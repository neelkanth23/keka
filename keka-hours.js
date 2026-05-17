// ╔══════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — MARIO EDITION                    ║
// ║   Paste in browser console on your Keka attendance page ║
// ╚══════════════════════════════════════════════════════════╝
(function () {
  'use strict';

  /* ═══════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════ */
  const WORK_MINUTES     = 8 * 60;   // 480 min
  const HALF_DAY_MINUTES = 4 * 60;   // 240 min

  /* ═══════════════════════════════════════
     STATE
  ═══════════════════════════════════════ */
  let tenMinTriggered    = false;
  let eightHourTriggered = false;
  let confettiInterval   = null;
  let titleFlashInterval = null;
  let didSlideIn         = false;
  const originalTitle    = document.title;

  /* ═══════════════════════════════════════
     TIME HELPERS
  ═══════════════════════════════════════ */
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
    const st = parseTime(s), en = parseTime(e);
    if (!st || !en) return 0;
    let m = (en.hours - st.hours) * 60 + (en.minutes - st.minutes);
    if (m < 0)   m += 1440;
    if (m > 720) m = 0;
    return m;
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    }).toUpperCase();
  }

  /* ═══════════════════════════════════════
     PROCESS LOGS
  ═══════════════════════════════════════ */
  function processLogs(container) {
    if (!container) return;
    const rows = Array.from(
      container.querySelectorAll('.ng-untouched.ng-pristine.ng-valid')
    );
    let totalM = 0, firstStart = null, prevEnd = null,
        breakM = 0, activeStart = null;

    rows.forEach((row, idx) => {
      const startEl = row.querySelector('.w-120.mr-20 .text-small')
                   || row.querySelector('.w-120.mr-20');
      const endEl   = row.querySelector('.w-120:not(.mr-20) .text-small')
                   || row.querySelector('.w-120:not(.mr-20)');
      const s = startEl ? startEl.textContent.trim() : null;
      const e = endEl   ? endEl.textContent.trim()   : null;
      if (idx === 0) firstStart = s;
      if (idx !== 0 && prevEnd && s) breakM += minutesBetween(prevEnd, s);
      if (e === 'MISSING') { activeStart = s; }
      else { totalM += minutesBetween(s, e); prevEnd = e; }
    });

    if (activeStart) {
      const st = parseTime(activeStart);
      if (st) {
        const now  = new Date();
        const live = (now.getHours() - st.hours) * 60
                   + (now.getMinutes() - st.minutes);
        if (live > 0) totalM += live;
      }
    }

    window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
  }

  /* ═══════════════════════════════════════
     VIBE MESSAGES
  ═══════════════════════════════════════ */
  function getVibe(pct) {
    if (pct >= 100) return '"nikal gayo bhai… the realm is yours. ghar ja."';
    if (pct >= 90)  return '"10% remains… do not falter now, warrior."';
    if (pct >= 75)  return '"ghar dikhne laga hai… hold the line."';
    if (pct >= 50)  return '"aadha done… the grind is not over."';
    if (pct >= 25)  return '"chautha part khatam… keep moving."';
    return '"kaam shuru kar… the grind demands tribute."';
  }

  /* ═══════════════════════════════════════
     INJECT STYLES
  ═══════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('kekaMarioStyles')) return;
    const style = document.createElement('style');
    style.id = 'kekaMarioStyles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,800;0,900;1,800&display=swap');

      #kekaMario * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Nunito', sans-serif; }

      /* ── SLIDE IN ── */
      @keyframes km-slidein {
        from { transform: translateX(115%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes km-slidein-done {
        from { transform: translateX(0); opacity: 1; }
        to   { transform: translateX(0); opacity: 1; }
      }

      /* ── MARIO RUN ── */
      @keyframes km-mrun {
        0%   { left: -44px; bottom: 56px; }
        35%  { left: 150px; bottom: 56px; }
        42%  { left: 175px; bottom: 115px; }
        49%  { left: 200px; bottom: 56px; }
        64%  { left: 265px; bottom: 56px; }
        70%  { left: 290px; bottom: 106px; }
        76%  { left: 315px; bottom: 56px; }
        100% { left: 420px; bottom: 56px; }
      }

      /* ── GOOMBA ── */
      @keyframes km-gwalk {
        0%   { left: 420px; }
        100% { left: -44px; }
      }

      /* ── ? BLOCK BOB ── */
      @keyframes km-qbob {
        0%,100% { transform: translateY(0); }
        50%      { transform: translateY(-6px); }
      }

      /* ── LIVE DOT ── */
      @keyframes km-ld {
        0%,100% { opacity: 1; }
        50%      { opacity: 0.3; }
      }

      /* ── COIN COLLECT ── */
      @keyframes km-coin-up {
        0%   { transform: translateY(0) scale(1); opacity: 1; }
        60%  { transform: translateY(-50px) scale(1.2); opacity: 1; }
        100% { transform: translateY(-90px) scale(0.4); opacity: 0; }
      }

      /* ── TICKER ── */
      @keyframes km-ticker {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }

      /* ── CONFETTI ── */
      @keyframes km-confetti {
        0%   { transform: translateY(-16px) rotate(0deg);   opacity: 1; }
        100% { transform: translateY(100vh)  rotate(720deg); opacity: 0; }
      }

      /* ── PEACH WAVE ── */
      @keyframes km-wave {
        0%,100% { transform: rotate(-15deg); }
        50%      { transform: rotate(20deg); }
      }

      /* ── STAR TWINKLE ── */
      @keyframes km-twinkle {
        0%,100% { opacity: 0.9; transform: scale(1); }
        50%      { opacity: 0.2; transform: scale(0.6); }
      }

      /* ── VICTORY PULSE ── */
      @keyframes km-victory {
        0%,100% { box-shadow: 0 0 0 4px #fff, 0 0 0 8px #ffd700, 0 0 0 12px #fff, 0 24px 60px rgba(0,0,0,0.4); }
        50%      { box-shadow: 0 0 0 4px #fff, 0 0 0 8px #ffd700, 0 0 0 12px #fff, 0 24px 80px rgba(255,215,0,0.5); }
      }

      /* ── WARNING PULSE ── */
      @keyframes km-warn {
        0%,100% { box-shadow: 0 0 0 4px #fff, 0 0 0 8px #e8282b, 0 0 0 12px #fff, 0 24px 60px rgba(0,0,0,0.4); }
        50%      { box-shadow: 0 0 0 4px #fff, 0 0 0 8px #ff6b00, 0 0 0 12px #fff, 0 24px 60px rgba(255,100,0,0.4); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════
     PIXEL ART — MARIO (canvas)
  ═══════════════════════════════════════ */
  function drawMarioFrame(ctx, frame) {
    ctx.clearRect(0, 0, 40, 52);
    const S = 4;
    const R='#e52213', B='#0052a2', SK='#fba86f', SH='#5e1205',
          BL='#4a2200', W='#ffffff', E='#e8a000';
    function d(x, y, c) { ctx.fillStyle=c; ctx.fillRect(x*S, y*S, S, S); }

    // Hat
    [[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],
     [2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]].forEach(p=>d(...p));
    // Hair
    [[1,2,SH],[2,2,SH],[3,2,SH]].forEach(p=>d(...p));
    // Face
    [[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],
     [1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK],
     [1,4,SK],[2,4,SK],[3,4,SK],[4,4,SK],[5,4,SK],[6,4,SK],[7,4,SK],[8,4,SK],[9,4,SK]].forEach(p=>d(...p));
    // Eyes + moustache
    d(3,3,SH); d(7,3,SH);
    [[2,4,SH],[3,4,SH],[4,4,SH],[6,4,SH],[7,4,SH],[8,4,SH]].forEach(p=>d(...p));
    // Overalls
    [[3,5,E],[4,5,E],[5,5,E],[6,5,E],[7,5,E],
     [2,5,R],[1,5,R],[8,5,R],[9,5,R],
     [0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B],
     [0,7,B],[1,7,B],[2,7,B],[3,7,B],[4,7,B],[5,7,B],[6,7,B],[7,7,B],[8,7,B],[9,7,B],[10,7,B],
     [2,8,B],[3,8,B],[4,8,SK],[5,8,SK],[6,8,B],[7,8,B],[8,8,B],
     [2,9,SK],[3,9,SK],[4,9,SK],[5,9,SK],[6,9,SK],[7,9,SK],[8,9,SK]].forEach(p=>d(...p));
    // Arms
    d(-1,6,SK); d(-1,7,R); d(11,6,SK); d(11,7,SK);
    // Buttons
    d(3,5,W); d(8,5,W);
    // Legs (alternating)
    if (frame % 2 === 0) {
      [[2,10,B],[3,10,B],[7,10,B],[8,10,B],[9,10,B],
       [2,11,BL],[3,11,BL],[8,11,BL],[9,11,BL]].forEach(p=>d(...p));
    } else {
      [[1,10,B],[2,10,B],[3,10,B],[8,10,B],[9,10,B],
       [1,11,BL],[2,11,BL],[8,11,BL],[9,11,BL]].forEach(p=>d(...p));
    }
  }

  /* ═══════════════════════════════════════
     PIXEL ART — GOOMBA (canvas)
  ═══════════════════════════════════════ */
  function drawGoombaFrame(ctx, frame) {
    ctx.clearRect(0, 0, 36, 36);
    const S = 4;
    const GB='#795548', GD='#4a2200', GW='#fff';
    function d(x, y, c) { ctx.fillStyle=c; ctx.fillRect(x*S, y*S, S, S); }
    [[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
     [0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB],
     [0,4,GB],[1,4,GB],[2,4,GB],[3,4,GB],[4,4,GB],[5,4,GB],[6,4,GB],[7,4,GB],[8,4,GB],
     [0,5,GB],[1,5,GB],[2,5,GB],[3,5,GB],[4,5,GB],[5,5,GB],[6,5,GB],[7,5,GB],[8,5,GB],
     [1,6,GB],[2,6,GB],[3,6,GB],[4,6,GB],[5,6,GB],[6,6,GB],[7,6,GB]].forEach(p=>d(...p));
    [[1,3,GW],[2,3,GW],[6,3,GW],[7,3,GW],
     [1,4,GW],[2,4,GW],[6,4,GW],[7,4,GW]].forEach(p=>d(...p));
    d(2,4,'#000'); d(7,4,'#000');
    [[0,2,GD],[1,2,GD],[6,2,GD],[7,2,GD],[8,2,GD]].forEach(p=>d(...p));
    if (frame % 2 === 0) {
      [[0,7,GD],[1,7,GD],[6,7,GD],[7,7,GD],[8,7,GD]].forEach(p=>d(...p));
    } else {
      [[1,7,GD],[2,7,GD],[5,7,GD],[6,7,GD],[7,7,GD]].forEach(p=>d(...p));
    }
  }

  /* ═══════════════════════════════════════
     CREATE UI
  ═══════════════════════════════════════ */
  function createUI() {
    injectStyles();
    if (document.getElementById('kekaMario')) return;

    const widget = document.createElement('div');
    widget.id = 'kekaMario';
    widget.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483646;
      width: 360px;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 0 0 4px #fff, 0 0 0 8px #e8282b, 0 0 0 12px #fff, 0 24px 60px rgba(0,0,0,0.4);
      animation: km-slidein 0.65s cubic-bezier(0.34,1.4,0.64,1) forwards;
      user-select: none;
      cursor: default;
    `;

    widget.innerHTML = `
      <!-- ═══ WORLD (SKY) ═══ -->
      <div id="kmWorld" style="
        position:relative; height:220px; overflow:hidden;
        background:linear-gradient(180deg,#5c94fc 0%,#7fb4ff 60%,#a8d0ff 100%);
      ">
        <!-- Stars -->
        <div style="position:absolute;top:10px;left:30px;width:3px;height:3px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite 0s;"></div>
        <div style="position:absolute;top:16px;left:85px;width:2px;height:2px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite 0.8s;"></div>
        <div style="position:absolute;top:8px;left:200px;width:3px;height:3px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite 1.4s;"></div>

        <!-- Sun -->
        <div style="
          position:absolute;top:16px;right:22px;
          width:52px;height:52px;border-radius:50%;
          background:#ffd700;border:4px solid #fff;
          box-shadow:0 0 0 3px #e8a000,0 6px 20px rgba(255,200,0,0.5);
        "></div>

        <!-- Cloud 1 -->
        <svg style="position:absolute;top:18px;left:12px;" width="90" height="46" viewBox="0 0 90 46">
          <ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/>
          <ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/>
          <ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/>
          <ellipse cx="40" cy="24" rx="18" ry="17" fill="white"/>
        </svg>

        <!-- Cloud 2 -->
        <svg style="position:absolute;top:22px;left:165px;" width="66" height="36" viewBox="0 0 66 36">
          <ellipse cx="33" cy="28" rx="30" ry="13" fill="white"/>
          <ellipse cx="20" cy="21" rx="16" ry="15" fill="white"/>
          <ellipse cx="42" cy="20" rx="18" ry="16" fill="white"/>
        </svg>

        <!-- Hills -->
        <svg style="position:absolute;bottom:56px;left:0;right:0;width:100%;height:70px;" viewBox="0 0 360 70" preserveAspectRatio="none">
          <ellipse cx="70" cy="100" rx="100" ry="72" fill="#2e7d32"/>
          <ellipse cx="240" cy="105" rx="115" ry="75" fill="#2e7d32"/>
          <ellipse cx="340" cy="108" rx="85" ry="68" fill="#2e7d32"/>
          <ellipse cx="70" cy="100" rx="96" ry="68" fill="#4caf50"/>
          <ellipse cx="240" cy="105" rx="111" ry="71" fill="#4caf50"/>
          <ellipse cx="340" cy="108" rx="81" ry="64" fill="#43a047"/>
          <ellipse cx="55" cy="72" rx="18" ry="10" fill="#66bb6a"/>
          <ellipse cx="220" cy="76" rx="22" ry="12" fill="#66bb6a"/>
        </svg>

        <!-- Ground -->
        <svg style="position:absolute;bottom:0;left:0;" width="360" height="56" viewBox="0 0 360 56">
          <defs>
            <pattern id="kmBrick" x="0" y="0" width="36" height="18" patternUnits="userSpaceOnUse">
              <rect width="36" height="18" fill="#c8860a"/>
              <rect x="0" y="0" width="35" height="8" fill="#d4920e"/>
              <rect x="0" y="10" width="17" height="8" fill="#d4920e"/>
              <rect x="19" y="10" width="17" height="8" fill="#d4920e"/>
              <rect x="0" y="8" width="36" height="2" fill="#7a5000"/>
              <rect x="18" y="0" width="2" height="8" fill="#7a5000"/>
              <rect x="0" y="10" width="1" height="8" fill="#7a5000"/>
              <rect x="18" y="10" width="2" height="8" fill="#7a5000"/>
              <rect x="35" y="0" width="1" height="8" fill="#7a5000"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="360" height="14" fill="#4caf50"/>
          <rect x="0" y="2" width="360" height="5" fill="#66bb6a"/>
          <rect x="0" y="12" width="360" height="2" fill="#2e7d32"/>
          <rect x="0" y="14" width="360" height="42" fill="url(#kmBrick)"/>
        </svg>

        <!-- Platform -->
        <div style="position:absolute;top:120px;left:188px;width:72px;height:18px;border-radius:4px;background:#c84b0c;border:3px solid #fff;box-shadow:0 4px 0 #8b2e00,inset 0 3px 0 rgba(255,255,255,0.15);overflow:hidden;">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0,transparent 16px,rgba(0,0,0,0.12) 16px,rgba(0,0,0,0.12) 17px);"></div>
        </div>
        <div style="position:absolute;top:100px;left:98px;width:54px;height:18px;border-radius:4px;background:#c84b0c;border:3px solid #fff;box-shadow:0 4px 0 #8b2e00,inset 0 3px 0 rgba(255,255,255,0.15);overflow:hidden;">
          <div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0,transparent 16px,rgba(0,0,0,0.12) 16px,rgba(0,0,0,0.12) 17px);"></div>
        </div>

        <!-- ? Blocks -->
        <div style="position:absolute;top:84px;left:103px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,0.3);animation:km-qbob 2s ease-in-out infinite 0s;">?</div>
        <div style="position:absolute;top:68px;left:198px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,0.3);animation:km-qbob 2.1s ease-in-out infinite 0.7s;">?</div>
        <div style="position:absolute;top:82px;left:236px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,0.3);animation:km-qbob 1.9s ease-in-out infinite 1.4s;">?</div>

        <!-- Pipe left -->
        <div style="position:absolute;bottom:56px;left:16px;display:flex;flex-direction:column;align-items:center;">
          <div style="width:46px;height:14px;background:#4caf50;border:3px solid #fff;border-radius:4px 4px 0 0;box-shadow:0 0 0 2px #2e7d32,inset 0 3px 0 rgba(255,255,255,0.25),inset -3px 0 0 rgba(0,0,0,0.15);"></div>
          <div style="width:36px;height:30px;background:#43a047;border:3px solid #fff;border-top:none;box-shadow:0 0 0 2px #2e7d32,inset -3px 0 0 rgba(0,0,0,0.1);"></div>
        </div>

        <!-- Pipe right -->
        <div style="position:absolute;bottom:56px;right:16px;display:flex;flex-direction:column;align-items:center;">
          <div style="width:38px;height:11px;background:#4caf50;border:3px solid #fff;border-radius:4px 4px 0 0;box-shadow:0 0 0 2px #2e7d32,inset 0 3px 0 rgba(255,255,255,0.25);"></div>
          <div style="width:30px;height:22px;background:#43a047;border:3px solid #fff;border-top:none;box-shadow:0 0 0 2px #2e7d32;"></div>
        </div>

        <!-- Bowser SVG -->
        <svg style="position:absolute;bottom:56px;right:52px;image-rendering:pixelated;" width="52" height="60" viewBox="0 0 52 60">
          <rect x="10" y="18" width="32" height="26" rx="4" fill="#33691e" stroke="#fff" stroke-width="2"/>
          <ellipse cx="26" cy="31" rx="10" ry="8" fill="#558b2f"/>
          <ellipse cx="26" cy="31" rx="6" ry="5" fill="#33691e"/>
          <polygon points="13,18 17,8 21,18" fill="#e53935" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          <polygon points="22,14 26,4 30,14" fill="#e53935" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          <polygon points="31,18 35,8 39,18" fill="#e53935" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          <rect x="8" y="8" width="36" height="24" rx="6" fill="#558b2f" stroke="#fff" stroke-width="2"/>
          <circle cx="16" cy="18" r="5" fill="#fff"/>
          <circle cx="36" cy="18" r="5" fill="#fff"/>
          <circle cx="17" cy="19" r="3" fill="#e53935"/>
          <circle cx="37" cy="19" r="3" fill="#e53935"/>
          <circle cx="18" cy="18" r="1.5" fill="#000"/>
          <circle cx="38" cy="18" r="1.5" fill="#000"/>
          <rect x="11" y="12" width="11" height="4" rx="2" fill="#33691e"/>
          <rect x="30" y="12" width="11" height="4" rx="2" fill="#33691e"/>
          <rect x="18" y="22" width="16" height="8" rx="4" fill="#7cb342" stroke="#fff" stroke-width="1.5"/>
          <circle cx="23" cy="26" r="2" fill="#33691e"/>
          <circle cx="29" cy="26" r="2" fill="#33691e"/>
          <rect x="2" y="28" width="10" height="8" rx="4" fill="#558b2f" stroke="#fff" stroke-width="1.5"/>
          <rect x="40" y="28" width="10" height="8" rx="4" fill="#558b2f" stroke="#fff" stroke-width="1.5"/>
          <rect x="12" y="42" width="12" height="8" rx="4" fill="#558b2f" stroke="#fff" stroke-width="1.5"/>
          <rect x="28" y="42" width="12" height="8" rx="4" fill="#558b2f" stroke="#fff" stroke-width="1.5"/>
          <ellipse cx="3" cy="28" rx="5" ry="4" fill="#ff6f00"/>
          <ellipse cx="3" cy="28" rx="3" ry="2.5" fill="#ffd600"/>
        </svg>

        <!-- Peach SVG -->
        <svg id="kmPeach" style="position:absolute;bottom:56px;right:8px;image-rendering:pixelated;" width="28" height="52" viewBox="0 0 28 52">
          <ellipse cx="14" cy="40" rx="12" ry="14" fill="#f06292" stroke="#fff" stroke-width="2"/>
          <rect x="8" y="28" width="12" height="16" fill="#f06292"/>
          <rect x="9" y="18" width="10" height="14" rx="3" fill="#fba86f" stroke="#fff" stroke-width="1.5"/>
          <ellipse cx="14" cy="14" rx="9" ry="10" fill="#fba86f" stroke="#fff" stroke-width="2"/>
          <ellipse cx="14" cy="8" rx="10" ry="7" fill="#ffd600" stroke="#fff" stroke-width="1.5"/>
          <polygon points="7,7 10,1 14,6 18,1 21,7" fill="#ffd700" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="10" cy="2" r="2" fill="#e53935"/>
          <circle cx="14" cy="1" r="2" fill="#4caf50"/>
          <circle cx="18" cy="2" r="2" fill="#1565c0"/>
          <circle cx="10" cy="13" r="2.5" fill="#fff"/>
          <circle cx="18" cy="13" r="2.5" fill="#fff"/>
          <circle cx="10" cy="13" r="1.5" fill="#1565c0"/>
          <circle cx="18" cy="13" r="1.5" fill="#1565c0"/>
          <path d="M10 18 Q14 21 18 18" fill="none" stroke="#c2185b" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="20" y="20" width="5" height="10" rx="3" fill="#fba86f" stroke="#fff" stroke-width="1.5" style="transform-origin:20px 20px;animation:km-wave 1.2s ease-in-out infinite;"/>
          <rect x="3" y="24" width="5" height="8" rx="3" fill="#fba86f" stroke="#fff" stroke-width="1.5"/>
        </svg>

        <!-- Mario canvas -->
        <canvas id="kmMario" width="40" height="52" style="
          position:absolute; bottom:56px; image-rendering:pixelated;
          animation:km-mrun 8s linear infinite;
        "></canvas>

        <!-- Goomba canvas -->
        <canvas id="kmGoomba" width="36" height="36" style="
          position:absolute; bottom:56px; image-rendering:pixelated;
          animation:km-gwalk 6s linear infinite;
        "></canvas>

        <!-- GLASS HUD -->
        <div style="
          position:absolute; top:12px; left:12px; right:12px;
          background:rgba(255,255,255,0.28);
          backdrop-filter:blur(20px) saturate(180%);
          -webkit-backdrop-filter:blur(20px) saturate(180%);
          border:3px solid rgba(255,255,255,0.9); border-radius:18px;
          padding:12px 14px 10px;
          box-shadow:inset 0 2px 0 rgba(255,255,255,1),0 8px 32px rgba(0,80,200,0.15);
          overflow:hidden;
        ">
          <div style="position:absolute;top:0;left:0;right:0;height:50%;background:linear-gradient(180deg,rgba(255,255,255,0.5) 0%,transparent 100%);border-radius:15px 15px 0 0;pointer-events:none;"></div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;position:relative;z-index:2;">
            <div>
              <div style="font-size:13px;font-weight:900;letter-spacing:0.06em;color:#1a237e;text-shadow:0 1px 0 rgba(255,255,255,0.6);">Grind Tracker</div>
              <div style="font-size:9px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(26,35,126,0.5);margin-top:1px;">The Eternal Session</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:5px;background:#22c55e;border:2.5px solid #fff;border-radius:50px;padding:4px 11px;box-shadow:0 3px 0 #14532d;">
                <div style="width:7px;height:7px;border-radius:50%;background:#fff;animation:km-ld 1.5s ease-in-out infinite;"></div>
                <span style="font-size:9px;font-weight:900;color:#fff;letter-spacing:0.1em;">LIVE</span>
              </div>
              <button id="kmMinBtn" style="
                width:26px;height:26px;border-radius:50%;
                background:#fff;border:2.5px solid rgba(255,255,255,0.8);
                box-shadow:0 3px 0 rgba(0,0,0,0.18);
                color:#1a237e;font-size:16px;line-height:1;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                font-weight:900;font-family:'Nunito',sans-serif;
              ">−</button>
            </div>
          </div>

          <div style="display:flex;align-items:flex-end;justify-content:center;gap:2px;position:relative;z-index:2;margin-bottom:3px;">
            <span id="kmHours" style="font-size:58px;line-height:0.88;font-weight:900;color:#1a237e;text-shadow:3px 3px 0 rgba(255,255,255,0.7),-1px -1px 0 rgba(255,255,255,0.5);letter-spacing:-2px;">0</span>
            <span style="font-size:16px;font-weight:900;color:rgba(26,35,126,0.5);margin-bottom:8px;margin-left:1px;margin-right:4px;">h</span>
            <span id="kmMins" style="font-size:58px;line-height:0.88;font-weight:900;color:#1a237e;text-shadow:3px 3px 0 rgba(255,255,255,0.7),-1px -1px 0 rgba(255,255,255,0.5);letter-spacing:-2px;">00</span>
            <span style="font-size:16px;font-weight:900;color:rgba(26,35,126,0.5);margin-bottom:8px;margin-left:1px;">m</span>
          </div>

          <div id="kmVibe" style="font-size:10px;font-weight:800;font-style:italic;color:rgba(26,35,126,0.55);text-align:center;position:relative;z-index:2;">"kaam shuru kar… the grind demands tribute."</div>
        </div>
      </div>

      <!-- ═══ BRICK DIVIDER ═══ -->
      <div style="
        height:24px;
        background:repeating-linear-gradient(90deg,#c84b0c 0,#c84b0c 30px,#a33800 30px,#a33800 32px);
        border-top:3px solid #fff;border-bottom:2px solid #8b2e00;
        position:relative;
      ">
        <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:rgba(0,0,0,0.15);transform:translateY(-50%);"></div>
      </div>

      <!-- ═══ BOTTOM PANEL ═══ -->
      <div id="kmPanel" style="background:#e8282b;padding:14px 14px 12px;">

        <!-- Coin row -->
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.6);">Coins Collected</span>
            <span id="kmPct" style="font-size:13px;font-weight:900;color:#ffe566;text-shadow:1px 1px 0 rgba(0,0,0,0.3);">0%</span>
          </div>
          <div id="kmCoins" style="display:flex;gap:3px;flex-wrap:nowrap;"></div>
        </div>

        <!-- Stat boxes -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
          <!-- Worked -->
          <div style="border-radius:14px;padding:10px 8px 9px;text-align:center;background:linear-gradient(155deg,#1565c0,#0d47a1);border:3px solid rgba(255,255,255,0.4);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,0.25),inset 0 2px 0 rgba(255,255,255,0.3);">
            <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,0.25),transparent);border-radius:11px 11px 0 0;pointer-events:none;"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:5px;">Worked</div>
            <div id="kmWorked" style="font-size:12px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,0.3);line-height:1.2;">0h 00m</div>
          </div>
          <!-- Baaki -->
          <div style="border-radius:14px;padding:10px 8px 9px;text-align:center;background:linear-gradient(155deg,#e65100,#bf360c);border:3px solid rgba(255,255,255,0.4);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,0.25),inset 0 2px 0 rgba(255,255,255,0.3);">
            <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,0.25),transparent);border-radius:11px 11px 0 0;pointer-events:none;"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:5px;">Baaki</div>
            <div id="kmLeft" style="font-size:12px;font-weight:900;color:#ffe566;text-shadow:1px 1px 0 rgba(0,0,0,0.3);line-height:1.2;">8h 00m</div>
          </div>
          <!-- Break -->
          <div style="border-radius:14px;padding:10px 8px 9px;text-align:center;background:linear-gradient(155deg,#2e7d32,#1b5e20);border:3px solid rgba(255,255,255,0.4);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,0.25),inset 0 2px 0 rgba(255,255,255,0.3);">
            <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,0.25),transparent);border-radius:11px 11px 0 0;pointer-events:none;"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:5px;">Break</div>
            <div id="kmBreak" style="font-size:12px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,0.3);line-height:1.2;">0h 00m</div>
          </div>
        </div>

        <!-- ETA -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:11px;">
          <div style="border-radius:16px;padding:10px 12px;background:#f9a825;border:3px solid rgba(255,255,255,0.5);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,0.2),inset 0 2px 0 rgba(255,255,255,0.35);">
            <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,0.3),transparent);border-radius:13px 13px 0 0;pointer-events:none;"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:rgba(100,50,0,0.7);margin-bottom:5px;">☀️ Half Day</div>
            <div id="kmHalf" style="font-size:18px;font-weight:900;color:#5d2e00;text-shadow:0 1px 0 rgba(255,255,255,0.3);line-height:1;">--:--</div>
          </div>
          <div style="border-radius:16px;padding:10px 12px;background:#1e88e5;border:3px solid rgba(255,255,255,0.5);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,0.2),inset 0 2px 0 rgba(255,255,255,0.35);">
            <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,0.3),transparent);border-radius:13px 13px 0 0;pointer-events:none;"></div>
            <div style="font-size:8px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:5px;">🚪 MAJDOORI KHATAM</div>
            <div id="kmFull" style="font-size:18px;font-weight:900;color:#fff;text-shadow:0 1px 0 rgba(0,0,0,0.2);line-height:1;">--:--</div>
          </div>
        </div>

        <!-- Ticker -->
        <div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:6px 10px;overflow:hidden;">
          <span id="kmTicker" style="display:inline-block;white-space:nowrap;font-size:8px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);animation:km-ticker 28s linear infinite;">
            CHAI PIVI CHE KE NHI ★ BOSS NE KHABAR NATHI ★ GHAR JA BHAI ★ SURAT NO SHER ★ KEKA BAND KAR ★ PAKODA TIME ★ CHAI PIVI CHE KE NHI ★ BOSS NE KHABAR NATHI ★ AB KAL ANA NAHA DHO KAR ★ SURAT NO SHER ★
          </span>
        </div>

      </div>
    `;

    document.body.appendChild(widget);

    /* Slide-in done */
    widget.addEventListener('animationend', (ev) => {
      if (ev.animationName === 'km-slidein' && !didSlideIn) {
        didSlideIn = true;
        widget.style.animation = '';
      }
    }, { once: true });

    /* Minimize */
    let minimized = false;
    document.getElementById('kmMinBtn').addEventListener('click', (ev) => {
      ev.stopPropagation();
      minimized = !minimized;
      document.getElementById('kmPanel').style.display = minimized ? 'none' : 'block';
      document.getElementById('kmWorld').style.height  = minimized ? '50px' : '220px';
      ev.currentTarget.textContent = minimized ? '+' : '−';
    });

    /* Build coins */
    buildCoins(0);

    /* Start sprite animation */
    startSprites();
  }

  /* ═══════════════════════════════════════
     COINS
  ═══════════════════════════════════════ */
  function buildCoins(pct) {
    const wrap = document.getElementById('kmCoins');
    if (!wrap) return;
    const TOTAL = 17;
    const lit   = Math.round((pct / 100) * TOTAL);
    wrap.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const c = document.createElement('div');
      const on = i < lit;
      c.style.cssText = `
        width:17px;height:17px;border-radius:50%;flex-shrink:0;position:relative;
        ${on
          ? `background:radial-gradient(circle at 35% 28%,#fffde7,#ffd600 38%,#c67c00 72%,#7a4500 100%);
             border:2.5px solid #fff;
             box-shadow:0 3px 0 rgba(0,0,0,0.25),inset 0 1px 2px rgba(255,255,255,0.5);`
          : `background:rgba(0,0,0,0.2);border:1.5px solid rgba(255,255,255,0.2);`
        }
      `;
      if (on) {
        const shine = document.createElement('div');
        shine.style.cssText = 'position:absolute;top:2px;left:3px;width:5px;height:4px;background:rgba(255,255,255,0.6);border-radius:50%;';
        c.appendChild(shine);
      }
      wrap.appendChild(c);
    }
  }

  /* ═══════════════════════════════════════
     SPRITES
  ═══════════════════════════════════════ */
  function startSprites() {
    const mc  = document.getElementById('kmMario');
    const gc  = document.getElementById('kmGoomba');
    if (!mc || !gc) return;
    const mCtx = mc.getContext('2d');
    const gCtx = gc.getContext('2d');
    let frame  = 0;
    drawMarioFrame(mCtx, 0);
    drawGoombaFrame(gCtx, 0);
    setInterval(() => {
      frame++;
      drawMarioFrame(mCtx, frame);
      drawGoombaFrame(gCtx, frame);
    }, 180);
  }

  /* ═══════════════════════════════════════
     CONFETTI
  ═══════════════════════════════════════ */
  function launchConfetti() {
    const colors = ['#ffd700','#e8282b','#1565c0','#4caf50','#f9a825','#fff','#e53935'];
    let count = 0;
    confettiInterval = setInterval(() => {
      if (count++ > 120) { clearInterval(confettiInterval); return; }
      const p = document.createElement('div');
      p.style.cssText = `
        position:fixed;top:-16px;z-index:2147483647;pointer-events:none;
        left:${Math.random() * 100}vw;
        width:${Math.random() * 9 + 4}px;
        height:${Math.random() * 9 + 4}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        animation:km-confetti ${Math.random() * 2.5 + 2}s linear forwards;
        animation-delay:${Math.random() * 0.5}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5500);
    }, 65);
  }

  /* ═══════════════════════════════════════
     TOAST
  ═══════════════════════════════════════ */
  function showToast(emoji, line1, line2, color) {
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed;bottom:28px;left:50%;
      transform:translateX(-50%) translateY(80px);
      z-index:2147483645;
      background:#fff;
      border-radius:20px;
      border:4px solid ${color};
      box-shadow:0 0 0 2px #fff,0 0 0 6px ${color},0 20px 60px rgba(0,0,0,0.3);
      padding:16px 28px;text-align:center;
      font-family:'Nunito',sans-serif;
      transition:transform 0.45s cubic-bezier(0.34,1.5,0.64,1),opacity 0.45s;
      opacity:0;min-width:240px;pointer-events:none;
    `;
    t.innerHTML = `
      <div style="font-size:28px;margin-bottom:7px;">${emoji}</div>
      <div style="font-size:14px;font-weight:900;color:${color};letter-spacing:0.1em;">${line1}</div>
      <div style="font-size:12px;font-weight:800;font-style:italic;color:rgba(0,0,0,0.4);margin-top:4px;">${line2}</div>
    `;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      t.style.transform = 'translateX(-50%) translateY(0)';
      t.style.opacity   = '1';
    });
    setTimeout(() => {
      t.style.transform = 'translateX(-50%) translateY(80px)';
      t.style.opacity   = '0';
      setTimeout(() => t.remove(), 500);
    }, 5000);
  }

  /* ═══════════════════════════════════════
     VICTORY OVERLAY
  ═══════════════════════════════════════ */
  function launchVictoryOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      z-index:2147483644;background:rgba(92,148,252,0);
      pointer-events:none;transition:background 0.6s;
      display:flex;align-items:center;justify-content:center;
    `;
    const card = document.createElement('div');
    card.style.cssText = `
      background:#fff;
      border-radius:24px;
      border:5px solid #e8282b;
      box-shadow:0 0 0 3px #fff,0 0 0 8px #e8282b,0 0 0 11px #fff,0 0 0 15px #ffd700,0 30px 80px rgba(0,0,0,0.5);
      padding:40px 50px;text-align:center;
      opacity:0;transform:scale(0.8) translateY(30px);
      transition:all 0.55s cubic-bezier(0.34,1.4,0.64,1) 0.15s;
      pointer-events:auto;max-width:360px;
      font-family:'Nunito',sans-serif;
    `;
    card.innerHTML = `
      <div style="font-size:48px;margin-bottom:12px;">⭐</div>
      <div style="font-size:11px;font-weight:900;letter-spacing:0.25em;text-transform:uppercase;color:rgba(0,0,0,0.3);margin-bottom:10px;">SESSION COMPLETE</div>
      <div style="font-size:52px;font-weight:900;color:#e8282b;line-height:1;margin-bottom:6px;letter-spacing:-1px;">8 GHANTE</div>
      <div style="font-size:14px;font-weight:900;color:rgba(0,0,0,0.3);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:18px;">COMPLETE</div>
      <div style="font-size:16px;font-weight:800;font-style:italic;color:rgba(0,0,0,0.55);line-height:1.6;margin-bottom:22px;">
        nikal gayo bhai 🎉<br>chutti pakki hai, ghar ja heve<br>keka band kar!
      </div>
      <div style="font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:rgba(0,0,0,0.2);">tap anywhere to close</div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.background = 'rgba(92,148,252,0.75)';
      card.style.opacity   = '1';
      card.style.transform = 'scale(1) translateY(0)';
    }, 80);
    overlay.addEventListener('click', () => {
      overlay.style.background = 'rgba(92,148,252,0)';
      card.style.opacity   = '0';
      card.style.transform = 'scale(0.9) translateY(20px)';
      setTimeout(() => overlay.remove(), 500);
    });
  }

  /* ═══════════════════════════════════════
     VICTORY THEME
  ═══════════════════════════════════════ */
  function applyVictoryTheme() {
    const widget = document.getElementById('kekaMario');
    if (!widget) return;
    widget.style.animation = 'km-victory 3s ease-in-out infinite';
    // Gold panel
    const panel = document.getElementById('kmPanel');
    if (panel) panel.style.background = '#f9a825';
    // Bar to 100%
    buildCoins(100);
    document.getElementById('kmPct').textContent = '100%';
    document.getElementById('kmPct').style.color = '#7a4800';
    document.getElementById('kmLeft').textContent = '0h 00m';
    document.getElementById('kmLeft').style.color = '#fff';
    // Ticker
    const ticker = document.getElementById('kmTicker');
    if (ticker) {
      ticker.style.color = 'rgba(100,50,0,0.5)';
      ticker.textContent = 'VICTORY ★ CHUTTI PAKKI HAI ★ GHAR JA BHAI ★ CURSO BAND KAR ★ SURAT NO SHER JEETI GAYO ★ NIKAL BHAI ★ VICTORY ★ CHUTTI PAKKI HAI ★ GHAR BHEGA THA ★ LAPTOP BAND KAR ★';
    }
    // Vibe
    const vibe = document.getElementById('kmVibe');
    if (vibe) vibe.textContent = '"Ghr bhega thao… the realm is yours. ghar ja."';
  }

  /* ═══════════════════════════════════════
     NOTIFICATION
  ═══════════════════════════════════════ */
  function requestNotification() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default')
      setTimeout(() => Notification.requestPermission(), 3000);
  }
  function fireNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification('⭐ 8 Ghante Pure Bhai!', {
        body: 'Ab koi nhi rok skta punchout krne se — Cursor bnd kr.',
        tag: 'keka-8hr', requireInteraction: true
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {}
  }

  /* ═══════════════════════════════════════
     TAB TITLE FLASH
  ═══════════════════════════════════════ */
  function startTitleFlash() {
    if (titleFlashInterval) return;
    let t = false;
    titleFlashInterval = setInterval(() => {
      document.title = t ? '⭐ Chutti Time! Ghar Ja!' : '✅ 8hrs Done — Nikal Bhai!';
      t = !t;
    }, 1300);
  }

  /* ═══════════════════════════════════════
     UPDATE UI
  ═══════════════════════════════════════ */
  function updateUI() {
    const data = window.KekaHoursLatest;
    if (!data) return;
    const { totalMinutes, breakMinutes, firstStart } = data;
    const remaining = WORK_MINUTES - totalMinutes;
    const pct       = Math.min(100, (totalMinutes / WORK_MINUTES) * 100);
    const H         = Math.floor(totalMinutes / 60);
    const M         = totalMinutes % 60;

    /* Clock */
    const kmH = document.getElementById('kmHours');
    const kmM = document.getElementById('kmMins');
    if (kmH) kmH.textContent = H;
    if (kmM) kmM.textContent = String(M).padStart(2, '0');

    /* Worked */
    const kwEl = document.getElementById('kmWorked');
    if (kwEl) kwEl.textContent = `${H}h ${String(M).padStart(2,'0')}m`;

    /* Baaki */
    const klEl = document.getElementById('kmLeft');
    if (klEl && !eightHourTriggered) {
      const r = Math.max(0, remaining);
      klEl.textContent = `${Math.floor(r/60)}h ${String(r%60).padStart(2,'0')}m`;
    }

    /* Break */
    const kbEl = document.getElementById('kmBreak');
    if (kbEl) kbEl.textContent = `${Math.floor(breakMinutes/60)}h ${String(breakMinutes%60).padStart(2,'0')}m`;

    /* Coins + pct */
    if (!eightHourTriggered) {
      buildCoins(Math.floor(pct));
      const kpEl = document.getElementById('kmPct');
      if (kpEl) kpEl.textContent = Math.floor(pct) + '%';
    }

    /* Vibe */
    const kvEl = document.getElementById('kmVibe');
    if (kvEl && !eightHourTriggered) kvEl.textContent = getVibe(pct);

    /* ETAs */
    if (firstStart) {
      const st = parseTime(firstStart);
      if (st) {
        const base = new Date();
        base.setHours(st.hours, st.minutes, 0, 0);
        const half = new Date(base.getTime() + (HALF_DAY_MINUTES + breakMinutes) * 60000);
        const full = new Date(base.getTime() + (WORK_MINUTES     + breakMinutes) * 60000);
        const halfEl = document.getElementById('kmHalf');
        const fullEl = document.getElementById('kmFull');
        if (halfEl) halfEl.textContent = fmtTime(half);
        if (fullEl && !eightHourTriggered) fullEl.textContent = fmtTime(full);
      }
    }

    /* Warning aura ≤ 30 min */
    const widget = document.getElementById('kekaMario');
    if (widget && remaining <= 30 && remaining > 0 && !eightHourTriggered) {
      widget.style.animation = 'km-warn 2s ease-in-out infinite';
    }

    /* 10 min toast */
    if (remaining <= 10 && remaining > 0 && !tenMinTriggered) {
      tenMinTriggered = true;
      showToast('⏳', 'SIRF 10 MINUTE', 'bas thodi der aur, fir majdoori si azaadi…', '#e65100');
    }

    /* 8hr VICTORY */
    if (totalMinutes >= WORK_MINUTES && !eightHourTriggered) {
      eightHourTriggered = true;
      launchConfetti();
      launchVictoryOverlay();
      applyVictoryTheme();
      fireNotification();
      startTitleFlash();
      showToast('⭐', '8 GHANTE PURE', 'nikal jaa meri jaaan ghr k liye', '#ffd700');
    }
  }

  /* ═══════════════════════════════════════
     OBSERVER + LOOP
  ═══════════════════════════════════════ */
  function findLogs() {
    return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
  }

  const observer = new MutationObserver(() => {
    const c = findLogs();
    if (c) processLogs(c);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  createUI();
  requestNotification();

  setInterval(() => {
    const c = findLogs();
    if (c) processLogs(c);
    updateUI();
  }, 1000);

})();
