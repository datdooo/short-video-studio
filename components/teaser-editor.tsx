'use client';
import {useState} from 'react';
import type {EditPart} from '@/lib/edit-plan';
import {adjustTeaserRange,chooseTeaserAlternative} from '@/lib/teaser-hooks.mjs';
export function TeaserEditor({part,cues,onChange}:{part:EditPart;cues:{start:number;end:number;text:string}[];onChange:(p:EditPart)=>void}){
 const [error,setError]=useState('');
 const h=part.teaser;
 return <div className="mt-3 text-xs">
 {h?.status==='selected'&&h.alternatives?.length? <button type="button" className="rounded border border-white/15 px-3 py-2" onClick={()=>{try{onChange(chooseTeaserAlternative(part,0));setError('');}catch(e){setError(String(e));}}}>Thử teaser khác · đã cache ({h.alternatives.length})</button>:null}
 <details className="mt-2"><summary className="cursor-pointer">Chỉnh range teaser · source giây</summary><form key={`${part.id}:${h?.status==='selected'?h.start:''}:${h?.status==='selected'?h.end:''}`} className="mt-2 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);try{onChange(adjustTeaserRange(part,Number(data.get('start')),Number(data.get('end')),cues));setError('');}catch{setError('Range phải trong main của part, sau 10 giây rendered, không cắt cue lời nói và tối đa 9 giây rendered. Cần tự xác nhận ý nghĩa/điểm kết.');}}}>
 <label>Start<input name="start" aria-label="Teaser source start" className="studio-input mt-1 w-24" type="number" step="0.001" min="0" required defaultValue={h?.status==='selected'?h.start:undefined}/></label><label>End<input name="end" aria-label="Teaser source end" className="studio-input mt-1 w-24" type="number" step="0.001" min="0" required defaultValue={h?.status==='selected'?h.end:undefined}/></label><button type="submit" className="rounded border border-white/15 px-3 py-2">Áp dụng range</button>
 </form><p className="mt-1 text-zinc-500">Không đổi main/lock hoặc job đã queue. Range chỉnh tay không được gắn nhãn AI.</p></details>{error&&<p role="alert" className="mt-2 text-amber-300">{error}</p>}
 </div>;
}
