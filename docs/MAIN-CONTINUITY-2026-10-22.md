Cập nhật 2026-11-04: OAuth đã được thay bằng Codex CLI; xem docs/CODEX-CLI-AUTO-PROMPT.md.

# MAIN — tiếp nối hai part và bảo toàn phần đuôi

Lượt điều tra ban đầu chỉ đọc source/cache/plan và sửa source, không gọi AI/test/render hoặc thay plan/draft/cache/media đang lưu. Sau đó người dùng đã cho phép một lượt package; kết quả cập nhật app DEV nằm ở mục cuối tài liệu này.

## Bằng chứng của lượt gần nhất còn lưu

Cache MAIN mới nhất: `media/cache/main-content/44f5476229324354e4f1730c84be9e55318ee8052f5db462b89d9c145e92e827.json`, mtime 2026-10-22 07:13:06 giờ máy. Source `5a732d5e-eb00-45fa-ac75-8bc876e37b1c`, video **Mở hộp iPhone Duo 1TB Chính Hãng Và Giải Đáp 15 Thắc Mắc Trước Ngày Mở Bán**, duration **840.237279 source seconds**. Cache ghi `method: ai`, `model: gpt-6.1-sol`, `version: editorial-main-v2`.

Đây là kết quả AI MAIN trong cache, **không khẳng định là draft Editor mới nhất**: chỉnh tay sau Generate có thể chỉ nằm trong storage của renderer. Không mở browser/storage hoặc thay đổi draft để điều tra.

| Vùng | Ranges lưu trong cache / khoảng bị bỏ | Độ dài nguồn |
|---|---|---:|
| Part 1 | Giữ 71.320 → 263.919 | 192.599s |
| Giữa hai part | Bỏ 263.919 → 524.640 (04:23.919 → 08:44.640) | **260.721s** |
| Part 2 | Giữ 524.640 → 603.640 | 79.000s |
| Sau Part 2 | Bỏ 603.640 → 840.237279 (10:03.640 → hết nguồn) | **236.597279s** |

Source metadata còn transcript và 405 caption cue. Các cue trong hai vùng bị bỏ vẫn chứa nội dung trực tiếp liên quan, theo lời nói trong captions, không phải quan sát hình ảnh:

- Giữa hai part: cue-120–141 nói về mục đích/giới hạn camera trong màn hình và lựa chọn selfie; cue-142–197 về tối ưu ứng dụng, Facebook/Instagram/YouTube và bố cục; cue-198–225 về Netflix và giải thích hiệu ứng phần mềm; cue-226–247 về ứng dụng mặc định và bàn phím.
- Sau Part 2: cue-284–323 nói về tư thế dùng máy, đồng hồ/hiển thị và lưu ý khi dùng lâu; cue-324–374 nói về Touch ID, các thao tác/giới hạn mở khóa và mong muốn cải thiện; cue-375–392 có nhận xét sử dụng và kết luận về tối ưu phần mềm. Cue-393 trở đi chuyển sang đề nghị bình luận/bài test tiếp theo rồi chuyện kết buổi quay. Vì vậy không có căn cứ coi toàn bộ 603.640 → hết nguồn là outro hoặc vô giá trị. Mốc 816.920 chỉ là biên cue chuyển lời, không phải đề xuất tự cắt/khôi phục.

Caption cuối trong source metadata có end 842.199, vượt duration 840.237279; đây không giải thích được việc bỏ cả 236.597279s. Không thay timestamp hoặc xử lý track trong lượt này.

## Truy vết và nguyên nhân

