import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMainCandidates, deterministicMainSelection, selectionToPlan, assertMainLocks } from './auto-cut/main-content.mjs';
import { normalizeSourceContext } from './source-context/index.mjs';
import { validatePlan } from '../worker/plan-validation.mjs';
const source = { id:'local-test', kind:'upload', title:'Harvest result', duration:200 };
const context = normalizeSourceContext({ kind:'local', sourceId:source.id, title:source.title, duration:200 });
const cues = Array.from({length:20},(_,i) => ({ start:i*10,end:i*10+9.5,text:i>10?'Harvest result.':'Prepare soil.' }));
export const goodSelection = input => ({ recipeId:input.recipes[0].id, language:'en', parts:[1,2].map(id => ({ id,title:`Harvest ${id}`,hook:'Harvest result.',reason:'Introduces preparation and the result.',hashtags:Array.from({length:10},(_,i)=>`#tag${i}`),exclusions:[] })) });
test('bounded deterministic candidates use complete cue boundaries, preserve chronology and expose actual bounded contributions', () => {
  const input = generateMainCandidates(source,context,{cues});
  assert.deepEqual(input,generateMainCandidates(source,context,{cues})); assert.ok(input.recipes.length<=48);
  for(const r of input.recipes){assert.ok(r.windows[0].end<=r.windows[1].start);assert.ok(r.score>=0&&r.score<=1);assert.ok(!cues.some(c=>r.windows[1].start>c.start&&r.windows[1].start<c.end));}
  const plan = selectionToPlan(input,goodSelection(input)); validatePlan(plan,source);
  assert.equal(plan.parts.length,2);assert.ok(plan.parts.every(p=>p.startTrimApplied&&p.smartCutApplied));
});
test('relative engagement shares one budget and missing/invalid/source-mismatched signals do not fabricate evidence', () => {
  const input = generateMainCandidates(source,context,{cues});
  assert.ok(input.recipes.every(r=>r.windows.every(w=>!w.signals.engagement)));
  assert.throws(()=>generateMainCandidates({...source,id:'other'},context),/another source/);
  assert.throws(()=>generateMainCandidates({...source,duration:10},context),/at least 16/);
  const replay = { ...context, comments:{status:'available',comments:[],clusters:[{centerMs:90000,centerFormatted:'1:30',startMs:90000,endMs:90000,mentionCount:1,commentCount:1,distinctAuthorCount:1,score:1,supportingCommentIds:[]}],provenance:{source:'fixture',extractedAt:'fixture',fields:{}}}, heatmap:{status:'available',timeline:'source',timeUnit:'ms',intensitySemantics:'relative-replay-interest',bins:[{startMs:0,endMs:200000,intensity:1}],provenance:{source:'fixture',extractedAt:'fixture',fields:{}}} };
  // local heatmap is intentionally disabled; test the engagement budget with YouTube.
  const yt={...source,kind:'youtube',sourceUrl:'https://youtu.be/BaW_jenozKc'};
  const c={...replay,source:{...replay.source,kind:'youtube',url:yt.sourceUrl},metadata:{...replay.metadata,videoId:'BaW_jenozKc'}};
  const all=generateMainCandidates(yt,c,{cues});assert.ok(all.recipes.every(r=>r.windows.every(w=>(w.signals.engagement?.contribution||0)<=.15)));
});
test('no-speech and short sources retain real main occurrences with explicitly labeled padding and fallback',()=>{
  const input=generateMainCandidates(source,context);const plan=deterministicMainSelection(input);validatePlan(plan,source);assert.equal(plan.analysis.method,'deterministic-fallback');
  const short={...source,duration:40}, c=normalizeSourceContext({kind:'local',sourceId:source.id,title:source.title,duration:40});
  const padded=deterministicMainSelection(generateMainCandidates(short,c));validatePlan(padded,short);
  assert.ok(padded.parts.every(p=>p.segments.some(s=>s.isPadding)));assert.ok(padded.parts.every(p=>p.segments.every(s=>s.start>=0&&s.end<=40)));
});
test('manual locks survive selection unchanged, impossible locks fail clearly and model exclusions are boundary validated',()=>{
  const input=generateMainCandidates(source,context,{cues}), plan=deterministicMainSelection(input);plan.parts[0].manualLocked=true;
  const locked=generateMainCandidates(source,context,{cues,currentPlan:plan});const result=selectionToPlan(locked,goodSelection(locked),{currentPlan:plan});assert.deepEqual(result.parts[0],plan.parts[0]);assertMainLocks(result,plan);
  const impossible=structuredClone(plan); impossible.parts[0].segments=[{start:1,end:199}];assert.throws(()=>generateMainCandidates(source,context,{cues,currentPlan:impossible}),/No chronological/);
  const bad=goodSelection(input);bad.parts[0].exclusions=[{start:3.14159,end:7,reason:'untrusted'}];assert.throws(()=>selectionToPlan(input,bad),/boundary/);
  bad.recipeId='arbitrary';assert.throws(()=>selectionToPlan(input,bad),/supplied recipe/);
});

test('serialized plan/cache analysis cannot forge units/source/probability-like contributions or crash consumer UI',()=>{
 const plan=deterministicMainSelection(generateMainCandidates(source,context,{cues}));validatePlan(plan,source);
 for(const mutate of [p=>{p.analysis.sourceId='another';},p=>{p.analysis.parts[0].signals.transcript.contribution=2;},p=>{p.analysis.parts[0].signals.transcript.contribution='0.2';},p=>{p.analysis.parts='bad';},p=>{p.analysis.structural.balance=Infinity;}]){const bad=structuredClone(plan);mutate(bad);assert.throws(()=>validatePlan(bad,source),/analysis metadata/);}
});

test('manual range edits invalidate only changed-part evidence and keep the other part cache/provenance intact',async()=>{
 const {applyPartTimes}=await import('./custom-time.mjs');const plan=deterministicMainSelection(generateMainCandidates(source,context,{cues}));
 const next=applyPartTimes(plan,[{start:String(plan.parts[0].segments[0].start+1),end:String(plan.parts[0].segments.at(-1).end)},{start:String(plan.parts[1].segments[0].start),end:String(plan.parts[1].segments.at(-1).end)}],source.duration);
 assert.deepEqual(next.analysis.parts[0].signals,{});assert.deepEqual(next.analysis.parts[1],plan.analysis.parts[1]);assert.equal(next.parts[0].manualLocked,true);assert.notEqual(plan.analysis.recipeId,'manual-customized');validatePlan(next,source);
});

test('near-identical recipe pairs are suppressed after deterministic ranking, not merely exact-ID dedupe',()=>{
 const dense=Array.from({length:200},(_,i)=>({start:i,end:i+.8,text:'A complete sentence.'}));const input=generateMainCandidates(source,context,{cues:dense});
 const iou=(a,b)=>{const x=Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start));return x/(a.end-a.start+b.end-b.start-x);};
 for(let i=0;i<input.recipes.length;i++)for(let j=i+1;j<input.recipes.length;j++)assert.ok(!input.recipes[i].windows.every((w,k)=>iou(w,input.recipes[j].windows[k])>=.96));
});
