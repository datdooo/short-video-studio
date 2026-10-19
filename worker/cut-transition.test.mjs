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
test("foreground-only shared sprite blend preserves alpha and introduces no timeline/audio filters", () => {
  for (const id of ["dip-black", "flash-white", "rainbow-light-leak", "vr-light-leak-v2"]) {
    const graph = cutTransitionFilters(id, segments, undefined, {spriteInput:7}).join(";");
    assert.match(graph, /^\[mainUnlit\]split/);
    assert.match(graph, /\[7:v\]crop=216:270/);
    assert.match(graph, /alphaextract/);
    assert.match(graph, /alphamerge\[main\]/);
    assert.match(graph, /blend=all_expr/);
    assert.doesNotMatch(graph, /fade=t=|xfade|acrossfade|setpts|atempo|subtitle|titlecard|concat|movie=/);
  }
});
