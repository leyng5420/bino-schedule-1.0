/* bino schedule 1.0: Miu, quân sư thư ký */
(function () {
  'use strict';
  const B = window.Bino;

  const SVG = '<svg class="miu-svg" viewBox="0 0 120 130" aria-hidden="true">' +
    '<path d="M22 48 L30 12 L52 36 Z" fill="#F1E8C1"/><path d="M98 48 L90 12 L68 36 Z" fill="#F1E8C1"/>' +
    '<path d="M30 40 L33 22 L44 35 Z" fill="#DA95AA"/><path d="M90 40 L87 22 L76 35 Z" fill="#DA95AA"/>' +
    '<ellipse cx="60" cy="98" rx="38" ry="30" fill="#F1E8C1"/><circle cx="60" cy="56" r="38" fill="#F1E8C1"/>' +
    '<path d="M28 80 Q60 96 92 80 L92 90 Q60 106 28 90 Z" fill="#A2AD61"/><rect x="74" y="86" width="12" height="22" rx="5" fill="#A2AD61"/>' +
    '<g class="miu-eyes"><ellipse cx="45" cy="56" rx="5" ry="7" fill="#1F1C20"/><ellipse cx="75" cy="56" rx="5" ry="7" fill="#1F1C20"/>' +
    '<circle cx="47" cy="53" r="1.8" fill="#FFF8FB"/><circle cx="77" cy="53" r="1.8" fill="#FFF8FB"/></g>' +
    '<ellipse cx="35" cy="68" rx="7" ry="4" fill="#E9A3B9"/><ellipse cx="85" cy="68" rx="7" ry="4" fill="#E9A3B9"/>' +
    '<path d="M57 64 L63 64 L60 68 Z" fill="#D1739B"/>' +
    '<path d="M60 68 Q55 74 50 71 M60 68 Q65 74 70 71" stroke="#1F1C20" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
    '<path d="M18 62 L34 64 M18 70 L34 68 M102 62 L86 64 M102 70 L86 68" stroke="#C9BE97" stroke-width="1.4" stroke-linecap="round"/></svg>';

  const BYE = ['Hứ, đi thì đi.', 'Được rồi, lát Miu quay lại đó.', 'Phũ ghê. Miu đi đây.', 'Miu dỗi rồi nha.'];
  const FREQ = { tat: null, it: { gap: 90, max: 2 }, vua: { gap: 45, max: 4 }, nhieu: { gap: 20, max: 8 } };
  const FREQ_LABEL = { tat: 'Tắt', it: 'Ít', vua: 'Vừa', nhieu: 'Nhiều' };

  const fill = t => String(t).replace(/\{ten\}/g, B.state.settings.ten || 'Cún');
  const $ = id => document.getElementById(id);
  let hideTimer = null, phase = 'hidden';

  function ms() {
    const st = B.state.settings.miuState;
    const today = B.u.ymd(new Date());
    if (st.day !== today) { st.day = today; st.count = 0; st.said = []; }
    return st;
  }

  // Chọn câu theo tình huống: lịch dày, gần giờ gym, giờ ăn, trời mưa, buổi tối
  function pickLine() {
    const lines = B.state.settings.miu.lines.filter(l => l && l.trim());
    if (!lines.length) return null;
    const ctx = B.miuContext ? B.miuContext() : {};
    const st = ms();
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const has = (l, re) => re.test(l.toLowerCase());
    const want = [];
    if (ctx.rain) want.push(/mưa|mang theo ô|mang ô/);
    if (ctx.busyHours >= 7) want.push(/nap|ngủ|nghỉ/);
    if (ctx.gymSoon) want.push(/gym|tập/);
    if ((h >= 11.5 && h < 13) || (h >= 18 && h < 19.5)) want.push(/ăn|bữa/);
    if (h >= 19 && h < 22) want.push(/mẹ|gọi/);
    if (h >= 6 && h < 10) want.push(/cây|tưới/);
    const fresh = lines.filter(l => !st.said.includes(l));
    const pool = fresh.length ? fresh : lines;
    for (const re of want) {
      const m = pool.filter(l => has(l, re));
      if (m.length) return m[Math.floor(Math.random() * m.length)];
    }
    const neutral = pool.filter(l => !has(l, /mưa|nap|ngủ trưa/) || (ctx.rain && has(l, /mưa/)));
    const list = neutral.length ? neutral : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  function show(text) {
    const box = $('miu');
    if (!box || !text) return false;
    clearTimeout(hideTimer);
    $('miuText').textContent = fill(text);
    $('miuShoo').hidden = true;
    box.hidden = false;
    box.classList.remove('run');
    requestAnimationFrame(() => box.classList.add('up'));
    phase = 'up';
    hideTimer = setTimeout(hide, 12000);
    return true;
  }

  function hide() {
    const box = $('miu');
    if (!box) return;
    clearTimeout(hideTimer);
    box.classList.remove('up');
    phase = 'hidden';
    setTimeout(() => { if (phase === 'hidden') box.hidden = true; }, 500);
  }

  function ask() {
    if (phase !== 'up') return;
    clearTimeout(hideTimer);
    $('miuShoo').hidden = false;
    $('miuShoo').focus();
    phase = 'ask';
    hideTimer = setTimeout(hide, 10000);
  }

  function shoo() {
    clearTimeout(hideTimer);
    $('miuText').textContent = BYE[Math.floor(Math.random() * BYE.length)];
    $('miuShoo').hidden = true;
    phase = 'leaving';
    const st = ms();
    st.shooUntil = Date.now() + 2 * 3600 * 1000;
    B.saveSettings();
    setTimeout(() => {
      const box = $('miu');
      box.classList.add('run');
      setTimeout(() => { box.classList.remove('up', 'run'); box.hidden = true; phase = 'hidden'; }, 650);
    }, 1000);
  }

  // Gọi định kỳ: chỉ hiện khi đủ điều kiện
  function maybeShow(force) {
    const s = B.state.settings;
    const f = FREQ[s.miu.freq];
    if (!force && !f) return false;
    if (phase !== 'hidden') return false;
    if (B.isBusyUI && B.isBusyUI()) return false;
    const now = new Date(), h = now.getHours();
    const st = ms();
    if (!force) {
      if (h >= 23 || h < 7) return false;
      if (st.shooUntil > Date.now()) return false;
      if (st.count >= f.max) return false;
      if (Date.now() - st.last < f.gap * 60000) return false;
    }
    const line = pickLine();
    if (!line) return false;
    if (!show(line)) return false;
    st.count++; st.last = Date.now(); st.said.push(line);
    B.saveSettings();
    return true;
  }

  function bind() {
    const cat = $('miuCat');
    if (!cat) return;
    cat.innerHTML = SVG;
    cat.addEventListener('click', () => { if (phase === 'up') ask(); else if (phase === 'ask') hide(); });
    $('miuShoo').addEventListener('click', shoo);
  }

  B.miu = { SVG, FREQ_LABEL, bind, show, hide, maybeShow, fill, isOpen: () => phase !== 'hidden' };
})();
