# Beta1115 — ổn định import JSON thủ công

## Bằng chứng và nguyên nhân
- worker/auto-cut-workflow.mjs trước đây chạy prepareInputs + mainContent.prepare lần nữa khi import rồi hash toàn bộ external payload mới. prepareInputs gọi lại sourceContexts.ensure/localSignals và chọn lại track; collector có thể enrich metadata/comments/replay/cache giữa hai thời điểm.
- external-editing-context.mjs hash JSON.stringify(payload), gồm mainInput.analysisKey và provenance. main-content.prepare cũng hash sourceEvidence; comments/replay provenance có extractedAt. source-context/normalize.mjs nhánh local tạo lại extractedAt cho heatmap unavailable. Thời điểm thu thập có thể làm đổi hash, không phải bằng chứng transcript/main người dùng đổi. Thứ tự key JSON cũng bị coi là nội dung.
- app/page.tsx webAiEditorSignature trước đây trải gần toàn bộ part: focus/renderer flags/AI metadata cũng làm stale.
- Các operation metadata cuối trong launcher.log: error, requestCount0, khoảng258–389ms. Log cũ không giữ digest thành phần/payload đã dùng nên không thể kết luận trường mismatch của từng lượt. Không đọc/log credentials hoặc toàn bộ source/output.

## Sửa
- worker/external-prompt-snapshot.mjs: lưu snapshot context/input/caption track/local cùng digest từng nhóm theo source/request trước khi xuất TXT. Dùng cache hiện có: tối đa64MiB, 2MiB/entry, tuổi14ngày và cơ chế ghi nguyên tử. Snapshot quá lớn/ghi lỗi thì không xuất TXT giả thành công. Không sửa cache module dùng chung.
- Import dùng đúng snapshot, không collector/network/ASR/local analysis/candidate rebuild. Digest canonical key order kiểm tra source media stat identity, sourceId/duration/language, request/provider, transcript, yêu cầu, semantic main/protection/manual teaser, normalized captions và rules. Metadata thu thập lại không thay evidence của TXT.
- Vẫn parse schema/request/source/analysisKey, assertMainLocks, validatePlan, attachExternalHooks/citation, kiểm tra sourceKey/range/gap/duration và async revision. Không relabel JSON cũ thành request mới, không fallback/repair/AI request.
- UI signature chỉ lấy trường biên tập/cue/manual có liên quan; bỏ renderer focus/AI diagnostic/history flags. Cơ chế lastImportMainSignature vẫn chỉ ack sau tất cả validation thành công, cho phép JSON khác cùng cuộc chat. Restore vẫn giữ snapshot lockedPlan/request/track/media như cũ.
- Lỗi chỉ rõ source/request/transcript/yêu cầu/main/phụ đề/rules hoặc snapshot thiếu/hết hạn. Không ghi source text/output/credentials vào diagnostics.
- Prompt v14: cần tải TXT mới một lần. TXT cũ không có snapshot không được tự gắn vào context mới. Giữ nguyên JSON draft/plan; chưa có bằng chứng để tự cứu mọi JSON cũ.

## Package và nghiệm thu
- Build1115, profile/ports/data root Beta giữ nguyên. Không sửa DEV, production hoặc dữ liệu người dùng.
- Chỉ build/package/native audit/codesign và đọc diff/import closure. Không tests/lint/typecheck riêng, AI, ASR, download video, render hoặc browser automation.
- Cần thử tay: ChatGPT web/Gemini/Muse tải TXT→import JSON→sửa kết quả ở web→import lại; đóng/mở app giữa TXT và import; đổi style/nhạc/focus/tab; sửa thật main/cue/transcript/yêu cầu hoặc source khác phải chặn đúng nguyên nhân; import schema sai giữ nguyên plan/JSON draft. Hai part độc lập theo validation hiện có.
- Chưa nghiệm thu runtime; build thành công không chứng minh mọi trường hợp import đã pass.
