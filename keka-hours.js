// ╔══════════════════════════════════════════════════════════╗
// ║ KEKA GRIND TRACKER — MULTI THEME EDITION                ║
// ║ Themes: Mario / Pokemon / Batman / Vice City            ║
// ║ Paste all 3 parts together, then run on Keka page        ║
// ╚══════════════════════════════════════════════════════════╝

(function () {
  'use strict';

  /* ═══════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════ */
  const WORK_MINUTES = 8 * 60;
  const HALF_DAY_MINUTES = 4 * 60;

  /*
    THEME ROTATION:
    Day 1 -> Mario
    Day 2 -> Pokemon
    Day 3 -> Batman
    Day 4 -> Vice City
    Day 5 -> Mario again

    Manual testing:
    Add ?kekaTheme=mario
    Add ?kekaTheme=pokemon
    Add ?kekaTheme=batman
    Add ?kekaTheme=vice
  */
  const THEME_ORDER = ['mario', 'pokemon', 'batman', 'vice'];

  /*
    IMAGE / GIF / RESOURCE ASSETS

    IMPORTANT:
    - Keep only image/audio/font URLs here.
    - Do NOT add external JavaScript URLs.
    - Prefer your own GitHub repo raw URLs.
    - You can replace these empty strings with your own URLs.

    Recommended formats:
    https://raw.githubusercontent.com/YOUR_USER/YOUR_REPO/main/assets/...
    or
    https://YOUR_USER.github.io/YOUR_REPO/assets/...

    Example:
    logo: 'https://raw.githubusercontent.com/neelansh/keka-themes/main/assets/batman/logo.png'
  */
  const ASSETS = {
    mario: {
      // Main characters
      mario: '',
      luigi: '',
      bowser: '',
      peach: '',
      goomba: '',

      // Background / props
      bg: '',
      pipe: '',
      block: '',
      coin: '',
      star: '',
      castle: '',

      // Optional animated resources
      coinGif: '',
      victoryGif: ''
    },

    pokemon: {
      // Main characters
      pikachu: '',
      charizard: '',
      gengar: '',
      trainer: '',

      // Props / UI
      pokeball: '',
      greatball: '',
      badge: '',
      potion: '',

      // Backgrounds
      bg: '',
      grass: '',
      arena: '',

      // Optional animated resources
      captureGif: '',
      victoryGif: ''
    },

    batman: {
      // Main Batman resources
      logo: '',
      batman: '',
      batSignal: '',
      batsGif: '',

      // Backgrounds
      gotham: '',
      cave: '',
      rain: '',
      moon: '',

      // Props
      batarang: '',
      jokerCard: '',
      arkhamLogo: '',

      // Optional animated resources
      smokeGif: '',
      lightningGif: ''
    },

    vice: {
      // Main Vice City resources
      logo: '',
      tommy: '',
      car: '',
      palm: '',

      // Backgrounds
      bg: '',
      sky: '',
      neonGrid: '',
      oceanDrive: '',

      // Props
      cassette: '',
      sunglasses: '',
      neonSign: '',

      // Optional animated resources
      sunsetGif: '',
      neonGif: ''
    }
  };

  /*
    WHERE PNG/GIF WILL BE USED

    MARIO:
    - ASSETS.mario.mario      -> replaces canvas Mario if provided
    - ASSETS.mario.luigi      -> left-side Luigi
    - ASSETS.mario.bowser     -> right-side Bowser
    - ASSETS.mario.peach      -> Princess Peach
    - ASSETS.mario.goomba     -> enemy on ground
    - ASSETS.mario.bg         -> Mario world background
    - ASSETS.mario.coin       -> coin row icon
    - ASSETS.mario.star       -> victory star

    POKEMON:
    - ASSETS.pokemon.pikachu  -> right-side Pikachu
    - ASSETS.pokemon.trainer  -> left-side trainer
    - ASSETS.pokemon.pokeball -> center Pokeball
    - ASSETS.pokemon.bg       -> Pokemon background
    - ASSETS.pokemon.badge    -> 100% completion badge

    BATMAN:
    - ASSETS.batman.logo      -> real Batman logo
    - ASSETS.batman.batman    -> Batman silhouette/body
    - ASSETS.batman.batsGif   -> bats coming out of cave animation
    - ASSETS.batman.gotham    -> Gotham skyline
    - ASSETS.batman.cave      -> Batcave background
    - ASSETS.batman.batSignal -> Bat signal
    - ASSETS.batman.rain      -> rain overlay if you use transparent GIF/PNG

    VICE CITY:
    - ASSETS.vice.logo        -> Vice City logo
    - ASSETS.vice.tommy       -> Tommy Vercetti
    - ASSETS.vice.car         -> car asset
    - ASSETS.vice.palm        -> palm tree
    - ASSETS.vice.bg          -> main Vice City background
    - ASSETS.vice.sky         -> sunset sky
    - ASSETS.vice.neonGrid    -> neon grid overlay
  */

  /* ═══════════════════════════════════════
     STATE
  ═══════════════════════════════════════ */
  let tenMinTriggered = false;
  let eightHourTriggered = false;
  let confettiInterval = null;
  let titleFlashInterval = null;
  let didSlideIn = false;
  let minimized = false;
  const originalTitle = document.title;

  /* ═══════════════════════════════════════
     THEME HELPERS
  ═══════════════════════════════════════ */
  function getDayOfYear() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    return Math.floor(diff / 86400000);
  }

  function getThemeFromURL() {
    try {
      const p = new URLSearchParams(window.location.search);
      const forced = (p.get('kekaTheme') || '').toLowerCase().trim();
      if (THEME_ORDER.includes(forced)) return forced;
    } catch (e) {}
    return null;
  }

  function getTodayTheme() {
    const forced = getThemeFromURL();
    if (forced) return forced;

    const day = getDayOfYear();
    return THEME_ORDER[(day - 1) % THEME_ORDER.length];
  }

  const CURRENT_THEME = getTodayTheme();

  const THEME_META = {
    mario: {
      name: 'MARIO WORLD',
      subtitle: 'The Eternal Session',
      accent: '#e8282b',
      accent2: '#ffd700',
      dark: '#1a237e',
      panel: '#e8282b',
      glassText: '#1a237e',
      worked: 'linear-gradient(155deg,#1565c0,#0d47a1)',
      left: 'linear-gradient(155deg,#e65100,#bf360c)',
      brk: 'linear-gradient(155deg,#2e7d32,#1b5e20)',
      half: '#f9a825',
      full: '#1e88e5',
      worldBg:
        'linear-gradient(180deg,#5c94fc 0%,#7fb4ff 60%,#a8d0ff 100%)',
      ticker:
        'CHAI PIVI CHE KE NHI ★ BOSS NE KHABAR NATHI ★ GHAR JA BHAI ★ SURAT NO SHER ★ KEKA BAND KAR ★ PAKODA TIME ★ CHAI PIVI CHE KE NHI ★',
      doneTicker:
        'VICTORY ★ CHUTTI PAKKI HAI ★ GHAR JA BHAI ★ LAPTOP BAND KAR ★ SURAT NO SHER JEETI GAYO ★ NIKAL BHAI ★',
      victoryTitle: '8 GHANTE COMPLETE',
      victoryLine: 'nikal gayo bhai 🎉',
      doneVibe: '"Ghr bhega thao… the realm is yours. ghar ja."'
    },

    pokemon: {
      name: 'POKEMON SHIFT',
      subtitle: 'Catch the Work Hours',
      accent: '#ef4444',
      accent2: '#ffcb05',
      dark: '#1d3557',
      panel: '#2563eb',
      glassText: '#1d3557',
      worked: 'linear-gradient(155deg,#2563eb,#1e3a8a)',
      left: 'linear-gradient(155deg,#f97316,#c2410c)',
      brk: 'linear-gradient(155deg,#16a34a,#166534)',
      half: '#ffcb05',
      full: '#ef4444',
      worldBg:
        'linear-gradient(180deg,#8ec5ff 0%,#d7fbe8 55%,#7bd66f 100%)',
      ticker:
        'WILD TASK APPEARED ★ USE FOCUS ATTACK ★ COFFEE POTION READY ★ GOTTA FINISH EM ALL ★ OFFICE GYM LEADER WAITING ★',
      doneTicker:
        'BADGE EARNED ★ 8 HOURS CAPTURED ★ RUN FROM OFFICE ★ POKECENTER HOME READY ★',
      victoryTitle: 'BADGE EARNED',
      victoryLine: '8 hours captured successfully ⚡',
      doneVibe: '"badge mil gaya… ab ghar ja trainer."'
    },

    batman: {
      name: 'GOTHAM WATCH',
      subtitle: 'Arkham Night Shift',
      accent: '#111827',
      accent2: '#facc15',
      dark: '#fef3c7',
      panel: '#050505',
      glassText: '#fef3c7',
      worked: 'linear-gradient(155deg,#111827,#020617)',
      left: 'linear-gradient(155deg,#78350f,#451a03)',
      brk: 'linear-gradient(155deg,#374151,#111827)',
      half: '#facc15',
      full: '#111827',
      worldBg:
        'radial-gradient(circle at 70% 18%,rgba(250,204,21,.35),transparent 14%),linear-gradient(180deg,#020617 0%,#030712 55%,#000 100%)',
      ticker:
        'GOTHAM IS WATCHING ★ SIGNAL ACTIVE ★ ONE MORE CASE FILE ★ THE NIGHT IS LONG ★ BATCAVE AWAITS ★',
      doneTicker:
        'MISSION COMPLETE ★ RETURN TO BATCAVE ★ GOTHAM SURVIVED ★ VANISH INTO THE NIGHT ★',
      victoryTitle: 'MISSION COMPLETE',
      victoryLine: 'Gotham survived another shift 🦇',
      doneVibe: '"mission complete… return to the cave."'
    },

    vice: {
      name: 'VICE SHIFT',
      subtitle: 'Neon Attendance Run',
      accent: '#ec4899',
      accent2: '#22d3ee',
      dark: '#ffffff',
      panel: '#111827',
      glassText: '#ffffff',
      worked: 'linear-gradient(155deg,#06b6d4,#0e7490)',
      left: 'linear-gradient(155deg,#ec4899,#9d174d)',
      brk: 'linear-gradient(155deg,#7c3aed,#4c1d95)',
      half: '#22d3ee',
      full: '#ec4899',
      worldBg:
        'linear-gradient(180deg,#2b1055 0%,#ec4899 45%,#f97316 100%)',
      ticker:
        'NEON LIGHTS ON ★ OCEAN DRIVE CALLING ★ FINISH THE SHIFT ★ NIGHT CITY MODE ★ LOGOUT SOON ★',
      doneTicker:
        'SHIFT COMPLETE ★ NEON NIGHT UNLOCKED ★ LOG OUT AND DRIVE HOME ★ VICE MODE COMPLETE ★',
      victoryTitle: 'SHIFT COMPLETE',
      victoryLine: 'Neon night unlocked 🌴',
      doneVibe: '"vice mode complete… ab logout kar."'
    }
  };

  const T = THEME_META[CURRENT_THEME] || THEME_META.mario;

  /* ═══════════════════════════════════════
     ASSET HELPERS
  ═══════════════════════════════════════ */
  function safeAsset(src) {
    if (!src || typeof src !== 'string') return '';

    const trimmed = src.trim();

    if (!trimmed) return '';

    // Only allow http/https images from trusted-style URLs.
    // This blocks javascript:, data:, blob:, file:, etc.
    if (!/^https:\/\//i.test(trimmed)) return '';

    return trimmed;
  }

  function assetImg(src, style, alt, className) {
    const safe = safeAsset(src);
    if (!safe) return '';

    return `
      <img
        src="${safe}"
        alt="${alt || ''}"
        class="${className || ''}"
        referrerpolicy="no-referrer"
        loading="eager"
        decoding="async"
        draggable="false"
        style="${style || ''}"
      />
    `;
  }

  function bgAssetStyle(src) {
    const safe = safeAsset(src);
    if (!safe) return '';
    return `background-image:url('${safe}');background-size:cover;background-position:center;background-repeat:no-repeat;`;
  }

  /* ═══════════════════════════════════════
     TIME HELPERS
  ═══════════════════════════════════════ */
  function parseTime(ts) {
    if (!ts || ts === 'MISSING') return null;

    const parts = ts.toLowerCase().split(' ').filter(Boolean);
    if (parts.length < 2) return null;

    let [H, M] = parts[0].split(':').map(Number);
    const ap = parts[1];

    if (Number.isNaN(H) || Number.isNaN(M)) return null;

    if (ap === 'pm' && H !== 12) H += 12;
    if (ap === 'am' && H === 12) H = 0;

    return { hours: H, minutes: M };
  }

  function minutesBetween(s, e) {
    const st = parseTime(s);
    const en = parseTime(e);

    if (!st || !en) return 0;

    let m = (en.hours - st.hours) * 60 + (en.minutes - st.minutes);

    if (m < 0) m += 1440;
    if (m > 720) m = 0;

    return m;
  }

  function fmtTime(d) {
    return d
      .toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
      .toUpperCase();
  }

  function fmtHM(mins) {
    const safe = Math.max(0, mins || 0);
    return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, '0')}m`;
  }

  /* ═══════════════════════════════════════
     KEKA LOG PROCESSING
  ═══════════════════════════════════════ */
  function processLogs(container) {
    if (!container) return;

    const rows = Array.from(
      container.querySelectorAll('.ng-untouched.ng-pristine.ng-valid')
    );

    let totalM = 0;
    let firstStart = null;
    let prevEnd = null;
    let breakM = 0;
    let activeStart = null;

    rows.forEach((row, idx) => {
      const startEl =
        row.querySelector('.w-120.mr-20 .text-small') ||
        row.querySelector('.w-120.mr-20');

      const endEl =
        row.querySelector('.w-120:not(.mr-20) .text-small') ||
        row.querySelector('.w-120:not(.mr-20)');

      const s = startEl ? startEl.textContent.trim() : null;
      const e = endEl ? endEl.textContent.trim() : null;

      if (idx === 0) firstStart = s;

      if (idx !== 0 && prevEnd && s) {
        breakM += minutesBetween(prevEnd, s);
      }

      if (e === 'MISSING') {
        activeStart = s;
      } else {
        totalM += minutesBetween(s, e);
        prevEnd = e;
      }
    });

    if (activeStart) {
      const st = parseTime(activeStart);

      if (st) {
        const now = new Date();
        const live =
          (now.getHours() - st.hours) * 60 +
          (now.getMinutes() - st.minutes);

        if (live > 0 && live < 720) totalM += live;
      }
    }

    window.KekaHoursLatest = {
      totalMinutes: totalM,
      breakMinutes: breakM,
      firstStart
    };
  }

  /* ═══════════════════════════════════════
     VIBE MESSAGES
  ═══════════════════════════════════════ */
  function getVibe(pct) {
    if (pct >= 100) return T.doneVibe || '"done… ghar ja."';

    if (CURRENT_THEME === 'pokemon') {
      if (pct >= 90) return '"final badge close hai… don’t faint now."';
      if (pct >= 75) return '"elite four stage… bas thoda aur."';
      if (pct >= 50) return '"half HP done… keep battling."';
      if (pct >= 25) return '"first badge secured… continue trainer."';
      return '"wild task appeared… choose focus."';
    }

    if (CURRENT_THEME === 'batman') {
      if (pct >= 90) return '"last case file… Gotham almost sleeps."';
      if (pct >= 75) return '"signal strong… hold the night."';
      if (pct >= 50) return '"half patrol done… no weakness."';
      if (pct >= 25) return '"streets are active… keep moving."';
      return '"the night has started… become the shadow."';
    }

    if (CURRENT_THEME === 'vice') {
      if (pct >= 90) return '"last neon mile… logout close."';
      if (pct >= 75) return '"Ocean Drive calling… hold the vibe."';
      if (pct >= 50) return '"half shift crossed… neon still burning."';
      if (pct >= 25) return '"engine warm… keep cruising."';
      return '"shift started… neon grind begins."';
    }

    if (pct >= 90) return '"10% remains… do not falter now, warrior."';
    if (pct >= 75) return '"ghar dikhne laga hai… hold the line."';
    if (pct >= 50) return '"aadha done… the grind is not over."';
    if (pct >= 25) return '"chautha part khatam… keep moving."';
    return '"kaam shuru kar… the grind demands tribute."';
  }
    /* ═══════════════════════════════════════
     STYLE INJECTION
  ═══════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('kekaMultiThemeStyles')) return;

    const style = document.createElement('style');
    style.id = 'kekaMultiThemeStyles';

    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,800;0,900;1,800&family=Orbitron:wght@700;900&family=Bebas+Neue&display=swap');

      #kekaMultiTheme,
      #kekaMultiTheme * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        user-select: none;
      }

      #kekaMultiTheme {
        font-family: 'Nunito', sans-serif;
      }

      #kekaMultiTheme img {
        pointer-events: none;
        user-select: none;
      }

      @keyframes km-slidein {
        from { transform: translateX(115%); opacity: 0; }
        to   { transform: translateX(0); opacity: 1; }
      }

      @keyframes km-twinkle {
        0%,100% { opacity: .9; transform: scale(1); }
        50% { opacity: .25; transform: scale(.6); }
      }

      @keyframes km-ld {
        0%,100% { opacity: 1; }
        50% { opacity: .28; }
      }

      @keyframes km-ticker {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }

      @keyframes km-confetti {
        0% { transform: translateY(-16px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }

      @keyframes km-warn {
        0%,100% {
          box-shadow:
            0 0 0 4px #fff,
            0 0 0 8px ${T.accent},
            0 0 0 12px #fff,
            0 24px 60px rgba(0,0,0,.4);
        }
        50% {
          box-shadow:
            0 0 0 4px #fff,
            0 0 0 8px ${T.accent2},
            0 0 0 12px #fff,
            0 24px 70px rgba(255,215,0,.35);
        }
      }

      @keyframes km-victory {
        0%,100% {
          box-shadow:
            0 0 0 4px #fff,
            0 0 0 8px ${T.accent2},
            0 0 0 12px #fff,
            0 24px 60px rgba(0,0,0,.45);
        }
        50% {
          box-shadow:
            0 0 0 4px #fff,
            0 0 0 8px ${T.accent2},
            0 0 0 12px #fff,
            0 24px 90px rgba(255,215,0,.45);
        }
      }

      @keyframes km-float {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }

      @keyframes km-pulse {
        0%,100% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.04); filter: brightness(1.12); }
      }

      @keyframes km-batfly {
        0% {
          opacity: 0;
          transform: translate(0,0) scale(.35) rotate(0deg);
        }
        15% { opacity: 1; }
        100% {
          opacity: 0;
          transform: translate(var(--x), var(--y)) scale(1.1) rotate(28deg);
        }
      }

      @keyframes km-rain {
        0% { transform: translateY(-40px); }
        100% { transform: translateY(40px); }
      }

      @keyframes km-neon {
        0%,100% {
          text-shadow:
            0 0 8px #ff4fd8,
            0 0 18px #ff4fd8,
            0 0 30px #00e5ff;
        }
        50% {
          text-shadow:
            0 0 4px #ff4fd8,
            0 0 12px #00e5ff,
            0 0 24px #00e5ff;
        }
      }

      @keyframes km-scan {
        0% { transform: translateY(-100%); opacity: 0; }
        30% { opacity: .35; }
        100% { transform: translateY(220px); opacity: 0; }
      }

      @keyframes km-mario-run {
        0% { left: -44px; bottom: 54px; }
        35% { left: 130px; bottom: 54px; }
        42% { left: 158px; bottom: 106px; }
        50% { left: 186px; bottom: 54px; }
        70% { left: 255px; bottom: 54px; }
        77% { left: 286px; bottom: 96px; }
        84% { left: 315px; bottom: 54px; }
        100% { left: 410px; bottom: 54px; }
      }

      @keyframes km-goomba-walk {
        0% { left: 390px; }
        100% { left: -44px; }
      }

      .km-bat {
        position: absolute;
        width: 18px;
        height: 10px;
        background: #000;
        clip-path: polygon(
          0 50%,
          18% 18%,
          38% 45%,
          50% 0,
          62% 45%,
          82% 18%,
          100% 50%,
          74% 58%,
          58% 50%,
          50% 80%,
          42% 50%,
          26% 58%
        );
        animation: km-batfly 3.6s ease-out infinite;
        filter: drop-shadow(0 0 6px rgba(0,0,0,.8));
      }

      .km-rain {
        position: absolute;
        inset: -40px 0;
        pointer-events: none;
        opacity: .22;
        background-image:
          repeating-linear-gradient(
            110deg,
            rgba(255,255,255,.0) 0px,
            rgba(255,255,255,.0) 10px,
            rgba(255,255,255,.35) 11px,
            rgba(255,255,255,.35) 12px,
            rgba(255,255,255,.0) 14px
          );
        animation: km-rain .55s linear infinite;
      }

      .km-scanline {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 70px;
        background: linear-gradient(
          180deg,
          transparent,
          rgba(255,255,255,.22),
          transparent
        );
        animation: km-scan 4.5s linear infinite;
        pointer-events: none;
      }

      .km-neon-text {
        font-family: 'Bebas Neue', 'Orbitron', sans-serif;
        animation: km-neon 2.2s ease-in-out infinite;
      }

      .km-world-img-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: .72;
      }

      .km-world-soft-overlay {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 20% 18%, rgba(255,255,255,.32), transparent 22%),
          linear-gradient(180deg, rgba(255,255,255,.08), rgba(0,0,0,.08));
        pointer-events: none;
      }
    `;

    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════
     PIXEL SPRITES — FALLBACK MARIO / GOOMBA
  ═══════════════════════════════════════ */
  function drawMarioFrame(ctx, frame) {
    ctx.clearRect(0, 0, 44, 58);

    const S = 4;
    const R = '#e52213';
    const B = '#0052a2';
    const SK = '#fba86f';
    const SH = '#5e1205';
    const BL = '#4a2200';
    const W = '#ffffff';
    const E = '#e8a000';

    function d(x, y, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x * S, y * S, S, S);
    }

    [
      [3,0,R],[4,0,R],[5,0,R],[6,0,R],[7,0,R],[8,0,R],
      [2,1,R],[3,1,R],[4,1,R],[5,1,R],[6,1,R],[7,1,R],[8,1,R],[9,1,R],
      [1,2,SH],[2,2,SH],[3,2,SH],
      [3,2,SK],[4,2,SK],[5,2,SK],[6,2,SK],[7,2,SK],[8,2,SK],[9,2,SK],
      [1,3,SK],[2,3,SK],[3,3,SK],[4,3,SK],[5,3,SK],[6,3,SK],[7,3,SK],[8,3,SK],[9,3,SK],
      [1,4,SK],[2,4,SK],[3,4,SK],[4,4,SK],[5,4,SK],[6,4,SK],[7,4,SK],[8,4,SK],[9,4,SK],
      [2,4,SH],[3,4,SH],[4,4,SH],[6,4,SH],[7,4,SH],[8,4,SH],
      [2,5,R],[1,5,R],[8,5,R],[9,5,R],
      [3,5,E],[4,5,E],[5,5,E],[6,5,E],[7,5,E],
      [0,6,B],[1,6,B],[2,6,B],[3,6,B],[4,6,B],[5,6,B],[6,6,B],[7,6,B],[8,6,B],[9,6,B],[10,6,B],
      [0,7,B],[1,7,B],[2,7,B],[3,7,B],[4,7,B],[5,7,B],[6,7,B],[7,7,B],[8,7,B],[9,7,B],[10,7,B],
      [2,8,B],[3,8,B],[4,8,SK],[5,8,SK],[6,8,B],[7,8,B],[8,8,B],
      [2,9,SK],[3,9,SK],[4,9,SK],[5,9,SK],[6,9,SK],[7,9,SK],[8,9,SK]
    ].forEach(p => d(...p));

    d(3,3,SH);
    d(7,3,SH);
    d(-1,6,SK);
    d(-1,7,R);
    d(11,6,SK);
    d(11,7,SK);
    d(3,5,W);
    d(8,5,W);

    if (frame % 2 === 0) {
      [
        [2,10,B],[3,10,B],[7,10,B],[8,10,B],[9,10,B],
        [2,11,BL],[3,11,BL],[8,11,BL],[9,11,BL]
      ].forEach(p => d(...p));
    } else {
      [
        [1,10,B],[2,10,B],[3,10,B],[8,10,B],[9,10,B],
        [1,11,BL],[2,11,BL],[8,11,BL],[9,11,BL]
      ].forEach(p => d(...p));
    }
  }

  function drawGoombaFrame(ctx, frame) {
    ctx.clearRect(0, 0, 40, 40);

    const S = 4;
    const GB = '#795548';
    const GD = '#4a2200';
    const GW = '#fff';

    function d(x, y, c) {
      ctx.fillStyle = c;
      ctx.fillRect(x * S, y * S, S, S);
    }

    [
      [1,2,GB],[2,2,GB],[3,2,GB],[4,2,GB],[5,2,GB],[6,2,GB],[7,2,GB],
      [0,3,GB],[1,3,GB],[2,3,GB],[3,3,GB],[4,3,GB],[5,3,GB],[6,3,GB],[7,3,GB],[8,3,GB],
      [0,4,GB],[1,4,GB],[2,4,GB],[3,4,GB],[4,4,GB],[5,4,GB],[6,4,GB],[7,4,GB],[8,4,GB],
      [0,5,GB],[1,5,GB],[2,5,GB],[3,5,GB],[4,5,GB],[5,5,GB],[6,5,GB],[7,5,GB],[8,5,GB],
      [1,6,GB],[2,6,GB],[3,6,GB],[4,6,GB],[5,6,GB],[6,6,GB],[7,6,GB]
    ].forEach(p => d(...p));

    [
      [1,3,GW],[2,3,GW],[6,3,GW],[7,3,GW],
      [1,4,GW],[2,4,GW],[6,4,GW],[7,4,GW]
    ].forEach(p => d(...p));

    d(2,4,'#000');
    d(7,4,'#000');

    [
      [0,2,GD],[1,2,GD],[6,2,GD],[7,2,GD],[8,2,GD]
    ].forEach(p => d(...p));

    if (frame % 2 === 0) {
      [
        [0,7,GD],[1,7,GD],[6,7,GD],[7,7,GD],[8,7,GD]
      ].forEach(p => d(...p));
    } else {
      [
        [1,7,GD],[2,7,GD],[5,7,GD],[6,7,GD],[7,7,GD]
      ].forEach(p => d(...p));
    }
  }

  function startSprites() {
    const mc = document.getElementById('kmMarioCanvas');
    const gc = document.getElementById('kmGoombaCanvas');

    if (!mc && !gc) return;

    const mCtx = mc ? mc.getContext('2d') : null;
    const gCtx = gc ? gc.getContext('2d') : null;

    let frame = 0;

    if (mCtx) drawMarioFrame(mCtx, 0);
    if (gCtx) drawGoombaFrame(gCtx, 0);

    setInterval(() => {
      frame++;
      if (mCtx) drawMarioFrame(mCtx, frame);
      if (gCtx) drawGoombaFrame(gCtx, frame);
    }, 180);
  }

  /* ═══════════════════════════════════════
     WORLD HTML
  ═══════════════════════════════════════ */
  function marioWorldHTML() {
    const marioImg = assetImg(
      ASSETS.mario.mario,
      'position:absolute;left:-44px;bottom:54px;width:54px;max-height:72px;object-fit:contain;animation:km-mario-run 8s linear infinite;filter:drop-shadow(0 4px 0 rgba(0,0,0,.22));z-index:4;',
      'Mario'
    );

    const goombaImg = assetImg(
      ASSETS.mario.goomba,
      'position:absolute;bottom:54px;width:42px;max-height:42px;object-fit:contain;animation:km-goomba-walk 6s linear infinite;filter:drop-shadow(0 3px 0 rgba(0,0,0,.22));z-index:3;',
      'Goomba'
    );

    return `
      ${ASSETS.mario.bg ? assetImg(ASSETS.mario.bg, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;', 'Mario Background') : ''}

      <div class="km-world-soft-overlay"></div>

      <div style="position:absolute;top:12px;right:24px;width:54px;height:54px;border-radius:50%;background:#ffd700;border:4px solid #fff;box-shadow:0 0 0 3px #e8a000,0 6px 20px rgba(255,200,0,.5);"></div>

      <svg style="position:absolute;top:18px;left:12px;" width="90" height="46" viewBox="0 0 90 46">
        <ellipse cx="45" cy="37" rx="42" ry="18" fill="white"/>
        <ellipse cx="28" cy="30" rx="22" ry="20" fill="white"/>
        <ellipse cx="55" cy="28" rx="24" ry="22" fill="white"/>
        <ellipse cx="40" cy="24" rx="18" ry="17" fill="white"/>
      </svg>

      <svg style="position:absolute;top:22px;left:170px;" width="70" height="38" viewBox="0 0 70 38">
        <ellipse cx="35" cy="29" rx="31" ry="13" fill="white"/>
        <ellipse cx="22" cy="22" rx="16" ry="15" fill="white"/>
        <ellipse cx="45" cy="21" rx="18" ry="16" fill="white"/>
      </svg>

      <svg style="position:absolute;bottom:54px;left:0;right:0;width:100%;height:74px;" viewBox="0 0 360 74" preserveAspectRatio="none">
        <ellipse cx="70" cy="104" rx="100" ry="72" fill="#4caf50"/>
        <ellipse cx="240" cy="106" rx="115" ry="75" fill="#43a047"/>
        <ellipse cx="340" cy="108" rx="85" ry="68" fill="#2e7d32"/>
        <ellipse cx="55" cy="72" rx="18" ry="10" fill="#66bb6a"/>
        <ellipse cx="220" cy="76" rx="22" ry="12" fill="#66bb6a"/>
      </svg>

      <div style="position:absolute;bottom:0;left:0;right:0;height:54px;background:
        linear-gradient(#4caf50 0 13px,#2e7d32 13px 15px,transparent 15px),
        repeating-linear-gradient(90deg,#c8860a 0,#c8860a 34px,#7a5000 34px,#7a5000 36px);
        border-top:3px solid #fff;">
      </div>

      <div style="position:absolute;top:86px;left:106px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;animation:km-float 2s ease-in-out infinite;">?</div>

      <div style="position:absolute;top:70px;left:204px;width:30px;height:30px;background:#e8a000;border:3px solid #fff;border-radius:6px;box-shadow:0 4px 0 #7a4800;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;animation:km-float 2.2s ease-in-out infinite .4s;">?</div>

      <div style="position:absolute;bottom:54px;left:18px;width:44px;height:44px;background:#43a047;border:3px solid #fff;border-radius:8px 8px 0 0;box-shadow:0 0 0 2px #2e7d32,inset -4px 0 0 rgba(0,0,0,.15);"></div>

      ${assetImg(ASSETS.mario.luigi, 'position:absolute;left:6px;bottom:56px;width:48px;max-height:76px;object-fit:contain;filter:drop-shadow(0 4px 0 rgba(0,0,0,.25));z-index:3;', 'Luigi')}

      ${
        marioImg ||
        '<canvas id="kmMarioCanvas" width="44" height="58" style="position:absolute;bottom:54px;image-rendering:pixelated;animation:km-mario-run 8s linear infinite;z-index:4;"></canvas>'
      }

      ${
        goombaImg ||
        '<canvas id="kmGoombaCanvas" width="40" height="40" style="position:absolute;bottom:54px;image-rendering:pixelated;animation:km-goomba-walk 6s linear infinite;z-index:3;"></canvas>'
      }

      ${
        ASSETS.mario.bowser
          ? assetImg(ASSETS.mario.bowser, 'position:absolute;right:18px;bottom:52px;width:78px;max-height:96px;object-fit:contain;filter:drop-shadow(0 5px 0 rgba(0,0,0,.25));z-index:3;', 'Bowser')
          : '<div style="position:absolute;right:20px;bottom:58px;width:62px;height:70px;background:#33691e;border:3px solid #fff;border-radius:16px;box-shadow:0 5px 0 rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:30px;z-index:3;">🐢</div>'
      }

      ${
        ASSETS.mario.peach
          ? assetImg(ASSETS.mario.peach, 'position:absolute;right:0;bottom:54px;width:46px;max-height:78px;object-fit:contain;filter:drop-shadow(0 2px 0 #fff);z-index:4;', 'Princess Peach')
          : '<div style="position:absolute;right:4px;bottom:58px;font-size:42px;filter:drop-shadow(0 2px 0 #fff);z-index:4;">👸</div>'
      }
    `;
  }

  function pokemonWorldHTML() {
    return `
      ${ASSETS.pokemon.bg ? assetImg(ASSETS.pokemon.bg, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.82;', 'Pokemon Background') : ''}

      <div class="km-world-soft-overlay"></div>

      <div style="position:absolute;left:-20px;right:-20px;bottom:0;height:64px;background:linear-gradient(180deg,#5fcf65,#2f9e44);border-top:4px solid rgba(255,255,255,.75);"></div>

      <div style="position:absolute;left:0;right:0;bottom:52px;height:38px;background:radial-gradient(ellipse at center,#ffffff 0 18%,transparent 19%),linear-gradient(90deg,transparent 0 48%,rgba(255,255,255,.8) 48% 52%,transparent 52%);opacity:.85;"></div>

      <div style="position:absolute;top:18px;right:22px;width:58px;height:58px;border-radius:50%;background:#ffcb05;border:4px solid #fff;box-shadow:0 0 0 4px #2a75bb,0 8px 24px rgba(0,0,0,.18);animation:km-pulse 2.2s ease-in-out infinite;"></div>

      ${
        ASSETS.pokemon.trainer
          ? assetImg(ASSETS.pokemon.trainer, 'position:absolute;left:18px;bottom:52px;width:74px;max-height:100px;object-fit:contain;filter:drop-shadow(0 4px 0 rgba(0,0,0,.2));z-index:3;', 'Pokemon Trainer')
          : '<div style="position:absolute;left:28px;bottom:58px;font-size:70px;filter:drop-shadow(0 4px 0 rgba(0,0,0,.2));z-index:3;">🧢</div>'
      }

      ${
        ASSETS.pokemon.pokeball
          ? assetImg(ASSETS.pokemon.pokeball, 'position:absolute;left:128px;bottom:64px;width:68px;height:68px;object-fit:contain;filter:drop-shadow(0 10px 25px rgba(0,0,0,.25));animation:km-float 2s ease-in-out infinite;z-index:4;', 'Pokeball')
          : '<div style="position:absolute;left:128px;bottom:64px;width:68px;height:68px;border-radius:50%;background:linear-gradient(#ef4444 0 48%,#111 48% 55%,#fff 55%);border:4px solid #111;box-shadow:0 0 0 4px #fff,0 10px 25px rgba(0,0,0,.25);animation:km-float 2s ease-in-out infinite;z-index:4;"><div style="position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;border-radius:50%;background:#fff;border:4px solid #111;"></div></div>'
      }

      ${
        ASSETS.pokemon.pikachu
          ? assetImg(ASSETS.pokemon.pikachu, 'position:absolute;right:18px;bottom:52px;width:88px;max-height:100px;object-fit:contain;filter:drop-shadow(0 5px 0 rgba(0,0,0,.2));z-index:3;', 'Pikachu')
          : '<div style="position:absolute;right:28px;bottom:58px;font-size:72px;z-index:3;">⚡</div>'
      }

      ${
        ASSETS.pokemon.charizard
          ? assetImg(ASSETS.pokemon.charizard, 'position:absolute;right:90px;top:34px;width:84px;max-height:84px;object-fit:contain;opacity:.9;filter:drop-shadow(0 4px 12px rgba(0,0,0,.25));z-index:2;', 'Charizard')
          : ''
      }

      ${
        ASSETS.pokemon.gengar
          ? assetImg(ASSETS.pokemon.gengar, 'position:absolute;left:218px;bottom:52px;width:66px;max-height:76px;object-fit:contain;opacity:.92;filter:drop-shadow(0 4px 12px rgba(0,0,0,.25));z-index:2;', 'Gengar')
          : ''
      }
    `;
  }

  function batmanWorldHTML() {
    return `
      ${ASSETS.batman.cave ? assetImg(ASSETS.batman.cave, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.72;', 'Batcave') : ''}

      ${ASSETS.batman.gotham ? assetImg(ASSETS.batman.gotham, 'position:absolute;left:0;right:0;bottom:48px;width:100%;height:106px;object-fit:cover;opacity:.9;', 'Gotham Skyline') : ''}

      <div class="km-rain"></div>
      <div class="km-scanline"></div>

      <div style="position:absolute;top:16px;right:28px;width:62px;height:62px;border-radius:50%;background:radial-gradient(circle,#fef3c7 0 35%,#facc15 36% 60%,rgba(250,204,21,.2) 61%);box-shadow:0 0 45px rgba(250,204,21,.55);"></div>

      ${
        ASSETS.batman.batSignal
          ? assetImg(ASSETS.batman.batSignal, 'position:absolute;top:20px;right:20px;width:82px;max-height:82px;object-fit:contain;filter:drop-shadow(0 0 22px rgba(250,204,21,.8));z-index:3;', 'Bat Signal')
          : ''
      }

      ${
        ASSETS.batman.logo
          ? assetImg(ASSETS.batman.logo, 'position:absolute;top:50px;left:50%;transform:translateX(-50%);width:138px;max-height:74px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(0,0,0,.9));z-index:4;', 'Batman Logo')
          : '<div style="position:absolute;top:64px;left:50%;transform:translateX(-50%);width:118px;height:50px;background:#000;clip-path:polygon(0 60%,18% 28%,38% 50%,50% 10%,62% 50%,82% 28%,100% 60%,75% 70%,60% 60%,50% 88%,40% 60%,25% 70%);filter:drop-shadow(0 0 18px rgba(0,0,0,.9));z-index:4;"></div>'
      }

      ${
        ASSETS.batman.batsGif
          ? assetImg(ASSETS.batman.batsGif, 'position:absolute;left:96px;bottom:62px;width:178px;max-height:138px;object-fit:contain;opacity:.92;filter:drop-shadow(0 0 16px rgba(0,0,0,.9));z-index:5;', 'Flying Bats')
          : `<div style="position:absolute;left:120px;bottom:78px;width:120px;height:100px;z-index:5;">
              ${Array.from({ length: 18 }, (_, i) => {
                const x = -110 + (i % 9) * 28;
                const y = -72 - (i % 6) * 18;
                const left = 34 + (i % 5) * 12;
                const top = 54 + (i % 4) * 8;
                const delay = ((i * 0.19) % 2.8).toFixed(2);
                return `<div class="km-bat" style="left:${left}px;top:${top}px;--x:${x}px;--y:${y}px;animation-delay:${delay}s;"></div>`;
              }).join('')}
            </div>`
      }

      ${
        ASSETS.batman.batman
          ? assetImg(ASSETS.batman.batman, 'position:absolute;left:26px;bottom:48px;width:108px;max-height:136px;object-fit:contain;filter:drop-shadow(0 0 24px rgba(0,0,0,.95));z-index:4;', 'Batman')
          : '<div style="position:absolute;left:38px;bottom:52px;width:88px;height:118px;background:#000;clip-path:polygon(50% 0,64% 18%,82% 24%,100% 100%,66% 84%,50% 100%,34% 84%,0 100%,18% 24%,36% 18%);filter:drop-shadow(0 0 24px rgba(0,0,0,.95));z-index:4;"><div style="position:absolute;top:22px;left:38px;width:4px;height:2px;background:#fef3c7;box-shadow:10px 0 #fef3c7;"></div></div>'
      }

      ${
        ASSETS.batman.batarang
          ? assetImg(ASSETS.batman.batarang, 'position:absolute;right:34px;bottom:58px;width:58px;max-height:58px;object-fit:contain;opacity:.85;filter:drop-shadow(0 0 12px rgba(250,204,21,.35));z-index:4;', 'Batarang')
          : ''
      }

      <div style="position:absolute;bottom:0;left:0;right:0;height:52px;background:linear-gradient(180deg,#111827,#020617);border-top:2px solid rgba(250,204,21,.25);"></div>
    `;
  }

  function viceWorldHTML() {
    return `
      ${ASSETS.vice.sky ? assetImg(ASSETS.vice.sky, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.58;', 'Vice City Sky') : ''}

      ${ASSETS.vice.bg ? assetImg(ASSETS.vice.bg, 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62;', 'Vice City Background') : ''}

      ${ASSETS.vice.neonGrid ? assetImg(ASSETS.vice.neonGrid, 'position:absolute;left:0;right:0;bottom:0;width:100%;height:96px;object-fit:cover;opacity:.72;', 'Neon Grid') : ''}

      <div class="km-scanline"></div>

      <div style="position:absolute;inset:0;background:
        radial-gradient(circle at 25% 22%,rgba(34,211,238,.35),transparent 24%),
        radial-gradient(circle at 80% 30%,rgba(236,72,153,.32),transparent 24%),
        linear-gradient(180deg,rgba(43,16,85,.2),rgba(0,0,0,.18));
      "></div>

      <div style="position:absolute;left:0;right:0;bottom:0;height:58px;background:linear-gradient(180deg,rgba(15,23,42,.25),#020617);border-top:2px solid rgba(34,211,238,.6);box-shadow:0 -10px 30px rgba(236,72,153,.25);"></div>

      ${
        ASSETS.vice.logo
          ? assetImg(ASSETS.vice.logo, 'position:absolute;left:14px;top:14px;width:124px;max-height:66px;object-fit:contain;filter:drop-shadow(0 0 12px #ff4fd8) drop-shadow(0 0 22px #00e5ff);z-index:4;', 'Vice City Logo')
          : '<div class="km-neon-text" style="position:absolute;left:18px;top:18px;font-size:30px;font-weight:950;font-style:italic;color:#fff;letter-spacing:.08em;z-index:4;">VICE</div>'
      }

      ${
        ASSETS.vice.palm
          ? assetImg(ASSETS.vice.palm, 'position:absolute;left:18px;bottom:48px;width:82px;max-height:130px;object-fit:contain;filter:drop-shadow(0 0 16px rgba(34,211,238,.35));z-index:3;', 'Palm Tree')
          : '<div style="position:absolute;left:26px;bottom:48px;font-size:76px;filter:drop-shadow(0 0 16px rgba(34,211,238,.35));z-index:3;">🌴</div>'
      }

      ${
        ASSETS.vice.tommy
          ? assetImg(ASSETS.vice.tommy, 'position:absolute;right:12px;bottom:48px;width:116px;max-height:144px;object-fit:contain;filter:drop-shadow(0 0 20px rgba(236,72,153,.55));z-index:4;', 'Tommy Vercetti')
          : '<div style="position:absolute;right:18px;bottom:52px;width:100px;height:132px;background:linear-gradient(180deg,#111,#2dd4bf 0 35%,#f472b6 35% 70%,#111 70%);clip-path:polygon(38% 0,62% 0,72% 18%,70% 100%,30% 100%,28% 18%);filter:drop-shadow(0 0 20px rgba(236,72,153,.5));opacity:.9;z-index:4;"></div>'
      }

      ${
        ASSETS.vice.car
          ? assetImg(ASSETS.vice.car, 'position:absolute;left:118px;bottom:42px;width:112px;max-height:58px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(34,211,238,.45));z-index:4;', 'Vice City Car')
          : ''
      }

      ${
        ASSETS.vice.neonSign
          ? assetImg(ASSETS.vice.neonSign, 'position:absolute;right:110px;top:64px;width:92px;max-height:64px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(236,72,153,.75));z-index:4;', 'Neon Sign')
          : ''
      }
    `;
  }

  function worldHTML() {
    if (CURRENT_THEME === 'pokemon') return pokemonWorldHTML();
    if (CURRENT_THEME === 'batman') return batmanWorldHTML();
    if (CURRENT_THEME === 'vice') return viceWorldHTML();
    return marioWorldHTML();
  }
  const ASSETS = {
  mario: {
    mario: '',
    luigi: '',
    bowser: '',
    peach: '',
    goomba: '',
    bg: '',
    pipe: '',
    block: '',
    coin: '',
    star: '',
    castle: '',
    coinGif: '',
    victoryGif: ''
  },

  pokemon: {
    pikachu: '',
    charizard: '',
    gengar: '',
    trainer: '',
    pokeball: '',
    greatball: '',
    badge: '',
    potion: '',
    bg: '',
    grass: '',
    arena: '',
    captureGif: '',
    victoryGif: ''
  },

  batman: {
    logo: '',
    batman: '',
    batSignal: '',
    batsGif: '',
    gotham: '',
    cave: '',
    rain: '',
    moon: '',
    batarang: '',
    jokerCard: '',
    arkhamLogo: '',
    smokeGif: '',
    lightningGif: ''
  },

  vice: {
    logo: '',
    tommy: '',
    car: '',
    palm: '',
    bg: '',
    sky: '',
    neonGrid: '',
    oceanDrive: '',
    cassette: '',
    sunglasses: '',
    neonSign: '',
    sunsetGif: '',
    neonGif: ''
  }
};
