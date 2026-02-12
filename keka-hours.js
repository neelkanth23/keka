// keka-hours-advanced-ui.js
(function(){
  'use strict';

  /* ================= CONFIG ================= */
  const WORK_MINUTES = 8 * 60;
  const PRE_ALERT_MINUTES = WORK_MINUTES - 10;
  const STORAGE_PREFIX = 'keka_hours_';
  const POSITION_KEY = STORAGE_PREFIX + 'floating_position';

  const defaultPrefs = {
    soundOnComplete: true,
    soundOnPreAlert: true,
    showFloatingTimer: true
  };

  function loadPrefs(){
    try{
      const raw = localStorage.getItem(STORAGE_PREFIX + 'prefs');
      return raw ? Object.assign({}, defaultPrefs, JSON.parse(raw)) : defaultPrefs;
    }catch(e){ return defaultPrefs; }
  }

  function savePrefs(p){
    localStorage.setItem(STORAGE_PREFIX + 'prefs', JSON.stringify(p));
  }

  const prefs = loadPrefs();

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
  let audioCtx = null;
  function playTone(freq=880, duration=200){
    if(!prefs.soundOnComplete) return;
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);
    o.frequency.value = freq;
    g.gain.value = 0.1;
    o.start();
    setTimeout(()=>o.stop(), duration);
  }

  function notifyPre(){
    if(wasNotified('pre_done')) return;
    new Notification("⏰ 10 Minutes Remaining");
    playTone(660);
    markNotified('pre_done');
  }

  function notifyDone(){
    if(wasNotified('eight_done')) return;
    new Notification("🎉 8 Hours Completed!");
    playTone(880);
    setTimeout(()=>playTone(1200),200);
    markNotified('eight_done');
  }

  if(Notification.permission !== "granted"){
    Notification.requestPermission();
  }

  /* ================= TIME PARSER ================= */
  function parseTime(t){
    if(!t) return null;
    const parts = t.toLowerCase().split(" ");
    if(parts.length<2) return null;
    let [h,m] = parts[0].split(":").map(Number);
    if(parts[1]==="pm" && h!==12) h+=12;
    if(parts[1]==="am" && h===12) h=0;
    return {h,m};
  }

  function minutesBetween(s,e){
    if(!s||!e) return 0;
    const st=parseTime(s);
    const en=parseTime(e);
    if(!st||!en) return 0;
    let mins=(en.h-st.h)*60+(en.m-st.m);
    if(mins<0) mins+=1440;
    return mins;
  }

  /* ================= FLOATING TIMER ================= */
  let floatingInterval=null;

  function createFloating(){
    if(!prefs.showFloatingTimer) return;
    if(document.getElementById("kekaFloating")) return;

    const box=document.createElement("div");
    box.id="kekaFloating";
    box.style.cssText=`
      position:fixed;
      top:20px;
      right:20px;
      z-index:999999;
      backdrop-filter:blur(16px);
      background:rgba(15,23,42,0.75);
      border:1px solid rgba(255,255,255,0.08);
      color:white;
      padding:18px;
      border-radius:20px;
      box-shadow:0 20px 50px rgba(0,0,0,0.35);
      font-family:Inter,system-ui;
      cursor:move;
      min-width:230px;
      transition:all .3s ease;
    `;

    box.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600;font-size:14px">⏱ Work Progress</div>
        <button id="closeTimer" style="all:unset;cursor:pointer">×</button>
      </div>

      <div style="display:flex;align-items:center;gap:18px;margin-top:15px">
        <div style="position:relative;width:80px;height:80px">
          <svg width="80" height="80">
            <circle cx="40" cy="40" r="34"
              stroke="rgba(255,255,255,0.1)"
              stroke-width="7"
              fill="none"/>
            <circle id="progressCircle"
              cx="40" cy="40" r="34"
              stroke="#3b82f6"
              stroke-width="7"
              fill="none"
              stroke-linecap="round"
              stroke-dasharray="214"
              stroke-dashoffset="214"
              style="transition:stroke-dashoffset .4s ease, stroke .3s ease"/>
          </svg>
          <div id="progressPercent"
            style="position:absolute;top:50%;left:50%;
                   transform:translate(-50%,-50%);
                   font-weight:600;font-size:14px">
            0%
          </div>
        </div>

        <div>
          <div id="totalTime" style="font-weight:600">Total: --</div>
          <div id="leftTime" style="font-size:12px;color:#cbd5e1;margin-top:5px">Left: --</div>
        </div>
      </div>
    `;

    document.body.appendChild(box);

    /* restore position */
    const pos=JSON.parse(localStorage.getItem(POSITION_KEY)||"null");
    if(pos){
      box.style.top=pos.top;
      box.style.left=pos.left;
      box.style.right="auto";
    }

    makeDraggable(box);

    document.getElementById("closeTimer").onclick=()=>box.remove();

    floatingInterval=setInterval(updateFloating,1000);
  }

  function updateFloating(){
    const latest=window.KekaHoursLatest;
    if(!latest) return;

    const secs=latest.totalMinutes*60;
    const percent=Math.min(100,Math.round((secs/(WORK_MINUTES*60))*100));

    const circle=document.getElementById("progressCircle");
    const percentText=document.getElementById("progressPercent");
    const total=document.getElementById("totalTime");
    const left=document.getElementById("leftTime");
    const box=document.getElementById("kekaFloating");

    if(!circle||!total) return;

    const circumference=214;
    const offset=circumference-(percent/100)*circumference;

    circle.style.strokeDashoffset=offset;
    percentText.innerText=percent+"%";

    total.innerText=`Total: ${Math.floor(latest.totalMinutes/60)}h ${latest.totalMinutes%60}m`;
    const remaining=Math.max(0,WORK_MINUTES-latest.totalMinutes);
    left.innerText=`Left: ${Math.floor(remaining/60)}h ${remaining%60}m`;

    if(percent>=100){
      circle.style.stroke="#10b981";
      box.style.boxShadow="0 0 35px rgba(16,185,129,0.7)";
      notifyDone();
    }
    else if(percent>=90){
      circle.style.stroke="#f59e0b";
      notifyPre();
    }
    else{
      circle.style.stroke="#3b82f6";
      box.style.boxShadow="0 20px 50px rgba(0,0,0,0.35)";
    }
  }

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
      localStorage.setItem(POSITION_KEY,JSON.stringify({
        top:el.style.top,
        left:el.style.left
      }));
    }
  }

  /* ================= LOG WATCHER ================= */
  function findLogs(){
    return document.querySelector('[formarrayname="logs"],[formArrayName="logs"]');
  }

  function processLogs(container){
    if(!container) return;
    const rows=container.querySelectorAll('.ng-untouched');
    let total=0;
    rows.forEach(row=>{
      const times=row.innerText.match(/\d{1,2}:\d{2}\s?(am|pm)/gi);
      if(times&&times.length>=2){
        total+=minutesBetween(times[0],times[1]);
      }
    });
    window.KekaHoursLatest={totalMinutes:total};
  }

  const observer=new MutationObserver(()=>{
    const container=findLogs();
    if(container){
      processLogs(container);
    }
  });

  observer.observe(document.body,{childList:true,subtree:true});

  createFloating();

})();
