/* bino schedule 1.0: thời tiết hôm nay (Open-Meteo, miễn phí, không cần API key) */
(function () {
  'use strict';
  const B = window.Bino;
  const HCM = { lat: 10.78, lon: 106.70, ten: 'TP.HCM' };
  const TTL = 30 * 60 * 1000;

  const ICON = {
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>',
    cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 9.6 4.2 4.2 0 0 0 7 18z" fill="currentColor"/></svg>',
    partly: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3.5" fill="currentColor" opacity=".7"/><path d="M9 19h9a3.5 3.5 0 0 0 .3-7 4.8 4.8 0 0 0-9.2.6A3.3 3.3 0 0 0 9 19z" fill="currentColor"/></svg>',
    rain: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 5.6 4.2 4.2 0 0 0 7 14z" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></g></svg>',
    storm: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13h10a4 4 0 0 0 .4-8A5.5 5.5 0 0 0 6.8 4.6 4.2 4.2 0 0 0 7 13z" fill="currentColor"/><path d="M12 14l-3 5h3l-1 4 4-6h-3l1-3z" fill="currentColor"/></svg>',
    fog: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9h16M6 13h12M4 17h16"/></g></svg>'
  };

  function describe(code, isDay) {
    if (code === 0) return { t: isDay ? 'Trời quang' : 'Trời trong', i: 'sun' };
    if (code === 1 || code === 2) return { t: 'Ít mây', i: 'partly' };
    if (code === 3) return { t: 'Nhiều mây', i: 'cloud' };
    if (code === 45 || code === 48) return { t: 'Sương mù', i: 'fog' };
    if (code >= 51 && code <= 57) return { t: 'Mưa phùn', i: 'rain' };
    if (code >= 61 && code <= 67) return { t: 'Mưa', i: 'rain' };
    if (code >= 80 && code <= 82) return { t: 'Mưa rào', i: 'rain' };
    if (code >= 95) return { t: 'Có dông', i: 'storm' };
    return { t: 'Nhiều mây', i: 'cloud' };
  }

  const isRainy = w => !!w && (w.rain >= 50 || (w.code >= 51 && w.code <= 82) || w.code >= 95);

  function tips(w) {
    const ten = B.state.settings.ten || 'Cún';
    const out = [];
    if (isRainy(w)) out.push('Khả năng mưa ' + w.rain + '%, nhớ mang theo ô');
    if (w.uv >= 6) out.push('UV cao (' + Math.round(w.uv) + '), nhớ bôi kem chống nắng');
    if (w.max >= 35) out.push('Trời nóng, nhớ uống đủ nước');
    if (!out.length) out.push('Thời tiết dễ chịu, chúc ' + ten + ' một ngày vui');
    return out;
  }

  async function get(force) {
    const loc = B.state.settings.loc || HCM;
    const cached = B.readStore(B.K.weather, null);
    const fresh = cached && cached.at > Date.now() - TTL && cached.lat === loc.lat && cached.lon === loc.lon;
    if (!force && fresh) return cached;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
        '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
        '&timezone=auto&forecast_days=1';
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const pick = (o, k) => (o && o[k] != null ? (Array.isArray(o[k]) ? o[k][0] : o[k]) : null);
      const w = {
        at: Date.now(), lat: loc.lat, lon: loc.lon, place: loc.ten,
        temp: Math.round(pick(j.current, 'temperature_2m')), code: pick(j.current, 'weather_code'), isDay: pick(j.current, 'is_day') !== 0,
        max: Math.round(pick(j.daily, 'temperature_2m_max')), min: Math.round(pick(j.daily, 'temperature_2m_min')),
        rain: Math.round(pick(j.daily, 'precipitation_probability_max') || 0), uv: pick(j.daily, 'uv_index_max') || 0
      };
      if (!isFinite(w.temp)) throw new Error('Dữ liệu thiếu');
      B.writeStore(B.K.weather, w);
      return w;
    } catch (e) {
      return cached ? Object.assign({ stale: true }, cached) : null;
    }
  }

  function locate() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('Thiết bị không hỗ trợ định vị')); return; }
      navigator.geolocation.getCurrentPosition(p => {
        B.state.settings.loc = { lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, ten: 'Vị trí của bạn' };
        B.saveSettings();
        res(B.state.settings.loc);
      }, () => rej(new Error('Chưa được cấp quyền vị trí')), { timeout: 10000, maximumAge: 3600000 });
    });
  }

  function useDefault() { B.state.settings.loc = null; B.saveSettings(); }

  function cardHtml(w, loading) {
    const esc = B.u.esc;
    if (loading && !w) return '<section class="wx wx-quiet" aria-live="polite">Miu đang xem trời…</section>';
    if (!w) return '<section class="wx wx-quiet">Chưa tải được thời tiết. <button class="linkbtn" data-wx="retry">Thử lại</button></section>';
    const d = describe(w.code, w.isDay);
    const t = new Date(w.at);
    return '<section class="wx" aria-label="Thời tiết hôm nay">' +
      '<div class="wx-main"><div><p class="wx-place">' + esc(w.place) + ', hôm nay</p>' +
      '<p class="wx-temp">' + w.temp + '°<span>' + d.t + ', ' + w.min + '°–' + w.max + '°</span></p></div>' +
      '<div class="wx-icon wx-' + d.i + '">' + ICON[d.i] + '</div></div>' +
      '<ul class="wx-tips">' + tips(w).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="wx-foot">' + (w.stale ? 'Số liệu cũ, ' : 'Cập nhật ') + B.u.pad(t.getHours()) + ':' + B.u.pad(t.getMinutes()) +
      (B.state.settings.loc ? ' · <button class="linkbtn" data-wx="default">Về TP.HCM</button>' : ' · <button class="linkbtn" data-wx="locate">Dùng vị trí của tôi</button>') +
      '</p></section>';
  }

  B.weather = { get, tips, locate, useDefault, cardHtml, isRainy, describe };
})();
