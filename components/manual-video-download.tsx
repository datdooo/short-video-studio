'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,Loader2,Square,ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {TaskProgress} from './task-progress';
import {downloadManualVideo,type ManualVideoProgress} from '@/lib/manual-video-download';
const phases:Record<string,string>={identity:'Kiểm tra nguồn video',cache:'Kiểm tra video đã chuẩn bị',waiting:'Chờ tài nguyên xử lý video',download:'Tải bản YouTube 480p',converting:'Tạo bản 480p từ video local',validating:'Kiểm tra video 480p',ready:'Video đã sẵn sàng',transferring:'Truyền video về trình duyệt',completed:'Đã truyền video cho trình duyệt',error:'Chưa tải được video',cancelled:'Đã dừng tải video'};
const mib=(n:number)=>(n/1048576).toFixed(1);
export function ManualVideoDownload({worker,sourceId,sourceKey,variantKey,disabled=false}:{worker:string;sourceId:string;sourceKey?:string;variantKey?:string;disabled?:boolean}) {
 const active=useRef<AbortController|null>(null);
 const [task,setTask]=useState<{progress:ManualVideoProgress;startedAt:number}|null>(null);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[worker,sourceId]);
 useEffect(()=>{setTask(null);},[worker,sourceId]);
 useEffect(()=>{if(!task||task.progress.state==='running'||task.progress.state==='error')return;const timer=setTimeout(()=>setTask(null),5000);return()=>clearTimeout(timer);},[task]);
 async function start(rendition:'original'|'480p'='original'){
  if(active.current||disabled||!sourceId)return;
  const controller=new AbortController();active.current=controller;const startedAt=Date.now();
  setTask({startedAt,progress:{phase:'identity',state:'running',percent:null}});
  try{
   await downloadManualVideo({worker,sourceId,sourceKey,variantKey,rendition,signal:controller.signal,onProgress:progress=>{if(active.current===controller)setTask({startedAt,progress});}});
  }catch(error){
   if(active.current===controller)setTask({startedAt,progress:{phase:controller.signal.aborted||error instanceof DOMException&&error.name==='AbortError'?'cancelled':'error',state:controller.signal.aborted||error instanceof DOMException&&error.name==='AbortError'?'cancelled':'error',percent:null,...(!controller.signal.aborted?{error:error instanceof Error?error.message:'Không tải được video.'}:{})}});
  }finally{if(active.current===controller)active.current=null;}
 }
 const value=task?.progress,running=value?.state==='running';
 const detail=value?.completedBytes!==undefined?`${mib(value.completedBytes)}${value.totalBytes?` / ${mib(value.totalBytes)}`:''} MiB${value.bytesPerSecond?` · ${mib(value.bytesPerSecond)} MiB/s`:''}${value.etaSeconds!==undefined?` · còn khoảng ${Math.ceil(value.etaSeconds)}s của bước truyền`:''}`:value?.phase==='completed'?'Trình duyệt quản lý bước lưu tệp.':undefined;
 return <div className="studio-web-download-control">
  <div className="studio-video-download-split">
   <Button type="button" variant="outline" size="action" onClick={()=>void start()} disabled={disabled||running||!sourceId} aria-busy={running} title="Tải đúng video nguồn ở bước chuẩn bị, không nén hoặc tải lại">{running?<Loader2 className="animate-spin"/>:<Download/>}Tải video</Button>
   <DropdownMenu>
    <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="action" disabled={disabled||running||!sourceId} aria-label="Chọn bản video để tải" title="Tùy chọn tải video"><ChevronDown/></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>void start('480p')}><Download/>Tải bản 480p</DropdownMenuItem></DropdownMenuContent>
   </DropdownMenu>
  </div>
  {value&&<><TaskProgress compact indeterminate label={phases[value.phase]||'Chuẩn bị video'} state={value.state==='done'?'done':value.state} percent={value.percent} startedAt={task?.startedAt} detail={detail}/>
   {running&&<Button type="button" size="sm" variant="ghost" onClick={()=>active.current?.abort(new DOMException('Đã dừng tải video.','AbortError'))}><Square/>Dừng tải video</Button>}
   {value.state==='error'&&value.error&&<details className="text-xs"><summary>Chi tiết</summary><p className="studio-muted break-words">{value.error}</p></details>}
  </>}
 </div>;
}
