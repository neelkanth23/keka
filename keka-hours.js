// keka-hours — the eternal session ✦
// aesthetic: elden ring gold · dune spice · ghost of tsushima ink · akira indigo
(function(){
'use strict';

const WORK_MINUTES     = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

let tenMinTriggered    = false;
let eightHourTriggered = false;
let confettiInterval   = null;
let didSlideIn         = false;
let titleFlashInterval = null;
const originalTitle    = document.title;

/* ═══════════════════════════════════════
   TIME HELPERS
═══════════════════════════════════════ */

function parseTime(ts){
  if(!ts || ts === 'MISSING') return null;
  const parts = ts.toLowerCase().split(' ').filter(Boolean);
  if(parts.length < 2) return null;
  let [H, M] = parts[0].split(':').map(Number);
  const ap = parts[1];
  if(ap === 'pm' && H !== 12) H += 12;
  if(ap === 'am' && H === 12) H = 0;
  return { hours: H, minutes: M };
}

function minutesBetween(s, e){
  const st = parseTime(s), en = parseTime(e);
  if(!st || !en) return 0;
  let m = (en.hours - st.hours) * 60 + (en.minutes - st.minutes);
  if(m < 0)   m += 1440;
  if(m > 720) m = 0;
  return m;
}

/* ═══════════════════════════════════════
   PROCESS LOGS
═══════════════════════════════════════ */

function processLogs(container){
  if(!container) return;
  const rows = Array.from(container.querySelectorAll('.ng-untouched.ng-pristine.ng-valid'));
  let totalM = 0, firstStart = null, prevEnd = null, breakM = 0, activeStart = null;

  rows.forEach((row, idx) => {
    const startEl = row.querySelector('.w-120.mr-20 .text-small') || row.querySelector('.w-120.mr-20');
    const endEl   = row.querySelector('.w-120:not(.mr-20) .text-small') || row.querySelector('.w-120:not(.mr-20)');
    const s = startEl ? startEl.textContent.trim() : null;
    const e = endEl   ? endEl.textContent.trim()   : null;
    if(idx === 0) firstStart = s;
    if(idx !== 0 && prevEnd && s) breakM += minutesBetween(prevEnd, s);
    if(e === 'MISSING'){ activeStart = s; }
    else { totalM += minutesBetween(s, e); prevEnd = e; }
  });

  if(activeStart){
    const st = parseTime(activeStart);
    if(st){
      const now  = new Date();
      const live = (now.getHours() - st.hours) * 60 + (now.getMinutes() - st.minutes);
      if(live > 0) totalM += live;
    }
  }

  window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
}

/* ═══════════════════════════════════════
   INJECT STYLES
═══════════════════════════════════════ */

function injectStyles(){
  if(document.getElementById('kekaArtifactStyles')) return;
  const s = document.createElement('style');
  s.id = 'kekaArtifactStyles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=JetBrains+Mono:wght@300;400;500&family=Cinzel:wght@400;600&display=swap');

    /* ── KEYFRAMES ── */
    @keyframes ka-slidein {
      from { transform: translateX(115%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes ka-aura {
      0%,100% { box-shadow: 0 0 22px rgba(140,100,28,0.1), 0 40px 90px rgba(0,0,0,0.95); }
      50%      { box-shadow: 0 0 44px rgba(140,100,28,0.2), 0 40px 90px rgba(0,0,0,0.95); }
    }
    @keyframes ka-aura-warning {
      0%,100% { box-shadow: 0 0 28px rgba(160,80,20,0.18), 0 40px 90px rgba(0,0,0,0.95); border-top-color: rgba(210,130,40,0.7); }
      50%      { box-shadow: 0 0 55px rgba(160,80,20,0.32), 0 40px 90px rgba(0,0,0,0.95); border-top-color: rgba(220,150,50,0.9); }
    }
    @keyframes ka-aura-victory {
      0%,100% { box-shadow: 0 0 40px rgba(215,170,45,0.22), 0 0 80px rgba(215,170,45,0.07), 0 40px 90px rgba(0,0,0,0.95); }
      50%      { box-shadow: 0 0 70px rgba(215,170,45,0.38), 0 0 130px rgba(215,170,45,0.12), 0 40px 90px rgba(0,0,0,0.95); }
    }
    @keyframes ka-spice {
      0%   { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes ka-spice-victory {
      0%   { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }
    @keyframes ka-scan {
      0%   { top: -2px; opacity: 0; }
      8%   { opacity: 1; }
      92%  { opacity: 1; }
      100% { top: 100%; opacity: 0; }
    }
    @keyframes ka-rune {
      0%,100% { text-shadow: 0 0 6px rgba(205,165,75,0.5);  opacity: 0.75; }
      50%      { text-shadow: 0 0 18px rgba(205,165,75,0.95), 0 0 36px rgba(205,165,75,0.22); opacity: 1; }
    }
    @keyframes ka-live {
      0%,47%  { opacity: 1; }
      50%,97% { opacity: 0; }
      100%    { opacity: 1; }
    }
    @keyframes ka-ticker {
      0%   { transform: translateX(0%); }
      100% { transform: translateX(-50%); }
    }
    @keyframes ka-float {
      0%,100% { transform: translateY(0px);  opacity: 0.35; }
      50%      { transform: translateY(-2px); opacity: 0.65; }
    }
    @keyframes ka-confetti {
      0%   { transform: translateY(-12px) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(100vh)  rotate(600deg); opacity: 0; }
    }
    @keyframes ka-overlay-in {
      0%   { transform: scale(0.86) translateY(24px); opacity: 0; }
      100% { transform: scale(1)    translateY(0);    opacity: 1; }
    }

    /* ── WIDGET STATES ── */
    #kekaArtifact {
      animation: ka-slidein 0.65s cubic-bezier(0.34,1.4,0.64,1) forwards;
      will-change: transform;
    }
    #kekaArtifact.ka-alive {
      animation: ka-aura 5s ease-in-out infinite !important;
    }
    #kekaArtifact.ka-warning {
      animation: ka-aura-warning 2.2s ease-in-out infinite !important;
    }
    #kekaArtifact.ka-victory {
      animation: ka-aura-victory 3.5s ease-in-out infinite !important;
    }

    /* ── BAR ── */
    .ka-bar-fill {
      background: linear-gradient(90deg,
        #3d2200 0%, #7a4800 18%, #c8820a 40%,
        #e8b84a 55%, #c8820a 72%, #7a4800 88%, #3d2200 100%
      );
      background-size: 300% 100%;
      animation: ka-spice 3s linear infinite;
    }
    .ka-bar-fill-victory {
      background: linear-gradient(90deg,
        #5c3300 0%, #b06800 15%, #e8a820 35%,
        #fde080 50%, #e8a820 65%, #b06800 82%, #5c3300 100%
      );
      background-size: 300% 100%;
      animation: ka-spice-victory 2s linear infinite;
      box-shadow: 0 0 14px rgba(220,175,55,0.55);
    }

    /* ── STAT CARDS ── */
    .ka-card {
      transition: transform 0.18s ease, background 0.18s ease;
      cursor: default;
    }
    .ka-card:hover {
      transform: translateY(-1px);
      background: rgba(205,165,75,0.09) !important;
    }

    /* ── TICKER ── */
    #kaTicker {
      display: inline-block;
      white-space: nowrap;
      animation: ka-ticker 34s linear infinite;
    }

    /* ── RUNE GLOW on header ── */
    .ka-rune-title {
      animation: ka-rune 4s ease-in-out infinite;
    }

    /* ── LIVE DOT ── */
    .ka-live-dot {
      animation: ka-live 2.4s step-end infinite;
    }

    /* ── FLOAT RUNE ── */
    .ka-float-rune {
      animation: ka-float 3.5s ease-in-out infinite;
    }

    /* ── CONFETTI ── */
    .ka-confetti {
      position: fixed;
      top: -16px;
      z-index: 2147483647;
      pointer-events: none;
      animation: ka-confetti linear forwards;
    }

    /* ── MIN BUTTON ── */
    #kaMinBtn:hover {
      background: rgba(205,165,75,0.12) !important;
      color: rgba(205,165,75,0.9) !important;
    }
  `;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════
   CREATE UI
═══════════════════════════════════════ */

function createUI(){
  injectStyles();
  if(document.getElementById('kekaArtifact')) return;

  const box = document.createElement('div');
  box.id = 'kekaArtifact';
  box.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483646;
    width: 355px;
    border-radius: 3px;
    background: linear-gradient(155deg, rgba(17,12,26,0.97) 0%, rgba(10,7,15,0.98) 55%, rgba(8,5,10,1) 100%);
    backdrop-filter: blur(36px) saturate(160%);
    -webkit-backdrop-filter: blur(36px) saturate(160%);
    border-top:    1px solid rgba(205,165,75,0.55);
    border-left:   1px solid rgba(205,165,75,0.18);
    border-right:  1px solid rgba(205,165,75,0.18);
    border-bottom: 1px solid rgba(205,165,75,0.12);
    color: #e8d5a3;
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
    user-select: none;
    cursor: default;
  `;

  box.innerHTML = `

    <!-- scanline -->
    <div id="kaScan" style="
      position:absolute;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent 0%,rgba(205,165,75,0.09) 30%,rgba(205,165,75,0.14) 50%,rgba(205,165,75,0.09) 70%,transparent 100%);
      animation:ka-scan 10s ease-in-out infinite;
      z-index:5;pointer-events:none;
    "></div>

    <!-- inner top glow -->
    <div style="position:absolute;top:0;left:0;right:0;height:55px;background:linear-gradient(180deg,rgba(205,165,75,0.05),transparent);pointer-events:none;z-index:1;"></div>

    <!-- corner brackets -->
    <div style="position:absolute;top:0;left:0;width:18px;height:18px;border-top:2px solid rgba(205,165,75,0.88);border-left:2px solid rgba(205,165,75,0.88);z-index:6;pointer-events:none;"></div>
    <div style="position:absolute;top:0;right:0;width:18px;height:18px;border-top:2px solid rgba(205,165,75,0.88);border-right:2px solid rgba(205,165,75,0.88);z-index:6;pointer-events:none;"></div>
    <div style="position:absolute;bottom:0;left:0;width:18px;height:18px;border-bottom:2px solid rgba(205,165,75,0.45);border-left:2px solid rgba(205,165,75,0.45);z-index:6;pointer-events:none;"></div>
    <div style="position:absolute;bottom:0;right:0;width:18px;height:18px;border-bottom:2px solid rgba(205,165,75,0.45);border-right:2px solid rgba(205,165,75,0.45);z-index:6;pointer-events:none;"></div>

    <!-- ── HEADER ── -->
    <div id="kaHeader" style="
      position:relative;z-index:2;
      padding:13px 20px 12px;
      border-bottom:1px solid rgba(205,165,75,0.1);
      display:flex;align-items:center;justify-content:space-between;
      background:linear-gradient(90deg,rgba(205,165,75,0.06) 0%,rgba(80,50,180,0.03) 60%,transparent 100%);
    ">
      <div>
        <div class="ka-rune-title" style="
          font-family:'Cinzel',serif;font-size:11px;font-weight:600;
          color:#d4a84b;letter-spacing:0.22em;text-transform:uppercase;
        ">Grind Tracker</div>
        <div style="font-size:7px;color:rgba(180,140,55,0.28);letter-spacing:0.22em;margin-top:2px;text-transform:uppercase;">The Eternal Session</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="display:flex;align-items:center;gap:5px;">
          <div id="kaLiveDot" class="ka-live-dot" style="width:5px;height:5px;border-radius:50%;background:#c8941e;box-shadow:0 0 6px rgba(200,148,30,0.8);"></div>
          <span style="font-size:7px;color:rgba(200,148,30,0.45);letter-spacing:0.2em;text-transform:uppercase;">live</span>
        </div>
        <div style="width:1px;height:16px;background:linear-gradient(180deg,transparent,rgba(205,165,75,0.2),transparent);"></div>
        <button id="kaMinBtn" style="
          background:transparent;border:none;cursor:pointer;
          font-family:'Cinzel',serif;font-size:18px;
          color:rgba(205,165,75,0.35);line-height:1;
          transition:color 0.15s,background 0.15s;
          padding:2px 4px;border-radius:2px;
        ">−</button>
      </div>
    </div>

    <!-- ── BODY ── -->
    <div id="kaBody" style="padding:16px 20px 15px;position:relative;z-index:2;">

      <!-- lore quote / vibe -->
      <div id="kaVibe" style="
        font-family:'Cormorant Garamond',serif;
        font-size:12px;font-weight:300;font-style:italic;
        color:rgba(190,160,90,0.4);
        letter-spacing:0.06em;line-height:1.6;
        border-left:1px solid rgba(205,165,75,0.18);
        padding-left:10px;margin-bottom:17px;
      ">"kaam shuru kar... the grind demands tribute."</div>

      <!-- BIG CLOCK -->
      <div style="margin-bottom:20px;display:flex;align-items:flex-end;justify-content:space-between;">
        <div style="display:flex;align-items:baseline;gap:2px;">
          <span id="kaHours" style="
            font-family:'Bebas Neue',sans-serif;
            font-size:66px;line-height:0.88;
            color:#e8d5a3;letter-spacing:0.02em;
            text-shadow:0 0 40px rgba(205,165,75,0.22), 0 2px 0 rgba(0,0,0,0.8);
          ">0</span>
          <span style="font-size:16px;color:rgba(205,165,75,0.42);margin:0 5px 9px 2px;">h</span>
          <span id="kaMins" style="
            font-family:'Bebas Neue',sans-serif;
            font-size:66px;line-height:0.88;
            color:#e8d5a3;
            text-shadow:0 0 40px rgba(205,165,75,0.22), 0 2px 0 rgba(0,0,0,0.8);
          ">00</span>
          <span style="font-size:16px;color:rgba(205,165,75,0.42);margin-bottom:9px;margin-left:2px;">m</span>
        </div>
        <!-- side mini -->
        <div style="display:flex;flex-direction:column;gap:5px;text-align:right;padding-bottom:7px;">
          <div>
            <div style="font-size:7px;color:rgba(180,140,55,0.3);letter-spacing:0.15em;text-transform:uppercase;">baaki</div>
            <div id="kaLeft" style="font-family:'Bebas Neue',sans-serif;font-size:19px;color:#c8941e;line-height:1;text-shadow:0 0 10px rgba(200,148,30,0.3);">8h 00m</div>
          </div>
          <div>
            <div style="font-size:7px;color:rgba(180,140,55,0.3);letter-spacing:0.15em;text-transform:uppercase;">break</div>
            <div id="kaBreak" style="font-family:'Bebas Neue',sans-serif;font-size:19px;color:rgba(200,185,155,0.38);line-height:1;">0h 00m</div>
          </div>
        </div>
      </div>

      <!-- STAMINA BAR -->
      <div style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
          <div style="display:flex;align-items:center;gap:7px;">
            <div style="width:18px;height:1px;background:linear-gradient(90deg,transparent,rgba(205,165,75,0.45));"></div>
            <span style="font-family:'Cinzel',serif;font-size:7.5px;color:rgba(205,165,75,0.38);letter-spacing:0.25em;text-transform:uppercase;">Stamina</span>
            <div style="width:18px;height:1px;background:linear-gradient(90deg,rgba(205,165,75,0.45),transparent);"></div>
          </div>
          <span id="kaPercent" style="font-size:8px;font-weight:500;color:rgba(205,165,75,0.55);">0%</span>
        </div>
        <div style="position:relative;height:10px;background:rgba(0,0,0,0.7);border:1px solid rgba(205,165,75,0.13);border-radius:1px;overflow:hidden;">
          <!-- inner gloss -->
          <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.04),transparent 50%,rgba(0,0,0,0.25) 100%);z-index:2;pointer-events:none;"></div>
          <!-- fill -->
          <div id="kaBar" class="ka-bar-fill" style="position:absolute;top:0;left:0;height:100%;width:0%;border-radius:1px 0 0 1px;transition:width 1s ease;"></div>
          <!-- notches -->
          <div style="position:absolute;top:0;left:25%;width:1px;height:100%;background:rgba(0,0,0,0.55);z-index:3;"></div>
          <div style="position:absolute;top:0;left:50%;width:1px;height:100%;background:rgba(0,0,0,0.5);z-index:3;"></div>
          <div style="position:absolute;top:0;left:75%;width:1px;height:100%;background:rgba(0,0,0,0.5);z-index:3;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px;">
          <span style="font-size:7px;color:rgba(205,165,75,0.18);">dawn</span>
          <span style="font-size:7px;color:rgba(205,165,75,0.18);">half</span>
          <span id="kaFreedomLabel" style="font-size:7px;color:rgba(205,165,75,0.18);">freedom</span>
        </div>
      </div>

      <!-- ETA CARDS — warm amber + cool indigo (two light sources) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:15px;">

        <div class="ka-card" style="
          background:linear-gradient(135deg,rgba(100,70,10,0.14),rgba(60,40,5,0.07));
          border:1px solid rgba(205,165,75,0.16);border-radius:2px;
          padding:10px 13px;position:relative;overflow:hidden;
        ">
          <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(205,165,75,0.4),transparent);"></div>
          <div style="font-size:7px;color:rgba(205,165,75,0.3);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:6px;">half day ✌️</div>
          <div id="kaHalf" style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:rgba(232,201,122,0.85);line-height:1;text-shadow:0 0 10px rgba(200,148,30,0.2);">--:--</div>
        </div>

        <div class="ka-card" style="
          background:linear-gradient(135deg,rgba(55,35,120,0.12),rgba(28,16,70,0.07));
          border:1px solid rgba(120,95,215,0.18);border-radius:2px;
          padding:10px 13px;position:relative;overflow:hidden;
        ">
          <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(140,115,220,0.35),transparent);"></div>
          <div style="font-size:7px;color:rgba(145,115,215,0.38);text-transform:uppercase;letter-spacing:0.15em;margin-bottom:6px;">chutti 🚪</div>
          <div id="kaFull" style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:rgba(185,160,255,0.88);line-height:1;text-shadow:0 0 12px rgba(120,95,210,0.3);">--:--</div>
        </div>

      </div>

      <!-- DIVIDER -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(205,165,75,0.12));"></div>
        <span class="ka-float-rune" style="font-family:'Cinzel',serif;font-size:8px;color:rgba(205,165,75,0.22);">✦</span>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(205,165,75,0.12),transparent);"></div>
      </div>

      <!-- TICKER -->
      <div style="overflow:hidden;">
        <span id="kaTicker" style="
          font-size:7.5px;color:rgba(205,165,75,0.22);
          letter-spacing:0.14em;text-transform:uppercase;
        ">CHAI PIVI CHE KE NHI &nbsp;✦&nbsp; BOS NE KHABAR NATHI TU SHU KAR CHE &nbsp;✦&nbsp; GHAR JA BHAI MA RAAH JOWE CHE &nbsp;✦&nbsp; SURAT NO SHER BESI RAHYO &nbsp;✦&nbsp; THODA AUR PAKODA MILEGA GHAR PE &nbsp;✦&nbsp; KEKA BAND KAR YAAR &nbsp;✦&nbsp; CHAI PIVI CHE KE NHI &nbsp;✦&nbsp; BOS NE KHABAR NATHI TU SHU KAR CHE &nbsp;✦&nbsp; GHAR JA BHAI MA RAAH JOWE CHE &nbsp;✦&nbsp; SURAT NO SHER BESI RAHYO &nbsp;✦&nbsp;</span>
      </div>

    </div>
  `;

  document.body.appendChild(box);

  /* slide-in ends → switch to breathing aura, no hover flicker */
  box.addEventListener('animationend', (ev) => {
    if(ev.animationName === 'ka-slidein' && !didSlideIn){
      didSlideIn = true;
      box.classList.add('ka-alive');
    }
  }, { once: true });

  /* minimize */
  let minimized = false;
  document.getElementById('kaMinBtn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    minimized = !minimized;
    document.getElementById('kaBody').style.display = minimized ? 'none' : 'block';
    ev.currentTarget.textContent = minimized ? '+' : '−';
  });
}

