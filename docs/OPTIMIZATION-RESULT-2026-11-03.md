# Kết quả tối ưu Beta — 2026-11-03

## Phạm vi và trạng thái

Thực hiện theo `docs/CODEX-OPTIMIZATION-PROMPT.md`, dựa trên `docs/AUDIT-2026-11-03.md`, trong checkout Beta, nhánh `beta/maintenance`, HEAD ban đầu `221cc9a`. Node thực chạy: v26.12.0; chưa kiểm tra trên Node 22 của CI.

Đã sửa source và chạy kiểm tra cục bộ theo năm nhóm. Không build/package, push/merge, gọi AI/ASR, tải video hoặc render thật. Không mở app đang cài, không đọc/sửa DEV, dữ liệu người dùng hoặc file release. Test sử dụng fixture và thư mục tạm; test runtime manifest chỉ sao chép fixture vào thư mục tạm, không tạo app/release. Các file có sẵn chưa tracked (`.claude/`, `.specify/`, hai tài liệu giao việc/audit) được giữ nguyên.

**Chưa hoàn tất quy trình commit và QA trình duyệt:** sandbox cấm ghi `.git` và mở cổng loopback; chi tiết bên dưới. Không tuyên bố đã qua QA runtime.

## Từng mã P/U/S

| Mã | Trạng thái | Công việc / phần bỏ qua và lý do |
| --- | --- | --- |
| P1 | Đã sửa, test đơn vị đạt | `/api/editor-renders?compact=1` bỏ `plan`, giữ `planSummary` gồm tiêu đề, id/title/hashtag Part. Endpoint không có tham số giữ payload cũ. Đã rà các caller `job.plan`: danh sách, xác nhận xoá và tiến độ đọc được summary hoặc full plan. Poll giữ identity khi dữ liệu không đổi, gồm id/state/progress/phase/outputs và metadata/lỗi khác; dùng 1,2s khi queued/rendering, 5s khi idle, không poll nền tab ẩn. Chưa đo payload thực từ dữ liệu người dùng. |
| P2 | Đã sửa, test clock/deck đạt; chưa profiling React | Chuyển clock khỏi state Home sang store riêng, ref giữ thời gian chính xác; `useSyncExternalStore` chỉ ở PreviewView (đồng hồ, seek, phụ đề, hiệu ứng) và wrapper nhạc. Timeline hiện không đọc playhead nên không đăng ký. Hiển thị tối đa 10 Hz; keyboard và nút ±5s đọc ref, không gắn listener theo clock. Đồng bộ nhạc đọc ref chính xác; lưu/checkpoint lấy playhead mới nhất qua getter, không thêm timer lưu. Không thêm React.memo vì chưa đo được lợi ích; không refactor Home ngoài phần clock được giao. |
| P3 | Đã sửa có điều kiện, test khôi phục đạt | Lịch sử dùng `planJobId` chỉ khi plan của item giống hoàn toàn plan job đã lưu trong cùng snapshot. Decode phục hồi bản sao độc lập trước resume/xem lại; plan đang chỉnh khác job vẫn giữ nguyên. Đọc được lịch sử định dạng cũ. Retention mặc định tắt; cần đồng thời cấu hình số job và xác nhận riêng; bảo vệ job đang chạy và mọi job batch tham chiếu. Không bật retention hay sửa lịch sử thực. |
| P4 | Đã sửa, test index/fallback đạt | Source reuse đọc index v2 trước; chỉ load hit, kiểm tra identity/media bằng đường load hiện có, quét fallback khi thiếu/cũ/hỏng/stale. Index lưu metadata gọn. Queue history liệt kê tên thư mục, dùng metadata indexed thay đọc mọi source.json, đọc fallback riêng cho nguồn chưa indexed; vẫn tìm legacy outputs kể cả khi không còn media tái sử dụng. Không xoá source/cache. |
| P5 | Đã sửa, test đạt | Handler rejection/exception log loại lỗi cố định, không raw message/stack/path; dừng command thuộc worker, checkpoint có giới hạn thời gian và thoát code 1. Test bằng EventEmitter/shutdown giả và timeout, không khởi động worker thật. |
| P6 | Chỉ đề xuất theo yêu cầu | Đề xuất subset WOFF2 có fallback và kiểm tra glyph JP/KR; không đổi asset/font ID hoặc định danh plan. Chưa đo dung lượng sau subset. |
| U1 | Đã thêm, chưa QA lỗi runtime | `app/error.tsx`, `app/global-error.tsx` có thông báo Việt và Thử lại. Layout effect thử checkpoint bằng `writeEditorSession` trước paint, giữ bảo vệ bản gốc bị blocked. Hỗ trợ retry của Next 16.3 và reset của vinext đang dùng. Đây là best effort, không bảo đảm cứu được render chưa commit, lỗi storage hoặc lỗi sập tiến trình. |
| U2 | Đã sửa, test nội dung phiên đạt | Save phiên trống trả thông báo, không ghi hoặc tạo “Bản nháp đã giữ”; đường preserve phiên trống cũng bỏ qua archive. Input chưa hoàn chỉnh, nguồn, batch, controls và plan thật vẫn giữ được. Chưa bấm nút qua browser. |
| U3 | Đã sửa CSS, chưa QA trình duyệt | Ở ≤1050px panel đóng dùng display:none cho toàn khối, gồm tab heading; giữ drawer và nút mở hiện có. |
| U4 | Đã sửa CSS, chưa đo bố cục thực | Body token 14px, meta tối thiểu 12px, preview seek và input range có vùng bấm tối thiểu 24px. Chưa xác nhận không tràn ngang tại từng breakpoint bằng browser. |
| U5 | Đã sửa các chuỗi được chỉ định | Gom chuỗi mới vào ui-strings.ts; Việt hoá Play/Pause preview, filter intensity, overlay opacity, template status, Preview/Inspector aria-label, nút đóng/thu mở Inspector và hướng dẫn chuẩn bị nhạc. Không dịch toàn app. |
| S1 | Đã sửa, test đạt | Thay vá im lặng bằng manualMainRules kiểm tra đoạn cần thay, báo lỗi khi canonical rules lệch. Test prompt manual không còn câu “No images/video/audio are supplied”. Giữ fallback standalone chỉ có evidence. |
| S2 | Đã sửa, test đạt | Tách các token at1x/at1.25x, first10, maximum9, normally1080p, below480p/a480p/optional480p, parts1/2, Preview1x, maximum100. WEB_AI_PROMPT_VERSION tăng v22→v23; v19–v22 vẫn trong danh sách compatible. Không sửa chuỗi prompt của phiên bản cũ hoặc định dạng JSON import. |
| S3 | Đã sửa, test grep đạt | Width/height, playback/foreground scale, blur/opacity và fps lấy từ render-config.mjs trong bốn consumer được giao. Type TS cũng dùng typeof hằng chuẩn. Test không còn các literal preset lặp trong bốn file; kiểm tra biểu thức light-leak giữ giá trị cũ. Không đổi tiêu chí main/hook. |
| S4 | Đã sửa, test tập giá trị đạt | Registry có tên ở prompt-versions.mjs. Hook giữ đúng v12 và tám adaptive legacy cùng v1 riêng; không thêm v11 hoặc đổi hook/cache version. Web giữ mọi phiên bản cũ, thêm v23 vì sửa chuỗi. Bổ sung module worker mới vào runtime manifest sau khi test closure phát hiện thiếu; không build/package. |
| S5 | Chỉ đề xuất theo yêu cầu | Giữ nguyên câu không có trần tiết kiệm quota. Tài liệu đề xuất ghi mốc giảm trần output 2000/4000 tokens từ ai-efficiency.md; không coi đó là mức tiết kiệm thực tế do sửa câu hoặc quy đổi quota. |
| S6 | Đã rà bằng grep, không xoá | Không thấy caller UI `/api/analyze`; metadata UI gọi worker, QA còn dùng cùng path, hosting vẫn tự phát hiện route. Drizzle còn script/dependency và plugin copy migrations. Chưa chứng minh route Next/hosting chắc chắn không dùng; không đề xuất xoá chắc chắn, giữ danh sách cần xác minh trong tài liệu. Không build để chứng minh vì bị cấm. |
| S7 | Đã làm trong phạm vi | Chỉ xuống dòng module minified phải sửa: muse-plan, teaser-hooks, music/light-leak, worker/source-reuse; không format hàng loạt. |
| S8 | Xử lý phần clock, bỏ qua refactor rộng | Home không còn state clock theo frame; tách subscriber nhạc khỏi Inspector. Không chia lại toàn bộ Home/getter/props vì ngoài phạm vi và chưa có phép đo lợi ích. |

