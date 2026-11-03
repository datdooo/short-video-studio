#!/usr/bin/env node
// Read-only: writes the v24 TXT for one saved snapshot so it can be compared by hand against a v23 export.
//   node scripts/make-paired-txt.mjs <snapshotPrefix> <outDir> [dataRoot]
// The TXT contains the user's own transcript/comments: keep the output private.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { EDIT_PLAN_SCHEMA } from "../lib/edit-plan.ts";
import { buildMusePrompt } from "../lib/muse-plan.mjs";
import { buildExternalEditingContext } from "../worker/external-editing-context.mjs";

const [prefix, outDir, rootArg] = process.argv.slice(2);
if (!prefix || !outDir) {
  console.error("usage: make-paired-txt.mjs <snapshotPrefix> <outDir> [dataRoot]");
  process.exit(2);
}
const root = rootArg || path.join(homedir(), "Library", "Application Support", "ShortCut Studio Beta", "media");
const dir = path.join(root, "cache", "external-prompt-snapshots");
const file = readdirSync(dir).find((name) => name.startsWith(prefix));
if (!file) throw new Error("snapshot not found");
const saved = JSON.parse(readFileSync(path.join(dir, file), "utf8")).value;
const source = JSON.parse(readFileSync(path.join(root, "sources", saved.captionTrack.sourceId, "source.json"), "utf8"));
const cues = saved.captionTrack.cues;
const options = { cues, boundaryCues: cues, captionTrack: saved.captionTrack, local: saved.local, transcript: String(source.transcript ?? ""), instruction: "", supplementalPrompt: "" };
const body = { requestId: "0".repeat(32), provider: "chatgpt-web", transcript: String(source.transcript ?? "") };
const external = buildExternalEditingContext(source, saved.context, options, saved.input, body);
const text = buildMusePrompt("", EDIT_PLAN_SCHEMA, source, { requestId: body.requestId, analysisKey: external.analysisKey, context: external });
mkdirSync(outDir, { recursive: true, mode: 0o700 });
writeFileSync(path.join(outDir, `txt-v24-${prefix}.txt`), text, { mode: 0o600 });
console.log(`wrote ${path.join(outDir, `txt-v24-${prefix}.txt`)} (${Buffer.byteLength(text, "utf8")} bytes)`);
