# Kết quả đồng bộ UI — 2026-11-04

## Phạm vi

Thực hiện 4 bước trong `docs/CODEX-UI-CONSISTENCY-PROMPT.md`, dựa trên `docs/UI-CONSISTENCY-AUDIT-2026-11-04.md`. Checkout Beta: nhánh `beta/maintenance`, HEAD `508c7e8`; thay đổi để trong working tree, không commit.

Chỉ sửa giao diện và test khóa quy tắc. Không build/package, push/merge; không gọi AI/ASR/render/tải video; không chạy app/worker phục vụ QA, không truy cập DEV, app đã cài, release hay dữ liệu người dùng. Bộ test được chạy theo yêu cầu; hai test cần listener cục bộ bị sandbox từ chối. Không sửa worker, nghiệp vụ, plan, prompt hoặc dữ liệu để né lỗi đó.

Đã đọc hướng dẫn Next tại `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`, `11-css.md` và `01-app/03-api-reference/03-file-conventions/error.md`. Global error tự import CSS vì thay thế root layout.

## Bảng trước–sau

Phạm vi đếm JSX: `app/**/*.tsx` và `components/**/*.tsx`. Số trước lấy trực tiếp từ checkout ban đầu `508c7e8`, khớp audit. Số CSS là literal trong declaration, không phải số đo trình duyệt.

| Chỉ số | Trước | Sau |
|---|---:|---:|
| `<button>` thô | 63 | 9 ngoại lệ có chú thích, được test khóa |
| `<Button>` | 33 | 88 |
| `<select>` native | 9 | 0 |
| `<details>` thô tại caller | 14 | 0 |
| `<details>` toàn bộ mã UI | 14 | 1, chỉ bên trong primitive `Disclosure` |
| Caller `<Disclosure>` | 0 | 14 |
| Tên size trong API Button | 10 | 4: sm/md/lg/icon |
| Giá trị literal `height`/`min-height` khác nhau trong CSS | 26 | 20 |
| Giá trị literal `border-radius: Npx` khác nhau trong CSS | 11 | 0 |
| Giá trị `font-weight: N` khác nhau trong CSS toàn app | 5 | 5 |
| Hex ngoài token trong TSX | 23 theo audit | 0 |
| Hex ngoài khối token `:root` trong CSS | 50 theo audit | 0 |

Thang Button: sm 32px, md mặc định 36px, lg 40px, icon 32px; 13px/500, bo `--control-radius`. API cũ đã migrate hết caller, không giữ alias. Vai trò gồm primary, secondary, ghost, destructive, icon; segmented dùng `data-state="active"`, cùng contract với Radix Tabs.

Literal height/min-height còn lại: 120px, 128px, 14px, 16px, 18px, 1px, 208px, 220px, 22px, 25px, 26px, 280px, 28px, 320px, 46px, 4px, 52px, 62px, 8px, 96px. Chúng gồm kích thước video, vùng chứa, chỉ số, biểu tượng và các declaration cũ được contract control ghi đè. Vì vậy số literal toàn stylesheet không được diễn giải thành số cỡ Button. Không xóa trọng lượng 400/600/700/800 của nội dung, tiêu đề và mẫu chữ. Contract Button áp 500; chưa đo computed style trên trình duyệt.

Lệnh grep tái lập phép đo CSS:

```sh
rg --pcre2 -o --no-filename '(?<![\w-])(?:min-height|height):\s*\K\d+px' app/globals.css | sort -u
rg -o --no-filename 'border-radius:\s*[0-9]+px' app/globals.css | sort -u
rg -o --no-filename 'font-weight:\s*[0-9]+\s*;' app/globals.css | sort -u
rg -o '<button\b|<select\b|<details\b' app components -g '*.tsx'
```

## Thay đổi theo bước

