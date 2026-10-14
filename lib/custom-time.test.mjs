import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlan, buildPrompt } from "./edit-plan.ts";
import { applyPartTimes, partTimes, timeInput } from "./custom-time.mjs";
import { trimPartStart } from "../worker/part-start.mjs";

function fixture(provider = "gemini") {
  return normalizePlan({ originalTitle: "Test", language: "en", parts: [1, 2].map((id) => ({
    id, title: `Part ${id}`, hook: "Quote", hashtags: Array.from({ length: 10 }, (_, index) => `#tag${index}`),
    segments: [{ start: (id - 1) * 120, end: id * 120, label: "Main", reason: "Keep" }],
  })) }, provider);
}
test("all AI providers apply one second on import, never again on normalization/preview/export", () => {
  for (const provider of ["chatgpt", "gemini", "muse", "openai", "qwen"]) {
    const plan = fixture(provider);
    assert.deepEqual(plan.parts.map((part) => part.segments[0].start), [1, 121]);
    assert.deepEqual(plan.parts.map((part) => part.segments[0].end), [120, 240]);
    assert.deepEqual(normalizePlan(plan, provider).parts, plan.parts);
    assert.deepEqual(plan.parts.map(trimPartStart), plan.parts);
    assert.deepEqual(partTimes(plan), [{ start: "00:00:01", end: "00:02:00" }, { start: "00:02:01", end: "00:04:00" }]);
  }
});
test("manual override is authoritative, including undoing the AI start offset", () => {
  const plan = fixture();
  const times = [{ start: "0", end: "110" }, { start: "130.5", end: "230" }];
  const result = applyPartTimes(plan, times, 240);
  assert.deepEqual(result.parts.map((part) => part.segments[0].start), [0, 130.5]);
  assert.deepEqual(result.parts.map(trimPartStart), result.parts);
  assert.equal(plan.parts[0].segments[0].start, 1);
  assert.deepEqual(applyPartTimes(plan, times, 240), result);
  assert.equal(timeInput(1.5), "00:00:01.5");
  assert.deepEqual(applyPartTimes(result, partTimes(result), 240), result);
});
test("custom boundaries preserve ads already excluded and end padding", () => {
  const plan = fixture();
  plan.parts[0].segments = [{ start: 1, end: 50, label: "Before", reason: "Ad 50–60" }, { start: 60, end: 120, label: "After", reason: "Skip ad" }, { start: 200, end: 220, label: "Padding", reason: "Recap", isPadding: true }];
  const result = applyPartTimes(plan, [{ start: "10", end: "110" }, { start: "121", end: "240" }], 240);
  assert.deepEqual(result.parts[0].segments.map(({ start, end }) => [start, end]), [[10, 50], [60, 110], [200, 220]]);
  assert.throws(() => applyPartTimes(plan, [{ start: "55", end: "110" }, { start: "121", end: "240" }], 240), /đã loại bỏ/);
});
test("invalid custom edits block export instead of silently using AI times", () => {
  const plan = fixture();
  for (const times of [
    [{ start: "", end: "120" }, { start: "121", end: "240" }],
    [{ start: "00:99", end: "120" }, { start: "121", end: "240" }],
    [{ start: "120", end: "110" }, { start: "121", end: "240" }],
    [{ start: "1", end: "130" }, { start: "121", end: "240" }],
    [{ start: "1", end: "120" }, { start: "121", end: "241" }],
    [{ start: "50", end: "120" }, { start: "121", end: "240" }],
  ]) assert.throws(() => applyPartTimes(plan, times, 240));
});
test("additional prompts are optional and automatic promotional exclusions apply to every AI", () => {
  for (const provider of ["chatgpt", "gemini", "muse", "openai", "qwen"]) {
    const request = { provider, originalTitle: "Test", transcript: "00:00 Main", instruction: "Keep chronology" };
    assert.equal(buildPrompt(request), buildPrompt({ ...request, supplementalPrompt: "  " }));
    const prompt = buildPrompt({ ...request, supplementalPrompt: "Part 2: test drive" });
    assert.match(prompt, /Additional user editing requirements:\nPart 2: test drive/);
    assert.match(prompt, /credits.*sponsorship/);
    assert.match(prompt, /brand or product name alone is NOT/);
    assert.match(prompt, /BOTH parts/);
  }
});
