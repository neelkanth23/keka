// ╔══════════════════════════════════════════════════════════════╗
// ║   KEKA HERO TRACKER — v4                                    ║
// ║   UI: Original orange sunset NYC sky restored               ║
// ║   Spider-Man: JS swing, L→R only (resets), always faces R  ║
// ║   Calc: v3 precision kept (RANGE_RE, fmtMinutes)            ║
// ║   Bottom: animated web-shooter canvas instead of plain box  ║
// ╚══════════════════════════════════════════════════════════════╝

(function () {

'use strict';

if (window.__KEKA_HERO_TRACKER__) { console.log('[KHT] Already running.'); return; }
window.__KEKA_HERO_TRACKER__ = true;

// ─────────────────────────────────────────────────────
// THEME
// ─────────────────────────────────────────────────────

const THEME = (new Date().getDate() % 2 === 0) ? 'spiderman' : 'mario';

// ─────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────

const WORK_MINUTES     = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;
const SCAN_INTERVAL_MS = 5000;

// ─────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────

let refs              = {};
let previousCoinState = -1;
let missionDone       = false;
let mutationTimer     = null;

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

function setIfChanged(el, val) {
    if (!el || el.textContent === val) return;
    el.textContent = val;
}

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

function minutesBetween(startStr, endStr) {
    const s = parseTimeToMinutes(startStr);
    const e = parseTimeToMinutes(endStr);
    if (s === null || e === null) return 0;
    const diff = e - s;
    if (diff <= 0 || diff > 840) return 0;
    return diff;
}

function liveMinutesFrom(startStr) {
    const s = parseTimeToMinutes(startStr);
    if (s === null) return 0;
    const now  = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const diff = nowM - s;
    if (diff < 0 || diff > 840) return 0;
    return diff;
}

function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true
    }).toUpperCase();
}

