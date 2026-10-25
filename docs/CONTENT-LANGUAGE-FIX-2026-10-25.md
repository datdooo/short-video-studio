# Cập nhật đóng gói 1108

Sửa bên dưới được chốt làm source build 1108. Build/package và kiểm tra tĩnh
artifact được cho phép; không chạy AI/tests/render. /Applications chưa thay khi
app còn mở. Các ghi chú 1107/chưa build bên dưới là trạng thái lúc điều tra.

# Lỗi tiêu đề Part khác ngôn ngữ nguồn — Beta 2026-10-25

## Bằng chứng và nguyên nhân

Ảnh nghiệm thu build 1107: original title tiếng Việt, part title và hashtag
có tiếng Nhật. Metadata source 77eebb60-bc2f-4390-9a86-71c69d9e15e8 đọc tại
Beta data root xác nhận language=vi, captionLanguage=vi, captionTranslated=false.
Không tải video, chạy ASR hay gọi AI để kiểm tra.

Schema EDIT_PLAN_SCHEMA / MAIN_SCHEMA chỉ cho de/en/fr/ja/ko, thiếu vi và mọi
ngôn ngữ khác. parseMusePlan và main validator lặp lại whitelist này; importer
không so ngôn ngữ kết quả với source.language. Vì vậy một kết quả đúng vi bị
contract cũ từ chối, còn ja được chấp nhận dù source vi. normalizePlan không
hề dịch title; preview/Inspector hiển thị part.title từ plan. Restore còn đổi
ngôn ngữ ngoài whitelist thành en, làm mất mã vi sau reload.

Không tìm được output AI/plan của lượt lỗi trong các JSON thuộc thư mục source
này. Chưa chứng minh vì sao model chọn riêng ja trong các giá trị sai được cho
phép, hoặc template có tác động tới lựa chọn đó. Không quy lỗi cho model yếu,
Whisper, quota hay khẳng định runtime mới đã đúng.

## Sửa source

- lib/content-language.mjs (+ .d.mts): schema/policy/validation mã ngôn ngữ
  dùng chung, không whitelist năm ngôn ngữ. Chấp nhận mã BCP-47 có cấu trúc
  hợp lệ, chuẩn hóa metadata; không dịch bất kỳ text nào. und khi chưa biết.
- lib/edit-plan.ts: type/schema mở cho ngôn ngữ nguồn; normalize giữ mã hợp lệ.
  Manual plan nhận ngôn ngữ source, không mặc định en. Mock demo vẫn là demo.
- lib/muse-plan.mjs: prompt v8 giữ ngôn ngữ nguồn, tách giải thích Việt và title/
  hashtag. Khi source xác định, schema chỉ nhận đúng code đó (ví dụ vi).
  Import báo CONTENT_LANGUAGE_MISMATCH nếu JSON là ja nhưng source vi.
- worker/main-content.mjs + lib/auto-cut/main-content.mjs: cùng policy/schema và
  validation cho Auto/Batch; cache identity có languagePolicy, prompt/schema
  mới. Cache cũ không được nhận thành kết quả contract mới. Không xóa cache.
- worker/auto-cut-workflow.mjs: guard ngôn ngữ ở server import, không chỉ UI.
- lib/editor-session.ts: restore giữ vi và mã hợp lệ khác; không ép en.
- app/page.tsx: truyền metadata language cho Manual cut; thêm type source.
- scripts/worker-runtime-files.mjs: module mới có trong manifest package.

Model/reasoning, dữ liệu đầu vào, số request, thuật toán main/teaser, timestamps,
validation kỹ thuật, subtitle track và engine không đổi. Không thêm AI/retry.
Policy ngôn ngữ chung chỉ gửi một lần trong prompt web, giữ 2–3 teaser/part.
Prompt v7 cũ hết hiệu lực cho import mới; plan/draft/teaser đang dùng được giữ.
Không chặn preview/render hoặc đổi title người dùng đã lưu vì policy mới.

## Giới hạn / nghiệm thu tay

Chỉ rà source/diff; chưa test/lint/typecheck/build/AI/download/ASR/render/browser.
App release và /Applications vẫn build 1107; chưa chứa sửa ngôn ngữ này.

- Video Việt: tải TXT mới, thấy sourceLanguage vi và schema language vi;
  nhận title/hashtag tiếng Việt, giải thích Việt, 2–3 teaser mỗi part.
- JSON khai ja cho source vi: Apply báo mismatch, giữ plan và JSON draft.
- Video Đức/Nhật/Hàn/Anh và một ngôn ngữ ngoài whitelist cũ: giữ ngôn ngữ gốc.
- Reload plan vi: giữ vi; đổi template/font không đổi ngôn ngữ nội dung.
- Source chưa xác định ngôn ngữ: prompt nêu und, không tự ép en/ja.

Validator đối chiếu mã ngôn ngữ, không tuyên bố đã kiểm chứng ngữ nghĩa mọi title/
hashtag. Model vẫn có thể khai vi nhưng viết sai ngôn ngữ; cần nghiệm thu thật.
Không tự dịch/sửa title Nhật hiện tại hay phân tích lại để tránh ghi đè chỉnh tay.
