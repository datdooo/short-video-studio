import path from 'node:path';

export function windowsEnvironment(resources, current) {
  const p = path.win32;
  if (!current.LOCALAPPDATA || !p.isAbsolute(current.LOCALAPPDATA)) throw new Error('LOCALAPPDATA must be an absolute Windows path.');
  const appRoot = p.join(resources, 'app');
  const dataRoot = p.join(current.LOCALAPPDATA, 'ShortCut Studio', 'media');
  const bin = p.join(resources, 'runtime', 'bin');
  const fontConfig = p.join(dataRoot, 'fontconfig.xml');
  const escape = (value) => value.replaceAll('\\', '/').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const fontXml = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${escape(p.join(appRoot, 'public'))}</dir><dir>${escape(p.join(current.SystemRoot || 'C:\\Windows', 'Fonts'))}</dir><cachedir>${escape(p.join(dataRoot, 'cache', 'fontconfig'))}</cachedir></fontconfig>`;
  // PATH keys are case-insensitive on Windows; Node must receive only one.
  const inheritedPath = current.PATH || current.Path || '';
  const env = Object.fromEntries(Object.entries(current).filter(([key]) => key.toLowerCase() !== 'path'));
  Object.assign(env, { PATH: `${bin};${inheritedPath}`, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '5173', MEDIA_WORKER_PORT: '8787', MEDIA_WORKER_DATA_DIR: dataRoot,
    FFMPEG_PATH: p.join(bin, 'ffmpeg.exe'), FFPROBE_PATH: p.join(bin, 'ffprobe.exe'), WHISPER_PATH: p.join(bin, 'whisper-cli.exe'), YT_DLP_PATH: p.join(bin, 'yt-dlp.exe'), CHATGPT_CREDENTIAL_HELPER: p.join(bin, 'chatgpt-credential-store.exe'), FONTCONFIG_FILE: fontConfig });
  return { appRoot, dataRoot, fontConfig, fontXml, env };
}
