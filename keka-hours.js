// keka-hours-genz.js — brat era, no apologies 💚
(function(){
'use strict';

const WORK_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

let tenMinTriggered = false;
let eightHourTriggered = false;
let confettiInterval = null;

/* ================= TIME HELPERS ================= */

function parseTime(ts){
  if(!ts || ts === 'MISSING') return null;
  const parts = ts.toLowerCase().split(' ').filter(Boolean);
  if(parts.length < 2) return null;
  let [H,M] = parts[0].split(':').map(Number);
  const ap = parts[1];
  if(ap === 'pm' && H !== 12) H += 12;
  if(ap === 'am' && H === 12) H = 0;
  return { hours:H, minutes:M };
}

function minutesBetween(s,e){
  const st = parseTime(s);
  const en = parseTime(e);
  if(!st || !en) return 0;
  let mins = (en.hours - st.hours)*60 + (en.minutes - st.minutes);
  if(mins < 0) mins += 1440;
  if(mins > 720) mins = 0;
  return mins;
}

/* ================= PROCESS LOGS ================= */

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
    if(e === "MISSING"){ activeStart = s; }
    else { totalM += minutesBetween(s, e); prevEnd = e; }
  });

  if(activeStart){
    const st = parseTime(activeStart);
    if(st){
      const now = new Date();
      let liveMinutes = (now.getHours() - st.hours)*60 + (now.getMinutes() - st.minutes);
      if(liveMinutes > 0) totalM += liveMinutes;
    }
  }

  window.KekaHoursLatest = { totalMinutes: totalM, breakMinutes: breakM, firstStart };
}

/* ================= INJECT STYLES ================= */

