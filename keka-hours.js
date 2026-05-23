// ╔══════════════════════════════════════════════════════════════╗
// ║   KEKA CINEMATIC TRACKER — CORE ENGINE                      ║
// ║   PART 1 / 3                                                ║
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

const SCAN_INTERVAL_MS = 20000;

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

    const diff = e - s;

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

    const diff = nowMins - s;

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
// EXTRACT LOGS
// ─────────────────────────────────────────────────────

function extractLogPairs() {

    const pairs = [];

    const allInputs =
        Array
            .from(document.querySelectorAll('input'))
            .filter(el =>
                !el.closest('#kekaMario') &&
                !el.closest('#kekaSpider')
            );

    const timeInputs =
        allInputs.filter(el => {

            const v = (el.value || '').trim();

            return parseTimeToMinutes(v) !== null;
        });

    function getRowAncestor(el) {

        let node = el.parentElement;

        for (let i = 0; i < 8; i++) {

            if (!node || node === document.body) break;

            const inputsInNode =
                node.querySelectorAll('input');

            if (inputsInNode.length >= 2) {
                return node;
            }

            node = node.parentElement;
        }

        return el.parentElement;
    }

    const rowMap = new Map();

    for (const inp of timeInputs) {

        const row = getRowAncestor(inp);

        if (!rowMap.has(row)) {
            rowMap.set(row, []);
        }

        rowMap.get(row).push(inp);
    }

    for (const [row, inputs] of rowMap) {

        inputs.sort((a, b) => {

            const pos =
                a.compareDocumentPosition(b);

            return
                (pos & Node.DOCUMENT_POSITION_FOLLOWING)
                    ? -1
                    : 1;
        });

        const s =
            (inputs[0].value || '').trim();

        if (parseTimeToMinutes(s) === null) continue;

        let e = 'MISSING';

        if (inputs.length >= 2) {

            const v2 =
                (inputs[1].value || '').trim();

            if (parseTimeToMinutes(v2) !== null) {
                e = v2;
            }
        }

        pairs.push({ s, e });
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

            const b =
                minutesBetween(prevEnd, s);

            if (b > 0) breakM += b;
        }

        const isMissing =
            (
                e === 'MISSING' ||
                !e ||
                parseTimeToMinutes(e) === null
            );

        if (isMissing) {

            activeStart = s;

        } else {

            const sessionMins =
                minutesBetween(s, e);

            if (sessionMins > 0) {
                totalM += sessionMins;
            }

            prevEnd = e;

            activeStart = null;
        }

    });

    if (activeStart) {

        const live =
            liveMinutesFrom(activeStart);

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
// ║   KEKA CINEMATIC TRACKER — MARIO SYSTEM                     ║
// ║   PART 2 / 3                                                ║
// ╚══════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────
// MARIO STYLES
// ─────────────────────────────────────────────────────

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
    from{
        transform:translateX(120%) scale(.96);
        opacity:0;
    }
    to{
        transform:translateX(0) scale(1);
        opacity:1;
    }
}

@keyframes km-soft-glow{
    0%,100%{
        filter:drop-shadow(0 18px 30px rgba(0,0,0,.20));
    }

    50%{
        filter:drop-shadow(0 22px 38px rgba(255,214,0,.24));
    }
}

@keyframes km-mrun{
    0%{
        left:-44px;
        bottom:56px;
    }

    30%{
        left:118px;
        bottom:56px;
    }

    37%{
        left:142px;
        bottom:92px;
    }

    44%{
        left:166px;
        bottom:56px;
    }

    62%{
        left:242px;
        bottom:56px;
    }

    69%{
        left:268px;
        bottom:90px;
    }

    76%{
        left:294px;
        bottom:56px;
    }

    100%{
        left:420px;
        bottom:56px;
    }
}

@keyframes km-gwalk{
    0%{
        left:420px;
    }

    100%{
        left:-44px;
    }
}

