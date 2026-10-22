# Bàn giao sửa draft, playback và main chỉnh tay — 21/10/2026

Checkout bắt đầu sạch tại branch `recovery/visual-dev-reconstructed`, HEAD
`865f75dd69893b9718a2590fb35243d0f2079b77`. Đối chiếu implementation hiện tại,
không dùng số dòng trong báo cáo hoặc ZIP làm căn cứ sửa.

## F01 — draft không đọc được

Xác nhận: capture click/input trước đây bật autosave trở lại dù restore trả
`blocked`. Nay chặn cả nơi bật lưu và hàm ghi dùng bởi debounce, pagehide,
beforeunload, visibility và lưu playhead định kỳ.

Nút “Giữ bản gốc & bật lưu” bảo toàn chính xác chuỗi raw trong localStorage,
ghi rồi đọc lại đối chiếu trước khi mở khóa autosave. Lỗi quota, schema hoặc
đọc/ghi thì không thay draft đang hoạt động. “Phiên mới” vẫn là thao tác bỏ nháp
có xác nhận rõ ràng hiện có. Không tự xóa các bản đã giữ.

## F05 — mở item Batch

Xác nhận: reset diễn ra trước GET source, nên GET lỗi cũng làm mất draft. Bốn
ô Manual cut dùng state toàn cục, có thể áp mốc/title A lên source B.

Nay tải và xác minh đúng source trước; giữ snapshot toàn bộ phiên, kể cả raw
controls chưa hợp lệ, trước khi thay phiên. Mở lại đúng item hiện tại không
nạp plan worker đè draft. Mỗi snapshot có identity source hoặc batch/item/source;
menu “Bản nháp đã giữ” cho mở lại. Khi lưu item vào queue, danh tính bản nháp
được giữ riêng với trạng thái đang duyệt item; handler/API queue vẫn giữ cách gửi.

Manual cut được lưu theo scope nguồn/item, không parse/trim khi nhập. Đổi nguồn
không dùng dữ liệu của scope khác, cũng không xóa vô điều kiện nháp manual cũ.
Draft phiên bản cũ được chuyển bốn trường legacy vào đúng scope lúc restore.

Kho nháp giới hạn 12 mục/8 MiB; quota thực của trình duyệt có thể thấp hơn.
Không đủ chỗ thì từ chối đổi phiên, không tự loại bản cũ. Đây là dữ liệu trình
duyệt; không sao chép media hoặc sửa các thư mục backups.

## F02 — rời workspace

Xác nhận: queueEditedBatchItem bỏ qua changeWorkspace; ticker thiếu cờ dừng;
pending play/ready cần bảo vệ ý định phát. Mọi setWorkspace nay đi qua một hàm
chuyển chung. Hàm dừng pause hai deck, ticker, video nguồn/Batch, mixed preview,
nhạc nghe thử và teaser nghe thử; hủy ý định cũ nhưng giữ playhead/draft.

Đã đọc bindAudition/onPlaybackControl và tick/handoff của deck. Deck pause đã có
generation guard, được tái sử dụng. Mixed audio trước đây **đã có** guard theo
playing=false; nhận định tất cả nhạc đều tiếp tục phát không đúng. Bổ sung latch
pause chủ động, guard promise/ready và suspension; buffering/handoff vẫn có quyền
nối lại trong cùng lượt phát. Video Kho pause trước khi ref bị gỡ khi unmount.

## Bổ sung theo yêu cầu trong lượt sửa

Xác nhận: applyMainRanges chủ động loại mọi teaser AI/import khi main đổi;
binding cũng chứa main cũ. Đồng thời mục tiêu AI >60 giây tiếp tục chặn main
chỉnh tay. Nay giữ timestamp và provenance teaser còn hợp lệ, lưu ngữ cảnh AI
gốc cùng identity main đã sửa. Source/request/transcript/captions và fingerprint/
evidence vẫn được kiểm tra. Các validator preview/import/render dùng cùng logic.

Teaser được giữ sau sửa main không bị loại chỉ vì rơi vào 10 giây đầu mới;
Auto chọn mới vẫn tránh đoạn đầu như trước. Nếu bị cắt khỏi main hoặc bắc qua
gap, giữ mốc cũ để sửa/khôi phục, báo cần chọn lại; không tự kéo main/teaser.
Main chỉnh tay không bị ép >60 giây hoặc ngưỡng candidate tự động. Vẫn kiểm
timestamp, nguồn, thứ tự/gap và thời lượng teaser. Không đổi tốc độ/zoom/engine.

Đã bỏ UI Khóa main và handler khóa/mở khóa. mainEdited bảo vệ chỉnh tay tự động;
không cần thao tác khóa. Dữ liệu tương thích snapshot cũ vẫn được giữ. Teaser đã
bị code cũ xóa thành unavailable không đủ mốc để tự phục hồi; cần chọn lại một lần.

## File sửa

- app/page.tsx
- components/use-manual-cut-draft.ts (mới)
- lib/editor-session.ts
- components/media-library-panel.tsx
- components/music-panel.tsx
- lib/music/preview-playback.mjs
- components/main-ranges-editor.tsx
- lib/main-ranges.mjs
- lib/teaser-context.mjs và lib/teaser-context.d.mts
- lib/teaser-hooks.mjs
- lib/teaser-import.mjs
- lib/edit-plan.ts
- worker/plan-validation.mjs
- lib/auto-cut/locks.mjs
- lib/auto-cut/main-content.mjs
- Tài liệu bàn giao này.

