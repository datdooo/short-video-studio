// Verify completed render artifacts without changing jobs or rendering another
// video. Protect opaque title/subtitle pixels and compare source/package evidence.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
const project = path.resolve(import.meta.dirname, ".."), scratch = path.join(project, ".isolation-verification/");
function arg(flag, required = true) {
  const index = process.argv.indexOf(flag); if (index < 0) { assert.ok(!required, `Missing ${flag}`); return null; }
  const file = path.resolve(process.argv[index + 1]); assert.ok(file.startsWith(scratch), "Only isolated QA artifacts are supported"); return file;
}
const sourceFile = arg("--source"), packageFile = arg("--packaged", false);
const source = JSON.parse(await readFile(sourceFile));
const packaged = packageFile ? JSON.parse(await readFile(packageFile)) : null;
let sampledFrames = 0, assets = 0;
if (packaged) {
  assert.equal(source.results.length, packaged.results.length);
  for (let i = 0; i < source.results.length; i++) {
    const a = source.results[i], b = packaged.results[i]; assert.equal(a.id, b.id); assert.deepEqual(a.style, b.style);
    for (let p = 0; p < a.parts.length; p++) {
      const x = a.parts[p], y = b.parts[p];
      for (const key of ["duration", "frames", "audioHash", "assets", "cutFrames"]) assert.deepEqual(x[key], y[key], `${a.id}: ${key}`);
      assert.deepEqual(x.metrics, y.metrics, `${a.id}: sampled frames/metrics`); sampledFrames += x.metrics.length; assets += Object.keys(x.assets).length;
    }
  }
}
function decoded(media, time) {
  assert.ok(media.startsWith(scratch));
  const result = spawnSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-ss", String(time), "-i", media, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.toString()); return sharp(result.stdout).removeAlpha().raw().toBuffer();
}
const protectedMetrics = [];
for (const result of source.results.filter((r) => r.transition !== "none")) {
  const control = source.results.find((r) => r.group === result.group && r.transition === "none"); assert.ok(control);
  for (let p = 0; p < result.parts.length; p++) {
    const part = result.parts[p], base = control.parts[p], directory = path.dirname(part.media);
    const masks = [{ role: "title", file: `part-${part.part}-titles.png` }, { role: "subtitle", file: Object.keys(part.assets).find((n) => /^subtitle-\d+\.png$/.test(n)) }];
    for (const metric of part.metrics.filter((m) => m.opacity === 1)) {
      const [actual, before] = await Promise.all([decoded(part.media, metric.time), decoded(base.media, metric.time)]);
      for (const { role, file } of masks) {
        assert.ok(file, `${result.id}: missing ${role} mask`);
        const rgba = await sharp(path.join(directory, file)).ensureAlpha().raw().toBuffer();
        let sum = 0, pixels = 0;
        for (let i = 0; i < rgba.length / 4; i += 3) if (rgba[i * 4 + 3] === 255) {
          pixels++; for (let c = 0; c < 3; c++) sum += Math.abs(actual[i * 3 + c] - before[i * 3 + c]);
        }
        assert.ok(pixels > 20); const mae = sum / (pixels * 3);
        assert.ok(mae < 5, `${result.id}/${role}: text must stay opaque/readable at cut (MAE ${mae})`);
        protectedMetrics.push({ id: result.id, part: part.part, boundary: metric.boundary, role, pixels, mae });
      }
    }
  }
}
const summary = { sourceFile, packageFile, cases: source.results.length, sourcePackageSampledFramesExact: sampledFrames, sourcePackageAssetsExact: assets, protectedTextChecks: protectedMetrics.length, maxTitleMae: Math.max(...protectedMetrics.filter((m) => m.role === "title").map((m) => m.mae)), maxSubtitleMae: Math.max(...protectedMetrics.filter((m) => m.role === "subtitle").map((m) => m.mae)), protectedMetrics };
await writeFile(arg("--output"), JSON.stringify(summary, null, 2));
console.log(`PASS ${summary.cases} transition cases; ${sampledFrames} source/package sampled frames, ${summary.protectedTextChecks} protected text checks`);
