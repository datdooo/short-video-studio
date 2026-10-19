import{adjustTeaserRange,mainRanges,permittedHookRanges,hookDurationLimits}from'./teaser-hooks.mjs';
export function parseCustomTeaser(input){
 if(typeof input!=='string'||input.length>1000)throw Error('Custom Teaser tối đa 1000 ký tự.');const text=input.trim();if(!text)return{mode:'auto',input:''};
 const range=text.match(/^(\d+(?::\d{2}){0,2}(?:[.,]\d{1,3})?)\s*[–—→-]\s*(\d+(?::\d{2}){0,2}(?:[.,]\d{1,3})?)$/u);
 if(range){const time=s=>{const a=s.replace(',','.').split(':').map(Number);if(a.length>1&&a.slice(1).some(n=>n>=60))throw Error('Timestamp có phút/giây không hợp lệ.');return a.reduce((n,v)=>n*60+v,0);};return{mode:'timestamp',input:text,start:time(range[1]),end:time(range[2])};}
 if(/\d+:\d+|\d+\s*[–—→-]\s*\d+/u.test(text))throw Error('Nhập đúng một range, ví dụ 00:42–00:50; timestamp không được tự sửa.');
 return{mode:'description',input:text};
}
export function customTimestampPart(part,input,cues=[]){
 const request=parseCustomTeaser(input);if(request.mode!=='timestamp')throw Error('Cần một range timestamp.');const{start,end}=request;
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw Error('End phải lớn hơn Start; timestamp phải hữu hạn, không âm.');
 if(end-start>hookDurationLimits().maxSourceSeconds)throw Error('Teaser vượt 9 giây rendered ở tốc độ 1.25×. Không tự rút ngắn range.');
 if(!mainRanges(part).some(r=>start>=r.start&&end<=r.end))throw Error('Range phải nằm trọn trong một đoạn main được giữ của đúng part, không đi qua gap/padding.');
 if(!permittedHookRanges(part).some(r=>start>=r.start&&end<=r.end))throw Error('Range chạm 10 giây rendered đầu main đã bị loại khỏi teaser.');
 try{const next=adjustTeaserRange(part,start,end,cues);return{...next,customTeaser:{version:1,mode:'timestamp',input:request.input}};}
 catch(e){if(String(e.message).includes('SPLITS_TIMED_SPEECH'))throw Error('Range cắt ngang cue lời nói. Chọn timestamp khác; app không tự căn lại.');throw e;}
}
export function validateCustomTeaser(part){
 const value=part.customTeaser;if(value===undefined)return;
 if(!value||Object.keys(value).some(k=>!['version','mode','input'].includes(k))||value.version!==1||!['timestamp','description'].includes(value.mode))throw Error('Custom Teaser không hợp lệ.');
 const request=parseCustomTeaser(value.input);if(request.mode!==value.mode)throw Error('Custom Teaser mode/input không khớp.');
 if(part.teaser?.status==='selected'&&request.mode==='timestamp'&&(request.start!==part.teaser.start||request.end!==part.teaser.end))throw Error('Timestamp Custom Teaser khác range hiệu lực.');
}
