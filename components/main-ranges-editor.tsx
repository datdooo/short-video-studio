'use client';
import {useEffect,useRef} from 'react';
import {useEditorDraft} from './editor-draft-context';
import type {ReactNode} from 'react';
import type {EditPlan,EditPart} from '@/lib/edit-plan';
import {hookRangeKey} from '@/lib/teaser-hooks.mjs';
import {MAX_MAIN_RANGES,mainRangeRows,inspectMainRanges} from '@/lib/main-ranges.mjs';
import type {MainRangeRow} from '@/lib/main-ranges.mjs';

type Props={children?:ReactNode;plan:EditPlan;part:EditPart;duration:number;locked:boolean;
 onEdit:(id:number,rows:MainRangeRow[],expectedKey:string)=>void;
 onDraft:(id:number,key:string,invalid:boolean)=>void;
 onLock:(id:number,locked:boolean)=>void;
 onRestore:(id:number)=>void;onInvalidate:()=>void};
export function MainRangesEditor({plan,part,duration,locked,onEdit,onDraft,onLock,onRestore,onInvalidate,children}:Props){
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
 return <section className="mt-4 space-y-2" aria-label={`Timeline Part ${part.id}`}>
  <h3 className="text-sm font-semibold">Part {part.id}</h3>
  {children}
  <h4 className="pt-2 text-xs font-semibold">Nội dung chính</h4>
  {rows.map((row,i)=><div key={i} className="rounded-lg border border-white/10 p-2">
   <div className="flex items-end gap-2"><span className="pb-2 text-[11px] text-zinc-500">{i+1}</span>
    {(['start','end'] as const).map(boundary=><label key={boundary} className="min-w-0 flex-1 text-[11px] text-zinc-400">{boundary==='start'?'Bắt đầu':'Kết thúc'}
     <input aria-label={`Part ${part.id} đoạn ${i+1} ${boundary==='start'?'Bắt đầu':'Kết thúc'}`} aria-invalid={Boolean(checked.errors[i])} aria-describedby={checked.errors[i]?`main-${part.id}-${i}-error`:undefined} inputMode="text" placeholder="00:00:00:00" autoComplete="off" spellCheck={false} className="studio-input mt-1 w-full font-mono text-xs" value={row[boundary]} onChange={e=>edit(rows.map((r,j)=>i===j?{...r,[boundary]:e.target.value,[boundary==='start'?'exactStart':'exactEnd']:undefined,timecode:true}:r))}/>
    </label>)}
    <button type="button" aria-label={`Xóa đoạn ${i+1} Part ${part.id}`} className="rounded border border-white/15 px-2 py-2 text-xs focus-visible:outline-2 focus-visible:outline-white" onClick={()=>edit(rows.filter((_,j)=>j!==i))}>Xóa</button>
   </div>{checked.errors[i]&&<p id={`main-${part.id}-${i}-error`} role="alert" className="mt-1 text-[11px] text-red-300">{checked.errors[i]}</p>}
  </div>)}
  {checked.error&&<p role="alert" className="text-xs text-red-300">{checked.error}</p>}
  <button type="button" disabled={rows.length>=MAX_MAIN_RANGES} className="rounded border border-white/15 px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" onClick={()=>edit([...rows,{start:'',end:'',timecode:true}])}>+ Thêm đoạn</button>
  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={locked} onChange={e=>onLock(part.id,e.target.checked)}/>Khóa main khi phân tích lại</label>
  <button type="button" disabled={!part.aiMainRanges} title={!part.aiMainRanges?'Plan này chưa lưu bản cắt AI để khôi phục.':undefined} className="rounded border border-white/15 px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" onClick={()=>{setDraft(null);ownApplied.current=null;onDraft(part.id,key,false);onRestore(part.id);}}>Dùng lại bản cắt AI</button>
  {invalid&&<p className="text-[11px] text-amber-200">Dòng chưa hợp lệ chưa áp dụng. Preview giữ các đoạn hợp lệ đã lưu; xuất/lưu job bị chặn đến khi sửa xong.</p>}
  {part.segments.some(s=>s.isPadding)&&<p className="text-[11px] text-zinc-500">Footage bổ sung ở cuối được giữ riêng, không nằm trong danh sách main.</p>}
 </section>;
}
