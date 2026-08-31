// Lightweight HUD bindings. Pure DOM, no framework.

import { Leaderboard, FALLBACK_NAME } from './leaderboard.js';
import { RunMode, MODE_CRUISIN, MODE_FESTIVAL } from './runMode.js';

const $smiles = document.getElementById('smiles');
const $best = document.getElementById('best');
const $bestScore = $best?.closest('.best-score');
const $bestConfetti = document.getElementById('best-confetti');
const $toast = document.getElementById('toast');
const $flash = document.getElementById('hit-flash');
const $starVignette = document.getElementById('star-vignette');
const $title = document.getElementById('title-card');
const $start = document.getElementById('start-btn');
const $juiceMeter = document.getElementById('juice-meter');
const $juiceFill = document.getElementById('juice-fill');
const $juiceReserve = document.getElementById('juice-reserve');
const $juiceReserveN = document.getElementById('juice-reserve-n');
const $smileStatus = document.getElementById('smile-status');
const $cycleStatus = document.getElementById('day-cycle');
const $cycleSymbol = document.getElementById('cycle-symbol');
const $lurleenStatus = document.getElementById('lurleen-status');

let _juiceState = '';     // '', 'low', or 'empty'
let _juiceReserveN = -1;
let _juiceBar = -1;
let _juiceAria = '';
let _smileN = 0;
let _bestN = 0;
let _cycleStep = -1;
let _cyclePhase = '';
let _cycleNight = false;
let _lurleenVisible = false;
let _startLabel = "Let's go ZERBLIN'!";
let _bestCelebrated = false;
let _smilePulseTimer = 0;
let _bestCelebrationTimer = 0;

let toastTimer = 0;
let toastTapHandler = null;   // currently-attached tap listener for tappable toasts

const BEST_KEY = 'zerble-best-smiles';
const NAME_KEY = 'zerble-player-name';

// Player name — captured from the title-card input, persisted across visits.
// Everything degrades to nameless: storage may be unavailable (private mode),
// the input may not exist (non-index pages import this module's siblings).
const $playerName = document.getElementById('player-name');
let _playerName = '';
try { _playerName = String(localStorage.getItem(NAME_KEY) || '').trim().slice(0, 20); } catch (e) { /* storage unavailable */ }
if ($playerName && _playerName) $playerName.value = _playerName;
function captureName() {
  if (!$playerName) return;
  _playerName = $playerName.value.trim().slice(0, 20);
  try {
    if (_playerName) localStorage.setItem(NAME_KEY, _playerName);
    else localStorage.removeItem(NAME_KEY);
  } catch (e) { /* session-only name */ }
}
$playerName?.addEventListener('change', captureName);

// ---- Mode selector (title card) ----
// D13: no saved preference defaults to Just Cruisin' — a returning player's
// habitual Start tap must never land them in a mode that can end their run.
const $modeCruisin = document.getElementById('mode-cruisin');
const $modeFestival = document.getElementById('mode-festival');
function reflectMode() {
  const fest = RunMode.isFestival();
  $modeCruisin?.setAttribute('aria-checked', String(!fest));
  $modeFestival?.setAttribute('aria-checked', String(fest));
}
RunMode.loadSaved();
reflectMode();
$modeCruisin?.addEventListener('click', () => { RunMode.set(MODE_CRUISIN); reflectMode(); });
$modeFestival?.addEventListener('click', () => { RunMode.set(MODE_FESTIVAL); reflectMode(); });

// ---- Title-card page swap: main menu ⇄ the How-to-play screen ----
// One card frame, two screens (console-menu style). Focus follows the swap so
// keyboard/AT users land on Back going in and back on the opener coming out;
// Escape mirrors the Back button.
const $pageMain = document.getElementById('title-page-main');
const $pageHowto = document.getElementById('title-page-howto');
const $howtoOpen = document.getElementById('howto-open');
const $howtoBack = document.getElementById('howto-back');
function showHowto(open) {
  if (!$pageMain || !$pageHowto) return;
  $pageMain.hidden = open;
  $pageHowto.hidden = !open;
  $howtoOpen?.setAttribute('aria-expanded', String(open));
  (open ? $howtoBack : $howtoOpen)?.focus({ preventScroll: true });
}
$howtoOpen?.addEventListener('click', () => showHowto(true));
$howtoBack?.addEventListener('click', () => showHowto(false));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $pageHowto && !$pageHowto.hidden) showHowto(false);
});

