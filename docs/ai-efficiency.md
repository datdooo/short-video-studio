# Latest owner request: GPT-6 Luna + Faster (source only)

2026-10-21: fixed gpt-6-luna, reasoning.effort=none (lowest documented;
Light is not a literal API effort). Owner subsequently explicitly requested Faster.
Native OAuth adapter actually targets api.openai.com/v1/responses; requests now
explicitly send service_tier=fast, including repair/retry. Legacy Responses route
aligned. No extra API key, paid-provider switch or auth changes.

Fast rejection is classified FAST_MODE_UNSUPPORTED without silent tier/model
fallback. Request diagnostics distinguish requested tier from response.service_tier
(actual fast/priority, downgrade default, or unconfirmed when absent). No provider
call has verified account entitlement, actual tier, quota or speed. Cache hits
remain reusable; Fast alone does not change source evidence or editorial identity.

Official model/Responses Fast docs confirm the parameter; they do not establish
this user's OAuth plan access. API Fast rates are2x applicable Standard rates;
this is NOT a measured ChatGPT5h-quota multiplier or guarantee of faster completion.
https://developers.openai.com/api/docs/models/gpt-6-luna
https://developers.openai.com/api/docs/guides/fast-mode

Owner says WAIT before packaging; current source newer than last built app.
Earlier no-Fast statements below are historical and superseded by this section.

---

# Reasoning thấp nhất và giới hạn lượt AI — 2026-10-21

## Model được chủ dự án chốt mới: GPT-6 Luna

Native app pin `ANALYSIS_MODEL='gpt-6-luna'` tại lib/ai-reasoning.mjs, dùng cho
main/source analysis, teaser/Custom/Retry/repair và legacy OpenAI route. Không còn
chọn theo phần tử đầu models endpoint hoặc OPENAI_MODEL ở route legacy. Gemini/
Muse web do người dùng chọn rõ vẫn giữ nguyên. Cache identity đã chứa model và
reasoning nên không gắn nhãn lại kết quả Sol thành Luna; plan/history/job cũ giữ.

