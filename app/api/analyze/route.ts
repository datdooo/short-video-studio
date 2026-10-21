import { NextResponse } from "next/server";
import {ANALYSIS_MODEL,ANALYSIS_SERVICE_TIER,lowestReasoning} from "@/lib/ai-reasoning.mjs";

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
    param?: string | null;
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

type AiRequestRecord = {
  model: string; actualModel?: string; requestedReasoning: string; actualReasoning?: string;
  requestedServiceTier?:string;actualServiceTier?:string;status: string; providerMs?: number; readMs?: number;
  usage?: Record<string, number>; retryReason?: string;
};
type AiDiagnostics = {
  kind: string; elapsedMs: number; requestCount: number; model?: string;
  reasoningPolicy?: string; requests: AiRequestRecord[];
  events: Array<{stage: string; elapsedMs: number; durationMs?: number; reason?: string}>;
};
type OpenAIResponse = ProviderErrorBody & {
  service_tier?:string;model?: string; status?: string; incomplete_details?: {reason?: string};
  reasoning?: {effort?: string}; usage?: Record<string, unknown>;
  output_text?: string; output?: Array<{content?: Array<{text?: string}>}>;
};

function sleep(milliseconds: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(signal.reason); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, {once: true});
    if (signal.aborted) abort();
  });
}

