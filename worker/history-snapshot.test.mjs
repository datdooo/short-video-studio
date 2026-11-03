import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeHistory,decodeHistory} from './history-snapshot.mjs';
test('deduplicated plans round trip exactly and old histories remain readable',()=>{
 const plan={originalTitle:'fixture',parts:[{segments:Array(50).fill({start:0,end:10})}]};
 const history={batches:[{id:'b',items:[{id:'i',jobId:'j',plan:structuredClone(plan),draft:{unchanged:true}}]}],jobs:[{id:'j',state:'cancelled',plan}]};
 const compact=encodeHistory(history.batches,history.jobs);
 assert.equal(compact.batches[0].items[0].plan,undefined);
 assert.deepEqual(decodeHistory(structuredClone(compact)),history);
 assert.deepEqual(decodeHistory(structuredClone(history)),history);
 console.log(`Synthetic history bytes: ${JSON.stringify(history).length} -> ${JSON.stringify(compact).length}`);
 const different=structuredClone(history);different.batches[0].items[0].plan.originalTitle='edited';
 assert.deepEqual(decodeHistory(encodeHistory(different.batches,different.jobs)),different);
 assert.throws(()=>decodeHistory({batches:compact.batches,jobs:[]}),/Missing referenced/);
});
test('history retention defaults off, requires confirmation and protects active/referenced jobs',()=>{
 const jobs=[{id:'a',state:'done'},{id:'b',state:'error'},{id:'c',state:'queued'},{id:'d',state:'done'}];
 const batches=[{items:[{jobId:'a'}]}];
 assert.equal(encodeHistory(batches,jobs).jobs.length,4);
 assert.equal(encodeHistory(batches,jobs,{maxHistoryJobs:1}).jobs.length,4);
 assert.deepEqual(encodeHistory(batches,jobs,{maxHistoryJobs:1,confirmed:true}).jobs.map(j=>j.id),['a','c','d']);
});
