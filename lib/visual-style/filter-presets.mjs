import { normalizeVisualStyle } from "./normalize.mjs";
import { getFilterPreset, normalizeFilter } from "./filters.mjs";

export function applyFilterPreset(input, id) {
  const style = normalizeVisualStyle(input);
  style.filter = getFilterPreset(id).filter;
  return style;
}
export function applyFilterIntensity(input, intensity) {
  const style = normalizeVisualStyle(input);
  if (style.filter.presetId) style.filter = normalizeFilter({ ...style.filter, intensity });
  return style;
}
