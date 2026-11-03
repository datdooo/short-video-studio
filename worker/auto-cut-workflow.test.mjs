import {editorialFixture,mainSelectionFixture,sourceFingerprintFixture} from "../lib/teaser-test-fixture.mjs";
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createAutoCutWorkflow} from './auto-cut-workflow.mjs';import {createMainContentSelector} from './main-content.mjs';import {createTeaserSelector} from './teaser-selection.mjs';import {permittedHookRanges} from '../lib/teaser-hooks.mjs';
import {normalizeSourceContext} from '../lib/source-context/index.mjs';import {validatePlan} from './plan-validation.mjs';
const source={id:'source-workflow',kind:'upload',title:'Harvest',duration:200};const context=normalizeSourceContext({kind:'local',sourceId:source.id,title:source.title,duration:200});
const decision=input=>({...mainSelectionFixture(input),parts:mainSelectionFixture(input).parts.map((p,i)=>({...p,segments:[{start:i*100,end:(i+1)*100,label:"Main",reason:"Synthetic chronological content",isPadding:false}]}))});
const cues=[{start:16.5,end:22.75,text:"First complete statement."},{start:116.5,end:122.75,text:"Second complete statement."}];
async function setup(t,authFailure=false){const root=await mkdtemp(path.join(tmpdir(),'workflow-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));let requests=0,hookRequests=0;
 const mainContent=createMainContentSelector({cacheRoot:path.join(root,'main'),fingerprint:async()=>sourceFingerprintFixture,resolveProvider:async()=>{if(authFailure)throw new Error('AUTH_REQUIRED');return{id:'chatgpt',model:'unit-only',analyze:async({input})=>{requests++;return{value:decision(input)};}};}});
 const hooks=createTeaserSelector({cacheRoot:path.join(root,'hooks'),frames:async p=>[{time:permittedHookRanges(p)[0].start+10.25,data:'synthetic'}],fingerprint:async()=>sourceFingerprintFixture,resolveProvider:async()=>({id:'chatgpt',model:'unit-only',analyze:async({input})=>{hookRequests++;const choose=input=>{const cue=input.transcript.find(c=>input.allowedRanges.some(r=>c.start>=r.start&&c.end<=r.end));assert.ok(cue);const start=cue.start;return {...editorialFixture(input,start,start+6.25),kind:"speech",endingBasis:"speech",cueIds:[`cue-${cues.findIndex(c=>c.start===cue.start)}`],start,end:start+6.25,reason:'Fixture action',relation:'Same part content',ending:"Fixture sentence finishes at the selected end; synthetic evidence only.",evidenceTimes:[start],limitations:['Unit fixture only.']};};return {value:input.parts?{parts:input.parts.map(row=>({partId:row.partId,selection:choose(row)}))}:choose(input)};}})});
 const prepareInputs=async(_s,body,signal)=>({context,options:{currentPlan:body.currentPlan,cues,captionTrack:body.captionCues||{sourceId:source.id,sourceDuration:200,timeline:"source",cues},instruction:body.instruction||'',signal}});
 return{run:createAutoCutWorkflow({prepareInputs,mainContent,selectHooks:(plan,source,signal)=>hooks(plan,source,{cues,signal}),describeWebVideo:async()=>({id:"fixture-video",sourceId:source.id,duration:200,clock:"source-seconds",playbackRate:1,coverage:[0,200],bytes:1234})}),mainContent,counts:()=>[requests,hookRequests]};}
test('ordinary Auto orchestration runs the shared main engine then independent hooks; style does not repeat analysis or change main/captions',async t=>{
 const f=await setup(t),body={captionCues:{sourceId:source.id,cues:[{start:1,end:3,text:'Keep caption'}]}};
 const {plan}=await f.run(source,body);validatePlan(plan,source);assert.ok(plan.parts.every(p=>p.teaser.selection==='ai'));assert.deepEqual(plan.captionCues,body.captionCues);assert.deepEqual(f.counts(),[1,1]);
 const cached=await f.run(source,{...body,visualStyle:{font:'ignored'}});assert.deepEqual(cached.plan.parts,plan.parts);assert.deepEqual(f.counts(),[1,1]);
});
test('missing auth rejects without fabricated main or additional provider requests',async t=>{
 const f=await setup(t,true);await assert.rejects(f.run(source,{}),e=>e.code==='provider-auth-unavailable');assert.deepEqual(f.counts(),[0,0]);
});
test('Semi-Auto imports intentional ranges and external hooks without reranking/snap; mismatched context/locks/missing hook are rejected',async t=>{
 const f=await setup(t),request={sourceId:source.id,requestId:'11111111-1111-4111-8111-111111111111',provider:'gemini'},prepared=(await f.run(source,{...request,mode:'context'})).context;
 const base=(await f.run(source,{})).plan;
 const selections=base.parts.map(p=>{const start=p.segments[0].start+14;return{...editorialFixture(undefined,start,start+6.25,true),start,end:start+6.25,reason:'External fixture reason',relation:'This same part',ending:"Fixture sentence finishes at the selected end; synthetic evidence only.",evidenceTimes:[start],limitations:['External fixture, no API claim.'],model:'self-reported'};});
 const plan={...base,providerUsed:'gemini'};
 const body={mode:'import',sourceId:source.id,requestId:'11111111-1111-4111-8111-111111111111',analysisKey:prepared.analysisKey,provider:'gemini',plan,hookSelections:selections,attachmentConfirmation:{...request,analysisKey:prepared.analysisKey,mediaId:'fixture-video',attached:true,method:'manual-import'}};
 const result=await f.run(source,body);assert.deepEqual(result.plan.parts.map(p=>p.segments),plan.parts.map(p=>p.segments));assert.ok(result.plan.parts.every(p=>p.teaser.selection==='external-import'));assert.equal(result.plan.analysis.method,'external-import');assert.deepEqual(f.counts(),[1,1]);
 await assert.rejects(f.run(source,{...body,analysisKey:'wrong'}),/context|Context|TXT/);
 await assert.rejects(f.run(source,{...body,hookSelections:[undefined,selections[1]]}),/teaserSelection/);
 const locked=structuredClone(plan);locked.parts[0].manualLocked=true;await assert.rejects(f.run(source,{...body,currentPlan:locked}),/context|Context|TXT/);
});
