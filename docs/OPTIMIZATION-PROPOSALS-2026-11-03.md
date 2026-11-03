# Đề xuất trong phạm vi audit 2026-11-03

Chỉ đề xuất; chưa bật retention, xoá dữ liệu, thay font hoặc thay chính sách AI.

## P3/P4 — Lịch sử và dọn dữ liệu có xác nhận

- `batch-history.json` mới vẫn đọc lịch sử cũ; bản mới dùng `planJobId` khi plan item giống hệt plan job. Khi đọc, khôi phục bản sao độc lập trước khi resume/xem lại. Không dùng file lịch sử mới với app cũ chưa hiểu `planJobId`; cần giải mã thành định dạng cũ trước khi hạ phiên bản. Không thay đổi file trên máy người dùng trong đợt này.
- `SHORTCUT_HISTORY_MAX_JOBS=N` chỉ có hiệu lực cùng `SHORTCUT_HISTORY_RETENTION_CONFIRMED=1`. Mặc định không giới hạn. Chỉ giới hạn job terminal không được batch tham chiếu; không xoá media/cache và không giới hạn số batch. Chưa bật hai biến này. Trước khi bật cần hiển thị danh sách lịch sử sẽ bỏ và được người dùng xác nhận; chưa triển khai UI này.
- Đề xuất màn hình dọn source/cache: quét chỉ đọc, hiện dung lượng, ngày dùng cuối và các tham chiếu từ plan/batch/nháp; không chọn sẵn mục nào. Chỉ thao tác sau khi người dùng xác nhận danh sách cụ thể. Kiểm tra lại khoá tác vụ và tham chiếu ngay trước thao tác; ưu tiên Thùng rác có khôi phục. Không triển khai mã xoá trong đợt này.
- Index source v2 lưu danh sách YouTube đã quét đầy đủ. Index cũ/thiếu/hỏng hoặc hit không còn hợp lệ vẫn quét lại. Không coi index là bằng chứng media còn tồn tại: hit vẫn qua `load` và kiểm tra identity.

## S5 — Chính sách quota: chờ người dùng quyết định

Giữ nguyên câu “without a quota-saving ceiling; prioritize quality over a cheap guess”. Đề xuất người dùng cân nhắc một bản prompt mới yêu cầu tái sử dụng bằng chứng đã đọc, tập trung kiểm tra các vùng còn bất định và giải thích ngắn trong schema hiện có. Không cắt transcript, thay tiêu chí main/hook hoặc giảm chất lượng để đạt một con số token. Nếu thông qua cần tăng version mới và đánh giá kết quả riêng; chưa sửa câu này.

Theo `docs/ai-efficiency.md` (mục “Follow-up từ lượt thật 249,5 giây”), lượt lịch sử có 281389 input, 6557 output và 274 reasoning tokens; đó không phải phép đo Beta hiện tại. Cơ chế output ceiling được tài liệu ghi nhận: 4500→2500 mỗi part hoặc 9000→5000 hai part, giảm trần tối đa 2000/4000 tokens (44,4%). Đây là mốc ước lượng tiết kiệm tối đa cho hướng hạn chế output, không phải tiết kiệm mới do thay một câu prompt và không cộng hai mức với nhau. Với chỉ sửa câu chính sách, chưa có cơ sở định lượng mức tiết kiệm thực tế; không cam kết giảm quota. Tài liệu cũng ghi 5→3 request khi đủ điều kiện, nhưng không cho phép quy thành phần trăm input tokens/quota. Các phần đó là ghi nhận lịch sử; không áp lại chính sách cũ đã bị thay thế.

## S6 — Route và hosting: chưa đủ bằng chứng để đề xuất xoá chắc chắn

Đã grep có phạm vi trong `app`, `components`, `lib`, `worker`, `scripts`, `build`, `vite.config.ts`, `.openai`, `package.json`; không build theo ràng buộc.

- `app/api/analyze/route.ts`: không tìm thấy caller `/api/analyze` trong phạm vi trên. Đây vẫn là route được framework phát hiện tự động; không thể từ grep khẳng định không có client ngoài repo/hosting gọi. Đưa vào danh sách cần xác minh trước khi đề xuất xoá, giữ nguyên file.
- `app/api/youtube/metadata/route.ts`: UI tại `components/editor/use-source-title.ts` dùng `workerFetch`, hàm này ghép `WORKER_ORIGIN`; worker có route tương ứng. `scripts/qa-youtube.mjs` gọi cùng path qua biến origin; QA khác cũng giả lập path này. Không đủ bằng chứng để loại route Next ở hosting. Giữ nguyên.
- Drizzle còn trong dependencies, script `db:generate`; `build/sites-vite-plugin.ts` vẫn copy thư mục migration nếu tồn tại. Không xoá Drizzle, cấu hình Cloudflare hoặc `examples/d1`.
- Chưa có danh sách nào đủ điều kiện “chắc chắn không dùng”. Cần người phụ trách hosting xác nhận caller/QA/deployment trước một đợt xoá riêng; đợt này không xoá route hay dependency.

## P6 — Font CJK

Đề xuất tạo subset WOFF2 theo phạm vi glyph sử dụng của giao diện và giữ fallback cho tiêu đề/phụ đề JP/KR tuỳ nguồn. Không dùng subset UI thay font burn-in khi chưa có đủ glyph của video. Cần kiểm thử shaping/combining marks, tiếng Nhật/Hàn và đường render riêng. Giữ nguyên font ID, family và định danh trong plan; chưa chuyển font hoặc tạo file release. Chưa đo dung lượng sau subset nên không hứa mức giảm cụ thể.

## S7/S8 — Phạm vi định dạng và cấu trúc

Chỉ xuống dòng ba module minified phải sửa: `muse-plan.mjs`, `teaser-hooks.mjs`, `music/light-leak.mjs`, cùng `worker/source-reuse.mjs`. Không format hàng loạt. Không tách lại toàn bộ Home hay hệ thống getter; giới hạn cập nhật đồng hồ và polling đã xử lý phần được giao. Chưa thêm memo khi chưa có phép đo lợi ích.
