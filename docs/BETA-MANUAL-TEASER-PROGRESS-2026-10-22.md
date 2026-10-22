# Beta — manual teaser toàn nguồn và nhãn tiến trình render

Phạm vi: sửa source trên checkout `/Users/datdo/Documents/tiktok-edit/short-video-studio-beta`, branch `beta/maintenance`, nền `f9f118bf7ba93f1c4a08275b4449f65ab138d686`. Trước sửa working tree sạch. Đã đối chiếu app `release/beta/ShortCut Studio Beta.app/Contents/Resources/config.json`: profile beta, version 1.1.0-beta.1/build 1101, cùng commit nền, cổng 5373/8987. Không lấy thay đổi từ DEV.

Chưa build/package hoặc cập nhật app trong lượt này. Không chạy AI, tests, lint/typecheck, render hay browser automation. Chỉ đọc source/diff và sửa source; không mở/ghi dữ liệu media, plans, drafts, database hay credentials. Không commit/push/merge.

## 1. Render progress

Các bề mặt dùng chung `RenderProgress → TaskProgress`:

- Footer Editor: `StudioRenderStatus`.
- Danh sách job trong Kho: `EditorRenderList`.
- Job của item Batch: `app/page.tsx`; tổng item Batch là `BatchProgress`, có mẫu số/nhãn riêng.

Không tìm thấy hai phép in số % trong cùng một `TaskProgress`; mỗi bề mặt có thanh riêng. Các vấn đề layout chứng minh được từ source: rule cũ `.studio-render-state progress` ép rộng 100px trong khi component mới đặt 100%; nhãn bước và chuỗi `% · scope` cùng nằm trong flex cho phép co/xuống dòng; footer có giới hạn 48px có thể cắt phần nhãn/detail khi nhiều dòng. Footer còn lồng hai vùng ARIA status, có thể đọc trạng thái lặp. Chưa quan sát runtime nên không khẳng định riêng một rule giải thích toàn bộ biểu hiện người dùng thấy.

Sửa:

- Một vị trí in số % trong cột `max-content`, không xuống dòng; tên bước và phạm vi ở cột `minmax(0,1fr)` có thể xuống dòng mà không đè số.
- Bỏ rule progress 100px cũ, giữ thanh đầy chiều rộng component; footer dành chỗ cho component, không cắt ở 48px.
- Tiếp tục dùng duy nhất `job.progress` từ worker, phạm vi ghi rõ “toàn tác vụ”. Tên Part là bước đang chạy/kiểm tra/lưu, không giả thành % riêng của Part.
- Truyền cờ dừng đang chờ ở footer/Kho vào component; trạng thái terminal error/cancelled/done được ưu tiên hơn cờ dừng cũ.
- Giữ guard chưa 100% khi job còn chạy/validation/publishing hoặc done thiếu output; không thêm bộ đếm/timer % hay request mới. Bỏ ARIA status lồng nhau khi thanh tự công bố trạng thái.

File: `components/task-progress.tsx`, `components/render-progress.tsx`, `components/studio-render-status.tsx`, `components/editor-render-list.tsx`, `app/globals.css`. Batch tự nhận cùng thay đổi component, tổng item vẫn tách biệt với tổng job render.

## 2. Quy tắc manual mới

Teaser có `status=selected, selection=manual` được lấy từ bất kỳ đoạn hợp lệ trong cùng source, độc lập main của cả hai part: ngoài main, qua gap main, trong 10 giây đầu hoặc các đoạn Auto loại. Không thêm vào main, không snap, không padding/đổi timestamp. Không đổi thuật toán/tiêu chí/model hoặc contract chọn teaser AI.

Kiểm tra kỹ thuật còn giữ:

- Timestamp hữu hạn, `0 ≤ start < end ≤ source.duration`.
- Giới hạn hiện có 0,5–9 giây export, tương đương 0,625–11,25 giây nguồn tại 1,25×. Preview 1×, timeline clock nguồn. Không đổi giới hạn hiện hành.
- Lựa chọn manual mới mang `manualSourceId`; kiểm tra với source hiện hành tại Apply/readiness/restore/context, preview nhạc và worker validation/render. Plan manual cũ không có trường này tiếp tục dựa vào source sở hữu session/item/job như trước; chưa thể suy ra fingerprint lịch sử không được lưu.
- Tạo manual từ đầu đối tượng mới: không mang binding, citation, alternatives hoặc bằng chứng AI cũ. `editedFrom` chỉ giữ metadata lịch sử hợp lệ, không dùng làm bằng chứng chọn.
- Cắt ngang cue/từ hoặc nằm ngoài main chỉ cảnh báo ngắn; không có checkbox xác nhận, không bị chặn bằng ngữ nghĩa/citation dành cho AI.

Nguyên nhân xác nhận:

1. `customTimestampPart` bắt range manual nằm trọn một range main, không qua gap.
2. `validateTeaser` kiểm tra `rangeKey` main, containment và `evidenceTimes` trong main cho cả manual; `hookNeedsReselection` vẫn áp containment main cho manual.
3. `presentationSegments`/transition từ chối rangeKey cũ trước khi prepend teaser, có thể bỏ manual sau main đổi dù timestamp nguồn còn hợp lệ.
4. `applyPartTimes` kiểu cũ thay teaser thành unavailable hoặc fallback khi main key đổi, kể cả manual. Đường `applyMainRanges` hiện có đã giữ teaser object và mốc; nó nay nhận đúng validator manual mới.
5. `readPlan` whitelist chưa có ID nguồn cho manual; các call validation chưa nhận source ID cho lựa chọn này. Tạo manual hiện có đã bỏ AI binding; không quy mọi lỗi cũ thành “còn binding”.

