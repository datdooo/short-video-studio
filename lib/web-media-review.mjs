// Manual website reports are declarations, never provider telemetry or proof
// that the model inspected the attachment. No media is decoded by this module.
export const WEB_MEDIA_REVIEW_VERSION='manual-media-review-v1';
const MODES={video:['continuous','sampled','unavailable','unknown'],audio:['listened','transcript-only','partial','unavailable','unknown']};
const fail=(code,detail)=>{throw Object.assign(Error(`WEB_MEDIA_REVIEW_${code} · ${detail}`),{code:`WEB_MEDIA_REVIEW_${code}`});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const short=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max;

export function webMediaReviewPlan(source){
 if(!source?.id||!Number.isFinite(source.duration)||source.duration<=0)fail('SOURCE','Thiếu định danh/thời lượng video nguồn.');
 // These are compact reporting checkpoints, NOT frames or an editorial cut
 // quota. They partition the whole source, including quiet spans and the tail.
 const count=Math.min(12,Math.max(1,Math.ceil(source.duration/90)));
 return{version:WEB_MEDIA_REVIEW_VERSION,sourceId:source.id,duration:source.duration,clock:'source-seconds',
  checkpoints:Array.from({length:count},(_,i)=>({id:`review-${i}`,start:source.duration*i/count,end:source.duration*(i+1)/count})),
  controls:{reviewDepth:'adaptive; deepen review whenever evidence is difficult or uncertain; quality precedes quota',videoSampling:'website-controlled; full continuous review requested, not confirmed',reasoning:'website-setting; not configured or verified by Studio'},
  receipt:'ai-self-report; not independent media-access or continuous-playback verification'};
}

export const WEB_MEDIA_REVIEW_INSTRUCTIONS=`MEDIA REVIEW — ONE TURN, NO EXTRA REQUEST:
1. Read all supplied text once, retaining global cue IDs. Review the ACTUAL full attached video from source time 0 through its ending, including low-speech sections. Use the website's native continuous-video capability if available; do not substitute a few still frames and call it a full watch. Do not replay the whole video for each part/candidate. A complete transcript supplies speech context but does not establish motion, a visual outcome, a child's presence or audio completion.
2. ADAPTIVE DEPTH: reuse this full-source review to choose main and shortlist teasers under the unchanged criteria. For straightforward material, focus detailed reinspection on the shortlist, main entry/exit points, retained joins and uncertain exclusions. For difficult material, quality takes priority over quota: inspect as much additional footage/audio as needed, including a second full pass if necessary; do not cap frames/time just to be cheap. Difficulty includes sparse speech with meaningful action, fast motion, unclear causality/payoff, uncertain cut boundaries, conflicting text/video or possible child appearances that cannot be clearly established. Listen to speech around final cuts and watch motion continuously through action endings. Report reviewDepth deep and one brief depthReason for the actual difficulty; otherwise standard. This is review work, not an instruction to change the website's reasoning setting or the app's Auto model. Inspect the SAME source-clock ranges; do not alter timestamps, speed, quality rules or protected edits. No exhaustive per-frame narration, long scorecards or repeated source summaries.
3. Return mediaReview using the supplied reviewPlan. One short note per checkpoint records a concrete observation; these checkpoints are bookkeeping of the full review, NOT permission to review only those frames. video.reviewedRanges declares what was actually reviewed; list every unreviewed interval in video.gaps. mode continuous is permitted ONLY after continuous review of those video intervals. A frame grid, sparse seeking or timestamp samples MUST be mode sampled even if samples span the entire source. Set sampleIntervalSeconds only if the sampling interval is actually known; otherwise null. Never infer missing duration/access/model/reasoning settings. Studio does not set or verify the website's frame sampling or reasoning mode; report unknown when unavailable. A prompt cannot change those settings.
4. Return one focusChecks row per newly selected teaser (winner index0, alternatives1/2), with its exact source start/end. Omit checks for disabled or preserved manual/custom teasers; do not change them. Declare video continuous only after actually watching that excerpt continuously. For speech/mixed-speech endings declare audio listened only after actually listening; transcript punctuation is not an audio check. audio.reviewedRanges identifies listened source intervals. Full-source audio need not be listened repeatedly: reuse complete transcript for context and listen to the final speech cuts and relevant ambiguous sound events; difficult audio deserves further listening without a quota cap. Mark every limitation honestly.
5. If full video review is unsupported, incomplete or unavailable, report it with partial checkpoint status and the actual mode/gaps. Do NOT invent a successful receipt or erase limitations just to satisfy import. The app may keep the previous plan and ask the user to resolve missing review. Keep the SAME source/request/context IDs on follow-up; return a complete revised JSON, including the updated mediaReview. Use available website media tools as needed, without inventing access or changing the user's model/mode. Studio does not add an AI request/retry/repair. Report concise observations and final decisions, not private reasoning or a chain-of-thought transcript.
All review status, model and reasoning values in this JSON are AI self-reports, NOT independently confirmed website/provider telemetry.`;

export function webMediaReviewSchema(source){
 const plan=webMediaReviewPlan(source),range={type:'array',minItems:2,maxItems:2,items:{type:'number'}},ranges={type:'array',maxItems:128,items:range};
 const row=(properties)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
 return row({version:{type:'string',const:WEB_MEDIA_REVIEW_VERSION},sourceId:{type:'string',const:source.id},duration:{type:['number','null']},reviewDepth:{type:'string',enum:['standard','deep']},depthReason:{type:'string',maxLength:160},
  video:row({mode:{type:'string',enum:MODES.video},reviewedRanges:ranges,gaps:ranges,sampleIntervalSeconds:{type:['number','null']}}),
  audio:row({mode:{type:'string',enum:MODES.audio},reviewedRanges:ranges}),
  model:{type:'string',maxLength:120,description:'Actual visible model label if known, otherwise web-model-unknown; self-report only.'},
  reasoningMode:{type:'string',maxLength:80,description:'Actual visible website mode if known, otherwise unknown. Not a requested API reasoning value or provider confirmation.'},
  checkpoints:{type:'array',minItems:plan.checkpoints.length,maxItems:plan.checkpoints.length,items:row({id:{type:'string',enum:plan.checkpoints.map(p=>p.id)},status:{type:'string',enum:['reviewed','partial','unavailable']},at:{type:['number','null']},note:{type:'string',maxLength:160,description:'One short Vietnamese observation or the precise access limitation; no transcript recap.'}})},
  focusChecks:{type:'array',maxItems:6,items:row({partId:{type:'integer',enum:[1,2]},choiceIndex:{type:'integer',minimum:0,maximum:2},start:{type:'number'},end:{type:'number'},video:{type:'string',enum:['continuous','sampled','unavailable','unknown']},audio:{type:'string',enum:['listened','transcript-only','unavailable','unknown']},note:{type:'string',maxLength:160}})},
  limitations:{type:'array',maxItems:6,items:{type:'string',maxLength:200}}});
}

function fields(value,names,path){
 if(!object(value)||Object.keys(value).some(key=>!names.includes(key))||names.some(key=>!Object.hasOwn(value,key)))fail('SCHEMA',`${path}: thiếu trường hoặc có trường ngoài schema. Trả đúng mediaReview trong TXT mới.`);
}
function ranges(value,duration,path){
 if(!Array.isArray(value)||value.length>128)fail('RANGES',`${path}: danh sách khoảng thời gian không hợp lệ.`);
 for(const r of value){
  if(!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)||r[0]<0||r[1]<=r[0]||r[1]>duration)fail('RANGES',`${path}: dùng các khoảng giây nguồn hữu hạn, không vượt nguồn.`);
 }
 return value;
}
// Coverage unions may overlap (e.g. two auditioned candidates). Sorting here
// changes neither the receipt nor any actual main/teaser source range.
function covers(all,start,end){let cursor=start;for(const r of [...all].sort((a,b)=>a[0]-b[0]||a[1]-b[1])){if(r[1]<=cursor)continue;if(r[0]>cursor)return false;cursor=r[1];if(cursor>=end)return true;}return cursor>=end;}

