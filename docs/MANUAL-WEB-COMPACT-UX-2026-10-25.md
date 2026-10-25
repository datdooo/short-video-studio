# Đóng gói theo yêu cầu: build 1109

Các sửa source bên dưới được chốt làm checkpoint build 1109. Lượt build chỉ
compile/package/native audit/codesign và đối chiếu artifact; không AI/tests/
render/ASR/download video/browser automation. Bản cũ giữ để rollback; chỉ cập
nhật /Applications sau khi người dùng Quit bình thường. Các ghi chú chưa build
bên dưới là trạng thái lúc sửa source.

# Manual web prompt + overlay/render UI — 2026-10-25 (source only)

Nền Beta beta/maintenance a4a0bd7, build đã cài 1108. Lượt này không build,
commit/push/merge, AI/probe, tests/lint/typecheck, browser automation, render,
ASR hay download. Chỉ rà source/diff và tra tài liệu/GitHub công khai.

## Ba mục giảm lãng phí được triển khai

1. Gộp đúng phần trùng, không bỏ bằng chứng:
   - lib/muse-plan.mjs chỉ chèn EXPLANATION_INSTRUCTIONS chung một lần, giữ đủ
     tiêu chí MAIN/teaser/ngôn ngữ. Giữ TXT đầy đủ, một file và import IDs.
   - Manual bật canonicalVideoInput(...,deduplicateExactValues:true).
     lib/video-ai-input.mjs tái sử dụng $ref/$cue/$cueText: chuỗi và mảng/object
     phẳng trùng chính xác có một bản canonical; không giấu toàn context/candidate
     sau chuỗi tham chiếu sâu. Giữ thời gian, cue IDs, candidate IDs và provenance.
   - Chỉ dùng biểu diễn mới nếu tổng text nhỏ hơn canonical cũ, giải tham chiếu
     khớp toàn bộ cây dữ liệu và độ sâu tham chiếu tối đa 3. Nếu không, giữ biểu
     diễn cũ đầy đủ. Guard này kiểm tra bảo toàn bằng code, không chứng minh model
     hiểu tham chiếu hoặc token/quota/thời gian đã giảm.
   - sourceText trùng chính xác cue text/chuỗi cue có thể dùng $cueText. Transcript
     có timestamp/newline hoặc lời nhập khác vẫn giữ nguyên văn; không coi hai
     biểu diễn khác nhau là trùng để âm thầm xóa. Candidate clipped text/evidence
     khác vẫn giữ. Comments/metadata/chapters/replay và local text signals còn đủ.
   - Opt-in chỉ ở prompt web thủ công; worker Auto không bật tùy chọn mới, shared
     instructions/version Auto và chính sách text-only không thay.
2. Kết quả gọn: lib/teaser-import.mjs yêu cầu JSON cuối, mỗi trường giải thích
   thường một câu Việt ngắn, mỗi trường một mục đích, không scorecard/bài luận
   hoặc lặp synopsis mỗi ứng viên. Quote cần thiết + nghĩa Việt/evidence và lý do
   loại giữa part/đuôi vẫn đủ; không thêm giới hạn độ dài validation để ép cắt ý.
3. Mặc định 2 teaser/part = winner + 1 alternative. Chỉ thêm alternative thứ hai
   (tổng 3) khi là khoảnh khắc/nhận định khác có giá trị biên tập; nêu khác biệt
   ngắn ngay trong reason hiện có. Không thêm trường/schema mới, request hoặc
   repair. Import vẫn kiểm tra mọi ứng viên, tối đa 2 alternatives, không bịa
   cho đủ số nếu nguồn thực sự thiếu lựa chọn hợp lệ. Cả export full và hook-only
   dùng cùng policy; Auto vẫn một winner.

Prompt web v9: external-editing-full-media-compact-v9. TXT cũ cần tải mới sau
cập nhật, không tự phân tích lại hoặc thay plan/draft/teaser đang dùng.

## Hai sửa UI tiếp nhận trong cùng lượt

- lib/visual-style/title-fit.mjs + declaration thêm partOverlayTitle.
  app/page.tsx, lib/render-spec.ts, worker/server.mjs dùng cùng display title
  cho fit/preview/raster overlay. Bỏ nhãn cuối Phần 1/2 hoặc Part 1/2 (kể cả
  phân cách |/dash/colon/ngoặc); không xóa từ Phần ở giữa câu, không trả title
  rỗng. Ví dụ A | Phần 1 -> A trên video. Nhãn 1/2 và 2/2 giữ nguyên.
  Không sửa part.title đã lưu, ô nhập, originalTitle hay title copy/đăng video.
- app/globals.css cho render heading/actions wrap trong card và cách progress
  row 12px. Component TaskProgress vốn chỉ có một % mỗi bar; không thêm số,
  đổi công thức/timer/job state. Running/validating/publishing/done/error/cancel
  dùng cùng component nên cùng được bố trí lại.

## Nghiên cứu và đề xuất chưa triển khai

- OpenAI latency guide: output generation thường là nút thắt; hướng yêu cầu
  giải thích gọn phù hợp. Đây là hướng dẫn API, không phải phép đo ChatGPT web:
  https://developers.openai.com/api/docs/guides/latency-optimization
- TOON mô tả header+rows cho bảng đồng nhất và tự khuyến cáo compact JSON cho
  dữ liệu lồng/không đồng nhất. Không thêm dependency hay đổi toàn payload sang
  định dạng mới chỉ vì benchmark của repo khác:
  https://github.com/toon-format/toon#when-not-to-use-toon
  https://github.com/toon-format/spec/blob/main/SPEC.md
- Cải tiến tiếp đáng xem: đưa mô tả chung của part ra một chỗ trong output để
  không sinh partUnderstanding giống nhau ở winner và từng alternative. Cần
  phối hợp schema/import/UI và giữ evidence/ending/relation riêng của từng
  ứng viên; chưa làm trong lượt này để không đổi contract ngoài ba mục đã chốt.
- Không gửi verbosity/reasoning API giả trong prompt web; không đổi model hoặc
  Thinking trên website, không tuyên bố đọc hết video chỉ vì có file đính kèm.

## Nghiệm thu tay sau khi cập nhật app

- TXT mới giữ source/request/analysis IDs, toàn transcript tới cuối, comments,
  replay và main/manual protection; giải thích policy không lặp hai lần.
- Kết quả thường hai lựa chọn/part, thứ ba chỉ khi khác biệt có ích, mọi lựa
  chọn vẫn qua source/range/gap/duration/citation validation và ngôn ngữ nguồn.
- Overlay A | Phần 1 hiển thị A, vẫn 1/2; preview và render cần tự quan sát.
  Title trong ô nhập/copy vẫn nguyên bản, chữ Phần giữa nội dung không mất.
- Kho/render list: nút Xóa/Huỷ và % tách hàng, cả màn hẹp và 100% hoàn tất.
- Đổi source/yêu cầu làm TXT v9 cũ hết hiệu lực; lỗi import giữ JSON/plan.

Chưa đo latency, token hoặc quota web; không hứa tỷ lệ giảm. Chưa xác minh
runtime/visual fit/đọc video/khả năng model xử lý biểu diễn mới trên website.
