import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
const context=new AsyncLocalStorage();
const stages=new Set(['preparation','discovery','frames','provider','reading','validation','retry','cache','complete','error','cancelled']);
function details(value={}){
 const result={};
 for(const key of ['partId','count','requested','reused','extracted','cacheMisses','durationMs','attempt','maxAttempts'])if(Number.isFinite(value[key]))result[key]=value[key];
 for(const key of ['hit','joined','combined'])if(typeof value[key]==='boolean')result[key]=value[key];
 for(const key of ['reason','cache'])if(typeof value[key]==='string'&&/^[a-zA-Z0-9:_.,+ -]{1,120}$/.test(value[key]))result[key]=value[key];
 return result;
}
function snapshot(s){return {id:s.id,kind:s.kind,stage:s.stage,startedAt:s.startedAt,elapsedMs:Math.round(performance.now()-s.start),requestCount:s.requests.length,requests:structuredClone(s.requests),events:structuredClone(s.events)};}
function publish(s){if(!s.live)return;try{s.observer?.(snapshot(s));}catch{/* Observer does not own shared work. */}}
export function aiEvent(stage,detail={}){const s=context.getStore();if(!s?.live||!stages.has(stage))return;s.stage=stage;s.events.push({stage,elapsedMs:Math.round(performance.now()-s.start),...details(detail)});if(s.events.length>160)s.events.shift();publish(s);}
export async function measureAiStage(stage,work,detail){const start=performance.now();aiEvent(stage,detail);try{return await work();}finally{aiEvent(stage,{...detail,durationMs:Math.round(performance.now()-start)});}}
export function aiMemo(key,create){const s=context.getStore();if(!s?.live)return create();if(!s.memo.has(key))s.memo.set(key,Promise.resolve().then(create));return s.memo.get(key);}
export function beginAiRequest(model,reasoning,metrics={}){
 const s=context.getStore();if(!s?.live)return()=>{};
 const row={model:String(model).slice(0,100),requestedReasoning:reasoning.effort,reasoningSource:reasoning.source,actualReasoning:null,status:'pending'};
 if(metrics.requestedServiceTier==='fast'){row.requestedServiceTier='fast';row.actualServiceTier=null;}
 if(typeof metrics.phase==='string'&&/^[a-z-]{1,48}$/.test(metrics.phase))row.phase=metrics.phase;
 if(typeof metrics.inputFormat==='string'&&/^[a-z0-9-]{1,48}$/.test(metrics.inputFormat))row.inputFormat=metrics.inputFormat;
 for(const key of ['inputCharacters','rawInputCharacters','imageCount','partCount'])if(Number.isFinite(metrics[key])&&metrics[key]>=0)row[key]=metrics[key];
 s.requests.push(row);publish(s);
 return values=>{Object.assign(row,values);publish(s);
  // A remaining shared consumer may receive completion after this operation's
  // original observer cancelled. Retain safe usage at the actual terminal point.
  if(values.status&&values.status!=='pending')console.info('AI_REQUEST',JSON.stringify({operationId:s.id,...row}));
 };
}
export function safeUsage(usage){if(!usage||typeof usage!=='object')return undefined;const result={};for(const key of ['input_tokens','output_tokens','total_tokens'])if(Number.isFinite(usage[key]))result[key]=usage[key];for(const [key,field] of [['cached_tokens','input_tokens_details'],['reasoning_tokens','output_tokens_details']])if(Number.isFinite(usage[field]?.[key]))result[key]=usage[field][key];return result;}
export async function withAiOperation(kind,work,observer){
 if(context.getStore()?.live)return work();
 const s={id:randomUUID(),kind,start:performance.now(),startedAt:Date.now(),stage:'preparation',requests:[],events:[],memo:new Map(),observer,live:true};
 return context.run(s,async()=>{aiEvent('preparation');try{const result=await work();aiEvent('complete');return {...result,diagnostics:snapshot(s)};}catch(error){aiEvent(error?.name==='AbortError'||/cancel|huỷ|hủy/i.test(error?.message||'')?'cancelled':'error');error.diagnostics=snapshot(s);throw error;}finally{s.live=false;s.memo.clear();console.info('AI_OPERATION',JSON.stringify(snapshot(s)));}});
}
