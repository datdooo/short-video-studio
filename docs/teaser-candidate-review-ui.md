# Khu xem ứng viên teaser — 2026-10-21

Base `0ef1399`, DEV branch `recovery/visual-dev-reconstructed`.

- `TeaserCandidateReview` hiển thị các phương án đã lưu thành các dòng có số,
  timecode nguồn, thời lượng preview1× và badge Đang dùng. Lý do của phương án
  đang chọn tách riêng; lời trích/quan hệ/ending/giới hạn thu gọn để tránh card dài.
- Khung phát thử nằm cạnh portrait chính khi center rộng >=580px. Cửa sổ hẹp
  dùng nút Ứng viên mở trong vùng preview, không thay tỷ lệ center55/45 hoặc
  đẩy Timeline/Render xuống. Nút Play/seek của preview chính sẽ đóng khu ứng
  viên nhỏ để không điều khiển một hình bị che.
- Dùng đúng một player phát video/tiếng nguồn1× trong range đang xem, có
  pause/seek/về đầu. Không phải bản render có style/BGM. Chỉ gắn source khi bấm
  Phát thử, không preload video cho mỗi card hoặc gọi worker tạo preview mới.
- Preview chính/BGM dừng khi audition. Main Play/seek, music audition, đổi
  part/workspace/source, đóng panel hoặc export dừng audition; thay card/đóng
  gỡ src và giải phóng node. Callback cuối range chỉ chạy lúc play, được hủy
  khi pause/unmount. Play intent/generation chặn metadata/promise cũ tự phát lại.
- Thứ tự và phương án đang xem lưu trong UI drafts có scope source/part/analysis.
  Bấm Áp dụng không sort card hay đưa card được chọn lên đầu; chỉ badge Đang
  dùng đổi. Vẫn gọi `chooseTeaserAlternative` với index thực của plan hiện tại,
  không thay schema hoặc tạo thêm danh sách lựa chọn trong EditPlan. AI phân tích
  mới được tạo một bộ ứng viên/thứ tự mới. Reload giữ order qua autosave hiện có.
- Pending Custom Teaser dùng chung khung phát thử và Apply; bỏ video inline và
  danh sách alternatives dài cũ. Không đổi validation, IME, main/locks/timecode,
  snapshots, AI/worker/render/transition/framing/export1.25×.

Source/diff review only. Không chạy test/lint/tsc/browser/render/AI/ASR/YouTube.
Một lượt Node22 DEV package thành công (exit0), log
`/tmp/shortcut-dev-teaser-candidate-review-build-20261021.log`; app
`release/dev/ShortCut Studio Dev.app`. App đang mở vẫn dùng previous-build,
không tự restart. Chưa nghiệm thu hình ảnh, nghe tiếng hoặc thao tác thực tế;
build không phải QA. Chi tiết process/build ở đầu `CODEX_HANDOFF.md`.

Người dùng tự thử: chọn các card → phát thử → Apply → kiểm tra số/vị trí card
không đổi; đổi Part/reload → giữ order; đang tải/phát ứng viên → Play preview
chính/đổi workspace/render → không phát chồng hoặc tự phát lại; cửa sổ hẹp →
mở/đóng Ứng viên, Timeline và Render vẫn dùng được.