1. `worker/main-content.mjs::prepare` lấy full-source evidence bằng `collectTeaserEvidence(...fullOnly:true)`, phạm vi 0 → source.duration. `lib/teaser-evidence.mjs` không áp nhánh thu hẹp transcript của teaser trong trường hợp này. Bản source còn phần đuôi; không thấy một bước truncation cuối transcript trong đường MAIN hiện tại. Raw request/response nguyên bản của lượt cũ không được giữ trong cache, nên không thể so byte-for-byte payload thực tế.
2. `generateMainCandidates` tạo recipes gợi ý bao từ entry đến split, rồi split đến cuối nguồn; `modelSelectionInput` ghi rõ optional. `MAIN_SCHEMA` cho AI trả ranges nguồn tự do, không ép thành hai highlight. Cache ghi `recipeId: editorial-source-ranges-v2`, không phải một recipe bắt buộc.
3. `editorialSelectionToPlan` nhận ranges rồi `structuredClone(p.segments)`; không chọn thêm entry, không rút đuôi, không merge khoảng bao, không snap/trim. Flags bypass cut được gắn cho contract này. `normalizePlan` giữ từng range; validator chỉ kiểm tra kỹ thuật. Hai khoảng bỏ trên đã nằm trong kết quả lựa chọn lưu lại, không có bằng chứng normalizer tự tạo chúng.
4. Lý do đã lưu giải thích Part 1 thành một chủ đề phụ kiện/màn hình; Part 2 thành một đoạn hỏi–thử đa nhiệm riêng và kết trước chủ đề tư thế dựng máy. Điều này phù hợp với việc chọn hai mục độc lập, nhưng **không có giải trình cụ thể cho toàn bộ hai vùng bị bỏ**. Summary `analysis.parts[].reason` bị giới hạn 500 ký tự ở implementation cũ; không dựng lại phần lý do không còn. Segment reasons đầy đủ còn lưu cũng không biện minh các nội dung bị mất đó.
5. Tiêu chí v2 nhấn mạnh mỗi part tự hiểu được và kết thúc trọn ý, nhưng thiếu yêu cầu rõ rằng điểm chia phải tiếp nối phần nội dung nguồn kế tiếp, phải xét phần đuôi tới hết, và phải giải trình từng subrange bị bỏ trong hai vùng này. Chỉ dẫn bỏ waiting/tangents cũng chưa phân biệt đủ đoạn ít lời nhưng còn diễn biến. Đây là thiếu sót contract xác nhận bằng source; không kết luận do năng lực model. Replay của lượt này ghi unavailable, nên không quy lỗi cho điểm replay thấp.

## Sửa nhỏ, cùng lượt quyết định AI

- `lib/main-instructions.mjs` / `.d.mts`: phiên bản `editorial-main-v3-continuity`; giữ quy tắc vào thẳng vấn đề, bổ sung tiếp nối hai part, đọc toàn nguồn gồm phần đuôi, mặc định giữ mọi diễn biến/kết quả/phản ứng/giải thích/kết luận liên quan. Chỉ loại đúng các nhóm thừa đã cho phép; không dùng độ kịch tính, replay, ít lời, đủ phút hoặc cân độ dài làm lý do loại. Khoảng pha trộn chỉ bỏ subrange thừa thực, không bỏ cả khoảng bao. Không áp ngưỡng giây/tỷ lệ, không bắt giữ quảng cáo, không ép số range.
- Dùng chung `MAIN_RANGE_REASON_DESCRIPTION`: reason của range cuối Part 1 phải giải trình vùng giữa hai part; reason của range cuối Part 2 phải giải trình phần đuôi. Mỗi khoảng con ghi start/end, loại thừa, cue ID và nội dung thực làm căn cứ; không có gap thì ghi tiếp nối, không bịa omission. Bằng chứng thiếu không biến silence thành rác. Chỉnh tay được bảo vệ giữ nguyên và ghi đúng nguồn gốc, không được AI bịa biện hộ hoặc khôi phục.
- `lib/auto-cut/main-content.mjs` và `lib/edit-plan.ts`: cùng mô tả trên trong trường `segments[].reason` của hai output schema hiện có. Không thêm field, request hoặc bước đánh giá. Native part-level reason vẫn là summary ngắn; giải trình chi tiết nằm ở segment.reason, trường đã được clone/import giữ nguyên, tránh mất ở summary 500 ký tự. Không thêm validator keyword giả làm đánh giá ngữ nghĩa.
- ChatGPT worker, legacy prompt và Gemini/Muse cùng đọc `MAIN_EDITING_CRITERIA`. Gemini/Muse vẫn một prompt text đầy đủ, schema import không đổi hình dạng. `lib/muse-plan.mjs` / `.d.mts` tăng phiên bản prompt lên `external-editing-text-v3-main-continuity`; sửa declaration vốn còn ghi v1 cho khớp runtime.
- `lib/auto-cut/analysis.mjs`: nhận phiên bản mới đồng thời tiếp tục chấp nhận v1/v2 của plan đang lưu. Native cache key đã chứa version + prompt + schema nên phân biệt policy mới; web revision/analysisKey cũng đổi theo version/rules. Không xóa cache, tự Generate hoặc ghi lại nhãn phiên bản vào kết quả cũ.
- `mainInstruction` chỉ nhận diện **nguyên văn** factory instruction v1 hoặc v2 cũ để dùng policy mới khi tạo request tiếp theo, giữ raw draft. Yêu cầu tự nhập/chỉnh khác nguyên văn vẫn giữ nguyên. Không ghi đè ô nhập.

