// Freshness binding, not authentication of a self-reported web provider.
export const transcriptValue = value => String(value || '').slice(0,100000);
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
export function selectionRequestValue(request={},part){return JSON.stringify({instruction:String(request.instruction||'').slice(0,6000),supplementalPrompt:String(request.supplementalPrompt||'').slice(0,6000),customInstruction:String(request.customInstruction??(part?.customTeaser?.mode==='description'?part.customTeaser.input:'')).slice(0,1000)});}
export function teaserContextValue(part,source,cues,transcriptKey,requestKey=part.teaser?.binding?.requestKey) {
 const h=part.teaser;
 return JSON.stringify({version:1,sourceId:source.id,duration:source.duration,title:source.title||'',partId:part.id,
  partTitle:part.title,partContext:part.hook,ranges:part.segments.filter(s=>!s.isPadding).map(s=>[s.start,s.end]),
  cues:cues.map(c=>[c.start,c.end,c.text,c.timing||'cue']),transcriptKey,
  provider:h.provider,model:h.model,promptVersion:h.promptVersion,inputKey:h.inputKey,requestKey});
}
export async function bindTeaserContext(part,source,cues,transcript,sourceFingerprint,request={}) {
 const transcriptKey=await selectionDigest(transcriptValue(transcript)),requestKey=await selectionDigest(selectionRequestValue(request,part));
 return {version:1,sourceId:source.id,transcriptKey,requestKey,evidenceKey:await selectionDigest(teaserEvidenceValue(source)),contextKey:await selectionDigest(teaserContextValue(part,source,cues,transcriptKey,requestKey)),
  ...(sourceFingerprint?{sourceFingerprint}:{})};
}
export async function assertTeaserContexts(plan,source,cues,transcript,request) {
 const transcriptKey=await selectionDigest(transcriptValue(transcript));
 for(const part of plan.parts){
  const h=part.teaser;if(part.teaserEnabled===false||h?.status!=='selected'||!['ai','external-import'].includes(h.selection))continue;
  if((request&&h.binding?.requestKey!==await selectionDigest(selectionRequestValue(request,part)))||h.binding?.version!==1||h.binding.sourceId!==source.id||h.binding.transcriptKey!==transcriptKey||h.binding.contextKey!==await selectionDigest(teaserContextValue(part,source,cues,transcriptKey)))throw Error(`Part ${part.id}: teaser AI cũ/khác ngữ cảnh; chọn lại cho source, main và phụ đề hiện tại.`);
 }
}
