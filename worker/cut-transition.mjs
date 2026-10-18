import { getCutTransition, resolveCutTransitions } from "../lib/visual-style/cut-transitions.mjs";
import { PLAYBACK_RATE, RENDER_FPS } from "../lib/render-config.mjs";

// Preset colors and timing come only from trusted mappings. No audio, timestamp
// or user-supplied expression enters this adapter.
export function cutTransitionFilters(id, segments, windows = resolveCutTransitions(id, segments)) {
  if (!windows.length) return null;
  const seconds = (frame) => (frame / RENDER_FPS * PLAYBACK_RATE).toFixed(9);
  return "format=rgb24," + windows.flatMap((window) => { const preset = getCutTransition(window.presetId || id); return [
    `fade=t=out:st=${seconds(window.startFrame)}:d=${seconds(window.halfFrames)}:color=${preset.color}:enable='between(t,${seconds(window.startFrame)},${seconds(window.cutFrame)})'`,
    `fade=t=in:st=${seconds(window.cutFrame)}:d=${seconds(window.halfFrames)}:color=${preset.color}:enable='between(t,${seconds(window.cutFrame)},${seconds(window.endFrame)})'`,
  ]; }).join(",");
}
