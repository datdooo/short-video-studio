import test from "node:test";
import assert from "node:assert/strict";
import { locateTimelineTime, timelineTimeForSegment } from "./preview-timeline.mjs";

test("preview seek and clock distinguish repeated footage by segment index", () => {
  const segments = [{ start: 10, end: 30 }, { start: 40, end: 60 }, { start: 10, end: 30 }, { start: 10, end: 30 }];
  assert.deepEqual(locateTimelineTime(segments, 0), { index: 0, sourceTime: 10 });
  assert.deepEqual(locateTimelineTime(segments, 32), { index: 2, sourceTime: 10 });
  assert.deepEqual(locateTimelineTime(segments, 52), { index: 3, sourceTime: 15 });
  assert.equal(timelineTimeForSegment(segments, 0, 15), 4);
  assert.equal(timelineTimeForSegment(segments, 3, 15), 52);
  assert.deepEqual(locateTimelineTime(segments, 1000), { index: 3, sourceTime: 30 });
});
