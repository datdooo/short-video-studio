import {mainRanges,permittedHookRanges,hookDurationLimits,hookCandidates,HOOK_SELECTION_POLICY} from './teaser-hooks.mjs';
import {partContextWindows} from './teaser-candidates.mjs';
import {validateHeatmap} from './source-context/heatmap.mjs';
const clean=(s,max)=>String(s||'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,max);
// Shared text input for native ChatGPT and manual Gemini/Muse context.
export function hookInput(part, source, cues = [], supporting = {}, searchPhase = 0) {
  const allRanges = mainRanges(part), ranges=allRanges.slice(0,200), permitted=permittedHookRanges(part).slice(0,200);
  const available = cues.slice(0, 20_000).filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && ranges.some((s) => c.start < s.end && c.end > s.start));
  const cueIds=new Map(cues.map((c,i)=>[c,`cue-${i}`]));
  const bounded = available.length > 120 ? Array.from({ length: 120 }, (_, i) => available[Math.floor(i * available.length / 120)]) : available;
  const heatmap = validateHeatmap(supporting.heatmap, { durationMs: Math.round(source.duration * 1000) });
  const relevantBins = heatmap?.status === 'available' ? heatmap.bins.filter(b => ranges.some(r => b.startMs < r.end * 1000 && b.endMs > r.start * 1000)) : [];
  // Bounded evidence summary; actual peak proposals are built by hookCandidates.
  const replayBins = relevantBins.length > 24 ? Array.from({ length: 24 }, (_, i) => relevantBins[Math.floor(i * relevantBins.length / 24)]) : relevantBins;
  return { sourceTitle: clean(source.title, 500), partTitle: clean(part.title, 500), partContext: clean(part.hook, 500), partId: part.id,
    durationLimits:hookDurationLimits(),contextWindows:partContextWindows(ranges,cues),transcriptCandidates:hookCandidates(part,cues,undefined,{...supporting,searchPhase,heatmap,sourceDurationMs:Math.round(source.duration*1000)}),selectionPolicy:HOOK_SELECTION_POLICY,mainContentRanges:allRanges.map(({start,end})=>({start,end})),excludedMainPresentationSeconds:10,permittedHookRanges:permitted,
    allowedRanges: permitted.map(({ start, end }) => ({ start, end })),
    transcript: bounded.map((c) => ({ cueId:cueIds.get(c),start: c.start, end: c.end, text: clean(c.text, 500),timing:c.timing||'cue' })),
    untimedTranscript: available.length ? "" : clean(source.transcript, 6000),
    supporting: { ...(replayBins.length ? { heatmap: { timeline: 'source', timeUnit: 'ms', intensitySemantics: 'relative-replay-interest', bins: replayBins } } : {}), chapters: Array.isArray(supporting.chapters) ? supporting.chapters.slice(0, 20).map((c) => ({ startMs: c.startMs, endMs: c.endMs, title: clean(c.title, 100) })) : [],
      speechSilences: supporting.audioSignals?.status==='available'?supporting.audioSignals.silences.filter(s=>ranges.some(r=>s.start<r.end&&s.end>r.start)).slice(0,240):[], description: clean(supporting.description, 1500), commentClusters: Array.isArray(supporting.commentClusters) ? supporting.commentClusters.filter((c) => ranges.some((r) => c.centerMs / 1000 >= r.start && c.centerMs / 1000 <= r.end)).slice(0, 12).map((c) => ({ centerMs: c.centerMs, score: c.score })) : [] },
    missing: [...(!available.length ? ["No timestamped transcript; do not infer speech/audio meaning."] : []), ...(available.length > 120 || allRanges.length > 200 || cues.length > 20_000 ? ["Context was bounded/sampled."] : [])],
  };
}
