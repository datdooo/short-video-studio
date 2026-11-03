import ts from 'typescript';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm,stat} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {copyWorkerLibraries} from '../scripts/worker-runtime-files.mjs';
function relativeImports(text){const out=[];const tree=ts.createSourceFile('runtime.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);function walk(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('.'))out.push(n.moduleSpecifier.text);if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0])&&n.arguments[0].text.startsWith('.'))out.push(n.arguments[0].text);ts.forEachChild(n,walk);}walk(tree);return out;}
test('runtime closure follows executable imports, including side effects/dynamic/require, without treating JSDoc types as runtime files',()=>{assert.deepEqual(relativeImports(`/** @typedef {import('../lib/edit-plan').EditPlan} Plan */
import './a.mjs';export{b}from'./b.mjs';const c=import('./c.mjs');const d=require('./d.mjs');`),['./a.mjs','./b.mjs','./c.mjs','./d.mjs']);});
test('macOS and Windows shared runtime manifest includes the entire worker relative-import closure',async t=>{
 const project=path.resolve(import.meta.dirname,'..'),app=await mkdtemp(path.join(tmpdir(),'worker-package-'));t.after(()=>rm(app,{recursive:true,force:true}));
 await cp(path.join(project,'worker'),path.join(app,'worker'),{recursive:true,filter:f=>!f.endsWith('.test.mjs')});await copyWorkerLibraries(project,app);
 const seen=new Set();async function visit(file){if(seen.has(file))return;seen.add(file);assert.ok((await stat(file)).isFile(),file);const s=await readFile(file,'utf8');
  for(const dependency of relativeImports(s)) await visit(path.resolve(path.dirname(file),dependency));
 }await visit(path.join(app,'worker/server.mjs'));
 assert.ok(seen.has(path.join(app,'lib/source-context/comments.mjs')));
 assert.ok(seen.has(path.join(app,'lib/source-context/heatmap.mjs')));
 assert.ok(seen.has(path.join(app,'worker/source-context.mjs')));
 assert.ok(seen.has(path.join(app,'worker/shared-operation.mjs')));
 assert.ok(seen.has(path.join(app,'worker/chatgpt-auth-state.mjs')));
 for(const file of ['chatgpt-auth.mjs','analysis-service.mjs','source-service.mjs','command-runner.mjs','http-responses.mjs','queue-history.mjs','routes/router.mjs','routes/http-handler.mjs','routes/sources.mjs','routes/index.mjs','render/composition.mjs','render/coordinator.mjs','library-service.mjs','batch-service.mjs','runtime-tools.mjs'])assert.ok(seen.has(path.join(app,'worker',file)),file);
 for(const platform of ['macos','windows'])assert.match(await readFile(path.join(project,`scripts/package-${platform}.mjs`),'utf8'),/await copyWorkerLibraries\(/);
});
