# Durable project rules

- Work only in `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`, branch `recovery/visual-dev-reconstructed`.
- Git was reconstructed at `d1e2cd6df0ee1ab640f8e6d111f0cbc6131c4ab6`; old local checkpoint SHAs are historical and unavailable. Do not repeat recovery. Current scope/status is in `docs/next-agent-task.md`; A–G are implemented; D–G technical checks and user H live/editorial acceptance are separated in `docs/smart-auto-cut-defg-qualification.md`.
- Read `docs/agent-handoff.md`, then `docs/next-agent-task.md`; use `docs/agent-architecture-map.md` to locate code. Respect `AGENTS.md` before code changes.
- Use Node 22: `PATH="/opt/homebrew/opt/node@22/bin:$PATH"`.
- DEV only: ShortCut Studio Dev, ports 5273/8887, separate DEV Application Support. Follow `docs/dev-isolation.md`.
- Never modify main, the original checkout, `/Applications/ShortCut Studio.app`, production data/credentials or production ports 5173/8787. Never install DEV into `/Applications`.
- Preserve existing work. No reset/amend/merge or unrelated Homebrew changes. Stop only verified owned DEV processes when necessary.
- Search with `rg` before targeted reads. Do not recursively reread the repository or old phase docs without a concrete regression question.
- Reuse the existing renderer, VisualStyle normalization and YouTube/yt-dlp stack. No parallel implementations or duplicate persisted style truth.
- Follow the latest user scope and `docs/next-agent-task.md`; historical RC/hook evidence is preserved. Use `.agents/skills/smart-auto-cut/SKILL.md` for that design; work one coherent checkpoint at a time.
- Focused tests first; report only checks actually run and distinguish synthetic evidence from real workflows. No unrelated features.

- Music/hook contracts: `docs/background-music.md` and `docs/music-qualification.md`. Music is local/OFF by default; do not reclassify un-auditioned catalog links or silently rewrite legacy/queued hooks.
