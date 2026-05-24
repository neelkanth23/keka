// ╔══════════════════════════════════════════════════════════════╗
// ║   KEKA HERO TRACKER — v3 FINAL                              ║
// ║   FIXES:                                                    ║
// ║   1. Calculation: fallback body-scan no longer picks up     ║
// ║      shift times (e.g. "10:00 AM - 06:00 PM") as logs.     ║
// ║      Now strictly anchored to the Biometric Logs section.   ║
// ║   2. Remaining shows Xh Ym (not just Xh).                  ║
// ║   3. Spider PNG 424×296 landscape — constrained by height,  ║
// ║      swings only inside the top sky strip, never overlaps   ║
// ║      the stats panel.                                       ║
// ║   4. Spider swing transform fixed — scaleX + rotate order   ║
// ║      corrected, transform-origin set per direction.         ║
// ║   5. Achievement popup added for Spider-Man (like Mario).   ║
// ╚══════════════════════════════════════════════════════════════╝

(function () {

'use strict';

if (window.__KEKA_HERO_TRACKER__) {
    console.log('[KHT] Already running.');
    return;
}
window.__KEKA_HERO_TRACKER__ = true;

// ─────────────────────────────────────────────────────
// THEME  (even date = spiderman, odd = mario)
// ─────────────────────────────────────────────────────

const THEME = (new Date().getDate() % 2 === 0) ? 'spiderman' : 'mario';

// ─────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────

const WORK_MINUTES     = 8 * 60;   // 480
const HALF_DAY_MINUTES = 4 * 60;   // 240
const SCAN_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────

let refs             = {};
let previousCoinState = -1;
let missionDone      = false;   // achievement fired once
let mutationTimer    = null;

// ─────────────────────────────────────────────────────
// GENERIC HELPERS
// ─────────────────────────────────────────────────────

function setIfChanged(el, val) {
    if (!el || el.textContent === val) return;
    el.textContent = val;
}

// Parse "10:13 am" / "10:13am" / "02:06 PM" → minutes since midnight
// Returns null if unrecognisable.
function parseTimeToMinutes(ts) {
    if (!ts) return null;
    const s = ts.trim().toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
    if (!m) return null;
    let H = parseInt(m[1], 10);
    const M = parseInt(m[2], 10);
    if (M < 0 || M > 59) return null;
    if (m[3] === 'pm' && H !== 12) H += 12;
    if (m[3] === 'am' && H === 12) H = 0;
    if (H < 0 || H > 23) return null;
    return H * 60 + M;
}

// Minutes between two time strings (handles same-day only, cap 14h)
function minutesBetween(startStr, endStr) {
    const s = parseTimeToMinutes(startStr);
    const e = parseTimeToMinutes(endStr);
    if (s === null || e === null) return 0;
    const diff = e - s;
    // Must be positive and ≤ 14 hours (840 min) — a single session can't be longer
    if (diff <= 0 || diff > 840) return 0;
    return diff;
}

// Live elapsed minutes from a start-time string to right now
function liveMinutesFrom(startStr) {
    const s = parseTimeToMinutes(startStr);
    if (s === null) return 0;
    const now   = new Date();
    const nowM  = now.getHours() * 60 + now.getMinutes();
    const diff  = nowM - s;
    // Negative means crossed midnight — not expected in a work tracker
    if (diff < 0 || diff > 840) return 0;
    return diff;
}

function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
    }).toUpperCase();
}

// Friendly "Xh Ym" from a minute count
function fmtMinutes(totalM) {
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────────────
// KEKA LOG PARSER  (v3 — strict, no body fallback)
//
// Strategy:
//  1. Find the element that says exactly "Biometric Logs".
//  2. Walk UP ancestors until we find one whose innerText
//     contains ≥ 2 time tokens AND does NOT also contain
//     shift-range text like "10:00 AM - 06:00 PM"
//     (the shift line has a " - " between two times; real
//      log pairs never have " - " between them in Keka's UI).
//  3. Strip out any "HH:MM AM - HH:MM PM" chunks first,
//     then collect the remaining time tokens as log pairs.
// ─────────────────────────────────────────────────────

const TIME_RE  = /\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/gi;
// Matches a shift-range pattern like "10:00 AM - 06:00 PM"
const RANGE_RE = /\d{1,2}:\d{2}\s*(?:am|pm)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)/gi;

