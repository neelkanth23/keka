// ╔══════════════════════════════════════════════════════════════╗
// ║   KEKA HERO TRACKER — FIXED BUILD                           ║
// ║   FIX 1: Time calculation now works with modal/popup logs   ║
// ║   FIX 2: Spider-Man flips direction when swinging back      ║
// ╚══════════════════════════════════════════════════════════════╝

(function () {

'use strict';

if (window.__KEKA_HERO_TRACKER__) {
    console.log('Already running.');
    return;
}

window.__KEKA_HERO_TRACKER__ = true;

// ─────────────────────────────────────────────────────
// THEME SELECTOR
// ─────────────────────────────────────────────────────

const TODAY_DATE = new Date().getDate();

const THEME =
    (TODAY_DATE % 2 === 0)
        ? 'spiderman'
        : 'mario';

// ─────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────

const WORK_MINUTES = 8 * 60;

const HALF_DAY_MINUTES = 4 * 60;

const SCAN_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────────────
// GLOBALS
// ─────────────────────────────────────────────────────

let refs = {};

let previousCoinState = -1;

let completedMission = false;

let mutationTimer = null;

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

function setIfChanged(el, val) {

    if (!el) return;

    if (el.textContent === val) return;

    el.textContent = val;
}

function parseTimeToMinutes(ts) {

    if (!ts || /^missing$/i.test(ts.trim())) {
        return null;
    }

    const cleaned =
        ts
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

    // ✅ FIX: Allow optional space between time and am/pm
    // Matches "10:13am", "10:13 am", "02:06pm", "02:06 pm"
    const match =
        cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);

    if (!match) return null;

    let H = parseInt(match[1], 10);

    const M = parseInt(match[2], 10);

    const ap = match[3];

    if (ap === 'pm' && H !== 12) H += 12;

    if (ap === 'am' && H === 12) H = 0;

    return H * 60 + M;
}

function minutesBetween(startStr, endStr) {

    const s = parseTimeToMinutes(startStr);

    const e = parseTimeToMinutes(endStr);

    if (s === null || e === null) return 0;

    let diff = e - s;

    if (diff < 0) {
        diff += 24 * 60;
    }

    if (diff <= 0 || diff > 720) return 0;

    return diff;
}

function liveMinutesFrom(startStr) {

    const s = parseTimeToMinutes(startStr);

    if (s === null) return 0;

    const now = new Date();

    const nowMins =
        now.getHours() * 60 +
        now.getMinutes();

    let diff = nowMins - s;

    if (diff < 0) {
        diff += 24 * 60;
    }

    if (diff <= 0 || diff > 840) return 0;

    return diff;
}

function fmtTime(d) {

    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).toUpperCase();
}

// ─────────────────────────────────────────────────────
// ✅ FIXED KEKA PARSER
// Previously only searched inside an element whose direct
// innerText === 'biometric logs'. Keka renders the logs
// inside a modal/popup with additional wrapper divs, so
// the parent match was too narrow.
//
// New approach:
//  1. Find ANY element whose trimmed text is exactly
//     "Biometric Logs" (case-insensitive).
//  2. Walk UP to a reasonable container that also contains
//     the time stamps (look at siblings / ancestors).
//  3. Extract all time tokens from that container.
// ─────────────────────────────────────────────────────

