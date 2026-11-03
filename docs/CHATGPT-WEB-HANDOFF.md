# Hiện hành — Codex CLI và TXT v24 (2026-11-04)

ChatGPT Auto · Sol low dùng Codex CLI cài riêng, đăng nhập bằng `codex login`
ngoài app và gọi `codex exec` qua `worker/codex-cli.mjs`, model `gpt-6.1-sol`,
reasoning `low`. Không còn đăng nhập OAuth trong app. MAIN nhận text + tối đa 24
khung hình lấy mẫu đều phủ toàn video; teaser vẫn text-only. Khung hình thưa không
phải xem video liên tục và không có âm thanh. Xem [AI providers](AI_PROVIDERS.md).

Ba chế độ thủ công Gemini, ChatGPT web, Muse giữ nguyên workflow tải TXT/video
và nhập JSON. TXT hiện tại là **v24** (`lib/txt-signals.mjs`), gồm chuỗi số dạng
cột, `cutPoints`, `timeMap`, `signalAvailability`; v19–v23 vẫn import được.
Chính sách tải nguồn mặc định và bản 480p tùy chọn bên dưới vẫn áp dụng; các số
phiên bản prompt cũ và mô tả Auto text-only thuộc lịch sử.

---

# Hiện hành — tải nguồn mặc định, 480p tùy chọn (2026-11-01)

- Nút **Tải video** tải đúng file nguồn local ở bước chuẩn bị (thường1080p), không chạy FFmpeg, hash toàn file, tải mạng hoặc đổi source.
- Mũi tên nhỏ bên cạnh mở **Tải bản480p**. Chỉ lựa chọn này đi qua cache/download rendition YouTube hoặc tạo derivative cho video local như trước.
- Thanh tải/cancel dùng chung operation telemetry, truyền bằng native browser stream, không giữ toàn video trong RAM Editor.
- Prompt v15 mô tả hai lựa chọn và không coi manifest là chứng nhận upload/đọc video. Tải TXT mới một lần. Nguồn gốc có thể vượt giới hạn upload website; không tự thay bằng480p.
- File nguồn giữ extension thực, kích thước/độ phân giải thực; không upscale nguồn thấp hơn rồi gọi là1080p. Profile và dữ liệu DEV/Beta giữ nguyên.
- Chưa build hoặc nghiệm thu runtime trong lượt sửa source này.

---
Các mục bên dưới là lịch sử, không phải chính sách tải hiện hành.

# Beta1113 / promptv12 — quyết định mới nhất — 2026-10-27

Nút Tải video nén THAY THẾ Tải video480p. Dùng nguồn1080 hiện có (hoặc kích
thước thực của source), không tải một bảnYouTube khác, không tự giảm độ phân
giải/fps. Nén H264 CRF23 +AAC96k đầy đủ timeline; không ép100MB. Nếu bản gốcMP4
đã nhỏ hơn bản nén thì dùng gốc. Cache bảnnén/marker cho lượt sau. TXT chỉ chứa
manifestpending và không chờ encode. Chưa chứng minhGPTđọc chínhxác hoặc nhanhhơn.

TXT/video có progress ngay dưới nút. Chuẩn bị chưa có mẫu số: barindeterminate
+ tên bước + elapsed. Nén dùng thời gianFFmpeg/tổngsource, bước truyền dùngbyte
HTTP/tổngfile; đây không phải%toàn pipeline.100 chỉ khi bước đã xong. Video tải
native, khôngbuffer cảfile trong JS; browserquảnlý lưuđĩa. Dừng/hủy/sourcechange
thật, mộtUUIDmỗi click, pollchỉ đọcstatus, khôngjob mới. Completed/cancelled tự
ẩn5s; error cóChi tiết. JSONimport/theo dõi hai part vàchildpolicy không đổi.
Promptv11 cũ cần tảiTXT mới; plan/JSONdraft không xóa. Phần dưới là lịch sử.