function extractLogPairs() {
    const pairs = [];

    // ── Step 1: find the "Biometric Logs" label ─────────
    let labelEl = null;
    for (const el of document.querySelectorAll('*')) {
        if (el.children.length > 8) continue;      // skip large containers
        const txt = (el.innerText || el.textContent || '').trim();
        if (/^biometric\s+logs$/i.test(txt)) {
            labelEl = el;
            break;
        }
    }

    if (!labelEl) {
        // Section not visible — no data to show
        console.log('[KHT] Biometric Logs section not found.');
        return pairs;
    }

    // ── Step 2: walk up to a container with ≥ 2 time tokens ──
    let container = labelEl;
    for (let depth = 0; depth < 10; depth++) {
        const parent = container.parentElement;
        if (!parent) break;
        const text   = parent.innerText || '';
        // Strip shift-range patterns first, then count remaining tokens
        const cleaned = text.replace(RANGE_RE, '');
        const found   = cleaned.match(TIME_RE);
        if (found && found.length >= 2) {
            container = parent;
            break;
        }
        container = parent;
    }

    // ── Step 3: extract cleaned time tokens ─────────────
    const rawText = (container.innerText || '').replace(RANGE_RE, '');
    const tokens  = [...rawText.matchAll(TIME_RE)].map(m =>
        m[1].trim().replace(/\s+/g, '')  // "10:13 am" → "10:13am"
    );

    if (tokens.length < 1) {
        console.log('[KHT] No time tokens found after cleaning.');
        return pairs;
    }

    // ── Step 4: build pairs ──────────────────────────────
    // Tokens come in pairs: [IN, OUT, IN, OUT, ...]
    // If odd count, last session is still open (no OUT yet).
    for (let i = 0; i < tokens.length; i += 2) {
        pairs.push({
            s: tokens[i],
            e: tokens[i + 1] || 'MISSING'
        });
    }

    console.log('[KHT] Log pairs:', JSON.stringify(pairs));
    return pairs;
}

// ─────────────────────────────────────────────────────
// PROCESS LOGS → window.KekaHoursLatest
// ─────────────────────────────────────────────────────

function processLogs() {
    const pairs = extractLogPairs();

    let totalM      = 0;
    let breakM      = 0;
    let firstStart  = null;
    let prevEnd     = null;
    let activeStart = null;

    pairs.forEach(({ s, e }, idx) => {
        if (parseTimeToMinutes(s) === null) return;

        if (firstStart === null) firstStart = s;

        // Break = gap between previous session's end and this session's start
        if (idx > 0 && prevEnd && prevEnd !== 'MISSING') {
            const b = minutesBetween(prevEnd, s);
            if (b > 0) breakM += b;
        }

        const isMissing = (e === 'MISSING' || parseTimeToMinutes(e) === null);

        if (isMissing) {
            // Session still open — count live minutes
            activeStart = s;
        } else {
            const sess = minutesBetween(s, e);
            if (sess > 0) totalM += sess;
            prevEnd     = e;
            activeStart = null;
        }
    });

    // If last session has no OUT, add live elapsed time
    if (activeStart) {
        const live = liveMinutesFrom(activeStart);
        if (live > 0) totalM += live;
    }

    console.log(`[KHT] totalM=${totalM} breakM=${breakM} firstStart=${firstStart}`);

    window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   MARIO THEME                                               ║
// ╚══════════════════════════════════════════════════════════════╝

function injectMarioStyles() {
    if (document.getElementById('kekaMarioStyles')) return;
    const s = document.createElement('style');
    s.id = 'kekaMarioStyles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
#kekaMario *{ box-sizing:border-box; margin:0; padding:0; font-family:'Nunito',sans-serif; }

@keyframes km-slidein{
  from{ transform:translateX(120%) scale(.96); opacity:0; }
  to{   transform:translateX(0)    scale(1);   opacity:1; }
}
@keyframes km-soft-glow{
  0%,100%{ filter:drop-shadow(0 18px 30px rgba(0,0,0,.20)); }
  50%{     filter:drop-shadow(0 22px 38px rgba(255,214,0,.24)); }
}
@keyframes km-progress-stripe{
  from{ background-position:0 0; }
  to{   background-position:34px 0; }
}
@keyframes km-coin-pop{
  0%,100%{ transform:translateY(0)   scale(1);    }
  50%{     transform:translateY(-3px) scale(1.08); }
}
@keyframes km-cloud{
  from{ transform:translateX(-20px); }
  to{   transform:translateX( 20px); }
}
@keyframes km-run{
  0%{   left:-50px;  }
  100%{ left:420px; }
}
@keyframes km-goomba{
  0%{   left:420px; }
  100%{ left:-60px; }
}
/* ── achievement popup ── */
@keyframes km-pop-in{
  0%{   transform:translateY(60px) scale(.7); opacity:0; }
  60%{  transform:translateY(-8px) scale(1.08); opacity:1; }
  100%{ transform:translateY(0)    scale(1);    opacity:1; }
}
@keyframes km-pop-out{
  from{ transform:translateY(0) scale(1);   opacity:1; }
  to{   transform:translateY(60px) scale(.7); opacity:0; }
}
#kmAchieve{
  position:fixed;
  bottom:20px; right:20px;
  z-index:2147483647;
  background:linear-gradient(135deg,#ffd600,#ff6d00);
  color:#1a237e;
  font-family:'Nunito',sans-serif;
  font-weight:900;
  font-size:15px;
  padding:14px 20px;
  border-radius:20px;
  box-shadow:0 8px 30px rgba(0,0,0,.35);
  display:flex; align-items:center; gap:10px;
  pointer-events:none;
  animation: km-pop-in .5s cubic-bezier(.34,1.4,.64,1) forwards;
}
#kmAchieve.out{ animation: km-pop-out .4s ease-in forwards; }
`;
    document.head.appendChild(s);
}

function px(ctx, S, x, y, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x * S, y * S, S, S);
}

function drawMarioFrame(ctx, frame) {
    ctx.clearRect(0, 0, 40, 52);
    const S=4, R='#e52213', B='#0052a2', SK='#fba86f', SH='#5e1205';
    const d = (x,y,c) => px(ctx,S,x,y,c);
    [[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],
     [2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]
    ].forEach(p=>d(...p));
    [[1,2,SH],[2,2,SH],[3,2,SH]].forEach(p=>d(...p));
    [[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],
     [1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK]
    ].forEach(p=>d(...p));
    d(3,3,SH); d(7,3,SH);
    [[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B]
    ].forEach(p=>d(...p));
    (frame%2===0
        ? [[2,10,B],[3,10,B],[7,10,B],[8,10,B]]
        : [[1,10,B],[2,10,B],[8,10,B],[9,10,B]]
    ).forEach(p=>d(...p));
}

function drawGoombaFrame(ctx) {
    ctx.clearRect(0,0,36,36);
    const S=4, GB='#795548';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
     [0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB]
    ].forEach(p=>d(...p));
}

function buildMarioCoins(pct) {
    const TOTAL = 17;
    const lit   = Math.round((pct/100)*TOTAL);
    if (lit === previousCoinState) return;
    previousCoinState = lit;
    const wrap = refs.coins;
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i=0; i<TOTAL; i++) {
        const c   = document.createElement('div');
        const on  = i < lit;
        c.style.cssText = on
            ? `width:18px;height:18px;border-radius:50%;flex-shrink:0;
               background:radial-gradient(circle at 35% 28%,#fffde7,#ffd600 38%,#c67c00 72%,#7a4500 100%);
               border:2.5px solid #fff;
               animation:km-coin-pop 2.4s ease-in-out infinite ${i*.06}s;`
            : `width:18px;height:18px;border-radius:50%;flex-shrink:0;
               background:rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.22);`;
        wrap.appendChild(c);
    }
}

function showMarioAchievement() {
    if (document.getElementById('kmAchieve')) return;
    const el = document.createElement('div');
    el.id = 'kmAchieve';
    el.innerHTML = `<span style="font-size:26px;">🏆</span><div><div style="font-size:12px;opacity:.7;margin-bottom:2px;">ACHIEVEMENT UNLOCKED</div>FULL DAY GRIND COMPLETE!</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(()=>el.remove(), 500); }, 5000);
}

