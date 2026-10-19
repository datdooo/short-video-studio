import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {createSourceReuse} from './source-reuse.mjs';
const url='https://youtu.be/BaW_jenozKc',id='11111111-1111-4111-8111-111111111111';
async function root(t){const dir=await mkdtemp(path.join(tmpdir(),'source-reuse-'));t.after(()=>rm(dir,{recursive:true,force:true}));const sourcesRoot=path.join(dir,'sources');await mkdir(sourcesRoot);return{dir,sourcesRoot};}
test('duplicate aliases and concurrent consumers share one stored media source, return independent metadata, and reuse after restart',async t=>{
 const f=await root(t);let downloads=0,metadata=0;const source={id,kind:'youtube',sourceUrl:url,title:'Fixture',duration:200,createdAt:'2026-10-19'};
 const options={sourcesRoot:f.sourcesRoot,metadata:async()=>{metadata++;return{metadata:{estimatedDownloadBytes:1024}};},download:async()=>{downloads++;await mkdir(path.join(f.sourcesRoot,id));await writeFile(path.join(f.sourcesRoot,id,'source.json'),JSON.stringify(source));return source;},load:async()=>structuredClone(source)};
 const reuse=createSourceReuse(options);const [a,b]=await Promise.all([reuse.get(url),reuse.get('https://www.youtube.com/watch?v=BaW_jenozKc')]);assert.equal(downloads,1);assert.equal(metadata,1);assert.equal(a.id,b.id);a.title='mutated';assert.equal(b.title,'Fixture');
 const restarted=createSourceReuse({...options,download:()=>assert.fail('must reuse source'),metadata:()=>assert.fail('no second extraction')});assert.equal((await restarted.get(url)).id,id);assert.ok(!(await readdir(f.dir)).some(n=>n.endsWith('.tmp')));
});
test('storage preflight refuses known oversized download and source identity/locked data are never silently replaced',async t=>{
 const f=await root(t);const options={sourcesRoot:f.sourcesRoot,metadata:async()=>({metadata:{estimatedDownloadBytes:Number.MAX_SAFE_INTEGER}}),download:()=>assert.fail('No partial download'),load:async()=>({})};await assert.rejects(createSourceReuse(options).get(url),/Insufficient free storage/);
 await mkdir(path.join(f.sourcesRoot,id));await writeFile(path.join(f.sourcesRoot,id,'source.json'),JSON.stringify({kind:'youtube',sourceUrl:url}));
 await assert.rejects(createSourceReuse({...options,isLocked:()=>true}).get(url),/busy/);
 await assert.rejects(createSourceReuse({...options,load:async()=>({kind:'youtube',sourceUrl:'https://youtu.be/abcdefghijk'})}).get(url),/identity mismatch/);
});
