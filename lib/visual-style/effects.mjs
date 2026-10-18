// Layers are ordered back-to-front. CSS consumes them in reverse order; SVG
// converts blur radius to Gaussian sigma. Only current-look legacy offsets have
// explicit compatibility values, preserving existing pixels rather than fixing
// the historical browser/export approximation during a preset change.
const effects = {
  none: [],
  "soft-shadow": [{ id: "soft", color: "#000000", opacity: 0.75, x: 0, y: 0.05, blur: 0.08 }],
  "heavy-shadow": [{ id: "heavy", color: "#000000", opacity: 0.9, x: 0, y: 0.07, blur: 0.04 }],
  "current-title-glow": [
    { id: "ambient-shadow", color: "#05080f", opacity: 0.7, x: 0, y: 0.02, svgY: 0, blur: 0.36 },
    { id: "soft-shadow", color: "#05080f", opacity: 0.9, x: 0, y: 0.12, blur: 0.20 },
    { id: "contact-shadow", color: "#05080f", opacity: 0.95, x: 0, y: 0.07, blur: 0.04 },
    { id: "outer-glow", color: "#e5efff", opacity: 0.55, x: 0, y: 0, blur: 0.16 },
    { id: "inner-glow", color: "#ffffff", opacity: 0.85, x: 0, y: 0, blur: 0.045 },
  ],
};
for (const layers of Object.values(effects)) { for (const layer of layers) Object.freeze(layer); Object.freeze(layers); }
Object.freeze(effects);
export const TEXT_EFFECT_IDS = Object.freeze([...Object.keys(effects), "current-title-glow-shine"]);
export function textEffectLayers(id) { return structuredClone(effects[id === "current-title-glow-shine" ? "current-title-glow" : id] || []); }
function rgba(hex, opacity) { return `rgba(${[1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)).join(",")},${opacity})`; }
export function textShadowCss(effect) {
  return textEffectLayers(effect).reverse().map((layer) => `${layer.x}em ${layer.y}em ${layer.blur}em ${rgba(layer.color, layer.opacity)}`).join(", ") || "none";
}
