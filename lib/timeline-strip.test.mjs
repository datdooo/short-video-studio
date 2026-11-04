import test from "node:test";
import assert from "node:assert/strict";
import { stripBlocks, stripTicks } from "./timeline-strip.mjs";

const part = (segments, teaser, teaserEnabled) => ({ segments, teaser, teaserEnabled });

test("main ranges and teaser become clamped percentage blocks, padding is skipped", () => {
  const blocks = stripBlocks(
    part(
      [
        { start: 10, end: 20 },
        { start: 90, end: 140 },
        { start: 5, end: 6, isPadding: true },
      ],
      { status: "selected", start: 40, end: 50 },
    ),
    100,
  );
  assert.deepEqual(
    blocks.map((b) => [b.kind, b.index, b.left, b.width]),
    [
      ["main", 0, 10, 10],
      ["main", 1, 90, 10],
      ["teaser", 0, 40, 10],
    ],
  );
});

test("unknown duration falls back to the last range; disabled or unselected teaser is hidden", () => {
  const blocks = stripBlocks(
    part([{ start: 0, end: 50 }], { status: "selected", start: 10, end: 20 }, false),
    Infinity,
  );
  assert.deepEqual(
    blocks.map((b) => [b.kind, b.width]),
    [["main", 100]],
  );
  assert.deepEqual(stripBlocks(part([], undefined), Infinity), []);
});

test("ticks cover the duration", () => {
  assert.deepEqual(stripTicks(100), ["00:00:00", "00:00:25", "00:00:50", "00:01:15", "00:01:40"]);
  assert.deepEqual(stripTicks(Infinity), []);
});