function responseUsage(value?: Record<string, unknown>) {
  const result: Record<string, number> = {};
  for (const field of ["input_tokens", "output_tokens", "total_tokens"]) {
    const count = value?.[field];
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) result[field] = count;
  }
  for (const [parent, field] of [["input_tokens_details", "cached_tokens"], ["output_tokens_details", "reasoning_tokens"]]) {
    const details = value?.[parent] as Record<string, unknown> | undefined;
    const count = details?.[field];
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) result[field] = count;
  }
  return Object.keys(result).length ? result : undefined;
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
  const waitSeconds = Number(retryAfter);
  const waitHint = retryAfter && Number.isFinite(waitSeconds) && waitSeconds > 0 ? ` Thử lại sau ${Math.ceil(waitSeconds)} giây.` : "";
  const codeHint = code && /^[a-zA-Z0-9_-]{1,80}$/.test(code) ? ` [${code}]` : "";
  // Upstream messages may echo an API-key fragment; only fixed text leaves here.
  return `${action || `OpenAI không hoàn tất yêu cầu (${status}).`}${waitHint}${codeHint}`;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function analyzeWithOpenAI(request: AnalyzeRequest, signal: AbortSignal, diagnostics: AiDiagnostics, started: number, suppliedApiKey?: string) {
  signal.throwIfAborted();
  const apiKey = suppliedApiKey || process.env.OPENAI_API_KEY;
  const model = ANALYSIS_MODEL;
  diagnostics.model = model;
  const policy = lowestReasoning(model);
  diagnostics.reasoningPolicy = policy.key;
  if (!apiKey) throw new ProviderRequestError("OpenAI chưa được cấu hình API key; không gửi AI hoặc tạo bản demo thay thế.", 503, "PROVIDER_NOT_CONFIGURED");

  const requestBody = JSON.stringify({
    model,
    reasoning: { effort: policy.effort },
    service_tier:ANALYSIS_SERVICE_TIER,
    max_output_tokens:4500,
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
  diagnostics.events.push({stage: "preparation", elapsedMs: Date.now() - started, durationMs: Date.now() - started});

  for (let attempt = 0; attempt < 3; attempt += 1) {
    signal.throwIfAborted();
    const record: AiRequestRecord = {model, requestedReasoning: policy.effort,requestedServiceTier:ANALYSIS_SERVICE_TIER, status: "pending"};
    diagnostics.requests.push(record); diagnostics.requestCount++;
    diagnostics.events.push({stage: "provider", elapsedMs: Date.now() - started});
    const providerStart = Date.now();
    let response: Response;
    try { response = await fetch("https://api.openai.com/v1/responses", {
      signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    }); } catch {
      record.providerMs = Date.now() - providerStart;
      record.status = signal.aborted ? "cancelled" : "network-error";
      signal.throwIfAborted();
      throw new ProviderRequestError("Không kết nối được OpenAI. Kiểm tra mạng rồi thử lại.", 502, "PROVIDER_NETWORK_ERROR");
    }
    record.providerMs = Date.now() - providerStart;
    record.status = `http-${response.status}`;
    diagnostics.events.push({stage: "reading", elapsedMs: Date.now() - started});
    const readingStart = Date.now();
    let data: OpenAIResponse;
    try { data = await response.json() as OpenAIResponse; }
    catch {
      record.readMs = Date.now() - readingStart;
      signal.throwIfAborted();
      throw new ProviderRequestError("OpenAI trả kết quả không đọc được. Thử phân tích lại.", 502, "INVALID_RESPONSE");
    }
    record.readMs = Date.now() - readingStart;
    record.usage = responseUsage(data.usage);
    if(['fast','priority','default','auto','flex','scale'].includes(data.service_tier||''))record.actualServiceTier=data.service_tier;
    if (typeof data.model === "string" && /^[A-Za-z0-9._:/-]{1,160}$/.test(data.model)) record.actualModel = data.model;
    if (typeof data.reasoning?.effort === "string" && ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"].includes(data.reasoning.effort)) record.actualReasoning = data.reasoning.effort;
    signal.throwIfAborted();

    if (response.ok) {
      if(record.actualReasoning&&record.actualReasoning!==policy.effort)throw new ProviderRequestError('REASONING_UNSUPPORTED: Provider trả mức reasoning khác yêu cầu thấp nhất; chưa áp dụng thành công.',400,'REASONING_UNSUPPORTED');
      if (data.status === "incomplete") {
        record.status = "incomplete";
        throw new ProviderRequestError("OpenAI chưa hoàn tất kết quả trong giới hạn output; chưa có bản cắt hợp lệ.", 502, "INVALID_RESPONSE_INCOMPLETE");
      }
      const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
      const validationStart = Date.now();
      try {
        const plan = normalizePlan(parseJson(outputText), "openai");
        signal.throwIfAborted(); record.status = "completed";
        return plan;
      } catch {
        signal.throwIfAborted(); record.status = "invalid-output";
        throw new ProviderRequestError("OpenAI trả bản cắt sai cấu trúc. Chưa áp dụng kết quả; thử phân tích lại.", 502, "INVALID_RESPONSE");
      } finally { diagnostics.events.push({stage: "validation", elapsedMs: Date.now() - started, durationMs: Date.now() - validationStart}); }
    }

    const body = data;
    if(response.status===400&&/service_tier|service tier|fast mode|priority processing/i.test(String(body.error?.param||'')+' '+String(body.error?.message||'')))throw new ProviderRequestError('FAST_MODE_UNSUPPORTED: Kết nối từ chối Faster; chưa bật thành công, không tự chuyển model hoặc chế độ.',400,'FAST_MODE_UNSUPPORTED');
    if (response.status === 400 && (body.error?.param === "reasoning" || body.error?.param === "reasoning.effort" || /reasoning/i.test(body.error?.message || "") && /unsupported|not supported|not allowed/i.test(body.error?.message || "")))
      throw new ProviderRequestError("REASONING_UNSUPPORTED: Kết nối/model từ chối mức reasoning đã cấu hình; chưa áp dụng thành công. Không tự nâng mức hoặc đổi model.", 400, "REASONING_UNSUPPORTED");
    const code = typeof body.error?.code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(body.error.code) ? body.error.code : undefined;
    const type = body.error?.type;
    const retryable =
      (response.status === 429 && (type === "rate_limit_error" || code === "slow_down" || code === "rate_limit_exceeded")) ||
      (response.status === 503 && code === "server_is_overloaded");
    const delay = retryDelay(response, attempt);

    if (retryable && attempt < 2 && delay !== null) {
      record.retryReason = response.status === 429 ? "provider-rate-limit" : "provider-overloaded";
      const retryStart = Date.now(), retryEvent = {stage: "retry", elapsedMs: Date.now() - started, reason: record.retryReason, durationMs: 0};
      diagnostics.events.push(retryEvent);
      try { await sleep(delay, signal); }
      finally { retryEvent.durationMs = Date.now() - retryStart; }
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

export async function POST(httpRequest: Request) {
  const started = Date.now();
  const diagnostics: AiDiagnostics = {kind: "legacy-generate", elapsedMs: 0, requestCount: 0, requests: [], events: []};
  const signal = AbortSignal.any([httpRequest.signal, AbortSignal.timeout(240_000)]);
  try {
    const suppliedApiKey = httpRequest.headers.get("x-provider-api-key")?.trim() || undefined;
    const request = (await httpRequest.json()) as AnalyzeRequest;
    if (request.provider === "muse" || request.provider === "gemini") return NextResponse.json({ error: "Muse và Gemini Pro dùng chế độ copy/dán JSON trong app, không gọi API/CLI hay fallback sang Mock." }, { status: 400 });
    if (!request.transcript?.trim()) {
      return NextResponse.json({ error: "Paste a timestamped transcript first." }, { status: 400 });
    }

    if (request.provider === "qwen") {
      diagnostics.model = process.env.QWEN_MODEL || "qwen-plus";
      throw new ProviderRequestError("REASONING_UNSUPPORTED: Kết nối Qwen hiện chưa xác minh được tham số reasoning thấp nhất; chưa gửi AI, không tự đổi model.", 400, "REASONING_UNSUPPORTED");
    }
    if (!["openai", "mock"].includes(request.provider)) throw new ProviderRequestError("Provider này phải dùng kết nối tương ứng trong app; không tạo bản demo thay thế.", 400, "PROVIDER_UNSUPPORTED");
    const plan = request.provider === "openai" ? await analyzeWithOpenAI(request, signal, diagnostics, started, suppliedApiKey) : mockPlan(request);
    diagnostics.elapsedMs = Date.now() - started;
    diagnostics.events.push({stage: "complete", elapsedMs: diagnostics.elapsedMs});
    return NextResponse.json({...plan, diagnostics}, {
      headers: { "X-AI-Fallback": request.provider === "mock" ? "true" : "false" },
    });
  } catch (error) {
    const code = error instanceof ProviderRequestError ? error.code : (error as {code?: string})?.code;
    const message = signal.aborted ? "Đã dừng phân tích hoặc hết thời gian chờ; chưa áp dụng kết quả." : error instanceof Error ? error.message : "Không tạo được bản cắt.";
    const status = signal.aborted ? 408 : error instanceof ProviderRequestError ? error.status : code === "REASONING_UNSUPPORTED" ? 400 : 500;
    diagnostics.elapsedMs = Date.now() - started;
    diagnostics.events.push({stage: signal.aborted ? "cancelled" : "error", elapsedMs: diagnostics.elapsedMs});
    return NextResponse.json(
      { error: message, ...(code ? {code} : {}), diagnostics },
      { status },
    );
  }
}
