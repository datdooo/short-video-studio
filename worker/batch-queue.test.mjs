import test from "node:test";
import assert from "node:assert/strict";
import { createBatchSubmissionQueue } from "./batch-queue.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(prepare) {
  const batches = new Map();
  const controllers = new Map();
  let nextId = 0;
  let writes = 0;
  const queue = createBatchSubmissionQueue({ batches, controllers, prepare, createId: () => `id-${++nextId}`, onChange: () => { writes++; } });
  return { queue, batches, controllers, writes: () => writes };
}
function submission(urls, batchId, promptTemplate = "original rules") {
  return { urls, batchId, promptTemplate, schema: { version: promptTemplate } };
}

test("appending returns immediately during preparation, preserves FIFO and per-submission rules, never prepares an item twice", async () => {
  const started = deferred();
  const release = deferred();
  const calls = [];
  const state = setup(async (batch, body, items) => {
    calls.push({ urls: items.map((item) => item.url), prompt: body.promptTemplate });
    if (calls.length === 1) { started.resolve(); await release.promise; }
    for (const item of items) { item.jobId = `job-${item.id}`; item.state = "queued"; }
  });
  const batch = state.queue.submit(submission(["A", "B"]));
  await started.promise;
  const firstItem = batch.items[0];
  firstItem.title = "Already prepared title";
  const appended = state.queue.submit(submission(["C", "D"], batch.id, "new rules"));
  const again = state.queue.submit(submission(["E"], batch.id, "third rules"));
  assert.strictEqual(appended, batch);
  assert.strictEqual(again, batch);
  assert.strictEqual(batch.items[0], firstItem);
  assert.equal(batch.items[0].title, "Already prepared title");
  assert.deepEqual(batch.items.map((item) => item.url), ["A", "B", "C", "D", "E"]);
  assert.equal(new Set(batch.items.map((item) => item.id)).size, 5);
  assert.equal(calls.length, 1, "Appending must not start duplicate preparation concurrently");
  assert.equal(state.batches.size, 1);
  assert.ok(state.writes() >= 3, "Every append must be persisted without waiting for preparation");
  release.resolve();
  await state.queue.idle();
  assert.deepEqual(calls, [
    { urls: ["A", "B"], prompt: "original rules" },
    { urls: ["C", "D"], prompt: "new rules" },
    { urls: ["E"], prompt: "third rules" },
  ]);
});

test("new submissions prepare while original jobs are still queued/rendering; existing outputs remain intact", async () => {
  const calls = [];
  const { queue } = setup(async (_batch, _body, items) => {
    calls.push(...items.map((item) => item.url));
    for (const item of items) item.jobId = `job-${item.id}`;
  });
  const batch = queue.submit(submission(["A"]));
  await queue.idle();
  batch.items[0].state = "rendering";
  batch.items[0].outputs = [{ url: "old-part-1.mp4" }];
  const snapshot = structuredClone(batch.items[0]);
  queue.submit(submission(["B"], batch.id));
  await queue.idle();
  assert.deepEqual(calls, ["A", "B"]);
  assert.deepEqual(batch.items[0], snapshot);
});

test("cancel aborts the original and all appended work; a stopped or missing batch rejects appends, a new run works", async () => {
  const started = deferred();
  const release = deferred();
  const processed = [];
  const state = setup(async (batch, _body, items) => {
    if (items[0].url === "A") { started.resolve(); await release.promise; }
    const signal = state.controllers.get(batch.id).signal;
    for (const item of items) {
      if (signal.aborted) { item.state = "cancelled"; continue; }
      processed.push(item.url); item.state = "queued";
    }
  });
  const batch = state.queue.submit(submission(["A"]));
  await started.promise;
  state.queue.submit(submission(["B"], batch.id));
  state.controllers.get(batch.id).abort();
  assert.throws(() => state.queue.submit(submission(["C"], batch.id)), { status: 409 });
  assert.throws(() => state.queue.submit(submission(["C"], "missing")), { status: 404 });
  assert.equal(batch.items.length, 2, "Rejected appends must not insert any item");
  release.resolve();
  await state.queue.idle();
  assert.deepEqual(processed, []);
  assert.ok(batch.items.every((item) => item.state === "cancelled"));
  const fresh = state.queue.submit(submission(["D"]));
  await state.queue.idle();
  assert.notEqual(fresh.id, batch.id);
  assert.deepEqual(processed, ["D"]);
});

test("preparation errors do not poison subsequent submissions or change accepted jobs", async () => {
  const { queue } = setup(async (_batch, _body, items) => {
    if (items[0].url === "A") {
      items[0].jobId = "accepted-job";
      throw new Error("failed before next item");
    }
    for (const item of items) item.state = "queued";
  });
  const batch = queue.submit(submission(["A", "B"]));
  queue.submit(submission(["C"], batch.id));
  await queue.idle();
  assert.equal(batch.items[0].jobId, "accepted-job");
  assert.equal(batch.items[1].state, "error");
  assert.equal(batch.items[1].error, "failed before next item");
  assert.equal(batch.items[2].state, "queued");
});

