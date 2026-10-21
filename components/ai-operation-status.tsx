'use client';
import{useEffect,useState}from'react';
import type{AiDiagnostics}from'@/lib/ai-progress';
const stages:Record<string,string>={preparation:'Chuẩn bị dữ liệu',discovery:'Tìm khoảnh khắc',frames:'Lấy bằng chứng hình ảnh',provider:'Chờ ChatGPT',reading:'Đọc kết quả ChatGPT',validation:'Kiểm tra kết quả',retry:'Sửa kết quả AI',cache:'Đọc kết quả đã lưu',complete:'Đã xử lý xong',error:'Phân tích chưa hoàn tất',cancelled:'Đã dừng'};
const phases:Record<string,string>={'select-main':'Chọn main','repair-main':'Sửa main','find-moments':'Tìm khoảnh khắc','find-two-part-moments':'Tìm khoảnh khắc chung','finalize-moments':'Chốt teaser','finalize-two-part-moments':'Chốt teaser hai part','select-two-parts':'Chọn teaser hai part','select-teaser':'Chọn teaser','repair-teaser':'Sửa teaser'};
const seconds=(ms:number)=>`${(ms/1000).toFixed(1)}s`;
function retryReason(code:string){
 if(/HOOK_DISCOVERY_ANCHOR_OUTSIDE_INTERVAL/.test(code))return'Mốc tìm khoảnh khắc nằm ngoài khoảng nguồn được phép';
 if(/HOOK_DISCOVERY_RANGE_INVALID/.test(code))return'Vùng tìm khoảnh khắc sai range';
 if(/HOOK_DISCOVERY_PART_WRAPPER_INVALID/.test(code))return'Kết quả tìm khoảnh khắc thiếu hoặc trùng part';
 if(/HOOK_DISCOVERY_SCHEMA_INVALID/.test(code))return'Kết quả tìm khoảnh khắc sai cấu trúc';
 if(code==='shared-in-flight')return'Dùng chung lượt đang xử lý; không tạo request AI mới.';
 if(/INCOMPLETE|output-incomplete/i.test(code))return'Kết quả trước bị thiếu hoặc vượt giới hạn đầu ra';
 if(/SCHEMA|schema-invalid/i.test(code))return'Kết quả trước sai cấu trúc JSON';
 if(/IMAGE_UNSUPPORTED/i.test(code))return'Kết nối từ chối ảnh; chưa xác minh bằng hình ảnh';
 if(/HOOK_|VALIDATION|selection-rejected/i.test(code))return'Kết quả trước chưa đạt điều kiện range hoặc cấu trúc; sửa đúng phần bị từ chối';
 return'Đang xử lý lại phần chưa hợp lệ';
}
export function AiOperationStatus({diagnostics,startedAt,running,finishedAt,finishedStage}:{diagnostics:AiDiagnostics|null;startedAt:number;running:boolean;finishedAt?:number;finishedStage?:'complete'|'error'|'cancelled'}){
 const[now,setNow]=useState(startedAt);
 useEffect(()=>{setNow(Date.now());if(!running)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[running,startedAt]);
 if(!startedAt&&!diagnostics)return null;
 const elapsed=running?Math.max(diagnostics?.elapsedMs||0,startedAt?now-startedAt:0):diagnostics?.elapsedMs??Math.max(0,(finishedAt||startedAt)-startedAt);
 const stage=!running&&finishedStage?finishedStage:diagnostics?.stage||(running?'preparation':'complete');
 return <div className="min-w-0 space-y-1 text-xs" role="status" aria-live="polite">
  <p className="studio-muted">{stages[stage]||'Đang xử lý phân tích'} · {seconds(elapsed)} · {diagnostics?`${diagnostics.requestCount} request AI mới`:'Chờ thống kê từ worker'}</p>
  {diagnostics&&<details className="min-w-0"><summary className="cursor-pointer studio-muted">Chi tiết lượt AI</summary><div className="mt-1 space-y-1 break-words">
   {!diagnostics.requests.length&&<p className="studio-muted">{diagnostics.events.some(event=>event.reason==='shared-in-flight')?'Dùng chung lượt đang xử lý; không tạo request AI mới.':'Chưa gửi request AI mới trong lượt này.'}</p>}
   {diagnostics.requests.map((request,index)=><div key={index} className="studio-muted"><p>#{index+1}{request.phase?` · ${phases[request.phase]||'Phân tích'}`:''} · {request.responseModel||request.model||'Model chưa xác định'}{request.responseModel&&request.responseModel!==request.model?` (yêu cầu ${request.model})`:''} · yêu cầu reasoning: {request.requestedReasoning||'không hỗ trợ/chưa xác định'} · provider xác nhận: {request.actualReasoning||'chưa trả'} · {({pending:'đang chờ',running:'đang chạy',completed:'hoàn tất',complete:'hoàn tất',success:'hoàn tất',error:'lỗi',failed:'lỗi',cancelled:'đã dừng',aborted:'đã dừng'}as Record<string,string>)[request.status]||'đang xử lý'}</p>{request.inputCharacters!==undefined&&<p>{request.inputCharacters.toLocaleString('vi-VN')} ký tự gửi{request.rawInputCharacters!==undefined&&request.rawInputCharacters>request.inputCharacters?` / ${request.rawInputCharacters.toLocaleString('vi-VN')} ký tự gốc`:''} · {request.imageCount||0} ảnh{request.partCount?` · ${request.partCount} part`:''}</p>}{(request.providerMs!==undefined||request.readMs!==undefined)&&<p>Chờ provider {seconds(request.providerMs||0)} · đọc {seconds(request.readMs||0)}</p>}{request.requestedServiceTier&&<p>Faster: {request.actualServiceTier==='fast'||request.actualServiceTier==='priority'?'provider xác nhận':request.actualServiceTier?`provider dùng ${request.actualServiceTier}`:'đã yêu cầu · chưa có xác nhận từ provider'}</p>}{request.usage&&<p>{Object.entries(request.usage).map(([key,value])=>`${({input_tokens:'Token đầu vào',output_tokens:'Token đầu ra',total_tokens:'Tổng token',cached_tokens:'Token cache',reasoning_tokens:'Token reasoning'}as Record<string,string>)[key]||key}: ${value}`).join(' · ')}</p>}</div>)}
   {diagnostics.events.filter(event=>event.durationMs!==undefined||event.reason).map((event,index)=><p key={index} className="studio-muted">{stages[event.stage]||'Xử lý'}{event.partId?` · Part ${event.partId}`:''}{event.durationMs!==undefined?` · ${seconds(event.durationMs)}`:''}{event.reason?` · ${retryReason(event.reason)} (${event.reason})`:''}</p>)}
  </div></details>}
 </div>;
}