function fmtMinutes(totalM) {
    const h = Math.floor(totalM / 60);
    const m = totalM % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────────────
// LOG PARSER  (v3 — strips shift-range, strict anchor)
// ─────────────────────────────────────────────────────

const TIME_RE  = /\b(\d{1,2}:\d{2}\s*(?:am|pm))\b/gi;
const RANGE_RE = /\d{1,2}:\d{2}\s*(?:am|pm)\s*[-–]\s*\d{1,2}:\d{2}\s*(?:am|pm)/gi;

function extractLogPairs() {
    const pairs = [];
    let labelEl = null;
    for (const el of document.querySelectorAll('*')) {
        if (el.children.length > 8) continue;
        const txt = (el.innerText || el.textContent || '').trim();
        if (/^biometric\s+logs$/i.test(txt)) { labelEl = el; break; }
    }
    if (!labelEl) { console.log('[KHT] Biometric Logs not found.'); return pairs; }

    let container = labelEl;
    for (let depth = 0; depth < 10; depth++) {
        const parent = container.parentElement;
        if (!parent) break;
        const cleaned = (parent.innerText || '').replace(RANGE_RE, '');
        const found   = cleaned.match(TIME_RE);
        if (found && found.length >= 2) { container = parent; break; }
        container = parent;
    }

    const rawText = (container.innerText || '').replace(RANGE_RE, '');
    const tokens  = [...rawText.matchAll(TIME_RE)].map(m => m[1].trim().replace(/\s+/g, ''));
    if (!tokens.length) return pairs;
    for (let i = 0; i < tokens.length; i += 2) {
        pairs.push({ s: tokens[i], e: tokens[i+1] || 'MISSING' });
    }
    console.log('[KHT] pairs:', JSON.stringify(pairs));
    return pairs;
}

function processLogs() {
    const pairs = extractLogPairs();
    let totalM = 0, breakM = 0, firstStart = null, prevEnd = null, activeStart = null;

    pairs.forEach(({ s, e }, idx) => {
        if (parseTimeToMinutes(s) === null) return;
        if (!firstStart) firstStart = s;
        if (idx > 0 && prevEnd && prevEnd !== 'MISSING') {
            const b = minutesBetween(prevEnd, s);
            if (b > 0) breakM += b;
        }
        const missing = (e === 'MISSING' || parseTimeToMinutes(e) === null);
        if (missing) {
            activeStart = s;
        } else {
            const sess = minutesBetween(s, e);
            if (sess > 0) totalM += sess;
            prevEnd = e; activeStart = null;
        }
    });

    if (activeStart) {
        const live = liveMinutesFrom(activeStart);
        if (live > 0) totalM += live;
    }
    console.log(`[KHT] total=${totalM} break=${breakM} first=${firstStart}`);
    window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║   MARIO                                                     ║
// ╚══════════════════════════════════════════════════════════════╝

function injectMarioStyles() {
    if (document.getElementById('kekaMarioStyles')) return;
    const s = document.createElement('style');
    s.id = 'kekaMarioStyles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
#kekaMario *{ box-sizing:border-box; margin:0; padding:0; font-family:'Nunito',sans-serif; }
@keyframes km-slidein{ from{ transform:translateX(120%) scale(.96); opacity:0; } to{ transform:translateX(0) scale(1); opacity:1; } }
@keyframes km-soft-glow{ 0%,100%{ filter:drop-shadow(0 18px 30px rgba(0,0,0,.20)); } 50%{ filter:drop-shadow(0 22px 38px rgba(255,214,0,.24)); } }
@keyframes km-progress-stripe{ from{ background-position:0 0; } to{ background-position:34px 0; } }
@keyframes km-coin-pop{ 0%,100%{ transform:translateY(0) scale(1); } 50%{ transform:translateY(-3px) scale(1.08); } }
@keyframes km-cloud{ from{ transform:translateX(-20px); } to{ transform:translateX(20px); } }
@keyframes km-run{ 0%{ left:-50px; } 100%{ left:420px; } }
@keyframes km-goomba{ 0%{ left:420px; } 100%{ left:-60px; } }
@keyframes km-pop-in{ 0%{ transform:translateY(60px) scale(.7); opacity:0; } 60%{ transform:translateY(-8px) scale(1.08); opacity:1; } 100%{ transform:translateY(0) scale(1); opacity:1; } }
@keyframes km-pop-out{ from{ transform:translateY(0) scale(1); opacity:1; } to{ transform:translateY(60px) scale(.7); opacity:0; } }
#kmAchieve{ position:fixed; bottom:20px; right:20px; z-index:2147483647; background:linear-gradient(135deg,#ffd600,#ff6d00); color:#1a237e; font-family:'Nunito',sans-serif; font-weight:900; font-size:15px; padding:14px 20px; border-radius:20px; box-shadow:0 8px 30px rgba(0,0,0,.35); display:flex; align-items:center; gap:10px; pointer-events:none; animation:km-pop-in .5s cubic-bezier(.34,1.4,.64,1) forwards; }
#kmAchieve.out{ animation:km-pop-out .4s ease-in forwards; }
`;
    document.head.appendChild(s);
}

function px(ctx, S, x, y, c) { ctx.fillStyle=c; ctx.fillRect(x*S,y*S,S,S); }

function drawMarioFrame(ctx, frame) {
    ctx.clearRect(0,0,40,52);
    const S=4,R='#e52213',B='#0052a2',SK='#fba86f',SH='#5e1205';
    const d=(x,y,c)=>px(ctx,S,x,y,c);
    [[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],[2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]].forEach(p=>d(...p));
    [[1,2,SH],[2,2,SH],[3,2,SH]].forEach(p=>d(...p));
    [[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],[1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK]].forEach(p=>d(...p));
    d(3,3,SH); d(7,3,SH);
    [[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B]].forEach(p=>d(...p));
    (frame%2===0?[[2,10,B],[3,10,B],[7,10,B],[8,10,B]]:[[1,10,B],[2,10,B],[8,10,B],[9,10,B]]).forEach(p=>d(...p));
}

function drawGoombaFrame(ctx) {
    ctx.clearRect(0,0,36,36);
    const S=4,GB='#795548',d=(x,y,c)=>px(ctx,S,x,y,c);
    [[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],[0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB]].forEach(p=>d(...p));
}

function buildMarioCoins(pct) {
    const TOTAL=17, lit=Math.round((pct/100)*TOTAL);
    if (lit===previousCoinState) return;
    previousCoinState=lit;
    const wrap=refs.coins; if (!wrap) return;
    wrap.innerHTML='';
    for (let i=0;i<TOTAL;i++) {
        const c=document.createElement('div');
        c.style.cssText = i<lit
            ? `width:18px;height:18px;border-radius:50%;flex-shrink:0;background:radial-gradient(circle at 35% 28%,#fffde7,#ffd600 38%,#c67c00 72%,#7a4500 100%);border:2.5px solid #fff;animation:km-coin-pop 2.4s ease-in-out infinite ${i*.06}s;`
            : `width:18px;height:18px;border-radius:50%;flex-shrink:0;background:rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.22);`;
        wrap.appendChild(c);
    }
}

function showMarioAchievement() {
    if (document.getElementById('kmAchieve')) return;
    const el=document.createElement('div'); el.id='kmAchieve';
    el.innerHTML=`<span style="font-size:26px;">🏆</span><div><div style="font-size:12px;opacity:.7;margin-bottom:2px;">ACHIEVEMENT UNLOCKED</div>FULL DAY GRIND COMPLETE!</div>`;
    document.body.appendChild(el);
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),500); },5000);
}

