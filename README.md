# ShortCut Studio

## Bản Windows cá nhân

Build trên macOS/Linux bằng `npm run package:windows`. Kết quả nằm trong `release/windows-x64/ShortCut Studio.exe` (Windows 10/11 x64 Intel/AMD).

- Một EXE, tự giải nén runtime và mở trình duyệt khi web/worker sẵn sàng. Không cần cài Node, FFmpeg, Python hay Visual C++ riêng.
- Giữ cửa sổ launcher mở trong lúc dùng; nhấn Enter và xác nhận để dừng. Đóng launcher sẽ dừng cả các tiến trình tải/render con bằng Windows Job Object.
- Dữ liệu/video/lịch sử: `%LOCALAPPDATA%\ShortCut Studio\media`; log khởi động: `%LOCALAPPDATA%\ShortCut Studio\logs\startup.log`.
- Whisper base tải model qua nút Auto Subtitle như bản Mac; kèm sẵn CLI và runtime C++/OpenMP x64. Continue with ChatGPT dùng OAuth trình duyệt như bản Mac; token Windows được mã hóa DPAPI theo tài khoản Windows đang đăng nhập, không cần API key. Điều kiện dùng gói/quyền/quota của OpenAI vẫn áp dụng.
- Giữ foreground scale 1.25×, playback/audio 1.25× và export 1080×1920. Windows mặc định dùng libx264; không có Apple VideoToolbox.
- Build kiểm tra checksum các runtime tải về, kiến trúc PE x64 và DLL phụ thuộc. Cross-build/kiểm thử logic trên Mac **không thay thế** việc chạy thử thực tế trên Windows. Bản cá nhân chưa có chữ ký Authenticode; không cần tắt Defender/SmartScreen để kiểm tra nguồn gốc.

Personal tool để biến video dài thành 2 video dọc 1080×1920. App có hai chế độ chọn nội dung:

- **AI plan**: đăng nhập ChatGPT Plus / Pro bằng OAuth chính thức, hoặc dùng mock mode.
- **Manual cut**: nhập timestamp trực tiếp, không gọi AI và không cần subtitle.

Sau khi cắt/ghép, worker dựng background blur, giữ main video ở native 100% và center-crop phần tràn ngang, thêm typography social-video, rồi mới tăng tốc video + audio lên 1.25×.

### Custom Time, Smart Cut và Auto Subtitle

- Sau khi áp dụng kết quả AI, Custom Time hiển thị start/end của cả hai part theo source. App cộng 1 giây đầu đúng một lần, rồi Smart Cut tìm khoảng lặng/ngắt câu gần nhất trong 2.5 giây. Không tìm được mốc đáng tin cậy thì giữ mốc hiện tại; không cắt lại khi preview/export.
- Chỉnh Custom Time cập nhật trực tiếp preview và bản render mới. Mốc chỉnh tay không bị Smart Cut/cộng 1 giây lại. Giữ các khoảng quảng cáo đã loại và footage bổ sung; mốc không hợp lệ, chồng part, vượt source hoặc làm part AI không đủ trên 60 giây sẽ chặn export.
- Prompt bổ sung kết hợp vào prompt của mọi AI, bao gồm lượt hàng loạt mới. Mặc định nhận diện và bỏ credit/promotion nhưng không loại nội dung chính chỉ vì có tên thương hiệu. JSON web được kiểm tra bằng sourceId, không dùng title/transcript làm định danh.
- Auto Subtitle mặc định tắt. Bật trong kết quả part, chọn font/cỡ/màu/viền/vị trí; xem preview và sửa chữ trong danh sách phụ đề. Hàng loạt có checkbox dùng chung style.
- Dùng VTT YouTube nếu có. Nếu không, tải model Whisper base đa ngôn ngữ (~142 MiB) một lần bằng nút trong app. Nhận diện lời nói local bằng Whisper/Metal, không gửi audio đến AI provider và không cần API key. Model nằm ở media/models, ngoài app bundle; cache phụ đề nằm cùng source và tái dùng cho các lần render.
- Phụ đề bám source timestamps, ánh xạ lại qua từng segment (kể cả footage lặp), tự chia tối đa hai dòng, burn-in bằng overlay trước setpts/atempo 1.25×. Các vị trí nằm trong vùng main video, không đè title trên/dưới. Không thể tự biết mọi chữ/logo đã có trong footage; chọn vị trí khác nếu cần.
- Phụ đề và Smart Cut là nhận diện tự động, không đảm bảo hoàn hảo khi âm thanh nhiễu, nhạc nền lớn hoặc giọng khó nghe. Luôn xem và sửa trước khi xuất.

