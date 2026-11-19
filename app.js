(function () {
  'use strict';

  const DATA = window.SCHEDULE;
  const DOW = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
  const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const LOG_KEY = 'bino-schedule-log-v1';
  const CUSTOM_KEY = 'bino-schedule-custom-v1';
  const UI_KEY = 'bino-schedule-ui-v2';

  /* ---------- Tiện ích ---------- */
  const pad = n => String(n).padStart(2, '0');
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const mondayOf = d => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
  const weeksBetween = (a, b) => Math.round((mondayOf(b) - mondayOf(a)) / (7 * 864e5));
  const toH = s => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
  const hm = h => { const t = Math.round(h * 60); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); };
  const short = s => { const d = parseDate(s); return d.getDate() + '/' + (d.getMonth() + 1); };
  const dayShort = s => DAY_SHORT[parseDate(s).getDay()] + ' ' + short(s);
  const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtHours = h => (Math.round(h * 10) / 10).toLocaleString('vi-VN') + 'h';
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
  const dur = x => x.e - x.s;
  const real = x => (x.phut ? x.phut / 60 : dur(x));

  // Chọn màu chữ (đậm hoặc sáng) dễ đọc nhất trên nền màu của thẻ
  function inkFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return (L + 0.05) / 0.0625 >= 1.05 / (L + 0.05) ? '#1F1C20' : '#FFF8FB';
  }
  const colorVars = x => '--c:' + x.mau + ';--ci:' + inkFor(x.mau);

  const CAL = {};
  (DATA ? DATA.lich : []).forEach(c => { CAL[c.id] = c; });

  /* ---------- Lưu trữ trên trình duyệt ---------- */
  function readStore(key, fallback) {
    try {
      const raw = window.localStorage && window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  let log = readStore(LOG_KEY, {});
  let custom = readStore(CUSTOM_KEY, []);
  if (!Array.isArray(custom)) custom = [];
  function saveLog() { if (!writeStore(LOG_KEY, log)) toast('Không lưu được. Trình duyệt đang chặn bộ nhớ, hãy tắt chế độ ẩn danh.'); }
  function saveCustom() { if (!writeStore(CUSTOM_KEY, custom)) toast('Không lưu được. Trình duyệt đang chặn bộ nhớ, hãy tắt chế độ ẩn danh.'); }

  /* ---------- Bộ máy lịch ---------- */
  const ruleId = r => r.lich + '-' + slug(r.ten) + '-' + r.tu.replace(':', '');
  const colorOf = r => (isHex(r.mau) ? r.mau : (CAL[r.lich] && isHex(CAL[r.lich].mau) ? CAL[r.lich].mau : '#E9C9D4'));

  function make(r, ds, id) {
    const s = toH(r.tu), e = toH(r.den);
    return { id, lich: r.lich, ten: r.ten, mau: colorOf(r), opt: !!r.tuyChon, allDay: false, date: ds, s, e, goc: { date: ds, s, e } };
  }

  function makeCustom(c, ds) {
    const id = 'u-' + c.cid + '@' + ds;
    if (c.kind === 'task') {
      return { id, lich: c.lich, ten: c.ten, mau: colorOf(c), opt: false, allDay: true, quanTrong: !!c.quanTrong,
        custom: c.cid, date: ds, s: 0, e: 0, goc: { date: ds, s: 0, e: 0 } };
    }
    const x = make(c, ds, id);
    x.custom = c.cid; x.lap = !!c.lap;
    return x;
  }

  // Tạo các buổi có ngày gốc nằm trong khoảng [from, to]
  function expand(from, to) {
    const out = [];
    const fromS = ymd(from), toS = ymd(to);
    const mine = custom.filter(c => CAL[c.lich]);
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const ds = ymd(d), dow = d.getDay();
      DATA.hangTuan.forEach(r => {
        const start = r.tuNgay || DATA.batDau;
        if (ds < start) return;
        if (r.denNgay && ds > r.denNgay) return;
        if (!r.thu.some(t => DOW[t] === dow)) return;
        if (r.moi && weeksBetween(parseDate(start), d) % r.moi !== 0) return;
        out.push(make(r, ds, ruleId(r) + '@' + ds));
      });
      mine.forEach(c => {
        if (c.kind === 'event' && c.lap && ds >= c.date && parseDate(c.date).getDay() === dow) out.push(makeCustom(c, ds));
      });
    }
    DATA.motLan.forEach(r => {
      [].concat(r.ngay).forEach(ds => { if (ds >= fromS && ds <= toS) out.push(make(r, ds, ruleId(r) + '@' + ds)); });
    });
    mine.forEach(c => {
      if (!(c.kind === 'event' && c.lap) && c.date >= fromS && c.date <= toS) out.push(makeCustom(c, c.date));
    });
    return out;
  }

  // Áp dụng nhật ký (tick, ghi chú, dời lịch) lên một buổi
  function apply(inst) {
    const L = log[inst.id] || {};
    const x = Object.assign({}, inst);
    if (L.doiNgay) x.date = L.doiNgay;
    if (L.doiGio && !inst.allDay) { x.s = toH(L.doiGio); x.e = x.s + (inst.e - inst.s); }
    x.xong = !!L.xong;
    x.boQua = !!L.boQua;
    x.ghiChu = L.ghiChu || '';
    x.phut = L.phutThucTe || null;
    x.daDoi = !!(L.doiNgay || (L.doiGio && !inst.allDay));
    return x;
  }

  function instancesBetween(from, to) {
    const a = ymd(from), b = ymd(to);
    return expand(addDays(from, -60), addDays(to, 60)).map(apply).filter(x => x.date >= a && x.date <= b);
  }

  // Đánh dấu trùng giờ: buổi có ưu tiên thấp hơn bị đánh dấu "thua"
  function markConflicts(list) {
    list.forEach(x => { x.trung = []; x.thua = false; });
    const timed = list.filter(x => !x.allDay && !x.boQua);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        const a = timed[i], b = timed[j];
        if (a.date !== b.date || !(a.s < b.e - 1e-9 && b.s < a.e - 1e-9)) continue;
        a.trung.push(b); b.trung.push(a);
        const pa = CAL[a.lich].uuTien, pb = CAL[b.lich].uuTien;
        if (pa < pb) b.thua = true;
        else if (pb < pa) a.thua = true;
        else { a.thua = true; b.thua = true; }
      }
    }
    return list;
  }

  function endTime(x) {
    const d = parseDate(x.date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, Math.round((x.allDay ? 24 : x.e) * 60));
  }

  function stats(list, now) {
    const per = {}, byTitle = {};
    DATA.lich.forEach(c => { per[c.id] = { plan: 0, done: 0 }; byTitle[c.id] = {}; });
    const s = { plan: 0, done: 0, nPlan: 0, nDone: 0, nMoved: 0, nSkip: 0, nOpen: 0, tTotal: 0, tDone: 0, per, byTitle };
    list.forEach(x => {
      if (x.allDay) { s.tTotal++; if (x.xong) s.tDone++; return; }
      if (!x.opt) { per[x.lich].plan += dur(x); s.plan += dur(x); s.nPlan++; }
      if (x.xong) {
        const r = real(x);
        per[x.lich].done += r; s.done += r; s.nDone++;
        byTitle[x.lich][x.ten] = (byTitle[x.lich][x.ten] || 0) + r;
      }
      if (x.daDoi) s.nMoved++;
      if (x.boQua) s.nSkip++;
      if (!x.xong && !x.boQua && !x.opt && endTime(x) < now) s.nOpen++;
    });
    return s;
  }

  function assignLanes(list) {
    const byDay = {};
    list.forEach(x => { (byDay[x.date] = byDay[x.date] || []).push(x); });
    Object.values(byDay).forEach(L => {
      L.sort((a, b) => a.s - b.s || b.e - a.e);
      const ends = [];
      L.forEach(x => {
        let k = ends.findIndex(e => e <= x.s + 1e-9);
        if (k < 0) { k = ends.length; ends.push(0); }
        ends[k] = x.e; x.lane = k;
      });
      L.forEach(x => {
        x.n = 1 + Math.max(...L.filter(y => y.s < x.e - 1e-9 && x.s < y.e - 1e-9).map(y => y.lane));
      });
    });
  }

  /* ---------- File .ics ---------- */
  function icsText(from, to) {
    const list = instancesBetween(from, to).filter(x => !x.boQua);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const dt = (ds, h) => ds.replace(/-/g, '') + 'T' + hm(h).replace(':', '') + '00';
    const fold = line => { let out = ''; while (line.length > 73) { out += line.slice(0, 73) + '\r\n '; line = line.slice(73); } return out + line; };
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BINO SCHEDULE//VI', 'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:BINO SCHEDULE', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Ho_Chi_Minh', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:+07', 'END:STANDARD', 'END:VTIMEZONE'
    ];
    list.forEach(x => {
      lines.push('BEGIN:VEVENT', 'UID:' + x.id.replace('@', '-') + '@bino-schedule', 'DTSTAMP:' + stamp);
      if (x.allDay) {
        lines.push('DTSTART;VALUE=DATE:' + x.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + ymd(addDays(parseDate(x.date), 1)).replace(/-/g, ''));
      } else {
        lines.push('DTSTART;TZID=Asia/Ho_Chi_Minh:' + dt(x.date, x.s), 'DTEND;TZID=Asia/Ho_Chi_Minh:' + dt(x.date, x.e));
      }
      lines.push(fold('SUMMARY:' + icsEsc((x.quanTrong ? '★ ' : '') + x.ten + ' (' + CAL[x.lich].ten + ')')), fold('CATEGORIES:' + icsEsc(CAL[x.lich].ten)));
      if (x.ghiChu) lines.push(fold('DESCRIPTION:' + icsEsc(x.ghiChu)));
      if (!x.allDay) lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', fold('DESCRIPTION:' + icsEsc(x.ten)), 'END:VALARM');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  // Cho phép kiểm thử bộ máy lịch ngoài trình duyệt
  window.BINO_ENGINE = {
    expand, instancesBetween, markConflicts, stats, icsText, mondayOf, parseDate, ymd, addDays, inkFor,
    setLog: l => { log = l; }, setCustom: c => { custom = c; }
  };
  if (typeof document === 'undefined') return;

  /* ==================== Giao diện ==================== */
  const $ = id => document.getElementById(id);
  const ui = readStore(UI_KEY, {});
  const narrow = window.matchMedia('(max-width: 899px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view = narrow ? 'day' : (ui.view || 'week');
  const hidden = new Set(ui.hidden || []);
  let monday = mondayOf(new Date());
  let current = [];
  let openId = null;
  let selDate = null;
  let addKind = 'event';
  let firstRender = true;
  let drag = null;

  function saveUi() { writeStore(UI_KEY, { view, hidden: [...hidden] }); }
  const inWeek = ds => ds >= ymd(monday) && ds <= ymd(addDays(monday, 6));
  const visible = () => current.filter(x => !hidden.has(x.lich));
  const findItem = id => current.find(y => y.id === id);

  let toastTimer;
  function toast(msg, action) {
    const t = $('toast');
    t.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);
    if (action) {
      const b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = () => { t.classList.remove('show'); action.fn(); };
      t.appendChild(b);
    }
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), action ? 6000 : 2600);
  }

  function render() {
    try {
      const sunday = addDays(monday, 6);
      current = markConflicts(instancesBetween(monday, sunday));
      document.body.dataset.view = view;
      renderHeader(sunday);
      renderStrip();
      renderChips();
      if (view === 'week') renderGrid(); else renderDay();
      renderSummary();
      if (firstRender) {
        firstRender = false;
        if (view === 'day' && inWeek(ymd(new Date()))) scrollToDate(ymd(new Date()), false);
      }
    } catch (err) {
      $('board').innerHTML = '<div class="board-error">Không đọc được dữ liệu lịch: ' + esc(err.message) +
        '. Kiểm tra lại file schedule.js (thường do thiếu dấu phẩy, dấu nháy, hoặc giờ viết sai dạng HH:MM).</div>';
      console.error(err);
    }
  }

  function renderHeader(sunday) {
    const m1 = monday.getMonth() + 1, m2 = sunday.getMonth() + 1;
    $('monthLabel').textContent = m1 === m2 ? 'Tháng ' + m1 : 'Tháng ' + m1 + ' – ' + m2;
    const diff = weeksBetween(new Date(), monday);
    const rel = diff === 0 ? 'tuần này' : diff === 1 ? 'tuần sau' : diff === -1 ? 'tuần trước'
      : diff > 0 ? diff + ' tuần nữa' : (-diff) + ' tuần trước';
    $('weekSub').textContent = short(ymd(monday)) + ' – ' + short(ymd(sunday)) + '/' + sunday.getFullYear() + ', ' + rel;
    const s = stats(current, new Date());
    $('heroDone').textContent = fmtHours(s.done);
    $('heroPlan').textContent = '/ ' + fmtHours(s.plan) + ' đã hoạt động';
    $('heroFill').style.width = (s.plan ? Math.min(100, s.done / s.plan * 100) : 0) + '%';
    $('viewDay').setAttribute('aria-pressed', String(view === 'day'));
    $('viewWeek').setAttribute('aria-pressed', String(view === 'week'));
    document.querySelectorAll('[data-mview]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mview === view)));
  }

  function renderStrip() {
    const todayS = ymd(new Date());
    let h = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i), ds = ymd(d);
      const cols = [...new Set(visible().filter(x => x.date === ds).map(x => x.mau))].slice(0, 4);
      h += '<button class="sday' + (ds === todayS ? ' today' : '') + (ds === selDate ? ' sel' : '') + '" data-drop="' + ds +
        '" data-jump="' + ds + '" aria-label="' + DAY_FULL[d.getDay()] + ' ' + short(ds) + '">' +
        '<span class="sw">' + DAY_SHORT[d.getDay()] + '</span><span class="sd">' + d.getDate() + '</span>' +
        '<span class="sdots" aria-hidden="true">' + cols.map(c => '<i style="--c:' + c + '"></i>').join('') + '</span></button>';
    }
    $('strip').innerHTML = h;
  }

  function renderChips() {
    $('chips').innerHTML = DATA.lich.map(c =>
      '<button class="chip" data-cal="' + c.id + '" aria-pressed="' + !hidden.has(c.id) + '" style="--c:' + colorOf({ lich: c.id }) + '">' +
      '<span class="dot"></span>' + esc(c.ten) + '<span class="prio">' + c.uuTien + '</span></button>'
    ).join('');
  }

  function conflictName(x) {
    const w = x.trung.find(y => CAL[y.lich].uuTien <= CAL[x.lich].uuTien) || x.trung[0];
    return w.ten;
  }

  function badgesFor(x) {
    const b = [];
    if (x.thua) b.push('<span class="badge bad">trùng ' + esc(conflictName(x)) + '</span>');
    if (x.opt) b.push('<span class="badge">tùy chọn</span>');
    if (x.daDoi) b.push('<span class="badge">dời từ ' + dayShort(x.goc.date) + (x.allDay ? '' : ' ' + hm(x.goc.s)) + '</span>');
    if (x.boQua) b.push('<span class="badge">bỏ qua</span>');
    if (x.phut) b.push('<span class="badge">thực tế ' + x.phut + ' phút</span>');
    if (x.lap) b.push('<span class="badge">lặp hàng tuần</span>');
    return b.length ? '<div class="badges">' + b.join('') + '</div>' : '';
  }

  function checkBtn(x) {
    return '<button class="check" data-tick="' + esc(x.id) + '" aria-pressed="' + x.xong + '" aria-label="' +
      (x.xong ? 'Bỏ đánh dấu hoàn thành ' : 'Đánh dấu hoàn thành ') + esc(x.ten) + '"><span aria-hidden="true">✓</span></button>';
  }

  function actionBtns(x) {
    return '<button class="more" data-open="' + esc(x.id) + '" aria-label="Chi tiết ' + esc(x.ten) + '">' +
      '<span class="lbl">Chi tiết</span><span class="ico" aria-hidden="true">›</span></button>' +
      '<button class="handle" data-drag="' + esc(x.id) + '" aria-label="Giữ và kéo để dời ' + esc(x.ten) + ' sang ngày khác">⋮</button>';
  }

  function cardHtml(x) {
    const cls = ['card'];
    if (x.xong) cls.push('done');
    if (x.boQua) cls.push('skip');
    if (x.opt && !x.xong && !x.boQua) cls.push('opt');
    if (x.thua) cls.push('lose');
    return '<article class="' + cls.join(' ') + '" style="' + colorVars(x) + '">' + checkBtn(x) +
      '<div class="cbody" data-open="' + esc(x.id) + '"><div class="ct">' + esc(x.ten) + '</div>' +
      '<div class="cm">' + hm(x.s) + ' – ' + hm(x.e) + '</div>' + badgesFor(x) +
      (x.ghiChu ? '<div class="cnote">' + esc(x.ghiChu) + '</div>' : '') + '</div>' + actionBtns(x) + '</article>';
  }

  function taskHtml(x) {
    return '<div class="task' + (x.xong ? ' done' : '') + (x.boQua ? ' skip' : '') + '" style="' + colorVars(x) + '">' + checkBtn(x) +
      '<div class="tbody" data-open="' + esc(x.id) + '"><span class="tt">' +
      (x.quanTrong ? '<span class="star" aria-label="Quan trọng">★</span> ' : '') + esc(x.ten) + '</span>' + badgesFor(x) +
      (x.ghiChu ? '<div class="cnote">' + esc(x.ghiChu) + '</div>' : '') + '</div>' + actionBtns(x) + '</div>';
  }

  function renderDay() {
    const vis = visible();
    const now = new Date(), todayS = ymd(now), nowH = now.getHours() + now.getMinutes() / 60;
    let h = '<div class="agenda">';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i), ds = ymd(d);
      const tasks = vis.filter(x => x.date === ds && x.allDay).sort((a, b) => (b.quanTrong ? 1 : 0) - (a.quanTrong ? 1 : 0));
      const evs = vis.filter(x => x.date === ds && !x.allDay).sort((a, b) => a.s - b.s || a.e - b.e);
      h += '<section class="dayrow' + (ds === todayS ? ' today' : '') + '" id="d-' + ds + '" data-drop="' + ds + '" aria-label="' +
        DAY_FULL[d.getDay()] + ' ' + short(ds) + '"><div class="dlabel" aria-hidden="true"><span class="dw">' + DAY_SHORT[d.getDay()] +
        '</span><span class="dn">' + d.getDate() + '</span></div><div class="ditems">';
      tasks.forEach(x => { h += taskHtml(x); });
      let nowPlaced = ds !== todayS;
      evs.forEach(x => {
        if (!nowPlaced && x.s >= nowH) { h += '<div class="nowline" aria-label="Bây giờ"></div>'; nowPlaced = true; }
        h += cardHtml(x);
      });
      if (!nowPlaced && evs.length) h += '<div class="nowline" aria-label="Bây giờ"></div>';
      if (!tasks.length && !evs.length) h += '<button class="addhere" data-add="' + ds + '">Trống. Chạm để thêm lịch</button>';
      h += '</div></section>';
    }
    $('board').innerHTML = h + '</div>';
  }

  function renderGrid() {
    const vis = visible();
    const timed = vis.filter(x => !x.allDay);
    let S = 8, E = 22;
    timed.forEach(x => { S = Math.min(S, Math.floor(x.s)); E = Math.max(E, Math.ceil(x.e)); });
    const H = 48, tall = (E - S) * H;
    assignLanes(timed);
    const now = new Date(), todayS = ymd(now), nowH = now.getHours() + now.getMinutes() / 60;

    let h = '<div class="gridpad"><div class="grid-wrap"><div class="grid"><div class="gh corner"></div>';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i), ds = ymd(d);
      h += '<div class="gh' + (ds === todayS ? ' today' : '') + '" data-drop="' + ds + '"><div class="gdn">' + DAY_SHORT[d.getDay()] +
        '</div><div class="gdd">' + d.getDate() + '</div>' +
        vis.filter(x => x.date === ds && x.allDay).map(x => '<button class="gtask' + (x.xong ? ' done' : '') + '" data-open="' + esc(x.id) +
          '" style="' + colorVars(x) + '">' + (x.quanTrong ? '★ ' : '') + esc(x.ten) + '</button>').join('') + '</div>';
    }
    h += '<div class="col tcol" style="height:' + tall + 'px">';
    for (let k = S + 1; k < E; k++) h += '<span class="tlabel" style="top:' + (k - S) * H + 'px">' + k + 'h</span>';
    h += '</div>';
    for (let i = 0; i < 7; i++) {
      const ds = ymd(addDays(monday, i));
      h += '<div class="col' + (ds === todayS ? ' today' : '') + '" data-drop="' + ds + '" data-s="' + S + '" data-h="' + H + '" style="height:' + tall + 'px">';
      for (let k = S + 1; k < E; k++) h += '<div class="hline" style="top:' + (k - S) * H + 'px"></div>';
      timed.filter(x => x.date === ds).forEach(x => {
        const cls = ['ev'];
        if (x.xong) cls.push('done');
        if (x.opt && !x.xong && !x.boQua) cls.push('opt');
        if (x.boQua) cls.push('skip');
        if (x.thua) cls.push('lose');
        const flags = [];
        if (x.thua) flags.push('trùng giờ');
        if (x.daDoi) flags.push('đã dời');
        if (x.ghiChu) flags.push('có ghi chú');
        const label = x.ten + ', ' + hm(x.s) + ' đến ' + hm(x.e) + (x.xong ? ', đã hoàn thành' : '') + (flags.length ? ', ' + flags.join(', ') : '');
        h += '<div class="' + cls.join(' ') + '" style="' + colorVars(x) + ';top:' + ((x.s - S) * H + 1) + 'px;height:' + Math.max(dur(x) * H - 2, 22) +
          'px;left:calc(' + (x.lane / x.n * 100) + '% + 3px);width:calc(' + (100 / x.n) + '% - 6px)">' +
          '<button class="evopen" data-open="' + esc(x.id) + '" aria-label="' + esc(label) + '"><span class="t">' + (x.xong ? '✓ ' : '') + esc(x.ten) +
          '</span><span class="h">' + hm(x.s) + '–' + hm(x.e) + '</span>' + (flags.length ? '<span class="f">' + flags.join(', ') + '</span>' : '') + '</button>' +
          '<button class="handle mini" data-drag="' + esc(x.id) + '" aria-label="Kéo để dời ' + esc(x.ten) + '">⋮</button></div>';
      });
      if (ds === todayS && nowH > S && nowH < E) h += '<div class="now" style="top:' + (nowH - S) * H + 'px"></div>';
      h += '</div>';
    }
    $('board').innerHTML = h + '</div></div></div>';
  }

  function renderSummary() {
    const s = stats(current, new Date());
    let bars = '', detail = '';
    DATA.lich.forEach(c => {
      const p = s.per[c.id];
      if (!p.plan && !p.done) return;
      const pc = p.plan ? Math.min(100, p.done / p.plan * 100) : 100;
      bars += '<div class="bar" style="--c:' + colorOf({ lich: c.id }) + '"><span>' + esc(c.ten) + '</span><div class="track"><div class="fill" style="width:' +
        Math.round(pc) + '%"></div></div><span class="val">' + fmtHours(p.done) + ' / ' + fmtHours(p.plan) + '</span></div>';
      const parts = Object.entries(s.byTitle[c.id]);
      if (parts.length) detail += '<p class="detail">' + esc(c.ten) + ': ' + parts.map(([t, v]) => esc(t) + ' ' + fmtHours(v)).join(', ') + '</p>';
    });
    const notes = current.filter(x => x.ghiChu).sort((a, b) => (a.date + hm(a.s)).localeCompare(b.date + hm(b.s)));
    let h = '<div><h2>Giờ theo lịch</h2>' + bars + detail + '</div>' +
      '<div><h2>Buổi trong tuần</h2><div class="counts">' +
      '<div class="count"><b>' + s.nDone + '/' + s.nPlan + '</b>buổi hoàn thành</div>' +
      '<div class="count' + (s.nOpen ? ' alert' : '') + '"><b>' + s.nOpen + '</b>buổi đã qua chưa tick</div>' +
      '<div class="count"><b>' + s.nMoved + '</b>buổi đã dời</div>' +
      '<div class="count"><b>' + s.nSkip + '</b>buổi bỏ qua</div>' +
      (s.tTotal ? '<div class="count"><b>' + s.tDone + '/' + s.tTotal + '</b>việc cần làm đã xong</div>' : '') + '</div></div>';
    if (notes.length) {
      h += '<div><h2>Ghi chú trong tuần</h2><ul class="notes">' + notes.map(x =>
        '<li><span>' + dayShort(x.date) + ', ' + esc(x.ten) + '</span>' + esc(x.ghiChu) + '</li>').join('') + '</ul></div>';
    }
    $('summary').innerHTML = h;
  }

  function scrollToDate(ds, smooth) {
    const el = $('d-' + ds);
    if (el) el.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
  }

  /* ---------- Lưu thay đổi ---------- */
  function setEntry(id, entry) {
    Object.keys(entry).forEach(k => { if (entry[k] === undefined || entry[k] === '' || entry[k] === false || entry[k] === null) delete entry[k]; });
    if (Object.keys(entry).length) log[id] = entry; else delete log[id];
    saveLog();
  }

  function undoFor(id) {
    const prev = log[id] ? Object.assign({}, log[id]) : null;
    return () => { if (prev) log[id] = prev; else delete log[id]; saveLog(); render(); };
  }

  function toggleDone(id) {
    const x = findItem(id);
    if (!x) return;
    const L = Object.assign({}, log[id]);
    L.xong = !x.xong;
    if (L.xong) L.boQua = undefined;
    setEntry(id, L);
    render();
  }

  function moveTo(x, date, time) {
    const newS = time != null ? time : x.s;
    if (date === x.date && Math.abs(newS - x.s) < 1e-9) return;
    const undo = undoFor(x.id);
    const L = Object.assign({}, log[x.id]);
    L.doiNgay = date !== x.goc.date ? date : undefined;
    if (!x.allDay) L.doiGio = hm(newS) !== hm(x.goc.s) ? hm(newS) : undefined;
    setEntry(x.id, L);
    render();
    toast('Đã dời ' + x.ten + ' sang ' + dayShort(date) + (x.allDay ? '' : ', ' + hm(newS)), { label: 'Hoàn tác', fn: undo });
  }

  /* ---------- Kéo để dời lịch ---------- */
  function startDrag(e, handle) {
    const x = findItem(handle.dataset.drag);
    if (!x || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    drag = { x, pid: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, target: null, vy: 0, raf: 0 };
    try { handle.setPointerCapture(e.pointerId); } catch (_) { /* bỏ qua */ }
  }

  function dragMove(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      drag.moved = true;
      document.body.classList.add('dragging');
      const g = $('ghost');
      g.setAttribute('style', colorVars(drag.x));
      g.style.display = 'block';
      if (navigator.vibrate) navigator.vibrate(12);
      autoScroll();
    }
    e.preventDefault();
    const g = $('ghost');
    g.style.transform = 'translate(' + Math.min(e.clientX + 14, window.innerWidth - 250) + 'px,' + (e.clientY - 56) + 'px)';

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const t = el && el.closest('[data-drop]');
    document.querySelectorAll('.drop-on').forEach(n => { if (n !== t) n.classList.remove('drop-on'); });
    let target = null;
    if (t) {
      t.classList.add('drop-on');
      target = { date: t.dataset.drop, time: null };
      if (t.classList.contains('col') && !drag.x.allDay) {
        const r = t.getBoundingClientRect();
        const S = +t.dataset.s, H = +t.dataset.h, len = dur(drag.x);
        const raw = S + (e.clientY - r.top) / H;
        target.time = Math.max(0, Math.min(24 - len, Math.round(raw * 4) / 4));
      }
    }
    drag.target = target;
    const when = target ? dayShort(target.date) + (drag.x.allDay ? '' : ', ' + hm(target.time != null ? target.time : drag.x.s)) : 'thả vào một ngày';
    g.textContent = drag.x.ten + ' → ' + when;

    const stripBottom = view === 'day' ? Math.max(0, $('strip').getBoundingClientRect().bottom) : 0;
    drag.vy = (e.clientY > stripBottom && e.clientY < stripBottom + 60) ? -14 : (e.clientY > window.innerHeight - 70 ? 14 : 0);
  }

  function autoScroll() {
    if (!drag) return;
    if (drag.vy) window.scrollBy(0, drag.vy);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.pid)) return;
    const d = drag;
    drag = null;
    cancelAnimationFrame(d.raf);
    document.body.classList.remove('dragging');
    $('ghost').style.display = 'none';
    document.querySelectorAll('.drop-on').forEach(n => n.classList.remove('drop-on'));
    if (!d.moved) { if (!cancelled) toast('Giữ biểu tượng ⋮ rồi kéo sang ngày khác để dời lịch'); return; }
    if (!cancelled && d.target) moveTo(d.x, d.target.date, d.target.time);
  }

  /* ---------- Bảng chi tiết ---------- */
  function openDetails(id) {
    const x = findItem(id);
    if (!x) return;
    openId = id;
    const c = CAL[x.lich], d = parseDate(x.date);
    const cu = x.custom ? custom.find(k => k.cid === x.custom) : null;
    let h = '<div class="grabber" aria-hidden="true"></div>' +
      '<div class="sh-head" style="' + colorVars(x) + '"><span class="swatch"></span><div>' +
      '<h2 id="dlgTitle">' + (x.quanTrong ? '★ ' : '') + esc(x.ten) + '</h2>' +
      '<p>' + DAY_FULL[d.getDay()] + ', ' + short(x.date) + (x.allDay ? ', việc cần làm' : ', ' + hm(x.s) + ' – ' + hm(x.e)) + '</p>' +
      '<p>' + esc(c.ten) + (x.lap ? ', lặp hàng tuần' : '') + '</p>' +
      (x.daDoi ? '<p>Lịch gốc: ' + dayShort(x.goc.date) + (x.allDay ? '' : ', ' + hm(x.goc.s) + ' – ' + hm(x.goc.e)) + '</p>' : '') +
      '</div><button class="close" data-close aria-label="Đóng">&times;</button></div>';
    if (x.trung && x.trung.length) {
      h += '<div class="warn">Trùng giờ với ' + x.trung.map(y => esc(y.ten) + ' ' + hm(y.s) + '–' + hm(y.e)).join(', ') +
        (x.thua ? '. Buổi này có ưu tiên thấp hơn.' : '.') + '</div>';
    }
    h += '<label class="bigtoggle"><input type="checkbox" id="fXong"' + (x.xong ? ' checked' : '') + '> Đã hoàn thành</label>';
    if (cu) h += '<label>Tên<input type="text" id="fTen" maxlength="80" value="' + esc(cu.ten) + '"></label>';
    h += '<fieldset><legend>Dời lịch</legend><div class="quick">' +
      (x.allDay ? '' : '<button type="button" data-q="-30">Sớm 30 phút</button><button type="button" data-q="30">Muộn 30 phút</button>') +
      '<button type="button" data-qd="1">Ngày mai</button><button type="button" data-qd="7">Tuần sau</button></div>' +
      '<div class="fields' + (x.allDay ? ' one' : '') + '"><label>Ngày<input type="date" id="fDate" value="' + x.date + '"></label>' +
      (x.allDay ? '' : '<label>Bắt đầu<input type="time" id="fTime" value="' + hm(x.s) + '"></label>') + '</div></fieldset>';
    if (!x.allDay) {
      h += '<label>Thời lượng thực tế (phút)<input type="number" id="fPhut" min="1" step="5" inputmode="numeric" value="' + Math.round(real(x) * 60) + '"></label>';
    }
    h += '<label>Ghi chú<textarea id="fNote" rows="3" placeholder="Ví dụ: học viên vắng 2, cần ôn lại đoạn điệp khúc">' + esc(x.ghiChu) + '</textarea></label>' +
      '<p class="err" id="fErr" role="alert"></p>' +
      '<div class="actions"><button class="primary" data-save>Lưu thay đổi</button>' +
      '<button data-skip>' + (x.boQua ? 'Hủy bỏ qua' : 'Bỏ qua buổi này') + '</button>' +
      (x.daDoi ? '<button data-reset>Trả về lịch gốc</button>' : '') +
      (cu ? '<button class="danger" data-del>' + (cu.lap ? 'Xóa cả chuỗi lặp' : 'Xóa') + '</button>' : '') + '</div>';
    $('dlgBody').innerHTML = h;
    $('dlg').showModal();
  }

  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }

  function quickAdjust(btn) {
    if (btn.dataset.qd) {
      const f = $('fDate');
      if (f.value) { f.value = ymd(addDays(parseDate(f.value), +btn.dataset.qd)); flash(f); }
    }
    if (btn.dataset.q) {
      const f = $('fTime');
      if (/^\d{2}:\d{2}$/.test(f.value)) { f.value = hm(Math.max(0, Math.min(23.75, toH(f.value) + btn.dataset.q / 60))); flash(f); }
    }
  }

  function closeDialog() { openId = null; if ($('dlg').open) $('dlg').close(); }

  function saveDetails() {
    const x = findItem(openId);
    if (!x) return;
    const err = $('fErr');
    const date = $('fDate').value;
    if (!date) { err.textContent = 'Chọn ngày cho buổi này.'; return; }
    let time = null, phut = null;
    if (!x.allDay) {
      time = $('fTime').value;
      phut = parseInt($('fPhut').value, 10);
      if (!/^\d{2}:\d{2}$/.test(time)) { err.textContent = 'Chọn giờ bắt đầu.'; return; }
      if (!(phut > 0)) { err.textContent = 'Nhập thời lượng thực tế lớn hơn 0 phút.'; return; }
    }
    const cu = x.custom ? custom.find(k => k.cid === x.custom) : null;
    if (cu && $('fTen')) {
      const ten = $('fTen').value.trim();
      if (!ten) { err.textContent = 'Nhập tên cho lịch này.'; return; }
      if (ten !== cu.ten) { cu.ten = ten; saveCustom(); }
    }
    const L = Object.assign({}, log[x.id]);
    L.doiNgay = date !== x.goc.date ? date : undefined;
    if (!x.allDay) {
      L.doiGio = time !== hm(x.goc.s) ? time : undefined;
      L.phutThucTe = phut !== Math.round(dur(x.goc) * 60) ? phut : undefined;
    }
    L.ghiChu = $('fNote').value.trim();
    L.xong = $('fXong').checked;
    if (L.xong) L.boQua = undefined;
    const moved = date !== x.date || (!x.allDay && time !== hm(x.s));
    setEntry(x.id, L);
    closeDialog();
    if (moved && !inWeek(date)) { monday = mondayOf(parseDate(date)); }
    render();
    toast(moved ? 'Đã dời sang ' + dayShort(date) + (x.allDay ? '' : ', ' + time) : 'Đã lưu');
  }

  function toggleSkip() {
    const x = findItem(openId);
    if (!x) return;
    const undo = undoFor(x.id);
    const L = Object.assign({}, log[x.id]);
    L.boQua = !x.boQua;
    if (L.boQua) L.xong = undefined;
    setEntry(x.id, L);
    closeDialog();
    render();
    toast(L.boQua ? 'Đã bỏ qua ' + x.ten : 'Đã hủy bỏ qua', { label: 'Hoàn tác', fn: undo });
  }

  function resetMove() {
    const x = findItem(openId);
    if (!x) return;
    const undo = undoFor(x.id);
    const L = Object.assign({}, log[x.id]);
    L.doiNgay = undefined; L.doiGio = undefined;
    setEntry(x.id, L);
    closeDialog();
    render();
    toast('Đã trả ' + x.ten + ' về lịch gốc', { label: 'Hoàn tác', fn: undo });
  }

  function deleteCustom() {
    const x = findItem(openId);
    const cu = x && x.custom ? custom.find(k => k.cid === x.custom) : null;
    if (!cu) return;
    const prefix = 'u-' + cu.cid + '@';
    const savedLog = {};
    Object.keys(log).forEach(k => { if (k.indexOf(prefix) === 0) { savedLog[k] = log[k]; delete log[k]; } });
    const idx = custom.indexOf(cu);
    custom.splice(idx, 1);
    saveCustom(); saveLog();
    closeDialog();
    render();
    toast('Đã xóa ' + cu.ten, { label: 'Hoàn tác', fn: () => {
      custom.splice(Math.min(idx, custom.length), 0, cu);
      Object.assign(log, savedLog);
      saveCustom(); saveLog(); render();
    } });
  }

  /* ---------- Bảng thêm mới ---------- */
  function openAdd(date) {
    openId = null;
    addKind = 'event';
    const todayS = ymd(new Date());
    const ds = date || (selDate && inWeek(selDate) ? selDate : (inWeek(todayS) ? todayS : ymd(monday)));
    const st = Math.min(22, Math.max(6, new Date().getHours() + 1));
    const defCal = CAL.viec ? 'viec' : DATA.lich[0].id;
    const h = '<div class="grabber" aria-hidden="true"></div>' +
      '<div class="sh-head plain"><h2 id="dlgTitle">Thêm mới</h2><button class="close" data-close aria-label="Đóng">&times;</button></div>' +
      '<div class="seg" role="group" aria-label="Loại"><button type="button" data-kind="event" aria-pressed="true">Lịch có giờ</button>' +
      '<button type="button" data-kind="task" aria-pressed="false">Việc cần làm</button></div>' +
      '<label>Tên<input type="text" id="aTen" maxlength="80" placeholder="Ví dụ: Họp nhóm biên đạo"></label>' +
      '<div><span class="lab" id="aLichLab">Thuộc lịch</span><div class="picks" role="radiogroup" aria-labelledby="aLichLab">' +
      DATA.lich.map(c => '<label class="pick" style="--c:' + colorOf({ lich: c.id }) + '"><input type="radio" name="aLich" value="' + c.id + '"' +
        (c.id === defCal ? ' checked' : '') + '><span>' + esc(c.ten) + '</span></label>').join('') + '</div></div>' +
      '<label>Ngày<input type="date" id="aDate" value="' + ds + '"></label>' +
      '<div id="aEvent" style="display:grid;gap:14px"><div class="fields"><label>Từ<input type="time" id="aTu" value="' + pad(st) + ':00"></label>' +
      '<label>Đến<input type="time" id="aDen" value="' + pad(st + 1) + ':00"></label></div>' +
      '<label class="bigtoggle"><input type="checkbox" id="aLap"> Lặp lại mỗi tuần</label></div>' +
      '<div id="aTask" hidden><label class="bigtoggle"><input type="checkbox" id="aQuan"> Đánh dấu quan trọng ★</label></div>' +
      '<p class="err" id="fErr" role="alert"></p>' +
      '<div class="actions"><button class="primary" data-create>Thêm vào lịch</button></div>';
    $('dlgBody').innerHTML = h;
    $('dlg').showModal();
    $('aTen').focus();
  }

  function setKind(kind) {
    addKind = kind;
    document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    $('aEvent').style.display = kind === 'event' ? 'grid' : 'none';
    $('aTask').hidden = kind !== 'task';
  }

  function createItem() {
    const err = $('fErr');
    const ten = $('aTen').value.trim();
    const pick = document.querySelector('input[name="aLich"]:checked');
    const date = $('aDate').value;
    if (!ten) { err.textContent = 'Nhập tên cho lịch mới.'; $('aTen').focus(); return; }
    if (!pick) { err.textContent = 'Chọn lịch mà mục này thuộc về.'; return; }
    if (!date) { err.textContent = 'Chọn ngày.'; return; }
    const item = { cid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: addKind, lich: pick.value, ten, date };
    if (addKind === 'event') {
      const tu = $('aTu').value, den = $('aDen').value;
      if (!/^\d{2}:\d{2}$/.test(tu) || !/^\d{2}:\d{2}$/.test(den)) { err.textContent = 'Chọn giờ bắt đầu và giờ kết thúc.'; return; }
      if (toH(den) <= toH(tu)) { err.textContent = 'Giờ kết thúc phải sau giờ bắt đầu.'; return; }
      item.tu = tu; item.den = den; item.lap = $('aLap').checked;
    } else {
      item.quanTrong = $('aQuan').checked;
    }
    custom.push(item);
    saveCustom();
    closeDialog();
    monday = mondayOf(parseDate(date));
    selDate = date;
    render();
    if (view === 'day') scrollToDate(date, true);
    toast('Đã thêm ' + ten, { label: 'Hoàn tác', fn: () => { custom = custom.filter(k => k.cid !== item.cid); saveCustom(); render(); } });
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function setView(v) {
    view = v;
    saveUi();
    render();
    if (v === 'day' && inWeek(ymd(new Date()))) scrollToDate(ymd(new Date()), false);
  }

  /* ---------- Sự kiện ---------- */
  function bind() {
    $('prev').onclick = () => { monday = addDays(monday, -7); selDate = null; render(); window.scrollTo(0, 0); };
    $('next').onclick = () => { monday = addDays(monday, 7); selDate = null; render(); window.scrollTo(0, 0); };
    $('today').onclick = () => {
      monday = mondayOf(new Date()); selDate = null; render();
      if (view === 'day') scrollToDate(ymd(new Date()), true);
    };
    $('viewDay').onclick = () => setView('day');
    $('viewWeek').onclick = () => setView('week');
    $('fab').onclick = () => openAdd();
    $('menuBtn').onclick = () => $('menu').showModal();

    $('chips').addEventListener('click', e => {
      const b = e.target.closest('[data-cal]');
      if (!b) return;
      const id = b.dataset.cal;
      if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
      saveUi(); render();
    });

    $('strip').addEventListener('click', e => {
      const b = e.target.closest('[data-jump]');
      if (!b) return;
      selDate = b.dataset.jump;
      renderStrip();
      scrollToDate(selDate, true);
    });

    $('board').addEventListener('click', e => {
      const tick = e.target.closest('[data-tick]');
      if (tick) { toggleDone(tick.dataset.tick); return; }
      const add = e.target.closest('[data-add]');
      if (add) { openAdd(add.dataset.add); return; }
      const open = e.target.closest('[data-open]');
      if (open) openDetails(open.dataset.open);
    });
    $('board').addEventListener('keydown', e => {
      const h = e.target.closest('[data-drag]');
      if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetails(h.dataset.drag); }
    });

    document.addEventListener('pointerdown', e => {
      const h = e.target.closest('[data-drag]');
      if (h) startDrag(e, h);
    });
    document.addEventListener('pointermove', dragMove, { passive: false });
    document.addEventListener('pointerup', e => endDrag(e, false));
    document.addEventListener('pointercancel', e => endDrag(e, true));
    document.addEventListener('contextmenu', e => { if (e.target.closest('[data-drag]')) e.preventDefault(); });

    $('dlgBody').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-close')) closeDialog();
      else if (b.hasAttribute('data-save')) saveDetails();
      else if (b.hasAttribute('data-skip')) toggleSkip();
      else if (b.hasAttribute('data-reset')) resetMove();
      else if (b.hasAttribute('data-del')) deleteCustom();
      else if (b.hasAttribute('data-create')) createItem();
      else if (b.dataset.kind) setKind(b.dataset.kind);
      else if (b.dataset.q || b.dataset.qd) quickAdjust(b);
    });
    $('dlgBody').addEventListener('input', () => { const err = $('fErr'); if (err) err.textContent = ''; });
    $('dlg').addEventListener('click', e => { if (e.target === $('dlg')) closeDialog(); });
    $('dlg').addEventListener('close', () => { openId = null; });

    $('menu').addEventListener('click', e => {
      if (e.target === $('menu') || e.target.closest('[data-mclose]')) { $('menu').close(); return; }
      const v = e.target.closest('[data-mview]');
      if (v) { $('menu').close(); setView(v.dataset.mview); }
    });
    $('btnIcs').onclick = () => {
      const from = mondayOf(new Date());
      download('bino-schedule.ics', icsText(from, addDays(from, 7 * 8 - 1)), 'text/calendar;charset=utf-8');
      $('menu').close();
      toast('Đã tải lịch 8 tuần tới');
    };
    $('btnBackup').onclick = () => {
      download('bino-schedule-sao-luu-' + ymd(new Date()) + '.json',
        JSON.stringify({ app: 'bino-schedule', version: 2, log, custom }, null, 2), 'application/json');
      $('menu').close();
      toast('Đã tải file sao lưu');
    };
    $('btnRestore').onclick = () => $('restoreFile').click();
    $('restoreFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(reader.result);
          const newLog = obj && obj.log ? obj.log : obj;
          const newCustom = obj && Array.isArray(obj.custom) ? obj.custom : custom;
          if (!newLog || typeof newLog !== 'object' || Array.isArray(newLog)) throw new Error('sai định dạng');
          if (!window.confirm('Thay toàn bộ tick, ghi chú và lịch tự thêm hiện tại bằng file sao lưu này?')) return;
          log = newLog; custom = newCustom;
          saveLog(); saveCustom(); $('menu').close(); render();
          toast('Đã khôi phục dữ liệu');
        } catch (err) {
          toast('File này không phải bản sao lưu của BINO SCHEDULE.');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(f);
    });

    document.addEventListener('keydown', e => {
      if ($('dlg').open || $('menu').open || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') $('prev').click();
      if (e.key === 'ArrowRight') $('next').click();
    });

    // Cập nhật vạch giờ hiện tại mỗi phút
    setInterval(() => { if (!$('dlg').open && !$('menu').open && !drag) render(); }, 60000);
  }

  if (!DATA) {
    $('board').innerHTML = '<div class="board-error">Không tìm thấy file schedule.js. Đặt file này cùng thư mục với index.html.</div>';
    return;
  }
  bind();
  render();

  // Cho phép cài lên màn hình chính và mở khi mất mạng (chỉ chạy trên GitHub Pages, không chạy khi mở file trực tiếp)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
