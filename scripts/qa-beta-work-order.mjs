// Synthetic browser only. No real worker, account, source or mutation is reached.
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.QA_PLAYWRIGHT_MODULE||'/private/tmp/marketing-slide-tools/node_modules/playwright/index.mjs');
const root=path.resolve('.isolation-verification/work-order-complete/ui');await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[],errors=[],blocked=[],fonts=[];
try{
 const context=await browser.newContext();
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1'&&u.port==='5373')return route.continue();
  if(u.hostname==='127.0.0.1'&&u.port==='8987'){
   let json={};
   if(u.pathname==='/health')json={ok:true,readyForYouTube:true,tools:{},render:{}};
   else if(u.pathname==='/api/chatgpt/session')json={session:{available:false,connected:false,sharing:false}};
   else if(u.pathname==='/api/storage')json={library:{storages:[],originals:[],parts:[],trash:[],warnings:[],totals:{originals:0,parts:0,trash:0}}};
   else if(u.pathname==='/api/editor-renders')json={jobs:[]};
   else if(u.pathname==='/api/batches')json={batches:[]};
   else if(u.pathname==='/api/music')json={assets:[]};
   else if(u.pathname==='/api/editor/source-lease')json={accepted:true};
   else if(u.pathname==='/api/speech/status')json={modelReady:false,installing:false};
   else {blocked.push({path:u.pathname,method:route.request().method()});return route.fulfill({status:503,json:{error:'Synthetic offline fixture'}});}
   return route.fulfill({json,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'}});
  }
  blocked.push({url:u.origin});return route.abort();
 });
 const page=await context.newPage();page.on('request',request=>{if(/NotoSans(?:JP|KR)/.test(request.url()))fonts.push(new URL(request.url()).pathname);});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5373/',{waitUntil:'networkidle'});
 for(const [width,height]of [[1440,900],[1280,720],[1024,768],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});
  for(const name of ['Editor','Batch','Kho']){
   await page.getByRole('navigation',{name:'Chế độ làm việc'}).getByRole('button',{name,exact:true}).click();
   await page.screenshot({path:path.join(root,`${width}-${height}-${name}.png`),fullPage:true});
   if(name==='Editor'){
    if(width<900)await page.getByRole('button',{name:'Thu/mở nguồn',exact:true}).click();
    const extra=page.getByLabel('Yêu cầu bổ sung',{exact:true});
    if(await extra.isVisible()) {await extra.fill('Giữ diễn biến và kết quả — tiếng Việt dài 日本語 한국어 '.repeat(8));assert.ok((await extra.inputValue()).includes('日本語'));}
    const advanced=page.getByRole('button',{name:'Nâng cao',exact:true});
    if(await advanced.isVisible()){await advanced.click();await page.screenshot({path:path.join(root,`${width}-${height}-Editor-advanced.png`),fullPage:true});await advanced.click();}
    if(width<900)await page.keyboard.press('Escape');
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   results.push({width,height,workspace:name,overflow});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('navigation',{name:'Chế độ làm việc'}).getByRole('button',{name:'Editor',exact:true}).click();
 await page.getByRole('button',{name:'Thu/mở nguồn',exact:true}).click();
 await assert.doesNotReject(()=>page.getByRole('dialog').waitFor());
 await page.keyboard.press('Escape');await assert.doesNotReject(()=>page.getByRole('dialog').waitFor({state:'hidden'}));
 assert.equal(await page.getByRole('button',{name:'Thu/mở nguồn',exact:true}).evaluate(n=>n===document.activeElement),true);
 await page.getByRole('button',{name:'Phím tắt',exact:true}).click();await page.getByRole('dialog').waitFor();await page.screenshot({path:path.join(root,'390-shortcuts.png'),fullPage:true});await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('button',{name:'Phím tắt',exact:true}).evaluate(n=>n===document.activeElement),true);
 await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await page.screenshot({path:path.join(root,'390-forced-colors-reduced-motion.png'),fullPage:true});
 await writeFile(path.join(root,'result.json'),JSON.stringify({results,errors,blocked,fonts,fixture:'empty/offline worker mocked; no real data'},null,2));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({screenshots:results.length+1,errors,overflow:results.filter(r=>r.overflow)}));
}finally{await browser.close();}
