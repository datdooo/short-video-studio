import test from "node:test";
import assert from "node:assert/strict";
import { titleAnimationFilters } from "./title-animation.mjs";
const options = { titleInput: 1, shineInput: 2, overlayFormat: "" };
test("none bypasses new graph exactly, invalid IDs fail before filter creation", () => {
  assert.equal(titleAnimationFilters(options), null);
  assert.equal(titleAnimationFilters({ ...options, id: "none" }), null);
  assert.throws(() => titleAnimationFilters({ ...options, id: "fade=injected" }), /Invalid/);
});
test("entrances use speed-adjusted duration, share shine transform, and keep scenes outside motion", () => {
  for (const id of ["fade-in", "slide-up", "pop-in"]) {
    const filters = titleAnimationFilters({ ...options, id, sceneInput: 5 });
    const graph = filters.join(";");
    assert.match(graph, /fade=t=in:st=0:d=0\.625:alpha=1/);
    assert.match(graph, /\[titlecard\]\[shine\]overlay/);
    assert.match(graph, /\[layout\]\[staticScene\]overlay/);
    assert.match(graph, /\[animationLayout\]\[animatedTitles\]overlay/);
    assert.doesNotMatch(graph, /subtitle|cuta|setpts/);
    assert.equal(/eval=frame:flags=bilinear/.test(graph), id === "pop-in");
    assert.equal(graph.includes("+20*(1-min(t/0.625,1))"), id === "slide-up");
    assert.deepEqual(titleAnimationFilters({ ...options, id, sceneInput: 5 }), filters, "Each part independently starts at zero");
  }
});
