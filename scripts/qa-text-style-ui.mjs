import { expandCustomize } from "./qa-customize-helpers.mjs";
// Requires Playwright via QA_PLAYWRIGHT_MODULE or an installed playwright module.
// Worker routes are mocked: synthetic browser fixture only, no saved credentials,
// media/history writes, AI requests, or contact with production ports.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || "playwright");
const project = path.resolve(import.meta.dirname, "..");
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, ".isolation-verification/text-ui-"));
const fixture = path.join(root, "QA synthetic video.mp4");
const generated = spawnSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=30", "-t", "6", "-c:v", "libx264", "-preset", "ultrafast", fixture]);
assert.equal(generated.status, 0, generated.stderr?.toString());
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const violations = [], errors = [], accepted = [];
const source = { id: "00000000-0000-4000-8000-000000000001", kind: "upload", title: "QA synthetic video", duration: 6, width: 960, height: 540, hasAudio: false, transcript: "" };
try {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):(5173|8787)\//, (route) => { violations.push(route.request().url()); return route.abort(); });
  await page.route("https://**", (route) => { violations.push(route.request().url()); return route.abort(); });
  await page.route("http://127.0.0.1:8887/**", async (route) => {
    const url = new URL(route.request().url()); let body = {}, status = 200;
    if (url.pathname === "/health") body = { ok: true, readyForYouTube: true, chatGPTAuthAvailable: false, tools: { ffmpeg: "QA", ffprobe: "QA", ytDlp: "QA" }, render: { contrast: 1.04, saturation: 1.06 } };
    else if (url.pathname === "/api/chatgpt/session") body = { available: false, connected: false };
    else if (url.pathname === "/api/editor-renders") body = { jobs: accepted };
    else if (url.pathname === "/api/batches") body = { batches: [] };
    else if (url.pathname === "/api/sources/upload") { body = { source }; status = 201; }
    else if (url.pathname === "/api/render") {
      const request = route.request().postDataJSON();
      accepted.push({ id: "00000000-0000-4000-8000-000000000002", sourceId: source.id, state: "queued", progress: 0, outputs: [], plan: structuredClone(request.plan), createdAt: new Date().toISOString() });
      body = { job: accepted.at(-1) }; status = 202;
    }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5273/", { waitUntil: "networkidle", timeout: 60000 });
  await expandCustomize(page);
  assert.equal(await page.getByRole("button", { name: /^Text style:/ }).count(), 8);
  assert.equal(await page.getByRole("button", { name: "Text style: Current", exact: true }).getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "Text style: Yellow Hook", exact: true }).click();
  await page.locator("#text-font").selectOption("Noto Sans JP");
  assert.equal(await page.getByRole("button", { name: "Text style: Yellow Hook", exact: true }).getAttribute("aria-pressed"), "true");
  const title = page.locator(".portrait-preview .overlay-copy-block").first();
  assert.equal(await title.evaluate((element) => getComputedStyle(element).color), "rgb(255, 226, 74)");
  assert.match(await title.evaluate((element) => getComputedStyle(element).fontFamily), /Studio Noto Sans JP/);
  await page.getByText(/^Auto Subtitle ·/).click();
  await page.getByLabel("Ghép phụ đề vào video xuất").check();
  await page.getByLabel("Màu chữ phụ đề", { exact: true }).fill("#aabbcc");
  assert.equal(await page.getByLabel("Màu chữ phụ đề", { exact: true }).inputValue(), "#aabbcc");
  await page.getByRole("button", { name: "Text style: Clean", exact: true }).click();
  assert.equal(await page.getByLabel("Màu chữ phụ đề", { exact: true }).inputValue(), "#ffffff");
  assert.equal(await page.getByLabel("Ghép phụ đề vào video xuất").isChecked(), true);
  await page.getByLabel("Màu chữ phụ đề", { exact: true }).fill("#abcdef");
  await page.getByLabel("Ghép phụ đề vào video xuất").uncheck();
  await page.getByRole("tab", { name: "Local video", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await page.getByRole("button", { name: "Chuẩn bị source để render", exact: false }).click();
  await page.getByRole("button", { name: "Source đã sẵn sàng", exact: false }).waitFor();
  await page.getByRole("tab", { name: "Manual cut", exact: false }).click();
  await page.locator("#manual-title-1").fill("How to grow sweeter tomatoes");
  await page.locator("#manual-title-2").fill("トマトを甘く育てる方法");
  await page.getByLabel("Part 1 timestamp ranges").fill("0 - 3");
  await page.getByLabel("Part 2 timestamp ranges").fill("3 - 6");
  await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
  assert.equal(await page.getByRole("button", { name: "Text style: Clean", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#text-font").inputValue(), "Inter");
  await page.getByRole("button", { name: "Render 2 MP4 files", exact: true }).click();
  for (let i = 0; i < 80 && !accepted.length; i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].plan.visualStyle.textPresetId, "clean");
  assert.equal(accepted[0].plan.visualStyle.originalTitle.font, "Inter");
  assert.equal(accepted[0].plan.visualStyle.subtitle.color, "#abcdef");
  const saved = structuredClone(accepted[0].plan.visualStyle);
  await page.getByRole("button", { name: "Text style: KR Clean", exact: true }).click();
  assert.deepEqual(accepted[0].plan.visualStyle, saved);
  // Exercise native keyboard interaction and verify every face loads locally.
  await page.getByRole("button", { name: "Text style: JP Clean", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("button", { name: "Text style: JP Clean", exact: true }).getAttribute("aria-pressed"), "true");
  for (const family of ["Noto Sans", "Noto Sans JP", "Noto Sans KR", "Montserrat", "Inter", "Roboto Condensed", "Oswald"]) {
    assert.ok(await page.evaluate(async (font) => (await document.fonts.load(`700 24px "Studio ${font}"`)).length > 0, family));
  }
  await page.locator('[aria-labelledby="text-style-heading"]').screenshot({ path: path.join(root, "controls.png") });
  await page.locator(".portrait-preview").screenshot({ path: path.join(root, "preview.png") });
  let titleStressCases = 0;
  if (process.argv.includes("--stress")) {
    await page.getByRole("button", { name: "Text style: Clean", exact: true }).click();
    for (const text of ["W".repeat(180), "m".repeat(180), "@".repeat(180), "Wm@ ".repeat(100), "A very long title with accents Süß Français ".repeat(40)]) {
      await page.locator("#source-title").fill(text);
      await page.locator("#manual-title-1").fill(text);
      await page.getByRole("button", { name: "Apply manual timestamps", exact: false }).click();
      for (const font of ["auto", "Noto Sans", "Noto Sans JP", "Noto Sans KR", "Montserrat", "Inter", "Roboto Condensed", "Oswald"]) {
        await page.locator("#text-font").selectOption(font);
        await page.locator('.portrait-preview[aria-busy="false"]').waitFor();
        const bounds = await page.locator(".portrait-preview .overlay-copy-block").evaluateAll((elements) => elements.map((element) => {
          const css = getComputedStyle(element), canvas = document.createElement("canvas"), context = canvas.getContext("2d");
          context.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
          return { text: element.textContent, font: context.font, widths: element.textContent.split("\n").map((line) => context.measureText(line).width), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, zoneHeight: element.parentElement.getBoundingClientRect().height };
        }));
        for (const box of bounds) {
          assert.ok(box.widths.every((width) => width <= box.width + 1), `${font}: preview horizontal overflow ${JSON.stringify(box)}`);
          assert.ok(box.height <= box.zoneHeight + 1, `${font}: preview vertical overflow`);
        }
        titleStressCases++;
      }
    }
    await page.locator(".portrait-preview").screenshot({ path: path.join(root, "stress-preview.png") });
  }
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
  await writeFile(path.join(root, "result.json"), JSON.stringify({ presets: 8, fontsLoadedLocally: 7, presetFontOverride: true, subtitlePrecedence: true, planTransitionPersistence: true, queuedSnapshotUnchanged: true, keyboardSelection: true, titleStressCases, productionRequests: 0, pageErrors: errors }, null, 2));
  console.log(`PASS text-style browser QA: ${root}`);
} finally { await browser.close(); }
