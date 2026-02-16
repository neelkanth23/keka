// keka-hours-final-real-time-witch.js
(function(){
'use strict';

const WORK_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

let tenMinTriggered = false;
let eightHourTriggered = false;

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

  let mins = (en.hours - st.hours) * 60 + (en.minutes - st.minutes);
  if(mins < 0) mins += 1440;
  if(mins > 720) mins = 0;

  return mins;
}

/* ================= PROCESS LOGS (REAL-TIME FIXED) ================= */

function processLogs(container){
  if(!container) return;

  const rows = Array.from(
    container.querySelectorAll('.ng-untouched.ng-pristine.ng-valid')
  );

  let totalM = 0;
  let firstStart = null;
  let prevEnd = null;
  let breakM = 0;
  let activeStart = null;

  rows.forEach((row, idx) => {

    const startEl = row.querySelector('.w-120.mr-20 .text-small')
      || row.querySelector('.w-120.mr-20');

    const endEl = row.querySelector('.w-120:not(.mr-20) .text-small')
      || row.querySelector('.w-120:not(.mr-20)');

    const s = startEl ? startEl.textContent.trim() : null;
    const e = endEl ? endEl.textContent.trim() : null;

    if(idx === 0) firstStart = s;

    if(idx !== 0 && prevEnd && s){
      breakM += minutesBetween(prevEnd, s);
    }

    if(e === "MISSING"){
      activeStart = s;
    } else {
      totalM += minutesBetween(s, e);
      prevEnd = e;
    }
  });

  /* ===== ADD LIVE RUNNING TIME ===== */
  if(activeStart){
    const st = parseTime(activeStart);
    if(st){
      const now = new Date();
      let liveMinutes =
        (now.getHours() - st.hours) * 60 +
        (now.getMinutes() - st.minutes);

      if(liveMinutes > 0){
        totalM += liveMinutes;
      }
    }
  }

  window.KekaHoursLatest = {
    totalMinutes: totalM,
    breakMinutes: breakM,
    firstStart: firstStart
  };
}

/* ================= UI ================= */

function createUI(){
  if(document.getElementById("kekaFloating")) return;

  const box = document.createElement("div");
  box.id = "kekaFloating";

  box.style.cssText = `
    position:fixed;
    top:30px;
    right:30px;
    z-index:999999;
    padding:22px;
    width:320px;
    border-radius:26px;
    background:rgba(18,22,30,0.82);
    backdrop-filter: blur(22px) saturate(160%);
    border:1px solid rgba(255,255,255,0.2);
    box-shadow:0 30px 70px rgba(0,0,0,0.55);
    color:white;
    font-family:-apple-system,Inter;
  `;

  box.innerHTML = `
    <div style="font-weight:600;margin-bottom:14px;">⏱ Work Progress</div>

    <div style="height:12px;background:rgba(255,255,255,0.1);
         border-radius:12px;overflow:hidden;">
      <div id="progressBar"
        style="height:100%;width:0%;
        background:#4f8cff;
        transition:width 1s linear;">
      </div>
    </div>

    <div id="kekaStats" style="margin-top:14px;font-size:13px"></div>
  `;

  document.body.appendChild(box);
}

/* ================= FULL SCREEN WITCH ================= */

function launchFullScreenWitch(){
  const witch = document.createElement("img");
  witch.src = "https://raw.githubusercontent.com/neelkanth23/keka/main/manish.jpg";

  witch.style.cssText = `
    position:fixed;
    top:40%;
    left:-300px;
    width:260px;
    z-index:99999999;
    pointer-events:none;
    transition:left 10s linear;
  `;

  document.body.appendChild(witch);

  setTimeout(()=> {
    witch.style.left = "120%";
  }, 100);

  setTimeout(()=> {
    witch.remove();
  }, 60000);
}

/* ================= UPDATE LOOP ================= */

function updateUI(){
  const data = window.KekaHoursLatest;
  if(!data) return;

  const { totalMinutes, breakMinutes, firstStart } = data;

  const remaining = WORK_MINUTES - totalMinutes;
  const percent = Math.min(100, (totalMinutes / WORK_MINUTES) * 100);

  const bar = document.getElementById("progressBar");
  if(bar){
    bar.style.width = percent + "%";
    if(percent >= 100){
      bar.style.background = "#22c55e";
    }
  }

  const stats = document.getElementById("kekaStats");
  if(stats){
    let halfTime = "--";
    let fullTime = "--";

    if(firstStart){
      const st = parseTime(firstStart);
      if(st){
        const base = new Date();
        base.setHours(st.hours, st.minutes, 0, 0);

        const half = new Date(base.getTime() +
          (HALF_DAY_MINUTES + breakMinutes)*60000);

        const full = new Date(base.getTime() +
          (WORK_MINUTES + breakMinutes)*60000);

        halfTime = half.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
        fullTime = full.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
      }
    }

    stats.innerHTML = `
      <div>Total: ${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m</div>
      <div>Break: ${Math.floor(breakMinutes/60)}h ${breakMinutes%60}m</div>
      <div>Left: ${Math.floor(remaining/60)}h ${remaining%60}m</div>
      <div style="color:#facc15">4hr Done At: ${halfTime}</div>
      <div style="color:#60a5fa">8hr Done At: ${fullTime}</div>
    `;
  }

  /* 10 MIN WARNING */
  if(remaining <= 10 && remaining > 0 && !tenMinTriggered){
    tenMinTriggered = true;
    alert("🧙‍♀️ 10 Minutes Left...");
  }

  /* 8 HR COMPLETION */
  if(totalMinutes >= WORK_MINUTES && !eightHourTriggered){
    eightHourTriggered = true;
    launchFullScreenWitch();
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

observer.observe(document.body,{childList:true,subtree:true});

createUI();
setInterval(()=>{
  const c = findLogs();
  if(c) processLogs(c);
  updateUI();
},1000);

})();