function createMarioUI() {
    injectMarioStyles();
    if (document.getElementById('kekaMario')) return;
    const widget=document.createElement('div'); widget.id='kekaMario';
    widget.style.cssText=`position:fixed;top:20px;right:20px;z-index:2147483646;width:370px;border-radius:28px;overflow:hidden;background:#e8282b;box-shadow:0 0 0 4px #fff,0 0 0 8px #e8282b,0 0 0 12px #fff,0 24px 70px rgba(0,0,0,.42);animation:km-slidein .65s cubic-bezier(.34,1.4,.64,1) forwards,km-soft-glow 4s ease-in-out infinite .9s;`;
    widget.innerHTML=`
<div style="position:relative;height:240px;overflow:hidden;background:linear-gradient(180deg,#4f8ffc 0%,#78b3ff 58%,#a9d5ff 100%);">
  <svg style="position:absolute;top:18px;left:12px;animation:km-cloud 7s ease-in-out infinite alternate;" width="90" height="46" viewBox="0 0 90 46">
    <ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/><ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/><ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/>
  </svg>
  <div style="position:absolute;left:0;right:0;bottom:0;height:52px;background:#c8860a;"></div>
  <canvas id="kmMarioSprite" width="40" height="52" style="position:absolute;bottom:52px;left:-50px;image-rendering:pixelated;animation:km-run 8s linear infinite;"></canvas>
  <canvas id="kmGoomba" width="36" height="36" style="position:absolute;bottom:52px;left:420px;image-rendering:pixelated;animation:km-goomba 6s linear infinite;"></canvas>
  <div style="position:absolute;top:14px;left:14px;right:14px;background:rgba(255,255,255,.25);backdrop-filter:blur(20px);border:3px solid rgba(255,255,255,.92);border-radius:20px;padding:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-size:13px;font-weight:900;letter-spacing:.06em;color:#1a237e;">GRIND TRACKER</div><div style="font-size:9px;font-weight:800;letter-spacing:.2em;color:rgba(26,35,126,.52);margin-top:2px;">WORLD 8-1</div></div>
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
  <div id="kmCoins" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
</div>`;
    document.body.appendChild(widget);
    refs={ widget, hours:widget.querySelector('#kmHours'), mins:widget.querySelector('#kmMins'), pct:widget.querySelector('#kmPct'), progress:widget.querySelector('#kmProgress'), vibe:widget.querySelector('#kmVibe'), coins:widget.querySelector('#kmCoins') };
    const mc=document.getElementById('kmMarioSprite'), gc=document.getElementById('kmGoomba');
    const mCtx=mc.getContext('2d'), gCtx=gc.getContext('2d');
    let frame=0;
    (function loop(){ frame++; drawMarioFrame(mCtx,frame); drawGoombaFrame(gCtx); requestAnimationFrame(loop); })();
    buildMarioCoins(0);
}

function updateMarioUI(data,total,breaks,left,pct,h,mStr) {
    setIfChanged(refs.hours,String(h)); setIfChanged(refs.mins,mStr); setIfChanged(refs.pct,`${pct}%`);
    refs.progress.style.width=`${pct}%`;
    if (pct>=100) refs.vibe.textContent='"nikal gayo bhai..."';
    else if (pct>=75) refs.vibe.textContent='"castle najik che..."';
    else if (pct>=50) refs.vibe.textContent='"aadho grind thai gayo..."';
    else refs.vibe.textContent='"coins collect thai rahya che..."';
    buildMarioCoins(pct);
    if (pct>=100 && !missionDone) { missionDone=true; showMarioAchievement(); }
}

if (THEME==='mario') createMarioUI();

// ╔══════════════════════════════════════════════════════════════╗
// ║   SPIDER-MAN  — original orange sunset sky, restored        ║
// ╚══════════════════════════════════════════════════════════════╝

