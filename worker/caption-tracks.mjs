// No language inference from the title or English-first fallback.
export const baseLanguage=value=>String(value||'').toLowerCase().replace(/-orig$/,'').split(/[-_]/)[0];
export function originalCaptionTrack(manual={},automatic={},spokenLanguage=''){
 const language=baseLanguage(spokenLanguage);
 if(!/^[a-z]{2,3}$/.test(language)||['und','zxx'].includes(language))return{language:'',warning:'Chưa rõ ngôn ngữ lời nói. Chọn ngôn ngữ và dùng Whisper nếu phụ đề không phù hợp.'};
 const untranslated=items=>Array.isArray(items)&&items.some(item=>{try{return !new URL(item.url).searchParams.has('tlang');}catch{return false;}});
 const matches=(tracks)=>Object.keys(tracks).filter(id=>id!=='live_chat'&&baseLanguage(id)===language&&untranslated(tracks[id]));
 const id=matches(manual)[0]||matches(automatic).find(id=>id.endsWith('-orig'))||matches(automatic)[0];
 return id?{id,language,translated:false}:{language,warning:'Không có track gốc phù hợp ngôn ngữ lời nói; không tự lấy bản dịch English. Có thể chọn Whisper.'};
}
