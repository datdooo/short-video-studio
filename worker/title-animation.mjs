import { normalizeTitleAnimation, TITLE_ANIMATION_SECONDS, TITLE_SLIDE_PIXELS, TITLE_POP_START_SCALE } from "../lib/visual-style/animations.mjs";
import { PLAYBACK_RATE, TITLE_SHINE_WIDTH, TITLE_SHINE_SECONDS } from "../lib/render-config.mjs";

// Runs before the exporter's final speed adjustment. All expressions are trusted
// constants, selected only by the bounded registry ID. Each part has its own graph.
export function titleAnimationFilters({ id, titleInput, shineInput, sceneInput, overlayFormat }) {
  id = normalizeTitleAnimation(id);
  if (id === "none") return null;
  const duration = TITLE_ANIMATION_SECONDS * PLAYBACK_RATE;
  const progress = `min(t/${duration},1)`;
  const shineX = `(1080-${TITLE_SHINE_WIDTH})*mod(t/${PLAYBACK_RATE},${TITLE_SHINE_SECONDS})/${TITLE_SHINE_SECONDS}`;
  const scale = `${TITLE_POP_START_SCALE}+(1-${TITLE_POP_START_SCALE})*${progress}`;
  const motion = id === "pop-in" ? `scale=w='round(1080*(${scale})/2)*2':h='round(1920*(${scale})/2)*2':eval=frame:flags=bilinear,` : "";
  const y = id === "slide-up" ? `(H-h)/2+${TITLE_SLIDE_PIXELS}*(1-${progress})` : "(H-h)/2";
  return [
    ...(sceneInput !== undefined ? [`[${sceneInput}:v]format=rgba[staticScene]`, `[layout][staticScene]overlay=0:0:shortest=1${overlayFormat}[animationLayout]`] : []),
    `[${titleInput}:v]format=rgba[titlecard]`,
    `[${shineInput}:v]format=rgba,crop=${TITLE_SHINE_WIDTH}:1920:x='${shineX}':y=0,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*max(0,1-abs(X-${TITLE_SHINE_WIDTH / 2})/${TITLE_SHINE_WIDTH / 2})'[shine]`,
    `[titlecard][shine]overlay=x='${shineX}':y=0:shortest=1:format=rgb[titleGroup]`,
    `[titleGroup]format=rgba,${motion}fade=t=in:st=0:d=${duration}:alpha=1[animatedTitles]`,
    `[${sceneInput !== undefined ? "animationLayout" : "layout"}][animatedTitles]overlay=x='(W-w)/2':y='${y}':shortest=1:eval=frame${overlayFormat}[titled]`,
  ];
}
