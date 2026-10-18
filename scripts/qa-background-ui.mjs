import { expandCustomize } from "./qa-customize-helpers.mjs";
// Actual source/built UI + native video filtering. Worker mutations are mocked;
// source media and exported comparison frames come only from qa-video-filters.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { gradientRowRgb, getBackgroundPreset } from "../lib/visual-style/backgrounds.mjs";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const project = path.resolve(import.meta.dirname, "..");
const resultFile = path.resolve(process.argv[process.argv.indexOf("--renders") + 1] || "");
assert.ok(process.argv.includes("--renders") && resultFile.startsWith(path.join(project, ".isolation-verification/")), "Pass --renders <isolated filter QA result.json>");
const rendered = JSON.parse(await readFile(resultFile, "utf8"));
const root = await mkdtemp(path.join(project, ".isolation-verification/background-ui-"));
await mkdir(root, { recursive: true });
const fixture = path.join(root, "Filter fixture.mp4");
const extended = spawnSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-stream_loop", "2", "-i", rendered.fixture, "-c", "copy", fixture]);
assert.equal(extended.status, 0, extended.stderr?.toString());
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 2880, height: 2400 }, deviceScaleFactor: 1 });
const errors = [], violations = [], accepted = [], mutations = [], acceptedBatches = [];
let mockBatch;
const source = { ...rendered.source, title: "FILTER FIXTURE", duration: 6, width: 960, height: 540 };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
async function paint() {
  await page.locator('.portrait-preview[aria-busy="false"]').waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function textState() {
  return page.locator(".portrait-preview .social-copy").evaluateAll((elements) => elements.map((el) => {
    const css = getComputedStyle(el);
    return { text: el.textContent, font: css.fontFamily, size: css.fontSize, weight: css.fontWeight, color: css.color, outline: css.webkitTextStroke, shadow: css.textShadow, opacity: css.opacity, filter: css.filter };
  }));
}
async function intensity(value) {
  const slider = page.getByLabel("Video filter intensity", { exact: true });
  await slider.focus(); await slider.press("Home");
  for (let i = 0; i < value; i++) await slider.press("ArrowRight");
  assert.equal(await slider.inputValue(), String(value)); await paint();
}
const comparisons = [];
async function capture(id, filter = "vivid", strength = 1) {
  await paint();
  const preview = page.locator(".portrait-preview");
  const frame = await preview.boundingBox();
  const geometry = await page.locator(".portrait-preview video").last().boundingBox();
  assert.ok(Math.abs(geometry.width / frame.width * 1080 - 1200) < 0.5);
  assert.ok(Math.abs((geometry.y - frame.y - 1) / (frame.height - 2) * 1920 - 622.5) < 1, "Foreground must retain its native centered geometry");
  const file = path.join(root, `${id}-${filter}-${strength}.png`);
  const { data, info } = await sharp(await preview.screenshot({ path: file })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sample = (points) => points.map(({ x, y }) => {
    // CSS backgrounds occupy the inner border box; map export canvas coordinates.
    const px = Math.round(1 + x / 1080 * (frame.width - 2)), py = Math.round(1 + y / 1920 * (frame.height - 2));
    const rgb = [0, 0, 0];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let c = 0; c < 3; c++) rgb[c] += data[((py + dy) * info.width + px + dx) * 3 + c] / 49;
    return rgb.map((v) => Number(v.toFixed(6)));
  });
  const samples = sample(rendered.backgroundPoints);
  const exported = rendered.results.find((r) => r.id === id && r.filterId === filter && r.intensity === strength && r.text === "yellow-hook");
  const errors = samples.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - exported.backgroundSamples[i][c])));
  const foreground = sample([{ x: 300, y: 800 }, { x: 700, y: 1100 }]);
  const result = { id, filter, strength, samples, foreground, geometry, mae: mean(errors), max: Math.max(...errors), screenshot: file };
  const bg = getBackgroundPreset(id).background;
  if (bg.mode === "source-blur" && filter === "vivid" && strength === 1) {
    const points = Array.from({ length: 1080 }, (_, x) => ({ x, y: 1450 }));
    // Stay inside the canvas at the outer pixels; only the middle edge is used.
    const row = sample(points.slice(320, 760)).map((rgb) => rgb[0]);
    const crossings = [0.1, 0.9].map((t) => { const target = row[10] + (row[430] - row[10]) * t; let best = 60; for (let x = 61; x < 380; x++) if (Math.abs(row[x] - target) < Math.abs(row[best] - target)) best = x; return best; });
    result.blurWidth = crossings[1] - crossings[0];
    assert.ok(result.blurWidth >= 80 && result.blurWidth <= 140, `Expected strong ~100px preview blur; got ${result.blurWidth}`);
  }
  if (bg.mode === "solid") assert.equal(Math.max(...samples.flat()), 0);
  if (bg.mode === "gradient") {
    result.cssMaxError = Math.max(...samples.flatMap((rgb, index) => rgb.map((v, c) => Math.abs(v - gradientRowRgb(bg, rendered.backgroundPoints[index].y, 1920)[c]))));
    assert.ok(result.cssMaxError <= 1.1, `CSS gradient differs from shared stops: ${result.cssMaxError}`);
    assert.ok(result.max <= 3, `Gradient preview/export mismatch ${result.max}`);
  }
  comparisons.push(result); return result;
}
try {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "blob:" || (url.hostname === "127.0.0.1" && url.port === "5273")) return route.continue();
    if (url.hostname !== "127.0.0.1" || url.port !== "8887") { violations.push(url.href); return route.abort(); }
    let body = {}, status = 200;
    if (route.request().method() !== "GET") mutations.push(url.pathname);
    if (url.pathname === "/health") body = { ok: true, readyForYouTube: true, chatGPTAuthAvailable: false, render: { contrast: 1.04, saturation: 1.06 }, tools: {} };
    else if (url.pathname === "/api/chatgpt/session") body = { session: { available: true, connected: true, sharing: true } };
    else if (url.pathname === "/api/editor-renders") body = { jobs: accepted };
    else if (url.pathname === "/api/batches" && route.request().method() === "POST") {
      acceptedBatches.push(structuredClone(route.request().postDataJSON()));
      mockBatch = { id: "00000000-0000-4000-8000-000000000003", items: [], finished: false, createdAt: new Date().toISOString() };
      body = { batch: mockBatch }; status = 202;
    }
    else if (url.pathname === "/api/batches") body = { batches: mockBatch ? [mockBatch] : [] };
    else if (url.pathname.startsWith("/api/batches/")) body = { batch: mockBatch };
    else if (url.pathname === "/api/sources/upload") { body = { source }; status = 201; }
    else if (url.pathname === "/api/render") {
      const request = route.request().postDataJSON();
      accepted.push({ id: "00000000-0000-4000-8000-000000000002", sourceId: source.id, state: "queued", progress: 0, outputs: [], plan: structuredClone(request.plan), createdAt: new Date().toISOString() });
      body = { job: accepted.at(-1) }; status = 202;
    }
    else if (url.pathname.endsWith("/media")) return route.fulfill({ path: fixture, contentType: "video/mp4" });
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5273/", { waitUntil: "networkidle" });
  await expandCustomize(page);
  assert.equal(await page.getByRole("button", { name: /^Video filter:/ }).count(), 8);
  assert.equal(await page.getByRole("button", { name: "Video filter: Current", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByLabel("Video filter intensity", { exact: true }).isDisabled(), true);
  await page.getByRole("tab", { name: "Local video", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: "Chuẩn bị source để render", exact: false }).click();
  await page.getByRole("button", { name: "Source đã sẵn sàng", exact: false }).waitFor();
  await page.getByRole("tab", { name: "Manual cut", exact: false }).click();
  await page.locator("#manual-title-1").fill("COLOR CHECK");
  await page.locator("#manual-title-2").fill("COLOR CHECK");
  await page.getByLabel("Part 1 timestamp ranges").fill("0 - 3");
  await page.getByLabel("Part 2 timestamp ranges").fill("3 - 6");
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
  await page.getByRole("button", { name: "Text style: Yellow Hook", exact: true }).click();
  await page.addStyleTag({ content: ".portrait-preview { width: 1080px !important; max-width: none !important; }" });
  await page.locator(".portrait-preview").evaluate((element) => { element.parentElement.parentElement.style.gridTemplateColumns = "minmax(340px,1fr) 1120px minmax(380px,1.1fr)"; });
  await page.waitForFunction(() => [...document.querySelectorAll(".portrait-preview video")].every((video) => video.readyState >= 2));
  await page.locator(".portrait-preview video").last().evaluate((video) => { window.__qaVideo = video; window.__qaLoads = 0; video.addEventListener("loadedmetadata", () => window.__qaLoads++); video.pause(); });
  await paint();
  const originalText = await textState(), originalMutations = mutations.length;
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click();
  await page.locator(".portrait-preview video").evaluateAll((videos) => Promise.all(videos.map((video) => new Promise((resolve) => { video.pause(); video.currentTime = 0.5; if (!video.seeking) resolve(); else video.addEventListener("seeked", resolve, { once: true }); }))));
  const labels = ["Current", "Dark Blur", "Light Blur", "Black", "Soft Gradient", "Dark Gradient"];
  assert.equal(await page.getByRole("button", { name: /^Background:/ }).count(), 6);
  for (const label of labels) {
    await page.getByRole("button", { name: `Background: ${label}`, exact: true }).click();
    assert.equal(await page.getByRole("button", { name: `Background: ${label}`, exact: true }).getAttribute("aria-pressed"), "true");
    await paint();
    assert.deepEqual(await textState(), originalText);
    const retained = await page.locator(".portrait-preview video").last().evaluate((v) => ({ same: v === window.__qaVideo, loads: window.__qaLoads, time: v.currentTime }));
    assert.ok(retained.same && retained.loads === 0 && Math.abs(retained.time - 0.5) < 0.05, `Selection must preserve element/source/time: ${JSON.stringify(retained)}`);
    await capture(label.toLowerCase().replaceAll(" ", "-"));
  }
  await page.getByRole("button", { name: "Play preview", exact: true }).last().click();
  await page.waitForTimeout(150);
  const playingTime = await page.locator(".portrait-preview video").last().evaluate((v) => v.currentTime);
  await page.getByRole("button", { name: "Background: Dark Blur", exact: true }).click();
  const playback = await page.locator(".portrait-preview video").evaluateAll((videos) => ({ paused: videos[1].paused, time: videos[1].currentTime, drift: Math.abs(videos[0].currentTime - videos[1].currentTime) }));
  assert.ok(!playback.paused && playback.time >= playingTime && playback.drift < 0.3, `Background selection must keep synchronized playback: ${JSON.stringify(playback)}`);
  await page.getByRole("button", { name: "Pause preview", exact: true }).click();
  await page.locator(".portrait-preview video").evaluateAll((videos) => Promise.all(videos.map((v) => new Promise((resolve) => { v.currentTime = 0.5; if (!v.seeking) resolve(); else v.addEventListener("seeked", resolve, { once: true }); }))));
  const luma = (r) => mean(r.samples.flat());
  assert.ok(luma(comparisons[1]) < luma(comparisons[0]) && luma(comparisons[0]) < luma(comparisons[2]));
  for (const id of ["current", "black", "soft-gradient"]) {
    await page.getByRole("button", { name: `Background: ${labels.find((label) => label.toLowerCase().replaceAll(" ", "-") === id)}`, exact: true }).click();
    await intensity(0); const neutral = await capture(id, "vivid", 0);
    const full = comparisons.find((r) => r.id === id && r.strength === 1);
    assert.notDeepEqual(neutral.foreground, full.foreground, "Video filter must change foreground");
    if (id === "current") assert.notDeepEqual(neutral.samples, full.samples);
    else assert.ok(neutral.samples.flat().every((v, i) => Math.abs(v - full.samples.flat()[i]) <= 1), "Synthetic background must bypass grade (one-level CSS dithering bound)");
    await intensity(100);
  }
  await page.getByRole("button", { name: "Video filter: Muted", exact: true }).click();
  const muted = await capture("soft-gradient", "muted");
  assert.ok(muted.samples.flat().every((v, i) => Math.abs(v - comparisons.find((r) => r.id === "soft-gradient" && r.strength === 1).samples.flat()[i]) <= 1), "Muted must preserve gradient within one-level CSS dithering");
  assert.equal(mutations.length, originalMutations, "Selections must not start AI/caption/preparation/render work");
  await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
  for (let i = 0; i < 80 && !accepted.length; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].plan.visualStyle.background.presetId, "soft-gradient");
  assert.equal(accepted[0].plan.visualStyle.filter.presetId, "muted");
  const snapshot = structuredClone(accepted[0].plan.visualStyle);
  await page.getByRole("button", { name: "Background: Black", exact: true }).focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Text style: KR Clean", exact: true }).click();
  await page.getByRole("button", { name: "Video filter: Soft", exact: true }).click();
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
  assert.equal(await page.getByRole("button", { name: "Background: Black", exact: true }).getAttribute("aria-pressed"), "true");
  assert.deepEqual(accepted[0].plan.visualStyle, snapshot);
  await page.locator('[aria-labelledby="background-heading"]').screenshot({ path: path.join(root, "controls.png") });
  await page.getByRole("button", { name: /^Xử lý hàng loạt/ }).click();
  await page.locator("#batch-urls").fill("https://youtu.be/synthetic-filter-qa");
  await page.getByRole("button", { name: "Chạy hàng đợi tự động", exact: false }).click();
  for (let i = 0; i < 80 && !acceptedBatches.length; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(acceptedBatches.length, 1);
  assert.equal(acceptedBatches[0].visualStyle.filter.presetId, "soft");
  assert.equal(acceptedBatches[0].visualStyle.background.presetId, "black");
  assert.equal(acceptedBatches[0].visualStyle.textPresetId, "kr-clean");
  const batchSnapshot = structuredClone(acceptedBatches[0].visualStyle);
  await page.getByRole("button", { name: "Chỉnh từng video", exact: true }).click();
  await page.getByRole("button", { name: "Background: Dark Gradient", exact: true }).click();
  assert.deepEqual(acceptedBatches[0].visualStyle, batchSnapshot);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  await writeFile(path.join(root, "result.json"), JSON.stringify({ renderResult: resultFile, comparisons, sourceVideoRetained: true, noFilterMutations: true, textIndependent: true, queuedSnapshotUnchanged: true, batchSnapshotUnchanged: true, keyboardSelection: true, planTransitionPersistence: true, productionRequests: 0, errors }, null, 2));
  console.log(`PASS background browser UI/parity: ${root}`);
} finally { await browser.close(); }
