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
- Text: white fill, thick red stroke, soft red glow, dark shadow.
- Font mapping: Latin / Japanese / Korean theo dominant script với system fallback.
- Final pass: `setpts=PTS/1.25` và `atempo=1.25` để audio giữ pitch tự nhiên.

## Kiểm tra code

```bash
npm run lint
npm run build
```
