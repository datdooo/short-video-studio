import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { coverageManifestText, framedMainRules, framedTextInstructions } from "../lib/frame-rules.mjs";
import { MAIN_INSTRUCTIONS } from "../lib/auto-cut/main-content.mjs";
import { VIDEO_TEXT_INSTRUCTIONS } from "../lib/video-ai-input.mjs";
import { coverageCount, coverageTimes, createCoverageFrames } from "./coverage-frames.mjs";

async function fixture(duration = 1000) {
  const root = await mkdtemp(path.join(tmpdir(), "coverage-"));
  const mediaPath = path.join(root, "source.mp4");
  await writeFile(mediaPath, "x".repeat(2048));
  const calls = [];
  const run = async (_binary, args, options) => {
    options?.signal?.throwIfAborted();
    calls.push(args);
    await writeFile(args.at(-1), "jpeg");
  };
  const source = { id: "src", mediaPath, duration };
  return { root, source, calls, make: (env = {}) => createCoverageFrames({ root: path.join(root, "frames"), ffmpeg: "ffmpeg", run, env }), cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("count is bounded, evenly spaced and overridable", () => {
  assert.equal(coverageCount(20, {}), 8);
  assert.equal(coverageCount(60, {}), 12);
  assert.equal(coverageCount(1054, {}), 211);
  assert.equal(coverageCount(10_000, {}), 300);
  assert.equal(coverageCount(1000, { SHORTCUT_CODEX_FRAMES: "0" }), 0);
  assert.equal(coverageCount(1000, { SHORTCUT_CODEX_FRAMES: "12" }), 12);
  assert.equal(coverageCount(1000, { SHORTCUT_CODEX_FRAMES: "999" }), 0);
  assert.equal(coverageCount(NaN, {}), 0);
  const times = coverageTimes(100, 4);
  assert.deepEqual(times, [12.5, 37.5, 62.5, 87.5]);
});

test("stills are extracted once, cached by source identity, and pruned safely", async () => {
  const f = await fixture();
  try {
    const sampler = f.make();
    const first = await sampler.frames(f.source);
    assert.equal(first.images.length, coverageCount(1000, {}));
    assert.equal(first.manifest.count, first.images.length);
    assert.ok(first.images.every((image, i) => image.index === i + 1 && image.time > 0 && image.time < 1000));
    assert.equal(f.calls.length, first.images.length);
    for (const args of f.calls) {
      assert.ok(args.includes("-an") && args.includes("-frames:v"));
      assert.ok(args.indexOf("-ss") < args.indexOf("-i"), "fast input seek");
    }
    const again = await sampler.frames(f.source);
    assert.equal(f.calls.length, first.images.length, "second request is a cache hit");
    assert.equal(again.digest, first.digest);
    assert.equal(await sampler.digest(f.source), first.digest);
    // A changed source file changes identity.
    await writeFile(f.source.mediaPath, "y".repeat(4096));
    assert.notEqual(await sampler.digest(f.source), first.digest);
  } finally {
    await f.cleanup();
  }
});

test("disabled or unreadable sources return no frames and never throw from digest", async () => {
  const f = await fixture();
  try {
    assert.equal(await f.make({ SHORTCUT_CODEX_FRAMES: "0" }).frames(f.source), null);
    assert.equal(await f.make().digest({ id: "x", mediaPath: path.join(f.root, "missing.mp4"), duration: 100 }), null);
  } finally {
    await f.cleanup();
  }
});

test("extraction failure removes partial stills and surfaces the error", async () => {
  const f = await fixture();
  try {
    let n = 0;
    const sampler = createCoverageFrames({
      root: path.join(f.root, "frames"), ffmpeg: "ffmpeg", env: {},
      run: async (_b, args) => { if (++n === 3) throw new Error("ffmpeg boom"); await writeFile(args.at(-1), "jpeg"); },
    });
    await assert.rejects(sampler.frames(f.source), /ffmpeg boom/);
    const dirs = await readdir(path.join(f.root, "frames"));
    for (const dir of dirs) {
      const files = await readdir(path.join(f.root, "frames", dir));
      for (const file of files) assert.ok((await stat(path.join(f.root, "frames", dir, file))).size > 0, "only complete stills remain");
    }
  } finally {
    await f.cleanup();
  }
});

test("frame instruction variants swap only the text-only claims and fail loudly otherwise", () => {
  const framed = framedMainRules(MAIN_INSTRUCTIONS);
  assert.ok(!framed.includes("No images/video/audio are supplied"));
  assert.match(framed, /uniformly sampled stills/);
  assert.ok(MAIN_INSTRUCTIONS.includes("No images/video/audio are supplied"), "canonical text-only rules stay untouched");
  assert.throws(() => framedMainRules("unrelated rules"), /Frame prompt rule missing/);
  const text = framedTextInstructions(VIDEO_TEXT_INSTRUCTIONS);
  assert.ok(!text.startsWith("TEXT ONLY:"));
  assert.match(text, /TEXT PLUS SAMPLED STILLS/);
  assert.throws(() => framedTextInstructions("nothing"), /Frame prompt rule missing/);
  const manifest = { count: 3, intervalSeconds: 40, times: [20, 60, 100] };
  const block = coverageManifestText(manifest);
  assert.match(block, /Image 1 = source second 20\.0 \(0:20\)/);
  assert.match(block, /Image 3 = source second 100\.0 \(1:40\)/);
});
