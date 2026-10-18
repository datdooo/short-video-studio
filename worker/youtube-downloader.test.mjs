import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createYouTubeDownloader, COMMENT_TIMEOUT_MS } from './youtube-downloader.mjs';
import { cookieHeader, fallback, youtubeFailure, youtubeUrl } from './youtube-common.mjs';
import { collectCommentSignals, COMMENT_FETCH_LIMIT } from '../lib/source-context/comments.mjs';

const url = 'https://www.youtube.com/watch?v=BaW_jenozKc';
async function fixture(t, adapters, options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'shortcut-youtube-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const downloader = createYouTubeDownloader({ dataRoot: root, adapters,
    probeMedia: async () => ({ width: 1920, height: 1080, hasAudio: true, duration: 10 }), env: {}, ...options });
  return { root, downloader, clean: async () => assert.deepEqual(await readdir(path.join(root, 'youtube-downloads')), []) };
}

test('low-res download is upscaled once before acceptance; GPU failure falls back to CPU', async (t) => {
  const encoders = []; let probes = 0;
  const { downloader, clean } = await fixture(t, { js: async (_, __, directory) => {
    await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { duration: 10 };
  } }, { ffmpeg: '/fake/ffmpeg', upscaleEncoder: () => 'h264_videotoolbox',
    probeMedia: async () => ({ width: ++probes === 1 ? 640 : 1920, height: probes === 1 ? 360 : 1080, hasAudio: true, duration: 10 }),
    run: async (_, args) => {
      encoders.push(args[args.indexOf('-c:v') + 1]);
      assert.ok(args.includes('scale=1920:1080:flags=lanczos,setsar=1'));
      if (encoders.length === 1) throw new Error('Hardware unavailable');
      await writeFile(args.at(-1), Buffer.alloc(2048));
    },
  });
  const result = await downloader.download(url, async ({ media, mediaPath }) => ({ width: media.width, height: media.height, name: path.basename(mediaPath) }));
  assert.deepEqual(result, { width: 1920, height: 1080, name: 'upscaled.mp4' });
  assert.deepEqual(encoders, ['h264_videotoolbox', 'libx264']); await clean();
});

test('yt-dlp download sorts resolution before codec and keeps best A/V fallback', async (t) => {
  let calls = 0;
  const { downloader, clean } = await fixture(t, undefined, { ytDlp: '/fake/yt-dlp',
    run: async (binary, args) => {
      calls++; assert.equal(binary, '/fake/yt-dlp');
      assert.equal(args[args.indexOf('-S') + 1], 'res:1080,vcodec:h264,acodec:aac');
      assert.equal(args[args.indexOf('-f') + 1], 'bv[height<=1080]+ba/b[height<=1080]/bv+ba/b');
      const directory = path.dirname(args[args.indexOf('-o') + 1]);
      await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048));
      await writeFile(path.join(directory, 'source.info.json'), JSON.stringify({ duration: 10 }));
      return { stdout: '' };
    },
  });
  assert.equal(await downloader.download(url, async ({ media }) => media.width), 1920);
  assert.equal(calls, 1); await clean();
});

test('canonical URLs share a valid video ID; lookalike hosts rejected', () => {
  for (const value of [url, 'youtu.be/BaW_jenozKc?t=5', 'https://m.youtube.com/shorts/BaW_jenozKc']) assert.equal(youtubeUrl(value).id, 'BaW_jenozKc');
  for (const value of ['https://youtube.com.evil.test/watch?v=BaW_jenozKc', 'https://youtube.com/playlist?list=abc', 'file:///tmp/video']) assert.throws(() => youtubeUrl(value));
});

test('cookie conversion excludes other sites, expired and malicious cookies', () => {
  const jar = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tprivate-fake\n#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t0\tHSID\tfake-two\n.google.com\tTRUE\t/\tTRUE\t0\tOTHER\tsecret\n.youtube.com\tTRUE\t/\tTRUE\t1\tOLD\told\n.youtube.com\tTRUE\t/\tTRUE\t0\tBAD\tx;injected';
  assert.equal(cookieHeader(jar), 'SID=private-fake; HSID=fake-two');
});