export function validateWebMediaReview(value,source,parts,selections){
 const plan=webMediaReviewPlan(source);
 fields(value,['version','sourceId','duration','reviewDepth','depthReason','video','audio','model','reasoningMode','checkpoints','focusChecks','limitations'],'mediaReview');
 if(value.version!==plan.version||value.sourceId!==source.id)fail('SOURCE','Báo cáo rà video thuộc nguồn hoặc phiên bản TXT khác.');
 if(!Number.isFinite(value.duration)||value.duration<=0||Math.abs(value.duration-source.duration)>.25)fail('DURATION',`Chưa xác định đúng thời lượng tệp video (nguồn ${source.duration}s).`);
 fields(value.video,['mode','reviewedRanges','gaps','sampleIntervalSeconds'],'mediaReview.video');
 fields(value.audio,['mode','reviewedRanges'],'mediaReview.audio');
 if(!['standard','deep'].includes(value.reviewDepth)||!short(value.depthReason,160)||!MODES.video.includes(value.video.mode)||!MODES.audio.includes(value.audio.mode)||!short(value.model,120)||!short(value.reasoningMode,80)||!Array.isArray(value.limitations)||value.limitations.length>6||value.limitations.some(s=>!short(s,200)))fail('SCHEMA','Báo cáo mức rà/video/audio/model chưa đúng schema.');
 const video=ranges(value.video.reviewedRanges,source.duration,'video.reviewedRanges'),gaps=ranges(value.video.gaps,source.duration,'video.gaps'),audio=ranges(value.audio.reviewedRanges,source.duration,'audio.reviewedRanges');
 if(value.video.sampleIntervalSeconds!==null&&(!Number.isFinite(value.video.sampleIntervalSeconds)||value.video.sampleIntervalSeconds<=0))fail('SAMPLING','Chu kỳ lấy mẫu phải là số giây dương thực sự biết hoặc null.');
 if(!Array.isArray(value.checkpoints)||value.checkpoints.length!==plan.checkpoints.length)fail('CHECKPOINTS','Thiếu mốc rà đầu/giữa/cuối nguồn theo reviewPlan trong TXT.');
 const seen=new Set();
 for(const check of value.checkpoints){
  fields(check,['id','status','at','note'],'mediaReview.checkpoints');const expected=plan.checkpoints.find(p=>p.id===check.id);
  if(!expected||seen.has(check.id)||!['reviewed','partial','unavailable'].includes(check.status)||!short(check.note,160)||check.at!==null&&(!Number.isFinite(check.at)||check.at<expected.start||check.at>expected.end))fail('CHECKPOINTS','Mốc rà video bị lặp, sai timestamp hoặc thiếu ghi chú.');
  seen.add(check.id);
  if(check.status==='reviewed'&&(check.at===null||!covers(video,expected.start,expected.end)))fail('CHECKPOINTS',`${check.id}: khai đã rà nhưng khoảng đã xem không phủ mốc ${expected.start}–${expected.end}s.`);
 }
 // A sampled declaration spanning the source is never relabeled continuous.
 if(value.video.mode!=='continuous'||value.video.sampleIntervalSeconds!==null||gaps.length||!covers(video,0,source.duration)||value.checkpoints.some(p=>p.status!=='reviewed')){
  const missing=value.checkpoints.filter(p=>p.status!=='reviewed').map(p=>p.id).join(', ');
  fail('INCOMPLETE',`AI chưa khai đã xem liên tục toàn video (cách đọc: ${value.video.mode}${missing?`; mốc thiếu: ${missing}`:''}). Giữ JSON để yêu cầu rà phần thiếu; plan hiện tại chưa thay đổi.`);
 }
 if(!Array.isArray(value.focusChecks)||value.focusChecks.length>6)fail('FOCUS','Thiếu/sai danh sách kiểm tra teaser.');
 const focus=new Map();
 for(const check of value.focusChecks){
  fields(check,['partId','choiceIndex','start','end','video','audio','note'],'mediaReview.focusChecks');
  if(![1,2].includes(check.partId)||!Number.isInteger(check.choiceIndex)||check.choiceIndex<0||check.choiceIndex>2||!MODES.video.includes(check.video)||!['listened','transcript-only','unavailable','unknown'].includes(check.audio)||!short(check.note,160))fail('FOCUS','Mốc kiểm tra teaser không đúng schema.');
  ranges([[check.start,check.end]],source.duration,'focusChecks');
  const key=`${check.partId}:${check.choiceIndex}`;if(focus.has(key))fail('FOCUS','Lặp kết quả kiểm tra cùng ứng viên teaser.');focus.set(key,check);
 }
 const expectedFocus=new Set();
 for(const [i,part] of parts.entries()){
  // Explicit manual/protected teasers are not newly subjected to AI gates.
  if(part.teaserEnabled===false||part.customTeaser)continue;
  const selection=selections?.[i];if(!selection)continue;
  if(!object(selection)||!Array.isArray(selection.alternatives)||selection.alternatives.length>2)fail('FOCUS',`Part ${part.id}: teaserSelection sai schema.`);
  for(const [rank,choice] of [selection,...(selection.alternatives||[])].entries()){
   if(!object(choice))fail('FOCUS',`Part ${part.id}, ứng viên ${rank+1}: thiếu lựa chọn teaser.`);
   if(choice.start===null&&choice.end===null)continue;
   const key=`${part.id}:${rank}`,check=focus.get(key);expectedFocus.add(key);
   if(!check||check.start!==choice.start||check.end!==choice.end)fail('FOCUS',`Part ${part.id}, ứng viên ${rank+1}: thiếu kiểm tra đúng range teaser đã trả.`);
   if(check.video!=='continuous')fail('FOCUS',`Part ${part.id}, ứng viên ${rank+1}: chưa khai đã xem liên tục đoạn teaser.`);
   if(choice.endingBasis==='speech'&&(check.audio!=='listened'||!['listened','partial'].includes(value.audio.mode)||!covers(audio,check.start,check.end)))fail('AUDIO',`Part ${part.id}, ứng viên ${rank+1}: chưa nghe kiểm tra đoạn lời nói tại mốc cắt; transcript không chứng minh đuôi âm.`);
  }
 }
 if([...focus.keys()].some(key=>!expectedFocus.has(key)))fail('FOCUS','Báo cáo có kiểm tra ứng viên không thuộc kết quả đang nhập.');
 return structuredClone(value);
}
