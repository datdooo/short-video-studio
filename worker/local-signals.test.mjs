import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
import {createLocalSignalAnalyzer,analysisWindows,parseVideoSignals,parseAudioSignals} from './local-signals.mjs';import {normalizeLocalSignals,LOCAL_SIGNAL_VERSION} from '../lib/auto-cut/local-signals.mjs';
const source={id:'local',mediaPath:'/fixture-only',duration:200,hasAudio:false};
const execute=(binary,args,options={})=>new Promise((resolve,reject)=>{const child=spawn(binary,args,{signal:options.signal,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;if(stdout.length>(options.maxStdout||4e6)){child.kill();reject(new Error('output bound'));}});child.stderr.on('data',b=>{stderr+=b;options.onStderr?.(String(b));});child.on('error',reject);child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error('FFmpeg fixture command failed')));});
async function root(t){const dir=await mkdtemp(path.join(tmpdir(),'local-signals-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('sampling is deterministic, <=180s total with source-time units; parsers reject malformed and retain real silence/scene evidence',()=>{
 const windows=analysisWindows(7200);assert.equal(windows.length,3);assert.equal(windows.reduce((n,w)=>n+w.end-w.start,0),180);
 const v=parseVideoSignals('frame:0 pts:0 pts_time:0\nlavfi.scd.score=0\nlavfi.scd.mafd=0\nframe:1 pts:1 pts_time:0.5\nlavfi.scd.score=82\nlavfi.scd.mafd=82',{start:60,end:61});assert.equal(v.boundaries[0].time,60.5);assert.equal(v.boundaries[0].change,.82);
 const a=parseAudioSignals('frame:0 pts:0 pts_time:0\nlavfi.astats.Overall.RMS_level=-inf\nframe:1 pts:1 pts_time:1\nlavfi.astats.Overall.RMS_level=-12','silence_start: 0\nsilence_end: 1',{start:60,end:62});assert.equal(a.activity[0].activity,0);assert.deepEqual(a.silences,[{start:60,end:61}]);
 const invalid=normalizeLocalSignals({version:LOCAL_SIGNAL_VERSION,sourceKey:'wrong',timeUnit:'source-seconds'},{duration:200,sourceKey:'expected'});assert.equal(invalid.visual.status,'unavailable');
});
test('local extraction is source-specific and cached without media copies; no-audio avoids audio calls',async t=>{
 const dir=await root(t);let calls=0;const analyzer=createLocalSignalAnalyzer({ffmpeg:'/fixture',cacheRoot:dir,fingerprint:async s=>s.id,run:async()=>{calls++;return{stdout:'frame:0 pts:0 pts_time:0\nlavfi.scd.score=0\nlavfi.scd.mafd=0'};}});
 const first=await analyzer.forSource(source);assert.equal(first.visual.status,'available');assert.equal(first.audio.status,'disabled');assert.equal(calls,3);
 const second=await analyzer.forSource(source);assert.equal(calls,3);second.visual.activity[0].change=1;assert.equal(first.visual.activity[0].change,0);
 await analyzer.forSource({...source,id:'another'});assert.equal(calls,6);assert.ok((await readdir(dir)).every(n=>/^[a-f0-9]{64}\.json$/.test(n)));
});
test('timeout degrades only optional local evidence; last-subscriber cancellation reaches the subprocess signal',async t=>{
 const dir=await root(t);let started,aborted=0;
 const run=async(_b,_a,{signal})=>new Promise((resolve,reject)=>{started=true;signal.addEventListener('abort',()=>{aborted++;reject(signal.reason);},{once:true});});
 const analyzer=createLocalSignalAnalyzer({ffmpeg:'/fixture',cacheRoot:dir,fingerprint:async()=> 'digest',run,timeoutMs:15});
 const keep=setTimeout(()=>{},1000);t.after(()=>clearTimeout(keep));const timed=await analyzer.forSource(source);assert.equal(timed.visual.reason,'analysis-timeout');assert.equal(aborted,1);
 const other=createLocalSignalAnalyzer({ffmpeg:'/fixture',cacheRoot:dir,fingerprint:async()=> 'different',run,timeoutMs:1000});started=false;
 const controller=new AbortController(),pending=other.forSource(source,controller.signal);while(!started)await new Promise(r=>setTimeout(r,1));controller.abort();await assert.rejects(pending);assert.equal(other.isBusy(source.id),false);
});
test('small actual FFmpeg scene/silence extraction smoke, no ASR/model/network and no retained intermediates',async t=>{
 const dir=await root(t),media=path.join(dir,'fixture.mp4'),cacheRoot=path.join(dir,'cache');
 await execute('/opt/homebrew/bin/ffmpeg',['-hide_banner','-v','error','-nostdin','-y','-f','lavfi','-i','color=black:s=64x64:r=2:d=2','-f','lavfi','-i','color=white:s=64x64:r=2:d=2','-f','lavfi','-i','anullsrc=r=16000:cl=mono:d=2','-f','lavfi','-i','sine=frequency=440:sample_rate=16000:duration=2','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a][3:a]concat=n=2:v=0:a=1[a]','-map','[v]','-map','[a]','-c:v','libx264','-preset','ultrafast','-c:a','aac',media]);
 assert.ok((await stat(media)).size<100000);
 const analyzer=createLocalSignalAnalyzer({ffmpeg:'/opt/homebrew/bin/ffmpeg',run:execute,fingerprint:async()=> 'fixture-digest',cacheRoot});
 const value=await analyzer.forSource({...source,mediaPath:media,duration:4,hasAudio:true});
 assert.equal(value.visual.status,'available');assert.ok(value.visual.boundaries.some(b=>b.time>=1.5&&b.time<=2.5));
 assert.equal(value.audio.status,'available');assert.ok(value.audio.silences.some(r=>r.start<.1&&r.end>1.5));assert.ok(value.audio.activity.some(a=>a.activity>0));
 assert.deepEqual((await readdir(dir)).sort(),['cache','fixture.mp4']);
});
