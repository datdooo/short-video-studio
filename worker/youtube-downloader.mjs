import { mkdir, mkdtemp, readFile, readdir, writeFile, rm, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { youtubeUrl, fallback } from './youtube-common.mjs';
import { YOUTUBE_FORMAT, YOUTUBE_SORT, upscaleDimensions } from './youtube-quality.mjs';

export function createYouTubeDownloader({ dataRoot, ytDlp, ffmpeg, run, probeMedia, adapters, env = process.env, timeouts = {}, upscaleEncoder = () => 'libx264' }) {
  const pending = new Map();
  const metadataCache = new Map();
  const scratchRoot = path.join(dataRoot, 'youtube-downloads');

  async function configuration() {
    let config = {};
    try { config = JSON.parse(await readFile(path.join(dataRoot, 'youtube-download.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('Cấu hình youtube-download.json không hợp lệ.'); }
    const browser = env.YOUTUBE_COOKIES_FROM_BROWSER || config.cookiesFromBrowser || '';
    const file = env.YOUTUBE_COOKIES_FILE || config.cookiesFile || '';
    if (typeof browser !== 'string' || (browser && !/^(chrome|chromium|firefox|edge|brave|safari|opera|vivaldi)(?::[^\r\n]+)?$/.test(browser))) throw new Error('cookiesFromBrowser phải là Chrome/Firefox hoặc tên trình duyệt yt-dlp hỗ trợ.');
    if (typeof file !== 'string' || (file && !path.isAbsolute(file))) throw new Error('cookiesFile phải là đường dẫn tuyệt đối tới file Netscape cookies.txt.');
    return { browser, file };
  }

  function shared(key, operation, signal) {
    signal?.throwIfAborted();
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, consumers: 0 };
      entry.promise = Promise.resolve().then(() => operation(controller.signal)).finally(() => { if (pending.get(key) === entry) pending.delete(key); });
      pending.set(key, entry);
    }
    entry.consumers++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = (callback, value) => {
        if (finished) return; finished = true; signal?.removeEventListener('abort', abort);
        if (--entry.consumers === 0) { entry.controller.abort(); if (pending.get(key) === entry) pending.delete(key); }
        callback(value);
      };
      const abort = () => finish(reject, signal.reason || new Error('Đã huỷ tải video.'));
      signal?.addEventListener('abort', abort, { once: true });
      entry.promise.then((value) => finish(resolve, value), (error) => finish(reject, error));
    });
  }

  async function attempt(operation, parsed, directory, auth, signal) {
    const timeout = AbortSignal.timeout(operation === 'download' ? (timeouts.download ?? 20 * 60_000) : (timeouts.metadata ?? 60_000));
    const bounded = AbortSignal.any([signal, timeout]);
    if (adapters) return adapters[auth.engine](operation, parsed, directory, auth, bounded);
    if (auth.engine === 'oembed') {
      const url = new URL('https://www.youtube.com/oembed'); url.searchParams.set('url', parsed.url); url.searchParams.set('format', 'json');
      const response = await fetch(url, { signal: AbortSignal.any([bounded, AbortSignal.timeout(20_000)]) });
      if (!response.ok) throw new Error(`Metadata HTTP ${response.status}`);
      const info = await response.json();
      if (!info.title) throw new Error('No title found');
      return { title: info.title, channelName: info.author_name || '', thumbnailUrl: info.thumbnail_url || '' };
    }
    let cookieFile = '';
    if (auth.file) {
      let cookie;
      try { cookie = await readFile(auth.file, 'utf8'); } catch { throw new Error('Cookies authentication file unreadable'); }
      if (!/^# (?:Netscape HTTP Cookie File|HTTP Cookie File)/m.test(cookie)) throw new Error('Cookies authentication format invalid');
      cookieFile = path.join(directory, 'cookies.txt');
      // yt-dlp may rewrite the jar; never let it mutate the user's original.
      await writeFile(cookieFile, cookie, { mode: 0o600, flag: 'wx' });
    }
    if (auth.engine === 'js') {
      const result = await run(process.execPath, ['--max-old-space-size=256', path.join(import.meta.dirname, 'youtube-js.mjs'), operation, parsed.id, directory, cookieFile], {
        signal: bounded, maxStdout: 10 * 1024 * 1024,
        env: { ...Object.fromEntries(Object.keys(process.env).filter((name) => !['PATH', 'LANG', 'TMPDIR', 'HOME', 'SystemRoot'].includes(name)).map((name) => [name, ''])) },
      });
      const info = JSON.parse(result.stdout);
      if (operation === 'download') {
        if (!ffmpeg) throw new Error('Missing tool FFmpeg');
        const inputs = info.combined ? ['-i', path.join(directory, 'combined.media')] : ['-i', path.join(directory, 'video.media'), '-i', path.join(directory, 'audio.media')];
        await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...inputs, '-map', '0:v:0', '-map', info.combined ? '0:a:0' : '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', path.join(directory, 'source.mp4')], { signal: bounded });
      }
      return info;
    }
    if (process.platform === 'darwin' && auth.browser === 'chrome') {
      // TCC can make yt-dlp's profile scan look like a missing database. Probe
      // access only; never read cookie contents or try to bypass OS permissions.
      const database = path.join(homedir(), 'Library/Application Support/Google/Chrome/Default/Cookies');
      try { const handle = await open(database, 'r'); await handle.close(); }
      catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) throw new Error('Chrome cookie database permission denied by macOS'); }
    }
    const common = ['--ignore-config', '--no-playlist', '--no-progress', '--retries', '1', '--fragment-retries', '1', '--extractor-retries', '1', '--socket-timeout', '20', '--js-runtimes', `node:${process.execPath}`];
    if (cookieFile) common.push('--cookies', cookieFile);
    if (auth.browser) common.push('--cookies-from-browser', auth.browser);
    if (ffmpeg) common.push('--ffmpeg-location', path.dirname(ffmpeg));
    if (operation === 'download') {
      await run(ytDlp, [...common, '-f', YOUTUBE_FORMAT, '-S', YOUTUBE_SORT, '--merge-output-format', 'mp4', '--write-info-json', '-o', path.join(directory, 'source.%(ext)s'), parsed.url], { signal: bounded });
      const files = await readdir(directory);
      return JSON.parse(await readFile(path.join(directory, files.find((name) => name.endsWith('.info.json')) || 'source.info.json'), 'utf8'));
    }
    const result = await run(ytDlp, [...common, '--skip-download', '--dump-single-json', parsed.url], { maxStdout: 10 * 1024 * 1024, signal: bounded });
    const info = JSON.parse(result.stdout);
    if (!info.title) throw new Error('No title found in player responses');
    if (operation === 'transcript') {
      const manual = Object.keys(info.subtitles || {}).filter((name) => name !== 'live_chat');
      const automatic = Object.keys(info.automatic_captions || {});
      const preferred = /[\uac00-\ud7af]/.test(info.title) ? 'ko' : /[\u3040-\u30ff]/.test(info.title) ? 'ja' : info.language;
      const selected = manual.find((name) => name === preferred) || automatic.find((name) => name === `${preferred}-orig`) || automatic.find((name) => name.endsWith('-orig')) || manual[0] || automatic[0];
      info.vtt = ''; info.language = selected || preferred || '';
      if (selected) {
        await run(ytDlp, [...common, '--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', selected, '--sub-format', 'vtt', '-o', path.join(directory, 'transcript.%(ext)s'), parsed.url], { signal: bounded });
        const file = (await readdir(directory)).find((name) => name.endsWith('.vtt'));
        if (!file) throw new Error('Caption response unavailable');
        info.vtt = await readFile(path.join(directory, file), 'utf8');
        if (!info.vtt.includes('-->')) throw new Error('Caption response unavailable');
      }
    }
    return info;
  }

  async function execute(operation, parsed, signal, accept) {
    const config = await configuration();
    const attempts = [];
    const add = (engine, auth = {}) => attempts.push({ engine, ...auth, label: `${engine === 'js' ? 'YouTube.js' : 'yt-dlp'}${auth.file || auth.browser ? ' (cookie)' : ''}` });
    if (config.file) { if (ytDlp || adapters?.yt) add('yt', { file: config.file }); add('js', { file: config.file }); }
    if (config.browser && (ytDlp || adapters?.yt)) add('yt', { browser: config.browser });
    if (ytDlp || adapters?.yt) add('yt');
    add('js');
    if (operation === 'metadata') attempts.push({ engine: 'oembed', label: 'YouTube oEmbed' });
    await mkdir(scratchRoot, { recursive: true, mode: 0o700 });
    return fallback(attempts, async (auth) => {
      const directory = await mkdtemp(path.join(scratchRoot, 'attempt-'));
      try {
        const info = await attempt(operation, parsed, directory, auth, signal);
        signal.throwIfAborted();
        if (operation !== 'download') return info;
        const name = (await readdir(directory)).find((file) => /^source\.(mp4|mkv|webm|mov)$/.test(file));
        if (!name) throw new Error('Media validation failed');
        let mediaPath = path.join(directory, name);
        let media = await probeMedia(mediaPath);
        const expected = Number(info.duration);
        if (!media.width || !media.height || !media.hasAudio || !media.duration || (expected > 0 && media.duration < expected - Math.max(3, expected * .02)) || (await stat(mediaPath)).size < 1000) throw new Error('Media validation failed: video stream/audio missing or truncated');
        const target = upscaleDimensions(media.width, media.height);
        if (target) {
          if (!ffmpeg) throw new Error('Missing tool FFmpeg');
          const output = path.join(directory, 'upscaled.mp4');
          const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeouts.download ?? 20 * 60_000)]);
          const encode = async (encoder) => run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', mediaPath,
            '-map', '0:v:0', '-map', '0:a:0', '-vf', `scale=${target.width}:${target.height}:flags=lanczos,setsar=1`,
            '-c:v', encoder, ...(encoder === 'h264_videotoolbox' ? ['-b:v', '12M', '-allow_sw', '1'] : ['-preset', 'fast', '-crf', '18']),
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], { signal: bounded });
          const encoder = upscaleEncoder();
          try { await encode(encoder); }
          catch (error) { bounded.throwIfAborted(); if (encoder !== 'h264_videotoolbox') throw error; await encode('libx264'); }
          const scaled = await probeMedia(output);
          if (scaled.width !== target.width || scaled.height !== target.height || !scaled.hasAudio || Math.abs(scaled.duration - media.duration) > .5 || (await stat(output)).size < 1000) throw new Error('Media validation failed: upscale output invalid');
          media = scaled; mediaPath = output;
        }
        return await accept({ info, media, mediaPath, parsed, signal });
      } finally { await rm(directory, { recursive: true, force: true }); }
    }, signal);
  }

  return {
    metadata: async (url, signal) => {
      const parsed = youtubeUrl(url), cached = metadataCache.get(parsed.id);
      if (cached && cached.expires > Date.now()) return cached.value;
      return shared(`metadata:${parsed.id}`, async (activeSignal) => {
        const info = await execute('metadata', parsed, activeSignal);
        const value = { videoId: parsed.id, title: info.title, channelName: info.channelName || info.uploader || '', thumbnailUrl: info.thumbnailUrl || info.thumbnail || '' };
        if (metadataCache.size >= 128) metadataCache.delete(metadataCache.keys().next().value);
        metadataCache.set(parsed.id, { value, expires: Date.now() + 5 * 60_000 }); return value;
      }, signal);
    },
    transcript: (url, signal) => { const parsed = youtubeUrl(url); return shared(`transcript:${parsed.id}`, (activeSignal) => execute('transcript', parsed, activeSignal), signal); },
    download: (url, accept, signal) => { const parsed = youtubeUrl(url); return shared(`download:${parsed.id}`, (activeSignal) => execute('download', parsed, activeSignal, accept), signal); },
  };
}
