import { existsSync } from "node:fs";
import { lstat, mkdir } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

const identities = {
  production: { name: "ShortCut Studio", bundleId: "local.datdo.shortcutstudio", webPort: 5173, workerPort: 8787 },
  development: { name: "ShortCut Studio Dev", bundleId: "local.datdo.shortcutstudio.dev", webPort: 5273, workerPort: 8887 },
};

export function resolveRuntime({ profile = "production", home = homedir(), existingDataRoot, exists = existsSync } = {}) {
  const identity = identities[profile];
  if (!identity) throw new Error(`Unknown runtime profile: ${profile}`);
  const isolated = profile === "development";
  const supportRoot = path.join(home, "Library", "Application Support", identity.name);
  const dataRoot = !isolated && existingDataRoot && exists(existingDataRoot) ? existingDataRoot : path.join(supportRoot, "media");
  return {
    ...identity, profile, isolated, supportRoot, dataRoot,
    webOrigin: `http://127.0.0.1:${identity.webPort}`,
    workerOrigin: `http://127.0.0.1:${identity.workerPort}`,
    credentialService: `${identity.name} ChatGPT`,
  };
}

// One environment boundary for source development and the packaged macOS app.
export function runtimeEnvironment(runtime, inherited = process.env) {
  const env = { ...inherited };
  if (runtime.isolated) {
    for (const key of Object.keys(env)) {
      if (/TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|COOKIE/i.test(key)
        || /^(MEDIA_WORKER_|CHATGPT_|ANTIGRAVITY_|GOOGLE_|GEMINI_|AGY_|XDG_|NEXT_PUBLIC_|FONTCONFIG_|NODE_OPTIONS$|NODE_PATH$|npm_config_)/.test(key)) delete env[key];
    }
    Object.assign(env, {
      SHORTCUT_RUNTIME_PROFILE: "development",
      HOME: path.join(runtime.supportRoot, "home"),
      CFFIXED_USER_HOME: path.join(runtime.supportRoot, "home"),
      XDG_CONFIG_HOME: path.join(runtime.supportRoot, "home", ".config"),
      XDG_CACHE_HOME: path.join(runtime.supportRoot, "home", ".cache"),
      XDG_DATA_HOME: path.join(runtime.supportRoot, "home", ".local", "share"),
      TMPDIR: path.join(runtime.supportRoot, "tmp"),
      MEDIA_WORKER_DISABLE_LEGACY: "1",
      CHATGPT_KEYCHAIN_SERVICE: runtime.credentialService,
    });
  }
  return {
    ...env, HOST: "127.0.0.1", PORT: String(runtime.webPort),
    MEDIA_WORKER_PORT: String(runtime.workerPort), MEDIA_WORKER_DATA_DIR: runtime.dataRoot,
    NEXT_PUBLIC_MEDIA_WORKER_ORIGIN: runtime.workerOrigin,
  };
}

export async function prepareRuntimeDirectories(runtime) {
  if (!runtime.isolated) return;
  const env = runtimeEnvironment(runtime, {});
  for (const directory of [runtime.supportRoot, runtime.dataRoot, env.HOME, env.XDG_CONFIG_HOME, env.XDG_CACHE_HOME, env.XDG_DATA_HOME, env.TMPDIR]) {
    // Preserve unexpected existing paths rather than following links into another app.
    let cursor = directory;
    while (cursor !== path.dirname(runtime.supportRoot)) {
      const info = await lstat(cursor).catch((error) => { if (error.code !== "ENOENT") throw error; });
      if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error(`DEV directory must be a real directory: ${cursor}`);
      cursor = path.dirname(cursor);
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
}

export function macPackageTarget({ development = false, compatible26 = false, projectRoot }) {
  if (development && compatible26) throw new Error("DEV and macOS 26 targets must be built separately.");
  const runtime = resolveRuntime({ profile: development ? "development" : "production" });
  const releaseRoot = path.join(projectRoot, "release", ...(development ? ["dev"] : compatible26 ? ["macos-26"] : []));
  return {
    runtime, releaseRoot, appName: `${runtime.name}.app`,
    outputAppPath: path.join(releaseRoot, `${runtime.name}.app`),
    config: {
      profile: runtime.profile,
      webPort: runtime.webPort,
      workerPort: runtime.workerPort,
      existingDataRoot: development || compatible26 ? null : path.join(projectRoot, "worker-data"),
    },
  };
}

export async function assertRuntimePortsAvailable(runtime) {
  for (const port of [runtime.webPort, runtime.workerPort]) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", () => reject(new Error(`${runtime.name}: port ${port} is unavailable. Existing processes were left running.`)));
      probe.listen(port, "127.0.0.1", () => probe.close(resolve));
    });
  }
}
