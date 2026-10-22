// Freshness binding, not authentication of a self-reported web provider.
// Preserve the entire current transcript for evidence/freshness. The HTTP body
// remains bounded; oversize input must fail explicitly instead of losing its end.
export const transcriptValue = value => String(value || '');
export async function selectionDigest(value) {
 const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function teaserEvidenceValue(source) {
 const c=source.sourceContext||{};
 return JSON.stringify({description:c.metadata?.description||'',tags:c.metadata?.tags||[],chapters:c.chapters||[],
  comments:c.comments?{status:c.comments.status,clusters:c.comments.clusters||[],items:(c.comments.comments||[]).map(x=>[x.id,x.text,x.likeCount,x.replyCount,x.timestampMentions])}:null,heatmap:c.heatmap?.status==='available'?c.heatmap.bins:[],
  visual:c.visualSignals?{boundaries:c.visualSignals.boundaries||[],sampledRanges:c.visualSignals.sampledRanges||[],sourceKey:c.visualSignals.sourceKey||''}:null,
  audio:c.audioSignals?{silences:c.audioSignals.silences||[],activity:c.audioSignals.activity||[],sourceKey:c.audioSignals.sourceKey||''}:null});
}
export function selectionRequestValue(request={},part){return JSON.stringify({instruction:String(request.instruction||''),supplementalPrompt:String(request.supplementalPrompt||''),customInstruction:String(request.customInstruction??(part?.customTeaser?.mode==='description'?part.customTeaser.input:'')).slice(0,1000)});}
function contextRanges(part){
 const ranges=part.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end]),manual=part.teaser?.binding?.manualMainContext,retained=retainedMainContext(part);
 if(retained)return retained.originalRanges;
 return manual?.version===1&&(part.mainEdited===true||part.manualLocked===true)&&part.startTrimApplied===true&&part.smartCutApplied===true&&manual.rangeKey===JSON.stringify(ranges)?manual.originalRanges:ranges;
}
function retainedMainContext(part){
 const context=part.teaser?.binding?.retainedMainContext;
 return context?.version===1&&part.startTrimApplied===true&&part.smartCutApplied===true&&context.rangeKey===JSON.stringify(part.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end]))?context:undefined;
}
function withinContext(start,end,ranges){return ranges.some(([a,b])=>end>=Math.max(0,a-10)&&start<=b+10);}
// Only timestamped, fully mapped transcript lines can be scoped safely. An
// untimed/mixed transcript stays complete: do not pretend it can be partitioned.
export function teaserTranscriptValue(part,transcript){
 const raw=transcriptValue(transcript),lines=raw.split(/\r?\n/),mapped=lines.filter(line=>line.trim()).map(line=>{
  const match=line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\s+(?:-\s*)?\S/);
  if(!match)return null;const fields=match[1].replace(',','.').split(':').map(Number);
  return fields.slice(1).every(n=>n<60)?{line,time:fields.reduce((n,v)=>n*60+v,0)}:null;
 });
 if(!mapped.length||mapped.some((line,i)=>!line||i>0&&line.time<mapped[i-1].time))return raw;
 const ranges=contextRanges(part);
 return JSON.stringify(mapped.filter((line,i)=>withinContext(line.time,mapped[i+1]?.time??Infinity,ranges)).map(line=>line.line));
}
export function teaserContextValue(part,source,cues,transcriptKey,requestKey=part.teaser?.binding?.requestKey) {
 const h=part.teaser;
 const currentRanges=part.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end]),manual=h.binding?.manualMainContext,preserved=retainedMainContext(part);
 // A manual main edit can keep an existing AI excerpt without claiming the AI
 // analyzed the new main. Only this explicit, current-range-bound provenance
 // reuses its original ranges; every source/caption/request field still hashes.
 const retained=manual?.version===1&&(part.mainEdited===true||part.manualLocked===true)
   &&part.startTrimApplied===true&&part.smartCutApplied===true&&manual.rangeKey===JSON.stringify(currentRanges);
 if(h.binding?.contextVersion===2){const ranges=contextRanges(part);return JSON.stringify({version:2,sourceId:source.id,duration:source.duration,partId:part.id,ranges,
  cues:cues.flatMap((c,i)=>withinContext(c.start,c.end,ranges)?[[`cue-${i}`,c.start,c.end,c.text,c.timing||'cue']]:[]),transcriptKey,
  provider:h.provider,model:h.model,promptVersion:h.promptVersion,inputKey:h.inputKey,requestKey});}
 return JSON.stringify({version:1,sourceId:source.id,duration:source.duration,title:source.title||'',partId:part.id,
  partTitle:preserved?.partTitle??part.title,partContext:preserved?.partContext??part.hook,ranges:preserved?.originalRanges??(retained?manual.originalRanges:currentRanges),
  cues:cues.map(c=>[c.start,c.end,c.text,c.timing||'cue']),transcriptKey,
  provider:h.provider,model:h.model,promptVersion:h.promptVersion,inputKey:h.inputKey,requestKey});
}
export async function bindTeaserContext(part,source,cues,transcript,sourceFingerprint,request={}) {
 const transcriptKey=await selectionDigest(teaserTranscriptValue({...part,teaser:{...part.teaser,binding:undefined}},transcript)),requestKey=await selectionDigest(selectionRequestValue(request,part));
 // A new provider selection is bound to the current main, never a retention
 // override carried by the previously selected excerpt.
 const selected={...part,teaser:{...part.teaser,binding:{contextVersion:2}}};
 return {version:1,contextVersion:2,sourceId:source.id,transcriptKey,requestKey,evidenceKey:await selectionDigest(teaserEvidenceValue(source)),contextKey:await selectionDigest(teaserContextValue(selected,source,cues,transcriptKey,requestKey)),
  ...(sourceFingerprint?{sourceFingerprint}:{})};
}
export async function assertTeaserContexts(plan,source,cues,transcript,request) {
 for(const part of plan.parts){
  const h=part.teaser;if(part.teaserEnabled===false||h?.status!=='selected')continue;
  if(h.selection==='manual'){
   if(h.manualSourceId!==undefined&&h.manualSourceId!==source.id)throw Error(`Part ${part.id}: teaser thủ công thuộc video nguồn khác.`);
   continue;
  }
  if(!['ai','external-import'].includes(h.selection))continue;
  const b=h.binding,transcriptKey=await selectionDigest(b?.contextVersion===2?teaserTranscriptValue(part,transcript):transcriptValue(transcript));
  let reason='';
  if(b?.version!==1||b.sourceId!==source.id)reason='định danh nguồn/binding không khớp';
  else if(request&&(retainedMainContext(part)?.requestKey||b.requestKey)!==await selectionDigest(selectionRequestValue(request,part)))reason='yêu cầu chọn teaser đã đổi';
  else if(b.transcriptKey!==transcriptKey)reason=b.contextVersion===2?'lời nguồn trong ngữ cảnh part đã đổi hoặc transcript chưa có timestamp để tách phạm vi':'transcript đã đổi (binding cũ toàn video)';
  else if(b.contextKey!==await selectionDigest(teaserContextValue(part,source,cues,transcriptKey)))reason=b.contextVersion===2?'main hoặc cue/timing dùng làm bằng chứng đã đổi':'main/cue/title đã đổi (binding cũ toàn video)';
  if(reason)throw Error(`Part ${part.id}: ${reason}. Giữ mốc hiện tại; chọn lại teaser hoặc áp dụng mốc thủ công.`);
 }
}
