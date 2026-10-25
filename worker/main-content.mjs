import {CONTENT_LANGUAGE_VERSION,sourceContentLanguage,contentLanguageSchema,assertContentLanguage} from '../lib/content-language.mjs';
import {collectTeaserEvidence} from '../lib/teaser-evidence.mjs';
import {mainInstruction,MAIN_EDITING_VERSION} from '../lib/main-instructions.mjs';
import {measureAiStage,aiEvent} from './ai-operation.mjs';
import { normalizeLocalSignals } from '../lib/auto-cut/local-signals.mjs';
import { createHash } from 'node:crypto';
import { generateMainCandidates, selectionToPlan, MAIN_SCHEMA, MAIN_INSTRUCTIONS, modelSelectionInput, lockedParts, assertMainLocks } from '../lib/auto-cut/main-content.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { createAnalysisCache } from './analysis-cache.mjs';
import { validatePlan } from './plan-validation.mjs';
import { hookFailure,hookFailureNotice } from './teaser-selection.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createMainContentSelector({ cacheRoot, resolveProvider, fingerprint, protectedKeys }) {
  const cache = createAnalysisCache(cacheRoot, { protectedKeys }), shared = createSharedOperations({onJoin:()=>aiEvent('cache',{joined:true,reason:'shared-in-flight'})});
  async function prepare(source, context, options = {}) {
    options.signal?.throwIfAborted();
    const digest = await fingerprint(source, options.signal);
    const input = generateMainCandidates(source, context, { ...options, localSourceKey:digest, ...(options.local ? { local:normalizeLocalSignals(options.local,{duration:source.duration,sourceKey:digest}) } : {}) });
    const rawInstruction=String(options.instruction||'');input.rawInstruction=rawInstruction;input.instruction=mainInstruction(rawInstruction).text;input.supplementalPrompt=String(options.supplementalPrompt||'');
    input.duration=source.duration;input.sourceTitle=source.title;input.sourceLanguage=sourceContentLanguage(source)||'und';input.languagePolicy=CONTENT_LANGUAGE_VERSION;
    const track=options.captionTrack,captionProvenance={origin:track?.origin||'unknown',timing:track?.timing||'cue',language:track?.language||'unknown',trackId:track?.trackId||null,warning:track?.warning||null};
    input.sourceEvidence=collectTeaserEvidence({id:0,title:source.title,hook:'Toàn video để biên tập main',segments:[{start:0,end:source.duration}]},{...source,sourceContext:context,captionProvenance,transcript:String(options.transcript??source.transcript??'')},options.cues||[],{instruction:input.instruction,supplementalPrompt:input.supplementalPrompt,fullOnly:true}).full;
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
      const schema={...MAIN_SCHEMA,properties:{...MAIN_SCHEMA.properties,language:contentLanguageSchema(prepared.sourceLanguage)}};
      const key = hash({ explanationLanguage:'vi-v1',analysisKey, provider: provider?.id || 'none', model: provider?.model || 'none', reasoningPolicy:provider?.reasoningPolicyKey||'unconfigured', retryVersion:'explicit-only-v1',logicVersion:MAIN_EDITING_VERSION,prompt:MAIN_INSTRUCTIONS,schema });
      const result = await shared(key, signal => cache.using(key, async () => {
        const cached = await cache.get(key);
        if (cached) {
          try { const plan = { ...cached, originalTitle:source.title, analysis:{ ...cached.analysis, sourceId, cacheKey:key } }; assertContentLanguage(plan.language,prepared.sourceLanguage); validatePlan(plan,source,{teasers:false}); assertMainLocks(plan,options.currentPlan); aiEvent('cache',{hit:true}); return plan; } catch { /* Invalid/old cache is not a valid analysis. */ }
        }
        aiEvent('cache',{hit:false});
        let plan, textOnly = false;
        if (provider) {
          const images=[];textOnly=true;
          let localValidation=false;
          try {
            const input={...modelSelectionInput(stableInput),phase:'select-main'};
            const response=await provider.analyze({input,images,schema,instructions:MAIN_INSTRUCTIONS,signal:AbortSignal.any([signal,AbortSignal.timeout(90000)]),maxTokens:3600});
            localValidation=true;
            plan=await measureAiStage('validation',()=>{
              const next=selectionToPlan(prepared,response.value,{currentPlan:options.currentPlan,provider:provider.id,model:provider.model});
              validatePlan(next,source,{teasers:false});return next;
            });
          } catch(e) {
            signal.throwIfAborted();if(e.code==='INPUT_TEXT_TOO_LARGE')throw e;
            failure=localValidation?'provider-selection-rejected':hookFailure(e);
            aiEvent('error',{reason:localValidation?'MAIN_PLAN_VALIDATION_FAILED':failure});
            // Technical failure is user-visible, never a second paid request.
            if(localValidation)throw Object.assign(Error(`Main chưa hợp lệ: ${String(e.message||'Sai range/schema').slice(0,240)}. Plan hiện tại được giữ; không tự gọi sửa.`),{code:'MAIN_PLAN_VALIDATION_FAILED'});
          }
        }
        if(!plan&&options.currentPlan&&failure)throw Object.assign(Error(hookFailureNotice(failure)),{code:failure});
        if(!plan)throw Object.assign(Error('Chưa có main được AI biên tập. '+hookFailureNotice(failure||'provider-unavailable')),{code:failure||'MAIN_SELECTION_UNAVAILABLE'});
        if (textOnly) plan.analysis.limitations.push('MAIN chỉ dùng text/tín hiệu số; không gửi ảnh/video/audio, chưa xác minh hành động bằng thị giác.');
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