function createMarioUI() {
    injectMarioStyles();
    if (document.getElementById('kekaMario')) return;
    const widget = document.createElement('div');
    widget.id = 'kekaMario';
    widget.style.cssText = `
        position:fixed;top:20px;right:20px;z-index:2147483646;
        width:370px;border-radius:28px;overflow:hidden;background:#e8282b;
        box-shadow:0 0 0 4px #fff,0 0 0 8px #e8282b,0 0 0 12px #fff,0 24px 70px rgba(0,0,0,.42);
        animation:km-slidein .65s cubic-bezier(.34,1.4,.64,1) forwards,
                  km-soft-glow 4s ease-in-out infinite .9s;
    `;
    widget.innerHTML = `
<div style="position:relative;height:240px;overflow:hidden;background:linear-gradient(180deg,#4f8ffc 0%,#78b3ff 58%,#a9d5ff 100%);">
  <svg style="position:absolute;top:18px;left:12px;animation:km-cloud 7s ease-in-out infinite alternate;" width="90" height="46" viewBox="0 0 90 46">
    <ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/>
    <ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/>
    <ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/>
  </svg>
  <div style="position:absolute;left:0;right:0;bottom:0;height:52px;background:#c8860a;"></div>
  <canvas id="kmMarioSprite" width="40" height="52" style="position:absolute;bottom:52px;left:-50px;image-rendering:pixelated;animation:km-run 8s linear infinite;"></canvas>
  <canvas id="kmGoomba" width="36" height="36" style="position:absolute;bottom:52px;left:420px;image-rendering:pixelated;animation:km-goomba 6s linear infinite;"></canvas>
  <div style="position:absolute;top:14px;left:14px;right:14px;background:rgba(255,255,255,.25);backdrop-filter:blur(20px);border:3px solid rgba(255,255,255,.92);border-radius:20px;padding:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:13px;font-weight:900;letter-spacing:.06em;color:#1a237e;">GRIND TRACKER</div>
        <div style="font-size:9px;font-weight:800;letter-spacing:.2em;color:rgba(26,35,126,.52);margin-top:2px;">WORLD 8-1</div>
      </div>
      <div style="font-size:11px;font-weight:900;background:#22c55e;color:white;padding:6px 10px;border-radius:999px;">LIVE</div>
    </div>
    <div style="display:flex;justify-content:center;align-items:flex-end;gap:3px;margin-top:14px;">
      <div id="kmHours" style="font-size:58px;font-weight:900;line-height:1;color:#1a237e;">0</div>
      <div style="font-size:15px;font-weight:900;margin-bottom:8px;color:rgba(26,35,126,.6);">h</div>
      <div id="kmMins" style="font-size:58px;font-weight:900;line-height:1;color:#1a237e;">00</div>
      <div style="font-size:15px;font-weight:900;margin-bottom:8px;color:rgba(26,35,126,.6);">m</div>
    </div>
    <div style="height:12px;border-radius:999px;background:rgba(26,35,126,.14);overflow:hidden;margin-top:10px;">
      <div id="kmProgress" style="height:100%;width:0%;border-radius:999px;
           background:repeating-linear-gradient(45deg,#ffd600 0,#ffd600 8px,#f9a825 8px,#f9a825 16px);
           animation:km-progress-stripe 1.4s linear infinite;"></div>
    </div>
    <div id="kmVibe" style="margin-top:10px;font-size:10px;font-style:italic;font-weight:800;color:rgba(26,35,126,.58);text-align:center;">"kaam sharu kar..."</div>
  </div>
</div>
<div style="background:linear-gradient(180deg,#ef3033 0%,#d71920 100%);padding:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div style="font-size:10px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.7);">COINS TO FREEDOM</div>
    <div id="kmPct" style="font-size:14px;font-weight:900;color:#ffe566;">0%</div>
  </div>
  <div id="kmCoins" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
</div>`;

    document.body.appendChild(widget);
    refs = {
        widget,
        hours:    widget.querySelector('#kmHours'),
        mins:     widget.querySelector('#kmMins'),
        pct:      widget.querySelector('#kmPct'),
        progress: widget.querySelector('#kmProgress'),
        vibe:     widget.querySelector('#kmVibe'),
        coins:    widget.querySelector('#kmCoins')
    };

    const mc = document.getElementById('kmMarioSprite');
    const gc = document.getElementById('kmGoomba');
    const mCtx = mc.getContext('2d');
    const gCtx = gc.getContext('2d');
    let frame = 0;
    (function loop() { frame++; drawMarioFrame(mCtx, frame); drawGoombaFrame(gCtx); requestAnimationFrame(loop); })();
    buildMarioCoins(0);
}

