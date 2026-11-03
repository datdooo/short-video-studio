import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, normalizePlan, finalDurationOf } from "./edit-plan.ts";

function fixture(duration) {
  return { originalTitle: "Video test", language: "en", parts: [1, 2].map((id) => ({
    id, title: `Part ${id}`, hook: "Actual quote", hashtags: Array.from({ length: 10 }, (_, index) => `#tag${index}`),
    segments: [{ start: (id - 1) * duration, end: id * duration, label: "Content", reason: "Continuous" }],
  })) };
}
test("AI imports preserve exact ranges without a minimum-duration or balance objective", () => {
  for (const provider of ["muse", "chatgpt", "gemini", "openai", "qwen", "mock", "manual"]) {
    for (const duration of [5, 20, 60, 75, 76.1]) {
      const value = fixture(duration), plan = normalizePlan(value, provider);
      assert.deepEqual(plan.parts.map(p => p.segments), value.parts.map(p => p.segments));
      assert.equal(finalDurationOf(plan.parts[0]), duration / 1.25);
    }
  }
});
test("prompt requests edited continuity rather than minimum duration or filler", () => {
  const prompt = buildPrompt({provider: "muse", originalTitle: "Test", transcript: "00:00 Content"});
  assert.match(prompt, /chronological|continuation/i);
  assert.match(prompt, /No mandatory minimum|no minimum|never.*padding/i);
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
