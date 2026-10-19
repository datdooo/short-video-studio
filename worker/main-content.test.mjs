import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createMainContentSelector} from './main-content.mjs';import {normalizeSourceContext} from '../lib/source-context/index.mjs';
const source={id:'source-main',kind:'upload',title:'Harvest',duration:200};const context=normalizeSourceContext({kind:'local',sourceId:source.id,title:source.title,duration:200});
const selection=input=>({recipeId:input.recipes[0].id,language:'en',parts:[1,2].map(id=>({id,title:`Part ${id}`,hook:'',reason:'Fixture selection, not live AI.',hashtags:Array.from({length:10},(_,i)=>`#tag${i}`),exclusions:[]}))});
async function setup(t,analyze){const root=await mkdtemp(path.join(tmpdir(),'main-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));let calls=0;return{select:createMainContentSelector({cacheRoot:root,fingerprint:async()=> 'digest',resolveProvider:async()=>({id:'chatgpt',model:'unit-only',analyze:async args=>{calls++;return analyze(args);}})}),calls:()=>calls};}
test('actual selector consumes structured AI decisions, caches across style edits and returns independent plan snapshots',async t=>{
 const f=await setup(t,async({input})=>({value:selection(input)}));const first=await f.select.select(source,context,{instruction:'preserve story'});assert.equal(first.analysis.method,'ai');
 const again=await f.select.select(source,context,{instruction:'preserve story',visualStyle:{anything:true}});assert.equal(f.calls(),1);again.parts[0].title='mutated';assert.notEqual(first.parts[0].title,'mutated');
 await f.select.select(source,context,{instruction:'different rule'});assert.equal(f.calls(),2);
});
test('malformed/unavailable AI falls back explicitly with bounded retries; auth is not retried; user cancellation propagates',async t=>{
 const f=await setup(t,async()=>({value:{recipeId:'not-existing'}}));const result=await f.select.select(source,context);assert.equal(f.calls(),2);assert.equal(result.analysis.method,'deterministic-fallback');assert.equal(result.analysis.provider,'none');
 const auth=await setup(t,async()=>{throw new Error('AUTH_REQUIRED PRIVATE');});const failed=await auth.select.select(source,context);assert.equal(auth.calls(),1);assert.ok(!JSON.stringify(failed).includes('PRIVATE'));
 const cancel=new AbortController();cancel.abort();await assert.rejects(f.select.select(source,context,{signal:cancel.signal}));
});