const SPIDER_PNG = 'https://raw.githubusercontent.com/neelkanth23/keka/main/spidermon.png';

// PNG is 424×296 (landscape).  We want a good size in the widget.
// Original widget was 390×560. Top animated section ≈ 240px tall.
// We render the image constrained to height 130px → width ≈ 186px.
// Faces RIGHT naturally — always L→R, resets, no flip needed.
const SP_H = 130;
const SP_W = Math.round(SP_H * (424/296));  // ≈ 186

function injectSpiderStyles() {
    if (document.getElementById('kekaSpiderStyles')) return;
    const s = document.createElement('style');
    s.id = 'kekaSpiderStyles';
    s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;700&display=swap');
#kekaSpider *{ box-sizing:border-box; margin:0; padding:0; }

@keyframes sp-slidein{
  from{ transform:translateX(120%) scale(.96); opacity:0; }
  to{   transform:translateX(0) scale(1); opacity:1; }
}
@keyframes sp-spin    { to{ transform:rotate(360deg);  } }
@keyframes sp-spin-rev{ to{ transform:rotate(-360deg); } }
@keyframes sp-glow{
  0%,100%{ box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42); }
  50%{     box-shadow:0 0 45px rgba(255,80,80,.32),0 25px 80px rgba(0,0,0,.55); }
}
@keyframes sp-float{
  0%,100%{ transform:translateY(0);    }
  50%{     transform:translateY(-8px); }
}
@keyframes sp-shimmer{
  0%{   transform:translateX(-140%) rotate(18deg); }
  100%{ transform:translateX(180%)  rotate(18deg); }
}
/* web-shooter canvas for mission area — defined via JS */
@keyframes sp-achieve-in{
  0%{   transform:translateY(60px) scale(.7); opacity:0; }
  60%{  transform:translateY(-8px) scale(1.08); opacity:1; }
  100%{ transform:translateY(0) scale(1); opacity:1; }
}
@keyframes sp-achieve-out{
  from{ transform:translateY(0) scale(1); opacity:1; }
  to{   transform:translateY(60px) scale(.7); opacity:0; }
}
@keyframes sp-complete-glow{
  0%,100%{ box-shadow:0 0 30px rgba(34,197,94,.30),0 20px 70px rgba(0,0,0,.45); }
  50%{     box-shadow:0 0 65px rgba(34,197,94,.55),0 20px 90px rgba(0,0,0,.55); }
}
.sp-complete{ animation:sp-complete-glow 1.8s ease-in-out infinite !important; }
#spAchieve{
  position:fixed; bottom:20px; right:20px; z-index:2147483647;
  background:linear-gradient(135deg,#ff3d3d,#3da5ff); color:white;
  font-family:'Orbitron',sans-serif; font-weight:700; font-size:13px;
  padding:14px 20px; border-radius:20px; box-shadow:0 8px 30px rgba(0,0,0,.40);
  display:flex; align-items:center; gap:10px; pointer-events:none;
  animation:sp-achieve-in .5s cubic-bezier(.34,1.4,.64,1) forwards;
}
#spAchieve.out{ animation:sp-achieve-out .4s ease-in forwards; }
`;
    document.head.appendChild(s);
}

function createSpiderUI() {
    injectSpiderStyles();
    if (document.getElementById('kekaSpider')) return;

    const widget = document.createElement('div');
    widget.id = 'kekaSpider';

    // ── ORIGINAL orange sunset gradient background ──────────────
    widget.style.cssText = `
        position:fixed; top:20px; right:20px; z-index:2147483646;
        width:390px; height:560px; border-radius:34px; overflow:hidden;
        background:linear-gradient(
            180deg,
            #ff9966 0%,
            #ff7e5f 18%,
            #f76b1c 34%,
            #355c7d 68%,
            #1d2b64 100%
        );
        box-shadow:0 0 25px rgba(255,80,80,.18),0 20px 60px rgba(0,0,0,.42);
        animation:sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards,
                  sp-glow 4s ease-in-out infinite;
    `;

    widget.innerHTML = `

<!-- City skyline canvas — fills the WHOLE widget (dark at bottom, transparent at top) -->
<canvas id="spCity"
  style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>