Kiểm thử: `node --test lib/*.test.mjs worker/*.test.mjs`, `node scripts/qa-editor-renders.mjs`, `node scripts/qa-speech.mjs` (hai script QA chỉ dùng video/giọng tổng hợp trong thư mục tạm riêng).

## Chạy app cá nhân

Yêu cầu: Node.js 22+ và FFmpeg. Trên macOS có thể cài FFmpeg bằng `brew install ffmpeg`.

```bash
npm install
npm run personal
```

Lần chạy đầu, app tự tải binary `yt-dlp` chính thức vào `.local-tools/`. Sau đó mở:

```text
http://127.0.0.1:5173
```

`npm run personal` chạy cả giao diện và media worker. Có thể chạy riêng từng phần bằng:

```bash
npm run setup:media
npm run worker
npm run dev
```

Media worker chỉ lắng nghe trên `127.0.0.1:8787`. Video nguồn và output local nằm trong `worker-data/`; cả hai thư mục này đều bị Git ignore.

## Workflow

1. Chọn **YouTube** hoặc **Local video**.
2. Khi paste YouTube URL, app tự lấy timestamped transcript bằng phụ đề gốc (manual/auto, gồm mã ngôn ngữ có hậu tố như `ko-orig`). Lỗi tải phụ đề được hiển thị rõ; video không có phụ đề vẫn dùng được Manual cut.
3. Bấm **Chuẩn bị source để render**.
   - YouTube: tải video tối đa 1080p, title gốc và thử lấy subtitle DE/EN/FR/JA/KO.
   - Local: upload file trực tiếp vào worker.
4. Chọn **AI plan** hoặc **Manual cut**. Your instruction đã có sẵn yêu cầu editor chi tiết, vẫn có thể sửa.
5. Sau khi Generate/Apply plan, preview chỉ phát các đoạn đã chọn của part đang mở, bỏ qua khoảng footage bị loại, ở tốc độ 1.25×. Thanh seek là timeline đã cắt; timestamp trong edit plan vẫn theo source.
6. Bấm **Render 2 MP4 files** rồi tải Part 1 / Part 2 khi progress đạt 100%. Tên file: `TITLE GỐC | TITLE MỚI.mp4` (giữ Unicode; thay dấu slash và giới hạn tên quá dài theo filesystem).

Nếu YouTube không có subtitle hoặc endpoint subtitle bị giới hạn, video vẫn được chuẩn bị bình thường; chuyển sang **Manual cut** và nhập mỗi đoạn theo format:

```text
00:10 - 00:24 Hook
01:08 - 01:42 Main reveal
```

Edit plan luôn lưu timestamp gốc. Ví dụ source cut 10 giây sẽ còn khoảng 8 giây sau bước speed-up 1.25×.

## ChatGPT plan — không cần API key

Trong tab **AI plan**, bấm **Continue with ChatGPT**. App mở OAuth chính thức của OpenAI bằng Authorization Code + PKCE; nếu account Plus / Pro đủ điều kiện và cấp quyền plan usage, worker sẽ dùng Responses API để tạo edit plan.

