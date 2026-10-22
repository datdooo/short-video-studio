# FFmpeg 9: filter graph argument

## Bằng chứng

Log launcher DEV xác nhận executable: release/dev/ShortCut Studio Dev.app/Contents/Resources/runtime/bin/ffmpeg. desktop/bootstrap.mjs đặt FFMPEG_PATH và runtime/bin đứng đầu PATH. worker/server.mjs resolve theo configured env -> PATH -> /opt/homebrew/bin/ffmpeg -> /usr/local/bin/ffmpeg (chỉ chọn file tồn tại). Packager bình thường lấy FFMPEG_PATH hoặc which ffmpeg; không tải bản mới trong lượt này.

Capability kiểm tra chỉ version/help và parsing option, không có media input/output: cả binary trong app và /opt/homebrew/bin/ffmpeg đều là 9.0.2, cấu hình Cellar ffmpeg/9.0.2_1. `-h full` có -filter_complex <graph_description>, không có filter_complex_script. Help lưu tạm tại /tmp/shortcut-bundled-ffmpeg-help.txt và /tmp/shortcut-homebrew-ffmpeg-help.txt.

Tài liệu CLI cài kèm /opt/homebrew/share/man/man1/ffmpeg.1 (đoạn khoảng 909) quy định thêm / ngay sau dấu - để đọc giá trị option từ file. Đã xác minh bằng lời gọi `[binary, -hide_banner, -/filter_complex, /tmp/shortcut-ffmpeg-capability-missing.ffgraph]` với đường dẫn được kiểm tra không tồn tại: cả hai binary trả “Error reading the value for option filter_complex from file”. Đây là kiểm tra bộ đọc option trước media, không decode/render và không tạo file. Nó chứng minh cú pháp đọc file được executable chấp nhận, không chứng minh filter graph chạy thành công.

## Sửa

worker/server.mjs::renderPart/buildArgs: `-filter_complex_script, filterGraphPath` -> `-/filter_complex, filterGraphPath`.
worker/music-preview.mjs: đổi tương tự cho graph audio preview.

Graph vẫn được ghi nguyên `renderFilters.join(";")` / `filters.join(';')`, không sửa nội dung graph. Giữ graph trong file để tránh giới hạn argv cho video nhiều đoạn/ducking dài. runCommand truyền binary + array qua child_process.spawn, không shell và không thêm dấu quote vào path/graph. Editor hai part, batch và resume đều đi qua renderPart này. Đã tìm toàn bộ source runtime: không còn caller filter_complex_script; các caller filter_complex trực tiếp khác được giữ nguyên.

Không đổi transition, foreground geometry/zoom, captions, BGM/ducking, preview/export speed, encoder hay bitrate/output settings. Các sửa draft/playback/AI/citation trước đó giữ nguyên.

## Bảo toàn dữ liệu khi lỗi

Render có scratch riêng được đánh dấu sourceId/jobId. finally dọn graph/range input và scratch của job; chỉ publish MP4 sau verify, không ghi đè output đã có. executeRender giữ các output part hoàn tất cho resume. Audio preview tạo .preview-UUID.m4a và graph riêng, rename cache chỉ khi chạy thành công; finally chỉ dọn tmp/graph/range inputs của tác vụ. Không thêm cleanup rộng, không sửa/xóa source, plan, media, exports hoặc backups trong lượt này.

Chưa render thử hoặc nghiệm thu hình/âm. Không chạy test suite, AI hoặc tải video. Build/package được thực hiện sau khi người dùng lưu và thoát app DEV, chỉ cập nhật bundle cố định; không tạo Review mới, không push/merge.

## Package cập nhật

Đã build/package một lần thành công vào app DEV cố định sau khi xác nhận app đã thoát. 6 module trong package khớp hash source trước build, gồm cả citation/parser trước đó; hai caller dùng -/filter_complex, không còn filter_complex_script. Binary đóng gói mới vẫn là FFmpeg 9.0.2 và capability đọc option từ file được xác nhận không dùng media. DEV config giữ nguyên. Native audit/sign guards hoàn tất. Log: /tmp/shortcut-dev-ffmpeg-filter-build.log. Không mở app, render thử, test hoặc AI; chưa nghiệm thu render.
