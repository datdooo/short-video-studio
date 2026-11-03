# Giao việc cho Codex — quy tắc (áp dụng từ 2026-11-04)

Mục tiêu: tiết kiệm quota Claude và chạy nhanh hơn, **nhưng không đánh đổi chất lượng logic lõi**.

## Ai làm gì
| Loại việc | Ai làm | Ghi chú |
|---|---|---|
| Logic lõi: pipeline AI, prompt, cầu nối Codex CLI, tín hiệu/TXT, khoá cache, bảo mật, hợp đồng dữ liệu | **Claude trực tiếp** | Codex không được giao, dù tiết kiệm |
| Thiết kế, review diff, QA trình duyệt, quyết định hợp nhất | **Claude** | Codex không tự review việc của chính nó |
| Đồng bộ UI/CSS theo hợp đồng thiết kế đã có (`ui`, `ui-css`) | Codex | Phải qua QA trình duyệt của Claude |
| Tài liệu (`docs`), đổi tên, cập nhật script QA, dựng khung test (`test-scaffold`, `script-update`, `rename`, `cleanup`) | Codex | Kiểm tra bằng tsc/lint/test |

## Quy trình
1. Viết file tác vụ ngắn, có dòng `Loại: <docs|ui|ui-css|test-scaffold|script-update|rename|cleanup>`, mục tiêu, file được phép sửa, tiêu chí xong.
2. Chạy: `node scripts/delegate-codex.mjs docs/<task>.md [--effort medium] [--verify]`. Script tạo worktree riêng (`codex/<slug>-<ts>`), dùng `gpt-6.1-sol` + sandbox `workspace-write`, chặn loại việc lõi, và so sánh trạng thái DEV trước/sau.
3. `--full-access` chỉ khi việc thật sự cần commit hoặc mở cổng; Claude vẫn là người commit.
4. Claude đọc `git diff`, chạy `npx tsc --noEmit`, `npm run lint`, `npm test`, QA trình duyệt nếu là UI, rồi mới commit/hợp nhất.

## Tiết kiệm quota
- Đọc đúng file, thay đổi tập trung; không tải lại tài liệu lịch sử.
- Đo trước khi tối ưu: `npx ccusage@latest --offline` (đọc log cục bộ) để biết quota đi đâu.
- Tác vụ Codex nên nhỏ và độc lập; mỗi lần gọi tốn khoảng 10–15k token nền.
