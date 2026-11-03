import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AUDIO_ACTIVITY_MAX_ENTRIES, LOCAL_SIGNAL_VERSION, audioActivityStep, normalizeLocalSignals } from "../lib/auto-cut/local-signals.mjs";
import { createLocalSignalAnalyzer, mergeRanges, parseAudioSignals } from "./local-signals.mjs";

const audioLog = (frames, step) => Array.from({ length: frames }, (_, i) => `frame:${i} pts:${i} pts_time:${i * step}\nlavfi.astats.Overall.RMS_level=-20`).join("\n");
const videoLog = "frame:0 pts:0 pts_time:0\nlavfi.scd.score=0\nlavfi.scd.mafd=0\nframe:1 pts:1 pts_time:0.5\nlavfi.scd.score=30\nlavfi.scd.mafd=30";
async function fixture(t, run, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "local-audio-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return createLocalSignalAnalyzer({ ffmpeg: "/fixture", cacheRoot: dir, fingerprint: async (s) => s.id, run, ...options });
}
const isAudio = (args) => args.includes("-vn");

test("audio activity step keeps whole-source evidence under the entry cap", () => {
  assert.equal(audioActivityStep(600), 1);
  assert.equal(audioActivityStep(1800), 1);
  assert.equal(audioActivityStep(7200), 4);
  for (const duration of [60, 1800, 3601, 7200, 36000]) assert.ok(Math.ceil(duration / audioActivityStep(duration)) <= AUDIO_ACTIVITY_MAX_ENTRIES, String(duration));
  const parsed = parseAudioSignals(audioLog(3, 4), "silence_start: 1\nsilence_end: 2", { start: 0, end: 12 }, 4);
  assert.deepEqual(parsed.activity.map((row) => [row.start, row.end]), [[0, 4], [4, 8], [8, 12]]);
  assert.equal(parsed.silencesTruncated, false);
  assert.deepEqual(mergeRanges([{ start: 5, end: 9 }, { start: 0, end: 5 }, { start: 20, end: 25 }]), [{ start: 0, end: 9 }, { start: 20, end: 25 }]);
});

test("long source: ONE audio pass over the whole file, three windowed video passes, per-channel ranges", async (t) => {
  const calls = [];
  const run = async (_binary, args, options = {}) => {
    calls.push(args);
    if (isAudio(args)) {
      options.onStderr?.("[silencedetect] silence_start: 100\n[silencedetect] silence_end: 101.5");
      return { stdout: audioLog(1800, 4) };
    }
    return { stdout: videoLog };
  };
  const analyzer = await fixture(t, run);
  const value = await analyzer.analyze({ id: "long", mediaPath: "/m.mp4", duration: 7200, hasAudio: true });
  const audioCalls = calls.filter(isAudio);
  assert.equal(audioCalls.length, 1);
  assert.ok(!audioCalls[0].includes("-ss") && !audioCalls[0].includes("-t"), "no seek or duration window");
  assert.ok(audioCalls[0].join(" ").includes("asetnsamples=n=64000"), "4 s per value");
  assert.equal(calls.filter((args) => !isAudio(args)).length, 3);
  assert.equal(value.version, LOCAL_SIGNAL_VERSION);
  assert.equal(value.audio.status, "available");
  assert.deepEqual(value.audio.sampledRanges, [{ start: 0, end: 7200 }]);
  assert.equal(value.audio.activity.length, 1800);
  assert.deepEqual(value.audio.silences, [{ start: 100, end: 101.5 }]);
  assert.equal(value.visual.sampledRanges.length, 3);
  assert.equal(value.visual.sampledRanges.reduce((n, r) => n + r.end - r.start, 0), 180);
  assert.deepEqual(value.sampledRanges, [{ start: 0, end: 7200 }], "top-level ranges are the union");
});

test("a failed or timed-out audio pass degrades only audio; video still runs", async (t) => {
  const run = async (_b, args) => {
    if (isAudio(args)) throw new Error("boom");
    return { stdout: videoLog };
  };
  const value = await (await fixture(t, run)).analyze({ id: "a1", mediaPath: "/m.mp4", duration: 100, hasAudio: true });
  assert.equal(value.audio.status, "unavailable");
  assert.equal(value.audio.reason, "audio-analysis-unavailable");
  assert.deepEqual(value.audio.sampledRanges, []);
  assert.equal(value.visual.status, "available");

  const slow = async (_b, args, { signal } = {}) => {
    if (!isAudio(args)) return { stdout: videoLog };
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  };
  const keep = setTimeout(() => {}, 1000);
  t.after(() => clearTimeout(keep));
  const timed = await (await fixture(t, slow, { audioTimeoutMs: 20 })).analyze({ id: "a2", mediaPath: "/m.mp4", duration: 100, hasAudio: true });
  assert.equal(timed.audio.reason, "analysis-timeout");
  assert.equal(timed.visual.status, "available");
});

test("sources without audio never run an audio pass", async (t) => {
  const calls = [];
  const run = async (_b, args) => { calls.push(args); return { stdout: videoLog }; };
  const value = await (await fixture(t, run)).analyze({ id: "mute", mediaPath: "/m.mp4", duration: 100, hasAudio: false });
  assert.equal(calls.filter(isAudio).length, 0);
  assert.equal(value.audio.status, "disabled");
});

test("v2 validates each channel against its own ranges and rejects evidence outside them", () => {
  const base = (patch = {}) => ({
    version: LOCAL_SIGNAL_VERSION, sourceKey: "k", timeUnit: "source-seconds", sampledRanges: [{ start: 0, end: 600 }],
    visual: { status: "available", sampledRanges: [{ start: 0, end: 60 }], boundaries: [{ time: 10, change: 0.5 }], activity: [{ start: 10, end: 10.5, change: 0.2 }] },
    audio: { status: "available", sampledRanges: [{ start: 0, end: 600 }], silences: [{ start: 400, end: 401 }], activity: [{ start: 500, end: 501, activity: 0.4 }] },
    ...patch,
  });
  const ok = normalizeLocalSignals(base(), { duration: 600, sourceKey: "k" });
  assert.equal(ok.audio.status, "available");
  assert.deepEqual(ok.audio.sampledRanges, [{ start: 0, end: 600 }]);
  assert.deepEqual(ok.visual.sampledRanges, [{ start: 0, end: 60 }]);
  const badVisual = base();
  badVisual.visual.boundaries = [{ time: 300, change: 0.5 }];
  assert.equal(normalizeLocalSignals(badVisual, { duration: 600, sourceKey: "k" }).visual.reason, "invalid-local-evidence");
  const legacy = base();
  delete legacy.visual.sampledRanges;
  delete legacy.audio.sampledRanges;
  legacy.sampledRanges = [{ start: 0, end: 60 }];
  legacy.audio.silences = [{ start: 10, end: 11 }];
  legacy.audio.activity = [{ start: 10, end: 11, activity: 0.4 }];
  const migrated = normalizeLocalSignals(legacy, { duration: 600, sourceKey: "k" });
  assert.equal(migrated.audio.status, "available");
  assert.deepEqual(migrated.audio.sampledRanges, [{ start: 0, end: 60 }], "channels without their own list use the shared one");
  assert.equal(normalizeLocalSignals({ ...base(), version: "ffmpeg-local-v1" }, { duration: 600, sourceKey: "k" }).visual.reason, "invalid-or-source-mismatched");
});
