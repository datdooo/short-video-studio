export const LOCAL_SIGNAL_VERSION = 'ffmpeg-local-v1';
export const MAX_LOCAL_ENTRIES = 2000;
const finite = Number.isFinite;
export function normalizeLocalSignals(raw, { duration, sourceKey } = {}) {
  const unavailable = reason => ({ version:LOCAL_SIGNAL_VERSION,sourceKey,timeUnit:'source-seconds',sampledRanges:[],visual:{status:'unavailable',reason,boundaries:[],activity:[]},audio:{status:'unavailable',reason,silences:[],activity:[]} });
  if (!raw || raw.version!==LOCAL_SIGNAL_VERSION || raw.timeUnit!=='source-seconds' || raw.sourceKey!==sourceKey || !finite(duration) || duration<=0) return unavailable('invalid-or-source-mismatched');
  const ranges = input => Array.isArray(input) && input.length<=MAX_LOCAL_ENTRIES && input.every(r=>r && finite(r.start)&&finite(r.end)&&r.start>=0&&r.end>r.start&&r.end<=duration+.001);
  if (!ranges(raw.sampledRanges)) return unavailable('invalid-sampled-ranges');
  const covered = (start,end=start) => raw.sampledRanges.some(r=>start>=r.start-.001&&end<=r.end+.001);
  const status = v => v && ['available','unavailable','disabled'].includes(v.status) && (v.reason===undefined || typeof v.reason==='string'&&v.reason.length<=200);
  const activity = (a,key) => ranges(a) && a.every(r=>covered(r.start,r.end)&&finite(r[key])&&r[key]>=0&&r[key]<=1);
  const v=raw.visual,a=raw.audio;
  if(!status(v)||!status(a)||!Array.isArray(v.boundaries)||v.boundaries.length>MAX_LOCAL_ENTRIES||!v.boundaries.every(b=>b&&finite(b.time)&&b.time>=0&&b.time<=duration&&covered(b.time)&&finite(b.change)&&b.change>=0&&b.change<=1)
    ||!activity(v.activity,'change')||!ranges(a.silences)||!a.silences.every(r=>covered(r.start,r.end))||!activity(a.activity,'activity')) return unavailable('invalid-local-evidence');
  const result={version:LOCAL_SIGNAL_VERSION,sourceKey,timeUnit:'source-seconds',sampledRanges:raw.sampledRanges.map(({start,end})=>({start,end})),
    visual:{status:v.status,...(v.reason?{reason:v.reason}:{}),boundaries:v.boundaries.map(({time,change})=>({time,change})),activity:v.activity.map(({start,end,change})=>({start,end,change}))},
    audio:{status:a.status,...(a.reason?{reason:a.reason}:{}),silences:a.silences.map(({start,end})=>({start,end})),activity:a.activity.map(({start,end,activity})=>({start,end,activity}))}};
  if(typeof raw.cacheKey==='string'&&/^[a-f0-9]{64}$/.test(raw.cacheKey)) result.cacheKey=raw.cacheKey;
  return result;
}
