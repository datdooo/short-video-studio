import {makeSource} from "../lib/teaser-test-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { validatePlan } from "./plan-validation.mjs";

function fixture() {
  return { providerUsed: "muse", parts: [1, 2].map((id) => ({ id, title: `Part ${id}`, segments: [
    { start: (id - 1) * 10, end: id * 10, isPadding: false },
    ...Array.from({ length: 4 }, () => ({ start: 0, end: 20, isPadding: true })),
  ] })) };
}

test("render accepts supplemental footage from anywhere in source, only after ordered main content", () => {
  const source = makeSource({duration: 20});
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

test("render does not impose the retired AI duration minimum; short manual cuts remain valid", () => {
  for (const provider of ["muse", "chatgpt", "gemini", "openai", "qwen", "manual"]) {
    const plan = fixture(); plan.providerUsed = provider;
    plan.parts[0].segments = [{ start: 0, end: 5 }];
    plan.parts[1].segments = [{ start: 5, end: 12 }];
    assert.doesNotThrow(() => validatePlan(plan, makeSource({duration: 20})));
  }
});
