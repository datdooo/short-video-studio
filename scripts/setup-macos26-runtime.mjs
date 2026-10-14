import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, readFile, readlink, readdir, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("Apple Silicon macOS is required.");
const root = path.resolve(import.meta.dirname, "../.local-tools/macos26");
const manifestFile = path.join(root, "runtime-manifest.json");
await mkdir(path.join(root, "archives"), { recursive: true });
await mkdir(path.join(root, "cellar"), { recursive: true });
await mkdir(path.join(root, "opt"), { recursive: true });
function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${binary}: ${result.error?.message || result.stderr}`);
  return result.stdout;
}
async function get(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return response;
}
async function download(url, destination, sha256, headers = {}) {
  const data = existsSync(destination) ? await readFile(destination) : Buffer.from(await (await get(url, headers)).arrayBuffer());
  if (createHash("sha256").update(data).digest("hex") !== sha256) throw new Error(`Checksum mismatch: ${path.basename(destination)}`);
  if (!existsSync(destination)) await writeFile(destination, data, { flag: "wx" });
}
function unpack(archive, destination) {
  const entries = run("/usr/bin/tar", ["-tf", archive]).split("\n").filter(Boolean);
  if (entries.some((name) => name.startsWith("/") || name.split("/").includes(".."))) throw new Error("Unsafe archive paths.");
  run("/usr/bin/tar", ["-xf", archive, "-C", destination]);
  return entries;
}

const nodeVersion = "24.21.0";
const nodeArchiveName = `node-v${nodeVersion}-darwin-arm64.tar.gz`;
const nodeBase = `https://nodejs.org/dist/v${nodeVersion}`;
const sums = await (await get(`${nodeBase}/SHASUMS256.txt`)).text();
const nodeSha = sums.split("\n").find((line) => line.endsWith(`  ${nodeArchiveName}`))?.split(/\s+/)[0];
if (!nodeSha) throw new Error("Official Node checksum is missing.");
const nodeArchive = path.join(root, "archives", nodeArchiveName);
console.log(`Downloading official Node ${nodeVersion} (SHA256 verified)…`);
await download(`${nodeBase}/${nodeArchiveName}`, nodeArchive, nodeSha);
if (!existsSync(path.join(root, `node-v${nodeVersion}-darwin-arm64/bin/node`))) unpack(nodeArchive, root);
const node = path.join(root, `node-v${nodeVersion}-darwin-arm64/bin/node`);
await chmod(node, 0o755);

const formulas = new Map();
async function formula(name) {
  if (formulas.has(name)) return;
  const metadata = await (await get(`https://formulae.brew.sh/api/formula/${encodeURIComponent(name)}.json`)).json();
  const tag = ["arm64_tahoe", "arm64_sequoia", "arm64_sonoma", "arm64_ventura", "all"].find((candidate) => metadata.bottle?.stable?.files?.[candidate]);
  if (!tag) throw new Error(`No macOS <=26 bottle for ${name}. Never use the macOS 27 bottle.`);
  const bottle = metadata.bottle.stable.files[tag];
  formulas.set(name, { name, version: metadata.versions.stable, tag, ...bottle, sourceUrl: metadata.urls.stable.url });
  await Promise.all(metadata.dependencies.map(formula));
}
await formula("ffmpeg");
await formula("whisper.cpp");
for (const item of formulas.values()) {
  const repository = new URL(item.url).pathname.match(/^\/v2\/(.+)\/blobs\//)?.[1];
  if (!repository || !item.url.startsWith("https://ghcr.io/v2/homebrew/core/")) throw new Error("Unexpected bottle registry.");
  const token = await (await get(`https://ghcr.io/token?service=ghcr.io&scope=${encodeURIComponent(`repository:${repository}:pull`)}`)).json();
  const archive = path.join(root, "archives", `${item.name.replaceAll("@", "-")}-${item.sha256}.tar.gz`);
  console.log(`Downloading ${item.name} ${item.version} · ${item.tag} (SHA256 verified)…`);
  await download(item.url, archive, item.sha256, { Authorization: `Bearer ${token.token}` });
  const entries = unpack(archive, path.join(root, "cellar"));
  const versionFolder = entries.map((name) => name.split("/")).find((parts) => parts[0] === item.name && parts[1] && parts[1] !== ".bottle")?.[1];
  if (!versionFolder) throw new Error(`Missing ${item.name} bottle version directory.`);
  item.directory = path.join(root, "cellar", item.name, versionFolder);
  const link = path.join(root, "opt", item.name);
  if (existsSync(link) && await readlink(link) !== item.directory) {
    if (!(await lstat(link)).isSymbolicLink() || !path.resolve(await readlink(link)).startsWith(path.join(root, "cellar", item.name) + path.sep)) throw new Error("Unexpected runtime opt link. Nothing removed.");
    await unlink(link);
  }
  if (!existsSync(link)) await symlink(item.directory, link, "dir");
  if ((await readdir(item.directory)).length === 0) throw new Error(`Empty bottle: ${item.name}`);
}
const manifest = {
  targetMacOS: "26.0", architecture: "arm64", node,
  nodeSource: { version: nodeVersion, url: `${nodeBase}/${nodeArchiveName}`, sha256: nodeSha, license: path.join(root, `node-v${nodeVersion}-darwin-arm64/LICENSE`) },
  ffmpeg: path.join(formulas.get("ffmpeg").directory, "bin/ffmpeg"),
  ffprobe: path.join(formulas.get("ffmpeg").directory, "bin/ffprobe"),
  whisper: path.join(formulas.get("whisper.cpp").directory, "bin/whisper-cli"),
  prefix: root, formulas: [...formulas.values()],
};
await writeFile(manifestFile, JSON.stringify(manifest, null, 2));
console.log(`Ready: ${manifestFile}`);
