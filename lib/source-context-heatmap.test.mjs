import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeHeatmap, validateHeatmap, heatmapUnavailable, MAX_HEATMAP_BINS, MAX_HEATMAP_SCAN,
  normalizeSourceContext, computeSourceCacheKey, SOURCE_CONTEXT_VERSION } from './source-context/index.mjs';
const info = JSON.parse(await readFile(new URL('./fixtures/youtube-source-context.json', import.meta.url), 'utf8'));
const options = { durationMs: 120000, extractedAt: 'fixture' };
test('realistic yt-dlp info populates A/B/C, typed heatmap round-trips as independent data at version 1', () => {
  const context = normalizeSourceContext({ info });
  assert.equal(context.metadata.title, info.title); assert.equal(context.chapters.length, 2);
  assert.equal(context.comments.comments.length, 2); assert.equal(context.comments.comments[0].isReply, false);
  assert.deepEqual(context.heatmap.bins, info.heatmap.map(b => ({ startMs: b.start_time * 1000, endMs: b.end_time * 1000, intensity: b.value })));
  const again = normalizeSourceContext(JSON.parse(JSON.stringify(context)));
  assert.deepEqual(again, context); assert.notEqual(again.heatmap.bins, context.heatmap.bins);
  assert.equal(SOURCE_CONTEXT_VERSION, 1); assert.equal(computeSourceCacheKey(context), 'youtube:BaW_jenozKc:dur120:rev1');
  assert.equal(computeSourceCacheKey({ ...context, visualStyle: { font: 'other' } }), computeSourceCacheKey(context));
});
test('relative intensity stays unscaled, including a legitimate zero; seconds become source milliseconds', () => {
  const heatmap = normalizeHeatmap([{ start_time: 1.125, end_time: 2.25, value: 0 }, { start_time: 2.25, end_time: 3, value: 0.42 }], options);
  assert.deepEqual(heatmap.bins, [{ startMs: 1125, endMs: 2250, intensity: 0 }, { startMs: 2250, endMs: 3000, intensity: 0.42 }]);
  assert.equal(heatmap.timeline, 'source'); assert.equal(heatmap.timeUnit, 'ms'); assert.equal(heatmap.intensitySemantics, 'relative-replay-interest');
});
test('unordered duplicates keep strongest value; overlaps are dropped deterministically and tail clipped to duration', () => {
  const raw = [{ start_time: 110, end_time: 130, value: 0.7 }, { start_time: 0, end_time: 10, value: 0.2 },
    { start_time: 0, end_time: 10, value: 0.6 }, { start_time: 5, end_time: 15, value: 1 }, { start_time: 10, end_time: 20, value: 0.3 }];
  const before = structuredClone(raw), heatmap = normalizeHeatmap(raw, options);
  assert.deepEqual(heatmap, normalizeHeatmap([...raw].reverse(), options)); assert.deepEqual(raw, before);
  assert.deepEqual(heatmap.bins, [{ startMs: 0, endMs: 10000, intensity: 0.6 }, { startMs: 10000, endMs: 20000, intensity: 0.3 }, { startMs: 110000, endMs: 120000, intensity: 0.7 }]);
  assert.equal(heatmap.provenance.fields.duplicates, '1'); assert.equal(heatmap.provenance.fields.overlaps, '1'); assert.equal(heatmap.provenance.fields.clipped, '1');
});
test('malformed entries, non-finite values, numeric strings, empty/reversed and out-of-duration intervals cannot fabricate evidence', () => {
  const invalid = [null, {}, { start_time: '0', end_time: 3, value: 0.5 },
    ...[NaN, Infinity, -1, 2].map(value => ({ start_time: 0, end_time: 2, value })),
    ...[-1, Infinity, 120, 200].map(start_time => ({ start_time, end_time: 130, value: 0.5 })),
    { start_time: 5, end_time: 5, value: 0.5 }, { start_time: 6, end_time: 5, value: 0.5 }];
  assert.equal(normalizeHeatmap(invalid, options).reason, 'malformed');
  assert.equal(normalizeHeatmap([...invalid, info.heatmap[0]], options).bins.length, 1);
  for (const [raw, reason] of [[undefined, 'not-provided'], [null, 'not-provided'], [[], 'empty'], [{}, 'malformed']]) assert.equal(normalizeHeatmap(raw, options).reason, reason);
  for (const durationMs of [undefined, 0, -1, NaN, Infinity]) assert.equal(normalizeHeatmap(info.heatmap, { durationMs }).reason, 'unknown-duration');
});
test('normalization scan and result are bounded; no interpolation fills gaps', () => {
  const raw = Array.from({ length: MAX_HEATMAP_SCAN + 1 }, (_, i) => ({ start_time: i * 2, end_time: i * 2 + 1, value: 0.2 }));
  const heatmap = normalizeHeatmap(raw, { durationMs: 10000000 });
  assert.equal(heatmap.bins.length, MAX_HEATMAP_BINS); assert.equal(heatmap.bins[1].startMs, 2000);
  assert.equal(heatmap.provenance.fields.bounded, 'true');
});
test('serialized boundary rejects malformed units, bins, bounds, status, order and provenance; strips unknown extras', () => {
  const valid = normalizeHeatmap(info.heatmap, options);
  for (const mutate of [v => { v.timeUnit = 'seconds'; }, v => { v.bins[0].intensity = Infinity; }, v => { v.bins[0].endMs = 130000; },
    v => { v.bins.reverse(); }, v => { v.bins[0].startMs = -1; }, v => { v.status = 'unavailable'; }, v => { v.provenance.fields = { unsafe: {} }; },
    v => { v.bins = new Array(2001).fill(v.bins[0]); }]) {
    const changed = structuredClone(valid); mutate(changed);
    assert.equal(validateHeatmap(changed, options).reason, 'invalid-serialized');
  }
  assert.deepEqual(validateHeatmap({ ...valid, arbitrary: 'ignored' }, options), valid);
  assert.deepEqual(validateHeatmap(heatmapUnavailable('not-provided'), options).bins, []);
});
test('older v1 cached context missing heatmap stays missing; malformed opaque old data becomes unavailable without losing A/B', () => {
  const before = normalizeSourceContext({ info }); const old = structuredClone(before); delete old.heatmap;
  const legacy = normalizeSourceContext(old); assert.equal(legacy.heatmap, undefined);
  const malformed = normalizeSourceContext({ ...old, heatmap: { windows: [{ score: 0.9 }] } });
  assert.equal(malformed.heatmap.reason, 'invalid-serialized'); assert.deepEqual(malformed.metadata, old.metadata); assert.deepEqual(malformed.comments, old.comments);
  assert.equal(computeSourceCacheKey(malformed), computeSourceCacheKey(before));
});
test('local sources stay disabled without fabricated replay interest; invalid raw metadata is safe', () => {
  const local = normalizeSourceContext({ kind: 'local', title: 'Local', duration: 120, heatmap: normalizeHeatmap(info.heatmap, options) });
  assert.equal(local.heatmap.status, 'disabled'); assert.equal(local.heatmap.reason, 'unsupported-source');
  assert.equal(normalizeSourceContext({ info: 42 }).heatmap.status, 'unavailable');
});