@keyframes km-progress-stripe{
    from{
        background-position:0 0;
    }

    to{
        background-position:34px 0;
    }
}

@keyframes km-coin-pop{
    0%,100%{
        transform:translateY(0) scale(1);
    }

    50%{
        transform:translateY(-3px) scale(1.08);
    }
}

@keyframes km-ld{
    0%,100%{
        opacity:1;
        transform:scale(1);
    }

    50%{
        opacity:.35;
        transform:scale(.75);
    }
}

@keyframes km-cloud{
    from{
        transform:translateX(-20px);
    }

    to{
        transform:translateX(20px);
    }
}

`;

document.head.appendChild(style);

}

// ─────────────────────────────────────────────────────
// PIXEL HELPERS
// ─────────────────────────────────────────────────────

function px(ctx, S, x, y, c) {

ctx.fillStyle = c;

ctx.fillRect(
    x * S,
    y * S,
    S,
    S
);

}

// ─────────────────────────────────────────────────────
// MARIO SPRITE
// ─────────────────────────────────────────────────────

function drawMarioFrame(ctx, frame) {

ctx.clearRect(0,0,40,52);

const S = 4;

const R = '#e52213';

const B = '#0052a2';

const SK = '#fba86f';

const SH = '#5e1205';

const BL = '#4a2200';

const d = (x,y,c)=>px(ctx,S,x,y,c);

[
[3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],
[2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R]

].forEach(p=>d(...p));

[
[1,2,SH],[2,2,SH],[3,2,SH]

].forEach(p=>d(...p));

[
[3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],
[1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK]

].forEach(p=>d(...p));

d(3,3,SH);

d(7,3,SH);

[
[2,4,SH],[3,4,SH],[4,4,SH],
[6,4,SH],[7,4,SH],[8,4,SH]

].forEach(p=>d(...p));

[
[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B]

].forEach(p=>d(...p));

(
frame % 2 === 0
?
[
[2,10,B],[3,10,B],[7,10,B],[8,10,B],[9,10,B]
]
:
[
[1,10,B],[2,10,B],[3,10,B],[8,10,B],[9,10,B]
]
).forEach(p=>d(...p));

}

// ─────────────────────────────────────────────────────
// GOOMBA
// ─────────────────────────────────────────────────────

function drawGoombaFrame(ctx) {

ctx.clearRect(0,0,36,36);

const S = 4;

const GB = '#795548';

const d = (x,y,c)=>px(ctx,S,x,y,c);

[
[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
[0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB]

].forEach(p=>d(...p));

}

// ─────────────────────────────────────────────────────
// COINS
// ─────────────────────────────────────────────────────

function buildMarioCoins(pct) {

const TOTAL = 17;

const lit =
    Math.round((pct / 100) * TOTAL);

if (lit === previousCoinState) return;

previousCoinState = lit;

const wrap = refs.coins;

if (!wrap) return;

wrap.innerHTML = '';

for (let i = 0; i < TOTAL; i++) {

    const c = document.createElement('div');

    const on = i < lit;

    c.style.cssText =
        on
        ?
        `
        width:18px;
        height:18px;
        border-radius:50%;
        flex-shrink:0;

        background:
        radial-gradient(
            circle at 35% 28%,
            #fffde7,
            #ffd600 38%,
            #c67c00 72%,
            #7a4500 100%
        );

        border:2.5px solid #fff;

        animation:
        km-coin-pop 2.4s ease-in-out infinite ${i*.06}s;
        `
        :
        `
        width:18px;
        height:18px;
        border-radius:50%;
        flex-shrink:0;

        background:rgba(0,0,0,.22);

        border:1.5px solid rgba(255,255,255,.22);
        `;

    wrap.appendChild(c);
}

}

// ─────────────────────────────────────────────────────
// CREATE MARIO UI
// ─────────────────────────────────────────────────────

function createMarioUI() {

injectMarioStyles();

if (document.getElementById('kekaMario')) return;

const widget = document.createElement('div');

widget.id = 'kekaMario';

widget.style.cssText = `
position:fixed;
top:20px;
right:20px;
z-index:2147483646;

