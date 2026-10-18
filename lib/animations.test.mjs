import test from "node:test";
import assert from "node:assert/strict";
import { TITLE_ANIMATION_IDS, getTitleAnimation, listTitleAnimations, normalizeTitleAnimation, titleAnimationAt, titleAnimationPreviewCss } from "./visual-style/animations.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";
import { applyVisualTemplate, matchVisualTemplate, VISUAL_TEMPLATE_IDS } from "./visual-style/templates.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { validatePlan } from "../worker/plan-validation.mjs";

test("four bounded title animations have immutable IDs and copy-safe registry getters", () => {
  assert.deepEqual(TITLE_ANIMATION_IDS, ["none", "fade-in", "slide-up", "pop-in"]);
  assert.ok(Object.isFrozen(TITLE_ANIMATION_IDS));
  const presets = listTitleAnimations(); presets[0].label = "mutated"; presets.pop();
  assert.equal(listTitleAnimations().length, 4); assert.equal(getTitleAnimation().label, "None");
});
test("absent and explicit none preserve the exact legacy v1 model; arbitrary inputs reject", () => {
  assert.equal(normalizeTitleAnimation(), "none");
  assert.deepEqual(normalizeVisualStyle({ titleAnimation: "none" }), normalizeVisualStyle());
  assert.ok(!Object.hasOwn(normalizeVisualStyle(), "titleAnimation"));
  for (const id of [null, {}, [], 1, "", "None", "__proto__", "constructor", "fade", "https://bad", "movie=/tmp/a", "fade-in;movie=bad", "x".repeat(100)]) {
    assert.throws(() => normalizeTitleAnimation(id), /Invalid/);
    assert.throws(() => normalizeVisualStyle({ titleAnimation: id }), /Invalid/);
    assert.throws(() => assertRenderableVisualStyle({ titleAnimation: id }), /Invalid/);
  }
  for (const id of TITLE_ANIMATION_IDS) assert.deepEqual(deserializeVisualStyle(serializeVisualStyle({ titleAnimation: id })), assertRenderableVisualStyle({ titleAnimation: id }));
});
test("fixed output-time poses clamp, settle, and reenter at every part start", () => {
  for (const id of TITLE_ANIMATION_IDS) {
    const start = titleAnimationAt(id, 0), middle = titleAnimationAt(id, 0.2), end = titleAnimationAt(id, 0.6);
    assert.deepEqual(end, { opacity: 1, y: 0, scale: 1 });
    assert.deepEqual(titleAnimationAt(id, -1), start); assert.deepEqual(titleAnimationAt(id, NaN), start);
    assert.deepEqual(titleAnimationAt(id, 20), end);
    assert.equal(start.opacity, id === "none" ? 1 : 0);
    if (id !== "none") assert.equal(middle.opacity, 0.4);
    if (id === "slide-up") { assert.equal(start.y, 20); assert.equal(middle.y, 12); }
    if (id === "pop-in") { assert.equal(start.scale, 0.975); assert.ok(middle.scale > start.scale && middle.scale < 1); }
    // Reentering another part uses the same zero-based clock, not source time.
    assert.deepEqual(titleAnimationAt(id, 0), start);
  }
  assert.deepEqual(titleAnimationPreviewCss("none", 0), {});
  assert.match(titleAnimationPreviewCss("slide-up", 0.2, 0.5).transform, /translateY\(6px\)/);
});
test("templates and lower text controls retain independent motion without masking typography changes", () => {
  for (const titleAnimation of TITLE_ANIMATION_IDS) for (const id of VISUAL_TEMPLATE_IDS) {
    const before = normalizeVisualStyle({ titleAnimation }), style = applyVisualTemplate(before, id);
    assert.equal(normalizeTitleAnimation(style.titleAnimation), titleAnimation);
    assert.equal(matchVisualTemplate(style), id);
    assert.equal(normalizeTitleAnimation(applyTextPreset(style, "clean").titleAnimation), titleAnimation);
    assert.equal(normalizeTitleAnimation(applyFontOverride(style, "Inter").titleAnimation), titleAnimation);
    style.originalTitle.color = "#123456"; assert.equal(matchVisualTemplate(style), null);
  }
});
test("animation selection preserves every other effective visual field and its input", () => {
  const input = applyVisualTemplate(undefined, "farming-jp");
  input.subtitle.enabled = true; input.subtitle.source = "whisper";
  input.subtitle.color = "#abcdef"; input.filter.intensity = 0.37;
  const before = structuredClone(input);
  for (const id of TITLE_ANIMATION_IDS) {
    const { titleAnimation, ...appearance } = normalizeVisualStyle({ ...input, titleAnimation: id });
    assert.equal(titleAnimation || "none", id);
    assert.deepEqual(appearance, before);
    assert.deepEqual(input, before);
  }
});
test("job snapshots freeze animation, subtitles and cuts independently; old plans validate", () => {
  const plan = { originalTitle: "Title", providerUsed: "manual", parts: [1, 2].map((id) => ({ id, title: "Part", hashtags: [], segments: [{ start: (id - 1) * 2, end: id * 2 }] })), visualStyle: { titleAnimation: "slide-up" } };
  assert.doesNotThrow(() => validatePlan(plan, { duration: 6 }));
  const first = snapshotPlanVisualStyle(plan); plan.visualStyle.titleAnimation = "pop-in";
  const second = snapshotPlanVisualStyle(plan); plan.parts[0].segments[0].start = 99;
  assert.equal(first.visualStyle.titleAnimation, "slide-up"); assert.equal(second.visualStyle.titleAnimation, "pop-in");
  assert.equal(first.parts[0].segments[0].start, 0); assert.equal(second.parts[0].segments[0].start, 0);
  assert.doesNotThrow(() => validatePlan({ ...first, visualStyle: undefined }, { duration: 6 }));
  assert.throws(() => validatePlan({ ...first, visualStyle: { titleAnimation: "eval(t)" } }, { duration: 6 }), /animation/);
});
