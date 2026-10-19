import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createYouTubeDownloader } from './youtube-downloader.mjs';
import { createSourceContextService, sourceContextFor, saveSourceContext } from './source-context.mjs';
const url = 'https://www.youtube.com/watch?v=BaW_jenozKc';
const source = { id: 'source-one', kind: 'youtube', title: 'Loading title', sourceUrl: url, duration: 120 };
const info = { id: 'BaW_jenozKc', title: 'How to plant', duration: 120, description: '0:00 Prepare\n1:00 Harvest',
  chapters: [{ start_time: 0, end_time: 60, title: 'Prepare' }, { start_time: 60, end_time: 120, title: 'Harvest' }],
  comments: [{ id: 'root-1', parent: 'root', text: '1:12 best harvest', author_id: 'viewer', like_count: 4 }] };
async function setup(t, override, timeouts) {
  const root = await mkdtemp(path.join(tmpdir(), 'context-unit-')); t.after(() => rm(root, { recursive: true, force: true }));
  const calls = [];
  const youtube = createYouTubeDownloader({ dataRoot: root, env: {}, adapters: { yt: async (op, parsed, dir, auth, signal) => {
    calls.push(op);
    if (override) return override(op, parsed, dir, signal);
    if (op === 'download') await writeFile(path.join(dir, 'source.mp4'), Buffer.alloc(2048));
    return { ...info, ...(op === 'comments' ? {} : { comments: undefined }) };
  } }, probeMedia: async () => ({ width: 1920, height: 1080, duration: 120, hasAudio: true }) });
  const options = { youtube, cacheRoot: path.join(root, 'cache'), timeouts };
  return { root, youtube, service: createSourceContextService(options), options, calls };
}
test('existing extraction supplies A; explicit context flow fetches B once, persists and rebinds aliases independently', async t => {
  const f = await setup(t);
  await f.youtube.download(url, async () => {});
  const imported = await f.service.ensure(source);
  assert.equal(imported.metadata.description, info.description); assert.equal(imported.chapters.length, 2);
  assert.deepEqual(f.calls, ['download']);
  const analyzed = await f.service.ensure({ ...source, sourceContext: imported }, { comments: true });
  assert.equal(analyzed.comments.status, 'available'); assert.equal(analyzed.comments.comments[0].isReply, false);
  assert.equal(analyzed.comments.clusters[0].centerMs, 72000);
  assert.deepEqual(f.calls, ['download', 'comments']);
  const restarted = createSourceContextService(f.options);
  const reused = await restarted.ensure({ ...source, id: 'new-source', sourceUrl: 'https://youtu.be/BaW_jenozKc' }, { comments: true });
  assert.equal(reused.source.id, 'new-source'); assert.deepEqual(f.calls, ['download', 'comments']);
  reused.metadata.title = 'changed'; assert.equal((await restarted.ensure(source)).metadata.title, info.title);
});
test('embedded comments need no second request; local source and malformed stored identity degrade safely', async t => {
  const f = await setup(t, async () => info);
  const context = await f.service.ensure(source, { comments: true });
  assert.equal(context.comments.status, 'available'); assert.deepEqual(f.calls, ['metadata']);
  const local = await f.service.ensure({ id: 'local', kind: 'upload', title: 'Local', duration: 25, sourceContext: { source: null } });
  assert.equal(local.source.kind, 'local'); assert.equal(local.comments.status, 'disabled'); assert.deepEqual(f.calls, ['metadata']);
});
test('separate video identities never reuse context; optional comment failures are cached, not source failures', async t => {
  const f = await setup(t, async (op, parsed) => {
    if (op === 'comments') throw new Error('PRIVATE provider payload');
    return { ...info, id: parsed.id, title: parsed.id, comments: undefined };
  });
  const a = await f.service.ensure(source, { comments: true });
  const b = await f.service.ensure({ ...source, id: 'other', sourceUrl: 'https://youtu.be/abcdefghijk' }, { comments: true });
  assert.notEqual(a.metadata.videoId, b.metadata.videoId); assert.equal(a.comments.status, 'unavailable');
  const count = f.calls.length; await f.service.ensure(source, { comments: true }); assert.equal(f.calls.length, count);
  assert.ok(!JSON.stringify(a).includes('PRIVATE'));
});
const untilAbort = signal => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); });
test('comments use a dedicated overall budget; timeout does not discard A or fail source loading', async t => {
  const f = await setup(t, async (op, parsed, dir, signal) => op === 'comments' ? untilAbort(signal) : { ...info, comments: undefined }, { comments: 15, metadata: 1000 });
  const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
  const context = await f.service.ensure(source, { comments: true });
  assert.equal(context.comments.reason, 'comment-timeout'); assert.equal(context.metadata.title, info.title);
});
test('one subscriber cancels independently; last subscriber cancellation reaches optional acquisition', async t => {
  let release, aborted = 0;
  const f = await setup(t, async (op, parsed, dir, signal) => {
    if (op === 'comments') { await new Promise((resolve, reject) => {
      let settled = false;
      release = () => { settled = true; resolve(); }; signal.addEventListener('abort', () => { if (!settled) { aborted++; reject(signal.reason); } }, { once: true });
    }); }
    return { ...info, id: parsed.id, comments: op === 'comments' ? info.comments : undefined };
  });
  const a = new AbortController(), b = new AbortController();
  const first = f.service.ensure(source, { comments: true, signal: a.signal });
  const second = f.service.ensure(source, { comments: true, signal: b.signal });
  while (!release) await new Promise(r => setTimeout(r, 1));
  a.abort(); await assert.rejects(first); assert.equal(aborted, 0);
  release(); assert.equal((await second).comments.status, 'available'); assert.equal(f.calls.filter(x => x === 'comments').length, 1);
  const c = new AbortController(); release = undefined;
  const pending = f.service.ensure({ ...source, sourceUrl: 'https://youtu.be/abcdefghijk' }, { comments: true, signal: c.signal });
  while (!release) await new Promise(r => setTimeout(r, 1));
  c.abort(); await assert.rejects(pending); await new Promise(r => setTimeout(r, 5)); assert.equal(aborted, 1);
});
test('source persistence changes context only; serialized source mismatch is discarded', async t => {
  const f = await setup(t); const file = path.join(f.root, 'source.json');
  const saved = { ...source, transcript: 'preserve', captions: [{ start: 1, end: 3, text: 'content' }], arbitraryExistingField: { locked: true } };
  await writeFile(file, JSON.stringify(saved)); const context = await f.service.ensure(source);
  await saveSourceContext(f.root, context);
  const reread = JSON.parse(await readFile(file, 'utf8')); const { sourceContext, ...unchanged } = reread;
  assert.deepEqual(unchanged, saved); assert.deepEqual(sourceContext, context);
  const stale = sourceContextFor({ ...source, sourceUrl: 'https://youtu.be/abcdefghijk', sourceContext: context });
  assert.notEqual(stale.metadata.videoId, context.metadata.videoId);
});

