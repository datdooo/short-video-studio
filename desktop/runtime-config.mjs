import { existsSync } from "node:fs";
import { lstat, mkdir } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

const identities = { beta: { name: "ShortCut Studio Beta", bundleId: "local.datdo.shortcutstudio.beta", webPort: 5373, workerPort: 8987 } };

export function resolveRuntime({ profile = "beta", home = homedir(), platform = process.platform, localAppData = process.env.LOCALAPPDATA, supportRoot: suppliedSupportRoot, existingDataRoot } = {}) {
  const identity = identities[profile];
  if (!identity) throw new Error(`This checkout only supports the Beta profile: ${profile}`);
  if (existingDataRoot) throw new Error("Beta cannot use an existing DEV/production data root.");
  const p = platform === 'win32' ? path.win32 : path;
  if (platform === 'win32' && !suppliedSupportRoot && (!localAppData || !p.isAbsolute(localAppData))) throw new Error('LOCALAPPDATA must be absolute.');
  const supportRoot = suppliedSupportRoot || (platform === 'win32' ? p.join(localAppData, identity.name) : p.join(home, "Library", "Application Support", identity.name));
  if (!p.isAbsolute(supportRoot) || p.basename(supportRoot) !== identity.name) throw new Error('Invalid Beta support root.');
  return { ...identity, profile, platform, isolated: true, supportRoot, dataRoot: p.join(supportRoot, 'media'),
    webOrigin: `http://127.0.0.1:${identity.webPort}`, workerOrigin: `http://127.0.0.1:${identity.workerPort}`,
    credentialService: `${identity.name} ChatGPT` };
}

// One environment boundary for source development and the packaged macOS app.
export function runtimeEnvironment(runtime, inherited = process.env) {
  const env = { ...inherited };
  const p = runtime.platform === "win32" ? path.win32 : path;
  if (runtime.isolated) {
    for (const key of Object.keys(env)) {
      if (/TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|ACCESS_KEY|COOKIE/i.test(key)
        || /^(MEDIA_WORKER_|CHATGPT_|ANTIGRAVITY_|GOOGLE_|GEMINI_|AGY_|XDG_|NEXT_PUBLIC_|FONTCONFIG_|NODE_OPTIONS$|NODE_PATH$|npm_config_)/.test(key)) delete env[key];
    }
    Object.assign(env, {
      SHORTCUT_RUNTIME_PROFILE: runtime.profile,
      SHORTCUT_BETA_SUPPORT_ROOT: runtime.supportRoot,
      HOME: p.join(runtime.supportRoot, "home"),
      CFFIXED_USER_HOME: p.join(runtime.supportRoot, "home"),
      XDG_CONFIG_HOME: p.join(runtime.supportRoot, "home", ".config"),
      XDG_CACHE_HOME: p.join(runtime.supportRoot, "home", ".cache"),
      XDG_DATA_HOME: p.join(runtime.supportRoot, "home", ".local", "share"),
      TMPDIR: p.join(runtime.supportRoot, "tmp"),
      TEMP: p.join(runtime.supportRoot, "tmp"), TMP: p.join(runtime.supportRoot, "tmp"),
      ...(runtime.platform === "win32" ? { USERPROFILE: p.join(runtime.supportRoot, "home"), APPDATA: p.join(runtime.supportRoot, "home", "AppData", "Roaming"), LOCALAPPDATA: p.join(runtime.supportRoot, "home", "AppData", "Local") } : {}),
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
  for (const directory of [runtime.supportRoot, runtime.dataRoot, env.HOME, env.XDG_CONFIG_HOME, env.XDG_CACHE_HOME, env.XDG_DATA_HOME, env.TMPDIR, ...(runtime.platform === "win32" ? [env.APPDATA, env.LOCALAPPDATA] : [])]) {
    // Preserve unexpected existing paths rather than following links into another app.
    let cursor = directory;
    while (cursor !== path.dirname(runtime.supportRoot)) {
      const info = await lstat(cursor).catch((error) => { if (error.code !== "ENOENT") throw error; });
      if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error(`Beta directory must be a real directory: ${cursor}`);
      cursor = path.dirname(cursor);
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
}

export function macPackageTarget({ beta = false, development = false, compatible26 = false, projectRoot }) {
  if (!beta || development || compatible26) throw new Error("Use --beta in this maintenance checkout; DEV/production targets are unavailable.");
  const runtime = resolveRuntime({ profile: 'beta' });
  const releaseRoot = path.join(projectRoot, 'release', 'beta');
  return { runtime, releaseRoot, appName: `${runtime.name}.app`, outputAppPath: path.join(releaseRoot, `${runtime.name}.app`),
    config: { profile: runtime.profile, webPort: runtime.webPort, workerPort: runtime.workerPort, existingDataRoot: null } };
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