function extractLogPairs() {

    const pairs = [];

    // ── Step 1: locate the "Biometric Logs" label ──────
    let labelEl = null;

    const allEls = document.querySelectorAll('*');

    for (const el of allEls) {

        // Only look at leaf-ish nodes to avoid false positives
        if (el.children.length > 6) continue;

        const txt = (el.innerText || el.textContent || '').trim();

        if (/^biometric\s+logs$/i.test(txt)) {
            labelEl = el;
            break;
        }
    }

    if (!labelEl) {
        // ── Fallback: scan whole document for time pairs ──
        // This catches cases where the modal text is all
        // in one big innerText blob.
        const bodyText = document.body.innerText || '';
        const allTimes = [
            ...bodyText.matchAll(/\b(\d{1,2}:\d{2}\s?(?:am|pm))\b/gi)
        ].map(m => m[1].replace(/\s/g, ' ').trim());

        if (allTimes.length >= 2) {
            for (let i = 0; i < allTimes.length; i += 2) {
                pairs.push({
                    s: allTimes[i],
                    e: allTimes[i + 1] || 'MISSING'
                });
            }
        }

        return pairs;
    }

    // ── Step 2: walk up ancestors to find a container ──
    // that has at least 2 time-like strings in its text.
    let container = labelEl;

    for (let depth = 0; depth < 8; depth++) {

        container = container.parentElement;

        if (!container) break;

        const text = container.innerText || '';

        const found = text.match(/\b\d{1,2}:\d{2}\s?(?:am|pm)\b/gi);

        if (found && found.length >= 2) break;
    }

    if (!container) return pairs;

    // ── Step 3: extract all time tokens from container ──
    const matches = [
        ...container.innerText.matchAll(
            /\b(\d{1,2}:\d{2}\s?(?:am|pm))\b/gi
        )
    ].map(m => m[1].replace(/\s+/g, ' ').trim());

    if (!matches.length) return pairs;

    for (let i = 0; i < matches.length; i += 2) {

        pairs.push({
            s: matches[i],
            e: matches[i + 1] || 'MISSING'
        });
    }

    return pairs;
}

// ─────────────────────────────────────────────────────
// PROCESS LOGS
// ─────────────────────────────────────────────────────

function processLogs() {

    const pairs = extractLogPairs();

    let totalM = 0;

    let breakM = 0;

    let firstStart = null;

    let prevEnd = null;

    let activeStart = null;

    pairs.forEach(({ s, e }, idx) => {

        if (parseTimeToMinutes(s) === null) return;

        if (firstStart === null) {
            firstStart = s;
        }

        if (
            idx > 0 &&
            prevEnd &&
            prevEnd !== 'MISSING'
        ) {

            const b = minutesBetween(prevEnd, s);

            if (b > 0) breakM += b;
        }

        const isMissing = (
            e === 'MISSING' ||
            !e ||
            parseTimeToMinutes(e) === null
        );

        if (isMissing) {

            activeStart = s;

        } else {

            const sessionMins = minutesBetween(s, e);

            if (sessionMins > 0) {
                totalM += sessionMins;
            }

            prevEnd = e;

            activeStart = null;
        }

    });

    if (activeStart) {

        const live = liveMinutesFrom(activeStart);

        if (live > 0) {
            totalM += live;
        }
    }

    window.KekaHoursLatest = {
        totalMinutes: totalM,
        breakMinutes: breakM,
        firstStart
    };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   MARIO SYSTEM — PART 2                                     ║
// ╚══════════════════════════════════════════════════════════════╝

function injectMarioStyles() {

    if (document.getElementById('kekaMarioStyles')) return;

    const style = document.createElement('style');

    style.id = 'kekaMarioStyles';

    style.textContent = `

@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');

#kekaMario *{
    box-sizing:border-box;
    margin:0;
    padding:0;
    font-family:'Nunito',sans-serif;
}

@keyframes km-slidein{
    from{ transform:translateX(120%) scale(.96); opacity:0; }
    to{ transform:translateX(0) scale(1); opacity:1; }
}

@keyframes km-soft-glow{
    0%,100%{ filter:drop-shadow(0 18px 30px rgba(0,0,0,.20)); }
    50%{ filter:drop-shadow(0 22px 38px rgba(255,214,0,.24)); }
}

@keyframes km-progress-stripe{
    from{ background-position:0 0; }
    to{ background-position:34px 0; }
}

@keyframes km-coin-pop{
    0%,100%{ transform:translateY(0) scale(1); }
    50%{ transform:translateY(-3px) scale(1.08); }
}

@keyframes km-cloud{
    from{ transform:translateX(-20px); }
    to{ transform:translateX(20px); }
}

@keyframes km-run{
    0%{ left:-50px; }
    100%{ left:420px; }
}

@keyframes km-goomba{
    0%{ left:420px; }
    100%{ left:-60px; }
}

`;

    document.head.appendChild(style);
}

function px(ctx, S, x, y, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x * S, y * S, S, S);
}

