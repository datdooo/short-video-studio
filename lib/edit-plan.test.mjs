import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, normalizePlan, finalDurationOf } from "./edit-plan.ts";

function fixture(duration) {
  return { originalTitle: "Video test", language: "en", parts: [1, 2].map((id) => ({
    id, title: `Part ${id}`, hook: "Actual quote", hashtags: Array.from({ length: 10 }, (_, index) => `#tag${index}`),
    segments: [{ start: (id - 1) * duration, end: id * duration, label: "Content", reason: "Continuous" }],
  })) };
}
test("AI parts must exceed 60 final seconds, strictly excluding cut gaps", () => {
  for (const provider of ["muse", "chatgpt", "gemini", "openai", "qwen"]) {
    for (const duration of [60, 74, 75]) assert.throws(() => normalizePlan(fixture(duration), provider), /75/);
    assert.ok(finalDurationOf(normalizePlan(fixture(75.1), provider).parts[0]) > 60);
  }
  const withGap = fixture(100);
  withGap.parts[0].segments = [{ start: 0, end: 30, label: "First", reason: "Cut promo" }, { start: 55, end: 100, label: "Second", reason: "After promo" }];
  assert.throws(() => normalizePlan(withGap, "muse"), /75/);
});
test("Mock/manual remain usable for short videos; prompt specifies post-speed-up minimum", () => {
  for (const provider of ["mock", "manual"]) assert.equal(normalizePlan(fixture(20), provider).parts.length, 2);
  const prompt = buildPrompt({ provider: "muse", originalTitle: "Test", transcript: "00:00 Content" });
  assert.match(prompt, /strictly greater than 60 seconds at 1.25x/);
  assert.match(prompt, /excluding removed gaps/);
  assert.match(prompt, /isPadding: true/);
});
test("padding may repeat any real source clip at the end without changing main chronology", () => {
  const value = fixture(40);
  value.parts[0].segments.push({ start: 60, end: 80, label: "Recap", reason: "Supplement", isPadding: true }, { start: 60, end: 80, label: "Repeat", reason: "Supplement", isPadding: true });
  value.parts[1].segments.push({ start: 0, end: 40, label: "Recap", reason: "Supplement", isPadding: true });
  const plan = normalizePlan(value, "muse");
  assert.equal(finalDurationOf(plan.parts[0]), 64);
  assert.equal(plan.parts[0].segments[2].start, 60);
  value.parts[0].segments.push({ start: 80, end: 90, label: "Invalid main", reason: "After padding" });
  assert.throws(() => normalizePlan(value, "muse"), /non-chronological/);
});
