// Static import closure, including literal dynamic imports and require().
// Also retain a UI file if any repository script/config names it literally.
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n'))].filter(f=>/\.(?:[cm]?[jt]sx?|json)$/.test(f)&&existsSync(f));
const code=files.filter(f=>/\.[cm]?[jt]sx?$/.test(f)),ui=code.filter(f=>f.startsWith('components/ui/'));
const source=new Map(code.map(f=>[f,readFileSync(f,'utf8')]));
const graph=new Map(),packages=new Map();
function resolve(from,spec){if(!spec.startsWith('.')&&!spec.startsWith('@/'))return null;const base=spec.startsWith('@/')?spec.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));return [base,...['.tsx','.ts','.mjs','.js','/index.tsx','/index.ts'].map(ext=>base+ext)].find(f=>source.has(f));}
for(const [f,text]of source){const imports=[];const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true);function walk(n){
 if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))imports.push(n.moduleSpecifier.text);
 if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0]))imports.push(n.arguments[0].text);
 ts.forEachChild(n,walk);}walk(sf);graph.set(f,imports.flatMap(s=>resolve(f,s)||[]));packages.set(f,imports.filter(s=>!s.startsWith('.')&&!s.startsWith('@/')).map(s=>s.startsWith('@')?s.split('/').slice(0,2).join('/'):s.split('/')[0]));}
const live=new Set();function visit(f){if(live.has(f))return;live.add(f);for(const next of graph.get(f)||[])visit(next);}
for(const f of code.filter(f=>!ui.includes(f)))visit(f);
for(const u of ui){const fragment=u.replace(/\.tsx?$/,'');if(files.some(f=>!f.startsWith('components/ui/')&&f!=='scripts/audit-ui-dependencies.mjs'&&readFileSync(f,'utf8').includes(fragment)))visit(u);}
const unused=ui.filter(f=>!live.has(f));const usedPackages=[...new Set([...live].flatMap(f=>packages.get(f)||[]))].sort();
const result={roots:code.length-ui.length,liveUi:ui.filter(f=>live.has(f)),unusedUi:unused,usedPackages,unresolvedDynamic:'Computed imports require source review; current source has no components/ui glob or computed loader.'};
mkdirSync('.isolation-verification/work-order-complete',{recursive:true});writeFileSync('.isolation-verification/work-order-complete/ui-dependencies.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
