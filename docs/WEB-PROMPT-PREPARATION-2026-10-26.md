# Chuẩn bị TXT độc lập với video — Beta 1111

## Bằng chứng

Log Beta còn giữ một AI_OPERATION của phiên vừa chạy:
`46e45799-2bba-409f-808b-0cf70c4a2e7b`, requestCount 0,
elapsedMs 324821. Chuẩn bị input 16321 ms; bước `web-video` 308243 ms.
Log không ghi source ID hay loại chuyển mã/tải rendition nên không kết luận
nhánh video cụ thể. Không gọi AI/download/render để tái hiện.

Đường gây chờ: `app/page.tsx:createWebAiPrompt` → auto-cut mode=context →
`createAutoCutWorkflow` → `webAiVideos.ensure`. Cả TXT và import từng chờ bước
chuẩn bị MP4 dưới 512 MiB, có thể tải rendition/chuyển mã, timeout 20 phút.
Nút Tải video đã có endpoint độc lập thực hiện cùng công việc này.

## Sửa

- `worker/web-ai-video.mjs:describe`: manifest nhẹ chỉ stat nguồn và tạo binding.
  Không hash toàn video, tải, chuyển mã hoặc đọc cache derivative tại đây.
  Bản cần chuyển đổi ghi delivery-copy-pending, bytes cuối null; không tuyên bố
  file đã sẵn sàng hay website đã nhận. `ensure`/delivery cache giữ nguyên.
- `worker/auto-cut-workflow.mjs`: context/import dùng describe, không ensure.
  Input text, collector, tiêu chí, model/reasoning, số request và validators giữ
  nguyên. Fingerprint nội dung đầy đủ trong mainContent.prepare vẫn giữ.
- `worker/server.mjs`: /manual-video vẫn chuẩn bị video riêng; kiểm tra sourceKey
  trước/sau prepare, giữ kiểm tra variant cũ. Import xác minh sourceKey/context.
  Thêm reason thời gian source-context/local-signals/source-captions; không log
  source text/output/credentials. Không đổi thời hạn hay bỏ dữ liệu để chạy nhanh.
- `app/page.tsx`: TXT nhận progress NDJSON qua reader sẵn có, hiển thị tên bước
  thật + elapsed, không bịa %. Giữ Dừng, chống trùng/stale và JSON/plan draft.
  Download video gắn sourceKey; Apply gửi lại cùng binding.
- `lib/editor-session.ts`: restore whitelist giữ sourceKey mới/variant cũ.
- `lib/muse-plan.mjs` + declarations: prompt v10 mô tả delivery pending đúng
  thực tế; nội dung/identity/schema lựa chọn giữ nguyên. Prompt cũ phải tải lại;
  không xóa plan, teaser hay JSON draft cũ.

## Giới hạn và nghiệm thu tay

Chuẩn bị metadata/comments, local signals, hash nội dung và ASR khi thiếu captions
vẫn có thể mất thời gian ở lần đầu. Không bỏ comments/replay/transcript hoặc
chạy thêm request. Comments hiện có ngân sách 180 giây; chưa có bằng chứng nó là
nguyên nhân của lượt log trên. Thời gian mới chưa đo; không hứa % giảm/quota.

1. Video >512 MiB: Tải TXT hoàn tất mà không chuẩn bị video nhẹ; kiểm tra vẫn đủ
   transcript/cue, comments/replay, rules/schema/IDs như trước.
2. Tải video sau hoặc trước TXT; nhập JSON đúng request vẫn hợp lệ. Bản nhẹ đủ
   timeline, source gốc/edit/export không đổi.
3. Tải TXT lần nữa khi input không đổi dùng prompt hiện có. Đổi source/main/yêu
   cầu rồi thử JSON cũ phải bị chặn, plan/draft vẫn giữ.
4. Dừng lúc thu thập; tác vụ cũ không tải TXT hay ghi kết quả sang phiên mới.
5. Reload sau khi đã tạo TXT vẫn giữ binding; nhập JSON đúng lượt và kiểm tra
   cả hai part, 2 teaser mặc định/phương án thứ ba có điều kiện như trước.

Build/package macOS một lượt theo guard hiện có, build1111; đối chiếu module,
frontend, native audit/codesign. Không chạy test/lint/typecheck riêng, AI, ASR,
download video, browser automation hoặc render. Chưa nghiệm thu runtime/import
hay đo lại thời gian. Windows installer không cập nhật trong lượt này.