Access token và refresh token chỉ được lưu trong **macOS Keychain** bởi media worker local. Token không được đưa vào source, `.env`, localStorage hay website đã deploy. Không muốn đăng nhập thì chọn Mock hoặc dùng Manual cut.

Chi tiết kỹ thuật và xử lý lỗi nằm trong [`docs/AI_PROVIDERS.md`](docs/AI_PROVIDERS.md).

## Render preset

- Canvas: 1080×1920, 30 fps, H.264 + AAC, Rec.709 limited-range metadata để màu nhất quán với Premiere/QuickTime.
- macOS Apple Silicon: encode bằng Apple VideoToolbox; tự fallback về `libx264` nếu hardware encoder không khả dụng.
- Color grade mặc định: contrast 1.04, saturation 1.06; có thể chỉnh bằng `FFMPEG_CONTRAST` và `FFMPEG_SATURATION`.
- Main video: native 100%, frame 1080×1080 tại `y=360`, center crop ngang, không kéo méo.
- Background: cùng source, scale cover, blur tương đương 50 px trên proxy 1/4-size, opacity 50% trên nền đen để render nhanh hơn mà không đổi layout.
- Original title: sát cạnh trên của main video.
- New part title: sát cạnh dưới và nổi bật nhất.
- Part indicator: `1/2`, `2/2` ở bottom safe area.
- Text: pure white fill, no outline, two-layer white/cool-white glow and three independent dark shadows. Preview allows effects beyond the text box; export bakes every layer into the title PNG.
- Batch video cards include a confirmed Delete action for finished/failed/stopped items. It moves only that render job's outputs into `worker-data/trash/renders` for recovery, removes the card, and cancels pending auto-download requests. Sources and browser Downloads are untouched; active jobs cannot be deleted.
- Batch history/results are persisted in `worker-data/batch-history.json` so older videos remain available for manual download/deletion after launching a new batch or reopening the app. Interrupted work is marked stopped, not silently resumed.
- The batch tab includes a small portrait preview with native playback/seek controls. Select View Part on any completed output; it plays the actual cut/rendered MP4 (including the final 1.25× speed), never the uncut source. Preview requests use inline video responses; download links remain attachments.
- Final publishing titles/copy text include the part suffix: `Original title | New title (1/2)` or `(2/2)`. Short language-code export filenames are unchanged.

## Muse — copy/dán JSON, không Meta API

Trong **Chỉnh từng video → AI plan**, chọn **Muse · copy / dán JSON**. Bấm **Tạo prompt cho Muse** để chuẩn bị source và tạo prompt gồm transcript, quy tắc hiện tại, title gốc, thời lượng, mã source và JSON schema. **Copy prompt**, mở Muse, tự đăng nhập nếu cần và gửi prompt. App không tự gửi dữ liệu tới Muse, không đọc cookie/credential và không gọi API trả phí.

Dán JSON Muse trả về (hoặc toàn bộ khối code `json`) vào **JSON kết quả từ Muse**, rồi bấm **Kiểm tra và áp dụng 2 part**. Kết quả phải đúng source/title, có đúng 2 part, DE/EN/FR/JA/KO, 10 hashtag khác nhau mỗi part, timestamp dạng số giây theo source gốc và không vượt thời lượng video. Nội dung chính giữ đúng thứ tự, không chồng nhau. JSON sai không thay đổi plan hiện tại. Không tự sửa/sắp xếp/lược bỏ timestamp sai. Nếu đổi source, transcript hoặc instruction, tạo/gửi lại prompt mới. Preview, title sau cùng, tên file và render 1.25× sử dụng workflow hiện có.

Muse chỉ hỗ trợ từng video; hàng loạt tự động dùng ChatGPT và không tự fallback khi đang chọn Muse/Gemini. Token thưởng trong Muse không được coi là credit Meta Model API. App không đảm bảo chất lượng/chính xác nội dung AI; hãy xem lại hook và preview trước khi render.