function updateMarioUI(data, total, breaks, left, pct, h, mStr) {
    setIfChanged(refs.hours, String(h));
    setIfChanged(refs.mins, mStr);
    setIfChanged(refs.pct, `${pct}%`);
    refs.progress.style.width = `${pct}%`;

    if      (pct >= 100) refs.vibe.textContent = '"nikal gayo bhai..."';
    else if (pct >= 75)  refs.vibe.textContent = '"castle najik che..."';
    else if (pct >= 50)  refs.vibe.textContent = '"aadho grind thai gayo..."';
    else                 refs.vibe.textContent = '"coins collect thai rahya che..."';

    buildMarioCoins(pct);

    if (pct >= 100 && !missionDone) {
        missionDone = true;
        showMarioAchievement();
    }
}

if (THEME === 'mario') createMarioUI();

// ╔══════════════════════════════════════════════════════════════╗
// ║   SPIDER-MAN THEME                                          ║
// ╚══════════════════════════════════════════════════════════════╝

const SPIDER_PNG = 'https://raw.githubusercontent.com/neelkanth23/keka/main/spidermon.png';

// The actual PNG is 424 × 296 (landscape, aspect ≈ 1.43:1).
// We render it at a fixed HEIGHT inside the sky strip.
// Sky strip height = 160px (widget height 560, content starts at ~160 from top with header).
// We want Spider-Man to fill the sky but not bleed into the content panel.
// Height = 90px → width = 90 * (424/296) ≈ 129px.  We'll use h=88, w=126.
const SP_H = 88;
const SP_W = Math.round(SP_H * (424 / 296));  // ≈ 126

// Sky strip is from y=0 to y=160 inside the widget.
// Spider-Man swings across x: from -SP_W to WIDGET_W (390).
const WIDGET_W  = 390;
const SKY_H     = 160;           // visible sky before content panel
const SP_TOP_MIN = 10;           // closest to top edge
const SP_TOP_MAX = SKY_H - SP_H - 10;  // ≈ 62 — keeps bottom edge inside sky

function injectSpiderStyles() {
    if (document.getElementById('kekaSpiderStyles')) return;
    const s = document.createElement('style');
    s.id = 'kekaSpiderStyles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;700&display=swap');
#kekaSpider *{ box-sizing:border-box; margin:0; padding:0; }