test("multiple accepted 20-link submissions extend one queue beyond 20 items", async () => {
  const urls = Array.from({ length: 40 }, (_, index) => `https://youtu.be/${index}`);
  const processed = [];
  const { queue } = setup(async (_batch, _body, items) => { processed.push(...items.map((item) => item.url)); });
  const batch = queue.submit(submission(urls.slice(0, 20)));
  queue.submit(submission(urls.slice(20), batch.id));
  await queue.idle();
  assert.equal(batch.items.length, 40);
  assert.deepEqual(processed, urls);
});

test("queued batch submissions own normalized style snapshots independent of caller and other submissions", async () => {
  const started = deferred(); const release = deferred(); const prepared = [];
  const { queue } = setup(async (_batch, body) => {
    if (!prepared.length) { prepared.push(body); started.resolve(); await release.promise; }
    else prepared.push(body);
  });
  const body = { ...submission(["A"]), visualStyle: { version: 1 }, subtitles: { enabled: true, color: "#ffffff", size: 48 } };
  queue.submit(body);
  await started.promise;
  const next = { ...body, urls: ["B"] };
  queue.submit(next);
  body.subtitles.color = "#ff0000";
  body.visualStyle.version = 2;
  next.urls.push("C");
  prepared[0].visualStyle.subtitle.color = "#00ff00";
  release.resolve(); await queue.idle();
  assert.equal(prepared[1].visualStyle.version, 1);
  assert.equal(prepared[1].visualStyle.subtitle.color, "#ffffff");
  assert.equal(prepared[1].subtitles.color, "#ffffff");
  assert.deepEqual(prepared[1].urls, ["B"]);
});

test("invalid/future style is rejected before creating batch state or scheduling work", async () => {
  const { queue, batches } = setup(() => assert.fail("must not prepare"));
  assert.throws(() => queue.submit({ ...submission(["A"]), visualStyle: { version: 2 } }), /version/);
  assert.throws(() => queue.submit({ ...submission(["A"]), visualStyle: { overlays: [{ id: "x", assetId: "x" }] } }), /not enabled/);
  await queue.idle();
  assert.equal(batches.size, 0);
});

test("different appended text presets retain independent font/color snapshots", async () => {
  const { applyTextPreset, applyFontOverride } = await import("../lib/visual-style/text-presets.mjs");
  const styles = [];
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); });
  const yellow = applyFontOverride(applyTextPreset(undefined, "yellow-hook"), "Inter");
  const batch = queue.submit({ ...submission(["A"]), visualStyle: yellow });
  yellow.originalTitle.color = "#ff0000";
  queue.submit({ ...submission(["B"], batch.id), visualStyle: applyTextPreset(undefined, "kr-clean") });
  await queue.idle();
  assert.equal(styles[0].textPresetId, "yellow-hook");
  assert.equal(styles[0].originalTitle.font, "Inter");
  assert.equal(styles[0].originalTitle.color, "#ffe24a");
  assert.equal(styles[1].textPresetId, "kr-clean");
  styles[1].subtitle.color = "#123456";
  assert.equal(styles[0].subtitle.color, "#ffe24a");
});

test("appended filters and strengths retain independent batch snapshots and text styling", async () => {
  const { applyFilterPreset, applyFilterIntensity } = await import("../lib/visual-style/filter-presets.mjs");
  const { applyTextPreset } = await import("../lib/visual-style/text-presets.mjs");
  const styles = [], started = deferred(), release = deferred();
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const vivid = applyFilterIntensity(applyFilterPreset(applyTextPreset(undefined, "yellow-hook"), "vivid"), 0.5);
  const batch = queue.submit({ ...submission(["A"]), visualStyle: vivid });
  await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: applyFilterPreset(vivid, "nature") });
  vivid.filter.intensity = 0; vivid.originalTitle.font = "Inter";
  release.resolve(); await queue.idle();
  assert.equal(styles[0].filter.presetId, "vivid"); assert.equal(styles[0].filter.intensity, 0.5);
  assert.equal(styles[1].filter.presetId, "nature"); assert.equal(styles[1].filter.intensity, 1);
  assert.equal(styles[0].originalTitle.font, "Oswald"); assert.equal(styles[1].textPresetId, "yellow-hook");
  styles[0].filter.brightness = -0.08;
  assert.equal(styles[1].filter.brightness, 0.01);
});

