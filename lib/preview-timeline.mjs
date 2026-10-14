import { PLAYBACK_RATE, segmentDuration, isStillSegment } from './render-config.mjs';
export function locateTimelineTime(segments, seconds, speed = PLAYBACK_RATE) {
  let remaining = Math.max(0, seconds) * speed;
  for (const [index, segment] of segments.entries()) {
    const duration = segmentDuration(segment);
    if (remaining < duration || index === segments.length - 1) {
      return { index, sourceTime: isStillSegment(segment) ? segment.start : segment.start + Math.min(remaining, duration), ...(isStillSegment(segment) ? { holdElapsed: Math.min(remaining, duration) / speed } : {}) };
    }
    remaining -= duration;
  }
  return { index: 0, sourceTime: 0 };
}

export function timelineTimeForSegment(segments, index, sourceTime, speed = PLAYBACK_RATE) {
  const segment = segments[index];
  if (!segment) return 0;
  const elapsed = segments.slice(0, index).reduce((total, item) => total + segmentDuration(item), 0);
  return (elapsed + Math.max(0, Math.min(sourceTime - segment.start, segment.end - segment.start))) / speed;
}
