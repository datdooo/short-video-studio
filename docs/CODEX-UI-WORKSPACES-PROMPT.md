# Prompt giao việc cho Codex — đồng bộ tab Batch và tab Kho/Render, sửa 4 lỗi UI

Repo: `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, nhánh `beta/maintenance`, bắt đầu từ commit `f0f0c6b`. Đọc `AGENTS.md`, `docs/UI-CONSISTENCY-RESULT-2026-11-04.md` và `components/ui/*` trước. Giao diện tiếng Việt. Chỉ đổi giao diện; không đổi hành vi nghiệp vụ, plan, prompt, worker, dữ liệu.

## Vấn đề (đo trên màn hình 1440×900)
Hai tab **Batch** ("Xử lý hàng loạt") và **Kho** (có "Danh sách render") không cùng một ngôn ngữ thiết kế:
- Tiêu đề trang: Kho có icon, Batch không có; chưa có thành phần tiêu đề chung.
- Thẻ/khung: Batch dùng bo 12px (`rounded-2xl`) và thẻ trạng thái xanh lục bo 16px, đệm 12/16px; Kho dùng bo 16px, đệm 24px. Cùng vai trò "panel" nhưng bo góc, đệm, nền, viền khác nhau; màu `emerald/amber` viết cứng trong lớp Tailwind thay vì token.
- Thanh công cụ: Kho có ô tìm kiếm + segmented tabs, Batch có ô chọn AI + nút rời; kiểu hàng điều khiển khác nhau.
- Trạng thái rỗng/lỗi/mất kết nối: mỗi nơi tự viết (Batch "Chưa có video trong hàng đợi…", Kho "Chưa có tác vụ render." + "Failed to fetch").
- Batch: lưới `.studio-batch-grid` chia cố định `0.9fr / 1.1fr`, nên biểu mẫu bị chặn ~335px, tự cuộn bên trong và nút thứ hai bị cắt nửa ở mép.

## Việc phải làm
1. **Khung trang chung** (`components/ui/` hoặc `components/workspace/`): `WorkspaceHeader` (icon + tiêu đề h1 + mô tả ngắn tuỳ chọn + vùng hành động bên phải), `Panel` (một bo góc duy nhất theo token `--card-radius`, một thang đệm sm/md, header/body/footer), `EmptyState` (icon + tiêu đề + mô tả + hành động tuỳ chọn), `InlineNotice` (info/success/warning/error dùng token màu; thay mọi `emerald/amber/red` viết cứng trong hai tab), `Toolbar` (hàng ô tìm kiếm/lọc/nút cùng chiều cao 36px).
2. **Áp dụng cho Batch và Kho** (`components/editor/batch-view.tsx`, `components/media-library-panel.tsx`, `components/editor-render-list.tsx`, aside preview trong Batch, và các thẻ job/render): cùng tiêu đề (cả hai có icon, ví dụ Batch dùng icon hàng đợi), cùng Panel, cùng khoảng cách dọc giữa các khối, cùng Toolbar, cùng trạng thái rỗng, cùng kiểu hàng danh sách (chiều cao hàng, nhãn trạng thái bằng `StatusChip`, nút hành động bằng `Button` đúng vai trò; "Xóa/Hủy" = `destructive`).
3. **Layout Batch:** sửa lưới để biểu mẫu co theo nội dung (ví dụ `grid-template-rows: fit-content(62%) minmax(160px, 1fr)`), không cắt nửa nút; nếu cần cuộn thì cuộn có chủ ý và thấy rõ phần còn lại. Kiểm tra 1024, 1280, 1440px.
4. **Lỗi hiển thị "Failed to fetch"** ở Kho (và các nơi tương tự trong Batch/Render): chuẩn hoá thông báo lỗi mạng/worker thành tiếng Việt ở một chỗ dùng chung (ví dụ trong `lib/api/worker-client.ts`: `TypeError: Failed to fetch` hoặc `Load failed` → "Không kết nối được media worker."), không lộ nguyên văn tiếng Anh của trình duyệt. Không đổi mã lỗi/`status` mà logic khác đang kiểm tra.
5. **Cỡ chữ control:** `Select` trigger/item và thẻ chọn mẫu đang bị ép 14px bởi luật `.text-sm … { font-size: var(--ui-text-body) }` trong `app/globals.css`; cho chúng dùng `--control-font-size` (13px) như `Button` và ô nhập. Đổi `.studio-inspector-body .visual-customize > summary` (đang `12px`, bo `12px`) về cùng token với các `Disclosure` khác (13px, bo 8px).
6. **Nút hủy diệt:** token `--destructive` (#f0a097, hồng cam) trùng màu với nhấn cam của thương hiệu nên "Bỏ nháp & tạo mới", "Xóa", "Xóa tất cả" trông như nút thường. Đổi sang đỏ rõ ràng hơn (đề xuất #ff6b7a cho viền/chữ, nền nhạt cùng tông), kiểm tra tương phản ≥4.5:1 trên nền tối và không làm mất khả năng phân biệt với lỗi/cảnh báo khác.

## Ràng buộc
- Chỉ sửa checkout Beta; không đụng DEV, dữ liệu người dùng, app đã cài/release. Không build/package, không push, không gọi AI/ASR/render/tải video. **Không commit** (người giao việc sẽ commit).
- Giữ `aria-label`/`data-testid`/id mà test và `scripts/qa-*.mjs` đang dùng; giữ mọi callback.
- Dùng token hiện có (`--control-*`, `--card-radius`, `--layer-*`); không thêm màu hex mới ngoài khối token. Không thêm thư viện.
- Mở rộng `lib/ui-consistency.test.mjs`: cấm lớp màu `emerald-`/`amber-` viết cứng trong hai tab và cấm `rounded-2xl` trong Batch/Kho; thêm kiểm tra tồn tại `WorkspaceHeader` ở cả hai tab.
- Tiết kiệm quota: đọc đúng file, thay đổi tập trung. Sau mỗi bước: `npx tsc --noEmit`, `npm run lint`, test liên quan; cuối cùng `npm test` (hiện 407/407).

## Báo cáo
Ghi `docs/UI-WORKSPACES-RESULT-2026-11-04.md`: bảng trước-sau (bo góc, đệm, số kiểu panel, màu cứng còn lại), file đổi, lệnh test và kết quả thật, phần chưa kiểm chứng (chưa QA trình duyệt trong sandbox).
