# AI providers

## Codex CLI

**ChatGPT Auto · Terra high** chạy qua Codex CLI do người dùng tự cài riêng, không đóng gói trong app. Sau khi cài, chạy `codex login` trong Terminal. `worker/codex-cli.mjs` gọi `codex exec` với model `gpt-6.1-terra`, reasoning `high`; nếu model bị từ chối thì báo lỗi, không tự đổi model. Không cần API key riêng cho luồng này. Quyền sử dụng và quota phụ thuộc tài khoản Codex.

- `SHORTCUT_CODEX_BIN`: đường dẫn tuyệt đối tới binary `codex`; dùng khi worker không tìm thấy CLI.
- `SHORTCUT_CODEX_TIMEOUT_MS`: thời gian chờ tối đa mỗi lần gọi, tính bằng mili giây.
- `SHORTCUT_CODEX_FRAMES`: `0` tắt khung hình; `1`–`24` đặt số khung hình lấy mẫu.
- MAIN nhận text và tối đa 24 khung hình lấy mẫu đều phủ toàn video qua `worker/coverage-frames.mjs` và `lib/frame-rules.mjs`. Teaser vẫn text-only. Khung hình thưa không phải xem video liên tục; không có âm thanh.
- Mỗi lần gọi tốn khoảng **10–15k token nền** của Codex, chưa gồm dữ liệu tác vụ và kết quả; đây không phải tổng token cố định cho mỗi video.

Trạng thái: `GET /api/codex/status`; `GET /api/chatgpt/session` giữ hình dạng cũ để tương thích. `GET /health` có trường `codex`.

OAuth trong app đã được gỡ: không còn callback `:8987/auth/callback`, kho credential ChatGPT Keychain/DPAPI, `chatgpt-credential-store.exe`, `/api/chatgpt/auth/*`, `/api/chatgpt/models` hay `DELETE /api/chatgpt/session`. App không còn đọc credential OAuth cũ và không tự xoá dữ liệu đó. Nếu muốn tự dọn, người dùng có thể xoá đúng mục ChatGPT cũ của ShortCut Studio trong Keychain Access (macOS), hoặc đúng file credential DPAPI cũ trong thư mục media của profile tương ứng (Windows); giữ dữ liệu đăng nhập Codex và các dữ liệu khác.

## Web thủ công và TXT

Ba chế độ Gemini, ChatGPT web, Muse giữ nguyên thao tác tải TXT/video, gửi trên website và nhập JSON. TXT hiện tại là **v24** (`lib/txt-signals.mjs`): chuỗi số dạng cột, `cutPoints`, `timeMap`, `signalAvailability`; v19–v23 vẫn import được. Đăng nhập website do người dùng tự thực hiện ngoài app.

## Mock và Manual cut

Mock tạo plan mẫu trên máy, không gọi AI. Manual cut bỏ qua toàn bộ AI layer và dùng timestamp do người dùng nhập. Cả hai vẫn dùng chung pipeline FFmpeg để dựng layout và render MP4.

## Troubleshooting

- **Worker offline**: chạy worker của đúng profile đang dùng.
- **CODEX_NOT_FOUND**: cài Codex CLI hoặc đặt `SHORTCUT_CODEX_BIN` thành đường dẫn tuyệt đối tới `codex`.
- **CODEX_NOT_LOGGED_IN**: chạy `codex login` trong Terminal.
- **CODEX_MODEL_REJECTED**: kiểm tra quyền dùng `gpt-6.1-terra`; app không tự chuyển model.
- **CODEX_TIMEOUT**: kiểm tra tác vụ và cấu hình `SHORTCUT_CODEX_TIMEOUT_MS` nếu cần.
- **CODEX_OUTPUT_INVALID / CODEX_ABORTED**: kết quả không hợp lệ hoặc tác vụ đã bị huỷ; kiểm tra thông báo trước khi thử lại.
- **Video không phát**: bấm **Chuẩn bị source để render** trước. Player cần worker đang chạy và đọc source qua endpoint hỗ trợ HTTP Range.
- **Render báo timestamp vượt source**: sửa timestamp hoặc Generate plan lại cho video đang mở.

## ChatGPT Auto = chế độ thủ công, tự động

Trong Editor, **ChatGPT Auto** chạy đúng quy trình của chế độ web thủ công, chỉ bỏ thao tác tay:
tạo cùng TXT (cùng prompt, tín hiệu, 3 ứng viên teaser mỗi part) → gửi nguyên văn cho Codex
(`gpt-6.1-terra`, `high`) kèm tối đa 24 khung hình phân bố đều (Codex không nhận được file video) →
nhận JSON thô → nhập qua đúng bộ nhập JSON thủ công (`provider: chatgpt-web`). Worker: `auto-cut` mode
`codex-run` (`runCodexTxt` trong `worker/analysis-service.mjs`, chế độ `txtPrompt` của `worker/codex-cli.mjs`).
Hàng loạt (Batch) vẫn dùng pipeline Auto phía worker cũ.