Quy tắc AI mặc định yêu cầu **mỗi part trên 1 phút sau khi bỏ 1 giây đầu và xuất ở 1.25×**: tổng segment phải hơn 76 giây source/part. Nếu part/source quá ngắn, AI được chọn footage thật phù hợp từ bất kỳ vị trí nào trong source, kể cả lặp lại, và ghép vào CUỐI với `isPadding: true` + lý do. Nội dung chính (`isPadding: false`) vẫn giữ timeline và nằm trước mọi đoạn bổ sung. Không tạo lời nói/chi tiết giả hoặc timestamp vượt source. UI đánh dấu footage bổ sung; preview/render phát đúng thứ tự ghép, kể cả đoạn lặp. Kết quả AI chưa đủ thời lượng bị từ chối; Manual cut vẫn cho phép cắt ngắn bằng tay.

Trong **Chỉnh từng video**, render được theo dõi ở danh sách riêng, không phụ thuộc ô source đang mở. Khi video 1 render, có thể chuẩn bị source và chia part video 2; render video 2 vào hàng chờ FIFO chung. Mỗi tác vụ giữ bản chụp title gốc, title sau cùng `Title gốc | Title mới (1/2)` / `(2/2)`, hashtag, tiến độ, nút dừng và tải từng part. Lịch sử được lưu ở worker nên tải lại trang vẫn còn; đóng app sẽ dừng tác vụ đang chạy (không tự resume), giữ các file đã hoàn tất.

Danh sách render có nút **Huỷ render** riêng cho video đang chạy/chờ, và **Xoá** cho tác vụ đã kết thúc. Xoá chuyển thư mục các Part vào Thùng rác, giữ video gốc và Downloads; khôi phục sẽ đưa tác vụ trở lại danh sách cùng title/hashtag. Khi đang huỷ, chờ FFmpeg dừng hẳn mới được xoá. Nút copy phản hồi riêng cho mỗi part bằng check xanh + “Đã copy!”; lỗi clipboard có thông báo rõ ràng.

Tất cả nút copy dùng chung `CopyButton`: kết quả part đang sửa, danh sách render, title/hashtag trong hàng loạt và prompt Gemini/Muse. Phản hồi riêng từng nút (đang copy → check xanh “Đã copy!” → trở lại sau 2,5 giây), có thông báo nếu clipboard bị chặn; đổi nội dung/part không hiển thị nhầm trạng thái thành công của nội dung trước.

Tên xuất tăng riêng theo ngôn ngữ **trong một phiên app**: `de1/de2`, `de11/de22`, `de111/de222`… Tắt hẳn app và mở lại sẽ reset mọi ngôn ngữ về cặp đầu tiên; chỉ refresh/đóng tab không reset. File và lịch sử cũ không đổi tên/không bị ghi đè (mỗi job có thư mục UUID riêng). Trình duyệt có thể thêm `(1)` vào tên trong Downloads khi gặp tên trùng; app không xoá bản tải cũ.

AI tạo đúng **10 hashtag** mỗi part, kết hợp tag nội dung cụ thể, tag chủ đề lớn và tag trending/discovery phù hợp thị trường. Không gắn tag không liên quan hoặc giả vờ đã kiểm chứng độ trending thời gian thực. Preview và mọi render (từng video/hàng loạt) bỏ đúng 1 giây source ở đầu mỗi part, không ở đầu mọi segment và không sửa timestamp trong plan gốc.

Logo dùng chung một vector `public/favicon.svg`: khung video dọc + nút play, hai cạnh ngắt gợi đường cắt, nền coral gradient. Header và favicon dùng trực tiếp vector này; bản build tạo icon `.icns` cùng mẫu và trích nhóm `studio-mark` thành icon template đơn sắc cho menu bar macOS (tự theo light/dark mode).

## Gemini Pro — copy/dán JSON trên Gemini web

