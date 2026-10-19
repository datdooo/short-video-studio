import test from 'node:test';import assert from 'node:assert/strict';
import {hookCandidates,chooseTeaserAlternative,adjustTeaserRange,validateTeaser,fallbackTeaser} from './teaser-hooks.mjs';
import {partContextWindows,candidateFrameTimes} from './teaser-candidates.mjs';
import {HOOK_INSTRUCTIONS,validateHookResponse,validateEditorialEvidence,replayEvidence} from './teaser-prompt.mjs';
import {normalizeHeatmap} from './source-context/index.mjs';
import {attachExternalHooks} from './teaser-import.mjs';
import {editorialFixture} from './teaser-test-fixture.mjs';
const part={id:1,title:'Mixed unknown',manualLocked:true,segments:[{start:0,end:1200}]};
const cues=Array.from({length:200},(_,i)=>({start:i*6,end:i*6+5,text:i===194?'A quiet discovery changes the interpretation.':`Complete neutral sentence ${i}.`}));
test('part-wide diversity covers late content and before/after interpretation; no English genre-quality keywords',()=>{
 const candidates=hookCandidates(part,cues);assert.ok(candidates.length>=6&&candidates.length<=12);assert.ok(candidates.some(c=>c.start>1100));assert.ok(candidates.every(c=>c.start>=12.5&&c.end-c.start<=11.25));
 const windows=partContextWindows(part.segments,cues);assert.ok(windows.flat().some(c=>c.start>1100));assert.ok(candidates.some(c=>c.before.length&&c.after.length));
 const frames=candidateFrameTimes(candidates);assert.equal(frames.length,9);assert.equal(new Set(frames.map(f=>f.candidateId)).size,3);
 assert.match(HOOK_INSTRUCTIONS,/mixed\/unknown/);assert.match(HOOK_INSTRUCTIONS,/quiet discovery/);assert.match(HOOK_INSTRUCTIONS,/ELIGIBILITY GATES/);
 assert.equal(fallbackTeaser(part,'no provider',cues).status,'unavailable','Many semantic choices do not silently collapse into earliest fallback');
});
test('no transcript exposes honest visual proposals; multilingual cue grouping is not semantic certification',()=>{
 const action=hookCandidates({segments:[{start:30,end:90}]},[]);assert.ok(action.length>=3);assert.ok(action.every(c=>c.kind==='visual-review'&&!c.text&&c.editorialVerified===false));
 for(const text of[['家は一日で','わずか二センチ上がりました。'],['낚싯줄 끝에서','커다란 물고기가 나타났습니다.']]){const c=hookCandidates({segments:[{start:0,end:40}]},[{start:14,end:18,text:text[0]},{start:18,end:24,text:text[1]}]);assert.ok(c.some(c=>c.start===14&&c.end===24));}
});
test('Most Replayed actually proposes eligible windows and records support, without correlated score addition',()=>{
 const heatmap=normalizeHeatmap([{start_time:0,end_time:5,value:1},{start_time:75,end_time:77,value:.9},{start_time:30,end_time:32,value:.6}],{durationMs:100000});
 const p={segments:[{start:0,end:100}]},cs=hookCandidates(p,[],1.25,{heatmap,sourceDurationMs:100000,commentClusters:[{centerMs:76000,score:1}]});
 const peak=cs.find(c=>c.supporting.replayPeak?.startMs===75000);assert.ok(peak);assert.ok(peak.start>=12.5&&peak.end-peak.start<=11.25);assert.ok(!cs.some(c=>c.supporting.replayPeak?.startMs===0));
 const e=replayEvidence({...peak,candidateId:peak.id,replayUse:'supports-context'},cs,heatmap);assert.equal(e.available,true);assert.equal(e.supportsSelection,true);assert.deepEqual(e.peakTimes,[76]);assert.match(peak.supporting.correlatedSignalsPolicy,/never added/);
 assert.equal(replayEvidence({...peak,candidateId:peak.id,replayUse:'not-used'},cs,heatmap).supportsSelection,false);assert.equal(replayEvidence({...peak,candidateId:peak.id,replayUse:'supports-context'},cs,undefined).supportsSelection,false);
});
test('synthetic fishing/action, vlog interaction and speech-heavy choices require evidence and semantic gates',()=>{
 for(const genre of['fishing/action','vlog/interaction','documentary/speech']){
  const v={...editorialFixture(undefined,20,28,true),start:20,end:28,reason:'Synthetic '+genre+' event has a concrete consequence; not a quality evaluation.',relation:'This part contains the same event.',ending:'Synthetic outcome completes at28.',evidenceTimes:[20,28],limitations:['Synthetic evidence only, no broad genre accuracy claim.']};
  validateHookResponse(v);assert.throws(()=>validateHookResponse({...v,complete:false}));assert.throws(()=>validateHookResponse({...v,standalone:false}));assert.throws(()=>validateEditorialEvidence(v,{candidates:[],cues:[]}),/CONTINUOUS/);
 }
});
test('cached alternatives and explicit manual adjustments preserve main/locks and queued values',async()=>{
 const p={id:1,title:'Test',manualLocked:true,segments:[{start:0,end:70}]};
 const choice=(start,end)=>({...editorialFixture(undefined,start,end,true),start,end,reason:'Fixture-specific evidence.',relation:'Same part.',ending:'Complete test outcome.',evidenceTimes:[start,end],limitations:[]});
 const alt=choice(40,47);delete alt.alternatives;const winner={...choice(20,30),alternatives:[alt],model:'fixture'};
 const imported=await attachExternalHooks({parts:[p]},[winner],{id:'source',title:'Source',duration:70},'','gemini'),before=structuredClone(imported),next=chooseTeaserAlternative(imported.parts[0],0);assert.equal(next.teaser.start,40);assert.deepEqual(next.segments,p.segments);assert.deepEqual(imported,before);validateTeaser(next,70);
 const manual=adjustTeaserRange(next,50,55);assert.equal(manual.teaser.selection,'manual');assert.equal(manual.teaser.alternatives,undefined);assert.deepEqual(manual.segments,p.segments);assert.ok(manual.manualLocked);assert.throws(()=>adjustTeaserRange(next,0,5));assert.throws(()=>adjustTeaserRange(next,50,62));
});
test('Gemini/Muse hook-only input includes actual replay proposals and part-wide context without changing main',async()=>{
 const {buildExternalHookOnlyPrompt}=await import('./teaser-import.mjs');const heatmap=normalizeHeatmap([{start_time:75,end_time:77,value:1}],{durationMs:100000}),plan={parts:[{id:1,title:'Unknown',segments:[{start:0,end:100}]}]},before=structuredClone(plan);
 const prompt=buildExternalHookOnlyPrompt(plan,{id:'source',title:'Unknown',duration:100,sourceContext:{heatmap}},'', 'nonce');assert.match(prompt,/replayPeak/);assert.match(prompt,/75000/);assert.match(prompt,/contextWindows/);assert.deepEqual(plan,before);
});
