import test from "node:test";
import assert from "node:assert/strict";
import { fallbackTeaser, presentationSegments, presentationDuration, validateTeaser, hookTransitionId } from "./teaser-hooks.mjs";
import { partCaptions } from "./subtitles.mjs";
import { locateTimelineTime } from "./preview-timeline.mjs";
import { snapshotPlanVisualStyle } from "./visual-style/normalize.mjs";
const legacy=p=>({version:1,status:"selected",start:p.segments[0].start,end:p.segments[0].start+6.25,selection:"fallback",reason:"Historical serialized hook fixture",relation:"Same part",evidenceTimes:[p.segments[0].start],limitations:[],provider:"none",model:"none",promptVersion:"same-part-hook-v1",inputKey:"0".repeat(64),rangeKey:JSON.stringify(p.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end])),transition:"inherit-or-dip-black"});
const part = (start = 0) => ({ id: start ? 2 : 1, segments: [{ start, end: start + 10 }, { start: start + 12, end: start + 16 }] });
test("same-part hooks duplicate footage without changing main ranges; legacy unchanged", () => {
  for (const start of [0, 30]) {
    const p = part(start), before = structuredClone(p);
    assert.strictEqual(presentationSegments(p), p.segments);
    p.teaser = legacy(p);
    assert.deepEqual(p.segments, before.segments);
    assert.equal((p.teaser.end - p.teaser.start) / 1.25, 5);
    assert.deepEqual(presentationSegments(p).slice(1), p.segments);
    assert.equal(presentationDuration(p), 20.25);
    assert.deepEqual(legacy(p), p.teaser);
    assert.equal(hookTransitionId(p, "none"), "dip-black");
    assert.equal(hookTransitionId(p, "flash-white"), "flash-white");
  }
});
test("short/empty main ranges are explicitly shortened or unavailable; padding excluded", () => {
  assert.equal(fallbackTeaser({ id: 1, segments: [] }).status, "unavailable");
  const p = { id: 1, segments: [{ start: 1, end: 3 }, { start: 80, end: 100, isPadding: true }] };
  assert.equal(fallbackTeaser(p).status, "unavailable");
  assert.equal(fallbackTeaser({ id: 1, segments: [{ start: 0, end: 0.1 }] }).status, "unavailable");
  assert.equal(fallbackTeaser({ id: 1, segments: [{start:0,end:0.01},{start:1,end:10}] }).status,"unavailable","Entry too short to carry the required transition");
});
test("reject cross-part/gap/padding hooks, malformed provenance, stale ranges and untrusted extras", () => {
  const p = part(); p.teaser = legacy(p);
  for (const patch of [{ start: 31, end: 37 }, { start: 8, end: 14 }, { end: Infinity }, { start: "0" }, { selection: "ai", provider: "" }, { evidenceTimes: [80] }, { rangeKey: "stale" }, { url: "https://x" }]) assert.throws(() => validateTeaser({ ...p, teaser: { ...p.teaser, ...patch } }));
  const changed = { ...p, segments: [{ start: 20, end: 30 }] };
  assert.strictEqual(presentationSegments(changed), changed.segments);
});
test("caption cue repeats at teaser and original occurrence; seek maps repeated source independently", () => {
  const p = part(); p.teaser = legacy(p);
  const segments = presentationSegments(p);
  const cues = partCaptions([{ start: 1, end: 2, text: "Same cue" }], p);
  assert.deepEqual(cues.map(c => [c.start,c.end]), [[1,2],[7.25,8.25]]);
  assert.equal(locateTimelineTime(segments, 0.8).sourceTime, 1);
  assert.equal(locateTimelineTime(segments, 5.8).sourceTime, 1);
});
test("job snapshot severs hook metadata, evidence and main range references", () => {
  const p = part(); p.teaser = legacy(p);
  const saved = snapshotPlanVisualStyle({ parts: [p] });
  p.teaser.evidenceTimes[0] = 99; p.segments[0].start = 99;
  assert.equal(saved.parts[0].teaser.evidenceTimes[0], 0);
  assert.equal(saved.parts[0].segments[0].start, 0);
});
