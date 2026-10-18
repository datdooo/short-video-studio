# Isolated macOS development

Use the `feature/visual-preset-engine` branch in
`/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
The stable checkout remains on `main`; its baseline is tagged
`stable-v1.1.0-before-visual-editor` at `255a23cf2a1ae128066f2bbaa6e91daca998e6ea`.

```sh
cd /Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev
npm run personal:dev-isolated
```

This command supplies every isolation setting itself. No `.env` file or exported
application variables are required. It refuses occupied DEV ports without
stopping their owners. Stop it with Ctrl+C; only its own child process groups stop.

| Setting | Stable defaults | Isolated DEV |
| --- | --- | --- |
| Name | ShortCut Studio | ShortCut Studio Dev |
| Bundle ID | local.datdo.shortcutstudio | local.datdo.shortcutstudio.dev |
| Web | http://127.0.0.1:5173 | http://127.0.0.1:5273 |
| Worker | http://127.0.0.1:8787 | http://127.0.0.1:8887 |
| Media | Existing worker-data when configured, otherwise stable Application Support/media | ~/Library/Application Support/ShortCut Studio Dev/media |
| Legacy lookup | Existing behavior | Disabled with MEDIA_WORKER_DISABLE_LEGACY=1 |
| ChatGPT Keychain service | ShortCut Studio ChatGPT | ShortCut Studio Dev ChatGPT |
| Package output | release/ShortCut Studio.app | release/dev/ShortCut Studio Dev.app |
| Launcher log | ~/Library/Logs/ShortCut Studio/launcher.log | ~/Library/Logs/ShortCut Studio Dev/launcher.log |

DEV ignores `existingDataRoot`, explicitly sets `MEDIA_WORKER_DATA_DIR`, and
never copies stable media, history, models, settings, or credentials. Directories
are created on demand. Unexpected symlinks in the DEV data/home directories cause
startup to fail without following them.

Media/tool processes use a private HOME, XDG cache/config/data directories, and TMPDIR
under `~/Library/Application Support/ShortCut Studio Dev/`. Inherited credential,
API key, cookie, legacy-root, and fontconfig settings are removed. Antigravity's
login command retains that private environment. Sign in separately when needed;
DEV does not import stable sessions. Exception: only the `/usr/bin/security`
credential subprocess resolves HOME/CFFIXED_USER_HOME from the logged-in macOS
account (`os.userInfo().homedir`). The isolated HOME has no default Keychain;
using it caused "Keychain Not Found" on secure save. This exception does not
change the worker environment or Keychain default/search list, and credentials
remain scoped to `ShortCut Studio Dev ChatGPT` / account `default`. Before a
write, a read-only default-keychain probe fails cleanly rather than triggering a
create/reset dialog. No production service or credential fallback is read. Browser storage is separate because the web
origin uses a different port.

The frontend uses the framework's build-time `NEXT_PUBLIC_MEDIA_WORKER_ORIGIN`.
Both DEV commands supply `http://127.0.0.1:8887` before the framework starts/builds.
An unconfigured frontend retains `http://127.0.0.1:8787`. Changing the public
variable after building a package does not change its browser bundle: rebuild it.

## Package

```sh
npm run package:mac:dev
```

Produces `release/dev/ShortCut Studio Dev.app` in the DEV worktree. The generated
config uses `profile: development`, ports 5273/8887, and `existingDataRoot: null`.
It packages fresh build output and runtime binaries, without stable application
data. It does not install anything. Launch the DEV app directly from that path.
Close the source DEV process before launching the package because both DEV
workflows deliberately share the DEV identity, ports, and data.

`npm run personal`, `npm run package:mac`, and `npm run package:macos26` retain their
production identities, defaults, outputs, and existing-data selection. Run DEV
commands for development; do not run production commands during isolation checks.
Windows launchers, production QA port mappings, and the worker's standalone port
8787 default remain unchanged because the DEV entrypoints explicitly configure
their own ports. No render/editor settings were changed.

## Local Node installation

During setup, the default Homebrew Node 26 could not start because
`libsimdjson.33.dylib` was missing. It was preserved. The installed Node 22 works.
On this machine, use these complete commands if the default Node remains broken:

```sh
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run personal:dev-isolated
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npm run package:mac:dev
```

Or invoke the same entrypoints directly without any environment setup:

```sh
/opt/homebrew/opt/node@22/bin/node scripts/personal-dev.mjs --isolated
/opt/homebrew/opt/node@22/bin/node scripts/package-macos.mjs --dev
```

## Verification

```sh
npm run test:isolation
node --test lib/*.test.mjs worker/*.test.mjs desktop/*.test.mjs
npm run lint
npx tsc --noEmit
curl --fail http://127.0.0.1:8887/health
```

Filesystem tests use temporary mock home directories. Keychain tests mock the
security executable and never access real credentials. For a browser smoke test,
confirm its network requests use 8887, production ports receive no requests, and
`/api/storage` lists only `current` storage. Production can remain open throughout.

Verified on 2026-10-16: all 115 tests passed (15 in `test:isolation`), lint and
TypeScript passed, and the DEV package built and passed deep/strict codesign
verification and native binary audit. Source and packaged runtime browser smoke
tests returned HTTP 200, used only worker port 8887, exposed only the empty DEV
storage root, and had no browser errors or requests to production ports. The DEV
ChatGPT session was disconnected. A second DEV start refused the occupied DEV
port without stopping its owner. Test DEV processes were stopped afterward.

The installed stable bundle's metadata fingerprint and original tracked-file
content hashes matched the initial baseline; the original checkout remained
clean on `main`. Production processes continued serving 5173/8787. Production
media metadata changed while its own FFmpeg process rendered; this work did not
write, migrate, delete, or reset production data or interrupt that process.
