# Kiểm tra nguồn khi render / giảm xử lý dư — 2026-10-21

Phạm vi DEV, base `0bbc6ff3d696d63698c1226f226c0316d2d99e1e`, branch
`recovery/visual-dev-reconstructed`. Chỉ đọc source/diff và trạng thái có sẵn;
không chạy test/lint/typecheck, render/benchmark, tải thử, AI/ASR hoặc browser.

## Nguyên nhân có bằng chứng

- `server.run` xếp cả ffprobe vào exclusive heavy lease. `executeRender` giữ
  lease xuyên các part; probe nguồn mới và cả loadSource của nguồn cache phải
  chờ toàn job. Downloader đã phát phase `probing` trước khi xếp hàng nên UI ghi
  “Kiểm tra video…” trong lúc chưa được chạy. Log launcher có sẵn không có dòng
  lỗi/timeout ffprobe để chứng minh một lỗi file/decoder khác.
- Snapshot read-only worker đang chạy: active=render, waiting=2. Job Editor đang
  part1, progress19, encoder=h264_videotoolbox, encoderFallback=false. Đây là
  trạng thái một thời điểm, không phải benchmark hay bằng chứng tốc độ trung bình.
- Transition blend có biểu thức tính từng pixel foreground trên toàn part,
  mặc dù atlas mặc định ngoài cửa sổ hiệu ứng là đen và phép screen là identity.
  subtitleFrames tạo lại PNG cho từng cue, kể cả đồ họa giống hệt khi teaser lặp
  lại lời trong main. Đây là việc xử lý dư xác định từ code; chưa đo tỷ trọng.

## Đã sửa source

1. Metadata có lane serial riêng: tối đa1 ffprobe chạy,16 lượt nền chờ và1 chỗ
   ưu tiên dành cho heavy lease đang giữ. Probe dùng1 thread, probe-size5MB và
   analyze-duration5s; không đếm/giải mã toàn bộ frame. Request nền có deadline30s
   gồm chờ và chạy. Probe thuộc heavy lease được chạy kế tiếp, có30s thực thi tính
   từ khi bắt đầu để tải nguồn nền không làm hết ngân sách xác minh MP4 của job.
   Parent/job cancel vẫn truyền qua; child group vẫn TERM/KILL và giữ slot đến
   close. Probe thiếu slot/timeout báo lỗi cụ thể, không tự tải lại qua mọi engine.
2. Truyền AbortSignal qua probe tải/chuẩn hóa và loadSource cache/mới, preflight/
   resume render. Khi FFmpeg ghép/chuẩn hóa thật sự phải chờ heavy lease, tiến độ
   hiện “Chờ render để xử lý nguồn…”/“Chờ tác vụ media khác…”; khi bắt đầu mới
   trở về phase thực. Không cho chạy thêm export/ASR/normalize song song.
3. Blend chỉ bật trong union đúng các cửa sổ transition đang có, giữ nguyên
   inclusive endpoints, biểu thức pixel, clock mapping, format và alpha mask.
   Đã đọc help của FFmpeg đóng gói: blend hỗ trợ timeline `enable`. Đây là đọc
   capability, không xử lý media. Các nhánh wash/scale/alpha vẫn tồn tại; không
   tuyên bố toàn graph không tốn CPU ngoài transition.
4. Cache SVG→PNG chỉ trong một lần subtitleFrames, tối đa256 entry; key là toàn
   SVG. Cue lặp dùng cùng bitmap, giữ nguyên ffconcat order/duration/blank/tail.
   Không giữ cache toàn cục, không đổi cache phụ đề/người dùng hay tạo media mới.

Không đổi FFmpeg range assembly đã sửa lag: packet concat tuần tự/PCM hữu hạn,
one output clock, một render nặng. Chất lượng giữ1080×1920/30fps, source1.25×,
framing125%, VT16M (max20M/buf32M) hoặc CPU CRF17/medium, AAC192k, Rec.709,
faststart và metadata sạch. Không tăng thread, giảm ưu tiên chất lượng hay đổi
teaser/main/transition/subtitle/BGM. Preview vẫn1×. Không có code upstream mới.

## Bàn giao / giới hạn

Chưa đo thời gian, CPU/RAM, chưa so MP4/hình ảnh hoặc nghe audio. Không khẳng định
đã hết lag, tăng tốc bao nhiêu hoặc TikTok giữ nguyên chất lượng sau recompress.
Hai tối ưu chỉ có tác dụng tương ứng khi có transition/cue lặp.

Build DEV cuối và trạng thái app xem đầu `CODEX_HANDOFF.md`. Không restart worker,
đóng app, hủy/submit job, sửa nguồn/exports, credentials, production hoặc backups.
Bản đang mở tiếp tục chạy code cũ; chờ job kết thúc rồi thoát bình thường và mở
`release/dev/ShortCut Studio Dev.app`. Không có migration làm output cũ thành mới.

Người dùng tự thử: trong lúc render, chuẩn bị nguồn mới/cached -> kiểm tra metadata
không đợi cả job; chuẩn hóa nặng hiện chờ rõ. Kiểm tra Cancel/đổi link không cập
nhật nguồn cũ. Xuất job mới có transition/phụ đề và so với bản trước về thời gian,
frame quanh cut, foreground mask, chữ, A/V tail và BGM; không dùng build success
thay nghiệm thu media. Không push/merge trong lượt này.
