Cập nhật 2026-11-04: OAuth đã được thay bằng Codex CLI; xem docs/CODEX-CLI-AUTO-PROMPT.md.

# Điều tra lỗi ChatGPT — 21/10/2026, source only

Đọc log hiện có `~/Library/Logs/ShortCut Studio Dev/launcher.log`, không gọi AI.
Không nhận được tệp log mới trong message; log DEV hiện có khớp chính xác các
số liệu chủ dự án nêu.

## Bằng chứng và giới hạn

- Operation `ab8662c6-1ec8-4cce-8ba2-a759604b34e8`, kind `teaser-retry`:
  1 request phase `select-teaser`, partCount=1, preparation/cache chỉ Part 1;
  24 ảnh, 139149 ký tự JSON gốc -> 96655 ký tự transport;
  providerMs=2965, tổng 3052ms, actualReasoning/serviceTier đều null.
- Operation Generate trước đó `8ad15b88-c07b-4c9e-88bc-4e390786bb4b`:
  2 request (main 1323ms, select-two-parts 1369ms). Request teaser chung
  partCount=2, 48 ảnh; cùng lỗi request được ghi cho hai part. Không phải hai
  request teaser độc lập. Lượt retry sau chỉ xử lý Part 1; Part 2 giữ lỗi cũ.
- Log cũ KHÔNG giữ HTTP status, request ID, error code/param, content-type,
  số byte hoặc event stream. Không thể xác định response cũ là JSON lỗi,
  SSE rỗng/bị ngắt, HTTP rejection hay network. 3 giây và null confirmation
  không chứng minh lỗi xác thực hoặc không tương thích model.

## Route và request thật

Editor POST `/api/sources/:sourceId/teaser-hooks` -> worker selector ->
resolveEditingProvider -> analyzeWithChatGPTPlan -> POST
`https://api.openai.com/v1/responses` với OAuth hiện có (không đổi auth/provider).
Model `gpt-6-luna`, reasoning `{effort:'none'}`, service_tier `'fast'`, stream true,
strict JSON schema; chọn riêng teaser max_output_tokens=2500.

lowestReasoning đang dùng catalog cục bộ, không phải capability được tài khoản/
route xác nhận. Không có response gốc để kết luận route/account này chấp nhận
gpt-6-luna + none + fast. Giữ nguyên tham số; chỉ xác nhận reasoning/tier khi
response thực sự trả các trường đó. Không đổi model, tăng effort hoặc thêm probe.

## Input 139149 -> 96655

worker/ai-input.mjs compactAiInput dùng bảng cột cho array object đồng nhất và
bảng strings cho chuỗi lặp >=64 ký tự có lợi về kích thước. Giữ thứ tự, giá trị,
timestamp và văn bản. Guard decode -> JSON phải khớp nguyên JSON.stringify(input),
nếu không thì gửi JSON gốc. Không phải tóm tắt hoặc bỏ cuối transcript tại bước
này. Số đếm là JSON user-text trước/sau encoding, không gồm instructions/schema,
không đo byte ảnh/base64, không phải tổng token hoặc toàn bộ HTTP payload.

Không lưu raw input lịch sử nên không thể so lại nội dung riêng của request cũ;
cũng không suy ra collector upstream có toàn bộ dữ liệu chỉ từ hai con số này.

## Sửa implementation

- worker/provider-response.mjs (mới): phân biệt HTTP JSON lỗi, SSE error/
  response.failed, JSON completed, empty/unfinished/interrupted stream, malformed
  SSE/JSON, unsupported content-type, output rỗng và output JSON sai.
- worker/server.mjs: ghi operational metadata vào request metric ở cả thành công
  và thất bại, giữ model/effort/tier. Không log body/header/remote message thô.
- Log AI_REQUEST/AI_OPERATION + UI: endpoint, HTTP status, x-request-id/request-id,
  response ID, provider code/type/param, errorCode, content-type/responseKind,
  số byte, số event, event cuối, output characters, partId, roundtrip integrity.
  Identifier có whitelist/kích thước; remote message chỉ dùng trong bộ phân loại,
  không đưa vào log. Token/cookie/Authorization/prompt/source response không lưu.
- worker/teaser-selection.mjs: phân loại auth/quota/rate/model/config/payload/
  HTTP/network/parser riêng; lỗi mới không vào nhánh technical repair tự động.
  Giữ teaser đang dùng khi retry thất bại. Chọn riêng part không sửa part khác.
