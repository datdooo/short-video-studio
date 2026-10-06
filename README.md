# ShortCut Studio

Personal tool để biến video dài thành 2 video dọc 1080×1920. App có hai chế độ chọn nội dung:

- **AI plan**: đăng nhập ChatGPT Plus / Pro bằng OAuth chính thức, hoặc dùng mock mode.
- **Manual cut**: nhập timestamp trực tiếp, không gọi AI và không cần subtitle.

Sau khi cắt/ghép, worker dựng background blur, giữ main video ở native 100% và center-crop phần tràn ngang, thêm typography social-video, rồi mới tăng tốc video + audio lên 1.25×.

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

Muse chỉ hỗ trợ từng video; hàng loạt tự động vẫn dùng ChatGPT hoặc Antigravity và không tự fallback khi đang chọn Muse. Token thưởng trong Muse không được coi là credit Meta Model API. App không đảm bảo chất lượng/chính xác nội dung AI; hãy xem lại hook và preview trước khi render.

Quy tắc AI mặc định yêu cầu **mỗi part trên 1 phút sau khi xuất ở 1.25×**: tổng segment phải hơn 75 giây source/part. Nếu part/source quá ngắn, AI được chọn footage thật phù hợp từ bất kỳ vị trí nào trong source, kể cả lặp lại, và ghép vào CUỐI với `isPadding: true` + lý do. Nội dung chính (`isPadding: false`) vẫn giữ timeline và nằm trước mọi đoạn bổ sung. Không tạo lời nói/chi tiết giả hoặc timestamp vượt source. UI đánh dấu footage bổ sung; preview/render phát đúng thứ tự ghép, kể cả đoạn lặp. Kết quả AI chưa đủ thời lượng bị từ chối; Manual cut vẫn cho phép cắt ngắn bằng tay.

## Antigravity / Gemini Pro / Google AI Pro

Select **Antigravity · Gemini Pro** in editor or batch mode, then click **Kết nối Antigravity**. The official native `agy` CLI replaces the retired Gemini CLI consumer login. An existing Google session is reused; otherwise Terminal opens for the user to complete Antigravity's sign-in/onboarding (including any Google consent). No API key, browser cookie extraction, or separately billed API fallback is used. The model is pinned to `gemini-3.1-pro-high`; quotas and availability are determined by Google. The UI displays Gemini's actual remaining quota/reset time. An exhausted quota blocks generation before the transcript is submitted. ChatGPT remains independently available.

Antigravity manages credentials in its native Keychain/session store. This app does not read/copy tokens. **Ngắt app** unlinks ShortCut Studio only; it does not log out the shared Antigravity/IDE account. Sign out from Antigravity itself with `/logout` if desired. Old Gemini credentials are not migrated or deleted. Each analysis uses stdin, structured JSON output and a dedicated primary agent in a separate workspace under `worker-data/antigravity-profile/workspace`. An official workspace PreToolUse hook denies every external tool action (only inert `finish` is allowed); no `--dangerously-skip-permissions`. Slash-command expansion is disabled for supplied transcripts. The adapter checks `/config` and refuses API-provider or enabled AI-credit fallback settings; it does not modify shared global preferences. Real AI generation needs an authenticated account with quota available.

The packaged Mac app includes the official Antigravity CLI. For source development, run `npm run install:antigravity` first (Google download + SHA512 verification; no shell-profile changes). Override the binary path with `ANTIGRAVITY_CLI_PATH` if needed. The old `gemini` provider ID and `/api/gemini/*` URLs remain for compatibility; the implementation uses Antigravity exclusively.

## macOS one-click app (Apple Silicon)

Run `npm run package:mac` to produce `release/ShortCut Studio.app`. Double-click it in Finder: the bundled production server and media worker start, then the default browser opens at `http://127.0.0.1:5173/`. The menu-bar film icon provides Open, View Log, and Quit; Quit asks before stopping any render. Closing the browser tab does not stop the app.

The bundle includes Node, FFmpeg/ffprobe (VideoToolbox enabled), their non-system dynamic libraries, and official standalone macOS yt-dlp. No Terminal/npm/Homebrew/Python setup is needed to launch the completed bundle. This is an ad-hoc-signed personal build, not a notarized public release. Apple Silicon only; moving it to a different Mac may require macOS approval for an unsigned developer.

Media is never copied into the app bundle. On this machine it continues using the existing project `worker-data`; if that directory is unavailable, it uses `~/Library/Application Support/ShortCut Studio/media`. Logs are in `~/Library/Logs/ShortCut Studio/launcher.log`. No credentials or media exports are bundled. Render/source data is not automatically purged; moving outputs to the recovery folder does not free disk space.
- Font title: Noto Sans (EN/FR/DE), Noto Sans JP và Noto Sans KR được đóng gói local; original title Bold 700, part title ExtraBold 800. Tự chọn theo script của từng title, fallback cùng họ Noto cho nội dung trộn ngôn ngữ.
- Mỗi part có TITLE SAU CÙNG = title gốc + ` | ` + title mới, cùng đúng 10 hashtag do ChatGPT tạo từ nội dung được giữ lại.
- File tải xuống dùng mã ngôn ngữ/quốc gia: ko→kr, ja→jp, en→us, de→de, fr→fr. Video đầu: kr1/kr2.mp4; video thứ hai: kr11/kr22.mp4; thứ ba: kr111/kr222.mp4. Bộ đếm riêng theo mã, lưu qua restart. Lượt đã bắt đầu rồi bị dừng vẫn chiếm số đó; không đổi tên file đã xuất trước đây.
- Hàng đợi personal: nhập tối đa 20 link YouTube, tự tải/transcript → ChatGPT chia part → render. Chuẩn bị source tiếp theo song song với render; render jobs chạy tuần tự. Link lỗi không chặn link tiếp theo. Có thể refresh/đóng tab và quay lại cùng trình duyệt; giữ worker chạy vì hàng đợi nằm trong RAM và mất khi restart. File đã render vẫn nằm trên ổ đĩa.
- Tab Xử lý hàng loạt có Dừng hàng đợi: hủy tải/ChatGPT/render đang chạy và các link chờ; giữ file đã xuất hoàn tất. Tab chỉnh từng video có Dừng render. Pipeline thu gọn mặc định.
- Mỗi part hoàn tất được tự gửi yêu cầu tải xuống lần lượt khi trang còn mở. Lịch sử yêu cầu lưu theo output để refresh không tự tải trùng. Trình duyệt có thể chặn tải nhiều file; thông báo chỉ xác nhận đã gửi yêu cầu, không khẳng định file đã lưu. Luôn có nút Tải lại từng part. Khi đóng trang, worker vẫn render; mở lại sẽ yêu cầu tải những output chưa từng được yêu cầu.
- Final pass: `setpts=PTS/1.25` và `atempo=1.25` để audio giữ pitch tự nhiên.

## Kiểm tra code

```bash
npm run lint
npm run build
```
