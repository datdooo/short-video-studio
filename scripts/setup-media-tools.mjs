import { constants, existsSync } from "node:fs";
import { access, chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const toolsDir = path.join(projectRoot, ".local-tools");
const executableName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const ytDlpPath = path.join(toolsDir, executableName);

function executableOnPath(name) {
  const pathValue = process.env.PATH || "";
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed (${response.status}) from ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const temporaryPath = `${destination}.download`;
  await writeFile(temporaryPath, bytes);
  await rename(temporaryPath, destination);
}

export async function ensureMediaTools() {
  const ffmpeg = process.env.FFMPEG_PATH || executableOnPath("ffmpeg") || (existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : null);
  const ffprobe = process.env.FFPROBE_PATH || executableOnPath("ffprobe") || (existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : null);
  if (!ffmpeg || !ffprobe) {
    throw new Error("FFmpeg/ffprobe chưa được cài. macOS: brew install ffmpeg");
  }

  const systemYtDlp = process.env.YT_DLP_PATH || executableOnPath("yt-dlp");
  if (systemYtDlp) {
    return { ffmpeg, ffprobe, ytDlp: systemYtDlp, downloaded: false };
  }

  await mkdir(toolsDir, { recursive: true });
  if (!existsSync(ytDlpPath)) {
    const asset = process.platform === "win32"
      ? "yt-dlp.exe"
      : process.platform === "darwin"
        ? "yt-dlp_macos"
        : process.platform === "linux" && process.arch === "arm64"
          ? "yt-dlp_linux_aarch64"
          : process.platform === "linux"
            ? "yt-dlp_linux"
            : "yt-dlp";
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    process.stdout.write(`Downloading yt-dlp from ${url}\n`);
    try {
      await download(url, ytDlpPath);
    } catch (error) {
      await unlink(`${ytDlpPath}.download`).catch(() => undefined);
      throw error;
    }
  }
  if (process.platform !== "win32") await chmod(ytDlpPath, 0o755);
  await access(ytDlpPath, process.platform === "win32" ? constants.F_OK : constants.X_OK);
  return { ffmpeg, ffprobe, ytDlp: ytDlpPath, downloaded: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const tools = await ensureMediaTools();
    process.stdout.write(`FFmpeg: ${tools.ffmpeg}\nyt-dlp: ${tools.ytDlp}\nMedia tools are ready.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
