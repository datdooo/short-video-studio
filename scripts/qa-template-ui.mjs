import { expandCustomize } from "./qa-customize-helpers.mjs";
// Actual source/built UI + native video filtering. Worker mutations are mocked;
// source media comes only from the deterministic template render QA fixture.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTextPreset } from "../lib/visual-style/text-presets.mjs";
import { getFilterPreset } from "../lib/visual-style/filters.mjs";
import { getBackgroundPreset } from "../lib/visual-style/backgrounds.mjs";
import { getOverlayPreset } from "../lib/visual-style/overlays.mjs";
import { applyVisualTemplate, listVisualTemplates, getVisualTemplate, matchVisualTemplate } from "../lib/visual-style/templates.mjs";
import { getCutTransition, resolveCutTransitions, cutTransitionPose } from "../lib/visual-style/cut-transitions.mjs";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const animationQA = process.argv.includes("--animations");
const transitionQA = process.argv.includes("--transitions");
const project = path.resolve(import.meta.dirname, "..");
const resultFile = path.resolve(process.argv[process.argv.indexOf("--renders") + 1] || "");
assert.ok(process.argv.includes("--renders") && resultFile.startsWith(path.join(project, ".isolation-verification/")), "Pass --renders <isolated template QA result.json>");
const rendered = JSON.parse(await readFile(resultFile, "utf8"));
rendered.fixture ||= path.join(path.dirname(resultFile), "fixture.mp4");
rendered.source ||= { id: "00000000-0000-4000-8000-000000000001", width: 960, height: 540, hasAudio: true };
const root = await mkdtemp(path.join(project, ".isolation-verification/template-ui-"));
await mkdir(root, { recursive: true });
const fixture = path.join(root, "Template fixture.mp4");
const extended = spawnSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-stream_loop", "2", "-i", rendered.fixture, "-c", "copy", fixture]);
assert.equal(extended.status, 0, extended.stderr?.toString());
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 2880, height: 2400 }, deviceScaleFactor: 1 });
const errors = [], violations = [], accepted = [], mutations = [], acceptedBatches = [];
let mockBatch;
const source = { ...rendered.source, title: "TEMPLATE FIXTURE", duration: transitionQA ? 12 : 6, width: transitionQA ? 640 : 960, height: transitionQA ? 360 : 540, captions: [{ start: 0.2, end: transitionQA ? 11.8 : 2.8, text: "Keep captions 日本語 한국어" }] };
async function paint() {
  await page.locator('.portrait-preview[aria-busy="false"]').waitFor();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function captionBounds() {
  return page.locator(".portrait-preview .z-20").evaluate((element) => {
    const caption = element.getBoundingClientRect(), canvas = element.closest(".portrait-preview").getBoundingClientRect();
    return { x: caption.x - canvas.x, y: caption.y - canvas.y, width: caption.width, height: caption.height };
  });
}
async function intensity(value) {
  const slider = page.getByLabel("Video filter intensity", { exact: true });
  await slider.focus(); await slider.press("Home");
  for (let i = 0; i < value; i++) await slider.press("ArrowRight");
  assert.equal(await slider.inputValue(), String(value)); await paint();
}
const recipes = listVisualTemplates();
const status = () => page.getByRole("status", { name: "Visual template status", exact: true });
async function selected(id) {
  assert.equal(await status().textContent(), getVisualTemplate(id).label);
  assert.equal(await page.getByRole("button", { name: `Visual template: ${getVisualTemplate(id).label}`, exact: true }).getAttribute("aria-pressed"), "true");
  const recipe = getVisualTemplate(id);
  assert.equal(await page.locator("#text-font").inputValue(), recipe.fontId);
  for (const [prefix, label] of [["Text style", getTextPreset(recipe.textPresetId).label], ["Video filter", getFilterPreset(recipe.filterPresetId).label], ["Background", getBackgroundPreset(recipe.backgroundPresetId).label], ["Overlay", getOverlayPreset(recipe.overlayPresetId).label]]) assert.equal(await page.getByRole("button", { name: `${prefix}: ${label}`, exact: true }).getAttribute("aria-pressed"), "true");
}
async function choose(id) { await page.getByRole("button", { name: `Visual template: ${getVisualTemplate(id).label}`, exact: true }).click(); await paint(); await selected(id); }
async function retained() {
  const result = await page.locator(".portrait-preview video").last().evaluate((v) => ({ same: v === window.__qaVideo, loads: window.__qaLoads, time: v.currentTime }));
  assert.ok(result.same && result.loads === 0 && Math.abs(result.time - 0.75) < 0.05, `Template/custom edit must preserve video and time: ${JSON.stringify(result)}`);
}
async function submit() {
  const n = accepted.length;
  await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
  for (let i = 0; i < 80 && accepted.length === n; i++) await page.waitForTimeout(50);
  assert.equal(accepted.length, n + 1); return accepted.at(-1).plan;
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
    else if (url.pathname.endsWith("/captions")) body = { sourceId: source.id, sourceDuration: source.duration, timeline: "source", origin: "whisper", cues: source.captions };
    else if (url.pathname === "/api/speech/status") body = { modelReady: true, installing: false };
    else if (url.pathname === "/api/editor-renders") body = { jobs: accepted.map((job) => ({ ...job, state: "done", progress: 100 })) };
    else if (url.pathname.startsWith("/api/batches") && route.request().method() === "POST") {
      acceptedBatches.push(structuredClone(route.request().postDataJSON()));
      mockBatch = { id: "00000000-0000-4000-8000-000000000003", items: [], finished: false, createdAt: new Date().toISOString() };
      body = { batch: mockBatch }; status = 202;
    }
    else if (url.pathname === "/api/batches") body = { batches: mockBatch ? [mockBatch] : [] };
    else if (url.pathname.startsWith("/api/batches/")) body = { batch: mockBatch };
    else if (url.pathname === "/api/sources/upload") { body = { source }; status = 201; }
    else if (url.pathname === "/api/render") {
      const request = route.request().postDataJSON();
      accepted.push({ id: `00000000-0000-4000-8000-${String(accepted.length + 2).padStart(12, "0")}`, sourceId: source.id, state: "queued", progress: 0, outputs: [], plan: structuredClone(request.plan), createdAt: new Date().toISOString() });
      body = { job: accepted.at(-1) }; status = 202;
    }
    else if (url.pathname.endsWith("/media")) return route.fulfill({ path: fixture, contentType: "video/mp4" });
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5273/", { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-visual-customize]").evaluate((el) => el.open), false, "Customize is collapsed by default");
  await expandCustomize(page);
  assert.equal(await page.getByRole("button", { name: /^Video filter:/ }).count(), 8);
  assert.equal(await page.getByRole("button", { name: "Video filter: Current", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByLabel("Video filter intensity", { exact: true }).isDisabled(), true);
  await page.getByRole("tab", { name: "Local video", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: "Chuẩn bị source để render", exact: false }).click();
  await page.getByRole("button", { name: "Source đã sẵn sàng", exact: false }).waitFor();
  if (animationQA) {
    // Before an edit plan exists, the same entrance follows the source clock.
    const sourceVideo = page.locator(".portrait-preview video").last();
    await sourceVideo.evaluate((video) => { window.__sourceAnimationVideo = video; });
    await page.getByLabel("Text animation", { exact: true }).selectOption("fade-in");
    const sourceSeek = page.getByLabel("Seek source video", { exact: true });
    await sourceSeek.focus(); await sourceSeek.press("Home");
    for (let i = 0; i < 4; i++) await sourceSeek.press("ArrowRight");
    await paint();
    assert.ok(Math.abs(Number(await page.locator("[data-title-animation]").evaluate((el) => getComputedStyle(el).opacity)) - 0.4) < 0.025);
    await page.getByLabel("Text animation", { exact: true }).selectOption("none");
    assert.equal(await sourceVideo.evaluate((v) => v === window.__sourceAnimationVideo), true);
  }
  await page.getByRole("tab", { name: "Manual cut", exact: false }).click();
  await page.locator("#manual-title-1").fill("COLOR CHECK");
  await page.locator("#manual-title-2").fill("COLOR CHECK");
  // Preserve the established one-second start trim while retaining three ranges.
  await page.getByLabel("Part 1 timestamp ranges").fill(transitionQA ? "0 - 2\n3 - 4\n5 - 6" : "0 - 3");
  await page.getByLabel("Part 2 timestamp ranges").fill(transitionQA ? "6 - 8\n9 - 10\n11 - 12" : "3 - 6");
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();

  assert.equal(await page.getByRole("button", { name: /^Visual template:/ }).count(), 8);
  await page.locator("details").filter({ has: page.locator('summary', { hasText: 'Auto Subtitle' }) }).locator("summary").click();
  await page.getByLabel("Ghép phụ đề vào video xuất").check();
  await page.getByRole("button", { name: "Dùng phụ đề Whisper", exact: true }).click();
  await page.getByText("1 câu · nhận diện local", { exact: false }).waitFor();
  const customize = page.locator("[data-visual-customize]"), customizeSummary = customize.locator(":scope > summary");
  const rowSummary = (id) => page.locator(`[data-customize-row="${id}"] > summary`);
  const customizeMutations = mutations.length;
  await choose("farming-jp");
  for (const [id, value] of [["text", "JP Clean"], ["font", "Noto Sans JP"], ["filter", "Nature · 100%"], ["background", "Dark Blur"], ["overlay", "Vignette"]]) assert.ok((await rowSummary(id).textContent()).includes(value), `${id}: friendly effective summary`);
  const sourceBeforeCollapse = await page.locator(".portrait-preview video").last().evaluate((v) => { window.__customizeVideo = v; return v.currentTime; });
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click();
  assert.equal(await status().textContent(), "Custom");
  assert.ok((await rowSummary("filter").textContent()).includes("Vivid · 100%"));
  await customizeSummary.focus(); await customizeSummary.press("Enter");
  assert.equal(await customize.evaluate((el) => el.open), false);
  assert.equal(await status().textContent(), "Custom");
  await customize.screenshot({ path: path.join(root, "customize-collapsed.png") });
  await customizeSummary.press("Enter");
  assert.equal(await customize.evaluate((el) => el.open), true);
  assert.equal(await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Video filter: Nature", exact: true }).click(); await selected("farming-jp");
  assert.equal(await page.locator(".portrait-preview video").last().evaluate((v, time) => v === window.__customizeVideo && Math.abs(v.currentTime-time)<.025, sourceBeforeCollapse), true);
  for (const id of ["text", "font", "filter", "background", "overlay", "animation", "transition"]) {
    const summary = rowSummary(id); await summary.focus(); await summary.press("Enter");
    assert.equal(await summary.locator("..").evaluate((el) => el.open), false, `${id}: keyboard close`);
  }
  await customize.screenshot({ path: path.join(root, "customize-list.png") });
  await page.setViewportSize({ width: 390, height: 1000 }); await paint();
  assert.equal(await customize.evaluate((el) => el.scrollWidth <= el.clientWidth), true, "Narrow Customize must not overflow");
  await customize.screenshot({ path: path.join(root, "customize-narrow.png") });
  await page.setViewportSize({ width: 2880, height: 2400 }); await expandCustomize(page);
  assert.equal(mutations.length, customizeMutations, "Disclosure/style changes must not mutate worker state");
  await writeFile(path.join(root, "customize-result.json"), JSON.stringify({ collapsedByDefault:true, keyboard:true, friendlySummaries:true, customPersistsAndRematches:true, noVideoRemountOrSeek:true, narrowNoOverflow:true, noDisclosureWorkerMutations:true }, null, 2));
  await choose("current");
  let animationSwitches = 0;
  if (animationQA) {
    const control = page.getByLabel("Text animation", { exact: true });
    assert.equal(await control.locator("option").count(), 4);
    assert.equal(await control.inputValue(), "none");
    // macOS native selects support typeahead; Home/End do not select options.
    await control.focus(); await control.press("f"); await control.press("Enter");
    assert.equal(await control.inputValue(), "fade-in", "Animation selection must work by keyboard");
    await control.selectOption("none");
    const animationMutations = mutations.length;
    await page.waitForFunction(() => [...document.querySelectorAll(".portrait-preview video")].every((video) => video.readyState >= 2));
    await page.locator(".portrait-preview video").last().evaluate((video) => { window.__animationVideo = video; window.__animationLoads = 0; video.addEventListener("loadedmetadata", () => window.__animationLoads++); video.pause(); });
    const animations = ["none", "fade-in", "slide-up", "pop-in"];
    async function seekAnimation(time) {
      const seek = page.getByLabel("Seek edited part", { exact: true });
      await seek.focus(); await seek.press("Home");
      for (let i = 0; i < Math.round(time / 0.05); i++) await seek.press("ArrowRight");
      await paint();
    }
    async function pose() {
      return page.locator("[data-title-animation]").evaluate((element) => {
        const css = getComputedStyle(element), matrix = new DOMMatrixReadOnly(css.transform);
        const video = [...document.querySelectorAll(".portrait-preview video")].at(-1);
        const rect = element.getBoundingClientRect();
        return { opacity: Number(css.opacity), scale: matrix.a, y: matrix.f, width: rect.width / matrix.a, same: video === window.__animationVideo, loads: window.__animationLoads, time: video.currentTime };
      });
    }
    for (const id of animations) {
      await control.selectOption(id); animationSwitches++;
      await page.getByRole("button", { name: "Visual template: Farming JP", exact: true }).click();
      assert.equal(await control.inputValue(), id, "Templates must retain animation");
      await selected("farming-jp");
      for (const time of [0, 0.2, 0.6, 1]) {
        await seekAnimation(time);
        const actual = await pose(), progress = Math.min(time / 0.5, 1);
        assert.ok(actual.same && actual.loads === 0, "Animation must preserve source video/loads");
        assert.ok(Math.abs(actual.opacity - (id === "none" ? 1 : progress)) < 0.025, `${id}/${time}: opacity ${actual.opacity}`);
        assert.ok(Math.abs(actual.scale - (id === "pop-in" ? 0.975 + 0.025 * progress : 1)) < 0.001);
        assert.ok(Math.abs(actual.y - (id === "slide-up" ? 20 * (1-progress) * actual.width / 1080 : 0)) < 0.15);
        await page.locator(".portrait-preview").screenshot({ path: path.join(root, `animation-${id}-${time}.png`) });
      }
      await page.getByRole("button", { name: "Part 2", exact: true }).click(); await paint();
      assert.ok(Math.abs((await pose()).opacity - (id === "none" ? 1 : 0)) < 0.025, "New part restarts entrance");
      await page.getByRole("button", { name: "Part 1", exact: true }).click(); await paint();
    }
    await seekAnimation(0.2);
    const before = await pose();
    const captionBefore = await captionBounds();
    for (let repeat=0; repeat<16; repeat++) for (const id of animations) {
      await control.selectOption(id); animationSwitches++;
      const after = await pose();
      assert.ok(after.same && after.loads === 0 && Math.abs(after.time-before.time)<0.025, "Animation switch must not reload/reseek");
      assert.deepEqual(await captionBounds(), captionBefore, "Subtitle cues must not move within the canvas");
    }
    assert.equal(mutations.length, animationMutations, "Animation preview/stress must not mutate worker state");
    const animationPlans = [];
    for (const id of animations) { await control.selectOption(id); animationPlans.push(await submit()); assert.equal(animationPlans.at(-1).visualStyle.titleAnimation || "none", id); }
    for (let i=1;i<animationPlans.length;i++) for(const key of ["parts","captionCues","originalTitle","render"]) assert.deepEqual(animationPlans[i][key],animationPlans[0][key]);
    await seekAnimation(0);
    await page.getByRole("button", { name: "Play preview", exact: true }).last().click();
    await page.waitForTimeout(180);
    const running = await pose(); await control.selectOption("fade-in");
    assert.equal(await page.locator(".portrait-preview video").last().evaluate((v,time)=>!v.paused && v.currentTime >= time,running.time),true);
    await page.waitForTimeout(600); assert.ok((await pose()).opacity > 0.99);
    await page.getByRole("button", { name: "Pause preview", exact: true }).click();
    await control.selectOption("none");
  }
  let transitionSwitches = 0;
  if (transitionQA) {
    const ids = ["none", "dip-black", "flash-white"];
    assert.equal(await page.getByRole("button", { name: /^Cut transition:/ }).count(), 3);
    async function select(id) { await page.getByRole("button", { name: `Cut transition: ${getCutTransition(id).label}`, exact: true }).click(); transitionSwitches++; await paint(); }
    async function seek(time) {
      const input = page.getByLabel("Seek edited part", { exact: true }); await input.focus(); await input.press("Home");
      for (let i = 0; i < Math.round(time / 0.05); i++) await input.press("ArrowRight"); await paint();
    }
    async function pose() { return page.evaluate(() => {
      const veil = document.querySelector("[data-cut-transition]"), title = document.querySelector("[data-title-animation]"), video = [...document.querySelectorAll(".portrait-preview video")].at(-1);
      return { opacity: veil ? Number(getComputedStyle(veil).opacity) : 0, color: veil ? getComputedStyle(veil).backgroundColor : null, z: veil ? Number(getComputedStyle(veil).zIndex) : 0, titleOpacity: Number(getComputedStyle(title).opacity), time: video.currentTime, same: video === window.__cutVideo, loads: window.__cutLoads };
    }); }
    await page.waitForFunction(() => [...document.querySelectorAll(".portrait-preview video")].every((v) => v.readyState >= 2));
    await page.locator(".portrait-preview video").last().evaluate((v) => { v.pause(); window.__cutVideo = v; window.__cutLoads = 0; v.addEventListener("loadedmetadata", () => window.__cutLoads++); });
    const before = mutations.length, windows = resolveCutTransitions("dip-black", [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }]);
    await page.getByLabel("Text animation", { exact: true }).selectOption("slide-up");
    for (const id of ids) {
      await select(id);
      assert.equal(await page.getByRole("button", { name: `Cut transition: ${getCutTransition(id).label}`, exact: true }).getAttribute("aria-pressed"), "true");
      for (const w of windows) for (const delta of [-0.25, -0.1, 0, 0.1, 0.25]) {
        const time = w.cutFrame / 30 + delta; await seek(time); const actual = await pose(), expected = cutTransitionPose(id, windows, time);
        assert.ok(Math.abs(actual.opacity - expected.opacity) < 0.025, `${id}/${time}: transition opacity ${actual.opacity}`);
        assert.equal(actual.titleOpacity, 1, "Internal cuts must not replay title animation"); assert.ok(actual.same && actual.loads === 0);
        if (id !== "none") { assert.equal(actual.color, id === "dip-black" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)"); assert.equal(actual.z, 8); }
      }
      await page.locator(".portrait-preview").screenshot({ path: path.join(root, `transition-${id}.png`) });
    }
    await select("dip-black"); await seek(0.8);
    const snapshot = await pose(), caption = await captionBounds();
    for (let repeat = 0; repeat < 32; repeat++) for (const id of ids) {
      await select(id); const actual = await pose();
      assert.ok(actual.same && actual.loads === 0 && Math.abs(actual.time - snapshot.time) < 0.025, "Selection must not remount/reseek");
      assert.deepEqual(await captionBounds(), caption, "Transitions must not move subtitles within the canvas");
    }
    for (const id of ["farming-jp", "news", "korean-tutorial", "current"]) {
      await select("flash-white"); await page.getByLabel("Text animation", { exact: true }).selectOption("pop-in"); await choose(id);
      assert.equal(await page.getByRole("button", { name: "Cut transition: Flash White", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(await page.getByLabel("Text animation", { exact: true }).inputValue(), "pop-in"); assert.ok((await pose()).same); assert.equal((await pose()).loads, 0);
    }
    await page.getByRole("button", { name: "Part 2", exact: true }).click(); await paint();
    assert.equal((await pose()).opacity, 0); assert.equal((await pose()).titleOpacity, 0);
    await seek(0.8); assert.equal((await pose()).opacity, 1); assert.equal((await pose()).titleOpacity, 1);
    await page.getByRole("button", { name: "Part 1", exact: true }).click(); await paint();
    await seek(0.55); await page.getByRole("button", { name: "Play preview", exact: true }).last().click();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector("[data-cut-transition]")).opacity) > 0.8);
    const playing = await pose(); await select("dip-black");
    assert.equal(await page.locator(".portrait-preview video").last().evaluate((v,t) => !v.paused && v.currentTime >= t, playing.time), true);
    await page.getByRole("button", { name: "Pause preview", exact: true }).click();
    await page.getByRole("button", { name: "Cut transition: Flash White", exact: true }).focus(); await page.keyboard.press("Enter");
    assert.equal(await page.getByRole("button", { name: "Cut transition: Flash White", exact: true }).getAttribute("aria-pressed"), "true");
    assert.equal(mutations.length, before, "Transition preview must not mutate worker state");
    const submitted = [];
    for (const id of ids) { await select(id); submitted.push(await submit()); assert.equal(submitted.at(-1).visualStyle.cutTransition || "none", id); }
    for (let i = 1; i < submitted.length; i++) for (const key of ["parts", "captionCues", "render", "originalTitle"]) assert.deepEqual(submitted[i][key], submitted[0][key]);
    const savedTransitions = structuredClone(submitted); await select("none"); assert.deepEqual(submitted, savedTransitions);
    await page.getByLabel("Text animation", { exact: true }).selectOption("none"); await choose("current");
  }
  // Custom Time must remain editor state while templates change.
  await page.getByLabel("Part 1 start", { exact: true }).fill("00:00.1");
  const customTimes = await page.getByLabel(/Part [12] (start|end)$/).evaluateAll((els) => els.map((e) => e.value));
  await page.waitForFunction(() => [...document.querySelectorAll(".portrait-preview video")].every((video) => video.readyState >= 2));
  await page.locator(".portrait-preview video").last().evaluate((video) => { window.__qaVideo = video; window.__qaLoads = 0; video.addEventListener("loadedmetadata", () => window.__qaLoads++); video.pause(); });
  await paint();
  await page.locator(".portrait-preview video").evaluateAll((videos) => Promise.all(videos.map((v) => new Promise((resolve) => { v.pause(); v.currentTime = 0.75; if (!v.seeking) resolve(); else v.addEventListener("seeked", resolve, { once: true }); }))));
  const originalMutations = mutations.length, plans = [];
  for (const recipe of recipes) {
    await choose(recipe.id); await retained();
    await page.locator(".portrait-preview").screenshot({ path: path.join(root, `${recipe.id}-preview.png`) });
    assert.equal(await page.getByLabel("Ghép phụ đề vào video xuất").isChecked(), true);
    assert.equal(await page.getByRole("button", { name: "Dùng phụ đề Whisper", exact: true }).getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.getByLabel(/Part [12] (start|end)$/).evaluateAll((els) => els.map((e) => e.value)), customTimes);
  }
  assert.equal(mutations.length, originalMutations, "Selecting templates must not start any worker mutation");
  // Accepted ordinary styles/content are the renderer contract, with no template metadata.
  for (const recipe of recipes) {
    await choose(recipe.id);
    const plan = await submit(); plans.push(plan);
    assert.deepEqual(plan.visualStyle, applyVisualTemplate({ subtitle: { enabled: true, source: "whisper" } }, recipe.id));
    assert.equal(matchVisualTemplate(plan.visualStyle), recipe.id);
    assert.equal(plan.captionCues.cues[0].text, source.captions[0].text);
    assert.equal(plan.parts[0].title, "COLOR CHECK");
    if (plans.length > 1) for (const key of ["parts", "captionCues", "render", "originalTitle"]) assert.deepEqual(plan[key], plans[0][key], `Template changed content ${key}`);
  }
  const saved = structuredClone(accepted.map((job) => job.plan));
  for (const [template, edit] of [["viral-shorts", async () => page.getByRole("button", { name: "Background: Black", exact: true }).click()], ["farming-jp", async () => page.getByRole("button", { name: "Overlay: Grain", exact: true }).click()], ["korean-tutorial", async () => page.locator("#text-font").selectOption("auto")], ["news", async () => intensity(70)]]) {
    await choose(template); await edit(); await paint(); assert.equal(await status().textContent(), "Custom"); await retained();
    await choose(template); await retained();
  }
  await choose("farming-jp");
  await page.getByRole("button", { name: "Video filter: Vivid", exact: true }).click(); assert.equal(await status().textContent(), "Custom");
  await page.getByRole("button", { name: "Video filter: Nature", exact: true }).click(); await selected("farming-jp");
  await page.locator("#text-font").selectOption("auto"); assert.equal(await status().textContent(), "Custom");
  await page.locator("#text-font").selectOption("Noto Sans JP"); await selected("farming-jp");
  await choose("news"); await intensity(70); assert.equal(await status().textContent(), "Custom"); await intensity(100); await selected("news");
  await page.getByLabel("Màu chữ phụ đề", { exact: true }).fill("#abcdef"); assert.equal(await status().textContent(), "Custom"); await retained();
  await choose("news"); assert.equal(await page.getByLabel("Màu chữ phụ đề", { exact: true }).inputValue(), "#ffffff");
  await page.getByLabel("Ghép phụ đề vào video xuất").uncheck(); await selected("news"); await choose("farming-jp"); assert.equal(await page.getByLabel("Ghép phụ đề vào video xuất").isChecked(), false);
  await page.getByLabel("Ghép phụ đề vào video xuất").check(); await selected("farming-jp");
  const beforeStress = mutations.length; let switches = 0;
  for (let repeat = 0; repeat < 4; repeat++) for (const recipe of recipes) {
    await page.getByRole("button", { name: `Visual template: ${recipe.label}`, exact: true }).click();
    await selected(recipe.id); await retained(); switches++;
    await page.getByRole("button", { name: "Background: Black", exact: true }).click(); assert.equal(await status().textContent(), "Custom");
    await choose(recipe.id); await retained(); switches++;
  }
  assert.equal(mutations.length, beforeStress, "Stress switches must not upload/reprepare/AI/caption/render");
  await page.getByRole("button", { name: "Play preview", exact: true }).last().click(); await page.waitForTimeout(150);
  const playingTime = await page.locator(".portrait-preview video").last().evaluate((v) => v.currentTime);
  await choose("viral-shorts");
  assert.equal(await page.locator(".portrait-preview video").last().evaluate((v, time) => !v.paused && v.currentTime >= time, playingTime), true);
  await page.getByRole("button", { name: "Pause preview", exact: true }).click();
  await page.getByRole("button", { name: "Visual template: Farming JP", exact: true }).focus(); await page.keyboard.press("Enter"); await selected("farming-jp");
  assert.deepEqual(accepted.map((job) => job.plan), saved);
  await page.locator('[aria-labelledby="visual-template-heading"]').screenshot({ path: path.join(root, "controls.png") });
  for (const id of ["viral-shorts", "farming-jp"]) {
    await choose(id);
    if (animationQA) await page.getByLabel("Text animation", { exact: true }).selectOption(id === "viral-shorts" ? "fade-in" : "pop-in");
    if (transitionQA) await page.getByRole("button", { name: id === "viral-shorts" ? "Cut transition: Dip Black" : "Cut transition: Flash White", exact: true }).click();
    await page.getByRole("button", { name: /^Xử lý hàng loạt/ }).click();
    await page.locator("#batch-urls").fill(`https://youtu.be/synthetic-${id}`);
    const n = acceptedBatches.length; await page.getByRole("button", { name: /Chạy hàng đợi tự động|Thêm vào hàng đợi đang chạy/ }).click();
    for (let i = 0; i < 80 && acceptedBatches.length === n; i++) await page.waitForTimeout(50);
    assert.equal(acceptedBatches.length, n + 1); assert.equal(matchVisualTemplate(acceptedBatches.at(-1).visualStyle), id);
    await page.getByRole("button", { name: "Chỉnh từng video", exact: true }).click();
  }
  if (animationQA) assert.deepEqual(acceptedBatches.map((b) => b.visualStyle.titleAnimation), ["fade-in", "pop-in"]);
  if (transitionQA) assert.deepEqual(acceptedBatches.map((b) => b.visualStyle.cutTransition), ["dip-black", "flash-white"]);
  const batchSnapshot = structuredClone(acceptedBatches);
  await choose("current"); assert.deepEqual(acceptedBatches, batchSnapshot);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  if (transitionQA) await writeFile(path.join(root, "transition-result.json"), JSON.stringify({ transitionSwitches, stressSwitches: 96, twoBoundariesAndParts: true, titleDoesNotReplay: true, subtitlesStationary: true, sourceRetained: true, keyboardSelection: true, playbackRetained: true, independentRenderAndBatchSnapshots: true, noAutomaticWorkerMutations: true, errors, violations }, null, 2));
  await writeFile(path.join(root, "result.json"), JSON.stringify({ renderResult: resultFile, animationQA, animationSwitches, templates: 8, templateSwitches: switches, matchedRecipes: plans.map((plan) => matchVisualTemplate(plan.visualStyle)), customAndRematch: true, subtitleOperationalStatePreserved: true, customTimesPreserved: true, contentPreserved: true, sourceVideoRetained: true, noAutomaticWorkerMutations: true, queuedSnapshotUnchanged: true, batchSnapshotUnchanged: true, keyboardSelection: true, productionRequests: 0, errors }, null, 2));
  console.log(`PASS visual template browser interaction/stress: ${root}`);
} finally { await browser.close(); }
