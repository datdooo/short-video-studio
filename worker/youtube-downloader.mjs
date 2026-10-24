import {originalCaptionTrack} from './caption-tracks.mjs';
import { mkdir, mkdtemp, readFile, readdir, writeFile, rm, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { youtubeUrl, fallback } from './youtube-common.mjs';
import { YOUTUBE_FORMAT, YOUTUBE_SORT, upscaleDimensions, youtubeReviewProfile,rankYouTubeReviewVideos } from './youtube-quality.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { normalizeSourceContext, heatmapUnavailable } from '../lib/source-context/index.mjs';
import { buildYouTubeCommentArgs } from '../lib/source-context/comments.mjs';

// Comment scraping is far slower than metadata and needs its own bounded budget.
// It must never inherit the (much shorter) metadata timeout.
export const COMMENT_TIMEOUT_MS = 3 * 60_000;

function attemptTimeoutMs(operation, timeouts) {
  if (operation === 'download' || operation === 'download-review') return timeouts.download ?? 20 * 60_000;
  if (operation === 'comments') return timeouts.comments ?? COMMENT_TIMEOUT_MS;
  return timeouts.metadata ?? 60_000;
}

// yt-dlp review uses explicit format IDs from this attempt's own metadata.
// Never fall back to unconstrained bestvideo or prioritize English/dubbed audio.
function reviewYtFormats(info,profile){
  const usable=(info.formats||[]).filter(item=>typeof item.format_id==='string'&&/^[a-z0-9_.-]+$/i.test(item.format_id));
  const normalized=usable.map(item=>({...item,has_video:Boolean(item.vcodec&&item.vcodec!=='none'),has_audio:Boolean(item.acodec&&item.acodec!=='none'),mime_type:item.vcodec||'',bitrate:Number(item.tbr)||0,content_length:item.filesize??item.filesize_approx}));
  const videos=rankYouTubeReviewVideos(normalized,profile);
  const fits=item=>!Number.isFinite(Number(item.content_length))||Number(item.content_length)<=profile.maxBytes;
  const originalPool=items=>{
    const clean=items.filter(item=>item.is_original!==false&&!item.is_dubbed&&!item.is_auto_dubbed&&!item.is_descriptive&&!item.is_secondary&&!/\b(?:dubbed|descriptive|secondary)\b/i.test(item.format_note||''));
    const explicit=clean.filter(item=>item.is_original===true||/(?:^|[ (,])original(?:[ ),]|$)/i.test(item.format_note||''));
    if(explicit.length)return {items:explicit,proof:'original-format-metadata'};
    const language=String(info.language||'').toLowerCase().split('-')[0];
    const sameLanguage=language?clean.filter(item=>String(item.language||'').toLowerCase().split('-')[0]===language):[];
    if(sameLanguage.length)return {items:sameLanguage,proof:'source-language-metadata'};
    const languages=new Set(clean.map(item=>String(item.language||'').toLowerCase().split('-')[0]).filter(Boolean));
    // With competing languages and no original marker, use the existing local
    // source fallback rather than silently choosing a translation/dub.
    return languages.size<=1?{items:clean,proof:'single-available-language'}:{items:[],proof:'original-language-unresolved'};
  };
  const audio=originalPool(normalized.filter(item=>item.has_audio&&!item.has_video&&fits(item)));
  audio.items.sort((a,b)=>Number(String(b.acodec).startsWith('mp4a'))-Number(String(a.acodec).startsWith('mp4a'))||b.bitrate-a.bitrate);
  const combined=originalPool(videos.filter(item=>item.has_audio));
  const knownBytes=item=>{const bytes=Number(item?.content_length);return Number.isFinite(bytes)&&bytes>0?bytes:0;};
  // Consider the complete bounded list before reducing height: a smaller audio
  // or lower-bitrate video at this height may fit when the first pair does not.
  for(const video of videos){
    const sound=audio.items.find(item=>knownBytes(video)+knownBytes(item)<=profile.maxBytes);
    if(sound)return {format:`${video.format_id}+${sound.format_id}`,audioLanguage:sound.language||'',audioSelection:audio.proof};
    if(combined.items.includes(video)&&knownBytes(video)<=profile.maxBytes)return {format:video.format_id,audioLanguage:video.language||'',audioSelection:combined.proof};
  }
  throw Error('Review stream/original audio unavailable within requested height and byte limit');
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
  function processingOptions(parsed, phase, signal) {
    return { signal,
      onQueued: kind => emitProgress(parsed, { phase: kind === 'render' ? 'waiting-render' : 'waiting-resource', percent: null }),
      onStart: () => emitProgress(parsed, { phase, percent: null }),
    };
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
    let pending = '',lastBytes=0,lastAt=0,lastEmit=0;
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
          const now=performance.now();if(downloaded<lastBytes){lastBytes=0;lastAt=now;}
          const seconds=lastAt?(now-lastAt)/1000:0,speed=seconds>=.25&&downloaded>=lastBytes?(downloaded-lastBytes)/seconds:null;
          if(now-lastEmit>=250||percent===100){emitProgress(parsed,{phase:'download',percent,stream,estimated:!(exact>0),downloadedBytes:Number.isFinite(downloaded)?downloaded:undefined,totalBytes:total>0?total:undefined,...(speed>0?{bytesPerSecond:speed,etaSeconds:total>downloaded?(total-downloaded)/speed:0}:{})});lastEmit=now;lastBytes=downloaded;lastAt=now;}
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


  async function attempt(operation, parsed, directory, auth, signal, review) {
    const timeout = AbortSignal.timeout(attemptTimeoutMs(operation, timeouts));
    const bounded = AbortSignal.any([signal, timeout]);
    // Comment retrieval is yt-dlp only; other engines have no comment support.
    if (operation === 'comments' && !ytDlp && !adapters?.yt) throw new Error('Comment retrieval unavailable');
    if (adapters) return adapters[auth.engine](operation, parsed, directory, auth, bounded, review);
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
      const result = await run(process.execPath, ['--max-old-space-size=256', path.join(import.meta.dirname, 'youtube-js.mjs'), operation, parsed.id, directory, cookieFile,...(review?[String(review.maxHeight),String(review.maxBytes)]:[])], {
        signal: bounded, maxStdout: 10 * 1024 * 1024,
        env: { ...Object.fromEntries(Object.keys(process.env).filter((name) => !['PATH', 'LANG', 'TMPDIR', 'HOME', 'SystemRoot'].includes(name)).map((name) => [name, ''])) },
      });
      const info = JSON.parse(result.stdout);
      if (operation === 'download' || operation === 'download-review') {
        if (!ffmpeg) throw new Error('Missing tool FFmpeg');
        if(!review)emitProgress(parsed, { phase: 'muxing', percent: null });
        const inputs = info.combined ? ['-i', path.join(directory, 'combined.media')] : ['-i', path.join(directory, 'video.media'), '-i', path.join(directory, 'audio.media')];
        await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...inputs, '-map', '0:v:0', '-map', info.combined ? '0:a:0' : '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', path.join(directory, 'source.mp4')], review?{signal:bounded}:processingOptions(parsed, 'muxing', bounded));
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
    if(operation==='download-review'){
      const metadata=await run(ytDlp,[...common,'--skip-download','--dump-single-json',parsed.url],{maxStdout:10*1024*1024,signal:bounded});
      const info=JSON.parse(metadata.stdout);
      if(info.id&&info.id!==parsed.id)throw Error('Source metadata identity mismatch');
      const selected=reviewYtFormats(info,review);
      await run(ytDlp,[...common,'-f',selected.format,'--max-filesize',String(review.maxBytes),'--merge-output-format','mp4','-o',path.join(directory,'source.%(ext)s'),parsed.url],{signal:bounded});
      return {...info,reviewProfile:{...review,audioLanguage:selected.audioLanguage,audioSelection:selected.audioSelection}};
    }
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
      const speechLanguage=info.requested_formats?.find(f=>f.acodec&&f.acodec!=='none')?.language||info.language||'';
      const track=originalCaptionTrack(info.subtitles,info.automatic_captions,speechLanguage),selected=track.id;
      info.vtt='';info.spokenLanguage=track.language;info.captionLanguage=selected?track.language:'';info.captionTrackId=selected||'';info.captionWarning=track.warning||'';info.captionTranslated=false;
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

  async function execute(operation, parsed, signal, accept, review) {
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
    let reviewAcceptFailure;
    const value=await fallback(attempts, async (auth) => {
      const directory = await mkdtemp(path.join(scratchRoot, 'attempt-'));
      try {
        if (operation === 'download') emitProgress(parsed, { phase: 'connecting', percent: null });
        const info = await attempt(operation, parsed, directory, auth, signal, review);
        signal.throwIfAborted();
        if(operation==='download-review'){
          const name=(await readdir(directory)).find(file=>/^source\.(mp4|mkv|webm|mov)$/.test(file));
          if(!name)throw Error('Review media validation failed');
          const mediaPath=path.join(directory,name),media=await probeMedia(mediaPath,signal),bytes=(await stat(mediaPath)).size;
          const expected=Number(info.duration);
          if(!media.width||!media.height||media.height>review.maxHeight||!media.hasAudio||!media.duration||bytes<1000||bytes>review.maxBytes
            ||(expected>0&&Math.abs(media.duration-expected)>Math.max(1,expected*.001)))throw Error('Review media validation failed: height, byte limit, audio or complete duration');
          signal.throwIfAborted();
          // A local callback/publish failure must not redownload the video with
          // every auth engine. The callback still runs before owned cleanup.
          try{return await accept({info,media,mediaPath,parsed,signal});}
          catch(error){reviewAcceptFailure={error};return undefined;}
        }
        rememberContext(parsed, info, auth.engine);
        if (operation !== 'download') return info;
        const name = (await readdir(directory)).find((file) => /^source\.(mp4|mkv|webm|mov)$/.test(file));
        if (!name) throw new Error('Media validation failed');
        let mediaPath = path.join(directory, name);
        emitProgress(parsed, { phase: 'probing', percent: null });
        let media = await probeMedia(mediaPath, signal);
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
            '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], processingOptions(parsed, 'upscaling', bounded));
          const encoder = upscaleEncoder();
          try { await encode(encoder); }
          catch (error) { bounded.throwIfAborted(); if (encoder !== 'h264_videotoolbox') throw error; await encode('libx264'); }
          const scaled = await probeMedia(output, bounded);
          if (scaled.width !== target.width || scaled.height !== target.height || !scaled.hasAudio || Math.abs(scaled.duration - media.duration) > .5 || (await stat(output)).size < 1000) throw new Error('Media validation failed: upscale output invalid');
          media = scaled; mediaPath = output;
        }
        emitProgress(parsed, { phase: 'completing', percent: null });
        return await accept({ info, media, mediaPath, parsed, signal });
      } finally { await rm(directory, { recursive: true, force: true }); }
    }, signal);
    if(reviewAcceptFailure)throw reviewAcceptFailure.error;
    return value;
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
    downloadReview:(url,options,accept,signal)=>{const parsed=youtubeUrl(url),review=youtubeReviewProfile(options);if(typeof accept!=='function')throw Error('Review download requires an owned-file callback');return execute('download-review',parsed,signal||new AbortController().signal,accept,review);},
    download: (url, accept, signal) => { const parsed = youtubeUrl(url); return shared(`download:${parsed.id}`, (activeSignal) => execute('download', parsed, activeSignal, accept), signal); },
  };
}