Không sửa main ranges, lựa chọn/timestamp/binding teaser của plan hiện tại, manual protections, tốc độ, style, nhạc, thuật toán candidate, normalization, validation range hay orchestration. Các file lib mới đã có trong manifest worker từ lượt trước; không cần thêm module vào package trong lượt này.

## Giới hạn và nghiệm thu tay

- Chưa có output mới: đây là sửa tiêu chí và output-field instructions, không phải bằng chứng chất lượng edit đã được khắc phục. Local validator không thể chứng minh lý do ngữ nghĩa của AI đúng chỉ từ một chuỗi reason.
- Tại thời điểm bàn giao source ban đầu chưa build; lần package được phép sau đó ghi ở mục cuối. Không chạy lại AI để kiểm chứng hoặc sửa plan cũ.
- Khi người dùng chủ động nghiệm thu sau cập nhật: kiểm tra cả vùng giữa hai part và sau Part 2, đối chiếu từng khoảng bỏ với cue/diễn biến thực; xác nhận chỉ phần thừa bị bỏ, nội dung ít lời vẫn được xem xét và payoff cuối còn nguyên. Đối chiếu segment.reason thay vì chỉ summary phân tích.
- Kiểm tra part có main chỉnh tay/xóa range chủ động vẫn giữ nguyên; teaser hiện tại không bị thay bằng thao tác của lượt sửa source này; prompt Gemini/Muse cũ phải được tạo lại cho policy mới, plan/draft cũ vẫn đọc được. Không ép khôi phục đoạn đã xóa hoặc tuyên bố output cũ dùng policy mới.

## Đối chiếu tích hợp trước package

