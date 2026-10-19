import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,writeFile,utimes} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {createAnalysisCache,requireDiskSpace} from './analysis-cache.mjs';
test('cache bounds prune only task cache entries; protected resume data survives pressure and malformed/symlink input is not consumed',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'analysis-cache-'));t.after(()=>rm(root,{recursive:true,force:true}));const protectedKeys=new Set(['a'.repeat(64)]);
 const cache=createAnalysisCache(root,{maxBytes:300,maxAgeMs:1,protectedKeys:()=>protectedKeys});
 assert.equal(await cache.put('a'.repeat(64),{important:'keep'}),true);
 await writeFile(path.join(root,'b'.repeat(64)+'.json'),JSON.stringify({value:'stale'}));await utimes(path.join(root,'b'.repeat(64)+'.json'),new Date(0),new Date(0));
 await writeFile(path.join(root,'user-plan.txt'),'never remove');await cache.prune();
 assert.ok((await readdir(root)).includes('a'.repeat(64)+'.json'));assert.ok((await readdir(root)).includes('user-plan.txt'));assert.ok(!(await readdir(root)).includes('b'.repeat(64)+'.json'));
 assert.deepEqual(await cache.get('a'.repeat(64)),{important:'keep'});assert.equal(await cache.put('c'.repeat(64),'x'.repeat(500)),false);await assert.rejects(cache.using('../unsafe',()=>cache.put('../unsafe',{})).then(v=>{if(v===false)throw Error('refused');}));
 assert.ok(!(await readdir(root)).some(n=>n.endsWith('.tmp')));
 await assert.rejects(requireDiskSpace(root,Number.MAX_SAFE_INTEGER),/Insufficient/);
});
