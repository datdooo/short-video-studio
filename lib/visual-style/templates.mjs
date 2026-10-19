import { normalizeVisualStyle } from "./normalize.mjs";
import { applyTextPreset, applyFontOverride } from "./text-presets.mjs";
import { applyFilterPreset } from "./filter-presets.mjs";
import { applyBackgroundPreset } from "./background-presets.mjs";
import { applyOverlayPreset } from "./overlay-presets.mjs";

const definitions = [
  ["current", "Current", "Original ShortCut Studio appearance", "classic", "current", "auto", "current", "current", "none"],
  ["viral-shorts", "Viral Shorts", "Bold social text with richer video and static grain", "social", "shorts-bold", "Roboto Condensed", "vivid", "dark-blur", "grain"],
  ["clean-tutorial", "Clean Tutorial", "Clear typography and a lighter source background", "tutorial", "clean", "Inter", "clean", "light-blur", "none"],
  ["farming-jp", "Farming JP", "Japanese tutorial typography with natural color", "regional", "jp-clean", "Noto Sans JP", "nature", "dark-blur", "vignette"],
  ["korean-tutorial", "Korean Tutorial", "Korean typography with restrained video color", "regional", "kr-clean", "Noto Sans KR", "clean", "dark-blur", "none"],
  ["news", "News", "Bold information layout and a generic recording HUD", "information", "news", "Montserrat", "contrast", "dark-gradient", "rec-hud"],
  ["cinematic-dark", "Cinematic Dark", "Minimal type and muted footage in a dark frame", "cinematic", "minimal", "Inter", "muted", "dark-gradient", "film-frame"],
  ["bright-social", "Bright Social", "Yellow hook, lifted video and a restrained glow", "social", "yellow-hook", "Oswald", "bright", "current", "soft-glow"],
].map(([id, label, description, category, textPresetId, fontId, filterPresetId, backgroundPresetId, overlayPresetId]) => Object.freeze({ id, label, description, category, textPresetId, fontId, filterPresetId, backgroundPresetId, overlayPresetId }));
const registry = Object.freeze(Object.fromEntries(definitions.map((recipe) => [recipe.id, recipe])));
export const VISUAL_TEMPLATE_IDS = Object.freeze(definitions.map(({ id }) => id));
export function getVisualTemplate(id = "current") {
  if (typeof id !== "string" || !Object.hasOwn(registry, id)) throw new Error("Invalid visual template id.");
  return { ...registry[id] };
}
export function listVisualTemplates() { return VISUAL_TEMPLATE_IDS.map(getVisualTemplate); }
export function applyVisualTemplate(input, id) {
  const current = normalizeVisualStyle(input), recipe = getVisualTemplate(id);
  // A complete recipe starts from the shipped canvas configuration. Content,
  // timeline and render settings live outside VisualStyle and never enter here.
  let style = normalizeVisualStyle({ titleAnimation: current.titleAnimation, cutTransition: current.cutTransition });
  style.subtitle = { ...style.subtitle, enabled: current.subtitle.enabled, source: current.subtitle.source };
  style = applyTextPreset(style, recipe.textPresetId);
  style = applyFontOverride(style, recipe.fontId);
  style = applyFilterPreset(style, recipe.filterPresetId);
  style = applyBackgroundPreset(style, recipe.backgroundPresetId);
  style = applyOverlayPreset(style, recipe.overlayPresetId);
  return normalizeVisualStyle(style);
}
function visualSignature(input) {
  const style = normalizeVisualStyle(input);
  // Text selection metadata is not visual truth; old plans need no metadata.
  delete style.textPresetId;
  // Motion is an independent control; matching still compares all typography.
  delete style.titleAnimation;
  delete style.cutTransition;
  delete style.subtitle.enabled;
  delete style.subtitle.source;
  return JSON.stringify(style);
}
const signatures = Object.freeze(Object.fromEntries(VISUAL_TEMPLATE_IDS.map((id) => [id, visualSignature(applyVisualTemplate(undefined, id))])));
export function matchVisualTemplate(input) {
  const signature = visualSignature(input);
  return VISUAL_TEMPLATE_IDS.find((id) => signatures[id] === signature) ?? null;
}
