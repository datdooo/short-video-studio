import test from "node:test";
import assert from "node:assert/strict";
import { getTextPreset, listTextPresets, applyTextPreset, applyFontOverride, TEXT_PRESET_IDS } from "./visual-style/text-presets.mjs";
import { normalizeVisualStyle, serializeVisualStyle, deserializeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle } from "./visual-style/normalize.mjs";
import { DEFAULT_VISUAL_STYLE } from "./visual-style/defaults.mjs";
import { textPreviewCss, styledTextSvg, subtitlePreviewCss } from "./visual-style/text-render.mjs";
import { textEffectLayers, textShadowCss } from "./visual-style/effects.mjs";
import { subtitleStyle } from "./subtitles.mjs";

test("eight stable text presets normalize, render, and are independent of registry/defaults", () => {
  assert.equal(TEXT_PRESET_IDS.length, 8);
  assert.equal(new Set(TEXT_PRESET_IDS).size, 8);
  for (const preset of listTextPresets()) {
    const style = applyTextPreset(undefined, preset.id);
    assert.deepEqual(normalizeVisualStyle(style), style);
    assert.doesNotThrow(() => assertRenderableVisualStyle(style));
    preset.originalTitle.color = "#ff0000";
    assert.notEqual(getTextPreset(preset.id).originalTitle.color, "#ff0000");
  }
  const current = getTextPreset("current");
  for (const role of ["originalTitle", "partTitle", "partIndicator", "subtitle"]) assert.deepEqual(current[role], DEFAULT_VISUAL_STYLE[role]);
  assert.throws(() => getTextPreset("__proto__"), /Unknown/);
});

test("applying a text preset preserves non-text sections, subtitle enable/source and schema version", () => {
  const original = normalizeVisualStyle({ filter: { contrast: 1.2 }, foreground: { scale: 2 }, background: { opacity: 0.9 }, overlays: [{ id: "later", assetId: "asset_1" }], subtitle: { enabled: true, source: "whisper", font: "Noto Sans KR", color: "#ff0000", outline: 8 } });
  const before = structuredClone(original);
  const style = applyTextPreset(original, "shorts-bold");
  for (const role of ["foreground", "background", "filter", "overlays"]) assert.deepEqual(style[role], original[role]);
  assert.equal(style.version, 1);
  assert.equal(style.presetId, "current");
  assert.equal(style.textPresetId, "shorts-bold");
  assert.equal(style.subtitle.enabled, true);
  assert.equal(style.subtitle.source, "whisper");
  assert.equal(style.subtitle.color, "#ffffff");
  assert.equal(style.subtitle.outline, 4);
  assert.deepEqual(original, before);
  style.overlays[0].opacity = 0;
  assert.equal(original.overlays[0].opacity, 1);
});

test("preset plus font override preserves colors/effects/outlines and independent job snapshots", () => {
  const yellow = applyTextPreset(undefined, "yellow-hook");
  const changed = applyFontOverride(yellow, "Noto Sans JP");
  for (const role of ["originalTitle", "partTitle", "partIndicator", "subtitle"]) {
    assert.equal(changed[role].font, "Noto Sans JP");
    for (const field of ["color", "outline", "outlineColor", "effect", "opacity"]) assert.equal(changed[role][field], yellow[role][field]);
  }
  assert.equal(changed.textPresetId, "yellow-hook");
  assert.equal(yellow.originalTitle.font, "Oswald");
  const first = snapshotPlanVisualStyle({ visualStyle: changed });
  const second = snapshotPlanVisualStyle({ visualStyle: changed });
  first.visualStyle.originalTitle.color = "#123456";
  first.subtitles.color = "#234567";
  assert.equal(second.visualStyle.originalTitle.color, "#ffe24a");
  assert.equal(second.subtitles.color, "#ffe24a");
  assert.equal(getTextPreset("yellow-hook").originalTitle.font, "Oswald");
});

test("legacy plans/subtitles and extended text styles round-trip through the existing schema", () => {
  assert.deepEqual(normalizeVisualStyle(), DEFAULT_VISUAL_STYLE);
  const legacy = { enabled: true, font: "Noto Sans JP", size: 52, color: "#ffffff", outline: 3, position: "top" };
  assert.deepEqual(normalizeVisualStyle({ subtitle: legacy }).subtitle, subtitleStyle(legacy));
  const style = applyTextPreset(undefined, "jp-clean");
  style.subtitle = subtitleStyle({ ...style.subtitle, size: 60, color: "#abcdef" });
  const snapshot = snapshotPlanVisualStyle({ visualStyle: style, subtitles: style.subtitle });
  assert.deepEqual(snapshot.visualStyle.subtitle, style.subtitle);
  assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(snapshot.visualStyle)), snapshot.visualStyle);
  assert.throws(() => normalizeVisualStyle({ textPresetId: "url(evil)" }), /Invalid/);
  assert.throws(() => normalizeVisualStyle({ originalTitle: { effect: "movie=evil" } }), /Invalid/);
});

test("preview and SVG use the same fill, outline, weight, opacity and effect layers", () => {
  for (const id of TEXT_PRESET_IDS) {
    const style = applyFontOverride(applyTextPreset(undefined, id), "Inter").originalTitle;
    style.opacity = 0.65;
    const css = textPreviewCss(style, "Safe text", 0.5);
    const svg = styledTextSvg(["Safe <text>"], { fontFamily: "Inter, Noto Sans JP, Noto Sans KR", fontSize: 70, firstBaseline: 200, lineHeight: 74, style });
    assert.equal(css.color, style.color);
    assert.equal(css.fontWeight, style.fontWeight);
    assert.equal(css.opacity, style.opacity);
    assert.equal(css.WebkitTextStroke, `${style.outline}px ${style.outlineColor}`);
    assert.equal(css.textShadow, textShadowCss(style.effect));
    assert.ok(svg.includes(`fill="${style.color}"`));
    assert.ok(svg.includes(`font-weight="${style.fontWeight}"`));
    assert.ok(svg.includes('opacity="0.65"'));
    assert.ok(svg.includes('Safe &lt;text&gt;'));
    for (const layer of textEffectLayers(style.effect)) assert.ok(svg.includes(`stdDeviation="${layer.blur / 2 * 70}"`));
  }
  const subtitle = getTextPreset("clean").subtitle;
  assert.equal(subtitlePreviewCss(subtitle, "Caption").textShadow, textShadowCss(subtitle.effect));
  assert.equal(subtitlePreviewCss({ ...subtitle, opacity: 0 }, "Caption").opacity, 0);
});

test("only supported text properties render; non-text changes and new layout rules stay blocked", () => {
  for (const input of [{ filter: { contrast: 1.2 } }, { foreground: { scale: 2 } }, { overlays: [{ id: "later", assetId: "asset" }] }, { originalTitle: { alignment: "left" } }, { originalTitle: { size: { max: 80 } } }]) assert.throws(() => assertRenderableVisualStyle(input), /not enabled/);
});
