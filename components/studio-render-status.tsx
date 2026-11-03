'use client';
import {useId} from 'react';
import type {ReactNode} from 'react';
import {Download,Loader2,Square} from 'lucide-react';
import {RenderProgress} from './render-progress';
type Job={id:string;state:string;progress:number;currentPart:number|null;error:string|null;resourceNotice?:string;phase?:string|null;startedAt?:string;attempt?:number;stopping?:boolean;outputs:{part:number;filename:string;url:string}[]};
export function StudioRenderStatus({timelineNotice,timelineDraftInvalid=false,job,submitting,canRender,hasPlan,blockedReason,validation,issues,stopping,worker,onRender,onCancel,onPart,busy}: {timelineNotice?:ReactNode;timelineDraftInvalid?:boolean;job:Job|null;submitting:boolean;canRender:boolean;hasPlan:boolean;blockedReason:string;validation:string;issues:{partId:number;reason:string}[];stopping:boolean;worker:string;onRender:()=>void;onCancel:()=>void;onPart:(id:number)=>void;busy:boolean}){
 const reasonId=useId();
 const cancelling=Boolean(job&&(stopping||job.stopping)&&['queued','rendering','cancelled'].includes(job.state));
 const running=Boolean(job&&(['queued','rendering'].includes(job.state)||cancelling));
 const reason=blockedReason||(!timelineDraftInvalid?validation:'')||(issues[0]?`Part ${issues[0].partId}: ${issues[0].reason}`:'')||(!hasPlan?'Chuẩn bị nguồn rồi Phân tích':'');
 return <>
  <div className="studio-render-state" role={running?undefined:'status'}>
   {timelineNotice}
   {submitting?<span><Loader2 size={13} className="animate-spin" aria-hidden="true"/>Đang gửi job…</span>:running&&job?<RenderProgress job={{...job,stopping:cancelling}} compact/>:reason?<details className={hasPlan?'studio-warning':'studio-muted'}><summary>{hasPlan?'Cần kiểm tra trước khi xuất':'Chưa có bản cắt'}</summary><p>{reason}</p></details>:job?.state==='error'?<span role="alert" className="studio-danger">Render lỗi · xem Chi tiết</span>:job?.state==='cancelled'?<span>Đã hủy</span>:job?.state==='done'?<span className="studio-connected">Hoàn tất</span>:<span className="studio-muted">Sẵn sàng xuất 2 MP4</span>}
   {job?.state==='error'&&<details className="studio-render-error-details"><summary>Chi tiết lỗi render</summary><p className="studio-danger">{job.error||'Render lỗi'}</p></details>}
   {!!issues.length&&hasPlan&&!running&&<span className="studio-part-fixes">{issues.map(issue=><button type="button" key={issue.partId} onClick={()=>onPart(issue.partId)} title={issue.reason}>Sửa Part {issue.partId}</button>)}</span>}
   {job?.resourceNotice&&<span className="studio-resource-notice" title={job.resourceNotice}>{job.resourceNotice}</span>}
   {busy&&<span className="studio-muted">Render chạy nền · editor vẫn dùng được</span>}
   {job?.outputs.map(output=><a key={output.part} title={output.filename} href={worker+output.url}><Download size={12}/>Part {output.part}</a>)}
  </div>
  {running&&<button type="button" className="studio-cancel" disabled={cancelling} onClick={onCancel}><Square size={13} aria-hidden="true"/>{cancelling?'Đang dừng…':'Hủy'}</button>}
  {!canRender&&reason&&<span id={reasonId} className="studio-render-disabled-reason studio-muted">{reason}</span>}
  <button type="button" aria-describedby={!canRender?reasonId:undefined} className="studio-primary studio-render-button" title={cancelling?'Chờ render dừng hẳn':!canRender?reason||'Chờ tác vụ đang xử lý':'Xuất effective plan đã hợp lệ'} disabled={!canRender||cancelling} onClick={onRender}>Render 2 MP4</button>
 </>;
}
