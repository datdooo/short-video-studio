# Bổ sung: ưu tiên mọi bản nguồn hợp lệ còn trong Kho

Người dùng yêu cầu tránh tải lại nếu vẫn có video trong Kho. Index cũ chỉ giữ
một sourceId/URL nên bản cache trỏ tới bản đã xóa có thể che khuất một bản còn
hợp lệ. Scan hiện ghi thêm danh sách ứng viên local theo YouTube ID (cùng giới
hạn scan hiện có, không scan Trash). get thử index ưu tiên rồi các bản local
cùng ID, mới nhất trước, không lặp sourceId. load/probe và đối chiếu sourceId/
kind/YouTube ID trước khi trả. Chỉ nguồn thiếu file bị loại; busy/cancel/probe/
permission/identity lỗi không tự biến thành tải mới. Nếu tìm được local hợp lệ,
trả ngay trước metadata mạng/download. Sau explicit Restore, bản khôi phục cũng
vào danh sách; không ghi đè mapping mới hơn. Xóa một source chỉ gỡ đúng nó.
Nếu scan bị giới hạn và chưa chứng minh không còn bản khác, giữ chặn download
cũ để tránh tải trùng. Nguồn còn trong Trash không tự khôi phục/dùng lại.

Sửa này được gom cùng bản đóng gói mới theo yêu cầu, chưa chạy download/AI/
tests/render để kiểm chứng. Runtime reuse nhiều bản cùng link cần nghiệm thu.

# User clarification: nguồn đã xóa trong Kho

Người dùng xác nhận đã chủ động xóa video nguồn trong Kho. Thư mục chỉ còn
metadata là trạng thái phù hợp với move/purge media của Kho; lỗi là cache tái
sử dụng vẫn trỏ vào nguồn đó. onMoved/onRestored trước đây chỉ xử lý part/parts,
bỏ qua original nên source reuse index không được thông báo.

Bổ sung: onMoved(original/current) gọi sourceReuse.forget đúng sourceId, không
xóa mapping của bản tải mới cùng URL. onRestored(original/current) cập nhật
index từ file đã được người dùng khôi phục nếu metadata/video hợp lệ; không
thay mapping mới hơn. Không tự khôi phục file từ Trash hoặc tải mạng ở callback.
Purge vĩnh viễn chỉ xóa mục đã chuyển Trash; entry nguồn đã bị loại khi move.
Sửa missing-media và reindex bên dưới vẫn xử lý cache cũ từ bản trước.

Tải lại qua URL chỉ chạy khi người dùng chủ động Chuẩn bị nguồn. Chuyển Trash
khác purge: move giữ file cho người dùng Restore; purge không được tự hoàn tác.
Không động source đang chạy/Editor; guard ownership/lease/busy của Kho giữ nguyên.
Chưa build/test/download/AI/render; dữ liệu hiện tại và bản app1109 không đổi.

# Missing local source media — 2026-10-25 (source only)

User screenshot: source preparation fails for YouTube 00ZFME7VEr8 with
“Không tìm thấy media file sau khi chuẩn bị source.”

Read-only evidence in Beta data: youtube-source-index.json points to source
 e5548e69-1326-45ea-9300-91fbd48d62c0. Its directory contains source.json only;
no source.mp4 or other source media exists. This is a missing cached local
video, not evidence that the latest remote download/merge failed. No matching
trash media record was found; why the video disappeared remains unknown.
Launcher log does not retain the original media-loss event. No network request,
video download, ASR, AI or render was performed for this diagnosis.

Code path: importYouTube -> sourceReuse.get -> cached index -> loadSource ->
findSourceMedia. findSourceMedia threw an untyped Error. Source reuse only
invalidates ENOENT/ENOTDIR, so existing metadata + absent media propagated the
generic error rather than treating that index entry as unusable.

Fix:
- worker/server.mjs: findSourceMedia emits SOURCE_MEDIA_MISSING / 404 with a
  correct saved-source message.
- worker/source-reuse.mjs: evict and persist that one stale index entry when
  SOURCE_MEDIA_MISSING, ENOENT or ENOTDIR is encountered. The user's existing
  prepare action can then proceed through its normal metadata/download path.
  Cancellation still propagates; probe/auth/identity and other errors do not
  trigger this fallback. Reindex skips metadata-only source directories so it
  does not re-add that unusable source after restart. No broad cleanup or
  automatic retries are added.

Existing source metadata/history/plan/draft/media/trash were not modified.
No tests/lint/typecheck/build/browser/render/AI/ASR/download. App release and
Applications still build 1109; need a separately requested build to deploy.
Manual checks: missing-media cached link can prepare again; valid cached source
reuses without download; cancellation and auth/probe errors do not restart a
transfer; failed download does not resurrect the removed stale disk index.