width:374px;

border-radius:28px;
overflow:hidden;

background:#e8282b;

box-shadow:
0 0 0 4px #fff,
0 0 0 8px #e8282b,
0 0 0 12px #fff,
0 24px 70px rgba(0,0,0,.42);

animation:
km-slidein .65s cubic-bezier(.34,1.4,.64,1) forwards,
km-soft-glow 4s ease-in-out infinite .9s;
`;

widget.innerHTML = `

<div
style="
position:relative;
height:252px;
overflow:hidden;

background:
linear-gradient(
180deg,
#4f8ffc 0%,
#78b3ff 58%,
#a9d5ff 100%
);
"
>

<svg
style="
position:absolute;
top:18px;
left:12px;
animation:km-cloud 7s ease-in-out infinite alternate;
"
width="90"
height="46"
viewBox="0 0 90 46"
>

<ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/>
<ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/>
<ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/>

</svg>

<svg
style="
position:absolute;
bottom:0;
left:0;
"
width="374"
height="56"
viewBox="0 0 374 56"
>

<rect
x="0"
y="14"
width="374"
height="42"
fill="#c8860a"
/>

</svg>

<canvas
id="kmMarioSprite"
width="40"
height="52"
style="
position:absolute;
bottom:56px;
image-rendering:pixelated;
animation:km-mrun 8s linear infinite;
"
></canvas>

<canvas
id="kmGoomba"
width="36"
height="36"
style="
position:absolute;
bottom:56px;
image-rendering:pixelated;
animation:km-gwalk 6s linear infinite;
"
></canvas>

<div
style="
position:absolute;
top:12px;
left:12px;
right:12px;

background:rgba(255,255,255,.25);

backdrop-filter:blur(20px);

border:3px solid rgba(255,255,255,.92);

border-radius:20px;

padding:12px 14px 11px;
"
>

<div
style="
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:7px;
"
>

<div>

<div
style="
font-size:13px;
font-weight:900;
letter-spacing:.06em;
color:#1a237e;
"
>
Grind Tracker
</div>

<div
style="
font-size:9px;
font-weight:800;
letter-spacing:.2em;
text-transform:uppercase;
color:rgba(26,35,126,.52);
margin-top:1px;
"
>
WORLD 8-1
</div>

</div>

<div
style="
display:flex;
align-items:center;
gap:5px;

background:#22c55e;

border:2.5px solid #fff;

border-radius:50px;

padding:4px 11px;
"
>

<div
style="
width:7px;
height:7px;
border-radius:50%;
background:#fff;
animation:km-ld 1.5s ease-in-out infinite;
"
></div>

<span
style="
font-size:9px;
font-weight:900;
color:#fff;
letter-spacing:.1em;
"
>
LIVE
</span>

</div>

</div>

<div
style="
display:flex;
align-items:flex-end;
justify-content:center;
gap:2px;
"
>

<span
id="kmHours"
style="
font-size:62px;
line-height:.88;
font-weight:900;
color:#1a237e;
"
>
0
</span>

<span
style="
font-size:16px;
font-weight:900;
color:rgba(26,35,126,.52);
margin-bottom:8px;
"
>
h
</span>

<span
id="kmMins"
style="
font-size:62px;
line-height:.88;
font-weight:900;
color:#1a237e;
"
>
00
</span>

<span
style="
font-size:16px;
font-weight:900;
color:rgba(26,35,126,.52);
margin-bottom:8px;
"
>
m
</span>

</div>

<div
style="
height:12px;
border-radius:999px;
background:rgba(26,35,126,.16);
overflow:hidden;
margin:3px 3px 6px;
"
>

