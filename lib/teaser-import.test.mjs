import test from 'node:test';import assert from 'node:assert/strict';
import { attachExternalHooks, externalHooksCurrent } from './teaser-import.mjs';
import { buildMusePrompt,parseMusePlan } from './muse-plan.mjs';
const source={id:'real-source-identity',title:'Tutorial',duration:220};
const plan={originalTitle:source.title,language:'en',parts:[1,2].map((id)=>({id,title:`Part ${id}`,hook:'Explain a separate result',hashtags:Array.from({length:10},(_,i)=>`#tag${i}`),segments:[{start:(id-1)*100,end:(id-1)*100+90,label:'main',reason:'evidence',isPadding:false}]}))};
const selections=()=>[10,110].map(start=>({start,end:start+6.25,reason:'The result attracts attention',relation:'The main content explains the result',evidenceTimes:[start],limitations:['Transcript only'],model:'web-model-unknown'}));
test('both web workflows request plan + per-part hook in one source-bound roundtrip', async()=>{
 const schema={properties:{parts:{type:'array',items:{properties:{},required:[]}}},required:['parts']};
 for(const provider of ['gemini','muse']){
  const prompt=buildMusePrompt('Untrusted transcript',schema,source,{requestId:'nonce'});assert.match(prompt,/teaserSelection/);assert.match(prompt,/UNTRUSTED DATA/);
  const raw={...plan,sourceId:source.id,requestId:'nonce',parts:plan.parts.map((p,i)=>({...p,teaserSelection:selections()[i]}))};
  const imported=parseMusePlan(JSON.stringify(raw),source,provider,{requestId:'nonce'});
  assert.equal(imported.parts[0].teaserSelection,undefined);
  const next=await attachExternalHooks(imported,imported.hookSelections,source,'[00:10] Result.',provider);
  assert.equal(next.parts[0].teaser.selection,'external-import');assert.equal(next.parts[1].teaser.provider,provider);assert.deepEqual(next.parts.map(p=>p.segments),plan.parts.map(p=>p.segments));
  assert.ok(await externalHooksCurrent(next,source,'[00:10] Result.'));
  assert.ok(await externalHooksCurrent({...next,visualStyle:{ignored:'style'}},source,'[00:10] Result.'));
  assert.equal(await externalHooksCurrent(next,source,'edited transcript'),false);
  assert.equal(await externalHooksCurrent(next,{...source,id:'other'},'[00:10] Result.'),false);
  assert.throws(()=>parseMusePlan(JSON.stringify(raw),source,provider,{requestId:'stale'}));
  assert.throws(()=>parseMusePlan(JSON.stringify({...raw,sourceId:'other'}),source,provider,{requestId:'nonce'}));
 }
});
test('reject swapped parts, out-of-range, malformed and unsupported import provenance', async()=>{
 for(const mutate of [s=>s.reverse(),s=>s[0].start=99,s=>s[0].model='',s=>s[0].extra='execute',s=>s[1].end='116.25']){const s=selections();mutate(s);await assert.rejects(attachExternalHooks(plan,s,source,'cues','gemini'));}
 await assert.rejects(attachExternalHooks(plan,selections(),source,'cues','unknown-service'));
});
test('hook-only refresh preserves exact manually locked ranges, content, captions and style',async()=>{
 const {buildExternalHookOnlyPrompt,parseExternalHookOnly}=await import('./teaser-import.mjs');
 const locked={...plan,parts:plan.parts.map(p=>({...p,startTrimApplied:true,smartCutApplied:true})),captionCues:{preserved:true},visualStyle:{preserved:true}};
 const before=structuredClone(locked),requestId='fresh-hook-only';const prompt=buildExternalHookOnlyPrompt(locked,source,'timed transcript',requestId);assert.match(prompt,/main content is locked/);
 const envelope={sourceId:source.id,requestId,selections:selections().map((s,i)=>({...s,partId:i+1}))};
 const parsed=parseExternalHookOnly(JSON.stringify(envelope),source,requestId,locked);const next=await attachExternalHooks(locked,parsed,source,'timed transcript','muse');
 assert.deepEqual(locked,before);assert.deepEqual(next.parts.map(p=>p.segments),locked.parts.map(p=>p.segments));assert.deepEqual(next.captionCues,locked.captionCues);assert.deepEqual(next.visualStyle,locked.visualStyle);
 for(const changed of [{...envelope,requestId:'old'},{...envelope,sourceId:'old'},{...envelope,selections:[...envelope.selections].reverse()},{...envelope,extra:'execute'}])assert.throws(()=>parseExternalHookOnly(JSON.stringify(changed),source,requestId,locked));
});
