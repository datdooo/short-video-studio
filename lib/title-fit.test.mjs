import test from "node:test";
import assert from "node:assert/strict";
import { constrainTitlePair, needsMeasuredTitleFit } from "./visual-style/title-fit.mjs";
import { applyTextPreset, applyFontOverride } from "./visual-style/text-presets.mjs";
import { TITLE_LAYOUT } from "./render-config.mjs";

const fit = (text, fontSize = 70) => ({ text, lines: text.split("\n"), fontSize, lineSpacing: 4, truncated: false });
const measure = (text, size) => Array.from(text).reduce((sum, char) => sum + (/[mW@]/.test(char) ? 1.3 : 0.6) * size, 0);

test("Current retains legacy fitting; presets and explicit font/weight choices use the guard", () => {
  const current = applyTextPreset(undefined, "current");
  assert.equal(needsMeasuredTitleFit(current), false);
  for (const id of ["clean", "shorts-bold", "yellow-hook", "minimal", "news", "jp-clean", "kr-clean"]) assert.equal(needsMeasuredTitleFit(applyTextPreset(undefined, id)), true);
  assert.equal(needsMeasuredTitleFit(applyFontOverride(current, "Inter")), true);
  current.partTitle.fontWeight = 900;
  assert.equal(needsMeasuredTitleFit(current), true);
});

test("already fitting titles retain the exact pair and do not alter existing wrapping", async () => {
  const pair = { original: fit("A short title"), part: fit("A part title") };
  assert.equal(await constrainTitlePair(pair.original.text, pair.part.text, pair, measure), pair);
});

test("wide glyphs and long tokens reflow within real width, minimum size, line and height limits", async () => {
  for (const value of ["m".repeat(300), "Wm@ ".repeat(100), "A long title ".repeat(100)]) {
    const pair = { original: fit(value), part: fit(value) };
    const before = structuredClone(pair);
    const result = await constrainTitlePair(value, value, pair, async (...args) => measure(...args));
    assert.deepEqual(pair, before);
    assert.equal(result.original.fontSize, result.part.fontSize);
    for (const [role, fitted] of Object.entries(result)) {
      assert.ok(fitted.fontSize >= TITLE_LAYOUT.minFontSize);
      assert.ok(fitted.lines.length <= TITLE_LAYOUT.maxLines);
      assert.ok(fitted.lines.length * fitted.fontSize + (fitted.lines.length - 1) * 4 <= TITLE_LAYOUT[role].bottom - TITLE_LAYOUT[role].top);
      for (const line of fitted.lines) assert.ok(measure(line, fitted.fontSize) <= TITLE_LAYOUT.maxWidth);
      assert.ok(fitted.truncated);
      assert.ok(fitted.text.endsWith("…"));
    }
  }
});

test("reflow preserves text when it fits, handles blank titles and propagates measurement failures", async () => {
  const value = "mmmm mmmm mmmm mmmm";
  const pair = { original: fit(value), part: fit("UNTITLED") };
  const result = await constrainTitlePair(value, "  ", pair, measure);
  assert.equal(result.original.text.replace(/\n/g, " "), value);
  assert.equal(result.original.truncated, false);
  assert.equal(result.part.text, "UNTITLED");
  const token = "m".repeat(27);
  const tall = await constrainTitlePair(token, token, { original: fit(token), part: fit(token) }, measure);
  assert.equal(tall.original.text.replace(/\n/g, ""), token);
  assert.ok(tall.original.fontSize < 70, "A three-line reflow must also fit the shorter original-title zone");
  assert.ok(tall.original.lines.length * tall.original.fontSize + (tall.original.lines.length - 1) * 4 <= TITLE_LAYOUT.original.bottom - TITLE_LAYOUT.original.top);
  await assert.rejects(constrainTitlePair(value, value, pair, () => { throw new Error("Missing font"); }), /Missing font/);
});
