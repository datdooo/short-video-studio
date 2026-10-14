import test from "node:test";
import assert from "node:assert/strict";
import { smartCutPlan } from "./smart-cut.mjs";
import { trimPartStart } from "./part-start.mjs";
function plan() { return { providerUsed: "gemini", parts: [{ id: 1, segments: [{ start: 10, end: 110 }, { start: 5, end: 15, isPadding: true }] }, { id: 2, segments: [{ start: 110, end: 220 }] }].map(trimPartStart) }; }
test("smart cuts adjust once after +1s, stay chronological and preserve padding", () => {
  const original = plan();
  const data = { silences: [{ start: 11.4, end: 11.8 }, { start: 109.4, end: 109.8 }, { start: 111.4, end: 111.8 }, { start: 219.4, end: 219.8 }] };
  const adjusted = smartCutPlan(original, data, 220);
  assert.ok(Math.abs(adjusted.parts[0].segments[0].start - 11.6) < 0.001);
  assert.ok(Math.abs(adjusted.parts[0].segments[0].end - 109.6) < 0.001);
  assert.deepEqual(adjusted.parts[0].segments[1], original.parts[0].segments[1]);
  assert.deepEqual(smartCutPlan(adjusted, data, 220), adjusted);
  assert.deepEqual(adjusted.parts.map(trimPartStart), adjusted.parts);
  assert.equal(original.parts[0].segments[0].start, 11);
});
test("sentence boundaries complete speech, and uncertain or distant candidates do not invent cuts", () => {
  const original = plan();
  const adjusted = smartCutPlan(original, { cues: [{ start: 10, end: 12, text: "Hello." }, { start: 12, end: 20, text: "Next." }] }, 220);
  assert.equal(adjusted.parts[0].segments[0].start, 10);
  assert.equal(smartCutPlan(original, { silences: [{ start: 30, end: 31 }] }, 220).parts[0].segments[0].start, 11);
});
test("manual overrides are not snapped again and >60 second minimum is retained", () => {
  const original = plan(); original.parts[0].smartCutApplied = true; original.parts[0].segments[0].start = 13;
  assert.equal(smartCutPlan(original, { silences: [{ start: 13.2, end: 13.8 }] }, 220).parts[0].segments[0].start, 13);
  const short = { providerUsed: "muse", parts: [{ id: 1, startTrimApplied: true, segments: [{ start: 1, end: 76.1 }] }, { id: 2, startTrimApplied: true, segments: [{ start: 77, end: 160 }] }] };
  assert.equal(smartCutPlan(short, { silences: [{ start: 2, end: 2.5 }] }, 160).parts[0].segments[0].start, 1);
});
