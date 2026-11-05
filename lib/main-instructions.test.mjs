import test from "node:test";
import assert from "node:assert/strict";
import {
  MAIN_EDITING_CRITERIA,
  PROMOTION_FILTER_INSTRUCTIONS,
  PRODUCT_TITLE_INSTRUCTIONS,
  MIN_EXPORT_INSTRUCTIONS,
  mainInstruction,
} from "./main-instructions.mjs";
import { manualMainRules } from "./muse-plan.mjs";

test("main rules include the promotion / redirect / personal-info filter and stay manual-prompt compatible", () => {
  assert.ok(MAIN_EDITING_CRITERIA.includes(PROMOTION_FILTER_INSTRUCTIONS));
  for (const word of ["Advertising or sponsorship", "third-party platform", "Personal or contact information", "Brand names", "Marketing or self-promotion"])
    assert.ok(PROMOTION_FILTER_INSTRUCTIONS.includes(word), word);
  assert.match(PROMOTION_FILTER_INSTRUCTIONS, /NOT the video's subject is removed/);
  assert.match(PROMOTION_FILTER_INSTRUCTIONS, /REVIEW \/ UNBOXING \/ DEMO EXCEPTION/);
  assert.ok(MAIN_EDITING_CRITERIA.includes(PRODUCT_TITLE_INSTRUCTIONS));
  assert.match(PRODUCT_TITLE_INSTRUCTIONS, /originalTitle is always the exact source title/);
  assert.ok(!MAIN_EDITING_CRITERIA.includes("A brand/product mention alone is not an advertisement"));
  assert.doesNotThrow(() => manualMainRules(MAIN_EDITING_CRITERIA));
});

test("the unchanged factory rule is never echoed back as a user requirement", () => {
  assert.equal(mainInstruction(MAIN_EDITING_CRITERIA).text, "");
  assert.equal(mainInstruction("Giữ nguyên đoạn nhạc cuối").text, "Giữ nguyên đoạn nhạc cuối");
});

test("main rules carry the 61 s export minimum, join repair and no stale 'no minimum' text", () => {
  assert.ok(MAIN_EDITING_CRITERIA.includes(MIN_EXPORT_INSTRUCTIONS));
  assert.match(MIN_EXPORT_INSTRUCTIONS, /longer than 61 seconds/);
  assert.match(MIN_EXPORT_INSTRUCTIONS, /at least 77 seconds/);
  assert.match(PROMOTION_FILTER_INSTRUCTIONS, /JOIN TEST/);
  assert.ok(!MAIN_EDITING_CRITERIA.includes("exceed a minimum length"));
  assert.ok(!MAIN_EDITING_CRITERIA.includes("balanced/minimum durations"));
});
