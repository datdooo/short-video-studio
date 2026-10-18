import { normalizeTitleAnimation } from "./animations.mjs";
import { normalizeCutTransition } from "./cut-transitions.mjs";
import { normalizeFontId, fontWeightFor } from "./fonts.mjs";
import { TEXT_EFFECT_IDS } from "./effects.mjs";
import { TEXT_PRESET_IDS } from "./text-presets-data.mjs";
import { DEFAULT_VISUAL_STYLE } from "./defaults.mjs";
import { subtitleStyle } from "../subtitles.mjs";
import { normalizeBackground, assertRenderableBackground } from "./backgrounds.mjs";
import { normalizeCuratedOverlay, assertRenderableOverlays } from "./overlays.mjs";
import { normalizeFilter, assertRenderableFilter } from "./filters.mjs";

function record(value, label) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`Invalid ${label}: expected a plain JSON object.`);
  return value;
}
function boundedString(value, label, limit = 64) {
  if (value !== undefined && (typeof value !== "string" || value.length > limit)) throw new Error(`Invalid ${label}: expected a bounded string.`);
  return value;
}
function choice(value, choices, fallback, label) {
  if (value === undefined) return fallback;
  boundedString(value, label);
  if (!choices.includes(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function number(value, fallback, min, max, integer = false) {
  const result = typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return integer ? Math.round(result) : result;
}
function color(value, fallback) {
  boundedString(value, "color");
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}
function text(value, base) {
  const input = record(value, "text style");
  const size = record(input.size, "text size");
  // Each role retains its current size policy; fitting is never replaced by a
  // fixed title size. New policies can be added deliberately in a later phase.
  const mode = choice(size.mode, [base.size.mode], base.size.mode, "size mode");
  let normalizedSize;
  if (mode === "auto-fit") {
    const min = number(size.min, base.size.min, 16, 100);
    normalizedSize = { mode, min, max: Math.max(min, number(size.max, base.size.max, 16, 100)), maxLines: number(size.maxLines, base.size.maxLines, 1, 4, true), maxWidth: number(size.maxWidth, base.size.maxWidth, 100, 1080), lineSpacing: number(size.lineSpacing, base.size.lineSpacing, 0, 20) };
  } else normalizedSize = { mode, value: number(size.value, base.size.value, 16, 100) };
  const weight = number(input.fontWeight, base.fontWeight, 400, 900);
  return {
    font: normalizeFontId(boundedString(input.font, "font") ?? base.font),
    fontWeight: fontWeightFor(input.font ?? base.font, Math.round(weight / 100) * 100),
    size: normalizedSize,
    color: color(input.color, base.color), outlineColor: color(input.outlineColor, base.outlineColor),
    outline: number(input.outline, base.outline, 0, 8),
    alignment: choice(input.alignment, ["left", "center", "right"], base.alignment, "alignment"),
    opacity: number(input.opacity, base.opacity, 0, 1),
    effect: choice(input.effect, TEXT_EFFECT_IDS, base.effect, "text effect"),
    layout: choice(input.layout, [base.layout], base.layout, "text layout"),
  };
}
function subtitle(value, fallback) {
  if (value == null) return { ...fallback };
  const input = record(value, "subtitle");
  for (const key of ["source", "font", "color", "outlineColor", "position", "effect"]) boundedString(input[key], `subtitle ${key}`);
  return subtitleStyle(input);
}
function identifier(value, label) {
  boundedString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value || "")) throw new Error(`Invalid ${label}: use an opaque asset identifier, not a path or URL.`);
  return value;
}
function overlays(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 16) throw new Error("Invalid overlays: maximum 16 entries.");
  const ids = new Set();
  return value.map((entry) => {
    const input = record(entry, "overlay");
    const id = identifier(input.id, "overlay id");
    if (ids.has(id)) throw new Error("Duplicate overlay id.");
    ids.add(id);
    if (input.presetId !== undefined) return normalizeCuratedOverlay({ ...input, id });
    const position = record(input.position, "overlay position");
    return {
      id, type: choice(input.type, ["image"], "image", "overlay type"), assetId: identifier(input.assetId, "asset id"),
      opacity: number(input.opacity, 1, 0, 1), blendMode: choice(input.blendMode, ["normal", "screen", "multiply"], "normal", "blend mode"),
      position: { x: number(position.x, 0.5, 0, 1), y: number(position.y, 0.5, 0, 1) }, scale: number(input.scale, 1, 0.1, 4),
    };
  });
}

