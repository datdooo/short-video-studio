# Beta: trả Timeline về dạng nhập mốc, manual teaser tự do

## Source changes
- Bỏ CutTimeline/component và dependency @xzdarcy/react-timeline-editor. app/page/MainRangesEditor quay về cấu trúc trước1117, giữ các sửa source/download trước đó. Không reset Git hoặc plan/draft. License/docs lịch sử giữ nguyên.
- lib/custom-teaser.mjs bỏ trần9s khi parse timestamp thủ công. lib/teaser-hooks.mjs validateTeaser và teaserReadiness chỉ áp min/max duration cho AI/fallback/external-import, không áp manual.
- Manual vẫn phải đúng source, timestamp hữu hạn và0≤start<end≤sourceDuration; không snap, đổi mốc, mở rộng main hoặc giữ binding AI cũ. Không ràng buộc main/gap/exclusions hoặc speech semantics. checkHookSpeechBoundaries sẵn bỏ qua manual; bỏ cảnh báo speech-end/context trong UI manual.
- Shared validator dùng bởi Apply, restore/session, preview presentationSegments, job snapshots và worker plan validation. Giữ nguyên giới hạn9s và evidence/citation/speech/range cho AI. Không thay model/reasoning/request policy.
- Timeline bỏ dòng preview/maxduration, cảnh báo biên lời nói, khoảng bị loại, tổng main và hướng dẫn timestamp. Giữ tên trường/nút thao tác. Lỗi range/draft/chọn AI/progress đưa bằng portal xuống StudioRenderStatus thanh dưới cùng; chi tiết thu gọn. Validation và điều kiện chặn export không bị ẩn để pass.

## Package/runtime
- Build1118 chỉ cập nhật release theo yêu cầu; Applications1116 giữ nguyên. Không test/lint/typecheck riêng/AI/render/browser QA. DEV và dữ liệu giữ nguyên. Chưa nghiệm thu runtime.
- Cần thử tay: manual>9s và<minimum AI, ngoài main, cắt ngang câu, hai part, custom timestamp/ô nhập, restore/main change, preview/export; AI vẫn max9s. Mốc âm/NaN/end≤start/quá EOF/source khác phải chặn và báo ở footer.