- worker/main-content.mjs: provider lỗi không áp main fallback đè currentPlan.
- app/page.tsx: unavailable khi retry là lỗi, không báo chọn thành công.
- worker/ai-operation.mjs, lib/ai-progress.ts, components/ai-operation-status.tsx:
  giữ lỗi xuyên stream NDJSON tới UI; không báo “Đã xử lý xong” khi request lỗi.

## Lần chủ dự án tự chạy tiếp theo

Source sửa chưa build, app Review trước đó chưa chứa các sửa chẩn đoán này.
Sau khi chủ dự án yêu cầu cập nhật app, chạy lại riêng teaser cần sửa một lần;
mở Chi tiết lượt AI và lấy AI_REQUEST/AI_OPERATION tương ứng. HTTP status,
providerCode/errorParam và responseKind/lastEvent sẽ xác định lớp lỗi tiếp theo.
Không cần gửi token/cookie/raw source. Chưa thể cam kết đã sửa nguyên nhân
provider của lượt cũ khi response gốc không còn.

Không chạy test, build, typecheck, lint, render, AI, YouTube hoặc ASR; chỉ đọc
code/log và kiểm tra diff. Không restart app/worker, không đụng credentials,
production, media/exports/backups; không commit/push/merge. Mọi thay đổi có sẵn
của lượt draft/playback/manual-main được giữ nguyên.

## Cập nhật bundle DEV 20261021-214000

Theo yêu cầu tiếp theo, đã build/đóng gói DEV thành công một lần, exit 0; giữ đầy đủ native audit và codesign guard. Không thêm feature hoặc đổi auth/model/reasoning/service_tier.

