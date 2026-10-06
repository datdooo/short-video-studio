import { spawnSync } from "node:child_process";
import { createRequire, isBuiltin } from "node:module";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { chmod, copyFile, cp, mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { trimRuntime } from "./trim-runtime.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("This packaging script targets Apple Silicon Macs.");
const releaseRoot = path.join(projectRoot, "release");
const outputAppPath = path.join(releaseRoot, "ShortCut Studio.app");
await mkdir(releaseRoot, { recursive: true });
const stageRoot = await mkdtemp(path.join(releaseRoot, ".build-"));
const appPath = path.join(stageRoot, "ShortCut Studio.app");
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: projectRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${binary}: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout || "";
}
console.log("Building production frontend…");
run(process.execPath, ["scripts/run-framework.mjs", "build"], { stdio: "inherit", env: { ...process.env, SHORTCUT_PERSONAL_BUILD: "1" } });
const contents = path.join(appPath, "Contents");
const resources = path.join(contents, "Resources");
const appRoot = path.join(resources, "app");
const binRoot = path.join(resources, "runtime", "bin");
const libRoot = path.join(resources, "runtime", "lib");
await mkdir(path.join(contents, "MacOS"), { recursive: true });
await mkdir(binRoot, { recursive: true });
await mkdir(libRoot, { recursive: true });
await cp(path.join(projectRoot, "dist", "standalone"), appRoot, { recursive: true, dereference: true });
await cp(path.join(projectRoot, "worker"), path.join(appRoot, "worker"), { recursive: true });
await cp(path.join(projectRoot, "desktop"), path.join(resources, "desktop"), { recursive: true });
await writeFile(path.join(resources, "config.json"), JSON.stringify({ existingDataRoot: path.join(projectRoot, "worker-data") }, null, 2));

