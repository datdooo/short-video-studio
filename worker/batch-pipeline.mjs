import {randomUUID} from 'node:crypto';
import {snapshotPlanVisualStyle} from '../lib/visual-style/normalize.mjs';
import {validatePlan} from './plan-validation.mjs';
// Existing FIFO calls this processor; one link's error cannot mutate another plan.
export function createBatchProcessor({acquire,load,analyze,render,resumeRender,getJob,persist,createId=randomUUID}) {
  return async function prepare(batch,_body,items,signal){
    let authBlocked=false;
    for(const item of items){
      if(item.deleted)continue;
      if(signal.aborted){if(!item.jobId)item.state='cancelled';continue;}
      const settings=item.settings||_body;
      if(authBlocked&&settings.provider==='chatgpt'){item.state='paused';item.error='Reconnect ChatGPT, then explicitly resume this item.';item.errorCode='auth-required';await persist();continue;}
      try{
        let source;
        if(item.sourceId)source=await load(item.sourceId); // A missing saved source needs user action; never redownload it silently.
        else{item.state='downloading';await persist();source=await acquire(item.url,signal);signal.throwIfAborted();item.sourceId=source.id;item.title=source.title;item.checkpoint='source';await persist();}
        if(item.jobId){
          const job=getJob(item.jobId);if(!job)throw new Error('Saved render record missing; inspect outputs before submitting again.');
          if(['error','cancelled'].includes(job.state))await resumeRender(job,signal);
          item.state=job.state;item.error=job.error;await persist();continue;
        }
        if(!item.plan||item.needsAnalysis){
          if(['gemini','muse'].includes(settings.provider)){item.state='awaiting-import';item.error=null;await persist();continue;}
          item.state='analyzing';await persist();
          const result=await analyze(source,{transcript:source.transcript||'',instruction:settings.instruction||'',supplementalPrompt:settings.supplementalPrompt||'',...(item.plan?.parts?.some(p=>p.manualLocked)?{currentPlan:item.plan}:{})},signal);
          signal.throwIfAborted();
          item.plan=snapshotPlanVisualStyle({...result.plan,visualStyle:settings.visualStyle,subtitles:settings.subtitles});
          item.checkpoint='plan';item.needsAnalysis=false;
          if(item.plan.analysis?.method==='deterministic-fallback'){
            const reason=item.plan.analysis.fallbackReason||'';item.approved=false;
            if(/auth|rate-limited|model-unavailable/.test(reason)){item.state='error';item.error=`Automatic provider unavailable (${reason}); reconnect/wait and retry explicitly.`;item.errorCode=/auth/.test(reason)?'auth-required':'provider-unavailable';item.needsAnalysis=true;authBlocked=/auth/.test(reason);}
            else{item.state='review-required';item.error='Deterministic fallback: review/approve this plan in the editor before rendering.';}
            await persist();continue;
          }
          item.approved=true;await persist();
        }
        if(item.approved===false){item.state='review-required';await persist();continue;}
        validatePlan(item.plan,source);
        item.state='render-ready';await persist();
        item.submissionId ||= createId();item.submissionProtocol=1;item.state='submitting';await persist();
        const existing=getJob(item.submissionId);
        if(existing){if(['error','cancelled'].includes(existing.state))await resumeRender(existing,signal);item.jobId=existing.id;item.state=existing.state;item.plan=structuredClone(existing.plan);await persist();continue;}
        const job=await render({sourceId:source.id,plan:structuredClone(item.plan),submissionId:item.submissionId},signal);
        item.jobId=job.id;item.plan=structuredClone(job.plan);item.state=job.state;item.error=null;item.checkpoint='render';await persist();
      }catch(error){
        item.state=signal.aborted?'cancelled':'error';item.error=signal.aborted?null:error instanceof Error?error.message:String(error);
        await persist();
      }
    }
  };
}
