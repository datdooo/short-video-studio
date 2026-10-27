export type ManualVideoProgress={phase:string;state:'running'|'done'|'error'|'cancelled';percent:number|null;completedBytes?:number;totalBytes?:number;bytesPerSecond?:number;etaSeconds?:number;error?:string;errorCode?:string};
const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;
function progress(value:unknown):ManualVideoProgress {
 if(!value||typeof value!=='object')throw Error('Không đọc được tiến trình tải video.');
 const raw=value as Record<string,unknown>;
 if(!['running','done','error','cancelled'].includes(String(raw.state)))throw Error('Trạng thái tải video chưa hợp lệ.');
 return {phase:typeof raw.phase==='string'?raw.phase:'identity',state:raw.state as ManualVideoProgress['state'],percent:number(raw.percent)??null,
  ...Object.fromEntries(['completedBytes','totalBytes','bytesPerSecond','etaSeconds'].flatMap(key=>number(raw[key])===undefined?[]:[[key,number(raw[key])]])),
  ...(typeof raw.error==='string'?{error:raw.error.slice(0,1200)}:{}),...(typeof raw.errorCode==='string'&&/^[A-Z0-9_]{1,80}$/.test(raw.errorCode)?{errorCode:raw.errorCode}:{})};
}
function pause(signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 signal.throwIfAborted();const abort=()=>{clearTimeout(timer);reject(signal.reason);};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},700);signal.addEventListener('abort',abort,{once:true});
});}
// Keep the browser's native download stream: no full-video Blob/ArrayBuffer in
// the Editor heap. Polling observes one existing request; it never starts a job.
export async function downloadManualVideo({worker,sourceId,sourceKey,variantKey,signal,onProgress}:{worker:string;sourceId:string;sourceKey?:string;variantKey?:string;signal:AbortSignal;onProgress:(value:ManualVideoProgress)=>void}) {
 signal.throwIfAborted();
 const id=crypto.randomUUID(),base=`${worker}/api/sources/${encodeURIComponent(sourceId)}`;
 const status=`${base}/manual-video-status/${id}`,params=new URLSearchParams({downloadId:id});
 if(sourceKey)params.set('source',sourceKey);else if(variantKey)params.set('variant',variantKey);
 const frame=document.createElement('iframe');frame.hidden=true;frame.tabIndex=-1;frame.setAttribute('aria-hidden','true');frame.title='Tải video phân tích';
 let completed=false,terminal=false,cancelSent=false;
 const cancel=()=>{if(cancelSent)return;cancelSent=true;void fetch(status,{method:'DELETE',keepalive:true}).catch(()=>{});frame.remove();};
 signal.addEventListener('abort',cancel,{once:true});
 try{
  signal.throwIfAborted();frame.src=`${base}/manual-video?${params}`;document.body.appendChild(frame);
  const started=Date.now();let seen=false,failures=0;
  while(true){
   signal.throwIfAborted();
   if(Date.now()-started>25*60_000)throw Error('Chưa hoàn tất tải video; đã dừng lượt chờ này.');
   let response:Response;
   try{response=await fetch(status,{signal,cache:'no-store'});failures=0;}
   catch(error){signal.throwIfAborted();if(++failures>=3)throw Error('Mất kết nối tiến trình tải video.');await pause(signal);continue;}
   if(response.status===404){if(seen||Date.now()-started>10000)throw Error('Trình duyệt chưa bắt đầu tải video hoặc worker đã khởi động lại.');await pause(signal);continue;}
   const data=await response.json() as {progress?:unknown;error?:string};
   if(!response.ok)throw Error(data.error||'Không theo dõi được lượt tải video.');
   const next=progress(data.progress);seen=true;onProgress(next);
   if(next.state==='done'){completed=true;return;}
   if(next.state==='error'){terminal=true;throw Error((next.error||'Tải video chưa hoàn tất.')+(next.errorCode?` (${next.errorCode})`:''));}
   if(next.state==='cancelled'){terminal=true;throw new DOMException('Đã dừng tải video.','AbortError');}
   await pause(signal);
  }
 }finally{signal.removeEventListener('abort',cancel);if(!completed&&!terminal)cancel();frame.remove();}
}