1. **Token và Button:** chuẩn hóa cỡ/vai trò, header secondary cùng cao 32px (sm và icon), trạng thái chọn dùng chung, chip Worker/provider/Đã lưu qua `StatusChip`; thao tác xóa/hủy dùng destructive; Chuẩn bị nguồn/Phân tích/Render dùng primary md.
2. **Lớp xổ ra:** chung token nền/viền/bo 8/shadow/animation/font 13/padding item, z-index dropdown 50/dialog 60/toast 70; item highlight/selected dùng cam và indicator. Thêm Radix Tooltip tiếng Việt, có phím tắt khi có; `Disclosure` gom chevron/padding/focus. Thay 9 select, giữ thứ tự option/group, giá trị callback và trạng thái disabled; hai giá trị nhạc rỗng ánh xạ qua sentinel nội bộ và trả lại chuỗi rỗng ở callback.
3. **Caller:** migrate 54/63 button thô; giữ 9 ngoại lệ bên dưới. Gom màu/bo/cỡ về token; trang error/global-error có tiêu đề, mô tả và primary “Thử lại”, giữ callback retry/reset và checkpoint. Media/sticky/drawer có token lớp riêng để duy trì thứ tự bên dưới floating layer; không đưa toàn bộ lớp video về z-index 50.
4. **Khóa quy tắc:** thêm `lib/ui-consistency.test.mjs`: chặn select native; details/summary ngoài primitive; button thô ngoài danh sách file/lý do/số lượng cố định. Kiểm tra size/role/token, tên truy cập của 9 selector, palette tương phản, surface/layer và tooltip. Thêm một thuộc tính ngoại lệ tùy ý ở file mới vẫn bị test từ chối.

## Ngoại lệ và lý do

| File | Số button thô | Lý do |
|---|---:|---|
| `components/background-panel.tsx` | 1 | Thẻ mẫu nền, cần giữ hình học mẫu và nội dung nhãn |
| `components/overlay-panel.tsx` | 1 | Thẻ mẫu lớp phủ, cần giữ hình học mẫu |
| `components/text-style-panel.tsx` | 1 | Thẻ mẫu chữ, giữ mẫu typography riêng |
| `components/video-filter-panel.tsx` | 1 | Thẻ mẫu bộ lọc, giữ dải màu mẫu |
| `components/visual-template-panel.tsx` | 1 | Thẻ template lớn có preview, không ép cao 32/36/40 |
| `components/editor-workspace.tsx` | 1 | Backdrop phủ vùng drawer để đóng; `tabIndex=-1`, không áp kích thước control |
| `components/teaser-candidate-review.tsx` | 3 | Một thẻ chọn ứng viên nhiều dòng và hai vùng bấm phủ video; giữ diện tích tương tác/hình học video, vùng chỉ icon có Tooltip |

Các ngoại lệ button có `data-ui-exception` và comment giải thích trong nguồn. Riêng `components/ui/disclosure.tsx` là ngoại lệ primitive duy nhất chứa native details/summary: giữ keyboard, thuộc tính `open`, mặc định đóng và selector QA hiện có. 14 caller đều dùng component chung; không cần đổi script QA. Split download giữ viền ngoài chung và hai mép ghép bên trong, nút icon nhận token 32px.

Không đổi `aria-label`/`data-testid`/id đang dùng. So sánh AST với HEAD xác nhận **128 thuộc tính id/aria-label/data-testid và 87 callback onClick** trong 41 file TSX đã đổi được giữ nguyên.

## File thay đổi

