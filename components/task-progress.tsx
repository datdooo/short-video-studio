'use client';

import {useEffect,useState} from 'react';
export type TaskState='running'|'done'|'error'|'cancelled'|'waiting';
// Percentage belongs to the named step, unless scope explicitly says total.
// A running task never claims completion before its owner validates/persists it.
export function TaskProgress({label,percent,estimated=false,scope='bước',state='running',startedAt,detail,compact=false}:{
 label:string;percent?:number|null;estimated?:boolean;scope?:'bước'|'toàn tác vụ'|'item kết thúc';state?:TaskState;startedAt?:number;detail?:string;compact?:boolean;
}){
 const started=typeof startedAt==='number'&&Number.isFinite(startedAt)&&startedAt>0?startedAt:undefined;
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(state!=='running'||!started)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[state,started]);
 const measured=typeof percent==='number'&&Number.isFinite(percent);
 const value=state==='done'?100:measured?Math.max(0,Math.min(99,Math.floor(percent))):null;
 return <div className={`studio-task-progress${compact?' studio-task-progress-compact':''}`} role="status" aria-live="polite" aria-busy={state==='running'}>
  <div className="studio-task-progress-label"><span>{label}{value!==null&&<small className="studio-task-progress-scope"> · {scope}</small>}</span><span className="studio-task-progress-value">{value!==null?`${estimated?'≈ ':''}${value}%`:state==='running'&&started?`${Math.max(0,Math.floor((now-started)/1000))}s`:''}</span></div>
  {value!==null&&<progress max={100} value={value} aria-label={`${label} · ${scope}${estimated?' · ước tính':''}`}/>}
  {detail&&<p className="studio-muted">{detail}</p>}
 </div>;
}
