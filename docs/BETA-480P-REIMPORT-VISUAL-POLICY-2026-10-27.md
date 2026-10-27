# Beta1112 — phạm vi và nguyên nhân

## Video phân tích480p

Trước sửa, MP4<=512MiB luôn trả bản gốc, kể cả1080p; bản lớn chọn720/480/360
hoặc encode theo long-edge. Nay `worker/web-ai-video.mjs` dùng cap height480
trong ensure/describe/cache validation. YouTube xin rendition cao nhất<=480,
fallback local encode giữ tỉ lệ và source clock, không upscale. Nguồn/rendition
thấp hơn480 được giữ độ phân giải thấp hơn. Byte-budget retry chỉ giảm bitrate,
không thay geometry. Full timeline/audio/timing guards,512MiB cap và cache/shared
operation vẫn giữ. Cache version480p-v3 không nhận derivative720p cũ.

UI `app/page.tsx` ghi Tải video480p. TXT vẫn chỉ stat manifest, không chờ
download/encode. Không đổi file nguồn, phụ đề, preview hoặc chất lượng xuất.
Không có phép đo cho thấy480p làm Thinking nhanh hơn; chỉ định dạng giao file.

## Nhập JSON sửa lại từ cùng cuộc chat

Lỗi code xác nhận: applyWebAiResult đổi plan/mainSignature nhưng context vẫn
chỉ nhận chữ ký trước Apply. Vì thế webAiPromptIsCurrent tự false, khóa Apply
và báo TXT cũ. Chưa có JSON/log lỗi người dùng để kết luận mọi từ chối đều do
đường này; lỗi schema/ID/evidence vẫn phải được báo và chặn đúng.

`app/page.tsx:webAiEditorSignature` dùng chung projection main/cues chuẩn hóa,
canonical key order để restore không lệch vì object insertion order. Có manual
teaser trong identity để không âm thầm ghi đè lựa chọn tay sau import. Sau TẤT CẢ
validators/async guards thành công, lưu lastImportMainSignature riêng cùng plan.
Chấp nhận chữ ký prompt gốc hoặc lần import thành công mới nhất. Giữ nguyên
lockedPlan, request/source/analysisKey của TXT gốc để worker tái xác minh đúng
context; không thay bằng kết quả vừa nhập. Không tự rebind JSON sai ID.

`lib/editor-session.ts` whitelist dấu vết import mới; không tự nâng context cũ
thiếu dấu vết. Freshness phân biệt version/source/provider/transcript/request/
main-phụ đề-manual edits. Style/nhạc không đi vào identity. Parser vẫn đòi full
JSON hai part, schema/range/citation/duration/locks; lỗi giữ plan và JSON draft.
`lib/muse-plan.mjs`/declaration v11 hướng dẫn follow-up giữ nguyên IDs và trả
FULL JSON, dùng chung cho ChatGPT web/Gemini/Muse. Auto/schema không đổi.

## Default chỉ cắt trẻ em có bằng chứng rõ

`lib/main-instructions.mjs:VISUAL_CHILD_EXCLUSION_INSTRUCTIONS` dùng chung MAIN
và `lib/teaser-prompt.mjs` (discovery/finalize/custom/retry). Chỉ loại khoảng
video xác định rõ trẻ em đang xuất hiện; không suy từ lời nói/comments/giọng/
vóc dáng/ảnh mờ. Không chắc thì GIỮ và ghi mốc review trong reason/limitations
hiện có. Không loại cả cảnh rộng hoặc bịa biên cắt. Bảo toàn chỉnh tay; báo
xung đột thay vì ghi đè. Teaser có bằng chứng rõ phải tránh vùng đã loại.

Auto text-only không có bằng chứng thị giác: không cắt theo suy đoán này hoặc
tuyên bố đã kiểm tra hình. Không thêm model local/request/detector/schema mới.
Manual prompt chỉ gửi prose policy này một lần. MAIN cache versionv5/instructions
và webv11 phân biệt mới; các plan hiện có không bị chạy lại hay tự sửa.
Factory default v4 chính xác được map sang v5 khi tạo input, raw draft giữ nguyên;
custom request không bị viết lại. Các tiêu chí hai đầu mút/continuity giữ nguyên.
`lib/auto-cut/analysis.mjs` vẫn nhận metadata v4 của plan đã lưu, không gán nhãn
v5 hoặc làm restore/export hỏng chỉ vì nâng phiên bản prompt/cache mới.

## Nghiệm thu tay và build

1. Nguồn1080p nhỏ/lớn512MiB: tải video tối đa480p, đủ đầu/cuối/âm thanh; tải
   lặp dùng cache. Nguồn360 không upscale; video dọc giữ tỉ lệ, không crop.
2. Tải TXT một lần, nhập JSON A; nhờ web AI chỉnh cắt, nhập full JSON B cùngIDs.
   Cả hai part/candidates thay đúng B. Reload rồi nhập C vẫn đúng context.
3. JSON lỗi/sai source/request phải chặn, giữ A/B và draft. Sửa tay main/teaser
   hoặc phụ đề sau Apply phải yêu cầu TXT mới, không bị JSON cũ ghi đè.
4. Style/nhạc/đổi tab không khóa Apply. Nhập mới khi request cũ chạy không để
   kết quả source/revision cũ ghi vào phiên hiện tại.
5. Kiểm tra prompt các provider có policy rõ: video mờ/không chắc không cắt;
   Auto text-only nêu giới hạn, không khẳng định đã nhìn thấy trẻ em.

Một lượt build/package macOS Beta1112 + audit/codesign/static module closure.
Hai app cố định release và Applications phải cùng checkpoint. Dọn chỉ bundle
macOS Beta cũ đã xác minh sau swap; không xóa DEV/source/Git/data/credentials/
Windows/recovery backups. Kết quả cleanup ghi receipt dưới release/beta.
Chưa chạy tests/lint/typecheck riêng, AI/ASR/download video/render/browser hoặc
nghiệm thu runtime. Chưa xác minh chất lượng cắt hay thời gian Thinking.
