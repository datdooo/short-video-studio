# Khu ứng viên teaser — bố cục đã chốt 2026-10-21

DEV branch `recovery/visual-dev-reconstructed`, base `ff4b6b7`.

- Luôn mở khu ứng viên khi có plan; bỏ nút toggle “Ứng viên” và X đóng panel.
- Bên trong khu ứng viên: khung video9:16 bên TRÁI; phương án và giải thích xếp
  dọc bên PHẢI, cuộn riêng. Video giữ nguồn contain, không bóp méo/crop footage
  hoặc giả bản render có style/BGM.
- Preview chính và clock/transport cùng một cột trái; thanh tua có hàng riêng,
  căn giữa theo video chính, không căn giữa toàn center. Giữ portrait/framing/
  preview1×/export1.25×. Center55/45 và Timeline không bị đẩy khỏi vùng hiện có.
- Center>=680px đặt main bên trái, khu ứng viên bên phải. Hẹp hơn xếp hai khu
  trong vùng preview cuộn nội bộ; không đóng/che main hoặc thêm resize handle.
- Bỏ ba mục dư dưới Timeline: “Xem ứng viên và phát thử”, “Teaser Part … · AI API”
  và “Trợ giúp teaser”. Bỏ lower Apply/Discard; Timeline giữ inputs, tạo/chọn lại,
  transition và lỗi thực tế. Toàn bộ xem/chọn/Apply ở khu ứng viên trên.
- Tạo/chọn lại thêm winner và alternatives hợp lệ vào cuối catalog UI; giữ các
  phương án cũ trong cùng context. Mốc manual mới hiện như ứng viên phía trên.
  Áp dụng chỉ đổi Đang dùng, KHÔNG sort/đổi thứ tự card. Chọn teaser đang dùng
  rồi bấm Dùng teaser này cho phép chủ động bỏ mốc/input nháp không hợp lệ.
- Catalog tối đa24 lựa chọn trong existing source/part UI drafts. Chỉ khi thêm
  kết quả vượt giới hạn mới bỏ mục cũ nhất không đang dùng; Apply không làm việc
  đó. Context SHA cục bộ gồm source/main/title/cue/transcript/yêu cầu/provider;
  thay context không trộn catalog cũ. Candidate parts dùng schema/validator hiện
  có, parent chỉ áp teaser/custom fields; không đổi EditPlan/schema/backend.
- Thứ tự/phương án đang xem/catalog dùng autosave UI hiện có, không media/base64.
  Job snapshot không bị sửa; Apply không tự gọi AI hoặc submit render.
- Chỉ một video audition, chỉ gắn src sau bấm Play. Có pause/seek/về đầu, nguồn
 1×. Main/BGM và audition không phát chồng theo coordinator hiện có. Đổi card/
  part/workspace/source/export dừng và teardown; play intent/generation ngăn
  metadata/play promise cũ phát lại. Callback cuối range chỉ chạy lúc play.
- Giữ main/locks/IME/draft/validation/provider/render/music/transition thực tế.
  Bằng chứng/reason/replay/model có trong phần giải thích phía trên.

Source/diff review only. Không chạy test/lint/tsc/browser/render/AI/ASR/YouTube
hoặc nghe/xem nghiệm thu. Hai build nhỏ trước đã kết thúc trước các yêu cầu bổ
sung; build layout tổng hợp hiện tại xem đầu `CODEX_HANDOFF.md`. Build không là QA.

Người dùng tự thử: tạo mới -> xem các phương án thêm cuối -> phát thử -> Apply ->
thứ tự giữ nguyên; đổi part/reload -> catalog độc lập; kiểm tra portrait9:16 bên
trái/phương án bên phải, slider chính căn theo main; cửa sổ hẹp cuộn cả hai khu;
Play main/nhạc/đổi workspace/export không làm audition cũ tự phát lại.

## Compact chrome / input follow-up

Main buffering status text removed (ordinary seek also triggered it); buffering
audio coordination/errors retained. Explicit icon-field padding resolves CSS
specificity collision for URL/search inputs. Successful restore notice clears
after4s; actionable errors remain. Header/footer controls32px, bar base40px.
Space toggles main player through existing lifecycle without hijacking text,
buttons or candidate controls. Arrow behavior unchanged (report withdrawn).
These changes are source reviewed, not runtime verified.

Inspector sections share36px header sizing and padding; normal text actions also
use36px across all workspaces. Batch fills viewport with setup/queue/existing
preview panes and responsive stacking. Kho fills available width with responsive
file/job cards; search/tab bar stays fixed, selected content is the only scroll
area. Existing API/job/media callbacks retained; no new decoder or media loading.

Latest design reference: user-supplied
`PLWhL13ZgwoMsXXn-grok-workspace.zip`: inspected batch/library TSX, relevant CSS
and both screenshots. Design reference only, no copied TSX/model/context/mock
code/assets. Batch setup above queue with real preview on right; advanced settings
fold into disclosure. Kho compact list rows with file-type icons (no invented
thumbnail data or new media requests). Full-width requirement overrides prototype
max-width. Four real Kho tabs and all existing actions retained.

## Paused handoff

User paused for quota. Latest Grok workspace package finished exit0 at
`/tmp/shortcut-dev-grok-workspaces-final-20261021.log`, but candidate loading
overlay removal occurred after frontend compilation; newest source is not fully
in that app. No further build/tests/QA. Read top of CODEX_HANDOFF.md before resume.
