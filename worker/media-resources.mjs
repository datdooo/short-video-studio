import {AsyncLocalStorage} from 'node:async_hooks';
import {availableParallelism} from 'node:os';
// Only the final export graph opts into this bounded pool. Decoder/encoder
// limits and the independent, serial editor lane stay unchanged.
// Half the cores, 2..4: measured on an 8-core M2 (same graph, nice 10): 2 threads 66 s, 4 threads 50 s,
// 8 threads no better. The render still runs at lowered priority, so the editor stays responsive.
export const RENDER_FILTER_COMPLEX_THREADS=Math.min(4,Math.max(2,Math.floor(availableParallelism()/2)));
export const RENDER_INPUT_THREADS=RENDER_FILTER_COMPLEX_THREADS;
export const RENDER_RESOURCE_PROFILE='balanced-m2-editor-v4';
// One worker-owned heavy lease, including child processes and CPU VAD. Export
// requests outrank background work and cancel only disposable audio previews.
export function createMediaResources({maxWaiting=Infinity}={}){
 const context=new AsyncLocalStorage(),queue=[];let active=null;
 function pump(){
  if(active)return;
  queue.sort((a,b)=>Number(b.kind==='render')-Number(a.kind==='render'));
  const task=queue.shift();if(!task)return;
  if(task.signal?.aborted){task.remove();task.reject(task.signal.reason);pump();return;}
  const lease={kind:task.kind,controller:new AbortController(),live:true};active=lease;
  const abort=()=>lease.controller.abort(task.signal.reason);task.signal?.addEventListener('abort',abort,{once:true});task.remove();
  if(task.signal?.aborted)abort();
  context.run(lease,async()=>{try{lease.controller.signal.throwIfAborted();task.resolve(await task.work(lease.controller.signal));}catch(error){task.reject(error);}finally{lease.live=false;task.signal?.removeEventListener('abort',abort);active=null;pump();}});
 }
 return{
  ownsLease:()=>Boolean(context.getStore()?.live),
  currentKind:()=>{const lease=context.getStore();return lease?.live?lease.kind:undefined;},
  currentSignal:()=>{const lease=context.getStore();return lease?.live?lease.controller.signal:undefined;},
  pausePreviews(){if(active?.kind==='preview')active.controller.abort(new Error('Audio preview tạm dừng để ưu tiên export.'));for(let i=queue.length-1;i>=0;i--)if(queue[i].kind==='preview'){const [task]=queue.splice(i,1);task.remove();task.reject(new Error('Audio preview tạm dừng để ưu tiên export.'));}},
  state:()=>({active:active?.kind||null,waiting:queue.length,renderBusy:active?.kind==='render'||queue.some(t=>t.kind==='render'),profile:'balanced-m2-v1',decodeThreads:2,filterThreads:1,encodeThreads:2}),
  use(kind,work,signal){
   signal?.throwIfAborted();const inherited=context.getStore();
   if(inherited?.live){const combined=signal?AbortSignal.any([signal,inherited.controller.signal]):inherited.controller.signal;combined.throwIfAborted();return work(combined);}
   if(kind==='render'&&active?.kind==='preview')active.controller.abort(new Error('Audio preview tạm dừng để ưu tiên export.'));
   // One reserved priority slot lets the current export finish validation even
   // when background metadata callers have filled a bounded queue.
   if(queue.length>=maxWaiting&&(kind!=='render'||queue.some(task=>task.kind==='render')))return Promise.reject(Object.assign(new Error('Hàng đợi tài nguyên đã đầy. Thử lại sau.'),{code:'MEDIA_QUEUE_FULL'}));
   return new Promise((resolve,reject)=>{const task={kind,work,signal,resolve,reject};const abort=()=>{const i=queue.indexOf(task);if(i>=0){queue.splice(i,1);task.remove();reject(signal.reason);}};task.remove=()=>signal?.removeEventListener('abort',abort);signal?.addEventListener('abort',abort,{once:true});queue.push(task);pump();});
  }
 };
}
// A single export can coexist with ONE bounded editor media task. Nested tool
// calls retain the owning lane; preview cancellation never cancels an export.
export function createEditorMediaResources(){
 const exports=createMediaResources(),editor=createMediaResources({maxWaiting:64});
 const owner=()=>exports.ownsLease()?exports:editor.ownsLease()?editor:undefined;
 return{
  ownsLease:()=>Boolean(owner()),
  currentSignal:()=>owner()?.currentSignal(),
  currentKind:()=>owner()?.currentKind(),
  commandState:()=>owner()?.state()||editor.state(),
  state(){const e=exports.state(),i=editor.state();return{...e,active:e.active||i.active,waiting:e.waiting+i.waiting,profile:RENDER_RESOURCE_PROFILE,renderFilterComplexThreads:RENDER_FILTER_COMPLEX_THREADS,renderInputThreads:RENDER_INPUT_THREADS,editorActive:i.active,editorWaiting:i.waiting};},
  use(kind,work,signal){if(kind==='render')return exports.use(kind,work,signal);return(owner()||editor).use(kind,work,signal);},
 };
}
// Explicit before EVERY input, not just the first decoder. No quality change.
export function balancedFfmpegArgs(args,{filterComplexThreads=1,inputThreads=2}={}){
 // Do not allow an unbounded/auto pool or change preview/ASR defaults.
 const complexThreads=filterComplexThreads===RENDER_FILTER_COMPLEX_THREADS?RENDER_FILTER_COMPLEX_THREADS:1;
 const decodeThreads=inputThreads===RENDER_INPUT_THREADS?RENDER_INPUT_THREADS:2;
 const result=['-nostdin','-filter_threads','1','-filter_complex_threads',String(complexThreads)];
 for(const arg of args){if(arg==='-i')result.push('-threads',String(decodeThreads),'-thread_queue_size','8');result.push(arg);}
 return result;
}