App: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev Review 20261021-214000.app`

Log: `/tmp/shortcut-dev-20261021-214000-build.log`

Profile development, web 5273 / worker 8887, existingDataRoot=null; bootstrap dùng `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media`. Không khởi chạy bundle để xác minh runtime.

Đã đối chiếu 24 source input không đổi trong lúc build, các module worker/lib sửa khớp hash bản source. Parser worker/provider-response.mjs và import worker/ai-operation.mjs có trong package, đúng nội dung; ai-input, server, bootstrap/runtime-config cũng khớp. Client đã biên dịch chứa marker draft/manual-main và diagnostics. Manifest tại Contents/Resources/source-build-manifest.json; kiểm tra file/package tĩnh, không phải test/runtime QA.

App Review 20261021-205914 đang chạy được giữ nguyên, không đóng/restart hoặc đổi bundle đó; bản đang mở chưa dùng diagnostics mới. Sau khi lưu nháp/công việc hoàn tất, người dùng thoát app cũ bình thường rồi mở bundle mới; không chạy đồng thời cùng cổng DEV.

Không test, render, browser automation, AI, YouTube hoặc ASR. Chỉ compile/package/native audit/signing bắt buộc; cảnh báo chunk lớn, không lỗi. Chưa xác định nguyên nhân provider cũ và không tuyên bố QA pass. Chưa commit/push/merge; chỉ bổ sung tài liệu sau build, source app giữ nguyên.

## HTTP 400 / JSON 43 byte — điều tra contract tiếp theo

Log thật: operations f51ccd65-f093-4b1d-b6cb-fb8fe943f86f và
226d4c4a-b9fe-49e1-b5a1-846f98d1dc2d; select-main, HTTP400,
application/json, responseBytes43, eventCount0/outputCharacters0, lần lượt
2001ms và1730ms. Không có providerCode/errorParam/requestId trong log.
Body chỉ sống trong biến raw/value khi đọc, không có nơi persist; không thể
khôi phục 43 byte hay suy chính xác tham số bị từ chối từ độ dài.

**Lỗi implementation đã chứng minh:** analyzeWithChatGPTPlan gửi
max_output_tokens trên OAuth SIWC. Tài liệu chính thức Preview limitations
cấm trường này. Đã bỏ khỏi body riêng route OAuth; maxTokens của selector
không còn được biến thành tham số HTTP ở đây. Không đổi model/effort/tier,
input/evidence/schema, auth hoặc credentials. Giữ local output-size guard,
parser/validation và giới hạn số lượt hiện có. Đây là sửa vi phạm contract,
không phải bằng chứng body43byte đã chỉ đích danh max_output_tokens.

Nguồn chính thức đã đọc ngày21/10/2026:
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
  SIWC HTTP: storefalse/streamtrue, inputarray; max_output_tokens không hỗ trợ.
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
  resource=https://api.openai.com/v1, scopes resource.invoke/chatgpt.tokens.use.direct.
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
  OAuth này dùng POST /v1/responses; model phải có trong catalog account.
- https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery
  Admission có thể trả detail thay error object; không suy lỗi cụ thể từHTTP400.
- https://developers.openai.com/api/docs/models/gpt-6-luna
  Model API hỗ trợ none và Structured Outputs; không chứng minh accountđược dùng.
- https://developers.openai.com/api/docs/guides/fast-mode
  fast/priority hợp lệ trên API Fast cho model hỗ trợ; quyền SIWC/account vẫn
  chưa xác nhận. Không thayfast bằngpriority để đoán, không tự fallbacktier.

Source authorize/exchange/refresh cùng resourcev1 và granted-scope check phù
hợp flow SIWC. Không đọc token/Keychain để xác minh audience của credential
hiện tại vì ngoài phạm vi; chỉ kết luận implementation flow đúng loại endpoint.
Không gọi models/inference để kiểm tra account theo giới hạn khôngprobe.
Model account, fast account và acceptance strictschema tại route này vẫnchưa
xác minh; không bỏ schema hoặc tăng reasoning chỉ để ép chạy.

**Lỗi chẩn đoán đã sửa:** trước đây HTTP400/422 không hiểu được đều gán
PROVIDER_PARAMETER. Nay không có code/param phù hợp thì PROVIDER_HTTP;
classificationBasis ghi rõ chỉstatus hay code/param. HTTP404 cũng không còn
bị coi mặc định là modelkhôngtồn tại. Không dùng message/detail tựdo làm mã máy.

worker/provider-response.mjs nhận errorobject/errorstring/detailstring/top-level;
trích message/code/type/param giới hạn, message chỉ giữ từvựng chẩn đoán và tên
trường quen thuộc, thay văn bản khác bằng[redacted], xóa Bearer/key/JWT/email/URL.
Không lưu fullbody, prompt, header hoặc remote message thô. lib/ai-progress.ts
và components/ai-operation-status.tsx truyền/hiển thị đoạnđãche cùng căn cứ phân
loại. Giữ requestID và sốbyte/event trướcđó. Fast vẫn ghi đãyêucầu/chưaxácnhận;
chưa có bằngchứng nókhônghỗtrợ để loại giátrị theo phỏngđoán.

Files sửa trong lượt này: worker/server.mjs (bỏ max_output_tokens),
worker/provider-response.mjs (phânloại và cheerror), lib/ai-progress.ts,
components/ai-operation-status.tsx, tài liệu này.
Cần build DEV mới để tựthử. Không build/test/probe/AI/render/ASR/YouTube,
không restart, không thay credentials hoặc draft; không push/merge. Không kết
luận provider đã hoạt động chỉ dựa trên sửa contract.


## DEV Review 20261021-224638

Đã build/package DEV một lần thành công: `release/dev/ShortCut Studio Dev Review 20261021-224638.app`. Giữ nguyên bản app cũ, không tự mở bản mới. Profile development, web 5273 / worker 8887, không dùng data root production.

Đối chiếu 24 hash source với manifest trong package; worker/server.mjs và provider-response.mjs khớp source. Body request OAuth SIWC không còn thuộc tính max_output_tokens; không đổi model, reasoning, tier, auth, schema hoặc dữ liệu đầu vào. Compile, native audit và signing guards của packager được giữ nguyên. Có cảnh báo bundle JS lớn hơn 500 kB.

Không gọi AI/probe, test hoặc render; chưa xác minh provider hoạt động hay QA runtime. Log build: /tmp/shortcut-dev-20261021-224638-build.log.


## Cập nhật OAuth tier mặc định

Log xác nhận HTTP 400 với detail Unsupported service_tier: fast. Đã bỏ trường service_tier tại adapter OAuth dùng chung main/teaser/custom/retry; không đổi model gpt-6-luna, reasoning none, auth, schema hoặc dữ liệu. max_output_tokens tiếp tục không được gửi. Diagnostics requestedServiceTier=default chỉ là metadata nội bộ; actualServiceTier chỉ lấy từ response. UI hiển thị Tier mặc định. Không gửi AI/probe để xác minh. Các lần cập nhật tiếp theo dùng release/dev/ShortCut Studio Dev.app; không sinh Review mới.

Build/package một lần thành công vào app DEV cố định. Đã đối chiếu worker/parser với source và kiểm tra tĩnh OAuth body trong package: không có service_tier hoặc max_output_tokens. UI biên dịch có Tier mặc định. DEV config giữ nguyên. Không mở app, không xác minh provider/runtime. Log build: /tmp/shortcut-dev-default-tier-build.log.


## HTTP 200 / unsupported: điều tra và sửa parser

Bằng chứng log: operation f2fd19e1-f9e8-49ca-a4ba-2b68393e4cfb, HTTP 200, MIME chuẩn hóa unknown, 164916 byte đã đọc, 0 event, 0 output. Code cũ chỉ nhận SSE khi contentType === text/event-stream, JSON khi MIME chứa json; còn lại đọc hết rồi gán unsupported. Charset hợp lệ đã được regex worker loại bỏ nên riêng charset không giải thích được log unknown. Header thiếu, header sai/leading whitespace đều có thể thành unknown; log cũ không giữ Content-Type gốc hoặc Content-Encoding. Body chỉ ở biến local trong reader, không có bản lưu; không attach/debug heap vì có dữ liệu riêng tư. Chưa xác định body cũ là SSE, JSON hay HTML, chưa có bằng chứng inference thành công.

Thay đổi worker/provider-response.mjs: một reader duy nhất, kiểm tra cấu trúc từ prefix tối đa 65536 ký tự khi MIME thiếu/sai, nhận SSE fields hoặc JSON object nhưng phải kiểm tra event/envelope Responses trước khi nhận output; HTML/JSON khác không được dùng làm output. Giữ giới hạn body/frame/output hiện có. SSE incremental line parser giữ trailing CR qua chunk boundaries, CRLF/LF/CR, multiple data lines, comments, final partial frame; xử lý failed/incomplete/error. response.completed chứa output được dùng làm kết quả đầy đủ, không bỏ do delta thiếu hoặc chỉ đọc được một phần. JSON Responses yêu cầu object=response/id resp_/status/output array và chỉ lấy message/output_text, không đọc text tùy tiện.

Chẩn đoán mới: MIME chuẩn hóa, header Content-Type (giữ MIME/charset thông thường, che tham số khác, tối đa 400 ký tự), Content-Encoding (coding allowlist), formatDetection, structureKind, tên event/key/type allowlist, số lượng output items và các trường không nhận diện. Không ghi body, prompt, output text, source, token, cookie hoặc Authorization. Fetch tự xử lý transport encoding; không giải nén body thêm lần nữa. responseBytes là byte reader nhận, không khẳng định kích thước compressed trên wire.

worker/server.mjs dùng reader chung cho OAuth; lib/ai-progress.ts và components/ai-operation-status.tsx truyền/hiện diagnostics cấu trúc. Không thay model/reasoning/auth/schema/input; OAuth tiếp tục bỏ service_tier và max_output_tokens. Parser/type errors không thuộc danh sách repair schema/incomplete của selector nên không phát thêm request tự động; UI không áp kết quả lỗi lên plan/draft. Không thay các handler chỉnh main/teaser/draft.

Tài liệu đối chiếu: https://developers.openai.com/api/docs/guides/streaming-responses và https://developers.openai.com/api/reference/resources/responses/streaming-events (2026-10-21). Không gọi AI/probe hoặc chạy test/render; chỉ rà source/diff và build/package theo yêu cầu. Chất lượng và tương thích response thật chưa được kiểm chứng.

Build/parser cập nhật thành công vào release/dev/ShortCut Studio Dev.app một lần; audit/sign guards hoàn tất. Đã đối chiếu package worker/parser/ai-operation/reasoning khớp source, UI compiled có diagnostics MIME/cấu trúc, DEV config không đổi, OAuth body không có service_tier hoặc max_output_tokens. Không tự mở app. Log: /tmp/shortcut-dev-response-parser-build.log. Chưa chạy test/AI/render hoặc nghiệm thu runtime.