/* ═══════════════════════════════════════
   VIBE / LORE MESSAGES
═══════════════════════════════════════ */

function getVibe(pct){
  if(pct >= 100) return '"nikal gayo bhai... the realm is yours. ghar ja."';
  if(pct >= 90)  return '"10% remains... do not falter now, warrior."';
  if(pct >= 75)  return '"ghar dikhne laga hai... hold the line."';
  if(pct >= 50)  return '"aadha done... the grind is not over."';
  if(pct >= 25)  return '"chautha part khatam... keep moving."';
  return '"kaam shuru kar... the grind demands tribute."';
}

/* ═══════════════════════════════════════
   CONFETTI
═══════════════════════════════════════ */

function launchConfetti(){
  const colors = ['#d4a84b','#e8c97a','#f5e090','#b8a0ff','#c8820a','#fde080','#a0c4ff'];
  let count = 0;
  confettiInterval = setInterval(() => {
    if(count++ > 100){ clearInterval(confettiInterval); return; }
    const p  = document.createElement('div');
    p.className = 'ka-confetti';
    const sz = Math.random() * 8 + 4;
    p.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${sz}px; height: ${sz}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      opacity: 0.88;
      animation-duration: ${Math.random() * 2.5 + 2}s;
      animation-delay: ${Math.random() * 0.6}s;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 5500);
  }, 72);
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */

