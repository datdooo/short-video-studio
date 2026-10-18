// Synthetic source/package worker QA. Never uses installed apps or user media.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { FILTER_PRESET_IDS, filterColorMatrix } from "../lib/visual-style/filters.mjs";
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
const root = await mkdtemp(path.join(project, `.isolation-verification/filter-${packaged ? "package" : "source"}-`));
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
const colors = [
  ...[32, 56, 80, 104, 128, 160, 192, 224].map((v) => [v, v, v]),
  [172, 126, 98], [138, 104, 80], [78, 128, 68], [122, 162, 86], [76, 124, 166], [122, 154, 180], [172, 80, 84], [184, 158, 88],
  [174, 98, 72], [142, 84, 114], [84, 148, 112], [136, 152, 72], [78, 106, 152], [116, 134, 174], [166, 106, 88], [164, 142, 110],
  [66, 84, 102], [98, 112, 82], [126, 94, 74], [148, 118, 142], [82, 136, 148], [158, 144, 78], [128, 132, 136], [174, 172, 162],
  ...[48, 72, 96, 120, 144, 168, 192, 216].map((v) => [v, v, v]),
  [164, 108, 78], [110, 142, 82], [102, 146, 170], [166, 132, 100], [124, 90, 156], [174, 116, 116], [86, 132, 98], [152, 148, 142],
];
const pixels = Buffer.alloc(width * height * 3);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const color = colors[Math.floor(y / 90) * 8 + Math.floor(x / 120)];
  for (let c = 0; c < 3; c++) pixels[(y * width + x) * 3 + c] = color[c];
}
const image = path.join(root, "patches.png"), fixture = path.join(root, "Filter fixture.mp4");
await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(image);
run(ffmpeg, ["-v", "error", "-loop", "1", "-i", image, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "2", "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "0", "-c:a", "aac", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv", fixture]);
const points = Array.from({ length: 4 }, (_, row) => Array.from({ length: 6 }, (_, column) => ({ x: (column + 1) * 120 + 60, y: row * 90 + 45 }))).flat();
export async function sampleFrame(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return points.map(({ x, y }) => {
    const px = Math.round((x - 480) * 1.25 + 540), py = Math.round((y - 270) * 1.25 + 960);
    assert.ok(px > 8 && px < info.width - 8 && py > 8 && py < info.height - 8);
    const rgb = [0, 0, 0];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let c = 0; c < 3; c++) rgb[c] += data[((py + dy) * info.width + px + dx) * 3 + c] / 49;
    return rgb;
  });
}
function stats(samples) {
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const luma = samples.map(([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b);
  const gray = luma.slice(0, 6), grayMean = mean(gray);
  return { meanRGB: [0, 1, 2].map((c) => mean(samples.map((rgb) => rgb[c]))), luma: mean(luma), grayContrast: Math.sqrt(mean(gray.map((v) => (v - grayMean) ** 2))), chroma: mean(samples.slice(6).map((rgb) => Math.max(...rgb) - Math.min(...rgb))) };
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
async function render(id, intensity = 1, suffix = "") {
  const style = applyFilterIntensity(applyFilterPreset(applyTextPreset(undefined, "yellow-hook"), id), intensity);
  style.subtitle.enabled = true;
  const plan = { originalTitle: "FILTER FIXTURE", providerUsed: "manual", language: "en", visualStyle: style, parts: [1, 2].map((part) => ({ id: part, title: "COLOR CHECK", startTrimApplied: true, hashtags: [], segments: [{ start: part - 1, end: part }] })), captionCues: { sourceId: source.id, sourceDuration: 2, timeline: "source", cues: [{ start: 0.1, end: 0.9, text: "Caption 日本語 한국어" }, { start: 1.1, end: 1.9, text: "Caption 日本語 한국어" }] } };
  const expected = structuredClone(style);
  const { job } = await call("/api/render", { sourceId: source.id, plan }, 202);
  plan.visualStyle.filter.contrast = 0.8;
  assert.deepEqual((await call(`/api/jobs/${job.id}`)).job.plan.visualStyle, expected);
  let done;
  for (let i = 0; i < 480; i++) { done = (await call(`/api/jobs/${job.id}`)).job; assert.notEqual(done.state, "error", `${done.error}\n${logs}`); if (done.state === "done") break; await delay(250); }
  assert.equal(done.state, "done", logs); assert.equal(done.outputs.length, 2);
  let media;
  for (const output of done.outputs) {
    const file = path.join(dataRoot, "sources", decodeURIComponent(output.url.slice("/files/".length)));
    const info = JSON.parse(run(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
    const video = info.streams.find((stream) => stream.codec_type === "video");
    assert.deepEqual([video.width, video.height, video.r_frame_rate, video.color_space, video.color_transfer, video.color_primaries], [1080, 1920, "30/1", "bt709", "bt709", "bt709"]);
    assert.ok(info.streams.some((stream) => stream.codec_type === "audio"));
    assert.ok(Math.abs(Number(info.format.duration) - 0.8) < 0.06);
    const directory = path.dirname(file), graphics = {};
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".png")).sort()) graphics[name] = hash(await readFile(path.join(directory, name)));
    expectedGraphics[output.part] ||= graphics;
    assert.deepEqual(graphics, expectedGraphics[output.part], "Filters must not change any title/subtitle/shine pixels");
    media ||= file;
  }
  const label = `${id}-${Math.round(intensity * 100)}${suffix}`, frame = path.join(root, `${label}.png`);
  await writeFile(frame, run(ffmpeg, ["-v", "error", "-ss", "0.4", "-i", media, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]));
  const samples = await sampleFrame(frame), metrics = stats(samples);
  const result = { id, intensity, filter: expected.filter, frame, samples, metrics, frameHash: hash(await readFile(frame)), jobId: job.id };
  console.log(`PASS ${packaged ? "packaged" : "source"} ${label}: snapshots, unchanged text PNGs, geometry/audio/Rec.709`);
  return result;
}
try {
  await boot();
  const response = await fetch(api + "/api/sources/upload?filename=Filter%20fixture.mp4", { method: "POST", body: await readFile(fixture) });
  assert.equal(response.status, 201); ({ source } = await response.json());
  for (const id of FILTER_PRESET_IDS) results.push(await render(id));
  const neutral = await render("vivid", 0), half = await render("vivid", 0.5);
  results.push(neutral, half);
  for (const result of results.filter((result) => result.id !== "current")) {
    const matrix = filterColorMatrix(result.filter);
    const errors = result.samples.flatMap((rgb, index) => rgb.map((v, row) => Math.abs(v - Math.max(0, Math.min(255, neutral.samples[index].reduce((sum, channel, col) => sum + channel * matrix[row * 5 + col], 255 * matrix[row * 5 + 4]))))));
    result.expectedMatrixMae = errors.reduce((a, b) => a + b) / errors.length;
    assert.ok(result.expectedMatrixMae <= 3, `${result.id}: export does not follow RGB matrix (${result.expectedMatrixMae})`);
    if (result.intensity > 0) assert.notEqual(result.frameHash, neutral.frameHash, "A selected recipe must actually change exported pixels");
  }
  assert.ok(results.find((r) => r.id === "bright").metrics.luma > neutral.metrics.luma);
  assert.ok(results.find((r) => r.id === "contrast").metrics.grayContrast > neutral.metrics.grayContrast);
  assert.ok(results.find((r) => r.id === "vivid" && r.intensity === 1).metrics.chroma > neutral.metrics.chroma);
  assert.ok(results.find((r) => r.id === "soft").metrics.grayContrast < neutral.metrics.grayContrast);
  await stop();
  await boot({ FFMPEG_CONTRAST: "1.19", FFMPEG_SATURATION: "0.87" });
  const overrideVivid = await render("vivid", 1, "-env"), overrideCurrent = await render("current", 1, "-env");
  assert.equal(overrideVivid.frameHash, results.find((r) => r.id === "vivid" && r.intensity === 1).frameHash);
  assert.notEqual(overrideCurrent.frameHash, results.find((r) => r.id === "current").frameHash);
  for (const [index, result] of results.slice(0, 8).entries()) {
    const text = Buffer.from(`<svg width="270" height="28"><rect width="270" height="28" fill="#17191f"/><text x="12" y="20" fill="white" font-size="16">${result.id}</text></svg>`);
    cards.push({ input: await sharp(result.frame).resize(270, 480).extend({ bottom: 28, background: "#17191f" }).composite([{ input: text, left: 0, top: 480 }]).png().toBuffer(), left: index % 4 * 270, top: Math.floor(index / 4) * 508 });
  }
  await sharp({ create: { width: 1080, height: 1016, channels: 4, background: "#17191f" } }).composite(cards).png().toFile(path.join(root, "contact-sheet.png"));
  await writeFile(path.join(root, "result.json"), JSON.stringify({ packaged, fixture, source, points, environmentPrecedence: true, textGraphicsIdentical: true, results }, null, 2));
  console.log(`PASS filter qualification: ${root}`);
} finally { await stop(); }
