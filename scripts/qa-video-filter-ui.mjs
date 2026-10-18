import { expandCustomize } from "./qa-customize-helpers.mjs";
// Actual source/built UI + native video filtering. Worker mutations are mocked;
// source media and exported comparison frames come only from qa-video-filters.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { filterColorMatrix } from "../lib/visual-style/filters.mjs";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const project = path.resolve(import.meta.dirname, "..");
const resultFile = path.resolve(process.argv[process.argv.indexOf("--renders") + 1] || "");
assert.ok(process.argv.includes("--renders") && resultFile.startsWith(path.join(project, ".isolation-verification/")), "Pass --renders <isolated filter QA result.json>");
const rendered = JSON.parse(await readFile(resultFile, "utf8"));
const root = await mkdtemp(path.join(project, ".isolation-verification/filter-ui-"));
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
function metrics(samples) {
  const luma = samples.map(([r, g, b]) => r * 0.2126 + g * 0.7152 + b * 0.0722), gray = luma.slice(0, 6), average = mean(gray);
  return { luma: mean(luma), grayContrast: Math.sqrt(mean(gray.map((v) => (v - average) ** 2))), chroma: mean(samples.slice(6).map((rgb) => Math.max(...rgb) - Math.min(...rgb))) };
}
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
let neutralComparison;
async function capture(id, strength = 1) {
  await paint();
  const preview = page.locator(".portrait-preview");
  const positions = await page.locator(".portrait-preview video").last().evaluate((el, points) => {
    const video = el.getBoundingClientRect(), frame = el.closest(".portrait-preview").getBoundingClientRect();
    return points.map(({ x, y }) => ({ x: Math.round(video.x - frame.x + x / 960 * video.width), y: Math.round(video.y - frame.y + y / 540 * video.height) }));
  }, rendered.points);
  const file = path.join(root, `${id}-${Math.round(strength * 100)}.png`);
  const png = await preview.screenshot({ path: file });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const samples = positions.map(({ x, y }) => {
    assert.ok(x > 8 && x < info.width - 8 && y > 8 && y < info.height - 8);
    const rgb = [0, 0, 0];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let c = 0; c < 3; c++) rgb[c] += data[((y + dy) * info.width + x + dx) * 3 + c] / 49;
    return rgb;
  });
  const exported = rendered.results.find((r) => r.id === id && r.intensity === strength);
  const errors = samples.flatMap((rgb, i) => rgb.map((v, c) => Math.abs(v - exported.samples[i][c])));
  const result = { id, intensity: strength, mae: mean(errors), maxPatchChannelError: Math.max(...errors), browser: metrics(samples), exported: exported.metrics, samples, screenshot: file };
  await writeFile(path.join(root, `${id}-${Math.round(strength * 100)}-comparison.json`), JSON.stringify({ ...result, exportedSamples: exported.samples }, null, 2));
  // Measure native video decode/color-management differences at identity first.
  // Then verify each renderer's treatment against that same decoded input, and
  // bound raw differences by the matrix-propagated neutral error + quantization.
  // This catches an incorrect filter without treating decoder error as a recipe.
  if (id !== "current") {
    if (strength === 0) {
      assert.ok(result.mae <= 5 && result.maxPatchChannelError <= 14 + 1e-6, "Unexpected native decode/color-management error at identity");
    } else {
      const matrix = filterColorMatrix(exported.filter), residuals = [];
      for (const [i, rgb] of samples.entries()) for (let row = 0; row < 3; row++) {
        const expected = Math.max(0, Math.min(255, neutralComparison.samples[i].reduce((sum, channel, col) => sum + channel * matrix[row * 5 + col], 255 * matrix[row * 5 + 4])));
        residuals.push(Math.abs(rgb[row] - expected));
        const neutralExport = rendered.results.find((r) => r.id === "vivid" && r.intensity === 0);
        const exportExpected = Math.max(0, Math.min(255, neutralExport.samples[i].reduce((sum, channel, col) => sum + channel * matrix[row * 5 + col], 255 * matrix[row * 5 + 4])));
        const bound = 3 + Math.abs(exportExpected - exported.samples[i][row]) + neutralComparison.samples[i].reduce((sum, channel, col) => sum + Math.abs(matrix[row * 5 + col]) * Math.abs(channel - neutralExport.samples[i][col]), 0);
        assert.ok(Math.abs(rgb[row] - exported.samples[i][row]) <= bound, `${id}: raw parity exceeds measured decoder error bound`);
      }
      result.browserMatrixMae = mean(residuals);
      result.browserMatrixMax = Math.max(...residuals);
      assert.ok(result.browserMatrixMae <= 2, `${id}: preview does not apply the shared RGB transform (${result.browserMatrixMae})`);
      assert.ok(result.browserMatrixMax <= 3, `${id}: preview matrix channel error (${result.browserMatrixMax})`);
    }
  }
  comparisons.push(result);
  return result;
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
  await intensity(0); neutralComparison = await capture("vivid", 0);
  for (const id of ["current", "clean", "vivid", "nature", "soft", "contrast", "bright", "muted"]) {
    const label = id[0].toUpperCase() + id.slice(1);
    await page.getByRole("button", { name: `Video filter: ${label}`, exact: true }).click();
    await paint();
    assert.equal(await page.getByRole("button", { name: `Video filter: ${label}`, exact: true }).getAttribute("aria-pressed"), "true");
    assert.deepEqual(await textState(), originalText, "Color selection must leave text typography/effects untouched");
    assert.equal(await page.locator(".portrait-preview video").last().evaluate((video) => video === window.__qaVideo && window.__qaLoads === 0), true);
    const colorFilters = await page.locator(".portrait-preview video").evaluateAll((videos) => videos.map((video) => getComputedStyle(video).filter));
    assert.ok(colorFilters[0].includes(id === "current" ? "contrast(" : "studio-preview-video-color"));
    assert.ok(colorFilters[1].includes(id === "current" ? "contrast(" : "studio-preview-video-color"));
    await capture(id);
  }
  assert.equal(mutations.length, originalMutations, "Selecting filters must not prepare sources, run AI/captions or submit renders");
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click();
  const neutral = neutralComparison;
  await intensity(50); await capture("vivid", 0.5);
  assert.equal(mutations.length, originalMutations, "Intensity must not start background work");
  assert.equal(await page.locator(".portrait-preview video").last().evaluate((video) => video === window.__qaVideo && window.__qaLoads === 0), true);
  for (const result of comparisons.filter((r) => r.id !== "current" && r.intensity > 0)) {
    for (const metric of ["luma", "grayContrast", "chroma"]) {
      const exportDelta = result.exported[metric] - neutral.exported[metric], previewDelta = result.browser[metric] - neutral.browser[metric];
      if (Math.abs(exportDelta) > 0.5) assert.equal(Math.sign(previewDelta), Math.sign(exportDelta), `${result.id}: ${metric} direction mismatch`);
    }
  }
  await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
  for (let i = 0; i < 80 && !accepted.length; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].plan.visualStyle.filter.presetId, "vivid"); assert.equal(accepted[0].plan.visualStyle.filter.intensity, 0.5);
  assert.equal(accepted[0].plan.visualStyle.textPresetId, "yellow-hook");
  const snapshot = structuredClone(accepted[0].plan.visualStyle);
  await page.getByRole("button", { name: "Video filter: Nature", exact: true }).focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Text style: JP Clean", exact: true }).click();
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
  assert.equal(await page.getByRole("button", { name: "Video filter: Nature", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "Text style: JP Clean", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Video filter: Soft", exact: true }).click();
  await page.getByRole("button", { name: "Text style: KR Clean", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Video filter: Soft", exact: true }).getAttribute("aria-pressed"), "true");
  assert.deepEqual(accepted[0].plan.visualStyle, snapshot);
  await page.locator('[aria-labelledby="video-filter-heading"]').screenshot({ path: path.join(root, "controls.png") });
  await page.getByRole("button", { name: /^Xử lý hàng loạt/ }).click();
  await page.locator("#batch-urls").fill("https://youtu.be/synthetic-filter-qa");
  await page.getByRole("button", { name: "Chạy hàng đợi tự động", exact: false }).click();
  for (let i = 0; i < 80 && !acceptedBatches.length; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(acceptedBatches.length, 1);
  assert.equal(acceptedBatches[0].visualStyle.filter.presetId, "soft");
  assert.equal(acceptedBatches[0].visualStyle.textPresetId, "kr-clean");
  const batchSnapshot = structuredClone(acceptedBatches[0].visualStyle);
  await page.getByRole("button", { name: "Chỉnh từng video", exact: true }).click();
  await page.getByRole("button", { name: "Video filter: Bright", exact: true }).click();
  assert.deepEqual(acceptedBatches[0].visualStyle, batchSnapshot);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  await writeFile(path.join(root, "result.json"), JSON.stringify({ renderResult: resultFile, comparisons, sourceVideoRetained: true, noFilterMutations: true, textIndependent: true, queuedSnapshotUnchanged: true, batchSnapshotUnchanged: true, keyboardSelection: true, planTransitionPersistence: true, productionRequests: 0, errors }, null, 2));
  console.log(`PASS video filter browser UI/parity: ${root}`);
} finally { await browser.close(); }
