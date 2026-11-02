# Web AI: đồng bộ UI + tiêu chí teaser

- ChatGPT/Gemini/Muse tiếp tục cùng builder/schema/importer/worker snapshot; không ba pipeline. Nhãn UI gọn, chung tải TXT, tải nguồn/menu480p, JSON kết quả và Áp dụng2part. Giữ provider/request/source trong snapshot/provenance: đổi AI vẫn cần đúng lượt TXT, không tự gắn lại JSON cũ.
- MANUAL_WEB_TEASER_REVIEW_INSTRUCTIONS trong lib/teaser-import.mjs nối vào full editing và legacy hook-only prompt. Hook-only vẫn giữ main theo contract riêng. Prompt v19 phân biệt snapshot cũ.
- Cải thiện tiêu chí: đọc toàn bộ final main/cues + video thực; so sánh speech/action/reaction/payoff có bằng chứng, vào ý nhanh, không mất chủ thể/phủ định/điều kiện/đơn vị, kiểm tra kết thúc tự nhiên. Replay hỗ trợ, không tự quyết định mốc. Phương án khác cần khác sự kiện/ý; mặc định2/part, thứ3 khi hữu ích; không bịa đủ số. Giải thích ngắn, không thêm scorecard hoặc field output.
- Không thêm request/model/detector, không bỏ dữ liệu, không nới validator. ChatGPT Auto Sol low/text-only và main giữ nguyên. Manual teaser giữ quyền tự do đã sửa1118.
- Chỉ sửa source/đọc diff; chưa AI/test/build/render/browser QA, chưa chứng minh chất lượng teaser tốt hơn trên video thật. Giữ sửa button đang có, release/Applications/DEV/dữ liệu nguyên vẹn. Tải TXT mới một lần khi app được cập nhật.

## Ưu tiên mới từ người dùng
- Teaser web ưu tiên cao trào/căng thẳng/bất ngờ thật hoặc hé lộ một phần payoff. Chọn trực tiếp sự kiện/thử nghiệm thay vì dẫn nhập hoặc lời hứa. Ví dụ câu cá/cú sút/test máy chỉ là analogies, không keyword filter hoặc bằng chứng thị giác.
- Giữ source/citation/range/duration AI, không áp trần lại cho manual, không tự thay lựa chọn hiện tại. Không thêm dữ liệu/request. Auto vẫn giữ như chốt trước.

## Tiêu chí mở rộng theo yêu cầu
- Các lens tổng quát: struggle/near-failure có stakes, reversal/discovery, before–after, test trả lời câu hỏi, kết quả đặc biệt có đơn vị/baseline, kỹ năng khó, chi tiết lộ ra/first use, sửa hiểu nhầm có bằng chứng, phản ứng có nguyên nhân. Không quota thể loại/keyword/score local.
- Micro-arc dễ hiểu; payoff glimpse mở câu hỏi how/why thật, không cắt giấu điều kiện để tạo suspense. Thất bại thật có thể hấp dẫn hơn thành công; không đánh tráo attempt thành kết quả.
- Không ghép phản ứng lạc cảnh, đảo cause/effect, bỏ phủ định/đơn vị, bịa superlative/nguy hiểm hoặc gọi B-roll là cao trào. Giữ xác minh trẻ em/khả năng đọc video thực, output ngắn và2 ứng viên mặc định.
- Không thêm request, thay model/Auto/validator hay plan hiện tại; chưa build hoặc gọi AI để kiểm chứng.

## Điều chỉnh cuối
- Bỏ toàn bộ ví dụ định hướng câu cá/bóng đá/máy móc khỏi prompt theo yêu cầu. Dùng tiêu chí tổng quát; không gán tình huống trung gian thành kết quả thành công.

## Chỉ một ô yêu cầu
- Bỏ hẳn Yêu cầu AI trong Nâng cao và ô Quy tắc chia part của Batch. Còn Yêu cầu bổ sung dùng chung.
- Phiên mới instruction trống. mainInstruction nhận diện chính xác nguyên văn default hiện tại/các default cũ thành text rỗng vì MAIN policy đã có riêng; không fuzzy-match, trim hay xóa custom text.
- Draft cũ: primary instruction tự viết hiển thị trước supplemental trong cùng ô; raw state/snapshot giữ nguyên cho tới khi người dùng sửa. Khi sửa ô chung, chuyển toàn bộ text đang thấy sang supplemental và xóa primary legacy. Không có yêu cầu riêng bị giấu hay mất; không đổi IDs/plan/teaser.
- Core MAIN/teaser policy vẫn được builder gửi độc lập. Các schema/validation/manual protections và dữ liệu giữ nguyên. Chưa build/test/AI/render.

## Đóng gói
- Build1119 chỉ cập nhật release, Applications và DEV giữ nguyên. Bao gồm button split border, tiêu chí web chung v19, bỏ ví dụ thể loại và bỏ ô Yêu cầu AI. Giữ một ô Yêu cầu bổ sung và yêu cầu custom cũ. Chỉ build/package/native audit/codesign bắt buộc; chưa nghiệm thu runtime/chất lượng teaser.
