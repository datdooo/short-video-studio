import test from 'node:test';import assert from 'node:assert/strict';
import {createBatchProcessor} from './batch-pipeline.mjs';import {createBatchSubmissionQueue,restoreBatchPreparation} from './batch-queue.mjs';
const source={id:'source-shared',title:'Fixture',duration:200,transcript:'[00:00] Fixture.'};
const plan=()=>({originalTitle:source.title,providerUsed:'manual',language:'en',parts:[1,2].map(id=>({id,teaserEnabled:false,title:`Part ${id}`,hook:'',hashtags:[],startTrimApplied:true,smartCutApplied:true,segments:[{start:(id-1)*100,end:id*100,label:'Main',reason:'Fixture'}]}))});
function setup({failAnalysis=false,crashSubmission=false,fallback=false,authFailure=false}={}){
 const jobs=new Map(),batches=new Map(),controllers=new Map();let loads=0,acquireCalls=0,analyses=0,renders=0,resumes=0,writes=0,next=0;
 const process=createBatchProcessor({acquire:async()=>{acquireCalls++;return structuredClone(source);},load:async id=>{loads++;assert.equal(id,source.id);return structuredClone(source);},analyze:async(_source,body)=>{analyses++;if(authFailure)throw Object.assign(Error("Expired fixture auth"),{code:"provider-auth-unavailable"});if(failAnalysis){failAnalysis=false;throw Error('temporary selection failure');}const p=body.currentPlan?structuredClone(body.currentPlan):plan();if(fallback)p.analysis={method:'deterministic-fallback',fallbackReason:'provider-auth-unavailable'};return{plan:p};},render:async body=>{renders++;const job={id:body.submissionId,sourceId:body.sourceId,plan:structuredClone(body.plan),state:'queued',outputs:[]};jobs.set(job.id,job);if(crashSubmission){crashSubmission=false;throw Error('reply interrupted AFTER accepted submission');}return job;},resumeRender:async job=>{resumes++;job.state='queued';},getJob:id=>jobs.get(id),persist:async()=>{writes++;},createId:()=>`submission-${++next}`});
 const queue=createBatchSubmissionQueue({batches,controllers,prepare:(b,body,items)=>process(b,body,items,controllers.get(b.id).signal),createId:()=>`item-${++next}`});
 return{queue,jobs,batches,controllers,reconnect:()=>{authFailure=false;},counts:()=>({loads,acquireCalls,analyses,renders,resumes,writes})};
}
const settings={resumeVersion:1,provider:'chatgpt',instruction:'Original rules'};
test('current main auth errors pause later ChatGPT items without acquiring or analyzing them', async () => {
  const items = [1, 2].map(id => ({id: `item-${id}`, url: `fixture-${id}`, settings}));
  let acquisitions = 0, analyses = 0;
  const process = createBatchProcessor({
    acquire: async () => { acquisitions++; return structuredClone(source); },
    load: async () => structuredClone(source),
    analyze: async () => {
      analyses++;
      // Current main-content.select throws this code; it no longer fabricates
      // a deterministic-fallback plan on missing/expired authentication.
      throw Object.assign(new Error('Kết nối ChatGPT hết hạn hoặc thiếu quyền.'), {code: 'provider-auth-unavailable'});
    },
    render: () => assert.fail('Auth failure must not enqueue a render'),
    getJob: () => undefined,
    persist: async () => {},
  });
  await process({items}, settings, items, new AbortController().signal);
  assert.equal(items[0].state, 'error');
  assert.equal(analyses, 1, 'Do not repeat a known auth failure for every remaining item');
  assert.equal(acquisitions, 1, 'Paused items must not acquire another source');
  assert.equal(items[1].state, 'paused');
  assert.equal(items[1].errorCode, 'auth-required');
});
test('per-item saved source/plan stages retry without repeating completed links; accepted ambiguous submission binds the same job',async()=>{
 const f=setup({failAnalysis:true});const batch=f.queue.submit({...settings,urls:['url-A','url-B']});await f.queue.idle();assert.equal(batch.items[0].state,'error');assert.equal(batch.items[1].state,'queued');const completed=structuredClone(batch.items[1]);
 f.queue.resume(batch.id,[batch.items[0].id]);await f.queue.idle();assert.deepEqual(batch.items[1],completed);assert.equal(f.counts().acquireCalls,2);assert.equal(f.counts().analyses,3);assert.equal(f.counts().renders,2);
 const ambiguous=setup({crashSubmission:true});const other=ambiguous.queue.submit({...settings,urls:['A']});await ambiguous.queue.idle();assert.equal(other.items[0].state,'error');assert.equal(ambiguous.jobs.size,1);
 ambiguous.queue.resume(other.id);await ambiguous.queue.idle();assert.equal(ambiguous.counts().renders,1);assert.ok(other.items[0].jobId);
});
test('restart reconstructs pending source/plan/settings; completed jobs remain immutable and explicit resume reuses interrupted renders',async()=>{
 const f=setup(),batch=f.queue.submit({...settings,urls:['A','B']});await f.queue.idle();const completed=batch.items[1];f.jobs.get(completed.jobId).state='done';
 const interrupted=batch.items[0];f.jobs.get(interrupted.jobId).state='cancelled';
 const restored=restoreBatchPreparation(JSON.parse(JSON.stringify(batch)),f.jobs);f.batches.set(restored.id,restored);f.controllers.delete(restored.id);f.queue.resume(restored.id,[interrupted.id]);await f.queue.idle();
 assert.equal(f.counts().resumes,1);assert.equal(f.counts().analyses,2);assert.equal(f.counts().acquireCalls,2);assert.equal(f.jobs.get(completed.jobId).state,'done');
 const pending=restoreBatchPreparation({items:[{id:'x',state:'analyzing',sourceId:source.id,settings}]},new Map());assert.equal(pending.items[0].state,'paused');assert.equal(pending.items[0].sourceId,source.id);
});
test('external batches wait for manual import, fallback auth pauses other requests, settings/plans stay independent',async()=>{
 const external=setup(),batch=external.queue.submit({...settings,provider:'gemini',urls:['A','B']});await external.queue.idle();assert.ok(batch.items.every(i=>i.state==='awaiting-import'));assert.equal(external.counts().analyses,0);assert.equal(external.counts().renders,0);
 batch.items[0].plan=plan();batch.items[0].approved=true;batch.items[0].state='render-ready';external.queue.resume(batch.id,[batch.items[0].id]);await external.queue.idle();assert.equal(external.counts().renders,1);assert.equal(batch.items[1].state,'awaiting-import');
 const f=setup({fallback:true}),blocked=f.queue.submit({...settings,urls:['A','B']});await f.queue.idle();assert.equal(f.counts().analyses,1);assert.equal(f.counts().renders,0);assert.equal(blocked.items[1].state,'paused');
});
test('cancel retains resumable stage data and rejects duplicate active resumes; legacy history is not guessed into new submissions',async()=>{
 const f=setup(),batch=f.queue.submit({...settings,urls:['A']});assert.throws(()=>f.queue.resume(batch.id),/No resumable/);await f.queue.idle();
 const saved=structuredClone(batch.items[0].plan);f.controllers.get(batch.id).abort();const job=f.jobs.get(batch.items[0].jobId);job.state='cancelled';batch.items[0].state='cancelled';f.queue.resume(batch.id);await f.queue.idle();assert.deepEqual(batch.items[0].plan,saved);
 f.batches.set('legacy',{id:'legacy',items:[{id:'legacy-item',state:'cancelled'}]});assert.throws(()=>f.queue.resume('legacy'),/Legacy/);
});