@keyframes sp-slidein{
  from{ transform:translateX(120%) scale(.96); opacity:0; }
  to{   transform:translateX(0)    scale(1);   opacity:1; }
}
@keyframes sp-spin     { to{ transform:rotate(360deg);  } }
@keyframes sp-spin-rev { to{ transform:rotate(-360deg); } }
@keyframes sp-glow{
  0%,100%{ box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42); }
  50%{     box-shadow:0 0 40px rgba(255,80,80,.28),0 25px 80px rgba(0,0,0,.52); }
}
@keyframes sp-float{
  0%,100%{ transform:translateY(0);    }
  50%{     transform:translateY(-8px); }
}
@keyframes sp-shimmer{
  0%{   transform:translateX(-140%) rotate(18deg); }
  100%{ transform:translateX(180%)  rotate(18deg); }
}
/* achievement */
@keyframes sp-achieve-in{
  0%{   transform:translateY(60px) scale(.7); opacity:0; }
  60%{  transform:translateY(-8px) scale(1.08); opacity:1; }
  100%{ transform:translateY(0)    scale(1);    opacity:1; }
}
@keyframes sp-achieve-out{
  from{ transform:translateY(0) scale(1);   opacity:1; }
  to{   transform:translateY(60px) scale(.7); opacity:0; }
}
@keyframes sp-complete-glow{
  0%,100%{ box-shadow:0 0 30px rgba(34,197,94,.25),0 20px 70px rgba(0,0,0,.45); }
  50%{     box-shadow:0 0 60px rgba(34,197,94,.50),0 20px 90px rgba(0,0,0,.55); }
}
.sp-complete{ animation:sp-complete-glow 1.8s ease-in-out infinite !important; }

#spAchieve{
  position:fixed;
  bottom:20px; right:20px;
  z-index:2147483647;
  background:linear-gradient(135deg,#ff3d3d,#3da5ff);
  color:white;
  font-family:'Orbitron',sans-serif;
  font-weight:700;
  font-size:13px;
  padding:14px 20px;
  border-radius:20px;
  box-shadow:0 8px 30px rgba(0,0,0,.40);
  display:flex; align-items:center; gap:10px;
  pointer-events:none;
  animation: sp-achieve-in .5s cubic-bezier(.34,1.4,.64,1) forwards;
}
#spAchieve.out{ animation: sp-achieve-out .4s ease-in forwards; }

