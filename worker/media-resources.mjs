import {AsyncLocalStorage} from 'node:async_hooks';
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
// Explicit before EVERY input, not just the first decoder. No quality change.
export function balancedFfmpegArgs(args){
 const result=['-nostdin','-filter_threads','1','-filter_complex_threads','1'];
 for(const arg of args){if(arg==='-i')result.push('-threads','2','-thread_queue_size','8');result.push(arg);}
 return result;
}
