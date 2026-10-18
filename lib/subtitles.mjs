import { isStillSegment, segmentDuration, FOREGROUND_Y, FOREGROUND_HEIGHT, FOREGROUND_SCALE, CANVAS_HEIGHT, SUBTITLE_BOTTOM_SAFE_MARGIN } from './render-config.mjs';
import { FONT_IDS, normalizeFontId, fontWeightFor } from "./visual-style/fonts.mjs";
import { presentationSegments } from "./teaser-hooks.mjs";
export const SUBTITLE_FONTS = FONT_IDS;
export const DEFAULT_SUBTITLE_STYLE = Object.freeze({ enabled: false, source: 'youtube', font: "auto", size: 48, color: "#ffffff", outlineColor: "#111111", outline: 3, position: "bottom" });
export function subtitleStyle(value = {}) {
  value = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  // Preserve legacy coercion/defaults for partial subtitle objects while ensuring
  // NaN/Infinity never enter the canonical JSON representation.
  const numeric = (input, fallback, min, max) => {
    const parsed = typeof input === "number" || typeof input === "string" ? Number(input) : NaN;
    const finite = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, finite || fallback));
  };
  return { enabled: value.enabled === true,
    source: ['youtube', 'whisper'].includes(value.source) ? value.source : 'auto',
    font: normalizeFontId(value.font),
    size: numeric(value.size, 48, 28, 72),
    color: /^#[\da-f]{6}$/i.test(value.color) ? value.color : "#ffffff",
    outlineColor: /^#[\da-f]{6}$/i.test(value.outlineColor) ? value.outlineColor : "#111111",
    outline: numeric(value.outline, 0, 0, 8),
    position: ["top", "center", "bottom"].includes(value.position) ? value.position : "bottom",
    ...(value.fontWeight !== undefined ? { fontWeight: fontWeightFor(value.font, typeof value.fontWeight === "number" ? value.fontWeight : 700) } : {}),
    ...(value.opacity !== undefined ? { opacity: typeof value.opacity === "number" && Number.isFinite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 } : {}),
    ...((value.effect !== undefined || value.fontWeight !== undefined || value.opacity !== undefined) ? { effect: ["none", "soft-shadow", "heavy-shadow"].includes(value.effect) ? value.effect : "soft-shadow" } : {}),
  };
}
export function subtitleY(style, sourceHeight = 1080) {
  const bottom = Math.min(FOREGROUND_Y + FOREGROUND_HEIGHT / 2 + Math.min(sourceHeight * FOREGROUND_SCALE, FOREGROUND_HEIGHT) / 2 - 32, CANVAS_HEIGHT - SUBTITLE_BOTTOM_SAFE_MARGIN - 24);
  return { top: 480, center: 900, bottom }[style.position] || bottom;
}
export function isCurrentCaptionRequest(request, current) {
  return Boolean(request.sourceId) && request.sourceId === current.sourceId && request.serial === current.serial && request.selectionEpoch === current.selectionEpoch;
}

