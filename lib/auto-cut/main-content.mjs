import {CONTENT_LANGUAGE_SCHEMA,CONTENT_LANGUAGE_INSTRUCTIONS,assertContentLanguage,normalizeLanguageCode} from '../content-language.mjs';
import {MAIN_EDITING_CRITERIA,MAIN_EDITING_VERSION,MAIN_RANGE_REASON_DESCRIPTION,mainInstruction} from '../main-instructions.mjs';
import {validSourceRange} from '../source-ranges.mjs';
import {EXPLANATION_INSTRUCTIONS} from '../explanation-language.mjs';
import {lockedParts,assertMainLocks} from './locks.mjs';
import { normalizeLocalSignals } from './local-signals.mjs';
import { sentenceBoundaries } from './boundaries.mjs';
import { normalizeSourceContext, computeSourceCacheKey } from '../source-context/index.mjs';
import { CANVAS_WIDTH, CANVAS_HEIGHT, BACKGROUND_BLUR, BACKGROUND_OPACITY, FOREGROUND_SCALE, PLAYBACK_RATE } from '../render-config.mjs';
import { trimPartStart } from '../../worker/part-start.mjs';
export const MAIN_ANALYSIS_VERSION = MAIN_EDITING_VERSION;
export const MAX_RECIPES = 48;
export const MAX_CUES = 20000;
const MIN_FOOTAGE = 60 * PLAYBACK_RATE + 1.5; // >60s AFTER the existing one-second trim.
const clean = (v, n = 500) => typeof v === 'string' ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, n) : '';
const round = n => Math.round(n * 1000) / 1000;
const clamp = n => Math.max(0, Math.min(1, n));
const overlap = (a, b) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
const sample = (a, n) => a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.floor(i * a.length / n)]);
export const mainRanges = part => part.segments.filter(s => !s.isPadding);
export {lockedParts,assertMainLocks} from './locks.mjs';
function tokens(text) {
  return new Set(Array.from(new Intl.Segmenter('und', { granularity: 'word' }).segment(text.toLocaleLowerCase())).filter(s => s.isWordLike).map(s => s.segment).slice(0, 200));
}
function evidenceFor(range, context, cues, instruction, local) {
  const relevant = cues.filter(c => overlap(range, c));
  const words = tokens(relevant.map(c => c.text).join(' ').slice(0, 16000));
  const query = tokens(`${context.metadata.title} ${instruction}`), matches = [...query].filter(w => words.has(w));
  const signals = {};
  if (relevant.length) signals.transcript = { contribution: .2 * (query.size ? matches.length / query.size : 0), evidence: relevant.slice(0, 3).map(c => round(c.start)), detail: 'Lexical overlap only; semantic relevance requires AI/editorial review.' };
  const chapters = context.chapters.filter(c => overlap(range, { start: c.startMs / 1000, end: c.endMs / 1000 }));
  if (chapters.length) signals.chapters = { contribution: .1 * Number(chapters.some(c => Math.abs(c.startMs / 1000 - range.start) <= 2.5)), evidence: chapters.slice(0, 4).map(c => round(c.startMs / 1000)), detail: 'Chapter-aligned entry.' };
  const clusters = context.comments?.status === 'available' ? context.comments.clusters.filter(c => c.centerMs / 1000 >= range.start && c.centerMs / 1000 < range.end) : [];
  const bins = context.heatmap?.status === 'available' ? context.heatmap.bins.map(b => ({ start: b.startMs / 1000, end: b.endMs / 1000, value: b.intensity })).filter(b => overlap(range, b)) : [];
  const observed = bins.reduce((n, b) => n + overlap(range, b), 0);
  // Correlated engagement evidence shares ONE 0.15 budget: max, never sum.
  if (clusters.length || bins.length) signals.engagement = { contribution: .15 * Math.max(...clusters.map(c => clamp(c.score)), observed ? bins.reduce((n, b) => n + overlap(range, b) * b.value, 0) / observed : 0),
    evidence: [...clusters.slice(0, 3).map(c => c.centerMs / 1000), ...bins.slice(0, 3).map(b => b.start)].map(round),
    detail: `max(comment clusters, relative replay interest); ${bins.length} replay bins/${clusters.length} clusters. Not retention/viewer counts.` };
  const scenes = local?.visual?.status === 'available' ? local.visual.boundaries.filter(b => b.time >= range.start && b.time < range.end) : [];
  const changes = local?.visual?.status === 'available' ? local.visual.activity.filter(b => overlap(range,b)) : [];
  if (scenes.length || changes.length) signals.visual = { contribution: .05 * Math.max(...scenes.map(b => clamp(b.change)), changes.length ? changes.reduce((n,b)=>n+b.change,0)/changes.length : 0), evidence: scenes.slice(0, 4).map(b => b.time), detail: 'Scene/luma change proxy, not action/emotion recognition.' };
  const activity = local?.audio?.status === 'available' ? local.audio.activity.filter(b => overlap(range, b)) : [];
  if (activity.length) signals.audio = { contribution: .05 * activity.reduce((n, b) => n + clamp(b.activity), 0) / activity.length, evidence: activity.slice(0, 4).map(b => b.start), detail: 'Local audio activity proxy, not semantic or emotional intensity.' };
  return Object.fromEntries(Object.entries(signals).map(([k, v]) => [k, { ...v, contribution: round(v.contribution) }]));
}