function drawMarioFrame(ctx, frame) {

    ctx.clearRect(0, 0, 40, 52);

    const S = 4;
    const R = '#e52213';
    const B = '#0052a2';
    const SK = '#fba86f';
    const SH = '#5e1205';

    const d = (x, y, c) => px(ctx, S, x, y, c);

    [[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],
    [2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]
    ].forEach(p => d(...p));

    [[1,2,SH],[2,2,SH],[3,2,SH]].forEach(p => d(...p));

    [[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],
    [1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK]
    ].forEach(p => d(...p));

    d(3,3,SH); d(7,3,SH);

    [[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B]
    ].forEach(p => d(...p));

    (frame % 2 === 0
        ? [[2,10,B],[3,10,B],[7,10,B],[8,10,B]]
        : [[1,10,B],[2,10,B],[8,10,B],[9,10,B]]
    ).forEach(p => d(...p));
}

function drawGoombaFrame(ctx) {

    ctx.clearRect(0, 0, 36, 36);

    const S = 4;
    const GB = '#795548';
    const d = (x, y, c) => px(ctx, S, x, y, c);

    [[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
    [0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB]
    ].forEach(p => d(...p));
}

function buildMarioCoins(pct) {

    const TOTAL = 17;

    const lit = Math.round((pct / 100) * TOTAL);

    if (lit === previousCoinState) return;

    previousCoinState = lit;

    const wrap = refs.coins;

    if (!wrap) return;

    wrap.innerHTML = '';

    for (let i = 0; i < TOTAL; i++) {

        const c = document.createElement('div');

        const on = i < lit;

        c.style.cssText = on
            ? `width:18px;height:18px;border-radius:50%;flex-shrink:0;
               background:radial-gradient(circle at 35% 28%,#fffde7,#ffd600 38%,#c67c00 72%,#7a4500 100%);
               border:2.5px solid #fff;
               animation:km-coin-pop 2.4s ease-in-out infinite ${i * .06}s;`
            : `width:18px;height:18px;border-radius:50%;flex-shrink:0;
               background:rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.22);`;

        wrap.appendChild(c);
    }
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
        animation:km-slidein .65s cubic-bezier(.34,1.4,.64,1) forwards,km-soft-glow 4s ease-in-out infinite .9s;
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
      <div id="kmProgress" style="height:100%;width:0%;border-radius:999px;background:repeating-linear-gradient(45deg,#ffd600 0,#ffd600 8px,#f9a825 8px,#f9a825 16px);animation:km-progress-stripe 1.4s linear infinite;"></div>
    </div>
    <div id="kmVibe" style="margin-top:10px;font-size:10px;font-style:italic;font-weight:800;color:rgba(26,35,126,.58);text-align:center;">"kaam sharu kar..."</div>
  </div>
</div>
<div style="background:linear-gradient(180deg,#ef3033 0%,#d71920 100%);padding:14px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <div style="font-size:10px;font-weight:900;letter-spacing:.18em;color:rgba(255,255,255,.7);">COINS TO FREEDOM</div>
    <div id="kmPct" style="font-size:14px;font-weight:900;color:#ffe566;">0%</div>
  </div>
  <div id="kmCoins" style="display:flex;gap:4px;"></div>
</div>
`;

    document.body.appendChild(widget);

    refs = {
        widget,
        hours: widget.querySelector('#kmHours'),
        mins: widget.querySelector('#kmMins'),
        pct: widget.querySelector('#kmPct'),
        progress: widget.querySelector('#kmProgress'),
        vibe: widget.querySelector('#kmVibe'),
        coins: widget.querySelector('#kmCoins')
    };

    const mc = document.getElementById('kmMarioSprite');
    const gc = document.getElementById('kmGoomba');
    const mCtx = mc.getContext('2d');
    const gCtx = gc.getContext('2d');

    let frame = 0;

    function loop() {
        frame++;
        drawMarioFrame(mCtx, frame);
        drawGoombaFrame(gCtx);
        requestAnimationFrame(loop);
    }

    loop();

    buildMarioCoins(0);
}

function updateMarioUI(data, total, breaks, left, pct, h, mStr) {

    setIfChanged(refs.hours, String(h));
    setIfChanged(refs.mins, mStr);
    setIfChanged(refs.pct, `${pct}%`);

    refs.progress.style.width = `${pct}%`;

    if (pct >= 100) {
        refs.vibe.textContent = '"nikal gayo bhai..."';
    } else if (pct >= 75) {
        refs.vibe.textContent = '"castle najik che..."';
    } else if (pct >= 50) {
        refs.vibe.textContent = '"aadho grind thai gayo..."';
    } else {
        refs.vibe.textContent = '"coins collect thai rahya che..."';
    }

    buildMarioCoins(pct);
}

if (THEME === 'mario') {
    createMarioUI();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   SPIDER HUD — PART 3 (with direction fix)                  ║
// ╚══════════════════════════════════════════════════════════════╝

const SPIDER_PNG =
    'https://raw.githubusercontent.com/neelkanth23/keka/main/spidermon.png';

function injectSpiderStyles() {

    if (document.getElementById('kekaSpiderStyles')) return;

    const style = document.createElement('style');

    style.id = 'kekaSpiderStyles';

    style.textContent = `

@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;700&display=swap');

#kekaSpider *{ box-sizing:border-box; margin:0; padding:0; }

@keyframes sp-slidein{
    from{ transform:translateX(120%) scale(.96); opacity:0; }
    to{ transform:translateX(0) scale(1); opacity:1; }
}

@keyframes sp-spin{ to{ transform:rotate(360deg); } }
@keyframes sp-spin-rev{ to{ transform:rotate(-360deg); } }

@keyframes sp-glow{
    0%,100%{ box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42); }
    50%{ box-shadow:0 0 40px rgba(255,80,80,.28),0 25px 80px rgba(0,0,0,.52); }
}

@keyframes sp-float{
    0%,100%{ transform:translateY(0); }
    50%{ transform:translateY(-8px); }
}

@keyframes sp-shimmer{
    0%{ transform:translateX(-140%) rotate(18deg); }
    100%{ transform:translateX(180%) rotate(18deg); }
}

@keyframes sp-complete{
    0%,100%{ box-shadow:0 0 30px rgba(34,197,94,.25),0 20px 70px rgba(0,0,0,.45); }
    50%{ box-shadow:0 0 60px rgba(34,197,94,.45),0 20px 90px rgba(0,0,0,.55); }
}

/* ✅ FIX: Spider-Man swings left→right, image is flipped at midpoint
   so he always faces the direction of travel.
   We use a JS-driven approach (see startSwingAnimation) instead of
   a pure CSS keyframe, because CSS @keyframes can't conditionally
   apply scaleX(-1) at the halfway point. */

#spSwinger {
    position: absolute;
    top: 30px;
    left: -150px;
    width: 150px;
    height: auto;
    z-index: 4;
    pointer-events: none;
    transform-origin: top center;
    filter:
        drop-shadow(0 10px 18px rgba(0,0,0,.45))
        drop-shadow(0 0 18px rgba(255,60,60,.18));
    /* No CSS animation — JS controls position & flip */
    transition: none;
}

