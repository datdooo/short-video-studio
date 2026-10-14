export const YOUTUBE_FORMAT = 'bv[height<=1080]+ba/b[height<=1080]/bv+ba/b';
export const YOUTUBE_SORT = 'res:1080,vcodec:h264,acodec:aac';

export function rankYouTubeVideos(formats) {
  const videos = formats.filter((item) => item.has_video && item.height > 0);
  const withinLimit = videos.filter((item) => item.height <= 1080);
  return [...(withinLimit.length ? withinLimit : videos)].sort((a, b) =>
    b.height - a.height || b.width - a.width ||
    Number((b.mime_type || '').includes('avc1')) - Number((a.mime_type || '').includes('avc1')) || b.bitrate - a.bitrate);
}

// 16:9 becomes 1920x1080; other aspect ratios stay intact without stretching,
// cropping or adding black bars. Never shrink a source already above this size.
export function upscaleDimensions(width, height) {
  const factor = Math.min(1920 / width, 1080 / height);
  if (!Number.isFinite(factor) || factor <= 1) return null;
  return { width: Math.max(2, Math.round(width * factor / 2) * 2), height: Math.max(2, Math.round(height * factor / 2) * 2) };
}
