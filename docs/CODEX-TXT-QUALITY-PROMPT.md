# Prompt giao việc — đo và cải thiện TXT gửi AI (chọn main/teaser tốt hơn)

Bạn làm trong worktree `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta-wt-txt`, nhánh `feat/txt-quality` (từ `f0f0c6b`). `node_modules` là symlink tới checkout chính: không sửa, không cài lại. Đọc `AGENTS.md`, `docs/AUDIT-2026-11-03.md`, `lib/muse-plan.mjs`, `worker/external-editing-context.mjs`, `lib/teaser-evidence.mjs`, `lib/teaser-input.mjs`, `lib/video-ai-input.mjs`, `lib/main-instructions.mjs`, `lib/teaser-import.mjs`.

## Bối cảnh
"TXT" là gói văn bản + schema mà app tạo cho 3 chế độ AI web thủ công (ChatGPT web, Gemini, Muse) và cũng là dữ liệu nguồn cho đường Auto. Người dùng chủ yếu dán **link YouTube**; nguồn video từ máy chỉ là trường hợp phụ — tối ưu cho YouTube trước (heatmap "Most Replayed", chapters, comment cluster, caption gốc, mô tả), nguồn local chỉ cần không bị hỏng và nói rõ thiếu tín hiệu nào.

Số đo có sẵn (từ 70 snapshot đã lưu trong `~/Library/Application Support/ShortCut Studio Beta/media/cache/external-prompt-snapshots`): mỗi snapshot 232 KB (trung vị) đến 413 KB; video 17,5 phút có 794 cue caption (mảnh ngắn, không phải câu); transcript cue 79 KB, `sourceText` 24 KB, `captionTrack` 64 KB, tín hiệu hình/âm lặp 3 nơi; `recipes` 55 KB. Bước đóng gói (`canonicalVideoInput`) có khử trùng giá trị giống hệt nên kích thước TXT thật có thể nhỏ hơn — **chưa đo**.

## QUYỀN VÀ GIỚI HẠN (bạn chạy full access; tự giữ kỷ luật)
- Ghi chỉ trong worktree này (+ thư mục tạm). **Đọc-only** với dữ liệu thật tại `~/Library/Application Support/ShortCut Studio Beta/media/**`: không sửa, xoá, di chuyển; copy fixture cần dùng vào thư mục tạm hoặc `lib/fixtures/` dưới dạng **đã ẩn danh/rút gọn** (không commit transcript/bình luận thật của người dùng; dùng dữ liệu tổng hợp).
- Tuyệt đối không đụng `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev` (DEV), `~/Library/Application Support/ShortCut Studio Dev*`, `/Applications/*`, `release/`, Keychain/credentials.
- Không gọi AI/ASR/render, không tải video, không chạy `codex exec`, không push/merge. Không mở cổng trừ khi cần test (cổng ≥ 6000, rồi đóng).
- Giữ nguyên hành vi 2 đường Auto/manual ngoài phần TXT; giữ khả năng import JSON của TXT cũ (v19–v23) và mọi guard `sourceId/requestId/analysisKey`.
- Commit nhỏ theo bước trong nhánh này; mỗi bước chạy `npx tsc --noEmit`, `npm run lint`, test liên quan; cuối cùng `npm test` (407/407 trước khi bạn bắt đầu).

## Giai đoạn 1 — ĐO (bắt buộc trước khi sửa)
1. Viết script offline `scripts/measure-txt.mjs` (chỉ đọc) dựng **TXT thật** bằng chính `buildExternalEditingContext` + `buildMusePrompt` từ các snapshot/`source.json` đã lưu (đọc-only), rồi báo cáo: byte, ước lượng token (ký tự/4 và nếu có bộ đếm cục bộ thì dùng), kích thước theo từng mục (transcript, cue, captionTrack, signals hình/âm, recipes, comments, heatmap, rules, schema), tỷ lệ dữ liệu lặp trước/sau đóng gói, số cue và độ dài cue trung vị; tổng hợp theo toàn bộ 70 snapshot (min/median/max).
2. Viết **bộ đánh giá cấu trúc** `scripts/eval-plans.mjs` đọc-only trên `batch-history.json` (97 job) và `sources/*/source.json`: với từng plan đã lưu tính chỉ số xác định được **không cần AI**: tỷ lệ ranh giới cắt rơi giữa câu/giữa cue liên tục (theo cue và khoảng lặng), teaser vượt/thiếu giới hạn thời lượng (`HOOK_MAX_SECONDS`, tối thiểu), tỷ lệ citation cueId hợp lệ, độ phủ main so với toàn nguồn, số gap/đuôi bị loại, tỷ lệ teaser rơi trong 10 giây rendered đầu của main, khoảng cách teaser tới đỉnh heatmap (nếu có). Xuất JSON + bảng Markdown; **không** in nội dung transcript/bình luận thật vào báo cáo (chỉ số, id rút gọn).
3. Ghi `docs/TXT-BASELINE-2026-11-04.md`: số liệu nền (kích thước TXT, chỉ số cấu trúc) + kết luận phần nào phình/lặp và phần nào thật sự mang tín hiệu.

