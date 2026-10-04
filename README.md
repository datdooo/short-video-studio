# ShortCut Studio

Personal tool để biến video dài thành 2 video dọc 1080×1920. App có hai chế độ chọn nội dung:

- **AI plan**: dùng transcript có timestamp với OpenAI, Qwen hoặc mock mode.
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
2. Bấm **Chuẩn bị source để render**.
   - YouTube: tải video tối đa 1080p, title gốc và thử lấy subtitle DE/EN/FR/JA/KO.
   - Local: upload file trực tiếp vào worker.
3. Chọn **AI plan** hoặc **Manual cut**.
4. Kiểm tra 2 Part và title trong portrait preview.
5. Bấm **Render 2 MP4 files** rồi tải Part 1 / Part 2 khi progress đạt 100%.

Nếu YouTube không có subtitle hoặc endpoint subtitle bị giới hạn, video vẫn được chuẩn bị bình thường; chuyển sang **Manual cut** và nhập mỗi đoạn theo format:

```text
00:10 - 00:24 Hook
01:08 - 01:42 Main reveal
```

Edit plan luôn lưu timestamp gốc. Ví dụ source cut 10 giây sẽ còn khoảng 8 giây sau bước speed-up 1.25×.

## AI provider

Trong tab **AI plan**, chọn OpenAI hoặc Qwen rồi paste API key vào ô ngay bên dưới. Key được lưu trong localStorage của trình duyệt đó và chỉ gửi tới API route khi bấm **Generate 2-part plan**.

Không muốn nhập key thì chọn Mock hoặc dùng Manual cut. Cấu hình `.env.local` vẫn được hỗ trợ như một tùy chọn nâng cao, nhưng không bắt buộc cho workflow cá nhân.

## Render preset

- Canvas: 1080×1920, 30 fps, H.264 + AAC.
- Main video: native 100%, frame 1080×1080 tại `y=360`, center crop ngang, không kéo méo.
- Background: cùng source, scale cover, blur 50, opacity 50% trên nền đen.
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
