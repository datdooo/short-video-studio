import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { FONT_IDS, listFonts, getFontDefinition, normalizeFontId, fontFallbackStack, fontFamilyForStyle, detectScript, supportsScript, fontFaceCss } from "./visual-style/fonts.mjs";
import { subtitleStyle } from "./subtitles.mjs";

test("font registry has unique stable IDs, bundled files/licenses, and copy-safe definitions", async () => {
  assert.equal(FONT_IDS.length, 8);
  assert.equal(new Set(FONT_IDS).size, 8);
  for (const font of listFonts()) {
    assert.equal(font.bundled, font.id !== "auto");
    for (const fallback of font.fallbackFamilies) assert.ok(FONT_IDS.includes(fallback));
    if (font.bundled) {
      const bytes = await readFile(new URL(`../public/${font.file}`, import.meta.url));
      assert.ok(bytes.length > 10000);
      assert.match(await readFile(new URL(`../public/${font.licenseFile}`, import.meta.url), "utf8"), /SIL OPEN FONT LICENSE/);
    }
    font.weights.push(1);
    assert.ok(!getFontDefinition(font.id).weights.includes(1));
  }
  const manifest = JSON.parse(await readFile(new URL("../public/font-sources.json", import.meta.url)));
  for (const font of manifest.fonts) {
    const bytes = await readFile(new URL(`../public/${font.file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
    assert.ok(font.source.includes(manifest.revision));
    assert.equal(font.license, "OFL-1.1");
  }
});

test("Auto preserves script selection; Latin display fonts keep JP/KR fallback offline", () => {
  assert.equal(detectScript("How to grow sweeter tomatoes"), "latin");
  assert.equal(detectScript("トマトを甘く育てる方法"), "japanese");
  assert.equal(detectScript("토마토를 맛있게 키우는 방법"), "korean");
  assert.deepEqual(fontFallbackStack("auto", "A"), ["Noto Sans", "Noto Sans JP", "Noto Sans KR", "sans-serif"]);
  assert.equal(fontFallbackStack("auto", "トマト")[0], "Noto Sans JP");
  assert.equal(fontFallbackStack("auto", "토마토")[0], "Noto Sans KR");
  for (const font of FONT_IDS) {
    const jp = fontFallbackStack(font, "トマト"), kr = fontFallbackStack(font, "토마토");
    assert.ok(jp.includes("Noto Sans JP")); assert.ok(kr.includes("Noto Sans KR"));
  }
  assert.equal(supportsScript("Inter", "japanese"), false);
  assert.equal(supportsScript("Noto Sans JP", "japanese"), true);
  assert.equal(fontFamilyForStyle("auto", "トマト", { browser: true }), "Studio Noto Sans JP, Studio Noto Sans, Studio Noto Sans KR, sans-serif");
  assert.equal(fontFamilyForStyle("auto", "A", { overrides: { latin: "Existing trusted override" } }), "Existing trusted override");
});

test("invalid font IDs fall back without exposing arbitrary CSS/paths; font faces use local assets only", () => {
  for (const value of ["../file", "url(https://example.com/font)", "__proto__", null, {}]) {
    assert.equal(normalizeFontId(value), "auto");
    assert.equal(subtitleStyle({ font: value }).font, "auto");
  }
  assert.doesNotMatch(fontFaceCss(), /https?:|file:/);
  for (const font of listFonts().filter((font) => font.bundled)) assert.ok(fontFaceCss().includes(`/${font.file}`));
});
