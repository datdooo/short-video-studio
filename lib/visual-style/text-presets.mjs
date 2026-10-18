import { normalizeVisualStyle } from "./normalize.mjs";
import { TEXT_PRESET_IDS, textPresetDefinition } from "./text-presets-data.mjs";
import { normalizeFontId } from "./fonts.mjs";
export { TEXT_PRESET_IDS };
export function getTextPreset(id = "current") {
  const definition = textPresetDefinition(id);
  const normalized = normalizeVisualStyle({ ...definition, textPresetId: id });
  return { id, label: definition.label, description: definition.description, originalTitle: normalized.originalTitle, partTitle: normalized.partTitle, partIndicator: normalized.partIndicator, subtitle: normalized.subtitle };
}
export function listTextPresets() { return TEXT_PRESET_IDS.map(getTextPreset); }
export function applyTextPreset(input, id) {
  const style = normalizeVisualStyle(input);
  const preset = getTextPreset(id);
  return normalizeVisualStyle({ ...style, textPresetId: id, originalTitle: preset.originalTitle, partTitle: preset.partTitle, partIndicator: preset.partIndicator,
    subtitle: { ...preset.subtitle, enabled: style.subtitle.enabled, source: style.subtitle.source } });
}
export function applyFontOverride(input, font) {
  const style = normalizeVisualStyle(input);
  const id = normalizeFontId(font);
  for (const role of ["originalTitle", "partTitle", "partIndicator", "subtitle"]) style[role].font = id;
  return normalizeVisualStyle(style);
}