test('error messages never contain raw cookies, tokens, paths or signed URLs', async () => {
  const secret = 'private-secret-cookie';
  await assert.rejects(fallback([{ label: 'yt-dlp' }, { label: 'YouTube.js' }], async () => { throw new Error(`Sign in to confirm bot Cookie: SID=${secret} /Users/private https://x.test/?token=${secret}`); }), (error) => {
    assert.ok(error.message.includes('xác thực')); assert.ok(error.message.includes('Chrome/Firefox')); assert.ok(!error.message.includes(secret)); assert.ok(!error.message.includes('/Users')); return true;
  });
  assert.match(youtubeFailure(new Error('getaddrinfo ENOTFOUND')), /DNS/);
  const denied = youtubeFailure(new Error('Chrome cookie database permission denied by macOS /Users/private SID=SECRET'));
  assert.match(denied, /Full Disk Access/);
  assert.equal(youtubeFailure(denied), denied);
  assert.ok(!denied.includes('SECRET') && !denied.includes('/Users'));
  assert.match(youtubeFailure(new Error('could not find chrome cookies database')), /đúng profile Chrome/);
});

test('metadata falls back yt-dlp → YouTube.js and caches only success', async (t) => {
  const calls = [];
  const { downloader, clean } = await fixture(t, {
    yt: async () => { calls.push('yt'); throw new Error('Sign in to confirm bot'); },
    js: async () => { calls.push('js'); return { title: 'Test title' }; },
  });
  assert.equal((await downloader.metadata(url)).title, 'Test title');
  assert.equal((await downloader.metadata('https://youtu.be/BaW_jenozKc')).title, 'Test title');
  assert.deepEqual(calls, ['yt', 'js']); await clean();
});

test('metadata retains oEmbed as final independent fallback', async (t) => {
  const fail = async () => { throw new Error('403'); };
  const { downloader, clean } = await fixture(t, { yt: fail, js: fail, oembed: async () => ({ title: 'oEmbed title' }) });
  assert.equal((await downloader.metadata(url)).title, 'oEmbed title'); await clean();
});

