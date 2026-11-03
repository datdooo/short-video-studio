Cập nhật 2026-11-04: OAuth đã được thay bằng Codex CLI; xem docs/CODEX-CLI-AUTO-PROMPT.md.

# Điều tra HOOK_MISSING_LOCAL_SPEECH_END_EVIDENCE

## Bằng chứng lượt thực tế

Operation `101c64d4-3572-4a5f-9d34-147c3a22c755`, log DEV launcher hiện có. Tổng 4 request: select-main, select-two-parts, repair-teaser Part 1, repair-teaser Part 2; cả 4 nhận HTTP 200, SSE và response.completed. Part 1 bị loại lần đầu vì HOOK_UNKNOWN_CANDIDATE_OR_CONTEXT_BOUNDS, sau repair vì HOOK_MISSING_LOCAL_SPEECH_END_EVIDENCE. Không phải lỗi model/quota/network được log chứng minh.

Output văn bản/JSON và cueIds của lựa chọn bị loại không được giữ trong log; cache selector chỉ lưu discovery và teaser cuối (unavailable khi bị loại), không lưu raw response/rejected selection. Không đọc heap/credentials hoặc phát request lại. Vì vậy chưa xác định lựa chọn cũ có cueIds rỗng, chỉ dẫn context ngoài range, hay evidenceTimes rơi ngoài cue (ví dụ tail). Không thể kết luận AI trích sai câu hoặc timestamp nguồn sai từ log này.

## Điều kiện cũ chính xác

Trong validateEditorialEvidence, chỉ khi endingBasis=speech:

1. Nếu cueIds không rỗng, resolve mỗi ID qua `cues[Number(id.slice(4))]`.
2. Nếu rỗng, tìm cue được gửi có chứa ít nhất một evidenceTime và giao start/end.
3. Throw mã cũ nếu cited rỗng HOẶC bất kỳ cited cue nào nằm hoàn toàn ngoài đoạn chọn: cue.end <= start hoặc cue.start >= end.

Các kiểm tra candidateId và cueId tồn tại/đã gửi chạy trước nhánh này. Không hề so sánh observed/quote với cue.text, không có trường quote riêng trong schema. Thông báo “trích dẫn lời nói không khớp cue” là mapping regex /SPEECH|CUE/ quá rộng. Mã cũ cũng không kiểm tra speech-end, khoảng lặng hoặc trọn nghĩa. Range permitted và duration được kiểm trước; checkHookSpeechBoundaries (word/tail) chạy sau.

## Danh tính dữ liệu

- worker/server chuẩn bị track hiện hành, truyền cùng track.cues cho cues và boundaryCues; không dùng một transcript khác để validator đối chiếu.
- hookInput/transcript, buildHookCandidates, partContextWindows và chunkTimedCues gắn cue-N theo index toàn nguồn trước filter/sort. Candidates có ID riêng candidate-N và tham chiếu global cue-N.
- compactAiInput dùng tables/string references, kiểm tra decode JSON khớp raw JSON trước khi gửi; log lượt này là roundtrip-verified. Không có bằng chứng local compact làm mất/đổi cue ID/timing/text. Điều này không chứng minh model tự decode đúng.
- Trước sửa, speechBoundaryCues và speechEndingOptions có text/timestamp nhưng không có global cue ID; suppliedCueIds cũng không tính chúng. Đây là thiếu nhất quán của contract, chưa chứng minh nó là nhánh gây lỗi cụ thể trên output cũ.
- Schema cho cueIds/evidenceTimes rỗng và instructions không phân biệt đủ rõ cue ngữ cảnh với cue nằm trong teaser. Khi AI dẫn thêm câu trước/sau để giải thích trọn nghĩa, predicate any-outside có thể loại một lựa chọn vẫn có cue thực sự nằm trong teaser.

## Sửa source

- lib/teaser-prompt.mjs: resolve source text/timing bằng global cue IDs, không ép model chép quote chính xác. Chấp nhận các cue thực sự giao range; context-only IDs đã xác minh không được tính là lời nói bên trong teaser, được bỏ khỏi cueIds lưu và nêu limitation. Nếu không còn cue bên trong thì vẫn từ chối, phân biệt thiếu citation với tất cả cue được dẫn ở ngoài range.
- Fallback không bịa speech-end: chỉ từ evidenceTimes nằm trong cue/range đã gửi, hoặc candidate ID với start/end KHỚP CHÍNH XÁC và cue IDs thực được cung cấp. Không mượn candidate text sau khi AI đổi range. Khi cueIds hợp lệ nhưng thiếu evidenceTimes, lấy citation anchor trong giao cue/range; đó không phải word-end hoặc bằng chứng câu hoàn chỉnh. Không đổi start/end hoặc observed do AI viết.
- Prompt/schema mô tả rõ global cue-N, speech phải dẫn cue giao range; text/timing lấy từ nguồn qua ID. observed/ending vẫn là nhận định AI, không phải kiểm tra chuỗi byte. complete/standalone vẫn bắt buộc. Cuối cue không chứng minh hết câu.
- lib/teaser-boundaries.mjs + declaration: speechEndingOptions mang cueId gốc trước filter/sort.
- worker/teaser-selection.mjs: speechBoundaryCues giữ global cueId, suppliedCueIds tính cả hai kênh boundary/ending. Nếu boundaryCues là track khác, không gán positional IDs của nó thành caption IDs. Nhận fields đã resolve, giữ nguyên start/end; thông báo tách thiếu citation / citation ngoài range / cue không được gửi. Diagnostic khi reject chỉ gồm mã, số lượng cue/citation và lý do; không ghi quote/output/source. Cache selector version mới cho lần người dùng chủ động chọn lại, không tự chạy lại.
- lib/teaser-import.mjs: nhận cùng fields đã resolve và thông báo lỗi tương ứng; không né source/request/range validation.

Không đổi model, reasoning, auth, schema shape, số lần retry, main ranges, manual provenance hoặc draft. Source/range/gap/duration và measured-word split/tail checks được giữ. Word-level timing không bị yêu cầu khi nguồn chỉ là subtitle cue; coarse cue chỉ xác nhận danh tính lời nguồn. Trọn câu/ý do AI đánh giá complete/ending và người dùng nghiệm thu, không có bằng chứng nghe mới được tạo.

## Giới hạn bàn giao

Chỉ đọc source/log/diff và sửa source; không gọi AI, test, lint/typecheck, build hoặc render. App DEV cố định CHƯA được cập nhật trong lượt này. Mọi thay đổi có trước được giữ. Chưa xác minh runtime hoặc chất lượng chọn teaser; chưa biết fields cụ thể của output Part 1 cũ. Lượt chạy sau do người dùng chủ động mới có diagnostic chính xác nhánh thiếu citation; không khuyến nghị Retry liên tục.

## Cập nhật package sau bàn giao

Theo yêu cầu tiếp theo, sau khi chủ dự án lưu và thoát app bình thường: đã build/package một lần thành công vào `release/dev/ShortCut Studio Dev.app`. Đối chiếu 8 module runtime theo hash source trước build; package chứa prompt/schema, validator, selector, importer và boundary citation mới. Profile DEV web5273/worker8887/existingDataRoot=null không đổi; OAuth body không gửi service_tier/max_output_tokens. Native audit/codesign guards hoàn tất. Log: /tmp/shortcut-dev-citation-build.log. Không tạo Review mới, không mở app, không chạy test/AI/render; chưa xác minh runtime.
