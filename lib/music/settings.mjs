export const MUSIC_VERSION=1;
const idPattern=/^[a-f0-9]{64}$/;
export function normalizeMusic(raw){
  if(raw===undefined)return{version:1,enabled:false,volume:15,ducking:true};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1||Object.keys(raw).some(k=>!['version','enabled','volume','ducking','assetId','overrides'].includes(k)))throw Error('Invalid background music settings.');
  if(typeof raw.enabled!=='boolean'||typeof raw.ducking!=='boolean'||!Number.isFinite(raw.volume)||raw.volume<0||raw.volume>100||(raw.assetId!==undefined&&(typeof raw.assetId!=="string"||!idPattern.test(raw.assetId))))throw Error('Invalid music gain/asset.');
  const out={version:1,enabled:raw.enabled,volume:raw.volume,ducking:raw.ducking,...(raw.assetId?{assetId:raw.assetId}:{})};
  if(raw.overrides!==undefined){if(!raw.overrides||typeof raw.overrides!=='object'||Array.isArray(raw.overrides)||Object.keys(raw.overrides).some(k=>!['1','2'].includes(k)))throw Error('Invalid per-part music.');out.overrides={};for(const[k,v]of Object.entries(raw.overrides)){if(v!==null&&(typeof v!=="string"||!idPattern.test(v)))throw Error('Invalid per-part music asset.');out.overrides[k]=v;}}
  return out;
}
export function effectiveMusic(raw,partId){const s=normalizeMusic(raw);if(s.overrides&&Object.hasOwn(s.overrides,partId))return{...s,assetId:s.overrides[partId]||undefined,enabled:s.enabled&&s.overrides[partId]!==null};return s;}
export function validateSpeechActivity(raw,source){
  if(!raw||raw.version!=='webrtc-vad-v1'||raw.sourceId!==source.id||raw.timeUnit!=='source-seconds'||typeof raw.sourceKey!=='string'||raw.sourceKey.length>1024||typeof raw.cacheKey!=='string'||!/^[a-f0-9]{64}$/.test(raw.cacheKey)||!['available','unavailable'].includes(raw.status)||!Array.isArray(raw.intervals)||raw.intervals.length>20000||!Array.isArray(raw.limitations)||raw.limitations.length>5||raw.limitations.some(s=>typeof s!=='string'||s.length>300))throw Error('Invalid speech detection data.');
  let end=0;for(const r of raw.intervals){if(!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<end||r.end<=r.start||r.end>source.duration+.001)throw Error('Invalid speech intervals.');end=r.end;}
  if(raw.status==='unavailable'&&raw.intervals.length)throw Error('Unavailable speech cannot carry detections.');
  return structuredClone(raw);
}
