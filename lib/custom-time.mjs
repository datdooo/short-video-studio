import {invalidateEditedAnalysis} from './auto-cut/analysis.mjs';
import { PLAYBACK_RATE } from './render-config.mjs';
import { hookRangeKey, fallbackTeaser } from "./teaser-hooks.mjs";

export function timeInput(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = Number((seconds % 60).toFixed(3));
  return [hours, minutes, remainder].map((value) => {
    const [integer, fraction] = String(value).split(".");
    return integer.padStart(2, "0") + (fraction ? `.${fraction}` : "");
  }).join(":");
}

export function partTimes(plan) {
  return plan.parts.map((part) => {
    const main = part.segments.filter((segment) => !segment.isPadding);
    return { start: timeInput(main[0].start), end: timeInput(main.at(-1).end) };
  });
}

function seconds(value) {
  if (!/^(?:\d+:)?\d{1,2}:\d{2}(?:\.\d+)?$|^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error("Dùng HH:MM:SS, MM:SS hoặc số giây.");
  const fields = value.trim().split(":").map(Number);
  if (fields.length > 1 && fields.slice(1).some((field) => field >= 60)) throw new Error("Phút/giây phải nhỏ hơn 60.");
  const result = fields.reduce((total, field) => total * 60 + field, 0);
  if (!Number.isFinite(result)) throw new Error("Thời gian phải là số hữu hạn.");
  return result;
}

// Preserve interior exclusions and supplemental footage; only edit the main window.
export function applyPartTimes(plan, times, sourceDuration = Infinity) {
  const parts = plan.parts.map((part, index) => {
    const start = seconds(times[index].start), end = seconds(times[index].end);
    if (end <= start || end > sourceDuration) throw new Error(`Part ${part.id}: end phải lớn hơn start và không vượt thời lượng source.`);
    const main = part.segments.filter((segment) => !segment.isPadding);
    const segments = main.map((segment, segmentIndex) => ({ ...segment,
      start: Math.max(start, segmentIndex === 0 ? Math.min(start, segment.start) : segment.start),
      end: Math.min(end, segmentIndex === main.length - 1 ? Math.max(end, segment.end) : segment.end),
    })).filter((segment) => segment.end > segment.start);
    if (!segments.length || segments[0].start !== start || segments.at(-1).end !== end) throw new Error(`Part ${part.id}: mốc nằm trong đoạn đã loại bỏ; chọn mốc trong nội dung được giữ lại.`);
    segments.push(...part.segments.filter((segment) => segment.isPadding));
    if (!["manual", "mock"].includes(plan.providerUsed) && segments.reduce((sum, segment) => sum + segment.end - segment.start, 0) / PLAYBACK_RATE <= 60) throw new Error(`Part ${part.id}: cần trên 1 phút sau tua 1.25×.`);
    const changed = start !== main[0].start || end !== main.at(-1).end;
    const next = { ...part, segments, ...(changed ? { manualLocked: true } : {}), startTrimApplied: true, smartCutApplied: true };
    if (part.teaser && hookRangeKey(next) !== hookRangeKey(part)) next.teaser = fallbackTeaser(next, "Main ranges changed; explicitly reselect a coherent later hook.");
    return next;
  });
  if (parts[1].segments[0].start < parts[0].segments.filter((segment) => !segment.isPadding).at(-1).end) throw new Error("Part 2 không được bắt đầu trước khi Part 1 kết thúc.");
  return { ...plan, parts, ...(plan.analysis?{analysis:invalidateEditedAnalysis(plan,parts,sourceDuration)}:{}) };
}
