/* bino schedule: nhật ký cập nhật. Mỗi bản mới chỉ cần thêm một mục vào đầu danh sách.
   demo: calendars, eye, now, views, theme, weather, miu
   action (nút Thử ngay): add, calendars, eye, month, theme, weather, miu */
window.BINO_CHANGELOG = [
  {
    version: '1.0',
    date: '2026-11-19',
    intro: 'Chào {ten}! Miu là quân sư thư ký của {ten} nè. App vừa lên bản 1.0 với nhiều điều mới, Miu dẫn {ten} đi xem từng cái nha.',
    slides: [
      {
        title: 'Tự tạo lịch và sự kiện', demo: 'calendars', action: 'calendars',
        say: 'Giờ {ten} muốn thêm gì cũng được, không chỉ học với đi dạy đâu. Tạo hẳn một lịch mới cũng được luôn.',
        steps: ['Bấm nút + để thêm sự kiện, chọn nó thuộc lịch nào.', 'Vào ⋯ → Các lịch để tạo lịch mới, đổi màu, xếp thứ tự ưu tiên.', 'Xóa sự kiện lặp: chọn chỉ buổi này, các buổi sau, hoặc cả chuỗi.']
      },
      {
        title: 'Nút mắt: xem giờ trống', demo: 'eye', action: 'eye',
        say: '{ten} hay hỏi "hôm nay còn trống lúc nào?". Bấm con mắt là Miu chỉ cho liền.',
        steps: ['Bấm nút hình con mắt, nằm ngay trên nút +.', 'Khung trống có viền nét đứt và số giờ trống.', 'Chạm "Thêm" để xếp lịch vào khung đó, giờ đã điền sẵn.']
      },
      {
        title: 'Thanh giờ hiện tại', demo: 'now',
        say: 'Nhìn vạch đỏ là biết bây giờ mấy giờ, đỡ phải nhìn đồng hồ nữa.',
        steps: ['Vạch đỏ có nhãn giờ, tự chạy theo từng phút.', 'Có ở chế độ xem buổi, ngày và tuần.']
      },
      {
        title: 'Nhiều cách xem lịch', demo: 'views', action: 'month',
        say: '{ten} muốn nhìn gần hay nhìn xa đều được: theo buổi, ngày, tuần, tháng, hay cả năm.',
        steps: ['Chọn chế độ xem ở hàng nút dưới tiêu đề.', 'Buổi chia sáng 0h–12h và chiều tối 12h–24h.', 'Ở Tháng và Năm, chạm vào một ngày hoặc một tháng để mở chi tiết.']
      },
      {
        title: 'Đổi giao diện', demo: 'theme', action: 'theme',
        say: '{ten} thích màu nào thì chọn màu đó. Muốn để ảnh crush làm hình nền Miu cũng không cản đâu.',
        steps: ['Vào ⋯ → Giao diện.', 'Chọn sáng, tối hoặc tự động, rồi chọn chủ đề màu và hình nền.', 'Đổi kiểu tô (màu, gradient, ảnh) cho từng lịch trong ⋯ → Các lịch.']
      },
      {
        title: 'Thời tiết hôm nay', demo: 'weather', action: 'weather',
        say: 'Sáng nào Miu cũng xem trời giùm {ten}. Mưa thì nhắc mang ô, nắng thì nhắc chống nắng.',
        steps: ['Ô thời tiết nằm đầu chế độ xem ngày và buổi.', 'Bấm "Dùng vị trí của tôi" để xem đúng chỗ {ten} đang ở, không thì Miu lấy TP.HCM.']
      },
      {
        title: 'Màn chào và Miu', demo: 'miu', action: 'miu',
        say: 'Còn Miu thì thỉnh thoảng sẽ nhảy ra nhắc {ten} vài chuyện. Phiền quá thì đuổi, nhưng Miu dỗi đó nha.',
        steps: ['Mỗi lần mở app có một câu chúc và lời nhắc lịch hôm nay.', 'Chạm vào Miu để hiện nút đuổi, Miu sẽ đi khoảng 2 tiếng.', 'Vào ⋯ → Miu và cài đặt để chỉnh tần suất, tên gọi và các câu nhắc.']
      }
    ],
    outro: 'Xong rồi đó! Có gì quên thì vào ⋯ → Có gì mới, Miu giảng lại cho. Giờ đi làm việc thôi {ten}.'
  }
];
