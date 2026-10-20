import {parseSourceTimecode,formatSourceTimecode,sourceTimecodeValue} from './source-timecode.mjs';
import { PLAYBACK_RATE } from './render-config.mjs';
import { invalidateEditedAnalysis } from './auto-cut/analysis.mjs';
import { hookRangeKey, hookNeedsReselection, mainRanges, unavailableHook, validateTeaser } from './teaser-hooks.mjs';

export const MAX_MAIN_RANGES = 200;
// Only raw input strings are drafts. Effective playback/export always uses segments.
export function sourceTime(value) {
  if(typeof value==='string'&&value.trim().split(':').length===4)return parseSourceTimecode(value);
  if(typeof value!=='string'||!value.trim()||!/^\d+(?::\d{2}){0,2}(?:\.\d+)?$/.test(value.trim()))throw Error('Nhập giây, MM:SS hoặc HH:MM:SS.');
  const fields=value.trim().split(':').map(Number);
  if(fields.slice(1).some(v=>v>=60))throw Error('Phút/giây phải nhỏ hơn 60.');
  const time=fields.reduce((n,v)=>n*60+v,0);
  if(!Number.isFinite(time)||time<0)throw Error('Timestamp phải hữu hạn, không âm.');
  return time;
}
// Do not round existing AI endpoints merely by displaying/editing another row.
export function rangeTime(time) { return formatSourceTimecode(time); }
export function mainRangeRows(part) {return mainRanges(part).map(s=>({start:rangeTime(s.start),end:rangeTime(s.end),exactStart:s.start,exactEnd:s.end,timecode:true}));}
export function inspectMainRanges(plan,partId,rows,sourceDuration=Infinity) {
  const index=plan.parts.findIndex(p=>p.id===partId),part=plan.parts[index];
  if(!part)throw Error('Không tìm thấy part.');
  const errors=Array.isArray(rows)?rows.map(()=> ''):[];
  let error='';const ranges=[];
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_MAIN_RANGES)return{errors,error:`Cần từ 1 đến ${MAX_MAIN_RANGES} đoạn main.`,ranges};
  for(const [i,row]of rows.entries()){
    try{const start=row.timecode?sourceTimecodeValue(row.start,row.exactStart):sourceTime(row.start),end=row.timecode?sourceTimecodeValue(row.end,row.exactEnd):sourceTime(row.end);
      if(end<=start)throw Error('Kết thúc phải lớn hơn Bắt đầu.');
      if(end>sourceDuration)throw Error('Range vượt thời lượng nguồn.');
      ranges[i]={start,end};
    }catch(e){errors[i]=e.message;}
  }
  for(let i=0;i<ranges.length;i++){
    const r=ranges[i];if(!r)continue;
    if(i&&ranges[i-1]&&r.start<ranges[i-1].end)errors[i]='Đảo thứ tự hoặc chồng đoạn trước; app không tự sắp xếp.';
    if(!i&&index>0&&r.start<mainRanges(plan.parts[index-1]).at(-1).end)errors[i]='Bắt đầu trước khi main của part trước kết thúc.';
    if(i===rows.length-1&&index<plan.parts.length-1&&r.end>mainRanges(plan.parts[index+1])[0].start)errors[i]='Kết thúc sau khi main của part tiếp theo bắt đầu.';
  }
  if(!errors.some(Boolean)&&!['manual','mock'].includes(plan.providerUsed)){
    const padding=part.segments.filter(s=>s.isPadding).reduce((n,s)=>n+s.end-s.start,0);
    if((ranges.reduce((n,r)=>n+r.end-r.start,0)+padding)/PLAYBACK_RATE<=60)error='Part cần trên 1 phút sau tua 1.25× theo quy tắc hiện có; padding được giữ riêng.';
  }
  return{errors,error,ranges};
}

