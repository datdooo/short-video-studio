import { copyWorkerLibraries } from "./worker-runtime-files.mjs";
// Cross-build a single-file Windows x64 EXE on macOS/Linux using a verified Go SDK.
// Generated downloads/staging live only in ignored .local-tools/ and release/.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire, isBuiltin } from 'node:module';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const project = path.resolve(import.meta.dirname, '..');
if (!['darwin', 'linux'].includes(process.platform)) throw new Error('Cross-packaging currently runs on macOS/Linux.');
const cache = path.join(project, '.local-tools', 'windows-x64');
const release = path.join(project, 'release', 'windows-x64');
await mkdir(cache, { recursive: true }); await mkdir(release, { recursive: true });
const stage = await mkdtemp(path.join(release, '.build-'));
const resources = path.join(stage, 'resources'), app = path.join(resources, 'app'), bin = path.join(resources, 'runtime', 'bin');
await mkdir(bin, { recursive: true });
const sources = [];
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { cwd: project, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`${path.basename(binary)}: ${result.error?.message || result.stderr || result.stdout}`);
  return result.stdout || '';
}
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download metadata failed: ${url} (${response.status})`);
  return response.json();
}
async function download(url, filename, expected, algorithm = 'sha256', encoding = 'hex') {
  if (!expected) throw new Error(`No checksum for ${url}`);
  const target = path.join(cache, filename);
  if (existsSync(target) && createHash(algorithm).update(await readFile(target)).digest(encoding) === expected) return target;
  console.log(`Downloading verified ${filename}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(900_000) });
  if (!response.ok) throw new Error(`Download failed: ${url} (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash(algorithm).update(bytes).digest(encoding) !== expected) throw new Error(`Checksum mismatch: ${filename}`);
  await writeFile(`${target}.partial`, bytes); await rename(`${target}.partial`, target);
  return target;
}
async function asset(repository, name, tag = 'latest') {
  const metadata = await json(`https://api.github.com/repos/${repository}/releases/${tag === 'latest' ? 'latest' : `tags/${tag}`}`);
  const entry = metadata.assets.find((item) => item.name === name);
  if (!entry?.digest?.startsWith('sha256:')) throw new Error(`Missing upstream SHA256: ${repository}/${name}`);
  const sha256 = entry.digest.slice(7);
  const archive = await download(entry.browser_download_url, `${sha256.slice(0, 12)}-${name}`, sha256);
  sources.push({ repository, tag: metadata.tag_name, url: entry.browser_download_url, sha256 });
  return archive;
}
async function unzip(archive, label) {
  const destination = await mkdtemp(path.join(cache, `${label}-`));
  run('/usr/bin/unzip', ['-q', archive, '-d', destination]); return destination;
}
async function walk(folder) {
  const files = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, item.name);
    if (item.isDirectory()) files.push(...await walk(filename)); else files.push(filename);
  }
  return files;
}

console.log('Building the existing production frontend (no architecture changes)…');
run(process.execPath, ['scripts/run-framework.mjs', 'build'], { stdio: 'inherit', env: { ...process.env, SHORTCUT_PERSONAL_BUILD: '1' } });
await cp(path.join(project, 'dist', 'standalone'), app, { recursive: true, dereference: true });
await cp(path.join(project, 'worker'), path.join(app, 'worker'), { recursive: true, filter: (file) => !file.endsWith('.test.mjs') });
await mkdir(path.join(app, 'lib'), { recursive: true });
await copyWorkerLibraries(project, app);
await mkdir(path.join(resources, 'desktop'));
for (const file of ['windows-bootstrap.mjs', 'windows-config.mjs']) await copyFile(path.join(project, 'desktop', file), path.join(resources, 'desktop', file));

