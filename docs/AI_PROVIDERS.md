# AI providers

## ChatGPT plan

ShortCut Studio dùng luồng **Sign in with ChatGPT** dành cho app open-source/local. Giao diện gọi media worker trên `127.0.0.1:8787`; worker tạo host ID ổn định, mở Authorization Code flow với PKCE, xác thực chữ ký ID token bằng OpenAI JWKS và lưu credential vào macOS Keychain.

- Không cần OpenAI API key hoặc client secret.
- Phải cấp scope `chatgpt.tokens.use.direct` thì AI plan mới chạy.
- Request dùng public Responses API với `store: false` và `stream: true`.
- Model được chọn từ catalog của chính account đã đăng nhập.
- Access token được refresh trước khi hết hạn; refresh token mới thay thế token cũ trong Keychain.
- Disconnect xóa credential local. Có thể quản lý/revoke quyền phía server trong ChatGPT Settings.

ChatGPT Plus / Pro eligibility, workspace policy và usage limit do OpenAI quyết định. App không tự chuyển sang billing/API key khác khi plan usage hết hạn hoặc chạm limit.

## Mock và Manual cut

Mock tạo plan mẫu trên máy, không gọi AI. Manual cut bỏ qua toàn bộ AI layer và dùng timestamp do người dùng nhập. Cả hai vẫn dùng chung pipeline FFmpeg để dựng layout và render MP4.

## Troubleshooting

- **Worker offline**: chạy `npm run personal`.
- **AUTH_REQUIRED / AUTH_EXPIRED**: bấm **Continue with ChatGPT** để đăng nhập lại.
- **PLAN_USAGE_DISABLED**: kết nối lại và cấp quyền dùng ChatGPT plan.
- **PLAN_LIMIT_REACHED**: kiểm tra usage trong ChatGPT Settings; app không bypass quota.
- **Video không phát**: bấm **Chuẩn bị source để render** trước. Player cần worker đang chạy và đọc source qua endpoint hỗ trợ HTTP Range.
- **Render báo timestamp vượt source**: sửa timestamp hoặc Generate plan lại cho video đang mở.
