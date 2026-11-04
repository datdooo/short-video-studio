import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const bundle = await build({
  entryPoints: ["lib/editor-session.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { preparePreservedEditorSessionDeletion, preparePreservedEditorSessionsClear } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const archiveKey = "shortcut-beta-editor-preserved-sessions-v1",
  activeKey = "shortcut-beta-editor-session-v1";
function fixture(run) {
  const before = globalThis.localStorage,
    map = new Map([
      [activeKey, "ACTIVE RAW MUST STAY"],
      [
        archiveKey,
        JSON.stringify({
          version: 1,
          entries: ["a", "b"].map((key) => ({ key, label: key, savedAt: "fixed", raw: "opaque " + key, opaque: true })),
        }),
      ],
    ]);
  globalThis.localStorage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  try {
    run(map);
  } finally {
    globalThis.localStorage = before;
  }
}
test("delete one preserved copy including opaque draft, without touching active raw or other copies", () =>
  fixture((map) => {
    const remove = preparePreservedEditorSessionDeletion("a");
    assert.equal(JSON.parse(map.get(archiveKey)).entries.length, 2, "preparation is read-only");
    assert.equal(remove(), "");
    assert.deepEqual(
      JSON.parse(map.get(archiveKey)).entries.map((e) => e.key),
      ["b"],
    );
    assert.equal(map.get(activeKey), "ACTIVE RAW MUST STAY");
  }));
test("newer saved copy, unreadable archive and write failure are preserved rather than silently deleted", () =>
  fixture((map) => {
    let remove = preparePreservedEditorSessionDeletion("a");
    const newer = JSON.parse(map.get(archiveKey));
    newer.entries[0].raw = "newer";
    map.set(archiveKey, JSON.stringify(newer));
    const preserved = map.get(archiveKey);
    assert.match(remove(), /thay đổi/);
    assert.equal(map.get(archiveKey), preserved);
    remove = preparePreservedEditorSessionDeletion("a");
    globalThis.localStorage.setItem = () => {
      throw Error("quota");
    };
    assert.match(remove(), /Không xóa/);
    assert.equal(map.get(archiveKey), preserved);
    map.set(archiveKey, "unreadable");
    assert.throws(() => preparePreservedEditorSessionDeletion("a"));
    assert.equal(map.get(archiveKey), "unreadable");
    assert.equal(map.get(activeKey), "ACTIVE RAW MUST STAY");
  }));
test("clear all removes every preserved copy (opaque ones too) and never touches the active raw session", () =>
  fixture((map) => {
    const { count, clear } = preparePreservedEditorSessionsClear();
    assert.equal(count, 2);
    assert.equal(JSON.parse(map.get(archiveKey)).entries.length, 2, "preparation is read-only");
    assert.equal(clear(), "");
    assert.deepEqual(JSON.parse(map.get(archiveKey)), { version: 1, entries: [] });
    assert.equal(map.get(activeKey), "ACTIVE RAW MUST STAY");
    assert.equal(preparePreservedEditorSessionsClear().count, 0);
  }));
test("clear all refuses when a copy was added or changed while the confirmation was open", () =>
  fixture((map) => {
    let { clear } = preparePreservedEditorSessionsClear();
    const added = JSON.parse(map.get(archiveKey));
    added.entries.push({ key: "c", label: "c", savedAt: "fixed", raw: "new copy", opaque: false });
    map.set(archiveKey, JSON.stringify(added));
    const preserved = map.get(archiveKey);
    assert.match(clear(), /thay đổi/);
    assert.equal(map.get(archiveKey), preserved);
    ({ clear } = preparePreservedEditorSessionsClear());
    const edited = JSON.parse(map.get(archiveKey));
    edited.entries[0].raw = "edited";
    map.set(archiveKey, JSON.stringify(edited));
    const afterEdit = map.get(archiveKey);
    assert.match(clear(), /thay đổi/);
    assert.equal(map.get(archiveKey), afterEdit);
  }));
test("clear all keeps data on write failure and on an unreadable archive", () =>
  fixture((map) => {
    const { clear } = preparePreservedEditorSessionsClear();
    const preserved = map.get(archiveKey);
    globalThis.localStorage.setItem = () => {
      throw Error("quota");
    };
    assert.match(clear(), /Không xóa/);
    assert.equal(map.get(archiveKey), preserved);
    map.set(archiveKey, "unreadable");
    assert.throws(() => preparePreservedEditorSessionsClear());
    assert.equal(map.get(archiveKey), "unreadable");
    assert.equal(map.get(activeKey), "ACTIVE RAW MUST STAY");
  }));
