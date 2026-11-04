import { formatSourceTimecode } from "./source-timecode.mjs";

// Read-only blocks for the source-time strip: where each Part keeps main ranges and its teaser.
// left/width are percentages of the source duration, clamped so a bad range can never overflow the track.
export function stripBlocks(part, duration) {
  const main = part.segments.filter((segment) => !segment.isPadding);
  const teaser = part.teaser?.status === "selected" && part.teaserEnabled !== false ? part.teaser : null;
  const ends = [...main.map((segment) => segment.end), teaser?.end ?? 0];
  const total = Number.isFinite(duration) && duration > 0 ? duration : Math.max(...ends, 0);
  if (!(total > 0)) return [];
  const block = (kind, index, start, end) => {
    const from = Math.min(Math.max(start, 0), total);
    const to = Math.min(Math.max(end, from), total);
    return {
      kind,
      index,
      start,
      end,
      left: (from / total) * 100,
      width: ((to - from) / total) * 100,
      label: `${formatSourceTimecode(from)} – ${formatSourceTimecode(to)}`,
    };
  };
  return [
    ...main.map((segment, index) => block("main", index, segment.start, segment.end)),
    ...(teaser ? [block("teaser", 0, teaser.start, teaser.end)] : []),
  ];
}

export function stripTicks(duration, count = 4) {
  if (!(Number.isFinite(duration) && duration > 0)) return [];
  return Array.from({ length: count + 1 }, (_, i) => formatSourceTimecode((duration * i) / count).slice(0, -3));
}
