import { NextResponse } from "next/server";

import {
  AnalyzeRequest,
  buildPrompt,
  EDIT_PLAN_SCHEMA,
  mockPlan,
  normalizePlan,
} from "@/lib/edit-plan";

export const runtime = "edge";

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

async function analyzeWithOpenAI(request: AnalyzeRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
    }),
  });

  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}).`);
  const data = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const outputText = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("") || "";
  return normalizePlan(parseJson(outputText), "openai");
}

async function analyzeWithQwen(request: AnalyzeRequest) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const baseUrl = process.env.QWEN_BASE_URL;
  if (!apiKey || !baseUrl) return null;

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
    const request = (await httpRequest.json()) as AnalyzeRequest;
    if (!request.transcript?.trim()) {
      return NextResponse.json({ error: "Paste a timestamped transcript first." }, { status: 400 });
    }

    const plan =
      request.provider === "openai"
        ? await analyzeWithOpenAI(request)
        : request.provider === "qwen"
          ? await analyzeWithQwen(request)
          : null;

    return NextResponse.json(plan || mockPlan(request), {
      headers: { "X-AI-Fallback": plan ? "false" : "true" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create an edit plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
