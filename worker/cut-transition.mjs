import { normalizeCutTransition, resolveCutTransitions } from "../lib/visual-style/cut-transitions.mjs";
import { foregroundTransitionFilters } from "../lib/visual-style/foreground-transitions.mjs";

// Foreground RGBA ONLY, after source geometry and before background/text/scene
// composition. The caller supplies the one local sprite input, never a URL or
// arbitrary expression. Output windows and source-clock conversion are shared
// with preview; the renderer now supplies clockRate:1 on its final-output clock.
export function cutTransitionFilters(id, segments, windows = resolveCutTransitions(id, segments), {input="mainUnlit",output="main",spriteInput=2,clockRate=1}={}) {
  const ordinary=normalizeCutTransition(id);
  const active=windows.map(w=>({...w,presetId:normalizeCutTransition(w.presetId||ordinary)})).filter(w=>w.presetId!=="none");
  if(!active.length)return null;
  return foregroundTransitionFilters(input,output,active,spriteInput,1080,1350,clockRate);
}