// ---- Score screen (Festival Run results + the local top-10 board) ----
const $scoreScreen = document.getElementById('score-screen');
const $scoreCause = document.getElementById('score-cause');
const $scoreStats = document.getElementById('score-stats');
const $scoreFinal = document.getElementById('score-final');
const $scoreDays = document.getElementById('score-days');
const $scoreCombo = document.getElementById('score-combo');
const $localBoardBody = document.querySelector('#local-board tbody');
const $boardEmpty = document.getElementById('board-empty');
const $scoreAgain = document.getElementById('score-again');
const $scoreClose = document.getElementById('score-close');
const $boardOpenTitle = document.getElementById('board-open-title');

let _onScoreAgain = null;
let _onScoreClose = null;

// ---- Combo chip state (dirty flags) ----
const $comboChip = document.getElementById('combo-chip');
const $comboMult = document.getElementById('combo-mult');
const $comboRingFill = document.getElementById('combo-ring-fill');
const $comboHeart = document.getElementById('combo-heart');
let _comboVisible = false;
let _comboMult = 1;
let _comboFrac = 0;
let _comboHeart = false;

// ---- Festival Run stakes chips ----
const $dayN = document.getElementById('day-n');
const $sputterCount = document.getElementById('sputter-count');
const $vibeChip = document.getElementById('vibe-chip');
const $vibeFill = document.getElementById('vibe-fill');
let _dayN = null;
let _sputterSec = null;
let _vibeActive = false;
let _vibeFrac = -1;
let _vibeWarn = false;

function renderBoard(board, highlightRank) {
  if (!$localBoardBody) return;
  $localBoardBody.textContent = '';
  $boardEmpty?.classList.toggle('hidden', board.length > 0);
  board.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i + 1 === highlightRank) tr.className = 'you';
    const cells = [
      ['rank', `${i + 1}.`],
      ['bname', entry.name || FALLBACK_NAME],   // names are player text — textContent only
      ['bscore', String(entry.score)],
      ['bdays', `day ${entry.days}`],
    ];
    for (const [cls, text] of cells) {
      const td = document.createElement('td');
      td.className = cls;
      td.textContent = text;
      tr.appendChild(td);
    }
    $localBoardBody.appendChild(tr);
  });
}

// ---- Score-screen board tabs (global board; hidden while it's disabled) ----
// Local renders synchronously from the last shown board; the global tabs fetch
// timeboxed and fall back to the local rows SILENTLY on any failure (spec:
// the Worker being down is invisible).
const $boardTabs = document.getElementById('board-tabs');
let _lastBoard = [];
let _lastHighlight = 0;
let _boardFetchSeq = 0;