# Cập nhật Beta1112 / promptv11 — 2026-10-27

- Tải video480p: YouTube ưu tiên rendition cao nhất<=480p, thiếu bản phù hợp
  mới encode từ nguồn local; không upscale nguồn/rendition thấp hơn. Cache mới
  không dùng bản720p cũ. Giữ full duration/audio/source clock; nguồn edit/render
  nguyên vẹn. TXT không chờ chuẩn bị video.
- Sau Apply thành công, có thể yêu cầu AI chỉnh cách cắt trong cùng cuộc chat,
  dán lại FULL JSON cả hai part với cùng requestId/sourceId/analysisKey/schema.
  Studio ghi nhận chữ ký Editor vừa nhập; không tự đổi lockedPlan/TXT gốc.
  Sửa tay main/teaser, phụ đề, transcript, nguồn hoặc yêu cầu thì tải TXT mới.
  Style/nhạc không làm mất lượt import. JSON lỗi giữ nguyên plan/draft.
- Mặc định loại hình ảnh trẻ em CHỈ nếu video cho bằng chứng trực tiếp rõ ràng
  và xác định được khoảng nguồn. Không đoán từ giọng/lời thoại/comments/vóc dáng.
  Chưa chắc thì giữ đoạn và báo mốc review. Auto chỉ text không kiểm chứng ảnh;
  không thêm detector/AIrequest, không tự sửa manual. Đây là prompt preference,
  không có local computer-vision enforcement, chưa nghiệm thu model làm đúng.

Promptv10 cũ phải tải TXT mới một lần; JSON draft/plan cũ không bị xóa.
Báo cáo BETA-480P-REIMPORT-VISUAL-POLICY-2026-10-27.md. Phần dưới là lịch sử.

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

Beta1111 / prompt v10: Tải TXT chỉ chuẩn bị text và định danh nguồn; không chờ
chuyển mã hoặc tải rendition của video. Tải video làm việc đó riêng khi cần.
TXT ghi rõ bản delivery đang chờ chuẩn bị; không giả kích thước/độ phân giải
cuối hoặc bằng chứng upload. Hai thao tác dùng source binding ổn định; nhập JSON
vẫn kiểm tra source/request/context và citation/range. Xem
WEB-PROMPT-PREPARATION-2026-10-26.md. Prompt v9 cũ phải tải lại TXT.

Hai nút tải, ô JSON và Apply nằm ngoài mọi danh sách thu gọn. Không có checkbox
xác nhận video, không hiển thị toàn bộ prompt hoặc trạng thái tự đọc câu trả lời.
Bộ đếm thời gian chỉ áp dụng khi app thật sự chuẩn bị context/kiểm tra import;
app không đoán tiến trình AI chạy trong website.

## Teaser và dữ liệu

Manual web dùng prompt/schema v9: mỗi part bật teaser yêu cầu mặc định 2 lựa chọn
xếp hạng, gồm winner và 1 alternative; chỉ có phương án thứ ba nếu khác biệt
đáng giá, vẫn tối đa hai alternatives. Mỗi lựa chọn có range,
citation/evidence, kết thúc trọn ý và giải thích tiếng Việt. Không bịa ứng viên
cho đủ số; importer kiểm tra từng lựa chọn, loại range trùng và báo nếu thiếu.
Các lựa chọn hợp lệ được giữ trong danh sách ứng viên hiện có.
Title/hook/hashtag giữ ngôn ngữ nguồn (ví dụ vi); giải thích vẫn tiếng Việt.
Không còn enum năm ngôn ngữ. Import chặn mã ngôn ngữ khác nguồn đã biết,
không tự dịch hoặc ghi đè title đang lưu. Prompt v8 phải tải lại TXT sau khi cập nhật source v9 này. Source v9 được chốt đóng gói ở build 1109; app 1108 cũ chưa chứa sửa. Xem MANUAL-WEB-COMPACT-UX-2026-10-25.md.
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