test('transcript uses fallback and does not retain temporary subtitle files', async (t) => {
  const { downloader, clean } = await fixture(t, {
    yt: async (_, __, directory) => { await writeFile(path.join(directory, 'transcript.partial'), 'broken'); throw new Error('429'); },
    js: async () => ({ title: 'Caption', vtt: 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello' }),
  });
  assert.match((await downloader.transcript(url)).vtt, /Hello/); await clean();
});

test('download cleans partials before fallback and validates complete A/V', async (t) => {
  const calls = [];
  const { downloader, root, clean } = await fixture(t, {
    yt: async (_, __, directory) => { calls.push('yt'); await writeFile(path.join(directory, 'source.mp4.part'), 'incomplete'); throw new Error('bot'); },
    js: async (_, __, directory) => {
      calls.push('js'); assert.equal((await readdir(path.join(root, 'youtube-downloads'))).length, 1);
      await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { title: 'Complete', duration: 10 };
    },
  });
  const result = await downloader.download(url, async ({ mediaPath, media }) => ({ bytes: (await readFile(mediaPath)).length, audio: media.hasAudio }));
  assert.deepEqual(result, { bytes: 2048, audio: true }); assert.deepEqual(calls, ['yt', 'js']); await clean();
});

test('missing audio is rejected and next downloader used', async (t) => {
  let probes = 0, accepts = 0;
  const success = async (_, __, directory) => { await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { duration: 10 }; };
  const { downloader, clean } = await fixture(t, { yt: success, js: success }, { probeMedia: async () => ({ width: 1920, height: 1080, hasAudio: ++probes > 1, duration: 10 }) });
  await downloader.download(url, async () => { accepts++; return 'ok'; });
  assert.equal(probes, 2); assert.equal(accepts, 1); await clean();
});

test('truncated media is not accepted', async (t) => {
  const success = async (_, __, directory) => { await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { duration: 100 }; };
  const { downloader, clean } = await fixture(t, { yt: success, js: success });
  await assert.rejects(downloader.download(url, async () => assert.fail('must not save incomplete media')), /không hợp lệ/); await clean();
});

test('configured browser authentication is tried automatically and only once', async (t) => {
  const calls = [];
  const { downloader, root, clean } = await fixture(t, {
    yt: async (_, __, ___, auth) => { calls.push(auth.browser || 'yt'); if (!auth.browser) throw new Error('bot'); return { title: 'Authenticated' }; },
    js: async () => { calls.push('js'); throw new Error('bot'); },
  });
  await writeFile(path.join(root, 'youtube-download.json'), JSON.stringify({ cookiesFromBrowser: 'firefox' }));
  assert.equal((await downloader.metadata(url)).title, 'Authenticated'); assert.deepEqual(calls, ['firefox']); await clean();
});

test('manual cookie configuration applies to both downloaders without logging', async (t) => {
  const calls = [], fail = async (_, __, ___, auth) => { calls.push([auth.engine, Boolean(auth.file)]); throw new Error('Sign in Cookie: SECRET'); };
  const { downloader, root, clean } = await fixture(t, { yt: fail, js: fail });
  await writeFile(path.join(root, 'youtube-download.json'), JSON.stringify({ cookiesFile: '/private/fake/cookies.txt' }));
  await assert.rejects(downloader.download(url, async () => {}), (error) => !error.message.includes('SECRET') && !error.message.includes('/private/fake'));
  assert.deepEqual(calls, [['yt', true], ['js', true], ['yt', false], ['js', false]]); await clean();
});

test('concurrent duplicate links download and accept exactly once', async (t) => {
  let calls = 0, accepts = 0;
  const { downloader, clean } = await fixture(t, { js: async (_, __, directory) => { calls++; await new Promise((resolve) => setTimeout(resolve, 30)); await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { duration: 10 }; } });
  const accept = async () => { accepts++; return { id: 'same-source' }; };
  const results = await Promise.all([downloader.download(url, accept), downloader.download('https://youtu.be/BaW_jenozKc', accept)]);
  assert.equal(calls, 1); assert.equal(accepts, 1); assert.equal(results[0], results[1]); await clean();
});

test('cancelling one subscriber does not cancel a shared download', async (t) => {
  const { downloader, clean } = await fixture(t, { js: async (_, __, directory, ___, signal) => { await new Promise((resolve) => setTimeout(resolve, 40)); signal.throwIfAborted(); await writeFile(path.join(directory, 'source.mp4'), Buffer.alloc(2048)); return { duration: 10 }; } });
  const controller = new AbortController();
  const first = downloader.download(url, async () => 'ok', controller.signal);
  const second = downloader.download(url, async () => 'ok'); controller.abort();
  await assert.rejects(first, { name: 'AbortError' }); assert.equal(await second, 'ok'); await clean();
});

test('cancel stops fallback and removes its partial files', async (t) => {
  const controller = new AbortController(); let jsCalls = 0;
  const { downloader, clean } = await fixture(t, {
    yt: async (_, __, directory, ___, signal) => { await writeFile(path.join(directory, 'source.mp4.part'), 'partial'); controller.abort(); signal.throwIfAborted(); },
    js: async () => { jsCalls++; },
  });
  await assert.rejects(downloader.download(url, async () => {}, controller.signal), { name: 'AbortError' });
  // The request can reject before the subprocess/finally has finished cleaning.
  await new Promise((resolve) => setTimeout(resolve, 30)); assert.equal(jsCalls, 0); await clean();
});

test('timeout terminates an attempt and falls back once, with no infinite retry', async (t) => {
  let calls = 0;
  const { downloader, clean } = await fixture(t, {
    yt: async (_, __, directory, ___, signal) => {
      calls++; await writeFile(path.join(directory, 'source.mp4.part'), 'partial');
      await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 1000); signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true }); });
    },
    js: async () => { calls++; return { title: 'After timeout' }; },
  }, { timeouts: { metadata: 20 } });
  assert.equal((await downloader.metadata(url)).title, 'After timeout'); assert.equal(calls, 2); await clean();
});

test('real yt-dlp arguments use only a private cookie-file path and do not alter the supplied jar', async (t) => {
  let calls = 0, original;
  const jar = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tFAKE-QA-ONLY\n';
  const { downloader, root, clean } = await fixture(t, undefined, {
    ytDlp: '/fake/yt-dlp',
    run: async (binary, args) => {
      calls++; assert.ok(!args.join(' ').includes('FAKE-QA-ONLY'));
      if (binary !== '/fake/yt-dlp' || !args.includes('--cookies')) throw new Error('Sign in to confirm bot');
      assert.ok(args.includes('--ignore-config')); assert.ok(args.includes('--socket-timeout'));
      const copied = args[args.indexOf('--cookies') + 1];
      assert.notEqual(copied, original); assert.equal((await stat(copied)).mode & 0o777, 0o600);
      assert.equal((await stat(path.dirname(copied))).mode & 0o777, 0o700);
      assert.equal(await readFile(copied, 'utf8'), jar);
      await writeFile(copied, '# updated by yt-dlp');
      return { stdout: JSON.stringify({ title: 'Private-cookie test' }) };
    },
  });
  original = path.join(root, 'own-fake-cookies.txt'); await writeFile(original, jar);
  await writeFile(path.join(root, 'youtube-download.json'), JSON.stringify({ cookiesFile: original }));
  assert.equal((await downloader.metadata(url)).title, 'Private-cookie test'); assert.equal(calls, 1);
  assert.equal(await readFile(original, 'utf8'), jar); await clean();
});