test('explicit resume after auth recovery reuses source and preserves draft/locks and completed sibling',async()=>{
 const auth=setup({authFailure:true}),pending=auth.queue.submit({...settings,urls:['first','second']});await auth.queue.idle();
 assert.equal(auth.counts().acquireCalls,1);assert.equal(auth.counts().analyses,1);assert.equal(auth.counts().renders,0);
 const draft=plan();draft.parts[0].manualLocked=true;draft.parts[0].title='Giữ nguyên nháp';
 pending.items[0].plan=structuredClone(draft);pending.items[0].needsAnalysis=true;const sourceId=pending.items[0].sourceId;
 const completed={id:'finished-item',jobId:'finished-job',state:'done',sourceId:source.id,plan:plan(),settings:structuredClone(settings)};pending.items.push(structuredClone(completed));auth.jobs.set('finished-job',{id:'finished-job',state:'done',plan:plan()});
 const savedSettings=structuredClone(pending.items[0].settings);auth.reconnect();
 assert.equal(auth.counts().analyses,1,'Reconnect alone does not schedule work');
 auth.queue.resume(pending.id,[pending.items[0].id]);await auth.queue.idle();
 assert.equal(pending.items[0].sourceId,sourceId);assert.equal(auth.counts().acquireCalls,1);assert.equal(auth.counts().loads,1);
 assert.deepEqual(pending.items[0].plan.parts,draft.parts);assert.deepEqual(pending.items[0].settings,savedSettings);assert.equal(auth.counts().renders,1);assert.equal(pending.items[0].errorCode,undefined);
 assert.equal(pending.items[1].state,'paused');
 const first=structuredClone(pending.items[0]);auth.queue.resume(pending.id,[pending.items[1].id]);await auth.queue.idle();
 assert.deepEqual(pending.items[0],first);assert.equal(auth.counts().renders,2);assert.equal(auth.jobs.size,3);
 assert.deepEqual(pending.items[2],completed);assert.equal(auth.jobs.get(completed.jobId).state,'done');
});
test('auth errors do not pause other providers and cancellation preserves checkpoints',async()=>{
 const saved=plan(),items=[{id:'auth',url:'a',settings},{id:'external',url:'b',settings:{...settings,provider:'gemini'}}];let acquired=0;
 const controller=new AbortController();const process=createBatchProcessor({acquire:async()=>{acquired++;return source;},load:async()=>source,analyze:async()=>{throw Object.assign(Error('Auth'),{code:'provider-auth-unavailable'});},persist:async()=>{},getJob:()=>undefined,render:()=>assert.fail('No render')});
 await process({items},settings,items,controller.signal);assert.equal(items[0].errorCode,'auth-required');assert.equal(items[1].state,'awaiting-import');assert.equal(acquired,2);
 const cancelled={id:'cancelled',sourceId:source.id,checkpoint:'plan',plan:saved};controller.abort();await process({},settings,[cancelled],controller.signal);assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.sourceId,source.id);assert.deepEqual(cancelled.plan,saved);assert.equal(cancelled.checkpoint,'plan');
});

