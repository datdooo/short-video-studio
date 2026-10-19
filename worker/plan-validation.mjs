import{validateCustomTeaser}from"../lib/custom-teaser.mjs";
import {normalizeMusic,validateSpeechActivity} from '../lib/music/settings.mjs';
import {validateMainAnalysis} from '../lib/auto-cut/analysis.mjs';
import { PLAYBACK_RATE } from '../lib/render-config.mjs';
import { assertRenderableVisualStyle, resolvePlanVisualStyle } from "../lib/visual-style/normalize.mjs";
import { validateTeaser, TEASER_POLICY } from "../lib/teaser-hooks.mjs";
export function validatePlan(plan, source) {
  if (!plan || !Array.isArray(plan.parts) || plan.parts.length !== 2) throw new Error("Edit plan phải có đúng 2 Part.");
  if(plan.hookTransition!==undefined&&!["rainbow-light-leak","vr-light-leak-v2","dip-black","flash-white","none"].includes(plan.hookTransition))throw Error("Invalid hook transition.");
  normalizeMusic(plan.music);
  if(plan.musicSpeech!==undefined)validateSpeechActivity(plan.musicSpeech,source);
  assertRenderableVisualStyle(resolvePlanVisualStyle(plan));
  if(plan.analysis!==undefined)validateMainAnalysis(plan.analysis,source);
  if (plan.teaserPolicy !== undefined && plan.teaserPolicy !== TEASER_POLICY) throw new Error("Invalid teaser policy.");
  let previousPartEnd = 0;
  for (const [partIndex, part] of plan.parts.entries()) {
    if (!part.title?.trim() || !Array.isArray(part.segments) || !part.segments.length) {
      throw new Error(`Part ${partIndex + 1} thiếu title hoặc segment.`);
    }
    let previousEnd = partIndex === 0 ? 0 : previousPartEnd;
    let paddingStarted = false;
    let mainCount = 0;
    let duration = 0;
    for (const segment of part.segments) {
      if (segment.type && segment.type !== 'source') throw new Error('Loại segment không hợp lệ.');
      if (segment.focus && (!Number.isFinite(segment.focus.scale) || segment.focus.scale < 1.05 || segment.focus.scale > 1.15)) throw new Error('Focus scale không hợp lệ.');
      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > source.duration + 0.5 || (segment.isPadding !== undefined && typeof segment.isPadding !== "boolean")) {
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
    validateTeaser(part, source.duration);
    validateCustomTeaser(part);
  }
}
