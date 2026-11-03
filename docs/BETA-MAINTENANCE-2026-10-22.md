Cập nhật 2026-11-04: OAuth đã được thay bằng Codex CLI; xem docs/CODEX-CLI-AUTO-PROMPT.md.

# Beta maintenance / DEV handoff

Baseline DEV checkpoint: `cf14ba4202eb25f1ecba5033c969d12797cbff9b`, local tag `checkpoint/dev-beta-base-2026-10-22`. Source matched the last packaged DEV source hashes before checkpoint. Parent was `865f75dd69893b9718a2590fb35243d0f2079b77`. No media, credentials, dependencies, app or cache was staged. DEV keeps its directory, branch name, app, configuration and user data.

- DEV advanced work: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`, branch `recovery/visual-dev-reconstructed`.
- Beta bug fixes/builds: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, branch `beta/maintenance`. This is an editable full source checkout with an independent `.git` directory/object database, no alternates or DEV-linked remote. No read-only/build lock is imposed: commit reviewed changes before packaging so each artifact has an exact revision.
- Release metadata: `desktop/beta-release.mjs`, initial version `1.1.0-beta.1`, build `1101`. Increment deliberately for each Beta update. Package receipts record the actual commit and baseline. Keep the previous good bundle/installer and its receipt; source history remains recoverable by Git.
- Shared fixes: inspect compatibility, then intentionally transfer only selected commits (for example cherry-pick after review). Never auto-merge/synchronize all DEV work into Beta. No additional DEV checkout is needed for Beta fixes.

| Setting | DEV macOS (unchanged) | Beta macOS | Beta Windows x64 |
|---|---|---|---|
| App | ShortCut Studio Dev | ShortCut Studio Beta | ShortCut Studio Beta |
| Profile | development | beta | beta |
| Bundle/installation identity | local.datdo.shortcutstudio.dev | local.datdo.shortcutstudio.beta | HKCU uninstall ShortCutStudioBeta; per-user install |
| App path | DEV checkout/release/dev/ShortCut Studio Dev.app | Beta checkout/release/beta/ShortCut Studio Beta.app | `%LOCALAPPDATA%\Programs\ShortCut Studio Beta\ShortCut Studio Beta.exe` |
| Web / worker | 5273 / 8887 | 5373 / 8987 | 5373 / 8987 |
| Media/history/cache | `~/Library/Application Support/ShortCut Studio Dev/media` | `~/Library/Application Support/ShortCut Studio Beta/media` | `%LOCALAPPDATA%\ShortCut Studio Beta\media` |
| Logs | `~/Library/Logs/ShortCut Studio Dev/launcher.log` | `~/Library/Logs/ShortCut Studio Beta/launcher.log` | `%LOCALAPPDATA%\ShortCut Studio Beta\logs\startup.log` |
| Credentials | Keychain ShortCut Studio Dev ChatGPT | Keychain ShortCut Studio Beta ChatGPT | Beta-only DPAPI file/entropy under Beta media |
| Browser state | origin :5273, existing DEV keys | origin :5373, shortcut-beta-* keys | origin :5373 on Windows, shortcut-beta-* keys |

Beta runtime has no DEV/production profile fallback, legacy library mount or existingDataRoot adoption. Worker validates profile/data root/ports/Keychain/helper paths before startup. Launcher/worker/frontend/Origin policy/OAuth callback agree on :5373/:8987. Callback is `http://127.0.0.1:8987/auth/callback`; no live authorization has been tried. Sign in separately; no token/cookie/account registration is copied. HOME/XDG/tmp (and Windows USERPROFILE/APPDATA/LOCALAPPDATA for child tools) are Beta-local. No DEV path is a writable Beta data root. Standalone native binaries/dependencies are copied into the target package, not symlinked to DEV/Homebrew.

Build commands (existing locked dependencies, no new framework):

```sh
npm run package:mac:beta
node scripts/package-windows.mjs --reuse-frontend
```

The second command requires a matching committed macOS build if reusing its frontend; omit `--reuse-frontend` to build the same frontend first on a clean release. Windows cross-build uses a verified host Go SDK, x64 PE audit, Windows Node/FFmpeg/ffprobe/yt-dlp/Whisper CLI/Sharp/VAD and app-local DLLs. It never executes Windows binaries on macOS. No Wine is installed. Installer creates per-user Desktop/Start Menu shortcuts and an Apps uninstall entry; updater refuses while Beta is running and retains one previous installed executable/receipt. Uninstall leaves user data/credentials intact and removes only the installation-owned files/links/registration. Unsigned Windows build; no Authenticode certificate has been supplied.

MAIN continuity v3, Sol low, text-only input, current subtitle/main/teaser/manual/draft/playback/music/render behavior are inherited from the baseline. Beta changes are identity/isolation/packaging only. No active plan is regenerated or copied. Known preliminary acceptance from the user: main opening and both current teasers were temporarily acceptable; gaps between parts/tail required the latest continuity correction. Do not label overall MAIN quality or runtime QA passed.

Not verified on a real session: semantic MAIN quality, retention after main reanalysis, OAuth callback/account support on the new port, source-language subtitles, Windows installation/uninstallation/DPAPI/fonts/encoding/playback/cancellation. Windows uses existing libx264 path because VideoToolbox is macOS-only; no encoder algorithm is changed. Whisper model files are not bundled/copied/downloaded in this work and will need separate user-initiated setup in Beta.

Build/static receipts and cleanup report are delivered outside signed app bundles under `release/beta/` and the parent workspace handoff. Cleanup only follows successful artifact comparison; keep source/Git, current apps/installers, previous rollback packages, user data, Git/recovery backups and diagnostics still needed. Never infer ownership/safety from an ignored/tmp/cache name alone.
