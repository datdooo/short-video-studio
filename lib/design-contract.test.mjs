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

// design-system/shortcut-studio/MASTER.md is the contract; these checks guard its mechanical rules.
test("master contract exists and names the state language", async () => {
  const master = await read("design-system/shortcut-studio/MASTER.md");
  for (const word of ["Selected", "Disabled", "Destructive", "Focus", "Sentence case"]) {
    assert.ok(master.includes(word), `MASTER.md must define ${word}`);
  }
});

test("contract block in globals.css defines every state once, last", async () => {
  const css = await read("app/globals.css");
  const at = css.indexOf("Design contract v2");
  assert.ok(at > 0, "contract block missing");
  const block = css.slice(at);
  assert.match(block, /--status-radius:\s*6px/);
  assert.match(block, /--selected-border:/);
  assert.match(block, /:is\(button, \[data-slot="button"\], \.studio-primary\):is\(:disabled/);
  assert.match(block, /text-transform:\s*none\s*!important/);
  assert.match(block, /prefers-reduced-motion/);
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
