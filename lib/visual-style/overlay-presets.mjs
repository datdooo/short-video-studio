import { normalizeVisualStyle } from "./normalize.mjs";
import { getOverlayPreset } from "./overlays.mjs";
export function applyOverlayPreset(input, id) {
  const style = normalizeVisualStyle(input);
  style.overlays = getOverlayPreset(id).overlays;
  return style;
}
export function applyOverlayOpacity(input, opacity) {
  const style = normalizeVisualStyle(input);
  return normalizeVisualStyle({ ...style, overlays: style.overlays.map((overlay) => ({ ...overlay, opacity })) });
}
