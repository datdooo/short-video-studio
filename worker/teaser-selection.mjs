import {createSharedOperations} from "./shared-operation.mjs";
import {diverseExcerpts,partContextWindows,candidateFrameTimes} from "../lib/teaser-candidates.mjs";
import { checkHookSpeechBoundaries,speechEndingOptions } from "../lib/teaser-boundaries.mjs";
import { HOOK_SCHEMA, HOOK_INSTRUCTIONS, validateHookResponse, validateEditorialEvidence, replayEvidence } from "../lib/teaser-prompt.mjs";
export { HOOK_SCHEMA, HOOK_INSTRUCTIONS };
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { hookCandidates,hookDurationLimits,HOOK_SELECTION_POLICY,permittedHookRanges,unavailableHook,TEASER_POLICY, HOOK_PROMPT_VERSION, mainRanges, hookRangeKey, validateTeaser } from "../lib/teaser-hooks.mjs";

const clean = (s, max) => String(s || "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").slice(0, max);
import { validateHeatmap } from "../lib/source-context/heatmap.mjs";

const hash = (s) => createHash("sha256").update(JSON.stringify(s)).digest("hex");
export function hookInput(part, source, cues = [], supporting = {}) {
  const allRanges = mainRanges(part), ranges=allRanges.slice(0,200), permitted=permittedHookRanges(part).slice(0,200);
  const available = cues.slice(0, 20_000).filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && ranges.some((s) => c.start < s.end && c.end > s.start));
  const bounded = available.length > 120 ? Array.from({ length: 120 }, (_, i) => available[Math.floor(i * available.length / 120)]) : available;
  const heatmap = validateHeatmap(supporting.heatmap, { durationMs: Math.round(source.duration * 1000) });
  const relevantBins = heatmap?.status === 'available' ? heatmap.bins.filter(b => ranges.some(r => b.startMs < r.end * 1000 && b.endMs > r.start * 1000)) : [];
  // Bounded evidence summary; actual peak proposals are built by hookCandidates.
  const replayBins = relevantBins.length > 24 ? Array.from({ length: 24 }, (_, i) => relevantBins[Math.floor(i * relevantBins.length / 24)]) : relevantBins;
  return { sourceTitle: clean(source.title, 500), partTitle: clean(part.title, 500), partContext: clean(part.hook, 500), partId: part.id,
    durationLimits:hookDurationLimits(),contextWindows:partContextWindows(ranges,cues),transcriptCandidates:hookCandidates(part,cues,undefined,{...supporting,heatmap,sourceDurationMs:Math.round(source.duration*1000)}),selectionPolicy:HOOK_SELECTION_POLICY,mainContentRanges:allRanges.map(({start,end})=>({start,end})),excludedMainPresentationSeconds:10,permittedHookRanges:permitted,
    allowedRanges: permitted.map(({ start, end }) => ({ start, end })),
    transcript: bounded.map((c) => ({ start: c.start, end: c.end, text: clean(c.text, 180) })),
    untimedTranscript: available.length ? "" : clean(source.transcript, 6000),
    supporting: { ...(replayBins.length ? { heatmap: { timeline: 'source', timeUnit: 'ms', intensitySemantics: 'relative-replay-interest', bins: replayBins } } : {}), chapters: Array.isArray(supporting.chapters) ? supporting.chapters.slice(0, 20).map((c) => ({ startMs: c.startMs, endMs: c.endMs, title: clean(c.title, 100) })) : [],
      speechSilences: supporting.audioSignals?.status==='available'?supporting.audioSignals.silences.filter(s=>ranges.some(r=>s.start<r.end&&s.end>r.start)).slice(0,240):[], description: clean(supporting.description, 1500), commentClusters: Array.isArray(supporting.commentClusters) ? supporting.commentClusters.filter((c) => ranges.some((r) => c.centerMs / 1000 >= r.start && c.centerMs / 1000 <= r.end)).slice(0, 12).map((c) => ({ centerMs: c.centerMs, score: c.score })) : [] },
    missing: [...(!available.length ? ["No timestamped transcript; do not infer speech/audio meaning."] : []), ...(available.length > 120 || allRanges.length > 200 || cues.length > 20_000 ? ["Context was bounded/sampled."] : [])],
  };
}
export function hookFailure(error) {
  const status = error?.status;
  const message = String(error?.message || "");
  if (/AUTH_REQUIRED|AUTH_EXPIRED|PLAN_USAGE_DISABLED/.test(message)) return "provider-auth-unavailable";
  if (status === 429 || /RATE_LIMITED|PLAN_LIMIT_REACHED/.test(message)) return "provider-rate-limited";
  if (status === 404 || /MODEL_UNAVAILABLE/.test(message)) return "provider-model-unavailable";
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "provider-timeout";
  return "provider-response-invalid-or-unavailable"; // Never leak remote errors, credentials or payloads.
}

