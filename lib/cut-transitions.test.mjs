import test from "node:test";
import assert from "node:assert/strict";
import { CUT_TRANSITION_IDS, normalizeCutTransition, getCutTransition, listCutTransitions, resolveCutTransitions, cutTransitionPose } from "./visual-style/cut-transitions.mjs";
import { normalizeVisualStyle, assertRenderableVisualStyle, snapshotPlanVisualStyle, serializeVisualStyle, deserializeVisualStyle } from "./visual-style/normalize.mjs";
import { applyVisualTemplate, matchVisualTemplate, VISUAL_TEMPLATE_IDS } from "./visual-style/templates.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { applyFilterPreset } from "./visual-style/filter-presets.mjs";
import { applyBackgroundPreset } from "./visual-style/background-presets.mjs";
import { applyOverlayPreset } from "./visual-style/overlay-presets.mjs";
import { validatePlan } from "../worker/plan-validation.mjs";
const segments = [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }];

test("three immutable transition IDs and independent bounded registry data", () => {
  assert.deepEqual(CUT_TRANSITION_IDS, ["none", "dip-black", "flash-white"]);
  assert.ok(Object.isFrozen(CUT_TRANSITION_IDS));
  const choices = listCutTransitions(); choices[1].color = "red"; choices.pop();
  assert.equal(listCutTransitions().length, 3); assert.equal(getCutTransition("dip-black").color, "#000000");
  assert.equal(getCutTransition("flash-white").durationMs, 400);
});
test("legacy/explicit None is exact; unsafe IDs reject and arbitrary parameters never persist", () => {
  assert.equal(normalizeCutTransition(), "none");
  assert.deepEqual(normalizeVisualStyle({ cutTransition: "none" }), normalizeVisualStyle());
  for (const id of [null, [], {}, 1, true, "", "None", "crossfade", "__proto__", "constructor", "https://bad", "/tmp/a", "fade=t=out", "opacity:0", { id: "dip-black", durationMs: 900 }]) {
    assert.throws(() => normalizeVisualStyle({ cutTransition: id }), /transition/);
    assert.throws(() => getCutTransition(id), /transition/);
  }
  for (const id of CUT_TRANSITION_IDS) {
    const style = normalizeVisualStyle({ cutTransition: id, cutTransitionColor: "#123456", cutTransitionDuration: 99, transitionExpression: "movie=/secret" });
    assert.ok(!Object.hasOwn(style, "cutTransitionColor")); assert.ok(!Object.hasOwn(style, "cutTransitionDuration"));
    assert.deepEqual(deserializeVisualStyle(serializeVisualStyle(style)), assertRenderableVisualStyle(style));
  }
});
test("shared output-frame windows only surround internal cuts, without overlap or endpoint effects", () => {
  const before = structuredClone(segments), windows = resolveCutTransitions("dip-black", segments);
  assert.deepEqual(windows, [{ boundary: 1, startFrame: 18, cutFrame: 24, endFrame: 30, halfFrames: 6 }, { boundary: 2, startFrame: 42, cutFrame: 48, endFrame: 54, halfFrames: 6 }]);
  for (const id of ["dip-black", "flash-white"]) {
    for (const t of [0, 0.5, 1.1, 2.399999]) assert.equal(cutTransitionPose(id, windows, t).opacity, 0);
    assert.equal(cutTransitionPose(id, windows, 0.8).opacity, 1);
    assert.ok(Math.abs(cutTransitionPose(id, windows, 0.7).opacity - 0.5) < 1e-10);
    assert.ok(Math.abs(cutTransitionPose(id, windows, 0.9).opacity - 0.5) < 1e-10);
  }
  assert.deepEqual(segments, before);
  windows[0].cutFrame = 0; assert.equal(resolveCutTransitions("dip-black", segments)[0].cutFrame, 24);
  assert.deepEqual(resolveCutTransitions("none", segments), []); assert.deepEqual(resolveCutTransitions("dip-black", [segments[0]]), []);
});
test("short neighbors clamp on the frame grid; sub-two-frame ranges safely skip; malformed timelines reject", () => {
  const short = [{ start: 0, end: 1 }, { start: 2, end: 2.25 }, { start: 3, end: 4 }];
  const windows = resolveCutTransitions("dip-black", short);
  assert.deepEqual(windows.map((w) => w.halfFrames), [3, 3]);
  assert.equal(windows[0].endFrame, windows[1].startFrame);
  assert.deepEqual(resolveCutTransitions("flash-white", [{ start: 0, end: 0.04 }, { start: 1, end: 2 }]), []);
  for (const bad of [null, [{ start: 1, end: 0 }], [{ start: NaN, end: 1 }], [{ start: 0, end: Infinity }], [{ start: 0, end: 1e30 }]]) assert.throws(() => resolveCutTransitions("dip-black", bad), /Invalid/);
});
test("many fractional ranges use absolute cumulative cuts, and each part owns a fresh zero-based window set", () => {
  const ranges = Array.from({ length: 100 }, (_, i) => ({ start: i, end: i + 0.117 }));
  const windows = resolveCutTransitions("dip-black", ranges);
  let elapsed = 0;
  for (let i = 0; i < ranges.length - 1; i++) { elapsed += ranges[i].end - ranges[i].start; assert.equal(windows[i].cutFrame, Math.round(elapsed / 1.25 * 30)); }
  for (let i = 1; i < windows.length; i++) assert.ok(windows[i].startFrame >= windows[i - 1].endFrame);
  assert.deepEqual(resolveCutTransitions("flash-white", segments), resolveCutTransitions("dip-black", segments));
});
test("transition changes only its field and stays independent of animation, templates and lower controls", () => {
  for (const animation of ["none", "fade-in", "slide-up", "pop-in"]) for (const template of VISUAL_TEMPLATE_IDS) {
    const input = normalizeVisualStyle({ ...applyVisualTemplate(undefined, template), titleAnimation: animation });
    const before = structuredClone(input);
    for (const id of CUT_TRANSITION_IDS) {
      const style = normalizeVisualStyle({ ...input, cutTransition: id }), { cutTransition, ...rest } = style;
      assert.equal(cutTransition || "none", id); assert.deepEqual(rest, before); assert.deepEqual(input, before);
      assert.equal(matchVisualTemplate(style), template);
      assert.equal(applyVisualTemplate(style, "news").cutTransition || "none", id);
      assert.equal(applyVisualTemplate(style, "news").titleAnimation || "none", animation);
      for (const edited of [applyTextPreset(style, "clean"), applyFontOverride(style, "Inter"), applyFilterPreset(style, "nature"), applyBackgroundPreset(style, "black"), applyOverlayPreset(style, "grain")]) assert.equal(edited.cutTransition || "none", id);
    }
  }
});
test("queued snapshots preserve independent transition, content, captions and animation; legacy plans validate", () => {
  const plan = { originalTitle: "Title", providerUsed: "manual", parts: [1, 2].map((id) => ({ id, title: "Keep", hashtags: ["#keep"], segments: [{ start: id, end: id + 0.5 }] })), visualStyle: { cutTransition: "dip-black", titleAnimation: "slide-up", subtitle: { enabled: true, source: "whisper" } }, captionCues: { cues: [{ start: 1, end: 1.5, text: "Keep" }] } };
  const a = snapshotPlanVisualStyle(plan); plan.visualStyle.cutTransition = "flash-white"; const b = snapshotPlanVisualStyle(plan); plan.visualStyle.cutTransition = "none";
  assert.equal(a.visualStyle.cutTransition, "dip-black"); assert.equal(b.visualStyle.cutTransition, "flash-white");
  assert.equal(a.visualStyle.titleAnimation, "slide-up"); assert.equal(a.visualStyle.subtitle.source, "whisper");
  assert.deepEqual(a.parts, b.parts); assert.deepEqual(a.captionCues, b.captionCues);
  assert.doesNotThrow(() => validatePlan({ ...plan, visualStyle: undefined }, { duration: 5 }));
  assert.throws(() => validatePlan({ ...plan, visualStyle: { cutTransition: {} } }, { duration: 5 }), /transition/);
});
