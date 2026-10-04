import { spawn } from "node:child_process";
import path from "node:path";

import { ensureMediaTools } from "./setup-media-tools.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal || code === 0) return;
    process.stderr.write(`${name} stopped with exit code ${code}.\n`);
    shutdown(code || 1);
  });
  return child;
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  const tools = await ensureMediaTools();
  process.stdout.write(`Media tools ready: ${tools.ytDlp}\n`);
  start(process.execPath, ["worker/server.mjs"], "Media worker");
  start(npmCommand, ["run", "dev", "--", "--port", "5173"], "Web app");
  process.stdout.write("\nShortCut Studio: http://127.0.0.1:5173\nMedia worker:    http://127.0.0.1:8787\n\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
