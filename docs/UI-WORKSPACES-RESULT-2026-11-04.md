# Kết quả đồng bộ workspace Batch và Kho — 2026-11-04

## Phạm vi

Thực hiện 6 mục trong `docs/CODEX-UI-WORKSPACES-PROMPT.md` tại checkout Beta, nhánh `beta/maintenance`, bắt đầu và kết thúc ở HEAD `f0f0c6b`. Thay đổi để trong working tree, **không commit**.

Đã đọc `AGENTS.md`, `docs/UI-CONSISTENCY-RESULT-2026-11-04.md`, toàn bộ `components/ui/*.tsx` và hướng dẫn Next cục bộ `01-app/01-getting-started/11-css.md`, `10-error-handling.md` trước các phần sửa tương ứng.

Chỉ sửa giao diện, hàm chuyển thông báo lỗi để hiển thị và test liên quan. Không đổi plan, prompt, nghiệp vụ, worker, luồng request hay dữ liệu. Không build/package, push, chạy app/worker để QA, gọi workflow AI/ASR/render/tải video, truy cập DEV, app đã cài/release hay dữ liệu người dùng. Test sử dụng fixture và thư mục tạm theo bộ test hiện có. Không sửa `.claude/`, `.specify/` hay prompt đầu vào có sẵn.

## Bảng trước–sau

Phạm vi đếm: `components/editor/batch-view.tsx`, `components/media-library-panel.tsx`, `components/editor-render-list.tsx`; số trước lấy từ `git show HEAD:<file>`. Bo góc/đệm dưới đây là khai báo trong nguồn, **không phải computed style đo trên trình duyệt**. CSS cũ đã ghi đè một số bo góc về token nên không coi mọi lớp Tailwind trước đây là kích thước hiển thị thực tế.

| Chỉ số | Trước | Sau |
|---|---|---|
| Tiêu đề trang | 2 cách viết; Batch thiếu icon | Cả hai dùng `WorkspaceHeader`, h1 + icon |
| Bo góc panel | Khai báo 8/12/16px qua `rounded-lg/xl/2xl`, thêm các override CSS | Một token `--card-radius` = 12px cho toàn bộ Panel |
| Đệm panel | 12/16/20/24px, riêng hàng file còn override 10px × 12px | Hai mức: sm = 12px, md = 16px |
| Số cấu hình panel tự khai báo | 9 vị trí: form, queue, job Batch, preview Batch, hàng file, preview Kho, danh sách render, job render, thẻ Part | 1 primitive `Panel`, 9 caller, 2 mức đệm; nền/viền chung |
| `rounded-2xl` trong ba file | 5 (Batch 2, Kho 3) | 0 |
| Lớp màu `emerald/amber/red` viết cứng | 49 (21/16/12 theo thứ tự ba file trên) | 0 |
| Lớp màu trung tính `white/black/zinc` viết cứng | 51 (23/15/13) | 0; dùng token, kể cả nền video `--sample-black` |
| Hex trực tiếp trong ba file TSX | 0 | 0; hex mới chỉ trong khối token CSS |
| Khoảng cách khối/danh sách | Nhiều mức margin/gap riêng | Token `--workspace-gap` = 12px; hàng danh sách tối thiểu 80px, tự tăng theo nội dung |
| Control trong Toolbar | Các hàng điều khiển tự viết | Chung chiều cao 36px; tự xuống dòng |
| Trạng thái rỗng/lỗi | JSX riêng, lỗi mạng có thể hiện tiếng Anh | `EmptyState`, `InlineNotice`; thông báo mạng qua một hàm chung |
| Batch: chia chiều cao | `0.9fr / 1.1fr`, biểu mẫu cuộn riêng | `auto minmax(160px, 1fr)`; biểu mẫu theo nội dung, workspace cuộn có gutter; queue cuộn riêng tối đa 480px |
| Select / nhãn thẻ mẫu | Có thể bị luật `text-sm/text-xs` ép về 14px | `--control-font-size` = 13px; giữ typography artwork |
| Summary tùy chỉnh | Có khai báo 12px, hình học riêng | Font 13px, bo `--control-radius` = 8px, cao theo token Disclosure |
| Destructive | `#f0a097`, gần màu nhấn cam | `#ff6b7a`, nền pha 8%, hover 12% cùng tông |