<div
id="kmProgress"
style="
height:100%;
width:0%;
border-radius:999px;

background:
repeating-linear-gradient(
45deg,
#ffd600 0,
#ffd600 8px,
#f9a825 8px,
#f9a825 16px
);

animation:
km-progress-stripe 1.4s linear infinite;
"
></div>

</div>

<div
id="kmVibe"
style="
font-size:10px;
font-weight:800;
font-style:italic;
color:rgba(26,35,126,.58);
text-align:center;
"
>
"kaam sharu kar..."
</div>

</div>

</div>

<div
style="
background:
linear-gradient(
180deg,
#ef3033 0%,
#d71920 100%
);

padding:14px;
"
>

<div
style="
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:7px;
"
>

<span
style="
font-size:9px;
font-weight:900;
letter-spacing:.2em;
text-transform:uppercase;
color:rgba(255,255,255,.68);
"
>
Coins to Freedom
</span>

<span
id="kmPct"
style="
font-size:13px;
font-weight:900;
color:#ffe566;
"
>
0%
</span>

</div>

<div
id="kmCoins"
style="
display:flex;
gap:3px;
"
></div>

</div>

`;

document.body.appendChild(widget);

refs = {

widget,

hours:
widget.querySelector('#kmHours'),

mins:
widget.querySelector('#kmMins'),

pct:
widget.querySelector('#kmPct'),

progress:
widget.querySelector('#kmProgress'),

vibe:
widget.querySelector('#kmVibe'),

coins:
widget.querySelector('#kmCoins')

};

const mc =
    document.getElementById('kmMarioSprite');

const gc =
    document.getElementById('kmGoomba');

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

// ─────────────────────────────────────────────────────
// UPDATE MARIO UI
// ─────────────────────────────────────────────────────

function updateMarioUI(
data,
total,
breaks,
left,
pct,
h,
mStr
) {

setIfChanged(
    refs.hours,
    String(h)
);

setIfChanged(
    refs.mins,
    mStr
);

setIfChanged(
    refs.pct,
    `${pct}%`
);

refs.progress.style.width =
    `${pct}%`;

setIfChanged(
    refs.vibe,
    pct >= 100
        ?
        '"castle clear bhai..."'
        :
        '"coins collect thai rahya che..."'
);

buildMarioCoins(pct);

}

// ─────────────────────────────────────────────────────
// INIT MARIO
// ─────────────────────────────────────────────────────

if (THEME === 'mario') {

createMarioUI();

}
// ╔══════════════════════════════════════════════════════════════╗
// ║   KEKA CINEMATIC TRACKER — SPIDER-MAN HUD                  ║
// ║   PART 3 / 3                                                ║
// ╚══════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────
// SPIDER STYLES
// ─────────────────────────────────────────────────────

function injectSpiderStyles() {

if (document.getElementById('kekaSpiderStyles')) return;

const style = document.createElement('style');

style.id = 'kekaSpiderStyles';

style.textContent = `

@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;700&display=swap');

#kekaSpider *{
    box-sizing:border-box;
    margin:0;
    padding:0;
}

@keyframes sp-slidein{
    from{
        transform:translateX(120%) scale(.96);
        opacity:0;
    }

    to{
        transform:translateX(0) scale(1);
        opacity:1;
    }
}

@keyframes sp-spin{
    to{
        transform:rotate(360deg);
    }
}

@keyframes sp-spin-rev{
    to{
        transform:rotate(-360deg);
    }
}

@keyframes sp-glow{
    0%,100%{
        box-shadow:
        0 0 25px rgba(255,80,80,.18),
        0 20px 60px rgba(0,0,0,.42);
    }

    50%{
        box-shadow:
        0 0 40px rgba(255,80,80,.28),
        0 25px 80px rgba(0,0,0,.52);
    }
}

@keyframes sp-float{
    0%,100%{
        transform:translateY(0);
    }

    50%{
        transform:translateY(-8px);
    }
}

