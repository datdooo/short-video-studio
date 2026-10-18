// Synthetic source/package worker QA. Never uses installed apps or user media.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { OVERLAY_PRESET_IDS, getOverlayPreset, getOverlayAsset } from "../lib/visual-style/overlays.mjs";
import { applyOverlayPreset, applyOverlayOpacity } from "../lib/visual-style/overlay-presets.mjs";
import { applyBackgroundPreset } from "../lib/visual-style/background-presets.mjs";
import { applyFilterPreset, applyFilterIntensity } from "../lib/visual-style/filter-presets.mjs";
import { applyTextPreset } from "../lib/visual-style/text-presets.mjs";
import { assertRuntimePortsAvailable, prepareRuntimeDirectories, resolveRuntime, runtimeEnvironment } from "../desktop/runtime-config.mjs";

const project = path.resolve(import.meta.dirname, "..");
const packaged = process.argv.includes("--packaged");
const resources = path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources");
const app = packaged ? path.join(resources, "app") : project;
const node = packaged ? path.join(resources, "runtime/bin/node") : process.execPath;
const ffmpeg = packaged ? path.join(resources, "runtime/bin/ffmpeg") : "/opt/homebrew/bin/ffmpeg";
const ffprobe = packaged ? path.join(resources, "runtime/bin/ffprobe") : "/opt/homebrew/bin/ffprobe";
const port = Number(process.env.QA_FILTER_PORT || 8887);
assert.ok([8887, 8897].includes(port), "Only isolated QA ports are allowed");
const api = `http://127.0.0.1:${port}`;
await assertRuntimePortsAvailable({ name: "Video filter QA", webPort: port, workerPort: port });
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, `.isolation-verification/overlay-${packaged ? "package" : "source"}-`));
const runtime = resolveRuntime({ profile: "development", home: path.join(root, "mock-home") });
await prepareRuntimeDirectories(runtime);
const dataRoot = path.join(root, "media");
const fontConfig = path.join(root, "fonts.xml");
const xml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(fontConfig, `<fontconfig><dir>${xml(path.join(app, "public"))}</dir><cachedir>${xml(path.join(root, "font-cache"))}</cachedir></fontconfig>`);
const preload = path.join(root, "offline.mjs");
await writeFile(preload, 'globalThis.fetch = async () => { throw new Error("QA worker fetch blocked"); };');
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: app, maxBuffer: 128 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, result.error?.message || result.stderr?.toString()); return result.stdout;
}
assert.match(run(node, ["--version"]).toString(), /^v22\./);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const width = 960, height = 540;
const pixels = Buffer.alloc(width * height * 3, 128);
const image = path.join(root, "patches.png"), fixture = path.join(root, "Filter fixture.mp4");
await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(image);
run(ffmpeg, ["-v", "error", "-loop", "1", "-i", image, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "2", "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "0", "-c:a", "aac", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", fixture]);
const points = [{ x: 6, y: 900 }, { x: 23, y: 900 }, { x: 40, y: 40 }, { x: 540, y: 960 }, { x: 560, y: 690 }, { x: 60, y: 335 }, { x: 50, y: 49 }, { x: 800, y: 1100 }, { x: 540, y: 1880 }];
async function pixelsOf(file) { return (await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data; }
function sample(data) {
  return points.map(({ x, y }) => {
    const rgb = [0, 0, 0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let c = 0; c < 3; c++) rgb[c] += data[((y + dy) * 1080 + x + dx) * 3 + c] / 25;
    return rgb.map((v) => Number(v.toFixed(6)));
  });
}
let worker, logs = "";
async function stop() {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  const exited = once(worker, "exit"); worker.kill("SIGTERM");
  const timer = setTimeout(() => worker.kill("SIGKILL"), 5000); await exited; clearTimeout(timer);
}
async function call(route, body, status = 200) {
  const response = await fetch(api + route, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
}
async function boot(overrides = {}) {
  logs = "";
  worker = spawn(node, ["--import", preload, path.join(app, "worker/server.mjs")], { cwd: app, stdio: ["ignore", "pipe", "pipe"], env: { ...runtimeEnvironment(runtime), MEDIA_WORKER_DATA_DIR: dataRoot, MEDIA_WORKER_PORT: String(port), MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, YT_DLP_PATH: path.join(project, ".local-tools/yt-dlp"), FONTCONFIG_FILE: fontConfig, FFMPEG_VIDEO_ENCODER: "libx264", FFMPEG_PRESET: "ultrafast", FFMPEG_CRF: "18", FFMPEG_CONTRAST: "1.04", FFMPEG_SATURATION: "1.06", ...overrides } });
  worker.stdout.on("data", (c) => { logs += c; }); worker.stderr.on("data", (c) => { logs += c; });
  for (let i = 0; i < 120; i++) { try { assert.equal((await call("/health")).dataRoot, dataRoot); return; } catch { assert.equal(worker.exitCode, null, logs); assert.ok(i < 119, logs); await delay(250); } }
}
let source;
const expectedGraphics = {};
const results = [], cards = [];
async function render(id, { filter = "vivid", intensity = 0, text = "minimal", background = "black", opacity, stack = false } = {}) {
  let style = applyOverlayPreset(applyBackgroundPreset(applyFilterIntensity(applyFilterPreset(applyTextPreset(undefined, text), filter), intensity), background), id);
  if (opacity !== undefined) style = applyOverlayOpacity(style, opacity);
  if (stack) style.overlays.push(...getOverlayPreset("soft-glow").overlays);
  style.subtitle.enabled = true;
  const plan = { originalTitle: "FILTER FIXTURE", providerUsed: "manual", language: "en", visualStyle: style, parts: [1, 2].map((part) => ({ id: part, title: "COLOR CHECK", startTrimApplied: true, hashtags: [], segments: [{ start: part - 1, end: part }] })), captionCues: { sourceId: source.id, sourceDuration: 2, timeline: "source", cues: [{ start: 0.1, end: 0.9, text: "Caption 日本語 한국어" }, { start: 1.1, end: 1.9, text: "Caption 日本語 한국어" }] } };
  const expected = structuredClone(style);
  const started = performance.now();
  const { job } = await call("/api/render", { sourceId: source.id, plan }, 202);
  plan.visualStyle.overlays.length = 0;
  assert.deepEqual((await call(`/api/jobs/${job.id}`)).job.plan.visualStyle, expected);
  let done;
  for (let i = 0; i < 480; i++) { done = (await call(`/api/jobs/${job.id}`)).job; assert.notEqual(done.state, "error", `${done.error}\n${logs}`); if (done.state === "done") break; await delay(250); }
  assert.equal(done.state, "done", logs); assert.equal(done.outputs.length, 2);
  const jobMs = Date.parse(done.finishedAt) - Date.parse(done.startedAt);
  let media;

  for (const output of done.outputs) {
    const file = path.join(dataRoot, "sources", decodeURIComponent(output.url.slice("/files/".length)));
    const info = JSON.parse(run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
    const video = info.streams.find((stream) => stream.codec_type === "video");
    assert.deepEqual([video.width, video.height, video.r_frame_rate, video.color_space, video.color_transfer, video.color_primaries], [1080, 1920, "30/1", "bt709", "bt709", "bt709"]);
    assert.ok(info.streams.some((stream) => stream.codec_type === "audio"));
    assert.ok(Math.abs(Number(info.format.duration) - 0.8) < 0.06);
    const directory = path.dirname(file), graphics = {};
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".png") && !name.endsWith("-scene-titles.png")).sort()) graphics[name] = hash(await readFile(path.join(directory, name)));
    expectedGraphics[`${text}-${output.part}`] ||= graphics;
    assert.deepEqual(graphics, expectedGraphics[`${text}-${output.part}`], "Filters must not change any title/subtitle/shine pixels");
    media ||= file;

  }
  const label = `${id}-${filter}-${Math.round(intensity * 100)}-${text}-${background}-${opacity ?? "default"}-${stack}`, frame = path.join(root, `${label}.png`);
  await writeFile(frame, run(ffmpeg, ["-v", "error", "-ss", "0.4", "-i", media, "-vf", "scale=in_color_matrix=bt709:flags=accurate_rnd+full_chroma_int", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]));
  const data = await pixelsOf(frame), samples = sample(data);
  // Same static fixture/time: no animation and no per-frame asset generation.
  const secondFrame = path.join(root, `${label}-later.png`);
  await writeFile(secondFrame, run(ffmpeg, ["-v", "error", "-ss", "0.6", "-i", media, "-vf", "scale=in_color_matrix=bt709:flags=accurate_rnd+full_chroma_int", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]));
  const later = sample(await pixelsOf(secondFrame));
  assert.ok(later.flat().every((v, i) => Math.abs(v - samples.flat()[i]) <= 2), "Static overlay regions must remain stable across frames");
  const result = { jobMs, id, filterId: filter, intensity, text, background, opacity, stack, overlays: expected.overlays, samples, frame, media, frameHash: hash(await readFile(frame)), jobId: job.id, renderMs: performance.now() - started };
  console.log(`PASS ${packaged ? "packaged" : "source"} ${label}: snapshot, static assets, text PNGs, audio/timing/geometry`);
  return result;
}
try {
  await boot();
  const response = await fetch(api + "/api/sources/upload?filename=Filter%20fixture.mp4", { method: "POST", body: await readFile(fixture) });
  assert.equal(response.status, 201); ({ source } = await response.json());
  if (process.argv.includes("--performance")) {
    for (let repeat = 0; repeat < 2; repeat++) for (const id of ["none", "grain", "none", "vignette", "none", "soft-glow", "none", "film-frame", "none", "rec-hud", "none"]) results.push(await render(id));
  } else {
  for (const id of OVERLAY_PRESET_IDS) results.push(await render(id));
  results.push(await render("grain", { opacity: 0 }));
  results.push(await render("rec-hud", { opacity: 0.5 }));
  results.push(await render("vignette", { stack: true }));
  for (const id of ["none", "grain", "vignette"]) results.push(await render(id, { background: "current" }));
  for (const [text, filter, background, id] of [["current", "current", "current", "none"], ["shorts-bold", "vivid", "dark-blur", "grain"], ["yellow-hook", "nature", "black", "vignette"], ["jp-clean", "clean", "light-blur", "soft-glow"], ["kr-clean", "muted", "soft-gradient", "film-frame"], ["news", "contrast", "dark-gradient", "rec-hud"]]) results.push(await render(id, { text, filter, background, intensity: 1 }));
  for (const filter of ["vivid", "muted"]) results.push(await render("rec-hud", { filter, intensity: 1, background: "black" }));
  results.push(await render("none")); // Warm end control for approximate timing.
  const baseline = results[0], baselineData = await pixelsOf(baseline.frame);
  assert.equal(results.find((r) => r.id === "grain" && r.opacity === 0).frameHash, baseline.frameHash, "Zero opacity must preserve None exactly");
  for (const result of results.slice(1, 6)) {
    const overlay = result.overlays[0], asset = getOverlayAsset(overlay.assetId);
    const assetData = (await sharp(path.join(app, "public/overlays", asset.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
    const expected = Buffer.from(baselineData);
    for (let i = 0, p = 0; i < expected.length; i += 3, p += 4) {
      const alpha = Math.round(assetData[p + 3] * overlay.opacity) / 255;
      for (let c = 0; c < 3; c++) expected[i + c] = Math.round(baselineData[i + c] * (1 - alpha) + assetData[p + c] * alpha);
    }
    const expectedSamples = sample(expected), errors = result.samples.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - expectedSamples[i][c])));
    result.compositeMae = errors.reduce((a, b) => a + b) / errors.length; result.compositeMax = Math.max(...errors);
    assert.ok(result.compositeMae <= 1.5 && result.compositeMax <= 3, `${result.id}: overlay alpha/color/geometry mismatch ${result.compositeMae}/${result.compositeMax}`);
    assert.notEqual(result.frameHash, baseline.frameHash);
  }
  const luma = (rgb) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  const find = (id) => results.find((r) => r.id === id);
  assert.ok(luma(find("vignette").samples[0]) < luma(baseline.samples[0]) - 10);
  assert.ok(Math.abs(luma(find("vignette").samples[3]) - luma(baseline.samples[3])) <= 2);
  assert.ok(luma(find("soft-glow").samples[4]) > luma(baseline.samples[4]) + 5);
  for (const id of ["film-frame", "rec-hud"]) assert.ok(Math.abs(luma(find(id).samples[3]) - luma(baseline.samples[3])) <= 2);
  assert.ok(luma(find("film-frame").samples[0]) < luma(baseline.samples[0]) - 10);
  assert.ok(find("rec-hud").samples[5][0] > baseline.samples[5][0] + 80);
  const current = results.filter((r) => r.background === "current" && r.text === "minimal");
  assert.ok(luma(current.find((r) => r.id === "vignette").samples[2]) < luma(current.find((r) => r.id === "none").samples[2]) - 10);
  const hud = results.filter((r) => r.id === "rec-hud" && r.background === "black" && r.text === "minimal" && r.intensity === 1);
  for (const i of [5, 6]) assert.deepEqual(hud[0].samples[i], hud[1].samples[i], "Source grading must not recolor HUD");
  const warmNoneMs = results.at(-1).renderMs;
  for (const result of results.slice(0, 6)) result.costRelativeToWarmNone = result.renderMs / warmNoneMs;
  }
  for (const [index, result] of results.slice(0, 6).entries()) {
    const text = Buffer.from(`<svg width="270" height="28"><rect width="270" height="28" fill="#17191f"/><text x="12" y="20" fill="white" font-size="16">${result.id}</text></svg>`);
    cards.push({ input: await sharp(result.frame).resize(270, 480).extend({ bottom: 28, background: "#17191f" }).composite([{ input: text, left: 0, top: 480 }]).png().toBuffer(), left: index % 4 * 270, top: Math.floor(index / 4) * 508 });
  }
  await sharp({ create: { width: 1080, height: 1016, channels: 4, background: "#17191f" } }).composite(cards).png().toFile(path.join(root, "contact-sheet.png"));
  await writeFile(path.join(root, "result.json"), JSON.stringify({ packaged, fixture, source, points, textGraphicsIdentical: true, results }, null, 2));
  console.log(`PASS overlay qualification: ${root}`);
} finally { await stop(); }
