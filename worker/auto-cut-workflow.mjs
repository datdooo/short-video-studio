import {externalPlanAnalysis,modelSelectionInput} from '../lib/auto-cut/main-content.mjs';
import {assertMainLocks,lockedParts} from '../lib/auto-cut/locks.mjs';
import {isLaterHookPolicy,fallbackTeaser,TEASER_POLICY,hookRangeKey,unavailableHook} from '../lib/teaser-hooks.mjs';
import {validatePlan} from './plan-validation.mjs';
// One orchestration path for single-source Auto, external context/import and batch.
export function createAutoCutWorkflow({prepareInputs,mainContent,selectHooks}) {
  return async function analyze(source,body={},signal){
    signal?.throwIfAborted();
    const {context,options}=await prepareInputs(source,body,signal);
    if(body.mode==='context')return{context:modelSelectionInput(await mainContent.prepare(source,context,options))};
    if(body.mode==='import'){
      if(!['gemini','muse'].includes(body.provider)||body.sourceId!==source.id||typeof body.requestId!=='string'||!/^[a-f0-9-]{16,64}$/i.test(body.requestId))throw new Error('External import source/request/provider mismatch.');
      const input=await mainContent.prepare(source,context,options);
      if(body.analysisKey!==input.analysisKey)throw new Error('Analysis context or manual locks changed; generate a new prompt.');
      const plan=structuredClone(body.plan);
      if(plan.providerUsed!==body.provider||plan.parts?.some((p,i)=>p.id!==i+1))throw new Error('External plan provider/part identity mismatch.');
      validatePlan(plan,source);assertMainLocks(plan,body.currentPlan);
      if(plan.parts.some(p=>!(p.teaser?.status==='unavailable'&&isLaterHookPolicy(p.teaser.selectionPolicy))&&(p.teaser?.selection!=='external-import'||p.teaser.provider!==body.provider)))throw new Error('Missing valid external hooks; use the hook-only prompt for this provider.');
      return{plan:externalPlanAnalysis(plan,source,context,options,input)};
    }
    let plan=await mainContent.select(source,context,options);
    if(body.captionCues)plan.captionCues=structuredClone(body.captionCues);
    for(const part of plan.parts){const previous=body.currentPlan?.parts?.find(p=>p.id===part.id);if(previous?.customTeaser){part.customTeaser=structuredClone(previous.customTeaser);part.teaser=hookRangeKey(previous)===hookRangeKey(part)?structuredClone(previous.teaser):unavailableHook(part,'Main đã đổi; Custom Teaser cần kiểm tra lại. Không tự chọn đoạn thay thế.');}}
    if(!lockedParts(body.currentPlan).every(Boolean)){
      if(plan.analysis?.method==='deterministic-fallback'&&/provider-/.test(plan.analysis.fallbackReason||'')){
        plan={...plan,hookTransition:plan.hookTransition??(plan.teaserPolicy?undefined:"vr-light-leak-v2"),teaserPolicy:TEASER_POLICY,parts:plan.parts.map(p=>({...p,teaser:(p.customTeaser||p.manualLocked)&&p.teaser?p.teaser:fallbackTeaser(p,'AI main selection unavailable; deterministic same-part hook, editorial relevance unverified.',options.boundaryCues||options.cues,plan.analysis.analysisKey)}))};
      }else plan=await selectHooks(plan,{...source,sourceContext:context},signal,body.transcript);
    }
    validatePlan(plan,source);assertMainLocks(plan,body.currentPlan);signal?.throwIfAborted();return{plan};
  };
}