// This is a restore snapshot only; it is never read by rendering or mapping.
export function captureAiMainRanges(plan,previous) {
  if(['manual','mock'].includes(plan.providerUsed)||plan.analysis?.method==='deterministic-fallback')return plan;
  return {...plan,parts:plan.parts.map(p=>{
    const prior=previous?.parts.find(old=>old.id===p.id);
    if(p.mainEdited||p.aiMainRanges)return p;
    if(prior?.manualLocked&&hookRangeKey(prior)===hookRangeKey(p)&&prior.aiMainRanges)return{...p,aiMainRanges:structuredClone(prior.aiMainRanges)};
    // Older locked/customized plans may no longer contain their original AI
    // ranges. Do not label a manual range list as a recovered AI checkpoint.
    if(p.manualLocked||plan.analysis?.recipeId==='manual-customized')return p;
    return{...p,aiMainRanges:{version:1,ranges:mainRanges(p).map(({start,end,label,reason})=>({start,end,label,reason}))}};
  })};
}
export function validateMainRangeMetadata(part,duration=Infinity) {
  if(part.mainEdited!==undefined&&typeof part.mainEdited!=='boolean')throw Error('Invalid main edit flag.');
  if(part.teaserNeedsReselection!==undefined&&typeof part.teaserNeedsReselection!=='boolean')throw Error('Invalid teaser review flag.');
  const saved=part.aiMainRanges;if(saved===undefined)return;
  if(!saved||saved.version!==1||Object.keys(saved).some(k=>!['version','ranges'].includes(k))||!Array.isArray(saved.ranges)||!saved.ranges.length||saved.ranges.length>MAX_MAIN_RANGES)throw Error('Invalid AI main restore snapshot.');
  let end=0;for(const r of saved.ranges){
    if(!r||Object.keys(r).some(k=>!['start','end','label','reason'].includes(k))||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<end||r.end<=r.start||r.end>duration||typeof r.label!=='string'||r.label.length>2000||typeof r.reason!=='string'||r.reason.length>4000)throw Error('Invalid AI main restore range.');
    end=r.end;
  }
}
export function applyMainRanges(plan,partId,rows,sourceDuration=Infinity,{restore=false}={}) {
  const checked=inspectMainRanges(plan,partId,rows,sourceDuration);
  if(checked.error||checked.errors.some(Boolean))throw Error(checked.error||checked.errors.find(Boolean));
  const captured=captureAiMainRanges(plan),part=captured.parts.find(p=>p.id===partId),old=mainRanges(part);
  const ranges=checked.ranges.map(r=>{const original=old.find(s=>s.start===r.start&&s.end===r.end);return original?{...original}:{...r,label:'Main',reason:'Explicit manual source range.',isPadding:false};});
  const changed=JSON.stringify(ranges.map(r=>[r.start,r.end]))!==hookRangeKey(part);
  const next={...part,segments:[...ranges,...part.segments.filter(s=>s.isPadding)],startTrimApplied:true,smartCutApplied:true,
    ...(changed?{manualLocked:true,mainEdited:!restore}:{})};
  if(changed&&part.teaser){
    // Keep an existing eligible excerpt exactly, never generate a substitute.
    const candidate={...part.teaser,rangeKey:hookRangeKey(next)};
    try{if(candidate.status==='selected'&&(hookNeedsReselection({...next,teaser:candidate})||candidate.selection==='external-import'))throw Error('Reselect');validateTeaser({...next,teaser:candidate},sourceDuration);next.teaser=candidate;}
    catch{next.teaser=unavailableHook(next,'Main đã đổi; teaser cũ không còn hợp lệ. Chọn lại teaser rõ ràng; app không tự thay đoạn khác.');next.teaserNeedsReselection=true;}
  }
  const parts=captured.parts.map(p=>p.id===partId?next:(p.smartCutApplied?p:{...p,smartCutApplied:true}));
  return {...captured,parts,...(plan.analysis?{analysis:invalidateEditedAnalysis(plan,parts,sourceDuration)}:{})};
}
export function restoreAiMainRanges(plan,partId,sourceDuration=Infinity) {
  const saved=plan.parts.find(p=>p.id===partId)?.aiMainRanges;
  if(!saved)throw Error('Plan này chưa có bản cắt AI để khôi phục.');
  validateMainRangeMetadata(plan.parts.find(p=>p.id===partId),sourceDuration);
  const next=applyMainRanges(plan,partId,saved.ranges.map(r=>({start:rangeTime(r.start),end:rangeTime(r.end),exactStart:r.start,exactEnd:r.end,timecode:true})),sourceDuration,{restore:true});
  const part=next.parts.find(p=>p.id===partId);
  part.mainEdited=false;
  part.segments=[...structuredClone(saved.ranges),...part.segments.filter(s=>s.isPadding)];
  return next;
}