test("appended backgrounds retain independent batch snapshots with text and filter", async () => {
  const { applyBackgroundPreset } = await import("../lib/visual-style/background-presets.mjs");
  const { applyFilterPreset } = await import("../lib/visual-style/filter-presets.mjs");
  const { applyTextPreset } = await import("../lib/visual-style/text-presets.mjs");
  const styles = [], started = deferred(), release = deferred();
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const style = applyBackgroundPreset(applyFilterPreset(applyTextPreset(undefined, "news"), "contrast"), "soft-gradient");
  const batch = queue.submit({ ...submission(["A"]), visualStyle: style });
  await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: applyBackgroundPreset(style, "black") });
  style.background.gradient.stops[0].color = "#ffffff";
  release.resolve(); await queue.idle();
  assert.equal(styles[0].background.gradient.stops[0].color, "#30343b");
  assert.equal(styles[1].background.presetId, "black");
  for (const saved of styles) { assert.equal(saved.textPresetId, "news"); assert.equal(saved.filter.presetId, "contrast"); }
});

test("queued and appended overlay selections remain independent after caller mutation", async () => {
  const { applyOverlayPreset } = await import("../lib/visual-style/overlay-presets.mjs");
  const { applyBackgroundPreset } = await import("../lib/visual-style/background-presets.mjs");
  const { applyFilterPreset } = await import("../lib/visual-style/filter-presets.mjs");
  const { applyTextPreset } = await import("../lib/visual-style/text-presets.mjs");
  const styles = [], started = deferred(), release = deferred();
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const style = applyOverlayPreset(applyBackgroundPreset(applyFilterPreset(applyTextPreset(undefined, "yellow-hook"), "vivid"), "dark-blur"), "grain");
  const batch = queue.submit({ ...submission(["A"]), visualStyle: style });
  await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: applyOverlayPreset(style, "vignette") });
  style.overlays[0].opacity = 0; release.resolve(); await queue.idle();
  assert.equal(styles[0].overlays[0].presetId, "grain"); assert.equal(styles[0].overlays[0].opacity, 0.22);
  assert.equal(styles[1].overlays[0].presetId, "vignette");
  for (const saved of styles) { assert.equal(saved.textPresetId, "yellow-hook"); assert.equal(saved.filter.presetId, "vivid"); assert.equal(saved.background.presetId, "dark-blur"); }
});

test("template-derived batch submissions own effective styles rather than template references", async () => {
  const { applyVisualTemplate, matchVisualTemplate } = await import("../lib/visual-style/templates.mjs");
  const styles = [], started = deferred(), release = deferred();
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const first = applyVisualTemplate(undefined, "viral-shorts"), second = applyVisualTemplate(first, "farming-jp");
  const batch = queue.submit({ ...submission(["A"]), visualStyle: first }); await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: second });
  first.filter.intensity = 0; second.overlays.length = 0;
  release.resolve(); await queue.idle();
  assert.equal(matchVisualTemplate(styles[0]), "viral-shorts"); assert.equal(matchVisualTemplate(styles[1]), "farming-jp");
});

test("queued and appended animations freeze independently, including legacy none", async () => {
  const styles = [], started = deferred(), release = deferred();
  const { queue, batches } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const first = { titleAnimation: "fade-in" }, second = { titleAnimation: "pop-in" };
  const batch = queue.submit({ ...submission(["A"]), visualStyle: first }); await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: second });
  queue.submit({ ...submission(["C"], batch.id) });
  first.titleAnimation = "slide-up"; second.titleAnimation = "none";
  assert.throws(() => queue.submit({ ...submission(["bad"]), visualStyle: { titleAnimation: "bad" } }), /animation/);
  assert.equal(batches.size, 1);
  release.resolve(); await queue.idle();
  assert.deepEqual(styles.map((s) => s.titleAnimation || "none"), ["fade-in", "pop-in", "none"]);
});

test("cut transitions snapshot independently in queued/appended batches, preserving template and title motion", async () => {
  const styles = [], started = deferred(), release = deferred();
  const { queue } = setup(async (_batch, body) => { styles.push(body.visualStyle); if (styles.length === 1) { started.resolve(); await release.promise; } });
  const first = { cutTransition: "dip-black", titleAnimation: "slide-up" }, second = { cutTransition: "flash-white", titleAnimation: "pop-in" };
  const batch = queue.submit({ ...submission(["A"]), visualStyle: first }); await started.promise;
  queue.submit({ ...submission(["B"], batch.id), visualStyle: second }); queue.submit(submission(["C"], batch.id));
  first.cutTransition = "none"; second.cutTransition = "none"; release.resolve(); await queue.idle();
  assert.deepEqual(styles.map((s) => s.cutTransition || "none"), ["dip-black", "flash-white", "none"]);
  assert.deepEqual(styles.slice(0, 2).map((s) => s.titleAnimation), ["slide-up", "pop-in"]);
});
