export const PART_START_TRIM_SECONDS = 1;

// Work on a copy: AI/manual plans continue to refer to the original source.
export function trimPartStart(part) {
  if (part.startTrimApplied === true) return part;
  let remaining = PART_START_TRIM_SECONDS;
  const segments = [];
  for (const segment of part.segments) {
    if (remaining > 0 && !segment.isPadding) {
      const length = Number(segment.end) - Number(segment.start);
      if (length <= remaining) { remaining -= length; continue; }
      segments.push({ ...segment, start: Number(segment.start) + remaining });
      remaining = 0;
    } else segments.push({ ...segment });
  }
  if (remaining > 0 || !segments.some((segment) => !segment.isPadding)) {
    throw new Error(`Part ${part.id} quá ngắn để bỏ 1 giây đầu. Hãy chọn thêm footage.`);
  }
  return { ...part, segments, startTrimApplied: true };
}