- `MAIN_RANGE_REASON_DESCRIPTION` phân biệt nhãn `GIỮ [segment.start–segment.end]` với `LOẠI GIỮA HAI PART [...]` / `LOẠI ĐUÔI [...]`. Reason nằm trên range được giữ nhưng phải dẫn chứng đúng cue/nội dung ở vùng bị bỏ; không dùng một lý do giữ làm bằng chứng rằng toàn bộ gap được phép bỏ. Cả hai vùng đều thuộc cùng quyết định MAIN hiện tại.
- Shared instructions nói rõ thứ tự ưu tiên: continuity/tail là yêu cầu sản phẩm mới nhất; các quy tắc chung cũ trong raw draft không được lấn át. Yêu cầu riêng tương thích và manual exclusions/protections vẫn giữ. Nếu xung đột phải nói rõ bằng tiếng Việt trong reason, không giả rằng đã đáp ứng cả hai. Raw draft không bị sửa; chỉ factory instruction cũ khớp nguyên văn mới đi qua compatibility mapping đã có.
- Phát hiện `worker/auto-cut-workflow.mjs` vẫn gọi `selectHooks` khi có `currentPlan`. Đã thêm nhánh reanalysis MAIN trả về trước nhánh chọn teaser: giữ selected/manual/custom/disabled hiện tại, không gọi AI chọn teaser trong nhánh này. Generate nguồn mới vẫn giữ pipeline đã chốt; import JSON Gemini/Muse vẫn là hành động import chủ động của người dùng.
- Với teaser AI/external đã có, đối chiếu original selection context, cue/transcript, source fingerprint/evidence và web input identity trước; rồi kiểm tra mốc giữ nguyên có nằm trong một range MAIN mới, duration và các guard kỹ thuật. Metadata `binding.retainedMainContext` lưu rõ context gốc và range key của MAIN mới; không gắn lại context gốc thành bằng chứng rằng AI đã xem MAIN mới, không đổi provenance hoặc timestamp. Request identity đã được chấp nhận qua thao tác reanalysis được ghi riêng, giữ nguyên requestKey/citation gốc.
- Đồng bộ metadata retention trong `lib/teaser-context.mjs/.d.mts`, `lib/teaser-hooks.mjs`, `lib/teaser-import.mjs` và chỉnh MAIN tay sau đó trong `lib/main-ranges.mjs`. Apply/freshness/restore/preview/render dùng cùng metadata và guard nguồn/range. Không giả gắn cờ manual cho MAIN do AI tạo. Worker truyền `verifySourceTeasers` vào workflow để kiểm tra source thật, không gọi provider.
- Nếu excerpt không còn hợp lệ hoặc chứng cứ đã đổi, giữ endpoints/evidence/custom input và đánh dấu cần kiểm tra; không thay bằng unavailable/fallback mới, không gọi AI thay thế. Không chạy logic này trên dữ liệu hiện tại trong lượt package; chỉ xảy ra khi người dùng chủ động phân tích lại MAIN. Main đã chỉnh/xóa tay vẫn được locks hiện có bảo vệ.
- Chưa chạy AI/test/render để xác minh hành vi. Checklist thêm: reanalysis có MAIN mở rộng/thu hẹp, không đổi mốc teaser hợp lệ và không có request teaser; teaser bắc gap/outside hoặc captions/source đổi phải còn mốc để sửa và chặn xuất đúng; sửa MAIN tay tiếp sau reanalysis, reload và render validation dùng cùng identity. Kiểm tra raw yêu cầu cũ không bị ghi đè, lý do xung đột không bị che.

## Package DEV cố định — 2026-10-22

- Đã chạy đúng một lần `/opt/homebrew/opt/node@22/bin/node scripts/package-macos.mjs --dev`, exit 0. Không chạy test/lint/typecheck riêng, browser automation, AI, ASR, download hoặc render. Không bỏ qua guard. Frontend, launcher Swift, native audit và ad-hoc codesign/verify đều hoàn tất; vẫn có cảnh báo client chunk >500 kB như bản trước.
- App mới: `/Users/datdo/Documents/tiktok-edit/short-video-studio-visual-dev/release/dev/ShortCut Studio Dev.app`. Package xác nhận có `editorial-main-v3-continuity`, cả hai vùng lý do LOẠI, thứ tự ưu tiên raw draft và nhánh bảo toàn teaser trước `selectHooks`. Binding retention cũng nằm trong bundle client/worker.
- Đối chiếu source → package: 182 file runtime/shared/third_party và 79 file frontend khớp SHA-256; 115 runtime modules / 277 relative imports không thiếu dependency. Native audit 54 binary arm64, target macOS 27.0; `codesign --verify --deep --strict` exit 0.
- Profile `development`, port web 5273 / worker 8887, data root `/Users/datdo/Library/Application Support/ShortCut Studio Dev/media` giữ nguyên. Sol low và OAuth không gửi `service_tier`/`max_output_tokens` vẫn có trong code đóng gói. Không chạy app để xác minh provider hay nội dung.
- App DEV đã thoát tại các lần kiểm tra trước build; không kill hoặc tự mở app. Bundle trước và manifest trước được giữ trong staging `release/dev/.build-Z3hbIz/previous-build.app` và `previous-source-build-manifest.json`. Không tạo Review hoặc xóa bản cũ.
- Manifest mới: `release/dev/source-build-manifest.json` (ngoài bundle đã ký). Log: `/tmp/shortcut-dev-main-continuity-build.log`. Không sửa production/credentials/media/exports/backups hoặc commit/push/merge.
- Git: branch `recovery/visual-dev-reconstructed`, HEAD `865f75dd69893b9718a2590fb35243d0f2079b77`; giữ đầy đủ thay đổi trước đó. **Chưa nghiệm thu runtime hoặc chất lượng MAIN/teaser retention**; build thành công không chứng minh tính đúng ngữ nghĩa của lựa chọn mới.
