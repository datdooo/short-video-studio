import { DEFAULT_VISUAL_STYLE } from "./defaults.mjs";
const base = DEFAULT_VISUAL_STYLE;
function preset(id, label, description, font, weight, effect, outline = 0, color = "#ffffff") {
  const title = (role) => ({ ...structuredClone(base[role]), font, fontWeight: weight, color, outline, outlineColor: "#111111", effect });
  return { id, label, description, originalTitle: title("originalTitle"), partTitle: title("partTitle"), partIndicator: title("partIndicator"), subtitle: { ...base.subtitle, font, fontWeight: weight, effect, opacity: 1, outline, color } };
}
const values = [
  { id: "current", label: "Current", description: "Original white glow", originalTitle: base.originalTitle, partTitle: base.partTitle, partIndicator: base.partIndicator, subtitle: base.subtitle },
  preset("clean", "Clean", "Clear white with a soft shadow", "Inter", 700, "soft-shadow", 0),
  preset("shorts-bold", "Shorts Bold", "Heavy condensed text and dark outline", "Roboto Condensed", 900, "heavy-shadow", 4),
  preset("yellow-hook", "Yellow Hook", "Yellow hook with a strong outline", "Oswald", 700, "heavy-shadow", 3, "#ffe24a"),
  preset("minimal", "Minimal", "Simple white without effects", "Noto Sans", 700, "none", 0),
  preset("news", "News", "Bold high-contrast headlines", "Montserrat", 800, "soft-shadow", 2),
  preset("jp-clean", "JP Clean", "Japanese Noto with a restrained shadow", "Noto Sans JP", 700, "soft-shadow", 1),
  preset("kr-clean", "KR Clean", "Korean Noto with a restrained shadow", "Noto Sans KR", 700, "soft-shadow", 1),
];
values.find((entry) => entry.id === "news").partTitle.color = "#8de7ff";
function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const registry = freeze(Object.fromEntries(values.map((value) => [value.id, value])));
export const TEXT_PRESET_IDS = Object.freeze(Object.keys(registry));
export function textPresetDefinition(id) {
  if (!Object.hasOwn(registry, id)) throw new Error("Unknown text preset.");
  return structuredClone(registry[id]);
}
