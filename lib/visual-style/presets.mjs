import { DEFAULT_VISUAL_STYLE } from "./defaults.mjs";
import { normalizeVisualStyle } from "./normalize.mjs";

const registry = Object.freeze({ current: DEFAULT_VISUAL_STYLE });
export function getVisualPreset(id = "current") {
  if (!Object.hasOwn(registry, id)) throw new Error("Unknown visual preset.");
  return normalizeVisualStyle(registry[id]);
}
export function listVisualPresets() {
  return [{ id: "current", name: "Current" }];
}
