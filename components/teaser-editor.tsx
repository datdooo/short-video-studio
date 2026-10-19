'use client';
import {useEffect,useRef,useState}from'react';
import type{EditPart}from'@/lib/edit-plan';
import {chooseTeaserAlternative}from'@/lib/teaser-hooks.mjs';
import {customTimestampPart,parseCustomTeaser}from'@/lib/custom-teaser.mjs';
import type{Teaser}from'@/lib/teaser-hooks.mjs';
import {PLAYBACK_RATE}from'@/lib/render-config.mjs';
const format=(t:number)=>`${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0')}`;
export function TeaserEditor({part,cues,sourceUrl,active,onChange,onResolve,onAudition}:{part:EditPart;active:boolean;cues:{start:number;end:number;text:string}[];sourceUrl:string;onChange:(p:EditPart)=>void;onResolve:(input:string,signal:AbortSignal)=>Promise<Teaser>;onAudition:()=>void}){
 const[input,setInput]=useState(part.customTeaser?.input||''),[candidate,setCandidate]=useState<EditPart|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[showPreview,setShowPreview]=useState(false);
 const request=useRef<AbortController|null>(null),preview=useRef<HTMLVideoElement|null>(null);
 const identity=JSON.stringify([part.segments,cues,part.customTeaser,part.teaser?.rangeKey]);
 useEffect(()=>{request.current?.abort();preview.current?.pause();queueMicrotask(()=>{setCandidate(null);setConfirmed(false);setShowPreview(false);setInput(part.customTeaser?.input||'');setBusy(false);});return()=>request.current?.abort();},[identity,part.customTeaser?.input]);
 useEffect(()=>{if(!active){request.current?.abort();preview.current?.pause();queueMicrotask(()=>setBusy(false));}},[active]);
 async function prepare(auto=false){request.current?.abort();const controller=new AbortController();request.current=controller;setError('');setBusy(true);setCandidate(null);setConfirmed(false);setShowPreview(false);preview.current?.pause();
 try{const parsed=parseCustomTeaser(auto?'':input);if(parsed.mode==='timestamp'){setCandidate(customTimestampPart(part,parsed.input,cues));return;}
 const teaser=await onResolve(parsed.input,controller.signal);if(controller.signal.aborted)return;if(parsed.mode==='auto'){onChange({...part,teaser,customTeaser:undefined});setInput('');return;}
 if(teaser.status!=='selected')throw Error(teaser.reason||'Không tìm thấy đoạn phù hợp.');
 setCandidate({...part,teaser,customTeaser:{version:1,mode:'description',input:parsed.input}});
 }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}finally{if(!controller.signal.aborted)setBusy(false);}}
 const h=candidate?.teaser;
 return <section className="mt-3 space-y-2 text-xs" aria-label={`Custom Teaser Part ${part.id}`}>
 <p className="text-zinc-400">{part.customTeaser?'Custom đã áp dụng':'Auto'}{part.teaser?.status==='selected'?` · ${format(part.teaser.start)} → ${format(part.teaser.end)}`:part.teaser?.reason?` · ${part.teaser.reason}`:''}</p>
 {!part.customTeaser&&part.teaser?.status==='selected'&&!!part.teaser.alternatives?.length&&<button type="button" className="rounded border border-white/15 px-3 py-2" onClick={()=>onChange(chooseTeaserAlternative(part,0))}>Thử teaser khác · đã cache ({part.teaser.alternatives.length})</button>}
 <label className="block font-semibold">Custom Teaser · Part {part.id}<textarea aria-label={`Custom Teaser Part ${part.id}`} className="studio-input mt-2 w-full" rows={2} maxLength={1000} value={input} placeholder="00:42–00:50 hoặc mô tả footage cần tìm" onChange={e=>{request.current?.abort();setBusy(false);setInput(e.target.value);setCandidate(null);setConfirmed(false);setShowPreview(false);preview.current?.pause();}}/></label>
 <p className="text-zinc-500">Timestamp dùng nguyên range, không gọi AI. Mô tả tìm footage thật bằng ChatGPT đã kết nối; không tạo nội dung mới. Để trống để về Auto. Tối đa 9 giây rendered, sau 10 giây main đầu.</p>
 <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>void prepare()} className="rounded border border-white/15 px-3 py-2 disabled:opacity-40">{busy?'Đang tìm/kiểm tra…':'Chuẩn bị teaser'}</button><button type="button" disabled={busy} onClick={()=>void prepare(true)} className="rounded border border-white/15 px-3 py-2 disabled:opacity-40">Về Auto</button></div>
 {h?.status==='selected'&&<div className="space-y-2 rounded border border-white/15 p-3"><p>{format(h.start)} → {format(h.end)} · {((h.end-h.start)/PLAYBACK_RATE).toFixed(2)}s rendered</p><p>{h.reason}</p><p className="text-zinc-500">{h.ending} Biên cue không bảo đảm trọn nghĩa/hành động; cần nghe/xem trước khi xác nhận.</p><button type="button" onClick={()=>{onAudition();setShowPreview(true);}} className="rounded border border-white/15 px-3 py-2">Nghe / xem thử</button>
 {showPreview&&<video key={`${h.start}:${h.end}`} ref={preview} src={sourceUrl} controls playsInline preload="metadata" className="max-h-48 w-full" onSeeking={e=>{const v=e.currentTarget;if(v.currentTime<h.start||v.currentTime>h.end)v.currentTime=h.start;}} onLoadedMetadata={e=>{e.currentTarget.currentTime=h.start;e.currentTarget.playbackRate=PLAYBACK_RATE;}} onTimeUpdate={e=>{if(e.currentTarget.currentTime>=h.end)e.currentTarget.pause();}} onPlay={e=>{onAudition();if(e.currentTarget.currentTime<h.start||e.currentTarget.currentTime>=h.end)e.currentTarget.currentTime=h.start;}}/>}
 <label className="flex gap-2"><input type="checkbox" disabled={!showPreview} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Tôi đã nghe/xem và xác nhận teaser trọn nghĩa, kết thúc sạch.</label><button type="button" disabled={!confirmed} className="rounded border border-white/15 px-3 py-2 disabled:opacity-40" onClick={()=>{if(candidate&&confirmed){preview.current?.pause();onChange(candidate);setCandidate(null);setShowPreview(false);}}}>Áp dụng teaser</button></div>}
 {error&&<p role="alert" className="text-amber-200">{error} Teaser/main hiện tại không thay đổi.</p>}
 </section>;
}