// Caption providers can end the final cue slightly beyond the muxed media EOF.
// Intersect that small tail with the SOURCE duration, never with a Part duration.
// Larger overruns remain errors: they can indicate a different source/timebase.
export function sourceCaptionTrack(track, source) {
  if (!source?.id || !Number.isFinite(source.duration) || source.duration <= 0) throw new Error("Không xác định được source/thời lượng để kiểm tra phụ đề.");
  if (track?.sourceId !== source.id) throw new Error("Phụ đề thuộc source khác. Hãy tạo lại phụ đề cho video đang xử lý.");
  if (track.timeline !== undefined && track.timeline !== "source") throw new Error("Timeline phụ đề phải dùng timestamp gốc, chưa cắt/chưa tăng tốc.");
  if (track.sourceDuration !== undefined && (!Number.isFinite(track.sourceDuration) || Math.abs(track.sourceDuration - source.duration) > 0.1)) throw new Error("Thời lượng source của phụ đề không khớp video đang xử lý.");
  if (!Array.isArray(track.cues) || track.cues.length > 20_000) throw new Error("Danh sách phụ đề không hợp lệ hoặc quá nhiều câu.");
  const cues = []; let previousStart = -1;
  for (const cue of track.cues) {
    if (!cue || !Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < 0 || cue.end <= cue.start || cue.start < previousStart || typeof cue.text !== "string" || cue.text.length > 2000) throw new Error("Timestamp/thứ tự/nội dung phụ đề không hợp lệ. Hãy tạo lại phụ đề.");
    if (cue.end > source.duration + 2) throw new Error("Timestamp phụ đề vượt quá source hơn 2 giây. Kiểm tra đúng video và timeline gốc.");
    previousStart = cue.start;
    const end = Math.min(cue.end, source.duration);
    if (end > cue.start) {
      const previous = cues.at(-1);
      if (previous && previous.end > cue.start) {
        previous.end = cue.start;
        if (previous.end <= previous.start) cues.pop();
      }
      cues.push({ start: cue.start, end, text: cue.text });
    }
  }
  return { sourceId: source.id, sourceDuration: source.duration, timeline: "source", cues, origin: track.origin || "" };
}
function timestamp(value) { return value.replace(",", ".").split(":").reduce((sum, item) => sum * 60 + Number(item), 0); }
// Shared with the existing mock/planner: plain timestamped transcript lines.
export function transcriptCues(transcript) {
  return [...transcript.matchAll(/(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\n|\s+-\s+|\s+)([^\n]+)/g)]
    .map((match) => ({ at: timestamp(match[1]), text: match[2].trim() })).filter((c) => Number.isFinite(c.at) && c.text.length > 0);
}
export function parseCaptions(value) {
  const cues = [];
  for (const block of value.replace(/^\uFEFF/, "").split(/\r?\n\r?\n+/)) {
    const lines = block.split(/\r?\n/);
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) continue;
    const match = lines[index].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
    if (!match) continue;
    const start = timestamp(match[1]), end = timestamp(match[2]);
    let text = lines.slice(index + 1).join(" ").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const previous = cues.at(-1);
    const rolling = previous && start <= previous.end + 0.02;
    if (rolling && previous.text === text) { previous.end = Math.max(end, previous.end); continue; }
    if (rolling && text.startsWith(previous.text)) text = text.slice(previous.text.length).trim();
    if (!text) continue;
    if (previous && previous.end > start) previous.end = start;
    cues.push({ start, end, text });
  }
  return cues.filter((cue) => cue.end > cue.start).sort((a, b) => a.start - b.start);
}
function width(text) {
  return [...text].reduce((sum, character) => sum + (/\s/u.test(character) ? 0.32 : /[\u3000-\u9fff\uac00-\ud7afMW]/u.test(character) ? 1 : /[A-Z]/u.test(character) ? 0.9 : /[a-z0-9\u00c0-\u024f]/u.test(character) ? 0.65 : 1), 0);
}
export function wrapCaption(text, size = 48) {
  const capacity = 860 / size;
  const tokens = [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)].flatMap(({ segment }) => width(segment) > capacity ? [...segment] : [segment]);
  const lines = []; let line = "";
  for (const token of tokens) {
    if (line && width(line + token) > capacity) { lines.push(line.trim()); line = ""; }
    line += token;
  }
  if (line.trim()) lines.push(line.trim());
  const chunks = [];
  for (let index = 0; index < lines.length; index += 2) chunks.push(lines.slice(index, index + 2).join("\n"));
  return chunks;
}
// Times are pre-speed-up, relative to the concatenated part, including repeats.
export function partCaptions(cues, part, style = DEFAULT_SUBTITLE_STYLE) {
  let offset = 0; const result = [];
  for (const segment of presentationSegments(part)) {
    if (isStillSegment(segment)) { offset += segmentDuration(segment); continue; }
    for (const cue of cues) {
      const start = Math.max(cue.start, segment.start), end = Math.min(cue.end, segment.end);
      if (end <= start) continue;
      const chunks = wrapCaption(cue.text, style.size);
      const weights = chunks.map((text) => [...text].length);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let position = offset + start - segment.start;
      chunks.forEach((text, index) => {
        const duration = (end - start) * weights[index] / total;
        result.push({ start: position, end: position + duration, text }); position += duration;
      });
    }
    offset += segment.end - segment.start;
  }
  return result;
}
