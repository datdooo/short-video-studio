import { spawn } from "node:child_process";
import { setPriority } from "node:os";
import path from "node:path";
import { balancedFfmpegArgs } from "./media-resources.mjs";
/** One worker-owned domain; shared services are read at operation entry. */
export function createCommandRunner(read) {
  async function run(binary, args, options = {}) {
    const { ffmpeg, ffprobe, mediaResources, metadataResources, whisper } = read();

    if (ffprobe && binary === ffprobe) {
      const inherited = mediaResources.currentSignal(),
        exportOwner = mediaResources.currentKind() === "render";
      const parent = AbortSignal.any([options.signal, inherited].filter(Boolean));
      // Heavy-lease validation gets the next probe slot, not the background FIFO.
      // Its execution deadline starts at spawn, so waiting behind one live probe
      // cannot consume the time budget of an otherwise completed export.
      let timeout = exportOwner ? undefined : AbortSignal.timeout(30_000);
      const bounded = timeout ? AbortSignal.any([parent, timeout]) : parent;
      try {
        return await metadataResources.use(
          exportOwner ? "render" : "probe",
          (signal) => {
            timeout ||= AbortSignal.timeout(30_000);
            return runCommand(binary, args, {
              ...options,
              signal: AbortSignal.any([signal, timeout]),
              lowerPriority: true,
            });
          },
          bounded,
        );
      } catch (error) {
        parent.throwIfAborted();
        if (timeout?.aborted)
          throw Object.assign(new Error("Kiểm tra video quá 30 giây. Thử chuẩn bị nguồn lại sau."), {
            code: "MEDIA_PROBE_TIMEOUT",
            status: 504,
          });
        if (error.code === "MEDIA_QUEUE_FULL")
          throw Object.assign(new Error("Đang có nhiều lượt kiểm tra video. Thử lại sau."), {
            code: "MEDIA_PROBE_BUSY",
            status: 429,
          });
        throw error;
      }
    }
    const heavy = binary && (binary === ffmpeg || binary === whisper);
    if (heavy) {
      const state = mediaResources.commandState();
      if (!mediaResources.ownsLease() && (state.active || state.waiting))
        options.onQueued?.(state.renderBusy ? "render" : "analysis");
      return mediaResources.use(
        "analysis",
        (signal) => {
          options.onStart?.();
          return runCommand(
            binary,
            binary === ffmpeg ? balancedFfmpegArgs(args, { filterComplexThreads: options.filterComplexThreads, inputThreads: options.inputThreads }) : args,
            { ...options, signal, lowerPriority: true },
          );
        },
        options.signal,
      );
    }
    return runCommand(binary, args, options);
  }

  async function runCommand(binary, args, options = {}) {
    const { commandLifecycle, projectRoot } = read();

    commandLifecycle.assertRunning();
    options.signal?.throwIfAborted();
    if (!binary) throw new Error(options.missingMessage || "Thiếu binary cần thiết.");
    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, {
        cwd: options.cwd || projectRoot,
        env: { ...process.env, ...options.env },
        stdio: ["ignore", "pipe", "pipe"],
        detached: Boolean(options.signal) && process.platform !== "win32",
        windowsHide: true,
      });
      commandLifecycle.track(child, Boolean(options.signal) && process.platform !== "win32");
      if (options.lowerPriority && Number.isInteger(child.pid)) {
        try {
          setPriority(child.pid, 10);
        } catch {
          /* OS may not support priority adjustment; thread limits still apply. */
        }
      }
      let killTimer;
      const kill = (signal) => {
        if (!Number.isInteger(child.pid) || child.pid <= 0) return;
        try {
          if (options.signal && process.platform !== "win32") process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          /* The process may already have exited. */
        }
      };
      const abort = () => {
        kill("SIGTERM");
        killTimer = setTimeout(() => kill("SIGKILL"), 3000);
        killTimer.unref();
      };
      const cleanup = () => {
        clearTimeout(killTimer);
        options.signal?.removeEventListener("abort", abort);
      };
      options.signal?.addEventListener("abort", abort, { once: true });
      if (options.signal?.aborted) abort();
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout = `${stdout}${chunk}`.slice(-(options.maxStdout || 100_000));
        options.onStdout?.(chunk.toString());
      });
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-100_000);
        options.onStderr?.(chunk.toString());
      });
      child.once("error", (error) => {
        cleanup();
        reject(error);
      });
      child.once("close", (code) => {
        cleanup();
        if (options.signal?.aborted) {
          reject(options.signal.reason);
          return;
        }
        if (code === 0) resolve({ stdout, stderr });
        else
          reject(new Error((stderr || stdout || `${path.basename(binary)} exited with ${code}`).trim().slice(-5_000)));
      });
    });
  }
  return { run };
}
