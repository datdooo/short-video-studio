# Teaser: text-only và kiểm tra duration

## Phạm vi đã chốt cuối cùng

Giữ pipeline/số bước AI và các lượt discovery/final/retry/repair hiện có; chỉ bỏ trích xuất/gửi ảnh trong teaser. Không áp dụng đề xuất trung gian gộp còn hai request, giảm context text hoặc sửa bước main. Giữ transcript, Most Replayed, comments, metadata và các nguồn text của pipeline hiện hành. Không đổi model/reasoning/auth hoặc thêm request trong lượt sửa.

## Bằng chứng lượt thực tế

Operation 7e3f6cdb-aadd-4446-94c1-7977854a3442: select-main, find-two-part-moments, finalize-two-part-moments, cả ba HTTP 200 / response.completed, gpt-6-luna, reasoning none được response xác nhận. Tổng usage: 202195 token = 18434 + 82229 + 101532, input 199425, output 2770, provider cached_tokens=0. Đây là provider đã trả output, sau đó local từ chối duration, không phải auth/quota/network.

| Part | start/end AI cũ | Clock AI thực dùng | Độ dài nguồn | Độ dài export | Min/max local lúc lỗi | Nhánh vi phạm cụ thể |
|---|---|---|---|---|---|---|
| 1 | Không giữ được | Chưa xác minh; contract là source seconds | Chưa biết | Chưa biết | 0.625–11.25s nguồn / 0.5–9s export | Chưa phân biệt min hay max |
| 2 | Không giữ được | Chưa xác minh; contract là source seconds | Chưa biết | Chưa biết | 0.625–11.25s nguồn / 0.5–9s export | Chưa phân biệt min hay max |

Log không có start/end, source duration hoặc source ID để đối chiếu chính xác video; không suy ra các giá trị này từ số token. Trong source trước sửa, rejected có start/end tạm thời nhưng log chỉ in code; cache chỉ giữ rejected nếu có speech diagnostic, nên lỗi duration cũ không được lưu kèm range. Raw output AI không được lưu. Không đọc heap hoặc phát lại request để dựng lại. Không kết luận hai teaser “quá dài”.

Điều kiện cũ chính xác tại rankedSelection, sau schema/permitted-range: `(end-start)/1.25 < 0.5 || end-start > 11.25`. Vì vậy mã bao gồm cả quá ngắn/reversed range và quá dài. Các trường start/end đã phải là số hữu hạn theo schema/local normalization. Không có bằng chứng để kết luận milliseconds, clock sai, nhân tốc độ hai lần hoặc floating-point là nguyên nhân của chính output cũ.

## Thay đổi duration

- lib/teaser-hooks.mjs + declaration: hookDurationLimits công khai thêm minRenderedSeconds=0.5 và minSourceSeconds=0.625 ở rate 1.25. hookDurationCheck dùng nguyên endpoint, tính sourceSeconds=end-start và renderedSeconds=sourceSeconds/rate đúng một lần; tách minimum, maximum, invalid-range. validateTeaser adaptive dùng cùng helper. Không thêm tolerance, không snap/round/cắt endpoint, không tăng trần 9 giây.
- lib/teaser-candidates.mjs: lọc kỹ thuật trước chọn/dedupe shortlist và mọi boundaryOptions: số hữu hạn, start<end, min/max và nằm trọn một permitted interval. Không cắt proposal để cho vừa, không chấm sức hút bằng local mới.
- lib/teaser-prompt.mjs: schema mô tả start/end là source seconds và giới hạn hiệu số; instructions ghi rõ 0.625–11.25 source / 0.5–9 export tại1.25x, preview1x, không có minimum bắt buộc5s, không cộng transition/padding hoặc áp tốc độ lần hai. Không ép hết9s. Câu dài quá giới hạn phải chọn ý độc lập/candidate khác; không cắt đuôi.
- worker/teaser-selection.mjs: reject duration giữ start/end, clock/unit, độ dài source/export, source duration, rate, min/max và nhánh vi phạm. Hiển thị giá trị đó trong reason, ghi diagnostic số vào log/cache; không lưu quote/prompt/output riêng tư. Mã OUT_OF_BOUNDS dùng nhãn min/max thay vì mặc định “vượt/quá dài”. Request provider vẫn completed; local failure đánh dấu stage error với code validation, không đổi thành lỗi provider.