Chọn **Gemini Pro · copy / dán JSON** trong tab chỉnh từng video. Workflow giống Muse: **Tạo prompt cho Gemini Pro → Copy prompt → Mở Gemini Pro → dán JSON kết quả → Kiểm tra và áp dụng 2 part**. Nút mở dẫn tới `https://gemini.google.com/app`; tự đăng nhập tài khoản Google AI Pro và chọn model Pro trong Gemini web. App không tự gửi prompt, không đọc tài khoản/token/quota web, không cần API key và không có API fallback.

Dùng cùng schema và kiểm tra timestamp/title/sourceId/10 hashtag/thời lượng như Muse. Đổi provider làm prompt cũ hết hiệu lực; phải tạo prompt mới trước khi copy hoặc nhập JSON. Gemini web chỉ hỗ trợ từng video, không chạy hàng loạt tự động. ChatGPT vẫn hoạt động độc lập như trước.

Kết nối Antigravity đã bị tắt: không polling phiên/quota, không chạy `agy`, không mở Terminal và không đóng gói CLI trong app mới. Các endpoint `/api/gemini/*` cũ trả thông báo chuyển sang copy/dán, không gọi dịch vụ khác. Giữ nguyên credential/profile cũ trên máy, không đăng xuất hay xoá tài khoản IDE. Adapter và bài kiểm thử cũ được giữ trong source để tham khảo, không còn được worker sử dụng.

## macOS one-click app (Apple Silicon)

Run `npm run package:mac` to produce `release/ShortCut Studio.app`. Double-click it in Finder: the bundled production server and media worker start, then the default browser opens at `http://127.0.0.1:5173/`. The menu-bar film icon provides Open, View Log, and Quit; Quit asks before stopping any render. Closing the browser tab does not stop the app.

The bundle includes Node, FFmpeg/ffprobe (VideoToolbox enabled), their non-system dynamic libraries, and official standalone macOS yt-dlp. No Terminal/npm/Homebrew/Python setup is needed to launch the completed bundle. This is an ad-hoc-signed personal build, not a notarized public release. Apple Silicon only; moving it to a different Mac may require macOS approval for an unsigned developer.

Media is never copied into the app bundle. On this machine it continues using the existing project `worker-data`; if that directory is unavailable, it uses `~/Library/Application Support/ShortCut Studio/media`. Logs are in `~/Library/Logs/ShortCut Studio/launcher.log`. No credentials or media exports are bundled. Render/source data is not automatically purged; moving outputs to the recovery folder does not free disk space.

### Portable build for macOS 26 (Apple Silicon)

```bash
npm run setup:macos26
npm run package:macos26
```

This creates an additional `release/macos-26/ShortCut Studio.app` and `release/macos-26/ShortCut-Studio-macOS26-AppleSilicon.zip`, preserving the existing app in `release/`. Send the ZIP, extract using Finder, then move the app into Applications. The portable build always stores new media in the receiving Mac's Application Support folder; it does not reference the developer's project directory.

