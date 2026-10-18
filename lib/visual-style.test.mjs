import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_VISUAL_STYLE } from "./visual-style/defaults.mjs";
import { normalizeVisualStyle, resolvePlanVisualStyle, snapshotPlanVisualStyle, assertRenderableVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";
import { getVisualPreset, listVisualPresets } from "./visual-style/presets.mjs";
import { DEFAULT_SUBTITLE_STYLE, subtitleStyle } from "./subtitles.mjs";
import { FOREGROUND_SCALE, TITLE_LAYOUT } from "./render-config.mjs";
import { normalizePlan } from "./edit-plan.ts";
import { validatePlan } from "../worker/plan-validation.mjs";

function plan() {
  return { originalTitle: "Fixture", language: "en", providerUsed: "manual", parts: [1, 2].map((id) => ({ id, title: `Part ${id}`, hook: "Own fixture", hashtags: [], segments: [{ start: (id - 1) * 10, end: id * 10 }] })) };
}

test("missing/null style and the single preset are complete, deterministic and idempotent", () => {
  for (const value of [undefined, null, {}, { version: 1 }]) assert.deepEqual(normalizeVisualStyle(value), DEFAULT_VISUAL_STYLE);
  assert.deepEqual(getVisualPreset(), normalizeVisualStyle());
  assert.deepEqual(normalizeVisualStyle(getVisualPreset()), getVisualPreset());
  assert.deepEqual(listVisualPresets(), [{ id: "current", name: "Current" }]);
  const metadata = listVisualPresets(); metadata[0].name = "Changed";
  assert.equal(listVisualPresets()[0].name, "Current");
  assert.throws(() => getVisualPreset("__proto__"), /Unknown/);
});

test("defaults describe the existing fitting, foreground, blur and color grade without timeline/encoder settings", () => {
  const style = getVisualPreset();
  assert.equal(style.originalTitle.size.mode, "auto-fit");
  assert.equal(style.originalTitle.size.min, TITLE_LAYOUT.minFontSize);
  assert.equal(style.originalTitle.size.max, TITLE_LAYOUT.maxFontSize);
  assert.equal(style.originalTitle.size.maxWidth, TITLE_LAYOUT.maxWidth);
  assert.equal(style.originalTitle.size.maxLines, TITLE_LAYOUT.maxLines);
  assert.equal(style.partIndicator.size.value, 58);
  assert.equal(style.foreground.scale, FOREGROUND_SCALE);
  assert.deepEqual(style.background, { mode: "source-blur", baseColor: "#000000", opacity: 0.5, blur: { radius: 12, passes: 2, workingWidth: 270, workingHeight: 480 } });
  assert.deepEqual(style.filter, { contrast: 1.04, saturation: 1.06 });
  assert.deepEqual(style.overlays, []);
  for (const key of ["fps", "codec", "playbackRate", "speed", "width", "height"]) assert.equal(style[key], undefined);
});

test("only schema version 1 is accepted; invalid containers cannot become style data", () => {
  for (const version of [0, 2, 100, "1", null, Infinity]) assert.throws(() => normalizeVisualStyle({ version }), /version/);
  for (const value of [[], new Date(), new Map(), new Set(), () => {}, "current", 1]) assert.throws(() => normalizeVisualStyle(value), /plain JSON/);
  assert.throws(() => normalizeVisualStyle({ filter: [] }), /plain JSON/);
});

test("text hex colors normalize; invalid colors fall back and oversized strings reject", () => {
  const style = normalizeVisualStyle({ originalTitle: { color: "#AABBCC", outlineColor: "red" }, partTitle: { color: "url(file:///secret)" } });
  assert.equal(style.originalTitle.color, "#aabbcc");
  assert.equal(style.originalTitle.outlineColor, "#000000");
  assert.equal(style.partTitle.color, "#ffffff");
  for (const key of ["font", "color", "effect", "layout"]) assert.throws(() => normalizeVisualStyle({ originalTitle: { [key]: "x".repeat(65) } }), /bounded/);
});

test("text fields are allowlisted, bounded and keep automatic title fitting", () => {
  const style = normalizeVisualStyle({ originalTitle: { font: "Noto Sans JP", fontWeight: 755, size: { min: -1, max: 999, maxLines: 100, maxWidth: Infinity, lineSpacing: -1 }, opacity: 12, outline: 100 } });
  assert.equal(style.originalTitle.font, "Noto Sans JP");
  assert.equal(style.originalTitle.fontWeight, 800);
  assert.deepEqual(style.originalTitle.size, { mode: "auto-fit", min: 16, max: 100, maxLines: 4, maxWidth: 900, lineSpacing: 0 });
  assert.equal(style.originalTitle.opacity, 1);
  assert.equal(style.originalTitle.outline, 8);
  assert.equal(normalizeVisualStyle({ originalTitle: { font: "../font.ttf" } }).originalTitle.font, "auto");
  for (const patch of [{ alignment: "expression(x)" }, { effect: "<svg/>" }, { size: { mode: "fixed", value: 1 } }]) assert.throws(() => normalizeVisualStyle({ originalTitle: patch }), /Invalid/);
  const range = normalizeVisualStyle({ originalTitle: { size: { min: 90, max: 32 } } });
  assert.equal(range.originalTitle.size.max, 90);
});

test("one subtitle representation preserves the current UI defaults and partial legacy semantics", () => {
  assert.deepEqual(getVisualPreset().subtitle, subtitleStyle(DEFAULT_SUBTITLE_STYLE));
  assert.deepEqual(getVisualPreset().subtitle, { enabled: false, source: "youtube", font: "auto", size: 48, color: "#ffffff", outlineColor: "#111111", outline: 3, position: "bottom" });
  for (const legacy of [{}, { enabled: true }, { enabled: true, source: "whisper", font: "Noto Sans KR", size: "52", outline: "4", color: "#AABBCC", outlineColor: "#223344", position: "top" }, { font: "../font", color: "red", size: 999, outline: -1 }]) {
    assert.deepEqual(resolvePlanVisualStyle({ subtitles: legacy }).subtitle, subtitleStyle(legacy));
    assert.deepEqual(normalizeVisualStyle({ subtitle: legacy }).subtitle, subtitleStyle(legacy));
  }
  assert.equal(resolvePlanVisualStyle({ subtitles: {} }).subtitle.source, "auto");
  assert.equal(resolvePlanVisualStyle({ subtitles: {} }).subtitle.outline, 0);
  const both = { visualStyle: { subtitle: { enabled: false, size: 32 } }, subtitles: { enabled: true, size: 60 } };
  assert.equal(resolvePlanVisualStyle(both).subtitle.size, 60, "Existing controls remain authoritative during transition");
});

test("subtitle non-finite values never reach JSON; null/malformed legacy input is safe", () => {
  assert.deepEqual(subtitleStyle(null), subtitleStyle({}));
  for (const value of [NaN, Infinity, -Infinity, {}, []]) {
    const subtitle = normalizeVisualStyle({ subtitle: { size: value, outline: value } }).subtitle;
    assert.equal(subtitle.size, 48);
    assert.equal(subtitle.outline, 0);
  }
  assert.throws(() => normalizeVisualStyle({ subtitle: { font: "x".repeat(1000) } }), /bounded/);
});

test("filter, background, foreground and overlay numbers clamp with finite deterministic fallbacks", () => {
  assert.deepEqual(normalizeVisualStyle({ filter: { contrast: 100, saturation: -100 } }).filter, { contrast: 1.3, saturation: 0.8 });
  for (const value of [NaN, Infinity, -Infinity, "1.2", [], {}, null]) assert.deepEqual(normalizeVisualStyle({ filter: { contrast: value, saturation: value } }).filter, DEFAULT_VISUAL_STYLE.filter);
  const style = normalizeVisualStyle({ foreground: { scale: 999 }, background: { opacity: -100, blur: { radius: 999, passes: 99, workingWidth: -1 } } });
  assert.equal(style.foreground.scale, 3);
  assert.equal(style.background.opacity, 0);
  assert.equal(style.background.blur.radius, 50);
  assert.equal(style.background.blur.passes, 4);
  assert.equal(style.background.blur.workingWidth, 16);
});

test("overlays reserve only opaque asset IDs and allowlisted fields, types and blend modes", () => {
  const overlay = { id: "mark", type: "image", assetId: "asset_1", blendMode: "screen", opacity: 99, position: { x: -1, y: 9 }, scale: 100, expression: "movie=/secret" };
  const style = normalizeVisualStyle({ overlays: [overlay] });
  assert.deepEqual(style.overlays[0], { id: "mark", type: "image", assetId: "asset_1", blendMode: "screen", opacity: 1, position: { x: 0, y: 1 }, scale: 4 });
  for (const patch of [{ type: "movie=/etc/passwd" }, { blendMode: "screen;exec=bad" }, { assetId: "../../secret" }, { assetId: "https://example.com/a" }, { id: "x".repeat(65) }]) assert.throws(() => normalizeVisualStyle({ overlays: [{ ...overlay, ...patch }] }), /Invalid/);
  assert.throws(() => normalizeVisualStyle({ overlays: Array(17).fill(overlay) }), /maximum/);
  assert.throws(() => normalizeVisualStyle({ overlays: [overlay, overlay] }), /Duplicate/);
  assert.throws(() => assertRenderableVisualStyle(style), /not enabled/);
});

test("unknown keys are removed consistently, including prototype keys and renderer expressions", () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"ffmpeg":"exec=bad","filter":{"contrast":1.04,"expression":"movie=x"},"originalTitle":{"css":"url(x)","size":{"path":"/secret"}}}');
  assert.deepEqual(normalizeVisualStyle(input), getVisualPreset());
  assert.equal({}.polluted, undefined);
  const original = structuredClone(input);
  normalizeVisualStyle(input);
  assert.deepEqual(input, original);
});

