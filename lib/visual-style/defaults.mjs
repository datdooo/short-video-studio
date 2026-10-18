import { FOREGROUND_SCALE, TITLE_LAYOUT } from "../render-config.mjs";
import { DEFAULT_SUBTITLE_STYLE, subtitleStyle } from "../subtitles.mjs";
import { CURRENT_BACKGROUND } from "./backgrounds.mjs";
import { CURRENT_FILTER } from "./filters.mjs";

function freeze(value) {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) freeze(nested);
    Object.freeze(value);
  }
  return value;
}
const title = (layout) => ({
  font: "auto", fontWeight: 700,
  size: { mode: "auto-fit", min: TITLE_LAYOUT.minFontSize, max: TITLE_LAYOUT.maxFontSize, maxLines: TITLE_LAYOUT.maxLines, maxWidth: TITLE_LAYOUT.maxWidth, lineSpacing: TITLE_LAYOUT.lineSpacing },
  color: "#ffffff", outlineColor: "#000000", outline: 0,
  alignment: "center", opacity: 1, effect: "current-title-glow-shine", layout,
});

// Describes the shipped look. Fitting, typography effects, and FFmpeg algorithms
// remain in their existing renderers; layout/effect IDs refer to those contracts.
export const DEFAULT_VISUAL_STYLE = freeze({
  version: 1, presetId: "current",
  originalTitle: title("original-title-zone"),
  partTitle: title("part-title-zone"),
  partIndicator: { ...title("part-indicator"), fontWeight: 800, size: { mode: "fixed", value: 58 }, effect: "current-title-glow" },
  subtitle: subtitleStyle(DEFAULT_SUBTITLE_STYLE),
  foreground: { layout: "native-center-crop-pad", scale: FOREGROUND_SCALE, position: "center" },
  background: structuredClone(CURRENT_BACKGROUND),
  filter: { ...CURRENT_FILTER },
  overlays: [],
});
