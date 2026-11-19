/* bino schedule 1.0: giao diện */
(function () {
  'use strict';
  const B = window.Bino;
  const u = B.u;
  const { esc, hm, ymd, addDays, parseDate, mondayOf, short, dayShort, fmtHours, DAY_SHORT, DAY_FULL, isHex, isTime, toH, dur, real } = u;
  const $ = id => document.getElementById(id);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = window.matchMedia && window.matchMedia('(max-width: 899px)').matches;
  const VIEWS = { buoi: 'Buổi', ngay: 'Ngày', tuan: 'Tuần', thang: 'Tháng', nam: 'Năm' };
  const REPEATS = { none: 'Không lặp', daily: 'Hàng ngày', weekly: 'Hàng tuần', biweekly: '2 tuần một lần' };
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

  let S;                        // B.state
  let view = 'ngay';
  let cursor = new Date();      // ngày đang chọn
  let half = new Date().getHours() < 12 ? 'sang' : 'chieu';
  let current = [];             // các buổi của tuần đang xem
  let hidden = new Set();
  let openId = null;
  let drag = null;
  let wx = null, wxLoading = false;
  let firstScroll = true;
  let formCtx = null, calDraft = null, imgPurpose = null, tourState = null;

  const monday = () => mondayOf(cursor);
  const todayS = () => ymd(new Date());
  const inWeek = ds => ds >= ymd(monday()) && ds <= ymd(addDays(monday(), 6));
  const visible = () => current.filter(x => !hidden.has(x.lich));
  const findItem = id => current.find(y => y.id === id);
  const styleOf = x => B.theme.fillVars(B.CAL[x.lich], x.mau);
  const fill = t => B.miu.fill(t);
  const nowH = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60; };
  const fmtDur = h => { const m = Math.round(h * 60); const hh = Math.floor(m / 60), mm = m % 60; return hh ? hh + 'h' + (mm ? u.pad(mm) : '') : mm + ' phút'; };

  /* ---------- Thông báo nhỏ và hoàn tác ---------- */
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
  function snapshot() { return JSON.stringify({ data: S.data, log: S.log }); }
  function undoTo(snap, after) {
    return { label: 'Hoàn tác', fn: () => {
      const o = JSON.parse(snap); S.data = o.data; S.log = o.log; B.saveData(); B.saveLog(); B.refreshCal(); render();
      if (after && $('dlg').open) after();
    } };
  }
  function setEntry(id, entry) {
    Object.keys(entry).forEach(k => { if (entry[k] === undefined || entry[k] === '' || entry[k] === false || entry[k] === null) delete entry[k]; });
    if (Object.keys(entry).length) S.log[id] = entry; else delete S.log[id];
    if (!B.saveLog()) toast('Không lưu được. Trình duyệt đang chặn bộ nhớ, hãy tắt chế độ ẩn danh.');
  }
  const findSeries = sid => S.data.series.find(s => s.id === sid);

  /* ---------- Vẽ toàn trang ---------- */
  function render() {
    try {
      B.refreshCal();
      const mon = monday();
      current = B.markConflicts(B.instancesBetween(mon, addDays(mon, 6)));
      document.body.dataset.view = view;
      renderHeader();
      renderStrip();
      renderChips();
      if (view === 'buoi') renderBuoi();
      else if (view === 'tuan') renderTuan();
      else if (view === 'thang') renderThang();
      else if (view === 'nam') renderNam();
      else renderNgay();
      renderSummary();
      if (firstScroll && view === 'ngay') { firstScroll = false; if (inWeek(todayS())) scrollToDate(todayS(), false); }
    } catch (err) {
      console.error(err);
      $('board').innerHTML = '<div class="board-error">Có lỗi khi hiển thị lịch: ' + esc(err.message) + '. Thử tải lại trang, hoặc dùng ⋯ → Khôi phục từ file sao lưu.</div>';
    }
  }

  function renderHeader() {
    const mon = monday(), sun = addDays(mon, 6);
    const diffW = u.weeksBetween(new Date(), mon);
    const relW = diffW === 0 ? 'tuần này' : diffW === 1 ? 'tuần sau' : diffW === -1 ? 'tuần trước' : diffW > 0 ? diffW + ' tuần nữa' : (-diffW) + ' tuần trước';
    let title = '', sub = '';
    if (view === 'buoi') {
      const ds = ymd(cursor);
      const dd = Math.round((parseDate(ds) - parseDate(todayS())) / 864e5);
      title = DAY_FULL[cursor.getDay()] + ', ' + short(ds);
      sub = dd === 0 ? 'Hôm nay' : dd === 1 ? 'Ngày mai' : dd === -1 ? 'Hôm qua' : (dd > 0 ? dd + ' ngày nữa' : (-dd) + ' ngày trước');
    } else if (view === 'thang') {
      title = 'Tháng ' + (cursor.getMonth() + 1);
      sub = String(cursor.getFullYear());
    } else if (view === 'nam') {
      title = 'Năm ' + cursor.getFullYear();
      sub = 'Độ đậm theo số giờ có lịch';
    } else {
      const m1 = mon.getMonth() + 1, m2 = sun.getMonth() + 1;
      title = m1 === m2 ? 'Tháng ' + m1 : 'Tháng ' + m1 + ' – ' + m2;
      sub = short(ymd(mon)) + ' – ' + short(ymd(sun)) + '/' + sun.getFullYear() + ', ' + relW;
    }
    $('title').textContent = title;
    $('sub').textContent = sub;
    const s = B.stats(current, new Date());
    $('heroDone').textContent = fmtHours(s.done);
    $('heroPlan').textContent = '/ ' + fmtHours(s.plan) + ' đã hoạt động ' + (diffW === 0 ? 'tuần này' : relW);
    $('heroFill').style.width = (s.plan ? Math.min(100, s.done / s.plan * 100) : 0) + '%';
    $('viewSeg').innerHTML = Object.entries(VIEWS).map(([k, v]) => '<button data-view="' + k + '" aria-pressed="' + (k === view) + '">' + v + '</button>').join('');
  }

  function renderStrip() {
    const t = todayS(), sel = ymd(cursor);
    let h = '';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday(), i), ds = ymd(d);
      const cols = [...new Set(visible().filter(x => x.date === ds).map(x => x.mau))].slice(0, 4);
      h += '<button class="sday' + (ds === t ? ' today' : '') + (ds === sel ? ' sel' : '') + '" data-drop="' + ds + '" data-jump="' + ds +
        '" aria-label="' + DAY_FULL[d.getDay()] + ' ' + short(ds) + '"><span class="sw">' + DAY_SHORT[d.getDay()] + '</span><span class="sd">' + d.getDate() +
        '</span><span class="sdots" aria-hidden="true">' + cols.map(c => '<i style="--c:' + c + '"></i>').join('') + '</span></button>';
    }
    $('strip').innerHTML = h;
  }

  function renderChips() {
    $('chips').innerHTML = S.data.calendars.map((c, i) =>
      '<button class="chip" data-cal="' + esc(c.id) + '" aria-pressed="' + !hidden.has(c.id) + '" style="--c:' + c.mau + '"><span class="dot"></span>' +
      esc(c.ten) + '<span class="prio">' + (i + 1) + '</span></button>').join('');
  }

  /* ---------- Thẻ lịch ---------- */
  function conflictName(x) {
    const w = x.trung.find(y => B.CAL[y.lich].uuTien <= B.CAL[x.lich].uuTien) || x.trung[0];
    return w.ten;
  }
  function badgesFor(x) {
    const b = [];
    if (x.thua) b.push('<span class="badge bad">trùng ' + esc(conflictName(x)) + '</span>');
    if (x.opt) b.push('<span class="badge">tùy chọn</span>');
    if (x.daDoi) b.push('<span class="badge">dời từ ' + dayShort(x.goc.date) + (x.allDay ? '' : ' ' + hm(x.goc.s)) + '</span>');
    if (x.boQua) b.push('<span class="badge">bỏ qua</span>');
    if (x.phut) b.push('<span class="badge">thực tế ' + x.phut + ' phút</span>');
    return b.length ? '<div class="badges">' + b.join('') + '</div>' : '';
  }
  function checkBtn(x) {
    return '<button class="check" data-tick="' + esc(x.id) + '" aria-pressed="' + x.xong + '" aria-label="' +
      (x.xong ? 'Bỏ đánh dấu hoàn thành ' : 'Đánh dấu hoàn thành ') + esc(x.ten) + '"><span aria-hidden="true">✓</span></button>';
  }
  function actionBtns(x) {
    return '<button class="more" data-open="' + esc(x.id) + '" aria-label="Chi tiết ' + esc(x.ten) + '"><span class="lbl">Chi tiết</span><span class="ico" aria-hidden="true">›</span></button>' +
      '<button class="handle" data-drag="' + esc(x.id) + '" aria-label="Giữ và kéo để dời ' + esc(x.ten) + ' sang ngày khác">⋮</button>';
  }
  function stateCls(x, base) {
    const c = [base];
    if (x.xong) c.push('done');
    if (x.boQua) c.push('skip');
    if (x.opt && !x.xong && !x.boQua) c.push('opt');
    if (x.thua) c.push('lose');
    return c.join(' ');
  }
  function cardHtml(x) {
    return '<article class="' + stateCls(x, 'card') + '" style="' + styleOf(x) + '">' + checkBtn(x) +
      '<div class="cbody" data-open="' + esc(x.id) + '"><div class="ct">' + esc(x.ten) + '</div><div class="cm">' + hm(x.s) + ' – ' + hm(x.e) + '</div>' +
      badgesFor(x) + (x.ghiChu ? '<div class="cnote">' + esc(x.ghiChu) + '</div>' : '') + '</div>' + actionBtns(x) + '</article>';
  }
  function taskHtml(x) {
    return '<div class="' + stateCls(x, 'task') + '" style="' + styleOf(x) + '">' + checkBtn(x) +
      '<div class="tbody" data-open="' + esc(x.id) + '"><span class="tt">' + (x.quanTrong ? '<span class="star" aria-label="Quan trọng">★</span> ' : '') +
      esc(x.ten) + '</span>' + badgesFor(x) + (x.ghiChu ? '<div class="cnote">' + esc(x.ghiChu) + '</div>' : '') + '</div>' + actionBtns(x) + '</div>';
  }
  const nowLine = () => '<div class="nowline" aria-label="Bây giờ ' + hm(nowH()) + '"><span>' + hm(nowH()) + '</span></div>';
  const weatherBlock = () => B.weather.cardHtml(wx, wxLoading);

  /* ---------- Xem theo ngày ---------- */
  function renderNgay() {
    const vis = visible();
    const t = todayS(), nh = nowH();
    let h = '<div class="agenda">' + (inWeek(t) ? weatherBlock() : '');
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday(), i), ds = ymd(d);
      const tasks = vis.filter(x => x.date === ds && x.allDay).sort((a, b) => (b.quanTrong ? 1 : 0) - (a.quanTrong ? 1 : 0));
      const evs = vis.filter(x => x.date === ds && !x.allDay).sort((a, b) => a.s - b.s || a.e - b.e);
      h += '<section class="dayrow' + (ds === t ? ' today' : '') + '" id="d-' + ds + '" data-drop="' + ds + '" aria-label="' + DAY_FULL[d.getDay()] + ' ' + short(ds) + '">' +
        '<div class="dlabel" aria-hidden="true"><span class="dw">' + DAY_SHORT[d.getDay()] + '</span><span class="dn">' + d.getDate() + '</span></div><div class="ditems">';
      tasks.forEach(x => { h += taskHtml(x); });
      let placed = ds !== t;
      evs.forEach(x => { if (!placed && x.s >= nh) { h += nowLine(); placed = true; } h += cardHtml(x); });
      if (!placed) h += nowLine();
      if (!tasks.length && !evs.length) h += '<button class="addhere" data-add="' + ds + '">Trống. Chạm để thêm lịch</button>';
      h += '</div></section>';
    }
    $('board').innerHTML = h + '</div>';
  }

  /* ---------- Xem theo buổi ---------- */
  function renderBuoi() {
    const ds = ymd(cursor), t = todayS();
    const from = half === 'sang' ? 0 : 12, to = from + 12, H = 56;
    const vis = visible().filter(x => x.date === ds);
    const tasks = vis.filter(x => x.allDay);
    const lanesIn = vis.filter(x => !x.allDay && x.e > from && x.s < to)
      .map(x => Object.assign({}, x, { os: x.s, oe: x.e, s: Math.max(from, x.s), e: Math.min(to, x.e) }));
    B.assignLanes(lanesIn);
    let h = '<div class="agenda">' + (ds === t ? weatherBlock() : '') +
      '<div class="seg halfseg" role="group" aria-label="Chọn buổi"><button data-half="sang" aria-pressed="' + (half === 'sang') + '">Sáng 0h – 12h</button>' +
      '<button data-half="chieu" aria-pressed="' + (half === 'chieu') + '">Chiều tối 12h – 24h</button></div>';
    if (tasks.length) h += '<div class="ditems" style="margin-bottom:12px">' + tasks.map(taskHtml).join('') + '</div>';
    h += '<div class="btl" style="height:' + (12 * H) + 'px">';
    for (let k = from; k <= to; k++) {
      const top = (k - from) * H;
      h += '<div class="bhl" style="top:' + top + 'px"></div>' + (k < to ? '<span class="blabel" style="top:' + top + 'px">' + k + 'h</span>' : '');
    }
    lanesIn.forEach(x => {
      h += '<div class="' + stateCls(x, 'bev') + '" style="' + styleOf(x) + ';top:' + ((x.s - from) * H + 1) + 'px;height:' + Math.max((x.e - x.s) * H - 2, 26) +
        'px;left:calc(46px + (100% - 50px) * ' + (x.lane / x.n) + ');width:calc((100% - 50px) / ' + x.n + ' - 4px)">' +
        '<button class="evopen" data-open="' + esc(x.id) + '" aria-label="' + esc(x.ten + ', ' + hm(x.os) + ' đến ' + hm(x.oe)) + '">' +
        '<span class="t">' + (x.xong ? '✓ ' : '') + esc(x.ten) + '</span><span class="h">' + hm(x.os) + ' – ' + hm(x.oe) + '</span>' +
        (x.thua ? '<span class="f">trùng giờ</span>' : '') + '</button></div>';
    });
    const nh = nowH();
    if (ds === t && nh >= from && nh < to) h += '<div class="now" style="top:' + ((nh - from) * H) + 'px;left:42px"><span>' + hm(nh) + '</span></div>';
    if (!lanesIn.length) h += '<button class="addhere bempty" data-add="' + ds + '">Buổi này còn trống. Chạm để thêm lịch</button>';
    $('board').innerHTML = h + '</div></div>';
  }

  /* ---------- Xem theo tuần ---------- */
  function renderTuan() {
    const vis = visible();
    const timed = vis.filter(x => !x.allDay);
    let Smin = 7, Emax = 22;
    timed.forEach(x => { Smin = Math.min(Smin, Math.floor(x.s)); Emax = Math.max(Emax, Math.ceil(x.e)); });
    const H = 48, tall = (Emax - Smin) * H, t = todayS(), nh = nowH();
    B.assignLanes(timed);
    let h = '<div class="gridpad"><div class="grid-wrap"><div class="grid"><div class="gh corner"></div>';
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday(), i), ds = ymd(d);
      h += '<div class="gh' + (ds === t ? ' today' : '') + '" data-drop="' + ds + '"><div class="gdn">' + DAY_SHORT[d.getDay()] + '</div><div class="gdd">' + d.getDate() + '</div>' +
        vis.filter(x => x.date === ds && x.allDay).map(x => '<button class="gtask' + (x.xong ? ' done' : '') + '" data-open="' + esc(x.id) + '" style="' + styleOf(x) + '">' +
          (x.quanTrong ? '★ ' : '') + esc(x.ten) + '</button>').join('') + '</div>';
    }
    h += '<div class="col tcol" style="height:' + tall + 'px">';
    for (let k = Smin + 1; k < Emax; k++) h += '<span class="tlabel" style="top:' + (k - Smin) * H + 'px">' + k + 'h</span>';
    h += '</div>';
    for (let i = 0; i < 7; i++) {
      const ds = ymd(addDays(monday(), i));
      h += '<div class="col' + (ds === t ? ' today' : '') + '" data-drop="' + ds + '" data-s="' + Smin + '" data-h="' + H + '" style="height:' + tall + 'px">';
      for (let k = Smin + 1; k < Emax; k++) h += '<div class="hline" style="top:' + (k - Smin) * H + 'px"></div>';
      timed.filter(x => x.date === ds).forEach(x => {
        const flags = [];
        if (x.thua) flags.push('trùng giờ');
        if (x.daDoi) flags.push('đã dời');
        if (x.ghiChu) flags.push('có ghi chú');
        h += '<div class="' + stateCls(x, 'ev') + '" style="' + styleOf(x) + ';top:' + ((x.s - Smin) * H + 1) + 'px;height:' + Math.max(dur(x) * H - 2, 22) +
          'px;left:calc(' + (x.lane / x.n * 100) + '% + 3px);width:calc(' + (100 / x.n) + '% - 6px)">' +
          '<button class="evopen" data-open="' + esc(x.id) + '" aria-label="' + esc(x.ten + ', ' + hm(x.s) + ' đến ' + hm(x.e) + (flags.length ? ', ' + flags.join(', ') : '')) + '">' +
          '<span class="t">' + (x.xong ? '✓ ' : '') + esc(x.ten) + '</span><span class="h">' + hm(x.s) + '–' + hm(x.e) + '</span>' +
          (flags.length ? '<span class="f">' + flags.join(', ') + '</span>' : '') + '</button>' +
          '<button class="handle mini" data-drag="' + esc(x.id) + '" aria-label="Kéo để dời ' + esc(x.ten) + '">⋮</button></div>';
      });
      if (ds === t && nh > Smin && nh < Emax) h += '<div class="now" style="top:' + (nh - Smin) * H + 'px"><span>' + hm(nh) + '</span></div>';
      h += '</div>';
    }
    $('board').innerHTML = h + '</div></div></div>';
  }

  /* ---------- Xem theo tháng ---------- */
  function renderThang() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const gStart = mondayOf(first), gEnd = addDays(mondayOf(last), 6);
    const list = B.instancesBetween(gStart, gEnd).filter(x => !hidden.has(x.lich));
    const t = todayS(), sel = ymd(cursor);
    let plan = 0, done = 0;
    let h = '<div class="month"><div class="mhead">' + WEEK_ORDER.map(d => '<span>' + DAY_SHORT[d] + '</span>').join('') + '</div><div class="mgrid">';
    for (let d = new Date(gStart); d <= gEnd; d = addDays(d, 1)) {
      const ds = ymd(d), other = d.getMonth() !== m;
      const items = list.filter(x => x.date === ds);
      const hrs = items.filter(x => !x.allDay && !x.opt && !x.boQua).reduce((a, x) => a + dur(x), 0);
      if (!other) { plan += hrs; done += items.filter(x => x.xong && !x.allDay).reduce((a, x) => a + real(x), 0); }
      const cols = [...new Set(items.map(x => x.mau))].slice(0, 4);
      const star = items.some(x => x.allDay && x.quanTrong && !x.xong);
      h += '<button class="mday' + (other ? ' other' : '') + (ds === t ? ' today' : '') + (ds === sel ? ' sel' : '') + '" data-mday="' + ds + '" aria-label="' +
        DAY_FULL[d.getDay()] + ' ' + short(ds) + ', ' + items.length + ' mục">' +
        '<span class="mdn">' + d.getDate() + '</span><span class="mdots" aria-hidden="true">' + cols.map(c => '<i style="--c:' + c + '"></i>').join('') + '</span>' +
        (hrs ? '<span class="mhrs">' + fmtHours(hrs) + '</span>' : '') + (star ? '<span class="mstar" aria-hidden="true">★</span>' : '') + '</button>';
    }
    h += '</div><p class="mfoot">Tháng này có ' + fmtHours(plan) + ' lịch, đã hoạt động ' + fmtHours(done) + '. Chạm một ngày để xem chi tiết.</p></div>';
    $('board').innerHTML = h;
  }

  /* ---------- Xem theo năm ---------- */
  function renderNam() {
    const y = cursor.getFullYear();
    const list = B.instancesBetween(new Date(y, 0, 1), new Date(y, 11, 31)).filter(x => !hidden.has(x.lich) && !x.allDay && !x.opt && !x.boQua);
    const per = {};
    let total = 0;
    list.forEach(x => { per[x.date] = (per[x.date] || 0) + dur(x); total += dur(x); });
    const t = todayS();
    let h = '<div class="year">';
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
      const lead = (first.getDay() + 6) % 7;
      let cells = '', mh = 0;
      for (let i = 0; i < lead; i++) cells += '<i class="ye"></i>';
      for (let d = 1; d <= days; d++) {
        const ds = y + '-' + u.pad(m + 1) + '-' + u.pad(d);
        const v = per[ds] || 0;
        mh += v;
        const lv = v === 0 ? 0 : v <= 2 ? 1 : v <= 4 ? 2 : v <= 6 ? 3 : 4;
        cells += '<i class="yl' + lv + (ds === t ? ' yt' : '') + '"></i>';
      }
      h += '<button class="ymonth' + (m === new Date().getMonth() && y === new Date().getFullYear() ? ' cur' : '') + '" data-ymonth="' + y + '-' + u.pad(m + 1) +
        '" aria-label="Tháng ' + (m + 1) + ', ' + fmtHours(mh) + '"><span class="ymn">Tháng ' + (m + 1) + '</span><span class="ymh">' + (mh ? fmtHours(mh) : '') + '</span>' +
        '<span class="ygrid" aria-hidden="true">' + cells + '</span></button>';
    }
    h += '</div><p class="mfoot ywrap">Cả năm ' + y + ' có ' + fmtHours(total) + ' lịch. Chạm một tháng để mở.</p>';
    $('board').innerHTML = h;
  }

  /* ---------- Tổng kết tuần ---------- */
  function renderSummary() {
    if (view !== 'ngay' && view !== 'tuan') { $('summary').innerHTML = ''; return; }
    const s = B.stats(current, new Date());
    let bars = '', detail = '';
    S.data.calendars.forEach(c => {
      const p = s.per[c.id];
      if (!p || (!p.plan && !p.done)) return;
      const pc = p.plan ? Math.min(100, p.done / p.plan * 100) : 100;
      bars += '<div class="bar" style="--c:' + c.mau + '"><span>' + esc(c.ten) + '</span><div class="track"><div class="fill" style="width:' + Math.round(pc) +
        '%"></div></div><span class="val">' + fmtHours(p.done) + ' / ' + fmtHours(p.plan) + '</span></div>';
      const parts = Object.entries(s.byTitle[c.id]);
      if (parts.length) detail += '<p class="detail">' + esc(c.ten) + ': ' + parts.map(([k, v]) => esc(k) + ' ' + fmtHours(v)).join(', ') + '</p>';
    });
    const notes = current.filter(x => x.ghiChu).sort((a, b) => (a.date + hm(a.s)).localeCompare(b.date + hm(b.s)));
    let h = '<div><h2>Giờ theo lịch</h2>' + (bars || '<p class="detail">Tuần này chưa có lịch nào.</p>') + detail + '</div>' +
      '<div><h2>Buổi trong tuần</h2><div class="counts">' +
      '<div class="count"><b>' + s.nDone + '/' + s.nPlan + '</b>buổi hoàn thành</div>' +
      '<div class="count' + (s.nOpen ? ' alert' : '') + '"><b>' + s.nOpen + '</b>buổi đã qua chưa tick</div>' +
      '<div class="count"><b>' + s.nMoved + '</b>buổi đã dời</div><div class="count"><b>' + s.nSkip + '</b>buổi bỏ qua</div>' +
      (s.tTotal ? '<div class="count"><b>' + s.tDone + '/' + s.tTotal + '</b>việc cần làm đã xong</div>' : '') + '</div></div>';
    if (notes.length) h += '<div><h2>Ghi chú trong tuần</h2><ul class="notes">' + notes.map(x => '<li><span>' + dayShort(x.date) + ', ' + esc(x.ten) + '</span>' + esc(x.ghiChu) + '</li>').join('') + '</ul></div>';
    $('summary').innerHTML = h;
  }

  function scrollToDate(ds, smooth) {
    const el = $('d-' + ds);
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: smooth && !reduceMotion ? 'smooth' : 'auto', block: 'start' });
  }
  function setView(v) {
    view = VIEWS[v] ? v : 'ngay';
    S.settings.view = view;
    B.saveSettings();
    render();
    if (view === 'ngay' && inWeek(todayS()) && ymd(cursor) === todayS()) scrollToDate(todayS(), false);
    else window.scrollTo(0, 0);
  }

  /* ---------- Tick, dời lịch ---------- */
  function toggleDone(id) {
    const x = findItem(id);
    if (!x) return;
    const L = Object.assign({}, S.log[id]);
    L.xong = !x.xong;
    if (L.xong) L.boQua = undefined;
    setEntry(id, L);
    render();
  }
  function moveTo(x, date, time) {
    const newS = time != null ? time : x.s;
    if (date === x.date && Math.abs(newS - x.s) < 1e-9) return;
    const snap = snapshot();
    const L = Object.assign({}, S.log[x.id]);
    L.doiNgay = date !== x.goc.date ? date : undefined;
    if (!x.allDay) L.doiGio = hm(newS) !== hm(x.goc.s) ? hm(newS) : undefined;
    setEntry(x.id, L);
    render();
    toast('Đã dời ' + x.ten + ' sang ' + dayShort(date) + (x.allDay ? '' : ', ' + hm(newS)), undoTo(snap));
  }

  /* ---------- Kéo để dời ---------- */
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
      g.setAttribute('style', styleOf(drag.x));
      g.style.display = 'block';
      if (navigator.vibrate) navigator.vibrate(12);
      autoScroll();
    }
    e.preventDefault();
    const g = $('ghost');
    g.style.transform = 'translate(' + Math.min(e.clientX + 14, window.innerWidth - 250) + 'px,' + (e.clientY - 56) + 'px)';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tg = el && el.closest('[data-drop]');
    document.querySelectorAll('.drop-on').forEach(n => { if (n !== tg) n.classList.remove('drop-on'); });
    let target = null;
    if (tg) {
      tg.classList.add('drop-on');
      target = { date: tg.dataset.drop, time: null };
      if (tg.classList.contains('col') && !drag.x.allDay) {
        const r = tg.getBoundingClientRect();
        const raw = +tg.dataset.s + (e.clientY - r.top) / +tg.dataset.h;
        target.time = Math.max(0, Math.min(24 - dur(drag.x), Math.round(raw * 4) / 4));
      }
    }
    drag.target = target;
    g.textContent = drag.x.ten + ' → ' + (target ? dayShort(target.date) + (drag.x.allDay ? '' : ', ' + hm(target.time != null ? target.time : drag.x.s)) : 'thả vào một ngày');
    const sb = view === 'ngay' ? Math.max(0, $('strip').getBoundingClientRect().bottom) : 0;
    drag.vy = (e.clientY > sb && e.clientY < sb + 60) ? -14 : (e.clientY > window.innerHeight - 70 ? 14 : 0);
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

  /* ---------- Bảng trượt ---------- */
  function openSheet(html) {
    $('dlgBody').innerHTML = '<div class="grabber" aria-hidden="true"></div>' + html;
    if (!$('dlg').open) $('dlg').showModal();
    $('dlgBody').scrollTop = 0;
  }
  function closeSheet() { openId = null; formCtx = null; calDraft = null; if ($('dlg').open) $('dlg').close(); }
  const head = (title, extra) => '<div class="sh-head plain"><h2 id="dlgTitle">' + title + '</h2><button class="close" data-act="close" aria-label="Đóng">&times;</button></div>' + (extra || '');
  const err = msg => { const el = $('fErr'); if (el) el.textContent = msg; return false; };

  /* ---------- Chi tiết một buổi ---------- */
  function openDetails(id) {
    const x = findItem(id);
    if (!x) return;
    openId = id;
    const c = B.CAL[x.lich], d = parseDate(x.date), sr = findSeries(x.sid);
    const rep = sr && sr.repeat ? sr.repeat.type : 'none';
    let h = '<div class="sh-head" style="' + styleOf(x) + '"><span class="swatch"></span><div><h2 id="dlgTitle">' + (x.quanTrong ? '★ ' : '') + esc(x.ten) + '</h2>' +
      '<p>' + DAY_FULL[d.getDay()] + ', ' + short(x.date) + (x.allDay ? ', việc cần làm' : ', ' + hm(x.s) + ' – ' + hm(x.e)) + '</p>' +
      '<p>' + esc(c.ten) + (rep !== 'none' ? ', ' + (rep === 'dates' ? 'lặp theo ngày cố định' : REPEATS[rep].toLowerCase()) : '') + '</p>' +
      (x.daDoi ? '<p>Lịch gốc: ' + dayShort(x.goc.date) + (x.allDay ? '' : ', ' + hm(x.goc.s) + ' – ' + hm(x.goc.e)) + '</p>' : '') +
      '</div><button class="close" data-act="close" aria-label="Đóng">&times;</button></div>';
    if (x.trung && x.trung.length) h += '<div class="warn">Trùng giờ với ' + x.trung.map(y => esc(y.ten) + ' ' + hm(y.s) + '–' + hm(y.e)).join(', ') + (x.thua ? '. Buổi này có ưu tiên thấp hơn.' : '.') + '</div>';
    h += '<label class="bigtoggle"><input type="checkbox" id="fXong"' + (x.xong ? ' checked' : '') + '> Đã hoàn thành</label>' +
      '<fieldset><legend>Dời buổi này</legend><div class="quick">' +
      (x.allDay ? '' : '<button type="button" data-act="q" data-v="-30">Sớm 30 phút</button><button type="button" data-act="q" data-v="30">Muộn 30 phút</button>') +
      '<button type="button" data-act="qd" data-v="1">Ngày mai</button><button type="button" data-act="qd" data-v="7">Tuần sau</button></div>' +
      '<div class="fields' + (x.allDay ? ' one' : '') + '"><label>Ngày<input type="date" id="fDate" value="' + x.date + '"></label>' +
      (x.allDay ? '' : '<label>Bắt đầu<input type="time" id="fTime" value="' + hm(x.s) + '"></label>') + '</div></fieldset>';
    if (!x.allDay) h += '<label>Thời lượng thực tế (phút)<input type="number" id="fPhut" min="1" step="5" inputmode="numeric" value="' + Math.round(real(x) * 60) + '"></label>';
    h += '<label>Ghi chú<textarea id="fNote" rows="3" placeholder="Học viên vắng 2, cần ôn lại đoạn điệp khúc">' + esc(x.ghiChu) + '</textarea></label>' +
      '<p class="err" id="fErr" role="alert"></p>' +
      '<div class="actions"><button class="primary" data-act="save">Lưu thay đổi</button>' +
      '<button data-act="skip">' + (x.boQua ? 'Hủy bỏ qua' : 'Bỏ qua buổi này') + '</button>' +
      (x.daDoi ? '<button data-act="reset">Trả về lịch gốc</button>' : '') +
      '<button data-act="edit-series">' + (x.lap ? 'Sửa cả chuỗi' : 'Sửa sự kiện') + '</button>' +
      '<button class="danger" data-act="del-menu">Xóa…</button></div>' +
      '<div class="delbox" id="delBox" hidden>' + (x.lap
        ? '<p>Xóa lịch lặp này:</p><button data-act="del-one">Chỉ buổi này</button><button data-act="del-follow">Buổi này và các buổi sau</button><button class="danger" data-act="del-all">Toàn bộ chuỗi lịch</button>'
        : '<button class="danger" data-act="del-all">Xóa sự kiện này</button>') + '<p class="fine">Sau khi xóa vẫn có nút Hoàn tác trong vài giây.</p></div>';
    openSheet(h);
  }

  function flash(el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  function quickAdjust(btn) {
    if (btn.dataset.act === 'qd') { const f = $('fDate'); if (f.value) { f.value = ymd(addDays(parseDate(f.value), +btn.dataset.v)); flash(f); } }
    else { const f = $('fTime'); if (isTime(f.value)) { f.value = hm(Math.max(0, Math.min(23.75, toH(f.value) + btn.dataset.v / 60))); flash(f); } }
  }

  function saveDetails() {
    const x = findItem(openId);
    if (!x) return;
    const date = $('fDate').value;
    if (!date) return err('Chọn ngày cho buổi này.');
    let time = null, phut = null;
    if (!x.allDay) {
      time = $('fTime').value; phut = parseInt($('fPhut').value, 10);
      if (!isTime(time)) return err('Chọn giờ bắt đầu.');
      if (!(phut > 0)) return err('Nhập thời lượng thực tế lớn hơn 0 phút.');
    }
    const L = Object.assign({}, S.log[x.id]);
    L.doiNgay = date !== x.goc.date ? date : undefined;
    if (!x.allDay) { L.doiGio = time !== hm(x.goc.s) ? time : undefined; L.phutThucTe = phut !== Math.round(dur(x.goc) * 60) ? phut : undefined; }
    L.ghiChu = $('fNote').value.trim();
    L.xong = $('fXong').checked;
    if (L.xong) L.boQua = undefined;
    const moved = date !== x.date || (!x.allDay && time !== hm(x.s));
    setEntry(x.id, L);
    closeSheet();
    if (moved && !inWeek(date)) cursor = parseDate(date);
    render();
    toast(moved ? 'Đã dời sang ' + dayShort(date) + (x.allDay ? '' : ', ' + time) : 'Đã lưu');
  }
  function toggleSkip() {
    const x = findItem(openId);
    if (!x) return;
    const snap = snapshot();
    const L = Object.assign({}, S.log[x.id]);
    L.boQua = !x.boQua;
    if (L.boQua) L.xong = undefined;
    setEntry(x.id, L);
    closeSheet(); render();
    toast(L.boQua ? 'Đã bỏ qua ' + x.ten : 'Đã hủy bỏ qua', undoTo(snap));
  }
  function resetMove() {
    const x = findItem(openId);
    if (!x) return;
    const snap = snapshot();
    const L = Object.assign({}, S.log[x.id]);
    L.doiNgay = undefined; L.doiGio = undefined;
    setEntry(x.id, L);
    closeSheet(); render();
    toast('Đã trả ' + x.ten + ' về lịch gốc', undoTo(snap));
  }
  function removeSeries(sid) {
    S.data.series = S.data.series.filter(s => s.id !== sid);
    Object.keys(S.log).forEach(k => { if (k.indexOf(sid + '@') === 0) delete S.log[k]; });
  }
  function deleteItem(scope) {
    const x = findItem(openId);
    if (!x) return;
    const sr = findSeries(x.sid);
    const snap = snapshot();
    if (scope === 'one') {
      S.log[x.id] = Object.assign({}, S.log[x.id], { xoa: true });
    } else if (scope === 'follow' && sr) {
      const orig = x.goc.date;
      if (sr.repeat && sr.repeat.type === 'dates') {
        sr.repeat.dates = sr.repeat.dates.filter(d => d < orig);
        if (!sr.repeat.dates.length) removeSeries(sr.id);
      } else if (orig <= sr.date) removeSeries(sr.id);
      else sr.until = ymd(addDays(parseDate(orig), -1));
    } else if (sr) {
      removeSeries(sr.id);
    }
    B.saveData(); B.saveLog();
    closeSheet(); render();
    toast(scope === 'one' ? 'Đã xóa buổi ' + x.ten : scope === 'follow' ? 'Đã xóa ' + x.ten + ' từ ' + dayShort(x.goc.date) + ' trở đi' : 'Đã xóa ' + x.ten, undoTo(snap));
  }

  /* ---------- Thêm và sửa sự kiện ---------- */
  function openForm(ctx) {
    formCtx = Object.assign({ mode: 'add' }, ctx);
    const sr = formCtx.mode === 'edit' ? findSeries(formCtx.sid) : null;
    const t = todayS();
    const ds = formCtx.date || (inWeek(ymd(cursor)) ? ymd(cursor) : (inWeek(t) ? t : ymd(monday())));
    const st = formCtx.s != null ? formCtx.s : Math.min(22, Math.max(6, new Date().getHours() + 1));
    const en = formCtx.e != null ? Math.min(formCtx.e, st + 1) : st + 1;
    const f = sr ? {
      kind: sr.kind, ten: sr.ten, lich: sr.lich, date: sr.date, tu: sr.tu || hm(st), den: sr.den || hm(en),
      rep: sr.repeat ? sr.repeat.type : 'none', days: (sr.repeat && sr.repeat.days) || [parseDate(sr.date).getDay()], until: sr.until || '',
      tuyChon: !!sr.tuyChon, quanTrong: !!sr.quanTrong, mau: sr.mau || ''
    } : {
      kind: formCtx.kind || 'event', ten: '', lich: (B.CAL.viec ? 'viec' : S.data.calendars[0].id), date: ds, tu: hm(st), den: hm(Math.min(24, en)),
      rep: 'none', days: [parseDate(ds).getDay()], until: '', tuyChon: false, quanTrong: false, mau: ''
    };
    formCtx.f = f;
    drawForm();
  }
  function readForm() {
    const f = formCtx.f;
    const v = id => ($(id) ? $(id).value : null);
    if ($('aTen')) f.ten = v('aTen');
    const pick = document.querySelector('input[name="aLich"]:checked');
    if (pick) f.lich = pick.value;
    if ($('aDate')) f.date = v('aDate');
    if ($('aTu')) f.tu = v('aTu');
    if ($('aDen')) f.den = v('aDen');
    if ($('aUntil')) f.until = v('aUntil');
    if ($('aOpt')) f.tuyChon = $('aOpt').checked;
    if ($('aQuan')) f.quanTrong = $('aQuan').checked;
  }
  function drawForm() {
    const f = formCtx.f, edit = formCtx.mode === 'edit';
    const isDates = f.rep === 'dates';
    const pal = [''].concat(B.theme.PALETTE);
    let h = head(edit ? 'Sửa ' + (f.kind === 'task' ? 'việc cần làm' : 'sự kiện') : 'Thêm mới');
    if (!edit) h += '<div class="seg" role="group" aria-label="Loại"><button type="button" data-act="kind" data-v="event" aria-pressed="' + (f.kind === 'event') + '">Lịch có giờ</button>' +
      '<button type="button" data-act="kind" data-v="task" aria-pressed="' + (f.kind === 'task') + '">Việc cần làm</button></div>';
    h += '<label>Tên<input type="text" id="aTen" maxlength="80" value="' + esc(f.ten) + '" placeholder="Họp nhóm biên đạo"></label>' +
      '<div><span class="lab" id="aLichLab">Thuộc lịch</span><div class="picks" role="radiogroup" aria-labelledby="aLichLab">' +
      S.data.calendars.map(c => '<label class="pick" style="--c:' + c.mau + '"><input type="radio" name="aLich" value="' + esc(c.id) + '"' + (c.id === f.lich ? ' checked' : '') +
        '><span>' + esc(c.ten) + '</span></label>').join('') + '<button type="button" class="pick-add" data-act="cal-new-from-form">+ Lịch mới</button></div></div>';
    if (!isDates) h += '<label>' + (f.rep === 'none' ? 'Ngày' : 'Bắt đầu từ ngày') + '<input type="date" id="aDate" value="' + esc(f.date) + '"></label>';
    if (f.kind === 'event') h += '<div class="fields"><label>Từ<input type="time" id="aTu" value="' + esc(f.tu) + '"></label><label>Đến<input type="time" id="aDen" value="' + esc(f.den) + '"></label></div>';
    if (isDates) h += '<p class="fine">Lịch này lặp theo danh sách ngày cố định có sẵn. Bạn vẫn đổi được tên, lịch, giờ và màu.</p>';
    else {
      h += '<div><span class="lab">Lặp lại</span><div class="quick">' + Object.entries(REPEATS).map(([k, v]) =>
        '<button type="button" data-act="rep" data-v="' + k + '" aria-pressed="' + (f.rep === k) + '">' + v + '</button>').join('') + '</div></div>';
      if (f.rep === 'weekly' || f.rep === 'biweekly') {
        h += '<div><span class="lab">Vào các thứ</span><div class="quick days">' + WEEK_ORDER.map(d =>
          '<button type="button" data-act="day" data-v="' + d + '" aria-pressed="' + f.days.includes(d) + '">' + DAY_SHORT[d] + '</button>').join('') + '</div></div>';
      }
      if (f.rep !== 'none') h += '<label>Kết thúc vào ngày (để trống nếu lặp mãi)<input type="date" id="aUntil" value="' + esc(f.until) + '"></label>';
    }
    if (f.kind === 'event') h += '<label class="bigtoggle"><input type="checkbox" id="aOpt"' + (f.tuyChon ? ' checked' : '') + '> Tùy chọn, không tính vào giờ kế hoạch</label>';
    else h += '<label class="bigtoggle"><input type="checkbox" id="aQuan"' + (f.quanTrong ? ' checked' : '') + '> Đánh dấu quan trọng ★</label>';
    h += '<div><span class="lab">Màu riêng cho mục này</span><div class="swatches">' + pal.map(c =>
      '<button type="button" class="sw' + (c ? '' : ' swnone') + '" data-act="mau" data-v="' + c + '" aria-pressed="' + ((f.mau || '') === c) + '" aria-label="' + (c ? 'Màu ' + c : 'Theo màu của lịch') + '"' +
      (c ? ' style="--c:' + c + '"' : '') + '>' + (c ? '' : 'Theo lịch') + '</button>').join('') + '</div></div>' +
      '<p class="err" id="fErr" role="alert"></p><div class="actions"><button class="primary" data-act="form-save">' + (edit ? 'Lưu thay đổi' : 'Thêm vào lịch') + '</button></div>';
    openSheet(h);
  }
  function saveForm() {
    readForm();
    const f = formCtx.f, edit = formCtx.mode === 'edit';
    const ten = (f.ten || '').trim();
    if (!ten) { $('aTen').focus(); return err('Nhập tên cho mục này.'); }
    if (!B.CAL[f.lich]) return err('Chọn lịch mà mục này thuộc về.');
    if (f.rep !== 'dates' && !f.date) return err('Chọn ngày.');
    if (f.kind === 'event') {
      if (!isTime(f.tu) || !isTime(f.den)) return err('Chọn giờ bắt đầu và giờ kết thúc.');
      if (toH(f.den) <= toH(f.tu)) return err('Giờ kết thúc phải sau giờ bắt đầu.');
    }
    if ((f.rep === 'weekly' || f.rep === 'biweekly') && !f.days.length) return err('Chọn ít nhất một thứ trong tuần.');
    if (f.until && f.until < f.date) return err('Ngày kết thúc phải sau ngày bắt đầu.');
    const snap = snapshot();
    let sr = edit ? findSeries(formCtx.sid) : null;
    if (!sr) { sr = { id: 's-' + u.uid() }; S.data.series.push(sr); }
    sr.kind = f.kind; sr.ten = ten; sr.lich = f.lich;
    if (f.rep !== 'dates') {
      sr.date = f.date;
      sr.repeat = f.rep === 'weekly' || f.rep === 'biweekly' ? { type: f.rep, days: f.days.slice().sort() } : { type: f.rep };
      sr.until = f.rep !== 'none' && f.until ? f.until : null;
    }
    sr.tu = f.kind === 'event' ? f.tu : null; sr.den = f.kind === 'event' ? f.den : null;
    sr.tuyChon = f.kind === 'event' && f.tuyChon; sr.quanTrong = f.kind === 'task' && f.quanTrong;
    sr.mau = isHex(f.mau) ? f.mau : null;
    B.saveData();
    closeSheet();
    if (!edit && f.date) cursor = parseDate(f.date);
    render();
    if (!edit && view === 'ngay' && f.date) scrollToDate(f.date, true);
    toast(edit ? 'Đã lưu ' + ten : 'Đã thêm ' + ten, undoTo(snap));
  }
  function formAct(act, v) {
    readForm();
    const f = formCtx.f;
    if (act === 'kind') f.kind = v;
    if (act === 'rep') { f.rep = v; if ((v === 'weekly' || v === 'biweekly') && !f.days.length && f.date) f.days = [parseDate(f.date).getDay()]; }
    if (act === 'day') { const d = +v; f.days = f.days.includes(d) ? f.days.filter(x => x !== d) : f.days.concat(d); }
    if (act === 'mau') f.mau = v;
    drawForm();
  }

  /* ---------- Giờ trống (nút mắt) ---------- */
  function openFree(ds) {
    const r = B.freeSlots(ds);
    const d = parseDate(ds);
    let h = head('Khung giờ trong ngày') +
      '<div class="freenav"><button class="iconbtn" data-act="free-day" data-v="-1" aria-label="Ngày trước">&#8249;</button><span>' + DAY_FULL[d.getDay()] + ', ' + short(ds) +
      (ds === todayS() ? ' (hôm nay)' : '') + '</span><button class="iconbtn" data-act="free-day" data-v="1" aria-label="Ngày sau">&#8250;</button></div><div class="freelist" data-day="' + ds + '">';
    r.segs.forEach(s => {
      if (s.type === 'free') {
        h += '<div class="fseg free"><span>' + hm(s.s) + ' – ' + hm(s.e) + '<b>Trống ' + fmtDur(s.e - s.s) + '</b></span>' +
          '<button data-act="free-add" data-v="' + ds + '|' + s.s + '|' + s.e + '">+ Thêm</button></div>';
      } else {
        h += '<div class="fseg busy"><span>' + hm(s.s) + ' – ' + hm(s.e) + '</span><span class="fitems">' +
          s.items.map(x => '<i style="' + styleOf(x) + '">' + esc(x.ten) + '</i>').join('') + '</span></div>';
      }
    });
    h += '</div><p class="ftotal">Tổng giờ trống: <b>' + fmtDur(r.free) + '</b></p>' +
      '<p class="fine">Đang xem từ ' + hm(r.from) + ' đến ' + hm(r.to) + '. Đổi khung này trong ⋯ → Miu và cài đặt.</p>';
    openSheet(h);
  }

  /* ---------- Quản lý lịch ---------- */
  function openCalendars() {
    const count = id => S.data.series.filter(s => s.lich === id).length;
    let h = head('Các lịch của bạn') + '<p class="fine">Lịch ở trên có ưu tiên cao hơn. Khi trùng giờ, lịch ưu tiên thấp hơn sẽ được đánh dấu.</p><div class="callist">';
    S.data.calendars.forEach((c, i) => {
      h += '<div class="calrow"><span class="calsw" style="' + B.theme.fillVars(B.CAL[c.id], c.mau).replace(/--fill:/, 'background:') + ';background-color:' + c.mau + '"></span>' +
        '<div class="calname"><b>' + esc(c.ten) + '</b><span>Ưu tiên ' + (i + 1) + ', ' + count(c.id) + ' mục</span></div>' +
        '<button class="iconbtn sm" data-act="cal-up" data-v="' + esc(c.id) + '" aria-label="Tăng ưu tiên ' + esc(c.ten) + '"' + (i === 0 ? ' disabled' : '') + '>&#8593;</button>' +
        '<button class="iconbtn sm" data-act="cal-down" data-v="' + esc(c.id) + '" aria-label="Giảm ưu tiên ' + esc(c.ten) + '"' + (i === S.data.calendars.length - 1 ? ' disabled' : '') + '>&#8595;</button>' +
        '<button data-act="cal-edit" data-v="' + esc(c.id) + '">Sửa</button></div>';
    });
    h += '</div><button class="dashed" data-act="cal-new">+ Tạo lịch mới</button>';
    openSheet(h);
  }
  function moveCal(id, dir) {
    const a = S.data.calendars, i = a.findIndex(c => c.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    B.saveData(); B.refreshCal(); render(); openCalendars();
  }
  function openCalEdit(id, back) {
    const c = id ? S.data.calendars.find(k => k.id === id) : null;
    calDraft = c ? Object.assign({}, c, { back }) : { id: null, ten: '', mau: B.theme.PALETTE[S.data.calendars.length % B.theme.PALETTE.length], fill: 'color', mau2: null, imageId: null, back };
    drawCalEdit();
  }
  function drawCalEdit(showDel) {
    const c = calDraft, th = B.theme;
    const pal = [...new Set((th.THEMES[S.settings.theme] || th.THEMES.matcha).pal.concat(th.PALETTE))];
    const sw = (act, sel) => pal.map(p => '<button type="button" class="sw" data-act="' + act + '" data-v="' + p + '" aria-pressed="' + (sel === p) + '" aria-label="Màu ' + p + '" style="--c:' + p + '"></button>').join('');
    const preview = B.theme.fillVars(c, c.mau);
    const n = c.id ? S.data.series.filter(s => s.lich === c.id).length : 0;
    let h = head(c.id ? 'Sửa lịch' : 'Tạo lịch mới') +
      '<label>Tên lịch<input type="text" id="cTen" maxlength="40" value="' + esc(c.ten) + '" placeholder="Gia đình"></label>' +
      '<div><span class="lab">Màu chính</span><div class="swatches">' + sw('cal-mau', c.mau) + '<label class="sw swcustom" aria-label="Chọn màu khác"><input type="color" id="cColor" value="' + c.mau + '"></label></div></div>' +
      '<div><span class="lab">Kiểu tô thẻ</span><div class="seg three" role="group" aria-label="Kiểu tô"><button type="button" data-act="cal-fill" data-v="color" aria-pressed="' + (c.fill === 'color') + '">Màu đơn</button>' +
      '<button type="button" data-act="cal-fill" data-v="gradient" aria-pressed="' + (c.fill === 'gradient') + '">Gradient</button>' +
      '<button type="button" data-act="cal-fill" data-v="image" aria-pressed="' + (c.fill === 'image') + '">Ảnh</button></div></div>';
    if (c.fill === 'gradient') h += '<div><span class="lab">Màu thứ hai</span><div class="swatches">' + sw('cal-mau2', c.mau2) + '</div></div>';
    if (c.fill === 'image') h += '<div class="imgrow"><button data-act="cal-img">' + (c.imageId && B.images[c.imageId] ? 'Đổi ảnh' : 'Chọn ảnh từ máy') + '</button>' +
      (c.imageId ? '<button data-act="cal-img-remove">Bỏ ảnh</button>' : '') + '<span class="fine">Ảnh được thu nhỏ trước khi lưu.</span></div>';
    h += '<div><span class="lab">Xem trước</span><div class="card preview" style="' + preview + '"><span class="check" aria-hidden="true"></span><div class="cbody"><div class="ct">' +
      esc(c.ten || 'Tên lịch') + '</div><div class="cm">08:30 – 10:15</div></div></div></div>' +
      '<p class="err" id="fErr" role="alert"></p><div class="actions"><button class="primary" data-act="cal-save">' + (c.id ? 'Lưu lịch' : 'Tạo lịch') + '</button>' +
      '<button data-act="cal-back">Quay lại</button>' + (c.id && S.data.calendars.length > 1 ? '<button class="danger" data-act="cal-del">Xóa lịch</button>' : '') + '</div>';
    if (showDel && c.id) {
      const others = S.data.calendars.filter(k => k.id !== c.id);
      h += '<div class="delbox" id="calDelBox"><p>Lịch này có ' + n + ' mục. Xử lý chúng thế nào?</p>' +
        '<label class="radio"><input type="radio" name="cDel" value="move" checked> Chuyển sang lịch <select id="cMoveTo">' +
        others.map(k => '<option value="' + esc(k.id) + '">' + esc(k.ten) + '</option>').join('') + '</select></label>' +
        '<label class="radio"><input type="radio" name="cDel" value="drop"> Xóa luôn ' + n + ' mục</label>' +
        '<button class="danger" data-act="cal-del-confirm">Xóa lịch ' + esc(c.ten) + '</button></div>';
    }
    openSheet(h);
    const cc = $('cColor');
    if (cc) cc.addEventListener('input', () => { calDraft.ten = $('cTen').value; calDraft.mau = cc.value.toUpperCase(); drawCalEdit(); });
  }
  function calAct(act, v) {
    if ($('cTen')) calDraft.ten = $('cTen').value;
    if (act === 'cal-mau') calDraft.mau = v;
    if (act === 'cal-mau2') calDraft.mau2 = v;
    if (act === 'cal-fill') calDraft.fill = v;
    if (act === 'cal-img-remove') { if (calDraft.imageId) B.idb.del(calDraft.imageId); calDraft.imageId = null; calDraft.fill = 'color'; }
    drawCalEdit(act === 'cal-del');
  }
  function saveCal() {
    calDraft.ten = $('cTen').value.trim();
    if (!calDraft.ten) return err('Nhập tên cho lịch.');
    if (calDraft.fill === 'image' && !calDraft.imageId) return err('Chọn một ảnh, hoặc đổi sang kiểu tô khác.');
    const snap = snapshot();
    const back = calDraft.back;
    const rec = { id: calDraft.id, ten: calDraft.ten, mau: calDraft.mau, fill: calDraft.fill, mau2: calDraft.mau2, imageId: calDraft.imageId };
    if (rec.id) Object.assign(S.data.calendars.find(k => k.id === rec.id), rec);
    else { rec.id = 'l-' + u.uid(); S.data.calendars.push(rec); }
    B.saveData(); B.refreshCal(); render();
    toast(calDraft.id ? 'Đã lưu lịch ' + rec.ten : 'Đã tạo lịch ' + rec.ten, undoTo(snap, openCalendars));
    if (back === 'form' && formCtx) { formCtx.f.lich = rec.id; calDraft = null; drawForm(); }
    else { calDraft = null; openCalendars(); }
  }
  function deleteCal() {
    const id = calDraft.id;
    const mode = (document.querySelector('input[name="cDel"]:checked') || {}).value || 'move';
    const to = $('cMoveTo') ? $('cMoveTo').value : null;
    const name = calDraft.ten;
    const snap = snapshot();
    if (mode === 'move' && to) S.data.series.forEach(s => { if (s.lich === id) s.lich = to; });
    else S.data.series.filter(s => s.lich === id).map(s => s.id).forEach(removeSeries);
    S.data.calendars = S.data.calendars.filter(k => k.id !== id);
    hidden.delete(id);
    B.saveData(); B.saveLog(); B.refreshCal();
    calDraft = null;
    render(); openCalendars();
    toast('Đã xóa lịch ' + name, undoTo(snap, openCalendars));
  }

  /* ---------- Giao diện ---------- */
  function openTheme() {
    const s = S.settings, th = B.theme;
    const mode = th.resolvedMode(s);
    let h = head('Giao diện') +
      '<div><span class="lab">Chế độ</span><div class="seg three">' + Object.entries(th.MODES).map(([k, v]) => '<button data-act="t-mode" data-v="' + k + '" aria-pressed="' + (s.mode === k) + '">' + v + '</button>').join('') + '</div></div>' +
      '<div><span class="lab">Chủ đề màu</span><div class="themes">' + Object.entries(th.THEMES).map(([k, t]) =>
        '<button class="themebtn" data-act="t-theme" data-v="' + k + '" aria-pressed="' + (s.theme === k) + '"><i style="background:' +
        (t.grad ? 'linear-gradient(135deg,' + t.a1 + ',' + t.a2 + ')' : 'linear-gradient(90deg,' + t.a1 + ' 50%,' + t.a2 + ' 50%)') + '"></i>' + t.ten + '</button>').join('') + '</div>' +
      '<button class="linkbtn" data-act="t-pal">Áp màu của chủ đề này cho các lịch</button></div>' +
      '<div><span class="lab">Hình nền</span><div class="bgs">' + Object.entries(th.BGS).map(([k, b]) =>
        '<button class="bgbtn" data-act="t-bg" data-v="' + k + '" aria-pressed="' + (s.bg === k) + '"><i style="background:linear-gradient(160deg,' + b[mode][0] + ',' + b[mode][1] + ')"></i>' + b.ten + '</button>').join('') +
      '<button class="bgbtn" data-act="t-bgimg" aria-pressed="' + (s.bg === 'image') + '"><i class="bgimg"' + (B.images.bg ? ' style="background:url(&quot;' + B.images.bg + '&quot;) center/cover"' : '') + '>' +
      (B.images.bg ? '' : '+') + '</i>' + (B.images.bg ? 'Ảnh của bạn' : 'Chọn ảnh') + '</button></div>' +
      (B.images.bg ? '<button class="linkbtn" data-act="t-bgdel">Xóa ảnh nền</button>' : '') + '</div>' +
      '<div><span class="lab">Viền thẻ lịch</span><div class="seg four">' + Object.entries(th.BORDERS).map(([k, v]) => '<button data-act="t-border" data-v="' + k + '" aria-pressed="' + (s.border === k) + '">' + v + '</button>').join('') + '</div></div>' +
      '<label>Độ bo góc thẻ: <output id="tRadOut">' + s.radius + 'px</output><input type="range" id="tRadius" min="4" max="28" step="1" value="' + s.radius + '"></label>' +
      '<p class="fine">Kiểu tô thẻ (màu đơn, gradient, ảnh) chỉnh riêng cho từng lịch trong ⋯ → Các lịch.</p>';
    openSheet(h);
    const r = $('tRadius');
    r.addEventListener('input', () => { S.settings.radius = +r.value; $('tRadOut').textContent = r.value + 'px'; B.theme.apply(); });
    r.addEventListener('change', () => B.saveSettings());
  }
  function themeAct(act, v) {
    const s = S.settings;
    if (act === 't-mode') s.mode = v;
    if (act === 't-theme') s.theme = v;
    if (act === 't-bg') s.bg = v;
    if (act === 't-border') s.border = v;
    if (act === 't-bgdel') { B.idb.del('bg'); s.bg = 'theme'; }
    if (act === 't-bgimg') { if (B.images.bg) s.bg = 'image'; else { pickImage('bg'); return; } }
    if (act === 't-pal') {
      const snap = snapshot();
      const pal = (B.theme.THEMES[s.theme] || B.theme.THEMES.matcha).pal;
      S.data.calendars.forEach((c, i) => { c.mau = pal[i % pal.length]; });
      B.saveData();
      toast('Đã đổi màu các lịch theo chủ đề', undoTo(snap));
    }
    B.saveSettings(); B.theme.apply(); render(); openTheme();
  }
  function pickImage(purpose) { imgPurpose = purpose; $('imgFile').value = ''; $('imgFile').click(); }
  async function onImagePicked(file) {
    if (!file) return;
    try {
      if (imgPurpose === 'bg') {
        const data = await B.compressImage(file, 1600, 0.82);
        await B.idb.put('bg', data);
        S.settings.bg = 'image'; B.saveSettings(); B.theme.apply(); render(); openTheme();
      } else if (imgPurpose === 'cal' && calDraft) {
        const data = await B.compressImage(file, 700, 0.8);
        const key = 'cal-' + u.uid();
        await B.idb.put(key, data);
        if ($('cTen')) calDraft.ten = $('cTen').value;
        calDraft.imageId = key; calDraft.fill = 'image';
        drawCalEdit();
      }
    } catch (e) { toast('Không đọc được ảnh này. Thử một ảnh JPG hoặc PNG khác.'); }
  }

  /* ---------- Miu và cài đặt ---------- */
  function openSettings() {
    const s = S.settings;
    const hours = (sel, max) => Array.from({ length: max + 1 }, (_, i) => '<option value="' + i + '"' + (+sel === i ? ' selected' : '') + '>' + u.pad(i) + ':00</option>').join('');
    let h = head('Miu và cài đặt') +
      '<label>Tên Miu gọi bạn<input type="text" id="sTen" maxlength="24" value="' + esc(s.ten) + '"></label>' +
      '<div><span class="lab">Miu xuất hiện</span><div class="seg four">' + Object.entries(B.miu.FREQ_LABEL).map(([k, v]) => '<button data-act="s-freq" data-v="' + k + '" aria-pressed="' + (s.miu.freq === k) + '">' + v + '</button>').join('') + '</div></div>' +
      '<button data-act="s-summon">Gọi Miu ra thử</button>' +
      '<label>Câu nhắc của Miu (mỗi dòng một câu, {ten} sẽ được thay bằng tên của bạn)<textarea id="sLines" rows="7">' + esc(s.miu.lines.join('\n')) + '</textarea></label>' +
      '<label>Câu chúc ở màn chào (mỗi dòng một câu)<textarea id="sWishes" rows="5">' + esc(s.wishes.join('\n')) + '</textarea></label>' +
      '<button class="linkbtn" data-act="s-defaults">Khôi phục các câu mặc định</button>' +
      '<div><span class="lab">Khung xem giờ trống</span><div class="fields"><label>Từ<select id="sFrom">' + hours(s.free.from, 23) + '</select></label><label>Đến<select id="sTo">' + hours(s.free.to, 24) + '</select></label></div></div>' +
      '<p class="err" id="fErr" role="alert"></p><div class="actions"><button class="primary" data-act="s-save">Lưu cài đặt</button></div>';
    openSheet(h);
  }
  function saveSettingsForm() {
    const ten = $('sTen').value.trim();
    const from = +$('sFrom').value, to = +$('sTo').value;
    const lines = $('sLines').value.split('\n').map(x => x.trim()).filter(Boolean);
    const wishes = $('sWishes').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!ten) return err('Nhập tên để Miu gọi.');
    if (to <= from) return err('Giờ kết thúc khung xem phải sau giờ bắt đầu.');
    if (!lines.length) return err('Cần ít nhất một câu nhắc cho Miu.');
    if (!wishes.length) return err('Cần ít nhất một câu chúc.');
    Object.assign(S.settings, { ten, free: { from, to }, wishes });
    S.settings.miu.lines = lines;
    B.saveSettings();
    closeSheet(); render();
    toast('Đã lưu cài đặt');
  }

  /* ---------- Có gì mới ---------- */
  const LOG = () => (window.BINO_CHANGELOG || []).slice().sort((a, b) => u.cmpVer(a.version, b.version));
  function pendingVersions() {
    const seen = S.settings.lastSeen;
    return LOG().filter(v => !seen || u.cmpVer(v.version, seen) > 0);
  }
  function openVersions() {
    let h = head('Có gì mới') + '<div class="callist">' + LOG().reverse().map(v =>
      '<button class="menuitem" data-act="tour" data-v="' + esc(v.version) + '">Bản ' + esc(v.version) + '<span>' + short(v.date) + '/' + v.date.slice(0, 4) + ', ' + v.slides.length + ' điều mới</span></button>').join('') + '</div>';
    openSheet(h);
  }
  function demoHtml(key) {
    const pal = (B.theme.THEMES[S.settings.theme] || B.theme.THEMES.matcha).pal;
    const mc = (c, t) => '<div class="dmc" style="--c:' + c + ';--ci:' + u.inkFor(c) + '">' + t + '</div>';
    switch (key) {
      case 'calendars': return '<div class="dchips">' + S.data.calendars.slice(0, 4).map(c => '<span><i style="background:' + c.mau + '"></i>' + esc(c.ten) + '</span>').join('') + '<span class="dadd">+ Lịch mới</span></div>';
      case 'eye': return mc(pal[1], '08:30 – 10:15, Dạy lớp') + '<div class="dfree">10:15 – 14:00, trống 3h45<b>+ Thêm</b></div>' + mc(pal[0], '14:00 – 15:00, Tự học');
      case 'now': return mc(pal[0], 'Tự học, 14:00') + '<div class="nowline"><span>' + hm(nowH()) + '</span></div>' + mc(pal[2], 'Gym, 15:30');
      case 'views': return '<div class="dviews">' + Object.values(VIEWS).map((v, i) => '<span' + (i === 3 ? ' class="on"' : '') + '>' + v + '</span>').join('') + '</div>';
      case 'theme': return '<div class="dthemes">' + Object.values(B.theme.THEMES).slice(0, 4).map(t => '<i style="background:' + (t.grad ? 'linear-gradient(135deg,' + t.a1 + ',' + t.a2 + ')' : 'linear-gradient(90deg,' + t.a1 + ' 50%,' + t.a2 + ' 50%)') + '"></i>').join('') + '</div>';
      case 'weather': return '<div class="dwx"><b>27°</b> Mưa rào chiều<span>Khả năng mưa 70%, nhớ mang theo ô</span></div>';
      case 'miu': return '<div class="dmiu">"' + esc(fill('Mẹ đang nhớ {ten} đó, gọi cho mẹ đi.')) + '"<b>Con mèo này cút đi</b></div>';
      default: return '';
    }
  }
  function openTour(versions) {
    if (!versions.length) return;
    const slides = [];
    versions.forEach(v => {
      slides.push({ type: 'intro', v });
      v.slides.forEach(sl => slides.push({ type: 'feat', v, sl }));
    });
    slides.push({ type: 'outro', v: versions[versions.length - 1] });
    tourState = { slides, i: 0 };
    drawTour();
    if (!$('tour').open) $('tour').showModal();
  }
  function drawTour() {
    const { slides, i } = tourState;
    const s = slides[i];
    let say = '', pane = '';
    if (s.type === 'intro') {
      say = s.v.intro;
      pane = '<div class="tpane"><h3>Bản ' + esc(s.v.version) + '</h3><p class="fine">Cập nhật ngày ' + short(s.v.date) + '/' + s.v.date.slice(0, 4) + '</p><div class="tlist">' +
        s.v.slides.map((sl, k) => '<span style="--c:' + (B.theme.THEMES[S.settings.theme] || B.theme.THEMES.matcha).pal[k % 8] + '">' + esc(sl.title) + '</span>').join('') + '</div></div>';
    } else if (s.type === 'feat') {
      say = s.sl.say;
      pane = '<div class="tpane"><h3>' + esc(s.sl.title) + '</h3><div class="tdemo">' + demoHtml(s.sl.demo) + '</div><ol class="tsteps">' +
        s.sl.steps.map(t => '<li>' + esc(fill(t)) + '</li>').join('') + '</ol>' +
        (s.sl.action ? '<button class="linkbtn" data-tact="try" data-v="' + s.sl.action + '">Thử ngay</button>' : '') + '</div>';
    } else {
      say = s.v.outro || 'Xong rồi đó!';
      pane = '<div class="tpane center"><h3>bino ' + esc(B.VERSION) + '</h3><p class="fine">Đã sẵn sàng</p><p class="tnote">Nhớ sao lưu dữ liệu mỗi tuần một lần trong ⋯</p><p class="tnote">Giữ ⋮ trên thẻ để kéo dời lịch như trước</p></div>';
    }
    const last = i === slides.length - 1;
    $('tourBody').innerHTML = '<div class="thead"><span>Bản ' + esc(s.v.version) + ', có gì mới</span>' + (last ? '' : '<button class="linkbtn" data-tact="skip">Bỏ qua</button>') + '</div>' +
      '<div class="tmiu"><div class="tcat">' + B.miu.SVG + '</div><p class="tsay" id="tourTitle">' + esc(fill(say)) + '</p></div>' + pane +
      '<div class="tfoot"><div class="tdots">' + slides.map((_, k) => '<button data-tact="go" data-v="' + k + '" aria-label="Trang ' + (k + 1) + '"' + (k === i ? ' aria-current="step" class="on"' : '') + '></button>').join('') + '</div>' +
      '<div class="actions">' + (i ? '<button data-tact="prev">Quay lại</button>' : '') + '<button class="primary" data-tact="next">' + (last ? 'Vào lịch thôi' : 'Tiếp') + '</button></div></div>';
  }
  function closeTour(after) {
    const latest = LOG().pop();
    if (latest && (!S.settings.lastSeen || u.cmpVer(latest.version, S.settings.lastSeen) > 0)) { S.settings.lastSeen = latest.version; B.saveSettings(); }
    tourState = null;
    if ($('tour').open) $('tour').close();
    if (after) after();
  }
  function tourTry(action) {
    closeTour(() => {
      if (action === 'add') openForm({});
      else if (action === 'calendars') openCalendars();
      else if (action === 'eye') openFree(todayS());
      else if (action === 'month') setView('thang');
      else if (action === 'theme') openTheme();
      else if (action === 'weather') { cursor = new Date(); setView('ngay'); window.scrollTo(0, 0); }
      else if (action === 'miu') setTimeout(() => B.miu.maybeShow(true), 400);
    });
  }

  /* ---------- Màn chào ---------- */
  function splashNote() {
    const t = new Date();
    const list = B.markConflicts(B.instancesBetween(t, t)).filter(x => !x.boQua);
    const timed = list.filter(x => !x.allDay).sort((a, b) => a.s - b.s);
    const nh = nowH();
    const exam = timed.find(x => /thi/i.test(x.ten) && x.e > nh);
    if (exam) return (exam.s >= 17 ? 'Tối nay' : 'Hôm nay') + ' có ' + exam.ten + ' lúc ' + hm(exam.s) + ', cố lên';
    const clash = timed.filter(x => x.thua).length;
    if (clash) return 'Hôm nay có ' + clash + ' buổi trùng giờ, nhớ xem lại nha';
    if (!timed.length) return list.length ? 'Hôm nay có ' + list.length + ' việc cần làm' : 'Hôm nay chưa có lịch nào, tận hưởng nha';
    const next = timed.find(x => x.s >= nh);
    return 'Hôm nay có ' + timed.length + ' buổi' + (next ? ', tiếp theo là ' + next.ten + ' lúc ' + hm(next.s) : ', đã qua hết rồi');
  }
  function showSplash() {
    const h = new Date().getHours();
    const greet = h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const wishes = S.settings.wishes;
    const sp = $('splash');
    sp.innerHTML = '<div class="splash-in"><div class="splash-cat">' + B.miu.SVG + '</div><p class="wordmark big"><span class="w1">bino</span><span class="w2">schedule</span></p>' +
      '<p class="splash-greet">' + greet + ', ' + esc(S.settings.ten) + '</p><p class="splash-wish">' + esc(fill(wishes[Math.floor(Math.random() * wishes.length)])) + '</p>' +
      '<p class="splash-note">' + esc(splashNote()) + '</p><p class="splash-foot">Chạm để vào ngay. Bản ' + B.VERSION + '</p></div>';
    sp.hidden = false;
    const done = () => {
      if (sp.hidden || sp.classList.contains('out')) return;
      sp.classList.add('out');
      setTimeout(() => { sp.hidden = true; sp.classList.remove('out'); afterSplash(); }, reduceMotion ? 0 : 380);
    };
    sp.onclick = done;
    sp.onkeydown = done;
    setTimeout(done, 2000);
  }
  function afterSplash() {
    const p = pendingVersions();
    if (p.length) openTour(p);
    else setTimeout(() => B.miu.maybeShow(), 4000);
  }

  /* ---------- Thời tiết ---------- */
  async function loadWeather(force) {
    wxLoading = true;
    if (!wx) wx = B.readStore(B.K.weather, null);
    const w = await B.weather.get(force);
    wxLoading = false;
    wx = w;
    if (!drag && (view === 'ngay' || view === 'buoi')) render();
  }

  /* ---------- Bối cảnh cho Miu ---------- */
  B.miuContext = () => {
    const t = new Date();
    const list = B.instancesBetween(t, t).filter(x => !x.allDay && !x.boQua);
    const nh = nowH();
    return {
      busyHours: list.filter(x => !x.opt).reduce((a, x) => a + dur(x), 0),
      gymSoon: list.some(x => /gym|tập/i.test(x.ten) && x.s > nh && x.s - nh <= 1.5),
      rain: B.weather.isRainy(wx)
    };
  };
  function isBusy() { return !!drag || $('dlg').open || $('menu').open || $('tour').open || !$('splash').hidden; }
  B.isBusyUI = isBusy;

  /* ---------- Sao lưu ---------- */
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function backup() {
    const settings = Object.assign({}, S.settings);
    download('bino-sao-luu-' + todayS() + '.json', JSON.stringify({ app: 'bino-schedule', version: 3, appVersion: B.VERSION, data: S.data, log: S.log, settings, images: B.images }, null, 1), 'application/json');
    toast('Đã tải file sao lưu');
  }
  function restore(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { toast('File này không phải bản sao lưu của BINO SCHEDULE.'); return; }
    if (!obj || typeof obj !== 'object') { toast('File này không phải bản sao lưu của BINO SCHEDULE.'); return; }
    if (!window.confirm('Thay toàn bộ dữ liệu hiện tại bằng file sao lưu này?')) return;
    const snap = snapshot();
    if (obj.data && Array.isArray(obj.data.calendars)) {
      S.data = obj.data; S.log = obj.log || {};
      if (obj.settings) S.settings = B.mergeSettings(obj.settings);
      if (obj.images) Object.entries(obj.images).forEach(([k, v]) => B.idb.put(k, v));
    } else {
      const log = obj.log && !Array.isArray(obj.log) ? obj.log : obj;
      if (typeof log !== 'object' || Array.isArray(log)) { toast('File này không phải bản sao lưu của BINO SCHEDULE.'); return; }
      S.log = log;
      if (Array.isArray(obj.custom)) B.migrateOldCustom(obj.custom, S.data);
    }
    B.saveData(); B.saveLog(); B.saveSettings(); B.refreshCal();
    hidden = new Set(S.settings.hidden);
    B.theme.apply(); render();
    toast('Đã khôi phục dữ liệu', undoTo(snap));
  }
  function reseed() {
    if (!window.SCHEDULE) { toast('Không tìm thấy file schedule.js.'); return; }
    if (!window.confirm('Nạp lại lịch gốc từ schedule.js? Các lịch và sự kiện hiện tại sẽ được thay bằng bản trong file. Tick và ghi chú vẫn được giữ.')) return;
    const snap = snapshot();
    S.data = B.seedFromSchedule(window.SCHEDULE);
    B.saveData(); B.refreshCal(); render();
    toast('Đã nạp lại lịch gốc', undoTo(snap));
  }

  /* ---------- Sự kiện ---------- */
  function onSheetClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act, v = b.dataset.v;
    if (act === 'close') return closeSheet();
    if (act === 'save') return saveDetails();
    if (act === 'skip') return toggleSkip();
    if (act === 'reset') return resetMove();
    if (act === 'q' || act === 'qd') return quickAdjust(b);
    if (act === 'del-menu') { const box = $('delBox'); box.hidden = !box.hidden; return; }
    if (act === 'del-one') return deleteItem('one');
    if (act === 'del-follow') return deleteItem('follow');
    if (act === 'del-all') return deleteItem('all');
    if (act === 'edit-series') { const x = findItem(openId); if (x) openForm({ mode: 'edit', sid: x.sid }); return; }
    if (act === 'kind' || act === 'rep' || act === 'day' || act === 'mau') return formAct(act, v);
    if (act === 'form-save') return saveForm();
    if (act === 'cal-new-from-form') { readForm(); openCalEdit(null, 'form'); return; }
    if (act === 'free-day') { const ds = b.closest('.sheet-body').querySelector('.freelist').dataset.day; return openFree(ymd(addDays(parseDate(ds), +v))); }
    if (act === 'free-add') { const [ds, s, en] = v.split('|'); return openForm({ date: ds, s: +s, e: +en }); }
    if (act === 'cal-up') return moveCal(v, -1);
    if (act === 'cal-down') return moveCal(v, 1);
    if (act === 'cal-edit') return openCalEdit(v);
    if (act === 'cal-new') return openCalEdit(null);
    if (act === 'cal-save') return saveCal();
    if (act === 'cal-back') { const back = calDraft && calDraft.back; calDraft = null; if (back === 'form' && formCtx) drawForm(); else openCalendars(); return; }
    if (act === 'cal-img') { if ($('cTen')) calDraft.ten = $('cTen').value; return pickImage('cal'); }
    if (act === 'cal-del-confirm') return deleteCal();
    if (act.indexOf('cal-') === 0) return calAct(act, v);
    if (act.indexOf('t-') === 0) return themeAct(act, v);
    if (act === 's-freq') { S.settings.miu.freq = v; B.saveSettings(); document.querySelectorAll('[data-act="s-freq"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === v))); return; }
    if (act === 's-summon') { closeSheet(); setTimeout(() => B.miu.maybeShow(true), 350); return; }
    if (act === 's-defaults') { $('sLines').value = B.DEFAULTS.MIU_LINES.join('\n'); $('sWishes').value = B.DEFAULTS.WISHES.join('\n'); return; }
    if (act === 's-save') return saveSettingsForm();
    if (act === 'tour') { const ver = LOG().find(x => x.version === v); closeSheet(); if (ver) openTour([ver]); }
  }

  function onTourClick(e) {
    const b = e.target.closest('[data-tact]');
    if (!b || !tourState) return;
    const a = b.dataset.tact;
    if (a === 'next') { if (tourState.i >= tourState.slides.length - 1) closeTour(() => setTimeout(() => B.miu.maybeShow(), 5000)); else { tourState.i++; drawTour(); } }
    else if (a === 'prev') { tourState.i = Math.max(0, tourState.i - 1); drawTour(); }
    else if (a === 'go') { tourState.i = +b.dataset.v; drawTour(); }
    else if (a === 'skip') { tourState.i = tourState.slides.length - 1; drawTour(); }
    else if (a === 'try') tourTry(b.dataset.v);
  }

  function nav(dir) {
    if (view === 'buoi') cursor = addDays(cursor, dir);
    else if (view === 'thang') cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    else if (view === 'nam') cursor = new Date(cursor.getFullYear() + dir, cursor.getMonth(), 1);
    else cursor = addDays(cursor, 7 * dir);
    render();
    window.scrollTo(0, 0);
  }

  function bind() {
    $('prev').onclick = () => nav(-1);
    $('next').onclick = () => nav(1);
    $('today').onclick = () => { cursor = new Date(); render(); if (view === 'ngay') scrollToDate(todayS(), true); else window.scrollTo(0, 0); };
    $('viewSeg').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
    $('fab').onclick = () => openForm({});
    $('eyeBtn').onclick = () => openFree(view === 'thang' || view === 'nam' ? todayS() : (inWeek(ymd(cursor)) ? ymd(cursor) : todayS()));
    $('menuBtn').onclick = () => $('menu').showModal();

    $('chips').addEventListener('click', e => {
      const b = e.target.closest('[data-cal]');
      if (!b) return;
      const id = b.dataset.cal;
      if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
      S.settings.hidden = [...hidden]; B.saveSettings(); render();
    });
    $('strip').addEventListener('click', e => {
      const b = e.target.closest('[data-jump]');
      if (!b) return;
      cursor = parseDate(b.dataset.jump);
      if (view === 'ngay') { renderStrip(); scrollToDate(b.dataset.jump, true); } else render();
    });
    $('board').addEventListener('click', e => {
      const tick = e.target.closest('[data-tick]');
      if (tick) return toggleDone(tick.dataset.tick);
      const add = e.target.closest('[data-add]');
      if (add) return openForm({ date: add.dataset.add });
      const hf = e.target.closest('[data-half]');
      if (hf) { half = hf.dataset.half; return render(); }
      const md = e.target.closest('[data-mday]');
      if (md) { cursor = parseDate(md.dataset.mday); view = 'ngay'; S.settings.view = view; B.saveSettings(); render(); return scrollToDate(md.dataset.mday, false); }
      const ym = e.target.closest('[data-ymonth]');
      if (ym) { const [y, m] = ym.dataset.ymonth.split('-').map(Number); cursor = new Date(y, m - 1, 1); return setView('thang'); }
      const w = e.target.closest('[data-wx]');
      if (w) {
        const a = w.dataset.wx;
        if (a === 'retry') loadWeather(true);
        if (a === 'default') { B.weather.useDefault(); loadWeather(true); }
        if (a === 'locate') B.weather.locate().then(() => loadWeather(true)).catch(er => toast(er.message + '. Miu dùng TP.HCM nha.'));
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) openDetails(open.dataset.open);
    });
    $('board').addEventListener('keydown', e => {
      const h = e.target.closest('[data-drag]');
      if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDetails(h.dataset.drag); }
    });
    document.addEventListener('pointerdown', e => { const h = e.target.closest('[data-drag]'); if (h) startDrag(e, h); });
    document.addEventListener('pointermove', dragMove, { passive: false });
    document.addEventListener('pointerup', e => endDrag(e, false));
    document.addEventListener('pointercancel', e => endDrag(e, true));
    document.addEventListener('contextmenu', e => { if (e.target.closest('[data-drag]')) e.preventDefault(); });

    $('dlgBody').addEventListener('click', onSheetClick);
    $('dlgBody').addEventListener('input', () => { const el = $('fErr'); if (el) el.textContent = ''; });
    $('dlg').addEventListener('click', e => { if (e.target === $('dlg')) closeSheet(); });
    $('dlg').addEventListener('close', () => { openId = null; });
    $('tourBody').addEventListener('click', onTourClick);
    $('tour').addEventListener('cancel', e => { e.preventDefault(); closeTour(); });

    $('menu').addEventListener('click', e => {
      if (e.target === $('menu') || e.target.closest('[data-mclose]')) { $('menu').close(); return; }
      const b = e.target.closest('[data-menu]');
      if (!b) return;
      const a = b.dataset.menu;
      $('menu').close();
      if (a === 'calendars') openCalendars();
      else if (a === 'theme') openTheme();
      else if (a === 'settings') openSettings();
      else if (a === 'whatsnew') openVersions();
      else if (a === 'ics') { const f = mondayOf(new Date()); download('bino-schedule.ics', B.icsText(f, addDays(f, 55)), 'text/calendar;charset=utf-8'); toast('Đã tải lịch 8 tuần tới'); }
      else if (a === 'backup') backup();
      else if (a === 'restore') { $('restoreFile').value = ''; $('restoreFile').click(); }
      else if (a === 'reseed') reseed();
    });
    $('restoreFile').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => restore(r.result);
      r.readAsText(f);
    });
    $('imgFile').addEventListener('change', e => onImagePicked(e.target.files[0]));

    document.addEventListener('keydown', e => {
      if (isBusy() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    });

    B.onThemeChange = () => render();
    B.miu.bind();
    setInterval(() => {
      if (!isBusy() && (view === 'ngay' || view === 'buoi' || view === 'tuan')) render();
      B.miu.maybeShow();
    }, 60000);
    setInterval(() => loadWeather(false), 30 * 60000);
  }

  /* ---------- Khởi động ---------- */
  function init() {
    S = B.load();
    hidden = new Set(S.settings.hidden);
    view = S.settings.view && VIEWS[S.settings.view] ? S.settings.view : (narrow ? 'ngay' : 'tuan');
    $('version').textContent = 'bino schedule ' + B.VERSION;
    B.theme.apply();
    bind();
    wx = B.readStore(B.K.weather, null);
    render();
    showSplash();
    loadWeather(false);
    B.idb.loadAll().then(imgs => { if (Object.keys(imgs).length) { B.theme.apply(); render(); } });
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  B.app = { render, setView, openForm, openFree, openCalendars, openTheme, openSettings, openTour, openDetails, pendingVersions };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
