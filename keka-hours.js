// keka-hours-genz.js — surat wala grind 💚
(function(){
'use strict';

const WORK_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

let tenMinTriggered = false;
let eightHourTriggered = false;
let confettiInterval = null;
let didSlideIn = false;

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
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Unbounded:wght@700;900&display=swap');

    @keyframes keka-slideIn {
      from { transform: translateX(130%); opacity:0; }
      to   { transform: translateX(0);    opacity:1; }
    }
    @keyframes keka-bratPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(132,220,0,0.6), 0 24px 60px rgba(0,0,0,0.55); }
      50%      { box-shadow: 0 0 0 14px rgba(132,220,0,0), 0 24px 60px rgba(0,0,0,0.55); }
    }
    @keyframes keka-barShimmer {
      0%   { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes keka-tickerScroll {
      0%   { transform: translateX(100%); }
      100% { transform: translateX(-220%); }
    }
    @keyframes keka-statusDot {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.4; transform:scale(0.75); }
    }
    @keyframes keka-floatBadge {
      0%,100% { transform: translateY(0px) rotate(-1deg); }
      50%      { transform: translateY(-6px) rotate(1deg); }
    }
    @keyframes keka-confettiFall {
      0%   { transform: translateY(-10px) rotate(0deg);   opacity:1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity:0; }
    }
    @keyframes keka-rainbowBorder {
      0%   { border-color: #84dc00; box-shadow: 0 0 20px rgba(132,220,0,0.55), 0 24px 60px rgba(0,0,0,0.55); }
      25%  { border-color: #ff6af0; box-shadow: 0 0 20px rgba(255,106,240,0.55), 0 24px 60px rgba(0,0,0,0.55); }
      50%  { border-color: #00e5ff; box-shadow: 0 0 20px rgba(0,229,255,0.55), 0 24px 60px rgba(0,0,0,0.55); }
      75%  { border-color: #ffcc00; box-shadow: 0 0 20px rgba(255,204,0,0.55), 0 24px 60px rgba(0,0,0,0.55); }
      100% { border-color: #84dc00; box-shadow: 0 0 20px rgba(132,220,0,0.55), 0 24px 60px rgba(0,0,0,0.55); }
    }
    @keyframes keka-vibeWobble {
      0%,100% { letter-spacing: -0.01em; }
      50%      { letter-spacing:  0.02em; }
    }

    /* Slide-in once on mount */
    #kekaFloating {
      animation: keka-slideIn 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards;
      will-change: transform;
    }
    /* Pulse added as class after slideIn — no hover conflict */
    #kekaFloating.keka-pulsing {
      animation: keka-bratPulse 3s ease-in-out infinite !important;
    }
    /* Rainbow near end-of-day */
    #kekaFloating.keka-rainbow {
      animation: keka-rainbowBorder 1.4s linear infinite !important;
    }

    .keka-progress-fill {
      background: linear-gradient(90deg, #84dc00, #c6ff47, #00e5ff, #84dc00);
      background-size: 300% 100%;
      animation: keka-barShimmer 2.2s linear infinite;
    }
    .keka-stat-card {
      transition: transform 0.18s ease, box-shadow 0.18s ease;
      cursor: default;
    }
    .keka-stat-card:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 8px 24px rgba(0,0,0,0.45) !important;
    }
    #kekaTicker {
      display: inline-block;
      white-space: nowrap;
      animation: keka-tickerScroll 18s linear infinite;
    }
    .keka-dot {
      animation: keka-statusDot 1.4s ease-in-out infinite;
    }
    .keka-vibe-text {
      animation: keka-vibeWobble 3s ease-in-out infinite;
    }
    .keka-completion-badge {
      animation: keka-floatBadge 2s ease-in-out infinite;
    }
    .keka-confetti {
      position:fixed;
      top:-20px;
      z-index:999999999;
      pointer-events:none;
      animation: keka-confettiFall linear forwards;
    }
    #kekaMinBtn {
      transition: background 0.15s, transform 0.15s;
      line-height: 1;
    }
    #kekaMinBtn:hover {
      background: rgba(0,0,0,0.38) !important;
      transform: scale(1.15);
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
    position:fixed;
    top:24px;
    right:24px;
    z-index:999999;
    width:360px;
    border-radius:22px;
    background:rgba(8,11,8,0.78);
    backdrop-filter:blur(32px) saturate(200%) brightness(0.9);
    -webkit-backdrop-filter:blur(32px) saturate(200%) brightness(0.9);
    border:2px solid #84dc00;
    box-shadow:0 24px 60px rgba(0,0,0,0.55);
    color:white;
    font-family:'Space Grotesk', sans-serif;
    overflow:hidden;
    cursor:default;
    user-select:none;
  `;

  box.innerHTML = `
    <!-- HEADER -->
    <div style="
      background:#84dc00;
      padding:12px 18px;
      display:flex;
      align-items:center;
      justify-content:space-between;
    ">
      <div style="display:flex;align-items:center;gap:9px;">
        <div class="keka-dot" style="
          width:10px;height:10px;border-radius:50%;
          background:#0a0f0a;flex-shrink:0;
        "></div>
        <span style="
          font-family:'Unbounded',sans-serif;
          font-weight:900;
          font-size:13px;
          color:#0a0f0a;
          letter-spacing:0.04em;
          text-transform:uppercase;
        ">grind tracker™</span>
      </div>
      <div style="display:flex;gap:7px;align-items:center;">
        <span style="
          font-family:'Space Grotesk',sans-serif;
          font-size:10px;font-weight:700;
          background:#0a0f0a;color:#84dc00;
          padding:3px 10px;border-radius:99px;
          letter-spacing:0.06em;text-transform:uppercase;
        ">● LIVE</span>
        <button id="kekaMinBtn" style="
          background:rgba(0,0,0,0.22);border:none;cursor:pointer;
          width:25px;height:25px;border-radius:50%;
          color:#0a0f0a;font-size:17px;font-weight:900;
          display:flex;align-items:center;justify-content:center;
          padding-bottom:2px;
        ">−</button>
      </div>
    </div>

    <!-- BODY -->
    <div id="kekaBody" style="padding:18px 18px 16px;">

      <!-- Vibe heading -->
      <div id="kekaVibe" class="keka-vibe-text" style="
        font-family:'Unbounded',sans-serif;
        font-size:20px;
        font-weight:900;
        line-height:1.15;
        margin-bottom:14px;
        color:#84dc00;
        letter-spacing:-0.01em;
      ">kaam shuru kar yaar 🔥</div>

      <!-- Progress -->
      <div style="margin-bottom:14px;">
        <div style="
          display:flex;justify-content:space-between;align-items:center;
          margin-bottom:7px;
        ">
          <span style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:0.12em;text-transform:uppercase;font-weight:500;">Progress</span>
          <span id="kekaPercent" style="font-family:'Unbounded',sans-serif;font-size:11px;font-weight:700;color:#84dc00;">0%</span>
        </div>
        <div style="
          height:11px;
          background:rgba(255,255,255,0.07);
          border-radius:99px;
          overflow:hidden;
          border:1px solid rgba(255,255,255,0.06);
        ">
          <div id="progressBar" class="keka-progress-fill"
            style="height:100%;width:0%;border-radius:99px;transition:width 1s ease;">
          </div>
        </div>
      </div>

      <!-- Done / Baaki -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="keka-stat-card" style="
          background:rgba(132,220,0,0.09);border-radius:14px;
          padding:13px 14px;border:1px solid rgba(132,220,0,0.22);
          backdrop-filter:blur(8px);
        ">
          <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;font-weight:500;">Done ✅</div>
          <div id="kekaDone" style="font-family:'Unbounded',sans-serif;font-size:23px;font-weight:900;color:#84dc00;line-height:1;">0h 0m</div>
        </div>
        <div class="keka-stat-card" style="
          background:rgba(255,106,240,0.09);border-radius:14px;
          padding:13px 14px;border:1px solid rgba(255,106,240,0.22);
          backdrop-filter:blur(8px);
        ">
          <div style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;font-weight:500;">Baaki ⏳</div>
          <div id="kekaLeft" style="font-family:'Unbounded',sans-serif;font-size:23px;font-weight:900;color:#ff6af0;line-height:1;">8h 0m</div>
        </div>
      </div>

      <!-- Break -->
      <div style="
        background:rgba(255,204,0,0.08);border:1px solid rgba(255,204,0,0.18);
        border-radius:12px;padding:10px 14px;
        display:flex;justify-content:space-between;align-items:center;
        margin-bottom:10px;backdrop-filter:blur(8px);
      ">
        <span style="font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.07em;text-transform:uppercase;font-weight:500;">☕ Break liya</span>
        <span id="kekaBreak" style="font-family:'Unbounded',sans-serif;font-size:13px;font-weight:700;color:#ffcc00;">0h 0m</span>
      </div>

      <!-- ETA cards -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div class="keka-stat-card" style="
          background:rgba(255,204,0,0.07);border-radius:14px;
          padding:12px 14px;border:1px solid rgba(255,204,0,0.18);
          backdrop-filter:blur(8px);
        ">
          <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;font-weight:500;">Half day ✌️</div>
          <div id="kekaHalf" style="font-family:'Unbounded',sans-serif;font-size:15px;font-weight:700;color:#ffcc00;">--:--</div>
        </div>
        <div class="keka-stat-card" style="
          background:rgba(0,229,255,0.07);border-radius:14px;
          padding:12px 14px;border:1px solid rgba(0,229,255,0.18);
          backdrop-filter:blur(8px);
        ">
          <div style="font-size:10px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;font-weight:500;">Chutti 🚀</div>
          <div id="kekaFull" style="font-family:'Unbounded',sans-serif;font-size:15px;font-weight:700;color:#00e5ff;">--:--</div>
        </div>
      </div>

      <!-- Ticker -->
      <div style="
        overflow:hidden;font-size:10px;
        color:rgba(132,220,0,0.5);
        letter-spacing:0.1em;text-transform:uppercase;font-weight:500;
        border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;
      ">
        <span id="kekaTicker">
          CHAI PIYA KYA? ✦ SCREEN SE AANKH HATA ✦ SURAT KA SHER ✦ KHATAM HONE WALA HAI ✦ THODI AUR MEHNAT ✦ GHAR JAAYEGA TU ✦ KAAM MEIN DIMAAG LAGA ✦
        </span>
      </div>

    </div>
  `;

  document.body.appendChild(box);

  /* Slide-in ends → switch to pulse class. No hover re-trigger. */
  box.addEventListener('animationend', (e) => {
    if(e.animationName === 'keka-slideIn' && !didSlideIn){
      didSlideIn = true;
      box.classList.add('keka-pulsing');
    }
  }, { once: true });

  /* Minimize */
  let minimized = false;
  document.getElementById('kekaMinBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    minimized = !minimized;
    document.getElementById('kekaBody').style.display = minimized ? 'none' : 'block';
    e.currentTarget.textContent = minimized ? '+' : '−';
  });
}

/* ================= DESI VIBE MESSAGES ================= */

function getVibeMessage(percent){
  if(percent >= 100) return "Nikal bhai, chutti! 🎉";
  if(percent >= 90)  return "10% baaki, ruk mat! 💪";
  if(percent >= 75)  return "Seedha ghar ki taraf 👀";
  if(percent >= 50)  return "Aadha ho gaya, nice! ✨";
  if(percent >= 25)  return "Chautha part done, chal! 🙌";
  return "kaam shuru kar yaar 🔥";
}

/* ================= CONFETTI ================= */

function launchConfetti(){
  const colors = ['#84dc00','#ff6af0','#00e5ff','#ffcc00','#ff4d4d','#fff','#b6ff47'];
  let count = 0;
  confettiInterval = setInterval(()=>{
    if(count++ > 100){ clearInterval(confettiInterval); return; }
    const piece = document.createElement('div');
    piece.className = 'keka-confetti';
    const size = Math.random()*9+5;
    piece.style.cssText = `
      left:${Math.random()*100}vw;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>0.5?'50%':'3px'};
      animation-duration:${Math.random()*2.5+2}s;
      animation-delay:${Math.random()*0.6}s;
    `;
    document.body.appendChild(piece);
    setTimeout(()=> piece.remove(), 5000);
  }, 70);
}

/* ================= TOAST ================= */

function showToast(emoji, line1, line2, color){
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:32px;left:50%;
    transform:translateX(-50%) translateY(90px);
    z-index:9999999;
    background:rgba(8,11,8,0.92);
    backdrop-filter:blur(20px);
    border:2px solid ${color};
    border-radius:18px;
    padding:16px 28px;
    font-family:'Space Grotesk',sans-serif;
    font-weight:700;font-size:14px;
    color:white;text-align:center;
    box-shadow:0 20px 60px rgba(0,0,0,0.7), 0 0 30px ${color}44;
    transition:transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.45s;
    opacity:0;min-width:240px;pointer-events:none;
  `;
  toast.innerHTML = `
    <div style="font-size:30px;margin-bottom:5px;">${emoji}</div>
    <div style="color:${color};font-family:'Unbounded',sans-serif;font-size:13px;">${line1}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:3px;">${line2}</div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(()=>{
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  setTimeout(()=>{
    toast.style.transform = 'translateX(-50%) translateY(90px)';
    toast.style.opacity = '0';
    setTimeout(()=> toast.remove(), 500);
  }, 4500);
}

/* ================= WITCH FLYOVER ================= */

function launchFullScreenWitch(){
  launchConfetti();

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    z-index:99999990;background:rgba(0,0,0,0);
    pointer-events:none;transition:background 0.5s;
    display:flex;align-items:center;justify-content:center;
  `;

  const badge = document.createElement('div');
  badge.className = 'keka-completion-badge';
  badge.style.cssText = `
    font-family:'Unbounded',sans-serif;font-weight:900;
    font-size:clamp(26px,5vw,54px);color:#84dc00;
    text-align:center;text-shadow:0 0 50px rgba(132,220,0,0.9);
    opacity:0;transition:opacity 0.6s 0.4s;line-height:1.25;
  `;
  badge.innerHTML = `8 GHANTE<br><span style="color:#ff6af0">COMPLETE!</span><br><span style="font-family:'Space Grotesk',sans-serif;font-size:0.4em;color:rgba(255,255,255,0.65);">nikal gaya bhai, chutti pakki 🎊</span>`;

  overlay.appendChild(badge);
  document.body.appendChild(overlay);

  setTimeout(()=>{ overlay.style.background='rgba(0,0,0,0.7)'; badge.style.opacity='1'; }, 300);

  const witch = document.createElement('img');
  witch.src = 'https://raw.githubusercontent.com/neelkanth23/keka/main/witch.jpg';
  witch.style.cssText = `
    position:fixed;top:30%;left:-340px;width:300px;
    z-index:99999999;pointer-events:none;
    border-radius:22px;border:3px solid #84dc00;
    box-shadow:0 0 60px rgba(132,220,0,0.6),0 20px 50px rgba(0,0,0,0.6);
    transition:left 9s cubic-bezier(0.4,0,0.6,1);
    filter:saturate(1.5) contrast(1.05);
  `;
  document.body.appendChild(witch);
  setTimeout(()=>{ witch.style.left='120%'; }, 200);
  setTimeout(()=>{
    witch.remove();
    overlay.style.background='rgba(0,0,0,0)';
    badge.style.opacity='0';
    setTimeout(()=> overlay.remove(), 600);
  }, 9800);
}

