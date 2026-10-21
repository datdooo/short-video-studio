// chunkTimedCues is narrowly adapted from MomentSearch chunk_cues:
// src/ingest/transcript.py @875b55fd6b01da85907e77f9b441893831362313.
// Copyright 2026 Traversaal.ai, Apache-2.0; LICENSE/NOTICE in third_party/momentsearch.
// Changes: JS, exact source cue IDs/timing, chapter/gap boundaries; no speakers,
// embedding model, vector database, downloader, provider or score threshold.
import {alignReplayToSource} from './replay-alignment.mjs';
import {replayPeakRegions,replayRegionsForRanges} from './replay-peaks.mjs';
export const TEASER_EVIDENCE_VERSION='source-evidence-v2-replay-ranking';
export const EVIDENCE_CHAR_BUDGET=120000;
const spread=(items,n)=>items.length<=n?items:Array.from({length:n},(_,i)=>items[Math.round(i*(items.length-1)/Math.max(1,n-1))]);
export function chunkTimedCues(cues,chapters=[],span=120){
 const chunks=[];let buffer=[],start=null,lastEnd=0;
 function flush(){if(buffer.length&&start!==null)chunks.push({start,end:lastEnd,cues:buffer});buffer=[];start=null;}
 for(const [index,cue]of cues.entries()){
  if(start!==null&&(cue.start-lastEnd>1||chapters.some(c=>c.startMs/1000>lastEnd&&c.startMs/1000<=cue.start)))flush();
  if(start===null)start=cue.start;
  buffer.push({cueId:`cue-${index}`,start:cue.start,end:cue.end,text:cue.text,timing:cue.timing||'cue'});lastEnd=cue.end;
  if(lastEnd-start>=span)flush();
 }
 flush();return chunks;
}
const channel=(value,fallback)=>({status:value?.status||'missing',reason:value?.reason||(!value?fallback:null)});
export function collectTeaserEvidence(part,source,cues,request={}){
 const c=source.sourceContext||{},comments=c.comments,heatmap=c.heatmap,visual=c.visualSignals,audio=c.audioSignals;
 const retained=part.segments.filter(s=>!s.isPadding).map(({start,end})=>({start,end}));
 const permitted=request.permittedRanges||retained;
 const partPeaks=replayRegionsForRanges(heatmap?.status==='available'?heatmap.bins:[],retained).map(p=>({...p,hookEligible:permitted.some(r=>p.startMs<r.end*1000&&p.endMs>r.start*1000),context:cues.filter(q=>q.start<p.endMs/1000+10&&q.end>p.startMs/1000-10).map(q=>({start:q.start,end:q.end,text:q.text,timing:q.timing||'cue'}))}));
 const sourceText=String(source.transcript||'');
 const full={version:TEASER_EVIDENCE_VERSION,sourceId:source.id,timeUnit:'seconds',timeline:'source',untrustedSourceData:true,
  source:{title:source.title,duration:source.duration,kind:source.kind},captionProvenance:source.captionProvenance||{timing:'cue',origin:'unknown'},
  transcript:{status:cues.length?'available':sourceText?'untimed':'missing',cues:chunkTimedCues(cues).flatMap(c=>c.cues),sourceText,sourceTextPolicy:'Văn bản hiện hành được gửi riêng, không ghi đè timing caption; các dòng timestamp thô không phải word alignment.'},
  metadata:c.metadata||{title:source.title},chapters:c.chapters||[],descriptionMarkers:c.descriptionMarkers||[],
  comments:{...channel(comments,'Chưa có dữ liệu bình luận'),provenance:comments?.provenance,items:(comments?.comments||[]).map(x=>({id:x.id,text:x.text,parentId:x.parentId,isReply:x.isReply,likeCount:x.likeCount,replyCount:x.replyCount,timestampMentions:x.timestampMentions})),clusters:comments?.clusters||[]},
  replay:{...channel(heatmap,'Chưa thu thập Most Replayed'),timeUnit:'ms',semantics:'relative replay interest, NOT retention/views/viewer counts',bins:heatmap?.bins||[],provenance:heatmap?.provenance,sourceSamples:alignReplayToSource(heatmap?.status==='available'?heatmap.bins:[],source.duration),regions:replayPeakRegions(heatmap?.status==='available'?heatmap.bins:[]),partPeaks,rankingPolicy:'Tín hiệu quan trọng: ưu tiên rõ đoạn được replay hỗ trợ mạnh khi sức hút/ý nghĩa tương đương. Nếu nội dung xuất sắc hơn thắng peak cao, giải thích cụ thể. Không cộng trọng số cố định hoặc dùng replay làm biên cắt.'},
  visual:{...channel(visual,'Chưa có scene/frame signals'),data:visual||null},audio:{...channel(audio,'Chưa có audio/silence signals'),data:audio||null},
  part:{id:part.id,title:part.title,context:part.hook,retainedMain:retained,permittedTeaser:permitted},
  userRequest:{instruction:String(request.instruction||'').slice(0,6000),supplementalPrompt:String(request.supplementalPrompt||'').slice(0,6000),customTeaserRequest:String(request.customInstruction||'').slice(0,1000)}};
 if(request.fullOnly===true)return{full};
 const fullCharacters=JSON.stringify(full).length,complete=fullCharacters<=EVIDENCE_CHAR_BUDGET;
 if(complete)return{full,overview:{...full,coverage:{complete:true,fullCharacters,transcriptCues:cues.length}},needsDiscovery:false};
 // Every cue belongs to a chunk and every chunk to a catalog entry, including
 // the end. References are server-held cue IDs, NOT URLs the model can fetch.
 const chunks=chunkTimedCues(cues,c.chapters||[]),step=Math.max(1,Math.ceil(chunks.length/48)),catalog=[];
 for(let i=0;i<chunks.length;i+=step){const group=chunks.slice(i,i+step),all=group.flatMap(x=>x.cues),quotes=spread(all,3).map(x=>({...x,text:x.text.slice(0,400),textTruncated:x.text.length>400}));
  catalog.push({id:`section-${catalog.length+1}`,start:group[0].start,end:group.at(-1).end,cueCount:all.length,cueRefs:[all[0].cueId,all.at(-1).cueId],verbatimSamples:quotes});}
 let overview={...full,
  transcript:{status:full.transcript.status,sectionCatalog:catalog,sourceTextSamples:spread(sourceText.match(/[\s\S]{1,2000}/g)||[],24).map((text,i)=>({sample:i,text})),sourceTextPolicy:full.transcript.sourceTextPolicy,cueCount:cues.length},
  metadata:{title:full.source.title,description:String(full.metadata.description||'').slice(0,8000),tags:full.metadata.tags||[]},
  comments:{...full.comments,items:full.comments.items.map(x=>({...x,text:x.text.slice(0,160),textTruncated:x.text.length>160})),clusters:spread(full.comments.clusters,64)},
  replay:{...full.replay,bins:spread(full.replay.bins,256),regions:spread(full.replay.regions,64),partPeaks:partPeaks.slice(0,16),totalPartPeaks:partPeaks.length,sourceSamples:spread(full.replay.sourceSamples,128),totalBins:full.replay.bins.length},
  visual:{...channel(visual,'Chưa có scene/frame signals'),data:visual?{...visual,boundaries:spread(visual.boundaries||[],240)}:null},
  audio:{...channel(audio,'Chưa có audio/silence signals'),data:audio?{...audio,activity:spread(audio.activity||[],240),silences:spread(audio.silences||[],240)}:null},
  coverage:{complete:false,fullCharacters,transcriptCues:cues.length,sectionCount:catalog.length,policy:'Toàn video có catalog; mẫu lời trích giữ nguyên. Nội dung đầy đủ vẫn ở server; bước chốt lấy lại cue/bằng chứng gốc quanh vùng GPT đề xuất. Thiếu dữ liệu không phải bằng chứng đoạn kém hấp dẫn.'}};
 // Bound by serialized characters rather than assuming a token-per-cue ratio.
 // Retain every catalog/time range and all channel states/counts at every level.
 for(let level=0;JSON.stringify(overview).length>EVIDENCE_CHAR_BUDGET&&level<8;level++){
  const textLimit=Math.max(0,Math.floor(200/2**level)),points=Math.max(8,Math.floor(128/2**level));
  overview={...overview,
   transcript:{...overview.transcript,sectionCatalog:catalog.map(section=>({...section,verbatimSamples:spread(section.verbatimSamples,level<3?2:1).map(q=>({...q,text:q.text.slice(0,textLimit),textTruncated:q.text.length>textLimit}))})),sourceTextSamples:spread(overview.transcript.sourceTextSamples,Math.max(3,24-level*3)).map(x=>({...x,text:x.text.slice(0,Math.max(120,textLimit))}))},
   metadata:{title:full.source.title,description:String(full.metadata.description||'').slice(0,Math.max(1000,6000/2**level)),tags:spread(full.metadata.tags||[],points)},
   chapters:full.chapters.map(ch=>({...ch,title:String(ch.title||'').slice(0,Math.max(40,textLimit))})),
   comments:{...overview.comments,items:full.comments.items.map(x=>({...x,text:x.text.slice(0,textLimit),textTruncated:x.text.length>textLimit,timestampMentions:(x.timestampMentions||[]).map(m=>({timestampMs:m.timestampMs}))})),clusters:spread(full.comments.clusters,points)},
   replay:{...overview.replay,bins:spread(full.replay.bins,points),regions:spread(full.replay.regions,points),partPeaks:partPeaks.slice(0,6).map(p=>({...p,context:spread(p.context,3).map(q=>({...q,text:q.text.slice(0,Math.max(80,textLimit)),textTruncated:q.text.length>Math.max(80,textLimit)}))})),sourceSamples:spread(full.replay.sourceSamples,points)},
   visual:{...channel(visual,'Chưa có scene/frame signals'),data:visual?{boundaries:spread(visual.boundaries||[],points),sampledRanges:visual.sampledRanges,sourceKey:visual.sourceKey}:null},
   audio:{...channel(audio,'Chưa có audio/silence signals'),data:audio?{silences:spread(audio.silences||[],points),activity:spread(audio.activity||[],points),sampledRanges:audio.sampledRanges,sourceKey:audio.sourceKey}:null},
   coverage:{...overview.coverage,compactLevel:level+1}};
 }
 if(JSON.stringify(overview).length>EVIDENCE_CHAR_BUDGET)throw Error('HOOK_EVIDENCE_BUDGET_EXCEEDED: Cần giảm dữ liệu đầu vào; chưa gửi payload vượt giới hạn.');
 return{full,overview,needsDiscovery:true};
}
export function evidenceAround(bundle,regions){
 const full=bundle.full,overlaps=x=>regions.some(r=>x.start<r.end+10&&x.end>r.start-10);
 const comments=full.comments.items.filter(x=>x.timestampMentions?.some(m=>regions.some(r=>m.timestampMs/1000>=r.start-10&&m.timestampMs/1000<=r.end+10)));
 let local={version:full.version,sourceId:full.sourceId,timeUnit:'seconds',timeline:'source',captionProvenance:full.captionProvenance,
  part:full.part,userRequest:full.userRequest,transcript:{status:full.transcript.status,cues:full.transcript.cues.filter(overlaps)},
  comments:{...channel(full.comments),totalNearby:comments.length,items:spread(comments,24),clusters:full.comments.clusters.filter(x=>regions.some(r=>x.centerMs/1000>=r.start-10&&x.centerMs/1000<=r.end+10))},
  replay:{...channel(full.replay),timeUnit:'ms',semantics:full.replay.semantics,bins:full.replay.bins.filter(x=>overlaps({start:x.startMs/1000,end:x.endMs/1000})),partPeaks:full.replay.partPeaks.filter(x=>overlaps({start:x.startMs/1000,end:x.endMs/1000}))},
  visual:{...channel(full.visual),boundaries:(full.visual.data?.boundaries||[]).filter(x=>overlaps({start:x.time,end:x.time+.001}))},
  audio:{...channel(full.audio),silences:(full.audio.data?.silences||[]).filter(overlaps),activity:(full.audio.data?.activity||[]).filter(overlaps)},
  coverage:{complete:false,regions,policy:'Cue gốc đầy đủ quanh vùng đã chọn; overview/catalog toàn video vẫn gửi riêng. Không tự thay mốc.'}};
 if(JSON.stringify(local).length>EVIDENCE_CHAR_BUDGET)local={...local,comments:{...local.comments,items:local.comments.items.map(x=>({...x,text:x.text.slice(0,240),timestampMentions:(x.timestampMentions||[]).map(m=>({timestampMs:m.timestampMs}))}))},audio:{...channel(full.audio),silences:spread(local.audio.silences,120),activity:spread(local.audio.activity,120)}};
 if(JSON.stringify(local).length>EVIDENCE_CHAR_BUDGET)throw Error('HOOK_EVIDENCE_BUDGET_EXCEEDED');
 return local;
}