export function generateMainCandidates(source, rawContext, options = {}) {
  if (!source?.id || !Number.isFinite(source.duration) || source.duration < 16) throw new Error('Source needs at least 16 seconds for two independent main ranges and hooks.');
  const context = normalizeSourceContext(rawContext);
  const duration = Math.floor(source.duration * 1000) / 1000, expected = computeSourceCacheKey({ kind: context.source.kind, id: source.id, url: source.sourceUrl, durationSeconds: duration });
  if (computeSourceCacheKey(context) !== expected) throw new Error('SourceContext belongs to another source/duration.');
  if (options.local) options = { ...options, local: normalizeLocalSignals(options.local, {duration,sourceKey:options.localSourceKey}) };
  const cues = (options.cues || []).slice(0, MAX_CUES).filter(c => Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start && c.end <= duration && typeof c.text === 'string').sort((a,b) => a.start - b.start);
  const boundaryCues = (options.boundaryCues || cues).slice(0,MAX_CUES).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start).sort((a,b)=>a.start-b.start);
  const sentence = sentenceBoundaries(boundaryCues);
  // Never snap a main boundary into the interior of a known cue.
  const prefixEnd = []; let maximumEnd = 0;
  for (const c of boundaryCues) { maximumEnd = Math.max(maximumEnd,c.end); prefixEnd.push(maximumEnd); }
  const safe = time => { let low=0, high=boundaryCues.length;
    while(low<high){const middle=(low+high)>>>1;if(boundaryCues[middle].start < time-.01)low=middle+1;else high=middle;}
    return !low || prefixEnd[low-1] <= time+.01;
  };
  const boundaries = [...new Set([0, duration, ...sentence.starts, ...sentence.ends,
    ...context.chapters.map(c => c.startMs / 1000), ...(options.local?.visual?.boundaries || []).map(b => b.time)]
    .filter(t => Number.isFinite(t) && t >= 0 && t <= duration && safe(t)).map(round))].sort((a,b) => a - b);
  const minimum = Math.min(MIN_FOOTAGE, duration / 2), low = minimum, high = duration - minimum;
  let splits = options.forcedSplit !== undefined ? [options.forcedSplit] : sample(boundaries.filter(t => t >= low && t <= high), 32);
  if (!splits.length) {
    const edges = cues.flatMap(c => [c.start, c.end]).filter(t => t >= 8 && t <= duration - 8 && safe(t));
    splits = [edges.sort((a,b) => Math.abs(a - duration / 2) - Math.abs(b - duration / 2) || a - b)[0] ?? round(duration / 2)];
  }
  const locks = lockedParts(options.currentPlan);
  const entries = sample(boundaries.filter(t => t <= Math.min(45, duration * .15) && t <= duration - 16), 4);
  const recipes = [], seen = new Set();
  for (const entry of entries) for (const split of splits) {
    let ranges = [{ start: entry, end: split }, { start: split, end: duration }];
    for (let i = 0; i < 2; i++) if (locks[i]) { const m = mainRanges(options.currentPlan.parts[i]); ranges[i] = { start: m[0].start, end: m.at(-1).end }; }
    if (ranges.some((r,i) => r.end<=r.start || (!locks[i]&&r.end-r.start<8) || r.start<0 || r.end>duration) || ranges[1].start < ranges[0].end) continue;
    if (duration >= MIN_FOOTAGE * 2 && ranges.some((r, i) => !locks[i] && r.end - r.start < MIN_FOOTAGE)) continue;
    const id = ranges.map(r => `${Math.round(r.start * 1000)}-${Math.round(r.end * 1000)}`).join('_');
    if (seen.has(id)) continue; seen.add(id);
    const windows = ranges.map(r => ({ ...r, text: clean(sample(cues.filter(c => overlap(r,c)), 8).map(c => c.text).join(' '), 1000), signals: evidenceFor(r, context, cues, options.instruction || '', options.local) }));
    const coverage = (ranges[0].end - ranges[0].start + ranges[1].end - ranges[1].start) / duration;
    const balance = Math.min(...ranges.map(r => r.end - r.start)) / Math.max(...ranges.map(r => r.end - r.start));
    const score = round(clamp(.25 * coverage + .2 * balance + windows.reduce((n,w) => n + Object.values(w.signals).reduce((s,v) => s + v.contribution,0), 0) / 2));
    recipes.push({ id, windows, score, structural: { coverage: round(coverage), balance: round(balance) }, boundaryLimitations: splits.some(t => !boundaries.includes(t)) ? ['No known complete sentence/scene boundary at the split; boundary review required.'] : [] });
  }
  // A single locked part may require a split absent from the sampled set.
  if (!recipes.length && locks.some(Boolean) && !options._lockRetry) {
    const forced = locks[0] ? mainRanges(options.currentPlan.parts[0]).at(-1).end : mainRanges(options.currentPlan.parts[1])[0].start;
    return generateMainCandidates(source, context, { ...options, _lockRetry: true, cues: [...cues, { start: forced, end: forced, text: '' }], forcedSplit: forced });
  }
  // Recipes remain optional suggestions; new AI output may choose any valid source ranges.
  recipes.sort((a,b) => b.score - a.score || Math.abs(a.windows[0].end - duration / 2) - Math.abs(b.windows[0].end - duration / 2) || a.id.localeCompare(b.id));
  const distinct=[];
  for(const recipe of recipes){if(!distinct.some(prior=>recipe.windows.every((w,i)=>{const p=prior.windows[i],intersection=overlap(w,p),union=w.end-w.start+p.end-p.start-intersection;return union>0&&intersection/union>=.96;})))distinct.push(recipe);if(distinct.length===MAX_RECIPES)break;}
  return { version: MAIN_ANALYSIS_VERSION, sourceId: source.id, sourceKey: computeSourceCacheKey(context), timeUnit: 'source-seconds', duration,
    sourceTitle: clean(source.title), instruction: clean(options.instruction, 6000), supplementalPrompt: clean(options.supplementalPrompt, 6000),
    transcript:sample(cues,96).map(c=>({start:c.start,end:c.end,text:clean(c.text,200)})),
    description: clean(context.metadata.description, 2000), chapters: context.chapters.slice(0, 40), recipes: distinct,
    boundaries, lockedParts: locks, lockedRanges: locks.map((v,i) => v ? options.currentPlan.parts[i].segments : null),
    missing: [...(!cues.length ? ['No timestamped transcript; semantic/sentence evidence unavailable.'] : []), ...(context.heatmap?.status !== 'available' ? ['Most Replayed unavailable; no replay score fabricated.'] : []),
      ...(options.local ? [`Local audio analysis covers ${round((options.local.audio.sampledRanges||options.local.sampledRanges).reduce((n,r)=>n+r.end-r.start,0))}/${duration} source seconds; scene/luma analysis samples ${round((options.local.visual.sampledRanges||options.local.sampledRanges).reduce((n,r)=>n+r.end-r.start,0))}/${duration}; unsampled events are unknown.`, ...[options.local.visual.reason,options.local.audio.reason].filter(Boolean)] : ['Local scene/audio evidence unavailable.'])] };
}
export const MAIN_SCHEMA={type:'object',additionalProperties:false,properties:{language:CONTENT_LANGUAGE_SCHEMA,parts:{type:'array',minItems:2,maxItems:2,items:{type:'object',additionalProperties:false,properties:{id:{type:'integer'},title:{type:'string'},hook:{type:'string'},reason:{type:'string'},hashtags:{type:'array',minItems:10,maxItems:10,items:{type:'string'}},segments:{type:'array',minItems:1,maxItems:200,items:{type:'object',additionalProperties:false,properties:{start:{type:'number'},end:{type:'number'},label:{type:'string'},reason:{type:'string',description:MAIN_RANGE_REASON_DESCRIPTION},isPadding:{type:'boolean'}},required:['start','end','label','reason','isPadding']}}},required:['id','title','hook','reason','hashtags','segments']}}},required:['language','parts']};
export const MAIN_INSTRUCTIONS=`${EXPLANATION_INSTRUCTIONS}
${CONTENT_LANGUAGE_INSTRUCTIONS}
${MAIN_EDITING_CRITERIA}
Return the exact retained segments for each part, not recipeId/exclusions. Every newly selected segment must have isPadding:false; preserved locked padding must stay unchanged. The minimum length per part is the MINIMUM EXPORT LENGTH rule; no repeated-footage padding. Assess joins within this SAME request; no additional analysis call. Part-level reason summarizes the opening and retained development in Vietnamese. Preserve the detailed between-part/tail omission explanations in the final retained segment.reason of the relevant part as specified above; do not replace them with a short thematic highlight summary. Use global cue-N evidence when explaining, without copying the transcript repeatedly.`;
function editorialSelectionToPlan(input,selection,{currentPlan,provider,model}){
 if(!selection||!normalizeLanguageCode(selection.language)||!Array.isArray(selection.parts)||selection.parts.length!==2)throw Error('MAIN_SELECTION_SCHEMA_INVALID');
 const language=assertContentLanguage(selection.language,input.sourceLanguage);
 let previousEnd=0;
 const parts=selection.parts.map((p,i)=>{
  if(p.id!==i+1||typeof p.title!=='string'||!p.title.trim()||typeof p.reason!=='string'||!p.reason.trim()||!Array.isArray(p.hashtags)||p.hashtags.length!==10||new Set(p.hashtags.map(t=>String(t).toLowerCase())).size!==10||p.hashtags.some(t=>typeof t!=='string'||!/^#[^#\s]{1,79}$/u.test(t))||!Array.isArray(p.segments)||!p.segments.length||p.segments.length>200)throw Error(`Part ${i+1}: main sai metadata/range theo schema.`);
  if(input.lockedParts[i]){const locked=currentPlan.parts[i];if(JSON.stringify(p.segments.map(s=>[s.start,s.end,s.isPadding===true]))!==JSON.stringify(locked.segments.map(s=>[s.start,s.end,s.isPadding===true])))throw Error(`Part ${i+1}: AI đã thay main chỉnh tay.`);previousEnd=mainRanges(locked).at(-1).end;return structuredClone(locked);}
  for(const [j,s]of p.segments.entries()){if(!validSourceRange(s,input.duration)||s.start<previousEnd||s.isPadding!==false||typeof s.label!=='string'||!s.label.trim()||typeof s.reason!=='string'||!s.reason.trim())throw Error(`Part ${i+1}, range ${j+1}: mốc nguồn/thứ tự/padding không hợp lệ; không tự sửa.`);previousEnd=s.end;}
  return{id:i+1,title:clean(p.title,200),hook:clean(p.hook),hashtags:p.hashtags,segments:structuredClone(p.segments),startTrimApplied:true,smartCutApplied:true};
 });
 const lengths=parts.map(p=>mainRanges(p).reduce((n,s)=>n+s.end-s.start,0));
 const result={originalTitle:input.sourceTitle,language,providerUsed:provider,parts,render:{width:CANVAS_WIDTH,height:CANVAS_HEIGHT,speed:PLAYBACK_RATE,foregroundScale:FOREGROUND_SCALE,preservePitch:true,backgroundBlur:BACKGROUND_BLUR,backgroundOpacity:BACKGROUND_OPACITY},analysis:{version:MAIN_ANALYSIS_VERSION,sourceId:input.sourceId,sourceKey:input.sourceKey,method:'ai',provider,model,recipeId:'editorial-source-ranges-v3',scoreSemantics:'Optional recipe heuristics are not an editorial quality score.',structural:{coverage:Math.min(1,lengths.reduce((a,b)=>a+b,0)/input.duration),balance:Math.min(...lengths)/Math.max(...lengths)},parts:parts.map((p,i)=>({id:p.id,reason:clean(selection.parts[i].reason,500),signals:{}})),limitations:[...input.missing,'Chỉ có text/tín hiệu số; AI chưa quan sát video hoặc nghe kiểm chứng mối nối.'].slice(0,12)}};
 assertMainLocks(result,currentPlan);return result;
}
function exclusionsToSegments(window, exclusions, boundaries) {
  let cursor = window.start; const segments = [];
  for (const x of exclusions) {
    if (![x.start,x.end].every(Number.isFinite) || x.start < cursor || x.end <= x.start || x.end > window.end || !boundaries.includes(x.start) || !boundaries.includes(x.end) || !clean(x.reason).trim()) throw new Error('Invalid or non-boundary exclusion.');
    if (x.start > cursor) segments.push({ start: cursor, end: x.start, label: 'Main content', reason: `Retained before exclusion: ${clean(x.reason)}`, isPadding: false });
    cursor = x.end;
  }
  if (cursor < window.end) segments.push({ start: cursor, end: window.end, label: 'Main content', reason: 'Continuous retained main content.', isPadding: false });
  return segments;
}
export function selectionToPlan(input, selection, { currentPlan, method = 'ai', provider = 'chatgpt', model = '', fallbackReason } = {}) {
  if(method==='ai')return editorialSelectionToPlan(input,selection,{currentPlan,provider,model});
  const recipe = input.recipes.find(r => r.id === selection?.recipeId);
  if (!recipe || !normalizeLanguageCode(selection.language) || selection.parts?.length !== 2) throw new Error('Selection must identify a supplied recipe and exactly two parts.');
  const language=assertContentLanguage(selection.language,input.sourceLanguage);
  const parts = selection.parts.map((p,i) => {
    if (input.lockedParts[i]) return structuredClone(currentPlan.parts[i]);
    if (p.id !== i + 1 || !clean(p.title).trim() || !Array.isArray(p.hashtags) || p.hashtags.length !== 10 || new Set(p.hashtags.map(t => String(t).toLowerCase())).size !== 10 || p.hashtags.some(t => typeof t !== 'string' || !/^#[^#\s]{1,79}$/u.test(t))) throw new Error('Invalid part metadata/hashtags.');
    if (!Array.isArray(p.exclusions) || p.exclusions.length > 8) throw new Error('Invalid exclusions.');
    const segments = exclusionsToSegments(recipe.windows[i], p.exclusions, input.boundaries);
    if (!segments.length) throw new Error('Exclusions removed all main content.');
    const part = trimPartStart({ id: i + 1, title: clean(p.title, 200), hook: clean(p.hook), hashtags: p.hashtags, segments });
    const mainDuration = part.segments.reduce((n,s) => n + s.end - s.start, 0);
    if (mainDuration / PLAYBACK_RATE <= 60) {
      // Preserve the established short-source padding contract; never manufacture footage.
      if (input.duration >= MIN_FOOTAGE * 2) throw new Error('Exclusions leave too little main footage; choose a longer valid recipe.');
      const main = mainRanges(part); let remaining = 75.1 - mainDuration;
      while (remaining > .0001 && part.segments.length < 32) { const s = main[(part.segments.length - main.length) % main.length]; const length = Math.min(remaining, s.end - s.start); part.segments.push({ ...s, end: round(s.start + length), isPadding: true, label: 'Supplemental repeat', reason: 'Explicit repeated footage from this part to meet the existing >60s output rule.' }); remaining -= length; }
      if (remaining > .01) throw new Error('Source/locks cannot satisfy minimum duration with bounded real padding.');
    }
    return { ...part, smartCutApplied: true };
  });
  const result = { originalTitle: input.sourceTitle, language, providerUsed: method === 'ai' ? provider : 'deterministic', parts,
    render: { width:CANVAS_WIDTH,height:CANVAS_HEIGHT,speed:PLAYBACK_RATE,foregroundScale:FOREGROUND_SCALE,preservePitch:true,backgroundBlur:BACKGROUND_BLUR,backgroundOpacity:BACKGROUND_OPACITY },
    analysis: { version: 'multi-signal-main-v1', sourceId: input.sourceId, sourceKey: input.sourceKey, method, provider: method === 'ai' ? provider : 'none', model: method === 'ai' ? model : '',
      ...(fallbackReason ? { fallbackReason } : {}), recipeId: recipe.id, scoreSemantics: 'bounded heuristic contributions; not probability', structural: recipe.structural,
      parts: recipe.windows.map((w,i) => ({ id:i+1, reason: clean(selection.parts[i].reason), signals: w.signals })), limitations: [...input.missing, ...recipe.boundaryLimitations] } };
  assertMainLocks(result,currentPlan); return result;
}
export function deterministicMainSelection(input, currentPlan, reason = 'AI unavailable; semantic/editorial relevance unverified.') {
  return selectionToPlan(input, { recipeId: input.recipes[0].id, language: normalizeLanguageCode(input.sourceLanguage)||'und', parts: [1,2].map(id => ({ id, title: `${input.sourceTitle} · Part ${id}`, hook: '', reason,
    hashtags: ['#video','#shorts','#shortvideo','#clip',`#part${id}`,'#sourcevideo','#videoclip','#verticalvideo','#videoedit','#story'], exclusions: [] })) }, { currentPlan, method:'deterministic-fallback', fallbackReason:reason });
}

export function externalPlanAnalysis(plan,source,context,options,input) {
  assertMainLocks(plan,options.currentPlan);
  return {...plan,analysis:{version:MAIN_ANALYSIS_VERSION,sourceId:source.id,sourceKey:input.sourceKey,method:'external-import',provider:plan.providerUsed,model:'web-model-self-reported',
    analysisKey:input.analysisKey,recipeId:'external-intentional-selection',scoreSemantics:'bounded heuristic evidence; external selection not automatically reranked',
    structural:{coverage:round(plan.parts.flatMap(mainRanges).reduce((n,r)=>n+r.end-r.start,0)/source.duration),balance:0},
    parts:plan.parts.map(p=>{const evidence=mainRanges(p).map(r=>evidenceFor(r,context,options.cues||[],options.instruction||'',options.local));const signals={};
      for(const name of new Set(evidence.flatMap(e=>Object.keys(e)))) {const entries=evidence.map(e=>e[name]).filter(Boolean);signals[name]={contribution:round(entries.reduce((n,e)=>n+e.contribution,0)/evidence.length),evidence:entries.flatMap(e=>e.evidence).slice(0,8),detail:entries[0].detail};}
      return{id:p.id,reason:clean(p.segments.map(s=>s.reason).join(' ')),signals};}),limitations:[...input.missing,'External web selection imported intentionally; provider/model self-reported, no automatic API capability implied.'],...(options.local?.cacheKey?{localCacheKey:options.local.cacheKey}:{})}};
}

// The catalog keeps explanations for UI/validation; provider input avoids repeating
// static prose 96 times and includes bounded timestamped transcript observations.
export function modelSelectionInput(input) {
 // The full canonical envelope owns transcript/metadata/user instructions.
 // Do not also send the legacy sampled/shortened representations beside it.
 const rest={...input};const {sourceEvidence,rawInstruction,instruction}=rest;
 for(const key of ['transcript','sourceEvidence','rawInstruction','instruction','supplementalPrompt','sourceTitle','description','chapters'])delete rest[key];
 const evidence=sourceEvidence?.userRequest?.instruction===MAIN_EDITING_CRITERIA?{...sourceEvidence,userRequest:{...sourceEvidence.userRequest,instruction:'Use the shared current MAIN editing policy in instructions (exact factory default; no additional user requirement).'}}:sourceEvidence;
 return {...rest,editorialRequestReference:'sourceEvidence.userRequest',instructionCompatibility:mainInstruction(rawInstruction??instruction).compatibility,sourceEvidence:evidence,
  // Keep every proposed location, but not the legacy balance/coverage ranking:
  // these two-window heuristics must not steer editorial A/B decisions.
  recipes:[...input.recipes].sort((a,b)=>a.windows[0].start-b.windows[0].start||a.windows[1].start-b.windows[1].start).map(r=>({id:r.id,windows:r.windows.map(w=>({start:w.start,end:w.end})),boundaryLimitations:r.boundaryLimitations})),
  recipePolicy:'Unranked source-location suggestions only. Select A/B from full source evidence; no balance objective; the MINIMUM EXPORT LENGTH rule still applies.'};
}
