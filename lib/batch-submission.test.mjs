import test from "node:test";
import assert from "node:assert/strict";
import { clearSubmittedBatchInput } from "./batch-submission.mjs";

test("successful submission clears exactly the submitted text", () => {
  const input = " https://youtu.be/A\nhttps://youtu.be/B\n";
  assert.equal(clearSubmittedBatchInput(input, input), "");
});
test("successful submission preserves additional links pasted while waiting for the response", () => {
  const submitted = "https://youtu.be/A";
  assert.equal(clearSubmittedBatchInput(`${submitted}\nhttps://youtu.be/B`, submitted), "https://youtu.be/B");
  assert.equal(clearSubmittedBatchInput("https://youtu.be/C", submitted), "https://youtu.be/C");
  assert.equal(clearSubmittedBatchInput("", submitted), "");
  assert.equal(clearSubmittedBatchInput(`${submitted}B`, submitted), `${submitted}B`);
  assert.equal(clearSubmittedBatchInput(`${submitted}\nhttps://youtu.be/B`, `${submitted}\n`), "https://youtu.be/B");
});
