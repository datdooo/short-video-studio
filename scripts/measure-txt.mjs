#!/usr/bin/env node
// Read-only: rebuilds the real manual-web TXT from saved TXT snapshots and reports sizes.
// Never writes to the data root, never prints transcript/comment content.
//   node scripts/measure-txt.mjs [dataRoot] [--json out.json]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { EDIT_PLAN_SCHEMA } from "../lib/edit-plan.ts";
import { buildMusePrompt } from "../lib/muse-plan.mjs";
import { canonicalVideoInput } from "../lib/video-ai-input.mjs";
import { buildExternalEditingContext } from "../worker/external-editing-context.mjs";

const args = process.argv.slice(2);
const jsonIndex = args.indexOf("--json");
const jsonOut = jsonIndex >= 0 ? args.splice(jsonIndex, 2)[1] : null;
const dataRoot = args[0] || path.join(homedir(), "Library", "Application Support", "ShortCut Studio", "media");
const snapshotDir = path.join(dataRoot, "cache", "external-prompt-snapshots");

const size = (value) => (value === undefined ? 0 : JSON.stringify(value).length);
const median = (values) => (values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0);
const tokens = (text) => Math.ceil(Buffer.byteLength(text, "utf8") / 4); // rough, language-agnostic estimate

function measure(file) {
  const saved = JSON.parse(readFileSync(path.join(snapshotDir, file), "utf8")).value;
  const sourceId = saved?.captionTrack?.sourceId;
  if (!sourceId) return { file: file.slice(0, 8), skipped: "no source id" };
  let source;
  try {
    source = JSON.parse(readFileSync(path.join(dataRoot, "sources", sourceId, "source.json"), "utf8"));
  } catch {
    return { file: file.slice(0, 8), skipped: "source record missing" };
  }
  const cues = saved.captionTrack.cues || [];
  const options = {
    cues, boundaryCues: cues, captionTrack: saved.captionTrack, local: saved.local,
    transcript: String(source.transcript ?? ""), instruction: "", supplementalPrompt: "", sourceMediaBytes: null,
  };
  const body = { requestId: "0".repeat(32), provider: "chatgpt-web", transcript: String(source.transcript ?? "") };
  const external = buildExternalEditingContext(source, saved.context, options, saved.input, body);
  const text = buildMusePrompt("", EDIT_PLAN_SCHEMA, source, { requestId: body.requestId, analysisKey: external.analysisKey, context: external });
  const { rules, captionTrack, ...evidence } = external;
  const packed = canonicalVideoInput(evidence, { enforceLimit: false, deduplicateExactValues: true });
  const raw = JSON.stringify(evidence);
  const sections = Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, size(value)]).sort((a, b) => b[1] - a[1]).slice(0, 8));
  const cueLengths = cues.map((cue) => String(cue.text || "").length);
  const ended = cues.filter((cue) => /[.!?…。！？]["')\]]?\s*$/.test(String(cue.text || ""))).length;
  return {
    file: file.slice(0, 8), durationSeconds: Math.round(source.duration), kind: source.kind,
    txtChars: text.length, txtBytes: Buffer.byteLength(text, "utf8"), estTokens: tokens(text),
    evidenceRawChars: raw.length, evidencePackedChars: JSON.stringify(packed.value).length, packedEncoded: packed.encoded,
    rulesChars: size(rules), captionTrackChars: size(captionTrack),
    topSections: sections,
    cueCount: cues.length, medianCueChars: median(cueLengths), cueEndsSentencePct: cues.length ? Math.round((100 * ended) / cues.length) : null,
    cuesPerMinute: source.duration ? Math.round((cues.length / source.duration) * 60) : null,
    hasHeatmap: external.videoEvidence?.sourceContext?.heatmap?.status === "available" || undefined,
  };
}

const rows = [];
for (const file of readdirSync(snapshotDir).filter((name) => name.endsWith(".json"))) {
  try {
    rows.push(measure(file));
  } catch (error) {
    rows.push({ file: file.slice(0, 8), skipped: `error: ${String(error.message).slice(0, 80)}` });
  }
}
const ok = rows.filter((row) => !row.skipped);
const stat = (key) => {
  const values = ok.map((row) => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
  return values.length ? { min: values[0], median: values[Math.floor(values.length / 2)], max: values.at(-1) } : null;
};
const summary = {
  snapshots: rows.length, measured: ok.length, skipped: rows.length - ok.length,
  txtBytes: stat("txtBytes"), estTokens: stat("estTokens"), evidenceRawChars: stat("evidenceRawChars"),
  evidencePackedChars: stat("evidencePackedChars"), rulesChars: stat("rulesChars"), captionTrackChars: stat("captionTrackChars"),
  cueCount: stat("cueCount"), medianCueChars: stat("medianCueChars"), cueEndsSentencePct: stat("cueEndsSentencePct"), cuesPerMinute: stat("cuesPerMinute"),
  packedEncoded: ok.filter((row) => row.packedEncoded).length,
};
console.log(JSON.stringify(summary, null, 2));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ summary, rows }, null, 2));
