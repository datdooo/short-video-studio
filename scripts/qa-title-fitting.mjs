// Exercise the actual source/packaged worker overlay function with synthetic
// titles. No server, media/history, credentials, production runtime or network.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

const project = path.resolve(import.meta.dirname, "..");
const packaged = process.argv.includes("--packaged");
const app = packaged ? path.join(project, "release/dev/ShortCut Studio Dev.app/Contents/Resources/app") : project;
await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
const root = await mkdtemp(path.join(project, `.isolation-verification/title-${packaged ? "package" : "source"}-`));
const xml = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
process.env.FONTCONFIG_FILE = path.join(root, "fonts.xml");
await writeFile(process.env.FONTCONFIG_FILE, `<fontconfig><dir>${xml(path.join(app, "public"))}</dir><cachedir>${xml(path.join(root, "font-cache"))}</cachedir></fontconfig>`);
const sharp = createRequire(path.join(app, "package.json"))("sharp");
const load = (file) => import(pathToFileURL(path.join(app, file)).href);
const { listFonts, fontFamilyForStyle } = await load("lib/visual-style/fonts.mjs");
const { styledTextSvg } = await load("lib/visual-style/text-render.mjs");
const { constrainTitlePair, needsMeasuredTitleFit } = await load("lib/visual-style/title-fit.mjs");
const { applyTextPreset, applyFontOverride } = await load("lib/visual-style/text-presets.mjs");
const { DEFAULT_VISUAL_STYLE } = await load("lib/visual-style/defaults.mjs");
const { TITLE_LAYOUT, FOREGROUND_Y, FOREGROUND_HEIGHT } = await load("lib/render-config.mjs");
const worker = await readFile(path.join(app, "worker/server.mjs"), "utf8");
// Evaluate only these trusted local worker definitions, avoiding server startup.
const definitions = worker.slice(worker.indexOf("function fontFamilyFor("), worker.indexOf("async function loadSource("))
  + worker.slice(worker.indexOf("async function renderTitleOverlay("), worker.indexOf("async function subtitleFrames("));
let measuredPair;
const render = vm.runInNewContext(`${definitions}\nrenderTitleOverlay`, {
  sharp, path, Buffer, projectRoot: app, process: { env: {} }, listFonts, fontFamilyForStyle, styledTextSvg,
  needsMeasuredTitleFit, constrainTitlePair: async (...args) => { measuredPair = await constrainTitlePair(...args); return measuredPair; },
  TITLE_LAYOUT, DEFAULT_VISUAL_STYLE, FOREGROUND_Y,
});
const samples = ["W".repeat(180), "m".repeat(180), "@".repeat(180), "Wm@ ".repeat(100), "A very long title with accents Süß Français ".repeat(40)];
const results = [];
for (const preset of ["clean", "shorts-bold", "current"]) for (const font of listFonts()) {
  if (preset === "current" && font.id === "auto") continue; // Deliberate legacy compatibility path.
  for (const [index, text] of samples.entries()) {
    const style = applyFontOverride(applyTextPreset(undefined, preset), font.id);
    const outputPath = path.join(root, `${preset}-${font.id.replaceAll(" ", "-")}-${index}.png`);
    const shineOutputPath = preset === "current" ? outputPath.replace(".png", "-shine.png") : undefined;
    measuredPair = undefined;
    await render({ outputPath, shineOutputPath, originalTitle: text, partTitle: text, partId: 1, totalParts: 2, visualStyle: style });
    assert.ok(measuredPair, "Must exercise the width guard");
    for (const image of [outputPath, shineOutputPath].filter(Boolean)) {
      const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let visible = 0, edges = 0, foreground = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha > 127) visible++;
        if (x < 8 || x > 1071 || y < 8 || y > 1911) edges += alpha;
        if (y >= FOREGROUND_Y && y < FOREGROUND_Y + FOREGROUND_HEIGHT) foreground += alpha;
      }
      assert.ok(visible > 500); assert.equal(edges, 0, `${font.id}/${index}: frame clipping`); assert.equal(foreground, 0);
    }
    for (const [role, fit] of Object.entries(measuredPair)) {
      const lines = fit.lines || fit.text.split("\n");
      assert.ok(lines.length <= TITLE_LAYOUT.maxLines);
      assert.ok(fit.fontSize >= TITLE_LAYOUT.minFontSize);
      assert.ok(lines.length * fit.fontSize + (lines.length - 1) * fit.lineSpacing <= TITLE_LAYOUT[role].bottom - TITLE_LAYOUT[role].top);
    }
    results.push({ preset, font: font.id, sample: index, size: measuredPair.original.fontSize, truncated: measuredPair.original.truncated });
  }
  console.log(`PASS ${packaged ? "packaged" : "source"} title stress: ${preset}/${font.id}`);
}
await writeFile(path.join(root, "result.json"), JSON.stringify({ packaged, cases: results.length, results }, null, 2));
console.log(`PASS measured title fitting (${results.length} cases): ${root}`);
