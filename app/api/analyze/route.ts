import { NextResponse } from "next/server";

import {
  AnalyzeRequest,
  buildPrompt,
  EDIT_PLAN_SCHEMA,
  mockPlan,
  normalizePlan,
} from "@/lib/edit-plan";

export const runtime = "edge";

type ProviderErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string | null;
  };
};

class ProviderRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.code = code;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const milliseconds = Number.isFinite(seconds)
      ? seconds * 1_000
      : new Date(retryAfter).getTime() - Date.now();
    if (milliseconds > 8_000) return null;
    if (milliseconds > 0) return milliseconds + Math.floor(Math.random() * 250);
  }
  return 700 * 2 ** attempt + Math.floor(Math.random() * 350);
}

function openAIErrorMessage(status: number, body: ProviderErrorBody, retryAfter?: string | null) {
  const code = body.error?.code || body.error?.type || undefined;
  const actionByCode: Record<string, string> = {
    credit_balance_exhausted: "OpenAI hết credit. Vào Billing → Add credits rồi thử lại.",
    insufficient_quota: "OpenAI không còn quota khả dụng. Kiểm tra Billing/Credits và giới hạn của project.",
    organization_spend_limit_exceeded: "Organization OpenAI đã chạm spend limit. Tăng Organization limits rồi thử lại.",
    project_spend_limit_exceeded: "Project OpenAI đã chạm spend limit. Tăng Project limits rồi thử lại.",
    organization_usage_limit_exceeded: "Organization OpenAI đã chạm usage limit. Cần tăng usage limit hoặc liên hệ OpenAI Support.",
    slow_down: "OpenAI đang giới hạn tốc độ tạm thời. Đợi một chút rồi bấm Generate lại.",
    rate_limit_exceeded: "OpenAI đang giới hạn số request/token tạm thời. Đợi một chút rồi bấm Generate lại.",
  };
  const action = code ? actionByCode[code] : undefined;
  const serverMessage = body.error?.message?.trim();
  const waitHint = retryAfter ? ` Retry-After: ${retryAfter}.` : "";
  const codeHint = code ? ` [${code}]` : "";
  return `${action || serverMessage || `OpenAI request failed (${status}).`}${waitHint}${codeHint}`;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function analyzeWithOpenAI(request: AnalyzeRequest, suppliedApiKey?: string) {
  const apiKey = suppliedApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const requestBody = JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || "low" },
    store: false,
    instructions: "You are a precise short-form video editor. Return only the requested structured edit plan.",
    input: buildPrompt(request),
    text: {
      format: {
        type: "json_schema",
        name: "edit_plan",
        strict: true,
        schema: EDIT_PLAN_SCHEMA,
      },
    },
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (response.ok) {
      const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
      return normalizePlan(parseJson(outputText), "openai");
    }

    const body = await response.json().catch(() => ({})) as ProviderErrorBody;
    const code = body.error?.code || undefined;
    const type = body.error?.type;
    const retryable =
      (response.status === 429 && (type === "rate_limit_error" || code === "slow_down" || code === "rate_limit_exceeded")) ||
      (response.status === 503 && code === "server_is_overloaded");
    const delay = retryDelay(response, attempt);

    if (retryable && attempt < 2 && delay !== null) {
      await sleep(delay);
      continue;
    }

    throw new ProviderRequestError(
      openAIErrorMessage(response.status, body, response.headers.get("retry-after")),
      response.status,
      code,
    );
  }

  throw new ProviderRequestError("OpenAI vẫn đang rate-limit sau 3 lần thử. Đợi một chút rồi bấm Generate lại.", 429, "rate_limit_exceeded");
}

async function analyzeWithQwen(request: AnalyzeRequest, suppliedApiKey?: string) {
  const apiKey = suppliedApiKey || process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
  if (!apiKey) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.QWEN_MODEL || "qwen-plus",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a precise short-form video editor. Return only valid JSON matching the requested edit-plan shape." },
        { role: "user", content: `${buildPrompt(request)}\n\nJSON Schema:\n${JSON.stringify(EDIT_PLAN_SCHEMA)}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Qwen request failed (${response.status}).`);
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return normalizePlan(parseJson(data.choices?.[0]?.message?.content || ""), "qwen");
}

export async function POST(httpRequest: Request) {
  try {
    const suppliedApiKey = httpRequest.headers.get("x-provider-api-key")?.trim() || undefined;
    const request = (await httpRequest.json()) as AnalyzeRequest;
    if (request.provider === "muse" || request.provider === "gemini") return NextResponse.json({ error: "Muse và Gemini Pro dùng chế độ copy/dán JSON trong app, không gọi API/CLI hay fallback sang Mock." }, { status: 400 });
    if (!request.transcript?.trim()) {
      return NextResponse.json({ error: "Paste a timestamped transcript first." }, { status: 400 });
    }

    const plan =
      request.provider === "openai"
        ? await analyzeWithOpenAI(request, suppliedApiKey)
        : request.provider === "qwen"
          ? await analyzeWithQwen(request, suppliedApiKey)
          : null;

    return NextResponse.json(plan || mockPlan(request), {
      headers: { "X-AI-Fallback": plan ? "false" : "true" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create an edit plan.";
    const status = error instanceof ProviderRequestError ? error.status : 500;
    return NextResponse.json(
      { error: message, ...(error instanceof ProviderRequestError && error.code ? { code: error.code } : {}) },
      { status },
    );
  }
}
