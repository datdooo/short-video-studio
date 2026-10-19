// Updated packaged runtime smoke on private ports/HOME; no normal app interruption.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {resolveRuntime,runtimeEnvironment,prepareRuntimeDirectories,assertRuntimePortsAvailable} from '../desktop/runtime-config.mjs';
import {adjustTeaserRange} from '../lib/teaser-hooks.mjs';
const project=path.resolve(import.meta.dirname,'..'),base=path.join(project,'.isolation-verification/adaptive-teaser'),root=await mkdtemp(path.join(base,'package-')),resources=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources'),app=path.join(resources,'app'),bin=path.join(resources,'runtime/bin'),runtime=resolveRuntime({profile:'development',home:path.join(root,'private-home')});
const report={privatePorts:[5275,8894],normalAppUntouched:true,providerCalls:0,root},children=[];let logs='';const delay=ms=>new Promise(r=>setTimeout(r,ms));
function start(file,env){const child=spawn(path.join(bin,'node'),[file],{cwd:app,env,stdio:['ignore','pipe','pipe']});children.push(child);for(const stream of[child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-3000));}
async function call(route,body){const r=await fetch('http://127.0.0.1:8894'+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
try{
const config=JSON.parse(await readFile(path.join(resources,'config.json'),'utf8'));assert.deepEqual(config,{profile:'development',webPort:5273,workerPort:8887,existingDataRoot:null});
for(const file of['worker/server.mjs','lib/teaser-candidates.mjs','lib/teaser-prompt.mjs','lib/music/vr-light-leak.mjs','public/effects/warm-cloud-leak-v2.png','third_party/teaser-reuse/AI-Youtube-Shorts-Generator-MIT.txt'])assert.equal(createHash('sha256').update(await readFile(path.join(project,file))).digest('hex'),createHash('sha256').update(await readFile(path.join(app,file))).digest('hex'),file);
const sign=spawnSync('/usr/bin/codesign',['--verify','--deep','--strict',path.dirname(path.dirname(resources))],{encoding:'utf8'});assert.equal(sign.status,0,sign.stderr);report.signature=true;report.sourceAssetNoticeHashes=true;
for(const port of report.privatePorts)await assertRuntimePortsAvailable({name:'Private packaged smoke',webPort:port,workerPort:port});await prepareRuntimeDirectories(runtime);
const env={...runtimeEnvironment(runtime),PATH:bin+':/usr/bin:/bin',MEDIA_WORKER_PORT:'8894',FFMPEG_PATH:path.join(bin,'ffmpeg'),FFPROBE_PATH:path.join(bin,'ffprobe'),CHATGPT_KEYCHAIN_SERVICE:'ShortCut Studio Dev Packaged Adaptive QA'};
start(path.join(app,'worker/server.mjs'),env);start(path.join(app,'server.js'),{...env,PORT:'5275',HOST:'127.0.0.1'});
let ready=false;for(let i=0;i<100;i++){try{assert.equal((await call('/health')).dataRoot,runtime.dataRoot);if((await fetch('http://127.0.0.1:5275')).ok){ready=true;break;}}catch{}await delay(200);}assert.ok(ready,logs);report.frontend200=true;
const effect=await fetch('http://127.0.0.1:5275/effects/warm-cloud-leak-v2.png');assert.ok(effect.ok);report.sprite200=true;
const upload=await fetch('http://127.0.0.1:8894/api/sources/upload?filename=real-building-200s.mp4',{method:'POST',body:await readFile(path.join(project,'.isolation-verification/teaser-finish/real-building-200s.mp4'))});assert.equal(upload.status,201);const{source}=await upload.json();
const music=await fetch('http://127.0.0.1:8894/api/music/import',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Filename':'Sauropod%20Spotting.mp3','X-Catalog-Id':'incompetech-usuan2500002'},body:await readFile('/Users/datdo/Library/Application Support/ShortCut Studio Dev/media/music/d62bc20e3e9f97386ff7611d32f0e91936aaf2a218782cbca25e70caaf31b1b6.mp3')});assert.equal(music.status,201);const{asset}=await music.json();
const cues=JSON.parse(await readFile(path.join(project,'.isolation-verification/teaser-resume-20261019/real-ai-plan.json'),'utf8')).plan.captionCues.cues;
const plan={providerUsed:'manual',teaserPolicy:'per-part-v1',hookTransition:'vr-light-leak-v2',originalTitle:'Packaged smoke',parts:[{id:1,title:'Part1',segments:[{start:45,end:75}],startTrimApplied:true,smartCutApplied:true},{id:2,title:'Part2',segments:[{start:145,end:175}],startTrimApplied:true,smartCutApplied:true}].map((p,i)=>adjustTeaserRange(p,i?160.36:61.8,i?166.84:68.439,cues)),music:{version:1,enabled:true,volume:40,ducking:true,assetId:asset.id}};
const mix=await call('/api/music/preview',{sourceId:source.id,plan,partId:1,sessionId:randomUUID()});assert.equal(mix.speechStatus,'available');const media=await fetch('http://127.0.0.1:8894/api/music/preview/'+mix.id+'/media');assert.ok(media.ok);const bytes=(await media.arrayBuffer()).byteLength;assert.ok(bytes>10000);report.realMusicPreview={bytes,duration:mix.duration,speechStatus:mix.speechStatus};report.nativeInteractiveLaunchTested=false;report.packagedBrowserInteractionsTested=false;report.success=true;
}catch(e){report.success=false;report.error=e.message;report.logs=logs;throw e;}
finally{for(const child of children)child.kill('SIGTERM');await delay(800);for(const child of children)if(child.exitCode===null)child.kill('SIGKILL');await writeFile(path.join(base,'package-report.json'),JSON.stringify(report,null,2));if(report.success)await rm(root,{recursive:true,force:true});console.log(JSON.stringify(report));}
