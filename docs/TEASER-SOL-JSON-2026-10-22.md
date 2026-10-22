# Teaser Sol / JSON

Teaser provider riêng gpt-6.1-sol reasoning low; main provider gpt-6-luna none giữ nguyên. Memo/provider cache phân biệt task/model/reasoning; selector giữ text-only, criteria, pipeline và request/repair limits cũ. Không tăng inference requests.

Không có catalog tài khoản được lưu cục bộ. Chưa gọi AI hoặc endpoint catalog trong lượt sửa. Bổ sung preflight GET /v1/models qua OAuth hiện có khi người dùng chủ động chọn teaser: yêu cầu đúng slug gpt-6.1-sol; nếu catalog có effort metadata thì phải chứa low; model vắng hoặc effort không hỗ trợ sẽ fail, không fallback. Đây là request metadata, không inference; chưa xác nhận quyền model của tài khoản tại thời điểm build. Model docs chính thức xác nhận low là giá trị model hỗ trợ: https://developers.openai.com/api/docs/models/gpt-6.1-sol . Không coi tài liệu/catalog hardcode là xác nhận tài khoản.

JSON: giữ điều kiện response.completed/status=completed; incomplete/failed/stream interrupted báo riêng. Chỉ lấy message/content/output_text, không lấy reasoning. Refusal explicit được phân loại riêng; nhiều output_text không ghép tùy tiện thành JSON. SSE event lặp cùng sequence và cùng dữ liệu được bỏ qua; cùng sequence khác dữ liệu báo parser lỗi. Final text từ completed được ưu tiên khi có; delta/done dùng part index, done thay delta chứ không nối lặp. Bỏ strip code fence bằng regex; JSON.parse nguyên text trim, không vá JSON/không bịa field hoặc bỏ schema validator. Output lỗi cũ không còn nên chưa xác định model sai JSON hay lỗi vận chuyển/ghép; không quy chắc do Luna.

Giữ main/teaser/draft theo cơ chế preserve-on-error hiện có. Không gọi AI/test/render. App cố định được build sau khi chủ dự án Quit; không Review mới, không push/merge. Chưa xác minh runtime/provider.

Build/package một lần thành công vào release/dev/ShortCut Studio Dev.app. Đối chiếu 8 module khớp source, DEV config giữ nguyên; main Luna/none, teaser Sol/low + catalog guard và parser mới trong package. Không gọi catalog/AI/test/render; chưa xác minh catalog tài khoản hoặc runtime. Log: /tmp/shortcut-dev-sol-json-build.log.