@keyframes sp-shimmer{
    0%{
        transform:translateX(-140%) rotate(18deg);
    }

    100%{
        transform:translateX(180%) rotate(18deg);
    }
}

@keyframes sp-complete{
    0%,100%{
        box-shadow:
        0 0 30px rgba(34,197,94,.25),
        0 20px 70px rgba(0,0,0,.45);
    }

    50%{
        box-shadow:
        0 0 60px rgba(34,197,94,.45),
        0 20px 90px rgba(0,0,0,.55);
    }
}

.sp-complete{
    animation:sp-complete 1.8s ease-in-out infinite !important;
}

`;

document.head.appendChild(style);

}

// ─────────────────────────────────────────────────────
// CREATE SPIDER UI
// ─────────────────────────────────────────────────────

function createSpiderUI() {

injectSpiderStyles();

if (document.getElementById('kekaSpider')) return;

const widget = document.createElement('div');

widget.id = 'kekaSpider';

widget.style.cssText = `
position:fixed;
top:20px;
right:20px;
z-index:2147483646;

width:420px;
height:760px;

border-radius:34px;

overflow:hidden;

background:
linear-gradient(
180deg,
#ff9966 0%,
#ff7e5f 18%,
#f76b1c 34%,
#355c7d 68%,
#1d2b64 100%
);

box-shadow:
0 0 25px rgba(255,80,80,.18),
0 20px 60px rgba(0,0,0,.42);

animation:
sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards,
sp-glow 4s ease-in-out infinite;

backdrop-filter:blur(10px);

overflow:hidden;
`;

widget.innerHTML = `

<div
style="
position:absolute;
inset:0;

background:
linear-gradient(
180deg,
rgba(255,255,255,.08),
rgba(255,255,255,.02)
);

pointer-events:none;
"
></div>

<!-- CITY BACKGROUND -->

<canvas
id="spidermanCanvas"
style="
position:absolute;
inset:0;
opacity:.95;
"
></canvas>

<!-- DARK OVERLAY -->

<div
style="
position:absolute;
inset:0;

background:
linear-gradient(
180deg,
rgba(0,0,0,.05),
rgba(0,0,0,.28)
);
"
></div>

<!-- TOP BAR -->

<div
style="
position:absolute;
top:18px;
left:18px;
right:18px;

display:flex;
justify-content:space-between;
align-items:center;

z-index:5;
"
>

<div>

<div
style="
font-family:'Orbitron',sans-serif;
font-size:26px;
font-weight:900;
letter-spacing:3px;
color:white;

text-shadow:
0 0 18px rgba(255,255,255,.45),
0 0 30px rgba(255,0,0,.4);
"
>
SPIDER HUD
</div>

<div
style="
font-size:11px;
letter-spacing:2px;
color:rgba(255,255,255,.72);
margin-top:2px;
"
>
EARTH-616 • NYC
</div>

</div>

<div
style="
display:flex;
gap:8px;
"
>

<button
id="spMin"
style="
width:34px;
height:34px;

border:none;

border-radius:50%;

background:rgba(255,255,255,.12);

color:white;

font-size:18px;

cursor:pointer;

backdrop-filter:blur(8px);
"
>
−
</button>

<button
id="spClose"
style="
width:34px;
height:34px;

border:none;

border-radius:50%;

background:rgba(255,255,255,.12);

color:white;

font-size:16px;

cursor:pointer;

backdrop-filter:blur(8px);
"
>
×
</button>

</div>

</div>

<!-- MAIN CONTENT -->

<div
id="spContent"
style="
position:absolute;
top:90px;
left:20px;
right:20px;
bottom:20px;

display:flex;
flex-direction:column;
"
>

<!-- REACTOR -->

<div
style="
position:relative;

width:240px;
height:240px;

margin:0 auto;

