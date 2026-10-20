import { normalizeLocalSignals } from '../lib/auto-cut/local-signals.mjs';
import { createHash } from 'node:crypto';
import { generateMainCandidates, deterministicMainSelection, selectionToPlan, MAIN_SCHEMA, MAIN_INSTRUCTIONS, modelSelectionInput, lockedParts, assertMainLocks } from '../lib/auto-cut/main-content.mjs';
import { createSharedOperations } from './shared-operation.mjs';
import { createAnalysisCache } from './analysis-cache.mjs';
import { validatePlan } from './plan-validation.mjs';
import { hookFailure } from './teaser-selection.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createMainContentSelector({ cacheRoot, resolveProvider, fingerprint, frames, protectedKeys }) {
  const cache = createAnalysisCache(cacheRoot, { protectedKeys }), shared = createSharedOperations();
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
        const plan = structuredClone(options.currentPlan); validatePlan(plan, source); return plan;
      }
      const prepared = await prepare(source, context, options);
      let provider, failure;
      try { provider = await resolveProvider(options.signal); } catch (e) { options.signal?.throwIfAborted(); failure = hookFailure(e); }
      const { sourceId, analysisKey, ...stableInput } = prepared;
      const key = hash({ explanationLanguage:'vi-v1',analysisKey, provider: provider?.id || 'none', model: provider?.model || 'none' });
      const result = await shared(key, signal => cache.using(key, async () => {
        const cached = await cache.get(key);
        if (cached) {
          try { const plan = { ...cached, originalTitle:source.title, analysis:{ ...cached.analysis, sourceId, cacheKey:key } }; validatePlan(plan,source); assertMainLocks(plan,options.currentPlan); return plan; } catch { /* Invalid/old cache is not a valid analysis. */ }
        }
        let plan, textOnly = false;
        if (provider) {
          const bounded = AbortSignal.any([signal, AbortSignal.timeout(90000)]);
          let images = [];
          try { images = frames ? await frames({ segments:[{start:0,end:source.duration}] },source,bounded) : []; }
          catch { bounded.throwIfAborted(); /* Optional sparse images; text still works. */ }
          textOnly = !images.length;
          for (let attempt=0; attempt<2; attempt++) {
            try {
              const response = await provider.analyze({ input:modelSelectionInput(stableInput), images: attempt ? [] : images, schema:MAIN_SCHEMA, instructions:MAIN_INSTRUCTIONS, signal:bounded, maxTokens:2400 });
              textOnly ||= Boolean(attempt);
              plan = selectionToPlan(prepared,response.value,{ currentPlan:options.currentPlan,provider:provider.id,model:provider.model });
              validatePlan(plan,source); break;
            } catch (e) {
              signal.throwIfAborted(); failure = hookFailure(e);
              if (bounded.aborted || /auth|rate-limited|model-unavailable/.test(failure)) break;
            }
          }
        }
        if (!plan) plan = deterministicMainSelection(prepared,options.currentPlan,failure || 'provider-unavailable');
        if (textOnly) plan.analysis.limitations.push('AI chọn main chưa nhận được hình ảnh hợp lệ; chỉ có bằng chứng văn bản/tín hiệu, chưa xác minh hành động trong video.');
        plan.analysis = { ...plan.analysis, sourceId, analysisKey, cacheKey:key, ...(options.local?.cacheKey ? { localCacheKey:options.local.cacheKey } : {}) };
        validatePlan(plan,source); signal.throwIfAborted();
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
