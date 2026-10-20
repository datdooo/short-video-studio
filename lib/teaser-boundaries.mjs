// One technical speech-boundary policy for Auto/Retry, manual and external import.
// Cue/word timing + pauses constrain cuts; none alone proves semantic completeness.
export const SPEECH_TAIL_SECONDS=.08;
const terminal=text=>/[.!?。！？]["'”’）)]*\s*$/u.test(text.trim())&&!/(?:\.{2,}|…)["'”’）)]*\s*$/u.test(text.trim());
const spokenCues=cues=>cues.filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&c.end-c.start<=10&&String(c.text||'').trim()).sort((a,b)=>a.start-b.start||a.end-b.end);
const measuredPauses=silences=>silences.filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start&&s.end-s.start>=.18);
export function speechEndingOptions(cues=[],ranges=[],silences=[]){
 const spoken=spokenCues(cues),pauses=measuredPauses(silences),out=[];
 for(let i=0;i<spoken.length;i++){
  const cue=spoken[i],next=spoken[i+1],pause=pauses.find(s=>s.start<=cue.end+.12&&s.end>=cue.end+.12),gap=next?next.start-cue.end:Infinity;
  if(!terminal(cue.text)&&gap<.35&&!pause)continue;
  const end=cue.end+.12;
  if(next&&end>next.start-.02)continue;
  if(!ranges.some(r=>cue.start>=r.start&&end<=r.end))continue;
  out.push({lastCueStart:cue.start,lastCueEnd:cue.end,suggestedEnd:end,text:String(cue.text).slice(0,240),nextSpeechStart:next?.start??null,...(pause?{measuredSilence:{start:pause.start,end:pause.end}}:{}),limitation:'Timing/punctuation/pause proposal only; verify the entire sentence/idea including number+unit. Never auto-apply this endpoint.'});
 }
 return out.length<=180?out:Array.from({length:180},(_,i)=>out[Math.floor(i*out.length/180)]);
}
export function hookSpeechBoundaryWarning(value,cues=[]){
 if(!value||!Number.isFinite(value.start)||!Number.isFinite(value.end))return '';
 const local=spokenCues(cues).filter(c=>c.start<value.end&&c.end>value.start);
 if(!local.length)return 'Chưa có timestamp lời nói/từ đủ chính xác để xác minh biên. Cần nghe kiểm tra đuôi âm và câu trọn nghĩa; app không tự đổi mốc.';
 return 'Cuối cue/khoảng ngắt chưa chứng minh trọn câu; cần nghe kiểm tra đuôi âm. Mốc nguồn không tự đổi.';
}
export function checkHookSpeechBoundaries(value,cues=[],{silences=[]}={}){
 if(!value||!Number.isFinite(value.start)||!Number.isFinite(value.end))return value;
 const spoken=spokenCues(cues),pauses=measuredPauses(silences);
 for(const time of [value.start,value.end])if(spoken.some(c=>time>c.start+.02&&time<c.end-.02))throw Error('HOOK_SPLITS_TIMED_SPEECH: Mốc có thể cắt giữa từ/âm tiết. Chọn mốc khác; không tự căn lại.');
 const included=spoken.filter(c=>c.start>=value.start-.02&&c.end<=value.end+.02),last=included.at(-1);
 if(!last){if(value.kind==='speech'||value.kind==='mixed')throw Error('HOOK_SPEECH_END_UNVERIFIED: Thiếu timestamp để xác định hết lời nói.');return value;}
 if(value.end<last.end+SPEECH_TAIL_SECONDS-1e-6)throw Error('HOOK_SPEECH_TAIL_TOO_SHORT: Cần chừa ít nhất 80ms sau cue/từ cuối, trong main và trước câu tiếp; không tự kéo end.');
 const next=spoken.find(c=>c.start>=last.end-.001&&c.start>last.start);
 if(next&&value.end>next.start-.02)throw Error('HOOK_ENTERED_NEXT_SENTENCE: Đuôi teaser đã lấn sang lời tiếp theo.');
 const gap=next?next.start-last.end:Infinity,pause=pauses.some(s=>s.start<=last.end+.12&&s.end>=value.end);
 if(!terminal(last.text)&&gap<.35)throw Error('HOOK_SENTENCE_END_NOT_ESTABLISHED: Cuối cue chưa phải hết câu/ý; còn lời nói tiếp. '+(pause?'Có khoảng lặng đo được nhưng không đủ chứng minh đã hết câu. ':'')+'Chọn câu hoàn chỉnh khác hoặc đổi start nhưng không cắt đuôi.');
 if(/(?:[,;:—–-]|\.{2,}|…)\s*$/u.test(last.text))throw Error('HOOK_INCOMPLETE_SPOKEN_IDEA: Câu đang bỏ dở; khoảng ngắt không đủ chứng minh hoàn tất ý.');
 if(next&&gap<.7&&/\d[.,]?\s*$/u.test(last.text)&&/^(?:%|°|cm\b|mm\b|km\b|m[²³]?\b|kg\b|gram\b|lit\b|triệu\b|tỷ\b|đồng\b|dollars?\b|million\b|billion\b|万|億|억)/iu.test(next.text.trim()))throw Error('HOOK_SPLITS_NUMBER_UNIT: Không tách con số khỏi đơn vị/vế hoàn thành ý.');
 return value;
}