animation:sp-float 4s ease-in-out infinite;
"
>

<div
style="
position:absolute;
inset:0;

border-radius:50%;

background:
radial-gradient(
circle,
rgba(255,255,255,.22),
rgba(255,255,255,.04)
);

backdrop-filter:blur(10px);
"
></div>

<svg viewBox="0 0 240 240"
style="
position:absolute;
inset:0;
"
>

<circle
cx="120"
cy="120"
r="88"

stroke="rgba(255,255,255,.12)"

stroke-width="6"

fill="none"
/>

<circle
id="spProgressCircle"

cx="120"
cy="120"
r="88"

stroke="url(#spGrad)"

stroke-width="12"

fill="none"

stroke-linecap="round"

transform="rotate(-90 120 120)"

stroke-dasharray="553"

stroke-dashoffset="553"
/>

<defs>

<linearGradient id="spGrad">

<stop offset="0%" stop-color="#ff3d3d"/>

<stop offset="100%" stop-color="#3da5ff"/>

</linearGradient>

</defs>

<g
style="
animation:sp-spin 16s linear infinite;
transform-origin:center;
"
>

<circle
cx="120"
cy="120"
r="104"

stroke="rgba(255,255,255,.18)"

stroke-dasharray="10 12"

stroke-width="2"

fill="none"
/>

</g>

<g
style="
animation:sp-spin-rev 10s linear infinite;
transform-origin:center;
"
>

<circle
cx="120"
cy="120"
r="72"

stroke="rgba(255,0,0,.38)"

stroke-dasharray="8 10"

stroke-width="2"

fill="none"
/>

</g>

</svg>

<div
style="
position:absolute;
inset:0;

display:flex;
align-items:center;
justify-content:center;
flex-direction:column;
"
>

<div
id="spHours"
style="
font-size:64px;
font-weight:900;
color:white;

line-height:1;

text-shadow:
0 0 18px rgba(255,255,255,.65),
0 0 30px rgba(255,0,0,.4);
"
>
0h
</div>

<div
id="spMins"
style="
font-size:24px;
color:#9fd3ff;

letter-spacing:3px;
"
>
00m
</div>

</div>

</div>

<!-- MISSION CARD -->

<div
style="
margin-top:24px;

background:
linear-gradient(
145deg,
rgba(255,255,255,.14),
rgba(255,255,255,.05)
);

border:1px solid rgba(255,255,255,.12);

border-radius:24px;

padding:18px;

backdrop-filter:blur(14px);

position:relative;

overflow:hidden;
"
>

<div
style="
position:absolute;
top:-30px;
left:-70px;

width:80px;
height:180px;

background:rgba(255,255,255,.18);

animation:sp-shimmer 6s linear infinite;
"
></div>

<div
style="
position:relative;
z-index:2;
"
>

<div
style="
display:grid;
grid-template-columns:1fr 1fr;
gap:14px;
"
>

<div>

<div
style="
font-size:11px;
letter-spacing:2px;
color:rgba(255,255,255,.65);
"
>
REMAINING
</div>

<div
id="spRemaining"
style="
font-size:28px;
font-weight:700;
color:white;
margin-top:5px;
"
>
0h
</div>

</div>

<div>

<div
style="
font-size:11px;
letter-spacing:2px;
color:rgba(255,255,255,.65);
"
>
BREAK
</div>

<div
id="spBreak"
style="
font-size:28px;
font-weight:700;
color:white;
margin-top:5px;
"
>
0m
</div>

</div>

<div>

<div
style="
font-size:11px;
letter-spacing:2px;
color:rgba(255,255,255,.65);
"
>
HALF DAY
</div>

<div
id="spHalf"
style="
font-size:24px;
font-weight:700;
color:white;
margin-top:5px;
"
>
--
</div>

</div>

<div>

<div
style="
font-size:11px;
letter-spacing:2px;
color:rgba(255,255,255,.65);
"
>
MISSION END
</div>