<!-- Spider-Man image — JS positions and animates it, always faces right -->
<img id="spSwinger" src="${SPIDER_PNG}" alt=""
  style="
    position:absolute;
    z-index:4;
    pointer-events:none;
    width:${SP_W}px;
    height:${SP_H}px;
    object-fit:contain;
    filter:drop-shadow(0 8px 16px rgba(0,0,0,.60)) drop-shadow(0 0 18px rgba(255,60,60,.20));
    top:-${SP_H}px;
    left:-${SP_W}px;
  "
/>

<!-- Dark overlay — covers ONLY the bottom half so top sky stays vibrant -->
<div style="
  position:absolute; left:0; right:0; bottom:0; height:320px;
  background:linear-gradient(180deg,rgba(10,10,30,0) 0%,rgba(5,8,20,.72) 40%,rgba(3,5,15,.92) 100%);
  pointer-events:none;
"></div>

<!-- TOP BAR -->
<div style="
  position:absolute; top:18px; left:18px; right:18px;
  display:flex; justify-content:space-between; align-items:center;
  z-index:5;
">
  <div>
    <div style="font-family:'Orbitron',sans-serif;font-size:24px;font-weight:900;letter-spacing:3px;color:white;">SPIDER HUD</div>
    <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.72);margin-top:2px;">EARTH-616 • NYC</div>
  </div>
  <div style="display:flex;gap:8px;">
    <button id="spMin"   style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:white;font-size:18px;cursor:pointer;backdrop-filter:blur(8px);">−</button>
    <button id="spClose" style="width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.12);color:white;font-size:16px;cursor:pointer;backdrop-filter:blur(8px);">×</button>
  </div>
</div>

<!-- CONTENT — positioned in lower portion, original glassmorphism card style -->
<div id="spContent"
  style="
    position:absolute;
    top:240px; left:14px; right:14px; bottom:14px;
    display:flex; flex-direction:column; gap:0;
  "
>

  <!-- MAIN GLASS CARD (original single card layout) -->
  <div style="
    flex:1;
    background:rgba(255,255,255,.13);
    backdrop-filter:blur(22px);
    -webkit-backdrop-filter:blur(22px);
    border:1.5px solid rgba(255,255,255,.22);
    border-radius:26px;
    padding:18px 18px 14px;
    display:flex;
    flex-direction:column;
    gap:14px;
    position:relative;
    overflow:hidden;
  ">

    <!-- shimmer sweep -->
    <div style="
      position:absolute; top:-40px; left:-80px; width:90px; height:220%;
      background:rgba(255,255,255,.12);
      animation:sp-shimmer 7s linear infinite;
      pointer-events:none;
    "></div>

    <!-- REACTOR + STATS row -->
    <div style="display:flex; align-items:center; gap:18px; position:relative; z-index:2;">

      <!-- Circular progress reactor (original 170px centered, here left-anchored) -->
      <div style="
        position:relative; width:150px; height:150px; flex-shrink:0;
        animation:sp-float 4s ease-in-out infinite;
      ">
        <svg viewBox="0 0 170 170" style="position:absolute;inset:0;width:100%;height:100%;">
          <circle cx="85" cy="85" r="62"
            stroke="rgba(255,255,255,.12)" stroke-width="5" fill="none"/>
          <circle id="spProgressCircle"
            cx="85" cy="85" r="62"
            stroke="url(#spGrad)"
            stroke-width="10" fill="none"
            stroke-linecap="round"
            transform="rotate(-90 85 85)"
            stroke-dasharray="390"
            stroke-dashoffset="390"/>
          <defs>
            <linearGradient id="spGrad">
              <stop offset="0%"   stop-color="#ff3d3d"/>
              <stop offset="100%" stop-color="#3da5ff"/>
            </linearGradient>
          </defs>
          <g style="animation:sp-spin 16s linear infinite;transform-origin:center;">
            <circle cx="85" cy="85" r="74"
              stroke="rgba(255,255,255,.18)" stroke-dasharray="10 12"
              stroke-width="2" fill="none"/>
          </g>
          <g style="animation:sp-spin-rev 10s linear infinite;transform-origin:center;">
            <circle cx="85" cy="85" r="50"
              stroke="rgba(255,0,0,.38)" stroke-dasharray="8 10"
              stroke-width="2" fill="none"/>
          </g>
        </svg>
        <div style="
          position:absolute; inset:0;
          display:flex; flex-direction:column;
          align-items:center; justify-content:center;
        ">
          <div id="spHours" style="
            font-size:46px; font-weight:900; line-height:1; color:white;
            text-shadow:0 0 18px rgba(255,255,255,.65),0 0 30px rgba(255,0,0,.40);
          ">0h</div>
          <div id="spMins" style="font-size:18px;letter-spacing:3px;color:#9fd3ff;">00m</div>
        </div>
      </div>

      <!-- Stats 2×2 grid -->
      <div style="flex:1; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">REMAINING</div>
          <div id="spRemaining" style="font-size:22px;font-weight:700;color:white;margin-top:4px;">8h</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">BREAK</div>
          <div id="spBreak" style="font-size:22px;font-weight:700;color:white;margin-top:4px;">0m</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">HALF DAY</div>
          <div id="spHalf" style="font-size:18px;font-weight:700;color:white;margin-top:4px;">--</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.65);">MISSION END</div>
          <div id="spFull" style="font-size:18px;font-weight:700;color:white;margin-top:4px;">--</div>
        </div>
      </div>

    </div>

    <!-- MISSION CANVAS AREA — animated web + mission text -->
    <div style="position:relative;border-radius:16px;overflow:hidden;height:80px;flex-shrink:0;">
      <!-- animated web shooter canvas behind the text -->
      <canvas id="spWebCanvas"
        style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
      <!-- dark tint over canvas so text stays readable -->
      <div style="
        position:absolute;inset:0;
        background:linear-gradient(90deg,rgba(255,0,0,.18),rgba(0,80,180,.22));
        border-radius:16px;
      "></div>
      <!-- mission text -->
      <div id="spMission" style="
        position:relative; z-index:2;
        height:100%; display:flex; align-items:center; padding:0 16px;
        font-size:14px; line-height:1.45; color:white;
        font-family:'Rajdhani',sans-serif; font-weight:700; letter-spacing:.5px;
      ">Entering Manhattan patrol route.</div>
    </div>

  </div>