test('C reuses heatmap from existing metadata/transcript extraction and preserves it through disk cache reuse', async t => {
  const fixture = JSON.parse(await readFile(new URL('../lib/fixtures/youtube-source-context.json', import.meta.url), 'utf8'));
  const f = await setup(t, async () => fixture);
  await f.youtube.transcript(url);
  const result = await f.service.ensure(source, { comments: true });
  assert.equal(result.heatmap.status, 'available'); assert.equal(result.heatmap.bins[2].intensity, 1);
  assert.equal(result.comments.status, 'available'); assert.deepEqual(f.calls, ['transcript']);
  const restarted = createSourceContextService(f.options);
  assert.deepEqual((await restarted.ensure(source, { comments: true })).heatmap, result.heatmap);
  assert.deepEqual(f.calls, ['transcript']);
});
test('old A/B cache missing C enriches heatmap alone without discarding existing comments or changing identity', async t => {
  const { createHash } = await import('node:crypto');
  const { computeSourceCacheKey } = await import('../lib/source-context/index.mjs');
  const { mkdir } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(new URL('../lib/fixtures/youtube-source-context.json', import.meta.url), 'utf8'));
  const f = await setup(t, async () => ({ ...fixture, comments: undefined }));
  const old = sourceContextFor(source);
  old.metadata.description = 'Preserved A description';
  const { normalizeComments } = await import('../lib/source-context/index.mjs');
  old.comments = normalizeComments(info.comments, { durationMs: 120000 }); delete old.heatmap;
  old.provenance.fields = { contextMetadata: 'yt-dlp', contextComments: 'yt-dlp' };
  const key = computeSourceCacheKey(old); await mkdir(f.options.cacheRoot, { recursive: true });
  await writeFile(path.join(f.options.cacheRoot, createHash('sha256').update(key).digest('hex') + '.json'), JSON.stringify(old));
  const enriched = await f.service.ensure(source, { comments: true });
  assert.equal(enriched.heatmap.status, 'available'); assert.deepEqual(enriched.comments, old.comments);
  assert.equal(computeSourceCacheKey(enriched), key); assert.deepEqual(f.calls, ['metadata']);
  await f.service.ensure(source, { comments: true }); assert.deepEqual(f.calls, ['metadata']);
});
test('C absence is normal; unavailable extraction and timeout give explicit reasons with no fabricated bins', async t => {
  for (const mode of ['absent', 'failure', 'timeout']) {
    const f = await setup(t, async (op, parsed, dir, signal) => {
      if (mode === 'failure') throw new Error('PRIVATE failure');
      if (mode === 'timeout') return untilAbort(signal);
      return { ...info, comments: undefined };
    }, { metadata: 10 });
    const keepAlive = setTimeout(() => {}, 1000); t.after(() => clearTimeout(keepAlive));
    const context = await f.service.ensure(source);
    assert.equal(context.heatmap.status, 'unavailable'); assert.deepEqual(context.heatmap.bins, []);
    assert.equal(context.heatmap.reason, mode === 'absent' ? 'not-provided' : mode === 'failure' ? 'extraction-failed' : 'retrieval-timeout');
    const count = f.calls.length; await f.service.ensure(source); assert.equal(f.calls.length, count);
  }
});
test('concurrent metadata-only import and comment analysis serialize enrichment without losing either signal', async t => {
  const f = await setup(t);
  const [a, b] = await Promise.all([f.service.ensure(source), f.service.ensure(source, { comments: true })]);
  assert.ok(a.metadata.description); assert.equal(b.comments.status, 'available');
  assert.equal((await f.service.ensure(source, { comments: true })).comments.status, 'available');
  assert.deepEqual(f.calls, ['metadata', 'comments']);
});

