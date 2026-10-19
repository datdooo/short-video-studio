import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm,stat} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {copyWorkerLibraries} from '../scripts/worker-runtime-files.mjs';
test('macOS and Windows shared runtime manifest includes the entire worker relative-import closure',async t=>{
 const project=path.resolve(import.meta.dirname,'..'),app=await mkdtemp(path.join(tmpdir(),'worker-package-'));t.after(()=>rm(app,{recursive:true,force:true}));
 await cp(path.join(project,'worker'),path.join(app,'worker'),{recursive:true,filter:f=>!f.endsWith('.test.mjs')});await copyWorkerLibraries(project,app);
 const seen=new Set();async function visit(file){if(seen.has(file))return;seen.add(file);assert.ok((await stat(file)).isFile(),file);const s=await readFile(file,'utf8');
  for(const match of s.matchAll(/(?:from\s+|import\s*\()(['"])(\.[^'"]+)\1/g)) await visit(path.resolve(path.dirname(file),match[2]));
 }await visit(path.join(app,'worker/server.mjs'));
 assert.ok(seen.has(path.join(app,'lib/source-context/comments.mjs')));
 assert.ok(seen.has(path.join(app,'lib/source-context/heatmap.mjs')));
 assert.ok(seen.has(path.join(app,'worker/source-context.mjs')));
 assert.ok(seen.has(path.join(app,'worker/shared-operation.mjs')));
 assert.ok(seen.has(path.join(app,'worker/chatgpt-auth-state.mjs')));
 for(const platform of ['macos','windows'])assert.match(await readFile(path.join(project,`scripts/package-${platform}.mjs`),'utf8'),/await copyWorkerLibraries\(/);
});
