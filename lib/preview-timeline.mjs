export function locateTimelineTime(segments, seconds, speed = 1.25) {
  let remaining = Math.max(0, seconds) * speed;
  for (const [index, segment] of segments.entries()) {
    const duration = segment.end - segment.start;
    if (remaining < duration || index === segments.length - 1) {
      return { index, sourceTime: segment.start + Math.min(remaining, duration) };
    }
    remaining -= duration;
  }
  return { index: 0, sourceTime: 0 };
}

export function timelineTimeForSegment(segments, index, sourceTime, speed = 1.25) {
  const segment = segments[index];
  if (!segment) return 0;
  const elapsed = segments.slice(0, index).reduce((total, item) => total + item.end - item.start, 0);
  return (elapsed + Math.max(0, Math.min(sourceTime - segment.start, segment.end - segment.start))) / speed;
}
