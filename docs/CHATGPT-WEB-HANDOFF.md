# Web thủ công — ChatGPT / Gemini / Muse (2026-10-25)

Quyết định mới nhất thay thế luồng extension/auto gửi–nhận trước đây.
Không cần extension, không đọc DOM, không tự gửi hoặc tự lấy câu trả lời.

## Thao tác

1. Chọn source và provider web trong Editor.
2. Bấm **Tải TXT**: tạo context/prompt hiện tại rồi tải một tệp
   `analysis-<requestId>.txt` đầy đủ. Khi context không đổi, dùng lại prompt.
   Không cần bấm Tạo prompt trước, không chia block, không cắt dữ liệu.
3. Bấm **Tải video**: trình duyệt tải MP4 qua endpoint nguồn hiện có.
   Có thể tải độc lập trước TXT. Giữ cơ chế bản toàn thời lượng độ phân giải
   thấp hơn khi nguồn vượt 512 MiB; không thay source/edit/export.
4. Người dùng tự đính kèm hai tệp và gửi trên website đã chọn.
5. Dán JSON vào ô luôn hiện bên dưới, bấm **Áp dụng 2 part**.

Hai nút tải, ô JSON và Apply nằm ngoài mọi danh sách thu gọn. Không có checkbox
xác nhận video, không hiển thị toàn bộ prompt hoặc trạng thái tự đọc câu trả lời.
Bộ đếm thời gian chỉ áp dụng khi app thật sự chuẩn bị context/kiểm tra import;
app không đoán tiến trình AI chạy trong website.

## Teaser và dữ liệu

Manual web dùng prompt/schema v7: mỗi part bật teaser yêu cầu 2–3 lựa chọn
xếp hạng, gồm lựa chọn chính và tối đa hai alternatives. Mỗi lựa chọn có range,
citation/evidence, kết thúc trọn ý và giải thích tiếng Việt. Không bịa ứng viên
cho đủ số; importer kiểm tra từng lựa chọn, loại range trùng và báo nếu thiếu.
Các lựa chọn hợp lệ được giữ trong danh sách ứng viên hiện có.
ChatGPT Auto vẫn một lựa chọn, Sol low/text-only theo cấu hình hiện tại.

Giữ source/request/analysisKey, toàn bộ text và tiêu chí hiện hành, schema import,
main chỉnh tay/locks và source timestamps. JSON cũ không tự gắn identity mới.
Import lỗi giữ plan/draft. Apply thủ công không chứng minh website đã đọc video;
không gán biên nhận upload hoặc tuyên bố model đã quan sát hình ảnh.

## Implementation và đóng gói

- `app/page.tsx`: TXT/video trực tiếp, import thủ công qua validator hiện có.
- `lib/muse-plan.mjs`, `lib/teaser-import.mjs`: prompt/schema và alternatives.
- `worker/auto-cut-workflow.mjs`: bỏ receipt extension, giữ kiểm tra import.
- `worker/web-ai-video.mjs`: cơ chế MP4 download hiện có được giữ.
- `scripts/package-macos.mjs`: không đóng gói browser extension nữa.
- Xóa component bridge và sáu file extension; không gỡ extension đã cài trong
  Chrome, không sửa app đang chạy hoặc bundle cũ trong lượt source này.

Source được chốt cho build Beta 1107. Chỉ chạy các bước build/package bắt buộc
và kiểm tra tĩnh artifact; không test/lint/typecheck riêng/browser/AI/render/
download/ASR. Chưa nghiệm thu download/import hoặc chất lượng teaser runtime.
