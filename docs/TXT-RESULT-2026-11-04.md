# TXT v24 — đo, cải thiện, đo lại (2026-11-04)

Nhánh `feat/txt-quality`. Dữ liệu: 70 snapshot TXT đã lưu (tất cả nguồn YouTube) và 98 job trong lịch sử Beta, **chỉ đọc**; không có nội dung transcript/bình luận trong báo cáo này. Không gọi AI.

## 1. Đo nền (script `scripts/measure-txt.mjs`, dựng lại đúng TXT bằng `buildExternalEditingContext` + `buildMusePrompt`)
- TXT thật nhỏ hơn snapshot lưu trên đĩa (snapshot chứa dữ liệu lặp): **trung vị 119.796 byte (~30k token), tối đa 236.372 byte (~59k token)**. Ước lượng trước đó (232–413 KB) là kích thước snapshot, không phải TXT.
- Mục **rules cố định 23.325 ký tự** (~20% TXT trung vị).
- Cue caption trung vị 18 ký tự; chỉ **31% cue kết thúc bằng dấu câu** (auto-caption thường không có dấu).
- Tín hiệu hình/âm cục bộ (`visual` 18 KB + `audio` 10 KB trong mẫu trung vị) chiếm ~24% evidence và **chỉ phủ trung vị 25% thời lượng nguồn (nhỏ nhất 8%; chỉ 2/70 nguồn phủ ≥95%)**.
- Đóng gói khử trùng giá trị (`canonicalVideoInput`) chỉ có hiệu lực ở 6/70 snapshot.
- Heatmap "Most Replayed": `replay.sourceSamples` có thể nặng 39 KB trong khi `bins` chỉ 6 KB.

## 2. Bộ đánh giá cấu trúc kế hoạch đã lưu (`scripts/eval-plans.mjs`)
Chỉ số cấu trúc, **không phải** chất lượng AI. "clean" = ranh giới cắt nằm trong 0,35 s của điểm cắt an toàn (hết câu, nghỉ ≥0,5 s).

| Provider | Job | Part | Ranh giới | clean | rơi giữa cue | Teaser bị chỉnh tay | Teaser ngoài giới hạn | Main giữ lại (trung vị) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| chatgpt | 16 | 32 | 88 | 46.6% | 3.4% | 16.7% | 0% | 48.6% |
| chatgpt-web | 75 | 150 | 406 | 50.5% | 6.2% | 15.8% | 1.4% | 44.3% |
| gemini | 7 | 14 | 107 | 70.1% | 0% | 28.6% | 0% | 27.4% |

Nhận xét: ranh giới rơi **giữa cue** chỉ 0–6% — vấn đề "cắt giữa câu" không nặng như lo ngại; phần lớn ranh giới nằm giữa hai cue nhưng không có dấu hiệu rõ là hết câu. Người dùng sửa tay teaser ở khoảng 16–29% part. Main hầu như không bị sửa (trung vị 0%). Chỉ có 7 job Gemini nên số liệu Gemini chưa đủ tin cậy.

## 3. Thay đổi TXT v24 (tương thích ngược v19–v23)
- `lib/txt-signals.mjs` (mới): chuỗi số dạng cột theo đoạn liên tục (không điền đầy khoảng chưa lấy mẫu), `cutPoints` dạng chuỗi nhỏ gọn (`cue-41@123.4:SP`), `timeMap` hợp nhất theo ô thời gian (null ở nơi chưa lấy mẫu, không điền 0), `signalAvailability`.
- `replay.sourceSamples` chuyển sang dạng cột, không mất dữ liệu (có `binIndex`).
- Cue (id, thời gian, văn bản) và `sourceText` **giữ nguyên**.
- Prompt: thêm DATA GUIDE và hai ví dụ tốt/xấu (tổng hợp, không dùng nội dung thật); `WEB_AI_PROMPT_VERSION` → v24, v23 vào danh sách tương thích.
- Mục bỏ qua: gom cue thành "câu" có mã riêng (đơn vị câu). Số đo cho thấy rơi-giữa-cue thấp và auto-caption không có dấu câu nên điểm cắt an toàn dựa trên nghỉ/im lặng hợp lý hơn; thêm đơn vị câu sẽ tăng kích thước mà lợi ích chưa chứng minh.

## 4. Đo lại
| Chỉ số | v23 (trước) | v24 (sau) |
|---|---|---|
| TXT bytes (min / median / max) | 70,252 / 119,796 / 236,372 | 50,066 / 99,254 / 228,107 |
| Ước lượng token (bytes/4) | 17,563 / 29,949 / 59,093 | 12,517 / 24,814 / 57,027 |

TXT trung vị giảm ~17% dù đã thêm cutPoints, timeMap, hướng dẫn và ví dụ; tối đa giảm ~3,5%. Tất cả 70 snapshot dựng lại không lỗi.

## 5. Giới hạn và việc nên làm tiếp
- Các số đo là **kích thước và cấu trúc**; chưa chứng minh AI chọn tốt hơn. Cần so sánh thủ công: `scripts/make-paired-txt.mjs` sinh cặp TXT cho cùng một nguồn.
- Khoảng trống chất lượng lớn nhất: tín hiệu âm thanh/hình chỉ phủ ~25% nguồn. Phủ toàn bộ âm thanh (loudness/im lặng) rất rẻ với ffmpeg và sẽ làm `timeMap` và `cutPoints` (cờ Q) có giá trị thật; đây là việc riêng vì chạm lớp local-signals dùng chung với Auto.
- Mọi nguồn trong mẫu là YouTube; chưa kiểm nguồn từ máy.
- `currentParts` chưa có trong số đo vì snapshot không lưu plan hiện tại.
