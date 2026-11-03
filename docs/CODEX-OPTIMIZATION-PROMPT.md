# Prompt giao việc cho Codex — tối ưu Beta

Bạn làm việc trong repo `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, nhánh `beta/maintenance`. Đọc `docs/AUDIT-2026-11-03.md` trước (mỗi mục có mã P/U/S và file:dòng). Đây là app desktop Next.js + worker Node; giao diện tiếng Việt.

## Ràng buộc bắt buộc
- Chỉ sửa trong checkout Beta. KHÔNG đụng `short-video-studio-visual-dev`, dữ liệu người dùng (`~/Library/Application Support/ShortCut Studio*`), app đã cài hay file release.
- KHÔNG gọi AI/ASR/tải video/render thật, KHÔNG build/package, KHÔNG push/merge. Làm bằng đọc code, test đơn vị và đo cục bộ.
- Đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem `AGENTS.md`).
- Giữ nguyên hành vi nghiệp vụ: logic chọn main/teaser, tiêu chí hook, định dạng JSON import, key cache, phiên bản prompt đã phát hành, quy tắc lưu nháp thủ công (không timer autosave). Mọi thay đổi chuỗi prompt phải tăng version đúng cơ chế hiện có và giữ tương thích import cũ.
- Mỗi nhóm việc = một commit nhỏ. Sau mỗi nhóm chạy `npx tsc --noEmit`, `npm run lint` và test liên quan (`node --test <file>`); cuối cùng chạy `npm test` (hiện 385/385 pass).
- Để tiết kiệm quota: chỉ đọc file liên quan, không đọc lại `docs/archive`, không refactor lan rộng, không format lại cả file.

## Nhóm 1 — Giảm re-render và polling (P1, P2, U1)
1. `use-render-jobs.ts`: chỉ cập nhật state khi dữ liệu thật sự đổi (so sánh theo `id/state/progress/phase/outputs`), poll chậm lại (vd 5s) khi không có job `queued/rendering`, và thêm endpoint/tham số trả danh sách gọn **không kèm `plan`** (giữ endpoint cũ tương thích). Kiểm tra nơi nào dùng `job.plan` để không vỡ.
2. Tách `previewCurrentTime` khỏi state gốc `Home`: dùng ref + subscribe nhỏ (vd `useSyncExternalStore`) hoặc cập nhật theo nhịp ≤10–15 Hz cho phần hiển thị; chỉ component hiển thị thời gian/timeline/phụ đề đăng ký. Sửa `use-preview-commands.ts` để listener keydown không gắn lại mỗi frame (đọc thời gian qua ref). Không đổi độ chính xác seek/đồng bộ deck.
3. Thêm `React.memo` hoặc chia nhỏ cho các view nặng nhất nhận prop ổn định (`StudioView` con: timeline, inspector, preview) nếu đo được lợi ích. Báo cáo cách đo (đếm render bằng test hoặc `<Profiler>` tạm, gỡ sau khi đo).
4. Thêm `app/error.tsx` và `app/global-error.tsx`: hiện thông báo tiếng Việt, nút thử lại, và cố gắng ghi checkpoint phiên (dùng đúng hàm lưu hiện có) trước khi hiển thị.

## Nhóm 2 — Worker và dữ liệu (P3, P4, P5)
1. `batch-history.json`: giữ định dạng cũ đọc được; giảm kích thước ghi (bỏ trường nặng lặp như `plan` đầy đủ nếu có thể khôi phục từ nơi khác, hoặc nén/tách file theo job) — chỉ khi chứng minh được không mất khả năng resume/xem lại. Thêm giới hạn số job lịch sử có cấu hình, mặc định không xoá gì nếu chưa xác nhận; viết test.
2. `source-reuse.mjs`/`queue-history.mjs`: dùng chỉ mục lưu sẵn (đã có `youtube-source-index.json`) thay vì đọc mọi `source.json` mỗi lần; fallback quét khi chỉ mục thiếu.
3. `worker/server.mjs`: thêm handler `unhandledRejection`/`uncaughtException` ghi log an toàn và thoát có kiểm soát (không nuốt lỗi), kèm test nếu khả thi.
4. KHÔNG tự xoá `sources/` hay `cache/`. Chỉ đề xuất cơ chế dọn dẹp có xác nhận người dùng (ghi vào `docs/`), không triển khai xoá.

## Nhóm 3 — UI/UX (U2–U5)
1. Bấm Lưu trên phiên chưa có nội dung không được tạo "Bản nháp đã giữ".
2. Ở ≤1050px: ẩn luôn tiêu đề tab của panel bị thu (hoặc hiện panel dạng drawer có nút mở rõ ràng); không để tiêu đề "ma".
3. Tăng cỡ chữ nền lên 14px cho nội dung chính, tối thiểu 12px cho phụ chú; vùng bấm slider ≥24px. Giữ bố cục không tràn ngang.
4. Việt hoá `aria-label`/chuỗi còn tiếng Anh (`Play preview`, `Video filter intensity`, `Overlay opacity`, `Preview`, `Inspector`, `Visual template status`); gom chuỗi mới vào `lib/ui-strings.ts`, không cần dịch toàn bộ app.
5. Kiểm tra lại bằng trình duyệt trên `http://127.0.0.1:5373` hoặc `npm run dev` với dữ liệu giả; không dùng dữ liệu thật.

