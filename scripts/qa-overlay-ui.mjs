import { expandCustomize } from "./qa-customize-helpers.mjs";
// Actual source/built UI + native video filtering. Worker mutations are mocked;
// source media and exported comparison frames come only from qa-video-filters.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getOverlayAsset } from "../lib/visual-style/overlays.mjs";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const project = path.resolve(import.meta.dirname, "..");
const resultFile = path.resolve(process.argv[process.argv.indexOf("--renders") + 1] || "");
assert.ok(process.argv.includes("--renders") && resultFile.startsWith(path.join(project, ".isolation-verification/")), "Pass --renders <isolated filter QA result.json>");
const rendered = JSON.parse(await readFile(resultFile, "utf8"));
const root = await mkdtemp(path.join(project, ".isolation-verification/overlay-ui-"));
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
let baselinePixels;
async function capture(id, opacity) {
  await paint();
  const preview = page.locator(".portrait-preview");
  // Align the QA-only 1:1 canvas to device pixels before extracting RGBA.
  // Center the enlarged QA canvas below the sticky app header. With expanded
  // customization rows, nearest-edge scrolling can place it behind that header.
  await preview.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await preview.evaluate((el) => { el.style.left = "0px"; el.style.top = "0px"; const r = el.getBoundingClientRect(); el.style.left = `${Math.ceil(r.x) - r.x}px`; el.style.top = `${Math.ceil(r.y) - r.y}px`; });
  const frame = path.join(root, `${id}-${opacity ?? "default"}.png`);
  const { data, info } = await sharp(await preview.screenshot({ path: frame })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1082, 1922]);
  const sample = (pixels) => rendered.points.map(({ x, y }) => {
    const rgb = [0, 0, 0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let c = 0; c < 3; c++) rgb[c] += pixels[((y + dy + 1) * info.width + x + dx + 1) * 3 + c] / 25;
    return rgb;
  });
  const samples = sample(data);
  await writeFile(path.join(root, `${id}-geometry.json`), JSON.stringify(await preview.evaluate((el) => ({ preview: el.getBoundingClientRect().toJSON(), scene: el.querySelector("[data-scene-overlays]").getBoundingClientRect().toJSON(), layer: el.querySelector("[data-overlay-asset]")?.getBoundingClientRect().toJSON(), border: getComputedStyle(el).borderLeftWidth })), null, 2));
  const exported = rendered.results.find((r) => r.id === id && r.text === "minimal" && r.background === "black" && r.intensity === 0 && r.opacity === opacity && !r.stack);
  assert.ok(exported, `Missing export control ${id}/${opacity}`);
  const errors = samples.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - exported.samples[i][c])));
  const result = { id, opacity, samples, frame, mae: mean(errors), max: Math.max(...errors) };
  assert.ok(result.mae <= 2 && result.max <= 3, `Overlay preview/export color/alpha/placement mismatch ${id}: ${result.mae}/${result.max}`);
  if (id === "none") baselinePixels = Buffer.from(data);
  else {
    const overlay = exported.overlays[0], asset = getOverlayAsset(overlay.assetId);
    const pixels = (await sharp(path.join(project, "public/overlays", asset.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
    const expected = Buffer.from(baselinePixels);
    for (let y = 0; y < 1920; y++) for (let x = 0; x < 1080; x++) {
      const p = (y * 1080 + x) * 4, i = ((y + 1) * info.width + x + 1) * 3, alpha = pixels[p + 3] / 255 * overlay.opacity;
      for (let c = 0; c < 3; c++) expected[i + c] = Math.round(baselinePixels[i + c] * (1 - alpha) + pixels[p + c] * alpha);
    }
    const predicted = sample(expected), residuals = samples.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - predicted[i][c])));
    result.assetMae = mean(residuals); result.assetMax = Math.max(...residuals);
    assert.ok(result.assetMae <= 1 && result.assetMax <= 2, `Browser must use actual asset RGBA math: ${id} ${result.assetMae}/${result.assetMax}`);
    const layer = page.locator("[data-overlay-asset]");
    assert.equal(await layer.count(), 1);
    assert.equal(await layer.evaluate((el) => getComputedStyle(el).pointerEvents), "none");
    assert.equal(await page.locator("[data-scene-overlays]").evaluate((el) => getComputedStyle(el).zIndex), "5");
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
  await page.getByRole("button", { name: "Text style: Minimal", exact: true }).click();
  await page.addStyleTag({ content: ".portrait-preview { width: 1082px !important; height: 1922px !important; aspect-ratio: auto !important; max-width: none !important; } .portrait-preview button { visibility: hidden !important; }" });
  await page.locator(".portrait-preview").evaluate((element) => { element.parentElement.parentElement.style.gridTemplateColumns = "minmax(340px,1fr) 1120px minmax(380px,1.1fr)"; });
  await page.waitForFunction(() => [...document.querySelectorAll(".portrait-preview video")].every((video) => video.readyState >= 2));
  await page.locator(".portrait-preview video").last().evaluate((video) => { window.__qaVideo = video; window.__qaLoads = 0; video.addEventListener("loadedmetadata", () => window.__qaLoads++); video.pause(); });
  await paint();
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click(); await intensity(0);
  await page.getByRole("button", { name: "Background: Black", exact: true }).click();
  const originalText = await textState(), originalMutations = mutations.length;
  const labels = ["None", "Grain", "Vignette", "Soft Glow", "Film Frame", "REC HUD"];
  assert.equal(await page.getByRole("button", { name: /^Overlay:/ }).count(), 6);
  await page.locator(".portrait-preview video").evaluateAll((videos) => Promise.all(videos.map((v) => new Promise((resolve) => { v.pause(); v.currentTime = 0.5; if (!v.seeking) resolve(); else v.addEventListener("seeked", resolve, { once: true }); }))));
  for (const label of labels) {
    await page.getByRole("button", { name: `Overlay: ${label}`, exact: true }).click(); await paint();
    assert.equal(await page.getByRole("button", { name: `Overlay: ${label}`, exact: true }).getAttribute("aria-pressed"), "true");
    assert.deepEqual(await textState(), originalText);
    const retained = await page.locator(".portrait-preview video").last().evaluate((v) => ({ same: v === window.__qaVideo, loads: window.__qaLoads, time: v.currentTime }));
    assert.ok(retained.same && retained.loads === 0 && Math.abs(retained.time - 0.5) < 0.05, JSON.stringify(retained));
    await capture(label.toLowerCase().replaceAll(" ", "-"));
  }
  const slider = page.getByLabel("Overlay opacity", { exact: true });
  await slider.focus(); await slider.press("Home");
  for (let i = 0; i < 50; i++) await slider.press("ArrowRight");
  await capture("rec-hud", 0.5);
  await page.getByRole("button", { name: "Play preview", exact: true }).last().click(); await page.waitForTimeout(150);
  const playingTime = await page.locator(".portrait-preview video").last().evaluate((v) => v.currentTime);
  await page.getByRole("button", { name: "Overlay: Grain", exact: true }).click();
  const playback = await page.locator(".portrait-preview video").evaluateAll((videos) => ({ paused: videos[1].paused, time: videos[1].currentTime, drift: Math.abs(videos[0].currentTime - videos[1].currentTime) }));
  assert.ok(!playback.paused && playback.time >= playingTime && playback.drift < 0.3, JSON.stringify(playback));
  await page.getByRole("button", { name: "Pause preview", exact: true }).click();
  assert.equal(mutations.length, originalMutations, "Overlay selection must not start source/AI/caption/render work");
  await page.getByRole("button", { name: "Text style: Yellow Hook", exact: true }).click();
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click();
  await page.getByRole("button", { name: "Background: Dark Blur", exact: true }).click();
  await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
  for (let i = 0; i < 80 && !accepted.length; i++) await page.waitForTimeout(50);
  assert.equal(accepted.length, 1);
  const snapshot = structuredClone(accepted[0].plan.visualStyle);
  assert.equal(snapshot.overlays[0].presetId, "grain"); assert.equal(snapshot.textPresetId, "yellow-hook"); assert.equal(snapshot.filter.presetId, "vivid"); assert.equal(snapshot.background.presetId, "dark-blur");
  await page.getByRole("button", { name: "Overlay: Vignette", exact: true }).focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Text style: KR Clean", exact: true }).click();
  await page.getByRole("button", { name: "Video filter: Soft", exact: true }).click();
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
  assert.equal(await page.getByRole("button", { name: "Overlay: Vignette", exact: true }).getAttribute("aria-pressed"), "true");
  assert.deepEqual(accepted[0].plan.visualStyle, snapshot);
  await page.locator('[aria-labelledby="overlay-heading"]').screenshot({ path: path.join(root, "controls.png") });
  await page.getByRole("button", { name: /^Xử lý hàng loạt/ }).click();
  await page.locator("#batch-urls").fill("https://youtu.be/synthetic-filter-qa");
  await page.getByRole("button", { name: "Chạy hàng đợi tự động", exact: false }).click();
  for (let i = 0; i < 80 && !acceptedBatches.length; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(acceptedBatches.length, 1);
  assert.equal(acceptedBatches[0].visualStyle.filter.presetId, "soft");
  assert.equal(acceptedBatches[0].visualStyle.background.presetId, "dark-blur");
  assert.equal(acceptedBatches[0].visualStyle.textPresetId, "kr-clean");
  assert.equal(acceptedBatches[0].visualStyle.overlays[0].presetId, "vignette");
  const batchSnapshot = structuredClone(acceptedBatches[0].visualStyle);
  await page.getByRole("button", { name: "Chỉnh từng video", exact: true }).click();
  await page.getByRole("button", { name: "Overlay: Film Frame", exact: true }).click();
  assert.deepEqual(acceptedBatches[0].visualStyle, batchSnapshot);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  await writeFile(path.join(root, "result.json"), JSON.stringify({ renderResult: resultFile, comparisons, sourceVideoRetained: true, noFilterMutations: true, textIndependent: true, queuedSnapshotUnchanged: true, batchSnapshotUnchanged: true, keyboardSelection: true, planTransitionPersistence: true, productionRequests: 0, errors }, null, 2));
  console.log(`PASS overlay browser UI/parity: ${root}`);
} finally { await browser.close(); }