// Only Sharp and its installed runtime dependencies are additional to vinext's standalone output.
const resolver = createRequire(path.join(projectRoot, "package.json"));
const copied = new Set();
function packageFile(name, from) {
  for (const folder of from.resolve.paths(name) || []) {
    const candidate = path.join(folder, name, "package.json");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
async function copyPackage(name, from = resolver, optional = false) {
  if (isBuiltin(name)) return;
  const filename = packageFile(name, from);
  if (!filename) { if (optional) return; throw new Error(`Missing runtime dependency: ${name}`); }
  const sourceRoot = path.dirname(realpathSync(filename));
  if (copied.has(sourceRoot)) return;
  copied.add(sourceRoot);
  const metadata = JSON.parse(readFileSync(filename, "utf8"));
  if (metadata.os && !metadata.os.includes("darwin")) return;
  if (metadata.cpu && !metadata.cpu.includes("arm64")) return;
  const relativePackageRoot = path.relative(projectRoot, sourceRoot);
  if (!relativePackageRoot.startsWith(`node_modules${path.sep}`)) throw new Error(`Runtime package outside project: ${sourceRoot}`);
  await cp(sourceRoot, path.join(appRoot, relativePackageRoot), {
    recursive: true, dereference: true,
    filter: (source) => !path.relative(sourceRoot, source).split(path.sep).includes("node_modules"),
  });
  const nextResolver = createRequire(filename);
  for (const dependency of Object.keys(metadata.dependencies || {})) await copyPackage(dependency, nextResolver);
  for (const dependency of Object.keys(metadata.optionalDependencies || {})) await copyPackage(dependency, nextResolver, true);
}
await copyPackage("sharp");
console.log(`Removed ${Math.round((await trimRuntime(path.join(appRoot, "node_modules"))) / 1e6)} MB of generated development metadata.`);

// Relocate Homebrew dylibs so Node/FFmpeg do not depend on Homebrew after packaging.
const libraries = new Map();
const packagedBinaries = [];
function dependencies(binary) {
  return run("/usr/bin/otool", ["-L", binary]).split("\n").slice(1).map((line) => line.trim().split(" (compatibility")[0]).filter(Boolean);
}
function resolveDependency(dependency, source) {
  if (dependency.startsWith("@loader_path/")) return path.join(path.dirname(source), dependency.slice(13));
  if (dependency.startsWith("@rpath/")) {
    const loadCommands = run("/usr/bin/otool", ["-l", source]);
    const rpaths = [...loadCommands.matchAll(/cmd LC_RPATH[\s\S]*?\n\s*path (.+?) \(offset/g)].map((match) => match[1]);
    for (const rpath of rpaths) {
      const resolved = rpath.replace("@loader_path", path.dirname(source)).replace("@executable_path", path.dirname(source));
      const candidate = path.join(resolved, dependency.slice(7));
      if (existsSync(candidate)) return candidate;
    }
    throw new Error(`Cannot resolve ${dependency} of ${source}`);
  }
  return dependency;
}
async function bundleBinary(source, destination, isLibrary = false) {
  source = realpathSync(source);
  await copyFile(source, destination);
  await chmod(destination, 0o755);
  packagedBinaries.push(destination);
  if (isLibrary) run("/usr/bin/install_name_tool", ["-id", `@loader_path/${path.basename(destination)}`, destination]);
  for (const dependency of dependencies(source)) {
    if (dependency.startsWith("/System/") || dependency.startsWith("/usr/lib/")) continue;
    if (dependency === source || (isLibrary && path.basename(dependency) === path.basename(source))) continue;
    const dependencyPath = resolveDependency(dependency, source);
    if (!path.isAbsolute(dependencyPath)) throw new Error(`Cannot relocate dependency ${dependency} of ${source}`);
    const realDependency = realpathSync(dependencyPath);
    const name = path.basename(dependencyPath);
    if (libraries.has(name) && libraries.get(name) !== realDependency) throw new Error(`Conflicting runtime library: ${name}`);
    if (!libraries.has(name)) {
      libraries.set(name, realDependency);
      await bundleBinary(realDependency, path.join(libRoot, name), true);
    }
    const replacement = isLibrary ? `@loader_path/${name}` : `@executable_path/../lib/${name}`;
    run("/usr/bin/install_name_tool", ["-change", dependency, replacement, destination]);
  }
}
console.log("Bundling Node and GPU-enabled FFmpeg…");
await bundleBinary(process.execPath, path.join(binRoot, "node"));
for (const name of ["ffmpeg", "ffprobe"]) {
  const configured = process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"];
  const executable = configured || run("/usr/bin/which", [name]).trim();
  await bundleBinary(executable, path.join(binRoot, name));
}
for (const binary of packagedBinaries.reverse()) run("/usr/bin/codesign", ["--force", "--sign", "-", binary]);
run(path.join(binRoot, "node"), ["--version"]);
run(path.join(binRoot, "ffmpeg"), ["-version"]);
run(path.join(binRoot, "ffprobe"), ["-version"]);

const bundledYtDlp = path.join(projectRoot, ".local-tools", "yt-dlp-macos-bundle");
if (!existsSync(bundledYtDlp)) {
  console.log("Downloading official standalone yt-dlp for macOS…");
  const response = await fetch("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos", { redirect: "follow" });
  if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status}`);
  await mkdir(path.dirname(bundledYtDlp), { recursive: true });
  await writeFile(bundledYtDlp, new Uint8Array(await response.arrayBuffer()));
  await chmod(bundledYtDlp, 0o755);
}
await copyFile(bundledYtDlp, path.join(binRoot, "yt-dlp"));
await chmod(path.join(binRoot, "yt-dlp"), 0o755);
run(path.join(binRoot, "yt-dlp"), ["--version"]);

console.log("Compiling macOS launcher…");
const scratch = await mkdtemp(path.join(tmpdir(), "shortcut-mac-build-"));
run("/usr/bin/swiftc", ["-O", "-target", "arm64-apple-macosx13.0", "-module-cache-path", path.join(scratch, "swift-cache"), path.join(projectRoot, "desktop", "Launcher.swift"), "-o", path.join(contents, "MacOS", "ShortCut Studio")]);
const iconset = path.join(scratch, "Studio.iconset");
await mkdir(iconset);
const icon = readFileSync(path.join(projectRoot, "public", "favicon.svg"));
for (const size of [16, 32, 128, 256, 512]) {
  await sharp(icon).resize(size, size).png().toFile(path.join(iconset, `icon_${size}x${size}.png`));
  await sharp(icon).resize(size * 2, size * 2).png().toFile(path.join(iconset, `icon_${size}x${size}@2x.png`));
}
run("/usr/bin/iconutil", ["-c", "icns", iconset, "-o", path.join(resources, "Studio.icns")]);
await writeFile(path.join(contents, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleName</key><string>ShortCut Studio</string><key>CFBundleDisplayName</key><string>ShortCut Studio</string>
<key>CFBundleIdentifier</key><string>local.datdo.shortcutstudio</string><key>CFBundleExecutable</key><string>ShortCut Studio</string>
<key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>1.0.0</string><key>CFBundleVersion</key><string>1</string>
<key>CFBundleIconFile</key><string>Studio.icns</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>`);
run("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath]);
run("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath]);
if (existsSync(outputAppPath)) await rename(outputAppPath, path.join(stageRoot, "previous-build.app"));
await rename(appPath, outputAppPath);
console.log(`\nReady: ${outputAppPath}\nDouble-click the app to start and open your browser.\nMedia data is kept outside the app bundle.`);