function injectStyles(){
  if(document.getElementById('kekaGenZStyles')) return;
  const style = document.createElement('style');
  style.id = 'kekaGenZStyles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

    @keyframes bratPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(132,220,0,0.7), 0 30px 70px rgba(0,0,0,0.6); }
      50%      { box-shadow: 0 0 0 18px rgba(132,220,0,0), 0 30px 70px rgba(0,0,0,0.6); }
    }
    @keyframes slideIn {
      from { transform: translateX(120%); opacity:0; }
      to   { transform: translateX(0);    opacity:1; }
    }
    @keyframes tickerScroll {
      0%   { transform: translateX(100%); }
      100% { transform: translateX(-100%); }
    }
    @keyframes barShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes popIn {
      0%   { transform: scale(0.4) rotate(-8deg); opacity:0; }
      70%  { transform: scale(1.08) rotate(2deg); opacity:1; }
      100% { transform: scale(1) rotate(0deg); }
    }
    @keyframes floatBadge {
      0%,100% { transform: translateY(0px) rotate(-2deg); }
      50%      { transform: translateY(-5px) rotate(2deg); }
    }
    @keyframes confettiFall {
      0%   { transform: translateY(-10px) rotate(0deg);   opacity:1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity:0; }
    }
    @keyframes rainbowBorder {
      0%   { border-color: #84dc00; }
      25%  { border-color: #ff6af0; }
      50%  { border-color: #00e5ff; }
      75%  { border-color: #ffcc00; }
      100% { border-color: #84dc00; }
    }
    @keyframes glitch {
      0%,100% { transform: translate(0); }
      20%      { transform: translate(-2px, 1px); }
      40%      { transform: translate(2px, -1px); }
      60%      { transform: translate(-1px, 2px); }
      80%      { transform: translate(1px, -2px); }
    }
    @keyframes wobble {
      0%,100% { transform: scale(1); }
      50%      { transform: scale(1.05); }
    }
    @keyframes statusDot {
      0%,100% { opacity:1; }
      50%      { opacity:0.3; }
    }

    #kekaFloating {
      animation: slideIn 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards, bratPulse 3s ease-in-out 1s infinite;
    }
    #kekaFloating:hover {
      animation: bratPulse 3s ease-in-out infinite;
      transform: scale(1.01);
      transition: transform 0.2s;
    }
    .keka-progress-bar {
      background: linear-gradient(90deg, #84dc00, #b6ff2e, #00e5ff, #84dc00);
      background-size: 300% 100%;
      animation: barShimmer 2s linear infinite;
    }
    .keka-stat-card {
      transition: transform 0.15s, background 0.15s;
    }
    .keka-stat-card:hover {
      transform: scale(1.03) translateY(-1px);
      background: rgba(255,255,255,0.12) !important;
    }
    .keka-minimize-btn:hover {
      background: rgba(255,255,255,0.2) !important;
      transform: scale(1.1);
    }
    .keka-ticker span {
      animation: tickerScroll 14s linear infinite;
    }
    .keka-status-dot {
      animation: statusDot 1.4s ease-in-out infinite;
    }
    .keka-completion-badge {
      animation: floatBadge 2s ease-in-out infinite;
    }
    .confetti-piece {
      position: fixed;
      width: 10px;
      height: 10px;
      top: -20px;
      z-index: 999999999;
      pointer-events: none;
      animation: confettiFall linear forwards;
    }
  `;
  document.head.appendChild(style);
}

/* ================= CREATE UI ================= */

function createUI(){
  injectStyles();
  if(document.getElementById('kekaFloating')) return;

  const box = document.createElement('div');
  box.id = 'kekaFloating';
  box.style.cssText = `
    position:fixed; top:24px; right:24px; z-index:999999;
    width:300px;
    border-radius:20px;
    background:rgba(10,12,10,0.72);
    backdrop-filter:blur(28px) saturate(180%) brightness(0.95);
    -webkit-backdrop-filter:blur(28px) saturate(180%) brightness(0.95);
    border:2px solid #84dc00;
    color:white;
    font-family:'Space Mono', monospace;
    overflow:hidden;
    cursor:default;
    user-select:none;
  `;

  box.innerHTML = `
    <!-- HEADER -->
    <div style="
      background:#84dc00;
      padding:10px 16px;
      display:flex;
      align-items:center;
      justify-content:space-between;
    ">
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="keka-status-dot" style="
          width:9px;height:9px;border-radius:50%;background:#0e0e0e;flex-shrink:0;
        "></div>
        <span style="
          font-family:'Syne',sans-serif;
          font-weight:800;
          font-size:13px;
          color:#0e0e0e;
          letter-spacing:0.05em;
          text-transform:uppercase;
        ">grind tracker™</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <span id="kekaWfhBadge" style="
          font-size:9px;font-weight:700;
          background:#0e0e0e;color:#84dc00;
          padding:2px 8px;border-radius:99px;
          letter-spacing:0.08em;text-transform:uppercase;
        ">● LIVE</span>
        <button id="kekaMinBtn" class="keka-minimize-btn" style="
          background:rgba(0,0,0,0.25);border:none;cursor:pointer;
          width:22px;height:22px;border-radius:50%;
          color:#0e0e0e;font-size:14px;font-weight:700;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.15s;
        ">−</button>
      </div>
    </div>

    <!-- BODY -->
    <div id="kekaBody" style="padding:16px 16px 14px;background:rgba(255,255,255,0.02);">

      <!-- Vibe label -->
      <div id="kekaVibe" style="
        font-family:'Syne',sans-serif;
        font-size:22px;
        font-weight:800;
        line-height:1;
        margin-bottom:12px;
        color:#84dc00;
        letter-spacing:-0.02em;
      ">let's get it 🔥</div>

      <!-- Progress -->
      <div style="margin-bottom:10px;">
        <div style="
          display:flex;justify-content:space-between;
          font-size:9px;color:rgba(255,255,255,0.45);
          margin-bottom:5px;letter-spacing:0.1em;text-transform:uppercase;
        ">
          <span>progress</span>
          <span id="kekaPercent">0%</span>
        </div>
        <div style="
          height:10px;background:rgba(255,255,255,0.08);
          border-radius:99px;overflow:hidden;
        ">
          <div id="progressBar" class="keka-progress-bar"
            style="height:100%;width:0%;border-radius:99px;transition:width 1s ease;">
          </div>
        </div>
      </div>

      <!-- Big time display -->
      <div style="
        display:grid;grid-template-columns:1fr 1fr;gap:8px;
        margin-bottom:10px;
      ">
        <div class="keka-stat-card" style="
          background:rgba(132,220,0,0.07);border-radius:12px;
          padding:10px 12px;border:1px solid rgba(132,220,0,0.18);
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        ">
          <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">done</div>
          <div id="kekaDone" style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#84dc00;">0h 0m</div>
        </div>
        <div class="keka-stat-card" style="
          background:rgba(255,106,240,0.07);border-radius:12px;
          padding:10px 12px;border:1px solid rgba(255,106,240,0.18);
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        ">
          <div style="font-size:9px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">left</div>
          <div id="kekaLeft" style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#ff6af0;">8h 0m</div>
        </div>
      </div>

      <!-- Break row -->
      <div style="
        background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.2);
        border-radius:10px;padding:8px 12px;
        display:flex;justify-content:space-between;align-items:center;
        margin-bottom:10px;
      ">
        <span style="font-size:10px;color:rgba(255,255,255,0.5);letter-spacing:0.08em;text-transform:uppercase;">break taken</span>
        <span id="kekaBreak" style="font-size:12px;font-weight:700;color:#ffcc00;">0h 0m</span>
      </div>

      <!-- ETA cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div class="keka-stat-card" style="
          background:rgba(255,204,0,0.07);border-radius:12px;
          padding:9px 12px;border:1px solid rgba(255,204,0,0.18);
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        ">
          <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">half day ✌️</div>
          <div id="kekaHalf" style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#ffcc00;">--:--</div>
        </div>
        <div class="keka-stat-card" style="
          background:rgba(0,229,255,0.07);border-radius:12px;
          padding:9px 12px;border:1px solid rgba(0,229,255,0.18);
          backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        ">
          <div style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:3px;">freedom 🚀</div>
          <div id="kekaFull" style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:#00e5ff;">--:--</div>
        </div>
      </div>

      <!-- Ticker -->
      <div class="keka-ticker" style="
        overflow:hidden;white-space:nowrap;
        font-size:9px;color:rgba(132,220,0,0.5);
        letter-spacing:0.1em;text-transform:uppercase;
        border-top:1px solid rgba(255,255,255,0.06);
        padding-top:8px;
      ">
        <span id="kekaTicker" style="display:inline-block;">
          YOU'RE DOING AMAZING SWEETIE ✦ STAY HYDRATED ✦ YOU'RE BUILT DIFFERENT ✦ GRIND NOW CHILL LATER ✦ NO CAP ✦
        </span>
      </div>
    </div>
  `;

  document.body.appendChild(box);

  /* Minimize toggle */
  let minimized = false;
  document.getElementById('kekaMinBtn').addEventListener('click', () => {
    minimized = !minimized;
    document.getElementById('kekaBody').style.display = minimized ? 'none' : 'block';
    document.getElementById('kekaMinBtn').textContent = minimized ? '+' : '−';
  });
}

/* ================= VIBE MESSAGES ================= */

function getVibeMessage(percent){
  if(percent >= 100) return "SLAY, YOU'RE DONE! 🧃";
  if(percent >= 90)  return "sooo close bestie 🏁";
  if(percent >= 75)  return "almost there no cap 💪";
  if(percent >= 50)  return "halfway slay ✨";
  if(percent >= 25)  return "locked in fr fr 🔒";
  return "let's get it 🔥";
}

/* ================= CONFETTI ================= */

function launchConfetti(){
  const colors = ['#84dc00','#ff6af0','#00e5ff','#ffcc00','#ff4d4d','#fff'];
  let count = 0;
  confettiInterval = setInterval(()=>{
    if(count++ > 80){ clearInterval(confettiInterval); return; }
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const size = Math.random()*8+6;
    piece.style.cssText = `
      left:${Math.random()*100}vw;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>0.5?'50%':'2px'};
      animation-duration:${Math.random()*2+2}s;
      animation-delay:${Math.random()*0.5}s;
    `;
    document.body.appendChild(piece);
    setTimeout(()=> piece.remove(), 4000);
  }, 80);
}

/* ================= TOAST NOTIFICATION ================= */

function showToast(emoji, title, sub, color){
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;
    bottom:30px; left:50%;
    transform:translateX(-50%) translateY(80px);
    z-index:9999999;
    background:#0e0e0e;
    border:2px solid ${color};
    border-radius:16px;
    padding:14px 22px;
    font-family:'Syne',sans-serif;
    font-weight:800;
    font-size:15px;
    color:white;
    text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,0.7);
    transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s;
    opacity:0;
    min-width:260px;
  `;
  toast.innerHTML = `
    <div style="font-size:28px;margin-bottom:4px;">${emoji}</div>
    <div style="color:${color};">${title}</div>
    <div style="font-family:'Space Mono',monospace;font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">${sub}</div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(()=>{
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(()=>{
    toast.style.transform = 'translateX(-50%) translateY(80px)';
    toast.style.opacity = '0';
    setTimeout(()=> toast.remove(), 500);
  }, 4000);
}

/* ================= WITCH FLYOVER (UPGRADED) ================= */

function launchFullScreenWitch(){
  launchConfetti();

  /* Dimmed overlay with celebration text */
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    z-index:99999990;
    background:rgba(0,0,0,0);
    pointer-events:none;
    transition:background 0.5s;
    display:flex;align-items:center;justify-content:center;
  `;

  const badge = document.createElement('div');
  badge.className = 'keka-completion-badge';
  badge.style.cssText = `
    font-family:'Syne',sans-serif;
    font-weight:800;
    font-size:clamp(28px,5vw,52px);
    color:#84dc00;
    text-align:center;
    text-shadow:0 0 40px rgba(132,220,0,0.8);
    opacity:0;
    transition:opacity 0.6s 0.4s;
    line-height:1.2;
  `;
  badge.innerHTML = `8 HOURS<br><span style="color:#ff6af0">COMPLETED</span><br><span style="font-size:0.45em;color:rgba(255,255,255,0.6);font-family:'Space Mono',monospace">you ate and left no crumbs 🍵</span>`;

  overlay.appendChild(badge);
  document.body.appendChild(overlay);

  setTimeout(()=>{
    overlay.style.background = 'rgba(0,0,0,0.65)';
    badge.style.opacity = '1';
  }, 300);

  /* Witch image */
  const witch = document.createElement('img');
  witch.src = 'https://raw.githubusercontent.com/neelkanth23/keka/main/witch.jpg';
  witch.style.cssText = `
    position:fixed;
    top:35%;
    left:-320px;
    width:280px;
    z-index:99999999;
    pointer-events:none;
    border-radius:20px;
    border:3px solid #84dc00;
    box-shadow:0 0 60px rgba(132,220,0,0.5);
    transition:left 9s cubic-bezier(0.4,0,0.6,1);
    filter:saturate(1.4);
  `;
  document.body.appendChild(witch);

  setTimeout(()=> { witch.style.left = '120%'; }, 200);
  setTimeout(()=>{
    witch.remove();
    overlay.style.background = 'rgba(0,0,0,0)';
    badge.style.opacity = '0';
    setTimeout(()=> overlay.remove(), 600);
  }, 9500);
}

/* ================= UPDATE UI ================= */

function updateUI(){
  const data = window.KekaHoursLatest;
  if(!data) return;

  const { totalMinutes, breakMinutes, firstStart } = data;
  const remaining = WORK_MINUTES - totalMinutes;
  const percent = Math.min(100, (totalMinutes / WORK_MINUTES) * 100);

  /* Progress bar */
  const bar = document.getElementById('progressBar');
  if(bar){
    bar.style.width = percent + '%';
    if(percent >= 100){
      bar.classList.remove('keka-progress-bar');
      bar.style.background = '#84dc00';
      bar.style.animation = 'none';
      bar.style.boxShadow = '0 0 12px rgba(132,220,0,0.7)';
    }
  }

  /* Percent label */
  const pct = document.getElementById('kekaPercent');
  if(pct) pct.textContent = Math.floor(percent) + '%';

  /* Vibe label */
  const vibe = document.getElementById('kekaVibe');
  if(vibe) vibe.textContent = getVibeMessage(percent);

  /* Stats */
  const doneEl = document.getElementById('kekaDone');
  const leftEl = document.getElementById('kekaLeft');
  const brkEl  = document.getElementById('kekaBreak');
  if(doneEl) doneEl.textContent = `${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`;
  if(leftEl){
    const r = Math.max(0, remaining);
    leftEl.textContent = `${Math.floor(r/60)}h ${r%60}m`;
    leftEl.style.color = remaining <= 30 ? '#84dc00' : '#ff6af0';
  }
  if(brkEl) brkEl.textContent = `${Math.floor(breakMinutes/60)}h ${breakMinutes%60}m`;

  /* ETAs */
  let halfTime = '--:--', fullTime = '--:--';
  if(firstStart){
    const st = parseTime(firstStart);
    if(st){
      const base = new Date();
      base.setHours(st.hours, st.minutes, 0, 0);
      const half = new Date(base.getTime() + (HALF_DAY_MINUTES + breakMinutes)*60000);
      const full = new Date(base.getTime() + (WORK_MINUTES + breakMinutes)*60000);
      halfTime = half.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
      fullTime = full.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});
    }
  }
  const halfEl = document.getElementById('kekaHalf');
  const fullEl = document.getElementById('kekaFull');
  if(halfEl) halfEl.textContent = halfTime;
  if(fullEl) fullEl.textContent = fullTime;

  /* Border rainbow when near done */
  const floatBox = document.getElementById('kekaFloating');
  if(floatBox && remaining <= 30 && remaining > 0){
    floatBox.style.animation = 'rainbowBorder 1.5s linear infinite, bratPulse 1.5s ease-in-out infinite';
  }

  /* 10 MIN WARNING */
  if(remaining <= 10 && remaining > 0 && !tenMinTriggered){
    tenMinTriggered = true;
    showToast('🧙‍♀️', '10 MINS LEFT BESTIE', 'wrap it up fr fr', '#ff6af0');
  }

  /* 8 HR DONE */
  if(totalMinutes >= WORK_MINUTES && !eightHourTriggered){
    eightHourTriggered = true;
    launchFullScreenWitch();
    showToast('🎉', 'THAT\'S 8 HOURS SLAY', 'u absolutely ate bestie', '#84dc00');
  }
}

/* ================= OBSERVER ================= */

function findLogs(){
  return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
}

const observer = new MutationObserver(()=>{
  const c = findLogs();
  if(c) processLogs(c);
});

observer.observe(document.body, { childList:true, subtree:true });

createUI();
setInterval(()=>{
  const c = findLogs();
  if(c) processLogs(c);
  updateUI();
}, 1000);

})();
