import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { OVERLAY_ASSETS, OVERLAY_PRESET_IDS, getOverlayPreset, getOverlayAsset, activeSceneOverlays, overlayAssetUrl } from "./visual-style/overlays.mjs";
import { applyOverlayPreset, applyOverlayOpacity } from "./visual-style/overlay-presets.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { applyFilterPreset } from "./visual-style/filter-presets.mjs";
import { applyBackgroundPreset } from "./visual-style/background-presets.mjs";
import { generateOverlayAssets } from "../scripts/generate-overlay-assets.mjs";
import { renderSceneOverlay } from "../worker/scene-overlays.mjs";

const project = path.resolve(import.meta.dirname, "..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
test("six curated presets and five assets are unique, immutable and copy-safe", () => {
  assert.equal(new Set(OVERLAY_PRESET_IDS).size, 6); assert.equal(Object.keys(OVERLAY_ASSETS).length, 5);
  assert.ok(Object.isFrozen(OVERLAY_PRESET_IDS)); assert.ok(Object.isFrozen(OVERLAY_ASSETS));
  for (const id of OVERLAY_PRESET_IDS) {
    const preset = getOverlayPreset(id), style = applyOverlayPreset(undefined, id);
    assert.deepEqual(assertRenderableVisualStyle(style), style);
    assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(style)), style);
    for (const overlay of preset.overlays) {
      assert.ok(Object.isFrozen(OVERLAY_ASSETS[overlay.assetId]));
      const asset = getOverlayAsset(overlay.assetId);
      assert.equal(overlayAssetUrl(overlay.assetId), `/overlays/${asset.file}`);
      asset.file = "bad";
      assert.notEqual(getOverlayAsset(overlay.assetId).file, "bad");
      overlay.opacity = 999;
      assert.notEqual(getOverlayPreset(id).overlays[0].opacity, 999);
    }
  }
});
test("None and missing overlays preserve the exact default; inactive overlays perform no IO", async () => {
  assert.deepEqual(applyOverlayPreset(undefined, "none"), normalizeVisualStyle());
  assert.deepEqual(normalizeVisualStyle().overlays, []);
  const invisible = applyOverlayOpacity(applyOverlayPreset(undefined, "grain"), 0).overlays;
  assert.deepEqual(activeSceneOverlays(invisible), []);
  assert.equal(await renderSceneOverlay({ overlays: invisible }), null);
});
test("curated overlays reject unsafe assets/modes, clamp opacity and discard unknown expressions", () => {
  const base = getOverlayPreset("grain").overlays[0];
  for (const value of ["../grain", "/etc/passwd", "https://bad/a", "file:///bad", "<svg/>", "movie=/bad", "url(bad)", "unknown"]) {
    assert.throws(() => getOverlayAsset(value), /Invalid/);
    assert.throws(() => normalizeVisualStyle({ overlays: [{ ...base, assetId: value }] }), /Invalid/);
  }
  for (const patch of [{ blendMode: "screen" }, { blendMode: "multiply" }, { blendMode: "overlay;exec" }, { kind: "video" }, { layer: 999 }, { scaleMode: "free" }, { presetId: "none" }, { presetId: "missing" }, { enabled: "yes" }]) assert.throws(() => normalizeVisualStyle({ overlays: [{ ...base, ...patch }] }), /Invalid|None/);
  for (const opacity of [NaN, Infinity, "1", null]) assert.equal(normalizeVisualStyle({ overlays: [{ ...base, opacity }] }).overlays[0].opacity, base.opacity);
  assert.equal(applyOverlayOpacity({ overlays: [base] }, 99).overlays[0].opacity, 1);
  assert.equal(applyOverlayOpacity({ overlays: [base] }, -99).overlays[0].opacity, 0);
  assert.deepEqual(normalizeVisualStyle({ overlays: [{ ...base, path: "/bad", url: "https://bad", css: "url(bad)", svg: "<svg/>", ffmpeg: "movie=/bad", zIndex: 999 }] }).overlays, [base]);
  assert.throws(() => assertRenderableVisualStyle({ overlays: [{ id: "legacy", assetId: "unregistered" }] }), /not enabled/);
  assert.throws(() => normalizeVisualStyle({ overlays: [base, base] }), /Duplicate/);
  assert.throws(() => normalizeVisualStyle({ overlays: Array(17).fill(base) }), /maximum/);
});
test("all requested combinations preserve other layers, font overrides and independent snapshots", () => {
  for (const [text, filter, background, overlay] of [["current", "current", "current", "none"], ["shorts-bold", "vivid", "dark-blur", "grain"], ["yellow-hook", "nature", "black", "vignette"], ["jp-clean", "clean", "light-blur", "soft-glow"], ["kr-clean", "muted", "soft-gradient", "film-frame"], ["news", "contrast", "dark-gradient", "rec-hud"]]) {
    const before = applyBackgroundPreset(applyFilterPreset(applyTextPreset(undefined, text), filter), background);
    before.subtitle.enabled = true;
    const style = applyOverlayPreset(before, overlay);
    assert.deepEqual({ ...style, overlays: before.overlays }, before);
    for (const next of [applyTextPreset(style, "news"), applyFontOverride(style, "Inter"), applyFilterPreset(style, "vivid"), applyBackgroundPreset(style, "black")]) assert.deepEqual(next.overlays, style.overlays);
    const a = snapshotPlanVisualStyle({ visualStyle: style }), b = snapshotPlanVisualStyle({ visualStyle: style });
    if (style.overlays.length) { style.overlays[0].opacity = 0; a.visualStyle.overlays[0].assetId = "bad"; assert.deepEqual(b.visualStyle.overlays, getOverlayPreset(overlay).overlays); }
  }
});
test("generator reproduces committed RGBA assets/hashes and expected alpha regions; ordered scene flattening", async () => {
  await mkdir(path.join(project, ".isolation-verification"), { recursive: true });
  const root = await mkdtemp(path.join(project, ".isolation-verification/overlay-unit-"));
  const generated = await generateOverlayAssets(path.join(root, "generated"));
  const manifest = JSON.parse(await readFile(path.join(project, "public/overlays/manifest.json")));
  assert.deepEqual(generated, manifest);
  for (const asset of Object.values(OVERLAY_ASSETS)) {
    const file = path.join(project, "public/overlays", asset.file);
    assert.equal(hash(await readFile(file)), manifest[asset.id].sha256);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [1080, 1920, 4]);
    const alpha = (x, y) => data[(y * 1080 + x) * 4 + 3];
    if (/vignette|film-frame|rec-hud/.test(asset.id)) assert.equal(alpha(540, 960), 0);
    if (asset.id.includes("grain")) { assert.ok(alpha(10, 10) > 0); assert.notEqual(alpha(10, 10), alpha(11, 10)); }
    if (asset.id.includes("vignette")) assert.ok(alpha(0, 0) > 120);
    if (asset.id.includes("soft-glow")) assert.ok(alpha(560, 690) > 65 && alpha(20, 1800) === 0);
    if (asset.id.includes("film-frame")) assert.ok(alpha(3, 900) > 0);
    if (asset.id.includes("rec-hud")) assert.ok(alpha(50, 49) > 0 && alpha(60, 335) > 0);
  }
  const a = getOverlayPreset("vignette").overlays[0], b = getOverlayPreset("soft-glow").overlays[0];
  const file1 = path.join(root, "scene1.png"), file2 = path.join(root, "scene2.png");
  await renderSceneOverlay({ overlays: [a, b], publicRoot: path.join(project, "public"), outputPath: file1 });
  await renderSceneOverlay({ overlays: [b, a], publicRoot: path.join(project, "public"), outputPath: file2 });
  assert.notEqual(hash(await readFile(file1)), hash(await readFile(file2)), "Array order determines over-compositing order");
});