function setBoardTab(which) {
  $boardTabs?.querySelectorAll('.board-tab').forEach((b) => {
    const on = b.id === `board-tab-${which}`;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

async function showBoardRange(range) {
  const seq = ++_boardFetchSeq;
  setBoardTab(range === 'daily' ? 'daily' : range === 'all' ? 'all' : 'local');
  if (range === 'local') { renderBoard(_lastBoard, _lastHighlight); return; }
  const entries = await Leaderboard.fetchGlobal(range);
  if (seq !== _boardFetchSeq) return;               // a newer tab click won
  if (!entries) { setBoardTab('local'); renderBoard(_lastBoard, _lastHighlight); return; }
  renderBoard(entries.slice(0, 10), 0);
}

document.getElementById('board-tab-local')?.addEventListener('click', () => showBoardRange('local'));
document.getElementById('board-tab-daily')?.addEventListener('click', () => showBoardRange('daily'));
document.getElementById('board-tab-all')?.addEventListener('click', () => showBoardRange('all'));

$scoreClose?.addEventListener('click', () => {
  HUD.hideScoreScreen();
  if (_onScoreClose) _onScoreClose();
});
$scoreAgain?.addEventListener('click', () => {
  HUD.hideScoreScreen();
  if (_onScoreAgain) _onScoreAgain();
});
$boardOpenTitle?.addEventListener('click', () => {
  HUD.showScoreScreen({ viewOnly: true, board: Leaderboard.localTop() });
});

function formatBest(n) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(n < 2000 ? 1 : 0)}k`;
  if (n < 1000000) return `${Math.floor(n / 1000)}k`;
  return `${(n / 1000000).toFixed(n < 2000000 ? 1 : 0)}m`;
}

function clearToastTap() {
  if (toastTapHandler) {
    $toast.removeEventListener('click', toastTapHandler);
    $toast.removeEventListener('touchend', toastTapHandler);
    toastTapHandler = null;
  }
  $toast.classList.remove('tappable');
}

export const HUD = {
  showTitle() {
    $title.classList.remove('hidden');
  },

  hideTitle() {
    $title.classList.add('hidden');
  },

  onStart(cb) {
    // captureName is synchronous — the iOS audio unlock in cb must stay inside
    // the same gesture with no async hop before Sound.init().
    $start.addEventListener('click', () => { captureName(); cb(); }, { once: true });
    window.__zerbleBootLoader?.ready();
    $start.textContent = _startLabel;
    $start.disabled = false;
    $start.setAttribute('aria-disabled', 'false');
    $start.setAttribute('aria-busy', 'false');
    $start.classList.add('is-ready');
    const settings = document.getElementById('settings-open-title');
    if (settings) settings.disabled = false;
  },

  // Mode selector re-sync (used after a resume snapshot restores the mode).
  refreshMode() { reflectMode(); },

  // Combo badge — dirty-flagged like every other HUD write. Hidden entirely
  // outside Festival Run (`stakes` false). `frac` is the chain window 0..1.
  setCombo(mult, frac, heart, stakes) {
    if (!$comboChip) return;
    if (stakes !== _comboVisible) {
      _comboVisible = stakes;
      $comboChip.classList.toggle('hidden', !stakes);
    }
    if (!stakes) return;
    const m = Math.max(1, Math.floor(mult));
    if (m !== _comboMult) {
      _comboMult = m;
      if ($comboMult) $comboMult.textContent = `×${m}`;
      $comboChip.classList.toggle('combo-hot', m >= 4);
      $comboChip.setAttribute('aria-label', `Combo ×${m}${heart ? ', Lurleen doubling' : ''}`);
    }
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - _comboFrac) >= 0.01) {
      _comboFrac = f;
      if ($comboRingFill) $comboRingFill.style.strokeDashoffset = String(81.68 * (1 - f));
    }
    const h = !!heart;
    if (h !== _comboHeart) {
      _comboHeart = h;
      $comboHeart?.classList.toggle('hidden', !h);
    }
  },

  // Festival Run day counter on the cycle chip. null = hide (Cruisin').
  setDay(n) {
    if (!$dayN) return;
    const v = n == null ? null : Math.max(1, Math.floor(n));
    if (v === _dayN) return;
    _dayN = v;
    $dayN.classList.toggle('hidden', v == null);
    if (v != null) $dayN.textContent = `Day ${v}`;
  },

  // Sputter grace countdown inside the juice chip. null = hide.
  setSputter(sec) {
    if (!$sputterCount) return;
    const v = sec == null ? null : Math.max(0, Math.ceil(sec));
    if (v === _sputterSec) return;
    _sputterSec = v;
    $sputterCount.classList.toggle('hidden', v == null);
    if (v != null) $sputterCount.textContent = `${v}s`;
  },

  // Persistent vibe meter (Festival Run only — council D15: a death path is
  // never invisible). frac 0..1 of the ejection limit; warn pulses the chip.
  setVibe(frac, active, warn = false) {
    if (!$vibeChip) return;
    if (active !== _vibeActive) {
      _vibeActive = active;
      $vibeChip.classList.toggle('hidden', !active);
    }
    if (!active) {
      // Deactivation must also drop the warn pulse, or its animation keeps
      // running on the hidden chip under the score screen.
      if (_vibeWarn) {
        _vibeWarn = false;
        $vibeChip.classList.remove('vibe-warn');
      }
      return;
    }
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - _vibeFrac) >= 0.01) {
      _vibeFrac = f;
      // Width, not scaleX: the fill's green→pink ramp is pinned to the track
      // width (background-size in CSS), so a low meter shows only the green
      // end instead of squashing the whole ramp — pink means actually high.
      if ($vibeFill) $vibeFill.style.width = `${f * 100}%`;
      // The whistle icon tints with the level (calm → tense → hot), same
      // thresholds the old emoji face used.
      $vibeChip.classList.toggle('vibe-hot', f >= 0.75);
      $vibeChip.classList.toggle('vibe-tense', f >= 0.4 && f < 0.75);
      $vibeChip.setAttribute('aria-label',
        f >= 0.75 ? 'Festival vibe: the marshals are watching' :
        f >= 0.4 ? 'Festival vibe: getting tense' : 'Festival vibe: all good');
    }
    if (warn !== _vibeWarn) {
      _vibeWarn = warn;
      $vibeChip.classList.toggle('vibe-warn', warn);
    }
  },

  // Score screen. viewOnly (the title-card "Local legends" peek) hides the
  // run stats + the "again" action and just shows the board.
  showScoreScreen({ cause = '', score = 0, days = 1, bestCombo = 1,
                    board = [], highlightRank = 0, viewOnly = false } = {}) {
    if (!$scoreScreen) return;
    if ($scoreCause) $scoreCause.textContent = viewOnly ? 'Local legends' : (cause || 'The festival rolls on…');
    $scoreStats?.classList.toggle('hidden', viewOnly);
    $scoreAgain?.classList.toggle('hidden', viewOnly);
    // viewOnly's h2 already says "Local legends" — drop the duplicate table title.
    document.querySelector('#score-screen .board-title')?.classList.toggle('hidden', viewOnly);
    if (!viewOnly) {
      if ($scoreFinal) $scoreFinal.textContent = String(Math.floor(score));
      if ($scoreDays) $scoreDays.textContent = String(Math.max(1, Math.floor(days)));
      if ($scoreCombo) $scoreCombo.textContent = `×${Math.max(1, Math.floor(bestCombo))}`;
    }
    _lastBoard = board;
    _lastHighlight = viewOnly ? 0 : highlightRank;
    setBoardTab('local');
    $boardTabs?.classList.toggle('hidden', !Leaderboard.globalEnabled());
    renderBoard(board, _lastHighlight);
    $scoreScreen.classList.remove('hidden');
  },

  hideScoreScreen() { $scoreScreen?.classList.add('hidden'); },

  onScoreAgain(cb) { _onScoreAgain = cb; },
  onScoreClose(cb) { _onScoreClose = cb; },

  getPlayerName() { return _playerName; },

  // Toast spice: given the everyday line and a "{name}"-bearing variant, swap
  // the named one in occasionally (sprinkle, don't saturate — see ROADMAP).
  // Nameless players always get the plain line.
  withName(nameless, named, chance = 0.25) {
    if (_playerName && named && Math.random() < chance) {
      return named.replace(/\{name\}/g, _playerName);
    }
    return nameless;
  },

  setStartLabel(label) {
    _startLabel = String(label || "Let's go ZERBLIN'!");
    if (!$start.disabled) $start.textContent = _startLabel;
  },

  setSmiles(n) {
    const next = Math.floor(n);
    const increased = next > _smileN;
    _smileN = next;
    $smiles.textContent = String(_smileN);
    $smileStatus?.setAttribute('aria-label', `${_smileN} smiles, personal best ${_bestN}`);
    if (increased) {
      $smiles.classList.remove('smile-pulse');
      void $smiles.offsetWidth;
      $smiles.classList.add('smile-pulse');
      clearTimeout(_smilePulseTimer);
      _smilePulseTimer = setTimeout(() => $smiles.classList.remove('smile-pulse'), 420);
    }
  },

  // Bubble-juice gauge. `total` is in meters (unbounded — gather as many jugs
  // as you like). The bar shows the working meter (min(1, total)); spare whole
  // meters show as a "N× jug" count to the right (no cap, unlike the old pips).
  // Below 0.45 (and no reserve) → amber low; ~empty → red pulsing. Called every
  // frame — guards against redundant DOM writes.
  setJuice(total) {
    const t = Math.max(0, total || 0);
    const bar = Math.min(1, t);
    if (Math.abs(bar - _juiceBar) >= 0.002) {
      _juiceBar = bar;
      if ($juiceFill) $juiceFill.style.transform = `scaleX(${bar})`;
    }

    const state = t <= 0.02 ? 'empty' : (t < 0.45 ? 'low' : '');
    if (state !== _juiceState) {
      _juiceState = state;
      if ($juiceMeter) {
        $juiceMeter.classList.toggle('low', state === 'low');
        $juiceMeter.classList.toggle('empty', state === 'empty');
      }
    }

    // Reserve = whole spare meters beyond the working one. No cap now — the
    // count just keeps climbing as you stockpile jugs.
    const reserves = Math.max(0, Math.floor(t) - 1);
    if (reserves !== _juiceReserveN) {
      _juiceReserveN = reserves;
      if ($juiceReserve) {
        $juiceReserve.classList.toggle('has-reserve', reserves > 0);
        $juiceReserve.setAttribute('aria-hidden', reserves > 0 ? 'false' : 'true');
        $juiceReserve.setAttribute('aria-label',
          reserves > 0 ? `${reserves} reserve bubble-juice jug${reserves === 1 ? '' : 's'}` : '');
        if ($juiceReserveN) $juiceReserveN.textContent = `${reserves}×`;
      }
    }
    if ($juiceMeter) {
      const percent = Math.round(bar * 100);
      const reserveText = reserves > 0 ? `, ${reserves} reserve jug${reserves === 1 ? '' : 's'}` : '';
      const label = `Bubble juice ${percent}%${reserveText}`;
      if (label !== _juiceAria) {
        _juiceAria = label;
        $juiceMeter.setAttribute('aria-label', label);
      }
    }
  },

  setTimeOfDay(t, nightness = 0) {
    if (!$cycleStatus || !Number.isFinite(t)) return;
    const normalized = ((t % 1) + 1) % 1;
    const step = Math.floor(normalized * 500);
    const cycleChanged = step !== _cycleStep;
    if (cycleChanged) {
      _cycleStep = step;
      $cycleStatus.style.setProperty('--cycle-turn', `${normalized}turn`);
    }

    let phase;
    if (normalized < 0.07) phase = 'Dawn';
    else if (normalized < 0.22) phase = 'Morning';
    else if (normalized < 0.43) phase = 'Afternoon';
    else if (normalized < 0.55) phase = 'Dusk';
    else if (normalized < 0.78) phase = 'Evening';
    else if (normalized < 0.95) phase = 'Late night';
    else phase = 'Dawn';

    const phaseChanged = phase !== _cyclePhase;
    if (phaseChanged) {
      _cyclePhase = phase;
    }
    const isNight = nightness > 0.55;
    if (isNight !== _cycleNight) {
      _cycleNight = isNight;
      $cycleStatus.classList.toggle('is-night', isNight);
      if ($cycleSymbol) $cycleSymbol.textContent = isNight ? '☾' : '☀';
    }
    if (cycleChanged || phaseChanged) {
      $cycleStatus.setAttribute('aria-label', `${phase}, ${Math.round(normalized * 100)}% through the day cycle`);
      $cycleStatus.title = phase;
    }
  },

  setLurleenFollowing(visible) {
    const next = !!visible;
    if (!$lurleenStatus || next === _lurleenVisible) return;
    _lurleenVisible = next;
    $lurleenStatus.classList.toggle('visible', next);
    $lurleenStatus.setAttribute('aria-hidden', next ? 'false' : 'true');
  },

  loadBest() {
    const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    _bestN = v || 0;
    $best.textContent = formatBest(_bestN);
    $smileStatus?.setAttribute('aria-label', `${_smileN} smiles, personal best ${_bestN}`);
    return _bestN;
  },

  saveBest(n) {
    const cur = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (n > cur) {
      localStorage.setItem(BEST_KEY, String(Math.floor(n)));
      _bestN = Math.floor(n);
      $best.textContent = formatBest(_bestN);
      $smileStatus?.setAttribute('aria-label', `${_smileN} smiles, personal best ${_bestN}`);
      if (!_bestCelebrated) {
        _bestCelebrated = true;
        $bestConfetti?.classList.add('on');
        $bestScore?.classList.add('best-beaten');
        clearTimeout(_bestCelebrationTimer);
        _bestCelebrationTimer = setTimeout(() => {
          $bestConfetti?.classList.remove('on');
          $bestScore?.classList.remove('best-beaten');
        }, 1050);
      }
      return true;
    }
    return false;
  },

  // toast(msg, ms, { onTap }) — when onTap is provided, the toast becomes a
  // single-shot button. First click/touchend fires onTap and clears the
  // listener; the toast also clears on its own when ms elapses or when any
  // subsequent toast() call replaces it.
  toast(msg, ms = 1600, opts = {}) {
    clearToastTap();
    $toast.textContent = msg;
    $toast.classList.remove('hidden');
    $toast.classList.add('show');
    if (typeof opts.onTap === 'function') {
      $toast.classList.add('tappable');
      const cb = opts.onTap;
      toastTapHandler = (e) => {
        // touchend fires before the synthesized click — handle once and bail.
        e.preventDefault();
        const fn = cb;
        clearToastTap();
        fn();
      };
      $toast.addEventListener('click', toastTapHandler);
      $toast.addEventListener('touchend', toastTapHandler, { passive: false });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $toast.classList.remove('show');
      clearToastTap();
    }, ms);
  },

  flashHit() {
    $flash.classList.add('on');
    setTimeout(() => $flash.classList.remove('on'), 180);
  },

  // Warm-gold edge vignette while star power is active. Pure CSS — zero
  // three.js cost.
  setStarPower(on) {
    if ($starVignette) $starVignette.classList.toggle('on', !!on);
  },
};
