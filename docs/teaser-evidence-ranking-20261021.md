# Teaser: evidence, xếp hạng và quyền chỉnh tay — 2026-10-21

## Trạng thái

DEV duy nhất: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
Branch `recovery/visual-dev-reconstructed`, base `69307f4`.
Đã sửa source và rà diff; một lượt Node22 DEV package thành công (exit0),
`release/dev/ShortCut Studio Dev.app`, log
`/tmp/shortcut-dev-teaser-evidence-replay-build-20261021.log`.
App/worker đang mở vẫn phục vụ previous-build; không tự restart. Chi tiết ở đầu
`CODEX_HANDOFF.md`. Build không phải kiểm chứng runtime.
Không viết/chạy test mới, lint/typecheck, browser, render, ASR, AI hay YouTube
để kiểm chứng trong lượt này. Chất lượng biên tập/âm thanh/hiệu năng chờ người
dùng nghiệm thu. Lịch sử QA cũ không chứng minh implementation này đã đạt.

## Đường chạy ChatGPT thật trong implementation

Generate: `/auto-cut` → `createAutoCutWorkflow` → `planTeasers` →
`createTeaserSelector` → `resolveEditingProvider` → adapter OAuth hiện có
`analyzeWithChatGPTPlan` (`/responses`). Retry/Custom mô tả đi thẳng
`/teaser-hooks`, chỉ sửa part đích, không gọi lại main planner. Batch dùng cùng
selector và có checkpoint sửa teaser riêng. Không đổi auth hoặc thêm API key.

Adapter thực tế gửi `input_text` + JPEG `input_image` có timestamp, JSON schema,
`store:false`, stream. Không gửi/khẳng định nhận video/audio liên tục. Model từ
danh sách account hiện có; nếu từ chối ảnh, lượt sửa giới hạn có thể chỉ dùng
văn bản và ghi giới hạn. Đã sửa mức chặn output3000 token lệch với yêu cầu4500
của selector; `response.incomplete` có lỗi riêng và đóng reader khi xong/lỗi.
Đây là phát hiện từ code, không chứng minh nguyên nhân của lần lỗi thực tế.
Log launcher hiện có không cung cấp stack/diagnostic mới để kết luận auth,
inference hoặc chất lượng hiện đang thành công. Không gọi provider lần này.

## Dữ liệu và video dài

- Track caption hiệu lực duy nhất: bản chỉnh hiện tại → track plan → caption
  nguồn; chỉ không có track mới dựng cue ước lượng từ transcript. Gắn provenance
  `word/cue/estimated`; không thay cue thật bằng end dòng transcript kế tiếp.
- Gửi metadata/title/description/tags/chapters, main ranges đúng part, yêu cầu
  người dùng, transcript/cues gốc và văn bản transcript hiện hành riêng; comments
  đã thu thập (tối đa200), mentions/clusters/counters, replay bins và nguồn tín
  hiệu; scene/audio/silence và trạng thái thiếu/lỗi/không có dữ liệu.
- `collectTeaserEvidence`: payload nguồn <=120000 ký tự gửi đầy đủ. Đây là
  giới hạn ký tự, không phải cam kết số token model. Dữ liệu vượt ngưỡng có
  catalog tối đa48 vùng phủ toàn bộ cue, gồm cuối nguồn, cue refs và mẫu trích
  nguyên văn; công khai compact/coverage. Raw evidence giữ ở worker cho lượt chốt.
- Video dài: tối đa1 lượt tìm tối đa4 vùng (mỗi vùng <=30 giây nguồn), sau đó
  lấy lại cue gốc quanh vùng ±10s và ảnh cục bộ để xếp hạng/chốt. Video nhỏ đủ
  evidence có thể chốt một lượt. Tối đa2 request/part kể cả repair; không có vòng
  lặp vô hạn. Nếu discovery hỏng, lượt cuối dùng candidates khác và dữ liệu gốc
  sẵn có, không giả discovery thành công. Lượt chốt chỉ chấp nhận cue đã thực
  sự đưa vào input, không lấy cue ID chỉ có trong catalog range làm bằng chứng.
- Tối đa48 ảnh tĩnh/part qua cả hai lượt,512×288 fit, có timeout và xóa JPEG
  tạm. Không chuyển mã toàn video hoặc thêm decoder/UI loop. Ảnh thưa không
  chứng minh hoàn tất hành động; lời nói đủ căn cứ không bắt buộc có ảnh.
- Các giới hạn thu thập hiện có vẫn giữ: transcript text đầu vào100000 ký tự,
  caption track tối đa20000 cue, metadata/comments theo SourceContext. Catalog
  không khôi phục dữ liệu chưa thu thập; không tuyên bố có toàn bộ lời nói nếu
  nguồn/caption provider không cung cấp. Dữ liệu thiếu không phải điểm âm.

## Replay được dùng thực sự

`alignReplayToSource` port từ MR.HiSum đặt bins đã chuẩn hóa vào thời gian nguồn,
tối đa4096 sample; gap là null. `replayRegionsForRanges` giới hạn main/permitted
ranges **trước** gom đỉnh; không để đỉnh part khác hoặc gap che vùng hợp lệ.
Gom bins liên tiếp, tách tại valley tương đối/gap, suppression trước topK; tối
đa6 đỉnh đi qua suppression và tối đa3 đề xuất replay riêng trong12 candidates.
Đây là phân bổ ngân sách tìm kiếm, không phải công thức điểm biên tập.

