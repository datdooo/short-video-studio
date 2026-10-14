import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createSpeechService } from './speech.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'shortcut-caption-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = { id: 'own-source', duration: 10, hasAudio: true };
  await mkdir(path.join(root, source.id));
  const speech = createSpeechService({ dataRoot: root, sourcesRoot: root, run: async () => assert.fail('No ASR required for this fixture') });
  return { root, source, speech };
}
test('YouTube captions return correct source/timebase with EOF clipped; repeated retrieval is stable', async (t) => {
  const { speech, source } = await fixture(t);
  source.captions = [{ start: 8, end: 10.183, text: 'End' }];
  const track = await speech.captions(source);
  assert.equal(track.sourceId, source.id); assert.equal(track.sourceDuration, 10); assert.equal(track.timeline, 'source'); assert.equal(track.cues[0].end, 10);
  assert.deepEqual(await speech.captions(source), track); assert.equal(source.captions[0].end, 10.183);
});
test('legacy Whisper cache is normalized at read time, not confused with a Part timeline', async (t) => {
  const { root, source, speech } = await fixture(t);
  await writeFile(path.join(root, source.id, 'speech-captions.json'), JSON.stringify({ cues: [{ start: 8, end: 10.2, text: 'Cached end' }], origin: 'whisper-local' }));
  const track = await speech.captions(source);
  assert.equal(track.sourceId, source.id); assert.equal(track.cues[0].end, 10);
  source.duration = 7;
  await assert.rejects(speech.captions(source), /vượt quá source/);
});
test('foreign-source or mismatched-duration cached captions remain rejected', async (t) => {
  const { root, source, speech } = await fixture(t);
  const file = path.join(root, source.id, 'speech-captions.json');
  await writeFile(file, JSON.stringify({ sourceId: 'other-source', cues: [], origin: 'whisper-local' }));
  await assert.rejects(speech.captions(source), /source khác/);
  await writeFile(file, JSON.stringify({ sourceId: source.id, sourceDuration: 12, cues: [], origin: 'whisper-local' }));
  await assert.rejects(speech.captions(source), /Thời lượng source/);
});

test('explicit YouTube never silently runs Whisper; explicit Whisper ignores YouTube and uses the base cache', async (t) => {
  const { root, source, speech } = await fixture(t);
  await assert.rejects(speech.captions(source, undefined, { provider: 'youtube' }), /không có phụ đề YouTube/);
  source.captions = [{ start: 1, end: 2, text: 'YouTube text' }];
  assert.equal((await speech.captions(source, undefined, { provider: 'youtube' })).origin, 'youtube');
  await writeFile(path.join(root, source.id, 'speech-captions.json'), JSON.stringify({ cues: [{ start: 1, end: 2, text: 'Old base cache' }], origin: 'whisper-local' }));
  assert.equal((await speech.captions(source, undefined, { provider: 'whisper' })).cues[0].text, 'Old base cache');
  await writeFile(path.join(root, source.id, 'speech-captions.json'), JSON.stringify({ sourceId: source.id, cues: [{ start: 3, end: 4, text: 'Base model text' }], origin: 'whisper-local' }));
  const track = await speech.captions(source, undefined, { provider: 'whisper' });
  assert.equal(track.origin, 'whisper-local'); assert.equal(track.cues[0].text, 'Base model text');
  await assert.rejects(speech.captions(source, undefined, { provider: 'unknown' }), /không hợp lệ/);
});