test("old and new plans normalize/validate without changing cuts or rewriting inputs", () => {
  const old = plan(); const before = structuredClone(old);
  validatePlan(old, { duration: 20 });
  const newPlan = normalizePlan(old, "manual");
  assert.deepEqual(newPlan.visualStyle, getVisualPreset());
  assert.deepEqual(newPlan.parts, old.parts);
  validatePlan(newPlan, { duration: 20 });
  validatePlan({ ...old, visualStyle: null }, { duration: 20 });
  assert.deepEqual(old, before);
  assert.equal(old.visualStyle, undefined);
  assert.throws(() => validatePlan({ ...old, visualStyle: { version: 2 } }, { duration: 20 }), /version/);
  assert.throws(() => normalizePlan({ ...old, visualStyle: { version: 2 } }, "manual"), /version/);
});

test("render boundary rejects staged changes instead of silently ignoring them; existing subtitle controls work", () => {
  for (const patch of [{ foreground: { scale: 2 } }, { background: { opacity: 0.9 } }, { filter: { saturation: 1.2 } }]) assert.throws(() => validatePlan({ ...plan(), visualStyle: patch }, { duration: 20 }), /not enabled/);
  assert.doesNotThrow(() => validatePlan({ ...plan(), visualStyle: { subtitle: { enabled: true, font: "Noto Sans JP", position: "top", size: 60 } } }, { duration: 20 }));
});

