// Bounded actual MP3 + natural speech mix, no render/AI/download. User files read-only.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {musicMixFilters} from '../worker/music-audio.mjs';
import {adjustTeaserRange,presentationDuration} from '../lib/teaser-hooks.mjs';
import {mapSpeechIntervals} from '../lib/music/envelope.mjs';
const project=path.resolve(import.meta.dirname,'..'),root=path.join(project,'.isolation-verification/adaptive-teaser'),bin=path.join(project,'release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin');
const source=path.join(project,'.isolation-verification/teaser-finish/real-building-200s.mp4'),music='/Users/datdo/Library/Application Support/ShortCut Studio Dev/media/music/d62bc20e3e9f97386ff7611d32f0e91936aaf2a218782cbca25e70caaf31b1b6.mp3';
const cues=JSON.parse(await readFile(path.join(project,'.isolation-verification/teaser-resume-20261019/real-ai-plan.json'),'utf8')).plan.captionCues.cues;
const part=adjustTeaserRange({id:1,manualLocked:true,segments:[{start:45,end:75}]},61.8,68.439,cues),duration=presentationDuration(part)/1.25;
// Exact supplied interval fixture tests mapping; this does not claim fresh VAD accuracy.
const activity={sourceId:'fixture',status:'available',intervals:[{start:61.8,end:68.439}],limitations:['Known speech cue fixture; detector independently qualified earlier.']},settings={version:1,enabled:true,volume:40,ducking:true};
const prefix='[0:a]asplit=2[h][m];[h]atrim=61.8:68.439,asetpts=PTS-STARTPTS[hook];[m]atrim=45:75,asetpts=PTS-STARTPTS[main];[hook][main]concat=n=2:v=0:a=1,atempo=1.25,aresample=48000,aformat=channel_layouts=stereo[originalaudio]';
function run(args){const p=spawnSync(path.join(bin,'ffmpeg'),['-v','error',...args],{maxBuffer:64*1024**2});assert.equal(p.status,0,p.stderr?.toString().slice(-2000));return p.stdout;}
const dry=run(['-i',source,'-filter_complex',prefix.replace('[originalaudio]','[dry]'),'-map','[dry]','-f','f32le','-']);
const render=v=>run(['-i',source,'-stream_loop','-1','-i',music,'-filter_complex',[prefix,...musicMixFilters({input:1,settings:{...settings,...v},part,activity,duration})].join(';'),'-map','[aout]','-f','f32le','-']);
const muted=render({volume:0}),normal=render({ducking:false}),duck=render({});assert.equal(muted.length,dry.length);assert.equal(normal.length,dry.length);assert.equal(duck.length,dry.length);
let delta=0,tail=0;for(let i=0;i<dry.length;i+=4){delta=Math.max(delta,Math.abs(dry.readFloatLE(i)-muted.readFloatLE(i)));if(i>dry.length-38400)tail+=duck.readFloatLE(i)**2;}assert.ok(delta<1e-6);assert.ok(tail>1);
const windows=mapSpeechIntervals(part,activity);assert.equal(windows.length,2);
const ratio=t=>{let a=0,b=0;for(let i=Math.floor(t*48000)*8;i<Math.min(dry.length,Math.floor((t+.1)*48000)*8);i+=4){a+=(duck.readFloatLE(i)-dry.readFloatLE(i))**2;b+=(normal.readFloatLE(i)-dry.readFloatLE(i))**2;}return Math.sqrt(a/Math.max(b,1e-20));};
const ratios=windows.map(w=>ratio((w.start+w.end)/2));for(const r of ratios)assert.ok(Math.abs(r-10**(-12/20))<.04);const restored=ratio(8);assert.ok(restored>.98&&restored<1.02);
await writeFile(path.join(root,'personal-music-audio-report.json'),JSON.stringify({success:true,track:'Sauropod Spotting — Kevin MacLeod',auditionVerified:false,source:'existing natural Vietnamese house-lift footage',manualSpeechIntervalFixture:true,renderedSeconds:dry.length/8/48000,expectedSeconds:duration,voiceAtZeroMaxDifference:delta,duckRatios:ratios,restoredRatio:restored,nonSilentTail:true,repeatedHookSpeechWindows:windows,mainUnchanged:true,temporaryMediaFiles:0},null,2));console.log('Real MP3/natural speech mix passed; music-only ducking twice, gain0 exact dry, restored pause, complete tail.');
