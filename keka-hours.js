// keka-hours-ios-glass-scary-witch.js
(function(){
'use strict';

/* ================= CONFIG ================= */

const WORK_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

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
  if(mins < 0) mins += 24 * 60;
  if(mins > 12 * 60) mins = 0;

  return mins;
}

/* ================= PROCESS LOGS (ORIGINAL LOGIC PRESERVED) ================= */

function processLogs(container){
  if(!container) return null;

  const rows = Array.from(
    container.querySelectorAll('.ng-untouched.ng-pristine.ng-valid')
  );

  if(!rows.length) return null;

  let totalM = 0;
  let firstStart = null;
  let prevEnd = null;
  let breakM = 0;

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

    totalM += minutesBetween(s, e);
    prevEnd = e;
  });

  window.KekaHoursLatest = {
    totalMinutes: totalM,
    breakMinutes: breakM,
    firstStart: firstStart
  };

  return window.KekaHoursLatest;
}

/* ================= FLOATING UI ================= */

function createFloating(){
  if(document.getElementById("kekaFloating")) return;

  const box = document.createElement("div");
  box.id = "kekaFloating";

  box.style.cssText = `
    position:fixed;
    top:28px;
    right:28px;
    z-index:999999;
    width:330px;
    padding:24px;
    border-radius:28px;

    background:
      linear-gradient(180deg,
        rgba(255,255,255,0.08) 0%,
        rgba(255,255,255,0.02) 100%
      ),
      rgba(18,22,30,0.82);

    backdrop-filter: blur(22px) saturate(160%);
    -webkit-backdrop-filter: blur(22px) saturate(160%);

    border:1px solid rgba(255,255,255,0.18);

    box-shadow:
      0 30px 70px rgba(0,0,0,0.55),
      inset 0 1px 0 rgba(255,255,255,0.25);

    color:white;
    font-family:-apple-system,BlinkMacSystemFont,Inter,system-ui;
    cursor:move;
    overflow:visible;
  `;

  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:600;font-size:15px">
        ⏱ Work Progress
      </div>
      <button id="closeTimer"
        style="all:unset;cursor:pointer;font-size:16px;opacity:.6">×</button>
    </div>

    <div style="display:flex;align-items:center;gap:22px;margin-top:20px">

      <div style="position:relative;width:95px;height:95px">
        <svg width="95" height="95">
          <circle cx="47.5" cy="47.5" r="42"
            stroke="rgba(255,255,255,0.08)"
            stroke-width="8"
            fill="none"/>
          <circle id="progressCircle"
            cx="47.5" cy="47.5" r="42"
            stroke="#4f8cff"
            stroke-width="8"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray="264"
            stroke-dashoffset="264"
            style="transition:stroke-dashoffset .5s ease, stroke .3s ease"/>
        </svg>

        <div id="progressPercent"
          style="position:absolute;top:50%;left:50%;
          transform:translate(-50%,-50%);
          font-weight:600;font-size:16px">
          0%
        </div>
      </div>

      <div style="flex:1;font-size:13px">
        <div id="totalTime" style="font-weight:600;font-size:14px">
          Total: --
        </div>

        <div id="leftTime"
          style="margin-top:6px;color:#cbd5e1">
          Left: --
        </div>

        <div id="breakTime"
          style="margin-top:6px;color:#94a3b8">
          Break: --
        </div>

        <div id="halfDayTime"
          style="margin-top:6px;color:#facc15;font-weight:500">
          4hr Done At: --
        </div>

        <div id="outTime"
          style="margin-top:6px;color:#60a5fa;font-weight:500">
          8hr Done At: --
        </div>
      </div>
    </div>

    <div id="witchContainer"
      style="
        position:absolute;
        bottom:-40px;
        right:-30px;
        display:none;
        pointer-events:none;
      ">
      <img id="witchGif"
        src="https://gifdb.com/gif/wicked-witch-flying-9vkfsa559h834cwl.gif"
        style="
          width:110px;
          opacity:0;
          transition:opacity .6s ease, transform 1.6s ease;
          transform:translateX(-80px);
        "/>
    </div>
  `;

  document.body.appendChild(box);
  document.getElementById("closeTimer").onclick = () => box.remove();
  makeDraggable(box);
  setInterval(updateFloating,1000);
}

/* ================= UPDATE ================= */

function updateFloating(){

  const latest = window.KekaHoursLatest;
  if(!latest) return;

  const { totalMinutes, breakMinutes, firstStart } = latest;

  const percent = Math.min(100,
    Math.round((totalMinutes / WORK_MINUTES) * 100)
  );

  const circle = document.getElementById("progressCircle");
  const percentText = document.getElementById("progressPercent");

  const circumference = 264;
  circle.style.strokeDashoffset =
    circumference - (percent/100)*circumference;

  percentText.innerText = percent + "%";

  document.getElementById("totalTime").innerText =
    `Total: ${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`;

  const remaining = Math.max(0, WORK_MINUTES-totalMinutes);

  document.getElementById("leftTime").innerText =
    `Left: ${Math.floor(remaining/60)}h ${remaining%60}m`;

  document.getElementById("breakTime").innerText =
    `Break: ${Math.floor(breakMinutes/60)}h ${breakMinutes%60}m`;

  if(firstStart){
    const st = parseTime(firstStart);
    if(st){
      const base = new Date();
      base.setHours(st.hours, st.minutes, 0, 0);

      const half = new Date(
        base.getTime() + (HALF_DAY_MINUTES + breakMinutes)*60000
      );

      const full = new Date(
        base.getTime() + (WORK_MINUTES + breakMinutes)*60000
      );

      document.getElementById("halfDayTime").innerText =
        "4hr Done At: " +
        half.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});

      document.getElementById("outTime").innerText =
        "8hr Done At: " +
        full.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
    }
  }

  /* ========= SCARY WITCH LOGIC ========= */

  const witchContainer = document.getElementById("witchContainer");
  const witchGif = document.getElementById("witchGif");

  if(remaining <= 10 && remaining > 0){
    witchContainer.style.display = "block";
    setTimeout(()=>{
      witchGif.style.opacity = "1";
      witchGif.style.transform = "translateX(0px)";
    },100);
  }

  if(remaining === 0){
    witchGif.style.opacity = "0";
    witchContainer.style.display = "none";
  }

  if(percent >= 100){
    circle.style.stroke = "#22c55e";
  }
}

/* ================= DRAG ================= */

function makeDraggable(el){
  let pos1=0,pos2=0,pos3=0,pos4=0;

  el.onmousedown = function(e){
    pos3=e.clientX; pos4=e.clientY;
    document.onmouseup=close;
    document.onmousemove=drag;
  };

  function drag(e){
    pos1=pos3-e.clientX;
    pos2=pos4-e.clientY;
    pos3=e.clientX;
    pos4=e.clientY;
    el.style.top=(el.offsetTop-pos2)+"px";
    el.style.left=(el.offsetLeft-pos1)+"px";
    el.style.right="auto";
  }

  function close(){
    document.onmouseup=null;
    document.onmousemove=null;
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

createFloating();

})();