test("serialization is deterministic, bounded and round-trips normalized JSON only", () => {
  const style = normalizeVisualStyle({ subtitle: { enabled: true, source: "whisper", size: 52 } });
  const json = serializeVisualStyle(style);
  assert.deepEqual(deserializeVisualStyle(json), style);
  assert.equal(serializeVisualStyle(deserializeVisualStyle(json)), json);
  assert.deepEqual(JSON.parse(JSON.stringify(style)), style);
  assert.throws(() => deserializeVisualStyle('{"version":2}'), /version/);
  assert.throws(() => deserializeVisualStyle(" ".repeat(32769)), /size/);
  assert.throws(() => deserializeVisualStyle("invalid JSON"));
});

test("resolved presets and job snapshots cannot share mutable style, subtitle, or timeline state", () => {
  const preset = getVisualPreset();
  const original = { ...plan(), visualStyle: preset };
  const first = snapshotPlanVisualStyle(original);
  const second = snapshotPlanVisualStyle(original);
  first.visualStyle.originalTitle.size.min = 99;
  first.visualStyle.subtitle.color = "#ff0000";
  first.visualStyle.overlays.push({ id: "x" });
  first.subtitles.color = "#00ff00";
  first.parts[0].segments[0].start = 3;
  assert.deepEqual(second.visualStyle, getVisualPreset());
  assert.deepEqual(preset, DEFAULT_VISUAL_STYLE);
  assert.equal(second.subtitles.color, "#ffffff");
  assert.equal(second.parts[0].segments[0].start, 0);
  assert.equal(original.parts[0].segments[0].start, 0);
  assert.equal(first.visualStyle.subtitle.color, "#ff0000", "Legacy alias must not share the nested style reference");
  assert.ok(Object.isFrozen(DEFAULT_VISUAL_STYLE.originalTitle.size));
  assert.ok(Object.isFrozen(DEFAULT_VISUAL_STYLE.overlays));
  assert.throws(() => { DEFAULT_VISUAL_STYLE.originalTitle.size.min = 99; }, TypeError);
});
