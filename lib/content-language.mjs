// Source/output language is independent of explanation language, typography and
// subtitle rendering style. No fixed list of supported video languages.
export const CONTENT_LANGUAGE_VERSION='source-language-v1';
export const CONTENT_LANGUAGE_SCHEMA=Object.freeze({type:'string',description:'Original spoken/source content language as a BCP-47 code, e.g. vi, en, de, ja, ko, zh-Hans. Use und only if genuinely undetermined; never translate into another language to fit a list.'});
export const CONTENT_LANGUAGE_INSTRUCTIONS=`CONTENT LANGUAGE: Titles, hook quotations and hashtags preserve the original spoken/source content language, including Vietnamese (vi) and languages outside the examples. The language field identifies that content language; explanations/labels/reasons remain Vietnamese under their separate rule. Use sourceLanguage when known. A visual template, font, country, channel name, older part title/hashtags or a translated subtitle track is NOT an output-language setting. Existing plan metadata may be wrong; do not copy its language as a new instruction. When sourceLanguage is unknown/und, determine it from the supplied original speech/transcript evidence; never default to English or Japanese. If genuinely uncertain, report the uncertainty and use und without inventing a language or translating source text. Changing content language never translates or overwrites subtitles.`;

export function normalizeLanguageCode(value){
 if(typeof value!=='string'||!value.trim()||value.length>64)return '';
 const code=value.trim().replaceAll('_','-');
 if(!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code))return '';
 try{return Intl.getCanonicalLocales(code)[0]||'';}catch{return '';}
}
export function knownContentLanguage(value){
 const code=normalizeLanguageCode(value);
 return code&&!['und','mul','zxx'].includes(code.split('-')[0])?code:'';
}
export function sourceContentLanguage(source){
 // Existing collector warning means source speech language was not established.
 // A subtitle target/style must never become the source language fallback.
 if(source?.captionWarning&&!source?.captionTrackId)return '';
 return knownContentLanguage(source?.language);
}
export function contentLanguageSchema(expected){
 const language=knownContentLanguage(expected);
 return {...CONTENT_LANGUAGE_SCHEMA,...(language?{enum:[language]}:{})};
}
export function assertContentLanguage(actual,expected){
 const code=normalizeLanguageCode(actual),language=knownContentLanguage(expected);
 if(!code)throw Object.assign(Error('language: cần mã ngôn ngữ nguồn hợp lệ (ví dụ vi, de, ja); không giới hạn trong một danh sách ngôn ngữ.'),{code:'CONTENT_LANGUAGE_INVALID'});
 if(language&&code.split('-')[0]!==language.split('-')[0])throw Object.assign(Error(`language: kết quả là ${code}, nhưng ngôn ngữ nguồn đã xác định là ${language}. Title/hook/hashtag phải giữ ngôn ngữ nguồn; không tự dịch hoặc đổi plan hiện tại.`),{code:'CONTENT_LANGUAGE_MISMATCH'});
 return code;
}
