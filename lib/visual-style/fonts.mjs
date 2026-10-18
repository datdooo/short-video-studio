// Stable IDs retain the subtitle font values used by existing saved plans.
const latinWeights = [400, 500, 600, 700, 800, 900];
const definitions = [
  { id: "auto", label: "Auto", family: null, file: null, licenseFile: null, scripts: ["latin", "japanese", "korean"], weights: latinWeights, group: "Recommended" },
  { id: "Noto Sans", label: "Noto Sans", family: "Noto Sans", file: "NotoSans-Variable.ttf", licenseFile: "NotoSans-OFL.txt", scripts: ["latin"], weights: latinWeights, group: "Recommended" },
  { id: "Noto Sans JP", label: "Noto Sans JP", family: "Noto Sans JP", file: "NotoSansJP-Variable.ttf", licenseFile: "NotoSansJP-OFL.txt", scripts: ["latin", "japanese"], weights: latinWeights, group: "Japanese" },
  { id: "Noto Sans KR", label: "Noto Sans KR", family: "Noto Sans KR", file: "NotoSansKR-Variable.ttf", licenseFile: "NotoSansKR-OFL.txt", scripts: ["latin", "korean"], weights: latinWeights, group: "Korean" },
  { id: "Montserrat", label: "Montserrat", family: "Montserrat", file: "Montserrat-Variable.ttf", licenseFile: "Montserrat-OFL.txt", scripts: ["latin"], weights: latinWeights, group: "Recommended" },
  { id: "Inter", label: "Inter", family: "Inter", file: "Inter-Variable.ttf", licenseFile: "Inter-OFL.txt", scripts: ["latin"], weights: latinWeights, group: "Recommended" },
  { id: "Roboto Condensed", label: "Roboto Condensed", family: "Roboto Condensed", file: "RobotoCondensed-Variable.ttf", licenseFile: "RobotoCondensed-OFL.txt", scripts: ["latin"], weights: latinWeights, group: "Recommended" },
  { id: "Oswald", label: "Oswald", family: "Oswald", file: "Oswald-Variable.ttf", licenseFile: "Oswald-OFL.txt", scripts: ["latin"], weights: [400, 500, 600, 700], group: "Recommended" },
];
for (const entry of definitions) {
  entry.bundled = Boolean(entry.file);
  entry.fallbackFamilies = ["Noto Sans", "Noto Sans JP", "Noto Sans KR"];
  for (const value of Object.values(entry)) if (Array.isArray(value)) Object.freeze(value);
  Object.freeze(entry);
}
const registry = Object.freeze(Object.fromEntries(definitions.map((entry) => [entry.id, entry])));
export const FONT_IDS = Object.freeze(definitions.map((entry) => entry.id));
export function normalizeFontId(value) { return typeof value === "string" && Object.hasOwn(registry, value) ? value : "auto"; }
export function getFontDefinition(id = "auto") { return structuredClone(registry[normalizeFontId(id)]); }
export function listFonts() { return definitions.map((entry) => structuredClone(entry)); }
export function detectScript(text) {
  const japanese = (String(text).match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  const korean = (String(text).match(/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g) || []).length;
  if (japanese > korean && japanese > 0) return "japanese";
  return korean > 0 ? "korean" : "latin";
}
export function supportsScript(id, script) { return registry[normalizeFontId(id)].scripts.includes(script); }
export function fontFallbackStack(id, text, browser = false) {
  const primary = registry[normalizeFontId(id)].family;
  const script = detectScript(text);
  const fallbacks = script === "japanese" ? ["Noto Sans JP", "Noto Sans", "Noto Sans KR"] : script === "korean" ? ["Noto Sans KR", "Noto Sans", "Noto Sans JP"] : ["Noto Sans", "Noto Sans JP", "Noto Sans KR"];
  const families = [...new Set([primary, ...fallbacks].filter(Boolean))];
  return [...families.map((family) => browser ? `Studio ${family}` : family), "sans-serif"];
}
export function fontFamilyForStyle(id, text, { browser = false, overrides = {} } = {}) {
  if (normalizeFontId(id) === "auto" && overrides[detectScript(text)]) return overrides[detectScript(text)];
  return fontFallbackStack(id, text, browser).join(", ");
}
export function fontWeightFor(id, value = 700) {
  const weights = registry[normalizeFontId(id)].weights;
  const requested = Number.isFinite(value) ? value : 700;
  return weights.reduce((best, weight) => Math.abs(weight - requested) < Math.abs(best - requested) ? weight : best);
}
export function fontFaceCss() {
  return definitions.filter((font) => font.bundled).map((font) => `@font-face{font-family:"Studio ${font.family}";src:url("/${font.file}") format("truetype");font-style:normal;font-weight:${Math.min(...font.weights)} ${Math.max(...font.weights)};font-display:swap;}`).join("\n");
}
