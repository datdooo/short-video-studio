Đã cập nhật đúng [ShortCut Studio Dev.app](<<dev-checkout>/release/dev/ShortCut Studio Dev.app>).

- **Một lượt build/package thành công**, native audit 54 binary và codesign verify đều đạt.
- Package chứa toàn bộ sửa hiện tại: MAIN, text-only, Sol low, subtitle, teaser/manual/context, draft/playback, UX/progress, FFmpeg và bốn follow-up.
- Đối chiếu hash: **182 file runtime/shared + 79 file frontend khớp**; 274 relative imports không thiếu module. Các module mới về MAIN/input, parser, caption, lease, Origin và persistence đều có trong package.
- Giữ profile DEV, port **5273/8887** và data root hiện có. Bundle cũ được giữ tại staging `.build-QSVo3R/previous-build.app`.

[Manifest đối chiếu](<<dev-checkout>/release/dev/source-build-manifest.json>) · [Báo cáo bàn giao](<<dev-checkout>/docs/DEV-LOGIC-MAIN-TEXT-UX-2026-10-22.md>)

Git: `recovery/visual-dev-reconstructed`  
HEAD: `865f75dd69893b9718a2590fb35243d0f2079b77`  
Status: **50 modified, 22 untracked, 0 staged**. Không commit/push/merge.

**Chưa nghiệm thu runtime hoặc chất lượng MAIN.** Không gọi AI, ASR, download, render, tests hay browser automation.