import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
export function findOnPath(name) {
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}
export function resolveBinary(environmentName, name, fallbacks = []) {
  const configured = process.env[environmentName];
  const candidates = [configured, findOnPath(name), ...fallbacks].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || null;
}
export function supportsEncoder(binary, encoder) {
  if (!binary) return false;
  const result = spawnSync(binary, ["-hide_banner", "-h", `encoder=${encoder}`], {
    encoding: "utf8",
    timeout: 5_000,
    windowsHide: true,
  });
  return result.status === 0 && !result.stderr.includes("not recognized");
}
export function binaryVersion(binary, args = ["--version"]) {
  if (!binary) return null;
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 5_000, windowsHide: true });
  return result.status === 0 ? result.stdout.trim().split("\n")[0] : null;
}
