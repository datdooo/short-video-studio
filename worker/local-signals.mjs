import {createHash} from 'node:crypto';
import {createSharedOperations} from './shared-operation.mjs';
import {createAnalysisCache} from './analysis-cache.mjs';
import {LOCAL_SIGNAL_VERSION,normalizeLocalSignals,MAX_LOCAL_ENTRIES,audioActivityStep} from '../lib/auto-cut/local-signals.mjs';
const round=n=>Math.round(n*1000)/1000, clamp=n=>Math.max(0,Math.min(1,n));
export function analysisWindows(duration) {
  if(!Number.isFinite(duration)||duration<=0)throw new Error('Invalid source duration');
  return duration<=180?[{start:0,end:duration}]:[0,(duration-60)/2,duration-60].map(start=>({start:round(start),end:Math.min(duration,round(start+60))}));
}
function metadataFrames(log) {
  const frames=[];let current;
  for(const line of log.split(/\r?\n/)){
    const time=line.match(/pts_time:\s*([\d.e+-]+)/);
    if(time){current={time:Number(time[1])};frames.push(current);}
    else if(current){const match=line.match(/(lavfi\.[\w.]+)=([^\s]+)/);if(match)current[match[1]]=match[2]==='-inf'?-Infinity:Number(match[2]);}
  }
  return frames;
}
export function parseVideoSignals(log,window) {
  const frames=metadataFrames(log),boundaries=[],activity=[];
  for(const frame of frames){const time=round(window.start+frame.time),score=frame['lavfi.scd.score'],diff=frame['lavfi.scd.mafd'];
    if(time<window.start||time>=window.end||!Number.isFinite(score))continue;
    if(score>=10)boundaries.push({time,change:clamp(score/100)});
    activity.push({start:time,end:round(Math.min(window.end,time+.5)),change:clamp((Number.isFinite(diff)?diff:score)/100)});
  }
  return{boundaries:boundaries.slice(0,MAX_LOCAL_ENTRIES),activity:activity.slice(0,MAX_LOCAL_ENTRIES)};
}
export function mergeRanges(ranges) {
  const sorted=ranges.filter(r=>r&&r.end>r.start).map(({start,end})=>({start,end})).sort((a,b)=>a.start-b.start),out=[];
  for(const r of sorted){const last=out.at(-1);if(last&&r.start<=last.end+.001)last.end=Math.max(last.end,r.end);else out.push({...r});}
  return out;
}
// `step` seconds per activity value (1 for sources up to 30 minutes, coarser beyond, never more than 1800 values).
export function parseAudioSignals(log,errors,window,step=1) {
  const activity=metadataFrames(log).filter(f=>Number.isFinite(f.time)).map(f=>({start:round(window.start+f.time),end:round(Math.min(window.end,window.start+f.time+step)),
    activity:clamp((f['lavfi.astats.Overall.RMS_level']+60)/60)})).filter(b=>b.start>=window.start&&b.end>b.start&&Number.isFinite(b.activity));
  const silences=[];let start;
  for(const match of errors.matchAll(/silence_(start|end):\s*([\d.e+-]+)/g)){
    const time=round(Math.min(window.end,Math.max(window.start,window.start+Number(match[2]))));
    if(match[1]==='start')start=time;else if(start!==undefined){if(time>start)silences.push({start,end:time});start=undefined;}
  }
  if(start!==undefined&&start<window.end)silences.push({start,end:window.end});
  return{activity:activity.slice(0,MAX_LOCAL_ENTRIES),silences:silences.slice(0,MAX_LOCAL_ENTRIES),silencesTruncated:silences.length>MAX_LOCAL_ENTRIES};
}
export function createLocalSignalAnalyzer({ffmpeg,run,fingerprint,cacheRoot,protectedKeys,timeoutMs=60000,audioTimeoutMs}) {
  const cache=createAnalysisCache(cacheRoot,{protectedKeys}),shared=createSharedOperations(),busy=new Map();let queue=Promise.resolve();
  return {
    isBusy:id=>busy.has(id),
    async analyze(source,signal){
      signal?.throwIfAborted();const sourceKey=await fingerprint(source,signal),windows=analysisWindows(source.duration);
      const key=createHash('sha256').update(JSON.stringify({version:LOCAL_SIGNAL_VERSION,sourceKey,duration:source.duration,windows,ffmpeg})).digest('hex');
      const result=await shared(key,active=>cache.using(key,async()=>{
        const cached=await cache.get(key);if(cached){const valid=normalizeLocalSignals(cached,{duration:source.duration,sourceKey});if(!valid.visual.reason?.startsWith('invalid')&&!valid.audio.reason?.startsWith('invalid'))return valid;}
        const task=queue.then(async()=>{
          active.throwIfAborted();
          const value={version:LOCAL_SIGNAL_VERSION,sourceKey,cacheKey:key,timeUnit:'source-seconds',sampledRanges:[],visual:{status:'unavailable',reason:'no-valid-samples',sampledRanges:[],boundaries:[],activity:[]},
            audio:{status:source.hasAudio?'unavailable':'disabled',reason:source.hasAudio?'no-valid-samples':'no-audio',sampledRanges:[],silences:[],activity:[]}};
          if(!ffmpeg){value.visual.reason='ffmpeg-unavailable';if(source.hasAudio)value.audio.reason='ffmpeg-unavailable';return value;}
          // Audio: ONE pass over the whole source (~100x realtime, measured), so energy and silence are known everywhere.
          // Video scene detection decodes frames and stays on bounded windows below.
          if(source.hasAudio){
            const audioMs=audioTimeoutMs??Math.min(300000,Math.max(60000,Math.round(source.duration/30)*1000+30000)),audioTimeout=AbortSignal.timeout(audioMs),
              audioBounded=AbortSignal.any([active,audioTimeout]),step=audioActivityStep(source.duration),full={start:0,end:round(source.duration)};
            let errors='';
            try{
              const response=await run(ffmpeg,['-hide_banner','-nostdin','-nostats','-threads','2','-i',source.mediaPath,'-vn','-af',`aformat=sample_rates=16000:channel_layouts=mono,asetnsamples=n=${16000*step}:p=0,astats=metadata=1:reset=1,ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=-,silencedetect=noise=-35dB:d=0.18`,'-f','null','-'],{signal:audioBounded,maxStdout:2*1024*1024,onStderr:chunk=>{errors=(errors+chunk).slice(-1048576);}});
              const audio=parseAudioSignals(response.stdout,errors,full,step);value.audio.activity=audio.activity;value.audio.silences=audio.silences;
              if(audio.activity.length){value.audio.status='available';delete value.audio.reason;value.audio.sampledRanges=[full];if(audio.silencesTruncated)value.audio.reason='silences-truncated';}
            }catch{active.throwIfAborted();value.audio.reason=audioTimeout.aborted?'analysis-timeout':'audio-analysis-unavailable';}
          }
          const timeout=AbortSignal.timeout(timeoutMs),bounded=AbortSignal.any([active,timeout]);
          for(const window of windows){
            const common=['-hide_banner','-nostdin','-nostats','-threads','2','-filter_threads','1','-ss',String(window.start),'-t',String(window.end-window.start),'-i',source.mediaPath];
            try{
              const response=await run(ffmpeg,[...common,'-map','0:v:0','-an','-vf','fps=2,scale=160:-2,scdet=threshold=10,metadata=mode=print:file=-','-f','null','-'],{signal:bounded,maxStdout:2*1024*1024});
              const video=parseVideoSignals(response.stdout,window);value.visual.boundaries.push(...video.boundaries);value.visual.activity.push(...video.activity);if(video.activity.length){value.visual.status='available';delete value.visual.reason;value.visual.sampledRanges.push(window);}
            }catch{active.throwIfAborted();value.visual.reason=timeout.aborted?'analysis-timeout':'video-analysis-unavailable';}
            if(bounded.aborted)break;
          }
          value.sampledRanges=mergeRanges([...value.visual.sampledRanges,...value.audio.sampledRanges]);
          for(const field of ['boundaries','activity'])value.visual[field]=value.visual[field].slice(0,MAX_LOCAL_ENTRIES);
          for(const field of ['silences','activity'])value.audio[field]=value.audio[field].slice(0,MAX_LOCAL_ENTRIES);
          const normalized=normalizeLocalSignals(value,{duration:source.duration,sourceKey});active.throwIfAborted();await cache.put(key,normalized);return normalized;
        });queue=task.catch(()=>{});return task;
      }),signal);
      return structuredClone(result);
    },
    async forSource(source,signal){busy.set(source.id,(busy.get(source.id)||0)+1);try{return await this.analyze(source,signal);}finally{const n=busy.get(source.id)-1;if(n)busy.set(source.id,n);else busy.delete(source.id);}},
  };
}
