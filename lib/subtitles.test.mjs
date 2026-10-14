import test from "node:test";
import assert from "node:assert/strict";
import { parseCaptions, partCaptions, wrapCaption, subtitleStyle, subtitleY, sourceCaptionTrack, isCurrentCaptionRequest } from "./subtitles.mjs";
test("VTT/SRT retain fractional source timing and clean inline markup/rolling duplicates", () => {
  const cues = parseCaptions("WEBVTT\n\n00:00:01.125 --> 00:00:03.250\n<v Speaker>Hello &amp; welcome.</v>\n\n00:00:03.250 --> 00:00:04.500\nHello &amp; welcome. New sentence.\n\n00:00:04.500 --> 00:00:05.500\nNew sentence.");
  assert.deepEqual(cues, [{ start: 1.125, end: 3.25, text: "Hello & welcome." }, { start: 3.25, end: 5.5, text: "New sentence." }]);
  assert.equal(parseCaptions("1\n00:01:00,500 --> 00:01:01,500\n日本語です。")[0].start, 60.5);
});
test("subtitle timing follows cuts, ad gaps, reused footage and 125% playback", () => {
  const cues = [{ start: 10, end: 12, text: "First" }, { start: 22, end: 24, text: "Second" }];
  const part = { segments: [{ start: 11, end: 15 }, { start: 20, end: 25 }, { start: 10, end: 15, isPadding: true }] };
  const result = partCaptions(cues, part);
  assert.deepEqual(result.map(({ start, end }) => [start / 1.25, end / 1.25]), [[0, 0.8], [4.8, 6.4], [7.2, 8.8]]);
});
test("all scripts wrap within two lines per timed chunk and subtitle position avoids titles", () => {
  for (const text of ["日本語の字幕が長い時も画面からはみ出さず自然に改行されます。".repeat(6), "한국어 자막은 화면에 맞게 자동으로 줄바꿈합니다. ".repeat(10), "German French English accents ÄÖÜ éèç remain readable. ".repeat(10)]) {
    for (const chunk of wrapCaption(text, 72)) assert.ok(chunk.split("\n").length <= 2);
  }
  for (const position of ["top", "center", "bottom"]) {
    const style = subtitleStyle({ position, size: 72 });
    assert.ok(subtitleY(style) > 285 && subtitleY(style) < 1635);
  }
  assert.equal(subtitleStyle({ color: "<script>", size: 999, font: "../x" }).size, 72);
  assert.equal(subtitleY(subtitleStyle({ position: 'bottom' })), 1476);
  assert.equal(subtitleY(subtitleStyle({ position: 'bottom' }), 720), 1378);
  assert.equal(subtitleStyle({ source: 'whisper' }).source, 'whisper');
});

test("real YouTube EOF mismatch is clipped once to source, without mutating input or removing validation", () => {
  const source = { id: "correct", duration: 683.177506 };
  const raw = { sourceId: source.id, cues: [{ start: 680.2, end: 683.36, text: "Last sentence" }] };
  const track = sourceCaptionTrack(raw, source);
  assert.equal(track.cues[0].end, source.duration); assert.equal(raw.cues[0].end, 683.36);
  assert.equal(track.timeline, "source"); assert.equal(track.sourceDuration, source.duration);
  assert.deepEqual(sourceCaptionTrack(track, source), track);
  assert.throws(() => sourceCaptionTrack({ ...raw, sourceId: "other" }, source), /source khác/);
  assert.throws(() => sourceCaptionTrack({ ...raw, timeline: "part" }, source), /timestamp gốc/);
  assert.throws(() => sourceCaptionTrack({ ...raw, sourceDuration: 600 }, source), /Thời lượng source/);
  assert.throws(() => sourceCaptionTrack({ ...raw, cues: [{ start: 680, end: 900, text: "Wrong timeline" }] }, source), /vượt quá source/);
});

test("original-time captions remap after custom times and Smart Cut, including exclusions and 125%", () => {
  const source = { id: "correct", duration: 100 };
  const track = sourceCaptionTrack({ sourceId: source.id, cues: [{ start: 10, end: 14, text: "First" }, { start: 20, end: 24, text: "Excluded ad" }, { start: 32, end: 36, text: "Last" }] }, source);
  const edited = { segments: [{ start: 11, end: 18 }, { start: 30, end: 40 }] };
  assert.deepEqual(partCaptions(track.cues, edited).map(({ start, end, text }) => [start / 1.25, end / 1.25, text]), [[0, 2.4, "First"], [7.2, 10.4, "Last"]]);
  const manual = { segments: [{ start: 12.5, end: 17 }, { start: 34, end: 38 }] };
  assert.deepEqual(partCaptions(track.cues, manual).map(({ start, end }) => [start / 1.25, end / 1.25]), [[0, 1.2], [3.6, 5.2]]);
  assert.equal(track.cues[0].start, 10, "Custom/AI cuts must not rewrite cached source times");
});

test("validation rejects invalid timestamps/order; a small out-of-media EOF cue has no display interval", () => {
  const source = { id: "correct", duration: 10 };
  const wrap = (cues) => ({ sourceId: source.id, cues });
  for (const cue of [{ start: -1, end: 2, text: "Bad" }, { start: 2, end: 2, text: "Bad" }, { start: 2, end: Infinity, text: "Bad" }, { start: "1", end: 2, text: "Bad" }]) assert.throws(() => sourceCaptionTrack(wrap([cue]), source), /không hợp lệ|vượt quá/);
  assert.throws(() => sourceCaptionTrack(wrap([{ start: 3, end: 4, text: "Later" }, { start: 1, end: 2, text: "Earlier" }]), source), /thứ tự/);
  assert.deepEqual(sourceCaptionTrack(wrap([{ start: 10.1, end: 10.2, text: "Outside" }]), source).cues, []);
});

test("repeated words separated by silence are not stretched across the gap", () => {
  const cues = parseCaptions("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n\n00:00:05.000 --> 00:00:06.000\nHello");
  assert.deepEqual(cues, [{ start: 1, end: 2, text: "Hello" }, { start: 5, end: 6, text: "Hello" }]);
});
test("overlapping provider captions use the same unambiguous intervals in preview and export", () => {
  const track = sourceCaptionTrack({ sourceId: "correct", cues: [{ start: 1, end: 4, text: "First" }, { start: 3, end: 6, text: "Next" }] }, { id: "correct", duration: 10 });
  assert.equal(track.cues[0].end, 3); assert.equal(track.cues[1].start, 3);
});

test("late subtitle responses cannot overwrite a new source or a regenerated track", () => {
  const request = { sourceId: "source-a", serial: 1, selectionEpoch: 2 };
  assert.equal(isCurrentCaptionRequest(request, request), true);
  assert.equal(isCurrentCaptionRequest(request, { ...request, sourceId: "source-b" }), false);
  assert.equal(isCurrentCaptionRequest(request, { ...request, serial: 2 }), false);
  assert.equal(isCurrentCaptionRequest(request, { ...request, selectionEpoch: 3 }), false);
});
