# Tiến độ nút Chuẩn bị nguồn — 2026-10-21

Follow-up cùng ngày: `docs/source-probe-render-performance.md` ghi sửa probe bị
chờ render. ffprobe chuyển sang lane nhẹ có giới hạn/timeout riêng; FFmpeg ghép/
chuẩn hóa còn xếp hàng nặng thì báo “Chờ render để xử lý nguồn…” hoặc “Chờ tác vụ
media khác…”, không giả là đang kiểm tra. Các ghi chú build phía cuối mục này là
bản trước follow-up; build mới xem đầu CODEX_HANDOFF.md.

- Nút sau ô URL YouTube nhận tiến độ tải thật, thay vì chờ JSON cuối cùng.
- Phần trăm là downloaded_bytes / total_bytes của từng luồng hình/tiếng/media.
  Nếu chỉ có total_bytes_estimate, hiển thị ≈. Không biết tổng byte thì không
  bịa phần trăm. Tải hình100% không đồng nghĩa toàn nguồn sẵn sàng; còn tiếng,
  ghép, kiểm tra, chuẩn hóa nếu cần và hoàn tất phụ đề/context.
- Các bước không có tiến độ định lượng hiển thị tên bước. YouTube.js fallback
  chưa xuất byte progress nên hiện “Tải nguồn…”; không có bộ đếm thời gian giả.
  Local upload giữ trạng thái chuẩn bị hiện có, chưa đo phần trăm upload.
- Source được tái sử dụng không tải lại để có thanh tiến độ. Shared download,
  cancellation, retry/timeouts, chất lượng và cache identity hiện có giữ nguyên.

## Đường chạy

`app/page.tsx:prepareSource` POST `/api/sources/youtube` thêm opt-in
`progress:true`. Route stream NDJSON trên chính kết nối đó: progress an toàn
(phase, percent, stream, estimated), result với publicSource như trước, hoặc error.
Không opt-in vẫn JSON201 như cũ; frontend cũng chấp nhận JSON từ worker cũ.
Không có request polling, job/database mới hoặc download mới phục vụ tiến độ.

`worker/youtube-downloader.mjs` dùng `--progress --newline --progress-delta 1`
và template JSON chọn riêng số byte + codec, không parse dòng log người dùng,
filename, URL ký hoặc cookies. Parser từng stream giữ đuôi tối đa8KiB; UI có
trần8MiB cho một dòng kết quả. Listener tối đa64 nguồn/16 mỗi nguồn; unsubscribe
trong finally. Hàng đợi ghi tiến độ chậm vượt16KiB thì bỏ bản tin tiến độ, không
bỏ result. Subscriber cũ/hủy/đổi source không cập nhật state mới; reset progress
khi hoàn tất/lỗi/đổi nguồn. Reload giữ thông báo interrupted, không khôi phục
một % giả hoặc tự tải lại.

Tham khảo tài liệu chính thức yt-dlp về progress-template (không sao chép code):
https://github.com/yt-dlp/yt-dlp#verbosity-and-simulation-options

## Bàn giao

Không chạy test/lint/tsc/browser/YouTube/AI/ASR/render hoặc tải nguồn thử. Chỉ rà
source/diff và build DEV; kết quả ở đầu CODEX_HANDOFF.md. Chưa xác minh phần trăm
trên download thật. Người dùng tự thử: dán link mới -> Chuẩn bị nguồn -> % theo
luồng -> các bước hoàn tất -> Nguồn sẵn sàng; đổi link khi tải, lỗi mạng, nguồn
cache không tải lại, fallback không % vẫn hoàn tất đúng. Không đổi UI render hoặc
engine/plan/teaser/nhạc/phụ đề.

DEV cuối đã build thành công (Node22, exit0), log
`/tmp/shortcut-dev-source-preparation-progress-final-20261021.log`. Bản build
đầu được thay thế do bổ sung JSON null khi thiếu trường byte. Hash worker đóng
gói khớp source. Không restart app/worker; chưa tải link thật để nghiệm thu.
