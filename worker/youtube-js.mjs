// Runs in a bounded, killable subprocess; no inherited application credentials.
import { Innertube, Platform, Log } from 'youtubei.js';
import { evaluatePlayer } from './youtube-player.mjs';
import { readFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { cookieHeader, youtubeFailure } from './youtube-common.mjs';
import { rankYouTubeVideos } from './youtube-quality.mjs';

Log.setLevel(Log.Level.NONE);
Platform.shim.eval = async (data) => evaluatePlayer(data);

const [operation, id, directory, cookieFile] = process.argv.slice(2);
try {
  const cookie = cookieFile ? cookieHeader(await readFile(cookieFile, 'utf8')) : undefined;
  const yt = await Innertube.create({ cookie, generate_session_locally: true,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([init?.signal, AbortSignal.timeout(30_000)].filter(Boolean)) }),
  });
  const info = await yt.getInfo(id);
  const basic = info.basic_info;
  if (info.playability_status?.status === 'LOGIN_REQUIRED') throw new Error(`Login required: ${info.playability_status.reason || ''}`);
  if (!basic.title || !basic.duration || basic.is_live || basic.is_upcoming) throw new Error(`Video unavailable: ${info.playability_status?.reason || ''}`);
  const result = { title: basic.title, duration: basic.duration, channelName: basic.author || '', thumbnailUrl: basic.thumbnail?.at(-1)?.url || '' };
  if (operation === 'transcript') {
    const tracks = info.captions?.caption_tracks || [];
    const preferred = /[\uac00-\ud7af]/.test(basic.title) ? 'ko' : /[\u3040-\u30ff]/.test(basic.title) ? 'ja' : '';
    const track = tracks.find((item) => preferred && item.language_code === preferred) || tracks.find((item) => item.kind !== 'asr') || tracks[0];
    result.language = track?.language_code || '';
    result.vtt = '';
    if (track) {
      const url = new URL(track.base_url); url.searchParams.set('fmt', 'vtt');
      if (url.protocol !== 'https:' || !/(^|\.)youtube\.com$/.test(url.hostname)) throw new Error('Caption URL unavailable');
      const response = await fetch(url, { headers: cookie ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Caption HTTP ${response.status}`);
      result.vtt = await response.text();
      if (!result.vtt.includes('-->')) throw new Error('Caption response unavailable');
    }
  }
  if (operation === 'download') {
    // Resolution first, codec only as a tie-breaker. Select explicit itags so adaptive tracks are never
    // mistaken for a complete video. The parent muxes and probes both streams.
    const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])];
    const videos = rankYouTubeVideos(formats);
    const audios = formats.filter((item) => item.has_audio && !item.has_video).sort((a, b) => Number(b.is_original) - Number(a.is_original) || Number(b.mime_type.includes('mp4a')) - Number(a.mime_type.includes('mp4a')) || b.bitrate - a.bitrate);
    const combined = !audios[0] && videos.find((item) => item.has_audio);
    if (!videos[0] || (!audios[0] && !combined)) throw new Error('Missing video stream or audio');
    result.combined = Boolean(combined);
    for (const [name, format] of combined ? [['combined', combined]] : [['video', videos[0]], ['audio', audios[0]]]) {
      const stream = await info.download({ itag: format.itag, type: name === 'combined' ? 'video+audio' : name, format: 'any' });
      await pipeline(Readable.fromWeb(stream), createWriteStream(path.join(directory, `${name}.media`), { flags: 'wx', mode: 0o600 }));
    }
  }
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(youtubeFailure(error)); process.exitCode = 1;
}
