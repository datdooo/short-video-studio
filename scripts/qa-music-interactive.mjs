// Private ordinary-editor QA: real worker/media/music; auth status, source-prep
// responses and plan response are explicit fixtures. No AI/YouTube call; normal
// app stays on5273/8887.
import {spawn} from 'node:child_process';import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {resolveRuntime,runtimeEnvironment,prepareRuntimeDirectories,assertRuntimePortsAvailable} from '../desktop/runtime-config.mjs';
import {adjustTeaserRange} from '../lib/teaser-hooks.mjs';import {PLAYBACK_RATE} from '../lib/render-config.mjs';
const project=path.resolve(import.meta.dirname,'..'),base=path.join(project,'.isolation-verification/adaptive-teaser');await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'ui-')),runtime=resolveRuntime({profile:'development',home:path.join(root,'private-home')}),bin=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin');
for(const p of[5274,8899,8896])await assertRuntimePortsAvailable({name:'Private music UI',webPort:p,workerPort:p});await prepareRuntimeDirectories(runtime);
const env={...runtimeEnvironment(runtime),PATH:'/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',FFMPEG_PATH:path.join(bin,'ffmpeg'),FFPROBE_PATH:path.join(bin,'ffprobe'),MEDIA_WORKER_PORT:'8899',NEXT_PUBLIC_MEDIA_WORKER_ORIGIN:'http://127.0.0.1:8896',SHORTCUT_PERSONAL_BUILD:'1',CHATGPT_KEYCHAIN_SERVICE:'ShortCut Studio Dev Private Music UI QA'};
const children=[],requests=[];function start(args){const p=spawn(process.execPath,args,{cwd:project,env,stdio:['ignore','pipe','pipe'],detached:true});children.push(p);p.stdout.on('data',b=>void writeFile(path.join(root,'runtime.log'),b,{flag:'a'}));p.stderr.on('data',b=>void writeFile(path.join(root,'runtime.log'),b,{flag:'a'}));}
const delay=ms=>new Promise(r=>setTimeout(r,ms));start(['worker/server.mjs']);
for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8899/health')).ok)break;}catch{}await delay(200);}
const response=await fetch('http://127.0.0.1:8899/api/sources/upload?filename=real-building-200s.mp4',{method:'POST',body:await readFile(path.join(project,'.isolation-verification/teaser-finish/real-building-200s.mp4'))});if(!response.ok)throw Error('Private source upload failed');const{source}=await response.json();
const saved=JSON.parse(await readFile(path.join(project,'.isolation-verification/teaser-resume-20261019/real-ai-plan.json'),'utf8')),cues=saved.plan.captionCues.cues;
const plan={providerUsed:'manual',originalTitle:'Real house-lift footage · synthetic QA plan response',language:'en',teaserPolicy:'per-part-v1',hookTransition:'vr-light-leak-v2',parts:[{id:1,title:'Site clearing and preparation',segments:[{start:0,end:95}]},{id:2,title:'Daily lift measurement',segments:[{start:100,end:200}]}].map((p,i)=>adjustTeaserRange({...p,startTrimApplied:true,smartCutApplied:true,hashtags:[]},i?160.36:61.8,i?166.84:68.439,cues)),captionCues:{...saved.plan.captionCues,sourceId:source.id,sourceDuration:200},subtitles:{enabled:true,source:'youtube',size:48,color:'#ffffff',outline:3}};
const json=(res,v,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, X-Filename, X-Catalog-Id','Access-Control-Allow-Methods':'GET, POST, HEAD, OPTIONS'});res.end(JSON.stringify(v));};
const proxy=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:8896');requests.push({at:Date.now(),path:url.pathname,method:req.method});if(req.method==='OPTIONS'){json(res,{});return;}
 if(url.pathname==='/api/chatgpt/session'){json(res,{session:{available:true,connected:true,sharing:true}});return;}
 if(url.pathname==='/api/youtube/metadata'){json(res,{title:source.title,videoId:'BaW_jenozKc'});return;}
 if(url.pathname==='/api/youtube/transcript'){json(res,{transcript:cues.map(c=>`[${c.start.toFixed(3)}] ${c.text}`).join('\n')});return;}
 if(url.pathname==='/api/sources/youtube'){json(res,{source},201);return;}
 if(url.pathname.endsWith('/auto-cut')){json(res,{plan});return;}
 if(url.pathname==='/qa/report'){json(res,{requests,root,sourceId:source.id,syntheticPlanOnly:true,realMedia:true,liveProviderCalls:0,playbackRate:PLAYBACK_RATE});return;}
 if(url.pathname==='/qa/transition'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Original warm leak scope preview</title><p>Original generated effect; outside purple and labels must remain unchanged. Not Adobe parity.</p><video controls loop width="360" src="/qa/preview.mp4"></video>');return;}
 if(url.pathname==='/qa/preview.mp4'){res.writeHead(200,{'Content-Type':'video/mp4'});res.end(await readFile(path.join(base,'foreground-preview.mp4')));return;}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const upstream=await fetch('http://127.0.0.1:8899'+req.url,{method:req.method,headers:{...req.headers,host:'127.0.0.1:8899'},...(chunks.length?{body:Buffer.concat(chunks)}:{})});res.writeHead(upstream.status,Object.fromEntries(upstream.headers));res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch(e){json(res,{error:String(e.message)},500);}});
proxy.listen(8896,'127.0.0.1');start(['scripts/run-framework.mjs','dev','--port','5274','--hostname','127.0.0.1']);
await writeFile(path.join(base,'ui-session.json'),JSON.stringify({root,pids:children.map(p=>p.pid),proxyPid:process.pid,url:'http://127.0.0.1:5274',proxy:'http://127.0.0.1:8896',sourceId:source.id,syntheticPlanOnly:true,realMedia:true},null,2));console.log('Private editor http://127.0.0.1:5274; no live provider calls.');
let closing=false;async function close(){if(closing)return;closing=true;proxy.close();for(const p of children)try{process.kill(-p.pid,'SIGTERM');}catch{}await writeFile(path.join(base,'ui-requests.json'),JSON.stringify(requests,null,2));setTimeout(()=>process.exit(),1000).unref();}
process.on('SIGTERM',close);process.on('SIGINT',close);
