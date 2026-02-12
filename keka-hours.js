// keka-hours-ios-glass.js
(function(){
  'use strict';

  /* ================= CONFIG ================= */
  const WORK_MINUTES = 8 * 60;
  const PRE_ALERT_MINUTES = WORK_MINUTES - 10;
  const STORAGE_PREFIX = 'keka_hours_';

  /* ================= NOTIFICATION ================= */
  if (Notification && Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  }

  function wasNotified(key){
    return localStorage.getItem(STORAGE_PREFIX + key) === todayKey();
  }

  function markNotified(key){
    localStorage.setItem(STORAGE_PREFIX + key, todayKey());
  }

  /* ================= SOUND ================= */
  let audioCtx=null;
  function playTone(freq){
    if(!audioCtx)
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    const o=audioCtx.createOscillator();
    const g=audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value=freq;
    g.gain.value=0.1;
    o.start();
    setTimeout(()=>o.stop(),200);
  }

  function notifyPre(){
    if(wasNotified('pre_done')) return;
    if(Notification.permission==="granted")
      new Notification("⏰ 10 minutes left for 8 hours");
    playTone(660);
    markNotified('pre_done');
  }

  function notifyDone(){
    if(wasNotified('eight_done')) return;
    if(Notification.permission==="granted")
      new Notification("🎉 8 Hours Completed!");
    playTone(880);
    setTimeout(()=>playTone(1200),200);
    markNotified('eight_done');
  }

  /* ================= TIME HELPERS ================= */
  function parseTime(str){
    if(!str) return null;
    const parts=str.toLowerCase().split(" ");
    if(parts.length<2) return null;
    let [h,m]=parts[0].split(":").map(Number);
    if(parts[1]==="pm" && h!==12) h+=12;
    if(parts[1]==="am" && h===12) h=0;
    return {h,m};
  }

  function minutesBetween(s,e){
    const st=parseTime(s);
    const en=parseTime(e);
    if(!st||!en) return 0;
    let mins=(en.h-st.h)*60+(en.m-st.m);
    if(mins<0) mins+=1440;
    return mins;
  }

  /* ================= FLOATING UI ================= */
  function createFloating(){
    if(document.getElementById("kekaFloating")) return;

    const box=document.createElement("div");
    box.id="kekaFloating";

    box.style.cssText=`
      position:fixed;
      top:24px;
      right:24px;
      z-index:999999;
      background:linear-gradient(
        145deg,
        rgba(22,28,36,0.88),
        rgba(15,23,42,0.82)
      );
      backdrop-filter: blur(18px) saturate(140%);
      -webkit-backdrop-filter: blur(18px) saturate(140%);
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:
        0 25px 60px rgba(0,0,0,0.45),
        inset 0 1px 0 rgba(255,255,255,0.05);
      color:white;
      padding:20px;
      border-radius:22px;
      font-family:Inter, system-ui;
      min-width:280px;
      transition:all .35s cubic-bezier(.4,.2,.2,1);
      cursor:move;
    `;

    box.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600;font-size:15px">⏱ Work Progress</div>
        <button id="closeTimer"
          style="all:unset;cursor:pointer;font-size:16px;opacity:.7">×</button>
      </div>

      <div style="display:flex;align-items:center;gap:20px;margin-top:18px">

        <div style="position:relative;width:88px;height:88px">
          <svg width="88" height="88">
            <circle cx="44" cy="44" r="38"
              stroke="rgba(255,255,255,0.08)"
              stroke-width="8"
              fill="none"/>
            <circle id="progressCircle"
              cx="44" cy="44" r="38"
              stroke="#4f8cff"
              stroke-width="8"
              fill="none"
              stroke-linecap="round"
              stroke-dasharray="238"
              stroke-dashoffset="238"
              style="transition:stroke-dashoffset .45s ease, stroke .3s ease"/>
          </svg>
          <div id="progressPercent"
            style="position:absolute;top:50%;left:50%;
                   transform:translate(-50%,-50%);
                   font-weight:600;font-size:15px">
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

          <div id="outTime"
            style="margin-top:6px;color:#60a5fa;font-weight:500">
            Out Time: --
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(box);
    document.getElementById("closeTimer").onclick=()=>box.remove();
    makeDraggable(box);
    setInterval(updateFloating,1000);
  }

  function updateFloating(){
    const latest=window.KekaHoursLatest;
    if(!latest) return;

    const totalMinutes=latest.totalMinutes||0;
    const breakMinutes=latest.breakMinutes||0;
    const firstStart=latest.firstStart||null;

    const percent=Math.min(100,
      Math.round((totalMinutes/WINDOW_WORK_MINUTES())*100)
    );

    const circle=document.getElementById("progressCircle");
    const percentText=document.getElementById("progressPercent");
    const total=document.getElementById("totalTime");
    const left=document.getElementById("leftTime");
    const breakEl=document.getElementById("breakTime");
    const outEl=document.getElementById("outTime");
    const box=document.getElementById("kekaFloating");

    if(!circle||!total) return;

    const circumference=238;
    circle.style.strokeDashoffset=
      circumference-(percent/100)*circumference;

    percentText.innerText=percent+"%";

    total.innerText=`Total: ${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`;

    const remaining=Math.max(0,WORK_MINUTES-totalMinutes);
    left.innerText=`Left: ${Math.floor(remaining/60)}h ${remaining%60}m`;

    breakEl.innerText=`Break: ${Math.floor(breakMinutes/60)}h ${breakMinutes%60}m`;

    if(firstStart){
      const st=parseTime(firstStart);
      if(st){
        const base=new Date();
        base.setHours(st.h,st.m,0,0);
        const out=new Date(base.getTime()+(WORK_MINUTES+breakMinutes)*60000);
        outEl.innerText="Out Time: "+
          out.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
      }
    }

    if(totalMinutes>=PRE_ALERT_MINUTES) notifyPre();
    if(totalMinutes>=WORK_MINUTES) notifyDone();

    if(percent>=100){
      circle.style.stroke="#22c55e";
      box.style.boxShadow="0 0 40px rgba(34,197,94,0.7)";
    }else if(percent>=90){
      circle.style.stroke="#f59e0b";
    }else{
      circle.style.stroke="#4f8cff";
    }
  }

  function WINDOW_WORK_MINUTES(){ return WORK_MINUTES; }

  /* ================= DRAG ================= */
  function makeDraggable(el){
    let pos1=0,pos2=0,pos3=0,pos4=0;
    el.onmousedown=function(e){
      pos3=e.clientX;pos4=e.clientY;
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

  /* ================= LOG OBSERVER ================= */
  function findLogs(){
    return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
  }

  function processLogs(container){
    if(!container) return;

    const rows=container.querySelectorAll('.ng-untouched');
    let total=0, breaks=0, firstStart=null, prevEnd=null;

    rows.forEach((row,i)=>{
      const times=row.innerText.match(/\d{1,2}:\d{2}\s?(am|pm)/gi);
      if(times&&times.length>=2){
        if(i===0) firstStart=times[0];
        total+=minutesBetween(times[0],times[1]);
        if(prevEnd){
          breaks+=minutesBetween(prevEnd,times[0]);
        }
        prevEnd=times[1];
      }
    });

    window.KekaHoursLatest={
      totalMinutes:total,
      breakMinutes:breaks,
      firstStart:firstStart
    };
  }

  const observer=new MutationObserver(()=>{
    const c=findLogs();
    if(c) processLogs(c);
  });

  observer.observe(document.body,{childList:true,subtree:true});

  createFloating();

})();
