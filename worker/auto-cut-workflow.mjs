import {buildExternalEditingContext} from './external-editing-context.mjs';
import {measureAiStage} from './ai-operation.mjs';
import {hookFailure,hookFailureNotice} from './teaser-selection.mjs';
import {captureAiMainRanges} from '../lib/main-ranges.mjs';
import {assertTeaserContexts,selectionDigest,selectionRequestValue,transcriptValue} from '../lib/teaser-context.mjs';
import {externalHooksCurrent} from '../lib/teaser-import.mjs';
import {externalPlanAnalysis} from '../lib/auto-cut/main-content.mjs';
import {attachExternalHooks} from '../lib/teaser-import.mjs';
import {assertMainLocks} from '../lib/auto-cut/locks.mjs';
import {isLaterHookPolicy,TEASER_POLICY,hookRangeKey,unavailableHook,validateTeaser,mainRanges} from '../lib/teaser-hooks.mjs';
import {validatePlan} from './plan-validation.mjs';
import {stat} from 'node:fs/promises';
// One orchestration path for single-source Auto, external context/import and batch.
export function createAutoCutWorkflow({prepareInputs,mainContent,selectHooks,verifyPreservedTeasers}) {
  return async function analyze(source,body={},signal){
    signal?.throwIfAborted();
    const {context,options}=await measureAiStage('preparation',()=>prepareInputs(source,body,signal));
    if(body.mode==='context'||body.mode==='import')options.sourceMediaBytes=(await stat(source.mediaPath)).size;
    if(body.mode==='context')return{context:buildExternalEditingContext(source,context,options,await mainContent.prepare(source,context,options),body)};
    if(body.mode==='import'){
      if(!['gemini','muse','chatgpt-web'].includes(body.provider)||body.sourceId!==source.id||typeof body.requestId!=='string'||!/^[a-f0-9-]{16,64}$/i.test(body.requestId))throw new Error('External import source/request/provider mismatch.');
      const input=await mainContent.prepare(source,context,options);
      const externalContext=buildExternalEditingContext(source,context,options,input,body);
      if(body.analysisKey!==externalContext.analysisKey)throw new Error('Dữ liệu nguồn, transcript, main/locks hoặc quy tắc prompt đã đổi. Tạo prompt mới trước khi nhập JSON.');
      const attachment=body.attachmentConfirmation;
      if(!attachment||attachment.sourceId!==source.id||attachment.requestId!==body.requestId||attachment.analysisKey!==body.analysisKey||attachment.mediaId!==externalContext.attachments.sourceVideo.id||attachment.attached!==true)throw Error('Xác nhận đã đính kèm đúng video nguồn của prompt hiện tại trước khi áp dụng. Manifest không phải bằng chứng đã tải lên.');
      let plan=structuredClone(body.plan);
      if(plan.providerUsed!==body.provider||plan.parts?.some((p,i)=>p.id!==i+1))throw new Error('External plan provider/part identity mismatch.');
      validatePlan(plan,source,{teasers:false});assertMainLocks(plan,body.currentPlan);
      plan=await attachExternalHooks({...plan,captionCues:options.captionTrack},body.hookSelections,{...source,sourceContext:context},String(body.transcript??source.transcript??''),body.provider,options.cues,{instruction:options.instruction,supplementalPrompt:options.supplementalPrompt,externalVideo:true});
      validatePlan(plan,source);
      if(plan.parts.some(p=>p.teaserEnabled!==false&&!(p.teaser?.status==='unavailable'&&isLaterHookPolicy(p.teaser.selectionPolicy))&&(p.teaser?.selection!=='external-import'||p.teaser.provider!==body.provider)))throw new Error('Part bật teaser cần kết quả import hợp lệ. Sửa teaserSelection trong JSON, không tự chuyển provider.');
      return{plan:captureAiMainRanges(externalPlanAnalysis(plan,source,context,options,input),body.currentPlan)};
    }
    let plan=await mainContent.select(source,context,options);
    if(options.captionTrack)plan.captionCues=structuredClone(options.captionTrack);
    if(body.currentPlan){
      // A re-run of MAIN is not permission to select new teasers. Validate the
      // previous source/citation identity first, then preserve it explicitly.
      const content=String(body.transcript??source.transcript??''),cues=options.cues||[];
      plan.teaserPolicy=body.currentPlan.teaserPolicy||TEASER_POLICY;
      plan.teaserTranscriptKey=await selectionDigest(transcriptValue(content));
      for(const part of plan.parts){
        const previous=body.currentPlan.parts.find(p=>p.id===part.id);
        if(!previous)continue;
        if(typeof previous.teaserEnabled==='boolean')part.teaserEnabled=previous.teaserEnabled;
        part.customTeaser=structuredClone(previous.customTeaser);
        part.teaser=previous.teaser?{...structuredClone(previous.teaser),rangeKey:hookRangeKey(part)}:unavailableHook(part,'Chưa có teaser. Chọn riêng trong Timeline.');
        part.teaserNeedsReselection=previous.teaserNeedsReselection===true;
        if(previous.teaserEnabled===false||previous.teaser?.status!=='selected')continue;
        try{
          const binding=previous.teaser.binding;
          if(['ai','external-import'].includes(previous.teaser.selection)&&binding){
            const original=binding.retainedMainContext;
            const {manualMainContext,retainedMainContext,...identity}=binding;void retainedMainContext;
            const originalRanges=structuredClone(original?.originalRanges||manualMainContext?.originalRanges||mainRanges(previous).map(s=>[s.start,s.end]));
            // The excerpt may currently need review after a manual exclusion.
            // Verify against its actual ORIGINAL selection context, then check
            // containment in the newly selected main separately below.
            const selectionPart={...previous,title:original?.partTitle??previous.title,hook:original?.partContext??previous.hook,
              segments:originalRanges.map(([start,end])=>({start,end})),
              teaser:{...previous.teaser,binding:identity,rangeKey:JSON.stringify(originalRanges)}};
            const isolated={...body.currentPlan,parts:[selectionPart]};
            validateTeaser(selectionPart,source.duration);
            await assertTeaserContexts(isolated,source,cues,content);
            if(!await externalHooksCurrent(isolated,source,content))throw Error('Teaser import đã cũ.');
            await verifyPreservedTeasers?.(isolated,source,signal);
            part.teaser.binding={...identity,retainedMainContext:{version:1,
              originalRanges,
              rangeKey:hookRangeKey(part),requestKey:await selectionDigest(selectionRequestValue({instruction:body.instruction,supplementalPrompt:body.supplementalPrompt},part)),
              partTitle:original?.partTitle??previous.title,partContext:original?.partContext??previous.hook}};
          }
          if(part.teaser.alternatives)part.teaser.alternatives=part.teaser.alternatives.filter(choice=>{try{validateTeaser({...part,teaser:{...part.teaser,...choice,heatmapEvidence:undefined,alternatives:undefined}},source.duration);return true;}catch{return false;}});
          validateTeaser(part,source.duration,source.id);
          await assertTeaserContexts({...plan,parts:[part]},source,cues,content,{instruction:body.instruction,supplementalPrompt:body.supplementalPrompt});
          part.teaserNeedsReselection=false;
        }catch(error){
          signal?.throwIfAborted();
          // Keep endpoints/evidence for editing, but never bless stale evidence
          // or hide a range outside the new main/gap. Readiness blocks export.
          part.teaserNeedsReselection=true;
        }
      }
      plan=captureAiMainRanges(plan,body.currentPlan);validatePlan(plan,source,{teasers:false});assertMainLocks(plan,body.currentPlan);signal?.throwIfAborted();return{plan};
    }
    if(plan.analysis?.method==='deterministic-fallback'&&/provider-(auth|rate-limited|model-unavailable|reasoning-unsupported|fast-unsupported)/.test(plan.analysis.fallbackReason||'')&&!body.currentPlan?.parts?.every(p=>p.manualLocked)){
      plan={...plan,hookTransition:plan.hookTransition??(plan.teaserPolicy?undefined:"vr-light-leak-v2"),teaserPolicy:TEASER_POLICY,parts:plan.parts.map(p=>p.teaserEnabled===false?p:({...p,teaser:(p.customTeaser||p.manualLocked)&&p.teaser?p.teaser:unavailableHook(p,'Bước phân tích main: '+hookFailureNotice(plan.analysis.fallbackReason))}))};
    }else try{
      plan=await selectHooks(plan,{...source,sourceContext:context},signal,body.transcript,{instruction:body.instruction,supplementalPrompt:body.supplementalPrompt});
    }catch(error){
      signal?.throwIfAborted();
      // A failure preparing optional teaser context must not discard new main
      // ranges or rerun main selection. Enabled parts still require valid hooks.
      plan={...plan,teaserPolicy:TEASER_POLICY,parts:plan.parts.map(p=>p.teaserEnabled===false?p:({...p,teaser:p.customTeaser&&p.teaser?p.teaser:unavailableHook(p,'Bước chuẩn bị/chọn teaser: '+hookFailureNotice(hookFailure(error)))}))};
    }
    plan=captureAiMainRanges(plan,body.currentPlan);validatePlan(plan,source,{teasers:false});assertMainLocks(plan,body.currentPlan);signal?.throwIfAborted();return{plan};
  };
}
