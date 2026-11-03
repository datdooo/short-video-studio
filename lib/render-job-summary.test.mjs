import test from 'node:test';
import assert from 'node:assert/strict';
import {compactRenderSnapshot, retainEqualJobs} from './render-job-summary.mjs';
test('compact polling preserves titles, hashtags and status without full plans', () => {
 const job={id:'test',state:'done',progress:100,outputs:[{url:'fake.mp4'}],plan:{originalTitle:'Giả',parts:[{id:1,title:'Một',hashtags:['#test'],segments:Array(100).fill({start:0,end:10,label:'fixture'})}]}};
 const compact=compactRenderSnapshot(job);
 assert.equal('plan' in compact,false);
 assert.deepEqual(compact.planSummary.parts,[{id:1,title:'Một',hashtags:['#test']}]);
 assert.equal(compact.outputs,job.outputs);
 assert.ok(JSON.stringify(compact).length<JSON.stringify(job).length/5);
 console.log(`Synthetic poll bytes: ${Buffer.byteLength(JSON.stringify(job))} -> ${Buffer.byteLength(JSON.stringify(compact))}`);
});
test('unchanged polling retains identity; status, output and metadata changes publish', () => {
 const jobs=[{id:'1',state:'queued',progress:0,phase:'wait',outputs:[]}];
 assert.equal(retainEqualJobs(jobs,structuredClone(jobs)),jobs);
 for(const patch of [{id:'2'},{state:'done'},{progress:1},{phase:'render'},{outputs:[{url:'new'}]},{error:'failed'}]) {
  const next=[{...jobs[0],...patch}]; assert.equal(retainEqualJobs(jobs,next),next);
 }
});
