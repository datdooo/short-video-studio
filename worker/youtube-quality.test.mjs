import test from 'node:test';
import assert from 'node:assert/strict';
import { rankYouTubeVideos, upscaleDimensions, YOUTUBE_SORT } from './youtube-quality.mjs';

const video = (height, codec, width = height * 16 / 9) => ({ has_video: true, height, width, mime_type: codec, bitrate: 100 });
test('1080p VP9 wins over 360p AVC; AVC wins only at equal resolution', () => {
  const hd = video(1080, 'vp9');
  assert.equal(rankYouTubeVideos([video(360, 'avc1'), hd, video(2160, 'avc1')])[0], hd);
  assert.equal(rankYouTubeVideos([hd, video(1080, 'avc1')])[0].mime_type, 'avc1');
  assert.equal(YOUTUBE_SORT.split(',')[0], 'res:1080');
});
test('lower-resolution sources select highest available; only higher formats still work', () => {
  assert.equal(rankYouTubeVideos([video(360, 'avc1'), video(720, 'vp9')])[0].height, 720);
  assert.equal(rankYouTubeVideos([video(2160, 'vp9')])[0].height, 2160);
  assert.deepEqual(rankYouTubeVideos([{ has_audio: true }]), []);
});
test('upscale 360p and 720p to 1920x1080 without stretching other ratios', () => {
  assert.deepEqual(upscaleDimensions(640, 360), { width: 1920, height: 1080 });
  assert.deepEqual(upscaleDimensions(1280, 720), { width: 1920, height: 1080 });
  assert.deepEqual(upscaleDimensions(640, 480), { width: 1440, height: 1080 });
  assert.deepEqual(upscaleDimensions(360, 640), { width: 608, height: 1080 });
  assert.equal(upscaleDimensions(1920, 1080), null);
  assert.equal(upscaleDimensions(3840, 2160), null);
});
