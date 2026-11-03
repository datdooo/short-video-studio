# Beta macOS build 1102

Release version remains `1.1.0-beta.1`; macOS build number increases from 1101 to 1102. The package config records the exact local checkpoint commit used by the build; its parent is `f9f118bf7ba93f1c4a08275b4449f65ab138d686`. The baseline DEV checkpoint remains `cf14ba4202eb25f1ecba5033c969d12797cbff9b`.

Includes the manual teaser/progress source fixes described in `BETA-MANUAL-TEASER-PROGRESS-2026-10-22.md`: manual source-wide ranges with source identity and exact timestamps, shared validation/presentation/restore/worker checks, preservation across main edits, and one measured percentage label per progress bar. No new algorithm, model, reasoning, AI requests, or DEV features are introduced.

Target remains exactly `release/beta/ShortCut Studio Beta.app`, profile beta, web 5373, worker 8987, data `~/Library/Application Support/ShortCut Studio Beta/media`, Keychain namespace `ShortCut Studio Beta ChatGPT`. Runtime/environment configuration is unchanged. Packaging now explicitly refuses to publish while this bundle or either Beta port is in use; it does not stop processes.

The previous macOS app/build receipt must remain available for rollback; the package script retains the previous bundle only after frontend/native compilation, import packaging, native audit and codesign finish successfully. Post-package static comparison and rollback path are recorded outside the signed bundle in `release/beta/macos-build-receipt.json` and `release/beta/macos-build-1102-handoff.md`.

Windows is **not rebuilt** in this update. `release/beta/windows-x64/ShortCut-Studio-Beta-Setup-1.1.0-beta.1-x64.exe` remains build 1101 from `f9f118bf7ba93f1c4a08275b4449f65ab138d686`, SHA-256 `7dab48ab60773f1e6a1782851ed43e94f886f04b89c3bb34ed9dfab06a9a3a8a`; it does not contain these manual/progress fixes.

Only mandatory build/package/native audit/codesign and static package comparisons are authorized in this release. No tests, separate lint/typecheck, AI, render, ASR, video download or browser automation. Build success does not establish runtime acceptance, Windows behavior or semantic MAIN quality. User media/drafts/history/credentials and the DEV checkout are left untouched.