// Discovery identifies an inspection anchor, NOT a final cut. Local code may
// construct a bounded context window around it; it never adjusts the AI's final
// teaser timestamps. Old cached start/end discoveries remain readable.
export const MOMENT_DISCOVERY_SCHEMA={type:'object',additionalProperties:false,properties:{partUnderstanding:{type:'string'},moments:{type:'array',minItems:1,maxItems:4,items:{type:'object',additionalProperties:false,properties:{intervalId:{type:'string'},anchorTime:{type:'number'},kind:{type:'string',enum:['speech','action','mixed']},reason:{type:'string'},evidenceTimes:{type:'array',maxItems:12,items:{type:'number'}}},required:['intervalId','anchorTime','kind','reason','evidenceTimes']}}},required:['partUnderstanding','moments']};
export function discoveryIntervals(allowed){return allowed.map((range,index)=>({id:`interval-${index+1}`,start:range.start,end:range.end}));}
export function inspectDiscovery(value,allowed){
 if(!value||!Array.isArray(value.moments)||!value.moments.length||value.moments.length>4)throw Error('HOOK_DISCOVERY_SCHEMA_INVALID');
 const regions=[],rejected=[];
 for(const [index,m]of value.moments.entries()){
  try{
   if(!m||!['speech','action','mixed'].includes(m.kind)||typeof m.reason!=='string'||!m.reason.trim())throw Error('HOOK_DISCOVERY_SCHEMA_INVALID');
   if(Object.hasOwn(m,'anchorTime')){
    if(!Number.isFinite(m.anchorTime)||typeof m.intervalId!=='string')throw Error('HOOK_DISCOVERY_SCHEMA_INVALID');
    const match=/^interval-([1-9]\d*)$/.exec(m.intervalId),range=match?allowed[Number(match[1])-1]:null;
    if(!range||m.anchorTime<range.start||m.anchorTime>range.end)throw Error('HOOK_DISCOVERY_ANCHOR_OUTSIDE_INTERVAL');
    const span=Math.min(30,range.end-range.start),start=Math.max(range.start,Math.min(range.end-span,m.anchorTime-span/2));
    if(span<=0)throw Error('HOOK_DISCOVERY_RANGE_INVALID');
    regions.push({start,end:start+span,anchorTime:m.anchorTime,intervalId:m.intervalId,kind:m.kind,reason:m.reason});
   }else{
    if(!Number.isFinite(m.start)||!Number.isFinite(m.end)||m.end<=m.start||m.end-m.start>30||!allowed.some(r=>m.start>=r.start&&m.end<=r.end))throw Error('HOOK_DISCOVERY_RANGE_INVALID');
    regions.push({start:m.start,end:m.end,kind:m.kind,reason:m.reason});
   }
  }catch(error){rejected.push({index,code:/^HOOK_DISCOVERY_[A-Z_]+$/.test(error.message)?error.message:'HOOK_DISCOVERY_SCHEMA_INVALID'});}
 }
 if(!regions.length)throw Object.assign(Error(rejected[0]?.code||'HOOK_DISCOVERY_SCHEMA_INVALID'),{rejected});
 return{regions,rejected};
}
export function discoveryRegions(value,allowed){return inspectDiscovery(value,allowed).regions;}
export function discoveryFrameTimes(regions){
 return regions.flatMap((region,index)=>{
  const lo=region.start+.001,hi=region.end-.001;
  const points=Number.isFinite(region.anchorTime)?[region.anchorTime,lo,hi,region.anchorTime-1.25,region.anchorTime+1.25,(lo+hi)/2]:Array.from({length:6},(_,i)=>lo+(hi-lo)*i/5);
  return [...new Set(points.map(time=>Math.max(lo,Math.min(hi,time))))].map(time=>({time,candidateId:`moment-${index+1}`}));
 });
}
