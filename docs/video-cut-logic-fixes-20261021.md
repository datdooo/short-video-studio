# Sửa theo audit logic cắt — source review 2026-10-21

Base `69307f4`, branch `recovery/visual-dev-reconstructed`. Bảo toàn audit gốc
`video-cut-logic-audit-20261021.md` và toàn bộ historical QA. Bảng này là thay
đổi source đã rà; không phải kết quả test/render/provider/hiệu năng đã chạy.
Chi tiết selector/IME/reuse: `teaser-evidence-ranking-20261021.md`.

| Audit | Sửa trong source |
| --- | --- |
| F1 | `validatePlan(...,{teasers:false})` cho edit/analyze/repair; render strict. Chỉ validate teaser mới của part đích, không để teaser cũ part kia chặn retry. |
| F2 | Giữ cue có timing thật; plain transcript estimate gắn provenance, giữ mili giây VTT. Không dùng cue thô để chứng minh cắt từ/tail hay coi punctuation là trọn câu. |
| F3 | `effectiveCutPlan` dùng chung preview/snapshot: manual exact, old AI start trim một lần; không Smart Cut lần nữa sau snapshot. Manual mới đặt applied flags ngay. |
| F4 | Batch resume kiểm tra theo checkpoint; `needsAnalysis` chưa đòi teaser render-ready. `needsTeasers` sửa riêng teaser, không gọi lại main; không tự đổi provider web/manual. |
| F5 | `effectiveCaptionTrack` cho preview/selector/readiness/snapshot/export. Edits hiện hành ưu tiên; không tạo/đổi caption track sau snapshot. Subtitle chưa chuẩn bị phải xử lý trong editor trước xuất. |
| F6 | `validSourceRange` dùng chung strict numeric/finite/EOF; không tolerance khác nhau giữa UI/worker/range input, không tự clip mốc. Giới hạn worker500 source segments; Timeline giữ giới hạn hiện có200. |
| F7 | Selection binding source/caption/transcript/request/evidence/ranges/model/prompt; UI/API/import/batch/execute/resume kiểm tra. Old AI không đủ binding cần chọn lại, không tự thay job đã gửi. |
| F8 | Scope replay vào main/permitted ranges, gom plateau/đỉnh trước suppression/topK; thêm proposals độc lập và ưu tiên replay khi GPT so sánh nội dung tương đương. |
| F9 | MP4 render trong scratch có marker owner, probe contract rồi hard-link publish không overwrite; journal inode/size/mtime/policy cho crash giữa publish và persist. Scratch task-owned xóa finally. |

## Defensive R1–R3

- R1 preview: vẫn đúng2 decks/snapshot video elements. Nghe waiting/stalled/
  seeked/playing/error/ended; BGM chờ deck thực phát, clock đồng bộ lại; warm
  tolerance giảm xuống khoảng nửa frame30fps, timeout15s dừng có lỗi. Dispose
  hủy timer/listener; owner/generation chặn callback nguồn cũ. EOF sớm báo lỗi,
  không freeze/padding để che. Độ mượt/seek/decode thực tế chưa đo.
- R2 probe: lưu coded/display geometry, SAR/rotation, start/duration video/audio;
  bỏ `setsar=1` trước lớp spatial filter cần SAR. Nếu range vượt audio đã biết,
  báo lỗi trước xử lý, không tự thêm silence/cắt main. Long-GOP/VFR/nonzeroPTS
  vẫn cần người dùng thử; chưa tuyên bố đã giải quyết mọi loại nguồn hay lag.
- R3 job-owned scratch: chỉ dọn thư mục `.render-work-v1-*` có marker trùng
  sourceId/jobId; ambiguous và exports cũ không bị xóa. Sau cancel/fail/success
  xóa scratch của lượt hiện tại. Không quét/xóa media hoặc dữ liệu khác.

## Tương thích và việc chờ nghiệm thu

- Renderer vẫn dùng sequential FFconcat/range seek, resource lease một tác vụ
  nặng, thread limits và chất lượng đã có; không trở lại nhiều nhánh trim buffer.
- Snapshot cũ chưa chốt start/Smart Cut, AI thiếu binding hoặc output cuối cũ
  không có bằng chứng publication phải mở editor/chọn lại/gửi **job mới** khi
  được yêu cầu. Không sửa job, ghi đè/xóa hoặc nhận output cũ là output sạch.
- File đã publish và ghi nhận hợp lệ vẫn được resume dùng lại. Journal chỉ cho
  nhận lại đúng inode/size/mtime/policy và probe, không nhận file lạ chỉ vì tên đúng.
- Không đổi UI layout, foreground framing, preview1×, export1.25×, music gain,
  VisualStyle/transition presets hoặc metadata-clean output policy.
- Chưa chạy test/lint/tsc/render/provider/ASR/browser/listening/benchmark. Build
  không chứng minh audio tail, frame count, seek, RSS/swap hoặc chất lượng teaser.