test('cancellation during analysis keeps acquired source and saved manual plan without rendering',async()=>{
 const controller=new AbortController(),draft=plan(),item={id:'cancel-in-flight',sourceId:source.id,plan:draft,needsAnalysis:true,checkpoint:'plan',settings};draft.parts[0].manualLocked=true;
 const before=structuredClone(draft);const process=createBatchProcessor({load:async()=>source,acquire:()=>assert.fail('Reuse saved source'),analyze:async()=>{controller.abort();throw controller.signal.reason;},render:()=>assert.fail('No render after cancel'),getJob:()=>undefined,persist:async()=>{}});
 await process({},settings,[item],controller.signal);assert.equal(item.state,'cancelled');assert.equal(item.sourceId,source.id);assert.deepEqual(item.plan,before);assert.equal(item.checkpoint,'plan');assert.equal(item.needsAnalysis,true);
});

test('pre-existing source draft locks settings and checkpoint survive auth failure before explicit recovery',async()=>{
 const f=setup({authFailure:true}),draft=plan();draft.parts[0].manualLocked=true;draft.parts[0].title='Nháp trước lỗi';
 const item={id:'saved-a',state:'paused',sourceId:source.id,plan:structuredClone(draft),draft:{start:'00:',title:'Đang nhập'},needsAnalysis:true,checkpoint:'plan',settings:structuredClone(settings)};
 const next={id:'saved-b',state:'paused',url:'synthetic-next',settings:structuredClone(settings)};
 f.batches.set('saved-batch',{id:'saved-batch',items:[item,next]});
 const retained=structuredClone({sourceId:item.sourceId,plan:item.plan,draft:item.draft,settings:item.settings,checkpoint:item.checkpoint});
 f.queue.resume('saved-batch');await f.queue.idle();
 assert.equal(item.state,'error');assert.equal(item.errorCode,'auth-required');assert.equal(next.state,'paused');
 assert.deepEqual({sourceId:item.sourceId,plan:item.plan,draft:item.draft,settings:item.settings,checkpoint:item.checkpoint},retained);
 assert.equal(f.counts().acquireCalls,0);assert.equal(f.counts().loads,1);assert.equal(f.counts().analyses,1);assert.equal(f.counts().renders,0);assert.equal(f.jobs.size,0);
 f.reconnect();await f.queue.idle();assert.equal(f.counts().analyses,1,'Reconnect alone must not schedule processing');
 f.queue.resume('saved-batch',[item.id]);await f.queue.idle();
 assert.equal(f.counts().acquireCalls,0);assert.equal(f.counts().loads,2);assert.equal(f.counts().analyses,2);assert.equal(f.counts().renders,1);assert.equal(f.jobs.size,1);
 assert.deepEqual(item.plan.parts,draft.parts);assert.deepEqual(item.draft,retained.draft);assert.deepEqual(item.settings,retained.settings);assert.equal(item.sourceId,retained.sourceId);assert.equal(next.state,'paused');
 assert.throws(()=>f.queue.resume('saved-batch',[item.id]),/No resumable/);assert.equal(f.counts().renders,1);
});
