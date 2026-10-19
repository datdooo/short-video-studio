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
