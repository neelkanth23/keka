// ╔══════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — ALERT-FREE VERSION              ║
// ║   Fixed alert() injection block issue                  ║
// ╚══════════════════════════════════════════════════════════╝

(function () {
  'use strict';

  const WORK_MINUTES = 8 * 60;
  const HALF_DAY_MINUTES = 4 * 60;

  let tenMinTriggered = false;
  let eightHourTriggered = false;

  function parseTime(ts) {
    if (!ts || ts === 'MISSING') return null;
    const parts = ts.toLowerCase().split(' ').filter(Boolean);
    if (parts.length < 2) return null;
    let [H, M] = parts[0].split(':').map(Number);
    const ap = parts[1];
    if (ap === 'pm' && H !== 12) H += 12;
    if (ap === 'am' && H === 12) H = 0;
    return { hours: H, minutes: M };
  }

  function minutesBetween(s, e) {
    const st = parseTime(s);
    const en = parseTime(e);
    if (!st || !en) return 0;
    let m = (en.hours - st.hours) * 60 + (en.minutes - st.minutes);
    if (m < 0) m += 1440;
    if (m > 960) return 0;
    return m;
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toUpperCase();
  }

  // ✅ TOAST NOTIFICATION — replaces alert()
  function showToast(msg, color = '#f59e0b', duration = 6000) {
    const existing = document.getElementById('kekaToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kekaToast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999999;
      background: ${color};
      color: #000;
      font-family: sans-serif;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      text-align: center;
      max-width: 360px;
      white-space: pre-line;
      animation: fadeIn 0.3s ease;
    `;
    toast.innerText = msg;

    // Close on click
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => toast.remove());

    document.body.appendChild(toast);
    setTimeout(() => toast && toast.remove(), duration);
  }

  function processLogs() {
    const allDivs = Array.from(document.querySelectorAll('div'));
    const rows = allDivs.filter(row => {
      const txt = row.innerText || '';
      const matches = txt.match(/\d{1,2}:\d{2}\s*(am|pm)/gi);
      return matches && matches.length >= 1;
    });

    let totalM = 0;
    let breakM = 0;
    let firstStart = null;
    let prevEnd = null;
    let activeStart = null;

    rows.forEach((row, idx) => {
      const times =
        (row.innerText.match(/\d{1,2}:\d{2}\s*(am|pm)/gi) || [])
        .map(t => t.toLowerCase());

      if (times.length === 0) return;

      const s = times[0] || null;
      const e = times[1] || 'MISSING';

      if (!s) return;

      if (!firstStart) firstStart = s;

      if (idx !== 0 && prevEnd && s) {
        breakM += minutesBetween(prevEnd, s);
      }

      if (e === 'MISSING') {
        activeStart = s;
      } else {
        const span = minutesBetween(s, e);
        if (span >= 0 && span <= 720) {
          totalM += span;
          prevEnd = e;
        }
      }
    });

    // Live session
    if (activeStart) {
      const st = parseTime(activeStart);
      if (st) {
        const now = new Date();
        const startDate = new Date();
        startDate.setHours(st.hours, st.minutes, 0, 0);
        const live = Math.floor((now - startDate) / 60000);
        if (live > 0 && live < 960) totalM += live;
      }
    }

    totalM = Math.min(totalM, 1440);

    return { totalMinutes: totalM, breakMinutes: breakM, firstStart };
  }

  function createUI() {
    if (document.getElementById('kekaTracker')) return;

    const div = document.createElement('div');
    div.id = 'kekaTracker';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      width: 320px;
      background: #111827;
      color: white;
      border-radius: 18px;
      padding: 18px;
      font-family: sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
    `;

    div.innerHTML = `
      <div style="font-size:22px;font-weight:700;margin-bottom:10px;">🎮 Grind Tracker</div>
      <div id="workedTime" style="font-size:42px;font-weight:900;">0h 00m</div>
      <div id="progressBar" style="margin-top:12px;height:14px;border-radius:999px;background:#374151;overflow:hidden;">
        <div id="progressFill" style="height:100%;width:0%;background:#22c55e;transition:width 0.5s ease;"></div>
      </div>
      <div id="progressText" style="margin-top:8px;font-size:14px;opacity:.85;">0% completed</div>
      <div id="remaining" style="margin-top:14px;font-size:15px;"></div>
      <div id="halfTime" style="margin-top:10px;font-size:14px;opacity:.85;"></div>
      <div id="fullTime" style="margin-top:6px;font-size:14px;opacity:.85;"></div>
      <div id="notifArea" style="margin-top:12px;font-size:13px;min-height:20px;"></div>
    `;

    document.body.appendChild(div);
  }

  // ✅ In-widget notification instead of alert()
  function setNotif(msg, color = '#f59e0b') {
    const el = document.getElementById('notifArea');
    if (el) {
      el.style.color = color;
      el.innerText = msg;
    }
  }

  function celebrate() {
    if (eightHourTriggered) return;
    eightHourTriggered = true;
    setNotif('🏆 8 HOURS ACHIEVED! Majdoori khatam bhai.', '#22c55e');
    showToast('🏆 8 HOURS ACHIEVED!\n\nMajdoori khatam bhai.', '#22c55e', 10000);
  }

  function warnTenMinutes(left) {
    if (tenMinTriggered) return;
    tenMinTriggered = true;
    setNotif(`⚠️ ${left} mins left! Final castle aa gaya.`, '#f59e0b');
    showToast(`⚠️ ${left} mins left!\n\nFinal castle aa gaya.`, '#f59e0b', 10000);
  }

  function updateUI() {
    const data = processLogs();
    const total = Math.max(0, data.totalMinutes);
    const left = Math.max(0, WORK_MINUTES - total);
    const pct = Math.min(100, Math.round((total / WORK_MINUTES) * 100));
    const h = Math.floor(total / 60);
    const m = total % 60;

    document.getElementById('workedTime').innerText = `${h}h ${String(m).padStart(2, '0')}m`;
    document.getElementById('progressText').innerText = `${pct}% completed`;
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('remaining').innerText =
      `⏳ Remaining: ${Math.floor(left / 60)}h ${String(left % 60).padStart(2, '0')}m`;

    if (data.firstStart) {
      const st = parseTime(data.firstStart);
      if (st) {
        const base = new Date();
        base.setHours(st.hours, st.minutes, 0, 0);
        const half = new Date(base.getTime() + HALF_DAY_MINUTES * 60000);
        const full = new Date(base.getTime() + WORK_MINUTES * 60000);
        document.getElementById('halfTime').innerText = `☀️ Half Day: ${fmtTime(half)}`;
        document.getElementById('fullTime').innerText = `🏁 Full Day: ${fmtTime(full)}`;
      }
    }

    if (left <= 10 && left > 0) warnTenMinutes(left);
    if (total >= WORK_MINUTES && total <= WORK_MINUTES + 30) celebrate();
  }

  createUI();
  updateUI();
  setInterval(updateUI, 20000);

  console.log('%c🎮 KEKA GRIND TRACKER LOADED (ALERT-FREE)', 'color:#22c55e;font-size:16px;font-weight:bold;');

})();
