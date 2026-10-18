import { fontFamilyForStyle } from "./fonts.mjs";
import { textEffectLayers, textShadowCss } from "./effects.mjs";

export function textPreviewCss(style, text, scale = 1, role = "title") {
  // The historical indicator preview used 700 while export used 800. Keep that
  // exact compatibility appearance only for the unchanged current indicator.
  const legacyIndicator = role === "indicator" && style.font === "auto" && style.fontWeight === 800 && style.effect === "current-title-glow" && style.color === "#ffffff" && style.outline === 0 && style.opacity === 1;
  return { fontFamily: fontFamilyForStyle(style.font, legacyIndicator ? "A" : text, { browser: true }), fontWeight: legacyIndicator ? 700 : style.fontWeight,
    color: style.color, opacity: style.opacity, WebkitTextStroke: `${style.outline * 2 * scale}px ${style.outlineColor}`, paintOrder: "stroke fill",
    textShadow: textShadowCss(style.effect), fontOpticalSizing: "none" };
}
export function subtitlePreviewCss(style, text, scale = 1) {
  const appearance = { ...style, fontWeight: style.fontWeight ?? 700, opacity: style.opacity ?? 1, effect: style.effect ?? "none" };
  return { ...textPreviewCss(appearance, text, scale), textShadow: style.effect === undefined ? `0 ${2 * scale}px ${3 * scale}px #000` : textShadowCss(style.effect) };
}
export function escapeTextXml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
export function styledTextSvg(lines, { fontFamily, fontSize, firstBaseline, lineHeight, style, roundBaseline = true }) {
  const textNodes = lines.map((line, index) => `<text x="540" y="${roundBaseline ? Math.round(firstBaseline + index * lineHeight) : firstBaseline + index * lineHeight}" text-anchor="middle">${escapeTextXml(line)}</text>`).join("");
  const id = `${Math.round(firstBaseline)}-${fontSize}`;
  const layers = textEffectLayers(style.effect);
  const defs = layers.filter((layer) => layer.blur > 0).map((layer) => `<filter id="${layer.id}-${id}" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="${layer.blur / 2 * fontSize}" /></filter>`).join("");
  const shadows = layers.map((layer) => {
    const y = layer.svgY ?? layer.y;
    const transform = layer.x || y ? ` transform="translate(${layer.x * fontSize} ${y * fontSize})"` : "";
    return `<g fill="${layer.color}" opacity="${layer.opacity}"${transform}${layer.blur ? ` filter="url(#${layer.id}-${id})"` : ""}>${textNodes}</g>`;
  }).join("");
  return `<g font-family="${escapeTextXml(fontFamily)}" font-size="${fontSize}" font-weight="${style.fontWeight}" letter-spacing="0" stroke="none"${style.opacity === 1 ? "" : ` opacity="${style.opacity}"`}><defs>${defs}</defs>${shadows}<g fill="${style.color}"${style.outline ? ` stroke="${style.outlineColor}" stroke-width="${style.outline * 2}" stroke-linejoin="round" paint-order="stroke fill"` : ""}>${textNodes}</g></g>`;
}