## Giai đoạn 2 — CẢI THIỆN (phiên bản TXT v24, tương thích ngược)
Chỉ làm các mục mà số đo giai đoạn 1 ủng hộ; bỏ qua mục nào không có lợi và ghi lý do:
1. **Đơn vị câu:** gom cue thành câu có mã (`s-12`), mốc đầu/cuối, cờ "kết câu tự nhiên"/"đứt giữa câu" dựa trên dấu câu, khoảng lặng, thay đổi người nói nếu có; AI trích dẫn theo mã câu (vẫn tương thích cue-id cũ cho import). Mục tiêu: giảm cắt giữa câu.
2. **Bảng tín hiệu hợp nhất theo ô thời gian** (5–10 giây tuỳ độ dài video): mật độ lời nói, tỷ lệ im lặng, năng lượng âm, số đổi cảnh, độ nóng replay (YouTube), số bình luận trỏ vào mốc đó, có chapter/marker mô tả không. Đặt gần đầu TXT như "bản đồ" để AI định hướng trước khi đọc toàn bộ cue.
3. **Giảm lặp:** mỗi dữ liệu chỉ xuất hiện một lần (tham chiếu), tận dụng/ mở rộng khử trùng sẵn có; không cắt bớt bằng chứng. Không đưa ngưỡng tiết kiệm làm mất tín hiệu.
4. **Khai báo tín hiệu có/không theo nguồn:** YouTube thiếu heatmap/bình luận/chapters/caption gốc → ghi rõ trạng thái (không phải điểm âm); nguồn local: nêu rõ không có replay/bình luận.
5. **Ví dụ mẫu ngắn:** một cặp ví dụ tốt/xấu cho ranh giới main và cho teaser (tổng hợp, không dùng nội dung thật), đặt trong rules.
6. Tăng `WEB_AI_PROMPT_VERSION` lên v24, thêm v23 vào danh sách tương thích (`lib/prompt-versions.mjs`), cập nhật reconstruct snapshot cũ (`worker/external-prompt-snapshot.mjs`) để TXT/JSON cũ vẫn import được; giữ test prompt thủ công không còn câu text-only cũ.
7. Thêm test: sinh TXT v24 từ fixture tổng hợp, kiểm tra schema, kích thước không tăng quá ngưỡng cho trước, mọi `sentenceId`/`cueId` tham chiếu tồn tại, import JSON v23 cũ vẫn qua, v24 round-trip.

## Giai đoạn 3 — ĐO LẠI và báo cáo
- Chạy lại `measure-txt` và `eval-plans` (chỉ số TXT; chỉ số kế hoạch cũ không đổi vì plan cũ — nêu rõ điều này) và ghi `docs/TXT-RESULT-2026-11-04.md`: bảng trước–sau (byte, token ước lượng, phần lặp), danh sách thay đổi, mục bỏ qua và lý do, lệnh test + kết quả thật.
- Nêu thẳng: các số đo là **cấu trúc và kích thước**, chưa chứng minh chất lượng AI tăng. Thêm `scripts/make-paired-txt.mjs` sinh cặp TXT v23/v24 cho cùng một nguồn (từ fixture tổng hợp hoặc nguồn đã chọn) để người dùng so sánh thủ công trên ChatGPT/Gemini; ghi hướng dẫn ngắn trong báo cáo.