- `app/error.tsx`
- `app/global-error.tsx`
- `app/globals.css`
- `components/ai-operation-status.tsx`
- `components/background-panel.tsx`
- `components/confirmation-provider.tsx`
- `components/connector-error.tsx`
- `components/copy-button.tsx`
- `components/cut-transition-panel.tsx`
- `components/editor-render-list.tsx`
- `components/editor-workspace.tsx`
- `components/editor/batch-view.tsx`
- `components/editor/inspector-view.tsx`
- `components/editor/preview-view.tsx`
- `components/editor/source-view.tsx`
- `components/editor/studio-view.tsx`
- `components/editor/timeline-view.tsx`
- `components/main-ranges-editor.tsx`
- `components/manual-video-download.tsx`
- `components/media-library-panel.tsx`
- `components/music-panel.tsx`
- `components/overlay-panel.tsx`
- `components/preserved-drafts.tsx`
- `components/shortcut-help.tsx`
- `components/source-options-section.tsx`
- `components/status-details.tsx`
- `components/studio-header.tsx`
- `components/studio-render-status.tsx`
- `components/teaser-candidate-review.tsx`
- `components/teaser-editor.tsx`
- `components/text-animation-panel.tsx`
- `components/text-style-panel.tsx`
- `components/ui/alert-dialog.tsx`
- `components/ui/button.tsx`
- `components/ui/dialog.tsx`
- `components/ui/disclosure.tsx` (mới)
- `components/ui/dropdown-menu.tsx`
- `components/ui/popover.tsx`
- `components/ui/select.tsx`
- `components/ui/status-chip.tsx` (mới)
- `components/ui/tabs.tsx`
- `components/ui/tooltip.tsx` (mới)
- `components/video-filter-panel.tsx`
- `components/visual-customize-panel.tsx`
- `components/visual-template-panel.tsx`
- `docs/UI-CONSISTENCY-RESULT-2026-11-04.md` (mới)
- `lib/ui-consistency.test.mjs` (mới)

Tổng cộng 47 file của công việc này. Các mục chưa được theo dõi có sẵn `.claude/`, `.specify/`, prompt và audit đầu vào được giữ nguyên.

## Lệnh kiểm tra và kết quả thật

| Mốc | Lệnh | Kết quả cuối của mốc |
|---|---|---|
| Bước 1 | `npx tsc --noEmit`; `npm run lint` | Pass, exit 0; lint không warning |
| Bước 1 | `node --test lib/preserved-drafts.test.mjs lib/session-content.test.mjs` | 4/4 pass |
| Bước 2 | `npx tsc --noEmit`; `npm run lint` | Pass, exit 0; lint không warning |
| Bước 2 | `node --test lib/music.test.mjs lib/subtitles.test.mjs lib/animations.test.mjs lib/cut-transitions.test.mjs lib/fonts.test.mjs` | 31/31 pass |
| Bước 3 | `npx tsc --noEmit`; `npm run lint` | Pass, exit 0; lint không warning |
| Bước 3 | `node --test lib/preserved-drafts.test.mjs lib/render-delete.test.mjs lib/session-content.test.mjs lib/cut-history.test.mjs lib/batch-submission.test.mjs` | 10/10 pass |
| Bước 4 | `npx tsc --noEmit`; `npm run lint` | Pass, exit 0; lint không warning |
| Bước 4 | `node --test lib/ui-consistency.test.mjs` | 5/5 pass |
| Cuối | `npm test` | **405/407 pass, 2 fail, 0 skip; exit 1** |
| Cuối | So sánh AST thuộc tính QA/callback với HEAD | Pass: 41 file TSX, 128 thuộc tính và 87 callback giữ nguyên |
| Cuối | `git diff --check` | Pass, không lỗi whitespace |

Hai test fail khi chạy `npm test`:

- `desktop/runtime-config.test.mjs:80`: `port collisions fail without stopping the existing listener`.
- `worker/routes.test.mjs:140`: `HTTP boundary enforces Host/Origin before mutation and OAuth exception, keeps OPTIONS and JSON/raw upload policy`.

Cả hai trả **`Error: listen EPERM: operation not permitted 127.0.0.1`**. Đây là giới hạn mở listener của sandbox; không sửa/skip test và không tuyên bố toàn bộ suite pass. 402/402 trong tài liệu là kết quả nền được cung cấp, không phải kết quả tái chạy trong sandbox này.

## Chưa kiểm chứng

**Chưa QA trình duyệt vì sandbox chặn mở cổng**, có bằng chứng `listen EPERM` ở hai test trên. Không khởi chạy app để chụp ảnh hay tuyên bố đã qua QA trực quan.

Chưa kiểm trực tiếp layout/overflow ở 1024–1440px, focus/tab/arrow/Escape, tooltip khi hover/focus, stacking trong mọi dialog và trạng thái có source/plan thật. Các điều kiện này mới được bảo toàn/kiểm tra ở mã nguồn, cần QA trình duyệt sau. Test tương phản xác nhận các cặp màu token của control đạt ≥4.5:1, không thay thế phép đo giao diện đã render.
