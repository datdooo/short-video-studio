import { PLAYBACK_RATE, RENDER_FPS, segmentDuration } from "../render-config.mjs";

const presets = Object.freeze([
  Object.freeze({ id: "none", label: "None", durationMs: 0, color: "#000000", behavior: "none" }),
  Object.freeze({ id: "dip-black", label: "Dip Black", durationMs: 400, color: "#000000", behavior: "smooth-dip" }),
  Object.freeze({ id: "flash-white", label: "Flash White", durationMs: 400, color: "#ffffff", behavior: "smooth-dip" }),
  Object.freeze({ id: "rainbow-light-leak", label: "Rainbow", durationMs: 600, color: "#ffffff", behavior: "rainbow-screen" }),
  Object.freeze({ id: "vr-light-leak-v2", label: "Warm Light Leak", durationMs: 600, color: "#ffffff", behavior: "warm-cloud-screen" }),
]);
export const CUT_TRANSITION_IDS = Object.freeze(presets.map(({ id }) => id));
export function normalizeCutTransition(id) {
  if (id === undefined) return "none";
  if (typeof id !== "string" || !CUT_TRANSITION_IDS.includes(id)) throw new Error("Invalid cut transition id.");
  return id;
}
export function getCutTransition(id) { return { ...presets.find((preset) => preset.id === normalizeCutTransition(id)) }; }
export function listCutTransitions() { return CUT_TRANSITION_IDS.map(getCutTransition); }

// One part only. Coordinates are edited/output frames, derived from cumulative
// cut times rather than summing independently rounded segment durations.
export function resolveCutTransitions(id, segments) {
  const preset = getCutTransition(id);
  if (preset.id === "none") return [];
  if (!Array.isArray(segments)) throw new Error("Invalid cut transition segments.");
  let elapsed = 0;
  const edges = [0];
  for (const segment of segments) {
    const duration = segmentDuration(segment);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Invalid cut transition segment duration.");
    elapsed += duration;
    if (!Number.isFinite(elapsed) || elapsed / PLAYBACK_RATE * RENDER_FPS > Number.MAX_SAFE_INTEGER) throw new Error("Invalid cut transition timeline duration.");
    edges.push(Math.round(elapsed / PLAYBACK_RATE * RENDER_FPS));
  }
  const maximumHalf = Math.round(preset.durationMs / 2000 * RENDER_FPS);
  return edges.slice(1, -1).flatMap((cutFrame, index) => {
    // At most half either adjacent segment. Windows cannot overlap or reach part
    // endpoints. Sub-two-frame neighbors cannot support a safe half-window.
    const halfFrames = Math.min(maximumHalf, Math.floor((cutFrame - edges[index]) / 2), Math.floor((edges[index + 2] - cutFrame) / 2));
    return halfFrames < 1 ? [] : [{ boundary: index + 1, startFrame: cutFrame - halfFrames, cutFrame, endFrame: cutFrame + halfFrames, halfFrames }];
  });
}
export function cutTransitionPose(id, windows, seconds) {
  const preset = getCutTransition(id);
  const frame = Number.isFinite(seconds) ? seconds * RENDER_FPS : -1;
  let opacity = 0, color = preset.color;
  for (const window of windows) {
    const current = getCutTransition(window.presetId || id);
    const value = current.id === "none" || frame<=window.startFrame || frame>=window.endFrame ? 0 : Math.sin(Math.PI * Math.max(0,Math.min(1,(frame-window.startFrame)/(2*window.halfFrames)))) ** 2;
    if (value > opacity) { opacity = value; color = current.color; }
  }
  return { color, opacity };
}
