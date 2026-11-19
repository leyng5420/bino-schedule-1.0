# bino schedule 1.0

Lịch cá nhân của Cún, có Miu làm quân sư thư ký. Bảng màu matcha strawberry, ưu tiên dùng trên điện thoại.

## Các file

| File | Vai trò |
|---|---|
| `index.html` | Khung trang |
| `style.css` | Giao diện, chế độ sáng tối |
| `core.js` | Dữ liệu và bộ máy lịch |
| `app.js` | Các chế độ xem, bảng chi tiết, thêm sửa xóa |
| `theme.js` | Chủ đề màu, hình nền, viền thẻ |
| `weather.js` | Thời tiết hôm nay (Open-Meteo, không cần API key) |
| `miu.js` | Nhân vật Miu |
| `changelog.js` | Nội dung "Có gì mới" Miu giới thiệu mỗi bản |
| `schedule.js` | Lịch gốc, chỉ dùng để nạp lần đầu |
| `sw.js`, `manifest.webmanifest`, các file ảnh `icon` | Cài lên màn hình chính, dùng khi mất mạng |

## Dữ liệu

Từ bản 1.0, mọi lịch nằm trong app và lưu trên từng thiết bị. Sửa, thêm, xóa ngay trong app.
`schedule.js` chỉ được nạp ở lần mở đầu tiên. Nếu sửa file này trên GitHub, vào ⋯ → Nạp lại lịch gốc để áp dụng.

Nhớ sao lưu mỗi tuần: ⋯ → Sao lưu dữ liệu.

## Ra bản mới

Thêm một mục vào đầu danh sách trong `changelog.js` (số bản, ngày, lời Miu, các trang tính năng),
đổi `B.VERSION` trong `core.js` và tên `CACHE` trong `sw.js`. Lần mở tiếp theo, Miu sẽ tự giới thiệu.
