# UI đồng bộ: button và lớp xổ ra — 2026-11-04

Đo trên app Beta đang chạy (build 1127, chưa gồm commit `508c7e8`) ở 1440×900 và 1024×700, cộng với đọc code. Chưa mở được mọi màn hình (cần source/plan thật cho Timeline, Inspector sau khi có plan, Batch, Kho, Nhạc).

## 1. Hiện trạng

Dự án **đã có** token (`--control-height: 36px`, `--control-compact-height: 32px`, `--control-radius: 8px`, `--control-icon-size: 32px`, `--control-font-size`…) và component `components/ui/*` (shadcn/Radix). Vấn đề là code đi vòng qua chúng.

### Button
| Bằng chứng | Số liệu |
|---|---|
| `<button>` thô so với `<Button>` | **63** so với **33** |
| `Button` các `size` `default/xs/sm` | cùng một kiểu (`h-9 px-3 text-[13px]`); `icon/icon-xs/icon-sm/icon-lg` cũng giống hệt → API nhiều tên nhưng không có thang cỡ thật |
| Chiều cao nút đo trên màn hình | 18, 28, 32, 36 (nút thường); thẻ chọn 75–125 |
| Cỡ chữ nút | 12px (header, "Render", "Mở/Xóa") và 13px (panel nguồn, tab) cho cùng vai trò |
| Độ đậm chữ | 400, 500, 600 trộn lẫn (vd. tab "Part 1" 600, tab "Giao diện" 500, "Editor" 500, "Bản nháp" 400) |
| Bo góc | `Đã lưu` **pill 9999px**, "Phiên mới"/"Bản nháp" 8px; tab Giao diện/Chữ/Nhạc **6px** vs tab Part/YouTube **8px**; summary "Tùy chỉnh" **12px** vs summary khác 8px |
| CTA chính | "Chuẩn bị nguồn/Phân tích" cao 36, chữ 13 vs "Render 2 MP4" cao 32, chữ 12 — cùng màu cam, hai kích thước |
| Nút hủy diệt | "Xóa" trong popover Bản nháp trông y hệt nút thường (không có kiểu destructive dù `variant="destructive"` tồn tại; code chỉ dùng `outline` 22 lần, `ghost` 2 lần) |
| Bo góc literal trong CSS | 8px ×8, 6px ×7, 4px, 5px, 14px, 12px, 99px ×4, 9999px ×5 (ngoài `var(--radius*)` ×34) |
| Chiều cao literal | min-height 24/30/32/36/40/44 |
| Màu cứng | 73 hex ngoài token (23 trong tsx, 50 trong CSS) |

### Lớp xổ ra (5 cơ chế khác nhau)
| Cơ chế | Chỗ dùng | Nhận xét |
|---|---|---|
| `<select>` native | 9 chỗ: `timeline-view`, `text-style-panel`, `inspector-view` ×2, `music-panel` ×4, `text-animation-panel` | Hộp xổ của hệ điều hành, khác hẳn Radix Select; không đồng bộ phông/bo/màu |
| Radix `Select` | `source-view`, `batch-view` | Có border, bo 8, z-50, item chọn viền cam + dấu ✓ |
| Radix `Popover` | `preserved-drafts`, `studio-header`, `status-details` | Nền/viền giống Select nhưng cỡ chữ **12px** vs Select **13px**, padding riêng |
| Radix `DropdownMenu` | chỉ `manual-video-download` | Một mình |
| `<details>` | **14** chỗ (source, inspector, music, visual…) | Disclosure tự làm, bo 8–12 không thống nhất, mũi tên riêng |
| Dialog / AlertDialog | 11 chỗ + `useConfirm` | Chưa kiểm tra giao diện từng cái |
| Tooltip | **0** | Nút chỉ có icon (Thu/mở nguồn, Tua ±5s, `?`) không có tooltip, chỉ `title`/aria |
| z-index | Radix `z-50`; còn 10/20/21/25/30/35 rải rác | Chưa có thang |

## 2. Lỗi còn lại ngoài UI
- Chưa QA trình duyệt các thay đổi của Codex (panel 1050px, error boundary, nút Lưu phiên trống, tăng cỡ chữ).
- `app/error.tsx` chưa có style, chỉ chữ trần.
- Lịch sử định dạng `planJobId` không tương thích ngược với bản cũ.
- Bản Beta cài trong Applications vẫn là build 1127; commit `508c7e8` chưa được đóng gói.
- Còn lại từ audit trước: font CJK 20 MB, route Next `analyze` chưa chứng minh chết, `Home` còn là component khổng lồ (~35 hook), retention dữ liệu chưa bật, chưa kiểm Windows/Node 22.
- `.claude/` và `.specify/` chưa được quyết ignore hay track.

## 3. Hướng sửa (hợp đồng thiết kế)
1. **Một thang cỡ**: `sm` = 32px, `md` = 36px (mặc định), `lg` = 40px, `icon` = 32px. Bỏ các alias trùng. Chữ nút 13px, đậm 500; chỉ tab/phân đoạn đang chọn đổi màu/viền, không đổi độ đậm.
2. **Một bộ vai trò**: `primary` (cam, chỉ CTA chính), `secondary` (outline), `ghost`, `destructive`, `icon`. "Xóa/Xóa hết/Hủy phiên" dùng `destructive`. Bo góc luôn `--control-radius`; pill chỉ cho chip trạng thái (Worker/ChatGPT/Đã lưu) và đúng một kiểu.
3. **Một họ lớp nổi** dựng trên cùng token bề mặt: nền, viền, bo 8, đổ bóng, thang z-index (`dropdown 50`, `dialog 60`, `toast 70`), animation vào/ra, cỡ chữ 13px, kiểu item hover/chọn (✓ + viền cam) dùng chung cho Select, DropdownMenu, Popover, Dialog.
4. **Thay 9 `<select>` native bằng `Select` chung** (giữ giá trị, `aria-label`, hành vi bàn phím, `disabled`).
5. **`<details>` → một component `Disclosure`** có chevron, bo, padding và trạng thái focus chung.
6. **Tooltip** cho mọi nút chỉ có icon (Radix Tooltip hoặc popover nhẹ), tiếng Việt, kèm phím tắt nếu có.
7. Gom hex còn lại vào token; bỏ bo góc/chiều cao literal lệch thang.
8. Quy tắc khóa: test/grep cấm `<button>` thô (trừ phần tử được liệt kê) và `<select>` native.
