import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");
async function tsx(folder) {
  const entries = await readdir(new URL(folder, root), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? tsx(`${folder}/${entry.name}`)
        : entry.name.endsWith(".tsx")
          ? [`${folder}/${entry.name}`]
          : [],
    ),
  );
  return nested.flat();
}
const kitFiles = (await readdir(new URL("app/ui/", root))).filter((name) => name.endsWith(".css")).sort();

// design-system/shortcut-studio/MASTER.md is the contract; these checks guard its mechanical rules.
test("master contract exists and names the state language", async () => {
  const master = await read("design-system/shortcut-studio/MASTER.md");
  for (const word of ["Selected", "Disabled", "Destructive", "Focus", "Sentence case", "kit-state"]) {
    assert.ok(master.includes(word), `MASTER.md must define ${word}`);
  }
});

test("globals.css only imports the kit, in layer order, after Tailwind", async () => {
  const css = await read("app/globals.css");
  assert.ok(css.split("\n").length < 40, "globals.css must stay a thin entry point");
  const imports = [...css.matchAll(/@import "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.slice(0, 4), [
    "tailwindcss",
    "tw-animate-css",
    "../vendor/shadcn-tailwind-4.13.0.css",
    "./ui/layers.css",
  ]);
  for (const name of kitFiles) assert.ok(imports.includes(`./ui/${name}`), `${name} is imported`);
  assert.match(await read("app/ui/layers.css"), /@layer kit-base, kit-controls, kit-layout, kit-state;/);
  assert.ok(
    imports.indexOf("./ui/state.css") > imports.indexOf("./ui/workspaces.css"),
    "state.css loads after layout files",
  );
});

test("hover, disabled, focus and active states live only in state.css", async () => {
  const offenders = [];
  for (const name of kitFiles.filter((file) => !["state.css", "media.css"].includes(file))) {
    const css = (await read(`app/ui/${name}`)).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(/:(hover|disabled|focus-visible|focus-within|active|read-only)\b/g)) {
      offenders.push(`${name}: :${match[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the kit never needs !important except the reduced-motion reset", async () => {
  const offenders = [];
  for (const name of kitFiles) {
    const css = (await read(`app/ui/${name}`)).replace(/\/\*[\s\S]*?\*\//g, "");
    const count = (css.match(/!important/g) ?? []).length;
    if (count && name !== "base.css") offenders.push(`${name}: ${count}`);
  }
  assert.deepEqual(offenders, []);
});

test("only tokens.css declares raw colours", async () => {
  const offenders = [];
  for (const name of kitFiles.filter((file) => !["tokens.css", "media.css"].includes(file))) {
    const css = (await read(`app/ui/${name}`)).replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutDataUri = css.replace(/url\("data:[^"]*"\)/g, "");
    for (const match of withoutDataUri.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)) offenders.push(`${name}: ${match[0]}`);
  }
  // Overlays on media keep a literal black scrim.
  assert.deepEqual(
    offenders.filter((item) => !item.endsWith("rgb(")),
    [],
  );
});

// Round shapes are allowed only for a status dot and the play button drawn over media.
const roundAllowed = new Set(["components/editor/source-view.tsx", "components/editor/preview-view.tsx"]);
test("no component uses uppercase text or pill shapes", async () => {
  const offenders = [];
  for (const file of await tsx("components")) {
    const source = await read(file);
    if (/\buppercase\b/.test(source)) offenders.push(`${file}: uppercase`);
    if (/\brounded-full\b/.test(source) && !roundAllowed.has(file)) offenders.push(`${file}: rounded-full`);
  }
  assert.deepEqual(offenders, []);
});
