// ╔══════════════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — DUAL THEME EDITION                       ║
// ║   Mario theme  → odd days  (1, 3, 5 …)                          ║
// ║   Spider-Man theme → even days (2, 4, 6 …)                      ║
// ║   Paste in browser console on your Keka attendance page          ║
// ╚══════════════════════════════════════════════════════════════════╝
(function () {
  'use strict';

  // ─── theme selector ──────────────────────────────────────────────────────────
  const TODAY_DATE  = new Date().getDate();
  const THEME       = (TODAY_DATE % 2 === 0) ? 'spiderman' : 'mario';

  // ─── constants ───────────────────────────────────────────────────────────────
  const WORK_MINUTES     = 8 * 60;
  const HALF_DAY_MINUTES = 4 * 60;
  const SCAN_INTERVAL_MS = 20_000;
  const SPRITE_FPS       = 8;

  // ─── state ───────────────────────────────────────────────────────────────────
  let tenMinTriggered    = false;
  let eightHourTriggered = false;
  let confettiInterval   = null;
  let titleFlashInterval = null;
  const originalTitle    = document.title;
  let refs = {};
  let prevLitCoins = -1;
  let rafHandle = null;
  let spriteFrame = 0;
  let lastFrameTime = 0;
  const FRAME_DELAY = 1000 / SPRITE_FPS;
  let mutationTimer = null;
  let lastScanTime = 0;
  const SCAN_THROTTLE_MS = 3_000;

  // ─── data processing (shared) ─────────────────────────────────────────────────

  function parseTimeToMinutes(ts) {
    if (!ts || /^missing$/i.test(ts.trim())) return null;
    const cleaned = ts.trim().toLowerCase().replace(/\s+/g, ' ');
    const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
    if (!match) return null;
    let H = parseInt(match[1], 10);
    const M = parseInt(match[2], 10);
    const ap = match[3];
    if (ap === 'pm' && H !== 12) H += 12;
    if (ap === 'am' && H === 12) H = 0;
    if (H < 0 || H > 23 || M < 0 || M > 59) return null;
    return H * 60 + M;
  }

  function minutesBetween(startStr, endStr) {
    const s = parseTimeToMinutes(startStr);
    const e = parseTimeToMinutes(endStr);
    if (s === null || e === null) return 0;
    const diff = e - s;
    if (diff <= 0 || diff > 720) return 0;
    return diff;
  }

  function liveMinutesFrom(startStr) {
    const s = parseTimeToMinutes(startStr);
    if (s === null) return 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const diff = nowMins - s;
    if (diff <= 0 || diff > 840) return 0;
    return diff;
  }

  function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  }

  function extractLogPairs() {
    const pairs = [];
    const allInputs = Array.from(document.querySelectorAll('input'))
      .filter(el => !el.closest('#kekaMario') && !el.closest('#kekaSpider'));
    const timeInputs = allInputs.filter(el => {
      const v = (el.value || '').trim();
      return parseTimeToMinutes(v) !== null;
    });

    if (timeInputs.length === 0) {
      const timeRegex = /^\d{1,2}:\d{2}\s*(am|pm)$/i;
      const allEls = Array.from(document.querySelectorAll('span, div, td, p'))
        .filter(el => {
          if (el.closest('#kekaMario') || el.closest('#kekaSpider')) return false;
          if (el.children.length > 2) return false;
          const t = (el.textContent || '').trim();
          return timeRegex.test(t);
        });
      const leafEls = allEls.filter(el => !allEls.some(other => other !== el && el.contains(other)));
      for (let i = 0; i < leafEls.length; i++) {
        const s = (leafEls[i].textContent || '').trim();
        if (parseTimeToMinutes(s) === null) continue;
        if (i + 1 < leafEls.length) {
          const e = (leafEls[i + 1].textContent || '').trim();
          pairs.push({ s, e: parseTimeToMinutes(e) !== null ? e : 'MISSING' });
          i++;
        } else {
          pairs.push({ s, e: 'MISSING' });
        }
      }
      return pairs;
    }

    function getRowAncestor(el) {
      let node = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!node || node === document.body) break;
        const inputsInNode = node.querySelectorAll('input');
        if (inputsInNode.length >= 2) return node;
        node = node.parentElement;
      }
      return el.parentElement;
    }

    const rowMap = new Map();
    for (const inp of timeInputs) {
      const row = getRowAncestor(inp);
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row).push(inp);
    }

    for (const [row, inputs] of rowMap) {
      inputs.sort((a, b) => {
        const pos = a.compareDocumentPosition(b);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });
      const s = (inputs[0].value || '').trim();
      if (parseTimeToMinutes(s) === null) continue;
      let e = 'MISSING';
      if (inputs.length >= 2) {
        const v2 = (inputs[1].value || '').trim();
        if (parseTimeToMinutes(v2) !== null) e = v2;
      }
      if (e === 'MISSING' && !/missing/i.test(row.textContent || '')) {
        if (inputs.length < 2) continue;
      }
      pairs.push({ s, e });
    }
    pairs.sort((a, b) => (parseTimeToMinutes(a.s) || 0) - (parseTimeToMinutes(b.s) || 0));
    return pairs;
  }

  function processLogs() {
    const pairs = extractLogPairs();
    if (pairs.length === 0) return;
    let totalM = 0, breakM = 0, firstStart = null, prevEnd = null, activeStart = null;
    pairs.forEach(({ s, e }, idx) => {
      if (parseTimeToMinutes(s) === null) return;
      if (firstStart === null) firstStart = s;
      if (idx > 0 && prevEnd && prevEnd !== 'MISSING') {
        const b = minutesBetween(prevEnd, s);
        if (b > 0) breakM += b;
      }
      const isMissing = (e === 'MISSING' || !e || parseTimeToMinutes(e) === null);
      if (isMissing) {
        activeStart = s;
      } else {
        const sessionMins = minutesBetween(s, e);
        if (sessionMins > 0) totalM += sessionMins;
        prevEnd = e;
        activeStart = null;
      }
    });
    if (activeStart) {
      const live = liveMinutesFrom(activeStart);
      if (live > 0) totalM += live;
    }
    window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
  }

  // ─── shared UI update ──────────────────────────────────────────────────────────
  function setIfChanged(el, val) {
    if (!el || el.textContent === val) return;
    el.textContent = val;
  }

  function getVibeSpider(pct) {
    if (pct >= 100) return 'Mission Complete. You swung through the city. Go home, hero.';
    if (pct >= 90)  return 'Final stretch. With great work comes great exit time.';
    if (pct >= 75)  return 'Multiverse pressure rising. Almost there, Spider.';
    if (pct >= 50)  return 'Spider Grind Mode. Half the city protected.';
    if (pct >= 25)  return 'Web is spinning. The grind has begun.';
    return 'Activating Spider-Sense… tracking your session.';
  }

  function getVibeMario(pct) {
    if (pct >= 100) return '"nikal gayo bhai… the realm is yours. ghar ja."';
    if (pct >= 90)  return '"final castle… bas thoda sa aur."';
    if (pct >= 75)  return '"ghar dikhne laga hai… hold the line."';
    if (pct >= 50)  return '"aadha done… grind ka boss fight baaki hai."';
    if (pct >= 25)  return '"coins collect ho rahe hain… keep moving."';
    return '"kaam shuru kar… the grind demands tribute."';
  }

  function updateUI() {
    const data   = window.KekaHoursLatest || { totalMinutes: 0, breakMinutes: 0, firstStart: null };
    const total  = Math.max(0, data.totalMinutes  || 0);
    const breaks = Math.max(0, data.breakMinutes  || 0);
    const left   = Math.max(0, WORK_MINUTES - total);
    const pct    = Math.min(100, Math.round((total / WORK_MINUTES) * 100));
    const h      = Math.floor(total / 60);
    const m      = total % 60;
    const mStr   = String(m).padStart(2, '0');

    if (THEME === 'mario') updateMarioUI(data, total, breaks, left, pct, h, mStr);
    else updateSpiderUI(data, total, breaks, left, pct, h, mStr);

    if (left <= 10 && left > 0) warnTenMinutes(left);
    if (total >= WORK_MINUTES)  celebrateEightHours();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ MARIO THEME ███
  // ═══════════════════════════════════════════════════════════════════════════════

  function injectMarioStyles() {
    if (document.getElementById('kekaMarioStyles')) return;
    const style = document.createElement('style');
    style.id = 'kekaMarioStyles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,800;0,900;1,800&display=swap');
      #kekaMario * { box-sizing:border-box; margin:0; padding:0; font-family:'Nunito',sans-serif; }
      @keyframes km-slidein { from{transform:translateX(120%) scale(.96);opacity:0;} to{transform:translateX(0) scale(1);opacity:1;} }
      @keyframes km-soft-glow { 0%,100%{filter:drop-shadow(0 18px 30px rgba(0,0,0,.20));} 50%{filter:drop-shadow(0 22px 38px rgba(255,214,0,.24));} }
      @keyframes km-victory-pop { 0%{transform:scale(.92) translateY(24px);opacity:0;} 60%{transform:scale(1.04) translateY(-4px);opacity:1;} 100%{transform:scale(1) translateY(0);opacity:1;} }
      @keyframes km-victory-rainbow { 0%{background-position:0% 50%;} 50%{background-position:100% 50%;} 100%{background-position:0% 50%;} }
      @keyframes km-flag-wave { 0%,100%{transform:rotate(-4deg) translateY(0);} 50%{transform:rotate(4deg) translateY(-3px);} }
      @keyframes km-star-spin { 0%{transform:rotate(0deg) scale(1);} 50%{transform:rotate(180deg) scale(1.18);} 100%{transform:rotate(360deg) scale(1);} }
      @keyframes km-medal-shine { 0%{transform:translateX(-130%) rotate(22deg);} 100%{transform:translateX(160%) rotate(22deg);} }
      @keyframes km-mrun { 0%{left:-44px;bottom:56px;} 30%{left:118px;bottom:56px;} 37%{left:142px;bottom:92px;} 44%{left:166px;bottom:56px;} 62%{left:242px;bottom:56px;} 69%{left:268px;bottom:90px;} 76%{left:294px;bottom:56px;} 100%{left:420px;bottom:56px;} }
      @keyframes km-gwalk { 0%{left:420px;} 100%{left:-44px;} }
      @keyframes km-qbob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-7px);} }
      @keyframes km-ld { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.35;transform:scale(.75);} }
      @keyframes km-ticker { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
      @keyframes km-twinkle { 0%,100%{opacity:.95;transform:scale(1);} 50%{opacity:.25;transform:scale(.55);} }
      @keyframes km-shine { 0%{transform:translateX(-140%) rotate(18deg);} 100%{transform:translateX(180%) rotate(18deg);} }
      @keyframes km-coin-pop { 0%,100%{transform:translateY(0) scale(1);} 50%{transform:translateY(-3px) scale(1.08);} }
      @keyframes km-progress-stripe { from{background-position:0 0;} to{background-position:34px 0;} }
      @keyframes km-cloud { from{transform:translateX(-20px);} to{transform:translateX(20px);} }
      @keyframes km-confetti { 0%{transform:translateY(-16px) rotate(0deg);opacity:1;} 100%{transform:translateY(100vh) rotate(720deg);opacity:0;} }
      @keyframes km-warn { 0%,100%{box-shadow:0 0 0 4px #fff,0 0 0 8px #e8282b,0 0 0 12px #fff,0 24px 60px rgba(0,0,0,.42);} 50%{box-shadow:0 0 0 4px #fff,0 0 0 8px #ffb000,0 0 0 12px #fff,0 24px 75px rgba(255,176,0,.38);} }
      @keyframes km-victory { 0%,100%{box-shadow:0 0 0 4px #fff,0 0 0 8px #ffd700,0 0 0 12px #fff,0 24px 70px rgba(0,0,0,.42);} 50%{box-shadow:0 0 0 4px #fff,0 0 0 8px #ffd700,0 0 0 12px #fff,0 24px 90px rgba(255,215,0,.5);} }
      @keyframes km-luigi-idle { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
      @keyframes km-bowser-breathe { 0%,100%{transform:translateY(0) scale(1);} 50%{transform:translateY(-2px) scale(1.03);} }
      @keyframes km-peach-wave { 0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-2px) rotate(2deg);} }
      @keyframes km-castle-glow { 0%,100%{opacity:.45;transform:scale(1);} 50%{opacity:.85;transform:scale(1.04);} }
    `;
    document.head.appendChild(style);
  }

  function px(ctx, S, x, y, c) { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, S, S); }

  function drawMarioFrame(ctx, frame, green = false) {
    ctx.clearRect(0, 0, 40, 52);
    const S=4, R=green?'#16a34a':'#e52213', B='#0052a2', SK='#fba86f', SH='#5e1205', BL='#4a2200', W='#fff', E='#e8a000';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],[2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]].forEach(p=>d(...p));
    [[1,2,SH],[2,2,SH],[3,2,SH]].forEach(p=>d(...p));
    [[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],[1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK],[1,4,SK],[2,4,SK],[3,4,SK],[4,4,SK],[5,4,SK],[6,4,SK],[7,4,SK],[8,4,SK],[9,4,SK]].forEach(p=>d(...p));
    d(3,3,SH); d(7,3,SH);
    [[2,4,SH],[3,4,SH],[4,4,SH],[6,4,SH],[7,4,SH],[8,4,SH]].forEach(p=>d(...p));
    [[3,5,E],[4,5,E],[5,5,E],[6,5,E],[7,5,E],[2,5,R],[1,5,R],[8,5,R],[9,5,R],[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B],[0,7,B],[1,7,B],[2,7,B],[3,7,B],[4,7,B],[5,7,B],[6,7,B],[7,7,B],[8,7,B],[9,7,B],[10,7,B],[2,8,B],[3,8,B],[4,8,SK],[5,8,SK],[6,8,B],[7,8,B],[8,8,B],[2,9,SK],[3,9,SK],[4,9,SK],[5,9,SK],[6,9,SK],[7,9,SK],[8,9,SK]].forEach(p=>d(...p));
    d(-1,6,SK); d(-1,7,R); d(11,6,SK); d(11,7,SK); d(3,5,W); d(8,5,W);
    (frame%2===0
      ?[[2,10,B],[3,10,B],[7,10,B],[8,10,B],[9,10,B],[2,11,BL],[3,11,BL],[8,11,BL],[9,11,BL]]
      :[[1,10,B],[2,10,B],[3,10,B],[8,10,B],[9,10,B],[1,11,BL],[2,11,BL],[8,11,BL],[9,11,BL]]
    ).forEach(p=>d(...p));
  }

  function drawGoombaFrame(ctx, frame) {
    ctx.clearRect(0, 0, 36, 36);
    const S=4,GB='#795548',GD='#4a2200',GW='#fff';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],[0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB],[0,4,GB],[1,4,GB],[2,4,GB],[3,4,GB],[4,4,GB],[5,4,GB],[6,4,GB],[7,4,GB],[8,4,GB],[0,5,GB],[1,5,GB],[2,5,GB],[3,5,GB],[4,5,GB],[5,5,GB],[6,5,GB],[7,5,GB],[8,5,GB],[1,6,GB],[2,6,GB],[3,6,GB],[4,6,GB],[5,6,GB],[6,6,GB],[7,6,GB]].forEach(p=>d(...p));
    [[1,3,GW],[2,3,GW],[6,3,GW],[7,3,GW],[1,4,GW],[2,4,GW],[6,4,GW],[7,4,GW]].forEach(p=>d(...p));
    d(2,4,'#000'); d(7,4,'#000');
    [[0,2,GD],[1,2,GD],[6,2,GD],[7,2,GD],[8,2,GD]].forEach(p=>d(...p));
    (frame%2===0?[[0,7,GD],[1,7,GD],[6,7,GD],[7,7,GD],[8,7,GD]]:[[1,7,GD],[2,7,GD],[5,7,GD],[6,7,GD],[7,7,GD]]).forEach(p=>d(...p));
  }

  function drawPeachFrame(ctx) {
    ctx.clearRect(0,0,32,52);
    const S=4,P='#f06292',SK='#fba86f',Y='#ffd600',C='#ffd700',W='#fff',BL='#1565c0',M='#c2185b';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[3,0,C],[5,0,C],[7,0,C],[4,1,C],[5,1,C],[6,1,C],[2,2,Y],[3,2,Y],[4,2,Y],[5,2,Y],[6,2,Y],[7,2,Y],[8,2,Y],[2,3,Y],[3,3,Y],[7,3,Y],[8,3,Y],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[3,4,SK],[4,4,SK],[5,4,SK],[6,4,SK],[7,4,SK],[3,5,SK],[4,5,SK],[5,5,SK],[6,5,SK],[7,5,SK]].forEach(p=>d(...p));
    d(4,4,W); d(7,4,W); d(4,4,BL); d(7,4,BL); d(5,5,M); d(6,5,M);
    [[3,6,P],[4,6,P],[5,6,P],[6,6,P],[7,6,P],[2,7,P],[3,7,P],[4,7,P],[5,7,P],[6,7,P],[7,7,P],[8,7,P],[1,8,P],[2,8,P],[3,8,P],[4,8,P],[5,8,P],[6,8,P],[7,8,P],[8,8,P],[9,8,P],[1,9,P],[2,9,P],[3,9,P],[4,9,P],[5,9,P],[6,9,P],[7,9,P],[8,9,P],[9,9,P],[0,10,P],[1,10,P],[2,10,P],[3,10,P],[4,10,P],[5,10,P],[6,10,P],[7,10,P],[8,10,P],[9,10,P],[10,10,P],[0,11,P],[1,11,P],[2,11,P],[3,11,P],[4,11,P],[5,11,P],[6,11,P],[7,11,P],[8,11,P],[9,11,P],[10,11,P],[1,6,SK],[9,6,SK],[10,5,SK]].forEach(p=>d(...p));
  }

  function drawBowserFrame(ctx) {
    ctx.clearRect(0,0,64,64);
    const S=4,G='#5f9f35',DG='#2f6f1f',R='#d62828',W='#fff',O='#ff7a00',Y='#ffd600',K='#111',SH='#8bc34a',H='#f5b041';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[4,0,R],[5,0,R],[10,0,R],[11,0,R],[3,1,R],[4,1,R],[5,1,R],[7,1,H],[8,1,H],[10,1,R],[11,1,R],[12,1,R],[3,2,G],[4,2,G],[5,2,G],[6,2,G],[7,2,G],[8,2,G],[9,2,G],[10,2,G],[11,2,G],[12,2,G],[2,3,G],[3,3,G],[4,3,G],[5,3,G],[6,3,G],[7,3,G],[8,3,G],[9,3,G],[10,3,G],[11,3,G],[12,3,G],[13,3,G],[2,4,G],[3,4,G],[4,4,G],[5,4,G],[6,4,G],[7,4,G],[8,4,G],[9,4,G],[10,4,G],[11,4,G],[12,4,G],[13,4,G],[3,3,W],[4,3,W],[11,3,W],[12,3,W],[4,3,R],[11,3,R],[5,3,K],[12,3,K],[4,5,H],[5,5,H],[6,5,H],[7,5,H],[8,5,H],[9,5,H],[10,5,H],[11,5,H],[5,6,H],[6,6,H],[7,6,H],[8,6,H],[9,6,H],[10,6,H],[5,7,DG],[6,7,DG],[7,7,DG],[8,7,DG],[9,7,DG],[10,7,DG],[4,8,DG],[5,8,DG],[6,8,SH],[7,8,SH],[8,8,SH],[9,8,SH],[10,8,DG],[11,8,DG],[3,9,DG],[4,9,DG],[5,9,DG],[6,9,DG],[7,9,DG],[8,9,DG],[9,9,DG],[10,9,DG],[11,9,DG],[12,9,DG],[4,10,DG],[5,10,DG],[10,10,DG],[11,10,DG],[4,11,DG],[5,11,DG],[10,11,DG],[11,11,DG],[1,7,O],[2,7,Y],[13,7,O],[14,7,Y],[6,8,W],[9,8,W]].forEach(p=>d(...p));
  }

  function marioStatCard(label, id, c1, c2, textColor) {
    return `<div style="border-radius:15px;padding:10px 8px 9px;text-align:center;background:linear-gradient(155deg,${c1},${c2});border:3px solid rgba(255,255,255,.42);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,.25),inset 0 2px 0 rgba(255,255,255,.30);">
      <div style="position:absolute;top:0;left:0;right:0;height:45%;background:linear-gradient(180deg,rgba(255,255,255,.25),transparent);"></div>
      <div style="position:relative;font-size:8px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.62);margin-bottom:5px;">${label}</div>
      <div id="${id}" style="position:relative;font-size:12px;font-weight:900;color:${textColor};text-shadow:1px 1px 0 rgba(0,0,0,.28);line-height:1.2;">--</div>
    </div>`;
  }

  function createMarioUI() {
    injectMarioStyles();
    if (document.getElementById('kekaMario')) return;
    const widget = document.createElement('div');
    widget.id = 'kekaMario';
    widget.style.cssText = `position:fixed;top:20px;right:20px;z-index:2147483646;width:374px;border-radius:28px;overflow:hidden;background:#e8282b;box-shadow:0 0 0 4px #fff,0 0 0 8px #e8282b,0 0 0 12px #fff,0 24px 70px rgba(0,0,0,.42);animation:km-slidein .65s cubic-bezier(.34,1.4,.64,1) forwards,km-soft-glow 4s ease-in-out infinite .9s;will-change:filter;transform:translateZ(0);user-select:none;cursor:default;contain:layout style paint;`;
    widget.innerHTML = `
      <div id="kmWorld" style="position:relative;height:252px;overflow:hidden;background:linear-gradient(180deg,#4f8ffc 0%,#78b3ff 58%,#a9d5ff 100%);">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.20),transparent 38%,rgba(0,0,0,.08));pointer-events:none;"></div>
        <div style="position:absolute;top:10px;left:28px;width:3px;height:3px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite 0s;"></div>
        <div style="position:absolute;top:17px;left:88px;width:2px;height:2px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite .8s;"></div>
        <div style="position:absolute;top:9px;left:210px;width:3px;height:3px;border-radius:50%;background:#fff;animation:km-twinkle 2s ease-in-out infinite 1.4s;"></div>
        <div style="position:absolute;top:16px;right:22px;width:54px;height:54px;border-radius:50%;background:#ffd700;border:4px solid #fff;box-shadow:0 0 0 3px #e8a000,0 8px 22px rgba(255,200,0,.55);"></div>
        <svg style="position:absolute;top:18px;left:12px;animation:km-cloud 7s ease-in-out infinite alternate;" width="90" height="46" viewBox="0 0 90 46"><ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/><ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/><ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/><ellipse cx="40" cy="24" rx="18" ry="17" fill="white"/></svg>
        <svg style="position:absolute;top:26px;left:174px;animation:km-cloud 8s ease-in-out infinite alternate-reverse;" width="66" height="36" viewBox="0 0 66 36"><ellipse cx="33" cy="28" rx="30" ry="13" fill="white"/><ellipse cx="20" cy="21" rx="16" ry="15" fill="white"/><ellipse cx="42" cy="20" rx="18" ry="16" fill="white"/></svg>
        <svg style="position:absolute;bottom:56px;left:0;right:0;width:100%;height:82px;" viewBox="0 0 374 82" preserveAspectRatio="none"><path d="M0 82 C45 26 86 36 120 82 Z" fill="#247a35"/><path d="M72 82 C132 16 202 28 248 82 Z" fill="#2f9a44"/><path d="M206 82 C262 24 326 30 374 82 Z" fill="#247a35"/><path d="M0 82 C55 42 96 48 138 82 Z" fill="#4caf50"/><path d="M180 82 C232 46 308 44 374 82 Z" fill="#43a047"/></svg>
        <div style="position:absolute;bottom:56px;left:0;right:0;height:22px;background:linear-gradient(180deg,#54c759,#2f9a44);border-top:3px solid rgba(255,255,255,.75);"></div>
        <svg style="position:absolute;bottom:0;left:0;" width="374" height="56" viewBox="0 0 374 56"><defs><pattern id="kmBrick" x="0" y="0" width="36" height="18" patternUnits="userSpaceOnUse"><rect width="36" height="18" fill="#c8860a"/><rect x="0" y="0" width="35" height="8" fill="#d4920e"/><rect x="0" y="10" width="17" height="8" fill="#d4920e"/><rect x="19" y="10" width="17" height="8" fill="#d4920e"/><rect x="0" y="8" width="36" height="2" fill="#7a5000"/><rect x="18" y="0" width="2" height="8" fill="#7a5000"/><rect x="18" y="10" width="2" height="8" fill="#7a5000"/></pattern></defs><rect x="0" y="0" width="374" height="14" fill="#4caf50"/><rect x="0" y="2" width="374" height="5" fill="#66bb6a"/><rect x="0" y="12" width="374" height="2" fill="#2e7d32"/><rect x="0" y="14" width="374" height="42" fill="url(#kmBrick)"/></svg>
        <div style="position:absolute;bottom:112px;left:196px;width:72px;height:18px;border-radius:4px;background:#c84b0c;border:3px solid #fff;box-shadow:0 4px 0 #8b2e00,inset 0 3px 0 rgba(255,255,255,.18);"></div>
        <div style="position:absolute;bottom:132px;left:100px;width:56px;height:18px;border-radius:4px;background:#c84b0c;border:3px solid #fff;box-shadow:0 4px 0 #8b2e00,inset 0 3px 0 rgba(255,255,255,.18);"></div>
        <div style="position:absolute;bottom:158px;left:104px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:7px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.3);animation:km-qbob 2s ease-in-out infinite;">?</div>
        <div style="position:absolute;bottom:174px;left:206px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:7px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.3);animation:km-qbob 2.1s ease-in-out infinite .7s;">?</div>
        <div style="position:absolute;bottom:159px;left:244px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:7px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.3);animation:km-qbob 1.9s ease-in-out infinite 1.4s;">?</div>
        <div style="position:absolute;bottom:56px;left:16px;display:flex;flex-direction:column;align-items:center;">
          <div style="width:46px;height:14px;background:#4caf50;border:3px solid #fff;border-radius:4px 4px 0 0;box-shadow:0 0 0 2px #2e7d32,inset 0 3px 0 rgba(255,255,255,.25);"></div>
          <div style="width:36px;height:30px;background:#43a047;border:3px solid #fff;border-top:none;box-shadow:0 0 0 2px #2e7d32;"></div>
        </div>
        <div style="position:absolute;bottom:56px;right:0;width:86px;height:88px;pointer-events:none;">
          <div style="position:absolute;right:4px;bottom:0;width:58px;height:58px;background:#6b3410;border:3px solid #fff;border-radius:8px 8px 0 0;box-shadow:0 4px 0 #2a1500,inset 0 5px 0 rgba(255,255,255,.12);"></div>
          <div style="position:absolute;right:9px;bottom:44px;width:48px;height:22px;background:#4b2500;border:3px solid #fff;border-radius:8px 8px 0 0;"></div>
          <div style="position:absolute;right:20px;bottom:63px;width:24px;height:18px;background:#4b2500;border:3px solid #fff;border-bottom:none;border-radius:7px 7px 0 0;"></div>
          <div style="position:absolute;right:21px;bottom:20px;width:20px;height:30px;background:#1b0f08;border:2px solid rgba(255,255,255,.7);border-radius:12px 12px 0 0;"></div>
          <div style="position:absolute;right:18px;bottom:39px;width:22px;height:22px;border-radius:50%;background:#ffd700;filter:blur(9px);animation:km-castle-glow 2s ease-in-out infinite;"></div>
        </div>
        <canvas id="kmBowser" width="64" height="64" style="position:absolute;bottom:56px;right:48px;image-rendering:pixelated;animation:km-bowser-breathe 1.8s ease-in-out infinite;"></canvas>
        <canvas id="kmPeachSprite" width="32" height="52" style="position:absolute;bottom:56px;right:8px;image-rendering:pixelated;animation:km-peach-wave 1.4s ease-in-out infinite;"></canvas>
        <canvas id="kmLuigi" width="40" height="52" style="position:absolute;bottom:56px;left:66px;image-rendering:pixelated;animation:km-luigi-idle 1.6s ease-in-out infinite;"></canvas>
        <canvas id="kmMario" width="40" height="52" style="position:absolute;bottom:56px;image-rendering:pixelated;animation:km-mrun 8s linear infinite;"></canvas>
        <canvas id="kmGoomba" width="36" height="36" style="position:absolute;bottom:56px;image-rendering:pixelated;animation:km-gwalk 6s linear infinite;"></canvas>
        <div style="position:absolute;top:12px;left:12px;right:12px;background:rgba(255,255,255,.25);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:3px solid rgba(255,255,255,.92);border-radius:20px;padding:12px 14px 11px;box-shadow:inset 0 2px 0 rgba(255,255,255,1),0 8px 32px rgba(0,80,200,.16);overflow:hidden;">
          <div style="position:absolute;top:-20px;left:-70px;width:80px;height:170px;background:rgba(255,255,255,.28);animation:km-shine 5s linear infinite;pointer-events:none;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;position:relative;z-index:2;">
            <div>
              <div style="font-size:13px;font-weight:900;letter-spacing:.06em;color:#1a237e;text-shadow:0 1px 0 rgba(255,255,255,.65);">Grind Tracker</div>
              <div style="font-size:9px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:rgba(26,35,126,.52);margin-top:1px;">World 8-1 • Eternal Session</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:5px;background:#22c55e;border:2.5px solid #fff;border-radius:50px;padding:4px 11px;box-shadow:0 3px 0 #14532d;">
                <div style="width:7px;height:7px;border-radius:50%;background:#fff;animation:km-ld 1.5s ease-in-out infinite;"></div>
                <span style="font-size:9px;font-weight:900;color:#fff;letter-spacing:.1em;">LIVE</span>
              </div>
              <button id="kmMinBtn" style="width:27px;height:27px;border-radius:50%;background:#fff;border:2.5px solid rgba(255,255,255,.85);box-shadow:0 3px 0 rgba(0,0,0,.18);color:#1a237e;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:900;">−</button>
            </div>
          </div>
          <div style="display:flex;align-items:flex-end;justify-content:center;gap:2px;position:relative;z-index:2;margin-bottom:4px;">
            <span id="kmHours" style="font-size:62px;line-height:.88;font-weight:900;color:#1a237e;text-shadow:3px 3px 0 rgba(255,255,255,.75),-1px -1px 0 rgba(255,255,255,.55);letter-spacing:-2px;">0</span>
            <span style="font-size:16px;font-weight:900;color:rgba(26,35,126,.52);margin-bottom:8px;margin-left:1px;margin-right:4px;">h</span>
            <span id="kmMins" style="font-size:62px;line-height:.88;font-weight:900;color:#1a237e;text-shadow:3px 3px 0 rgba(255,255,255,.75),-1px -1px 0 rgba(255,255,255,.55);letter-spacing:-2px;">00</span>
            <span style="font-size:16px;font-weight:900;color:rgba(26,35,126,.52);margin-bottom:8px;margin-left:1px;">m</span>
          </div>
          <div style="height:12px;border-radius:999px;background:rgba(26,35,126,.16);border:2px solid rgba(255,255,255,.7);overflow:hidden;margin:3px 3px 6px;position:relative;z-index:2;">
            <div id="kmProgress" style="height:100%;width:0%;border-radius:999px;background:repeating-linear-gradient(45deg,#ffd600 0,#ffd600 8px,#f9a825 8px,#f9a825 16px);box-shadow:inset 0 2px 0 rgba(255,255,255,.55);animation:km-progress-stripe 1.4s linear infinite;"></div>
          </div>
          <div id="kmVibe" style="font-size:10px;font-weight:800;font-style:italic;color:rgba(26,35,126,.58);text-align:center;position:relative;z-index:2;">"kaam shuru kar… the grind demands tribute."</div>
        </div>
      </div>
      <div style="height:24px;background:repeating-linear-gradient(90deg,#c84b0c 0,#c84b0c 30px,#a33800 30px,#a33800 32px);border-top:3px solid #fff;border-bottom:2px solid #8b2e00;"></div>
      <div id="kmPanel" style="background:linear-gradient(180deg,#ef3033 0%,#d71920 100%);padding:14px 14px 12px;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 10% 0%,rgba(255,255,255,.18),transparent 28%),radial-gradient(circle at 90% 20%,rgba(255,214,0,.18),transparent 28%);pointer-events:none;"></div>
        <div style="position:relative;z-index:1;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <span style="font-size:9px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.68);">Coins to Freedom</span>
            <span id="kmPct" style="font-size:13px;font-weight:900;color:#ffe566;text-shadow:1px 1px 0 rgba(0,0,0,.3);">0%</span>
          </div>
          <div id="kmCoins" style="display:flex;gap:3px;flex-wrap:nowrap;"></div>
          <div style="font-size:8px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.46);margin-top:7px;">100% coins = flagpole clear + castle victory</div>
        </div>
        <div style="position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
          ${marioStatCard('Worked','kmWorked','#1565c0','#0d47a1','#fff')}
          ${marioStatCard('Baaki','kmLeft','#e65100','#bf360c','#ffe566')}
          ${marioStatCard('Break','kmBreak','#2e7d32','#1b5e20','#fff')}
        </div>
        <div style="position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:11px;">
          <div style="border-radius:17px;padding:10px 12px;background:#f9a825;border:3px solid rgba(255,255,255,.55);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.35);">
            <div style="font-size:8px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:rgba(100,50,0,.72);margin-bottom:5px;">☀️ Half Day</div>
            <div id="kmHalf" style="font-size:18px;font-weight:900;color:#5d2e00;line-height:1;">--:--</div>
          </div>
          <div style="border-radius:17px;padding:10px 12px;background:#1e88e5;border:3px solid rgba(255,255,255,.55);position:relative;overflow:hidden;box-shadow:0 5px 0 rgba(0,0,0,.2),inset 0 2px 0 rgba(255,255,255,.35);">
            <div style="font-size:8px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.68);margin-bottom:5px;">🚪 Majdoori Khatam</div>
            <div id="kmFull" style="font-size:18px;font-weight:900;color:#fff;line-height:1;">--:--</div>
          </div>
        </div>
        <div style="position:relative;z-index:1;background:rgba(0,0,0,.22);border-radius:10px;padding:7px 10px;overflow:hidden;border:1px solid rgba(255,255,255,.12);">
          <span id="kmTicker" style="display:inline-block;white-space:nowrap;font-size:8px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.52);animation:km-ticker 28s linear infinite;">CHAI PIVI CHE KE NHI ★ BOSS NE KHABAR NATHI ★ GHAR JA BHAI ★ SURAT NO SHER ★ KEKA BAND KAR ★ PAKODA TIME ★ FINAL CASTLE AAVI GAYU ★ CHAI PIVI CHE KE NHI ★</span>
        </div>
      </div>`;
    document.body.appendChild(widget);
    refs = {
      widget,
      hours: widget.querySelector('#kmHours'), mins: widget.querySelector('#kmMins'),
      worked: widget.querySelector('#kmWorked'), left: widget.querySelector('#kmLeft'),
      breakEl: widget.querySelector('#kmBreak'), pct: widget.querySelector('#kmPct'),
      progress: widget.querySelector('#kmProgress'), vibe: widget.querySelector('#kmVibe'),
      half: widget.querySelector('#kmHalf'), full: widget.querySelector('#kmFull'),
      coins: widget.querySelector('#kmCoins'), world: widget.querySelector('#kmWorld'),
      panel: widget.querySelector('#kmPanel'), minBtn: widget.querySelector('#kmMinBtn'),
    };
    let minimized = false;
    refs.minBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      minimized = !minimized;
      refs.panel.style.display = minimized ? 'none' : 'block';
      refs.world.style.height  = minimized ? '62px' : '252px';
      refs.minBtn.textContent  = minimized ? '+' : '−';
      if (minimized) pauseSprites(); else resumeSprites();
    });
    buildMarioCoins(0);
    startMarioSprites();
  }

  function buildMarioCoins(pct) {
    const TOTAL = 17;
    const lit   = Math.round((pct / 100) * TOTAL);
    if (lit === prevLitCoins) return;
    prevLitCoins = lit;
    const wrap = refs.coins;
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const c = document.createElement('div');
      const on = i < lit;
      c.style.cssText = on
        ? `width:18px;height:18px;border-radius:50%;flex-shrink:0;position:relative;background:radial-gradient(circle at 35% 28%,#fffde7,#ffd600 38%,#c67c00 72%,#7a4500 100%);border:2.5px solid #fff;box-shadow:0 3px 0 rgba(0,0,0,.25),inset 0 1px 2px rgba(255,255,255,.5);animation:km-coin-pop 2.4s ease-in-out infinite ${i*.06}s;`
        : `width:18px;height:18px;border-radius:50%;flex-shrink:0;position:relative;background:rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.22);box-shadow:inset 0 2px 4px rgba(0,0,0,.12);`;
      if (on) {
        const shine = document.createElement('div');
        shine.style.cssText = 'position:absolute;top:2px;left:3px;width:5px;height:4px;background:rgba(255,255,255,.65);border-radius:50%;';
        c.appendChild(shine);
      }
      wrap.appendChild(c);
    }
  }

  let spritePaused = false;
  function spriteLoop(now) {
    if (spritePaused) return;
    rafHandle = requestAnimationFrame(spriteLoop);
    if (now - lastFrameTime < FRAME_DELAY) return;
    lastFrameTime = now;
    spriteFrame++;
    if (refs._mCtx) drawMarioFrame(refs._mCtx, spriteFrame, false);
    if (refs._gCtx) drawGoombaFrame(refs._gCtx, spriteFrame);
    if (refs._lCtx) drawMarioFrame(refs._lCtx, spriteFrame, true);
    if (spriteFrame % 4 === 0) {
      if (refs._pCtx) drawPeachFrame(refs._pCtx);
      if (refs._bCtx) drawBowserFrame(refs._bCtx);
    }
  }

  function startMarioSprites() {
    const mc = document.getElementById('kmMario');
    const gc = document.getElementById('kmGoomba');
    const lc = document.getElementById('kmLuigi');
    const pc = document.getElementById('kmPeachSprite');
    const bc = document.getElementById('kmBowser');
    if (!mc || !gc || !lc || !pc || !bc) return;
    refs._mCtx = mc.getContext('2d');
    refs._gCtx = gc.getContext('2d');
    refs._lCtx = lc.getContext('2d');
    refs._pCtx = pc.getContext('2d');
    refs._bCtx = bc.getContext('2d');
    drawMarioFrame(refs._mCtx, 0, false);
    drawGoombaFrame(refs._gCtx, 0);
    drawMarioFrame(refs._lCtx, 0, true);
    drawPeachFrame(refs._pCtx);
    drawBowserFrame(refs._bCtx);
    spritePaused = false;
    rafHandle = requestAnimationFrame(spriteLoop);
  }

  function pauseSprites() {
    spritePaused = true;
    if (rafHandle) { cancelAnimationFrame(rafHandle); rafHandle = null; }
  }
  function resumeSprites() {
    if (spritePaused) { spritePaused = false; rafHandle = requestAnimationFrame(spriteLoop); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseSprites(); else resumeSprites();
  });

  function updateMarioUI(data, total, breaks, left, pct, h, mStr) {
    setIfChanged(refs.hours,  String(h));
    setIfChanged(refs.mins,   mStr);
    setIfChanged(refs.worked, `${h}h ${mStr}m`);
    setIfChanged(refs.left,   `${Math.floor(left/60)}h ${String(left%60).padStart(2,'0')}m`);
    setIfChanged(refs.breakEl,`${Math.floor(breaks/60)}h ${String(breaks%60).padStart(2,'0')}m`);
    setIfChanged(refs.pct,    `${pct}%`);
    if (refs.progress && refs.progress.style.width !== `${pct}%`) refs.progress.style.width = `${pct}%`;
    setIfChanged(refs.vibe, getVibeMario(pct));
    buildMarioCoins(pct);
    if (data.firstStart) {
      const s = parseTimeToMinutes(data.firstStart);
      if (s !== null) {
        const base = new Date();
        base.setHours(Math.floor(s / 60), s % 60, 0, 0);
        const half = new Date(base.getTime() + (HALF_DAY_MINUTES + breaks) * 60000);
        const full = new Date(base.getTime() + (WORK_MINUTES     + breaks) * 60000);
        setIfChanged(refs.half, fmtTime(half));
        setIfChanged(refs.full, fmtTime(full));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ SPIDER-MAN THEME ███
  // ═══════════════════════════════════════════════════════════════════════════════

  function injectSpiderStyles() {
    if (document.getElementById('kekaSpiderStyles')) return;
    const style = document.createElement('style');
    style.id = 'kekaSpiderStyles';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
      #kekaSpider * { box-sizing:border-box; margin:0; padding:0; }
      @keyframes sp-slidein { from{transform:translateX(120%) scale(.96);opacity:0;} to{transform:translateX(0) scale(1);opacity:1;} }
      @keyframes sp-ring-spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
      @keyframes sp-ring-spin-rev { from{transform:rotate(0deg);} to{transform:rotate(-360deg);} }
      @keyframes sp-pulse { 0%,100%{opacity:.7;transform:scale(1);} 50%{opacity:1;transform:scale(1.04);} }
      @keyframes sp-glow-pulse { 0%,100%{box-shadow:0 0 0 2px rgba(220,38,38,.3),0 0 28px rgba(220,38,38,.15),0 24px 60px rgba(0,0,0,.8);} 50%{box-shadow:0 0 0 2px rgba(220,38,38,.7),0 0 48px rgba(220,38,38,.35),0 24px 80px rgba(0,0,0,.85);} }
      @keyframes sp-warn-glow { 0%,100%{box-shadow:0 0 0 2px rgba(251,191,36,.4),0 0 32px rgba(251,191,36,.2),0 24px 60px rgba(0,0,0,.8);} 50%{box-shadow:0 0 0 2px rgba(251,191,36,.9),0 0 60px rgba(251,191,36,.4),0 24px 80px rgba(0,0,0,.85);} }
      @keyframes sp-victory-glow { 0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,.5),0 0 40px rgba(34,197,94,.3),0 24px 70px rgba(0,0,0,.8);} 50%{box-shadow:0 0 0 2px rgba(34,197,94,1),0 0 70px rgba(34,197,94,.55),0 24px 90px rgba(0,0,0,.85);} }
      @keyframes sp-web-rotate { from{transform:rotate(0deg) scale(1.05);} to{transform:rotate(360deg) scale(1.05);} }
      @keyframes sp-particle { 0%{transform:translateY(0) translateX(0) scale(1);opacity:.8;} 100%{transform:translateY(-40px) translateX(var(--dx)) scale(0);opacity:0;} }
      @keyframes sp-rain { 0%{transform:translateY(-20px);opacity:0;} 10%{opacity:.4;} 90%{opacity:.2;} 100%{transform:translateY(280px);opacity:0;} }
      @keyframes sp-ticker { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
      @keyframes sp-ld { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.3;transform:scale(.7);} }
      @keyframes sp-shimmer { 0%{transform:translateX(-180%) rotate(20deg);} 100%{transform:translateX(220%) rotate(20deg);} }
      @keyframes sp-float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
      @keyframes sp-scan { 0%{top:-2px;opacity:0;} 10%{opacity:.6;} 90%{opacity:.4;} 100%{top:100%;opacity:0;} }
      @keyframes sp-hero-pop { 0%{transform:scale(.88) translateY(20px);opacity:0;} 60%{transform:scale(1.03) translateY(-3px);opacity:1;} 100%{transform:scale(1) translateY(0);opacity:1;} }
    `;
    document.head.appendChild(style);
  }

  function createSpiderUI() {
    injectSpiderStyles();
    if (document.getElementById('kekaSpider')) return;

    const widget = document.createElement('div');
    widget.id = 'kekaSpider';
    widget.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:2147483646;width:360px;
      border-radius:20px;overflow:hidden;
      background:linear-gradient(160deg,#0a0a14 0%,#0f0f1e 40%,#120810 100%);
      border:1px solid rgba(220,38,38,.25);
      box-shadow:0 0 0 1px rgba(220,38,38,.12),0 0 28px rgba(220,38,38,.15),0 24px 60px rgba(0,0,0,.85);
      animation:sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards, sp-glow-pulse 4s ease-in-out infinite 1s;
      will-change:box-shadow;transform:translateZ(0);user-select:none;cursor:default;contain:layout style paint;
    `;

    // ── SVG Web overlay (background) ──
    const webSVG = `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.045;pointer-events:none;" viewBox="0 0 360 600" xmlns="http://www.w3.org/2000/svg">
      <g stroke="#cc2222" stroke-width=".6" fill="none">
        <circle cx="180" cy="0" r="40"/><circle cx="180" cy="0" r="80"/><circle cx="180" cy="0" r="120"/>
        <circle cx="180" cy="0" r="160"/><circle cx="180" cy="0" r="200"/><circle cx="180" cy="0" r="240"/>
        <line x1="180" y1="0" x2="0"   y2="600"/><line x1="180" y1="0" x2="60"  y2="600"/>
        <line x1="180" y1="0" x2="120" y2="600"/><line x1="180" y1="0" x2="180" y2="600"/>
        <line x1="180" y1="0" x2="240" y2="600"/><line x1="180" y1="0" x2="300" y2="600"/>
        <line x1="180" y1="0" x2="360" y2="600"/>
      </g>
    </svg>`;

    // ── Rain particles ──
    let rainHTML = '';
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 360;
      const dur = (1.8 + Math.random() * 2.4).toFixed(1);
      const delay = (Math.random() * 3).toFixed(1);
      rainHTML += `<div style="position:absolute;left:${x}px;top:0;width:1px;height:${14+Math.random()*14|0}px;background:linear-gradient(180deg,transparent,rgba(96,165,250,.28),transparent);animation:sp-rain ${dur}s linear ${delay}s infinite;pointer-events:none;"></div>`;
    }

    widget.innerHTML = `
      ${webSVG}
      <div id="spRainLayer" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">${rainHTML}</div>

      <!-- ── TOP HUD STRIP ── -->
      <div style="position:relative;padding:12px 16px 10px;border-bottom:1px solid rgba(220,38,38,.18);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#ef4444;letter-spacing:.22em;text-transform:uppercase;">Spider-Web</div>
          <div style="font-family:'Rajdhani',sans-serif;font-size:9px;font-weight:600;color:rgba(148,163,184,.55);letter-spacing:.18em;text-transform:uppercase;margin-top:1px;">Multiverse Work Console</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:5px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:30px;padding:4px 10px;">
            <div style="width:6px;height:6px;border-radius:50%;background:#22c55e;animation:sp-ld 1.4s ease-in-out infinite;"></div>
            <span style="font-family:'Orbitron',monospace;font-size:7px;font-weight:700;color:#22c55e;letter-spacing:.14em;">ACTIVE</span>
          </div>
          <button id="spMinBtn" style="width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(148,163,184,.7);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;">−</button>
        </div>
      </div>

      <!-- ── REACTOR RING SECTION ── -->
      <div id="spWorld" style="position:relative;padding:22px 16px 16px;display:flex;flex-direction:column;align-items:center;">
        <!-- Ambient glow behind ring -->
        <div style="position:absolute;top:30px;left:50%;transform:translateX(-50%);width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,rgba(220,38,38,.12) 0%,transparent 70%);pointer-events:none;"></div>

        <!-- Ring container -->
        <div style="position:relative;width:176px;height:176px;margin-bottom:16px;">
          <!-- Outer decorative ring (slow spin) -->
          <svg id="spOuterRing" viewBox="0 0 176 176" width="176" height="176" style="position:absolute;inset:0;animation:sp-ring-spin 18s linear infinite;will-change:transform;">
            <circle cx="88" cy="88" r="84" fill="none" stroke="rgba(220,38,38,.15)" stroke-width="1" stroke-dasharray="4 6"/>
          </svg>
          <!-- Middle ring (counter spin) -->
          <svg id="spMidRing" viewBox="0 0 176 176" width="176" height="176" style="position:absolute;inset:0;animation:sp-ring-spin-rev 10s linear infinite;will-change:transform;">
            <circle cx="88" cy="88" r="76" fill="none" stroke="rgba(96,165,250,.12)" stroke-width="1" stroke-dasharray="2 10"/>
          </svg>
          <!-- Progress arc canvas -->
          <canvas id="spArcCanvas" width="176" height="176" style="position:absolute;inset:0;"></canvas>
          <!-- Inner glow circle -->
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:116px;height:116px;border-radius:50%;background:radial-gradient(circle,rgba(10,10,25,.95) 62%,rgba(220,38,38,.06) 100%);border:1px solid rgba(220,38,38,.18);"></div>
          <!-- Center time display -->
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;width:110px;">
            <div style="display:flex;align-items:baseline;justify-content:center;gap:2px;">
              <span id="spHours" style="font-family:'Orbitron',monospace;font-size:34px;font-weight:900;color:#f1f5f9;line-height:1;letter-spacing:-1px;">0</span>
              <span style="font-family:'Orbitron',monospace;font-size:11px;color:rgba(148,163,184,.5);margin-bottom:2px;">h</span>
              <span id="spMins" style="font-family:'Orbitron',monospace;font-size:34px;font-weight:900;color:#f1f5f9;line-height:1;letter-spacing:-1px;">00</span>
              <span style="font-family:'Orbitron',monospace;font-size:11px;color:rgba(148,163,184,.5);margin-bottom:2px;">m</span>
            </div>
            <div id="spPct" style="font-family:'Orbitron',monospace;font-size:12px;font-weight:700;color:#ef4444;letter-spacing:.1em;margin-top:2px;">0%</div>
            <div id="spMode" style="font-family:'Rajdhani',sans-serif;font-size:8px;font-weight:600;color:rgba(148,163,184,.45);letter-spacing:.15em;text-transform:uppercase;margin-top:2px;">Friendly Mode</div>
          </div>
        </div>

        <!-- Vibe text -->
        <div id="spVibe" style="font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:600;color:rgba(148,163,184,.48);text-align:center;letter-spacing:.08em;font-style:italic;padding:0 12px;margin-bottom:4px;">Activating Spider-Sense… tracking your session.</div>
      </div>

      <!-- ── STATS PANEL ── -->
      <div id="spPanel" style="padding:0 16px 14px;position:relative;">
        <!-- scan line effect -->
        <div style="position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(220,38,38,.3),transparent);animation:sp-scan 4s linear infinite;pointer-events:none;"></div>

        <!-- 3-stat row -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(220,38,38,.18);border-radius:12px;padding:9px 8px;text-align:center;position:relative;overflow:hidden;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.2em;color:rgba(148,163,184,.45);text-transform:uppercase;margin-bottom:4px;">Worked</div>
            <div id="spWorked" style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#60a5fa;line-height:1.2;">--</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(239,68,68,.25);border-radius:12px;padding:9px 8px;text-align:center;position:relative;overflow:hidden;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.2em;color:rgba(148,163,184,.45);text-transform:uppercase;margin-bottom:4px;">Remaining</div>
            <div id="spLeft" style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#ef4444;line-height:1.2;">--</div>
          </div>
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(96,165,250,.15);border-radius:12px;padding:9px 8px;text-align:center;position:relative;overflow:hidden;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.2em;color:rgba(148,163,184,.45);text-transform:uppercase;margin-bottom:4px;">Break</div>
            <div id="spBreak" style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#94a3b8;line-height:1.2;">--</div>
          </div>
        </div>

        <!-- Half day / Full day row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.2);border-radius:12px;padding:9px 12px;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.2em;color:rgba(251,191,36,.55);text-transform:uppercase;margin-bottom:3px;">Half Day Exit</div>
            <div id="spHalf" style="font-family:'Orbitron',monospace;font-size:15px;font-weight:700;color:#fbbf24;line-height:1;">--:--</div>
          </div>
          <div style="background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.22);border-radius:12px;padding:9px 12px;">
            <div style="font-family:'Rajdhani',sans-serif;font-size:7.5px;font-weight:700;letter-spacing:.2em;color:rgba(34,197,94,.55);text-transform:uppercase;margin-bottom:3px;">Mission Clear</div>
            <div id="spFull" style="font-family:'Orbitron',monospace;font-size:15px;font-weight:700;color:#22c55e;line-height:1;">--:--</div>
          </div>
        </div>

        <!-- Ticker -->
        <div style="background:rgba(0,0,0,.35);border-radius:8px;padding:6px 10px;overflow:hidden;border:1px solid rgba(255,255,255,.05);">
          <span id="spTicker" style="display:inline-block;white-space:nowrap;font-family:'Orbitron',monospace;font-size:7px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(148,163,184,.35);animation:sp-ticker 32s linear infinite;">WEB-SLINGER MODE ACTIVE ⬡ MULTIVERSE STABLE ⬡ SPIDER-SENSE ONLINE ⬡ KEKA PROTOCOL ENGAGED ⬡ SWING THROUGH THE GRIND ⬡ WEB-SLINGER MODE ACTIVE ⬡</span>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    refs = {
      widget,
      hours: widget.querySelector('#spHours'), mins: widget.querySelector('#spMins'),
      pct: widget.querySelector('#spPct'), mode: widget.querySelector('#spMode'),
      worked: widget.querySelector('#spWorked'), left: widget.querySelector('#spLeft'),
      breakEl: widget.querySelector('#spBreak'), vibe: widget.querySelector('#spVibe'),
      half: widget.querySelector('#spHalf'), full: widget.querySelector('#spFull'),
      world: widget.querySelector('#spWorld'), panel: widget.querySelector('#spPanel'),
      minBtn: widget.querySelector('#spMinBtn'),
      arcCanvas: widget.querySelector('#spArcCanvas'),
    };

    refs._arcPct = 0;
    drawSpiderArc(0);

    let minimized = false;
    refs.minBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      minimized = !minimized;
      refs.panel.style.display = minimized ? 'none' : 'block';
      refs.world.style.display = minimized ? 'none' : 'flex';
      refs.minBtn.textContent  = minimized ? '+' : '−';
    });
  }

  function drawSpiderArc(pct) {
    const canvas = refs.arcCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 176, H = 176, cx = W/2, cy = H/2, R = 70;
    ctx.clearRect(0, 0, W, H);

    // Track background
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Determine color by pct
    let color1, color2;
    if (pct >= 100) { color1 = '#22c55e'; color2 = '#4ade80'; }
    else if (pct >= 70) { color1 = '#ef4444'; color2 = '#fb923c'; }
    else if (pct >= 30) { color1 = '#3b82f6'; color2 = '#ef4444'; }
    else { color1 = '#60a5fa'; color2 = '#93c5fd'; }

    const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);

    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + (Math.PI * 2 * (pct / 100));

    ctx.beginPath();
    ctx.arc(cx, cy, R, startAngle, endAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glow dot at tip
    if (pct > 0 && pct < 100) {
      const tipX = cx + R * Math.cos(endAngle);
      const tipY = cy + R * Math.sin(endAngle);
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
      ctx.fillStyle = color2;
      ctx.fill();
      ctx.shadowBlur = 12;
      ctx.shadowColor = color2;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Tick marks
    for (let i = 0; i < 32; i++) {
      const a = (Math.PI * 2 * i / 32) - Math.PI / 2;
      const r1 = R + 11, r2 = R + (i % 8 === 0 ? 17 : 14);
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = i % 8 === 0 ? 'rgba(220,38,38,.45)' : 'rgba(255,255,255,.08)';
      ctx.lineWidth = i % 8 === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }
  }

  function updateSpiderUI(data, total, breaks, left, pct, h, mStr) {
    setIfChanged(refs.hours,  String(h));
    setIfChanged(refs.mins,   mStr);
    setIfChanged(refs.pct,    `${pct}%`);
    setIfChanged(refs.worked, `${h}h ${mStr}m`);
    setIfChanged(refs.left,   `${Math.floor(left/60)}h ${String(left%60).padStart(2,'0')}m`);
    setIfChanged(refs.breakEl,`${Math.floor(breaks/60)}h ${String(breaks%60).padStart(2,'0')}m`);
    setIfChanged(refs.vibe, getVibeSpider(pct));

    // Mode label
    let modeText = 'Friendly Mode';
    if (pct >= 100) modeText = 'Mission Complete';
    else if (pct >= 70) modeText = 'Multiverse Pressure';
    else if (pct >= 30) modeText = 'Spider Grind';
    setIfChanged(refs.mode, modeText);

    // Redraw arc only when pct changes
    if (refs._arcPct !== pct) {
      refs._arcPct = pct;
      drawSpiderArc(pct);
    }

    // Dynamic ring color tint on widget border
    if (refs.widget) {
      let borderCol;
      if (pct >= 100) borderCol = 'rgba(34,197,94,.5)';
      else if (pct >= 70) borderCol = 'rgba(239,68,68,.55)';
      else if (pct >= 30) borderCol = 'rgba(239,68,68,.35)';
      else borderCol = 'rgba(96,165,250,.3)';
      refs.widget.style.borderColor = borderCol;
    }

    if (data.firstStart) {
      const s = parseTimeToMinutes(data.firstStart);
      if (s !== null) {
        const base = new Date();
        base.setHours(Math.floor(s / 60), s % 60, 0, 0);
        const half = new Date(base.getTime() + (HALF_DAY_MINUTES + breaks) * 60000);
        const full = new Date(base.getTime() + (WORK_MINUTES     + breaks) * 60000);
        setIfChanged(refs.half, fmtTime(half));
        setIfChanged(refs.full, fmtTime(full));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ SHARED CELEBRATIONS ███
  // ═══════════════════════════════════════════════════════════════════════════════

  function launchConfetti() {
    const colors = THEME === 'spiderman'
      ? ['#dc2626','#2563eb','#1e3a5f','#60a5fa','#fff','#ef4444','#93c5fd']
      : ['#ffd700','#e8282b','#1565c0','#4caf50','#f9a825','#fff','#e53935'];
    let count = 0;
    confettiInterval = setInterval(() => {
      if (count++ > 80) { clearInterval(confettiInterval); confettiInterval = null; return; }
      const p = document.createElement('div');
      const size = Math.random() * 9 + 4;
      p.style.cssText = `position:fixed;top:-16px;z-index:2147483647;pointer-events:none;left:${Math.random()*100}vw;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation:km-confetti ${Math.random()*2.5+2}s linear ${Math.random()*.5}s forwards;`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5500);
    }, 80);
  }

  function showToast(emoji, line1, line2, color) {
    const t = document.createElement('div');
    const fontFam = THEME === 'spiderman' ? "'Orbitron',monospace" : "'Nunito',sans-serif";
    t.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(80px);z-index:2147483645;background:${THEME==='spiderman'?'rgba(10,10,20,.96)':'#fff'};border-radius:20px;border:2px solid ${color};box-shadow:0 0 0 1px rgba(0,0,0,.3),0 0 28px ${color}44,0 20px 60px rgba(0,0,0,.4);padding:16px 28px;text-align:center;font-family:${fontFam};transition:transform .45s cubic-bezier(.34,1.5,.64,1),opacity .45s;opacity:0;min-width:240px;pointer-events:none;`;
    t.innerHTML = `<div style="font-size:28px;margin-bottom:7px;">${emoji}</div><div style="font-size:13px;font-weight:700;color:${color};letter-spacing:.1em;">${line1}</div><div style="font-size:11px;font-weight:600;font-style:italic;color:rgba(148,163,184,.6);margin-top:4px;">${line2}</div>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.transform='translateX(-50%) translateY(0)'; t.style.opacity='1'; });
    setTimeout(() => {
      t.style.transform='translateX(-50%) translateY(80px)'; t.style.opacity='0';
      setTimeout(() => t.remove(), 500);
    }, 5000);
  }

  function launchSpiderVictoryOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:2147483644;background:rgba(0,0,0,0);pointer-events:none;transition:background .6s ease;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;overflow:hidden;`;
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,rgba(220,38,38,.22) 0%,transparent 55%),linear-gradient(180deg,rgba(10,10,24,.94),rgba(5,5,14,.98));"></div>
      <div style="position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(220,38,38,.4) 2px,rgba(220,38,38,.4) 3px);pointer-events:none;"></div>
      <div style="position:relative;width:min(560px,calc(100vw - 32px));animation:sp-hero-pop .8s cubic-bezier(.34,1.4,.64,1) forwards;">
        <div style="border:1px solid rgba(220,38,38,.5);border-radius:20px;padding:32px 28px;background:rgba(10,10,20,.9);backdrop-filter:blur(32px);text-align:center;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-40px;left:-80px;width:100px;height:300px;background:rgba(255,255,255,.04);transform:rotate(22deg);animation:sp-shimmer 3s ease-in-out infinite;pointer-events:none;"></div>
          <div style="font-size:9px;letter-spacing:.4em;color:rgba(220,38,38,.6);margin-bottom:12px;text-transform:uppercase;">— Mission Complete —</div>
          <div style="font-size:48px;font-weight:900;color:#f1f5f9;letter-spacing:-2px;line-height:1;text-shadow:0 0 40px rgba(220,38,38,.4);margin-bottom:8px;">8 HOURS<br><span style="color:#ef4444;">CLEARED</span></div>
          <div style="font-size:11px;letter-spacing:.2em;color:rgba(148,163,184,.5);margin-bottom:24px;text-transform:uppercase;">Multiverse Stability Achieved</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 auto 20px;max-width:400px;">
            <div style="background:rgba(220,38,38,.1);border:1px solid rgba(220,38,38,.25);border-radius:12px;padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">🕸️</div>
              <div style="font-size:7px;letter-spacing:.18em;color:rgba(148,163,184,.5);">WEBS SPUN</div>
              <div style="font-size:14px;font-weight:700;color:#ef4444;margin-top:2px;">MAX</div>
            </div>
            <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.22);border-radius:12px;padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">🏙️</div>
              <div style="font-size:7px;letter-spacing:.18em;color:rgba(148,163,184,.5);">CITY SAFE</div>
              <div style="font-size:14px;font-weight:700;color:#22c55e;margin-top:2px;">YES</div>
            </div>
            <div style="background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.2);border-radius:12px;padding:12px 8px;">
              <div style="font-size:18px;margin-bottom:4px;">⚡</div>
              <div style="font-size:7px;letter-spacing:.18em;color:rgba(148,163,184,.5);">POWER</div>
              <div style="font-size:14px;font-weight:700;color:#60a5fa;margin-top:2px;">FULL</div>
            </div>
          </div>
          <div style="font-size:10px;font-style:italic;color:rgba(148,163,184,.4);letter-spacing:.08em;">With great work comes great exit time.</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.background = 'rgba(0,0,0,.65)'; });
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .7s ease';
      setTimeout(() => overlay.remove(), 800);
    }, 8500);
  }

  function launchMarioVictoryOverlay() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:2147483644;background:rgba(6,20,45,0);pointer-events:none;transition:background .6s ease;display:flex;align-items:center;justify-content:center;font-family:'Nunito',sans-serif;overflow:hidden;`;
    overlay.innerHTML = `
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 18%,rgba(255,214,0,.34),transparent 22%),radial-gradient(circle at 82% 22%,rgba(34,197,94,.26),transparent 24%),radial-gradient(circle at 50% 90%,rgba(232,40,43,.28),transparent 28%),linear-gradient(180deg,rgba(79,143,252,.75),rgba(9,20,46,.88));opacity:.95;"></div>
      <div style="position:absolute;bottom:0;left:0;right:0;height:96px;background:linear-gradient(180deg,#54c759 0,#2f9a44 24px,#c8860a 24px,#c8860a 100%);border-top:5px solid #fff;"></div>
      <div style="position:absolute;top:9%;left:9%;font-size:38px;animation:km-star-spin 3s linear infinite;">⭐</div>
      <div style="position:absolute;top:14%;right:12%;font-size:34px;animation:km-star-spin 3.4s linear infinite reverse;">⭐</div>
      <div style="position:relative;width:min(620px,calc(100vw - 34px));border-radius:34px;padding:8px;background:linear-gradient(135deg,#ffd700,#ff4d4d,#4f8ffc,#22c55e,#ffd700);background-size:300% 300%;animation:km-victory-rainbow 4s ease infinite,km-victory-pop .75s cubic-bezier(.34,1.5,.64,1) forwards;box-shadow:0 0 0 5px rgba(255,255,255,.95),0 26px 90px rgba(0,0,0,.48);">
        <div style="border-radius:27px;padding:28px 26px 24px;background:rgba(255,255,255,.92);border:4px solid rgba(255,255,255,.95);text-align:center;">
          <div style="font-size:48px;font-weight:900;color:#1a237e;text-shadow:3px 3px 0 #fff;letter-spacing:-1px;margin-bottom:12px;">8 HOURS<br>ACHIEVED</div>
          <div style="display:inline-flex;gap:8px;align-items:center;background:#1a237e;color:#fff;font-size:13px;font-weight:900;padding:9px 15px;border-radius:999px;box-shadow:0 5px 0 rgba(0,0,0,.25);margin-bottom:14px;"><span>🚪</span><span>Majdoori khatam. Ghar ja bhai.</span></div>
          <div style="font-size:12px;font-weight:800;font-style:italic;color:rgba(26,35,126,.5);">"nikal gayo bhai… the realm is yours."</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.background = 'rgba(6,20,45,.42)'; });
    setTimeout(() => {
      overlay.style.background = 'rgba(6,20,45,0)';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity .7s ease,background .7s ease';
      setTimeout(() => overlay.remove(), 800);
    }, 8500);
  }

  function flashTitle() {
    const msg = THEME === 'spiderman' ? '🕷️ MISSION COMPLETE!' : '🏆 8 HOURS DONE!';
    let flip = false;
    titleFlashInterval = setInterval(() => {
      document.title = (flip = !flip) ? msg : originalTitle;
    }, 900);
    setTimeout(() => { clearInterval(titleFlashInterval); document.title = originalTitle; }, 12000);
  }

  function celebrateEightHours() {
    if (eightHourTriggered) return;
    eightHourTriggered = true;
    if (THEME === 'spiderman') {
      if (refs.widget) refs.widget.style.animation = 'sp-victory-glow 1.5s ease-in-out infinite';
      launchConfetti();
      launchSpiderVictoryOverlay();
      flashTitle();
      showToast('🕷️', 'MISSION COMPLETE', 'With great work comes great exit time.', '#22c55e');
    } else {
      if (refs.widget) refs.widget.style.animation = 'km-victory 1.5s ease-in-out infinite,km-soft-glow 3s ease-in-out infinite';
      launchConfetti();
      launchMarioVictoryOverlay();
      flashTitle();
      showToast('🏆','8 HOURS ACHIEVED','nikal gayo bhai… ghar ja.','#e8282b');
    }
  }

  function warnTenMinutes(left) {
    if (tenMinTriggered) return;
    tenMinTriggered = true;
    if (THEME === 'spiderman') {
      if (refs.widget) refs.widget.style.animation = 'sp-warn-glow 1.2s ease-in-out infinite';
      showToast('⚠️', `${left} MIN REMAINING`, 'Final stretch. Swing through.', '#fbbf24');
      setTimeout(() => {
        if (refs.widget && !eightHourTriggered) refs.widget.style.animation = 'sp-glow-pulse 4s ease-in-out infinite';
      }, 7000);
    } else {
      if (refs.widget) refs.widget.style.animation = 'km-warn 1.2s ease-in-out infinite,km-soft-glow 3s ease-in-out infinite';
      showToast('⚠️',`${left} MIN LEFT`,'final castle… bas thoda sa aur.','#f9a825');
      setTimeout(() => {
        if (refs.widget && !eightHourTriggered) refs.widget.style.animation = 'km-soft-glow 4s ease-in-out infinite';
      }, 7000);
    }
  }

  // ─── scan ─────────────────────────────────────────────────────────────────────
  function scan() {
    const now = Date.now();
    if (now - lastScanTime < SCAN_THROTTLE_MS) return;
    lastScanTime = now;
    processLogs();
    updateUI();
  }

  // ─── boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    if (THEME === 'spiderman') createSpiderUI();
    else createMarioUI();

    // Console badge
    const badge = THEME === 'spiderman'
      ? '%c🕷️ Keka Grind Tracker — Spider-Man Theme (even day)'
      : '%c🍄 Keka Grind Tracker — Mario Theme (odd day)';
    const style = THEME === 'spiderman'
      ? 'background:#0a0a14;color:#ef4444;padding:4px 10px;border-radius:4px;font-weight:bold;'
      : 'background:#e8282b;color:#ffd700;padding:4px 10px;border-radius:4px;font-weight:bold;';
    console.log(badge, style);

    scan();
    setInterval(scan, SCAN_INTERVAL_MS);

    const obs = new MutationObserver(() => {
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(scan, 500);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