// Unknown keys are dropped at every level by constructing allowlisted objects.
// No input object or preset object is ever returned by reference.
export function normalizeVisualStyle(value) {
  const input = record(value, "VisualStyle");
  if (input.version !== undefined && input.version !== 1) throw new Error("Unsupported VisualStyle version.");
  const base = DEFAULT_VISUAL_STYLE;
  const foreground = record(input.foreground, "foreground");
  const titleAnimation = normalizeTitleAnimation(input.titleAnimation);
  const cutTransition = normalizeCutTransition(input.cutTransition);
  return {
    ...(input.textPresetId !== undefined ? { textPresetId: choice(input.textPresetId, TEXT_PRESET_IDS, "current", "text preset id") } : {}),
    ...(titleAnimation !== "none" ? { titleAnimation } : {}),
    ...(cutTransition !== "none" ? { cutTransition } : {}),
    version: 1, presetId: choice(input.presetId, ["current"], "current", "preset id"),
    originalTitle: text(input.originalTitle, base.originalTitle),
    partTitle: text(input.partTitle, base.partTitle),
    partIndicator: text(input.partIndicator, base.partIndicator),
    subtitle: subtitle(input.subtitle, base.subtitle),
    foreground: { layout: choice(foreground.layout, ["native-center-crop-pad"], base.foreground.layout, "foreground layout"), scale: number(foreground.scale, base.foreground.scale, 0.5, 3), position: choice(foreground.position, ["center"], "center", "foreground position") },
    background: normalizeBackground(input.background),
    filter: normalizeFilter(input.filter),
    overlays: overlays(input.overlays),
  };
}

// Legacy/UI subtitles are authoritative while the existing subtitle controls
// still send a top-level field. Both paths use subtitleStyle, with no migration
// of stored history. A style-only plan uses its canonical subtitle section.
export function resolvePlanVisualStyle(plan = {}) {
  const input = record(plan, "style plan");
  const style = normalizeVisualStyle(input.visualStyle);
  if (input.subtitles != null) style.subtitle = subtitle(input.subtitles, style.subtitle);
  return style;
}

export function snapshotPlanVisualStyle(plan) {
  const style = resolvePlanVisualStyle(plan);
  return { ...structuredClone(plan), visualStyle: style, subtitles: { ...style.subtitle } };
}

// Staged fields are data contracts, not silently ignored render instructions.
// Text, video filters and curated backgrounds are implemented; other sections and layout policies stay
// restricted to the shipped look until their own renderer phases.
export function assertRenderableVisualStyle(style) {
  const normalized = normalizeVisualStyle(style);
  for (const key of Object.keys(normalized)) {
    if (!["subtitle", "cutTransition", "titleAnimation", "textPresetId", "originalTitle", "partTitle", "partIndicator", "filter", "background", "overlays"].includes(key) && JSON.stringify(normalized[key]) !== JSON.stringify(DEFAULT_VISUAL_STYLE[key])) {
      throw new Error("Custom VisualStyle rendering is not enabled yet; use the current look.");
    }
  }
  assertRenderableFilter(normalized.filter);
  assertRenderableBackground(normalized.background);
  assertRenderableOverlays(normalized.overlays);
  for (const role of ["originalTitle", "partTitle", "partIndicator"]) {
    for (const key of ["size", "layout", "alignment"]) {
      if (JSON.stringify(normalized[role][key]) !== JSON.stringify(DEFAULT_VISUAL_STYLE[role][key])) throw new Error("Custom text layout is not enabled yet.");
    }
  }
  return normalized;
}

export function serializeVisualStyle(style) {
  return JSON.stringify(normalizeVisualStyle(style));
}
export function deserializeVisualStyle(json) {
  if (typeof json !== "string" || json.length > 32_768) throw new Error("Invalid VisualStyle JSON size.");
  return normalizeVisualStyle(JSON.parse(json));
}