test('extractor/probed duration mismatch cannot leak out-of-source replay intervals into source/cache', async t => {
  const f = await setup(t, async () => ({ ...info, duration: 120.2, heatmap: [{ start_time: 119, end_time: 120.2, value: 0.8 }] }));
  const context = await f.service.ensure(source);
  assert.deepEqual(context.heatmap.bins, [{ startMs: 119000, endMs: 120000, intensity: 0.8 }]);
  assert.equal(context.heatmap.provenance.fields.clipped, '1');
  assert.deepEqual((await f.service.ensure(source)).heatmap, context.heatmap);
});

test('partial fallback extraction preserves earlier richer A/C and reports the actual heatmap provider', async t => {
  let calls = 0;
  const f = await setup(t, async () => ++calls === 1 ? { ...info, comments: undefined, heatmap: [{ start_time: 10, end_time: 20, value: 0.4 }], tags: ['tutorial'] }
    : { title: info.title });
  await f.youtube.metadata(url);
  await f.youtube.transcript(url);
  const context = await f.service.ensure(source);
  assert.equal(context.metadata.description, info.description); assert.deepEqual(context.metadata.tags, ['tutorial']);
  assert.deepEqual(context.heatmap.bins, [{ startMs: 10000, endMs: 20000, intensity: 0.4 }]);
});

test('a later normal extraction enriches a cached failure without duplicate metadata/comment calls', async t => {
  let available = false;
  const f = await setup(t, async () => { if (!available) throw new Error('unavailable'); return { ...info, heatmap: [{ start_time: 50, end_time: 60, value: 1 }] }; });
  assert.equal((await f.service.ensure(source)).heatmap.reason, 'extraction-failed');
  available = true; await f.youtube.metadata(url);
  const count = f.calls.length, context = await f.service.ensure(source, { comments: true });
  assert.equal(context.metadata.description, info.description); assert.equal(context.heatmap.status, 'available');
  assert.equal(context.comments.status, 'available'); assert.equal(f.calls.length, count);
});

test('a partial fresh extraction cannot erase a valid cached heatmap or tags after service restart', async t => {
  const f = await setup(t, async () => ({ ...info, heatmap: [{ start_time: 50, end_time: 60, value: 0.8 }], tags: ['tutorial'] }));
  const original = await f.service.ensure(source);
  const partial = await setup(t, async () => ({ title: info.title, duration: 120 }));
  await partial.youtube.metadata(url);
  const restarted = createSourceContextService({ ...f.options, youtube: partial.youtube });
  const reused = await restarted.ensure(source);
  assert.deepEqual(reused.heatmap, original.heatmap); assert.deepEqual(reused.metadata.tags, ['tutorial']);
  assert.deepEqual(partial.calls, ['metadata']);
});

test('legacy rounded-duration cache keys still enforce the exact current media duration on disk-only reuse', async t => {
  const f = await setup(t, async () => ({ ...info, duration: 120.2, heatmap: [{ start_time: 119, end_time: 120.2, value: 0.8 }] }));
  const first = await f.service.ensure({ ...source, duration: 120.2 });
  const { computeSourceCacheKey } = await import('../lib/source-context/index.mjs');
  const short = { ...source, id: 'shorter', duration: 119.8 };
  assert.equal(computeSourceCacheKey(first), computeSourceCacheKey(sourceContextFor(short)));
  const offline = createSourceContextService({ ...f.options, youtube: { peekContext: () => undefined, context: () => assert.fail('No new metadata extraction') } });
  const result = await offline.ensure(short);
  assert.deepEqual(result.heatmap.bins, [{ startMs: 119000, endMs: 119800, intensity: 0.8 }]);
  assert.equal(result.source.id, 'shorter'); assert.deepEqual(f.calls, ['metadata']);
  assert.deepEqual(sourceContextFor({ ...short, sourceContext: first }).heatmap.bins, result.heatmap.bins);
});