Đề xuất retention/dọn dữ liệu, chính sách quota, route và font: `docs/OPTIMIZATION-PROPOSALS-2026-11-03.md`. Không có triển khai xoá sources/cache.

## Số liệu trước–sau và cách đo

| Phép đo | Trước | Sau | Giới hạn |
| --- | ---: | ---: | --- |
| Payload một job fixture, JSON UTF-8 (`render-job-summary.test.mjs`) | 4076 B | 170 B | Giảm khoảng 95,8%; dữ liệu tổng hợp, không phải 9 job thật trong audit. Full endpoint vẫn giữ plan. |
| Snapshot history fixture (`history-snapshot.test.mjs`) | 2344 | 1250 | Độ dài JSON fixture ASCII, cũng là số byte; giảm khoảng 46,7%, decode deep-equal toàn bộ nội dung. Không đo file 3,7 MB thực. |
| Nhịp poll idle theo cấu hình | 1200 ms | 5000 ms | Danh nghĩa 50→12 lượt/phút, chưa tính thời gian response; active giữ 1200 ms. |
| Clock giả lập 60 callback trong 1 giây (`preview-clock.test.mjs`) | 60 lần đưa thời gian vào clock | 10 thông báo subscriber hiển thị | Ref đúng ở cả 60 callback. Đây là số thông báo, không phải số lần render React đo bằng Profiler. |
| Payload thực audit | 377581 B / 9 job | Chưa đo | Không đọc dữ liệu người dùng hoặc gọi worker đang chạy. |
| Render Home/StudioView và mức giật video thật | Chưa profiling | Chưa profiling | Không báo tỷ lệ giảm render/RAM/FPS; không để Profiler tạm trong code. |