// Copy only JS runtime dependencies. Never ship Mac native bindings on Windows.
const resolver = createRequire(path.join(project, 'package.json')), copied = new Set();
async function copyPackage(name, from = resolver, optional = false) {
  if (isBuiltin(name)) return;
  const filename = (from.resolve.paths(name) || []).map((folder) => path.join(folder, name, 'package.json')).find(existsSync);
  if (!filename) { if (optional) return; throw new Error(`Missing dependency ${name}`); }
  const root = path.dirname(realpathSync(filename)), metadata = JSON.parse(readFileSync(filename, 'utf8'));
  if (copied.has(root) || (metadata.os && !metadata.os.includes('win32')) || (metadata.cpu && !metadata.cpu.includes('x64'))) return;
  copied.add(root);
  const relative = path.relative(project, root);
  if (!relative.startsWith(`node_modules${path.sep}`)) throw new Error('Dependency outside project');
  await cp(root, path.join(app, relative), { recursive: true, dereference: true, filter: (file) => !path.relative(root, file).split(path.sep).includes('node_modules') });
  const next = createRequire(filename);
  for (const dependency of Object.keys(metadata.dependencies || {})) await copyPackage(dependency, next);
  for (const dependency of Object.keys(metadata.optionalDependencies || {})) await copyPackage(dependency, next, true);
}
await copyPackage('sharp'); await copyPackage('youtubei.js'); await copyPackage('@ozymandiasthegreat/vad');
// Sharp's Windows package contains the native addon and its libvips DLLs.
const sharpVersion = JSON.parse(readFileSync(path.join(project, 'node_modules/sharp/package.json'))).version;
const sharpPackage = await json(`https://registry.npmjs.org/@img%2fsharp-win32-x64/${sharpVersion}`);
const [integrityAlgorithm, integrity] = sharpPackage.dist.integrity.split('-');
const sharpArchive = await download(sharpPackage.dist.tarball, `sharp-win32-x64-${sharpVersion}.tgz`, integrity, integrityAlgorithm, 'base64');
const sharpRoot = path.join(app, 'node_modules', '@img', 'sharp-win32-x64');
await mkdir(sharpRoot, { recursive: true }); run('/usr/bin/tar', ['-xzf', sharpArchive, '--strip-components=1', '-C', sharpRoot]);
sources.push({ name: sharpPackage.name, version: sharpVersion, url: sharpPackage.dist.tarball, integrity: sharpPackage.dist.integrity });

const nodeVersion = 'v24.21.0', nodeName = `node-${nodeVersion}-win-x64.zip`;
const sumsResponse = await fetch(`https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`);
if (!sumsResponse.ok) throw new Error('Node checksums unavailable');
const nodeSha = (await sumsResponse.text()).split('\n').find((line) => line.endsWith(`  ${nodeName}`))?.split(/\s+/)[0];
const nodeArchive = await download(`https://nodejs.org/dist/${nodeVersion}/${nodeName}`, nodeName, nodeSha);
const nodeRoot = path.join(await unzip(nodeArchive, 'node'), `node-${nodeVersion}-win-x64`);
await copyFile(path.join(nodeRoot, 'node.exe'), path.join(bin, 'node.exe'));
const licenses = path.join(resources, 'licenses'); await mkdir(licenses);
await copyFile(path.join(nodeRoot, 'LICENSE'), path.join(licenses, 'Node-LICENSE.txt'));
sources.push({ name: 'Node', version: nodeVersion, url: `https://nodejs.org/dist/${nodeVersion}/${nodeName}`, sha256: nodeSha });

