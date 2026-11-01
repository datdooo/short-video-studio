# Nút tải video nguồn + menu480p

Đóng gói build1116; chưa nghiệm thu runtime. Không test/render/AI/download/browser QA.

## Thay đổi
- components/manual-video-download.tsx: split button, nút chính tải original, mũi tên Radix dropdown (keyboard/focus có sẵn) chỉ có mục480p; không lưu480p thành mặc định. Chặn double click/cancel/progress giữ nguyên.
- lib/manual-video-download.ts: rendition original mặc định hoặc480p; vẫn một native iframe download + status polling, không Blob video.
- worker/server.mjs: validate rendition whitelist, mặc định original; chọn usingOriginal hoặc using. Progress chuẩn bị480p không được đẩy vào original. Guard sourceKey, source ownership, status/cancel và truyền byte có sẵn giữ nguyên.
- worker/web-ai-video.mjs: usingOriginal giữ lease/busy trong suốt stream, chỉ stat và truyền source.mediaPath, không encode/network/fingerprint. Giữ đường480p và cache riêng; không thêm480p vào source edit/render.
- app/globals.css: nút chính và arrow32px chung chiều cao/viền, min-width0 để không tràn cột.
- lib/muse-plan.mjs/.d.mts: prompt v15 và mô tả file nguồn mặc định/480p tùy chọn. sourceKey không đổi cách tính, snapshot/import kiểm tra như trước.

## Phạm vi
Dùng component chung cho ChatGPT web/Gemini/Muse; không đổi model, thuật toán, dữ liệu hay policy Auto. Không sửa DEV. Nếu nguồn thực không phải1080p, tải chính xác file nguồn thay vì upscale/đổi tên chất lượng. Original không bị giới hạn512MiB nội bộ; prompt nhắc giới hạn website, không tự fallback.

## Nghiệm thu tay
- Ba web provider: nút chính trả cùng byte/source ở bước1, không chuẩn bị480p/encode, không tải lại mạng.
- Arrow mở menu, Escape/keyboard hoạt động; chọn480p giữ nguồn gốc và dùng cache cũ hợp lệ.
- Kiểm tra thanh tải, Stop, sourcechange và nhấn nhanh không tạo job trùng.
- TXT mới mô tả đúng lựa chọn; import giữ request/source/snapshot guards.

## Bổ sung UI nguồn
- app/page.tsx: chuyển thông báo loading/error YouTube xuống dưới nút Chuẩn bị nguồn, ngoài TabsContent; chữ thay đổi không đẩy vị trí nút. Giữ nguyên handler/state/disabled và logic tải nguồn.
- Build1116 giữ profile Beta, ports5373/8987, data root và credentials hiện có. DEV không thay đổi.
