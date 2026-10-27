# Beta: chuyển lại bản gửi AI tối đa 480p

- Checkpoint build 1114: đóng gói bản tải YouTube tối đa 480p; chưa nghiệm thu runtime.
- YouTube: dùng downloader review hiện có, chọn rendition cao nhất không vượt 480p. Sao chép video stream, giữ soundtrack nguồn đã quản lý và kiểm tra timeline; không encode lại hình ảnh 1080p. Tải lỗi báo lỗi, không âm thầm fallback nén nguồn.
- Local video: không có rendition để tải; chỉ đường này tạo derivative tối đa 480p, hai thread, một encode.
- Cache version v5 tách bản 1080p nén cũ. Giữ cache/file cũ nguyên vẹn; tái sử dụng bản 480p mới sau lần chuẩn bị đầu.
- TXT v13 mô tả đúng bản gửi, không chờ tải/encode video. Tải TXT mới để đồng bộ mô tả.
- Giữ nguồn edit/render, source binding, plan/draft, giới hạn 512 MiB, kiểm tra duration/timing/audio/aspect, cancel và streaming native.
- Giai đoạn tải rendition chưa có mẫu số telemetry: hiển thị bước/thời gian, không bịa %. Truyền về trình duyệt dùng byte progress có sẵn; local encode dùng output time.
- Chưa tải video, gọi AI, render, test, build hoặc nghiệm thu runtime; chưa đo thời gian trước/sau. DEV không thay đổi.
