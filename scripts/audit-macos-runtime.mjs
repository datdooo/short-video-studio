import { spawnSync } from "node:child_process";
import { open, readdir } from "node:fs/promises";
import path from "node:path";

const magic = new Set(["cffaedfe", "cefaedfe", "feedfacf", "feedface", "cafebabe", "bebafeca", "cafebabf", "bfbafeca"]);
function newerThan(version, maximum) {
  const actual = version.split(".").map(Number);
  const target = maximum.split(".").map(Number);
  for (let index = 0; index < Math.max(actual.length, target.length); index++) {
    if ((actual[index] || 0) !== (target[index] || 0)) return (actual[index] || 0) > (target[index] || 0);
  }
  return false;
}
function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`Cannot inspect ${args.at(-1)}: ${result.error?.message || result.stderr}`);
  return result.stdout;
}
export async function auditMacOSRuntime(root, maximum = "26.0") {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(filename);
      else if (entry.isFile()) {
        const handle = await open(filename, "r");
        const bytes = Buffer.alloc(4);
        try { await handle.read(bytes, 0, 4, 0); } finally { await handle.close(); }
        if (magic.has(bytes.toString("hex"))) files.push(filename);
      }
    }
  }
  await walk(root);
  const report = [];
  for (const filename of files) {
    const architectures = run("/usr/bin/lipo", ["-archs", filename]).trim().split(/\s+/);
    if (!architectures.includes("arm64")) throw new Error(`Missing Apple Silicon architecture: ${filename}`);
    const builds = run("/usr/bin/otool", ["-l", filename]);
    const versions = [...builds.matchAll(/\bminos\s+(\d+(?:\.\d+)*)|cmd LC_VERSION_MIN_MACOSX\s+cmdsize \d+\s+version (\d+(?:\.\d+)*)/g)].map((match) => match[1] || match[2]);
    if (!versions.length || versions.some((version) => newerThan(version, maximum))) {
      throw new Error(`Incompatible with macOS ${maximum}: ${path.relative(root, filename)} (${versions.join(", ") || "unknown minimum OS"}). Rebuild/replace it; never just edit the version metadata.`);
    }
    const linked = run("/usr/bin/otool", ["-L", filename]).split("\n").filter((line) => /^\s/.test(line)).map((line) => line.trim().split(" (compatibility")[0]);
    const external = linked.filter((dependency) => dependency.startsWith("/") && !dependency.startsWith("/usr/lib/") && !dependency.startsWith("/System/Library/"));
    if (external.length || linked.some((dependency) => dependency.includes("HOMEBREW"))) throw new Error(`Unbundled dependency in ${filename}: ${external.join(", ")}`);
    report.push({ file: path.relative(root, filename), architectures, minimumMacOS: versions });
  }
  if (!report.length) throw new Error("No native runtime binaries found.");
  return report;
}
