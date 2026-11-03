import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createQueueHistory} from './queue-history.mjs';
test('persist and restart recover exact item plans before resume using only fixture directories',async t=>{
 const dataRoot=await mkdtemp(path.join(tmpdir(),'history-fixture-'));t.after(()=>rm(dataRoot,{recursive:true,force:true}));
 const sourcesRoot=path.join(dataRoot,'sources');await mkdir(sourcesRoot);
 const plan={originalTitle:'fixture',parts:[{id:1,segments:[{start:0,end:10}]}]};
 const state={dataRoot,sourcesRoot,probeMedia:()=>assert.fail('no probing'),batches:new Map([['b',{id:'b',items:[{id:'i',jobId:'j',state:'cancelled',plan:structuredClone(plan)}]}]]),jobs:new Map([['j',{id:'j',state:'cancelled',plan}]])};
 await createQueueHistory(()=>state).persistBatchHistory({strict:true});
 const raw=JSON.parse(await readFile(path.join(dataRoot,'batch-history.json'),'utf8'));assert.equal(raw.batches[0].items[0].planJobId,'j');
 state.batches.clear();state.jobs.clear();await createQueueHistory(()=>state).restoreBatchHistory();
 assert.deepEqual(state.batches.get('b').items[0].plan,plan);assert.deepEqual(state.jobs.get('j').plan,plan);
});
test('legacy output discovery uses indexed metadata without source.json, falls back for unindexed folders',async t=>{
 const dataRoot=await mkdtemp(path.join(tmpdir(),'history-index-fixture-'));t.after(()=>rm(dataRoot,{recursive:true,force:true}));
 const sourcesRoot=path.join(dataRoot,'sources'),ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const {writeFile}=await import('node:fs/promises');
 for(const id of ids){
  const dir=path.join(sourcesRoot,id,'outputs',id,'part-1');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'fixture.mp4'),'not real media');
 }
 await writeFile(path.join(dataRoot,'youtube-source-index.json'),JSON.stringify({version:2,records:[{id:ids[0],kind:'youtube',title:'Indexed',sourceUrl:'https://youtu.be/BaW_jenozKc'}]}));
 await writeFile(path.join(sourcesRoot,ids[1],'source.json'),JSON.stringify({kind:'youtube',title:'Fallback',sourceUrl:'https://youtu.be/abcdefghijk'}));
 const state={dataRoot,sourcesRoot,probeMedia:async()=>({duration:10}),batches:new Map(),jobs:new Map()};
 await createQueueHistory(()=>state).restoreBatchHistory();assert.equal(state.jobs.size,2);
 assert.deepEqual([...state.batches.values()].flatMap(b=>b.items.map(i=>i.title)).sort(),['Fallback','Indexed']);
});