## 3. Đường tích hợp và file

| Đường | Thay đổi / kiểm tra |
|---|---|
| Draft timestamp / Custom Timestamp | `components/teaser-editor.tsx`, `lib/custom-teaser.mjs`, `.d.mts`: truyền source ID/duration, giữ raw input và timestamp chính xác; bỏ gate main, kiểm tra source bounds; warning gọn. Request của source cũ vẫn bị abort, Apply vẫn kiểm tra epoch/revision. |
| Plan contract / validator | `lib/teaser-hooks.mjs`, `.d.mts`: thêm `manualSourceId`, manual không phụ thuộc main key/containment/exclusion/evidence-in-main; vẫn kiểm tra duration/source. AI vẫn giữ các gate cũ. |
| Apply / readiness / render submission | `app/page.tsx`, `lib/teaser-context.mjs`, `lib/teaser-import.mjs`: so source ID; manual bỏ kiểm tra binding AI; guards async/part và import AI giữ nguyên. |
| Restore | `lib/editor-session.ts`: giữ `manualSourceId`, đối chiếu source của session; bỏ cờ stale main cũ khi manual hợp lệ. Dữ liệu không hợp lệ vẫn giữ để chỉnh, không tự sửa mốc. |
| Main chỉnh tay / main phân tích lại | `lib/custom-time.mjs` giữ manual thay vì tạo unavailable/fallback; `lib/main-ranges.mjs` được đọc, không cần sửa vì đã giữ đúng object/mốc. `worker/auto-cut-workflow.mjs` truyền source ID khi xác minh teaser được bảo toàn. Không phát sinh request chọn lại manual. |
| Preview nguồn / captions | `presentationSegments` và hook transition dùng cùng luật manual mới. `partCaptions` trong `lib/subtitles.mjs` đã map từng presentation segment từ cue nguồn; không giới hạn theo main. Candidate `RangePlayer` dùng media nguồn và đúng start/end. Không cần thay engine/caption mapping. |
| Preview nhạc | `worker/music-preview.mjs`: kiểm tra manual source/range trước khi tạo cache/prepare. Cache đã gồm source fingerprint và toàn bộ presentation segments; `lib/music/envelope.mjs` map lời nói qua cả teaser, không chỉ main. Không tạo audio cache trong lượt sửa. |
| Job snapshot / history / worker / export | `worker/plan-validation.mjs`, `worker/server.mjs`: truyền source ID tới validator; `startRender` clone plan, history giữ plan, resume xác minh nguồn trước enqueue. `originalCutPlan` giữ teaser metadata. `renderPart → prepareRangeInput` đọc presentation segments theo thứ tự, kể cả teaser nằm trước/sau main hoặc nhảy ngược thời gian nguồn; không sort/merge teaser vào main. Không thay graph/tốc độ/render engine. |

Không sửa worker cung cấp tiến trình, thuật toán AI, model/reasoning, prompt, số bước/request, media/cache/history thực hoặc source của DEV. Không thêm module runtime/dependency mới; thay đổi vào các module đã có trong manifest đóng gói.

## 4. Checklist nghiệm thu tay sau khi được build

Lặp riêng Part 1 và Part 2:

1. Nhập teaser ngoài main, qua gap, trong 10 giây đầu và trong vùng Auto loại; Apply. Đối chiếu timestamp giữ nguyên, main không đổi, provenance manual và đúng nguồn; không stale do main.
2. Nghe preview video/nhạc và xem phụ đề ở đoạn nguồn đó; thử đoạn nằm trước lẫn sau main. Cắt ngang cue chỉ cảnh báo, không cần xác nhận.
3. Sửa/xóa main không chạm source, đổi style/nhạc/tab/part; reload và mở lại item/history. Manual còn nguyên, Part 1 không làm đổi Part 2.
4. Thử số sai/nhập dở, start=end/end<start, vượt source, dưới minimum hiện hành, quá 11,25 giây nguồn; không Apply/render, giữ draft. Sai source ID phải báo lỗi nguồn. Không dùng AI thật chỉ để nghiệm thu quyền manual.
5. Sau build, khi người dùng chủ động render: kiểm tra snapshot/export đúng teaser/phụ đề/âm thanh nguồn; không thêm teaser vào main. Range có audio nguồn thiếu thực sự vẫn có thể bị guard audio kỹ thuật hiện hành từ chối, không tự mute/padding để che lỗi.
6. Kiểm tra một nhãn %/thanh trong Editor, Kho, Batch trên cửa sổ hẹp. Xét running, validating, publishing, done, error và cancel; % là toàn job, tổng item Batch có nhãn riêng, không 100% trước hoàn tất.

Chưa xác minh runtime, build/type compatibility, Windows, render hoặc chất lượng phụ đề/âm thanh thực tế. App Beta đang dùng vẫn là bundle đã đóng gói trước sửa; cần lượt build/package riêng sau khi source được chốt và người dùng cho phép.
