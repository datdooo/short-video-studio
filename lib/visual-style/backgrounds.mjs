// Curated, immutable recipes. Current deliberately retains its legacy JSON shape.
const freeze = (value) => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CURRENT_BACKGROUND = freeze({ mode: "source-blur", baseColor: "#000000", opacity: 0.5, blur: { radius: 12, passes: 2, workingWidth: 270, workingHeight: 480 } });
const recipes = freeze([
  { id: "current", label: "Current", background: CURRENT_BACKGROUND },
  { id: "dark-blur", label: "Dark Blur", background: { ...CURRENT_BACKGROUND, presetId: "dark-blur", opacity: 0.3 } },
  { id: "light-blur", label: "Light Blur", background: { ...CURRENT_BACKGROUND, presetId: "light-blur", opacity: 0.7 } },
  { id: "black", label: "Black", background: { presetId: "black", mode: "solid", baseColor: "#000000" } },
  ...[["soft-gradient", "Soft Gradient", "#30343b", "#17191f"], ["dark-gradient", "Dark Gradient", "#161b24", "#080a10"]].map(([id, label, top, bottom]) => ({ id, label, background: { presetId: id, mode: "gradient", gradient: { type: "linear", angle: 180, stops: [{ position: 0, color: top }, { position: 1, color: bottom }] } } })),
]);
export const BACKGROUND_PRESET_IDS = Object.freeze(recipes.map(({ id }) => id));
export function getBackgroundPreset(id = "current") {
  const recipe = typeof id === "string" && recipes.find((recipe) => recipe.id === id);
  if (!recipe) throw new Error("Invalid background preset id.");
  return structuredClone(recipe);
}
export function listBackgroundPresets() { return BACKGROUND_PRESET_IDS.map(getBackgroundPreset); }
const record = (value) => {
  const input = value ?? {};
  if (typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("Invalid background object.");
  return input;
};
const number = (value, fallback, min, max, integer = false) => {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  return integer ? Math.round(n) : n;
};
const color = (value, fallback) => {
  if (value !== undefined && (typeof value !== "string" || value.length > 64)) throw new Error("Invalid background color.");
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
};
export function normalizeBackground(value) {
  const input = record(value), id = input.presetId ?? "current", base = getBackgroundPreset(id).background;
  const mode = input.mode ?? base.mode;
  if (mode !== base.mode) throw new Error("Invalid background mode for preset.");
  if (mode === "source-blur") {
    const blur = record(input.blur);
    return { ...(id !== "current" ? { presetId: id } : {}), mode, baseColor: color(input.baseColor, base.baseColor), opacity: number(input.opacity, base.opacity, 0, 1), blur: { radius: number(blur.radius, base.blur.radius, 0, 50), passes: number(blur.passes, base.blur.passes, 1, 4, true), workingWidth: number(blur.workingWidth, base.blur.workingWidth, 16, 1080, true), workingHeight: number(blur.workingHeight, base.blur.workingHeight, 16, 1920, true) } };
  }
  if (mode === "solid") return { presetId: id, mode, baseColor: color(input.baseColor, base.baseColor) };
  const gradient = record(input.gradient), defaults = base.gradient;
  if (gradient.type !== undefined && gradient.type !== "linear") throw new Error("Invalid gradient type.");
  if (gradient.angle !== undefined && gradient.angle !== 180) throw new Error("Only finite vertical preset gradients are supported.");
  const stops = gradient.stops ?? defaults.stops;
  if (!Array.isArray(stops) || stops.length !== 2) throw new Error("Preset gradients require two stops.");
  return { presetId: id, mode, gradient: { type: "linear", angle: 180, stops: stops.map((stop, index) => {
    const entry = record(stop);
    if (entry.position !== undefined && entry.position !== index) throw new Error("Preset gradient stops must be at 0 and 1.");
    return { position: index, color: color(entry.color, defaults.stops[index].color) };
  }) } };
}
export function assertRenderableBackground(value) {
  const background = normalizeBackground(value);
  if (JSON.stringify(background) !== JSON.stringify(normalizeBackground(getBackgroundPreset(background.presetId || "current").background))) throw new Error("Custom background rendering is not enabled; select a background preset.");
  return background;
}
export function backgroundCss(value) {
  const bg = assertRenderableBackground(value);
  if (bg.mode === "source-blur") return { backgroundColor: bg.baseColor };
  if (bg.mode === "solid") return { backgroundColor: bg.baseColor };
  return { backgroundImage: `linear-gradient(180deg, ${bg.gradient.stops[0].color} 0%, ${bg.gradient.stops[1].color} 100%)` };
}
// Encoded sRGB interpolation at pixel centers, matching CSS's vertical gradient.
export function gradientRowRgb(value, y, height) {
  const bg = assertRenderableBackground(value);
  if (bg.mode !== "gradient" || !Number.isInteger(height) || height < 1 || !Number.isFinite(y)) throw new Error("Invalid gradient raster dimensions.");
  const t = Math.max(0, Math.min(1, (y + 0.5) / height));
  const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const [a, b] = bg.gradient.stops.map(({ color }) => rgb(color));
  return a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
}
