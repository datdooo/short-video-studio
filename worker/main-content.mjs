import {measureAiStage,aiEvent} from './ai-operation.mjs';
import { normalizeLocalSignals } from '../lib/auto-cut/local-signals.mjs';
import { createHash } from 'node:crypto';
import { generateMainCandidates, deterministicMainSelection, selectionToPlan, MAIN_SCHEMA, MAIN_INSTRUCTIONS, modelSelectionInput, lockedParts, assertMainLocks } from '../lib/auto-cut/main-content.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { createAnalysisCache } from './analysis-cache.mjs';
import { validatePlan } from './plan-validation.mjs';
import { hookFailure } from './teaser-selection.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createMainContentSelector({ cacheRoot, resolveProvider, fingerprint, frames, protectedKeys }) {
  const cache = createAnalysisCache(cacheRoot, { protectedKeys }), shared = createSharedOperations({onJoin:()=>aiEvent('cache',{joined:true,reason:'shared-in-flight'})});
  async function prepare(source, context, options = {}) {
    options.signal?.throwIfAborted();
    const digest = await fingerprint(source, options.signal);
    const input = generateMainCandidates(source, context, { ...options, localSourceKey:digest, ...(options.local ? { local:normalizeLocalSignals(options.local,{duration:source.duration,sourceKey:digest}) } : {}) });
    const { sourceId, ...stable } = input;
    const analysisKey = hash({ digest, input: stable });
    return { ...input, sourceId, analysisKey };
  }
  return {
    prepare,
    async select(source, context, options = {}) {
      if (lockedParts(options.currentPlan).every(Boolean)) {
        const plan = structuredClone(options.currentPlan); validatePlan(plan, source,{teasers:false}); return plan;
      }
      const prepared = await measureAiStage('preparation',()=>prepare(source, context, options));
      let provider, failure;
      try { provider = await resolveProvider(options.signal); } catch (e) { options.signal?.throwIfAborted(); failure = hookFailure(e); }
      const { sourceId, analysisKey, ...stableInput } = prepared;
      const key = hash({ explanationLanguage:'vi-v1',analysisKey, provider: provider?.id || 'none', model: provider?.model || 'none', reasoningPolicy:provider?.reasoningPolicyKey||'unconfigured', retryVersion:'technical-repair-v2' });
      const result = await shared(key, signal => cache.using(key, async () => {
        const cached = await cache.get(key);
        if (cached) {
          try { const plan = { ...cached, originalTitle:source.title, analysis:{ ...cached.analysis, sourceId, cacheKey:key } }; validatePlan(plan,source,{teasers:false}); assertMainLocks(plan,options.currentPlan); aiEvent('cache',{hit:true}); return plan; } catch { /* Invalid/old cache is not a valid analysis. */ }
        }
        aiEvent('cache',{hit:false});
        let plan, textOnly = false;
        if (provider) {
          let images = [];
          try { images = frames ? await frames({ segments:[{start:0,end:source.duration}] },source,signal) : []; }
          catch { signal.throwIfAborted(); /* Optional sparse images; text still works. */ }
          textOnly = !images.length;
          let repair;
          for (let attempt=0; attempt<2; attempt++) {
            let localValidation=false;
            if(attempt)aiEvent('retry',{reason:repair?.code||failure,attempt:attempt+1});
            try {
              const input={...modelSelectionInput(stableInput),phase:attempt?'repair-main':'select-main',...(repair?{retry:repair}:{})};
              const response = await provider.analyze({ input, images, schema:MAIN_SCHEMA, instructions:MAIN_INSTRUCTIONS, signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]), maxTokens:3600 });
              localValidation=true;
              plan=await measureAiStage('validation',()=>{
                const next=selectionToPlan(prepared,response.value,{currentPlan:options.currentPlan,provider:provider.id,model:provider.model});
                validatePlan(next,source,{teasers:false});return next;
              });break;
            } catch (e) {
              signal.throwIfAborted(); failure = localValidation?'provider-selection-rejected':hookFailure(e);
              if(localValidation)repair={code:'MAIN_PLAN_VALIDATION_FAILED',reason:String(e.message||'Invalid main selection').slice(0,240),instruction:'Repair only the failed main selection using the exact supplied recipes, boundaries and locks. Preserve complete source coverage and all unmodified input evidence; do not invent timestamps.'};
              else if(e.code==='IMAGE_UNSUPPORTED'&&images.length){images=[];textOnly=true;repair={code:'IMAGE_UNSUPPORTED',instruction:'Connection explicitly rejected image input. Use the supplied text and signals; disclose missing visual evidence.'};}
              else if(!['provider-schema-invalid','provider-output-incomplete'].includes(failure))break;
              else repair={code:failure,instruction:'Return complete valid JSON in the supplied schema. Keep the same source evidence, recipes and locks; repair only the response shape.'};
            }
          }
        }
        if (!plan) plan = deterministicMainSelection(prepared,options.currentPlan,failure || 'provider-unavailable');
        if (textOnly) plan.analysis.limitations.push('AI chọn main chưa nhận được hình ảnh hợp lệ; chỉ có bằng chứng văn bản/tín hiệu, chưa xác minh hành động trong video.');
        plan.analysis = { ...plan.analysis, sourceId, analysisKey, cacheKey:key, ...(options.local?.cacheKey ? { localCacheKey:options.local.cacheKey } : {}) };
        validatePlan(plan,source,{teasers:false}); signal.throwIfAborted();
        // Do not perpetually cache auth/rate/timeout failures as a successful AI result.
        if (plan.analysis.method === 'ai') await cache.put(key,plan);
        return plan;
      }),options.signal);
      const plan = structuredClone(result);
      lockedParts(options.currentPlan).forEach((locked,i) => { if(locked) plan.parts[i] = structuredClone(options.currentPlan.parts[i]); });
      plan.analysis.sourceId = source.id; assertMainLocks(plan,options.currentPlan); return plan;
    },
  };
}
