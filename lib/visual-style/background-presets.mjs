import { normalizeVisualStyle } from "./normalize.mjs";
import { getBackgroundPreset } from "./backgrounds.mjs";
export function applyBackgroundPreset(input, id) {
  const style = normalizeVisualStyle(input);
  style.background = getBackgroundPreset(id).background;
  return style;
}
