// Lightweight HUD bindings. Pure DOM, no framework.

import { Leaderboard, FALLBACK_NAME } from './leaderboard.js';

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

$scoreClose?.addEventListener('click', () => HUD.hideScoreScreen());
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
    renderBoard(board, viewOnly ? 0 : highlightRank);
    $scoreScreen.classList.remove('hidden');
  },

  hideScoreScreen() { $scoreScreen?.classList.add('hidden'); },

  onScoreAgain(cb) { _onScoreAgain = cb; },

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
