import test from "node:test";
import assert from "node:assert/strict";
import { BACKGROUND_PRESET_IDS, CURRENT_BACKGROUND, getBackgroundPreset, listBackgroundPresets, normalizeBackground, backgroundCss, gradientRowRgb } from "./visual-style/backgrounds.mjs";
import { applyBackgroundPreset } from "./visual-style/background-presets.mjs";
import { applyFilterPreset } from "./visual-style/filter-presets.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";

test("six background recipes are normalized, copy-safe and serializable", () => {
  assert.equal(new Set(BACKGROUND_PRESET_IDS).size, 6);
  assert.ok(Object.isFrozen(BACKGROUND_PRESET_IDS)); assert.ok(Object.isFrozen(CURRENT_BACKGROUND.blur));
  for (const preset of listBackgroundPresets()) {
    assert.deepEqual(normalizeBackground(preset.background), preset.background);
    const style = applyBackgroundPreset(undefined, preset.id);
    assert.deepEqual(assertRenderableVisualStyle(style), style);
    assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(style)), style);
    preset.background.mode = "injected";
    assert.notEqual(getBackgroundPreset(preset.id).background.mode, "injected");
  }
  for (const id of ["__proto__", "bad", "url(secret)", {}, null]) assert.throws(() => getBackgroundPreset(id), /Invalid/);
});
test("missing and explicit Current keep the exact legacy representation", () => {
  for (const value of [undefined, null, {}, { presetId: "current" }]) assert.deepEqual(normalizeBackground(value), CURRENT_BACKGROUND);
  assert.deepEqual(normalizeVisualStyle().background, CURRENT_BACKGROUND);
  assert.deepEqual(applyBackgroundPreset(applyBackgroundPreset(undefined, "black"), "current"), normalizeVisualStyle());
});
test("background boundary rejects expressions, malformed modes/gradients and unsafe render changes", () => {
  for (const value of [[], 1, "black", new Date(), { mode: "image" }, { presetId: "black", mode: "source-blur" }, { presetId: "soft-gradient", gradient: { stops: [] } }, { presetId: "dark-gradient", gradient: { angle: Infinity } }, { presetId: "dark-gradient", gradient: { angle: 90 } }, { presetId: "dark-gradient", gradient: { stops: [{ position: 0.5 }, {}] } }]) assert.throws(() => normalizeBackground(value), /Invalid|require|supported|must/);
  const dirty = { ...getBackgroundPreset("soft-gradient").background, css: "url(secret)", path: "/secret" };
  assert.deepEqual(normalizeBackground(dirty), getBackgroundPreset("soft-gradient").background);
  const bg = normalizeBackground({ opacity: Infinity, blur: { radius: NaN, passes: "2" }, baseColor: "red" });
  assert.deepEqual(bg, CURRENT_BACKGROUND);
  assert.equal(normalizeBackground({ opacity: 99, blur: { radius: -99, passes: 99 } }).opacity, 1);
  assert.equal(normalizeBackground({ blur: { radius: -99, passes: 99 } }).blur.radius, 0);
  assert.equal(normalizeBackground({ blur: { passes: 99 } }).blur.passes, 4);
  assert.throws(() => assertRenderableVisualStyle({ background: { opacity: 0.9 } }), /not enabled/);
  assert.throws(() => assertRenderableVisualStyle({ background: { presetId: "black", baseColor: "#ffffff" } }), /not enabled/);
  const custom = getBackgroundPreset("soft-gradient").background; custom.gradient.stops[0].color = "#ffffff";
  assert.throws(() => assertRenderableVisualStyle({ background: custom }), /not enabled/);
  assert.doesNotMatch(JSON.stringify(normalizeBackground(dirty)), /secret|url/);
});
export const combinations = [["shorts-bold", "vivid", "current"], ["yellow-hook", "nature", "dark-blur"], ["jp-clean", "clean", "light-blur"], ["kr-clean", "muted", "black"], ["news", "contrast", "soft-gradient"]];
test("all requested text/filter/background combinations compose independently", () => {
  for (const [text, filter, background] of combinations) {
    const before = applyFilterPreset(applyTextPreset(undefined, text), filter);
    before.subtitle.enabled = true;
    const style = applyBackgroundPreset(before, background);
    assert.deepEqual({ ...style, background: before.background }, before);
    for (const next of [applyTextPreset(style, "news"), applyFontOverride(style, "Inter"), applyFilterPreset(style, "vivid")]) assert.deepEqual(next.background, style.background);
    assert.deepEqual(applyTextPreset(style, "news").filter, style.filter);
    assert.deepEqual(applyFilterPreset(style, "muted").originalTitle, style.originalTitle);
    const a = snapshotPlanVisualStyle({ visualStyle: style }), b = snapshotPlanVisualStyle({ visualStyle: style });
    style.background.mode = "invalid"; a.visualStyle.background.mode = "invalid";
    assert.equal(b.visualStyle.background.mode, getBackgroundPreset(background).background.mode);
  }
  const staged = normalizeVisualStyle({ overlays: [{ id: "reserved", assetId: "reserved" }], foreground: { scale: 2 } });
  const changed = applyBackgroundPreset(staged, "black");
  assert.deepEqual(changed.overlays, staged.overlays); assert.deepEqual(changed.foreground, staged.foreground);
});
test("static gradient math and CSS use the same fixed safe stops", () => {
  for (const id of ["soft-gradient", "dark-gradient"]) {
    const bg = getBackgroundPreset(id).background;
    assert.match(backgroundCss(bg).backgroundImage, /linear-gradient\(180deg, #[a-f0-9]{6} 0%, #[a-f0-9]{6} 100%\)/);
    const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
    assert.deepEqual(gradientRowRgb(bg, 0, 1920), rgb(bg.gradient.stops[0].color));
    assert.deepEqual(gradientRowRgb(bg, 1919, 1920), rgb(bg.gradient.stops[1].color));
    assert.deepEqual(gradientRowRgb(bg, 959.5, 1920), rgb(bg.gradient.stops[0].color).map((v, i) => Math.round((v + rgb(bg.gradient.stops[1].color)[i]) / 2)));
  }
});
