import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mainSelectionFixture, sourceFingerprintFixture } from "../lib/teaser-test-fixture.mjs";
import { normalizeSourceContext } from "../lib/source-context/index.mjs";
import { createMainContentSelector } from "./main-content.mjs";

const source = { id: "source-main", kind: "upload", title: "Harvest", duration: 200 };
const context = normalizeSourceContext({ kind: "local", sourceId: source.id, title: source.title, duration: 200 });

async function setup(t, { digest = "d1", frames } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "main-frames-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const seen = [];
  let frameCalls = 0;
  const provider = {
    id: "chatgpt", model: "unit-only", reasoningPolicyKey: "unit",
    coverageDigest: async () => digest,
    coverageFrames: async () => {
      frameCalls++;
      if (frames instanceof Error) throw frames;
      return frames ?? {
        images: [{ index: 1, time: 50, file: "/x/1.jpg" }, { index: 2, time: 150, file: "/x/2.jpg" }],
        digest, manifest: { version: "v", count: 2, intervalSeconds: 100, times: [50, 150] },
      };
    },
    analyze: async (args) => { seen.push(args); return { value: mainSelectionFixture(args.input) }; },
  };
  const select = createMainContentSelector({ cacheRoot: root, fingerprint: async () => sourceFingerprintFixture, resolveProvider: async () => provider });
  return { select, seen, frameCalls: () => frameCalls, setDigest: (value) => { digest = value; } };
}

test("main selection attaches coverage stills, swaps the text-only rule and caches by visual identity", async (t) => {
  const f = await setup(t);
  const plan = await f.select.select(source, context, { instruction: "keep story" });
  assert.equal(f.seen.length, 1);
  const call = f.seen[0];
  assert.equal(call.images.length, 2);
  assert.ok(call.images.every((image) => typeof image.file === "string" && Number.isFinite(image.time)));
  assert.match(call.instructions, /uniformly sampled stills/);
  assert.ok(!call.instructions.includes("No images/video/audio are supplied"));
  assert.equal(call.input.visualCoverage.count, 2);
  assert.ok(plan.analysis.limitations.some((line) => /khung hình lấy mẫu đều/.test(line)));
  assert.ok(!plan.analysis.limitations.some((line) => /không gửi ảnh/.test(line)));
  await f.select.select(source, context, { instruction: "keep story" });
  assert.equal(f.seen.length, 1, "cache hit: no second request");
  assert.equal(f.frameCalls(), 1, "cache hit: stills are not extracted again");
});

test("a different visual identity is a different cache key", async (t) => {
  const f = await setup(t);
  await f.select.select(source, context, { instruction: "keep story" });
  f.setDigest("d2");
  await f.select.select(source, context, { instruction: "keep story" });
  assert.equal(f.seen.length, 2);
});

test("if stills cannot be produced the request stays text-only, says so, and is not cached", async (t) => {
  const f = await setup(t, { frames: new Error("ffmpeg missing") });
  const plan = await f.select.select(source, context, { instruction: "keep story" });
  assert.equal(f.seen[0].images.length, 0);
  assert.ok(f.seen[0].instructions.includes("No images/video/audio are supplied"), "canonical text-only rules when no stills");
  assert.ok(plan.analysis.limitations.some((line) => /không tạo được khung hình/.test(line)));
  await f.select.select(source, context, { instruction: "keep story" });
  assert.equal(f.seen.length, 2, "degraded result is never cached as the visual result");
});

test("providers without a visual lane keep the exact text-only behaviour", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "main-text-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const seen = [];
  const select = createMainContentSelector({
    cacheRoot: root, fingerprint: async () => sourceFingerprintFixture,
    resolveProvider: async () => ({ id: "x", model: "m", analyze: async (a) => { seen.push(a); return { value: mainSelectionFixture(a.input) }; } }),
  });
  await select.select(source, context, {});
  assert.deepEqual(seen[0].images, []);
  assert.ok(seen[0].instructions.includes("No images/video/audio are supplied"));
  assert.equal(seen[0].input.visualCoverage, undefined);
});
