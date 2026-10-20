import {requireBothTeasers} from '../lib/teaser-hooks.mjs';
import { assertRenderableVisualStyle, snapshotPlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { randomUUID } from "node:crypto";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

// Preparation is FIFO, independently of the render queue. Each submission owns
// an immutable list of items and its own prompt configuration, even when the
// visible batch keeps growing while earlier submissions are still preparing.
export function createBatchSubmissionQueue({ batches, controllers, prepare, onChange = () => {}, createId = randomUUID }) {
  let preparationQueue = Promise.resolve();
  const scheduled = new Set();
  function schedule(batch,body,items) {
    items.forEach(i=>scheduled.add(i.id));
    preparationQueue=preparationQueue.then(()=>prepare(batch,body,items)).catch(error=>{
      const cancelled=controllers.get(batch.id)?.signal.aborted;
      for(const item of items)if(!item.jobId&&!['done','error','cancelled','awaiting-import','review-required'].includes(item.state)){item.state=cancelled?'cancelled':'error';item.error=cancelled?null:error instanceof Error?error.message:String(error);}
    }).finally(()=>{items.forEach(i=>scheduled.delete(i.id));return onChange();});
  }
  return {
    submit(body) {
      body = snapshotPlanVisualStyle(body);
      assertRenderableVisualStyle(body.visualStyle);
      let batch;
      if (body.batchId !== undefined) {
        batch = batches.get(body.batchId);
        if (!batch) fail("Hàng đợi không còn tồn tại. Refresh trang rồi thêm link lại.", 404);
        const controller = controllers.get(batch.id);
        if (!controller || controller.signal.aborted) fail("Hàng đợi đã dừng. Chờ cập nhật trạng thái rồi chạy lượt mới; link chưa được thêm.", 409);
      } else {
        batch = { id: createId(), items: [] };
        batches.set(batch.id, batch);
        controllers.set(batch.id, new AbortController());
      }
      if(batch.items.filter(i=>!i.deleted&&!['done','error','cancelled','awaiting-import','review-required','paused'].includes(i.state)).length+body.urls.length>100)fail('At most 100 pending links per queue; wait for existing work.',409);
      const {urls: _urls,batchId: _batchId,...settings}=body;
      void _urls;void _batchId;
      const items = body.urls.map((url) => ({ id: createId(), url, state: "pending", error: null, settings:structuredClone(settings) }));
      batch.items.push(...items);
      void onChange();
      schedule(batch,body,items);
      return batch;
    },
    resume(batchId,itemIds) {
      const batch=batches.get(batchId);if(!batch)fail('Queue not found',404);
      if(itemIds!==undefined&&(!Array.isArray(itemIds)||!itemIds.length||itemIds.length>100||itemIds.some(id=>typeof id!=='string')))fail('Invalid resume item list',400);
      const items=batch.items.filter(i=>!i.deleted&&(!itemIds||itemIds.includes(i.id))&&['error','cancelled','paused','render-ready','review-required','awaiting-import'].includes(i.state));
      if(!items.length)fail('No resumable items',409);
      for(const item of items){if(item.plan)requireBothTeasers(item.plan);}
      if(items.some(i=>scheduled.has(i.id)))fail('These items are still stopping/preparing; retry shortly.',409);
      if(items.some(i=>i.settings?.resumeVersion!==1))fail('Legacy item lacks resumable settings; open it in the editor instead.',409);
      if(!controllers.get(batch.id)||controllers.get(batch.id).signal.aborted)controllers.set(batch.id,new AbortController());
      for(const item of items){item.state='pending';item.error=null;item.attempts=(item.attempts||0)+1;}
      void onChange();schedule(batch,{},items);return batch;
    },
    idle: () => preparationQueue,
  };
}

// Recovery pauses work; it never submits a new render by guessing an old failure.
export function restoreBatchPreparation(batch,jobs) {
  for(const item of batch.items||[]) {
    if(item.deleted)continue;
    if(!item.jobId&&item.submissionId&&jobs.has(item.submissionId))item.jobId=item.submissionId;
    if(item.jobId){const job=jobs.get(item.jobId);item.state=job?.state||'paused';item.error=job?.error||(!job?'Render history missing; inspect outputs before resubmitting.':null);continue;}
    if(!['done','error','cancelled','awaiting-import','review-required','paused'].includes(item.state)){
      item.state='paused';item.error='Interrupted before completion; resume saved stages explicitly.';
    }
  }
  return batch;
}