function showToast(emoji, line1, line2, borderColor){
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:28px;left:50%;
    transform:translateX(-50%) translateY(80px);
    z-index:2147483645;
    background:linear-gradient(155deg,rgba(17,12,26,0.94),rgba(8,5,10,0.97));
    backdrop-filter:blur(28px);
    border-top:1px solid ${borderColor};
    border-left:1px solid rgba(205,165,75,0.14);
    border-right:1px solid rgba(205,165,75,0.14);
    border-bottom:1px solid rgba(205,165,75,0.08);
    border-radius:3px;
    padding:16px 28px;
    font-family:'JetBrains Mono',monospace;
    color:#e8d5a3;text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,0.7);
    transition:transform 0.45s cubic-bezier(0.34,1.5,0.64,1),opacity 0.45s;
    opacity:0;min-width:240px;pointer-events:none;
  `;
  t.innerHTML = `
    <div style="font-size:28px;margin-bottom:7px;">${emoji}</div>
    <div style="font-family:'Cinzel',serif;font-size:11px;font-weight:600;color:${borderColor};letter-spacing:0.18em;">${line1}</div>
    <div style="font-family:'Cormorant Garamond',serif;font-size:12px;font-weight:300;font-style:italic;color:rgba(205,165,75,0.4);margin-top:4px;">${line2}</div>
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
   COMPLETION OVERLAY
═══════════════════════════════════════ */

function launchCompletionOverlay(){
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    z-index:2147483644;
    background:rgba(0,0,0,0);
    pointer-events:none;
    transition:background 0.55s;
    display:flex;align-items:center;justify-content:center;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    background:linear-gradient(155deg,rgba(20,14,4,0.94),rgba(10,7,2,0.97));
    backdrop-filter:blur(40px) saturate(160%);
    -webkit-backdrop-filter:blur(40px) saturate(160%);
    border-top:   1px solid rgba(220,175,55,0.7);
    border-left:  1px solid rgba(220,175,55,0.22);
    border-right: 1px solid rgba(220,175,55,0.22);
    border-bottom:1px solid rgba(220,175,55,0.12);
    border-radius:3px;
    padding:46px 54px;
    text-align:center;
    box-shadow:0 0 60px rgba(215,170,45,0.15), 0 40px 90px rgba(0,0,0,0.8);
    opacity:0;
    transform:scale(0.86) translateY(24px);
    transition:opacity 0.5s cubic-bezier(0.34,1.4,0.64,1) 0.2s,
               transform 0.5s cubic-bezier(0.34,1.4,0.64,1) 0.2s;
    pointer-events:auto;
    max-width:370px;
    position:relative;overflow:hidden;
  `;

  /* corner brackets on overlay card */
  card.innerHTML = `
    <div style="position:absolute;top:0;left:0;width:18px;height:18px;border-top:2px solid rgba(220,175,55,0.9);border-left:2px solid rgba(220,175,55,0.9);"></div>
    <div style="position:absolute;top:0;right:0;width:18px;height:18px;border-top:2px solid rgba(220,175,55,0.9);border-right:2px solid rgba(220,175,55,0.9);"></div>
    <div style="position:absolute;bottom:0;left:0;width:18px;height:18px;border-bottom:2px solid rgba(220,175,55,0.55);border-left:2px solid rgba(220,175,55,0.55);"></div>
    <div style="position:absolute;bottom:0;right:0;width:18px;height:18px;border-bottom:2px solid rgba(220,175,55,0.55);border-right:2px solid rgba(220,175,55,0.55);"></div>

    <div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:rgba(220,175,55,0.38);letter-spacing:0.28em;text-transform:uppercase;margin-bottom:14px;">∴ session complete ∴</div>

    <div style="
      font-family:'Bebas Neue',sans-serif;
      font-size:58px;line-height:0.9;
      color:#f5e090;
      text-shadow:0 0 50px rgba(220,175,55,0.45), 0 0 100px rgba(220,175,55,0.12);
      margin-bottom:4px;letter-spacing:0.03em;
    ">8 GHANTE</div>

    <div style="
      font-family:'Cinzel',serif;font-size:13px;font-weight:600;
      color:rgba(220,175,55,0.55);letter-spacing:0.28em;text-transform:uppercase;
      margin-bottom:18px;
    ">Complete</div>

    <div style="
      font-family:'Cormorant Garamond',serif;
      font-size:16px;font-weight:300;font-style:italic;
      color:rgba(232,213,163,0.65);line-height:1.65;
      margin-bottom:24px;
    ">nikal gayo bhai 😭<br>chutti pakki hai, ghar ja heve<br>keka band kar</div>

    <div style="
      font-family:'JetBrains Mono',monospace;
      font-size:8px;color:rgba(205,165,75,0.22);
      letter-spacing:0.18em;text-transform:uppercase;
    ">tap anywhere to close</div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.background = 'rgba(6,3,12,0.75)';
    card.style.opacity   = '1';
    card.style.transform = 'scale(1) translateY(0)';
  }, 80);

  overlay.addEventListener('click', () => {
    overlay.style.background = 'rgba(0,0,0,0)';
    card.style.opacity   = '0';
    card.style.transform = 'scale(0.93) translateY(14px)';
    setTimeout(() => overlay.remove(), 480);
  });
}

