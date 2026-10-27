# Beta1113 — progress, video nén, RAM/idle

## Quyết định cuối thay480p

`worker/web-ai-video.mjs` không tải rendition từYouTube nữa. Bản giao web lấy
từ mediaPath local, H264 CRF23/presetveryfast/2threads/AAC96k, giữ kích thước
nguồn (làm chẵn tối đa1pixel), frame rate/timeline đầy đủ. Không giảm resolution,
không ép100MB, không retry giảm chất lượng. Nếu encode lớn hơn nguồnMP4<=512MiB,
dùng nguồn nhỏ hơn, cache marker thay vì copy source. Cachev4 bao gồm quality
policy và source fingerprint/stat, không nhận cache480p. Nguồn edit/render,
teaser/main/timecode/audio mix/export không đổi. Nén lossy không thể chứng minh
GPT đọc mọi chi tiết đúng; model phải nêu chi tiết mờ/không đọc được. File vượt
512MiB bị chặn, không tự cắt video hoặc gửi thiếu để báo thành công.

`describe` vẫn chỉ stat manifest, không hash/encode/download khi tạoTXT. Source
binding ổn định trước/sau prepare; JSON importer vẫn xác minh source/request/
context. Promptv12/type declaration ghi policy mới; không rebindJSONv11 cũ.

## Progress thực

| Tác vụ/bước | Nguồn | Hiển thị |
|---|---|---|
| TXT thu thập/đóng gói | NDJSON preparation hiện có | Bar chưa xác định + bước + elapsed, không%giả |
| TXT giao browser | BlobTXT đã tạo và clickdownload |100% tạo/giao tệp, không xác nhận lưuđĩa |
| Identity/cache/chờ lane/validation video | worker progress | Bar chưa xác định + bước + elapsed |
| Nén video | FFmpeg out_time_us / source.duration |%bước nén, cap99 trước kiểm tra/publish |
| Truyền video | Bytes qua HTTP pipeline / file bytes |%bước truyền, MiB, tốcđộ/ETA khi đủ mẫu |
| Hoàn tất HTTP | pipeline hoàn tất |100% đã truyền cho browser; không xác nhận lưuđĩa |

- `components/task-progress.tsx` thêm indeterminate opt-in, dùng style hiện có.
- `components/manual-video-download.tsx` giữ state riêng, poll700ms không khiến
  toàn Editor rerender; thành công/hủy ẩn5s, lỗi cóChi tiết, Dừng rõ ràng.
- `lib/manual-video-download.ts` dùng iframe/native download +status, không
  tải cảvideo<=512MiB thànhBlob/ArrayBuffer trong heapJS. Poll chỉ đọc tiến trình
  của cùngUUID, không tạo job; mấtkết nối không khởi động lại encode.
- `worker/server.mjs` map ephemeral tốiđa32 lượt, TTL5phút terminal, khôngevict
  active. Source+UUID/variant validation, Origin guard có hiệu lực. DELETE hủy
  đúng lượt; tombstone chặn Cancel đến trướcGET; duplicateGET không tạo lạijob.
  Hủy một consumer không hủy sharedencode còn consumer khác.
- `serveMediaPath` chỉ thêm meter/signal khi caller yêu cầu; giữ backpressure và
  cách truyềnmedia ở các route cũ. Poll/cancel/timer/listener/iframe có cleanup.

## Tài nguyên có bằng chứng và sửa

- MusicPanel dừngnghe thử trước đây chỉpause, giữsrc/ref/callback. Nay clear
  src/load +null handlers/ref khi stop/end/error/source/part/workspace/unmount;
  async play cũ bịepoch chặn. Mix đã bị thay cũng giải phóng element, không
  xóa lựa chọnnhạc, mix hợp lệ đang dùng hoặc bảnnháp.
- PreviewBackground trước đây RAF liên tục ngay khi pause/opacity0. Nay không
  tick khi ẩn/pause; vẽ theo framevideo khiplay, fallbackRAF, wake cho seek/
  loadeddata/timeupdate/pause/deck/source; canvasDOM giữ để không clear nền lúc
  handoff. Cleanup callbacks vàlisteners theo deck/source/unmount.
- MusicPanel syncRAF chỉ khi đang phát; pausedseek/readiness sync một lần.
- Giữ oneexport +oneeditor lane, boundedqueue, decoder/encoder2threads, filters
  1–2threads, Sharp32MiB, boundedstdout sẵn có. Không pinheapNode thấp dễOOM,
  không hạ chất lượng render hoặc chặn native preview vì export.
- Snapshot read-only hiện không cóFFmpeg/Whisper đang chạy: chưa chứng minh
  nguyên nhân peakRAM/lag dưới tải hoặc tiếtkiệm bao nhiêuMiB. Không benchmark.
  Không chỉnh OS, đóng app khác hoặc xóa dữ liệu/credentials/cachemedia.

## Nghiệm thu tay

1. TảiTXT mới và cachehit: bar/tên bước/elapsed; JSONdraft giữ; Dừng rồi làm
   lượt mới không bị completion cũ ghi đè. TXT100 không có nghĩa AI đã xửlý.
2. Tải video lầnđầu: identity/cache →chờ/nén →validation →truyền. %mỗi bước
   riêng, validation không đứng100; bytes/tổng phản ánh file thực. Tải lạicache.
3. Dừng khiqueue/nén/truyền; đổi source/workspace/đóngtab. Không cònpolling/job
   mồcôi của lượt đó; consumer khác/nguồn/plan/media không bịhủy/xóa.
4. File nén giữ1080/kích thước nguồn, fps, full đầu/cuối/audio; bản gốc không
   bịthay. File quágiới hạn báo lỗi, không cóautoqualitydrop. Xem độ rõ chữ/
   người/khoảnhkhắc bằng file thật; chưa có bảođảm suy luận củaChatGPT.
5. Nghe nhạc rồiStop/đổipart/rờiEditor: tiếng dừng, quaylại chủđộngphát được.
   Pause/play/seek nhanh, handoffdeck và đổi source: nền/nhạc vẫn đúngframe/time.

Một lượt build/package1113 +native audit/codesign/static artifactclosure theo
guard. Không tests/lint/typecheck riêng/browserautomation/AI/ASR/download/render.
HaiappBeta cố định cùngcheckpoint; DEV riêng/production/data/Windows nguyênvẹn.
Chưa QA runtime, đoRAM hoặc chất lượng/Thinking. Dọn chỉbundleappBeta bị thay,
không xóa source/Git/recovery hoặc userdata. Báo cáo build/cleanup ngoàiGit nằm
trong release/beta/cleanup-receipt-1113.json.