## Lệnh đã chạy và kết quả thật

Sau mỗi nhóm đều chạy `npx tsc --noEmit`, `npm run lint` và `node --test <file liên quan>`. Các lần cuối của từng nhóm: tsc exit 0, lint sạch, không warning. Đã chạy lại nhóm 1 và 2 sau bổ sung store/index; kiểm tra cuối áp dụng cho toàn bộ source cuối cùng.

| Nhóm | Lệnh test liên quan | Kết quả |
| --- | --- | --- |
| 1 | `node --test lib/preview-clock.test.mjs lib/render-job-summary.test.mjs lib/preview-decks.test.mjs lib/preview-timeline.test.mjs lib/music-preview.test.mjs` | 11/11 pass |
| 2 | `node --test worker/source-reuse.test.mjs worker/history-snapshot.test.mjs worker/queue-history.test.mjs worker/fatal-errors.test.mjs worker/batch-pipeline.test.mjs worker/batch-queue.test.mjs` | 33/33 pass |
| 3 | `node --test lib/session-content.test.mjs` | 2/2 pass |
| 4 | `node --test lib/optimization-contracts.test.mjs lib/muse-plan.test.mjs lib/teaser-import.test.mjs lib/auto-cut-request.test.mjs lib/teaser-hooks.test.mjs worker/main-content.test.mjs` | 25/25 pass |
| 5 | `node --test lib/optimization-contracts.test.mjs desktop/worker-runtime-files.test.mjs` | 5/5 pass |
| Cuối | `npx tsc --noEmit` | Exit 0 |
| Cuối | `npm run lint` | Exit 0, sạch |
| Cuối | `npm test` | 402 tests: 400 pass, 2 fail do listen EPERM; không đạt toàn bộ suite trong sandbox |
| Rà diff | `git diff --check` | Sạch |

Hai test cuối không chạy được do quyền mở cổng loopback:

- `desktop/runtime-config.test.mjs`: “port collisions fail without stopping the existing listener”.
- `worker/routes.test.mjs`: “HTTP boundary enforces Host/Origin before mutation and OAuth exception, keeps OPTIONS and JSON/raw upload policy”.

Cả hai báo `listen EPERM: operation not permitted 127.0.0.1`. Không skip/sửa test để che lỗi môi trường. Lần npm test trước từng phát hiện thiếu `prompt-versions.mjs` trong runtime manifest; đã bổ sung cả prompt-versions và render-job-summary, test closure cuối pass. Chưa xác minh full suite trên môi trường được phép mở cổng.

## Commit và giới hạn môi trường

Đã thử `git add` theo danh sách file nhóm 1 rồi commit nhỏ, nhưng Git không thể tạo `.git/index.lock`: `Operation not permitted`. Lệnh dừng ở git add, commit chưa thực thi. Sandbox chỉ cho đọc `.git`, chính sách approval là never; không tìm cách ghi vòng qua hạn chế đó. **Số commit tạo được: 0**; các thay đổi vẫn nằm trong working tree. Không push/merge. Quy trình “mỗi nhóm một commit” vì vậy chưa thực hiện được trong phiên này.

`npm run dev` được thử trên cổng cố định 5373, nhưng vinext báo `listen EPERM ... 127.0.0.1:5373`. Không khởi động worker để tránh truy cập dữ liệu thật, không dùng app có sẵn làm môi trường test. Chưa có phiên browser QA trên source mới với dữ liệu giả.

## Phần chưa kiểm chứng / rủi ro còn lại

- Browser QA: panel ở 1024/1050px và breakpoint khác, không tràn ngang sau tăng chữ, thao tác Lưu phiên trống, error boundary/checkpoint/Thử lại, phụ đề/hiệu ứng/nhạc khi phát video giả. Cần làm trong môi trường có loopback và storage giả cô lập.
- Chưa profiling render React, RAM/GC/FPS hoặc payload/list lịch sử thật; chỉ có số đo fixture nêu trên.
- Chưa test storage đầy/IME/screen reader, Windows và Node 22; không gọi AI, ASR hoặc render để kiểm tra chất lượng.
- History mới đọc được history cũ; app cũ chưa hiểu planJobId không nên đọc snapshot mới. Nếu hạ phiên bản cần xuất lại history đã decode. Không thay dữ liệu thực để thử downgrade.
- Retention chỉ giới hạn job terminal không bị batch tham chiếu, không phải tổng số batch/history/media; mặc định không xoá gì. Chưa có UI xác nhận và chưa bật cấu hình.
- Index là metadata tăng tốc; hit reuse vẫn phải qua load/identity, legacy history vẫn liệt kê thư mục để không bỏ nguồn chưa indexed. Chưa benchmark thư viện lớn hoặc filesystem khác.
- Error checkpoint chỉ giữ snapshot đã commit gần nhất và playhead ref; không hứa cứu được render lỗi trước commit hay bộ nhớ local không khả dụng. Không thêm autosave theo timer.
