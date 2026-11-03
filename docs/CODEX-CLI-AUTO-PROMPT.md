# Prompt giao việc — thay ChatGPT Auto (OAuth) bằng Codex CLI

Repo: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, nhánh `beta/maintenance`. Đọc `AGENTS.md`, `lib/ai-reasoning.mjs`, `worker/analysis-service.mjs`, `worker/chatgpt-auth.mjs`, `worker/routes/auth.mjs` trước. Làm theo thứ tự; mỗi bước chạy `npx tsc --noEmit`, `npm run lint`, test liên quan; cuối cùng `npm test`.

## Quyết định của chủ dự án
- **Bỏ hẳn OAuth** (đăng nhập ChatGPT trong app). Máy đã cài sẵn `codex` CLI và đã đăng nhập; video đã tải về máy.
- "ChatGPT Auto · Sol low" gửi và nhận **qua `codex exec`** (CLI), tự áp dụng JSON như hiện tại.
- **Giữ nguyên 3 chế độ thủ công** (Gemini, ChatGPT web, Muse): prompt, TXT, schema, import JSON, nút tải TXT/video. Không sửa `lib/muse-plan.mjs`, `lib/teaser-import.mjs` và chuỗi prompt v23. Thêm test chứng minh prompt thủ công không đổi byte.
- Model và mức suy luận giữ nguyên: `gpt-6.1-sol`, `low`. Nếu Codex từ chối model, báo lỗi rõ, **không tự đổi model**.

## Sự thật đã đo (đừng đoán lại)
Thử trên máy này: `codex exec -m gpt-6.1-sol -c model_reasoning_effort=low --sandbox read-only --ephemeral --skip-git-repo-check --ignore-user-config --output-schema schema.json -i frame.png -o out.json "<prompt>"` chạy được (6,5 giây, thoát 0), trả đúng JSON theo schema, nhận ảnh. Chi phí nền khoảng **14k token** cho một tác vụ gần như rỗng (prompt hệ thống của Codex). `--ignore-user-config` vẫn dùng đăng nhập hiện có. `-i` của `codex exec` được thiết kế cho ảnh. Thử đưa một file `.mp4` vào `-i`: lệnh **không lỗi** (exit 0, 20k token), nhưng log cho thấy Codex tự chạy lệnh để trích một khung hình rồi mới trả lời; tức là nó xử lý video **kiểu agent, tự chọn vài khung**, không phải nhận video 1x liên tục và không nghe được âm thanh. Số khung nó tự lấy không kiểm soát được, nên **không được dựa vào hành vi này** để bảo đảm phủ hết video. Vì vậy "gửi video" = Bước 3 (app tự trích khung phủ toàn bộ thời lượng, **và** đặt file video trong thư mục job để Codex có thể trích thêm khung khi cần); âm thanh được thay bằng transcript/tín hiệu cục bộ. Phải ghi rõ trên giao diện, không gọi là "xem toàn bộ video như ChatGPT web".

## Bước 1 — Cầu nối Codex (`worker/codex-cli.mjs`, mới)
1. Tìm binary theo thứ tự: biến `SHORTCUT_CODEX_BIN` → PATH → `/opt/homebrew/bin/codex` → `/Applications/ChatGPT.app/Contents/Resources/codex-cli/...` (macOS) và `%LOCALAPPDATA%`/PATH (Windows `codex.exe`/`codex.cmd`). Kiểm tra `codex --version` và `codex login status`; lưu kết quả cache ngắn hạn.
2. Chạy bằng `spawn` với **mảng argv, không qua shell**. Tham số cố định: `exec -m gpt-6.1-sol -c model_reasoning_effort=low --sandbox read-only --ephemeral --skip-git-repo-check --ignore-user-config --ignore-rules -c web_search="disabled" --output-schema <file> -o <file> [-i <ảnh>...]` và đọc prompt từ **stdin**. Chạy với `-C` là **thư mục tạm rỗng riêng cho mỗi job** (tránh Codex đọc `AGENTS.md`/repo), xoá sau khi xong. Chỉ cho phép khóa môi trường cần thiết (allowlist), không rò rỉ biến nhạy cảm của app.
3. Một tiến trình đồng thời mỗi lần (hàng đợi), hỗ trợ `AbortSignal` (kill cả cây tiến trình), timeout cấu hình được, giới hạn kích thước stdout/stderr, **không ghi nội dung prompt/video/transcript vào log**; stderr được làm sạch (không đường dẫn người dùng).
4. Kết quả: đọc file `-o`, parse JSON, chạy **cùng đường kiểm tra schema/validation hiện có** (`readProviderOutput`/validate plan). Phân loại lỗi có mã: `CODEX_NOT_FOUND`, `CODEX_NOT_LOGGED_IN`, `CODEX_MODEL_REJECTED`, `CODEX_TIMEOUT`, `CODEX_OUTPUT_INVALID`, `CODEX_ABORTED`; thông báo tiếng Việt hướng dẫn (vd. "chạy `codex login` trong Terminal").
5. `GET /health` thêm trạng thái Codex (có/không, đã đăng nhập, version) thay cho trạng thái ChatGPT OAuth. Không gọi mạng/AI khi health.
6. Đo và ghi lại token nền, thời gian gọi; nếu có cách hợp lệ giảm prompt hệ thống của Codex mà không đổi hành vi (vd. cấu hình `-c`), ghi đề xuất, **không tự đổi** nếu chưa chứng minh.

