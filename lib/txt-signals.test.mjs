import assert from "node:assert/strict";
import test from "node:test";
import { PROMPT_VERSIONS } from "./prompt-versions.mjs";
import { WEB_AI_PROMPT_VERSION, buildMusePrompt } from "./muse-plan.mjs";
import { buildCutPoints, buildTimeMap, compactSeries, compactTxtEvidence, expandSeries } from "./txt-signals.mjs";

const rows = (start, count, step, key, f = (i) => i / 100) =>
  Array.from({ length: count }, (_, i) => ({ start: start + i * step, end: start + (i + 1) * step, [key]: f(i) }));

test("columnar series round-trips to 3 decimals and keeps coverage gaps as separate runs", () => {
  const input = [...rows(0, 3, 0.5, "change"), ...rows(100, 2, 0.5, "change", (i) => 0.123456 + i)];
  const series = compactSeries(input, "change");
  assert.equal(series.step, 0.5);
  assert.equal(series.runs.length, 2);
  assert.deepEqual(series.runs[1], { start: 100, values: [0.123, 1.123] });
  const back = expandSeries(series);
  assert.equal(back.length, input.length);
  input.forEach((row, i) => {
    assert.equal(back[i].start, row.start);
    assert.equal(back[i].end, row.end);
    assert.ok(Math.abs(back[i].change - row.change) <= 0.0005);
  });
  assert.equal(compactSeries([{ start: 0, end: 1, v: 1 }, { start: 1, end: 3, v: 2 }], "v"), null, "uneven step is not encoded");
  assert.equal(compactSeries([{ start: 0, end: 1, v: NaN }, { start: 1, end: 2, v: 1 }], "v"), null);
  assert.equal(compactSeries([], "v"), null);
});

test("cut points flag sentence ends, pauses and silences in a compact string form", () => {
  const cues = [
    { cueId: "cue-0", start: 0, end: 2, text: "Hello there" },
    { cueId: "cue-1", start: 2.1, end: 4, text: "that is why it failed." },
    { cueId: "cue-2", start: 4.8, end: 6, text: "next thing" },
    { cueId: "cue-3", start: 6.05, end: 8, text: "ends quietly" },
  ];
  const points = buildCutPoints(cues, [{ start: 7.9, end: 9 }]);
  assert.deepEqual(points, ["cue-1@4:SP", "cue-3@8:Q"]);
  assert.ok(!points.some((p) => p.startsWith("cue-0")), "a 0.1 s gap in mid-sentence is not a cut point");
  assert.ok(points.every((p) => /^cue-\d+@[\d.]+:[SPQ]+$/.test(p)));
  assert.deepEqual(buildCutPoints([{ cueId: "a", start: 0, end: 1, text: "你好。" }]), ["a@1:S"]);
});

test("time map fuses channels, marks unsampled bins null and never zero-fills", () => {
  const map = buildTimeMap({
    duration: 20, binSeconds: 5,
    cues: [{ start: 0, end: 5, text: "abcdefghij" }],
    audioActivity: rows(0, 5, 1, "activity", () => 0.5),
    silences: [{ start: 2, end: 3 }],
    visualActivity: rows(10, 4, 0.5, "change", () => 0.1),
    commentTimes: [12, 13, 99],
    replayBins: [{ start: 15, end: 20, intensity: 0.9 }],
  });
  assert.equal(map.binSeconds, 5);
  assert.deepEqual(map.speechCharsPerSecond, [2, 0, 0, 0]);
  assert.deepEqual(map.audioActivity, [0.5, null, null, null]);
  assert.deepEqual(map.quietRatio, [0.2, null, null, null]);
  assert.deepEqual(map.sceneChange, [null, null, 0.4, null]);
  assert.deepEqual(map.commentTimestampMentions, [0, 0, 2, 0]);
  assert.deepEqual(map.replayIntensity, [null, null, null, 0.9]);
  const bare = buildTimeMap({ duration: 20, binSeconds: 5, cues: [] });
  assert.ok(!("audioActivity" in bare) && !("sceneChange" in bare) && !("replayIntensity" in bare), "absent channels are omitted");
  assert.equal(buildTimeMap({ duration: 0 }), null);
});

test("compacting evidence changes encodings only; cue text, ids and timing stay identical", () => {
  const evidence = {
    transcript: { cues: [{ cueId: "cue-0", start: 0, end: 2, text: "x.", timing: "cue" }], sourceText: "00:00 x." },
    audio: { data: { activity: rows(0, 4, 1, "activity", () => 0.7561245), silences: [{ start: 1, end: 2 }] } },
    visual: { data: { activity: rows(0, 4, 0.5, "change", () => 0.03078) } },
    replay: {
      bins: [{ startMs: 0, endMs: 1000, intensity: 0.5 }, { startMs: 1000, endMs: 2000, intensity: 0.8 }],
      sourceSamples: [
        { sourceTime: 0.5, intensity: 0.5, binStartMs: 0, binEndMs: 1000 },
        { sourceTime: 1.5, intensity: 0.8, binStartMs: 1000, binEndMs: 2000 },
      ],
    },
    comments: { items: [{ text: "t", timestampMentions: [1.5] }] },
    chapters: [],
  };
  const frozen = structuredClone(evidence);
  const out = compactTxtEvidence(evidence, { duration: 4 });
  assert.deepEqual(evidence, frozen, "input is never mutated");
  assert.deepEqual(out.transcript, evidence.transcript);
  assert.equal(out.audio.data.activity.runs[0].values[0], 0.756);
  assert.deepEqual(out.replay.sourceSamples, { sourceTime: [0.5, 1.5], intensity: [0.5, 0.8], binIndex: [0, 1] });
  assert.deepEqual(out.signalAvailability.missing, ["chapters"]);
  assert.deepEqual(out.signalAvailability.present.sort(), ["audioSignals", "captions", "comments", "mostReplayed", "visualSignals"]);
  assert.equal(out.txtFormat.notes.length, 3);
  assert.ok(out.cutPoints.includes("cue-0@2:SQ") || out.cutPoints.includes("cue-0@2:S"));
  assert.ok(out.timeMap.commentTimestampMentions.some((n) => n > 0));
  const bare = compactTxtEvidence({ transcript: { cues: [] } }, { duration: 10 });
  assert.deepEqual(bare.signalAvailability.present, []);
  assert.equal(bare.txtFormat.notes.length, 0);
});

test("v24 prompt carries the data guide and examples; older TXT versions stay importable", () => {
  assert.equal(WEB_AI_PROMPT_VERSION, "external-editing-full-media-compact-v24");
  assert.ok(PROMPT_VERSIONS.web.legacy.includes("external-editing-full-media-compact-v23"));
  const source = { id: "s", title: "T", duration: 100 };
  const text = buildMusePrompt("", { type: "object", properties: { parts: { items: { properties: {}, required: [] } } }, required: [] }, source, {
    requestId: "a".repeat(32), analysisKey: "k", context: { version: WEB_AI_PROMPT_VERSION, rules: undefined, videoEvidence: { x: 1 } },
  });
  assert.match(text, /TXT v24 DATA GUIDE/);
  assert.match(text, /BOUNDARY EXAMPLES \(synthetic/);
  assert.match(text, /signalAvailability/);
  assert.ok(text.indexOf("TXT v24 DATA GUIDE") < text.indexOf("REVIEW EFFORT"));
});
