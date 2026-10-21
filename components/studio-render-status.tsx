'use client';
import {Download,Loader2,Square} from 'lucide-react';
type Job={id:string;state:string;progress:number;currentPart:number|null;error:string|null;resourceNotice?:string;outputs:{part:number;filename:string;url:string}[]};
export function StudioRenderStatus({job,submitting,canRender,hasPlan,blockedReason,validation,issues,stopping,worker,onRender,onCancel,onPart,hold,busy}:{job:Job|null;submitting:boolean;canRender:boolean;hasPlan:boolean;blockedReason:string;validation:string;issues:{partId:number;reason:string}[];stopping:boolean;worker:string;onRender:()=>void;onCancel:()=>void;onPart:(id:number)=>void;hold:boolean;busy:boolean}){
 const running=job&&['queued','rendering'].includes(job.state),percent=job?Math.max(0,Math.min(100,Number.isFinite(job.progress)?job.progress:0)):0;
 const reason=blockedReason||validation||(issues[0]?`Part ${issues[0].partId}: ${issues[0].reason}`:'')||(!hasPlan?'Chuẩn bị nguồn rồi Phân tích':'');
 return <>
  <div className="studio-render-state" role="status">
   {submitting?<span><Loader2 size={13} className="animate-spin"/>Đang gửi job…</span>:running?<><span>{job.state==='queued'?'Đang chờ / chuẩn bị':`Đang render Part ${job.currentPart||1}`} · {percent}%</span><progress aria-label="Tiến độ render thật" value={percent} max={100}/></>:reason?<span className={hasPlan?'studio-warning':'studio-muted'}>{reason}</span>:job?.state==='error'?<span role="alert" className="studio-danger">{job.error||'Render lỗi'}</span>:job?.state==='cancelled'?<span>Đã hủy</span>:job?.state==='done'?<span className="studio-connected">Hoàn tất</span>:<span className="studio-muted">Sẵn sàng xuất 2 MP4</span>}
   {reason&&job?.state==='error'&&<span role="alert" className="studio-danger">{job.error||'Render lỗi'}</span>}
   {!!issues.length&&hasPlan&&!running&&<span className="studio-part-fixes">{issues.map(issue=><button type="button" key={issue.partId} onClick={()=>onPart(issue.partId)} title={issue.reason}>Sửa Part {issue.partId}</button>)}</span>}
   {job?.resourceNotice&&<span className="studio-resource-notice" title={job.resourceNotice}>{job.resourceNotice}</span>}
   {busy&&<span className="studio-muted">Preview/nhạc tạm dừng</span>}
   {!busy&&hold&&<span className="studio-muted">Bấm Play để tiếp tục preview</span>}
   {job?.outputs.map(output=><a key={output.part} title={output.filename} href={worker+output.url}><Download size={12}/>Part {output.part}</a>)}
  </div>
  {running&&<button type="button" className="studio-cancel" disabled={stopping} onClick={onCancel}><Square size={13}/>{stopping?'Đang dừng…':'Hủy'}</button>}
  <button type="button" className="studio-primary studio-render-button" title={!canRender?reason||'Chờ tác vụ đang xử lý':'Xuất effective plan đã hợp lệ'} disabled={!canRender} onClick={onRender}>Render 2 MP4</button>
 </>;
}