“Số cấu hình panel” là số vị trí từng tự khai báo khung trước khi migrate, không phải số phần tử DOM khi có nhiều job. Không tính Disclosure, nội dung video hay thông báo là Panel. Số lớp màu là số lần xuất hiện các utility `text/bg/border` tương ứng trong nguồn; không tính tên token hoặc selector tương thích cũ trong CSS toàn app.

## Thay đổi theo bước

1. **Khung dùng chung:** thêm `WorkspaceHeader`, `Panel` cùng slot header/body/footer, `EmptyState`, `InlineNotice` với 4 tone và `Toolbar`; dùng token sẵn có và token đệm/khoảng cách chung.
2. **Batch/Kho/Render:** migrate 9 vị trí Panel, preview và trạng thái rỗng/lỗi; thêm `StatusChip` cho trạng thái, mở rộng tone `error`. Nút xóa/dừng/hủy dùng `Button destructive`; tải file dùng `Button asChild` giữ nguyên anchor, URL và thuộc tính download. Giữ các điều kiện disabled, callback và luồng dữ liệu.
3. **Layout Batch:** bỏ giới hạn chiều cao theo tỷ lệ; không cuộn riêng trong setup. Workspace cuộn khi thiếu chiều cao, queue có vùng cuộn rõ ràng. Quy tắc cột giữ `minmax(0, 1fr)` và cột preview 240–300px; toolbar xuống dòng. Đây mới là kiểm tra mã nguồn cho 1024/1280/1440px, chưa phải QA trực quan ở ba kích thước đó.
4. **Lỗi mạng:** `workerErrorMessage` chỉ chuyển chuỗi hiển thị `Failed to fetch`, `TypeError: Failed to fetch`, `Load failed`, `NetworkError when attempting to fetch resource`, `fetch failed` thành “Không kết nối được media worker.”; giữ tiền tố tiến độ nếu có. Dùng tại các thông báo lỗi Batch, job/render, Kho và preview. Không thay `workerFetch`, `workerError`, Error gốc, code, HTTP status, retry hay xử lý AbortSignal.
5. **Typography:** loại Select khỏi luật body typography, thêm selector control đủ ưu tiên cho trigger/item và nhãn thẻ mẫu; đưa summary tùy chỉnh về token Disclosure. Chỉ đổi nhãn mẫu, không đổi artwork/font preview.
6. **Destructive:** đổi token đỏ và nền/hover; màu warning/success/brand giữ vai trò riêng. Kiểm tra tương phản trên background/surface/panel và nền pha 8%/12%. Riêng trên panel: **6.035:1** nền gốc, **5.391:1** nền nút, **5.055:1** hover. Lỗi có `InlineNotice`/role alert; thao tác hủy diệt có nút viền đỏ và nhãn hành động.

## Bảo toàn selector và callback

Đối chiếu AST TypeScript với HEAD ở ba file UI xác nhận **14 thuộc tính id/aria-label/data-testid, 29 callback `on*` và 42 binding disabled/checked/value/href/src/download ban đầu được giữ nguyên**. Không đổi các `data-batch-state`, `data-render-state`, aria-label vùng queue/preview/render hay callback mở editor, tiếp tục, dừng, xóa, tìm kiếm, chọn file và đổi tab. Không sửa script QA.

## File thay đổi

- `app/globals.css`
- `components/ui/workspace.tsx` (mới)
- `components/ui/status-chip.tsx`
- `components/editor/batch-view.tsx`
- `components/media-library-panel.tsx`
- `components/editor-render-list.tsx`
- `lib/api/worker-client.ts`
- `lib/ui-consistency.test.mjs`
- `lib/worker-client.test.mjs`
- `docs/UI-WORKSPACES-RESULT-2026-11-04.md` (mới)

Tổng cộng 10 file của công việc này; không tính prompt đầu vào và các mục untracked có sẵn.

## Lệnh kiểm tra và kết quả thật