.sp-complete{
    animation: sp-complete 1.8s ease-in-out infinite !important;
}

`;

    document.head.appendChild(style);
}

function createSpiderUI() {

    injectSpiderStyles();

    if (document.getElementById('kekaSpider')) return;

    const widget = document.createElement('div');

    widget.id = 'kekaSpider';

    widget.style.cssText = `
        position:fixed;top:20px;right:20px;z-index:2147483646;
        width:390px;height:560px;border-radius:34px;overflow:hidden;
        background:linear-gradient(180deg,#ff9966 0%,#ff7e5f 18%,#f76b1c 34%,#355c7d 68%,#1d2b64 100%);
        box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42);
        animation:sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards,sp-glow 4s ease-in-out infinite;
        backdrop-filter:blur(10px);
    `;

    widget.innerHTML = `
<canvas id="spidermanCanvas" style="position:absolute;inset:0;opacity:.95;"></canvas>

<!-- ✅ Spider-Man image — JS will animate position & flip -->
<img id="spSwinger" src="${SPIDER_PNG}" alt="Spider-Man" />

<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.30));"></div>

<!-- TOP BAR -->
<div style="position:absolute;top:18px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:center;z-index:5;">
  <div>
    <div style="font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;letter-spacing:3px;color:white;">SPIDER HUD</div>
    <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.72);margin-top:2px;">EARTH-616 • NYC</div>
  </div>
  <div style="display:flex;gap:8px;">
    <button id="spMin" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:white;font-size:18px;cursor:pointer;backdrop-filter:blur(8px);">−</button>
    <button id="spClose" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:white;font-size:16px;cursor:pointer;backdrop-filter:blur(8px);">×</button>
  </div>
