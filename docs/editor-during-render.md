# Editor hoạt động khi render / bitrate vừa phải — 2026-10-21

Yêu cầu mới thay thế pause-on-export trong `render-resource-fix.md`: render chạy
nền, Editor tiếp tục phát/chỉnh/Generate/nguồn/teaser/nhạc/phụ đề bình thường.
Giữ snapshot job bất biến và các bảo vệ xóa/trash media đang sử dụng.

## Nguyên nhân và source đã sửa

Đây là khóa chủ động, không phải lỗi decoder đã tái hiện: `exportActivity` gọi
pauseForExport, giữ renderHold, chặn Play/ticker/background/candidate/music và
worker `/api/music/preview` cùng3 chỗ isExporting trả lỗi. Global heavy lease
cũng khiến frame/ASR/chuẩn hóa/audio mix phải đợi toàn job.

- Bỏ liên kết playback/controls Editor với exportActivity; bỏ overlay và renderHold.
  Chỉ giữ exportActivity cho status thật. Pause khi đổi source/workspace/audition
  vẫn giữ. Không tự pause khi submit, không đè editor bằng job.plan trả về sau
  khi người dùng đã chỉnh thêm. Callback submit vẫn chụp plan độc lập.
- `createEditorMediaResources` có1 lane export và1 lane Editor serial, hàng đợi
  Editor tối đa64. Cho1 export +1 tác vụ media Editor chạy đồng thời; không mở
  nhiều decoder theo số range. Nested FFmpeg/Whisper kế thừa đúng lane đang giữ,
  tránh reacquire/deadlock. ASR vẫn1 tác vụ/2thread, filter1, decoder2, CPU encode2,
  nice10. Cancel của job/lượt edit độc lập; không kill process app khác.
- Gỡ pausePreviews tại submit/enqueue và worker/audio-preview export guards. VAD
  vẫn chuẩn bị trước khi giữ preview/render lease để tránh shared-promise deadlock.
  Preview mix/cache/cancel/ducking/source gain/mapping giữ nguyên.
- Metadata vẫn serial1 riêng; chỉ probe thuộc lane export được ưu tiên/reserve,
  không để editor probe nhận nhầm quyền ưu tiên. Nhãn chờ nguồn xét hàng đợi của
  chính lane Editor, không báo “Chờ render” chỉ vì có export song song.

Một tác vụ Editor nặng có thể phải đợi tác vụ Editor trước đó, nhưng không bị
khóa đến cuối render. Video/audio playback đã chuẩn bị không qua hàng đợi này.
8GB vẫn có thể chịu áp lực khi ASR+export song song; chưa đo/không hứa hết lag.

## Bitrate mới

Mặc định VideoToolbox target16M → **12M**, max20M → **14M**, buffer32M → **24M**.
CPU fallback chuyển default CRF17 sang ABR target12M/max14M/buf24M, giữ medium và
2thread; FFMPEG_CRF nếu người dùng cấu hình rõ vẫn được tôn trọng với VBV14M/24M.
Override FFMPEG_VIDEO_* hiện có vẫn được giữ. Health trả target/max/buffer để
không chỉ đổi nhãn. Các đường single/batch/resume đều dùng renderPart chung.

Giữ1080×1920/30fps, preview1×, source export1.25×, framing125%, AAC192k, Rec.709,
faststart, cut/transition/overlay/subtitle/BGM/ducking và output metadata policy.
Không transcode lại/ghi đè/xóa file cũ, không đổi cấu hình worker đang chạy. Job
đang chạy dùng code cũ; mặc định mới dùng khi chạy app build mới. Resume đang dùng
engine/default hiện hành như trước; không tự sửa snapshot source/range đã lưu.

TikTok official Media Transfer Guide khuyến nghị MP4/H.264 và nêu giới hạn FPS/
geometry/file, **không công bố một “bitrate trung bình” cho mọi video**:
https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide
12Mbps là lựa chọn cân bằng của dự án, không giả thành một chuẩn chính thức.
Giảm bitrate làm giảm dữ liệu video mục tiêu, có thể giảm size/I/O; không suy ra
render nhanh tương ứng vì graph/scale/encode còn công việc khác. Chưa so artefact
ở cảnh chuyển động cao hoặc bản TikTok recompress.

Không chạy tests/lint/tsc/browser/AI/ASR/download/render/benchmark. Source/diff
review và build DEV một lần; kết quả xem đầu CODEX_HANDOFF.md. Người dùng tự
thử Play/BGM/seek/chỉnh/nguồn/AI khi có render; cancel chỉ đúng job; so bitrate,
chữ, chuyển động/cut, audio tail của job mới. Build success không phải QA pass.
Không restart app/worker/ngắt job, production/credentials/media/exports/backups
giữ nguyên. Không push/merge.