Mỗi bước đều chạy `npx tsc --noEmit`, `npm run lint` và test liên quan. Bảng ghi kết quả cuối của từng bước sau khi sửa lỗi tìm được.

| Mốc | Lệnh | Kết quả |
|---|---|---|
| Bước 1 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/ui-consistency.test.mjs` | tsc/lint exit 0, không warning; 5/5 test pass |
| Bước 2 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/ui-consistency.test.mjs lib/batch-submission.test.mjs lib/render-delete.test.mjs` | tsc/lint exit 0; 9/9 test pass |
| Bước 3 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/ui-consistency.test.mjs` | tsc/lint exit 0; 7/7 test pass |
| Bước 4 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/worker-client.test.mjs lib/ui-consistency.test.mjs` | tsc/lint exit 0; 11/11 test pass |
| Bước 5 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/ui-consistency.test.mjs` | tsc/lint exit 0; 8/8 test pass |
| Bước 6 | `npx tsc --noEmit`; `npm run lint`; `node --test lib/ui-consistency.test.mjs` | tsc/lint exit 0; 9/9 test pass |
| Kiểm tra cuối | `npx tsc --noEmit`; `npm run lint` | Cả hai exit 0, lint không warning |
| Kiểm tra cuối | `node --test lib/ui-consistency.test.mjs lib/worker-client.test.mjs lib/render-delete.test.mjs lib/batch-submission.test.mjs` | 16/16 pass, exit 0 |
| Toàn bộ suite, lượt cuối | `npm test` | **410/412 pass, 2 fail, 0 skip; exit 1** |
| Kiểm tra lại lỗi timeout trung gian | `node --test worker/source-context.test.mjs` | 15/15 pass, exit 0 |
| Bảo toàn thuộc tính/callback | Đối chiếu AST ba file với `git show HEAD:<file>` | Pass: 14 selector, 29 callback, 42 binding |
| Whitespace | `git diff --check` | Pass |

Hai test fail ở lượt toàn bộ cuối:

- `desktop/runtime-config.test.mjs:80` — `port collisions fail without stopping the existing listener`.
- `worker/routes.test.mjs:140` — `HTTP boundary enforces Host/Origin before mutation and OAuth exception, keeps OPTIONS and JSON/raw upload policy`.

Cả hai lỗi **`listen EPERM: operation not permitted 127.0.0.1`**, do sandbox không cho mở listener. Không sửa hay skip test để né lỗi; không tuyên bố toàn bộ suite pass. Suite tăng từ 407 lên 412 test do thêm 4 test UI và 1 test thông báo lỗi mạng.

Một lượt chạy toàn bộ trung gian có **409/412 pass, 3 fail**: ngoài hai lỗi EPERM, `worker/source-context.test.mjs:125` nhận `retrieval-timeout` thay vì `extraction-failed` trong fixture deadline 10ms. Test này pass khi chạy riêng (15/15 toàn file) và pass ở lượt toàn bộ tiếp theo; có dấu hiệu nhạy thời gian dưới tải, chưa xác định nguyên nhân gốc. Không sửa worker hay test ngoài phạm vi. Ở bước 1, lượt test ban đầu cũng bắt được kích thước icon viết literal 24px; đã đổi sang token và chạy lại đủ kiểm tra.

## Chưa kiểm chứng

**Chưa QA trình duyệt trong sandbox.** Không khởi chạy app/worker, không dùng DEV hay dữ liệu thật để kiểm tra. Hai lỗi mở listener EPERM ở trên là bằng chứng giới hạn môi trường hiện tại.

Chưa đo trực tiếp ở **1024×900, 1280×900, 1440×900**: nút thứ hai có được thấy đầy đủ, thao tác cuộn và scrollbar thực tế, toolbar xuống dòng, danh sách dài và preview. Chưa kiểm computed font/radius, tương tác bàn phím/focus của Select và tab, hoặc các trạng thái có dữ liệu thật. Các kiểm tra nguồn/AST, test token và phép tính tương phản không thay thế QA trực quan. Cần thực hiện các mục này ở môi trường được phép sau.