const ffmpegArchive = await asset('BtbN/FFmpeg-Builds', 'ffmpeg-n8.1-latest-win64-gpl-shared-8.1.zip');
const ffmpegRoot = await unzip(ffmpegArchive, 'ffmpeg');
for (const file of await walk(ffmpegRoot)) {
  if (/\.(exe|dll)$/i.test(file) && path.basename(file) !== 'ffplay.exe') await copyFile(file, path.join(bin, path.basename(file)));
  if (/license|copying|readme/i.test(path.basename(file))) await copyFile(file, path.join(licenses, `ffmpeg-${path.basename(file)}`));
}
const ytArchive = await asset('yt-dlp/yt-dlp', 'yt-dlp.exe');
await copyFile(ytArchive, path.join(bin, 'yt-dlp.exe'));
const whisperArchive = await asset('ggml-org/whisper.cpp', 'whisper-bin-x64.zip', 'b5454');
const whisperRoot = await unzip(whisperArchive, 'whisper');
for (const file of await walk(whisperRoot)) {
  if (/\.dll$/i.test(file) || path.basename(file) === 'whisper-cli.exe') await copyFile(file, path.join(bin, path.basename(file)));
  if (/license|copying/i.test(path.basename(file))) await copyFile(file, path.join(licenses, `whisper-${path.basename(file)}`));
}
if (!existsSync(path.join(bin, 'whisper-cli.exe'))) throw new Error('Whisper CLI missing');
// App-local Microsoft C++/OpenMP runtime for Whisper: no system installer/admin
// prompt and no dependency on Visual Studio already being installed on the PC.
const vcUrl = 'https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe';
const vcSha = '843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c';
const vcInstaller = await download(vcUrl, 'VC_redist.x64.exe', vcSha);
sources.push({ name: 'Microsoft Visual C++ Redistributable', version: '14.51.36247.0', url: vcUrl, sha256: vcSha });
const sevenArchive = await asset('ip7z/7zip', process.platform === 'darwin' ? '7z2604-mac.tar.xz' : `7z2604-linux-${process.arch === 'arm64' ? 'arm64' : 'x64'}.tar.xz`, '26.04');
const sevenRoot = await mkdtemp(path.join(cache, '7zip-'));
run('/usr/bin/tar', ['-xJf', sevenArchive, '-C', sevenRoot]);
const seven = path.join(sevenRoot, '7zz');
const vcRoot = await mkdtemp(path.join(cache, 'vcrt-'));
const vcBytes = await readFile(vcInstaller);
const vcFolders = [];
// WiX Burn EXEs contain attached CAB containers; extract data only, never run
// this installer or execute code from its MSI payloads on the build host.
for (let offset = vcBytes.indexOf('MSCF'); offset !== -1; offset = vcBytes.indexOf('MSCF', offset + 4)) {
  if (offset + 12 > vcBytes.length) continue;
  const length = vcBytes.readUInt32LE(offset + 8);
  if (length < 36 || offset + length > vcBytes.length) continue;
  const cab = path.join(vcRoot, `${offset}.cab`), folder = path.join(vcRoot, String(offset));
  await writeFile(cab, vcBytes.subarray(offset, offset + length));
  run(seven, ['x', '-y', `-o${folder}`, cab]); vcFolders.push(folder);
}
const vcRuntimeFiles = new Set();
for (const folder of vcFolders) {
  for (const file of await walk(folder)) {
    const bytes = await readFile(file);
    if (bytes.subarray(0, 4).toString() === 'MSCF') {
      const nested = `${file}-unpacked`; run(seven, ['x', '-y', `-o${nested}`, file]);
      for (const dll of await walk(nested)) {
        const name = path.basename(dll);
        if (/^(msvcp140(?:_.*)?|vcruntime140(?:_.*)?|vcomp140|concrt140)\.dll_amd64$/i.test(name)) {
          const dllName = name.replace(/_amd64$/i, '');
          await copyFile(dll, path.join(bin, dllName)); vcRuntimeFiles.add(dllName);
        }
      }
    } else if (bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xfe])) && bytes.toString('utf16le').includes('MICROSOFT')) {
      await copyFile(file, path.join(licenses, 'Microsoft-Visual-Cpp-EULA.txt'));
    }
  }
}
for (const name of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll', 'vcomp140.dll']) if (!vcRuntimeFiles.has(name)) throw new Error(`Missing app-local VC runtime ${name}`);
await cp(sevenRoot, path.join(licenses, '7zip'), { recursive: true, filter: (file) => !/\/7zz$/.test(file) });
// Preserve upstream license texts, attribution, and source locations.
for (const [label, url] of Object.entries({
  'yt-dlp-LICENSE': 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/2026.08.19/LICENSE',
  'Whisper-LICENSE': 'https://raw.githubusercontent.com/ggml-org/whisper.cpp/b5454/LICENSE',
  'FFmpeg-Builds-LICENSE': 'https://raw.githubusercontent.com/BtbN/FFmpeg-Builds/master/LICENSE',
})) { const response = await fetch(url); if (!response.ok) throw new Error(`License unavailable: ${label}`); await writeFile(path.join(licenses, `${label}.txt`), await response.text()); }
await writeFile(path.join(licenses, 'runtime-sources.json'), JSON.stringify(sources, null, 2));

const goVersions = await json('https://go.dev/dl/?mode=json');
const goVersion = goVersions.find((item) => item.stable);
const goFile = goVersion.files.find((file) => file.os === process.platform && file.arch === (process.arch === 'arm64' ? 'arm64' : 'amd64') && file.kind === 'archive');
if (!goFile) throw new Error('No Go SDK for build host');
const goArchive = await download(`https://go.dev/dl/${goFile.filename}`, goFile.filename, goFile.sha256);
const goRoot = path.join(cache, `${goVersion.version}-${process.platform}-${process.arch}`);
if (!existsSync(path.join(goRoot, 'go/bin/go'))) { await mkdir(goRoot, { recursive: true }); run('/usr/bin/tar', ['-xzf', goArchive, '-C', goRoot]); }
const go = path.join(goRoot, 'go/bin/go');
const goEnv = { ...process.env, GOTOOLCHAIN: 'local', GO111MODULE: 'off', CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64', GOCACHE: path.join(cache, 'go-cache') };
run(go, ['build', '-trimpath', '-ldflags=-s -w', '-o', path.join(bin, 'chatgpt-credential-store.exe'), 'desktop/CredentialStore_windows.go'], { env: goEnv });

// Refuse a cross-platform package with any Mach-O binaries copied from this Mac.
const manifest = [];
for (const file of await walk(resources)) {
  const relative = path.relative(resources, file).split(path.sep).join('/');
  const bytes = await readFile(file);
  if (/\.(exe|dll|node)$/i.test(file) && bytes.subarray(0, 2).toString() !== 'MZ') throw new Error(`Non-Windows native runtime: ${relative}`);
  if (/\.(dylib|so)$/i.test(file)) throw new Error(`Foreign native library: ${relative}`);
  manifest.push({ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(path.join(resources, 'runtime-manifest.json'), JSON.stringify({ platform: 'win32', arch: 'x64', files: manifest }, null, 2));
const payload = path.join(stage, 'payload.zip');
run('/usr/bin/zip', ['-q', '-r', payload, '.'], { cwd: resources });
await copyFile(path.join(project, 'desktop/Launcher_windows.go'), path.join(stage, 'main.go'));

const hostGoEnv = { ...goEnv, GOOS: process.platform, GOARCH: process.arch === 'arm64' ? 'arm64' : 'amd64' };
const imports = JSON.parse(run(go, ['run', 'scripts/audit-windows-runtime.go', resources], { env: hostGoEnv }));
// The PE audit checks x64 architecture and resolves all named DLL imports to a
// sibling DLL, runtime/bin, or known Windows system libraries (including UCRT).
const systemDlls = new Set(('kernel32 ntdll advapi32 shell32 ole32 oleaut32 user32 ws2_32 bcrypt bcryptprimitives crypt32 dbghelp iphlpapi userenv winmm msvcrt gdi32 imm32 setupapi version shlwapi dnsapi d2d1 dwrite msimg32 rpcrt4 usp10 avrt avicap32 cfgmgr32 ncrypt secur32 psapi powrprof wintrust comdlg32 comctl32 uxtheme dwmapi normaliz winhttp wininet').split(' ').map((name) => `${name}.dll`));
for (const [file, libraries] of Object.entries(imports)) {
  for (const dll of libraries) {
    if (systemDlls.has(dll) || /^(api-ms-win-|ext-ms-win-)/.test(dll)) continue;
    const siblings = (await readdir(path.dirname(path.join(resources, file)))).map((name) => name.toLowerCase());
    const runtimeFiles = (await readdir(bin)).map((name) => name.toLowerCase());
    if (!siblings.includes(dll) && !runtimeFiles.includes(dll)) throw new Error(`Unresolved Windows DLL ${dll} imported by ${file}`);
  }
}
await writeFile(path.join(resources, 'windows-dependencies.json'), JSON.stringify(imports, null, 2));
// Include the verified dependency report in the embedded payload too.
run('/usr/bin/zip', ['-q', payload, 'windows-dependencies.json'], { cwd: resources });
// Generate a Windows resource (.syso) containing the same crisp play logo.
const png = await sharp(path.join(project, 'public/favicon.svg')).resize(256, 256).png().toBuffer();
const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(path.join(stage, 'Studio.ico'), Buffer.concat([ico, png]));
await writeFile(path.join(stage, 'winres.json'), JSON.stringify({ RT_GROUP_ICON: { APP: { '0409': 'Studio.ico' } }, RT_MANIFEST: { '#1': { '0409': { identity: { name: 'ShortCutStudio', version: '1.1.0.0' }, description: 'ShortCut Studio', 'minimum-os': 'win10', 'execution-level': 'as invoker', 'long-path-aware': true } } } }));
const nativeEnv = { ...goEnv, GO111MODULE: 'on', GOOS: process.platform, GOARCH: process.arch === 'arm64' ? 'arm64' : 'amd64', GOBIN: path.join(cache, 'go-tools') };
run(go, ['install', 'github.com/tc-hib/go-winres@v0.3.3'], { env: nativeEnv });
run(path.join(cache, 'go-tools/go-winres'), ['make', '--in', 'winres.json', '--arch', 'amd64'], { cwd: stage });
console.log('Compiling the native Windows launcher with embedded app payload…');
const output = path.join(stage, 'ShortCut Studio.exe');
run(go, ['build', '-trimpath', '-ldflags=-s -w', '-o', output, '.'], { cwd: stage, env: goEnv });
const destination = path.join(release, 'ShortCut Studio.exe');
if (existsSync(destination)) await rename(destination, path.join(stage, 'previous-build.exe'));
await rename(output, destination);
const sha256 = createHash('sha256').update(await readFile(destination)).digest('hex');
await writeFile(path.join(release, 'SHA256SUMS.txt'), `${sha256}  ShortCut Studio.exe\n`);
await writeFile(path.join(release, 'README.txt'), `ShortCut Studio — Windows 10/11 x64\n\nDouble-click ShortCut Studio.exe. No Node/Python/FFmpeg installation needed.\nFirst launch extracts the bundled runtime under %LOCALAPPDATA%\\ShortCut Studio\\runtime.\nKeep the launcher window open; press Enter to stop, or close its window. Active jobs stop with the app.\nMedia and history: %LOCALAPPDATA%\\ShortCut Studio\\media\nLog: %LOCALAPPDATA%\\ShortCut Studio\\logs\\startup.log\nWhisper small multilingual model is downloaded only when requested in Auto Subtitle.\nChatGPT: click Continue with ChatGPT, sign in and authorize in your browser.\nOAuth tokens are encrypted using Windows DPAPI (this Windows account), not browser storage.\nRestart preserves the connection. Disconnect removes only this app's local saved tokens.\nEligible plan/permissions/usage limits still apply; login alone does not grant plan usage.\nThis personal build is unsigned and has not been runtime-tested on a Windows machine.\nDo not disable Windows security protections; verify origin/checksum before running.\n`);
const zip = path.join(release, 'ShortCut-Studio-Windows-x64.zip');
if (existsSync(zip)) await rename(zip, path.join(stage, 'previous-build.zip'));
run('/usr/bin/zip', ['-q', zip, 'ShortCut Studio.exe', 'README.txt', 'SHA256SUMS.txt'], { cwd: release });
console.log(JSON.stringify({ executable: destination, bytes: (await readFile(destination)).length, sha256, nativeRuntimeFiles: manifest.filter((file) => /\.(exe|dll|node)$/.test(file.path)).length, windowsRuntimeTested: false }));
