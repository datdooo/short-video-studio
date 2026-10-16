import test from 'node:test';
import assert from 'node:assert/strict';
import { windowsEnvironment } from './windows-config.mjs';
test('Windows paths, fonts and binary names never reference the developer Mac', () => {
  const result = windowsEnvironment('C:\\Users\\Test User\\AppData\\Local\\ShortCut Studio\\runtime\\abc', { LOCALAPPDATA: 'C:\\Users\\Test User\\AppData\\Local', Path: 'C:\\Windows\\System32', SystemRoot: 'C:\\Windows' });
  assert.equal(result.env.FFMPEG_PATH.endsWith('runtime\\bin\\ffmpeg.exe'), true);
  assert.equal(result.env.WHISPER_PATH.endsWith('whisper-cli.exe'), true);
  assert.equal(result.env.CHATGPT_CREDENTIAL_HELPER.endsWith('chatgpt-credential-store.exe'), true);
  assert.ok(result.env.PATH.includes(';C:\\Windows\\System32'));
  assert.equal(result.env.Path, undefined);
  assert.ok(result.fontXml.includes('C:/Windows/Fonts'));
  assert.ok(!JSON.stringify(result).includes('/Users/datdo'));
  assert.ok(result.dataRoot.endsWith('ShortCut Studio\\media'));
});
test('Windows bootstrap rejects missing local application data', () => {
  assert.throws(() => windowsEnvironment('C:\\App', {}), /LOCALAPPDATA/);
});
