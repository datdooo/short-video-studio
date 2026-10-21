import {createHash} from 'node:crypto';
import {teaserContextValue} from '../lib/teaser-context.mjs';
import {validateMainRangeMetadata} from '../lib/main-ranges.mjs';
import{validateCustomTeaser}from"../lib/custom-teaser.mjs";
import {normalizeMusic,validateSpeechActivity} from '../lib/music/settings.mjs';
import {validateMainAnalysis} from '../lib/auto-cut/analysis.mjs';
import { PLAYBACK_RATE } from '../lib/render-config.mjs';
import { assertRenderableVisualStyle, resolvePlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { requireBothTeasers,validateTeaser, TEASER_POLICY } from "../lib/teaser-hooks.mjs";
import {validSourceRange, MAX_SOURCE_RANGES} from '../lib/source-ranges.mjs';
import {effectiveCaptionTrack} from '../lib/subtitles.mjs';
export function validatePlan(plan, source, {teasers = true} = {}) {
  if (!plan || !Array.isArray(plan.parts) || plan.parts.length !== 2) throw new Error("Edit plan phải có đúng 2 Part.");
  if(plan.hookTransition!==undefined&&!["rainbow-light-leak","vr-light-leak-v2","dip-black","flash-white","none"].includes(plan.hookTransition))throw Error("Invalid hook transition.");
  if(!source?.id||!Number.isFinite(source.duration)||source.duration<=0)throw Error('Source/thời lượng không hợp lệ.');
  if(plan.captionCues)effectiveCaptionTrack(plan,source);
  if(plan.teaserTranscriptKey!==undefined&&!/^[a-f0-9]{64}$/.test(plan.teaserTranscriptKey))throw Error('Invalid transcript revision.');
  normalizeMusic(plan.music);
  if(plan.musicSpeech!==undefined)validateSpeechActivity(plan.musicSpeech,source);
  assertRenderableVisualStyle(resolvePlanVisualStyle(plan));
  if(plan.analysis!==undefined)validateMainAnalysis(plan.analysis,source);
  if (plan.teaserPolicy !== undefined && plan.teaserPolicy !== TEASER_POLICY) throw new Error("Invalid teaser policy.");
  let previousPartEnd = 0;
  for (const [partIndex, part] of plan.parts.entries()) {
    if (part.id !== partIndex + 1 || typeof part.title !== 'string' || !part.title.trim() || !Array.isArray(part.segments) || !part.segments.length || part.segments.length > MAX_SOURCE_RANGES) {
      throw new Error(`Part ${partIndex + 1} thiếu title hoặc segment.`);
    }
    let previousEnd = partIndex === 0 ? 0 : previousPartEnd;
    let paddingStarted = false;
    let mainCount = 0;
    let duration = 0;
    for (const segment of part.segments) {
      if(!segment||typeof segment!=='object')throw Error('Segment không hợp lệ.');
      if (segment.type && segment.type !== 'source') throw new Error('Loại segment không hợp lệ.');
      if (segment.focus && (!Number.isFinite(segment.focus.scale) || segment.focus.scale < 1.05 || segment.focus.scale > 1.15)) throw new Error('Focus scale không hợp lệ.');
      const {start, end} = segment;
      if (!validSourceRange(segment, source.duration) || (segment.isPadding !== undefined && typeof segment.isPadding !== "boolean")) {
        throw new Error(`Timestamp Part ${partIndex + 1} không hợp lệ hoặc vượt duration source.`);
      }
      if (segment.isPadding === true) {
        if (!mainCount) throw new Error(`Part ${partIndex + 1} phải có nội dung chính trước footage bổ sung.`);
        paddingStarted = true;
      } else {
        if (paddingStarted || start < previousEnd) throw new Error(`Nội dung chính Part ${partIndex + 1} bị đảo thứ tự hoặc chồng nhau.`);
        previousEnd = end; mainCount += 1;
      }
      duration += end - start;
    }
    if (plan.providerUsed && !["mock", "manual"].includes(plan.providerUsed) && duration / PLAYBACK_RATE <= 60) {
      throw new Error(`Part ${partIndex + 1} phải trên 1 phút sau tua 1.25×; cần hơn 75 giây footage gốc. Yêu cầu AI bổ sung footage thật ở cuối (isPadding: true) nếu nội dung chính quá ngắn.`);
    }
    previousPartEnd = previousEnd;
    for(const key of ['manualLocked','startTrimApplied','smartCutApplied'])if(part[key]!==undefined&&typeof part[key]!=='boolean')throw Error('Cờ trạng thái cut không hợp lệ.');
    if(part.teaserEnabled!==undefined&&typeof part.teaserEnabled!=='boolean')throw Error('Invalid teaser enabled flag.');
    if(teasers){validateTeaser(part, source.duration);validateCustomTeaser(part);}
    validateMainRangeMetadata(part,source.duration);
    if(part.mainEdited&&(part.startTrimApplied!==true||part.smartCutApplied!==true))throw Error("Manual main ranges must bypass start trimming and Smart Cut.");
  }
}

// Loading/editing/analyzing old plans intentionally remains validatePlan-only.
export function validateRenderPlan(plan,source){
 const cues=effectiveCaptionTrack(plan,source)?.cues||[];
 requireBothTeasers(plan,source.duration,cues);
 for(const part of plan.parts){
  const h=part.teaser;if(part.teaserEnabled===false||h?.status!=='selected'||!['ai','external-import'].includes(h.selection))continue;
  const b=h.binding,key=plan.teaserTranscriptKey||b?.transcriptKey;
  if(b?.version!==1||b.sourceId!==source.id||!b.sourceFingerprint||b.transcriptKey!==key||b.contextKey!==createHash('sha256').update(teaserContextValue(part,source,cues,key)).digest('hex'))throw Object.assign(Error(`Part ${part.id}: teaser AI thiếu binding hoặc đã cũ so với source/main/phụ đề. Chọn lại bằng AI hoặc Custom Teaser.`),{code:'TEASER_REQUIRED',status:409});
 }
 validatePlan(plan,source);
}