// Validate each AI-ranked choice independently. A broken optional alternative
// must not discard a valid winner, and only the AI's own order can promote one.
function rankedSelection(value, {part,source,cues,boundaryCues,input,images,provider,key,supporting}) {
  const rejected=[],valid=[];
  const alternatives=Array.isArray(value?.alternatives)?value.alternatives.slice(0,2):[];
  const choices=[value,...alternatives];
  for(let i=0;i<choices.length;i++){
    try{
      const choice=i===0?validateHookResponse({...choices[i],alternatives:[]}):validateHookResponse(choices[i],true);
      if(choice.start===null){rejected.push({rank:i,code:'HOOK_PROVIDER_UNAVAILABLE',reason:clean(choice.reason,600)});continue;}
      const {alternatives:ignored,...fields}=choice;void ignored;
      const {start,end}=fields;
      if(!input.allowedRanges.some(r=>start>=r.start&&end<=r.end))throw Error('HOOK_OUTSIDE_PERMITTED_RANGE');
      if((end-start)/hookDurationLimits().playbackRate<.5||end-start>hookDurationLimits().maxSourceSeconds)throw Error('HOOK_DURATION_OUT_OF_BOUNDS');
      validateEditorialEvidence(fields,{candidates:input.transcriptCandidates,images,cues});
      checkHookSpeechBoundaries(fields,boundaryCues,{silences:input.supporting.speechSilences});
      const result={...fields,limitations:[...fields.limitations,...input.missing,...(!images.length?['Chỉ có văn bản; chưa phân tích bằng chứng hình ảnh/hành động.']:['Chỉ có ảnh tĩnh thưa; chưa kiểm chứng video chuyển động hoặc audio.'])].slice(0,12),
        heatmapEvidence:replayEvidence(fields,input.transcriptCandidates,supporting.heatmap),version:1,selectionPolicy:HOOK_SELECTION_POLICY,status:'selected',selection:'ai',provider:provider.id,model:provider.model,promptVersion:HOOK_PROMPT_VERSION,inputKey:key,rangeKey:hookRangeKey(part),transition:'inherit-or-dip-black'};
      validateTeaser({...part,teaser:result},source.duration);
      valid.push({fields,result,rank:i});
    }catch(error){
      // Only local validation codes go back into repair, never remote payloads.
      const code=String(error.message||'').match(/^(?:HOOK_[A-Z_]+|INVALID_HOOK_[A-Z_]+)/)?.[0]||'HOOK_PLAN_VALIDATION_FAILED';
      rejected.push({rank:i,code,start:Number.isFinite(choices[i]?.start)?choices[i].start:null,end:Number.isFinite(choices[i]?.end)?choices[i].end:null});
    }
  }
  if(!valid.length)return{rejected};
  const winner=valid[0],others=diverseExcerpts(valid.map(v=>v.fields),3).slice(1);
  winner.result.alternatives=others;
  if(winner.rank>0)winner.result.limitations=[`Dùng phương án AI xếp hạng ${winner.rank+1}: phương án trước không qua kiểm tra kỹ thuật; không tự sửa timestamp.`,...winner.result.limitations].slice(0,12);
  validateTeaser({...part,teaser:winner.result},source.duration);
  return{result:winner.result,rejected};
}

