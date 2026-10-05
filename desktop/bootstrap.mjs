import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import net from "node:net";

const resources = path.resolve(import.meta.dirname, "..");
const appRoot = path.join(resources, "app");
const config = JSON.parse(await readFile(path.join(resources, "config.json"), "utf8"));
const supportRoot = path.join(homedir(), "Library", "Application Support", "ShortCut Studio");
const dataRoot = config.existingDataRoot && existsSync(config.existingDataRoot) ? config.existingDataRoot : path.join(supportRoot, "media");
await mkdir(dataRoot, { recursive: true });
await mkdir(path.join(dataRoot, "cache"), { recursive: true });
const xmlEscape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const fontConfig = path.join(dataRoot, "fontconfig.xml");
await writeFile(fontConfig, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><dir>${xmlEscape(path.join(appRoot, "public"))}</dir><dir>/System/Library/Fonts</dir><cachedir>${xmlEscape(path.join(dataRoot, "cache", "fontconfig"))}</cachedir></fontconfig>`);
const runtimeBin = path.join(resources, "runtime", "bin");
const childEnv = {
  ...process.env,
  PATH: `${runtimeBin}:/usr/bin:/bin:/usr/sbin:/sbin`,
  NODE_ENV: "production", HOST: "127.0.0.1", PORT: "5173",
  MEDIA_WORKER_PORT: "8787", MEDIA_WORKER_DATA_DIR: dataRoot,
  FFMPEG_PATH: path.join(runtimeBin, "ffmpeg"), FFPROBE_PATH: path.join(runtimeBin, "ffprobe"),
  YT_DLP_PATH: path.join(runtimeBin, "yt-dlp"),
  ANTIGRAVITY_CLI_PATH: path.join(runtimeBin, "agy"),
  FONTCONFIG_FILE: fontConfig,
};

async function portOccupied(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.setTimeout(1000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}
if (await portOccupied(5173) || await portOccupied(8787)) {
  throw new Error("Cổng 5173 hoặc 8787 đang có bản ShortCut Studio khác chạy. Hãy tắt bản chạy trong Terminal rồi mở app lại; không dừng render đang chạy.");
}

const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ }
  }
  setTimeout(() => {
    for (const child of children) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ } }
    process.exit(code);
  }, 3500);
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
function start(script, label) {
  const child = spawn(process.execPath, [script], { cwd: appRoot, env: childEnv, detached: true, stdio: ["ignore", "inherit", "inherit"] });
  children.add(child);
  child.once("error", (error) => { console.error(`${label}: ${error.message}`); stop(1); });
  child.once("exit", (code) => {
    children.delete(child);
    if (!stopping) { console.error(`${label} đã dừng (${code}).`); stop(code || 1); }
  });
}
start(path.join(appRoot, "worker", "server.mjs"), "Media worker");
start(path.join(appRoot, "server.js"), "Web app");
let ready = false;
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  try {
    const [worker, web] = await Promise.all([
      fetch("http://127.0.0.1:8787/health", { signal: AbortSignal.timeout(1500) }),
      fetch("http://127.0.0.1:5173/", { signal: AbortSignal.timeout(1500) }),
    ]);
    ready = worker.ok && (await worker.json()).ok && web.ok;
    if (ready) { console.log("SHORTCUT_READY"); break; }
  } catch { /* Wait until both servers are listening. */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!ready && !stopping) { console.error("Không khởi động được app. Xem log để biết chi tiết."); stop(1); }