test('comments reuse the yt-dlp engine without downloading media or touching YouTube.js', async (t) => {
  const calls = [];
  const { downloader, clean } = await fixture(t, {
    yt: async (operation, parsed) => { calls.push(`yt:${operation}:${parsed.id}`); return { title: 'Comment source', comments: [{ id: 'c1', text: 'see 1:00', author: 'A' }] }; },
    js: async () => assert.fail('YouTube.js must not handle comment retrieval'),
  });
  const info = await downloader.comments(url);
  assert.equal(info.title, 'Comment source');
  assert.equal(info.comments.length, 1);
  assert.deepEqual(calls, ['yt:comments:BaW_jenozKc']);
  await clean();
});

test('comment retrieval failure degrades to a normalized unavailable signal', async (t) => {
  const { downloader, clean } = await fixture(t, {
    yt: async () => { throw new Error('429 rate limited'); },
    js: async () => assert.fail('YouTube.js must not handle comment retrieval'),
  });
  await assert.rejects(downloader.comments(url));
  const signals = await collectCommentSignals(() => downloader.comments(url));
  assert.equal(signals.status, 'unavailable');
  assert.equal(signals.reason, 'comment-retrieval-failed');
  await clean();
});

test('real comments operation uses comment-only yt-dlp arguments and no media flags', async (t) => {
  const calls = [];
  const { downloader, clean } = await fixture(t, undefined, {
    ytDlp: '/fake/yt-dlp',
    run: async (binary, args) => {
      calls.push({ binary, args });
      return { stdout: JSON.stringify({ title: 'Comment source', comments: [{ id: 'c1', text: 'see 1:00', author: 'A', parent: 'root' }] }) };
    },
  });

  const info = await downloader.comments(url);
  assert.equal(info.title, 'Comment source');
  assert.equal(calls.length, 1);

  const { binary, args } = calls[0];
  assert.equal(binary, '/fake/yt-dlp');
  assert.ok(args.includes('--skip-download'), 'comments must never download media');
  assert.ok(args.includes('--write-comments'), 'comments must be requested from yt-dlp');
  assert.ok(args.includes('--dump-single-json'), 'comments must be emitted as a single JSON payload');
  assert.ok(args.includes(`youtube:max_comments=${COMMENT_FETCH_LIMIT}`), 'comment extraction must be bounded');
  for (const flag of ['-f', '-S', '--merge-output-format', '--write-info-json', '--write-subs', '--write-auto-subs']) {
    assert.ok(!args.includes(flag), `${flag} must be absent from the comments path`);
  }
  assert.ok(args.at(-1).includes('BaW_jenozKc'), 'the comments path must target the parsed video URL');
  await clean();
});

test('comment retrieval gets a dedicated timeout budget instead of the metadata budget', async (t) => {
  assert.ok(COMMENT_TIMEOUT_MS >= 120_000, 'the comment budget must be at least 120 seconds');
  let aborted = false;
  const { downloader, clean } = await fixture(t, undefined, {
    ytDlp: '/fake/yt-dlp',
    timeouts: { metadata: 1 },
    run: async (_binary, args, options) => {
      assert.ok(args.includes('--write-comments'));
      // Outlives the tiny metadata budget; only a dedicated comment budget survives.
      await new Promise((resolve, reject) => {
        const onAbort = () => { clearTimeout(timer); aborted = true; reject(options.signal.reason); };
        const timer = setTimeout(() => {
          // A finished subprocess no longer observes the downloader's normal
          // shared-request cleanup abort after its final consumer resolves.
          options.signal.removeEventListener('abort', onAbort);
          resolve();
        }, 75);
        options.signal.addEventListener('abort', onAbort, { once: true });
      });
      return { stdout: JSON.stringify({ title: 'Slow comment scrape' }) };
    },
  });

  assert.equal((await downloader.comments(url)).title, 'Slow comment scrape');
  assert.equal(aborted, false);
  await clean();
});
