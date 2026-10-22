// Text transport only. IDs are readable references, never attachments or URLs to fetch.
export const VIDEO_TEXT_VERSION='canonical-video-text-v2';
export const VIDEO_TEXT_INSTRUCTIONS='TEXT ONLY: no images/video/audio/files are supplied; never claim visual observation or fetch URLs. Input uses canonical cues and records: recursively expand {"$cue":"cue-N",...overrides} from canonical.cues, merging overrides and omitting the keys listed in $without; expand {"$ref":"rN"} from canonical.records. A $cue has its global cue-N identity. {$cueText:[IDs],characters:N} is the exact first N UTF-16 characters of those original cue texts joined by one space; no speech is summarized. Preserve original source seconds, order and evidence provenance. These are readable JSON references, not evidence summaries. Comments are unverified audience statements, replay is relative interest, scene/audio numbers are proxies. Missing channels do not disprove events. Return the ordinary requested output schema, never reference-encoded JSON.';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const MAX_TEXT_CHARACTERS=1_500_000; // Local resource guard, NOT a claim about provider context size.
export function canonicalVideoInput(input,{enforceLimit=true}={}){
 const original=JSON.parse(JSON.stringify(input)),cues={},records={},counts={cueOccurrences:0,canonicalCues:0,commentOccurrences:0,canonicalComments:0,chapterOccurrences:0,canonicalChapters:0,replayOccurrences:0,canonicalReplayIntervals:0};
 const states={transcript:new Set(),comments:new Set(),replay:new Set(),visual:new Set(),audio:new Set()};let metadata=false,chapters=false;
 let collision=false;const signatures=new Map(),occurrences=new Map();
 function scan(v){if(Array.isArray(v)){v.forEach(scan);return;}if(!object(v))return;
  if(['$cue','$ref','$without','$cueText'].some(k=>Object.hasOwn(v,k)))collision=true;
  if(typeof v.cueId==='string'&&/^cue-\d+$/.test(v.cueId)&&typeof v.text==='string'&&Number.isFinite(v.start)&&Number.isFinite(v.end)){
   counts.cueOccurrences++;const prior=cues[v.cueId];if(!prior||v.text.length>prior.text.length)cues[v.cueId]=Object.fromEntries(Object.entries(v).filter(([k])=>['start','end','text','timing'].includes(k)));
  }
  let kind;if(typeof v.text==='string'&&typeof v.id==='string'&&('timestampMentions'in v||'likeCount'in v))kind='comment';
  else if(Number.isFinite(v.startMs)&&Number.isFinite(v.endMs)&&typeof v.title==='string')kind='chapter';
  else if(Number.isFinite(v.startMs)&&Number.isFinite(v.endMs)&&Number.isFinite(v.intensity))kind='replay';
  if(kind){const key=JSON.stringify(v);occurrences.set(key,(occurrences.get(key)||0)+1);signatures.set(key,kind);counts[kind+'Occurrences']++;}
  for(const [key,value]of Object.entries(v)){if(Object.hasOwn(states,key)&&object(value)&&typeof value.status==='string')states[key].add(['available','unavailable','missing','untimed','disabled','error','partial','unsupported'].includes(value.status)?value.status:'unknown');if(key==='metadata'&&object(value))metadata=true;if(key==='chapters'&&Array.isArray(value)&&value.length)chapters=true;}
  Object.values(v).forEach(scan);
 }
 scan(original);counts.canonicalCues=Object.keys(cues).length;
 for(const kind of ['comment','chapter','replay'])counts[{comment:'canonicalComments',chapter:'canonicalChapters',replay:'canonicalReplayIntervals'}[kind]]=[...signatures.values()].filter(v=>v===kind).length;
 const refs=new Map();for(const [key,n]of occurrences)if(n>1&&key.length>48){const id='r'+(refs.size+1);refs.set(key,id);records[id]=JSON.parse(key);}
 function encode(v){if(Array.isArray(v))return v.map(encode);if(!object(v))return v;
  const id=refs.get(JSON.stringify(v));if(id)return{$ref:id};
  const cue=cues[v.cueId];if(cue&&typeof v.text==='string'&&Number.isFinite(v.start)&&Number.isFinite(v.end)){const rest={};for(const [k,x]of Object.entries(v)){if(k==='cueId')continue;if(Object.hasOwn(cue,k)&&JSON.stringify(cue[k])===JSON.stringify(x))continue;rest[k]=k==='text'&&typeof x==='string'&&cue.text.startsWith(x)?{$cueText:[v.cueId],characters:x.length}:encode(x);}const without=Object.keys(cue).filter(k=>!Object.hasOwn(v,k));return{$cue:v.cueId,...(without.length?{$without:without}:{}),...rest};}
  const ids=Array.isArray(v.cueIds)&&v.cueIds.every(id=>cues[id])?v.cueIds:cue?[v.cueId]:[];const joined=ids.map(id=>cues[id].text).join(' ');
  return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='text'&&typeof x==='string'&&ids.length&&joined.startsWith(x)?{$cueText:ids,characters:x.length}:encode(x)]));
 }
 function decode(v){if(Array.isArray(v))return v.map(decode);if(!object(v))return v;if(Object.hasOwn(v,'$cueText'))return v.$cueText.map(id=>cues[id].text).join(' ').slice(0,v.characters);if(Object.hasOwn(v,'$ref'))return structuredClone(records[v.$ref]);if(Object.hasOwn(v,'$cue')){const cue={...cues[v.$cue]};for(const k of v.$without||[])delete cue[k];return{cueId:v.$cue,...cue,...Object.fromEntries(Object.entries(v).filter(([k])=>!['$cue','$without'].includes(k)).map(([k,x])=>[k,decode(x)]))};}return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));}
 // Compare value trees without depending on object insertion order.
 const stable=v=>JSON.stringify(v,(_k,x)=>object(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 let value=original,encoded=false;
 if(!collision){const data=encode(original);if(stable(decode(data))===stable(original)){value={format:VIDEO_TEXT_VERSION,canonical:{cues,records},data};encoded=true;}}
 const length=JSON.stringify(value).length;
 if(enforceLimit&&length>MAX_TEXT_CHARACTERS)throw Object.assign(Error(`INPUT_TEXT_TOO_LARGE: ${length} ký tự text vượt ngưỡng tài nguyên cục bộ ${MAX_TEXT_CHARACTERS}; chưa gửi AI, không cắt dữ liệu hoặc tự chia request.`),{code:'INPUT_TEXT_TOO_LARGE'});
 const availability={...Object.fromEntries(Object.entries(states).map(([key,values])=>[key,values.size?[...values].sort().join(','):'not-supplied-this-step'])),metadata:metadata?'supplied':'not-supplied-this-step',chapters:chapters?'supplied':'none-collected'};
 return{value,counts,availability,encoded,characters:length};
}
