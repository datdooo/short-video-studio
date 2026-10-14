import test from "node:test";
import assert from "node:assert/strict";
import { trimPartStart } from "./part-start.mjs";

test("trim just the beginning, without mutating source timestamps or padding", () => {
  const part = { id: 1, segments: [{ start: 10, end: 20 }, { start: 30, end: 40 }, { start: 0, end: 10, isPadding: true }] };
  const result = trimPartStart(part);
  assert.deepEqual(result.segments.map((segment) => segment.start), [11, 30, 0]);
  assert.equal(part.segments[0].start, 10);
});
test("short first segment consumes one second across main footage only", () => {
  assert.deepEqual(trimPartStart({ id: 2, segments: [{ start: 0, end: 0.4 }, { start: 10, end: 20 }] }).segments, [{ start: 10.6, end: 20 }]);
  assert.throws(() => trimPartStart({ id: 1, segments: [{ start: 0, end: 1 }, { start: 5, end: 20, isPadding: true }] }), /quá ngắn/);
});
