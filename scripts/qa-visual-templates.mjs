// Source/package integration QA: synthetic media only, isolated HOME/fontconfig,
// no network access in the render worker, and no production app or ports.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { listFonts, fontFallbackStack } from "../lib/visual-style/fonts.mjs";
import { applyVisualTemplate, getVisualTemplate, VISUAL_TEMPLATE_IDS, matchVisualTemplate } from "../lib/visual-style/templates.mjs";
import { assertRuntimePortsAvailable, resolveRuntime, runtimeEnvironment, prepareRuntimeDirectories } from "../desktop/runtime-config.mjs";
import { FOREGROUND_Y, FOREGROUND_HEIGHT } from "../lib/render-config.mjs";

const project = path.resolve(import.meta.dirname, "..");
const packaged = process.argv.includes("--packaged");
const nativeSmoke = process.argv.includes("--native-smoke");
assert.ok(!nativeSmoke || packaged, "Native smoke requires the isolated DEV package");
const resources = path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources");
const app = packaged ? path.join(resources, "app") : project;
const node = packaged ? path.join(resources, "runtime/bin/node") : process.execPath;
const ffmpeg = packaged ? path.join(resources, "runtime/bin/ffmpeg") : "/opt/homebrew/bin/ffmpeg";
const ffprobe = packaged ? path.join(resources, "runtime/bin/ffprobe") : "/opt/homebrew/bin/ffprobe";
const port = Number(process.env.QA_TEMPLATE_PORT || 8897);
assert.ok([8887,8897].includes(port));
const api = `http://127.0.0.1:${port}`;
await assertRuntimePortsAvailable({ name: "Visual template QA", webPort: port, workerPort: port });
const scratch = path.join(project, ".isolation-verification"); await mkdir(scratch, { recursive: true });
const root = await mkdtemp(path.join(scratch, packaged ? "template-package-" : "template-source-"));
const runtime = resolveRuntime({ profile: "development", home: path.join(root, "mock-home") });
await prepareRuntimeDirectories(runtime);
const dataRoot = path.join(root, "media");
const fontConfig = path.join(root, "fonts.xml");
const xml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
await writeFile(fontConfig, `<fontconfig><dir>${xml(path.join(app, "public"))}</dir><cachedir>${xml(path.join(root, "font-cache"))}</cachedir></fontconfig>`);
const denyNetwork = path.join(root, "deny-network.mjs");
await writeFile(denyNetwork, 'globalThis.fetch = async () => { throw new Error("QA: network access is disabled"); };');
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: app, maxBuffer: 64 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, result.error?.message || result.stderr?.toString()); return result.stdout;
}
assert.match(run(node, ["--version"]).toString(), /^v22\./);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const coverage = {};
for (const font of listFonts().filter((font) => font.bundled)) {
  const bytes = await readFile(path.join(app, "public", font.file));
  assert.equal(hash(bytes), hash(await readFile(path.join(project, "public", font.file))));
  assert.match(await readFile(path.join(app, "public", font.licenseFile), "utf8"), /SIL OPEN FONT LICENSE/);
  const ranges = run("/opt/homebrew/bin/fc-scan", ["--format", "%{charset}\n", path.join(app, "public", font.file)]).toString().split("\n")[0].split(" ").map((range) => range.split("-").map((value) => parseInt(value, 16)));
  coverage[font.family] = (char) => ranges.some(([start, end = start]) => char.codePointAt(0) >= start && char.codePointAt(0) <= end);
}
const allSamples = {
  current: "How to grow sweeter tomatoes", "viral-shorts": "Sweet tomatoes トマト 토마토", "clean-tutorial": "Süßere Tomaten · Français éàç", "farming-jp": "トマトを甘く育てる方法", "korean-tutorial": "토마토를 맛있게 키우는 방법", news: "Tomatoes: today's growing guide", "cinematic-dark": "Frische Tomaten für alle", "bright-social": "Cultiver des tomates plus sucrées",
  "viral-jp": "トマトを甘く育てる方法", "viral-kr": "토마토를 맛있게 키우는 방법", "viral-fr": "Français: cultiver des tomates", "viral-de": "Süßere Tomaten für alle",
};
const samples = nativeSmoke ? Object.fromEntries(["viral-shorts", "farming-jp"].map((id) => [id, allSamples[id]])) : allSamples;
const templateId = (id) => id.startsWith("viral-") && id !== "viral-shorts" ? "viral-shorts" : id;
for (const [id, text] of Object.entries(samples)) {
  const font = applyVisualTemplate(undefined, templateId(id)).originalTitle.font;
  for (const char of text.replace(/\s/g, "")) assert.ok(fontFallbackStack(font, text).some((family) => coverage[family]?.(char)), `${id}: missing glyph U+${char.codePointAt(0).toString(16)}`);
}
const fixture = path.join(root, "fixture.mp4");
run(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=30", ...(nativeSmoke ? [] : ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]), "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", ...(nativeSmoke ? [] : ["-c:a", "aac"]), fixture]);
const bytes = await readFile(fixture);
let logs = "";
const worker = spawn(node, ["--import", denyNetwork, path.join(app, "worker/server.mjs")], { cwd: app, stdio: ["ignore", "pipe", "pipe"], env: { ...runtimeEnvironment(runtime), MEDIA_WORKER_DATA_DIR: dataRoot, MEDIA_WORKER_PORT: String(port), MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, YT_DLP_PATH: path.join(project, ".local-tools/yt-dlp"), FONTCONFIG_FILE: fontConfig, FFMPEG_VIDEO_ENCODER: nativeSmoke ? "h264_videotoolbox" : "libx264", FFMPEG_PRESET: "ultrafast", FFMPEG_CRF: "18" } });
worker.stdout.on("data", (c) => { logs += c; }); worker.stderr.on("data", (c) => { logs += c; });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function call(route, body, expected = 200) {
  const response = await fetch(api + route, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
}
const cards = [], results = [];
try {
  for (let i = 0; i < 120; i++) { try { assert.equal((await call("/health")).dataRoot, dataRoot); break; } catch { assert.ok(worker.exitCode === null && worker.signalCode === null, logs); assert.ok(i < 119, logs); await delay(250); } }
  if (nativeSmoke) assert.equal((await call("/health")).render.encoder, "h264_videotoolbox");
  for (const id of Object.keys(samples)) {
    const uploaded = await fetch(api + "/api/sources/upload?filename=" + encodeURIComponent(`${samples[id]}.mp4`), { method: "POST", body: bytes });
    assert.equal(uploaded.status, 201); const { source } = await uploaded.json();
    source.title = samples[id];
    const metadataPath = path.join(dataRoot, "sources", source.id, "source.json");
    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    await writeFile(metadataPath, JSON.stringify({ ...metadata, title: source.title }));
    const input = applyVisualTemplate(undefined, "current"); input.subtitle.enabled = true; input.subtitle.source = "whisper";
    const style = applyVisualTemplate(input, templateId(id));
    assert.equal(style.subtitle.enabled, true); assert.equal(style.subtitle.source, "whisper");
    const submitted = { originalTitle: source.title, providerUsed: "manual", language: id === "farming-jp" ? "ja" : id === "korean-tutorial" ? "ko" : "en", visualStyle: style, parts: [1, 2].map((part) => ({ id: part, title: samples[id], startTrimApplied: true, hashtags: [], segments: [{ start: part - 1, end: part }] })), captionCues: { sourceId: source.id, sourceDuration: source.duration, timeline: "source", cues: [0, 1].map((start) => ({ start: start + 0.1, end: start + 0.9, text: samples[id] })) } };
    const expectedStyle = structuredClone(style);
    const { job } = await call("/api/render", { sourceId: source.id, plan: submitted }, 202);
    assert.deepEqual(job.plan.visualStyle, style);
    assert.equal(matchVisualTemplate(style), templateId(id));
    // Editing the caller's preset after acceptance cannot mutate the queued job.
    const later = applyVisualTemplate(style, "news"); later.originalTitle.color = "#ff0000";
    submitted.visualStyle.originalTitle.color = "#00ff00";
    assert.deepEqual((await call(`/api/jobs/${job.id}`)).job.plan.visualStyle, expectedStyle);
    let done;
    for (let i = 0; i < 480; i++) { done = (await call(`/api/jobs/${job.id}`)).job; assert.notEqual(done.state, "error", `${done.error}\n${logs}`); if (done.state === "done") break; await delay(250); }
    assert.equal(done.state, "done", logs); assert.equal(done.outputs.length, 2);
    if (nativeSmoke) assert.equal(done.encoder, "h264_videotoolbox", "Native template smoke must not silently fall back to CPU");
    let firstMedia, titleHash;
    for (const output of done.outputs) {
      const media = path.join(dataRoot, "sources", decodeURIComponent(output.url.slice("/files/".length)));
      const info = JSON.parse(run(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=width,height,codec_type", "-of", "json", media]));
      assert.ok(info.streams.some((stream) => stream.width === 1080 && stream.height === 1920));
      assert.ok(info.streams.some((stream) => stream.codec_type === "audio"), "Output retains or synthesizes audio");
      assert.ok(Math.abs(Number(info.format.duration) - 0.8) < 0.06);
      const directory = path.dirname(media);
      const title = path.join(directory, `part-${output.part}-titles.png`);
      const { data: pixels, info: dims } = await sharp(title).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let foregroundAlpha = 0, edges = 0, titlePixels = 0;
      for (let y = 0; y < dims.height; y++) for (let x = 0; x < dims.width; x++) {
        const a = pixels[(y * dims.width + x) * 4 + 3];
        if (y >= FOREGROUND_Y && y < FOREGROUND_Y + FOREGROUND_HEIGHT) foregroundAlpha += a;
        if (x < 8 || x > 1071 || y < 8 || y > 1911) edges += a;
        if (a > 127) titlePixels++;
      }
      assert.equal(foregroundAlpha, 0, "Titles must stay outside foreground"); assert.equal(edges, 0, "Text must not clip against output frame"); assert.ok(titlePixels > 500);
      for (const file of (await readdir(directory)).filter((name) => /^subtitle-\d+\.png$/.test(name))) {
        const stats = await sharp(path.join(directory, file)).trim({ background: "#00000000", threshold: 1 }).toBuffer({ resolveWithObject: true });
        assert.ok(stats.info.width < 1000 && stats.info.height < 240, `${id}: subtitle safe layout`);
      }
      if (!firstMedia) { firstMedia = media; titleHash = hash(await readFile(title)); }
    }
    const frame = run(ffmpeg, ["-v", "error", "-ss", "0.4", "-i", firstMedia, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
    const label = Buffer.from(`<svg width="270" height="34"><rect width="270" height="34" fill="#15171c"/><text x="12" y="23" fill="white" font-size="17">${id}</text></svg>`);
    if (VISUAL_TEMPLATE_IDS.includes(id)) cards.push({ input: await sharp(frame).resize(270, 480).extend({ bottom: 34, background: "#15171c" }).composite([{ input: label, top: 480, left: 0 }]).png().toBuffer(), top: Math.floor(results.length / 4) * 514, left: results.length % 4 * 270 });
    results.push({ id, recipe: getVisualTemplate(templateId(id)), style: expectedStyle, frameHash: hash(frame), text: samples[id], font: style.originalTitle.font, titleHash, frames: 2, resolution: "1080x1920", durationPerPart: 0.8, ...(nativeSmoke ? { encoder: done.encoder } : {}) });
    console.log(`PASS ${packaged ? "packaged" : "source"} ${id}: glyph coverage, snapshot, safe titles/subtitles, 1080x1920`);
  }
  await sharp({ create: { width: 1080, height: 1028, channels: 4, background: "#111111" } }).composite(cards).png().toFile(path.join(root, "contact-sheet.png"));
  await writeFile(path.join(root, "result.json"), JSON.stringify({ packaged, nativeSmoke, offlineWorker: true, fontFilesVerified: 7, results }, null, 2));
  console.log(`PASS visual template contact set: ${root}`);
} finally {
  if (worker.exitCode === null && worker.signalCode === null) { const exited = once(worker, "exit"); worker.kill("SIGTERM"); const timer = setTimeout(() => worker.kill("SIGKILL"), 5000); try { await exited; } finally { clearTimeout(timer); } }
}
