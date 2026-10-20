'use client';
import {Cloud,CloudOff,Save,Film,LayoutGrid,FolderOpen} from 'lucide-react';
import {useState} from 'react';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import type {ReactNode} from 'react';
export type SaveState='idle'|'restoring'|'saving'|'saved'|'error';
export function StudioHeader({workspace,onWorkspace,workerReady,providerLabel,providerReady,saveState,saveMessage,onNewSession,ready}:{workspace:'editor'|'batch'|'storage';onWorkspace:(value:'editor'|'batch'|'storage')=>void;workerReady:boolean;providerLabel:string;providerReady:boolean;saveState:SaveState;saveMessage:string;onNewSession:()=>void;ready:boolean}){
 const [confirmNew,setConfirmNew]=useState(false);
 const tabs:{id:'editor'|'batch'|'storage';label:string;icon:ReactNode}[]=[{id:'editor',label:'Editor',icon:<Film size={14}/>},{id:'batch',label:'Batch',icon:<LayoutGrid size={14}/>},{id:'storage',label:'Kho video',icon:<FolderOpen size={14}/>}];
 return <header className="studio-header">
  <strong className="studio-brand"><b aria-hidden="true">SC</b> ShortCut Studio <span>DEV M2</span></strong>
  <nav aria-label="Chế độ làm việc" className="studio-workspaces">{tabs.map(tab=><button type="button" key={tab.id} aria-current={workspace===tab.id?'page':undefined} onClick={()=>onWorkspace(tab.id)}>{tab.icon}{tab.label}</button>)}</nav>
  <div className="studio-header-status">
   <span role="status" title={workerReady?'Media worker đang kết nối':'Media worker chưa kết nối'} className={workerReady?'studio-connected':'studio-warning'}>{workerReady?<Cloud size={13}/>:<CloudOff size={13}/>}<span>{workerReady?'Worker OK':'Offline'}</span></span>
   <span className={providerReady?'studio-connected':'studio-warning'} title="Trạng thái cấu hình/đăng nhập; không đồng nghĩa đã kiểm chứng inference.">{providerLabel}</span>
   <span role="status" className={saveState==='error'?'studio-danger':saveState==='saving'||saveState==='restoring'?'studio-warning':'studio-muted'} title={saveMessage}><Save size={12}/>{saveState==='saved'?'Đã lưu':saveState==='saving'?'Đang lưu…':saveState==='restoring'?'Khôi phục…':saveState==='error'?'Lỗi lưu':'Chưa có bản nháp'}</span>
   <Popover open={confirmNew} onOpenChange={setConfirmNew}><PopoverTrigger asChild><button type="button" disabled={!ready}>Phiên mới</button></PopoverTrigger><PopoverContent align="end" className="studio-new-session-popover"><p className="font-semibold">Tạo phiên mới?</p><p className="mt-2 text-xs">Bỏ bản nháp đang chỉnh. Giữ video nguồn, nhạc, MP4 đã xuất và job worker.</p><div className="mt-3 flex justify-end gap-2"><button type="button" className="studio-ghost" onClick={()=>setConfirmNew(false)}>Hủy</button><button type="button" className="studio-primary" onClick={()=>{setConfirmNew(false);onNewSession();}}>Bỏ nháp & tạo mới</button></div></PopoverContent></Popover>
  </div>
 </header>;
}
