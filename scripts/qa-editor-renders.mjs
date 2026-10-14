// Isolated integration check: never uses the personal media directory or AI credits.
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from 'sharp';
import { FOREGROUND_Y, FOREGROUND_HEIGHT } from '../lib/render-config.mjs';

const project = path.resolve(import.meta.dirname, "..");
const runtime = process.env.QA_RUNTIME_BIN || "/Applications/ShortCut Studio.app/Contents/Resources/runtime/bin";
const root = await mkdtemp("/private/tmp/shortcut-editor-qa-");
const fixture = path.join(root, "fixture.mp4");
const ffmpeg = path.join(runtime, "ffmpeg");
const ffprobe = path.join(runtime, "ffprobe");
const generated = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "40", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture], { encoding: "utf8" });
assert.equal(generated.status, 0, generated.stderr);
const bytes = await readFile(fixture);
const api = "http://127.0.0.1:8788";
let worker;
let logs = "";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function call(route, method = "GET", body, status = 200) {
  const response = await fetch(`${api}${route}`, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function boot() {
  worker = spawn(path.join(runtime, "node"), [path.join(project, "worker/server.mjs")], { cwd: project, env: { ...process.env, MEDIA_WORKER_PORT: "8788", MEDIA_WORKER_DATA_DIR: root, MEDIA_WORKER_DISABLE_LEGACY: "1", FFMPEG_PATH: ffmpeg, FFPROBE_PATH: ffprobe, YT_DLP_PATH: path.join(runtime, "yt-dlp") }, stdio: ["ignore", "pipe", "pipe"] });
  worker.stdout.on("data", (chunk) => { logs += chunk; }); worker.stderr.on("data", (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const health = await call("/health"); assert.equal(health.dataRoot, root); return; }
    catch { if (worker.exitCode !== null || attempt === 59) throw new Error(logs); await delay(250); }
  }
}
async function stop() {
  if (worker?.exitCode === null) { worker.kill("SIGTERM"); await new Promise((resolve) => worker.once("exit", resolve)); }
}
async function upload(name) {
  const response = await fetch(`${api}/api/sources/upload?filename=${encodeURIComponent(name)}`, { method: "POST", headers: { "X-Filename": encodeURIComponent(name) }, body: bytes });
  assert.equal(response.status, 201); return (await response.json()).source;
}
function plan(source, label) {
  return { originalTitle: source.title, language: "de", providerUsed: "manual", parts: [1, 2].map((id) => ({ id, title: `${label} title ${id}`, hook: "Own test", hashtags: Array.from({ length: 10 }, (_, index) => `#${label}${index}`), segments: [{ start: (id - 1) * 20, end: id * 20 }] })) };
}
try {
  await boot();
  const first = await upload("First source.mp4");
  const submitted = plan(first, "first");
  await call(`/api/sources/${first.id}/transform-lite`, "POST", { plan: submitted }, 404);
  const { job: job1 } = await call("/api/render", "POST", { sourceId: first.id, plan: submitted }, 202);
  await call(`/api/editor-renders/${job1.id}`, "DELETE", {}, 409);
  submitted.parts[0].title = "Changed editor title";
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await call(`/api/jobs/${job1.id}`)).job.state === "rendering") break;
    assert.ok(attempt < 49); await delay(100);
  }
  const second = await upload("Second source.mp4");
  assert.equal((await call(`/api/jobs/${job1.id}`)).job.state, "rendering", "Preparing source 2 must not interrupt render 1");
  const { job: job2 } = await call("/api/render", "POST", { sourceId: second.id, plan: plan(second, "second") }, 202);
  assert.equal(job2.state, "queued");
  const list = (await call("/api/editor-renders")).jobs;
  assert.equal(list.length, 2);
  assert.equal(list.find((job) => job.id === job1.id).plan.parts[0].title, "first title 1");
  assert.equal(list.find((job) => job.id === job2.id).plan.parts[1].hashtags.length, 10);
  assert.equal(job1.plan.parts[0].segments[0].start, 1, "Stored plan includes the one-time offset in source time");
  console.log("PASS source 2 prepares during render 1; both jobs retain their own title, 10 hashtags and original timestamps.");
  const cancelled = (await call(`/api/jobs/${job2.id}/cancel`, "POST")).job;
  assert.equal(cancelled.state, "cancelled");
  assert.equal((await call(`/api/jobs/${job1.id}`)).job.state, "rendering");
  const customPlan = plan(second, "second");
  customPlan.parts.forEach((part, index) => { part.startTrimApplied = true; part.smartCutApplied = true; part.segments = [{ start: index ? 21.5 : 0.5, end: index ? 39.5 : 18.5 }]; });
  customPlan.parts[0].segments = [{ start: 0.5, end: 8 }, { start: 10.5, end: 21 }];
  customPlan.subtitles = { enabled: true, size: 48, color: "#ffffff", outline: 3, position: "bottom" };
  customPlan.captionCues = { sourceId: second.id, sourceDuration: second.duration, timeline: "source", cues: [{ start: 2, end: 6, text: "Subtitle burn-in test 日本語 한국어" }, { start: 8.5, end: 10, text: "Excluded advertisement must not appear" }, { start: 23, end: 27, text: "Subtitle Part 2 — Français Deutsch" }, { start: 38, end: second.duration + 0.183, text: "Final cue near EOF 日本語 한국어" }] };
  for (const [patch, expected] of [[{ sourceId: first.id }, /source khác/], [{ timeline: "part" }, /timestamp gốc/], [{ sourceDuration: 99 }, /Thời lượng source/]]) {
    const invalidPlan = { ...customPlan, captionCues: { ...customPlan.captionCues, ...patch } };
    const rejected = await call("/api/render", "POST", { sourceId: second.id, plan: invalidPlan }, 500);
    assert.match(rejected.error, expected);
  }
  const { job: job3 } = await call("/api/render", "POST", { sourceId: second.id, plan: customPlan }, 202);
  assert.equal(job3.plan.parts[0].segments[0].start, 0.5, "Manual override must not get another offset");
  assert.equal(job3.plan.captionCues.cues.at(-1).end, second.duration, "Normalize provider EOF overshoot before storing the immutable render plan");
  for (let attempt = 0; attempt < 360; attempt++) {
    const jobs = (await call("/api/editor-renders")).jobs.filter((job) => [job1.id, job3.id].includes(job.id));
    assert.ok(jobs.every((job) => job.state !== "error"), JSON.stringify(jobs));
    if (jobs.every((job) => job.state === "done")) break;
    assert.ok(attempt < 359, "Render timeout"); await delay(500);
  }
  for (const id of [job1.id, job3.id]) {
    const { job } = await call(`/api/jobs/${id}`);
    assert.equal(job.outputs.length, 2);
    assert.deepEqual(job.outputs.map((output) => output.filename), id === job1.id ? ["de1.mp4", "de2.mp4"] : ["de11.mp4", "de22.mp4"]);
    for (const output of job.outputs) {
      const media = path.join(root, "sources", output.url.slice("/files/".length));
      const probe = spawnSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", media], { encoding: "utf8" });
      assert.equal(probe.status, 0, probe.stderr);
      const info = JSON.parse(probe.stdout);
      assert.ok(Math.abs(Number(info.format.duration) - (id === job1.id ? 15.2 : 14.4)) < 0.1, "Exact edited duration / 1.25, with no double offset");
      assert.ok(info.streams.some((stream) => stream.width === 1080 && stream.height === 1920));
      const titleFile = path.join(path.dirname(media), `part-${output.part}-titles.png`);
      const { data: titlePixels, info: titleInfo } = await sharp(titleFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let titleOverlap = 0;
      for (let y = FOREGROUND_Y; y < FOREGROUND_Y + FOREGROUND_HEIGHT; y++) for (let x = 0; x < titleInfo.width; x++) titleOverlap += titlePixels[(y * titleInfo.width + x) * 4 + 3];
      assert.equal(titleOverlap, 0, 'Title glyphs, glow and shadow must stay outside enlarged foreground');
      if (id === job3.id && output.part === 1) {
        const whites = [0.5, 2, 5, 6.2].map((time) => {
          const frame = spawnSync(ffmpeg, ["-v", "error", "-ss", String(time), "-i", media, "-vf", "crop=900:240:90:750", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1024 * 1024 });
          assert.equal(frame.status, 0, frame.stderr.toString());
          let count = 0; for (let pixel = 0; pixel < frame.stdout.length; pixel += 3) if (frame.stdout[pixel] > 200 && frame.stdout[pixel + 1] > 200 && frame.stdout[pixel + 2] > 200) count++;
          return count;
        });
        assert.ok(whites[0] < 20 && whites[1] > 1000 && whites[2] < 20 && whites[3] < 20, `Burn-in visible only during the cue at 1.25x; removed ad omitted: ${whites}`);
      }
      const response = await fetch(`${api}${output.url}`, { headers: { Range: "bytes=0-100" } });
      assert.equal(response.status, 206); await response.arrayBuffer();
    }
  }
  console.log("PASS per-job cancel does not cancel other renders; FIFO produces four playable 1080×1920 outputs with exactly 1 second trimmed per part.");
  const { trashId } = await call(`/api/editor-renders/${job1.id}`, "DELETE", {});
  assert.ok(trashId);
  assert.equal((await call("/api/editor-renders")).jobs.length, 2);
  assert.equal((await call("/api/storage")).library.originals.length, 2);
  assert.equal((await call(`/api/jobs/${job1.id}`)).job.outputs.length, 0);
  await call(`/api/editor-renders/${job1.id}`, "DELETE", {});
  await stop(); await boot();
  assert.equal((await call("/api/editor-renders")).jobs.length, 2, "Deleted row must not return on restart");
  await call("/api/storage/restore", "POST", { id: trashId });
  const restored = (await call("/api/editor-renders")).jobs;
  assert.equal(restored.length, 3);
  assert.equal(restored.find((job) => job.id === job1.id).outputs.length, 2);
  assert.equal(restored.find((job) => job.id === job1.id).plan.parts[0].title, "first title 1");
  assert.equal(restored.find((job) => job.id === job2.id).state, "cancelled");
  assert.equal(restored.find((job) => job.id === job1.id).plan.parts[0].hashtags.length, 10);
  console.log("PASS completed-render deletion is recoverable, preserves originals, survives restart and restores title/hashtags/downloads.");
  const { job: job4 } = await call("/api/render", "POST", { sourceId: second.id, plan: plan(second, "fresh") }, 202);
  for (let attempt = 0; attempt < 60; attempt++) {
    const { job } = await call(`/api/jobs/${job4.id}`);
    if (job.exportNames) { assert.deepEqual(job.exportNames, ["de1.mp4", "de2.mp4"]); break; }
    assert.ok(attempt < 59); await delay(100);
  }
  await call(`/api/jobs/${job4.id}/cancel`, "POST");
  for (let attempt = 0; attempt < 60; attempt++) {
    const job = (await call("/api/editor-renders")).jobs.find((job) => job.id === job4.id);
    if (!job.stopping) break;
    assert.ok(attempt < 59); await delay(100);
  }
  await call(`/api/editor-renders/${job4.id}`, "DELETE", {});
  console.log(`PASS filenames increment in-session and reset to de1/de2 after app restart without overwriting old files. Own fixture only: ${root}`);
} finally { await stop(); }
