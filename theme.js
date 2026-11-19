/* bino schedule 1.0: chủ đề màu, hình nền, chế độ sáng tối */
(function () {
  'use strict';
  const B = window.Bino;

  // a1, a2: màu nhấn sáng (dùng làm nền nút); a1d, a2d: bản đậm (dùng làm chữ trên nền sáng)
  const THEMES = {
    matcha:   { ten: 'Matcha dâu', a1: '#D8DD80', a2: '#DA95AA', a1d: '#5E6420', a2d: '#A33A65', pal: ['#E3E38D', '#DA95AA', '#A2AD61', '#E9C9D4', '#D1739B', '#F1E8C1', '#C596A6', '#E0E5A2'] },
    bien:     { ten: 'Biển', a1: '#8FD3E8', a2: '#7FA8F0', a1d: '#1D6A82', a2d: '#2E55A8', pal: ['#8FD3E8', '#7FA8F0', '#A7E3D0', '#C9DCF2', '#5D93D6', '#E3F1F7', '#7BB7D6', '#B5C8F2'] },
    hoanghon: { ten: 'Hoàng hôn', a1: '#F6B26B', a2: '#EC7F9A', a1d: '#8C4A10', a2d: '#A02E4D', grad: true, pal: ['#F6B26B', '#EC7F9A', '#F6C98A', '#F2B5A7', '#D9667F', '#FBE3C4', '#E39A7E', '#F0D08A'] },
    oaihuong: { ten: 'Oải hương', a1: '#C9B8EA', a2: '#E8B0CF', a1d: '#55408C', a2d: '#913767', pal: ['#C9B8EA', '#E8B0CF', '#B3C3F0', '#DCD0F2', '#A68BD8', '#F1E9F8', '#D7A6C9', '#BFB1E0'] },
    bacha:    { ten: 'Bạc hà', a1: '#A8DCC8', a2: '#F2C6B4', a1d: '#2A6E59', a2d: '#934D33', pal: ['#A8DCC8', '#F2C6B4', '#C9E8B5', '#D6EEE6', '#7CC3AA', '#FBEADF', '#9CCFC0', '#E8D6A8'] },
    caphe:    { ten: 'Cà phê', a1: '#E0C3A5', a2: '#CF9A78', a1d: '#6E4A2E', a2d: '#86492A', pal: ['#E0C3A5', '#CF9A78', '#D9C8A0', '#EADCCB', '#B98563', '#F3E9DC', '#C4A484', '#D8B48C'] },
    donsac:   { ten: 'Đơn sắc', a1: '#E6E6E6', a2: '#B5B5B5', a1d: '#333333', a2d: '#555555', pal: ['#E6E6E6', '#BDBDBD', '#9E9E9E', '#D6D6D6', '#848484', '#F2F2F2', '#ADADAD', '#CFCFCF'] },
    keongot:  { ten: 'Kẹo ngọt', a1: '#B8E1FF', a2: '#FFC2D4', a1d: '#24619A', a2d: '#A33557', grad: true, pal: ['#B8E1FF', '#FFC2D4', '#C8F2C2', '#FFE7A8', '#D9C4FF', '#FFD9C2', '#A8F0E4', '#F7C6F0'] }
  };

  // Hình nền gradient: mỗi loại có bản cho chế độ tối và sáng để chữ luôn đọc được
  const BGS = {
    theme:   { ten: 'Mặc định', dark: ['#141315', '#2C2B2D'], light: ['#FAF7F5', '#EFE9EC'] },
    dau:     { ten: 'Đêm dâu', dark: ['#161214', '#4A2C3A'], light: ['#FFF6F9', '#F5DCE6'] },
    rung:    { ten: 'Rừng matcha', dark: ['#121512', '#33402A'], light: ['#F7F9EE', '#E3E9C6'] },
    bien:    { ten: 'Biển đêm', dark: ['#0E131C', '#1E3552'], light: ['#F2F8FC', '#D8E8F5'] },
    chieu:   { ten: 'Chiều tà', dark: ['#1A1213', '#4C2C22'], light: ['#FFF5EE', '#FADBC8'] },
    tim:     { ten: 'Oải hương', dark: ['#15121C', '#352A4D'], light: ['#F8F4FD', '#E6DCF6'] },
    chi:     { ten: 'Than chì', dark: ['#101010', '#2C2C2C'], light: ['#FBFBFB', '#E8E8E8'] }
  };

  const BORDERS = { none: 'Không viền', thin: 'Viền mảnh', bold: 'Viền đậm', dashed: 'Nét đứt' };
  const MODES = { light: 'Sáng', dark: 'Tối', auto: 'Tự động' };

  // Bảng màu đầy đủ để chọn màu cho lịch
  const PALETTE = ['#E3E38D', '#D8DD80', '#A2AD61', '#E9C9D4', '#DA95AA', '#D1739B', '#C596A6', '#BD5D5E', '#F1E8C1',
    '#F6B26B', '#EC7F9A', '#8FD3E8', '#7FA8F0', '#A8DCC8', '#C9B8EA', '#E0C3A5', '#B5B5B5', '#FFE7A8'];

  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: true };
  const resolvedMode = s => (s.mode === 'auto' ? (mq.matches ? 'dark' : 'light') : (s.mode === 'light' ? 'light' : 'dark'));

  function apply() {
    const s = B.state.settings;
    const t = THEMES[s.theme] || THEMES.matcha;
    const mode = resolvedMode(s);
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.dataset.border = BORDERS[s.border] ? s.border : 'none';
    const set = (k, v) => root.style.setProperty(k, v);
    set('--a1', t.a1); set('--a2', t.a2); set('--a1d', t.a1d); set('--a2d', t.a2d);
    set('--acc1', mode === 'dark' ? t.a1 : t.a1d);
    set('--acc2', mode === 'dark' ? t.a2 : t.a2d);
    set('--acc-inv', mode === 'dark' ? t.a1d : t.a1);
    set('--r-card', Math.max(4, Math.min(28, +s.radius || 18)) + 'px');

    const layer = document.getElementById('bgLayer');
    const img = s.bg === 'image' ? B.images['bg'] : null;
    if (layer) {
      if (img) {
        const scrim = mode === 'dark' ? 'rgba(14,13,15,.62)' : 'rgba(250,247,245,.68)';
        layer.style.backgroundImage = 'linear-gradient(' + scrim + ',' + scrim + '),url("' + img + '")';
      } else {
        const g = (BGS[s.bg] || BGS.theme)[mode];
        layer.style.backgroundImage = 'linear-gradient(180deg,' + g[0] + ' 0%,' + g[1] + ' 100%)';
      }
    }
    const g0 = (BGS[s.bg] || BGS.theme)[mode][0];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', g0);
  }

  if (mq.addEventListener) mq.addEventListener('change', () => { if (B.state && B.state.settings.mode === 'auto') { apply(); if (B.onThemeChange) B.onThemeChange(); } });

  // Cách tô thẻ theo lịch: màu đơn, gradient hoặc ảnh
  function fillVars(cal, mau) {
    const ci = B.u.inkFor(mau);
    if (cal && cal.fill === 'gradient') {
      const m2 = B.u.isHex(cal.mau2) ? cal.mau2 : (THEMES[B.state.settings.theme] || THEMES.matcha).a1;
      return '--c:' + mau + ';--ci:' + ci + ';--fill:linear-gradient(135deg,' + mau + ' 0%,' + m2 + ' 100%)';
    }
    if (cal && cal.fill === 'image' && cal.imageId && B.images[cal.imageId]) {
      return '--c:' + mau + ';--ci:#FFF8FB;--fill:linear-gradient(rgba(20,16,20,.5),rgba(20,16,20,.5)),url(&quot;' + B.images[cal.imageId] + '&quot;) center/cover';
    }
    return '--c:' + mau + ';--ci:' + ci;
  }

  B.theme = { THEMES, BGS, BORDERS, MODES, PALETTE, apply, fillVars, resolvedMode };
})();
