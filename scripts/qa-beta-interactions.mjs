// Isolated React integration fixtures: these imports are the production controls.
// All worker requests and clipboard operations are synthetic; no installed app.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.QA_PLAYWRIGHT_MODULE||'/private/tmp/marketing-slide-tools/node_modules/playwright/index.mjs');
const out=path.resolve('.isolation-verification/work-order-complete/interactions');await mkdir(out,{recursive:true});
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{ConfirmationProvider,useConfirm}from'./components/confirmation-provider';
import{CopyButton}from'./components/copy-button';import{ManualVideoDownload}from'./components/manual-video-download';
import{MainRangesEditor}from'./components/main-ranges-editor';import{EditorDraftContext}from'./components/editor-draft-context';
import{mockPlan}from'./lib/edit-plan';const DEFAULT_REQUEST={originalTitle:'Synthetic',transcript:'',instruction:'',provider:'mock'};
function Fixture(){const confirm=useConfirm();const[text,setText]=useState('A'),[source,setSource]=useState('A'),[choice,setChoice]=useState('idle'),[controls,setControls]=useState({}),[plan,setPlan]=useState(()=>mockPlan(DEFAULT_REQUEST));
return <EditorDraftContext.Provider value={{controls,setControls,scope:'fixture',activity:()=>{}}}>
<button type="button" onClick={async()=>setChoice(await confirm({message:'Synthetic replacement',save:true}))}>Replace</button><output>{choice}</output>
<button type="button" onClick={()=>setText(t=>t==='A'?'B':'A')}>Change copy</button><CopyButton text={text} label="Copy fixture"/>
<button type="button" onClick={()=>setSource(s=>s==='A'?'B':'A')}>Change source</button><ManualVideoDownload worker="http://127.0.0.1:8987" sourceId={source}/>
<MainRangesEditor plan={plan} part={plan.parts[0]} duration={2000} onEdit={()=>{}} onDraft={()=>{}} onRestore={()=>setPlan(mockPlan(DEFAULT_REQUEST))} onInvalidate={()=>{}}/>
</EditorDraftContext.Provider>};createRoot(document.getElementById('root')).render(<ConfirmationProvider><Fixture/></ConfirmationProvider>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',platform:'browser',write:false,define:{'process.env.NODE_ENV':'"production"'}});
const browser=await chromium.launch({channel:'chrome',headless:true});const events=[],errors=[];
try{const context=await browser.newContext();await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());if(u.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module" src="/fixture.js"></script>'});
 if(u.pathname==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:bundle.outputFiles[0].text});
 events.push({path:u.pathname,method:req.method()});
 if(u.pathname.includes('/manual-video-status/'))return route.fulfill({json:{progress:{phase:'download',state:'running',percent:23,completedBytes:23,totalBytes:100}},headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,DELETE,OPTIONS'}});
 return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
 });const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.fixtureCopies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:text=>new Promise(resolve=>{window.fixtureCopies.push(text);window.finishFixtureCopy=resolve;})}});});
 await page.goto('http://127.0.0.1:5373/fixture');
 await page.getByRole('button',{name:'Replace',exact:true}).click();await page.getByRole('alertdialog').waitFor();
 for(const name of ['Lưu rồi mở','Bỏ phần chưa lưu','Ở lại'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),1);
 await page.keyboard.press('Escape');await page.getByRole('alertdialog').waitFor({state:'hidden'});assert.equal(await page.locator('output').textContent(),'cancel');assert.equal(await page.getByRole('button',{name:'Replace',exact:true}).evaluate(n=>n===document.activeElement),true);
 await page.getByRole('button',{name:'Replace',exact:true}).click();await page.getByRole('button',{name:'Lưu rồi mở',exact:true}).click();assert.equal(await page.locator('output').textContent(),'save');
 await page.getByRole('button',{name:'Copy fixture',exact:true}).click();await page.getByRole('button',{name:'Change copy',exact:true}).click();await page.evaluate(()=>window.finishFixtureCopy());assert.deepEqual(await page.evaluate(()=>window.fixtureCopies),['A']);assert.equal(await page.getByText('Đã sao chép',{exact:true}).count(),0);
 const start=page.getByLabel('Part 1 đoạn 1 Bắt đầu',{exact:true});await start.fill('00:00:');assert.equal(await start.inputValue(),'00:00:');assert.equal(await start.getAttribute('aria-invalid'),'true');
 await start.dispatchEvent('compositionstart');await start.fill('00:00:01:01');await start.dispatchEvent('compositionend',{data:'1'});assert.equal(await start.inputValue(),'00:00:01:01');
 await page.getByRole('button',{name:'Tải video',exact:true}).click();await page.getByRole('button',{name:'Dừng tải video',exact:true}).waitFor();
 await page.getByRole('button',{name:'Change source',exact:true}).click();await page.getByRole('button',{name:'Change source',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Dừng tải video',exact:true}).count(),0);
 assert.ok(events.some(e=>e.method==='DELETE'&&e.path.startsWith('/api/sources/A/')),'Old download canceled on source change');
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'result.json'),JSON.stringify({errors,events,checks:['dialog choices/Escape/focus','copy old completion suppressed','partial timecode/IME retained','download A→B→A cancels old task'],scope:'component integration only; no real worker'},null,2));console.log('PASS: dialog, clipboard, timecode and download ownership fixtures');
}finally{await browser.close();}