</div>
`;

    document.body.appendChild(widget);

    refs = {
        widget,
        hours:     widget.querySelector('#spHours'),
        mins:      widget.querySelector('#spMins'),
        remaining: widget.querySelector('#spRemaining'),
        breakEl:   widget.querySelector('#spBreak'),
        half:      widget.querySelector('#spHalf'),
        full:      widget.querySelector('#spFull'),
        mission:   widget.querySelector('#spMission'),
        progress:  widget.querySelector('#spProgressCircle'),
        content:   widget.querySelector('#spContent')
    };

    // buttons
    let minimized = false;
    widget.querySelector('#spMin').addEventListener('click', () => {
        minimized = !minimized;
        refs.content.style.display = minimized ? 'none' : 'flex';
        widget.style.height = minimized ? '82px' : '560px';
        widget.querySelector('#spMin').textContent = minimized ? '+' : '−';
    });
    widget.querySelector('#spClose').addEventListener('click', () => {
        widget.remove();
        window.__KEKA_HERO_TRACKER__ = false;
    });

    startSpiderCity();
    startSpiderSwing();
    startWebCanvas();
}

// ─────────────────────────────────────────────────────
// SPIDER-MAN SWING
// PNG faces RIGHT naturally.
// Animation: always L→R, then instantly resets off-screen left.
// No flip, no return trip — same as original CSS approach but JS.
// A gentle arc and tilt give the swinging feel.
// ─────────────────────────────────────────────────────

function startSpiderSwing() {
    const img = document.getElementById('spSwinger');
    if (!img) return;

    const DURATION = 9000;   // ms to cross the widget
    const START_X  = -SP_W;  // off-screen left
    const END_X    = 390;    // off-screen right
    let t0 = null;

    function eio(t) { return t < .5 ? 2*t*t : -1 + (4 - 2*t)*t; }

    function tick(now) {
        if (!t0) t0 = now;
        const elapsed = (now - t0) % DURATION;
        const frac    = elapsed / DURATION;   // 0 → 1
        const ease    = eio(frac);

        // Horizontal — always left to right
        const x = START_X + (END_X - START_X) * ease;

        // Vertical arc: dips in the middle (swing feel)
        // Top range: 10px at edges, 60px at peak of arc
        const y = 10 + Math.sin(frac * Math.PI) * 55;

        // Tilt: leans forward (clockwise) during mid-swing
        const tilt = Math.sin(frac * Math.PI) * 22;

        img.style.left      = `${x}px`;
        img.style.top       = `${y}px`;
        img.style.transform = `rotate(${tilt}deg)`;
        // scaleX: always 1 (facing right), never flipped

        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────────────
// CITY SKYLINE CANVAS
// Draws a NYC morning/dusk skyline at the bottom.
// The top of the canvas is transparent (orange sky shows through).
// ─────────────────────────────────────────────────────

function startSpiderCity() {
    const canvas = document.getElementById('spCity');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = 390;
    canvas.height = 560;
    const W = 390, H = 560;

    // Stable building layout — generated once
    const buildings = [];
    for (let i = 0; i < 24; i++) {
        const bw = 14 + Math.abs(Math.sin(i * 2.3)) * 22;
        const bh = 80 + Math.abs(Math.sin(i * 1.7)) * 220;
        buildings.push({
            x: i * 17 - 5,
            w: bw,
            h: bh,
            y: H - bh,
            layer: i % 3   // 0=back, 1=mid, 2=front
        });
    }

    let frame = 0;

    function render() {
        ctx.clearRect(0, 0, W, H);

        // ── Silhouette layers (back → front) ──────────────
        [0, 1, 2].forEach(layer => {
            buildings.filter(b => b.layer === layer).forEach(b => {
                // Each layer slightly darker / taller in front
                const alpha = 0.45 + layer * 0.22;
                const grd   = ctx.createLinearGradient(0, b.y, 0, H);
                grd.addColorStop(0,   `rgba(15,12,35,${alpha})`);
                grd.addColorStop(1,   `rgba(5,4,18,${alpha + 0.2})`);
                ctx.fillStyle = grd;
                ctx.fillRect(b.x, b.y, b.w, b.h);

                // Windows — flicker gently
                for (let wy = b.y + 6; wy < H - 5; wy += 11) {
                    for (let wx = b.x + 3; wx < b.x + b.w - 4; wx += 7) {
                        // Deterministic "on/off" per window position
                        const seed = Math.sin(wx * 13 + wy * 7 + layer) + Math.sin(frame * 0.003 + wx * 0.1);
                        if (seed > 0.5) {
                            const warm = Math.sin(wx + wy * 2) > 0;
                            const op   = 0.45 + 0.35 * Math.abs(Math.sin(frame * 0.005 + wx * 0.3));
                            ctx.fillStyle = warm
                                ? `rgba(255,200,90,${op.toFixed(2)})`
                                : `rgba(140,195,255,${op.toFixed(2)})`;
                            ctx.fillRect(wx, wy, 3, 5);
                        }
                    }
                }
            });
        });

        // ── Street-level traffic streaks ──────────────────
        for (let i = 0; i < 12; i++) {
            const speed = 0.6 + (i % 4) * 0.35;
            const tx    = ((i * 38 + frame * speed) % (W + 50)) - 50;
            const ty    = H - 22 + Math.sin(i) * 5;
            ctx.strokeStyle = i % 2
                ? `rgba(255,80,80,${0.30 + (i%3)*.08})`
                : `rgba(255,240,160,${0.22 + (i%3)*.06})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + 28, ty);
            ctx.stroke();
        }

        frame++;
        requestAnimationFrame(render);
    }

    render();
}

