import test from "node:test";
import assert from "node:assert/strict";
import { cutTransitionFilters } from "./cut-transition.mjs";
const segments = [{ start: 0, end: 1 }, { start: 2, end: 3 }, { start: 4, end: 5 }];
test("None and single-segment parts introduce no filter; invalid IDs cannot become expressions", () => {
  assert.equal(cutTransitionFilters(undefined, segments), null);
  assert.equal(cutTransitionFilters("none", segments), null);
  assert.equal(cutTransitionFilters("dip-black", [segments[0]]), null);
  assert.throws(() => cutTransitionFilters("white:movie=/secret", segments), /Invalid/);
});
test("trusted fades use shared speed-adjusted windows, gated so each cut recovers; no audio/timestamp filters", () => {
  for (const id of ["dip-black", "flash-white"]) {
    const graph = cutTransitionFilters(id, segments);
    assert.equal((graph.match(/fade=t=/g) || []).length, 4);
    assert.match(graph, /fade=t=out:st=0\.750000000:d=0\.250000000/);
    assert.match(graph, /fade=t=in:st=1\.000000000:d=0\.250000000/);
    assert.equal((graph.match(/enable='between/g) || []).length, 4);
    assert.ok(graph.includes(id === "dip-black" ? "color=#000000" : "color=#ffffff"));
    assert.doesNotMatch(graph, /xfade|acrossfade|setpts|atempo|subtitle|titlecard|concat|movie=/);
  }
});
