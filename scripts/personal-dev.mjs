import { spawn } from "node:child_process";
import path from "node:path";

import { resolveRuntime, runtimeEnvironment, prepareRuntimeDirectories, assertRuntimePortsAvailable } from "../desktop/runtime-config.mjs";

import { ensureMediaTools } from "./setup-media-tools.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
const isolated = process.argv.includes("--isolated");
const runtime = resolveRuntime({ profile: isolated ? "development" : "production" });
const childEnv = isolated ? {
  ...runtimeEnvironment(runtime),
  PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ""}`,
  SHORTCUT_PERSONAL_BUILD: "1",
} : process.env;

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: childEnv,
    detached: isolated,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    process.stderr.write(`${name}: ${error.message}\n`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (isolated && stopping) return;
    if (isolated && !stopping) { shutdown(code || 1); return; }
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
    if (isolated) {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ }
    } else if (!child.killed) child.kill("SIGTERM");
  }
  if (isolated) {
    setTimeout(() => {
      for (const child of children) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ } }
      process.exit(code);
    }, 3500);
  } else setTimeout(() => process.exit(code), 250).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  if (isolated) {
    await assertRuntimePortsAvailable(runtime);
    await prepareRuntimeDirectories(runtime);
  }
  const tools = await ensureMediaTools();
  if (isolated) Object.assign(childEnv, { FFMPEG_PATH: tools.ffmpeg, FFPROBE_PATH: tools.ffprobe, YT_DLP_PATH: tools.ytDlp });
  process.stdout.write(`Media tools ready: ${tools.ytDlp}\n`);
  start(process.execPath, ["worker/server.mjs"], "Media worker");
  if (isolated) start(process.execPath, ["scripts/run-framework.mjs", "dev", "--port", String(runtime.webPort), "--hostname", "127.0.0.1"], "Web app");
  else start(npmCommand, ["run", "dev", "--", "--port", "5173"], "Web app");
  process.stdout.write(`\n${runtime.name}: ${runtime.webOrigin}\nMedia worker: ${runtime.workerOrigin}\n${isolated ? `DEV data: ${runtime.dataRoot}\nLegacy lookup: disabled\n` : ""}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