## Bước 2 — Đổi provider "chatgpt" sang Codex
1. Trong `worker/analysis-service.mjs`, thay đường `/responses` OAuth bằng cầu nối ở Bước 1 qua cùng giao diện provider (`analyze({ input, schema, instructions, images, signal })`). Giữ nguyên khoá cache/`reasoningPolicyKey`/chống trùng; thêm định danh transport mới (vd. `codex-cli-v1`) vào khoá cache để không dùng nhầm kết quả cũ.
2. Giữ giá trị provider đã lưu `"chatgpt"` đọc được (kế hoạch/nháp cũ) và hiển thị nhãn "ChatGPT Auto (Codex)"; cân nhắc id mới `"codex"` chỉ nếu cần, nhưng **không phá khả năng mở plan/lịch sử cũ**. Cập nhật `lib/edit-plan.ts`, `lib/ai-response.ts`, nhãn trong `source-view.tsx`, `batch-view.tsx`.
3. Giữ nguyên quy tắc: không tự chuyển model, không retry sang model khác, fallback chỉ khi người dùng đã phê duyệt như hiện nay.

## Bước 3 — Gửi video cho Codex (phủ toàn bộ thời lượng)
Chủ dự án yêu cầu: giống chế độ thủ công, Codex cũng phải nhận được **video**. Vì Codex không nhận video 1x liên tục, thực hiện theo hai lớp:
1. **Lớp xác định (app làm):** từ video đã tải, trích khung theo bước đều phủ **từ đầu đến cuối** (bước thích ứng theo thời lượng, có trần số ảnh), ghép thành ảnh ghép (contact sheet) có **timecode nguồn in rõ trên từng ô**; truyền bằng `-i`. Tái dùng/bật lại mã trích khung sẵn có (`worker/hook-frame-cache.mjs`, `frames:'disabled-text-only-v1'` trong `worker/teaser-selection.mjs`). Thêm khung dày hơn quanh các ứng viên teaser/ranh giới part theo dữ liệu cục bộ đã có. TXT, transcript, tín hiệu âm thanh cục bộ (RMS/silence/scene) giữ trong prompt như hiện nay.
2. **Lớp theo yêu cầu (Codex làm):** đặt video đã tải vào thư mục job (hard link hoặc symlink chỉ-đọc, không sao chép nếu cùng ổ), cho phép Codex dùng `ffmpeg` đã bundle (đường dẫn truyền qua prompt) để trích thêm khung ở các mốc nó cần, tối đa K lần (cấu hình). Dùng sandbox `workspace-write` **chỉ** cho thư mục job tạm; vẫn tắt web search/mạng; không cho ghi ngoài thư mục job.
3. Giới hạn cứng: số ảnh, kích thước/ảnh, tổng byte, số lần trích thêm, thời gian; mặc định thấp để tiết kiệm quota. Cache khung theo nguồn+mốc. Ghi nhận trong kết quả (không phải "biên nhận đã xem") các mốc nguồn mà JSON dựa vào, và kiểm tra citation nằm trong phạm vi video như đường import hiện có.
4. UI ghi rõ: "Khung hình phủ toàn video + transcript; không nghe âm thanh nền". Cần phân tích nghe-nhìn đầy đủ thì dùng 3 chế độ thủ công trên nền AI web.
4. Chưa gọi Codex thật trong test tự động; dùng bản giả (fake `codex` script) để kiểm tra argv, stdin, đọc `-o`, lỗi, timeout, abort.

## Bước 4 — Gỡ OAuth (sau khi Bước 1–3 xanh)
Gỡ: `worker/chatgpt-auth.mjs`, `worker/chatgpt-auth-state.mjs`, `worker/chatgpt-store.mjs`, `worker/routes/auth.mjs` (+ test, snapshot `route-table.snapshot.json`), `app/chatgpt-auth.ts`, `components/editor/use-chatgpt-session.ts`, chip/nút "ChatGPT · cần đăng nhập" và mọi luồng đăng nhập trong UI, ngoại lệ `/auth/callback` trong `worker/request-origin.mjs`, mục Keychain/DPAPI trong `desktop/runtime-config.mjs`, `desktop/CredentialStore_windows.go`, `scripts/package-windows.mjs`, `package.json`, danh sách file runtime (`scripts/worker-runtime-files.mjs` và test closure). Cập nhật 18 script `scripts/qa-*.mjs` đang mock `/api/chatgpt/*`. Cập nhật `docs/dev-isolation.md`/handoff cho khớp. Mỗi lần xoá phải có grep chứng minh không còn tham chiếu; **không xoá** dữ liệu người dùng (file credentials cũ trong Keychain/thư mục dữ liệu) — chỉ ngừng đọc; ghi vào docs cách người dùng tự xoá.

## Ràng buộc
- Chỉ sửa checkout Beta; không đụng DEV, dữ liệu người dùng, app đã cài/release. Không build/package, không push. Không gọi AI/ASR/render thật trong test; không chạy `codex exec` thật trừ khi người giao việc cho phép.
- Giữ nguyên hành vi 3 chế độ thủ công và mọi tiêu chí main/teaser/hook, định dạng JSON, khoá cache hiện có ngoài phần transport mới.
- Tiết kiệm quota: đọc đúng file, thay đổi tập trung, không format lại file.
- Chia thành các commit nhỏ theo bước nếu có quyền ghi `.git`; nếu không, để thay đổi trong working tree.

## Báo cáo
Ghi `docs/CODEX-CLI-AUTO-RESULT-2026-11-xx.md`: từng bước đã làm/bỏ qua, danh sách file gỡ và file thêm, bảng argv Codex đang dùng và lý do, đo token/thời gian nếu có, lệnh test và kết quả thật, và phần chưa kiểm chứng (chạy Codex thật với video thật, Windows, các phiên bản Codex khác).