// ─────────────────────────────────────────────────────
// WEB-SHOOTER CANVAS  (replaces the plain mission text box)
// Draws animated spider-web lines radiating from a corner,
// with sparkling nodes — gives a techy web-sensor feel.
// Mission text overlays on top.
// ─────────────────────────────────────────────────────

function startWebCanvas() {
    const canvas = document.getElementById('spWebCanvas');
    if (!canvas) return;

    // Size canvas to match its CSS container
    const setSize = () => {
        const r = canvas.getBoundingClientRect();
        canvas.width  = r.width  || 330;
        canvas.height = r.height || 80;
    };
    setSize();

    const ctx = canvas.getContext('2d');
    const W   = canvas.width;
    const H   = canvas.height;

    // Origin: bottom-left corner
    const OX = 0;
    const OY = H;

    // Radial web lines from origin
    const LINES = 8;
    const angles = Array.from({length: LINES}, (_, i) =>
        // Spread from -10° to -80° (upper-right quadrant from bottom-left)
        (-10 - i * 9) * (Math.PI / 180)
    );

    // Concentric arcs at these radii
    const radii = [30, 60, 95, 135, 180, 230];

    let frame = 0;

    function render() {
        ctx.clearRect(0, 0, W, H);

        // Web lines
        angles.forEach(angle => {
            const len = 280;
            const ex  = OX + Math.cos(angle) * len;
            const ey  = OY + Math.sin(angle) * len;

            const pulse = 0.10 + 0.08 * Math.sin(frame * 0.04 + angle * 3);

            ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
            ctx.lineWidth   = 0.8;
            ctx.beginPath();
            ctx.moveTo(OX, OY);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        });

        // Concentric arcs connecting the lines
        radii.forEach((r, ri) => {
            const aStart = angles[angles.length - 1];
            const aEnd   = angles[0];
            const pulse  = 0.08 + 0.06 * Math.sin(frame * 0.025 + ri * 0.8);

            ctx.strokeStyle = `rgba(255,255,255,${pulse.toFixed(2)})`;
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.arc(OX, OY, r, aStart, aEnd);
            ctx.stroke();
        });

        // Glowing nodes at intersections
        angles.forEach(angle => {
            radii.forEach((r, ri) => {
                const nx  = OX + Math.cos(angle) * r;
                const ny  = OY + Math.sin(angle) * r;
                const flicker = Math.sin(frame * 0.06 + angle * 5 + ri * 2);
                if (flicker > 0.3) {
                    const op = 0.4 + 0.5 * flicker;
                    ctx.fillStyle = `rgba(61,165,255,${op.toFixed(2)})`;
                    ctx.beginPath();
                    ctx.arc(nx, ny, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });

        // Sweeping "radar" line from origin
        const sweepAngle = angles[0] + (angles[angles.length-1] - angles[0]) *
            (((frame * 0.012) % 1 + 1) % 1);
        const sx = OX + Math.cos(sweepAngle) * 230;
        const sy = OY + Math.sin(sweepAngle) * 230;
        const swGrd = ctx.createLinearGradient(OX, OY, sx, sy);
        swGrd.addColorStop(0,   'rgba(255,60,60,.30)');
        swGrd.addColorStop(0.6, 'rgba(255,60,60,.12)');
        swGrd.addColorStop(1,   'rgba(255,60,60,0)');
        ctx.strokeStyle = swGrd;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(OX, OY);
        ctx.lineTo(sx, sy);
        ctx.stroke();

        frame++;
        requestAnimationFrame(render);
    }

    render();
}

function showSpiderAchievement() {
    if (document.getElementById('spAchieve')) return;
    const el = document.createElement('div'); el.id = 'spAchieve';
    el.innerHTML = `<span style="font-size:24px;">🕷️</span><div>
      <div style="font-size:9px;opacity:.65;letter-spacing:2px;margin-bottom:2px;">MISSION COMPLETE</div>
      MANHATTAN SECURED!</div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 5000);
}

// ─────────────────────────────────────────────────────
// UPDATE SPIDER UI
// ─────────────────────────────────────────────────────

function updateSpiderUI(data, total, breaks, left, pct, h, mStr) {
    setIfChanged(refs.hours, `${h}h`);
    setIfChanged(refs.mins,  `${mStr}m`);
    setIfChanged(refs.remaining, fmtMinutes(left));
    setIfChanged(refs.breakEl,   fmtMinutes(breaks));

    // Progress arc (r=62, circumference=390 as per original)
    refs.progress.style.strokeDashoffset = 390 - (pct / 100) * 390;

    // Mission text
    const msgs = [
        'Entering Manhattan patrol route.',
        'Spider-Sense activated across NYC.',
        'Swinging through Midtown at full speed.',
        'Final villain chase sequence active.',
        '🕷️  MISSION COMPLETE. Manhattan secured.'
    ];
    const mi = pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
    setIfChanged(refs.mission, msgs[mi]);

    // Half-day / full-day
    if (data.firstStart) {
        const sMin = parseTimeToMinutes(data.firstStart);
        if (sMin !== null) {
            const base = new Date();
            base.setHours(Math.floor(sMin/60), sMin%60, 0, 0);
            setIfChanged(refs.half, fmtTime(new Date(base.getTime() + (HALF_DAY_MINUTES + breaks)*60000)));
            setIfChanged(refs.full, fmtTime(new Date(base.getTime() + (WORK_MINUTES + breaks)*60000)));
        }
    }

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
    const mStr   = String(total % 60).padStart(2, '0');

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
    `%c🕷️ KEKA HERO TRACKER v4 — ${THEME.toUpperCase()}`,
    'color:#ff3d3d;font-size:14px;font-weight:bold;background:#0a0a0a;padding:4px 8px;border-radius:4px;'
);

})();
