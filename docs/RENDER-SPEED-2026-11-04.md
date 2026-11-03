# Tốc độ render — đo và tối ưu (2026-11-04)

Máy: Apple M2 (8 lõi), render thật bằng đồ thị lọc của app, VideoToolbox (giải mã và mã hóa phần cứng), nguồn 1080p H.264, phần Part 1 rút gọn còn ~90 giây main (thành phẩm 72,0 giây, 2.160 khung). Mọi so sánh A/B chạy xen kẽ trong cùng trạng thái máy. Script lặp lại được: `scripts/bench-render.mjs` (chỉ đọc dữ liệu thật, ghi vào thư mục tạm).

## Hiện trạng đo trước khi sửa
- Lịch sử 95 job render xong: trung vị 1.187 giây cho 524 giây thành phẩm (**gấp 2,14 lần**; p90 gấp 4 lần).
- Render chạy ở `nice 10` với 2 luồng giải mã, 2 luồng đồ thị và 2 luồng mã hóa → dùng khoảng 1,8 trong 8 lõi.
- Cắt đoạn: giải mã một mình chỉ 3–10% thời gian. Mã hóa phần cứng gần như không tốn thêm. **Nút thắt là đồ thị lọc.**
- Tăng số luồng một mình chỉ nhanh hơn ~20%, vì có bộ lọc chạy đơn luồng chiếm gần hết thời gian.

## Nút thắt thật: `geq` của hiệu ứng "shine" tiêu đề
Mỗi khung hình, `geq` tính bốn biểu thức thông dịch cho từng điểm ảnh của dải 160×1920 (~25 ms/khung, một luồng) = khoảng một nửa thời gian render ở cấu hình cũ. Hầu hết kiểu mẫu đều bật shine.

## Thay đổi
1. **Shine:** hệ số mờ dần theo cột là hằng số, nên dựng một lần (một khung, rồi lặp) và áp dụng bằng `blend multiply` + `alphamerge` (`worker/render/shine-filter.mjs`, dùng ở `composition.mjs` và `title-animation.mjs`).
2. **Lớp phủ tĩnh** (thẻ tiêu đề, phụ đề) đổi sang định dạng `yuva420p` một lần trước khi lặp/`fps`, thay vì mỗi khung. Kiểm chứng **bit-identical** bằng `framemd5`.
3. **Ngân sách luồng của export:** giải mã và đồ thị từ 2 → nửa số lõi (2..4; 4 trên M2), vẫn `nice 10`. Chỉ export; các lệnh ffmpeg khác giữ 2 luồng. Hồ sơ `balanced-m2-editor-v4`.

## Kết quả (render thật, thời gian tường, thành phẩm 72 giây)
| Cấu hình | Lần 1 | Lần 2 | Trung bình | So với cũ |
|---|---:|---:|---:|---:|
| Cũ (đồ thị cũ, 2 luồng) | 111,2 s | 112,8 s | 112,0 s | — |
| Đồ thị mới, 2 luồng | 67,1 s | 65,8 s | 66,5 s | −41% |
| Đồ thị mới, 4 luồng (mặc định mới) | 50,0 s | 49,7 s | 49,9 s | **−55% (nhanh gấp 2,2 lần)** |

Tức từ 1,56× thời lượng thành phẩm xuống 0,69× (nhanh hơn thời gian thực). Với trung vị lịch sử 2,14× kỳ vọng còn khoảng 1,0×.

## Chất lượng (so với bản cũ)
- Chuỗi lọc thay thế, so trên video không nén (ffv1): **PSNR 82,2 dB, SSIM 0,999999**; chênh lệch tối đa 1 mức alpha 8-bit, chỉ trong dải shine.
- Phần lớp phủ tĩnh: giống hệt từng bit.
- Sau mã hóa VideoToolbox: PSNR trung bình **52,7 dB** (thấp nhất một khung 43,1 dB), SSIM 0,9987. Bộ mã hóa cho kết quả giống hệt nhau giữa hai lần render cùng đồ thị (PSNR vô cực), nên mức chênh này hoàn toàn đến từ sai khác ±1 mức alpha vùng shine bị bộ điều khiển bitrate khuếch đại thành nhiễu mã hóa phân tán; ảnh hiệu số khuếch đại 24 lần là nhiễu kết cấu, không có vệt hay lỗi cục bộ. Kích thước file +0,003%.
- Không đổi âm thanh, độ dài (72,003 giây), bitrate, định dạng màu.

## Đã thử nhưng không dùng
- Thay lớp nền mờ bằng đường YUV: nhanh thêm nhưng lệch nhiều (PSNR 22 dB), bỏ.
- Tăng lên 8 luồng: không nhanh hơn 4 luồng đáng kể.

## Giới hạn
- Đo trên một nguồn và một kiểu mẫu (nền mờ, shine bật). Đường RGB (có bộ lọc màu hoặc nền khác) giữ `format=rgba` nên chỉ hưởng phần shine và luồng.
- Số liệu ±10–20% giữa các lần do trạng thái máy; kết luận dựa trên các lần xen kẽ.
- Chưa đo trên Windows (đường libx264 phần mềm).
