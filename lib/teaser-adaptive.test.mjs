import {editorialFixture} from "./teaser-test-fixture.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {hookCandidates,hookDurationLimits,fallbackTeaser,validateTeaser,permittedHookRanges,HOOK_PROMPT_VERSION,HOOK_SELECTION_POLICY,presentationSegments} from './teaser-hooks.mjs';
import {attachExternalHooks,externalHookKey,externalHooksCurrent,buildExternalHookOnlyPrompt} from './teaser-import.mjs';
import {checkHookSpeechBoundaries} from './teaser-boundaries.mjs';
import {snapshotPlanVisualStyle} from './visual-style/normalize.mjs';
const part={id:1,title:'Lift measurement',manualLocked:true,segments:[{start:30,end:70}]};
const cue={start:45,end:55.5,text:'The house rose only 2.5 centimeters despite a full day of work.'};
const selection=(start,end)=>({...editorialFixture(undefined,start,end,true),start,end,reason:'The measured 2.5 cm result is the concrete payoff compared with the site introduction.',relation:'The part explains the measured daily house lift.',ending:'The comparison ends with the complete measured result at '+end+'s, transcript only; action ending is unproven.',evidenceTimes:[start,end],limitations:['Synthetic transcript evidence only.'],model:'fixture'});
test('complete 7–9s and meaningful shorter thoughts are allowed; no padding, cap includes adjusted bounds',()=>{
 const before=structuredClone(part);const h=fallbackTeaser(part,'fixture',[cue]);assert.equal((h.end-h.start)/1.25,8.4);validateTeaser({...part,teaser:h},70);
 for(const sourceSeconds of[.625,2.5,8.75,11.25])validateTeaser({...part,teaser:{...h,end:h.start+sourceSeconds,evidenceTimes:[h.start]}},70);
 assert.throws(()=>validateTeaser({...part,teaser:{...h,end:h.start+11.25001}},70));
 assert.throws(()=>validateTeaser({...part,teaser:{...h,end:h.start+11.25+.35}},70),'boundary adjustment cannot exceed cap');
 const short=fallbackTeaser(part,'fixture',[{start:45,end:47.5,text:'The jack failed.'}]);assert.equal(short.end-short.start,2.5);assert.equal(short.selection,'fallback');assert.match(short.reason,/NOT editorially verified/);
 assert.deepEqual(part,before);assert.deepEqual(presentationSegments({...part,teaser:h}).slice(1),before.segments);
});
test('source limits and first-10s exclusion derive from playback speed, not fixed source seconds',()=>{
 assert.equal(hookDurationLimits().maxSourceSeconds,11.25);
 for(const speed of[1,1.25,1.5,2]){assert.equal(hookDurationLimits(speed).maxSourceSeconds,9*speed);assert.deepEqual(permittedHookRanges(part,speed),[{start:30+10*speed,end:70}]);const c=hookCandidates(part,[{start:52,end:61,text:'The result is a nine centimeter lift.'}],speed);assert.ok(c.length);assert.ok(c.some(x=>x.start===52&&x.end===61&&x.renderedSeconds===9/speed));}
 for(const v of[0,NaN,-1])assert.throws(()=>hookDurationLimits(v));
});
test('candidate grouping respects complete cue groups, rejects dependent/introduction and unfinished/overlong evidence',()=>{
 const cues=[{start:43,end:47,text:'The house rose only'},{start:47,end:53,text:'2.5 centimeters after a day of work.'}];
 assert.ok(hookCandidates(part,cues).some(c=>c.start===43&&c.end===53));
 assert.throws(()=>checkHookSpeechBoundaries({start:44,end:53},cues));
 for(const text of['The result will be','これはまだ','아직 결과는'])assert.ok(hookCandidates(part,[{start:45,end:50,text}]).every(c=>c.kind==='visual-review'));
 assert.equal(fallbackTeaser(part,'fixture',[{start:45,end:57,text:'The whole result requires twelve seconds.'}]).status,'unavailable');
 const ranked=hookCandidates(part,[{start:43,end:44,text:'Workers move materials.'},cue]);assert.ok(ranked.some(c=>c.start===45),'Candidates expose the payoff for semantic review without keyword quality scores');
 assert.ok(ranked.every(c=>c.editorialVerified===false));
});
test('new web schemas require ending evidence and enforce9s; old shorter snapshots and hashes remain valid',async()=>{
 const source={id:'fixture',title:'House',duration:70},plan={parts:[part]},s=selection(45,56.25);
 for(const provider of['gemini','muse']){const imported=await attachExternalHooks(plan,[s],source,'cues',provider);assert.equal(imported.parts[0].teaser.promptVersion,HOOK_PROMPT_VERSION);assert.ok(await externalHooksCurrent(imported,source,'cues'));await assert.rejects(attachExternalHooks(plan,[{...s,end:56.251}],source,'cues',provider));const {ending,...missing}=s;assert.ok(ending);await assert.rejects(attachExternalHooks(plan,[missing],source,'cues',provider));}
 const h=fallbackTeaser(part,'fixture',[cue]),legacy={...h,end:51.25,promptVersion:'same-part-hook-v1',selectionPolicy:'later-main-v1',selection:'external-import',provider:'gemini',model:'old'};delete legacy.ending;
 legacy.inputKey=await externalHookKey(source,part,'cues','gemini','old','later-main-v1');validateTeaser({...part,teaser:legacy},70);assert.ok(await externalHooksCurrent({parts:[{...part,teaser:legacy}]},source,'cues'));
 const fresh=await externalHookKey(source,part,'cues','gemini','old',HOOK_SELECTION_POLICY);assert.notEqual(fresh,legacy.inputKey);
 const queued=snapshotPlanVisualStyle({parts:[{...part,teaser:legacy}]});await attachExternalHooks(plan,[s],source,'cues','gemini');assert.deepEqual(queued.parts[0].teaser,legacy);
 const prompt=buildExternalHookOnlyPrompt(plan,source,'cues','nonce');for(const pattern of[/5–9 RENDERED/,/Hard maximum 9/,/Cue alignment|cue alignment/,/strongest/,/ending/,/permittedHookRanges/])assert.match(prompt,pattern);
});