GPT nhận bin/đỉnh/time/intensity tương đối, thứ hạng và maximum trong part,
cùng cue quanh đỉnh. Đề xuất replay có cửa sổ riêng kể cả không có transcript.
Khi hấp dẫn/liên quan/trọn nghĩa tương đương, prompt ưu tiên rõ replay mạnh.
Nội dung đặc biệt hơn vẫn được thắng nhưng AI phải giải thích cụ thể tiếng Việt.
Không cộng comments/replay tương quan thành hai phiếu; không có trọng số cố định.

`heatmapEvidence.available/supportsSelection/peakTimes/reason` ghi dữ liệu sẵn
có, việc model nhận dùng replay, bin đỉnh giao đoạn chọn, rank/intensity trong
main và giới hạn. Áp dụng cả `source-range` ngoài candidate IDs. Intensity không
phải retention, viewer count hay xác suất. Chọn alternative đã lưu giữ lý do AI,
ghi chưa tính lại replay; không giả đã phân tích lại. Thiếu heatmap vẫn chọn
bằng bằng chứng khác. Không tuyên bố đã đo replay cải thiện chất lượng.

## Xếp hạng, validation và trạng thái

- Prompt/cache `same-part-hook-v11-replay-ranking`; GPT hiểu diễn biến part,
  so sánh lời nói/hành động, chọn winner + tối đa2 phương án khác biệt, được đề
  xuất ngoài candidates trong permitted ranges. Không có ngưỡng keyword/độ to/
  “đủ sốc” phủ quyết winner; quiet part vẫn chọn tốt nhất tương đối có căn cứ.
- Winner/alternatives được kiểm tra độc lập; alternative lỗi không loại winner.
  Winner sai kỹ thuật dùng phương án GPT xếp tiếp, rồi tối đa lượt repair còn
  lại với reject code cụ thể/permitted ranges. Không dùng heuristic làm winner.
- Giữ <=9 giây export (=11.25 giây nguồn ở1.25×), AI tránh10 giây export đầu
  main, không bắc qua gap/padding/part khác. GPT đánh giá trọn câu/ý; word timing
  đo thật mới có thể chứng minh split/tail. Không coi cue thô là word alignment.
- Mốc tay: provenance `manual/user`, giữ chính xác mốc; cue/meaning/tail chỉ
  cảnh báo, không chặn Apply/readiness/API/render/queue/resume. Giữ technical
  source/range/duration checks; manual được chọn đầu main. Sửa mốc AI lưu
  `editedFrom`, không gắn manual cho kết quả mô tả GPT hoặc Gemini/Muse.
- Raw Custom Teaser draft theo source/part, textarea không format/trim khi gõ,
  DOM không bị plan/cue rerender ghi đè lúc focus/composition. Enter composition
  không submit; chỉ nút gọi lựa chọn. Abort/revision chặn response cũ. Chưa thử
  IME thật; state draft vẫn dùng autosave hiện có.
- Lý do, hiểu part, quan sát, quan hệ, ending và limitations yêu cầu tiếng Việt
  cùng lượt chọn. Quote giữ lời gốc + nghĩa Việt trong giải thích; không dịch
  subtitle/title/hashtag. Legacy explanation được giữ, không tự dịch qua API.
- Cache/binding gồm source fingerprint, ranges, caption timing/text, transcript,
  instruction/custom request, metadata/comments/replay/local signals, provider/
  model/prompt. Style/music không tham gia. Ràng buộc được kiểm tra lại ở UI,
  import, submission, batch/resume/execution. Local scene/audio không bị cache
  metadata YouTube thay mất khi enrichment. Kết quả cũ không tự sửa snapshot.
- Auth/quota/model/timeout/JSON incomplete/schema/boundary/evidence có thông báo
  riêng; main được giữ. Retry Part1 không bị teaser cũ của Part2 chặn ở boundary
  có thể chỉnh, nhưng xuất vẫn kiểm tra mọi part đang bật.

## Reuse và giới hạn

Chi tiết repo/commit/file/phần sửa: `THIRD_PARTY_NOTICES.md`.
MR.HiSum: **Được tác giả cấp phép riêng để tái sử dụng toàn bộ project, theo
xác nhận của chủ dự án.** Attribution Jinhwan Sul, Jihoon Han, Joonseok Lee và
link repo chỉ ở notices/repo; không credit UI/video/metadata. Public license
upstream không được tuyên bố đã thay đổi. Không đưa trao đổi riêng vào repo.
MomentSearch: Apache-2.0, port `chunk_cues`; giữ LICENSE/NOTICE.
VideoITG: chỉ học luồng coarse→fine, không copy code/weights. Không thêm Python,
GPU/model/vectorDB/framework, dependency hay model download.

Người dùng tự thử: Generate nguồn có/không replay → đọc so sánh replay của từng
part; Retry một part khi part kia thiếu teaser; nhập mốc tay trong cue → Apply;
gõ Telex/VNI → đổi part/reload; chỉnh caption/main/request → báo stale; đổi style
không phân tích lại. Đây là checklist chờ nghiệm thu, không phải QA đã chạy.