/* ═══════════════════════════════════════
   COMPLETION THEME SHIFT → full gold
═══════════════════════════════════════ */

function applyCompletionTheme(){
  const box = document.getElementById('kekaArtifact');
  if(!box) return;

  /* border upgrades */
  box.style.borderTopColor    = 'rgba(220,175,55,0.75)';
  box.style.borderLeftColor   = 'rgba(220,175,55,0.28)';
  box.style.borderRightColor  = 'rgba(220,175,55,0.28)';
  box.style.borderBottomColor = 'rgba(220,175,55,0.15)';

  /* background warms up */
  box.style.background = 'linear-gradient(155deg,rgba(20,14,4,0.97) 0%,rgba(12,8,2,0.99) 55%,rgba(10,6,1,1) 100%)';

  box.classList.remove('ka-alive','ka-warning');
  box.classList.add('ka-victory');

  /* rune title → brighter gold */
  const title = box.querySelector('.ka-rune-title');
  if(title) title.style.color = '#e8c84a';

  /* live dot → bright gold */
  const dot = document.getElementById('kaLiveDot');
  if(dot){ dot.style.background = '#eab308'; dot.style.boxShadow = '0 0 8px rgba(234,179,8,0.9)'; }

  /* big clock → warm gold */
  const kaH = document.getElementById('kaHours');
  const kaM = document.getElementById('kaMins');
  if(kaH) kaH.style.color = '#f5e090';
  if(kaM) kaM.style.color = '#f5e090';
  if(kaH) kaH.style.textShadow = '0 0 50px rgba(220,175,55,0.45), 0 2px 0 rgba(0,0,0,0.9)';
  if(kaM) kaM.style.textShadow = '0 0 50px rgba(220,175,55,0.45), 0 2px 0 rgba(0,0,0,0.9)';

  /* left (baaki) → gold */
  const leftEl = document.getElementById('kaLeft');
  if(leftEl){ leftEl.style.color = '#fde080'; leftEl.style.textShadow = '0 0 10px rgba(220,175,55,0.5)'; }

  /* bar → victory fill */
  const bar = document.getElementById('kaBar');
  if(bar){
    bar.classList.remove('ka-bar-fill');
    bar.classList.add('ka-bar-fill-victory');
    bar.style.width = '100%';
  }

  /* percent */
  const pct = document.getElementById('kaPercent');
  if(pct){ pct.textContent = '100%'; pct.style.color = 'rgba(220,175,55,0.8)'; }

  /* freedom label */
  const fl = document.getElementById('kaFreedomLabel');
  if(fl){ fl.textContent = 'freedom ✦'; fl.style.color = 'rgba(220,175,55,0.5)'; }

  /* chutti card → gold too */
  const fullEl = document.getElementById('kaFull');
  if(fullEl){ fullEl.style.color = '#fde080'; fullEl.style.textShadow = '0 0 12px rgba(220,175,55,0.4)'; }

  /* ticker → victory text, gold color */
  const ticker = document.getElementById('kaTicker');
  if(ticker){
    ticker.style.color = 'rgba(220,175,55,0.3)';
    ticker.innerHTML = 'VICTORY &nbsp;✦&nbsp; CHUTTI PAKKI HAI &nbsp;✦&nbsp; GHAR JA BHAI MA RAAH JOWE CHE &nbsp;✦&nbsp; LAPTOP BAND KAR &nbsp;✦&nbsp; SURAT NO SHER JEET GAYO &nbsp;✦&nbsp; NIKAL BHAI &nbsp;✦&nbsp; VICTORY &nbsp;✦&nbsp; CHUTTI PAKKI HAI &nbsp;✦&nbsp; GHAR JA BHAI MA RAAH JOWE CHE &nbsp;✦&nbsp; LAPTOP BAND KAR &nbsp;✦&nbsp;';
  }

  /* vibe quote */
  const vibe = document.getElementById('kaVibe');
  if(vibe){
    vibe.style.color = 'rgba(220,185,90,0.45)';
    vibe.style.borderLeftColor = 'rgba(220,175,55,0.28)';
    vibe.textContent = '"nikal gayo bhai... the realm is yours. ghar ja."';
  }
}

