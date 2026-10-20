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
// Fit the source INSIDE the existing foreground first, then magnify its image
// 125% about the center. Never multiply raw source pixels or resize the viewport.
// Playback clocks are independent of this shared preview/export geometry.
export function foregroundGeometry(width, height) {
  const sourceWidth = Number.isFinite(width) && width > 0 ? width : 1920;
  const sourceHeight = Number.isFinite(height) && height > 0 ? height : 1080;
  const fit = Math.min(CANVAS_WIDTH / sourceWidth, FOREGROUND_HEIGHT / sourceHeight);
  const fittedWidth = sourceWidth * fit, fittedHeight = sourceHeight * fit;
  const scaledWidth = Math.max(2, Math.trunc(fittedWidth * FOREGROUND_SCALE / 2) * 2);
  const scaledHeight = Math.max(2, Math.trunc(fittedHeight * FOREGROUND_SCALE / 2) * 2);
  return { fittedWidth, fittedHeight, scaledWidth, scaledHeight, x: Math.max(0, (CANVAS_WIDTH - scaledWidth) / 2),
    y: Math.max(0, (FOREGROUND_HEIGHT - scaledHeight) / 2),
    width: Math.min(CANVAS_WIDTH, scaledWidth), height: Math.min(FOREGROUND_HEIGHT, scaledHeight) };
}
export function foregroundFilter(focus = '1') {
  // Use display aspect (including SAR) just like browser videoWidth/videoHeight.
  // Transparent padding still reveals the outside background, never black bars.
  const fit = `min(${CANVAS_WIDTH}/(iw*sar),${FOREGROUND_HEIGHT}/ih)`;
  return `scale=w='max(2,trunc(iw*sar*${fit}*${FOREGROUND_SCALE}*(${focus})/2)*2)':h='max(2,trunc(ih*${fit}*${FOREGROUND_SCALE}*(${focus})/2)*2)':eval=frame,setsar=1,format=rgba,pad=w='max(iw,${CANVAS_WIDTH})':h='max(ih,${FOREGROUND_HEIGHT})':x='(ow-iw)/2':y='(oh-ih)/2':color=black@0:eval=frame,crop=${CANVAS_WIDTH}:${FOREGROUND_HEIGHT}:(iw-${CANVAS_WIDTH})/2:(ih-${FOREGROUND_HEIGHT})/2`;
}