</div>

<!-- CONTENT -->
<div id="spContent" style="position:absolute;top:90px;left:18px;right:18px;bottom:18px;display:flex;flex-direction:column;">

  <!-- REACTOR -->
  <div style="position:relative;width:170px;height:170px;margin:0 auto;animation:sp-float 4s ease-in-out infinite;">
    <svg viewBox="0 0 170 170" style="position:absolute;inset:0;">
      <circle cx="85" cy="85" r="62" stroke="rgba(255,255,255,.12)" stroke-width="5" fill="none"/>
      <circle id="spProgressCircle" cx="85" cy="85" r="62" stroke="url(#spGrad)" stroke-width="10" fill="none" stroke-linecap="round" transform="rotate(-90 85 85)" stroke-dasharray="390" stroke-dashoffset="390"/>
      <defs>
        <linearGradient id="spGrad">
          <stop offset="0%" stop-color="#ff3d3d"/>
          <stop offset="100%" stop-color="#3da5ff"/>
        </linearGradient>
      </defs>
      <g style="animation:sp-spin 16s linear infinite;transform-origin:center;">
        <circle cx="85" cy="85" r="74" stroke="rgba(255,255,255,.18)" stroke-dasharray="10 12" stroke-width="2" fill="none"/>
      </g>
      <g style="animation:sp-spin-rev 10s linear infinite;transform-origin:center;">
        <circle cx="85" cy="85" r="50" stroke="rgba(255,0,0,.38)" stroke-dasharray="8 10" stroke-width="2" fill="none"/>
      </g>
    </svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
      <div id="spHours" style="font-size:46px;font-weight:900;line-height:1;color:white;text-shadow:0 0 18px rgba(255,255,255,.65),0 0 30px rgba(255,0,0,.4);">0h</div>
      <div id="spMins" style="font-size:18px;letter-spacing:3px;color:#9fd3ff;">00m</div>
    </div>
  </div>

  <!-- STATS -->
  <div style="margin-top:22px;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:18px;backdrop-filter:blur(14px);position:relative;overflow:hidden;">
    <div style="position:absolute;top:-30px;left:-70px;width:80px;height:180px;background:rgba(255,255,255,.18);animation:sp-shimmer 6s linear infinite;"></div>
    <div style="position:relative;z-index:2;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">REMAINING</div>
          <div id="spRemaining" style="font-size:24px;font-weight:700;color:white;margin-top:5px;">0h</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">BREAK</div>
          <div id="spBreak" style="font-size:24px;font-weight:700;color:white;margin-top:5px;">0m</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">HALF DAY</div>
          <div id="spHalf" style="font-size:20px;font-weight:700;color:white;margin-top:5px;">--</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">MISSION END</div>
          <div id="spFull" style="font-size:20px;font-weight:700;color:white;margin-top:5px;">--</div>
        </div>
      </div>
      <div id="spMission" style="margin-top:18px;padding:14px;border-radius:18px;background:linear-gradient(90deg,rgba(255,0,0,.16),rgba(0,120,255,.16));font-size:14px;line-height:1.5;color:white;">
        Swinging through Manhattan...
      </div>
    </div>
  </div>

