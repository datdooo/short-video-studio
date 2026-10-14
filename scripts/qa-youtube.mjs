import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = await mkdtemp(path.join(tmpdir(), 'shortcut-youtube-live-'));
const origin = 'http://127.0.0.1:8789';
const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const child = spawn(process.execPath, ['worker/server.mjs'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: { ...process.env, MEDIA_WORKER_PORT: '8789', MEDIA_WORKER_DATA_DIR: root, MEDIA_WORKER_DISABLE_LEGACY: '1', YOUTUBE_COOKIES_FILE: '', YOUTUBE_COOKIES_FROM_BROWSER: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// Capture only; do not print any upstream stderr or user credentials.
child.stdout.resume(); child.stderr.resume();
try {
  for (let index = 0; index < 100; index++) {
    if (child.exitCode !== null) throw new Error('QA worker stopped');
    try { if ((await fetch(`${origin}/health`)).ok) break; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  console.log(`Isolated test storage: ${root}`);
  const metadataResponse = await fetch(`${origin}/api/youtube/metadata?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(180_000) });
  const metadata = await metadataResponse.json();
  assert.equal(metadataResponse.status, 200, metadata.error); assert.equal(metadata.videoId, 'jNQXAC9IVRw'); assert.ok(metadata.title);
  console.log(`Metadata OK: ${metadata.title}`);
  const response = await fetch(`${origin}/api/sources/youtube`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: AbortSignal.timeout(180_000) });
  const result = await response.json();
  if (response.ok) {
    assert.ok(result.source.hasAudio); assert.ok(result.source.width); assert.ok(result.source.duration >= 18);
    const stored = JSON.parse(await readFile(path.join(root, 'sources', result.source.id, 'source.json'), 'utf8'));
    assert.equal(stored.youtubeVideoId, 'jNQXAC9IVRw');
    console.log(`Download OK: ${stored.width}x${stored.height}, ${stored.duration}s, audio present`);
  } else {
    assert.match(result.error, /yt-dlp:/); assert.match(result.error, /YouTube.js:/); assert.match(result.error, /Chrome\/Firefox/);
    assert.ok(!/Cookie:|SAPISID=|SID=|https?:\/\//i.test(result.error));
    assert.deepEqual(await readdir(path.join(root, 'sources')), []);
    console.log(`Live download rejected safely: ${result.error}`);
    console.log('No authenticated cookie test performed: browser credentials were not accessed.');
  }
  assert.deepEqual(await readdir(path.join(root, 'youtube-downloads')), []);
  console.log('No unfinished downloads/cookie files left; personal media untouched.');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
}
