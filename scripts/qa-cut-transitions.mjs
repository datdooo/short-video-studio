// Real HTTP source/package qualification. Synthetic media, private HOME/storage,
// local fonts and blocked worker fetch; never production listeners or data.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { applyVisualTemplate } from "../lib/visual-style/templates.mjs";
import { normalizeVisualStyle } from "../lib/visual-style/normalize.mjs";
import { resolveCutTransitions, cutTransitionPose } from "../lib/visual-style/cut-transitions.mjs";
import { resolveRuntime, runtimeEnvironment, prepareRuntimeDirectories, assertRuntimePortsAvailable } from "../desktop/runtime-config.mjs";
const project = path.resolve(import.meta.dirname, "..");
const packaged = process.argv.includes("--packaged"), native = process.argv.includes("--native-smoke"), performance = process.argv.includes("--performance");
assert.ok(!native || packaged);
const resources = path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources");
const app = packaged ? path.join(resources, "app") : project;
const binary = (name) => packaged ? path.join(resources, "runtime/bin", name) : name === "node" ? process.execPath : `/opt/homebrew/bin/${name}`;
const port = Number(process.env.QA_TRANSITION_PORT || 8887); assert.ok([8887, 8897].includes(port));
await assertRuntimePortsAvailable({ name: "Cut transition QA", webPort: port, workerPort: port });
const root = await mkdtemp(path.join(project, `.isolation-verification/transition-${packaged ? "package" : "source"}-`));
const runtime = resolveRuntime({ profile: "development", home: path.join(root, "mock-home") }); await prepareRuntimeDirectories(runtime);
const dataRoot = path.join(root, "media"), fontConfig = path.join(root, "fonts.xml"), preload = path.join(root, "deny-network.mjs");
const xml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
await writeFile(fontConfig, `<fontconfig><dir>${xml(path.join(app, "public"))}</dir><cachedir>${xml(path.join(root, "font-cache"))}</cachedir></fontconfig>`);
await writeFile(preload, 'globalThis.fetch = async () => { throw new Error("QA network disabled"); };');
const hash = (b) => createHash("sha256").update(b).digest("hex");
function run(name, args) { const r = spawnSync(binary(name), args, { maxBuffer: 128 * 1024 * 1024 }); assert.equal(r.status, 0, r.error?.message || r.stderr?.toString()); return r.stdout; }
const fixture = path.join(root, "fixture.mp4");
const video = "testsrc2=size=640x360:rate=30,drawbox=c=red@0.8:t=fill:enable='lt(mod(t,6),2)',drawbox=c=green@0.8:t=fill:enable='between(mod(t,6),2,4)',drawbox=c=blue@0.8:t=fill:enable='gte(mod(t,6),4)'";
run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", video, ...(native ? [] : ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]), "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", ...(native ? [] : ["-c:a", "aac"]), fixture]);
const bytes = await readFile(fixture);
const worker = spawn(binary("node"), ["--import", preload, path.join(app, "worker/server.mjs")], { cwd: app, env: { ...runtimeEnvironment(runtime), MEDIA_WORKER_PORT: String(port), MEDIA_WORKER_DATA_DIR: dataRoot, MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: binary("ffmpeg"), FFPROBE_PATH: binary("ffprobe"), YT_DLP_PATH: path.join(project, ".local-tools/yt-dlp"), FONTCONFIG_FILE: fontConfig, FFMPEG_VIDEO_ENCODER: native ? "h264_videotoolbox" : "libx264", FFMPEG_PRESET: "ultrafast", FFMPEG_CRF: "18" }, stdio: ["ignore", "pipe", "pipe"] });
let logs = ""; worker.stdout.on("data", (c) => { logs += c; }); worker.stderr.on("data", (c) => { logs += c; });
const api = `http://127.0.0.1:${port}`, delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(route, body, status = 200) { const r = await fetch(api + route, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }); const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data; }
const groups = [
  { id: "current", template: "current", animation: "none" },
  { id: "viral-fade", template: "viral-shorts", animation: "fade-in", transition: "dip-black" },
  { id: "nature-slide", template: "farming-jp", animation: "slide-up", transition: "flash-white", black: true },
  { id: "news-pop", template: "news", animation: "pop-in", transition: "dip-black" },
  { id: "farming-slide", template: "farming-jp", animation: "slide-up", transition: "dip-black" },
  { id: "korean-pop", template: "korean-tutorial", animation: "pop-in", transition: "flash-white" },
  { id: "short", template: "current", animation: "none", short: true },
];
const points = [[540, 900], [200, 500], [900, 1200], [50, 50], [50, 350]];
const results = [], sources = new Map(), controls = new Map(), frameCache = new Map(), cards = [];
async function frame(media, time) {
  const key = `${media}/${time.toFixed(9)}`; if (frameCache.has(key)) return frameCache.get(key);
  const png = run("ffmpeg", ["-v", "error", "-ss", String(time), "-i", media, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"]);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples = points.map(([x, y]) => { const rgb = [0, 0, 0]; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let c = 0; c < 3; c++) rgb[c] += data[((y + dy) * info.width + x + dx) * 3 + c] / 25; return rgb; });
  const value = { png, samples, hash: hash(png) }; frameCache.set(key, value); return value;
}
async function render(group, transition, sequence = "") {
  const text = group.template === "farming-jp" ? "トマトを甘く育てる方法" : group.template === "korean-tutorial" ? "토마토를 맛있게 키우는 방법" : "Cut transitions 日本語 한국어";
  if (!sources.has(text)) {
    const r = await fetch(api + "/api/sources/upload?filename=" + encodeURIComponent(text + ".mp4"), { method: "POST", body: bytes }); assert.equal(r.status, 201); const { source } = await r.json();
    source.title = text; const file = path.join(dataRoot, "sources", source.id, "source.json"); const metadata = JSON.parse(await readFile(file)); await writeFile(file, JSON.stringify({ ...metadata, title: text })); sources.set(text, source);
  }
  const source = sources.get(text), id = `${group.id}-${transition}${sequence}`;
  let style = normalizeVisualStyle({ ...applyVisualTemplate(undefined, group.template), titleAnimation: group.animation, cutTransition: transition });
  if (group.black) style = normalizeVisualStyle({ ...style, background: { mode: "solid", presetId: "black", baseColor: "#000000" } });
  style.subtitle.enabled = true; style.subtitle.source = "whisper";
  const parts = [1, 2].map((part) => { const offset = (part - 1) * 6; return { id: part, title: text, startTrimApplied: true, smartCutApplied: true, hashtags: ["#keep"], segments: [{ start: offset, end: offset + 1 }, { start: offset + 2, end: offset + (group.short ? 2 + 1 / 3 : 3) }, { start: offset + 4, end: offset + 5 }] }; });
  const plan = { originalTitle: text, providerUsed: "manual", visualStyle: style, parts, captionCues: { sourceId: source.id, sourceDuration: source.duration, timeline: "source", cues: [{ start: 0, end: 12, text: "Fixed caption 日本語 한국어" }] } };
  const expected = structuredClone(style), { job } = await call("/api/render", { sourceId: source.id, plan }, 202);
  plan.visualStyle.cutTransition = "none"; assert.deepEqual((await call(`/api/jobs/${job.id}`)).job.plan.visualStyle, expected);
  let done; for (let i = 0; i < 1200; i++) { done = (await call(`/api/jobs/${job.id}`)).job; assert.notEqual(done.state, "error", `${done.error}\n${logs}`); if (done.state === "done") break; await delay(250); }
  assert.equal(done.state, "done", logs); assert.equal(done.outputs.length, 2); if (native) assert.equal(done.encoder, "h264_videotoolbox");
  const record = { id, group: group.id, transition, style: expected, jobMs: Date.parse(done.finishedAt) - Date.parse(done.startedAt), encoder: done.encoder, parts: [] };
  for (const output of done.outputs) {
    const media = path.join(dataRoot, "sources", output.url.slice("/files/".length)), dir = path.dirname(media);
    const info = JSON.parse(run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate,nb_frames,codec_type", "-of", "json", media]));
    const video = info.streams.find((s) => s.codec_type === "video"); assert.deepEqual([video.width, video.height, video.r_frame_rate], [1080, 1920, "30/1"]); assert.ok(info.streams.some((s) => s.codec_type === "audio"));
    assert.ok(Math.abs(Number(info.format.duration) - (group.short ? 28 / 15 : 2.4)) < 0.06);
    const assets = {}; for (const name of (await readdir(dir)).filter((n) => /subtitle|titles|shine/.test(n) && /\.png$|\.ffconcat$/.test(n)).sort()) assets[name] = hash(await readFile(path.join(dir, name)));
    const audioHash = hash(run("ffmpeg", ["-v", "error", "-i", media, "-map", "0:a", "-f", "s16le", "-acodec", "pcm_s16le", "-"]));
    const part = { part: output.part, media, duration: Number(info.format.duration), frames: Number(video.nb_frames), audioHash, assets, metrics: [] };
    if (transition === "none" && !performance) {
      // Measure actual hard cuts in the unchanged control. Legacy CFR timestamps
      // can present frames later than nominal edited times; do not "fix" timing.
      const rgb = run("ffmpeg", ["-v", "error", "-i", media, "-vf", "crop=16:16:532:892,scale=1:1", "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      part.cutFrames = []; let previous = 0;
      for (let n = 0; n < rgb.length / 3; n++) { const values = [...rgb.subarray(n * 3, n * 3 + 3)], dominant = values.indexOf(Math.max(...values)); if (dominant !== previous) { part.cutFrames.push(n); previous = dominant; } }
      assert.equal(part.cutFrames.length, 2, "Structured red/green/blue control must have two observable cuts");
    }
    const base = transition === "none" ? null : controls.get(group.id)?.parts[output.part - 1];
    if (base) { assert.equal(part.duration, base.duration); assert.equal(part.frames, base.frames); assert.equal(audioHash, base.audioHash, "Transitions must not change audio bytes/timing"); assert.deepEqual(assets, base.assets, "Text assets and subtitle cue timing must remain exact"); }
    if (!performance) {
      const windows = resolveCutTransitions(transition === "none" ? "dip-black" : transition, parts[output.part - 1].segments);
      for (const window of windows) for (const delta of [-8, -Math.min(3, Math.floor(window.halfFrames / 2)), 0, Math.min(3, Math.floor(window.halfFrames / 2)), 8]) {
        const cutFrame = (base || part).cutFrames[window.boundary - 1];
        const time = (cutFrame + delta) / 30, actual = await frame(media, time), pose = cutTransitionPose(transition, windows, (window.cutFrame + delta) / 30);
        const control = base ? await frame(base.media, time) : actual;
        const target = transition === "flash-white" ? 255 : 0;
        const errors = actual.samples.flatMap((rgb, p) => rgb.map((v, c) => Math.abs(v - (control.samples[p][c] * (1 - pose.opacity) + target * pose.opacity))));
        const mae = errors.reduce((a, b) => a + b) / errors.length;
        // One output-frame quantization is up to 1/halfFrames of the color ramp.
        if (base) assert.ok(mae <= 255 / window.halfFrames + 4, `${id}/${time}: interpolation ${mae}`);
        if (base && delta === 0) assert.ok(actual.samples.flat().every((v) => transition === "dip-black" ? v < 12 : v > 243), `${id}: cut must reach transition color ${JSON.stringify(actual.samples)}`);
        part.metrics.push({ boundary: window.boundary, nominalCutFrame: window.cutFrame, measuredCutFrame: cutFrame, time, opacity: pose.opacity, samples: actual.samples, hash: actual.hash, mae });
        if (output.part === 1 && window.boundary === 1 && results.length < 3) {
          const label = Buffer.from(`<svg width="216" height="30"><rect width="216" height="30" fill="#17191f"/><text x="5" y="21" fill="white" font-size="13">${id} ${time.toFixed(2)}s</text></svg>`);
          cards.push({ input: await sharp(actual.png).resize(216,384).extend({ bottom:30,background:"#17191f" }).composite([{input:label,left:0,top:384}]).png().toBuffer(), left: (part.metrics.length - 1) * 216, top: results.length * 414 });
        }
      }
      if (base) for (const time of [0, (part.frames - 1) / 30]) {
        const a = await frame(media, time), b = await frame(base.media, time);
        assert.ok(a.samples.flat().every((v, i) => Math.abs(v - b.samples.flat()[i]) < 6), "No transition at part start/end");
      }
    }
    record.parts.push(part);
  }
  if (transition === "none") controls.set(group.id, record);
  results.push(record); console.log(`PASS ${packaged ? "package" : "source"} ${id}: two parts/two cuts, audio, text, timing and scene metrics`); return record;
}
try {
  for (let i = 0; i < 120; i++) { try { assert.equal((await call("/health")).dataRoot, dataRoot); break; } catch { assert.equal(worker.exitCode, null, logs); assert.ok(i < 119, logs); await delay(250); } }
  if (performance) {
    for (let repeat = 0; repeat < 2; repeat++) for (const id of ["none", "dip-black", "none", "flash-white", "none"]) await render(groups[0], id, `-${repeat}-${results.length}`);
  } else {
    const selected = process.argv.includes("--quick") ? groups.slice(0, 1) : native ? [groups[0], groups[3]] : groups;
    for (const group of selected) { await render(group, "none"); for (const id of group.transition ? [group.transition] : ["dip-black", "flash-white"]) await render(group, id); }
    if (cards.length) await sharp({ create:{width:1080,height:1242,channels:4,background:"#17191f"} }).composite(cards).png().toFile(path.join(root,"contact-sheet.png"));
  }
  await writeFile(path.join(root, "result.json"), JSON.stringify({ packaged, native, performance, fixture, points, results }, null, 2));
  console.log(`PASS cut transition qualification: ${root}`);
} finally { if (worker.exitCode === null && worker.signalCode === null) { const exited = once(worker, "exit"); worker.kill("SIGTERM"); await exited; } }
