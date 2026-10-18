import { TITLE_LAYOUT } from "../render-config.mjs";

// Current keeps its historical fitter and pixels. New presets and explicit font
// choices additionally check real glyph widths in their respective rasterizer.
export function needsMeasuredTitleFit(style) {
  return ["originalTitle", "partTitle"].some((role) => {
    const text = style[role];
    return text.font !== "auto" || text.fontWeight !== 700 || text.outline !== 0
      || text.effect !== "current-title-glow-shine";
  });
}

export async function constrainTitlePair(original, part, pair, measure) {
  // Leave room for preview borders and rounding at the small editor scale.
  const maxWidth = TITLE_LAYOUT.maxWidth - 16;
  const cache = new Map();
  const width = async (text, size, role) => {
    const key = JSON.stringify([text, size, role]);
    if (!cache.has(key)) cache.set(key, await measure(text, size, role));
    return cache.get(key);
  };
  const linesOf = (fit) => fit.lines || fit.text.split("\n");
  let overflow = false;
  for (const role of ["original", "part"]) {
    for (const line of linesOf(pair[role])) {
      if (await width(line, pair[role].fontSize, role) > maxWidth) overflow = true;
    }
  }
  if (!overflow) return pair;

  async function wrap(value, size, role) {
    const words = (value.trim().replace(/\s+/g, " ") || "UNTITLED").split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (await width(candidate, size, role) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ""; }
      let rest = Array.from(word);
      while (rest.length) {
        let low = 1, high = rest.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (await width(rest.slice(0, middle).join(""), size, role) <= maxWidth) low = middle;
          else high = middle - 1;
        }
        line = rest.slice(0, low).join(""); rest = rest.slice(low);
        if (rest.length) { lines.push(line); line = ""; }
        if (lines.length > TITLE_LAYOUT.maxLines) return lines;
      }
      if (lines.length > TITLE_LAYOUT.maxLines) return lines;
    }
    if (line) lines.push(line);
    return lines;
  }
  const cap = Math.min(pair.original.fontSize, pair.part.fontSize);
  for (let size = cap; size >= TITLE_LAYOUT.minFontSize; size -= 2) {
    const fitted = {};
    let fits = true;
    for (const [role, value] of [["original", original], ["part", part]]) {
      let lines = await wrap(value, size, role);
      const truncated = lines.length > TITLE_LAYOUT.maxLines;
      if (lines.length * size + (lines.length - 1) * TITLE_LAYOUT.lineSpacing > TITLE_LAYOUT[role].bottom - TITLE_LAYOUT[role].top) fits = false;
      if (truncated) {
        fits = false;
        lines = lines.slice(0, TITLE_LAYOUT.maxLines);
        let last = Array.from(lines.at(-1));
        while (last.length && await width(`${last.join("").trimEnd()}…`, size, role) > maxWidth) last.pop();
        lines[lines.length - 1] = `${last.join("").trimEnd()}…`;
      }
      fitted[role] = { ...pair[role], lines, text: lines.join("\n"), lineCount: lines.length, fontSize: size, truncated };
    }
    if (fits || size === TITLE_LAYOUT.minFontSize) return fitted;
  }
  return pair;
}