## Nghiệm thu tay đề nghị

1. Draft hỏng: click/gõ/chuyển tab/đóng mở trang không ghi đè raw; thử bảo toàn
   khi storage không ghi được; sau đó thử “Giữ bản gốc & bật lưu” và “Phiên mới”.
2. A có mốc nhập dở/sai: mở B chưa có plan, thử GET B lỗi, mở lại A, reload;
   thử hai item cùng URL. Kiểm tra text, title, mốc, captions và playhead.
3. Đang phát main/mix/nhạc thử/teaser thử: sang Batch/Kho hoặc lưu item rồi về
   Batch; quay lại phải đứng yên. Thử chuyển ngay khi playback còn chuẩn bị.
4. Sửa main nhưng giữ teaser bên trong: teaser còn nguyên mốc; thử rút dưới
   60 giây và đưa teaser vào đầu main mới. Sau đó cắt bỏ vùng teaser: main được
   giữ, báo đúng lỗi teaser; sửa lại hoặc chọn lại trước khi xuất.

Chỉ đọc source và diff. Không chạy test, lint, typecheck, build, browser, render,
AI, YouTube hoặc ASR. Chưa xác minh runtime/chất lượng video/âm thanh. Không
đóng gói, restart app/worker, commit, push hoặc merge; app đóng gói chưa cập nhật.

## Build theo yêu cầu tiếp theo của chủ dự án

Đã đọc lại diff, giữ nguyên toàn bộ source hiện tại; không thêm tính năng hoặc sửa code trong lượt build.
Đóng gói DEV thành công một lần (exit 0), dùng Node 22 và toàn bộ compile/native audit/codesign guard hiện có.
Chỉ đổi đường dẫn đầu ra trong script build tạm, đã xóa script tạm sau khi hoàn tất; không sửa packager được lưu trong Git.

App mới: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev Review 20261021-205914.app`

Log: `/tmp/shortcut-dev-review-20261021-205914-build.log`

Bundle chứa `Contents/Resources/source-build-manifest.json`: 16 source input giữ nguyên hash trong lúc build; 8 module worker/lib đã đối chiếu khớp bản đóng gói. Các marker client cho draft/manual-main mới có trong bundle đã biên dịch. DEV dùng web 5273 / worker 8887.

Build có cảnh báo chunk JavaScript lớn, không lỗi; không tắt guard. Không chạy test/lint/typecheck riêng, browser, render, AI, YouTube hoặc ASR. Các bước phiên bản binary/native compatibility/signing là bước sẵn có của packager. Chưa kiểm chứng runtime/QA.

Phát hiện app cũ đang render nên không thay bundle đang chạy, không đóng hoặc restart app/worker. Các PID launcher/bootstrap/worker/web 68984/68986/68988/68989 còn nguyên sau build. App đang mở vẫn phục vụ build cũ. Sau khi job xong và lưu draft, chủ dự án thoát app cũ bình thường rồi mở app Review ở đường dẫn trên; không chạy đồng thời hai bundle cùng cổng DEV.

Git vẫn branch `recovery/visual-dev-reconstructed`, HEAD `865f75dd69893b9718a2590fb35243d0f2079b77`, 15 file sửa và 2 file mới; chưa commit/push/merge. Chỉ tài liệu này được bổ sung sau build, source app không đổi.

## Cập nhật bundle DEV 20261021-214000

Theo yêu cầu tiếp theo, đã build/đóng gói DEV thành công một lần, exit 0; giữ đầy đủ native audit và codesign guard. Không thêm feature hoặc đổi auth/model/reasoning/service_tier.

App: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev Review 20261021-214000.app`

Log: `/tmp/shortcut-dev-20261021-214000-build.log`

Profile development, web 5273 / worker 8887, existingDataRoot=null; bootstrap dùng `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`. Không khởi chạy bundle để xác minh runtime.

Đã đối chiếu 24 source input không đổi trong lúc build, các module worker/lib sửa khớp hash bản source. Parser worker/provider-response.mjs và import worker/ai-operation.mjs có trong package, đúng nội dung; ai-input, server, bootstrap/runtime-config cũng khớp. Client đã biên dịch chứa marker draft/manual-main và diagnostics. Manifest tại Contents/Resources/source-build-manifest.json; kiểm tra file/package tĩnh, không phải test/runtime QA.

App Review 20261021-205914 đang chạy được giữ nguyên, không đóng/restart hoặc đổi bundle đó; bản đang mở chưa dùng diagnostics mới. Sau khi lưu nháp/công việc hoàn tất, người dùng thoát app cũ bình thường rồi mở bundle mới; không chạy đồng thời cùng cổng DEV.

Không test, render, browser automation, AI, YouTube hoặc ASR. Chỉ compile/package/native audit/signing bắt buộc; cảnh báo chunk lớn, không lỗi. Chưa xác định nguyên nhân provider cũ và không tuyên bố QA pass. Chưa commit/push/merge; chỉ bổ sung tài liệu sau build, source app giữ nguyên.