</div>
`;

    document.body.appendChild(widget);

    refs = {
        widget,
        hours: widget.querySelector('#spHours'),
        mins: widget.querySelector('#spMins'),
        remaining: widget.querySelector('#spRemaining'),
        breakEl: widget.querySelector('#spBreak'),
        half: widget.querySelector('#spHalf'),
        full: widget.querySelector('#spFull'),
        mission: widget.querySelector('#spMission'),
        progress: widget.querySelector('#spProgressCircle'),
        content: widget.querySelector('#spContent')
    };

    // ── Buttons ──────────────────────────────────────────
    const minBtn = widget.querySelector('#spMin');
    const closeBtn = widget.querySelector('#spClose');

    let minimized = false;

    minBtn.addEventListener('click', () => {
        minimized = !minimized;
        refs.content.style.display = minimized ? 'none' : 'flex';
        widget.style.height = minimized ? '82px' : '560px';
        minBtn.textContent = minimized ? '+' : '−';
    });

    closeBtn.addEventListener('click', () => {
        widget.remove();
        window.__KEKA_HERO_TRACKER__ = false;
    });

    // ── Background ───────────────────────────────────────
    startSpiderBackground();

    // ── ✅ FIX: JS-driven swing animation with direction flip ──
    startSwingAnimation();
}

// ─────────────────────────────────────────────────────
// ✅ FIX: Spider-Man swing — JS-driven so we can flip
// the image horizontally when he's moving right→left.
//
// The widget is 390px wide. Spider-Man image is 150px.
// We animate `left` from -150 → 390 (L→R), then 390 → -150 (R→L).
// When going R→L, we apply scaleX(-1) to face left.
// ─────────────────────────────────────────────────────

function startSwingAnimation() {

    const img = document.getElementById('spSwinger');

    if (!img) return;

    const WIDGET_W = 390;
    const IMG_W = 150;
    const START = -IMG_W;           // left edge, off-screen
    const END = WIDGET_W;           // right edge, off-screen
    const CYCLE_MS = 9000;          // total round-trip time
    const HALF_MS = CYCLE_MS / 2;   // time for one direction

    let startTime = null;

    function tick(now) {

        if (!startTime) startTime = now;

        const elapsed = (now - startTime) % CYCLE_MS;

        let left, scaleX, tiltDeg;

        if (elapsed < HALF_MS) {

            // ── LEFT → RIGHT ──
            const t = elapsed / HALF_MS;           // 0..1
            const ease = easeInOut(t);

            left = START + (END - START) * ease;

            // Facing right = normal orientation
            scaleX = 1;

            // Gentle tilt: leans forward (clockwise) when going right
            tiltDeg = -15 + Math.sin(t * Math.PI) * 20;

        } else {

            // ── RIGHT → LEFT ──
            const t = (elapsed - HALF_MS) / HALF_MS; // 0..1
            const ease = easeInOut(t);

            left = END + (START - END) * ease;

            // Facing left = flip horizontally
            scaleX = -1;

            // Mirror tilt
            tiltDeg = 15 - Math.sin(t * Math.PI) * 20;
        }

        // Slight vertical arc (parabolic swing feel)
        const swingT = elapsed / CYCLE_MS;
        const topOffset = 20 + Math.abs(Math.sin(swingT * Math.PI * 2)) * 30;

        img.style.left = `${left}px`;
        img.style.top = `${topOffset}px`;
        img.style.transform = `scaleX(${scaleX}) rotate(${tiltDeg}deg)`;

        // Keep the filter on img style (overrides the CSS)
        img.style.filter =
            'drop-shadow(0 10px 18px rgba(0,0,0,.45)) drop-shadow(0 0 18px rgba(255,60,60,.18))';

        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

function easeInOut(t) {
    // Smooth cubic ease-in-out
    return t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t;
}

// ─────────────────────────────────────────────────────
// BACKGROUND ENGINE
// ─────────────────────────────────────────────────────

function startSpiderBackground() {

    const canvas = document.getElementById('spidermanCanvas');

    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    let w = canvas.width = 390;
    let h = canvas.height = 560;

    const buildings = [];

    for (let i = 0; i < 20; i++) {
        buildings.push({
            x: i * 20,
            y: h - (100 + Math.random() * 180),
            w: 20 + Math.random() * 24,
            h: 100 + Math.random() * 160
        });
    }

    let t = 0;

    function render() {

        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,255,255,.05)';

        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(
                (i * 120 + t * .2) % (w + 200) - 100,
                90 + Math.sin(i + t * .002) * 12,
                40, 0, Math.PI * 2
            );
            ctx.fill();
        }

        buildings.forEach(b => {

            const g = ctx.createLinearGradient(0, b.y, 0, h);
            g.addColorStop(0, 'rgba(20,20,40,.85)');
            g.addColorStop(1, 'rgba(10,10,20,1)');
            ctx.fillStyle = g;
            ctx.fillRect(b.x, b.y, b.w, b.h);

            for (let wy = b.y + 8; wy < h; wy += 14) {
                for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 12) {
                    if (Math.random() > .72) {
                        ctx.fillStyle = Math.random() > .5
                            ? 'rgba(255,190,80,.7)'
                            : 'rgba(120,180,255,.6)';
                        ctx.fillRect(wx, wy, 4, 6);
                    }
                }
            }
        });

        for (let i = 0; i < 10; i++) {
            ctx.strokeStyle = i % 2
                ? 'rgba(255,80,80,.35)'
                : 'rgba(255,255,180,.28)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const yy = h - 40 + Math.sin(i) * 6;
            ctx.moveTo((i * 60 + t * 1.4) % (w + 100) - 100, yy);
            ctx.lineTo((i * 60 + t * 1.4) % (w + 100) - 40, yy);
            ctx.stroke();
        }

        t++;

        requestAnimationFrame(render);
    }

    render();
}

// ─────────────────────────────────────────────────────
// UPDATE SPIDER UI
// ─────────────────────────────────────────────────────

function updateSpiderUI(data, total, breaks, left, pct, h, mStr) {

    setIfChanged(refs.hours, `${h}h`);
    setIfChanged(refs.mins, `${mStr}m`);
    setIfChanged(refs.remaining, `${Math.floor(left / 60)}h`);
    setIfChanged(refs.breakEl, `${breaks}m`);

    const circumference = 390;

    refs.progress.style.strokeDashoffset =
        circumference - (pct / 100) * circumference;

    if (pct < 25) {
        refs.mission.textContent = 'Entering Manhattan patrol route.';
    } else if (pct < 50) {
        refs.mission.textContent = 'Spider-Sense activated across NYC.';
    } else if (pct < 75) {
        refs.mission.textContent = 'Swinging through Midtown at full speed.';
    } else if (pct < 100) {
        refs.mission.textContent = 'Final villain chase sequence active.';
    } else {
        refs.mission.textContent = 'MISSION COMPLETE. Manhattan secured.';
    }

    if (data.firstStart) {

        const s = parseTimeToMinutes(data.firstStart);

        if (s !== null) {

            const base = new Date();

            base.setHours(Math.floor(s / 60), s % 60, 0, 0);

            const half = new Date(
                base.getTime() + (HALF_DAY_MINUTES + breaks) * 60000
            );

            const full = new Date(
                base.getTime() + (WORK_MINUTES + breaks) * 60000
            );

            setIfChanged(refs.half, fmtTime(half));
            setIfChanged(refs.full, fmtTime(full));
        }
    }

    if (pct >= 100 && !completedMission) {
        completedMission = true;
        refs.widget.classList.add('sp-complete');
    }
}

// ─────────────────────────────────────────────────────
// MASTER UPDATE
// ─────────────────────────────────────────────────────

function updateUI() {

    processLogs();

    const data = window.KekaHoursLatest || {
        totalMinutes: 0,
        breakMinutes: 0,
        firstStart: null
    };

    const total = Math.max(0, data.totalMinutes || 0);
    const breaks = Math.max(0, data.breakMinutes || 0);
    const left = Math.max(0, WORK_MINUTES - total);
    const pct = Math.min(100, Math.round((total / WORK_MINUTES) * 100));

    const h = Math.floor(total / 60);
    const m = total % 60;
    const mStr = String(m).padStart(2, '0');

    if (THEME === 'mario') {
        updateMarioUI(data, total, breaks, left, pct, h, mStr);
    } else {
        updateSpiderUI(data, total, breaks, left, pct, h, mStr);
    }
}

// ─────────────────────────────────────────────────────
// OBSERVER
// ─────────────────────────────────────────────────────

function startObservers() {

    const observer = new MutationObserver(() => {
        clearTimeout(mutationTimer);
        mutationTimer = setTimeout(() => { updateUI(); }, 1000);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────

if (THEME === 'spiderman') {
    createSpiderUI();
}

updateUI();

setInterval(updateUI, SCAN_INTERVAL_MS);

startObservers();

console.log(
    '%c🕷️ KEKA HERO TRACKER LOADED (FIXED)',
    'color:#ff3d3d;font-size:16px;font-weight:bold;'
);

})();
