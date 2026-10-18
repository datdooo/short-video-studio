import test from "node:test";
import assert from "node:assert/strict";
import { FILTER_PRESET_IDS, CURRENT_FILTER, listFilterPresets, getFilterPreset, normalizeFilter, currentFilterEnvironment, effectiveFilterParameters, filterColorMatrix, browserFilterStyle, ffmpegFilterExpression } from "./visual-style/filters.mjs";
import { applyFilterPreset, applyFilterIntensity } from "./visual-style/filter-presets.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";

test("filter registry has eight unique IDs and copy-safe normalized presets", () => {
  assert.equal(FILTER_PRESET_IDS.length, 8);
  assert.equal(new Set(FILTER_PRESET_IDS).size, 8);
  assert.ok(Object.isFrozen(FILTER_PRESET_IDS)); assert.ok(Object.isFrozen(CURRENT_FILTER));
  for (const preset of listFilterPresets()) {
    assert.deepEqual(normalizeFilter(preset.filter), preset.filter);
    const style = applyFilterPreset(undefined, preset.id);
    assert.doesNotThrow(() => assertRenderableVisualStyle(style));
    assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(style)), style);
    preset.filter.contrast = 999;
    assert.notEqual(getFilterPreset(preset.id).filter.contrast, 999);
  }
  for (const id of ["__proto__", "movie=/secret", "url(https://bad)", "missing", null, {}]) {
    assert.throws(() => getFilterPreset(id), /Invalid filter/);
    assert.throws(() => normalizeFilter({ presetId: id }), /Invalid filter/);
  }
});

test("Current and missing filters retain legacy JSON and exact eq/CSS syntax", () => {
  for (const value of [undefined, null, {}, { presetId: "current" }, { contrast: 1.04, saturation: 1.06 }]) {
    assert.deepEqual(normalizeFilter(value), { contrast: 1.04, saturation: 1.06 });
    assert.equal(ffmpegFilterExpression(value), "eq=contrast=1.04:saturation=1.06");
    assert.equal(browserFilterStyle(value), "contrast(1.04) saturate(1.06)");
  }
  assert.deepEqual(normalizeVisualStyle().filter, CURRENT_FILTER);
  assert.throws(() => assertRenderableVisualStyle({ filter: { contrast: 1.2 } }), /not enabled/);
  assert.deepEqual(normalizeFilter({ brightness: 0.05, intensity: 0 }), CURRENT_FILTER, "Old objects without a preset ID retain the old unknown-field behavior");
  assert.throws(() => normalizeFilter({ presetId: "current", intensity: 0 }), /Current/);
});

test("finite filter parameters clamp, malformed containers reject, and renderer expressions disappear", () => {
  assert.deepEqual(normalizeFilter({ presetId: "vivid", brightness: 99, contrast: -9, saturation: 99, intensity: -1 }), { presetId: "vivid", brightness: 0.08, contrast: 0.8, saturation: 1.4, intensity: 0 });
  for (const value of [NaN, Infinity, -Infinity, "1.2", {}, [], null]) {
    assert.deepEqual(normalizeFilter({ presetId: "vivid", brightness: value, contrast: value, saturation: value, intensity: value }), getFilterPreset("vivid").filter);
  }
  for (const value of [[], "vivid", 1, new Date()]) assert.throws(() => normalizeFilter(value), /plain JSON/);
  const dirty = { ...getFilterPreset("vivid").filter, expression: "movie=/secret", css: "url(secret)", temperature: 99, tint: 99 };
  assert.deepEqual(normalizeFilter(dirty), getFilterPreset("vivid").filter);
  assert.ok(filterColorMatrix(dirty).every(Number.isFinite));
  assert.doesNotMatch(ffmpegFilterExpression(dirty), /secret|movie=|NaN|Infinity/);
});

test("filter/text application composes independently, including requested Yellow/JP/KR combinations", () => {
  for (const [text, filter] of [["yellow-hook", "current"], ["yellow-hook", "vivid"], ["jp-clean", "nature"], ["kr-clean", "soft"]]) {
    const original = applyFontOverride(applyTextPreset(undefined, text), "Inter");
    original.subtitle.enabled = true;
    const before = structuredClone(original);
    const result = applyFilterPreset(original, filter);
    assert.deepEqual({ ...result, filter: original.filter }, original);
    assert.deepEqual(original, before);
    const changedText = applyTextPreset(result, "news");
    assert.deepEqual(changedText.filter, result.filter);
  }
  const staged = normalizeVisualStyle({ background: { opacity: 0.8 }, foreground: { scale: 2 }, overlays: [{ id: "reserved", assetId: "asset" }] });
  const changed = applyFilterPreset(staged, "nature");
  assert.deepEqual(changed.background, staged.background); assert.deepEqual(changed.overlays, staged.overlays); assert.deepEqual(changed.foreground, staged.foreground);
  assert.throws(() => assertRenderableVisualStyle(changed), /not enabled/);
});

