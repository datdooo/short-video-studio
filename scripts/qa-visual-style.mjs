// Synthetic before/after regression. Archives source from an explicit Git ref;
// never reads installed apps, personal media, OAuth sessions or production ports.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { applyVisualTemplate } from "../lib/visual-style/templates.mjs";
import { getVisualPreset } from "../lib/visual-style/presets.mjs";
import { assertRuntimePortsAvailable, prepareRuntimeDirectories, resolveRuntime, runtimeEnvironment } from "../desktop/runtime-config.mjs";

const project = path.resolve(import.meta.dirname, "..");
const baselineRef = process.argv[process.argv.indexOf("--baseline") + 1];
if (!process.argv.includes("--baseline") || !/^[a-f0-9]{7,40}$/.test(baselineRef || "")) throw new Error("Pass --baseline <Phase-1-commit-SHA>.");
const ffmpeg = process.env.FFMPEG_PATH || "/opt/homebrew/bin/ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "/opt/homebrew/bin/ffprobe";
const port = 8887;
const api = `http://127.0.0.1:${port}`;
await assertRuntimePortsAvailable({ name: "VisualStyle synthetic QA", webPort: port, workerPort: port });
const scratch = path.join(project, ".isolation-verification");
await mkdir(scratch, { recursive: true });
const root = await mkdtemp(path.join(scratch, "visual-style-qa-"));
const baseline = path.join(root, "baseline");
await mkdir(baseline);
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: project, maxBuffer: 256 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, result.error?.message || result.stderr?.toString());
  return result.stdout;
}
const archive = run("git", ["archive", baselineRef, "worker", "lib", "public"]);
run("/usr/bin/tar", ["-xf", "-", "-C", baseline], { input: archive });
const fixture = path.join(root, "synthetic.mp4");
run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "6", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture]);
const fixtureBytes = await readFile(fixture);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
let worker;
let logs = "";
async function stop() {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  const exited = once(worker, "exit");
  worker.kill("SIGTERM");
  const timer = setTimeout(() => worker.kill("SIGKILL"), 5000);
  try { await exited; } finally { clearTimeout(timer); }
}
async function call(route, body, expected = 200) {
  const response = await fetch(`${api}${route}`, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const value = await response.json();
  assert.equal(response.status, expected, JSON.stringify(value));
  return value;
}
async function boot(sourceRoot, label, overrides = {}) {
  await assertRuntimePortsAvailable({ name: label, webPort: port, workerPort: port });
  const runtime = resolveRuntime({ profile: "development", home: path.join(root, label, "mock-home") });
  await prepareRuntimeDirectories(runtime);
  const dataRoot = path.join(root, label, "data");
  logs = "";
  worker = spawn(process.execPath, [path.join(sourceRoot, "worker/server.mjs")], {
    cwd: sourceRoot, stdio: ["ignore", "pipe", "pipe"],
    env: { ...runtimeEnvironment(runtime), MEDIA_WORKER_PORT: String(port), MEDIA_WORKER_DATA_DIR: dataRoot, MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, YT_DLP_PATH: path.join(project, ".local-tools/yt-dlp"), FFMPEG_VIDEO_ENCODER: "libx264", FFMPEG_PRESET: "ultrafast", FFMPEG_CRF: "18", FFMPEG_CONTRAST: "1.04", FFMPEG_SATURATION: "1.06", ...overrides },
  });
  worker.stdout.on("data", (chunk) => { logs += chunk; });
  worker.stderr.on("data", (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const health = await call("/health");
      assert.equal(health.dataRoot, dataRoot);
      assert.equal(health.ok, true);
      return { dataRoot, health };
    } catch {
      if (worker.exitCode !== null || worker.signalCode !== null || attempt === 119) throw new Error(logs);
      await sleep(250);
    }
  }
}
function plan(source, withSubtitles, canonical) {
  const result = { originalTitle: source.title, providerUsed: "manual", language: "en", parts: [1, 2].map((id) => ({ id, title: `DEFAULT PART ${id} 日本語 한국어`, startTrimApplied: true, segments: [{ start: (id - 1) * 3, end: id * 3 }], hashtags: [] })) };
  const subtitle = { enabled: withSubtitles, source: "youtube", font: "auto", size: 48, color: "#ffffff", outlineColor: "#111111", outline: 3, position: "bottom" };
  if (canonical) result.visualStyle = { ...(process.argv.includes("--current-template") ? applyVisualTemplate(undefined, "current") : getVisualPreset()), subtitle };
  else if (withSubtitles) result.subtitles = subtitle;
  if (withSubtitles) result.captionCues = { sourceId: source.id, sourceDuration: source.duration, timeline: "source", cues: [{ start: 0.4, end: 1.8, text: "Caption 日本語 한국어" }, { start: 3.4, end: 4.8, text: "Second caption Français" }] };
  return result;
}
async function render(dataRoot, withSubtitles, canonical) {
  const uploaded = await fetch(`${api}/api/sources/upload?filename=DEFAULT%20SOURCE.mp4`, { method: "POST", body: fixtureBytes });
  assert.equal(uploaded.status, 201);
  const { source } = await uploaded.json();
  const submitted = plan(source, withSubtitles, canonical);
  const { job } = await call("/api/render", { sourceId: source.id, plan: submitted }, 202);
  let done;
  const maxPolls = process.argv.includes("--slow-host") ? 2400 : 360;
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    done = (await call(`/api/jobs/${job.id}`)).job;
    assert.notEqual(done.state, "error", `${done.error}\n${logs}`);
    if (done.state === "done") break;
    await sleep(250);
  }
  assert.equal(done.state, "done", logs);
  if (canonical) {
    assert.deepEqual(done.plan.visualStyle, submitted.visualStyle);
    assert.deepEqual(done.plan.subtitles, submitted.visualStyle.subtitle);
  }
  const result = [];
  for (const output of done.outputs) {
    const media = path.join(dataRoot, "sources", decodeURIComponent(output.url.slice("/files/".length)));
    const info = JSON.parse(run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", media]).toString());
    const video = info.streams.find((s) => s.codec_type === "video");
    assert.deepEqual([video.width, video.height, video.r_frame_rate], [1080, 1920, "30/1"]);
    assert.ok(Math.abs(Number(info.format.duration) - 2.4) < 0.05);
    const rawFrameHashes = run(ffmpeg, ["-v", "error", "-i", media, "-map", "0:v", "-f", "framemd5", "-"]).toString().split("\n").filter((line) => line && !line.startsWith("#"));
    const directory = path.dirname(media);
    const graphics = {};
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".png")).sort()) graphics[filename] = hash(await readFile(path.join(directory, filename)));
    result.push({ part: output.part, width: video.width, height: video.height, duration: Number(info.format.duration), rawFrameHashes, graphics });
  }
  assert.equal(result.length, 2);
  return result;
}
try {
  const before = await boot(baseline, "before");
  assert.deepEqual([before.health.render.contrast, before.health.render.saturation], [1.04, 1.06]);
  const beforeDefault = await render(before.dataRoot, false, false);
  const beforeSubtitle = await render(before.dataRoot, true, false);
  await stop();
  console.log("PASS baseline synthetic default and subtitle renders");
  const after = await boot(project, "after");
  assert.deepEqual([after.health.render.contrast, after.health.render.saturation], [1.04, 1.06]);
  const afterLegacy = await render(after.dataRoot, false, false);
  const afterDefault = await render(after.dataRoot, false, true);
  const afterSubtitle = await render(after.dataRoot, true, true);
  // Compare decoded pixels, timestamps, dimensions, and title/subtitle PNGs.
  // Encoded container bytes are intentionally not used as a visual assertion.
  assert.deepEqual(afterLegacy, beforeDefault);
  assert.deepEqual(afterDefault, beforeDefault);
  assert.deepEqual(afterSubtitle, beforeSubtitle);
  await stop();
  console.log("PASS all decoded frames and title/subtitle PNGs match baseline; 1080x1920 at 30 fps, 2.4 seconds per part");
  const overridden = await boot(project, "overrides", { FFMPEG_CONTRAST: "1.2", FFMPEG_SATURATION: "1.3" });
  assert.deepEqual([overridden.health.render.contrast, overridden.health.render.saturation], [1.2, 1.3]);
  await stop();
  const invalid = await boot(project, "invalid-overrides", { FFMPEG_CONTRAST: "Infinity", FFMPEG_SATURATION: "bad" });
  assert.deepEqual([invalid.health.render.contrast, invalid.health.render.saturation], [1.04, 1.06]);
  await stop();
  await writeFile(path.join(root, "result.json"), JSON.stringify({ baselineRef, syntheticOnly: true, decodedFramesIdentical: true, graphicsIdentical: true, output: { width: 1080, height: 1920, fps: 30, duration: 2.4 }, legacyAndCanonicalStyleMatch: true, environmentOverridesPreserved: true, clipsCompared: 6 }, null, 2));
  console.log(`PASS environment overrides preserved. QA artifacts: ${root}`);
} finally { await stop(); }
