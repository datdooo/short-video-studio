import test from'node:test';import assert from'node:assert/strict';
import{normalizeMusic,effectiveMusic,validateSpeechActivity}from'./music/settings.mjs';import{duckWindows,mapSpeechIntervals,musicGainAt,DUCK_GAIN,mixSample}from'./music/envelope.mjs';import{rainbowPixel}from'./music/light-leak.mjs';import{partTransitionWindows,presentationDuration}from'./teaser-hooks.mjs';import{snapshotPlanVisualStyle}from'./visual-style/normalize.mjs';import{voiceFramesToIntervals}from'../worker/music-speech.mjs';
const legacy=(p,start=p.segments[0].start,end=start+6.25)=>({version:1,status:'selected',start,end,selection:'fallback',reason:'Historical hook fixture',relation:'Same part',evidenceTimes:[start],limitations:[],provider:'none',model:'none',promptVersion:'same-part-hook-v1',inputKey:'0'.repeat(64),rangeKey:JSON.stringify(p.segments.map(s=>[s.start,s.end])),transition:'inherit-or-dip-black'});
const source={id:'fixture',duration:30},base={id:1,title:'A',segments:[{start:0,end:10},{start:20,end:30}]},part={...base,teaser:legacy(base)},activity={version:'webrtc-vad-v1',sourceId:'fixture',sourceKey:'unit',cacheKey:'a'.repeat(64),timeUnit:'source-seconds',status:'available',intervals:[{start:1,end:2},{start:21,end:23}],limitations:[]};
test('legacy music is off; gain is linear 0–unity, strict settings and independent job overrides',()=>{
 assert.equal(normalizeMusic().enabled,false);assert.equal(normalizeMusic().volume,15);assert.equal(normalizeMusic().ducking,true);
 for(const v of [{version:1,enabled:true,volume:101,ducking:true},{version:1,enabled:true,volume:15,ducking:true,assetId:'../../secret'},{version:1,enabled:true,volume:15,ducking:true,assetId:['a'.repeat(64)]}])assert.throws(()=>normalizeMusic(v));
 const s={version:1,enabled:true,volume:15,ducking:true,assetId:'a'.repeat(64),overrides:{2:null}};const snap=snapshotPlanVisualStyle({music:s});s.volume=90;assert.equal(snap.music.volume,15);assert.equal(effectiveMusic(snap.music,2).enabled,false);assert.equal(effectiveMusic(snap.music,1).assetId,'a'.repeat(64));
});
test('speech maps output-time through independent hook/main, cuts, speed and padding without caption assumptions',()=>{
 const mapped=mapSpeechIntervals(part,activity);assert.deepEqual(mapped,[{start:.8,end:1.6},{start:5.8,end:6.6},{start:13.8,end:15.4}]);
 const repeat={...base,segments:[...base.segments,{start:0,end:4,isPadding:true}]};assert.equal(mapSpeechIntervals(repeat,activity).length,3);
 assert.deepEqual(mapSpeechIntervals(part,{...activity,status:'unavailable'}),[]);validateSpeechActivity(activity,source);assert.throws(()=>validateSpeechActivity({...activity,sourceId:'other'},source));assert.throws(()=>validateSpeechActivity({...activity,intervals:[{start:0,end:40}]},source));
});
test('ducking anticipates 100ms, attacks 50ms, holds 300ms, recovers 600ms; short gaps do not pump',()=>{
 const m={version:1,enabled:true,volume:40,ducking:true},windows=duckWindows([{start:2,end:3},{start:3.2,end:4}],10);
 assert.equal(windows.length,1);assert.equal(windows[0].start,1.9);assert.equal(windows[0].end,4.3);
 assert.equal(musicGainAt(1,10,m,windows),.4);assert.ok(musicGainAt(1.925,10,m,windows)<.4&&musicGainAt(1.925,10,m,windows)>.4*DUCK_GAIN);assert.equal(musicGainAt(3.1,10,m,windows),.4*DUCK_GAIN);assert.ok(Math.abs(musicGainAt(4.6,10,m,windows)-.4*(1+DUCK_GAIN)/2)<1e-10);assert.equal(musicGainAt(5,10,m,windows),.4);
 for(const t of[0,.001,1,3,9.999,10]){assert.equal(musicGainAt(t,10,{...m,volume:0},windows),0);assert.ok(musicGainAt(t,10,m,windows)<=.4);}assert.equal(musicGainAt(3,10,m,[]),.4);
});
test('only music headroom is limited; source is unchanged at mute and output does not newly clip',()=>{for(const s of[-1,-.95,-.5,0,.5,.95,1])for(const m of[-1,-.2,0,.2,1]){assert.equal(mixSample(s,0),s);assert.ok(Math.abs(mixSample(s,m))<=Math.max(.98,Math.abs(s))+.000001);}});
test('rainbow is hook-only, legacy preserved, explicit None suppresses boundary; neighboring windows clamp',()=>{
 assert.equal(partTransitionWindows(part,'none')[0].presetId,'dip-black');const w=partTransitionWindows(part,'dip-black','rainbow-light-leak');assert.equal(w[0].presetId,'rainbow-light-leak');assert.equal(w[0].halfFrames,9);assert.equal(w[1].presetId??'dip-black','dip-black');assert.equal(partTransitionWindows(part,'dip-black','none').length,1);assert.equal(presentationDuration(part),26.25);
 const tiny={...base,segments:[{start:0,end:.2},{start:2,end:3}]};tiny.teaser=legacy(tiny,2,3);assert.equal(partTransitionWindows(tiny,'none','rainbow-light-leak')[0].halfFrames,2);
 assert.deepEqual(rainbowPixel(.5,.5,0),[0,0,0]);assert.deepEqual(rainbowPixel(.5,.5,1),[0,0,0]);const peak=rainbowPixel(.5,.5,.5);assert.ok(peak.every(v=>v>150&&v<255));
});
test('VAD event aggregation rejects tiny isolated events and bridges within-word gaps',()=>{const f=Array(30).fill(false);f.fill(true,0,6);f.fill(true,8,15);f[25]=true;assert.deepEqual(voiceFramesToIntervals(f,1),[{start:0,end:.44999999999999996}]);});
