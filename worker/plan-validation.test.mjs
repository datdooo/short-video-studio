import test from "node:test";
import assert from "node:assert/strict";
import { validatePlan } from "./plan-validation.mjs";

function fixture() {
  return { providerUsed: "muse", parts: [1, 2].map((id) => ({ title: `Part ${id}`, segments: [
    { start: (id - 1) * 10, end: id * 10, isPadding: false },
    ...Array.from({ length: 4 }, () => ({ start: 0, end: 20, isPadding: true })),
  ] })) };
}

test("render accepts supplemental footage from anywhere in source, only after ordered main content", () => {
  const source = { duration: 20 };
  assert.doesNotThrow(() => validatePlan(fixture(), source));
  for (const mutation of [
    (p) => { p.parts[0].segments[0].isPadding = true; },
    (p) => { p.parts[0].segments[2].isPadding = false; },
    (p) => { p.parts[1].segments[0].start = 9; },
    (p) => { p.parts[0].segments[1].end = 21; },
    (p) => { p.parts[0].segments[1].isPadding = "true"; },
  ]) {
    const plan = fixture(); mutation(plan);
    assert.throws(() => validatePlan(plan, source));
  }
});

test("render enforces the AI final minimum again; manual short cuts remain supported", () => {
  for (const provider of ["muse", "chatgpt", "gemini", "openai", "qwen"]) {
    const plan = fixture(); plan.providerUsed = provider;
    plan.parts[0].segments = [{ start: 0, end: 75 }];
    plan.parts[1].segments = [{ start: 75, end: 151 }];
    assert.throws(() => validatePlan(plan, { duration: 151 }), /75/);
    plan.parts[0].segments[0].end = 75.1;
    plan.parts[1].segments[0].start = 75.1;
    assert.doesNotThrow(() => validatePlan(plan, { duration: 151 }));
  }
  const manual = fixture(); manual.providerUsed = "manual";
  manual.parts.forEach((part) => { part.segments = part.segments.slice(0, 1); });
  assert.doesNotThrow(() => validatePlan(manual, { duration: 20 }));
});