Theo [model page chính thức](https://developers.openai.com/api/docs/models/gpt-6-luna),
reasoning thấp nhất là none; mọi request app gửi reasoning.effort=none rõ ràng.
Không coi Light/Faster là tên giá trị API; không thêm service_tier/fast/pro mode
hoặc gói trả phí. User intent là pin model nên không gọi /models chỉ để chọn tên
trong mỗi Generate; auth vẫn được kiểm tra bằng adapter hiện có tại request thật.
Model/capability bị từ chối thì báo đúng lỗi, không tự chuyển model hay effort.
Usage/model/effort thực tế chỉ xác nhận khi response thật trả về. Chưa gọi inference
Luna trong lượt sửa này, chưa xác minh account có dùng được hoặc đo quota/tốc độ.
Không thêm API key/auth mới hoặc giảm dữ liệu/tiêu chí. Các ghi chú giữ model
gpt-6.1-sol/low bên dưới là lịch sử trước quyết định mới này.

## Sửa sau lượt112,163 giây (chưa chạy inference mới)

Log thật: main cache hit; discovery chung46,323s, repair Part1 29,064s,
final Part2 27,903s; tổng229879 input/2798 output tokens, cached_tokens0.
Part1 bị gán HOOK_DISCOVERY_SCHEMA_INVALID cho mọi lỗi discovery, kể cả range.
Không còn raw response trong log nên không thể kết luận subtype thật của lượt
này. Code xác nhận ba nguồn lãng phí: duplicate fields/text, raw character
threshold ép discovery dù representation gọn có thể đủ, và bất kỳ lỗi discovery
của một part khiến cả bước chốt phải tách thành hai request riêng.

Implementation mới:
- worker/ai-input.mjs dùng JSON columns/rows cho uniform record arrays và bảng
  strings cho chuỗi lặp chính xác. Toàn bộ giá trị, thứ tự, số/timestamp và văn bản
  giữ nguyên; kiểm tra decode→JSON bằng raw serialization trong production trước
  khi gửi. Nếu collision tên marker, không nhỏ hơn hoặc không roundtrip thì gửi
  JSON gốc. Không phải semantic summary, không bỏ evidence, không đổi output schema.
  Main và mọi native teaser/repair dùng cùng encoder. Ghi raw/sent characters và
  inputFormat; đây là ký tự, không phải ước lượng token hoặc quota.
- Nếu toàn bộ input+evidence gốc sau encoding nằm trong120000 ký tự hiện có,
  bỏ discovery và gửi đủ dữ liệu trong một pass. Caches thành công không bị
  invalidated chỉ vì thay representation: identity đã chứa hash evidence đầy đủ.
  Không cam kết video13phút luôn đủ một pass hoặc mọi Generate chỉ có2request.
- Discovery mới trả inspection intervalId+anchorTime, không phải biên cut.
  Local tạo vùng xem kỹ <=30s trong đúng interval; final teaser vẫn do ChatGPT
  trả timestamp và chịu nguyên validation9s/đúngmain/đầu10s/trọný. Không snap mốc
  teaser AI/manual. Frame refinement có ảnh tại anchor, vẫn tối đa6/vùng48/part.
- inspectDiscovery giữ các vùng AI hợp lệ theo thứ tự, loại riêng vùng sai; chỉ
  lỗi khi không còn vùng hợp lệ. Cache start/end schema cũ vẫn đọc được. Phân biệt
  sai wrapper, sai schema, sai range và anchor ngoài interval; không gom generic.
- Một discovery part lỗi (schema/range) không làm bỏ final chung: cùng request
  final nhận rejection+permitted intervals+original neighborhood/unranked proposals
  của đúng part đó. ChatGPT vẫn chọn, local không làm winner. Provider auth/quota/
  timeout vẫn dừng, không repair vô hạn. Hai cơ hội/part và một winner/part giữ nguyên.
- lib/render-delete + worker artifact guard: xóa Part/nhómPart kiểm tra đúng job,
  không chặn do source ASR/BGM/render job khác. Xóa nguồn vẫn giữ guard source rộng.
  Polling lỗi tách mutation lỗi để không xóa thông báo DELETE sau1.2s.
- Khung Nâng cao chỉ là CSS cho content đang mở, giữ button/secondary Yêu cầu AI.

Tham khảo [OpenAI latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization)
và [TOON](https://github.com/toon-format/toon),
[spec uniform tables](https://github.com/toon-format/spec/blob/main/SPEC.md).
Chỉ học ý tưởng representation cột dùng chung; encoder tự viết bằng JSON, không
copy code/spec text, không triển khai hoặc tuyên bố TOON compatibility, không
thêm SDK/model/vector DB/framework/dependency. Giữ các attribution cũ nguyên vẹn.
Không dùng benchmark upstream để khẳng định mức tiết kiệm của app.

Chỉ rà source/diff, không tests/AI/render/ASR/YouTube/browser QA. Mức High người
dùng cấp cho Codex độc lập AI app: adapter/model/reasoning low không bị nâng.
Chưa có token/quota/latency/chất lượng sau sửa; build không thay thế nghiệm thu.

## Follow-up từ lượt thật 249,5 giây

Đọc log DEV có sẵn, không chạy inference mới: 1 main + discovery/final mỗi
part = 5 request, không phải bốn lần repair. Model gpt-6.1-sol xác nhận low cả5.
281389 input tokens,6557 output tokens,274 reasoning tokens, cached_tokens=0.
Tổng chờ/đọc provider khoảng230,7s; lấy frame khoảng15,5s. Không quy đổi những
token này thành tỷ lệ quota;6% là quan sát của người dùng, không phải số API trả.

Đã sửa source:
- Cả nhánh catalog dài có thể discovery chung hai part, rồi final chung hai part:
  main1 + discovery1 + final1 =3 request nếu đủ điều kiện và hợp lệ ngay. Nhánh
  một pass vẫn main1+final1=2. Không hứa mọi Generate chỉ3 request: cache, locks,
  Custom, lỗi/schema và số part thực tế vẫn quyết định nhánh chạy.
- Recursive factoring các trường videoEvidence giống hệt nhau, gồm cả các
  trường con replay/comments/audio/transcript. Dữ liệu đầy đủ được tái dựng bằng
  recursive merge sharedVideoEvidence+part.videoEvidence; không cắt transcript,
  giảm coverage/frame hay bỏ dữ liệu để đạt số token thấp hơn.
- Theo yêu cầu mới, native Auto/Retry/Custom chỉ trả1 winner/part, alternatives=[];
  schema request ép maxItems0. Output ceiling2500 riêng /5000 hai part thay4500/
  9000; lời giải thích vẫn có đủ trường, ngắn bằng tiếng Việt. So sánh nhiều
  khoảnh khắc vẫn giữ; saved/external schema và ứng viên lịch sử không bị xóa.
- Giữ tối đa2 cơ hội gọi/part. Discovery chung tính là1 cơ hội của mỗi part tham
  gia, final chung tính là1; không thêm repair thứ3 sau đó. Repair riêng chỉ xử
  lý part lỗi khi còn budget; không gọi lại main hoặc nâng effort/model.
- Discovery/final không bị gắn nhãn retry oan. Request metrics mới ghi phase,
  serialized input characters, image count, part count cùng usage/thời gian;
  UI Chi tiết lượt AI hiển thị các thống kê này, không payload riêng tư.
- Yêu cầu AI trong Nâng cao đổi thành hàng phụ nền trong suốt/nhẹ; nút Nâng cao
  giữ nguyên. Không đổi state, input, payload hay remount.

Các mô tả request tối đa/alternative9000 bên dưới là trạng thái trước follow-up
này. Tham khảo official OpenAI latency optimization (chỉ đọc, không copy code):
https://developers.openai.com/api/docs/guides/latency-optimization
Chưa đo trước/sau hoặc xác minh chất lượng bằng video thật. Không hứa mức giảm
quota hoặc thời gian. Trạng thái app/build cập nhật ở CODEX_HANDOFF.md.

DEV branch `recovery/visual-dev-reconstructed`, base
`0621d442435847c92ab200e10fabb86561c882b7`. Source/diff review only; không gọi
provider, YouTube, ASR, render/benchmark, tests/lint/typecheck hoặc browser QA.
Build không phải bằng chứng inference/chất lượng/tiết kiệm quota.

## Adapter và reasoning

Kết nối hiện có dùng OAuth plan usage với `https://api.openai.com/v1/responses`,
SSE và structured JSON; không phải tự động hóa web ChatGPT. Không thêm API key,
đổi auth hoặc model. Auto giữ nguyên cách lấy model đầu tiên phù hợp từ models
endpoint. Một Generate memoize cùng provider/model metadata cho main và teaser;
retry không resolve sang model khác hoặc nâng reasoning.

`lib/ai-reasoning.mjs` đọc giá trị API trong `supported_reasoning_efforts` /
`reasoning_efforts` / `reasoning.supported_efforts` nếu có; không ánh xạ label
“Light”. Nếu metadata không cung cấp, catalog Responses được đối chiếu với tài
liệu chính thức bên dưới. Thứ tự: none → minimal → low → medium → high → xhigh →
max → ultra, chỉ chọn giá trị được capability công bố. Catalog hiện tại dùng
low cho gpt-6-astra/gpt-6.1-sol; none cho GPT-6 Sol/Luna, GPT-5.6 và các model
GPT-5.1–5.5 hỗ trợ; minimal cho GPT-5 thường/mini/nano; low cho o1/o3/o4-mini.
Không suy diễn các model Pro/alias lạ: thiếu capability đáng tin cậy thì báo
REASONING_UNSUPPORTED trước inference, không dùng default để giả đã áp dụng.

Mọi native inference truyền `reasoning:{effort:...}`. Retry/repair dùng nguyên
policy đó. Body HTTP không được override policy nội bộ. Provider HTTP400 từ chối
reasoning hoặc response trả effort khác yêu cầu là lỗi cấu hình, không thử mức
cao hơn. Nếu provider không echo effort: chỉ ghi **đã gửi** và actual=null, chưa
xác minh thực thi. Không gọi AI để dò capability trong lượt sửa này.

Legacy `/api/analyze` OpenAI cũng dùng policy này, giữ model/env/input; effort env
cũ không override yêu cầu thấp nhất. Request tối đa3 rate/overload attempts như
trước, cùng body, abort được, tổng240s. Qwen adapter chưa xác minh được tham số
reasoning nên báo giới hạn trước inference; không giả thành mock. Gemini/Muse
web import do người dùng chủ động thực hiện ngoài app: app không điều khiển effort
của trang web và không tuyên bố đã áp dụng cho các lượt đó.

Tham khảo chính thức (chỉ tra schema/capability; không copy implementation):
- https://developers.openai.com/api/docs/guides/reasoning
- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/models/gpt-5.5

## Chi phí/chờ tìm được từ code và thay đổi

- Adapter native trước đây bỏ `reasoning`, phụ thuộc default của model; không
  thể quy7–10% quota mà người dùng quan sát thành token/bước khi chưa có usage.
- Main trước đây có thể gửi lại cùng yêu cầu và tự bỏ ảnh ở lần2. Nay giữ ảnh,
  chỉ bỏ khi adapter báo IMAGE_UNSUPPORTED rõ ràng; repair gồm đúng lỗi local,
  recipes/boundaries/locks đã chuẩn bị. Auth/quota/timeout/config không repair
  ngầm. Giữ giới hạn2 main attempts, ceiling JSON3600 thay2400 để giảm nguy cơ
  JSON thiếu trường. Đây là trần, không ép model dùng hết token.
- Hai part cold-cache có evidence vừa một pass và không Custom/discovery: chọn
  chung bằng schema wrapper2part, validate riêng. Nguồn/bằng chứng giống hệt được
  factor một lần ở `sharedVideoEvidence`; mọi giá trị khác giữ nguyên ở part.
  Không tóm tắt hoặc bỏ dữ liệu để gộp. Max output9000=2×trần4500 hiện có, tránh
  adapter cắt paired response ở4500 rồi bắt repair.
- Lựa chọn tốt của part này không gửi lại khi part kia sai. Short Generate
  thường main1+paired1; tối đa main2+paired1+repair riêng từng part1=5 inference.
  Catalog dài giữ discovery→original neighborhood→selection: tối đa2/part,
  cộng main tối đa2=6. Custom/Retry riêng1part tối đa2, không lập lại main.
  Cache hit có thể0 request mới. Không tăng AI concurrency.
- Request trùng dùng subscriber-aware shared operation. UI chặn double-click;
  đổi source/yêu cầu/transcript/main hủy request cũ. Part identity không bị lỗi
  teaser khác part làm hủy oan. Dừng hủy fetch/reader và tín hiệu worker; shared
  work chỉ dừng khi hết subscriber. Có nhãn riêng khi join lượt đang chạy.
- Metadata provider memoize một Generate. Source context network và local
  signals độc lập có thể chuẩn bị song song2 tác vụ. Theo yêu cầu mới sau đó,
  FFmpeg/VAD/ASR Editor đi qua lane serial riêng để tiếp tục dùng khi export;
  tối đa1 export +1 Editor media task. Không tăng decoder/encode threads.
  Chi tiết thay thế global heavy lease ở `editor-during-render.md`.
- Frame trước đây mở decoder theo từng sample ở mỗi lượt, xóa JPEG ngay sau đọc.
  Nay exact source ID/content fingerprint/timestamp/geometry-version cache:
  generated cache12MiB + LRU8MiB/512entry, dedup in-flight từng frame. Giữ512×288,
  q5, 48 mẫu/45s, tối đa300kB/frame và nguồn/timestamp/coverage cũ. Cache miss ở
  các mốc khác vẫn accurate seek riêng; chưa batch decoder vì cần tránh decode
  gap dài/sai VFR. Không có model/framework hoặc media trung gian toàn video.
- SSE đọc cả block cuối không có dòng trống; phân biệt incomplete/schema/config/
  auth/quota/timeout. Content filter không repair tự động. Giữ native request90s,
  hook route240s, Generate600s; không dùng giảm timeout để tuyên bố tăng tốc.

## Dữ liệu, cache và tương thích

Cache main/teaser gồm content fingerprint, transcript/cues, ranges, yêu cầu,
provider/model, policy reasoning và phiên bản thuật toán. Style/font/nhạc không
nằm trong identity và không tự gọi AI. Retry một part giữ input/bằng chứng đã
chuẩn bị; frame bổ sung vẫn giới hạn và cache. Bản cũ vẫn mở được, job snapshot
không bị sửa hoặc tự chạy lại.

Full evidence và catalog chia theo thời gian trên toàn video, giữ cue refs và
lấy lại nguyên văn quanh vùng discovery như trước. Không chỉ gửi candidates
đóng. Không thay tiêu chí sốc/trọn ý/9s export/loại10s đầu main hoặc manual policy.
Đã bỏ cắt transcript100k ký tự ở UI và canonical transcript/freshness; native
HTTP giới hạn1 triệu ký tự (body chung6MiB), vượt giới hạn báo lỗi rõ trước AI,
không tự bỏ đuôi. Lựa chọn AI cũ với transcript dài hơn100k có thể cần chọn lại
trước một submission mới vì trước đó hash chỉ dùng prefix; file/job cũ giữ nguyên.
Giới hạn catalog/cue/input/media hiện có vẫn có; không tuyên bố video vô hạn hoặc
mọi câu/ảnh được xem liên tục. Không giả word timing/vision hoặc heatmap counts.

## Thống kê và thao tác người dùng

Opt-in `progress:true` trên auto-cut / teaser-hooks trả NDJSON trên cùng kết nối;
consumer cũ vẫn JSON. Stage preparation/frames/provider/reading/validation/retry/
cache, elapsed và Dừng thật; không %/ETA giả. `providerMs` từ request đến text đầu,
`readMs` từ text đầu đến kết thúc stream. Các event stage có thời lượng, retry
reason là local code, UI diễn giải tiếng Việt. Một số preparation scope lồng nhau,
không cộng tất cả duration như các giai đoạn độc lập.

Result `diagnostics` + log `AI_OPERATION` theo Generate/retry/batch và terminal
`AI_REQUEST`: model gửi/thực trả, effort gửi/thực trả nếu có, số inference request
mới, usage input/output/cached/reasoning tokens nếu provider trả. Không suy quota%
hoặc tiền từ số request; không log prompt, transcript, base64, source URL/path,
credential/token/cookie. Log terminal vẫn giữ usage nếu subscriber đầu hủy nhưng
subscriber khác còn dùng request chung. Consumer join được báo rõ,0 request mới
không nghĩa là không chờ công việc AI. Hủy sớm có thể không nhận được usage.

Người dùng tự thử Generate mới/cache, đổi font/nhạc rồi Generate; Retry1part;
Custom mô tả và mốc tay (mốc tay0AI); Dừng/đổi link/yêu cầu khi đang chạy; xem
Chi tiết lượt AI và log. Chưa có nghiệm thu tốc độ, quota, lời giải thích hoặc
chất lượng teaser thật. Build/dev commit xem đầu CODEX_HANDOFF.md. Không push.
