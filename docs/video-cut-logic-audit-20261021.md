# Rà soát logic cắt video — 2026-10-21

## Phạm vi và bằng chứng

- DEV: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev`.
- Branch `recovery/visual-dev-reconstructed`; HEAD `87c3135c5ff176028f378c9f1d32833569e6c75c`.
- Rà **source local có sửa chưa commit**, gồm framing/UI và manual teaser/bật-tắt
  mới nhất, không coi GitHub/HEAD là toàn bộ implementation hiện tại.
- Đọc source-loading/SourceContext, main planner, locks/Smart Cut/start trim,
  Timeline/draft/timecode, Auto/custom/external teaser, preview decks, subtitle,
  nhạc/ducking, range input/FFmpeg, resource gate, render/batch/resume/snapshots.
- Chỉ rà tĩnh và đối chiếu tài liệu. Không chạy test, chương trình mô phỏng,
  browser, render, benchmark, ASR, AI/YouTube, rebuild hoặc restart app/worker.
  Chỉ thêm báo cáo này; không sửa implementation hoặc dữ liệu người dùng.
- Báo cáo render/timing/UI cũ dưới `.isolation-verification/adaptive-teaser/`
  và `teaser-resume-20261019/`, cùng `docs/render-resource-fix.md`, không chứng
  minh chất lượng/hiệu năng của source mới. Không có số đo RSS/swap/stack crash
  hiện tại để kết luận máy còn lag hay đã hết lag.

P1: nên sửa trước khi coi luồng cắt đáng tin cậy. P2: sửa tiếp theo; phụ thuộc
đường thao tác/loại nguồn. “Xác định từ code” không có nghĩa đã tái hiện runtime.

## Các lỗi/mâu thuẫn xác định được từ code

### F1 — P1 — Retry/Generate có thể bị teaser hỏng của part khác chặn

`app/page.tsx:1254` chỉ bỏ teaser/custom của part đang Retry. Worker gọi
`validatePlan(body.plan, source)` trước khi vào nhánh `/teaser-hooks`
(`worker/server.mjs:1848`); hàm này validate teaser của **cả hai part**
(`worker/plan-validation.mjs:46`). Generate lại với `currentPlan` cũng đi qua
validation này ở `worker/server.mjs:775`.

**Điều kiện:** plan cũ có hai teaser selected không còn hợp lệ (ví dụ overlap
đầu main theo policy AI hoặc range đã đổi). Retry Part1 bị Part2 chặn và ngược
lại; Generate chưa tới bước sửa cũng bị từ chối. Teaser unavailable đúng schema
không gây lỗi này. Tắt teaser kia hoặc chọn tay có thể tránh nhưng không phải
luồng sửa lỗi hợp lý.

**Khắc phục:** tách validation plan có thể chỉnh/phân tích khỏi validation xuất.
Request sửa teaser kiểm tra source/main/locks/schema và part mục tiêu; cho giữ
teaser cũ cần sửa ở part khác. Kết quả mới phải validate đầy đủ trước Apply;
Render/batch vẫn chỉ chấp nhận teaser hợp lệ ở các part đang bật.

### F2 — P1 — Cue dựng từ transcript có thể làm điều kiện hết câu vô nghiệm

`worker/server.mjs:797,817` gán end của dòng transcript bằng start dòng kế.
Ngay cả khi có captions chính xác, transcript không rỗng vẫn thay thế cue dùng
đề xuất; bản text VTT còn bỏ phần lẻ giây (`compactTimestamp`, dòng929).
`lib/teaser-boundaries.mjs:28–35` cấm cắt trong cue, yêu cầu end sau cue cuối
ít nhất80ms và trước cue tiếp ít nhất20ms.

**Ví dụ suy luận, không phải test đã chạy:** các cue liên tiếp20–25,25–30.
Muốn kết ở cue đầu phải end>=25.08 nhưng đồng thời end<=24.98. Dữ liệu này
không đo thời điểm hết lời, nhưng lại được dùng như timestamp lời nói chính xác.
Khi không có boundary track chính xác, các lựa chọn speech có thể bị loại hết.
Khi có track chính xác, đề xuất bằng cue thô vẫn có thể xung đột với validator.

**Khắc phục:** giữ nguyên timestamp caption/ASR chính xác; tách text người dùng
sửa khỏi timing. Gắn provenance/độ hạt cho boundary evidence; không coi interval
ước lượng từ dòng kế là word alignment. AI vẫn phải có kết thúc trọn nghĩa;
thiếu bằng chứng thì báo đúng giới hạn và hỗ trợ chọn tay, không tự kéo/cắt end.
Biên nhập tay có rủi ro từ cue thô nên cảnh báo rõ thay vì nhận định chắc chắn
đã cắt một từ. Tail chỉ xác nhận khi thật sự biết hết lời và chưa sang câu sau.

### F3 — P1 — Manual cut trong Nâng cao vẫn mất1 giây đầu

`lib/edit-plan.ts:195` tạo manual plan không có `startTrimApplied`;
normalizePlan cố ý không trim provider manual (dòng129), nhưng
`app/page.tsx:547` trim tất cả part. Render boundary cũng map `trimPartStart`
không phân biệt manual (`worker/server.mjs:1518`).

**Điều kiện:** nhập60–70 trong Manual cut mới sẽ thành61–70 khi dựng effective
plan. Timeline sửa trực tiếp qua `applyMainRanges` đã đặt hai applied flags,
nên **không phải mọi mốc chỉnh tay đều bị cộng1 giây**.

**Khắc phục:** manual ranges mới phải được đánh dấu là explicit/exact và bỏ qua
start trim/Smart Cut từ lúc tạo. Duy trì quy tắc1 giây lịch sử cho đúng đường AI
còn cần nó, áp dụng một lần; không chuyển nghiệp vụ này sang timestamp UI.

### F4 — P1 — Resume batch kiểm tra điều kiện render trước khi được phân tích lại

`worker/batch-pipeline.mjs:31–32` giữ plan fallback, đặt `needsAnalysis=true`
khi auth/quota/model lỗi. Nhưng route resume gọi `validateRenderPlan` cho plan
đó trước (`worker/server.mjs:1942`), rồi queue lại gọi `requireBothTeasers`
(`worker/batch-queue.mjs:53`). Nếu teaser đang bật còn thiếu, resume không đến
được bước analyze dù người dùng đã sửa đăng nhập/quota.

**Khắc phục:** phân nhánh resume theo checkpoint. `needsAnalysis` chỉ cần source,
settings và main locks hợp lệ để tiếp tục phân tích. Chỉ kiểm tra đầy đủ teaser
ngay trước render-ready/submission. Không nới validation của job thực sự xuất;
không chạy lại main của item đã có plan được duyệt nếu chỉ thiếu teaser.

### F5 — P1 — Caption và kiểm tra biên có nhiều nguồn sự thật

- Preview ưu tiên `previewPlan.captionCues` trước `sourceCaptions`
  (`app/page.tsx:564,569`).
- Tạo lại/sửa phụ đề chỉ cập nhật `sourceCaptions` (dòng1303,2127).
- Render payload ưu tiên sourceCaptions mới (dòng1590).
- Worker kiểm tra teaser lại ưu tiên captions gốc YouTube trước captionCues
  đã chọn (`worker/plan-validation.mjs:55`), trong khi hook selection ưu tiên
  captionCues của plan (`worker/server.mjs:809`).

**Điều kiện:** plan đã chứa captionCues, sau đó đổi sang Whisper hoặc sửa subtitle.
Preview có thể còn chữ/timing cũ nhưng xuất dùng bản mới; teaser qua kiểm tra ở
editor có thể bị worker từ chối bằng một track khác. Không phải chỉ lỗi styling.

**Khắc phục:** một helper giải quyết effective caption track có source binding và
revision, dùng cho preview, snapshot và export. Text chỉnh tay phải hiện ngay
trong preview. Boundary evidence gốc có thể tách riêng, nhưng phải có quy tắc
provenance rõ và dùng cùng một quy tắc ở selection/manual/render validation.

### F6 — P2 — Ngưỡng EOF khác nhau giữa các tầng

Worker plan validation cho main end vượt source0.5s (`plan-validation.mjs:30`);
UI Render cho0.05s (`app/page.tsx:1582`); range input chỉ cho0.001s
(`worker/range-input.mjs:12`). Một plan được API nhận vẫn có thể thất bại ở
chuẩn bị range. UI Timeline chuẩn lại không cho vượt source.

**Khắc phục:** chung hợp đồng numeric/finite/range/EOF và giới hạn số segment.
Không âm thầm cắt lại timestamp. Nếu provider có sai số EOF được chấp nhận,
chuẩn hóa một lần có thông báo ở import boundary; downstream dùng bản chuẩn.
Giữ cho kiểm tra sớm và render thực tế chấp nhận cùng một tập dữ liệu.

### F7 — P2 — Freshness teaser chưa được cưỡng chế đồng nhất ở worker

UI kiểm tra `externalHooksCurrent` cho Gemini/Muse (`app/page.tsx:1240`);
worker kiểm tra tại batch `/items/.../plan` (server1953) nhưng submit render
và resume chủ yếu chỉ dùng `validateRenderPlan` (1517,1583). `validateTeaser`
kiểm tra hình dạng inputKey/ranges, không so inputKey với input hiện tại.
Đường GPT cũng không có đối chiếu input selection hiện tại tại render boundary.

**Ảnh hưởng:** gọi API trực tiếp/resume không có cùng bảo đảm freshness như UI;
cue/source context đổi nhưng range còn vừa không tự chứng minh lựa chọn AI còn
đúng dữ liệu. Không kết luận mọi UI export đang dùng teaser cũ.

**Khắc phục:** lưu selection-input identity có source fingerprint, main ranges,
caption/evidence revision, provider/model và prompt version; dùng chung helper
kiểm tra freshness ở snapshot/export/import/resume. Style không tham gia key;
manual timestamp dùng validation riêng và không giả provenance AI. Snapshot cũ
không bị tự sửa; nếu không đủ dữ kiện xác nhận thì báo cần reselection rõ ràng.

### F8 — P2 — Most Replayed đang lấy top bins trước khi tách đỉnh

`lib/teaser-candidates.mjs:27` sort intensity rồi lấy6 bin cao nhất; sau đó mới
suppression và giữ tối đa3 replay proposals (dòng65). Một plateau gồm6 bin gần
nhau có thể chiếm hết quota, để cuối cùng chỉ còn1 ứng viên và bỏ các đỉnh xa
khác. Đây là giới hạn tìm ứng viên, không phải GPT cố ý chọn đoạn nhạt.

**Khắc phục:** gom vùng replay liên tiếp/tìm local maxima, suppression theo thời
gian trước khi lấy topK; tiếp tục lấy các đỉnh khác nếu bị trùng. GPT vẫn so
semantic/action/relevance/ending, không chọn theo intensity đơn thuần. Không
cộng đúp comment/replay.

### F9 — P1 — File MP4 dở làm Cancel → Resume không chạy tiếp được

`executeRender` đưa tên MP4 đích trực tiếp vào `renderPart`
(`worker/server.mjs:1468–1476`). Chỉ sau khi FFmpeg thành công mới thêm output
record (1483–1491). Hủy/lỗi không dọn hoặc chuyển tên MP4 đã ghi dở (1496–1499).
Khi Resume, file không có record hợp lệ bị `verifiedRenderOutput` trả null;
guard `existingOutput` (1462) lại từ chối vì file đã tồn tại.

**Điều kiện:** hủy/lỗi sau khi FFmpeg đã tạo MP4 của part đang chạy. Part hoàn
thành trước đó vẫn có thể reuse; part bị hủy thì kẹt. Hủy trước khi tạo file
không gặp nhánh này. Cơ chế bảo vệ export cũ là đúng nhưng đang áp cả lên file
dở do chính job hiện tại tạo.

**Khắc phục:** output staging riêng có job/part ownership, ví dụ tên kết thúc
`.partial.mp4`; chỉ atomic rename sang tên cuối khi FFmpeg thành công và hoàn
tất kiểm tra cần thiết. Giữ bản ghi trạng thái publish để phục hồi sau crash.
Resume chỉ dọn/restart scratch được chứng minh thuộc job, không ghi đè/xóa bất
kỳ MP4 đã publish, export cũ hoặc file không rõ nguồn gốc. Không tự chạy lại
render trong lượt audit này.

## Rủi ro riêng cần kiểm chứng runtime sau khi người dùng cho phép

### R1 — Preview không bao phủ đủ trạng thái decode/seek/EOF

`lib/preview-decks.mjs:50–58` có warming/seeked/canplay cho standby, nhưng không
có state machine đầy đủ cho active waiting/stalled/error/ended. Seek báo
`onBuffer(false)` ngay cả khi active video còn seeking. `app/page.tsx:1972–73`
bỏ qua pause/ended native khi đã có plan.

Đã có pause BGM khi **pending handoff** qua `previewBuffering` (MusicPanel dòng2158),
nên không báo nhầm rằng nhánh handoff này thiếu hoàn toàn đồng bộ. Tuy vậy,
seek/stall active chưa được bao phủ tương đương. EOF sớm hơn main end có thể
không đạt ngưỡng2ms của tick. `ready` cho standby còn dùng tolerance50ms, lớn
hơn một frame30fps. Chưa đo xem trường hợp nào gây khựng/lệch tiếng thực tế.

**Đề xuất:** mở rộng controller hai deck hiện tại với waiting/seeking/playing/
ended/error có ownership/epoch; pause/resync mix theo buffer thực và không tự
play sau pause. Chỉ dùng frame callback khi cần để xác nhận frame sẵn sàng,
cleanup đầy đủ. Không thêm decoder/player hoặc chèn frame đứng để giấu lỗi.

### R2 — Nguồn có SAR/rotation hoặc hai stream kết thúc khác nhau

`probeMedia` (server891) không lấy SAR/display matrix/start_time/duration từng
stream; graph đặt `setsar=1` trước `foregroundFilter` vốn còn định dùng SAR
(1293). Nguồn pixel không vuông có thể sai DAR/framing so với browser. SAR mất
trong graph là vấn đề xác định; tác động lên fixture thực chưa được đo. Rotation
và EOF khác nhau cần khảo sát riêng, không suy đoán một lỗi duy nhất.

PCM strict-size ở `range-input.mjs:28–29` sẽ từ chối range nếu audio thiếu sample,
kể cả một file có video dài hơn audio; không được gọi mọi file như vậy là hỏng.

**Đề xuất:** probe display geometry và từng stream, bảo toàn DAR trước khi square-
pixel scale; thống nhất geometry/mask. Kiểm tra đầu/cuối stream sớm, báo đúng
nguồn không đồng độ dài. Không tự đổi cut, kéo video hoặc padding giả khi chưa
có policy người dùng chấp nhận.

### R3 — Chưa thể kết luận render hết lag hoặc mọi cut frame-perfect

Graph hiện tại đã bỏ fan-out/interleave cũ: FFconcat packet demux tuần tự,
`select=concatdec_select`, một video decoder; PCM join theo range; shared heavy
lease, giới hạn thread, serial export và OS priority có trong code. Không đề xuất
quay lại trim nhiều nhánh từ một input hoặc thay toàn renderer.

Nguồn long-GOP/B-frame/VFR/nonzero timestamps vẫn cần kiểm tra frame/PTS thực.
FFmpeg nêu rõ inpoint/outpoint có thể sinh packet ngoài range với non-intra
codecs; select theo concat metadata là biện pháp hiện có, không phải bằng chứng
tự động rằng MP4 hiện tại không mất/lặp frame. Peak RAM/swap chưa được đo.
Title/subtitle PNG và ffconcat phụ trợ được ghi vào thư mục part output và không
có cleanup tương đương rangeInput.dispose; cần cân nhắc dọn đúng scratch đã sở
hữu sau success/cancel, không xóa MP4 hoặc dữ liệu resume cần thiết.

## Phần đang có cơ chế đúng, nên giữ

- `segments` là dữ liệu main chung; chỉnh Timeline không tự lấp gap, padding tách
  riêng; draft thiếu/lỗi chưa đưa vào effective plan. Mốc AI chưa sửa giữ exact
  value riêng, timecode30fps là projection hiển thị.
- Shared `presentationSegments` dùng cho teaser repetition, subtitle, BGM/ducking
  và render. Preview rate1 và export1.25 tách riêng. Teaser max9 export giây;
  AI loại10 export giây đầu main theo presentation qua gaps; manual mới được
  phép chọn đầu main. Per-part off lưu boolean và bỏ teaser/Hook→Main, không xóa
  lựa chọn/draft. Các bảo đảm này được thấy từ code, chưa phải nghiệm thu runtime.
- Auto selector không tự biến heuristic thành GPT; retries tối đa2/part, giữ
  unavailable rõ ràng. Heatmap thực sự vào candidate generation.
- `snapshotPlanVisualStyle` structuredClone plan; batch giữ settings/plan riêng;
  queue/export serial và cancel theo process group của job. Shared request
  cancellation đã có subscriber counting, không lặp lại cảnh báo lịch sử rằng
  mọi request dùng chung bị hủy cùng nhau.
- Transition nằm trước background/title/subtitle composition; clean metadata
  flags ở output scope; chất lượng FHD/30fps/VT16M hoặc CRF17/AAC192k giữ nguyên.

## Thứ tự khắc phục đề xuất

1. **Checkpoint validation/caption:** F1,F2,F4,F5 — tách điều kiện sửa/chọn/xuất,
   thống nhất cue timing/provenance và effective caption; gỡ vòng bế tắc Retry.
2. **Checkpoint exact main / recovery:** F3,F6,F9; chốt một effective range pipeline idempotent
   trước preview/snapshot, không Smart Cut lại sau submit. Hiện đường legacy/API
   vẫn có `enqueueRender` Smart Cut cho part thiếu flag (server1564), khác đường
   editor tự gắn flag đã xử lý (page547). Chuẩn hóa compatibility một lần, công
   khai bước nào có thể đổi mốc; không sửa snapshot đã gửi.
3. **Checkpoint evidence/freshness:** F7,F8; phân bổ bằng chứng quanh candidate
   thay vì chỉ nhiều ảnh toàn video; không hứa tìm “sốc nhất” từ tối đa12 proposals,
  48 ảnh tĩnh và context đã lấy mẫu. Thiếu hành động liên tục phải ghi rõ.
4. **Checkpoint playback/resources:** R1–R3, dùng engine/deck/resource gate sẵn
   có. Khi được phép mới kiểm chứng bằng fixture nhỏ và video người dùng chọn;
   không tự chạy campaign hoặc package/render chỉ để hoàn thành báo cáo.

## Nguồn kỹ thuật đối chiếu

- [FFmpeg concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat): giới hạn
  inpoint/outpoint và packet timestamps đối với inter-frame codecs.
- [FFmpeg select / concatdec_select](https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect):
  chọn frame bằng metadata interval của concat demuxer.
- [FFmpeg setsar](https://ffmpeg.org/ffmpeg-filters.html#setdar_002c-setsar): đổi SAR
  làm đổi DAR; không đồng nghĩa đã rescale pixel đúng tỷ lệ hiển thị.

Chỉ tham khảo tài liệu chính thức, không thêm dependency/copy code. Đây là báo
cáo và phương án sửa; **chưa triển khai các phương án trên** và không tuyên bố QA pass.