/* ═══════════════════════════════════════
   BROWSER NOTIFICATION
═══════════════════════════════════════ */

function requestNotificationPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    setTimeout(() => Notification.requestPermission(), 3000);
  }
}

function fireNativeNotification(){
  if(!('Notification' in window)) return;
  if(Notification.permission !== 'granted') return;
  try {
    const n = new Notification('✦ 8 Ghante Pure Bhai!', {
      body: 'Chutti pakki hai — nikal ghar ja heve. Keka band kar.',
      tag: 'keka-8hr',
      requireInteraction: true,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch(e){}
}

/* ═══════════════════════════════════════
   TAB TITLE FLASH
═══════════════════════════════════════ */

function startTitleFlash(){
  if(titleFlashInterval) return;
  let t = false;
  titleFlashInterval = setInterval(() => {
    document.title = t ? '✦ Chutti Time! Ghar Ja!' : '✅ 8hrs Done — Nikal Bhai!';
    t = !t;
  }, 1300);
}

/* ═══════════════════════════════════════
   UPDATE UI
═══════════════════════════════════════ */

function updateUI(){
  const data = window.KekaHoursLatest;
  if(!data) return;

  const { totalMinutes, breakMinutes, firstStart } = data;
  const remaining = WORK_MINUTES - totalMinutes;
  const percent   = Math.min(100, (totalMinutes / WORK_MINUTES) * 100);

  /* big clock split into hours + mins */
  const kaH = document.getElementById('kaHours');
  const kaM = document.getElementById('kaMins');
  if(kaH) kaH.textContent = Math.floor(totalMinutes / 60);
  if(kaM) kaM.textContent = String(totalMinutes % 60).padStart(2, '0');

  /* stamina bar */
  const bar = document.getElementById('kaBar');
  if(bar && !eightHourTriggered) bar.style.width = percent + '%';

  /* percent */
  const pct = document.getElementById('kaPercent');
  if(pct && !eightHourTriggered) pct.textContent = Math.floor(percent) + '%';

  /* vibe quote */
  const vibe = document.getElementById('kaVibe');
  if(vibe && !eightHourTriggered) vibe.textContent = getVibe(percent);

  /* baaki + break */
  const leftEl = document.getElementById('kaLeft');
  const brkEl  = document.getElementById('kaBreak');
  if(brkEl) brkEl.textContent = `${Math.floor(breakMinutes/60)}h ${String(breakMinutes%60).padStart(2,'0')}m`;
  if(leftEl && !eightHourTriggered){
    const r = Math.max(0, remaining);
    leftEl.textContent = `${Math.floor(r/60)}h ${String(r%60).padStart(2,'0')}m`;
    /* transitions from orange → gold as you approach end */
    leftEl.style.color = remaining <= 30
      ? 'rgba(232,201,122,0.95)'
      : '#c8941e';
  }

  /* ETAs */
  if(firstStart){
    const st = parseTime(firstStart);
    if(st){
      const base = new Date();
      base.setHours(st.hours, st.minutes, 0, 0);
      const half = new Date(base.getTime() + (HALF_DAY_MINUTES + breakMinutes) * 60000);
      const full = new Date(base.getTime() + (WORK_MINUTES     + breakMinutes) * 60000);
      const fmt  = (d) => d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }).toUpperCase();
      const halfEl = document.getElementById('kaHalf');
      const fullEl = document.getElementById('kaFull');
      if(halfEl) halfEl.textContent = fmt(half);
      if(fullEl && !eightHourTriggered) fullEl.textContent = fmt(full);
    }
  }

  /* near-end → warning aura ≤30 min */
  const box = document.getElementById('kekaArtifact');
  if(box && remaining <= 30 && remaining > 0 && !eightHourTriggered && !box.classList.contains('ka-warning')){
    box.classList.remove('ka-alive');
    box.classList.add('ka-warning');
  }

  /* 10 min toast */
  if(remaining <= 10 && remaining > 0 && !tenMinTriggered){
    tenMinTriggered = true;
    showToast('⏳', 'SIRF 10 MINUTE', 'bas thodi der aur, ruk mat...', 'rgba(200,148,30,0.8)');
  }

  /* 8hr done — the victory sequence */
  if(totalMinutes >= WORK_MINUTES && !eightHourTriggered){
    eightHourTriggered = true;
    launchConfetti();
    launchCompletionOverlay();
    applyCompletionTheme();
    fireNativeNotification();
    startTitleFlash();
    showToast('✦', '8 GHANTE PURE', 'nikal gayo bhai... ghar ja heve', '#d4a84b');
  }
}

/* ═══════════════════════════════════════
   OBSERVER + LOOP
═══════════════════════════════════════ */

function findLogs(){
  return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
}

const observer = new MutationObserver(() => {
  const c = findLogs(); if(c) processLogs(c);
});
observer.observe(document.body, { childList: true, subtree: true });

createUI();
requestNotificationPermission();

setInterval(() => {
  const c = findLogs(); if(c) processLogs(c);
  updateUI();
}, 1000);

})();
