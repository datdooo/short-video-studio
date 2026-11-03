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
  const track = await speech.cachedCaptions(source);
  assert.equal(track.sourceId, source.id); assert.equal(track.cues[0].end, 10);
  source.duration = 7;
  assert.equal(await speech.cachedCaptions(source), null);
});
test('foreign-source or mismatched-duration cached captions remain rejected', async (t) => {
  const { root, source, speech } = await fixture(t);
  const file = path.join(root, source.id, 'speech-captions.json');
  await writeFile(file, JSON.stringify({ sourceId: 'other-source', cues: [], origin: 'whisper-local' }));
  assert.equal(await speech.cachedCaptions(source), null);
  await writeFile(file, JSON.stringify({ sourceId: source.id, sourceDuration: 12, cues: [], origin: 'whisper-local' }));
  assert.equal(await speech.cachedCaptions(source), null);
});

test('explicit YouTube never silently runs Whisper; current small/transcribe cache is separate from legacy base', async t => {
  const {root,source,speech}=await fixture(t);
  await assert.rejects(speech.captions(source,undefined,{provider:'youtube'}), /không có phụ đề YouTube/);
  source.captions=[{start:1,end:2,text:'YouTube text'}];
  assert.equal((await speech.captions(source,undefined,{provider:'youtube'})).origin,'youtube');
  await writeFile(path.join(root,source.id,'speech-captions.json'),JSON.stringify({cues:[{start:1,end:2,text:'Old base text'}],origin:'whisper-local'}));
  assert.equal((await speech.cachedCaptions(source)).cues[0].text,'Old base text');
  await assert.rejects(speech.captions(source,undefined,{provider:'whisper'}), /Whisper small/);
  const asrIdentity=(await speech.status()).cacheIdentity;
  await writeFile(path.join(root,source.id,'speech-captions-small-v1.json'),JSON.stringify({sourceId:source.id,sourceDuration:10,cues:[{start:3,end:4,text:'Aktueller deutscher Text.'}],origin:'whisper-local-small',language:'de',task:'transcribe',asrIdentity,requestedLanguage:'auto'}));
  const track=await speech.captions(source,undefined,{provider:'whisper'});
  assert.equal(track.origin,'whisper-local-small'); assert.equal(track.language,'de'); assert.equal(track.cues[0].text,'Aktueller deutscher Text.');
  await assert.rejects(speech.captions(source,undefined,{provider:'unknown'}), /không hợp lệ/);
});