The build uses checksum-verified official Node 24 and Homebrew macOS 26 (or older compatible) FFmpeg bottles, including their dependencies. Before signing, it rejects native binaries without arm64, with minimum macOS greater than 26.0, or with unbundled Homebrew dependencies. `Contents/Resources/compatibility-report.json` records the audit; `licenses/` records runtime provenance and available bundled license notices. The default `package:mac` uses the host's runtime and declares that host's major macOS version; changing Info.plist alone cannot make those binaries backwards-compatible. Both builds are ad-hoc signed, not Apple-notarized. Testing on a newer host does not substitute for testing on macOS 26.
- Font title: Noto Sans (EN/FR/DE), Noto Sans JP và Noto Sans KR được đóng gói local; original title Bold 700, part title ExtraBold 800. Tự chọn theo script của từng title, fallback cùng họ Noto cho nội dung trộn ngôn ngữ.
- Mỗi part có TITLE SAU CÙNG = title gốc + ` | ` + title mới, cùng đúng 10 hashtag do ChatGPT tạo từ nội dung được giữ lại.
- File tải xuống dùng mã ngôn ngữ/quốc gia: ko→kr, ja→jp, en→us, de→de, fr→fr. Video đầu: kr1/kr2.mp4; video thứ hai: kr11/kr22.mp4; thứ ba: kr111/kr222.mp4. Bộ đếm riêng theo mã, lưu qua restart. Lượt đã bắt đầu rồi bị dừng vẫn chiếm số đó; không đổi tên file đã xuất trước đây.
- Hàng đợi personal: nhập tối đa 20 link YouTube, tự tải/transcript → ChatGPT chia part → render. Chuẩn bị source tiếp theo song song với render; render jobs chạy tuần tự. Link lỗi không chặn link tiếp theo. Có thể refresh/đóng tab và quay lại cùng trình duyệt; giữ worker chạy vì hàng đợi nằm trong RAM và mất khi restart. File đã render vẫn nằm trên ổ đĩa.
- Mỗi lần có thể thêm tối đa 20 link. Sau khi worker nhận thành công, ô nhập tự xoá; lỗi thì giữ nguyên link. Có thể paste thêm và bấm **Thêm vào hàng đợi đang chạy** ngay khi lượt trước còn tải/AI/render: link mới nối cuối cùng một hàng đợi, giữ nguyên các video/kết quả cũ và tự tải output như bình thường. Từng lần thêm giữ quy tắc chia part tại thời điểm gửi. Một hàng đợi chỉ có một luồng chuẩn bị và một render mỗi lần; nút Dừng áp dụng cho cả link mới thêm. Link vừa gõ/paste trong lúc request đang chờ không bị xoá nhầm.
- Tab Xử lý hàng loạt có Dừng hàng đợi: hủy tải/ChatGPT/render đang chạy và các link chờ; giữ file đã xuất hoàn tất. Tab chỉnh từng video có Dừng render. Pipeline thu gọn mặc định.
- Mỗi part hoàn tất được tự gửi yêu cầu tải xuống lần lượt khi trang còn mở. Lịch sử yêu cầu lưu theo output để refresh không tự tải trùng. Trình duyệt có thể chặn tải nhiều file; thông báo chỉ xác nhận đã gửi yêu cầu, không khẳng định file đã lưu. Luôn có nút Tải lại từng part. Khi đóng trang, worker vẫn render; mở lại sẽ yêu cầu tải những output chưa từng được yêu cầu.
- Final pass: `setpts=PTS/1.25` và `atempo=1.25` để audio giữ pitch tự nhiên.

## Thùng rác & kho video

Tab **Thùng rác** có ba nhóm: **Video gốc**, **Part đã render**, **Trong thùng rác**. Có tìm theo title/tên file, xem trước, tải file, chọn nhiều mục và chuyển vào thùng rác. Các file gốc và Part được xử lý riêng: chuyển nguồn không xoá Part, chuyển Part không xoá nguồn. Kho hiện tại ở Application Support (app portable), hoặc `MEDIA_WORKER_DATA_DIR` (dev); app cũng nhận diện kho cũ `~/Documents/tiktok-edit/short-video-studio/worker-data` nếu còn tồn tại. Không di chuyển dữ liệu cũ tự động. Có thể thay bằng `MEDIA_WORKER_LEGACY_DATA_DIR`, hoặc tắt bằng `MEDIA_WORKER_DISABLE_LEGACY=1`.