test('serialized comment signals remain typed and bounded, never bypassing <=200 through a cached context', () => {
  const context = normalizeSourceContext({ info });
  for (const mutate of [c => { c.comments.comments = new Array(201).fill(c.comments.comments[0]); },
    c => { c.comments.comments[0].engagementWeight = 2; }, c => { c.comments.clusters[0].centerMs = Infinity; },
    c => { c.comments.comments[0].timestampMentions[0].timestampMs = 121000; }]) {
    const changed = structuredClone(context); mutate(changed);
    const result = normalizeSourceContext(changed);
    assert.equal(result.comments.status, 'unavailable'); assert.deepEqual(result.comments.comments, []);
    assert.deepEqual(result.heatmap, context.heatmap);
  }
});

test('malformed A chapter times and provenance cannot break serialized context consumers', () => {
  const context = normalizeSourceContext({ info: { ...info, chapters: [{ start_time: Infinity, end_time: Infinity }, ...info.chapters] } });
  assert.equal(context.chapters.length, 2);
  const again = normalizeSourceContext({ ...context, provenance: { fields: null }, chapters: [null, { startMs: NaN }, ...context.chapters] });
  assert.deepEqual(again.chapters, context.chapters); assert.deepEqual(again.provenance.fields, {});
  assert.deepEqual(again.heatmap, context.heatmap);
});

test('valid serialized contexts using durationMs retain replay data without requiring duplicate durationSeconds', () => {
  const context = normalizeSourceContext({ info }); const expected = structuredClone(context.heatmap);
  delete context.source.durationSeconds; delete context.metadata.durationSeconds;
  assert.deepEqual(normalizeSourceContext(context).heatmap, expected);
});
