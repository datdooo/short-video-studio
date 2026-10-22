// Browser upload telemetry only. No automatic retry, provider change or job creation.
export type UploadMetric={loaded:number;total:number|null;percent:number|null};
export function uploadJson<T>(url:string,body:Blob,{headers={},signal,onProgress,onTransferred}:{headers?:Record<string,string>;signal?:AbortSignal;onProgress?:(value:UploadMetric)=>void;onTransferred?:()=>void}={}):Promise<T>{
 return new Promise((resolve,reject)=>{
  signal?.throwIfAborted();const xhr=new XMLHttpRequest();let last=0;
  const abort=()=>xhr.abort();
  const cleanup=()=>signal?.removeEventListener('abort',abort);
  xhr.open('POST',url);for(const [key,value]of Object.entries(headers))xhr.setRequestHeader(key,value);
  xhr.upload.onprogress=event=>{const now=performance.now();if(now-last<250&&event.loaded!==event.total)return;last=now;const total=event.lengthComputable&&event.total>0?event.total:null;onProgress?.({loaded:event.loaded,total,percent:total===null?null:event.loaded/total*100});};
  xhr.upload.onload=()=>onTransferred?.();
  xhr.onload=()=>{cleanup();let data:T&{error?:string};try{data=JSON.parse(xhr.responseText);}catch{reject(Error('Phản hồi import không phải JSON hợp lệ.'));return;}if(xhr.status<200||xhr.status>=300){reject(Error(data.error||`Import HTTP ${xhr.status}`));return;}resolve(data);};
  xhr.onerror=()=>{cleanup();reject(Error('Không kết nối được worker khi import.'));};
  xhr.onabort=()=>{cleanup();reject(signal?.reason||new DOMException('Đã dừng import','AbortError'));};
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){cleanup();reject(signal.reason);return;}xhr.send(body);
 });
}
