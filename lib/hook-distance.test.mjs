import {editorialFixture} from "./teaser-test-fixture.mjs";
import test from'node:test';import assert from'node:assert/strict';import{permittedHookRanges,validateTeaser,fallbackTeaser,hookNeedsReselection,hookRangeKey}from'./teaser-hooks.mjs';import{attachExternalHooks,buildExternalHookOnlyPrompt}from'./teaser-import.mjs';import{hookInput}from'../worker/teaser-selection.mjs';
const part={id:1,title:'Part',manualLocked:true,segments:[{start:30,end:60}]};
const cue={start:43,end:49.25,text:'A coherent complete later sentence.'};
test('30–60 main rejects 30–35 opening for new policy, accepts later coherent cue and leaves locked main intact',()=>{const before=structuredClone(part),h=fallbackTeaser(part,'fixture',[{start:30,end:36.25,text:'Opening.'},cue]);assert.equal(h.start,43);validateTeaser({...part,teaser:h},60);assert.throws(()=>validateTeaser({...part,teaser:{...h,start:30,end:36.25}},60));assert.deepEqual(part,before);assert.deepEqual(permittedHookRanges(part),[{start:42.5,end:60}]);const i=hookInput(part,{title:'Source',duration:60},[cue]);assert.deepEqual(i.allowedRanges,i.permittedHookRanges);assert.equal(i.allowedRanges[0].start,42.5);});
test('excluded source gaps do not count toward 10 rendered seconds; padding contributes no eligibility',()=>{const p={...part,segments:[{start:30,end:35},{start:100,end:120},{start:0,end:100,isPadding:true}]};assert.deepEqual(permittedHookRanges(p),[{start:107.5,end:120}]);const h=fallbackTeaser(p,'fixture',[{start:100,end:106.25,text:'Too early in edited content.'},{start:108,end:114.25,text:'Later valid sentence.'}]);assert.equal(h.start,108);assert.equal(hookNeedsReselection({...p,teaser:{...h,start:100,end:106.25}}),true);});
test('short parts and absence of coherent eligible cues export main only, never silently reuse opening',()=>{for(const p of[{...part,segments:[{start:30,end:40}]},part]){const h=fallbackTeaser(p,'missing evidence',[{start:30,end:36.25,text:'Opening.'}]);assert.equal(h.status,'unavailable');assert.match(h.reason,/10 rendered seconds/);assert.equal(h.rangeKey,hookRangeKey(p));}});
test('old opening hooks load unchanged but are flagged; new external imports enforce identical permitted ranges',async()=>{const h=fallbackTeaser(part,'fixture',[cue]),old={...h,start:30,end:36.25};delete old.selectionPolicy;delete old.ending;old.promptVersion="same-part-hook-v1";validateTeaser({...part,teaser:old},60);assert.ok(hookNeedsReselection({...part,teaser:old}));const other={...part,id:2,segments:[{start:70,end:100}]},plan={parts:[part,other]},source={id:'source',title:'Source',duration:100};const selection=(start)=>({...editorialFixture(undefined,start,start+6.25,true),start,end:start+6.25,reason:'Evidence',relation:'This part',ending:"Fixture sentence finishes at the selected end; synthetic evidence only.",evidenceTimes:[start],limitations:[],model:'fixture'});await assert.rejects(attachExternalHooks(plan,[selection(30),selection(85)],source,'','gemini'));const good=await attachExternalHooks(plan,[selection(43),selection(85)],source,'','muse');assert.deepEqual(good.parts.map(p=>p.segments),plan.parts.map(p=>p.segments));const prompt=buildExternalHookOnlyPrompt(plan,source,'transcript','request');assert.match(prompt,/permittedHookRanges/);assert.match(prompt,/10 RENDERED/);});

// Updated explicit-user policy; these regressions were added, not run during UI delivery.
import {customTimestampPart} from './custom-teaser.mjs';
import {presentationSegments,hookTransitionId,teaserReadiness,requireBothTeasers} from './teaser-hooks.mjs';
import {partCaptions} from './subtitles.mjs';
test('manual opening override keeps exact source timestamps and retained main while Auto stays excluded',()=>{
 const before=structuredClone(part),manual=customTimestampPart(part,'30–35');
 assert.equal(manual.teaser.selection,'manual');assert.equal(manual.teaser.start,30);assert.equal(manual.teaser.end,35);
 assert.equal(hookNeedsReselection(manual),false);validateTeaser(manual,60);
 assert.deepEqual(permittedHookRanges(manual),[{start:42.5,end:60}]);assert.deepEqual(manual.segments,part.segments);assert.deepEqual(part,before);
 assert.throws(()=>customTimestampPart(part,'29–35'));assert.throws(()=>customTimestampPart(part,'30–42'));
 assert.throws(()=>customTimestampPart({...part,segments:[{start:30,end:35},{start:38,end:60}]},'33–40'));
});
test('per-part disable removes only the repeated presentation and caption occurrence and restores exact saved hook',()=>{
 const selected=customTimestampPart(part,'30–35'),queued=structuredClone(selected),off={...selected,teaserEnabled:false};
 assert.strictEqual(presentationSegments(off),off.segments);assert.equal(hookTransitionId(off,'flash-white','dip-black'),'none');
 const cues=[{start:31,end:32,text:'Original speech.'}];
 assert.equal(partCaptions(cues,selected).length,2);assert.equal(partCaptions(cues,off).length,1);
 assert.equal(presentationSegments({...off,teaserEnabled:true}).length,selected.segments.length+1);
 assert.deepEqual(off.teaser,queued.teaser);assert.equal(queued.teaserEnabled,undefined);
 const missing={...part,id:2,segments:[{start:70,end:100}],teaserEnabled:false};
 assert.doesNotThrow(()=>requireBothTeasers({parts:[off,missing]},100));
 assert.equal(teaserReadiness({parts:[{...part,teaserEnabled:true},missing]},100).length,1);
 assert.throws(()=>requireBothTeasers({parts:[{...part,teaserEnabled:'false'},missing]},100));
});