/* ================= UPDATE UI ================= */

function updateUI(){
  const data = window.KekaHoursLatest;
  if(!data) return;

  const { totalMinutes, breakMinutes, firstStart } = data;
  const remaining = WORK_MINUTES - totalMinutes;
  const percent = Math.min(100, (totalMinutes / WORK_MINUTES) * 100);

  const bar = document.getElementById('progressBar');
  if(bar){
    bar.style.width = percent + '%';
    if(percent >= 100){
      bar.classList.remove('keka-progress-fill');
      bar.style.background = '#84dc00';
      bar.style.animation = 'none';
      bar.style.boxShadow = '0 0 14px rgba(132,220,0,0.8)';
    }
  }

  const pct = document.getElementById('kekaPercent');
  if(pct) pct.textContent = Math.floor(percent) + '%';

  const vibe = document.getElementById('kekaVibe');
  if(vibe) vibe.textContent = getVibeMessage(percent);

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

  /* Rainbow border ≤30 min left */
  const floatBox = document.getElementById('kekaFloating');
  if(floatBox && remaining <= 30 && remaining > 0 && !floatBox.classList.contains('keka-rainbow')){
    floatBox.classList.remove('keka-pulsing');
    floatBox.classList.add('keka-rainbow');
  }

  /* 10 min toast */
  if(remaining <= 10 && remaining > 0 && !tenMinTriggered){
    tenMinTriggered = true;
    showToast('⚡', 'SIRF 10 MINUTE!', 'bas thodi der aur, ruk ja', '#ff6af0');
  }

  /* 8hr done */
  if(totalMinutes >= WORK_MINUTES && !eightHourTriggered){
    eightHourTriggered = true;
    launchFullScreenWitch();
    showToast('🎊', '8 GHANTE PURE!', 'nikal bhai, chutti pakki hai', '#84dc00');
  }
}

/* ================= OBSERVER + LOOP ================= */

function findLogs(){
  return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
}

const observer = new MutationObserver(()=>{
  const c = findLogs();
  if(c) processLogs(c);
});

observer.observe(document.body,{childList:true,subtree:true});

createUI();
setInterval(()=>{
  const c = findLogs();
  if(c) processLogs(c);
  updateUI();
}, 1000);

})();
