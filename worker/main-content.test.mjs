import {mainSelectionFixture,sourceFingerprintFixture} from "../lib/teaser-test-fixture.mjs";
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createMainContentSelector} from './main-content.mjs';import {normalizeSourceContext} from '../lib/source-context/index.mjs';
const source={id:'source-main',kind:'upload',title:'Harvest',duration:200};const context=normalizeSourceContext({kind:'local',sourceId:source.id,title:source.title,duration:200});
const selection=mainSelectionFixture;
async function setup(t,analyze){const root=await mkdtemp(path.join(tmpdir(),'main-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;return{select:createMainContentSelector({cacheRoot:root,fingerprint:async()=>sourceFingerprintFixture,resolveProvider:async()=>({id:'chatgpt',model:'unit-only',analyze:async args=>{calls++;return analyze(args);}})}),calls:()=>calls};}
test('actual selector consumes structured AI decisions, caches across style edits and returns independent plan snapshots',async t=>{
 const f=await setup(t,async({input})=>({value:selection(input)}));const first=await f.select.select(source,context,{instruction:'preserve story'});assert.equal(first.analysis.method,'ai');
 const again=await f.select.select(source,context,{instruction:'preserve story',visualStyle:{anything:true}});assert.equal(f.calls(),1);again.parts[0].title='mutated';assert.notEqual(first.parts[0].title,'mutated');
 await f.select.select(source,context,{instruction:'different rule'});assert.equal(f.calls(),2);
});
test('invalid AI output and auth fail once without fallback; cancellation propagates',async t=>{
 const f=await setup(t,async()=>({value:{recipeId:'not-existing'}}));
 await assert.rejects(f.select.select(source,context),e=>e.code==='MAIN_PLAN_VALIDATION_FAILED'); assert.equal(f.calls(),1);
 const auth=await setup(t,async()=>{throw new Error('AUTH_REQUIRED PRIVATE');});
 await assert.rejects(auth.select.select(source,context),e=>e.code==='provider-auth-unavailable'&&!e.message.includes('PRIVATE')); assert.equal(auth.calls(),1);
 const cancel=new AbortController();cancel.abort();await assert.rejects(f.select.select(source,context,{signal:cancel.signal}));
});
