/* bino schedule 1.0: dữ liệu, bộ máy lịch, lưu trữ */
(function () {
  'use strict';
  const B = window.Bino = window.Bino || {};
  B.VERSION = '1.0';

  /* ---------- Tiện ích ---------- */
  const DOW = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
  const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
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
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtHours = h => (Math.round(h * 10) / 10).toLocaleString('vi-VN') + 'h';
  const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
  const isTime = v => /^\d{2}:\d{2}$/.test(v || '');
  const dur = x => x.e - x.s;
  const real = x => (x.phut ? x.phut / 60 : dur(x));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = o => JSON.parse(JSON.stringify(o));

  function inkFor(hex) {
    if (!isHex(hex)) return '#1F1C20';
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return (L + 0.05) / 0.0625 >= 1.05 / (L + 0.05) ? '#1F1C20' : '#FFF8FB';
  }
  const cmpVer = (a, b) => {
    const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  };

  B.u = { DOW, DAY_SHORT, DAY_FULL, pad, parseDate, ymd, addDays, mondayOf, weeksBetween, toH, hm, short, dayShort,
    slug, esc, fmtHours, isHex, isTime, dur, real, uid, clone, inkFor, cmpVer };

  /* ---------- Lưu trữ ---------- */
  const K = {
    data: 'bino-data-v1', log: 'bino-schedule-log-v1', settings: 'bino-settings-v1',
    weather: 'bino-weather-v1', oldCustom: 'bino-schedule-custom-v1', oldUi: 'bino-schedule-ui-v2'
  };
  B.K = K;
  function readStore(key, fallback) {
    try {
      const raw = window.localStorage && window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  B.readStore = readStore;
  B.writeStore = writeStore;

  const DEFAULT_MIU_LINES = [
    'Hôm nay tưới cây chưa vậy {ten}?',
    '{ten} nhớ ăn đủ bữa nha {ten} ơi, còi là xấu lắm đó.',
    'Tập gym không phải để đô mà là để khoẻ từ tâm trí đến thể lực, để còn làm việc khác.',
    'Mẹ đang nhớ {ten} đó, gọi cho mẹ đi.',
    'Hôm nay uống mấy lít nước rồi hả "xấu xí và tềnh tàng"?',
    'Lịch hôm nay có vẻ dày đấy, nhớ cân bằng, take a nap 15–30 phút nhé.',
    'Trời sắp mưa đó {ten}, nhớ mang theo ô nha.'
  ];
  const DEFAULT_WISHES = [
    'Chúc {ten} một ngày năng lượng và may mắn',
    'Từng việc một thôi {ten}, không cần vội',
    'Hôm nay {ten} làm được mà, cố lên',
    'Nhớ thở sâu và uống đủ nước nha {ten}',
    'Một ngày dễ thương đang chờ {ten} đó'
  ];
  const DEFAULT_SETTINGS = {
    ten: 'Cún', mode: 'dark', theme: 'matcha', bg: 'theme', border: 'none', radius: 18,
    view: null, hidden: [], free: { from: 6, to: 23 }, loc: null, lastSeen: null,
    miu: { freq: 'vua', lines: DEFAULT_MIU_LINES.slice() },
    wishes: DEFAULT_WISHES.slice(),
    miuState: { day: '', count: 0, last: 0, shooUntil: 0, said: [] }
  };
  B.DEFAULTS = { MIU_LINES: DEFAULT_MIU_LINES, WISHES: DEFAULT_WISHES };

  /* ---------- Nạp dữ liệu và chuyển đổi từ bản cũ ---------- */
  const ruleId = r => r.lich + '-' + slug(r.ten) + '-' + r.tu.replace(':', '');

  function seedFromSchedule(S) {
    const calendars = (S.lich || []).slice().sort((a, b) => a.uuTien - b.uuTien)
      .map(c => ({ id: c.id, ten: c.ten, mau: isHex(c.mau) ? c.mau : '#E9C9D4', fill: 'color', mau2: null, imageId: null }));
    const series = [];
    const used = new Set();
    const uniq = id => { let k = id, i = 2; while (used.has(k)) k = id + '-' + (i++); used.add(k); return k; };
    (S.hangTuan || []).forEach(r => series.push({
      id: uniq(ruleId(r)), lich: r.lich, ten: r.ten, kind: 'event', date: r.tuNgay || S.batDau, tu: r.tu, den: r.den,
      repeat: { type: r.moi === 2 ? 'biweekly' : 'weekly', days: r.thu.map(t => DOW[t]) },
      until: r.denNgay || null, tuyChon: !!r.tuyChon, quanTrong: false, mau: isHex(r.mau) ? r.mau : null
    }));
    (S.motLan || []).forEach(r => {
      const dates = [].concat(r.ngay).slice().sort();
      series.push({
        id: uniq(ruleId(r)), lich: r.lich, ten: r.ten, kind: 'event', date: dates[0], tu: r.tu, den: r.den,
        repeat: { type: 'dates', dates }, until: null, tuyChon: !!r.tuyChon, quanTrong: false, mau: isHex(r.mau) ? r.mau : null
      });
    });
    return { calendars, series };
  }

  function migrateOldCustom(list, data) {
    (Array.isArray(list) ? list : []).forEach(c => {
      if (!c || !data.calendars.some(k => k.id === c.lich)) return;
      const id = 'u-' + c.cid;
      if (data.series.some(s => s.id === id)) return;
      data.series.push({
        id, lich: c.lich, ten: c.ten, kind: c.kind === 'task' ? 'task' : 'event', date: c.date,
        tu: c.tu || null, den: c.den || null,
        repeat: c.lap ? { type: 'weekly', days: [parseDate(c.date).getDay()] } : { type: 'none' },
        until: null, tuyChon: false, quanTrong: !!c.quanTrong, mau: null
      });
    });
  }

  function mergeSettings(s) {
    const out = Object.assign(clone(DEFAULT_SETTINGS), s || {});
    out.miu = Object.assign(clone(DEFAULT_SETTINGS.miu), (s && s.miu) || {});
    out.free = Object.assign(clone(DEFAULT_SETTINGS.free), (s && s.free) || {});
    out.miuState = Object.assign(clone(DEFAULT_SETTINGS.miuState), (s && s.miuState) || {});
    if (!Array.isArray(out.wishes) || !out.wishes.length) out.wishes = DEFAULT_WISHES.slice();
    if (!Array.isArray(out.miu.lines) || !out.miu.lines.length) out.miu.lines = DEFAULT_MIU_LINES.slice();
    if (!Array.isArray(out.hidden)) out.hidden = [];
    return out;
  }

  function load() {
    let data = readStore(K.data, null);
    const fresh = !data;
    if (!data) {
      data = window.SCHEDULE ? seedFromSchedule(window.SCHEDULE) : { calendars: [], series: [] };
      migrateOldCustom(readStore(K.oldCustom, []), data);
    }
    if (!data.calendars.length) data.calendars.push({ id: 'chung', ten: 'Lịch chung', mau: '#E9C9D4', fill: 'color', mau2: null, imageId: null });
    let settings = readStore(K.settings, null);
    if (!settings) {
      const oldUi = readStore(K.oldUi, {});
      settings = { hidden: oldUi.hidden || [] };
    }
    B.state = { data, log: readStore(K.log, {}), settings: mergeSettings(settings), fresh };
    if (fresh) saveData();
    refreshCal();
    return B.state;
  }

  function saveData() { return writeStore(K.data, B.state.data); }
  function saveLog() { return writeStore(K.log, B.state.log); }
  function saveSettings() { return writeStore(K.settings, B.state.settings); }

  function refreshCal() {
    const m = {};
    B.state.data.calendars.forEach((c, i) => { m[c.id] = Object.assign({}, c, { uuTien: i + 1 }); });
    B.CAL = m;
    return m;
  }

  /* ---------- Bộ máy lịch ---------- */
  const isRepeating = sr => !!sr.repeat && ['daily', 'weekly', 'biweekly'].includes(sr.repeat.type);

  function occurs(sr, d) {
    const t = sr.repeat.type;
    if (t === 'daily') return true;
    if (!sr.repeat.days || !sr.repeat.days.includes(d.getDay())) return false;
    if (t === 'biweekly') return weeksBetween(parseDate(sr.date), d) % 2 === 0;
    return true;
  }

  function makeInst(sr, ds) {
    const cal = B.CAL[sr.lich];
    const mau = isHex(sr.mau) ? sr.mau : cal.mau;
    const base = { id: sr.id + '@' + ds, sid: sr.id, lich: sr.lich, ten: sr.ten, mau, date: ds,
      lap: isRepeating(sr) || (!!sr.repeat && sr.repeat.type === 'dates' && sr.repeat.dates.length > 1) };
    if (sr.kind === 'task') return Object.assign(base, { allDay: true, quanTrong: !!sr.quanTrong, opt: false, s: 0, e: 0, goc: { date: ds, s: 0, e: 0 } });
    const s = toH(sr.tu), e = toH(sr.den);
    return Object.assign(base, { allDay: false, opt: !!sr.tuyChon, s, e, goc: { date: ds, s, e } });
  }

  // Các buổi có ngày gốc nằm trong khoảng [from, to]
  function expand(from, to) {
    const out = [];
    const fromS = ymd(from), toS = ymd(to);
    B.state.data.series.forEach(sr => {
      if (!B.CAL[sr.lich]) return;
      if (sr.kind !== 'task' && !(isTime(sr.tu) && isTime(sr.den))) return;
      const t = sr.repeat ? sr.repeat.type : 'none';
      if (t === 'none') { if (sr.date >= fromS && sr.date <= toS) out.push(makeInst(sr, sr.date)); return; }
      if (t === 'dates') {
        sr.repeat.dates.forEach(ds => { if (ds >= fromS && ds <= toS && (!sr.until || ds <= sr.until)) out.push(makeInst(sr, ds)); });
        return;
      }
      const start = parseDate(sr.date);
      for (let d = start > from ? start : new Date(from); d <= to; d = addDays(d, 1)) {
        const ds = ymd(d);
        if (sr.until && ds > sr.until) break;
        if (occurs(sr, d)) out.push(makeInst(sr, ds));
      }
    });
    return out;
  }

  function apply(inst) {
    const L = B.state.log[inst.id] || {};
    const x = Object.assign({}, inst);
    if (L.doiNgay) x.date = L.doiNgay;
    if (L.doiGio && !inst.allDay) { x.s = toH(L.doiGio); x.e = x.s + (inst.e - inst.s); }
    x.xong = !!L.xong;
    x.boQua = !!L.boQua;
    x.xoa = !!L.xoa;
    x.ghiChu = L.ghiChu || '';
    x.phut = L.phutThucTe || null;
    x.daDoi = !!(L.doiNgay || (L.doiGio && !inst.allDay));
    return x;
  }

  function instancesBetween(from, to) {
    const a = ymd(from), b = ymd(to);
    return expand(addDays(from, -60), addDays(to, 60)).map(apply).filter(x => !x.xoa && x.date >= a && x.date <= b);
  }

  function markConflicts(list) {
    list.forEach(x => { x.trung = []; x.thua = false; });
    const timed = list.filter(x => !x.allDay && !x.boQua);
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        const a = timed[i], b = timed[j];
        if (a.date !== b.date || !(a.s < b.e - 1e-9 && b.s < a.e - 1e-9)) continue;
        a.trung.push(b); b.trung.push(a);
        const pa = B.CAL[a.lich].uuTien, pb = B.CAL[b.lich].uuTien;
        if (pa < pb) b.thua = true; else if (pb < pa) a.thua = true; else { a.thua = true; b.thua = true; }
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
    B.state.data.calendars.forEach(c => { per[c.id] = { plan: 0, done: 0 }; byTitle[c.id] = {}; });
    const s = { plan: 0, done: 0, nPlan: 0, nDone: 0, nMoved: 0, nSkip: 0, nOpen: 0, tTotal: 0, tDone: 0, per, byTitle };
    list.forEach(x => {
      if (!per[x.lich]) return;
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
      L.forEach(x => { x.n = 1 + Math.max(...L.filter(y => y.s < x.e - 1e-9 && x.s < y.e - 1e-9).map(y => y.lane)); });
    });
  }

  // Chia một ngày thành các khung bận và khung trống
  function freeSlots(ds) {
    const f = B.state.settings.free;
    const from = Math.max(0, Math.min(23, +f.from || 0)), to = Math.max(from + 1, Math.min(24, +f.to || 24));
    const d = parseDate(ds);
    const items = instancesBetween(d, d).filter(x => !x.allDay && !x.boQua && x.e > from && x.s < to)
      .map(x => ({ s: Math.max(from, x.s), e: Math.min(to, x.e), x })).sort((a, b) => a.s - b.s);
    const busy = [];
    items.forEach(it => {
      const last = busy[busy.length - 1];
      if (last && it.s <= last.e + 1e-9) { last.e = Math.max(last.e, it.e); last.items.push(it.x); }
      else busy.push({ s: it.s, e: it.e, items: [it.x] });
    });
    const segs = [];
    let cur = from, free = 0;
    busy.forEach(b => {
      if (b.s - cur >= 0.25 - 1e-9) { segs.push({ type: 'free', s: cur, e: b.s }); free += b.s - cur; }
      segs.push({ type: 'busy', s: b.s, e: b.e, items: b.items });
      cur = Math.max(cur, b.e);
    });
    if (to - cur >= 0.25 - 1e-9) { segs.push({ type: 'free', s: cur, e: to }); free += to - cur; }
    return { segs, free, from, to };
  }

  /* ---------- File .ics ---------- */
  function icsText(from, to) {
    const list = instancesBetween(from, to).filter(x => !x.boQua);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const e = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const dt = (ds, h) => ds.replace(/-/g, '') + 'T' + hm(h).replace(':', '') + '00';
    const fold = line => { let out = ''; while (line.length > 73) { out += line.slice(0, 73) + '\r\n '; line = line.slice(73); } return out + line; };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BINO SCHEDULE//VI', 'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:BINO SCHEDULE', 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh', 'BEGIN:VTIMEZONE', 'TZID:Asia/Ho_Chi_Minh',
      'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:+07', 'END:STANDARD', 'END:VTIMEZONE'];
    list.forEach(x => {
      const cal = B.CAL[x.lich];
      lines.push('BEGIN:VEVENT', 'UID:' + x.id.replace('@', '-') + '@bino-schedule', 'DTSTAMP:' + stamp);
      if (x.allDay) lines.push('DTSTART;VALUE=DATE:' + x.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + ymd(addDays(parseDate(x.date), 1)).replace(/-/g, ''));
      else lines.push('DTSTART;TZID=Asia/Ho_Chi_Minh:' + dt(x.date, x.s), 'DTEND;TZID=Asia/Ho_Chi_Minh:' + dt(x.date, x.e));
      lines.push(fold('SUMMARY:' + e((x.quanTrong ? '★ ' : '') + x.ten + ' (' + cal.ten + ')')), fold('CATEGORIES:' + e(cal.ten)));
      if (x.ghiChu) lines.push(fold('DESCRIPTION:' + e(x.ghiChu)));
      if (!x.allDay) lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', fold('DESCRIPTION:' + e(x.ten)), 'END:VALARM');
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  /* ---------- Ảnh (IndexedDB) ---------- */
  B.images = {};
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        if (!window.indexedDB) { rej(new Error('no idb')); return; }
        const r = indexedDB.open('bino-images', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('img');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    tx(mode, fn) {
      return this.open().then(db => new Promise((res, rej) => {
        const t = db.transaction('img', mode);
        const req = fn(t.objectStore('img'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      }));
    },
    put(k, v) { B.images[k] = v; return this.tx('readwrite', s => s.put(v, k)).catch(() => {}); },
    del(k) { delete B.images[k]; return this.tx('readwrite', s => s.delete(k)).catch(() => {}); },
    loadAll() {
      return this.open().then(db => new Promise(res => {
        const out = {};
        const req = db.transaction('img').objectStore('img').openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { out[c.key] = c.value; c.continue(); } else { Object.assign(B.images, out); res(out); } };
        req.onerror = () => res(out);
      })).catch(() => ({}));
    }
  };
  B.idb = idb;

  function compressImage(file, max, quality) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Ảnh không đọc được')); };
      img.src = url;
    });
  }

  Object.assign(B, {
    load, saveData, saveLog, saveSettings, refreshCal, mergeSettings, seedFromSchedule, migrateOldCustom,
    expand, apply, instancesBetween, markConflicts, stats, assignLanes, freeSlots, icsText, isRepeating, compressImage
  });
})();
