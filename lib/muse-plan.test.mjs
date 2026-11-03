import test from "node:test";
import assert from "node:assert/strict";
import { buildMusePrompt, parseMusePlan } from "./muse-plan.mjs";

const source = { id: "video-test", title: "자동차 테스트", duration: 120 };
test("Gemini web uses the same strict import contract with its own provider label", () => {
  assert.equal(parseMusePlan(JSON.stringify(fixture()), source, "Gemini Pro").parts.length, 2);
  assert.throws(() => parseMusePlan("{}", source, "Gemini Pro"), /Gemini Pro/);
  assert.throws(() => parseMusePlan("not JSON", source, "Gemini Pro"), /Gemini Pro/);
});
function fixture() {
  return { sourceId: source.id, originalTitle: source.title, language: "ko", parts: [1, 2].map((id) => ({
    id, title: `테스트 ${id}`, hook: "이 소리를 들어보세요", hashtags: Array.from({ length: 10 }, (_, index) => `#자동차${index}`),
    segments: [{ start: id === 1 ? 10 : 60, end: id === 1 ? 60 : 120, label: "테스트", reason: "광고 없이 연속 유지", isPadding: false }],
  })) };
}
test("Muse prompt carries exact source and JSON schema; import accepts plain/fenced JSON", () => {
  const prompt = buildMusePrompt("Keep chronological source timestamps", { properties: { parts: {} }, required: ["parts"] }, source);
  assert.match(prompt, /video-test/); assert.match(prompt, /sourceId/); assert.match(prompt, /ten distinct factual hashtags/);
  for (const raw of [JSON.stringify(fixture()), `\`\`\`json\n${JSON.stringify(fixture(), null, 2)}\n\`\`\``]) {
    const plan = parseMusePlan(raw, source);
    assert.equal(plan.originalTitle, source.title); assert.equal(plan.parts[1].segments[0].end, 120);
    assert.equal(plan.sourceId, undefined); assert.equal(plan.render, undefined);
  }
});
test('manual web prompt requires the actual attachment, not model browsing of a YouTube URL', () => {
  const prompt = buildMusePrompt('Use original source timestamps', {properties: {}, required: []}, {...source, sourceUrl: 'https://youtu.be/yQC1SjvZJUE'});
  assert.match(prompt, /separately attached full-duration source video/);
  assert.match(prompt, /not.*actual video input|not an attachment/i);
  assert.match(prompt, /sourceId/); assert.match(prompt, /never invent/);
  assert.doesNotMatch(prompt, /Watch this exact YouTube video/);
});
test("Muse import rejects wrong source, shape, language, IDs and extra render settings", () => {
  for (const change of [p => { p.sourceId = "other"; }, p => { p.originalTitle = ""; }, p => { p.language = "invalid-language"; }, p => { p.parts.pop(); }, p => { p.parts.push(p.parts[0]); }, p => { p.parts[0].id = 2; }, p => { p.render = { speed: 5 }; }, p => { p.parts[0].title = ""; }]) {
    const value = fixture(); change(value); assert.throws(() => parseMusePlan(JSON.stringify(value), source));
  }
  for (const raw of ["", "explanation\n{}", "null", "[]", "alert(1)", "x".repeat(2 * 1024 * 1024 + 1)]) assert.throws(() => parseMusePlan(raw, source));
});
test("same source ID remains valid when the AI formats the title or metadata updates", () => {
  const value = fixture(); value.originalTitle = `  ${source.title.normalize("NFD")}  `;
  assert.equal(parseMusePlan(JSON.stringify(value), source, "Gemini Pro").originalTitle, source.title);
  assert.equal(parseMusePlan(JSON.stringify(value), { ...source, title: `${source.title}!` }).originalTitle, `${source.title}!`);
  value.sourceId = "another-video";
  assert.throws(() => parseMusePlan(JSON.stringify(value), source), /video nguồn khác/);
});
test("Muse import refuses invalid, out-of-order, overlapping and out-of-bounds timestamps without correcting them", () => {
  for (const change of [p => { p.parts[0].segments[0].start = "00:10"; }, p => { p.parts[0].segments[0].start = -1; }, p => { p.parts[0].segments[0].end = 10; }, p => { p.parts[1].segments[0].start = 59; }, p => { p.parts[1].segments[0].end = 121; }, p => { p.parts[0].segments.push({ ...p.parts[0].segments[0], start: 5, end: 9 }); }]) {
    const value = fixture(); change(value); assert.throws(() => parseMusePlan(JSON.stringify(value), source));
  }
});
test("Muse import requires 10 unique hashtags and allows explicitly explained promotional gaps", () => {
  const value = fixture(); value.parts[0].segments = [
    { start: 10, end: 30, label: "Hook", reason: "Skip sponsor from 30 to 40", isPadding: false },
    { start: 40, end: 60, label: "Continue", reason: "After sponsor", isPadding: false },
  ];
  assert.equal(parseMusePlan(JSON.stringify(value), source).parts[0].segments.length, 2);
  for (const tags of [[], ["#one"], Array(10).fill("#same"), [...value.parts[0].hashtags.slice(0, 9), "#has space"]]) {
    const invalid = fixture(); invalid.parts[0].hashtags = tags; assert.throws(() => parseMusePlan(JSON.stringify(invalid), source));
  }
});
test("Muse accepts real supplemental repeats only at the end, within source bounds", () => {
  const value = fixture();
  value.parts[0].segments.push({ start: 80, end: 100, label: "Recap", reason: "Real footage reused", isPadding: true });
  value.parts[0].segments.push({ start: 80, end: 100, label: "Repeat", reason: "Meet minimum", isPadding: true });
  assert.throws(() => parseMusePlan(JSON.stringify(value), source), /padding/);
  const lockedPlan = structuredClone(value); lockedPlan.parts.forEach(p => p.manualLocked = true);
  assert.equal(parseMusePlan(JSON.stringify(value), source, "Muse", {lockedPlan}).parts[0].segments.length, 3);
  value.parts[0].segments.push({ start: 100, end: 110, label: "Main", reason: "Wrong placement", isPadding: false });
  assert.throws(() => parseMusePlan(JSON.stringify(value), source));
});

test('manual providers accept copied JSON envelope while preserving identity rejection and readable hashtag errors',()=>{for(const provider of ['ChatGPT web','Gemini Pro','Muse']){const p=fixture();assert.equal(parseMusePlan('Kết quả:\n```json'+JSON.stringify(p)+'```\nXong.',source,provider).parts.length,2);p.sourceId='wrong';assert.throws(()=>parseMusePlan(JSON.stringify(p),source,provider),/source|nguồn|video/i);}for(const tag of ['#tag,','#'+'a'.repeat(101),'#🙂']){const p=fixture();p.parts[0].hashtags[0]=tag;assert.throws(()=>parseMusePlan(JSON.stringify(p),source),/Part 1.*hashtag/);}const p=fixture();p.parts[0].hashtags[0]='#café';p.parts[0].hashtags[1]='#cafe\u0301';assert.throws(()=>parseMusePlan(JSON.stringify(p),source),/khác nhau/);p.parts[0].hashtags[1]='#khác';const parsed=parseMusePlan(JSON.stringify(p),source);assert.equal(parsed.parts[0].hashtags[0],'#café');});
