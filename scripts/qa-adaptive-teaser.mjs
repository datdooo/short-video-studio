// Bounded source render plus lossless scope comparison; no AI/network.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {once} from 'node:events';
import {resolveRuntime,runtimeEnvironment,prepareRuntimeDirectories,assertRuntimePortsAvailable} from '../desktop/runtime-config.mjs';
import {fallbackTeaser,presentationSegments,partTransitionWindows,HOOK_PROMPT_VERSION} from '../lib/teaser-hooks.mjs';
import {partCaptions} from '../lib/subtitles.mjs';
import {vrLeakForegroundFilters,VR_LEAK_ID,VR_LEAK_SPRITE} from '../lib/music/vr-light-leak.mjs';
const project=path.resolve(import.meta.dirname,'..'), reportRoot=path.join(project,'.isolation-verification/adaptive-teaser');
await mkdir(reportRoot,{recursive:true});
const root=await mkdtemp(path.join(reportRoot,'smoke-')),bin=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin');
const ffmpeg=path.join(bin,'ffmpeg'),ffprobe=path.join(bin,'ffprobe'),report={synthetic:true,liveProviderCalls:0,root};
const run=(binary,args)=>{const r=spawnSync(binary,args,{maxBuffer:64*1024*1024});assert.equal(r.status,0,r.stderr?.toString().slice(-3500));return r.stdout;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let child,logs='';
try{
 // RGB lossless control proves masks/layer order independently of H264 blocks.
 const w=360,h=640,y=95,fgH=450,duration=2.4;
 const window={boundary:1,startFrame:27,cutFrame:36,endFrame:45,halfFrames:9,presetId:VR_LEAK_ID};
 const textFile=path.join(root,'labels.png');
 await sharp(Buffer.from(`<svg width="360" height="640"><g fill="white" font-family="sans-serif" font-size="18"><text x="20" y="35">TITLE · unaffected</text><text x="20" y="350">SUBTITLE · unaffected</text><text x="20" y="600">PART 1 · unaffected</text></g></svg>`)).png().toFile(textFile);
 for(const enabled of[false,true]){
 const graph=[`[0:v]format=rgba,pad=${w}:${fgH}:(ow-iw)/2:(oh-ih)/2:color=black@0[fg]`,...(enabled?vrLeakForegroundFilters('fg','lit',[window],1,w,fgH):['[fg]null[lit]']),`color=c=0x4b125d:s=${w}x${h}:r=30:d=3,format=rgb24[bg]`,`[bg][lit]overlay=0:${y}:shortest=1:format=rgb[scene]`,`[2:v]format=rgba[txt]`,`[scene][txt]overlay=0:0:shortest=1:format=rgb,setpts=PTS/1.25,fps=30:eof_action=pass,tpad=stop_mode=clone:stop_duration=0.1,trim=end_frame=72[out]`].join(';');
 run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=160x90:r=30:d=3','-loop','1','-i',path.join(project,'public',VR_LEAK_SPRITE.slice(1)),'-loop','1','-i',textFile,'-filter_complex',graph,'-map','[out]','-t',String(duration),'-an','-c:v','ffv1','-pix_fmt','bgr0',path.join(root,enabled?'effect.mkv':'control.mkv')]);
 }
 const raw=file=>run(ffmpeg,['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','-']);
 const control=raw(path.join(root,'control.mkv')),effect=raw(path.join(root,'effect.mkv')),frameSize=w*h*3;
 assert.equal(effect.length,control.length);assert.equal(effect.length/frameSize,72);
 let changed=0,outside=0,first=-1,last=-1;
 // Actual visible source rectangle x100..259 y275..364; padding is excluded.
 for(let frame=0;frame<72;frame++)for(let py=0;py<h;py++)for(let px=0;px<w;px++){
 const i=frame*frameSize+(py*w+px)*3,diff=Math.max(...[0,1,2].map(c=>Math.abs(control[i+c]-effect[i+c])));
 if(diff){if(px<100||px>=260||py<275||py>=365)outside++;else{changed++;if(first<0)first=frame;last=frame;}}
 }
 assert.equal(outside,0,'Outside background/transparent padding/text must match exactly');assert.ok(changed>1000);
 assert.ok(first>=27&&last<=45);report.scope={frames:72,changedPixels:changed,outsideChangedPixels:outside,firstEffectFrame:first,lastEffectFrame:last,foreground:[100,275,160,90],textCompositeAfterEffect:true};
 run(ffmpeg,['-v','error','-y','-i',path.join(root,'effect.mkv'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',path.join(reportRoot,'foreground-preview.mp4')]);
 for(const [label,at]of[['before',.8],['during',1.2],['after',1.6]])run(ffmpeg,['-v','error','-y','-ss',String(at),'-i',path.join(root,'effect.mkv'),'-frames:v','1',path.join(reportRoot,`${label}.png`)]);
 if(!process.argv.includes('--scope-only')){
 const runtime=resolveRuntime({profile:'development',home:path.join(root,'private-home')}),dataRoot=runtime.dataRoot,port=8897,api=`http://127.0.0.1:${port}`;
 await assertRuntimePortsAvailable({name:'Adaptive QA',webPort:port,workerPort:port});await prepareRuntimeDirectories(runtime);
 const fixture=path.join(root,'source.mp4');run(ffmpeg,['-v','error','-y','-f','lavfi','-i','testsrc2=s=320x180:r=30:d=60','-f','lavfi','-i','sine=f=440:r=48000:d=60','-c:v','libx264','-preset','ultrafast','-crf','28','-c:a','aac','-b:a','64k',fixture]);
 const env={...runtimeEnvironment(runtime),MEDIA_WORKER_PORT:String(port),FFMPEG_PATH:ffmpeg,FFPROBE_PATH:ffprobe,YT_DLP_PATH:path.join(bin,'yt-dlp'),FFMPEG_VIDEO_ENCODER:'h264_videotoolbox',CHATGPT_KEYCHAIN_SERVICE:'ShortCut Studio Dev Adaptive QA Isolated'};
 child=spawn(process.execPath,['worker/server.mjs'],{cwd:project,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs=(logs+b).slice(-6000));child.stderr.on('data',b=>logs=(logs+b).slice(-6000));
 const call=async(route,body)=>{const response=await fetch(api+route,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;};
 let ready=false;for(let i=0;i<100;i++){try{assert.equal((await call('/health')).dataRoot,dataRoot);ready=true;break;}catch{}await delay(200);}assert.ok(ready,logs);
 const uploaded=await fetch(api+'/api/sources/upload?filename=adaptive-fixture.mp4',{method:'POST',body:await readFile(fixture)});assert.equal(uploaded.status,201);const{source}=await uploaded.json();
 const cues=[{start:14.375,end:25.625,text:'The house rose only 2.5 centimeters despite a full day of work.'},{start:43.75,end:46.25,text:'The jack failed.'}];
 const plan={providerUsed:'manual',originalTitle:'Adaptive duration smoke',teaserPolicy:'per-part-v1',hookTransition:VR_LEAK_ID,parts:[1,2].map((id,i)=>{const p={id,title:`Part ${id} result`,manualLocked:true,startTrimApplied:true,smartCutApplied:true,hashtags:[],segments:[{start:i*30,end:i*30+27.5,label:'Unchanged main',reason:'Synthetic manual fixture'}]};return{...p,teaser:fallbackTeaser(p,'Fixture only',cues)};}),subtitles:{enabled:true,source:'youtube',size:48,color:'#ffffff',outline:3},captionCues:{sourceId:source.id,sourceDuration:60,timeline:'source',origin:'qa-synthetic',cues}};
 assert.deepEqual(plan.parts.map(p=>(p.teaser.end-p.teaser.start)/1.25),[9,2]);
 for(const [i,p]of plan.parts.entries()){const repeated=partCaptions([cues[i]],p);assert.ok(repeated.length>=2&&repeated.length%2===0);assert.deepEqual(repeated.slice(0,repeated.length/2).map(c=>c.text),repeated.slice(repeated.length/2).map(c=>c.text));assert.deepEqual(presentationSegments(p).slice(1),p.segments);assert.equal(p.teaser.promptVersion,HOOK_PROMPT_VERSION);assert.equal(partTransitionWindows(p,'none',VR_LEAK_ID)[0].halfFrames,9);}
 const before=structuredClone(plan);const{job}=await call('/api/render',{sourceId:source.id,plan});let result;
 for(let i=0;i<900;i++){result=(await call(`/api/jobs/${job.id}`)).job;if(['done','error','cancelled'].includes(result.state))break;await delay(300);}assert.equal(result.state,'done',JSON.stringify(result).slice(-2500)+logs);
 assert.deepEqual(result.plan.parts,before.parts);report.renders=[];
 for(const out of result.outputs){const file=path.join(dataRoot,'sources',decodeURIComponent(out.url.slice('/files/'.length))),probe=JSON.parse(run(ffprobe,['-v','error','-show_format','-show_streams','-of','json',file])),v=probe.streams.find(s=>s.codec_type==='video');const expected=out.part===1?31:24;assert.deepEqual([v.width,v.height],[1080,1920]);assert.equal(Number(v.nb_frames),expected*30);assert.ok(Math.abs(Number(probe.format.duration)-expected)<.06);
 const pcm=run(ffmpeg,['-v','error','-ss',String(expected-.1),'-i',file,'-map','0:a','-ac','1','-ar','48000','-f','s16le','-']);let energy=0;for(let i=0;i<pcm.length;i+=2)energy+=(pcm.readInt16LE(i)/32768)**2;assert.ok(energy/(pcm.length/2)>.001);report.renders.push({part:out.part,duration:probe.format.duration,frames:v.nb_frames,bytes:(await stat(file)).size,audioTail:true,subtitleOccurrences:2});}
 report.mainAndSnapshotUnchanged=true;
 }
 report.success=true;
}catch(e){report.success=false;report.error=e.stack;report.logs=logs;throw e;}
finally{if(child?.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}await writeFile(path.join(reportRoot,'render-report.json'),JSON.stringify(report,null,2));if(report.success)await rm(root,{recursive:true,force:true});console.log(JSON.stringify(report));}
