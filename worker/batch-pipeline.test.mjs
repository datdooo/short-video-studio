import test from 'node:test';import assert from 'node:assert/strict';
import {createBatchProcessor} from './batch-pipeline.mjs';import {createBatchSubmissionQueue,restoreBatchPreparation} from './batch-queue.mjs';
const source={id:'source-shared',title:'Fixture',duration:200,transcript:'[00:00] Fixture.'};
const plan=()=>({originalTitle:source.title,providerUsed:'manual',language:'en',parts:[1,2].map(id=>({id,title:`Part ${id}`,hook:'',hashtags:[],startTrimApplied:true,smartCutApplied:true,segments:[{start:(id-1)*100,end:id*100,label:'Main',reason:'Fixture'}]}))});
function setup({failAnalysis=false,crashSubmission=false,fallback=false}={}){
 const jobs=new Map(),batches=new Map(),controllers=new Map();let acquireCalls=0,analyses=0,renders=0,resumes=0,writes=0,next=0;
 const process=createBatchProcessor({acquire:async()=>{acquireCalls++;return structuredClone(source);},load:async id=>{assert.equal(id,source.id);return structuredClone(source);},analyze:async()=>{analyses++;if(failAnalysis){failAnalysis=false;throw Error('temporary selection failure');}const p=plan();if(fallback)p.analysis={method:'deterministic-fallback',fallbackReason:'provider-auth-unavailable'};return{plan:p};},render:async body=>{renders++;const job={id:body.submissionId,sourceId:body.sourceId,plan:structuredClone(body.plan),state:'queued',outputs:[]};jobs.set(job.id,job);if(crashSubmission){crashSubmission=false;throw Error('reply interrupted AFTER accepted submission');}return job;},resumeRender:async job=>{resumes++;job.state='queued';},getJob:id=>jobs.get(id),persist:async()=>{writes++;},createId:()=>`submission-${++next}`});
 const queue=createBatchSubmissionQueue({batches,controllers,prepare:(b,body,items)=>process(b,body,items,controllers.get(b.id).signal),createId:()=>`item-${++next}`});
 return{queue,jobs,batches,controllers,counts:()=>({acquireCalls,analyses,renders,resumes,writes})};
}
const settings={resumeVersion:1,provider:'chatgpt',instruction:'Original rules'};
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
