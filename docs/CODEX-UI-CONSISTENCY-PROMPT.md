# Prompt giao việc cho Codex — đồng bộ button và lớp xổ ra

Repo: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, nhánh `beta/maintenance`, bắt đầu từ commit `508c7e8`. Đọc `docs/UI-CONSISTENCY-AUDIT-2026-11-04.md` trước (có số liệu và hợp đồng thiết kế ở mục 3). Giao diện tiếng Việt; đọc `node_modules/next/dist/docs/` trước khi dùng API Next (xem `AGENTS.md`).

Mục tiêu: giao diện chỉn chu, **mọi button và mọi lớp xổ ra (Select, Popover, Dropdown, Dialog, Disclosure, Tooltip) đồng bộ** theo một hệ token/primitive duy nhất. Chỉ đổi giao diện; không đổi hành vi nghiệp vụ, dữ liệu, plan, prompt hay worker.

## Ràng buộc
- Chỉ sửa checkout Beta. Không đụng DEV, dữ liệu người dùng, app đã cài, release. Không build/package, không push/merge, không gọi AI/ASR/render/tải video.
- KHÔNG commit (sandbox chặn ghi `.git`); để thay đổi trong working tree, người giao việc sẽ commit.
- Giữ nguyên `aria-label`/`data-testid`/id mà script QA (`scripts/qa-*.mjs`) và test đang dùng; nếu buộc đổi, cập nhật script đó cùng lúc.
- Giữ bảng màu hiện tại (nền tối, nhấn cam `#ff5a36`); không thiết kế lại thương hiệu. Giữ khả năng tiếp cận: focus-visible, bàn phím, vùng bấm ≥24px, tương phản ≥4.5:1, không tràn ngang từ 1024px đến 1440px.
- Tiết kiệm quota: đọc đúng file cần, thay đổi nhỏ và tập trung; không format lại cả file, không refactor ngoài phạm vi.
- Sau mỗi bước: `npx tsc --noEmit`, `npm run lint`, test liên quan; cuối cùng `npm test` (hiện 402/402 pass).

## Bước 1 — Token và Button (nền tảng)
1. Trong `app/globals.css`/`components/ui/button.tsx`: thang cỡ **sm 32 / md 36 (mặc định) / lg 40 / icon 32**; xoá alias trùng (`xs`, `action`, `timeline`, `icon-xs/sm/lg` — giữ lại một cách ánh xạ tương thích nếu còn chỗ dùng, rồi migrate hết caller). Chữ nút 13px, đậm 500, bo `--control-radius`.
2. Vai trò: `primary` (cam, CTA chính), `secondary` (outline, hiện là `outline`), `ghost`, `destructive`, `icon`. Trạng thái chọn của tab/phân đoạn là một biến thể riêng (`data-state=active`) dùng chung cho Editor/Batch/Kho, Part 1/2, Giao diện/Chữ/Nhạc, YouTube/Video từ máy: cùng cao, cùng bo, cùng độ đậm; chỉ đổi màu/viền.
3. Chip trạng thái (Worker, ChatGPT, Đã lưu) là một component `StatusChip` bo pill duy nhất; nút hành động trong header (Bản nháp, Phiên mới, Phím tắt, Lưu) cùng kiểu secondary, cùng cao.
4. "Xóa", "Xóa hết", "Hủy phiên" và các thao tác huỷ diệt dùng `destructive`; CTA "Chuẩn bị nguồn", "Phân tích", "Render" cùng kích thước `primary`.

## Bước 2 — Một họ lớp xổ ra
1. Định nghĩa token bề mặt chung (nền, viền, bo 8, đổ bóng, thang z-index `dropdown 50 / dialog 60 / toast 70`, animation vào-ra, cỡ chữ 13px, padding item) và áp cho `components/ui/{select,popover,dropdown-menu,dialog,alert-dialog}.tsx`.
2. Item hover/chọn dùng một kiểu (viền cam + dấu ✓ như `Select` hiện tại); `Popover` đổi chữ từ 12px lên 13px.
3. Thêm `components/ui/tooltip.tsx` (Radix) và `Disclosure` (thay `<details>`): chevron, bo, padding, focus chung. Tooltip tiếng Việt cho mọi nút chỉ có icon (Thu/mở nguồn, Thu/mở Inspector, Tua lùi/tới 5 giây, Play, `?`), kèm phím tắt nếu có.
4. Thay **9 `<select>` native** (`timeline-view`, `text-style-panel`, `inspector-view` ×2, `music-panel` ×4, `text-animation-panel`) bằng `Select` chung, giữ giá trị, `aria-label`, `disabled`, điều khiển bằng bàn phím và thứ tự lựa chọn.
5. Thay 14 `<details>` bằng `Disclosure`, giữ trạng thái mở/đóng mặc định hiện tại và nội dung bên trong.
6. Dọn z-index lẻ (10/20/21/25/30/35) về thang chung nếu không gây lỗi chồng lớp.

## Bước 3 — Migrate caller
1. Chuyển 63 `<button>` thô sang `Button`/biến thể tương ứng, theo từng khu vực (header, source, preview, timeline, inspector, music, batch/kho, popover/dialog). Các phần tử cố ý giữ thô (vd. vùng kéo, thẻ chọn lớn 75–125px) phải được liệt kê lý do trong báo cáo.
2. Thay bo góc/chiều cao literal lệch thang trong `app/globals.css` (6/5/4/14/99/9999px và min-height 24/30/40/44) bằng token; thay hex rải rác bằng token. Không đổi giá trị hiển thị khi không cần.
3. Style trang lỗi `app/error.tsx` và `app/global-error.tsx` theo token mới (tiêu đề, nút `primary` "Thử lại").

## Bước 4 — Khoá quy tắc
Thêm test (hoặc kiểm tra bằng grep trong test hiện có) báo lỗi nếu xuất hiện `<select>` native, `<details>` thô, hoặc `<button>` thô ngoài danh sách ngoại lệ có chú thích.

## Cách báo cáo
Ghi `docs/UI-CONSISTENCY-RESULT-2026-11-04.md`: bảng trước-sau (số `<button>` thô, `<select>` native, `<details>`, số kích thước/bo góc/độ đậm khác nhau đo bằng grep), danh sách file đổi, ngoại lệ và lý do, lệnh test và kết quả thật, phần chưa kiểm chứng (chưa QA trình duyệt vì sandbox chặn mở cổng). Không tuyên bố đã qua QA trực quan.
