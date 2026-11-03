import assert from "node:assert/strict";
import test from "node:test";
import { RENDER_FILTER_COMPLEX_THREADS, RENDER_INPUT_THREADS, RENDER_RESOURCE_PROFILE, balancedFfmpegArgs } from "./media-resources.mjs";

test("export thread budget is bounded to 2..4 and shared by decode and the filter graph", () => {
  assert.ok(RENDER_FILTER_COMPLEX_THREADS >= 2 && RENDER_FILTER_COMPLEX_THREADS <= 4);
  assert.equal(RENDER_INPUT_THREADS, RENDER_FILTER_COMPLEX_THREADS);
  assert.equal(RENDER_RESOURCE_PROFILE, "balanced-m2-editor-v4");
});

test("only the export opts into the larger pool; every other ffmpeg call keeps 2 decode threads and 1 graph thread", () => {
  const exportArgs = balancedFfmpegArgs(["-i", "a", "-i", "b", "out"], { filterComplexThreads: RENDER_FILTER_COMPLEX_THREADS, inputThreads: RENDER_INPUT_THREADS });
  assert.deepEqual(exportArgs, ["-nostdin", "-filter_threads", "1", "-filter_complex_threads", String(RENDER_FILTER_COMPLEX_THREADS),
    "-threads", String(RENDER_INPUT_THREADS), "-thread_queue_size", "8", "-i", "a", "-threads", String(RENDER_INPUT_THREADS), "-thread_queue_size", "8", "-i", "b", "out"]);
  assert.deepEqual(balancedFfmpegArgs(["-i", "a", "out"]), ["-nostdin", "-filter_threads", "1", "-filter_complex_threads", "1", "-threads", "2", "-thread_queue_size", "8", "-i", "a", "out"]);
  // Arbitrary values cannot unlock an unbounded pool.
  assert.deepEqual(balancedFfmpegArgs(["-i", "a"], { filterComplexThreads: 64, inputThreads: 64 }), ["-nostdin", "-filter_threads", "1", "-filter_complex_threads", "1", "-threads", "2", "-thread_queue_size", "8", "-i", "a"]);
});
