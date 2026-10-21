import { mkdir, mkdtemp, readFile, readdir, writeFile, rm, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { youtubeUrl, fallback } from './youtube-common.mjs';
import { YOUTUBE_FORMAT, YOUTUBE_SORT, upscaleDimensions } from './youtube-quality.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { normalizeSourceContext, heatmapUnavailable } from '../lib/source-context/index.mjs';
import { buildYouTubeCommentArgs } from '../lib/source-context/comments.mjs';

// Comment scraping is far slower than metadata and needs its own bounded budget.
// It must never inherit the (much shorter) metadata timeout.
export const COMMENT_TIMEOUT_MS = 3 * 60_000;

function attemptTimeoutMs(operation, timeouts) {
  if (operation === 'download') return timeouts.download ?? 20 * 60_000;
  if (operation === 'comments') return timeouts.comments ?? COMMENT_TIMEOUT_MS;
  return timeouts.metadata ?? 60_000;
}

export function createYouTubeDownloader({ dataRoot, ytDlp, ffmpeg, run, probeMedia, adapters, env = process.env, timeouts = {}, upscaleEncoder = () => 'libx264' }) {
  const shared = createSharedOperations();
  const contextCache = new Map();
  const metadataCache = new Map();
  const scratchRoot = path.join(dataRoot, 'youtube-downloads');
  const progressListeners = new Map();
  function emitProgress(parsed, value) {
    for (const listener of progressListeners.get(parsed.id) || []) {
      try { listener(value); } catch { /* A disconnected observer never owns a download. */ }
    }
  }
  function subscribeProgress(url, listener) {
    const { id } = youtubeUrl(url);
    if (!progressListeners.has(id) && progressListeners.size >= 64) throw new Error('Quá nhiều lượt theo dõi nguồn. Thử lại sau.');
    const listeners = progressListeners.get(id) || new Set();
    if (listeners.size >= 16) throw new Error('Quá nhiều lượt theo dõi cùng nguồn.');
    listeners.add(listener); progressListeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) progressListeners.delete(id); };
  }
  // Parse our numeric template only, never human logs, filenames or signed URLs.
  function progressReader(parsed) {
    let pending = '';
    return chunk => {
      pending += String(chunk);
      const lines = pending.split(/\r?\n/); pending = lines.pop().slice(-8192);
      for (const line of lines) {
        if (!line.startsWith('__shortcut_progress__') || line.length > 8192) continue;
        try {
          const value = JSON.parse(line.slice('__shortcut_progress__'.length));
          if (value.phase === 'muxing') { emitProgress(parsed, { phase: 'muxing', percent: null }); continue; }
          const downloaded = typeof value.downloaded === 'number' ? value.downloaded : NaN;
          const exact = typeof value.total === 'number' ? value.total : NaN, estimate = typeof value.estimate === 'number' ? value.estimate : NaN;
          const total = exact > 0 ? exact : estimate;
          const percent = Number.isFinite(downloaded) && downloaded >= 0 && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(100, downloaded / total * 100)) : null;
          const stream = value.video === 'none' ? 'audio' : value.video && value.video !== 'NA' && value.video !== 'null' ? (value.audio && value.audio !== 'none' && value.audio !== 'null' ? 'media' : 'video') : 'media';
          emitProgress(parsed, { phase: 'download', percent, stream, estimated: !(exact > 0) });
        } catch { /* Partial/malformed provider progress is not a source failure. */ }
      }
    };
  }


  // Keep only bounded normalized intelligence, never format URLs/cookies/raw info.
  function rememberContext(parsed, info, engine) {
    if (info.id && info.id !== parsed.id) throw new Error('Source metadata identity mismatch');
    if (metadataCache.size >= 128) metadataCache.delete(metadataCache.keys().next().value);
    if (info.title) metadataCache.set(parsed.id, { value: { videoId: parsed.id, title: info.title, channelName: info.channelName || info.uploader || '', thumbnailUrl: info.thumbnailUrl || info.thumbnail || '' }, expires: Date.now() + 5 * 60_000 });
    const next = normalizeSourceContext({ info: { ...info, id: parsed.id, webpage_url: parsed.url }, url: parsed.url });
    const provider = engine === 'yt' ? 'yt-dlp' : engine === 'js' ? 'youtubejs' : 'oembed';
    next.provenance.source = provider;
    for (const [field, origin] of Object.entries(next.provenance.fields)) {
      if (origin === 'yt-dlp') next.provenance.fields[field] = provider;
    }
    next.provenance.fields.contextMetadata = provider;
    next.provenance.fields.contextHeatmap = provider;
    if (engine !== 'yt') next.heatmap = heatmapUnavailable('provider-unsupported', { source: provider });
    if (Array.isArray(info.comments)) next.provenance.fields.contextComments = provider;
    const previous = contextCache.get(parsed.id)?.value;
    if (previous) {
      next.metadata = { ...previous.metadata, ...next.metadata };
      if (!info.title) next.metadata.title = previous.metadata.title;
      if (!Array.isArray(info.tags)) next.metadata.tags = previous.metadata.tags;
      if (!next.chapters.length) next.chapters = previous.chapters;
      if (!next.descriptionMarkers.length) next.descriptionMarkers = previous.descriptionMarkers;
      if (!Array.isArray(info.comments)) next.comments = previous.comments;
      if (previous.heatmap?.status === 'available' && next.heatmap?.status !== 'available') {
        next.heatmap = previous.heatmap;
        next.provenance.fields.contextHeatmap = previous.provenance.fields.contextHeatmap;
      }
      next.provenance.fields = { ...previous.provenance.fields, ...next.provenance.fields };
    }
    next.source.title = next.metadata.title;
    if (Number.isFinite(next.metadata.durationSeconds)) {
      next.source.durationSeconds = next.metadata.durationSeconds;
      next.source.durationMs = Math.round(next.metadata.durationSeconds * 1000);
    }
    if (contextCache.size >= 128) contextCache.delete(contextCache.keys().next().value);
    contextCache.set(parsed.id, { value: next, expires: Date.now() + 5 * 60_000 });
  }
  function peekContext(url) {
    const cached = contextCache.get(youtubeUrl(url).id);
    return cached && cached.expires > Date.now() ? structuredClone(cached.value) : undefined;
  }

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


  async function attempt(operation, parsed, directory, auth, signal) {
    const timeout = AbortSignal.timeout(attemptTimeoutMs(operation, timeouts));
    const bounded = AbortSignal.any([signal, timeout]);
    // Comment retrieval is yt-dlp only; other engines have no comment support.
    if (operation === 'comments' && !ytDlp && !adapters?.yt) throw new Error('Comment retrieval unavailable');
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
      if (operation === 'download') emitProgress(parsed, { phase: 'download', percent: null, stream: 'media' });
      const result = await run(process.execPath, ['--max-old-space-size=256', path.join(import.meta.dirname, 'youtube-js.mjs'), operation, parsed.id, directory, cookieFile], {
        signal: bounded, maxStdout: 10 * 1024 * 1024,
        env: { ...Object.fromEntries(Object.keys(process.env).filter((name) => !['PATH', 'LANG', 'TMPDIR', 'HOME', 'SystemRoot'].includes(name)).map((name) => [name, ''])) },
      });
      const info = JSON.parse(result.stdout);
      if (operation === 'download') {
        if (!ffmpeg) throw new Error('Missing tool FFmpeg');
        emitProgress(parsed, { phase: 'muxing', percent: null });
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
      await run(ytDlp, [...common, '--progress', '--newline', '--progress-delta', '1',
        '--progress-template', 'download:__shortcut_progress__{"downloaded":%(progress.downloaded_bytes|null)j,"total":%(progress.total_bytes|null)j,"estimate":%(progress.total_bytes_estimate|null)j,"video":%(info.vcodec|null)j,"audio":%(info.acodec|null)j}',
        '--progress-template', 'postprocess:__shortcut_progress__{"phase":"muxing"}',
        '-f', YOUTUBE_FORMAT, '-S', YOUTUBE_SORT, '--merge-output-format', 'mp4', '--write-info-json', '-o', path.join(directory, 'source.%(ext)s'), parsed.url],
        { signal: bounded, onStdout: progressReader(parsed), onStderr: progressReader(parsed) });
      const files = await readdir(directory);
      return JSON.parse(await readFile(path.join(directory, files.find((name) => name.endsWith('.info.json')) || 'source.info.json'), 'utf8'));
    }
    if (operation === 'comments') {
      const result = await run(ytDlp, [...common, ...buildYouTubeCommentArgs(), '--dump-single-json', parsed.url], { maxStdout: 20 * 1024 * 1024, signal: bounded });
      const info = JSON.parse(result.stdout);
      if (!info.title) throw new Error('No title found in player responses');
      return info;
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
    const supportsJs = operation !== 'comments';
    if (config.file) { if (ytDlp || adapters?.yt) add('yt', { file: config.file }); if (supportsJs) add('js', { file: config.file }); }
    if (config.browser && (ytDlp || adapters?.yt)) add('yt', { browser: config.browser });
    if (ytDlp || adapters?.yt) add('yt');
    if (supportsJs) add('js');
    if (operation === 'comments' && attempts.length === 0) add('yt');
    if (operation === 'metadata') attempts.push({ engine: 'oembed', label: 'YouTube oEmbed' });
    await mkdir(scratchRoot, { recursive: true, mode: 0o700 });
    return fallback(attempts, async (auth) => {
      const directory = await mkdtemp(path.join(scratchRoot, 'attempt-'));
      try {
        if (operation === 'download') emitProgress(parsed, { phase: 'connecting', percent: null });
        const info = await attempt(operation, parsed, directory, auth, signal);
        signal.throwIfAborted();
        rememberContext(parsed, info, auth.engine);
        if (operation !== 'download') return info;
        const name = (await readdir(directory)).find((file) => /^source\.(mp4|mkv|webm|mov)$/.test(file));
        if (!name) throw new Error('Media validation failed');
        let mediaPath = path.join(directory, name);
        emitProgress(parsed, { phase: 'probing', percent: null });
        let media = await probeMedia(mediaPath);
        const expected = Number(info.duration);
        if (!media.width || !media.height || !media.hasAudio || !media.duration || (expected > 0 && media.duration < expected - Math.max(3, expected * .02)) || (await stat(mediaPath)).size < 1000) throw new Error('Media validation failed: video stream/audio missing or truncated');
        const target = upscaleDimensions(media.width, media.height);
        if (target) {
          emitProgress(parsed, { phase: 'upscaling', percent: null });
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
        emitProgress(parsed, { phase: 'completing', percent: null });
        return await accept({ info, media, mediaPath, parsed, signal });
      } finally { await rm(directory, { recursive: true, force: true }); }
    }, signal);
  }

  return {
    subscribeProgress,
    peekContext,
    context: async (url, signal) => {
      signal?.throwIfAborted();
      const cached = peekContext(url);
      if (cached) return cached;
      const parsed = youtubeUrl(url);
      await shared(`context:${parsed.id}`, (activeSignal) => execute('metadata', parsed, activeSignal), signal);
      return peekContext(url);
    },
    metadata: async (url, signal) => {
      const parsed = youtubeUrl(url), cached = metadataCache.get(parsed.id);
      if (cached && cached.expires > Date.now()) return cached.value;
      return shared(`metadata:${parsed.id}`, async (activeSignal) => {
        await shared(`context:${parsed.id}`, (signal) => execute('metadata', parsed, signal), activeSignal);
        const context = peekContext(parsed.url);
        const info = { title: context.metadata.title, uploader: context.metadata.uploader };
        const value = metadataCache.get(parsed.id)?.value || { videoId: parsed.id, title: info.title, channelName: info.uploader || '', thumbnailUrl: '' };
        if (metadataCache.size >= 128) metadataCache.delete(metadataCache.keys().next().value);
        metadataCache.set(parsed.id, { value, expires: Date.now() + 5 * 60_000 }); return value;
      }, signal);
    },
    transcript: (url, signal) => { const parsed = youtubeUrl(url); return shared(`transcript:${parsed.id}`, (activeSignal) => execute('transcript', parsed, activeSignal), signal); },
    comments: (url, signal) => { const parsed = youtubeUrl(url); return shared(`comments:${parsed.id}`, (activeSignal) => execute('comments', parsed, activeSignal), signal); },
    download: (url, accept, signal) => { const parsed = youtubeUrl(url); return shared(`download:${parsed.id}`, (activeSignal) => execute('download', parsed, activeSignal, accept), signal); },
  };
}