/* Spider-Man image — all positioning done in JS */
#spSwinger{
  position:absolute;
  z-index:4;
  pointer-events:none;
  /* size set via JS to SP_W × SP_H */
  width:${SP_W}px;
  height:${SP_H}px;
  object-fit:contain;
  filter:drop-shadow(0 6px 12px rgba(0,0,0,.55)) drop-shadow(0 0 14px rgba(255,60,60,.25));
  /* NO CSS animation — 100% JS-controlled */
}
`;
    document.head.appendChild(s);
}

function createSpiderUI() {
    injectSpiderStyles();
    if (document.getElementById('kekaSpider')) return;
    const widget = document.createElement('div');
    widget.id = 'kekaSpider';
    widget.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:2147483646;
        width:${WIDGET_W}px; height:560px; border-radius:34px; overflow:hidden;
        background:linear-gradient(180deg,#0d1b2a 0%,#1b2f4e 30%,#162744 60%,#0a1628 100%);
        box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42);
        animation:sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards, sp-glow 4s ease-in-out infinite;
    `;

    widget.innerHTML = `
<!-- City canvas fills entire widget -->
<canvas id="spCity" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>

<!-- Spider-Man swings in top ${SKY_H}px — positioned by JS -->
<img id="spSwinger" src="${SPIDER_PNG}" alt="" />

<!-- Subtle gradient overlay so stats panel reads clearly -->
<div style="position:absolute;left:0;right:0;top:${SKY_H}px;bottom:0;
     background:linear-gradient(180deg,rgba(10,20,40,.82),rgba(5,10,20,.96));
     border-radius:0 0 34px 34px;"></div>

<!-- TOP BAR (z above everything) -->
<div style="position:absolute;top:0;left:0;right:0;height:${SKY_H}px;z-index:5;pointer-events:none;">
  <!-- header row -->
  <div style="position:absolute;top:14px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-family:'Orbitron',sans-serif;font-size:20px;font-weight:900;letter-spacing:3px;color:white;
                  text-shadow:0 0 20px rgba(255,80,80,.6);">SPIDER HUD</div>
      <div style="font-size:9px;letter-spacing:2.5px;color:rgba(255,255,255,.55);margin-top:3px;">EARTH-616 • NYC</div>
    </div>
    <!-- buttons need pointer-events -->
    <div style="display:flex;gap:8px;pointer-events:all;">
      <button id="spMin"   style="width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:white;font-size:17px;cursor:pointer;backdrop-filter:blur(8px);">−</button>
      <button id="spClose" style="width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,80,80,.25);color:white;font-size:15px;cursor:pointer;backdrop-filter:blur(8px);">×</button>
    </div>
  </div>
</div>

<!-- CONTENT PANEL — starts exactly where sky ends -->
<div id="spContent" style="position:absolute;top:${SKY_H}px;left:0;right:0;bottom:0;
     display:flex;flex-direction:column;padding:16px;gap:14px;">

  <!-- REACTOR ROW -->
  <div style="display:flex;align-items:center;gap:16px;">
    <!-- circular progress -->
    <div style="position:relative;width:130px;height:130px;flex-shrink:0;animation:sp-float 4s ease-in-out infinite;">
      <svg viewBox="0 0 130 130" style="position:absolute;inset:0;width:100%;height:100%;">
        <circle cx="65" cy="65" r="54" stroke="rgba(255,255,255,.08)" stroke-width="6" fill="none"/>
        <circle id="spProgressCircle" cx="65" cy="65" r="54"
                stroke="url(#spGrad2)" stroke-width="10" fill="none"
                stroke-linecap="round" transform="rotate(-90 65 65)"
                stroke-dasharray="339" stroke-dashoffset="339"/>
        <defs>
          <linearGradient id="spGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stop-color="#ff3d3d"/>
            <stop offset="100%" stop-color="#3da5ff"/>
          </linearGradient>
        </defs>
        <g style="animation:sp-spin 18s linear infinite;transform-origin:65px 65px;">
          <circle cx="65" cy="65" r="62" stroke="rgba(255,255,255,.10)" stroke-dasharray="8 10" stroke-width="1.5" fill="none"/>
        </g>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div id="spHours" style="font-family:'Orbitron',sans-serif;font-size:32px;font-weight:900;line-height:1;color:white;
             text-shadow:0 0 16px rgba(255,255,255,.5),0 0 28px rgba(255,60,60,.35);">0h</div>
        <div id="spMins"  style="font-size:14px;letter-spacing:2px;color:#7ec8ff;margin-top:2px;">00m</div>
      </div>
    </div>

    <!-- right-side stats -->
    <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:8px 10px;">
          <div style="font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.45);">REMAINING</div>
          <div id="spRemaining" style="font-size:18px;font-weight:700;color:white;margin-top:3px;">8h 0m</div>
        </div>
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:8px 10px;">
          <div style="font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.45);">BREAK</div>
          <div id="spBreak" style="font-size:18px;font-weight:700;color:white;margin-top:3px;">0m</div>
        </div>
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:8px 10px;">
          <div style="font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.45);">HALF DAY</div>
          <div id="spHalf" style="font-size:16px;font-weight:700;color:#ffd166;margin-top:3px;">--</div>
        </div>
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);border-radius:12px;padding:8px 10px;">
          <div style="font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.45);">FULL DAY</div>
          <div id="spFull" style="font-size:16px;font-weight:700;color:#06d6a0;margin-top:3px;">--</div>
        </div>
      </div>
    </div>
  </div>

  <!-- PROGRESS BAR -->
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
      <div style="font-size:9px;letter-spacing:2px;color:rgba(255,255,255,.4);">MISSION PROGRESS</div>
      <div id="spPct" style="font-size:11px;font-weight:700;color:#3da5ff;">0%</div>
    </div>
    <div style="height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;">
      <div id="spBar" style="height:100%;width:0%;border-radius:999px;
           background:linear-gradient(90deg,#ff3d3d,#3da5ff);transition:width .5s ease;"></div>
    </div>
  </div>

  <!-- MISSION STATUS -->
  <div id="spMission" style="flex:1;display:flex;align-items:center;justify-content:center;
       background:linear-gradient(135deg,rgba(255,61,61,.10),rgba(61,165,255,.10));
       border:1px solid rgba(255,255,255,.08);border-radius:18px;
       padding:14px 16px;font-size:13px;line-height:1.5;color:rgba(255,255,255,.85);text-align:center;">
    Entering Manhattan patrol route.
  </div>

</div>
`;

    document.body.appendChild(widget);

    refs = {
        widget,
        hours:    widget.querySelector('#spHours'),
        mins:     widget.querySelector('#spMins'),
        remaining:widget.querySelector('#spRemaining'),
        breakEl:  widget.querySelector('#spBreak'),
        half:     widget.querySelector('#spHalf'),
        full:     widget.querySelector('#spFull'),
        mission:  widget.querySelector('#spMission'),
        progress: widget.querySelector('#spProgressCircle'),
        bar:      widget.querySelector('#spBar'),
        pct:      widget.querySelector('#spPct'),
        content:  widget.querySelector('#spContent')
    };

    // ── buttons ──────────────────────────────────────────
    let minimized = false;
    widget.querySelector('#spMin').addEventListener('click', () => {
        minimized = !minimized;
        refs.content.style.display = minimized ? 'none' : 'flex';
        widget.style.height         = minimized ? '74px' : '560px';
        widget.querySelector('#spMin').textContent = minimized ? '+' : '−';
    });
    widget.querySelector('#spClose').addEventListener('click', () => {
        widget.remove();
        window.__KEKA_HERO_TRACKER__ = false;
    });

    startSpiderCity();
    startSpiderSwing();
}

