// BINO SCHEDULE: dữ liệu lịch
// Đây là file duy nhất bạn cần sửa khi lịch thay đổi.
// Giờ viết dạng "HH:MM", ngày viết dạng "YYYY-MM-DD".
// Thứ viết: T2, T3, T4, T5, T6, T7, CN
// Lưu ý: nếu đổi tên hoặc giờ gốc của một buổi, các tick và ghi chú cũ của buổi đó sẽ không còn gắn vào nữa.
// mau: mã màu (bảng matcha strawberry). Mỗi dòng lịch có thể thêm mau riêng để đổi sắc.

window.SCHEDULE = {
  // Ngày bắt đầu áp dụng lịch hàng tuần
  batDau: '2026-11-16',

  // 4 lịch. uuTien: số càng nhỏ càng quan trọng (được giữ lại khi trùng giờ)
  lich: [
    { id: 'hoc',    ten: 'Học tiếng Anh',    uuTien: 1, mau: '#E3E38D' },
    { id: 'viec',   ten: 'Công việc',        uuTien: 2, mau: '#DA95AA' },
    { id: 'gym',    ten: 'Gym',              uuTien: 3, mau: '#A2AD61' },
    { id: 'canhan', ten: 'Cá nhân mục tiêu', uuTien: 4, mau: '#E9C9D4' }
  ],

  // Lịch lặp lại hàng tuần
  // Tùy chọn thêm: denNgay (ngày kết thúc), tuNgay (ngày bắt đầu riêng),
  // moi: 2 (2 tuần một lần), tuyChon: true (không tính vào giờ kế hoạch)
  hangTuan: [
    // Học tiếng Anh
    { lich: 'hoc', ten: 'Tự học',        thu: ['T2', 'T4'],       tu: '14:00', den: '15:00', mau: '#E0E5A2' },
    { lich: 'hoc', ten: 'Lớp tiếng Anh', thu: ['T3', 'T5', 'T7'], tu: '12:00', den: '14:00', mau: '#D8DD80' },

    // Công việc
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T2', 'T4'],             tu: '08:30', den: '10:15' },
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T3', 'T5'],             tu: '08:10', den: '10:00' },
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T3', 'T5'],             tu: '14:30', den: '16:00' },
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T2', 'T6'],             tu: '18:15', den: '19:15' },
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T3', 'T4', 'T5', 'T6'], tu: '19:30', den: '20:30' },
    { lich: 'viec', ten: 'Dạy lớp', thu: ['T7', 'CN'],             tu: '19:00', den: '20:00' },
    { lich: 'viec', ten: 'Kèm 1:1', thu: ['T3', 'T5'],             tu: '20:30', den: '21:30', denNgay: '2026-11-30', mau: '#C596A6' },

    // Gym
    { lich: 'gym', ten: 'Gym',           thu: ['T2', 'T4'], tu: '15:30', den: '16:30' },
    { lich: 'gym', ten: 'Gym',           thu: ['T6'],       tu: '17:00', den: '18:00' },
    { lich: 'gym', ten: 'Gym',           thu: ['T7', 'CN'], tu: '16:00', den: '17:00' },
    { lich: 'gym', ten: 'Gym (tùy sức)', thu: ['T5'],       tu: '18:00', den: '19:00', tuyChon: true },

    // Cá nhân mục tiêu
    { lich: 'canhan', ten: 'Spa, chăm sóc bản thân', thu: ['T6'], tu: '10:00', den: '12:00', moi: 2, tuNgay: '2026-11-27', mau: '#F1E8C1' }
  ],

  // Lịch theo ngày cụ thể (biên đạo, ôn thi...)
  motLan: [
    {
      lich: 'viec', ten: 'Biên đạo', tu: '16:45', den: '17:45', mau: '#D1739B',
      ngay: ['2026-11-25', '2026-11-26', '2026-12-01', '2026-12-02', '2026-12-03',
             '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-15', '2026-12-16']
    },
    { lich: 'hoc', ten: 'Ôn thi (off)', tu: '19:00', den: '21:00', mau: '#BD5D5E', ngay: ['2026-11-26', '2026-11-27'] },
    { lich: 'hoc', ten: 'Ôn thi (off)', tu: '18:30', den: '20:00', mau: '#BD5D5E', ngay: ['2026-12-12'] },
    { lich: 'hoc', ten: 'Ôn thi (onl)', tu: '18:30', den: '20:00', mau: '#BD5D5E', ngay: ['2026-11-29', '2026-12-08', '2026-12-10'] },
    { lich: 'hoc', ten: 'Ôn thi (onl)', tu: '16:00', den: '17:30', mau: '#BD5D5E', ngay: ['2026-12-05', '2026-12-13'] },
    { lich: 'hoc', ten: 'Ôn thi (onl)', tu: '17:30', den: '19:00', mau: '#BD5D5E', ngay: ['2026-12-05', '2026-12-13'] }
  ]
};
