// ╔══════════════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — CINEMATIC DUAL THEME EDITION             ║
// ║   MARIO + SPIDER-MAN AAA NYC EXPERIENCE                         ║
// ║   PART 1 / 3                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

(function () {

'use strict';

if (window.__KEKA_CINEMATIC__) {
    console.log('Keka Cinematic Tracker already running.');
    return;
}

window.__KEKA_CINEMATIC__ = true;

// ─────────────────────────────────────────────────────────────
// THEME SELECTOR
// ─────────────────────────────────────────────────────────────

const TODAY_DATE = new Date().getDate();

const THEME =
    (TODAY_DATE % 2 === 0)
        ? 'spiderman'
        : 'mario';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const WORK_MINUTES = 8 * 60;
const HALF_DAY_MINUTES = 4 * 60;

const SCAN_INTERVAL_MS = 20000;

const SPRITE_FPS = 10;

const FRAME_DELAY = 1000 / SPRITE_FPS;

// ─────────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────────

let refs = {};

let spriteFrame = 0;

let rafHandle = null;

let lastFrameTime = 0;

let completedMission = false;

let scanLock = false;

let mutationTimer = null;

let previousCoinState = -1;

// ─────────────────────────────────────────────────────────────
// TIME HELPERS
// ─────────────────────────────────────────────────────────────

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

    if (H < 0 || H > 23 || M < 0 || M > 59) {
        return null;
    }

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
        now.getHours() * 60 + now.getMinutes();

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

// ─────────────────────────────────────────────────────────────
// DOM UTILS
// ─────────────────────────────────────────────────────────────

function setIfChanged(el, val) {

    if (!el) return;

    if (el.textContent === val) return;

    el.textContent = val;
}

// ─────────────────────────────────────────────────────────────
// LOG EXTRACTION
// ─────────────────────────────────────────────────────────────

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

    // fallback mode

    if (timeInputs.length === 0) {

        const timeRegex =
            /^\d{1,2}:\d{2}\s*(am|pm)$/i;

        const allEls =
            Array
                .from(document.querySelectorAll(
                    'span, div, td, p'
                ))
                .filter(el => {

                    if (
                        el.closest('#kekaMario') ||
                        el.closest('#kekaSpider')
                    ) return false;

                    if (el.children.length > 2) return false;

                    const t =
                        (el.textContent || '').trim();

                    return timeRegex.test(t);
                });

        const leafEls =
            allEls.filter(el =>
                !allEls.some(other =>
                    other !== el &&
                    el.contains(other)
                )
            );

        for (let i = 0; i < leafEls.length; i++) {

            const s =
                (leafEls[i].textContent || '').trim();

            if (parseTimeToMinutes(s) === null) continue;

            if (i + 1 < leafEls.length) {

                const e =
                    (leafEls[i + 1].textContent || '').trim();

                pairs.push({
                    s,
                    e:
                        parseTimeToMinutes(e) !== null
                            ? e
                            : 'MISSING'
                });

                i++;

            } else {

                pairs.push({
                    s,
                    e: 'MISSING'
                });
            }
        }

        return pairs;
    }

    // structured rows

    function getRowAncestor(el) {

        let node = el.parentElement;

        for (let i = 0; i < 8; i++) {

            if (!node || node === document.body) break;

            const inputsInNode =
                node.querySelectorAll('input');

            if (inputsInNode.length >= 2) return node;

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

        if (
            e === 'MISSING' &&
            !/missing/i.test(row.textContent || '')
        ) {
            if (inputs.length < 2) continue;
        }

        pairs.push({ s, e });
    }

    pairs.sort((a, b) =>
        (parseTimeToMinutes(a.s) || 0) -
        (parseTimeToMinutes(b.s) || 0)
    );

    return pairs;
}

// ─────────────────────────────────────────────────────────────
// PROCESS LOGS
// ─────────────────────────────────────────────────────────────

function processLogs() {

    const pairs = extractLogPairs();

    if (pairs.length === 0) return;

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

// ─────────────────────────────────────────────────────────────
// VIBES
// ─────────────────────────────────────────────────────────────

function getSpiderVibe(pct) {

    if (pct >= 100)
        return 'MISSION COMPLETE. Manhattan secured.';

    if (pct >= 90)
        return 'Final villain chase. Almost done.';

    if (pct >= 75)
        return 'Swinging through Midtown at full speed.';

    if (pct >= 50)
        return 'Spider-Sense fully activated.';

    if (pct >= 25)
        return 'Patrolling NYC skyline.';

    return 'Entering Manhattan patrol route.';
}

function getMarioVibe(pct) {

    if (pct >= 100)
        return '"nikal gayo bhai… castle clear."';

    if (pct >= 90)
        return '"final boss baki che..."';

    if (pct >= 75)
        return '"ghar dekhai rahyu che..."';

    if (pct >= 50)
        return '"aadho grind thai gayo..."';

    if (pct >= 25)
        return '"coins collect thai rahya che..."';

    return '"kaam sharu kar..."';
}
// ╔══════════════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — MARIO SYSTEM                            ║
// ║   PART 2 / 3                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────
// MARIO STYLES
// ─────────────────────────────────────────────────────────────

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
        filter:drop-shadow(0 18px 30px rgba(0,0,0,.2));
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

@keyframes km-cloud{
    from{
        transform:translateX(-20px);
    }

    to{
        transform:translateX(20px);
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

@keyframes km-ticker{
    0%{
        transform:translateX(0);
    }

    100%{
        transform:translateX(-50%);
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

`;

document.head.appendChild(style);

}

// ─────────────────────────────────────────────────────────────
// PIXEL DRAW HELPERS
// ─────────────────────────────────────────────────────────────

function px(ctx, S, x, y, c) {

ctx.fillStyle = c;

ctx.fillRect(
    x * S,
    y * S,
    S,
    S
);

}

// ─────────────────────────────────────────────────────────────
// DRAW MARIO
// ─────────────────────────────────────────────────────────────

function drawMarioFrame(ctx, frame, green = false) {

ctx.clearRect(0,0,40,52);

const S = 4;

const R = green ? '#16a34a' : '#e52213';

const B = '#0052a2';

const SK = '#fba86f';

const SH = '#5e1205';

const BL = '#4a2200';

const W = '#fff';

const E = '#e8a000';

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
[3,5,E],[4,5,E],[5,5,E],[6,5,E],[7,5,E]

].forEach(p=>d(...p));

[
[0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B]

].forEach(p=>d(...p));

[
[0,7,B],[1,7,B],[2,7,B],[3,7,B],[4,7,B],[5,7,B],[6,7,B],[7,7,B],[8,7,B],[9,7,B],[10,7,B]

].forEach(p=>d(...p));

[
[2,8,B],[3,8,B],[4,8,SK],[5,8,SK],[6,8,B],[7,8,B],[8,8,B]

].forEach(p=>d(...p));

[
[2,9,SK],[3,9,SK],[4,9,SK],[5,9,SK],[6,9,SK],[7,9,SK],[8,9,SK]

].forEach(p=>d(...p));

d(-1,6,SK);

d(-1,7,R);

d(11,6,SK);

d(11,7,SK);

d(3,5,W);

d(8,5,W);

(
frame % 2 === 0
?
[
[2,10,B],[3,10,B],[7,10,B],[8,10,B],[9,10,B],
[2,11,BL],[3,11,BL],[8,11,BL],[9,11,BL]
]
:
[
[1,10,B],[2,10,B],[3,10,B],[8,10,B],[9,10,B],
[1,11,BL],[2,11,BL],[8,11,BL],[9,11,BL]
]
).forEach(p=>d(...p));

}

// ─────────────────────────────────────────────────────────────
// DRAW GOOMBA
// ─────────────────────────────────────────────────────────────

function drawGoombaFrame(ctx, frame) {

ctx.clearRect(0,0,36,36);

const S = 4;

const GB = '#795548';

const GD = '#4a2200';

const GW = '#fff';

const d = (x,y,c)=>px(ctx,S,x,y,c);

[
[1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
[0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB]

].forEach(p=>d(...p));

[
[1,3,GW],[2,3,GW],[6,3,GW],[7,3,GW],
[1,4,GW],[2,4,GW],[6,4,GW],[7,4,GW]

].forEach(p=>d(...p));

d(2,4,'#000');

d(7,4,'#000');

(
frame % 2 === 0
?
[
[0,7,GD],[1,7,GD],[6,7,GD],[7,7,GD],[8,7,GD]
]
:
[
[1,7,GD],[2,7,GD],[5,7,GD],[6,7,GD],[7,7,GD]
]
).forEach(p=>d(...p));

}

// ─────────────────────────────────────────────────────────────
// MARIO COINS
// ─────────────────────────────────────────────────────────────

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
            position:relative;

            background:
                radial-gradient(
                    circle at 35% 28%,
                    #fffde7,
                    #ffd600 38%,
                    #c67c00 72%,
                    #7a4500 100%
                );

            border:2.5px solid #fff;

            box-shadow:
                0 3px 0 rgba(0,0,0,.25),
                inset 0 1px 2px rgba(255,255,255,.5);

            animation:
                km-coin-pop 2.4s ease-in-out infinite ${i*.06}s;
            `
            :
            `
            width:18px;
            height:18px;
            border-radius:50%;
            flex-shrink:0;
            position:relative;

            background:rgba(0,0,0,.22);

            border:1.5px solid rgba(255,255,255,.22);
            `;

    wrap.appendChild(c);
}

}

// ─────────────────────────────────────────────────────────────
// CREATE MARIO UI
// ─────────────────────────────────────────────────────────────

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

<div id="kmWorld"
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
">

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

<div
style="
display:grid;
grid-template-columns:1fr 1fr;
gap:8px;
margin-top:12px;
"
>

<div class="spiderCard">

<div class="spiderCardLabel">
Worked
</div>

<div
id="kmWorked"
class="spiderCardValue"
>
0h 00m
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Remaining
</div>

<div
id="kmLeft"
class="spiderCardValue"
>
8h 00m
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Half Day
</div>

<div
id="kmHalf"
class="spiderCardValue"
>
--
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Mission End
</div>

<div
id="kmFull"
class="spiderCardValue"
>
--
</div>

</div>

</div>

</div>

`;

document.body.appendChild(widget);

refs = {

widget,

hours:
    widget.querySelector('#kmHours'),

mins:
    widget.querySelector('#kmMins'),

worked:
    widget.querySelector('#kmWorked'),

left:
    widget.querySelector('#kmLeft'),

pct:
    widget.querySelector('#kmPct'),

progress:
    widget.querySelector('#kmProgress'),

vibe:
    widget.querySelector('#kmVibe'),

half:
    widget.querySelector('#kmHalf'),

full:
    widget.querySelector('#kmFull'),

coins:
    widget.querySelector('#kmCoins')

};

buildMarioCoins(0);

startMarioSprites();

}

// ─────────────────────────────────────────────────────────────
// SPRITE LOOP
// ─────────────────────────────────────────────────────────────

function spriteLoop(now) {

rafHandle = requestAnimationFrame(spriteLoop);

if (now - lastFrameTime < FRAME_DELAY) return;

lastFrameTime = now;

spriteFrame++;

if (refs._mCtx) {
    drawMarioFrame(
        refs._mCtx,
        spriteFrame,
        false
    );
}

if (refs._gCtx) {
    drawGoombaFrame(
        refs._gCtx,
        spriteFrame
    );
}

}

// ─────────────────────────────────────────────────────────────
// START SPRITES
// ─────────────────────────────────────────────────────────────

function startMarioSprites() {

const mc =
    document.getElementById('kmMarioSprite');

const gc =
    document.getElementById('kmGoomba');

if (!mc || !gc) return;

refs._mCtx = mc.getContext('2d');

refs._gCtx = gc.getContext('2d');

drawMarioFrame(refs._mCtx, 0, false);

drawGoombaFrame(refs._gCtx, 0);

rafHandle = requestAnimationFrame(spriteLoop);

}

// ─────────────────────────────────────────────────────────────
// UPDATE MARIO UI
// ─────────────────────────────────────────────────────────────

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
    refs.worked,
    `${h}h ${mStr}m`
);

setIfChanged(
    refs.left,
    `${Math.floor(left/60)}h ${String(left%60).padStart(2,'0')}m`
);

setIfChanged(
    refs.pct,
    `${pct}%`
);

refs.progress.style.width = `${pct}%`;

setIfChanged(
    refs.vibe,
    getMarioVibe(pct)
);

buildMarioCoins(pct);

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

}
// ─────────────────────────────────────────────────────────────
// MARIO INIT
// ─────────────────────────────────────────────────────────────

if (THEME === 'mario') {

    createMarioUI();

}
// ╔══════════════════════════════════════════════════════════════════╗
// ║   KEKA GRIND TRACKER — SPIDER-MAN CINEMATIC ENGINE             ║
// ║   PART 3 / 3                                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────
// SPIDER STYLES
// ─────────────────────────────────────────────────────────────

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

@keyframes sp-rain{
    0%{
        transform:translateY(-20px);
        opacity:0;
    }

    10%{
        opacity:.4;
    }

    100%{
        transform:translateY(280px);
        opacity:0;
    }
}

@keyframes sp-float{
    0%,100%{
        transform:translateY(0);
    }

    50%{
        transform:translateY(-6px);
    }
}

@keyframes sp-glow{
    0%,100%{
        box-shadow:
            0 0 30px rgba(255,80,80,.25),
            0 0 120px rgba(0,0,0,.45);
    }

    50%{
        box-shadow:
            0 0 60px rgba(255,80,80,.45),
            0 0 150px rgba(0,0,0,.6);
    }
}

`;

document.head.appendChild(style);

}

// ─────────────────────────────────────────────────────────────
// CREATE SPIDER UI
// ─────────────────────────────────────────────────────────────

function createSpiderUI() {

injectSpiderStyles();

if (document.getElementById('kekaSpider')) return;

const widget = document.createElement('div');

widget.id = 'kekaSpider';

widget.style.cssText = `
position:fixed;
inset:0;
z-index:2147483646;
overflow:hidden;
pointer-events:none;
`;

let rainHTML = '';

for (let i = 0; i < 24; i++) {

    const x = Math.random() * window.innerWidth;

    const dur =
        (1.8 + Math.random() * 2.4).toFixed(1);

    const delay =
        (Math.random() * 3).toFixed(1);

    rainHTML += `
    <div
    style="
    position:absolute;
    left:${x}px;
    top:0;
    width:1px;
    height:${14+Math.random()*14|0}px;

    background:
    linear-gradient(
        180deg,
        transparent,
        rgba(96,165,250,.28),
        transparent
    );

    animation:
    sp-rain ${dur}s linear ${delay}s infinite;

    pointer-events:none;
    "
    ></div>
    `;
}

widget.innerHTML = `

<div
id="spidermanScene"
style="
position:absolute;
inset:0;

background:
linear-gradient(
180deg,
#ff9966 0%,
#ff7e5f 18%,
#f76b1c 34%,
#355c7d 68%,
#1d2b64 100%
);

overflow:hidden;
"
>

<canvas
id="spidermanCanvas"
style="
position:absolute;
inset:0;
"
></canvas>

<div
style="
position:absolute;
inset:0;
pointer-events:none;
overflow:hidden;
"
>
${rainHTML}
</div>

<div
id="spidermanHud"
style="
position:absolute;
right:70px;
top:60px;

width:370px;

background:
linear-gradient(
145deg,
rgba(255,255,255,.14),
rgba(255,255,255,.05)
);

backdrop-filter:blur(18px);

border:1px solid rgba(255,255,255,.2);

border-radius:32px;

padding:28px;

box-shadow:
0 0 30px rgba(255,80,80,.25),
0 0 120px rgba(0,0,0,.45);

animation:
sp-slidein .7s cubic-bezier(.34,1.3,.64,1) forwards,
sp-glow 4s ease-in-out infinite;

pointer-events:auto;

overflow:hidden;
"
>

<div
style="
position:absolute;
inset:-40%;

background:
conic-gradient(
from 0deg,
transparent,
rgba(255,255,255,.12),
transparent
);

animation:sp-spin 8s linear infinite;
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
font-family:'Orbitron',sans-serif;
font-size:30px;
font-weight:900;
color:white;
letter-spacing:4px;
text-transform:uppercase;

text-shadow:
0 0 15px rgba(255,255,255,.8),
0 0 30px rgba(255,0,0,.8);

margin-bottom:10px;
"
>
Spider Mission
</div>

<div
style="
color:rgba(255,255,255,.8);
letter-spacing:2px;
margin-bottom:28px;
font-size:13px;
"
>
NYC SWING TRACKER • EARTH-616
</div>

<div
style="
width:220px;
height:220px;
margin:auto;
position:relative;
"
>

<svg viewBox="0 0 220 220">

<circle
cx="110"
cy="110"
r="85"
stroke="rgba(255,255,255,.12)"
stroke-width="4"
fill="none"
/>

<circle
id="spProgressCircle"
cx="110"
cy="110"
r="85"
stroke="url(#spGrad)"
stroke-width="10"
fill="none"
stroke-linecap="round"

transform="rotate(-90 110 110)"

stroke-dasharray="534"
stroke-dashoffset="534"
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
cx="110"
cy="110"
r="96"

stroke="rgba(255,255,255,.14)"

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
cx="110"
cy="110"
r="70"

stroke="rgba(255,0,0,.4)"

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
font-size:60px;
font-weight:900;
color:white;
line-height:1;

text-shadow:
0 0 25px rgba(255,255,255,.8),
0 0 45px rgba(255,0,0,.8);
"
>
0h
</div>

<div
id="spMins"
style="
font-size:22px;
color:#9fd3ff;
margin-top:5px;
letter-spacing:3px;
"
>
00m
</div>

</div>

</div>

<div
style="
margin-top:28px;

display:grid;
grid-template-columns:1fr 1fr;

gap:16px;
"
>

<div class="spiderCard">

<div class="spiderCardLabel">
Remaining
</div>

<div
id="spRemaining"
class="spiderCardValue"
>
0h
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Break
</div>

<div
id="spBreak"
class="spiderCardValue"
>
0m
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Half Day
</div>

<div
id="spHalf"
class="spiderCardValue"
>
--
</div>

</div>

<div class="spiderCard">

<div class="spiderCardLabel">
Mission End
</div>

<div
id="spFull"
class="spiderCardValue"
>
--
</div>

</div>

</div>

<div
id="spMission"
style="
margin-top:22px;

background:
linear-gradient(
90deg,
rgba(255,0,0,.2),
rgba(0,120,255,.2)
);

border:1px solid rgba(255,255,255,.15);

padding:16px;

border-radius:20px;

color:white;

font-size:15px;

letter-spacing:1px;
"
>
Swinging through Manhattan...
protecting the city while surviving Keka.
</div>

</div>

</div>

<div
id="spComplete"
style="
position:absolute;
inset:0;

display:none;

align-items:center;
justify-content:center;
flex-direction:column;

background:
radial-gradient(
circle,
rgba(255,255,255,.18),
rgba(0,0,0,.82)
);

z-index:20;
"
>

<img
src='https://upload.wikimedia.org/wikipedia/commons/5/52/Spider-Man_Icon.png'

style="
width:240px;

filter:
drop-shadow(0 0 40px red)
drop-shadow(0 0 70px rgba(255,255,255,.7));
"
/>

<div
style="
margin-top:30px;

color:white;

font-size:52px;

font-family:'Orbitron',sans-serif;

font-weight:900;

letter-spacing:6px;

text-shadow:
0 0 20px rgba(255,255,255,.8),
0 0 50px red;
"
>
MISSION COMPLETE
</div>

</div>

</div>

`;

document.body.appendChild(widget);

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

complete:
    widget.querySelector('#spComplete')

};

startSpiderScene();

}

// ─────────────────────────────────────────────────────────────
// CANVAS ENGINE
// ─────────────────────────────────────────────────────────────

function startSpiderScene() {

const canvas =
    document.getElementById('spidermanCanvas');

if (!canvas) return;

const ctx = canvas.getContext('2d');

let w = canvas.width = window.innerWidth;

let h = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {

    w = canvas.width = window.innerWidth;

    h = canvas.height = window.innerHeight;

});

const buildings = [];

for (let i = 0; i < 50; i++) {

    buildings.push({

        x: i * 70,

        y: h - (150 + Math.random() * 350),

        w: 80 + Math.random() * 120,

        h: 200 + Math.random() * 450

    });
}

const particles = [];

for (let i = 0; i < 100; i++) {

    particles.push({

        x: Math.random() * w,

        y: Math.random() * h,

        s: Math.random() * 2,

        v: Math.random() * .6 + .2

    });
}

let t = 0;

function drawSpiderMan(x, y, swing) {

    ctx.save();

    ctx.translate(x, y);

    ctx.rotate(Math.sin(swing) * .5);

    ctx.strokeStyle = 'rgba(255,255,255,.7)';

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.moveTo(0, -300);

    ctx.lineTo(0, 0);

    ctx.stroke();

    ctx.fillStyle = '#ff2d2d';

    ctx.beginPath();

    ctx.arc(0, 0, 16, 0, Math.PI * 2);

    ctx.fill();

    ctx.fillStyle = '#1f6fff';

    ctx.fillRect(-10, 16, 20, 34);

    ctx.strokeStyle = '#1f6fff';

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(-8, 48);

    ctx.lineTo(-18, 70);

    ctx.moveTo(8, 48);

    ctx.lineTo(18, 70);

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(-10, 24);

    ctx.lineTo(-24, 42);

    ctx.moveTo(10, 24);

    ctx.lineTo(24, 42);

    ctx.stroke();

    ctx.restore();
}

function render() {

    ctx.clearRect(0,0,w,h);

    const grad =
        ctx.createLinearGradient(0,0,0,h);

    grad.addColorStop(0,'#ff9966');

    grad.addColorStop(.2,'#ff5e62');

    grad.addColorStop(.5,'#355c7d');

    grad.addColorStop(1,'#1d2b64');

    ctx.fillStyle = grad;

    ctx.fillRect(0,0,w,h);

    // clouds

    ctx.fillStyle = 'rgba(255,255,255,.05)';

    for (let i = 0; i < 10; i++) {

        ctx.beginPath();

        ctx.arc(
            (i * 220 + t * .4) % (w + 400) - 200,
            120 + Math.sin(i + t * .002) * 20,
            80,
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
            'rgba(30,30,60,.85)'
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
            let wy = b.y + 10;
            wy < h;
            wy += 16
        ) {

            for (
                let wx = b.x + 8;
                wx < b.x + b.w - 8;
                wx += 14
            ) {

                if (Math.random() > .7) {

                    ctx.fillStyle =
                        Math.random() > .5
                            ?
                            'rgba(255,190,80,.8)'
                            :
                            'rgba(120,180,255,.7)';

                    ctx.fillRect(wx,wy,5,7);
                }
            }
        }

    });

    // traffic

    for (let i = 0; i < 20; i++) {

        ctx.strokeStyle =
            i % 2
                ?
                'rgba(255,80,80,.5)'
                :
                'rgba(255,255,180,.4)';

        ctx.lineWidth = 2;

        ctx.beginPath();

        const yy =
            h - 60 + Math.sin(i) * 12;

        ctx.moveTo(
            (i * 100 + t * 2) % (w + 200) - 200,
            yy
        );

        ctx.lineTo(
            (i * 100 + t * 2) % (w + 200) - 120,
            yy
        );

        ctx.stroke();
    }

    // particles

    particles.forEach(p=>{

        ctx.fillStyle =
            'rgba(255,255,255,.4)';

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            p.s,
            0,
            Math.PI * 2
        );

        ctx.fill();

        p.y -= p.v;

        if (p.y < -10) {

            p.y = h + 10;

            p.x = Math.random() * w;
        }

    });

    // helicopter

    ctx.fillStyle = 'rgba(0,0,0,.8)';

    const hx =
        (t * .8) % (w + 200) - 200;

    ctx.fillRect(hx,100,40,10);

    ctx.fillRect(hx + 15,90,10,8);

    ctx.beginPath();

    ctx.moveTo(hx - 20,105);

    ctx.lineTo(hx + 60,105);

    ctx.strokeStyle = 'rgba(255,255,255,.7)';

    ctx.stroke();

    // spiderman

    const sx =
        w * .35 + Math.sin(t * .002) * 240;

    const sy =
        h * .3 + Math.cos(t * .003) * 80;

    drawSpiderMan(sx,sy,t * .01);

    // motion streaks

    ctx.strokeStyle =
        'rgba(255,255,255,.15)';

    ctx.lineWidth = 4;

    for (let i = 0; i < 6; i++) {

        ctx.beginPath();

        ctx.moveTo(
            sx - 20 - i * 16,
            sy + i * 4
        );

        ctx.lineTo(
            sx - 120 - i * 16,
            sy + i * 4
        );

        ctx.stroke();
    }

    t++;

    requestAnimationFrame(render);

}

render();

}

// ─────────────────────────────────────────────────────────────
// UPDATE SPIDER UI
// ─────────────────────────────────────────────────────────────

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

const circumference = 534;

refs.progress.style.strokeDashoffset =
    circumference -
    (pct / 100) * circumference;

setIfChanged(
    refs.mission,
    getSpiderVibe(pct)
);

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

    refs.complete.style.display = 'flex';

}

}

// ─────────────────────────────────────────────────────────────
// MASTER UPDATE
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// OBSERVERS
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

if (THEME === 'spiderman') {

    createSpiderUI();

}

updateUI();

setInterval(updateUI,SCAN_INTERVAL_MS);

startObservers();

console.log(
'%c🕷️ KEKA CINEMATIC TRACKER LOADED',
'color:#ff3d3d;font-size:16px;font-weight:bold;'
);

})();
