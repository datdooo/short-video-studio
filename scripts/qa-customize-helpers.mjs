// Open the real disclosures before exercising the existing selector assertions.
export async function expandCustomize(page) {
  const customize = page.locator("[data-visual-customize]");
  if (!await customize.evaluate((element) => element.open)) await customize.locator(":scope > summary").click();
  for (const row of await customize.locator("[data-customize-row]").all()) {
    if (!await row.evaluate((element) => element.open)) await row.locator(":scope > summary").click();
  }
}
