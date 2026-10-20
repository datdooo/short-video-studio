'use client';
import {Fragment,useEffect,useRef} from 'react';
import {useEditorDraft} from './editor-draft-context';
import type {ReactNode} from 'react';
import type {EditPlan,EditPart} from '@/lib/edit-plan';
import {hookRangeKey} from '@/lib/teaser-hooks.mjs';
import {MAX_MAIN_RANGES,mainRangeRows,inspectMainRanges,rangeTime} from '@/lib/main-ranges.mjs';
import type {MainRangeRow} from '@/lib/main-ranges.mjs';

type Props={active?:boolean;children?:ReactNode;plan:EditPlan;part:EditPart;duration:number;locked:boolean;
 onSeek?:(index:number)=>void;onEdit:(id:number,rows:MainRangeRow[],expectedKey:string)=>void;
 onDraft:(id:number,key:string,invalid:boolean)=>void;
 onLock:(id:number,locked:boolean)=>void;
 onRestore:(id:number)=>void;onInvalidate:()=>void};
export function MainRangesEditor({active=true,plan,part,duration,locked,onEdit,onDraft,onLock,onRestore,onInvalidate,children,onSeek}:Props){
 const key=hookRangeKey(part);
 const[draft,setDraft]=useEditorDraft<{key:string;appliedKey?:string;rows:MainRangeRow[]}|null>(`main-${part.id}`,null,v=>v===null||!!v&&typeof v==='object'&&'key'in v&&typeof v.key==='string'&&'rows'in v&&Array.isArray(v.rows)&&v.rows.length<=MAX_MAIN_RANGES&&v.rows.every(r=>r&&typeof r.start==='string'&&typeof r.end==='string'&&(r.exactStart===undefined||Number.isFinite(r.exactStart))&&(r.exactEnd===undefined||Number.isFinite(r.exactEnd))));
 const ownApplied=useRef<string|null>(null);
 const rows=draft&&(draft.key===key||draft.appliedKey===key||ownApplied.current===key)?draft.rows:mainRangeRows(part);
 const checked=inspectMainRanges(plan,part.id,rows,duration),invalid=Boolean(checked.error||checked.errors.some(Boolean));
 const report=useRef(onDraft);useEffect(()=>{report.current=onDraft;},[onDraft]);
 useEffect(()=>{report.current(part.id,key,invalid);},[part.id,key,invalid]);
 function edit(next:MainRangeRow[]){
   onInvalidate();ownApplied.current=null;
   const result=inspectMainRanges(plan,part.id,next,duration),bad=Boolean(result.error||result.errors.some(Boolean));
   setDraft({key,rows:next,...(!bad?{appliedKey:JSON.stringify(result.ranges.map(r=>[r.start,r.end]))}:{})});
   onDraft(part.id,key,bad);
   if(!bad){ownApplied.current=JSON.stringify(result.ranges.map(r=>[r.start,r.end]));onEdit(part.id,next,key);}
 }
 return <section hidden={!active} className="mt-3 min-w-0 space-y-2" aria-label={`Timeline Part ${part.id}`}>
  {children}
  <h4 className="border-t border-white/10 pt-3 text-xs font-semibold">Nội dung chính <span className="font-normal text-zinc-500">· {part.segments.filter(s=>!s.isPadding).reduce((n,s)=>n+s.end-s.start,0).toFixed(2)}s preview 1×</span></h4>
  <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] gap-1.5 text-xs text-zinc-500" aria-hidden="true"><span>Đoạn</span><span>Bắt đầu</span><span>Kết thúc</span><span/></div>
  {rows.map((row,i)=><Fragment key={i}>
   {i>0&&checked.ranges[i]&&checked.ranges[i-1]&&!checked.errors[i]&&!checked.errors[i-1]&&checked.ranges[i].start>checked.ranges[i-1].end&&<p className="studio-source-gap">Đã loại: {rangeTime(checked.ranges[i-1].end)} → {rangeTime(checked.ranges[i].start)}</p>}
   <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem] items-center gap-1.5">
   <span className="text-xs text-zinc-400">{i+1}</span>
   {(['start','end'] as const).map(boundary=><input key={boundary} aria-label={`Part ${part.id} đoạn ${i+1} ${boundary==='start'?'Bắt đầu':'Kết thúc'}`} aria-invalid={Boolean(checked.errors[i])} aria-describedby={checked.errors[i]?`main-${part.id}-${i}-error`:undefined} inputMode="text" placeholder="00:00:00:00" title="HH:MM:SS:FF · 30 FPS" autoComplete="off" spellCheck={false} className="studio-input w-full min-w-0 px-1.5 py-2 font-mono text-xs" value={row[boundary]} onChange={e=>edit(rows.map((r,j)=>i===j?{...r,[boundary]:e.target.value,[boundary==='start'?'exactStart':'exactEnd']:undefined,timecode:true}:r))}/>)}
   <div className="flex justify-end gap-1">{onSeek&&<button type="button" disabled={invalid} className="studio-ghost" title="Tới đoạn này trong preview 1×" onClick={()=>onSeek(i)}>Xem</button>}<button type="button" aria-label={`Xóa đoạn ${i+1} Part ${part.id}`} title="Xóa đoạn" className="rounded border border-white/15 py-2 text-sm focus-visible:outline-2 focus-visible:outline-white" onClick={()=>edit(rows.filter((_,j)=>j!==i))}>×</button></div>
   {checked.errors[i]&&<p id={`main-${part.id}-${i}-error`} role="alert" className="col-span-4 text-xs text-red-300">{checked.errors[i]}</p>}
  </div></Fragment>)}
  {checked.error&&<p role="alert" className="text-xs text-red-300">{checked.error}</p>}
  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
   <button type="button" disabled={rows.length>=MAX_MAIN_RANGES} className="rounded border border-white/15 px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" onClick={()=>edit([...rows,{start:'',end:'',timecode:true}])}>+ Thêm đoạn</button>
   <label className="flex items-center gap-1.5"><input type="checkbox" checked={locked} onChange={e=>onLock(part.id,e.target.checked)}/>Khóa main</label>
   <button type="button" disabled={!part.aiMainRanges} title={!part.aiMainRanges?'Chưa có bản cắt AI để khôi phục.':undefined} className="rounded border border-white/15 px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" onClick={()=>{setDraft(null);ownApplied.current=null;onDraft(part.id,key,false);onRestore(part.id);}}>Dùng lại bản AI</button>
  </div>
  {invalid&&<p role="alert" className="text-xs text-amber-200">Dòng chưa hợp lệ chưa áp dụng. Sửa hoặc xóa trước khi xuất.</p>}
 </section>;
}
