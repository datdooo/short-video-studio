// Real packaged UI -> real packaged worker. No mocked HTTP responses or AI calls.
// Synthetic media/source-title/caption fixtures; all state is under this QA root.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveRuntime, assertRuntimePortsAvailable } from "../desktop/runtime-config.mjs";
import { applyVisualTemplate, matchVisualTemplate } from "../lib/visual-style/templates.mjs";
import { normalizeVisualStyle } from "../lib/visual-style/normalize.mjs";
import { expandCustomize } from "./qa-customize-helpers.mjs";

const project = path.resolve(import.meta.dirname, "..");
const resources = path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources");
const bin = path.join(resources, "runtime/bin");
const cpu = process.argv.includes("--cpu");
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, `.isolation-verification/rc-real-ui-${cpu ? "cpu" : "native"}-`));
console.log(`QA root: ${root}`);
const home = path.join(root, "mock-home");
const runtime = resolveRuntime({ profile: "development", home });
const web = runtime.webOrigin, api = runtime.workerOrigin;
const config = JSON.parse(await readFile(path.join(resources, "config.json"), "utf8"));
assert.deepEqual(config, { profile: "development", webPort: 5273, workerPort: 8887, existingDataRoot: null });
await assertRuntimePortsAvailable(runtime);
const run = (name, args) => {
  const result = spawnSync(path.join(bin, name), args, { maxBuffer: 128 * 1024 * 1024 });
  assert.equal(result.status, 0, result.error?.message || result.stderr?.toString());
  return result.stdout;
};
// Catch missing worker dependencies before any listening socket or browser starts.
run("node", ["--input-type=module", "-e", `await import(${JSON.stringify(path.join(resources, "app/worker/youtube-downloader.mjs"))})`]);
const fixture = path.join(root, "fixture.mp4");
run("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "24", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", fixture]);
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const errors = [], violations = [], requests = [], jobs = [], outputAudits = [];
let app, browser, page, appLogs = "";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function call(route, method = "GET", body) {
  const response = await fetch(api + route, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  assert.ok(response.ok, `${route}: ${JSON.stringify(data)}`);
  return data;
}
async function boot() {
  app = spawn(path.join(bin, "node"), [path.join(resources, "desktop/bootstrap.mjs")], {
    cwd: resources,
    env: { HOME: home, PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`, ...(cpu ? { FFMPEG_VIDEO_ENCODER: "libx264" } : {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (chunk) => { appLogs += chunk; });
  app.stderr.on("data", (chunk) => { appLogs += chunk; });
  for (let i = 0; i < 160; i++) {
    assert.equal(app.exitCode, null, appLogs);
    try {
      const health = await call("/health");
      if (health.ok && (await fetch(web)).ok) {
        assert.equal(health.dataRoot, runtime.dataRoot);
        return;
      }
    } catch { /* Bootstrap is still starting. */ }
    await delay(250);
  }
  throw new Error(`Packaged bootstrap timed out: ${appLogs}`);
}
async function stop() {
  if (app?.exitCode === null) {
    const exit = once(app, "exit");
    app.kill("SIGTERM");
    await exit;
  }
}
async function openRow(id) {
  const panel = page.locator("[data-visual-customize]");
  if (!await panel.evaluate((el) => el.open)) await panel.locator(":scope > summary").click();
  const row = panel.locator(`[data-customize-row=${id}]`);
  if (!await row.evaluate((el) => el.open)) await row.locator(":scope > summary").click();
}
const cases = cpu ? [
  { id: "farming-jp", label: "Farming JP", title: "農業の秘密 日本語", caption: "朝の水やり 日本語", animation: "slide-up", transition: "Dip Black" },
] : [
  { id: "current", label: "Current", title: "Ernte Récolte Deutsch Français", caption: "Ernte und récolte", animation: "none", transition: "None" },
  { id: "farming-jp", label: "Farming JP", title: "農業の秘密 日本語", caption: "朝の水やり 日本語", animation: "slide-up", transition: "Dip Black" },
  { id: "korean-tutorial", label: "Korean Tutorial", title: "한국어 농업 안내", caption: "물을 주는 시간 한국어", animation: "pop-in", transition: "Flash White" },
  { id: "news", label: "News", title: "Global News English", caption: "Current global information", animation: "pop-in", transition: "Flash White" },
  { id: "viral-shorts", label: "Viral Shorts", title: "Daily Social Tutorial", caption: "Mixed 日本語 한국어 English", animation: "fade-in", transition: "Dip Black" },
];
try {
  await boot();
  const storage = await call("/api/storage");
  assert.equal(storage.library.storages.length, 1);
  assert.equal(storage.library.storages[0].id, "current");
  browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-color-profile=srgb"] });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1300 } });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:"].includes(url.protocol)) return route.continue();
    if (!(["127.0.0.1", "localhost"].includes(url.hostname) && ["5273", "8887"].includes(url.port))) {
      violations.push(url.origin); return route.abort();
    }
    requests.push({ method: route.request().method(), url: route.request().url() });
    return route.continue();
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(web);
  await page.getByRole("tab", { name: "Local video", exact: true }).click();
  for (const item of cases) {
    console.log(`Real UI case: ${item.id}`);
    await page.locator("input[type=file]").setInputFiles({ name: `${item.title}.mp4`, mimeType: "video/mp4", buffer: await readFile(fixture) });
    const upload = page.waitForResponse((r) => r.url().includes("/api/sources/upload") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Chuẩn bị source để render", exact: true }).click();
    const uploaded = await (await upload).json();
    assert.ok(uploaded.source?.id);
    const source = uploaded.source;
    await page.getByRole("button", { name: "Source đã sẵn sàng", exact: true }).waitFor();
    // The existing render boundary intentionally takes originalTitle from source
    // metadata, not the editor plan. Upload sanitization strips non-Latin names.
    // Seed representative source metadata in our private fixture (not an API mock)
    // so both original/part title rendering get genuine JP/KR glyph coverage.
    const sourceFile = path.join(runtime.dataRoot, "sources", source.id, "source.json");
    const sourceRecord = JSON.parse(await readFile(sourceFile, "utf8"));
    await writeFile(sourceFile, JSON.stringify({ ...sourceRecord, title: item.title }));
    await page.locator("#source-title").fill(item.title);
    // Deliberately seeded deterministic ASR cache; this tests caption plumbing,
    // not speech recognition. No provider responses or render endpoints are mocked.
    const cues = [{ start: 0, end: 9, text: item.caption }, { start: 12, end: 21, text: item.caption }];
    await writeFile(path.join(runtime.dataRoot, "sources", source.id, "speech-captions.json"), JSON.stringify({ sourceId: source.id, sourceDuration: source.duration, timeline: "source", origin: "whisper-local", cues }));
    await page.getByRole("tab", { name: "Manual cut", exact: true }).click();
    await page.locator("#manual-title-1").fill(`${item.title} 1`);
    await page.locator("#manual-title-2").fill(`${item.title} 2`);
    await page.getByLabel("Part 1 timestamp ranges", { exact: true }).fill("0 - 2\n3 - 4\n5 - 6\n7 - 8");
    await page.getByLabel("Part 2 timestamp ranges", { exact: true }).fill("12 - 14\n15 - 16\n17 - 18\n19 - 20");
    await page.getByRole("button", { name: "Apply manual timestamps", exact: true }).click();
    const subtitleDetails = page.locator("details").filter({ has: page.locator(":scope > summary", { hasText: "Auto Subtitle" }) }).first();
    if (!await subtitleDetails.evaluate((el) => el.open)) await subtitleDetails.locator(":scope > summary").click();
    await page.getByRole("checkbox", { name: "Ghép phụ đề vào video xuất", exact: true }).check();
    await page.getByRole("button", { name: "Dùng phụ đề Whisper", exact: true }).click();
    await page.getByText("Xem / sửa phụ đề · 2 câu", { exact: true }).waitFor();
    await page.getByRole("button", { name: `Visual template: ${item.label}`, exact: true }).click();
    assert.equal(await page.getByRole("status", { name: "Visual template status", exact: true }).textContent(), item.label);
    await openRow("animation"); await page.locator("#title-animation").selectOption(item.animation);
    await openRow("transition"); await page.getByRole("button", { name: `Cut transition: ${item.transition}`, exact: true }).click();
    if (item === cases[0]) {
      await expandCustomize(page);
      assert.equal(await page.locator("[data-customize-row]").count(), 7);
      const summaries = () => page.locator("[data-customize-row]").evaluateAll((rows) => Object.fromEntries(rows.map((row) => [row.dataset.customizeRow, row.querySelector("summary span:nth-child(2)").textContent])));
      const baseline = await summaries();
      const mutations = [
        ["text", () => page.getByRole("button", { name: "Text style: Clean", exact: true }).click()],
        ["font", () => page.locator("#text-font").selectOption("Inter")],
        ["filter", () => page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click()],
        ...(item.id === "current" ? [] : [["filter", () => page.getByLabel("Video filter intensity", { exact: true }).press("ArrowLeft")]]),
        ["overlay", () => page.getByRole("button", { name: "Overlay: Grain", exact: true }).click()],
      ];
      for (const [changed, mutate] of mutations) {
        await mutate();
        assert.equal(await page.getByRole("status", { name: "Visual template status", exact: true }).textContent(), "Custom");
        const values = await summaries();
        for (const key of ["filter", "background", "overlay", "animation", "transition"]) {
          if (key !== changed) assert.equal(values[key], baseline[key], `${changed} must not alter ${key}`);
        }
        await page.getByRole("button", { name: `Visual template: ${item.label}`, exact: true }).click();
        assert.deepEqual(await summaries(), baseline);
      }
      await page.getByRole("button", { name: "Background: Black", exact: true }).click();
      assert.equal(await page.getByRole("status", { name: "Visual template status", exact: true }).textContent(), "Custom");
      const video = page.locator(".portrait-preview video").last();
      await video.evaluate((v) => { window.__rcVideo = v; v.pause(); });
      const position = await video.evaluate((v) => v.currentTime);
      const before = requests.filter((r) => r.method !== "GET").length;
      const summary = page.locator("[data-visual-customize] > summary");
      await summary.click(); await summary.click();
      assert.equal(await video.evaluate((v) => v === window.__rcVideo), true);
      assert.ok(Math.abs(await video.evaluate((v) => v.currentTime) - position) < 0.05);
      await page.getByRole("button", { name: "Play preview", exact: true }).last().click();
      const playingPosition = await video.evaluate((v) => v.currentTime);
      await summary.click(); await summary.click();
      await page.waitForTimeout(200);
      const playing = await video.evaluate((v) => ({ same: v === window.__rcVideo, paused: v.paused, time: v.currentTime }));
      assert.ok(playing.same && !playing.paused && playing.time > playingPosition, "Disclosure must preserve active playback");
      await page.getByRole("button", { name: "Pause preview", exact: true }).click();
      assert.equal(requests.filter((r) => r.method !== "GET").length, before);
      assert.equal(await page.getByRole("status", { name: "Visual template status", exact: true }).textContent(), "Custom");
      await page.getByRole("button", { name: `Visual template: ${item.label}`, exact: true }).click();
    }
    const render = page.waitForResponse((r) => r.url() === `${api}/api/render` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
    const response = await render, result = await response.json();
    assert.equal(response.status(), 202, JSON.stringify(result));
    const job = result.job;
    assert.equal(job.plan.originalTitle, item.title);
    assert.deepEqual(job.plan.parts.map((part) => part.title), [`${item.title} 1`.toUpperCase(), `${item.title} 2`.toUpperCase()]);
    const expected = normalizeVisualStyle({ ...applyVisualTemplate(undefined, item.id), titleAnimation: item.animation, cutTransition: item.transition === "Dip Black" ? "dip-black" : item.transition === "Flash White" ? "flash-white" : "none" });
    expected.subtitle = { ...expected.subtitle, enabled: true, source: "whisper" };
    assert.deepEqual(job.plan.visualStyle, expected);
    assert.equal(matchVisualTemplate(job.plan.visualStyle), item.id);
    assert.deepEqual(job.plan.captionCues.cues, cues);
    jobs.push({ id: job.id, sourceId: source.id, template: item.id, expectedPlan: job.plan });
    await page.screenshot({ path: path.join(root, `${item.id}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Visual template: Clean Tutorial", exact: true }).click();
  for (const item of jobs) {
    let job;
    for (let i = 0; i < 600; i++) {
      job = (await call(`/api/jobs/${item.id}`)).job;
      assert.deepEqual(job.plan, item.expectedPlan, "Later editor changes must not mutate stored jobs");
      assert.notEqual(job.state, "error", `${job.error}\n${appLogs}`);
      if (job.state === "done") break;
      await delay(250);
    }
    assert.equal(job.state, "done"); assert.equal(job.outputs.length, 2);
    assert.equal(job.encoder, cpu ? "libx264" : "h264_videotoolbox");
    for (const output of job.outputs) {
      const media = path.join(runtime.dataRoot, "sources", output.url.slice("/files/".length));
      const probe = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", media]));
      const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
      assert.deepEqual([v.codec_name, v.width, v.height, v.r_frame_rate, v.pix_fmt, v.color_space], ["h264", 1080, 1920, "30/1", "yuv420p", "bt709"]);
      assert.deepEqual([a.codec_name, a.channels, a.sample_rate], ["aac", 2, "48000"]);
      assert.ok(Math.abs(Number(probe.format.duration) - 3.2) < 0.06);
      assert.equal(Number(v.nb_frames), 96);
      if (cpu) {
        const bitstream = (await readFile(media)).toString("latin1");
        assert.match(bitstream, /rc=crf .*crf=17\.0/);
        assert.match(bitstream, /ref=3 .*subme=7/); // Actual medium settings, not parity's ultrafast override.
      }
      run("ffmpeg", ["-v", "error", "-i", media, "-f", "null", "-"]);
      const playback = await page.evaluate(async (url) => {
        const video = document.createElement("video"); video.src = url; video.muted = true;
        document.body.append(video);
        try {
          await video.play(); await new Promise((resolve) => setTimeout(resolve, 350));
          return { width: video.videoWidth, height: video.videoHeight, time: video.currentTime, error: video.error?.code || null };
        } finally { video.pause(); video.remove(); }
      }, api + output.url + "?preview=1");
      assert.deepEqual([playback.width, playback.height, playback.error], [1080, 1920, null]);
      assert.ok(playback.time > 0);
      outputAudits.push({ template: item.template, part: output.part, encoder: job.encoder, media, frames: v.nb_frames, duration: probe.format.duration, playback });
    }
  }
  // API recovery checks on jobs produced through actual UI, with full new fields.
  const first = jobs[0], { trashId } = await call(`/api/editor-renders/${first.id}`, "DELETE", {});
  assert.ok(trashId);
  await browser.close(); browser = null;
  await stop(); await boot();
  assert.ok(!(await call("/api/editor-renders")).jobs.some((j) => j.id === first.id));
  await call("/api/storage/restore", "POST", { id: trashId });
  const recovered = (await call("/api/editor-renders")).jobs;
  for (const item of jobs) assert.deepEqual(recovered.find((j) => j.id === item.id).plan, item.expectedPlan);
  assert.equal(recovered.find((j) => j.id === first.id).outputs.length, 2);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  await writeFile(path.join(root, "result.json"), JSON.stringify({ ok: true, cpu, syntheticCaptionCache: true, syntheticSourceTitles: true, jobs, outputAudits, errors, violations, requests }, null, 2));
  console.log(`PASS: ${jobs.length} real UI jobs / ${outputAudits.length} playable MP4s, independent snapshots and restart/restore. ${root}`);
} finally {
  await browser?.close(); await stop();
  await writeFile(path.join(root, "app.log"), appLogs);
}
