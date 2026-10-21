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
  const tail=(cue.timing==='word'||(pause&&pause.end>=cue.end+.12)) ? .12 : 0;
  const end=cue.end+tail;
  if(next&&end>next.start-(tail ? .02 : 0))continue;
  if(!ranges.some(r=>cue.start>=r.start&&end<=r.end))continue;
  out.push({lastCueStart:cue.start,lastCueEnd:cue.end,suggestedEnd:end,timing:cue.timing||'cue',text:String(cue.text).slice(0,240),nextSpeechStart:next?.start??null,...(pause?{measuredSilence:{start:pause.start,end:pause.end}}:{}),limitation:'Timing/punctuation/pause proposal only; verify the entire sentence/idea including number+unit. Never auto-apply this endpoint.'});
 }
 return out.length<=180?out:Array.from({length:180},(_,i)=>out[Math.floor(i*out.length/180)]);
}
export function hookSpeechBoundaryWarning(value,cues=[]){
 if(!value||!Number.isFinite(value.start)||!Number.isFinite(value.end))return '';
 const local=spokenCues(cues).filter(c=>c.start<value.end&&c.end>value.start);
 if(!local.length)return 'Chưa có timestamp lời nói/từ đủ chính xác để xác minh biên. Cần nghe kiểm tra đuôi âm và câu trọn nghĩa; app không tự đổi mốc.';
 const inside=local.some(c=>[value.start,value.end].some(t=>t>c.start+.02&&t<c.end-.02));
 return inside?'Mốc nằm trong cue lời nói; có thể cắt lời. Đây là cảnh báo, mốc thủ công không bị đổi hoặc chặn.':'Cuối cue/khoảng ngắt chưa chứng minh trọn câu; có thể thiếu đuôi âm. Mốc thủ công vẫn dùng nguyên.';
}
export function checkHookSpeechBoundaries(value,cues=[]){
 if(!value||!Number.isFinite(value.start)||!Number.isFinite(value.end)||value.selection==='manual')return value;
 // Only explicitly word-timed evidence can establish a technical split/tail.
 // Cue punctuation, next-line estimates and semantic completeness belong to GPT,
 // never a local keyword/engagement threshold or a fabricated word alignment.
 const words=spokenCues(cues).filter(c=>c.timing==='word');
 for(const time of [value.start,value.end])if(words.some(c=>time>c.start+.02&&time<c.end-.02))throw Error('HOOK_SPLITS_TIMED_SPEECH: Mốc nằm trong từ có timestamp; chọn mốc khác, không tự snap.');
 const last=words.filter(c=>c.start>=value.start-.02&&c.end<=value.end+.02).at(-1);
 if(last&&value.end<last.end+SPEECH_TAIL_SECONDS-1e-6)throw Error('HOOK_SPEECH_TAIL_TOO_SHORT: Thiếu 80ms sau từ cuối có timestamp đo được; chọn lại trong permitted range.');
 return value;
}
