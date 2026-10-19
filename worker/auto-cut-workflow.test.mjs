import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createAutoCutWorkflow} from './auto-cut-workflow.mjs';import {createMainContentSelector} from './main-content.mjs';import {createTeaserSelector} from './teaser-selection.mjs';
import {normalizeSourceContext} from '../lib/source-context/index.mjs';import {validatePlan} from './plan-validation.mjs';import {attachExternalHooks} from '../lib/teaser-import.mjs';
const source={id:'source-workflow',kind:'upload',title:'Harvest',duration:200};const context=normalizeSourceContext({kind:'local',sourceId:source.id,title:source.title,duration:200});
const decision=input=>({recipeId:input.recipes[0].id,language:'en',parts:[1,2].map(id=>({id,title:`Part ${id}`,hook:'Harvest',reason:'Unit fixture, no real inference.',hashtags:Array.from({length:10},(_,i)=>`#tag${i}`),exclusions:[]}))});
async function setup(t,authFailure=false){const root=await mkdtemp(path.join(tmpdir(),'workflow-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));let requests=0,hookRequests=0;
 const mainContent=createMainContentSelector({cacheRoot:path.join(root,'main'),fingerprint:async()=> 'digest',resolveProvider:async()=>{if(authFailure)throw new Error('AUTH_REQUIRED');return{id:'chatgpt',model:'unit-only',analyze:async({input})=>{requests++;return{value:decision(input)};}};}});
 const hooks=createTeaserSelector({cacheRoot:path.join(root,'hooks'),fingerprint:async()=> 'digest',resolveProvider:async()=>({id:'chatgpt',model:'unit-only',analyze:async({input})=>{hookRequests++;const start=input.allowedRanges[0].start+4;return{value:{start,end:start+6.25,reason:'Fixture action',relation:'Same part content',evidenceTimes:[start],limitations:['Unit fixture only.']}};}})});
 const prepareInputs=async(_s,body,signal)=>({context,options:{currentPlan:body.currentPlan,cues:[],instruction:body.instruction||'',signal}});
 return{run:createAutoCutWorkflow({prepareInputs,mainContent,selectHooks:hooks}),mainContent,counts:()=>[requests,hookRequests]};}
test('ordinary Auto orchestration runs the shared main engine then independent hooks; style does not repeat analysis or change main/captions',async t=>{
 const f=await setup(t),body={captionCues:{sourceId:source.id,cues:[{start:1,end:3,text:'Keep caption'}]}};
 const {plan}=await f.run(source,body);validatePlan(plan,source);assert.ok(plan.parts.every(p=>p.teaser.selection==='ai'));assert.deepEqual(plan.captionCues,body.captionCues);assert.deepEqual(f.counts(),[1,2]);
 const cached=await f.run(source,{...body,visualStyle:{font:'ignored'}});assert.deepEqual(cached.plan.parts,plan.parts);assert.deepEqual(f.counts(),[1,2]);
});
test('missing auth is an explicit deterministic main/hook fallback without a second provider attempt',async t=>{
 const f=await setup(t,true),{plan}=await f.run(source,{});validatePlan(plan,source);assert.equal(plan.analysis.method,'deterministic-fallback');assert.ok(plan.parts.every(p=>p.teaser.status==='unavailable'&&p.teaser.reason.includes('10 rendered seconds')));assert.deepEqual(f.counts(),[0,0]);
});
test('Semi-Auto imports intentional ranges and external hooks without reranking/snap; mismatched context/locks/missing hook are rejected',async t=>{
 const f=await setup(t),prepared=(await f.run(source,{mode:'context'})).context;
 const base=(await f.run(source,{})).plan;
 const selections=base.parts.map(p=>{const start=p.segments[0].start+14;return{start,end:start+6.25,reason:'External fixture reason',relation:'This same part',evidenceTimes:[start],limitations:['External fixture, no API claim.'],model:'self-reported'};});
 const plan=await attachExternalHooks({...base,providerUsed:'gemini'},selections,source,'','gemini');
 const body={mode:'import',sourceId:source.id,requestId:'11111111-1111-4111-8111-111111111111',analysisKey:prepared.analysisKey,provider:'gemini',plan};
 const result=await f.run(source,body);assert.deepEqual(result.plan.parts,plan.parts);assert.equal(result.plan.analysis.method,'external-import');assert.deepEqual(f.counts(),[1,2]);
 await assert.rejects(f.run(source,{...body,analysisKey:'wrong'}),/context/);
 const missing=structuredClone(plan);delete missing.parts[0].teaser;await assert.rejects(f.run(source,{...body,plan:missing}),/Missing valid external hooks/);
 const locked=structuredClone(plan);locked.parts[0].manualLocked=true;await assert.rejects(f.run(source,{...body,currentPlan:locked}),/context/);
});