Chuyển vào thùng rác giữ nguyên file và thông tin vị trí cũ, chưa giải phóng dung lượng. **Khôi phục** đưa file về vị trí cũ, không ghi đè file đã tồn tại. **Xoá vĩnh viễn** cần xác nhận, chỉ xoá các mục được chọn trong `trash/media` hoặc các bộ Part đã xoá trước đây trong `trash/renders`. Nút Chọn tất cả áp dụng tối đa 500 mục đang hiển thị sau bộ lọc tìm kiếm; xoá gốc không ảnh hưởng source code, tài khoản, Downloads hay những video khác. Không xoá tự động sau render. Video đang tải, phân tích, render hoặc đang dừng không được chuyển/xoá; thao tác file khoá source để không bắt đầu render mới giữa lúc di chuyển file.

Kho video chỉ nhận file nguồn `source.*` và các MP4 trong `outputs/<job>/part-1|part-2`, với ID/thư mục được kiểm tra. Không nhận đường dẫn tùy ý từ client, không đi theo symlink. API kho chỉ chấp nhận trình duyệt từ origin local; thao tác ghi yêu cầu JSON. Khôi phục các bộ Part từ nút Xoá trong hàng đợi có thể đưa card và đường dẫn tải về lại lịch sử; không yêu cầu tải tự động lại những Part đã từng được gửi yêu cầu tải.

## Tải YouTube và cookie local

Metadata, transcript và tải video tự fallback từ yt-dlp sang YouTube.js. Khi có cấu hình cookie, app thử thêm lượt có xác thực; metadata còn có oEmbed làm phương án cuối. Mỗi lượt có timeout và retry hữu hạn. Chỉ lưu source sau khi kiểm tra hình, âm thanh và thời lượng; file tải dở/cookie tạm được xoá khi chuyển phương án. Những request đang chạy cho cùng một video dùng chung lượt tải, không tải trùng. Không áp dụng fallback vào AI hoặc render.

Không cần đăng nhập Google trong app. Trong thư mục project, cấu hình trình duyệt đã đăng nhập YouTube:

```bash
npm run youtube:cookies -- --browser chrome
# hoặc
npm run youtube:cookies -- --browser firefox
# Chrome có nhiều profile: --browser 'chrome:Profile 1'
```

App chỉ đọc cookie trình duyệt khi cần lượt fallback xác thực. macOS có thể yêu cầu quyền Keychain; Chrome có thể khoá kho cookie, nên thử đóng trình duyệt hoặc dùng Firefox. Không tự quét mọi trình duyệt/profile.

Nếu cần file cookie thủ công, dùng file Netscape từ công cụ đáng tin cậy, lưu local, không gửi vào AI/chat hoặc đưa lên GitHub:

```bash
npm run youtube:cookies -- --file '/đường/dẫn/cookies.txt'
# Bỏ cấu hình và xoá bản sao riêng của app:
npm run youtube:cookies -- --clear
```

Mặc định các lệnh trên cấu hình bản Applications, lưu tại `~/Library/Application Support/ShortCut Studio/media/youtube-download.json`. File cookie riêng của app có quyền `0600`, thư mục `0700`; cookie được lưu local, không mã hoá ổ đĩa riêng và không xuất hiện trong log/thông báo. Dev dùng `MEDIA_WORKER_DATA_DIR=/đường/dẫn/worker-data` trước lệnh cấu hình. Có thể dùng env `YOUTUBE_COOKIES_FROM_BROWSER` hoặc `YOUTUBE_COOKIES_FILE` (đường dẫn tuyệt đối); không truyền giá trị cookie qua env/command line. Cấu hình được đọc lại mỗi lần tải, không cần restart.

Nếu cả hai downloader bị YouTube từ chối, app báo từng phương án bằng nguyên nhân đã lọc và hướng dẫn kiểm tra mạng/quyền truy cập/cookie. YouTube.js và cookie **không đảm bảo vượt xác minh bot, giới hạn khu vực hoặc quyền truy cập video**. Chỉ tải nội dung bạn có quyền sử dụng. Tài liệu: [YouTube.js authentication](https://ytjs.dev/guide/authentication), [yt-dlp cookie FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp).

## Kiểm tra code

```bash
npm run lint
npm run build
```