Trước sửa, số5 trong helper là preferred/soft target; không phải hard min của adaptive v3. Kiểm tra4–6s cũ chỉ dành compatibility selection policy cũ, được giữ cho dữ liệu cũ. Không áp lại nó lên lựa chọn adaptive hiện tại. Công thức preview/export hiện có và presentationSegments giữ nguyên: teaser là nguồn start/end, preview1x, export1.25x; transition không cộng thêm một đoạn teaser mới.

## Ảnh và context lặp

Nguồn tăng48 ->86 ảnh là pairFrames(refine): giữ c.images từ discovery, thêm frame mới, dedupe chỉ theo timestamp rồi cap48 MỖI part. Log thêm20/part, trong đó Part1 có2 frame cache hit; phù hợp với tổng48+18+20=86. Token input ở bước chốt cũng tăng vì thêm discoveredMoments/refinedEvidence trên context cũ. Việc factor dữ liệu chung giữa hai part không loại được mọi bản biểu diễn transcript/candidate/context khác nhau trong cùng part.

Sửa worker/teaser-selection.mjs: pairTextInputs chỉ chuẩn bị/refine text như trước; bỏ toàn bộ lời gọi sampler ở các nhánh single/pair discovery, finalize, retry/repair. Mọi provider.analyze teaser truyền images:[] rõ ràng. Không có bước tạo JPEG/base64 teaser; capabilities/coverage và hướng dẫn ghi đúng text-only. worker/server.mjs không truyền sampler vào selector teaser nữa; mainContent vẫn nhận hookFrames như trước. Các phương thức ranking, permitted ranges, speech citation, word/tail và validator visual không bị nới để giả đã nhìn thấy hành động. Không có ảnh thì visual-only claim vẫn không có bằng chứng; speech có căn cứ vẫn được đánh giá theo tiêu chí hiện có.

Cache selector phân biệt phiên bản duration/text-only để không gắn dữ liệu đã chọn có ảnh thành kết quả text-only mới. Không tự xóa plan/draft/teaser hiện tại hay chạy lại video cũ. Main cache, main requests và sampler main không đổi.

Theo chốt cuối, giữ text/context và số bước AI hiện hành, không cắt mù transcript/comments/metadata để giảm token. Rủi ro còn lại: context text vẫn có bản biểu diễn lặp; discovery vẫn có thể phát sinh theo điều kiện cũ. Không tuyên bố đã giảm tổng request hoặc một tỷ lệ quota. Local frame cache chỉ giảm việc giải mã file; cached_tokens=0 của provider không phản ánh cache local. Bỏ ảnh sẽ giảm dữ liệu ảnh gửi teaser theo source mới nhưng chưa đo thời gian/usage/quota trước-sau.

## Giữ dữ liệu và bàn giao

Giữ main/teaser/draft theo cơ chế priorTeaser/structuredClone hiện có. Không đổi mốc thủ công, provenance, locks/snapshots. Các sửa FFmpeg -/filter_complex trong render và audio preview giữ nguyên; build DEV trước đã chứa sửa đó. Không render thử trong lượt này.

Chỉ đọc source/log/diff và sửa source. Không gọi AI, test, lint/typecheck, build, render, YouTube hoặc ASR. Chưa nghiệm thu runtime/chất lượng chọn teaser, chưa có bằng chứng xác định min hay max trên output lỗi cũ.

App hiện tại CHƯA chứa sửa duration/text-only của lượt này. Lần cập nhật được yêu cầu tiếp theo: lưu và Quit app DEV bình thường, build/package một lần vào release/dev/ShortCut Studio Dev.app, đối chiếu selector/prompt/helper và FFmpeg fix trong package. Không tạo Review mới, không đụng production/data/credentials/media/exports/backups, không push/merge.

## Build DEV 2026-10-22

Sau khi người dùng lưu/Quit và xác nhận không còn app/FFmpeg chạy, build/package một lần thành công vào release/dev/ShortCut Studio Dev.app. Đối chiếu 13 module package khớp hash source trước build. Selector teaser không có sampler call/base64/input_image và cả 4 nhánh provider request đều images:[]; main selector và model policy khớp app cũ, main vẫn giữ hookFrames. Có helper/check/diagnostics duration, parser/citation và -/filter_complex ở render/audio preview. OAuth body vẫn không có service_tier/max_output_tokens. DEV config không đổi; native audit/sign guards hoàn tất. Log: /tmp/shortcut-dev-text-duration-build.log. Không tự mở app, không gọi AI/test/render. Chưa xác minh runtime hoặc nguyên nhân start/end output lỗi cũ.
