#!/usr/bin/env node
// Delegate ONE mechanical task to Codex in an isolated git worktree, with guardrails.
//   node scripts/delegate-codex.mjs <task.md> [--worktree auto|<dir>] [--effort low|medium|high]
//                                   [--full-access] [--verify] [--dry-run]
// The task file must declare its kind on a line "Loại: <kind>" (see docs/DELEGATION.md).
// Core logic is never delegated: kinds outside MECHANICAL are refused.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

const MECHANICAL = new Set(["docs", "ui", "ui-css", "test-scaffold", "script-update", "rename", "cleanup"]);
const CORE = new Set(["logic-lõi", "logic-loi", "core", "prompt", "pipeline", "security"]);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const taskFile = args.find((arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--worktree" && args[args.indexOf(arg) - 1] !== "--effort");
if (!taskFile) {
  console.error("usage: delegate-codex.mjs <task.md> [--worktree auto|dir] [--effort low|medium|high] [--full-access] [--verify] [--dry-run]");
  process.exit(2);
}
const git = (cwd, ...rest) => execFileSync("git", rest, { cwd, encoding: "utf8" }).trim();
const repo = git(process.cwd(), "rev-parse", "--show-toplevel");
const text = readFileSync(path.resolve(taskFile), "utf8");
const kind = /^\s*Loại:\s*([^\s#]+)/im.exec(text)?.[1]?.toLowerCase();
if (!kind) throw new Error("Task file needs a line 'Loại: <kind>'. Allowed: " + [...MECHANICAL].join(", "));
if (CORE.has(kind) || !MECHANICAL.has(kind)) throw new Error(`Refused: kind '${kind}' is core logic or unknown. Do it directly (Claude), not through Codex.`);

const effort = option("--effort", "high");
if (!["low", "medium", "high"].includes(effort)) throw new Error("effort must be low|medium|high");
const slug = path.basename(taskFile, path.extname(taskFile)).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
let cwd = repo;
const wt = option("--worktree", "auto");
if (wt === "auto") {
  cwd = path.join(path.dirname(repo), `${path.basename(repo)}-wt-codex-${slug}`);
  if (!existsSync(cwd)) {
    git(repo, "worktree", "add", "-q", "-b", `codex/${slug}-${stamp}`, cwd, "HEAD");
    if (existsSync(path.join(repo, "node_modules"))) symlinkSync(path.join(repo, "node_modules"), path.join(cwd, "node_modules"));
  }
} else if (wt !== "none") cwd = path.resolve(wt);

// Safety baseline for paths Codex must never touch (full access has no sandbox).
const devRepo = path.join(path.dirname(repo), "short-video-studio-visual-dev");
const devData = path.join(homedir(), "Library", "Application Support", "ShortCut Studio Dev");
const newest = (dir) => {
  let max = 0, count = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        count += 1;
        max = Math.max(max, statSync(full).mtimeMs);
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return `${count}:${Math.round(max)}`;
};
const snapshot = () => ({
  devHead: existsSync(devRepo) ? git(devRepo, "rev-parse", "HEAD") : null,
  devDirty: existsSync(devRepo) ? git(devRepo, "status", "--short").split("\n").filter(Boolean).length : null,
  devData: newest(devData),
  mainHead: git(repo, "rev-parse", "HEAD"),
});
const before = snapshot();

const guard = [
  `Loại việc: ${kind} (cơ học). KHÔNG sửa logic lõi (pipeline, prompt, cầu nối Codex, tín hiệu, bảo mật).`,
  `Chỉ làm trong: ${cwd}. KHÔNG đụng ${repo} (nếu khác), ${devRepo}, ${devData}, ~/Library/Application Support/ShortCut Studio*, /Applications/*.`,
  "Không build/package/push/merge, không gọi AI/ASR/render/tải video, không chạy codex exec.",
  "Chạy npx tsc --noEmit, npm run lint và test liên quan sau khi sửa; báo kết quả thật. KHÔNG commit (người giao việc sẽ review rồi commit).",
].join("\n");
const prompt = `${guard}\n\n---\n${text}`;
const out = path.join(tmpdir(), `codex-${slug}-${stamp}.txt`);
const codexArgs = ["exec", "-m", "gpt-6.1-sol", "-c", `model_reasoning_effort="${effort}"`, "--sandbox", flag("--full-access") ? "danger-full-access" : "workspace-write", "-C", cwd, "-o", out, "-"];
console.log(JSON.stringify({ kind, cwd, effort, sandbox: codexArgs[codexArgs.indexOf("--sandbox") + 1], output: out }, null, 2));
if (flag("--dry-run")) process.exit(0);

const child = spawn("codex", codexArgs, { cwd, stdio: ["pipe", "inherit", "inherit"] });
child.stdin.end(prompt);
child.on("close", (code) => {
  const after = snapshot();
  const touched = Object.keys(before).filter((key) => key !== "mainHead" && before[key] !== after[key]);
  console.log(`\ncodex exit ${code}. Safety check: ${touched.length ? "CHANGED " + touched.join(", ") : "DEV repo/data unchanged"}${before.mainHead !== after.mainHead ? "; main checkout HEAD moved" : ""}`);
  console.log(git(cwd, "status", "--short") || "(no changes)");
  if (flag("--verify") && code === 0) {
    for (const cmd of [["npx", "tsc", "--noEmit"], ["npm", "run", "lint"]]) {
      try {
        execFileSync(cmd[0], cmd.slice(1), { cwd, stdio: "inherit" });
      } catch {
        console.error(`verify failed: ${cmd.join(" ")}`);
        process.exitCode = 1;
      }
    }
  }
  console.log(`Last message: ${out}\nReview with: git -C ${cwd} diff`);
  process.exit(code === 0 && !touched.length ? process.exitCode || 0 : 1);
});
void mkdirSync;
