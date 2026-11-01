# Timeline Beta — source implementation

- Dùng trực tiếp @xzdarcy/react-timeline-editor@1.0.0 (MIT), package-lock pin integrity. Repo https://github.com/xzdarcy/react-timeline-editor; license gốc giữ tại docs/licenses/react-timeline-editor-MIT.txt. Không copy code OpenCut/Remotion; OpenCut chỉ tham khảo hành vi selection/trim/undo.
- Thư viện xử lý ruler, zoom, virtualized tracks, drag-resize/autoscroll. Adapter components/cut-timeline.tsx nối source time với presentationSegments/preview1x. Không đổi render engine, không chạy player riêng hoặc tạo decoder/thumbnails.
- Teaser/Main hai hàng, main nối tiếp đúng thứ tự nguồn. Padding/still hiển thị nhưng không kéo. Không cho đảo clip/track tùy ý. Chỉ part đang chọn/Editor đang hiện được mount timeline.
- Kéo chỉ có draft hình học trong library; thả mới inspectMainRanges/applyMainRanges hoặc adjustTeaserRange/validateTeaser + handler teaser dùng chung với ô nhập. Giữ precision cạnh không chỉnh, không bật snap mặc định. Manual teaser vẫn được ngoài main theo policy Beta.
- Escape remount/hủy gesture; source/part/key đổi chặn gesture cũ. Seek tối đa một lần mỗi animation frame, callback pending hủy khi unmount.
- Undo/Redo tối đa50 command ở timeline hiện tại; main undo qua applyMainRanges bảo toàn cơ chế retention hiện có, không hoàn tác style/metadata khác. Teaser undo qua đúng validation/provenance snapshot cũ. Chỉnh ngoài timeline đổi context sẽ xóa lịch sử cục bộ; đổi part/unmount cũng vậy. Không tuyên bố lịch sử undo này được lưu qua restart.
- Danh sách timecode, Apply/validation, draft Main/Teaser, AI candidate review vẫn giữ. Nguồn/file/clock1x/export1.25x/model/prompt không đổi.
- app/page.tsx: tách nguyên handler applyEditorTeaser để cả timeline và TeaserEditor dùng chung. components/main-ranges-editor.tsx dùng cùng hàm edit/draft; CSS giới hạn trong timeline.
- Build1117 chỉ cập nhật release theo yêu cầu sau; không sửa Applications. Không test, lint/typecheck riêng, browser QA, AI hoặc render. Chỉ đọc source/diff và cài package với --ignore-scripts. Peer package React>=18, react-virtualized resolved9.22.6 khai báo React19; chưa xác minh runtime.

## Giới hạn cần nghiệm thu
- Chưa có thumbnail/waveform, track nhạc/phụ đề hoặc kéo đổi thứ tự. Đây là timeline chỉnh Teaser/Main, không thay toàn bộ Premiere.
- Clip sát đầu sequence không kéo sang phần thời gian âm; dùng ô timecode để mở rộng đầu nguồn ở trường hợp đó.
- Cần thử cả hai part: zoom/seek/Space, kéo mép hợp lệ/sai gap/source/duration, Escape, undo/redo, đổi source/part giữa gesture/async, nhập timecode dở/IME rồi kéo phải bị chặn, lưu/reload draft.
- Kiểm tra desktop packaging và license closure khi người dùng yêu cầu build sau.
