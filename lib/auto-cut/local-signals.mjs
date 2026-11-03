export const LOCAL_SIGNAL_VERSION = 'ffmpeg-local-v2';
export const MAX_LOCAL_ENTRIES = 2000;
/** Whole-source audio activity is one value per `audioActivityStep` seconds, never more than this many values. */
export const AUDIO_ACTIVITY_MAX_ENTRIES = 1800;
export const audioActivityStep = duration => Math.max(1, Math.ceil(duration / AUDIO_ACTIVITY_MAX_ENTRIES));
const finite = Number.isFinite;
export function normalizeLocalSignals(raw, { duration, sourceKey } = {}) {
  const unavailable = reason => ({ version:LOCAL_SIGNAL_VERSION,sourceKey,timeUnit:'source-seconds',sampledRanges:[],visual:{status:'unavailable',reason,sampledRanges:[],boundaries:[],activity:[]},audio:{status:'unavailable',reason,sampledRanges:[],silences:[],activity:[]} });
  if (!raw || raw.version!==LOCAL_SIGNAL_VERSION || raw.timeUnit!=='source-seconds' || raw.sourceKey!==sourceKey || !finite(duration) || duration<=0) return unavailable('invalid-or-source-mismatched');
  const ranges = input => Array.isArray(input) && input.length<=MAX_LOCAL_ENTRIES && input.every(r=>r && finite(r.start)&&finite(r.end)&&r.start>=0&&r.end>r.start&&r.end<=duration+.001);
  if (!ranges(raw.sampledRanges)) return unavailable('invalid-sampled-ranges');
  // v2: each channel carries its own sampled ranges (audio now covers the whole source while video
  // stays windowed). A channel without its own list falls back to the shared one.
  const own = ch => ch && Array.isArray(ch.sampledRanges) ? ch.sampledRanges : raw.sampledRanges;
  if (!ranges(own(raw.visual)) || !ranges(own(raw.audio))) return unavailable('invalid-sampled-ranges');
  const coverage = list => (start,end=start) => list.some(r=>start>=r.start-.001&&end<=r.end+.001);
  const status = v => v && ['available','unavailable','disabled'].includes(v.status) && (v.reason===undefined || typeof v.reason==='string'&&v.reason.length<=200);
  const activity = (a,key,covered) => ranges(a) && a.every(r=>covered(r.start,r.end)&&finite(r[key])&&r[key]>=0&&r[key]<=1);
  const v=raw.visual,a=raw.audio;
  const vCovered=coverage(own(v)),aCovered=coverage(own(a));
  if(!status(v)||!status(a)||!Array.isArray(v.boundaries)||v.boundaries.length>MAX_LOCAL_ENTRIES||!v.boundaries.every(b=>b&&finite(b.time)&&b.time>=0&&b.time<=duration&&vCovered(b.time)&&finite(b.change)&&b.change>=0&&b.change<=1)
    ||!activity(v.activity,'change',vCovered)||!ranges(a.silences)||!a.silences.every(r=>aCovered(r.start,r.end))||!activity(a.activity,'activity',aCovered)) return unavailable('invalid-local-evidence');
  const result={version:LOCAL_SIGNAL_VERSION,sourceKey,timeUnit:'source-seconds',sampledRanges:raw.sampledRanges.map(({start,end})=>({start,end})),
    visual:{status:v.status,...(v.reason?{reason:v.reason}:{}),sampledRanges:own(v).map(({start,end})=>({start,end})),boundaries:v.boundaries.map(({time,change})=>({time,change})),activity:v.activity.map(({start,end,change})=>({start,end,change}))},
    audio:{status:a.status,...(a.reason?{reason:a.reason}:{}),sampledRanges:own(a).map(({start,end})=>({start,end})),silences:a.silences.map(({start,end})=>({start,end})),activity:a.activity.map(({start,end,activity})=>({start,end,activity}))}};
  if(typeof raw.cacheKey==='string'&&/^[a-f0-9]{64}$/.test(raw.cacheKey)) result.cacheKey=raw.cacheKey;
  return result;
}