test("intensity interpolates from identity RGB to recipe; Current remains fixed", () => {
  const full = applyFilterPreset(undefined, "vivid");
  const zero = applyFilterIntensity(full, 0), half = applyFilterIntensity(full, 0.5);
  assert.deepEqual(effectiveFilterParameters(zero.filter), { brightness: 0, contrast: 1, saturation: 1 });
  assert.equal(ffmpegFilterExpression(zero.filter), "format=rgba");
  const target = getFilterPreset("vivid").filter;
  assert.deepEqual(effectiveFilterParameters(half.filter), { brightness: target.brightness / 2, contrast: 1 + (target.contrast - 1) / 2, saturation: 1 + (target.saturation - 1) / 2 });
  assert.deepEqual(applyFilterIntensity(undefined, 0).filter, CURRENT_FILTER);
  assert.equal(full.filter.intensity, 1);
  assert.deepEqual(half.originalTitle, full.originalTitle);
});

test("legacy environment precedence and coercion stay exact, new presets ignore machine grade", () => {
  assert.deepEqual(currentFilterEnvironment(), CURRENT_FILTER);
  assert.deepEqual(currentFilterEnvironment({ FFMPEG_CONTRAST: "1.2", FFMPEG_SATURATION: "0.9" }), { contrast: 1.2, saturation: 0.9 });
  assert.deepEqual(currentFilterEnvironment({ FFMPEG_CONTRAST: "", FFMPEG_SATURATION: "999" }), { contrast: 0.8, saturation: 1.4 });
  assert.deepEqual(currentFilterEnvironment({ FFMPEG_CONTRAST: "bad", FFMPEG_SATURATION: "Infinity" }), CURRENT_FILTER);
  const env = currentFilterEnvironment({ FFMPEG_CONTRAST: "1.2", FFMPEG_SATURATION: "0.9" });
  assert.equal(ffmpegFilterExpression(undefined, env), "eq=contrast=1.2:saturation=0.9");
  assert.equal(browserFilterStyle(undefined, env), "contrast(1.2) saturate(0.9)");
  const vivid = getFilterPreset("vivid").filter;
  assert.equal(ffmpegFilterExpression(vivid, env), ffmpegFilterExpression(vivid));
  assert.equal(browserFilterStyle(vivid, env), browserFilterStyle(vivid));
});

test("shared RGB matrix preserves neutral luminance and gives the intended color contribution", () => {
  const neutral = filterColorMatrix({ presetId: "vivid", brightness: 0, contrast: 1, saturation: 1, intensity: 0 });
  assert.deepEqual(neutral, [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
  const matrix = filterColorMatrix({ presetId: "vivid", brightness: 0, contrast: 1, saturation: 0.8 });
  const transform = (rgb) => [0, 1, 2].map((row) => rgb.reduce((sum, channel, col) => sum + channel * matrix[row * 5 + col], matrix[row * 5 + 4]));
  for (const channel of transform([0.5, 0.5, 0.5])) assert.ok(Math.abs(channel - 0.5) < 1e-7);
  const red = transform([1, 0, 0]);
  assert.ok(red[0] < 1 && red[1] > 0 && red[2] > 0);
  assert.match(ffmpegFilterExpression(getFilterPreset("bright").filter), /format=rgba,colorchannelmixer=/);
  assert.throws(() => browserFilterStyle(getFilterPreset("bright").filter, undefined, "x);url(bad)"), /Invalid/);
});

test("job filter snapshots own independent nested objects and retain selected text", () => {
  const style = applyFilterPreset(applyTextPreset(undefined, "yellow-hook"), "vivid");
  const original = { visualStyle: style, parts: [{ id: 1 }] };
  const first = snapshotPlanVisualStyle(original), second = snapshotPlanVisualStyle(original);
  original.visualStyle.filter.intensity = 0;
  first.visualStyle.filter.saturation = 0.8;
  assert.equal(second.visualStyle.filter.intensity, 1);
  assert.equal(second.visualStyle.filter.saturation, getFilterPreset("vivid").filter.saturation);
  assert.equal(second.visualStyle.textPresetId, "yellow-hook");
});
