'use client';

import {useEffect,useId,useState} from 'react';
export type TaskState='running'|'done'|'error'|'cancelled'|'waiting';
// Percentage belongs to the named step, unless scope explicitly says total.
// A running task never claims completion before its owner validates/persists it.
export function TaskProgress({label,percent,estimated=false,scope='bước',state='running',startedAt,detail,compact=false,indeterminate=false}:{
 label:string;percent?:number|null;estimated?:boolean;scope?:'bước'|'toàn tác vụ'|'item kết thúc';state?:TaskState;startedAt?:number;detail?:string;compact?:boolean;indeterminate?:boolean;
}){
 const labelId=useId();
 const detailId=useId();
 const started=typeof startedAt==='number'&&Number.isFinite(startedAt)&&startedAt>0?startedAt:undefined;
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(state!=='running'||!started)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[state,started]);
 const measured=typeof percent==='number'&&Number.isFinite(percent);
 const value=state==='done'?100:measured?Math.max(0,Math.min(99,Math.floor(percent))):null;
 const elapsed=state==='running'&&started?Math.max(0,Math.floor((now-started)/1000)):null;
 return <div className={`studio-task-progress${compact?' studio-task-progress-compact':''}`} data-task-state={state}>
  <div className="studio-task-progress-label"><span id={labelId} role="status" aria-atomic="true">{label}{value!==null&&<small className="studio-task-progress-scope"> · {scope}{estimated?' · ước tính':''}</small>}</span><span className="studio-task-progress-value" aria-hidden="true">{value!==null?`${estimated?'≈ ':''}${value}%`:elapsed!==null?`${elapsed}s`:''}</span></div>
  {(value!==null||indeterminate&&state==='running')&&<progress max={100} value={value??undefined} aria-labelledby={labelId} aria-describedby={detail?detailId:undefined} aria-valuetext={value===null?'Đang xử lý, chưa xác định phần trăm':`${value}% ${scope}${estimated?' · ước tính':''}`}/>}
  {detail&&<p id={detailId} className="studio-muted">{detail}</p>}
 </div>;
}
