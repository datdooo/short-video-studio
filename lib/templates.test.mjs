import test from "node:test";
import assert from "node:assert/strict";
import { VISUAL_TEMPLATE_IDS, getVisualTemplate, listVisualTemplates, applyVisualTemplate, matchVisualTemplate } from "./visual-style/templates.mjs";
import { FONT_IDS, fontFallbackStack } from "./visual-style/fonts.mjs";
import { getTextPreset, applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { getFilterPreset } from "./visual-style/filters.mjs";
import { applyFilterPreset, applyFilterIntensity } from "./visual-style/filter-presets.mjs";
import { getBackgroundPreset } from "./visual-style/backgrounds.mjs";
import { applyBackgroundPreset } from "./visual-style/background-presets.mjs";
import { getOverlayPreset } from "./visual-style/overlays.mjs";
import { applyOverlayPreset, applyOverlayOpacity } from "./visual-style/overlay-presets.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, serializeVisualStyle, deserializeVisualStyle, snapshotPlanVisualStyle } from "./visual-style/normalize.mjs";

test("eight immutable/copy-safe template recipes reference only existing component IDs", () => {
  assert.equal(new Set(VISUAL_TEMPLATE_IDS).size, 8); assert.ok(Object.isFrozen(VISUAL_TEMPLATE_IDS));
  for (const recipe of listVisualTemplates()) {
    assert.ok(FONT_IDS.includes(recipe.fontId));
    for (const get of [() => getTextPreset(recipe.textPresetId), () => getFilterPreset(recipe.filterPresetId), () => getBackgroundPreset(recipe.backgroundPresetId), () => getOverlayPreset(recipe.overlayPresetId)]) assert.doesNotThrow(get);
    assert.deepEqual(Object.keys(recipe).sort(), ["id", "label", "description", "category", "textPresetId", "fontId", "filterPresetId", "backgroundPresetId", "overlayPresetId"].sort());
    const style = applyVisualTemplate(undefined, recipe.id);
    assert.deepEqual(style, normalizeVisualStyle(style)); assert.deepEqual(assertRenderableVisualStyle(style), style);
    assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(style)), style);
    assert.equal(matchVisualTemplate(style), recipe.id);
    assert.deepEqual(applyVisualTemplate(style, recipe.id), style);
    const independent = structuredClone(style), registryBefore = listVisualTemplates();
    style.originalTitle.color = "#123456"; style.subtitle.size = 71;
    style.overlays.length = 0;
    assert.deepEqual(applyVisualTemplate(undefined, recipe.id), independent);
    assert.deepEqual(listVisualTemplates(), registryBefore);
    recipe.fontId = "bad"; assert.notEqual(getVisualTemplate(recipe.id).fontId, "bad");
  }
});
test("untrusted template IDs cannot resolve URLs, paths, JSON, code or unknown recipes", () => {
  for (const id of [null, {}, [], 1, "__proto__", "constructor", "../current", "/tmp/current", "https://bad", "file:///bad", "{\"font\":\"bad\"}", "movie=/secret", "x".repeat(100)]) {
    assert.throws(() => getVisualTemplate(id), /Invalid/); assert.throws(() => applyVisualTemplate(undefined, id), /Invalid/);
  }
});
test("Current restores exact legacy appearance and old plans match without template/text metadata", () => {
  const style = applyVisualTemplate(applyVisualTemplate(undefined, "news"), "current");
  const { textPresetId, ...appearance } = style;
  assert.equal(textPresetId, "current"); assert.deepEqual(appearance, normalizeVisualStyle());
  assert.equal(matchVisualTemplate(), "current");
  const old = applyVisualTemplate(undefined, "farming-jp"); delete old.textPresetId;
  assert.equal(matchVisualTemplate(old), "farming-jp");
});
test("templates preserve operational subtitle state, replace visual overrides, and never inherit intensity", () => {
  for (const enabled of [true, false]) for (const id of VISUAL_TEMPLATE_IDS) {
    const input = applyFilterIntensity(applyVisualTemplate(undefined, "viral-shorts"), 0.37);
    Object.assign(input.subtitle, { enabled, source: "whisper", color: "#123456", size: 66, position: "top" });
    const before = structuredClone(input), style = applyVisualTemplate(input, id);
    assert.deepEqual(input, before); assert.equal(style.subtitle.enabled, enabled); assert.equal(style.subtitle.source, "whisper");
    assert.equal(matchVisualTemplate(style), id);
    assert.equal(style.filter.intensity, id === "current" ? undefined : 1);
    assert.notEqual(style.subtitle.color, "#123456");
    style.subtitle.enabled = !enabled; style.subtitle.source = "youtube"; assert.equal(matchVisualTemplate(style), id);
    style.subtitle.color = "#abcdef"; assert.equal(matchVisualTemplate(style), null);
    assert.equal(style.subtitle.source, "youtube");
  }
});
test("manual appearance changes become Custom and exact restoration rematches", () => {
  const jp = applyVisualTemplate(undefined, "farming-jp");
  for (const edited of [applyFilterPreset(jp, "vivid"), applyFontOverride(jp, "auto"), applyBackgroundPreset(jp, "black"), applyOverlayPreset(jp, "grain"), applyTextPreset(jp, "clean"), applyOverlayOpacity(jp, 0.1)]) assert.equal(matchVisualTemplate(edited), null);
  assert.equal(matchVisualTemplate(applyFilterPreset(applyFilterPreset(jp, "vivid"), "nature")), "farming-jp");
  assert.equal(matchVisualTemplate(applyFontOverride(applyFontOverride(jp, "auto"), "Noto Sans JP")), "farming-jp");
  const news = applyVisualTemplate(undefined, "news"); assert.equal(matchVisualTemplate(applyFilterIntensity(news, 0.7)), null);
  assert.equal(matchVisualTemplate(applyFilterIntensity(applyFilterIntensity(news, 0.7), 1)), "news");
  const custom = applyBackgroundPreset(applyVisualTemplate(undefined, "viral-shorts"), "black");
  assert.equal(matchVisualTemplate(custom), null); assert.equal(custom.background.presetId, "black");
  assert.deepEqual(applyVisualTemplate(custom, "viral-shorts"), applyVisualTemplate(undefined, "viral-shorts"));
});
test("template-derived plans preserve content/timing/captions and jobs own complete independent styles", () => {
  const style = applyVisualTemplate(undefined, "viral-shorts"); style.subtitle.enabled = true; style.subtitle.source = "whisper";
  const plan = { originalTitle: "Original content", providerUsed: "manual", sourceId: "synthetic", parts: [{ id: 1, title: "Unchanged", hashtags: ["#keep"], smartCutApplied: true, segments: [{ start: 3.25, end: 9.5 }] }], captionCues: { timeline: "source", cues: [{ start: 4, end: 5, text: "Keep captions" }] }, visualStyle: style, subtitles: { ...style.subtitle } };
  const before = structuredClone(plan), a = snapshotPlanVisualStyle(plan);
  const nextStyle = applyVisualTemplate(style, "farming-jp");
  const next = { ...plan, visualStyle: nextStyle, subtitles: { ...nextStyle.subtitle } }, b = snapshotPlanVisualStyle(next);
  assert.deepEqual({ ...next, visualStyle: before.visualStyle, subtitles: before.subtitles }, before);
  assert.equal(next.parts, plan.parts); assert.equal(next.captionCues, plan.captionCues);
  next.visualStyle.filter.intensity = 0; next.captionCues.cues[0].text = "Later caller mutation";
  assert.equal(matchVisualTemplate(a.visualStyle), "viral-shorts"); assert.equal(matchVisualTemplate(b.visualStyle), "farming-jp");
  assert.equal(a.captionCues.cues[0].text, "Keep captions"); assert.equal(b.captionCues.cues[0].text, "Keep captions");
});
test("every recipe retains the existing JP/KR fallback stacks for multilingual content", () => {
  for (const id of VISUAL_TEMPLATE_IDS) for (const text of ["English", "Süßere Tomaten", "Français éàç", "トマトを育てる", "토마토를 키우기", "Tomatoes 日本語 한국어"]) {
    const style = applyVisualTemplate(undefined, id), stack = fontFallbackStack(style.originalTitle.font, text);
    if (/[ぁ-龯]/.test(text)) assert.ok(stack.includes("Noto Sans JP"));
    if (/[가-힣]/.test(text)) assert.ok(stack.includes("Noto Sans KR"));
  }
});
