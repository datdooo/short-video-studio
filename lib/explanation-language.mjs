// Explain editorial decisions in Vietnamese without translating source content
// or spending an extra provider call. Shared by internal and external prompts.
export const EXPLANATION_INSTRUCTIONS=`EXPLANATION LANGUAGE: Vietnamese (tiếng Việt), regardless of source language. Write ALL editorial explanation fields in natural Vietnamese: teaser reason/relation/ending, partUnderstanding, observed/startContext, limitations, alternative explanations, main-part reasons, segment reasons, exclusion reasons, unavailable/fallback warnings and evidence caveats. Explain concrete interest, natural curiosity, relation to retained main and the complete ending in Vietnamese. Preserve verbatim quotations, transcript/caption text, originalTitle, part title, hook quotation, hashtags and language code in the original source language. When quoting source speech inside an explanation, keep the quotation verbatim AND explain it in Vietnamese. Do this within THIS analysis request; never call a translation service. IDs, enums, timestamps/ranges and evidence coordinates must remain exact.`;
const vietnamese=/[ăđơưĂĐƠƯ\u1ea0-\u1ef9]/u;
export function explainInVietnamese(value,fallback='Giải thích đã lưu chưa có bản tiếng Việt; dữ liệu gốc vẫn giữ trong plan. Có thể phân tích lại khi cần.'){
 // A compatibility display guard, NOT translation or proof of linguistic quality.
 // Unknown legacy explanations remain stored verbatim, never rewrite evidence.
 return typeof value==='string'&&vietnamese.test(value)?value:fallback;
}
