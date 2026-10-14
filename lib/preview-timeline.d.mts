import type { Segment } from './edit-plan';
type Range = Segment;
export function locateTimelineTime(segments: Range[], seconds: number, speed?: number): { index: number; sourceTime: number; holdElapsed?: number };
export function timelineTimeForSegment(segments: Range[], index: number, sourceTime: number, speed?: number): number;