<div
id="spFull"
style="
font-size:24px;
font-weight:700;
color:white;
margin-top:5px;
"
>
--
</div>

</div>

</div>

<div
id="spMission"
style="
margin-top:20px;

padding:16px;

border-radius:18px;

background:
linear-gradient(
90deg,
rgba(255,0,0,.16),
rgba(0,120,255,.16)
);

font-size:15px;
color:white;

line-height:1.5;
"
>
Swinging through Manhattan...
protecting the city while surviving Keka.
</div>

</div>

</div>

</div>

`;

document.body.appendChild(widget);

// ─────────────────────────────────────────
// REFS
// ─────────────────────────────────────────

refs = {

widget,

hours:
widget.querySelector('#spHours'),

mins:
widget.querySelector('#spMins'),

remaining:
widget.querySelector('#spRemaining'),

breakEl:
widget.querySelector('#spBreak'),

half:
widget.querySelector('#spHalf'),

full:
widget.querySelector('#spFull'),

mission:
widget.querySelector('#spMission'),

progress:
widget.querySelector('#spProgressCircle'),

content:
widget.querySelector('#spContent')

};

// ─────────────────────────────────────────
// BUTTONS
// ─────────────────────────────────────────

const minBtn =
    widget.querySelector('#spMin');

const closeBtn =
    widget.querySelector('#spClose');

let minimized = false;

minBtn.addEventListener('click',()=>{

    minimized = !minimized;

    refs.content.style.display =
        minimized
            ? 'none'
            : 'flex';

    widget.style.height =
        minimized
            ? '90px'
            : '760px';

    minBtn.textContent =
        minimized
            ? '+'
            : '−';

});

closeBtn.addEventListener('click',()=>{

    widget.remove();

});

// ─────────────────────────────────────────
// START BACKGROUND
// ─────────────────────────────────────────

startSpiderBackground();

}

// ─────────────────────────────────────────────────────
// BACKGROUND ENGINE
// ─────────────────────────────────────────────────────

function startSpiderBackground() {

const canvas =
    document.getElementById('spidermanCanvas');

if (!canvas) return;

const ctx = canvas.getContext('2d');

let w = canvas.width = 420;

let h = canvas.height = 760;

const buildings = [];

for (let i = 0; i < 24; i++) {

    buildings.push({

        x: i * 24,

        y: h - (100 + Math.random() * 260),

        w: 22 + Math.random() * 30,

        h: 120 + Math.random() * 240

    });
}

let t = 0;

function render() {

    ctx.clearRect(0,0,w,h);

    // clouds

    ctx.fillStyle =
        'rgba(255,255,255,.05)';

    for (let i = 0; i < 6; i++) {

        ctx.beginPath();

        ctx.arc(
            (i * 120 + t * .2) % (w + 200) - 100,
            100 + Math.sin(i + t * .002) * 12,
            40,
            0,
            Math.PI * 2
        );

        ctx.fill();
    }

    // buildings

    buildings.forEach((b)=>{

        const g =
            ctx.createLinearGradient(
                0,
                b.y,
                0,
                h
            );

        g.addColorStop(
            0,
            'rgba(20,20,40,.85)'
        );

        g.addColorStop(
            1,
            'rgba(10,10,20,1)'
        );

        ctx.fillStyle = g;

        ctx.fillRect(
            b.x,
            b.y,
            b.w,
            b.h
        );

        for (
            let wy = b.y + 8;
            wy < h;
            wy += 14
        ) {

            for (
                let wx = b.x + 6;
                wx < b.x + b.w - 6;
                wx += 12
            ) {

                if (Math.random() > .72) {

                    ctx.fillStyle =
                        Math.random() > .5
                            ?
                            'rgba(255,190,80,.7)'
                            :
                            'rgba(120,180,255,.6)';

                    ctx.fillRect(wx,wy,4,6);
                }
            }
        }

    });

    // traffic

    for (let i = 0; i < 10; i++) {

        ctx.strokeStyle =
            i % 2
                ?
                'rgba(255,80,80,.35)'
                :
                'rgba(255,255,180,.28)';

        ctx.lineWidth = 2;

        ctx.beginPath();

        const yy =
            h - 40 + Math.sin(i) * 6;

        ctx.moveTo(
            (i * 60 + t * 1.4) % (w + 100) - 100,
            yy
        );

        ctx.lineTo(
            (i * 60 + t * 1.4) % (w + 100) - 40,
            yy
        );

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

function updateSpiderUI(
data,
total,
breaks,
left,
pct,
h,
mStr
) {

setIfChanged(
    refs.hours,
    `${h}h`
);

setIfChanged(
    refs.mins,
    `${mStr}m`
);

setIfChanged(
    refs.remaining,
    `${Math.floor(left/60)}h`
);

setIfChanged(
    refs.breakEl,
    `${breaks}m`
);

const circumference = 553;

refs.progress.style.strokeDashoffset =
    circumference -
    (pct / 100) * circumference;

if (pct < 25) {

    refs.mission.textContent =
        'Entering Manhattan patrol route.';

} else if (pct < 50) {

    refs.mission.textContent =
        'Spider-Sense activated across NYC.';

} else if (pct < 75) {

    refs.mission.textContent =
        'Swinging through Midtown at full speed.';

} else if (pct < 100) {

    refs.mission.textContent =
        'Final villain chase sequence active.';

} else {

    refs.mission.textContent =
        'MISSION COMPLETE. Manhattan secured.';
}

if (data.firstStart) {

    const s =
        parseTimeToMinutes(data.firstStart);

    if (s !== null) {

        const base = new Date();

        base.setHours(
            Math.floor(s / 60),
            s % 60,
            0,
            0
        );

        const half =
            new Date(
                base.getTime() +
                (
                    HALF_DAY_MINUTES +
                    breaks
                ) * 60000
            );

        const full =
            new Date(
                base.getTime() +
                (
                    WORK_MINUTES +
                    breaks
                ) * 60000
            );

        setIfChanged(
            refs.half,
            fmtTime(half)
        );

        setIfChanged(
            refs.full,
            fmtTime(full)
        );
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

const data =
    window.KekaHoursLatest ||
    {
        totalMinutes:0,
        breakMinutes:0,
        firstStart:null
    };

const total =
    Math.max(0,data.totalMinutes || 0);

const breaks =
    Math.max(0,data.breakMinutes || 0);

const left =
    Math.max(0,WORK_MINUTES - total);

const pct =
    Math.min(
        100,
        Math.round(
            (total / WORK_MINUTES) * 100
        )
    );

const h =
    Math.floor(total / 60);

const m =
    total % 60;

const mStr =
    String(m).padStart(2,'0');

if (THEME === 'mario') {

    updateMarioUI(
        data,
        total,
        breaks,
        left,
        pct,
        h,
        mStr
    );

} else {

    updateSpiderUI(
        data,
        total,
        breaks,
        left,
        pct,
        h,
        mStr
    );
}

}

// ─────────────────────────────────────────────────────
// OBSERVER
// ─────────────────────────────────────────────────────

function startObservers() {

const observer =
    new MutationObserver(()=>{

        clearTimeout(mutationTimer);

        mutationTimer =
            setTimeout(()=>{
                updateUI();
            },1000);

    });

observer.observe(document.body,{
    childList:true,
    subtree:true
});

}

// ─────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────

if (THEME === 'spiderman') {

createSpiderUI();

}

updateUI();

setInterval(updateUI,SCAN_INTERVAL_MS);

startObservers();

console.log(
'%c🕷️ KEKA HERO TRACKER LOADED',
'color:#ff3d3d;font-size:16px;font-weight:bold;'
);

})();
