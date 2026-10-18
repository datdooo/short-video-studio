// All recipes operate on encoded RGB, using one affine transform in both
// renderers. Current deliberately retains the shipped YUV eq/CSS path instead.
const recipes = [
  { id: "current", label: "Current", description: "Original ShortCut Studio look", brightness: 0, contrast: 1.04, saturation: 1.06 },
  { id: "clean", label: "Clean", description: "A restrained lift for tutorials", brightness: 0.005, contrast: 1.02, saturation: 1.02 },
  { id: "vivid", label: "Vivid", description: "More color and contrast for action", brightness: 0.005, contrast: 1.08, saturation: 1.16 },
  { id: "nature", label: "Nature", description: "Richer natural colors", brightness: 0.01, contrast: 1.04, saturation: 1.12 },
  { id: "soft", label: "Soft", description: "Gentler contrast and color", brightness: 0.015, contrast: 0.94, saturation: 0.94 },
  { id: "contrast", label: "Contrast", description: "Stronger tonal separation", brightness: 0, contrast: 1.14, saturation: 1.02 },
  { id: "bright", label: "Bright", description: "Lift dim scenes gently", brightness: 0.035, contrast: 0.98, saturation: 1.03 },
  { id: "muted", label: "Muted", description: "Calmer color for explanatory clips", brightness: 0.005, contrast: 1.02, saturation: 0.86 },
];
recipes.forEach(Object.freeze); Object.freeze(recipes);
const registry = Object.freeze(Object.fromEntries(recipes.map((recipe) => [recipe.id, recipe])));
export const FILTER_PRESET_IDS = Object.freeze(recipes.map((recipe) => recipe.id));
export const CURRENT_FILTER = Object.freeze({ contrast: 1.04, saturation: 1.06 });
function preset(id) {
  if (typeof id !== "string" || !Object.hasOwn(registry, id)) throw new Error("Invalid filter preset id.");
  return registry[id];
}
export function getFilterPreset(id = "current") {
  const recipe = preset(id);
  return { id: recipe.id, label: recipe.label, description: recipe.description, filter: id === "current" ? { ...CURRENT_FILTER } : { presetId: id, brightness: recipe.brightness, contrast: recipe.contrast, saturation: recipe.saturation, intensity: 1 } };
}
export function listFilterPresets() { return FILTER_PRESET_IDS.map(getFilterPreset); }
function bounded(value, fallback, min, max) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function normalizeFilter(value) {
  const input = value ?? {};
  if (typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("Invalid filter: expected a plain JSON object.");
  const id = input.presetId === undefined ? "current" : input.presetId;
  const recipe = preset(id);
  const values = { contrast: bounded(input.contrast, recipe.contrast, 0.8, 1.3), saturation: bounded(input.saturation, recipe.saturation, 0.8, 1.4) };
  if (id === "current") {
    // Preserve the exact old JSON shape. Changed Current appearance is rejected
    // at the render boundary rather than silently ignoring staged parameters.
    if (input.presetId !== undefined && ((input.brightness !== undefined && input.brightness !== 0) || (input.intensity !== undefined && input.intensity !== 1))) throw new Error("Current filter has fixed legacy brightness and intensity.");
    return values;
  }
  return { presetId: id, brightness: bounded(input.brightness, recipe.brightness, -0.08, 0.08), ...values, intensity: bounded(input.intensity, 1, 0, 1) };
}
export function assertRenderableFilter(value) {
  const filter = normalizeFilter(value);
  if (!filter.presetId && (filter.contrast !== CURRENT_FILTER.contrast || filter.saturation !== CURRENT_FILTER.saturation)) throw new Error("Custom Current filter rendering is not enabled; select a filter preset.");
  return filter;
}
export function currentFilterEnvironment(env = {}) {
  const number = (key, fallback, min, max) => {
    const value = Number(env[key]);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  };
  return { contrast: number("FFMPEG_CONTRAST", 1.04, 0.8, 1.3), saturation: number("FFMPEG_SATURATION", 1.06, 0.8, 1.4) };
}
export function effectiveFilterParameters(value) {
  const filter = normalizeFilter(value);
  if (!filter.presetId) return { brightness: 0, ...CURRENT_FILTER };
  return { brightness: filter.brightness * filter.intensity, contrast: 1 + (filter.contrast - 1) * filter.intensity, saturation: 1 + (filter.saturation - 1) * filter.intensity };
}
const decimal = (value) => Number(value.toFixed(8));
export function filterColorMatrix(value) {
  const { brightness, contrast, saturation } = effectiveFilterParameters(value);
  const luma = [0.2126, 0.7152, 0.0722];
  const offset = (1 - contrast) / 2 + brightness;
  return [...luma.flatMap((_, row) => [...luma.map((weight, column) => decimal(contrast * ((row === column ? saturation : 0) + (1 - saturation) * weight))), 0, decimal(offset)]), 0, 0, 0, 1, 0];
}
export function browserFilterStyle(value, current = CURRENT_FILTER, id = "studio-preview-video-color") {
  const filter = normalizeFilter(value);
  if (!filter.presetId) {
    const legacy = normalizeFilter(current);
    return `contrast(${legacy.contrast}) saturate(${legacy.saturation})`;
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) throw new Error("Invalid internal filter element id.");
  return `url(#${id})`;
}
export function ffmpegFilterExpression(value, current = CURRENT_FILTER) {
  const filter = assertRenderableFilter(value);
  if (!filter.presetId) {
    const legacy = normalizeFilter(current);
    return `eq=contrast=${legacy.contrast}:saturation=${legacy.saturation}`;
  }
  const parameters = effectiveFilterParameters(filter);
  if (parameters.brightness === 0 && parameters.contrast === 1 && parameters.saturation === 1) return "format=rgba";
  const matrix = filterColorMatrix(filter), channels = ["r", "g", "b"];
  const options = channels.flatMap((row, index) => [...channels.map((column, j) => `${row}${column}=${matrix[index * 5 + j]}`), `${row}a=${matrix[index * 5 + 4]}`]);
  // RGBA ensures alpha=1 supplies the affine brightness/contrast offset. No
  // serialized expressions, paths, CSS or user-selected filter names enter it.
  return `format=rgba,colorchannelmixer=${options.join(":")}:aa=1`;
}
