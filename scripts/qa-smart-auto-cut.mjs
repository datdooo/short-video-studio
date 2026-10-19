// Bounded DEV-only smoke. No live AI/YouTube request. Synthetic evidence is labeled.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile,link,stat,rm,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {resolveRuntime,runtimeEnvironment,prepareRuntimeDirectories,assertRuntimePortsAvailable} from '../desktop/runtime-config.mjs';
import {normalizeSourceContext} from '../lib/source-context/index.mjs';
import {fallbackTeaser,TEASER_POLICY} from '../lib/teaser-hooks.mjs';
import {requireDiskSpace} from '../worker/analysis-cache.mjs';
const project=path.resolve(import.meta.dirname,'..'),packaged=process.argv.includes('--packaged');
const root=path.join(project,'.isolation-verification/smart-auto-defg/smoke');
await mkdir(root,{recursive:true});
for(const name of [`${packaged?'packaged':'source'}-report.json`,`${packaged?'packaged':'source'}-failure.png`]){try{await rename(path.join(root,name),path.join(root,`${Date.now()}-${name}`));}catch{/* first attempt */}}
await writeFile(path.join(root,'.task-owned-smoke'),'SmartAuto D/E/F/G synthetic smoke');
const home=path.join(root,'private-home'),runtime=resolveRuntime({profile:'development',home});
const sourceId='55555555-5555-4555-8555-555555555555',videoId='BaW_jenozKc',url=`https://www.youtube.com/watch?v=${videoId}`;
const resources=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources'),bin=packaged?path.join(resources,'runtime/bin'):'/opt/homebrew/bin';
const node=packaged?path.join(bin,'node'):process.execPath,ffmpeg=path.join(bin,'ffmpeg'),ffprobe=path.join(bin,'ffprobe');
await requireDiskSpace(project,512*1024*1024);await assertRuntimePortsAvailable(runtime);await prepareRuntimeDirectories(runtime);
const fixture=path.join(root,'fixture.mp4');
function command(binary,args){const r=spawnSync(binary,args,{maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr?.toString().slice(-2000));return r.stdout.toString();}
if(!packaged){
  command(ffmpeg,['-hide_banner','-v','error','-nostdin','-y','-f','lavfi','-i','color=black:s=320x180:r=2:d=80','-f','lavfi','-i','color=white:s=320x180:r=2:d=80','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=160','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a','-c:v','libx264','-preset','ultrafast','-crf','28','-c:a','aac','-b:a','32k',fixture]);
  assert.ok((await stat(fixture)).size<2*1024*1024);
  const directory=path.join(runtime.dataRoot,'sources',sourceId);await mkdir(directory,{recursive:true});
  try{await link(fixture,path.join(directory,'source.mp4'));}catch(e){if(e.code!=='EEXIST')throw e;}
  const title='Synthetic harvest fixture — NOT real speech',captions=[{start:4,end:10,text:'Synthetic preparation caption.'},{start:84,end:90,text:'Synthetic harvest caption.'}];
  const context=normalizeSourceContext({sourceId,url,info:{id:videoId,title,duration:160,description:'Synthetic test data; no actual farming action/speech.',comments:[],chapters:[{start_time:0,end_time:80,title:'Black scene'},{start_time:80,end_time:160,title:'White scene'}],heatmap:[]}});
  Object.assign(context.provenance.fields,{contextMetadata:'qa-synthetic',contextComments:'qa-synthetic',contextHeatmap:'qa-synthetic'});
  await writeFile(path.join(directory,'source.json'),JSON.stringify({id:sourceId,kind:'youtube',sourceUrl:url,youtubeVideoId:videoId,title,originalFilename:'source.mp4',duration:160,width:320,height:180,hasAudio:true,transcript:'[00:04] Synthetic preparation caption.\n[01:24] Synthetic harvest caption.',captions,subtitleFound:true,sourceContext:context,createdAt:new Date().toISOString()}));
}
if(packaged){
  const resume=JSON.parse(await readFile(path.join(root,'resume.json'),'utf8'));
  const file=path.join(runtime.dataRoot,'batch-history.json'),history=JSON.parse(await readFile(file,'utf8'));
  const job=history.jobs.find(j=>j.id===resume.jobId);assert.ok(job&&job.sourceId===sourceId&&job.outputs.length===2);
  job.state='cancelled';job.error='QA-only simulated interruption after completed parts';
  const item=history.batches.find(b=>b.id===resume.batchId)?.items.find(i=>i.id===resume.itemId);assert.equal(item.jobId,job.id);item.state='cancelled';
  await writeFile(file,JSON.stringify(history));
}
const children=[],errors=[],violations=[],requests=[],report={mode:packaged?'packaged':'source',synthetic:true,liveAIRequests:0,liveYouTubeRequests:0};let logs='',browser,page;
function child(binary,args,env,cwd=project){const p=spawn(binary,args,{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});children.push(p);p.stdout.on('data',b=>{logs=(logs+b).slice(-16000);});p.stderr.on('data',b=>{logs=(logs+b).slice(-16000);});return p;}
async function stop(){for(const p of children){if(p.exitCode===null){try{process.kill(-p.pid,'SIGTERM');}catch{/* own child exited */}}}await Promise.race([Promise.all(children.filter(p=>p.exitCode===null).map(p=>once(p,'exit'))),new Promise(r=>setTimeout(r,5000))]);for(const p of children)if(p.exitCode===null)try{process.kill(-p.pid,'SIGKILL');}catch{/* own child exited */}}
async function call(route,method='GET',body){const response=await fetch(runtime.workerOrigin+route,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.ok(response.ok,`${route}: ${JSON.stringify(value).slice(0,1500)}`);return value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
  if(packaged){
    const config=JSON.parse(await readFile(path.join(resources,'config.json'),'utf8'));assert.equal(config.profile,'development');assert.equal(config.webPort,5273);assert.equal(config.workerPort,8887);
    command(node,['--input-type=module','-e',`await import(${JSON.stringify(path.join(resources,'app/worker/auto-cut-workflow.mjs'))});await import(${JSON.stringify(path.join(resources,'app/worker/source-reuse.mjs'))})`]);
    child(node,[path.join(resources,'desktop/bootstrap.mjs')],{HOME:home,PATH:`${bin}:/usr/bin:/bin:/usr/sbin:/sbin`},resources);
  }else{
    const env={...runtimeEnvironment(runtime),PATH:`${path.dirname(node)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,SHORTCUT_PERSONAL_BUILD:'1',FFMPEG_PATH:ffmpeg,FFPROBE_PATH:ffprobe,CHATGPT_KEYCHAIN_SERVICE:'ShortCut Studio Dev QA SmartAuto 20261019'};
    child(node,['worker/server.mjs'],env);child(node,['scripts/run-framework.mjs','dev','--port','5273','--hostname','127.0.0.1'],env);
  }
  let ready=false;
  for(let i=0;i<180;i++){try{const health=await call('/health');if(health.ok&&(await fetch(runtime.webOrigin)).ok){assert.equal(health.dataRoot,runtime.dataRoot);ready=true;break;}}catch{/* starting */}await delay(500);}
  assert.ok(ready,logs);
  const {chromium}=await import(process.env.QA_PLAYWRIGHT_MODULE||'/Users/datdo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({viewport:{width:1500,height:1100}});
  await ctx.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(['data:','blob:'].includes(u.protocol))return route.continue();
    if(!['127.0.0.1','localhost'].includes(u.hostname)||!['5273','8887'].includes(u.port)){violations.push(u.origin);return route.abort();}
    requests.push({method:request.method(),path:u.pathname});
    // Never access the user's Keychain session or allow a provider request in smoke.
    if(u.pathname.startsWith('/api/chatgpt/'))return route.fulfill({json:{session:{available:true,connected:false,sharing:false}}});
    if(u.pathname==='/api/youtube/metadata')return route.fulfill({json:{videoId,title:'Synthetic harvest fixture — NOT real speech',channelName:'QA'}});
    if(u.pathname==='/api/youtube/transcript')return route.fulfill({json:{title:'Synthetic harvest fixture — NOT real speech',transcript:'[00:04] Synthetic preparation caption.\n[01:24] Synthetic harvest caption.'}});
    return route.continue();
  });
  page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(runtime.webOrigin);await page.getByText('Worker ready',{exact:true}).waitFor({timeout:60000});await page.locator('#youtube-url').fill(url);assert.equal(await page.locator('#youtube-url').inputValue(),url);
  await page.getByRole('button',{name:'Chuẩn bị source để render',exact:true}).click();await page.getByRole('button',{name:'Source đã sẵn sàng',exact:true}).waitFor({timeout:30000});
  if(!packaged){
    const response=page.waitForResponse(r=>r.url().endsWith(`/api/sources/${sourceId}/auto-cut`)&&r.request().postDataJSON()?.mode!== 'context');
    await page.getByRole('button',{name:'Generate 2-part plan',exact:true}).click();const data=await(await response).json();assert.ok(data.plan,JSON.stringify(data));
    assert.equal(data.plan.analysis.method,'deterministic-fallback');assert.ok(data.plan.parts.every(p=>p.teaser?.status==='selected'&&p.teaser.selection==='fallback'));report.auto={method:data.plan.analysis.method,parts:data.plan.parts.map(p=>({ranges:p.segments,hook:p.teaser}))};
    await page.getByRole('button',{name:'Visual template: Farming JP',exact:true}).click();const count=requests.filter(r=>r.path.endsWith('/auto-cut')).length;await delay(400);assert.equal(requests.filter(r=>r.path.endsWith('/auto-cut')).length,count);report.styleNoReanalysis=true;
  }
  // Choose an existing external provider. No external service is contacted.
  await page.getByRole('combobox').first().click();await page.getByRole('option',{name:/Gemini/}).click();
  const preparedResponse=page.waitForResponse(r=>r.url().endsWith(`/api/sources/${sourceId}/auto-cut`)&&r.request().postDataJSON()?.mode==='context');
  await page.getByRole('button',{name:/1\. Tạo prompt cho Gemini/}).click();const prepared=(await(await preparedResponse).json()).context;assert.ok(prepared.analysisKey);
  const prompt=await page.getByLabel('Prompt cho Gemini Pro',{exact:true}).inputValue();const requestId=prompt.match(/"requestId":\s*\{\s*"type":\s*"string",\s*"const":\s*"([a-f0-9-]+)"/)?.[1];assert.ok(requestId,'request nonce in actual prompt');
  const source=(await call(`/api/sources/${sourceId}`)).source;
  const external={sourceId,requestId,analysisKey:prepared.analysisKey,originalTitle:source.title,language:'en',parts:[1,2].map(id=>({id,title:`Synthetic scene ${id}`,hook:'Synthetic fixture; no real provider inference.',hashtags:Array.from({length:10},(_,i)=>`#fixture${i}`),segments:[{start:(id-1)*80,end:id*80,label:'Synthetic main',reason:'Intentional fixture continuous range',isPadding:false}],teaserSelection:{start:(id-1)*80+4,end:(id-1)*80+10,reason:'Synthetic caption repeat',relation:'Same synthetic part',evidenceTimes:[(id-1)*80+4],limitations:['Hand-authored QA fixture, no provider functionality claim.'],model:'qa-fixture-not-provider'}}))};
  await page.locator('#web-ai-result').fill(JSON.stringify(external));const importedResponse=page.waitForResponse(r=>r.url().endsWith(`/api/sources/${sourceId}/auto-cut`)&&r.request().postDataJSON()?.mode==='import');await page.getByRole('button',{name:'3. Kiểm tra và áp dụng 2 part',exact:true}).click();const imported=await(await importedResponse).json();assert.ok(imported.plan,JSON.stringify(imported));assert.deepEqual(imported.plan.parts.map(p=>p.segments.map(s=>[s.start,s.end])),[[[1,80]],[[81,160]]]);report.externalImport={method:imported.plan.analysis.method,provider:imported.plan.providerUsed};
  await page.screenshot({path:path.join(root,`${report.mode}-editor.png`),fullPage:false});
  if(!packaged){
    // Persist a web batch with duplicate aliases; no network or duplicate source file.
    const batch=(await call('/api/batches','POST',{provider:'gemini',urls:[url,'https://youtu.be/'+videoId],instruction:'Synthetic only',visualStyle:imported.plan.visualStyle})).batch;
    let current;for(let i=0;i<100;i++){current=(await call(`/api/batches/${batch.id}`)).batch;if(current.finished)break;await delay(200);}
    assert.equal(current.items.length,2);assert.ok(current.items.every(i=>i.state==='awaiting-import'&&i.sourceId===sourceId));report.batchSourceReuse={sourceId,items:2,waiting:2};
    const plan={...imported.plan,providerUsed:'manual',teaserPolicy:TEASER_POLICY,parts:imported.plan.parts.map((p,i)=>{const part={...p,startTrimApplied:true,smartCutApplied:true,segments:[{start:i*80+4,end:i*80+12,label:'Short manual smoke range',reason:'QA-only shortened render; full planner duration is tested separately.'}]};return{...part,teaser:fallbackTeaser(part,'Synthetic QA-only hook, not provider inference.',source.captions,'3'.repeat(64))};}),captionCues:{sourceId,sourceDuration:160,timeline:'source',origin:'qa-synthetic',cues:source.captions},subtitles:{enabled:true,source:'youtube',size:48,color:'#ffffff',outline:3}};
    delete plan.analysis;report.renderScope='Short explicit manual QA ranges; full Auto/Semi duration constraints verified separately. FHD/encoding unchanged.';
    const item=current.items[0];await call(`/api/batches/${batch.id}/items/${item.id}/plan`,'POST',{sourceId,transcript:source.transcript,instruction:'Synthetic only',plan});
    let done;for(let i=0;i<600;i++){done=(await call(`/api/batches/${batch.id}`)).batch.items[0];if(['done','error'].includes(done.state))break;await delay(500);}
    assert.equal(done.state,'done',JSON.stringify(done).slice(-1500));assert.equal(done.job.outputs.length,2);
    const audits=[];for(const output of done.job.outputs){const file=path.join(runtime.dataRoot,'sources',decodeURIComponent(output.url.slice('/files/'.length)));const info=JSON.parse(command(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]));const v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');assert.equal(v.width,1080);assert.equal(v.height,1920);assert.ok(a);const expected=(8+6)/1.25;assert.ok(Math.abs(Number(info.format.duration)-expected)<.2);audits.push({part:output.part,width:v.width,height:v.height,duration:Number(info.format.duration),audioDuration:Number(a.duration),size:(await stat(file)).size,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});}
    report.renders=audits;await writeFile(path.join(root,'resume.json'),JSON.stringify({batchId:batch.id,itemId:item.id,jobId:done.job.id,sourceId,outputs:done.job.outputs,audits}));
  }else{
    const resume=JSON.parse(await readFile(path.join(root,'resume.json'),'utf8'));
    const before=(await call(`/api/batches/${resume.batchId}`)).batch;assert.equal(before.items[0].state,'cancelled');
    await call(`/api/batches/${resume.batchId}/resume`,'POST',{itemIds:[resume.itemId]});
    let batch;for(let i=0;i<120;i++){batch=(await call(`/api/batches/${resume.batchId}`)).batch;if(['done','error'].includes(batch.items[0].state))break;await delay(250);}
    assert.equal(batch.items[0].state,'done');assert.equal(batch.items[0].job.id,resume.jobId);assert.equal(batch.items[1].state,'awaiting-import');
    // Startup/restart reuses persisted complete outputs. Explicit retry test is fixture-only.
    report.persistedBatch={items:batch.items.length,firstState:batch.items[0].state,secondState:batch.items[1].state};
    for(const output of resume.outputs){const file=path.join(runtime.dataRoot,'sources',decodeURIComponent(output.url.slice('/files/'.length)));assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),resume.audits.find(a=>a.part===output.part).sha256);}
    report.restartOutputHashesUnchanged=true;report.completedPartsReused=2;report.renderJobIdPreserved=true;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);report.browserErrors=errors;report.networkViolations=violations;report.success=true;
}catch(error){report.success=false;report.error=String(error.message);report.logs=logs.slice(-4000);if(page)await page.screenshot({path:path.join(root,`${report.mode}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();await stop();if(packaged&&report.success){assert.equal(await readFile(path.join(root,'.task-owned-smoke'),'utf8'),'SmartAuto D/E/F/G synthetic smoke');assert.equal(path.dirname(home),root);const usage=spawnSync('/usr/bin/du',['-sk',home],{encoding:'utf8'});report.cleanup={privateHomeApparentKiB:Number(usage.stdout?.trim().split(/\s+/)[0])||0,scope:'task-created private QA data/fixtures only'};await rm(home,{recursive:true,force:true});await rm(fixture,{force:true});}
await writeFile(path.join(root,`${report.mode}-report.json`),JSON.stringify(report,null,2));console.log(JSON.stringify({mode:report.mode,success:report.success,root,error:report.error}));}