## Nhóm 4 — Prompt và đồng bộ (S1–S5, S3)
1. `lib/muse-plan.mjs:37`: thay `.replace()` trên câu cố định bằng cơ chế có kiểm tra (hàm báo lỗi nếu không tìm thấy đoạn cần thay) hoặc đưa biến thể "manual" vào nguồn `main-instructions.mjs`. Thêm test: prompt manual không còn chứa câu "No images/video/audio are supplied".
2. Sửa token dính liền trong prompt (`at1x`, `first10`, `maximum9`, `normally1080p`, `480p`, `parts1/2`). Vì đổi chuỗi prompt, tăng `WEB_AI_PROMPT_VERSION` theo quy ước và giữ `WEB_AI_COMPATIBLE_PROMPT_VERSIONS` cho TXT cũ; cập nhật test snapshot/rule liên quan.
3. Hợp nhất hằng render (1080, 1920, 1.25, blur/opacity 50, 30fps) vào một nguồn từ `lib/render-config.mjs` và import ở `edit-plan.ts`, `ai-response.ts`, `auto-cut/main-content.mjs`, `light-leak.mjs`. Thêm test đảm bảo không còn literal lặp (grep trong test).
4. Gom danh sách phiên bản hook/prompt (`teaser-hooks.mjs:102`, `muse-plan.mjs:11`) thành registry có tên, dễ đọc, không đổi tập giá trị hợp lệ.
5. Với câu "không có trần tiết kiệm quota, ưu tiên chất lượng" trong prompt: KHÔNG tự đổi. Đề xuất bằng văn bản (kèm ước lượng token tiết kiệm được từ `docs/ai-efficiency.md`) để người dùng quyết định.

## Nhóm 5 — Dọn dẹp an toàn (S6–S8, P6)
1. Chứng minh bằng grep/build rằng `app/api/analyze/route.ts` và `app/api/youtube/metadata` có còn được dùng (kể cả bởi hosting build/QA). Nếu chắc chắn không dùng, đưa danh sách đề xuất xoá vào `docs/` thay vì xoá.
2. Chỉ định dạng lại (xuống dòng) các module minified bạn phải sửa trong các nhóm trên; không định dạng hàng loạt.
3. Đề xuất (không bắt buộc làm) subset font CJK sang woff2; không đổi font ID/định danh đã dùng trong plan.

## Cách báo cáo
Cuối cùng ghi `docs/OPTIMIZATION-RESULT-2026-11-xx.md` gồm: từng mã P/U/S đã làm / bỏ qua / lý do; số liệu trước-sau (payload poll, số lần render nếu đo được); lệnh test đã chạy và kết quả thật; phần chưa kiểm chứng. Không tuyên bố đã qua QA runtime nếu chưa chạy.
