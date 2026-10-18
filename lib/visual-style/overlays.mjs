// Asset filenames are trusted constants, never derived from serialized paths.
const freeze = (value) => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const definitions = [
  ["grain", "Grain", 0.22], ["vignette", "Vignette", 0.55],
  ["soft-glow", "Soft Glow", 0.35], ["film-frame", "Film Frame", 0.65], ["rec-hud", "REC HUD", 0.9],
];
export const OVERLAY_ASSETS = freeze(Object.fromEntries(definitions.map(([id]) => [`overlay.${id}.v1`, { id: `overlay.${id}.v1`, file: `${id}-v1.png`, width: 1080, height: 1920 }])));
export const OVERLAY_PRESET_IDS = Object.freeze(["none", ...definitions.map(([id]) => id)]);
export function getOverlayAsset(id) {
  if (typeof id !== "string" || !Object.hasOwn(OVERLAY_ASSETS, id)) throw new Error("Invalid or unregistered overlay asset id.");
  return { ...OVERLAY_ASSETS[id] };
}
export function getOverlayPreset(id = "none") {
  if (id === "none") return { id, label: "None", overlays: [] };
  const recipe = typeof id === "string" && definitions.find(([key]) => key === id);
  if (!recipe) throw new Error("Invalid overlay preset id.");
  return { id, label: recipe[1], overlays: [{ id, presetId: id, kind: "image", assetId: `overlay.${id}.v1`, opacity: recipe[2], blendMode: "normal", layer: "scene", scaleMode: "canvas", enabled: true }] };
}
export function listOverlayPresets() { return OVERLAY_PRESET_IDS.map(getOverlayPreset); }
export function normalizeCuratedOverlay(input) {
  const base = getOverlayPreset(input.presetId).overlays[0];
  if (!base) throw new Error("None must use an empty overlays array.");
  // Normal is deliberately the only implemented blend mode. Layout is fixed.
  for (const key of ["kind", "assetId", "blendMode", "layer", "scaleMode"]) {
    if (input[key] !== undefined && input[key] !== base[key]) throw new Error(`Invalid overlay ${key}.`);
  }
  if (input.enabled !== undefined && typeof input.enabled !== "boolean") throw new Error("Invalid overlay enabled flag.");
  return { ...base, id: input.id, opacity: typeof input.opacity === "number" && Number.isFinite(input.opacity) ? Math.max(0, Math.min(1, input.opacity)) : base.opacity, enabled: input.enabled ?? true };
}
export function assertRenderableOverlays(overlays) {
  for (const overlay of overlays) {
    if (!overlay.presetId) throw new Error("Custom overlay rendering is not enabled; select a curated overlay.");
    normalizeCuratedOverlay(overlay);
    getOverlayAsset(overlay.assetId);
  }
  return overlays;
}
export function activeSceneOverlays(overlays) {
  return assertRenderableOverlays(overlays).filter((overlay) => overlay.enabled && overlay.opacity > 0);
}
export function overlayAssetUrl(assetId) { return `/overlays/${getOverlayAsset(assetId).file}`; }