export function createTeaserSelector({cacheRoot,resolveProvider,frames=async()=>[],fingerprint,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
  const shared=createSharedOperations();
  async function selectPart(part,source,cues,boundaryCues,supporting,provider,sourceHash,signal,providerFailure,maxAttempts,customInstruction,forceRefresh){
    const input=hookInput(part,source,cues,supporting);
    if(customInstruction)input.customTeaserRequest=customInstruction;
    input.speechBoundaryCues=boundaryCues.slice(0,20_000).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&c.end-c.start<=10&&String(c.text||'').trim()&&input.allowedRanges.some(r=>c.start<r.end&&c.end>r.start)).slice(0,240).map(({start,end,text})=>({start,end,text:clean(text,240)}));
    input.speechEndingOptions=speechEndingOptions(boundaryCues,input.allowedRanges,input.supporting.speechSilences);
    const key=hash({version:HOOK_PROMPT_VERSION,sourceHash,sourceId:source.id,transcriptHash:hash(source.transcript||''),ranges:hookRangeKey(part),input,provider:provider?.id||'none',model:provider?.model||'none',frames:'round-robin-local-max48x512-v5'});
    const file=path.join(cacheRoot,`${key}.json`);
    if(!forceRefresh)try{
      const cached=JSON.parse(await readFile(file,'utf8'));
      validateTeaser({...part,teaser:cached.teaser},source.duration);checkHookSpeechBoundaries(cached.teaser,boundaryCues,{silences:input.supporting.speechSilences});
      if(cached.promptVersion===HOOK_PROMPT_VERSION&&cached.inputKey===key&&cached.teaser.selectionPolicy===HOOK_SELECTION_POLICY&&cached.teaser.selection==='ai')return cached.teaser;
    }catch{/* Old/missing/unavailable analysis is not a new successful selection. */}
    return structuredClone(await shared(key,async activeSignal=>{
      let result,failure=providerFailure||'provider-not-configured',rejected=[];
      if(!input.allowedRanges.some(r=>(r.end-r.start)/hookDurationLimits().playbackRate>=.5))return unavailableHook(part,'Không có khoảng teaser hợp lệ sau 10 giây export đầu main của part này. Main được giữ; cần chỉnh main hoặc Custom Teaser hợp lệ.');
      if(provider){
        let images=[];
        try{images=await frames(part,source,activeSignal,candidateFrameTimes(input.transcriptCandidates));}catch{activeSignal.throwIfAborted();input.missing.push('Không lấy được ảnh đại diện; chưa có bằng chứng hình ảnh.');}
        for(let attempt=0;attempt<maxAttempts;attempt++){
          activeSignal.throwIfAborted();
          try{
            input.visualCoverage=input.transcriptCandidates.map(c=>({candidateId:c.id,frameTimes:images.filter(f=>f.candidateId===c.id).map(f=>f.time),limitation:'Sparse stills do not prove continuous action or audio.'}));
            const repair=attempt?{retry:{rejected,permittedIntervals:input.allowedRanges,durationLimits:input.durationLimits,instruction:'Choose again using these exact permitted source intervals and actual supplied evidence. Do not adjust old timestamps mechanically. Compare the strongest remaining real moments. Return unavailable if no compelling complete eligible choice is evidenced.'}}:{};
            const response=await provider.analyze({input:{...input,...repair},images,instructions:HOOK_INSTRUCTIONS+(customInstruction?'\nUSER CUSTOM REQUEST is a strict footage-search constraint, not a request to create speech/images. Select ONLY matching real footage in customTeaserRequest. If available speech/images cannot establish that event, return unavailable; never substitute another attractive event. Sparse images do not prove a largest catch or completed motion.':''),maxTokens:4500,schema:HOOK_SCHEMA,signal:AbortSignal.any([activeSignal,AbortSignal.timeout(90_000)])});
            const selection=rankedSelection(response.value,{part,source,cues,boundaryCues,input,images,provider,key,supporting});
            rejected=selection.rejected;
            if(selection.result){result=selection.result;break;}
            failure=rejected.some(r=>r.code==='HOOK_PROVIDER_UNAVAILABLE')?'provider-no-evidenced-candidate':'provider-selection-rejected';
          }catch(error){
            activeSignal.throwIfAborted();failure=hookFailure(error);rejected=[{code:failure}];
            if(['provider-auth-unavailable','provider-model-unavailable'].includes(failure))break;
            if(error.status===400&&images.length){images=[];input.missing.push('Model từ chối ảnh/request có cấu trúc; lượt sửa chỉ dùng văn bản.');}
            else if(failure==='provider-rate-limited'){
              const delay=Number(error.retryAfterMs??1000);if(!Number.isFinite(delay)||delay>5000||attempt+1>=maxAttempts)break;
              await sleep(Math.max(0,delay));activeSignal.throwIfAborted();
            }
          }
        }
      }
      const explanation={'provider-auth-unavailable':'lỗi đăng nhập/quyền sử dụng','provider-rate-limited':'hết hạn mức hoặc bị giới hạn lượt gọi','provider-model-unavailable':'model chưa khả dụng','provider-timeout':'request bị gián đoạn hoặc quá thời gian','provider-no-evidenced-candidate':'AI chưa tìm được khoảnh khắc đủ hấp dẫn, trọn nghĩa và có bằng chứng','provider-selection-rejected':'các lựa chọn AI không qua kiểm tra schema/range/biên lời nói','provider-not-configured':'chưa có provider được cấu hình'}[failure]||'provider chưa trả kết quả hợp lệ';
      const codes=rejected.map(r=>r.code).filter(c=>c.startsWith('HOOK_')).join(', ');
      result||=unavailableHook(part,`Chưa chọn được teaser bằng ChatGPT: ${explanation}.${codes?' Mã kiểm tra: '+codes+'.':''} Main/khóa được giữ. Chọn lại bằng AI hoặc dùng Custom Teaser; chưa thể xuất khi thiếu teaser hợp lệ.`);
      activeSignal.throwIfAborted();
      try{
        await mkdir(cacheRoot,{recursive:true,mode:0o700});
        await writeFile(file,JSON.stringify({at:Date.now(),promptVersion:HOOK_PROMPT_VERSION,inputKey:key,teaser:result}),{mode:0o600});
        const entries=(await readdir(cacheRoot)).filter(f=>/^[a-f0-9]{64}\.json$/.test(f));
        for(const name of entries.filter(f=>f!==`${key}.json`).slice(0,Math.max(0,entries.length-256)))await unlink(path.join(cacheRoot,name)).catch(()=>{});
      }catch{/* Best-effort cache never invalidates a successful AI choice. */}
      return result;
    },signal));
  }
  return async function select(plan,source,{cues=[],boundaryCues=cues,supporting={},signal,targetPartId,maxAttempts=2,customInstruction,forceRefresh=false}={}){
    signal?.throwIfAborted();let provider,providerFailure;
    try{provider=await resolveProvider(signal);}catch(error){signal?.throwIfAborted();providerFailure=hookFailure(error);}
    const sourceHash=await fingerprint(source,signal),result=structuredClone(plan);
    if(plan.teaserPolicy===undefined&&!plan.parts.some(p=>p.teaser)&&plan.hookTransition===undefined)result.hookTransition='vr-light-leak-v2';
    result.teaserPolicy=TEASER_POLICY;
    for(const part of result.parts)if((targetPartId===undefined||targetPartId===part.id)&&(!part.customTeaser||customInstruction)){
      signal?.throwIfAborted();part.teaserNeedsReselection=false;
      try{
        part.teaser=await selectPart(part,source,cues,boundaryCues,supporting,provider,sourceHash,signal,providerFailure,Number.isFinite(maxAttempts)?Math.min(2,Math.max(1,Math.trunc(maxAttempts))):2,customInstruction,forceRefresh);
      }catch{
        signal?.throwIfAborted();
        part.teaser=unavailableHook(part,'Chưa chọn được teaser bằng ChatGPT: không chuẩn bị được bằng chứng/kết quả cho part này. Main được giữ; chọn lại bằng AI hoặc Custom Teaser.');
      }
    }
    return result;
  };
}
