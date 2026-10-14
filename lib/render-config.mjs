export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const PLAYBACK_RATE = 1.25;
export const FOREGROUND_SCALE = 1.25;
export const RENDER_FPS = 30;
export const FOREGROUND_BASE_HEIGHT = 1080;
export const FOREGROUND_HEIGHT = FOREGROUND_BASE_HEIGHT * FOREGROUND_SCALE;
export const FOREGROUND_Y = (CANVAS_HEIGHT - FOREGROUND_HEIGHT) / 2;
export const TITLE_SHINE_SECONDS = 5;
export const TITLE_SHINE_WIDTH = 160;
export const SUBTITLE_BOTTOM_SAFE_MARGIN = 420;
export const TITLE_LAYOUT = Object.freeze({
  original: Object.freeze({ top: 80, bottom: FOREGROUND_Y - 24 }),
  part: Object.freeze({ top: FOREGROUND_Y + FOREGROUND_HEIGHT + 24, bottom: 1780 }),
  maxFontSize: 70, minFontSize: 32, maxLines: 3, maxWidth: 900, lineSpacing: 4,
});
export const isStillSegment = (segment) => ['summary_card', 'freeze'].includes(segment.type);
export const segmentDuration = (segment) => isStillSegment(segment) ? segment.holdDuration : segment.end - segment.start;
export const timelineDuration = (segments) => segments.reduce((sum, segment) => sum + segmentDuration(segment), 0);
export function foregroundFilter(focus = '1') {
  // Native-size sources may be smaller than the foreground area. Transparent
  // padding reveals the existing blurred background instead of adding black bars.
  return `scale=w='trunc(iw*${FOREGROUND_SCALE}*(${focus})/2)*2':h=-2:eval=frame,format=rgba,pad=w='max(iw,${CANVAS_WIDTH})':h='max(ih,${FOREGROUND_HEIGHT})':x='(ow-iw)/2':y='(oh-ih)/2':color=black@0:eval=frame,crop=${CANVAS_WIDTH}:${FOREGROUND_HEIGHT}:(iw-${CANVAS_WIDTH})/2:(ih-${FOREGROUND_HEIGHT})/2`;
}