// ── Spider-Man swing animation ───────────────────────
// PNG: 424×296 landscape. We display at SP_W × SP_H.
// Swings across the top SKY_H strip only.
// transform = scaleX(±1) to face direction of travel,
// with a subtle tilt. We apply them as TWO separate
// style properties to avoid order-of-operations confusion.

function startSpiderSwing() {
    const img = document.getElementById('spSwinger');
    if (!img) return;

    const CYCLE  = 10000;  // ms per full round-trip
    const HALF   = CYCLE / 2;
    const LEFT_X = -SP_W;      // start off-screen left
    const RIGHT_X = WIDGET_W;  // end off-screen right
    let t0 = null;

    function eio(t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t; }

    function tick(now) {
        if (!t0) t0 = now;
        const elapsed = (now - t0) % CYCLE;
        const goingRight = elapsed < HALF;
        const frac = goingRight ? elapsed/HALF : (elapsed-HALF)/HALF;
        const ease = eio(frac);

        // X position
        const x = goingRight
            ? LEFT_X  + (RIGHT_X - LEFT_X)  * ease
            : RIGHT_X + (LEFT_X  - RIGHT_X) * ease;

        // Y: gentle arc — deepest at midpoint of each leg
        const arc = Math.sin(frac * Math.PI);  // 0→1→0
        const y   = SP_TOP_MIN + (SP_TOP_MAX - SP_TOP_MIN) * arc;

        // Tilt: leans into the direction of travel
        // Going right: positive tilt (clockwise lean); going left: negative
        const maxTilt = 18;
        const tilt = goingRight
            ?  maxTilt * Math.sin(frac * Math.PI)
            : -maxTilt * Math.sin(frac * Math.PI);

        // scaleX: 1 = faces right, -1 = faces left
        // We apply scaleX by scaling around the image center,
        // so we DON'T use transform-origin; instead we do:
        //   translate to center → scaleX → rotate → translate back
        // Simpler: just set transform directly; browser handles it left-to-right.
        const sx = goingRight ? 1 : -1;

        img.style.left   = `${x}px`;
        img.style.top    = `${y}px`;
        // scaleX first, then rotate — this flips correctly without off-origin issues
        img.style.transform = `scaleX(${sx}) rotate(${tilt}deg)`;

        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// ── NYC city background canvas ───────────────────────

function startSpiderCity() {
    const canvas = document.getElementById('spCity');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = WIDGET_W;
    canvas.height = 560;
    const W = WIDGET_W, H = 560;

    // Generate stable buildings once
    const buildings = Array.from({length:22}, (_,i) => ({
        x: i * 19,
        w: 14 + Math.sin(i*7)*8,
        h: 90 + Math.abs(Math.sin(i*3.7))*200,
        hue: 210 + Math.sin(i)*15
    })).map(b => ({ ...b, y: H - b.h }));

    // Web lines
    const webs = Array.from({length:5}, (_,i) => ({
        x1: i*90, y1: 0,
        x2: i*90+60, y2: 80,
        phase: i * 1.2
    }));

    let frame = 0;

    function render() {
        ctx.clearRect(0, 0, W, H);

        // Sky gradient (night city)
        const sky = ctx.createLinearGradient(0,0,0,H);
        sky.addColorStop(0,   '#0a0f1e');
        sky.addColorStop(0.5, '#0d1a32');
        sky.addColorStop(1,   '#080d18');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // Moon
        ctx.save();
        ctx.beginPath();
        ctx.arc(320, 35, 22, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,240,200,.85)';
        ctx.shadowColor = 'rgba(255,240,180,.4)';
        ctx.shadowBlur  = 20;
        ctx.fill();
        ctx.restore();

        // Stars
        ctx.save();
        for (let s=0; s<40; s++) {
            const sx = ((s * 97 + frame*0.02) % W);
            const sy = (s * 43) % (H * 0.45);
            const op = 0.3 + 0.5*Math.abs(Math.sin(frame*0.01 + s));
            ctx.fillStyle = `rgba(255,255,255,${op.toFixed(2)})`;
            ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        ctx.restore();

        // Buildings
        buildings.forEach(b => {
            const g = ctx.createLinearGradient(b.x, b.y, b.x+b.w, b.y+b.h);
            g.addColorStop(0, `hsla(${b.hue},25%,14%,0.95)`);
            g.addColorStop(1, `hsla(${b.hue},20%,8%,1)`);
            ctx.fillStyle = g;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            // windows
            for (let wy = b.y+6; wy < H-10; wy += 12) {
                for (let wx = b.x+3; wx < b.x+b.w-4; wx += 8) {
                    if (Math.sin(wx*7+wy*3) > 0.2) {
                        const warmCool = Math.sin(wx+wy) > 0;
                        ctx.fillStyle = warmCool
                            ? `rgba(255,195,80,${0.5+0.4*Math.sin(frame*0.003+wx)})`
                            : `rgba(130,190,255,${0.4+0.4*Math.sin(frame*0.004+wy)})`;
                        ctx.fillRect(wx, wy, 3, 5);
                    }
                }
            }
        });

        // Web lines in sky area
        webs.forEach(w => {
            const sway = Math.sin(frame*0.015 + w.phase) * 8;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.quadraticCurveTo(w.x1+30+sway, 40, w.x2, w.y2);
            ctx.stroke();
            ctx.restore();
        });

        // Ground traffic streaks
        for (let i=0; i<8; i++) {
            const speed = 0.8 + (i%3)*0.4;
            const tx = ((i*55 + frame*speed) % (W+60)) - 60;
            ctx.strokeStyle = i%2
                ? 'rgba(255,80,80,.40)'
                : 'rgba(255,240,160,.30)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx, H-28+Math.sin(i)*4);
            ctx.lineTo(tx+32, H-28+Math.sin(i)*4);
            ctx.stroke();
        }

        frame++;
        requestAnimationFrame(render);
    }
    render();
}

function showSpiderAchievement() {
    if (document.getElementById('spAchieve')) return;
    const el = document.createElement('div');
    el.id = 'spAchieve';
    el.innerHTML = `<span style="font-size:24px;">🕷️</span><div>
      <div style="font-size:9px;opacity:.65;letter-spacing:2px;margin-bottom:2px;">MISSION COMPLETE</div>
      MANHATTAN SECURED!</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(()=>el.remove(), 500); }, 5000);
}

// ─────────────────────────────────────────────────────
// UPDATE SPIDER UI
// ─────────────────────────────────────────────────────

function updateSpiderUI(data, total, breaks, left, pct, h, mStr) {
    setIfChanged(refs.hours, `${h}h`);
    setIfChanged(refs.mins,  `${mStr}m`);

    // ✅ Remaining: show Xh Ym precisely
    setIfChanged(refs.remaining, fmtMinutes(left));

    // ✅ Break: show Xh Ym if > 60
    setIfChanged(refs.breakEl, fmtMinutes(breaks));

    // Progress arc: circumference of r=54 circle = 2π×54 ≈ 339.3
    const C = 2 * Math.PI * 54;
    refs.progress.setAttribute('stroke-dasharray',  C.toFixed(1));
    refs.progress.style.strokeDashoffset = (C - (pct/100)*C).toFixed(1);

    // Progress bar
    if (refs.bar)  refs.bar.style.width  = `${pct}%`;
    if (refs.pct)  setIfChanged(refs.pct, `${pct}%`);

    // Mission text
    const missions = [
        'Entering Manhattan patrol route.',
        'Spider-Sense activated across NYC.',
        'Swinging through Midtown at full speed.',
        'Final villain chase sequence active.',
        'MISSION COMPLETE. Manhattan secured.'
    ];
    const mIdx = pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
    setIfChanged(refs.mission, missions[mIdx]);

    // Half-day / full-day projected times
    if (data.firstStart) {
        const sMin = parseTimeToMinutes(data.firstStart);
        if (sMin !== null) {
            const base = new Date();
            base.setHours(Math.floor(sMin/60), sMin%60, 0, 0);
            const halfTime = new Date(base.getTime() + (HALF_DAY_MINUTES + breaks)*60000);
            const fullTime = new Date(base.getTime() + (WORK_MINUTES     + breaks)*60000);
            setIfChanged(refs.half, fmtTime(halfTime));
            setIfChanged(refs.full, fmtTime(fullTime));
        }
    }

    // Achievement popup
    if (pct >= 100 && !missionDone) {
        missionDone = true;
        refs.widget.classList.add('sp-complete');
        showSpiderAchievement();
    }
}

// ─────────────────────────────────────────────────────
// MASTER UPDATE
// ─────────────────────────────────────────────────────

function updateUI() {
    processLogs();

    const data   = window.KekaHoursLatest || { totalMinutes:0, breakMinutes:0, firstStart:null };
    const total  = Math.max(0, data.totalMinutes  || 0);
    const breaks = Math.max(0, data.breakMinutes  || 0);
    const left   = Math.max(0, WORK_MINUTES - total);
    const pct    = Math.min(100, Math.round((total / WORK_MINUTES) * 100));
    const h      = Math.floor(total / 60);
    const m      = total % 60;
    const mStr   = String(m).padStart(2, '0');

    if (THEME === 'mario') updateMarioUI(data, total, breaks, left, pct, h, mStr);
    else                   updateSpiderUI(data, total, breaks, left, pct, h, mStr);
}

// ─────────────────────────────────────────────────────
// MUTATION OBSERVER
// ─────────────────────────────────────────────────────

function startObservers() {
    new MutationObserver(() => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(updateUI, 800);
    }).observe(document.body, { childList:true, subtree:true });
}

// ─────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────

if (THEME === 'spiderman') createSpiderUI();

updateUI();
setInterval(updateUI, SCAN_INTERVAL_MS);
startObservers();

console.log(
    `%c🕷️ KEKA HERO TRACKER v3 — THEME: ${THEME}`,
    'color:#ff3d3d;font-size:14px;font-weight:bold;background:#0a0a0a;padding:4px 8px;border-radius:4px;'
);

})();
