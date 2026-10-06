type Range = { start: number; end: number };
export function locateTimelineTime(segments: Range[], seconds: number, speed?: number): { index: number; sourceTime: number };
export function timelineTimeForSegment(segments: Range[], index: number, sourceTime: number, speed?: number): number;
