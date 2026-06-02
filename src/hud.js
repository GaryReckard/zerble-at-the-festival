// Lightweight HUD bindings. Pure DOM, no framework.

const $smiles = document.getElementById('smiles');
const $best = document.getElementById('best');
const $toast = document.getElementById('toast');
const $flash = document.getElementById('hit-flash');
const $title = document.getElementById('title-card');
const $start = document.getElementById('start-btn');
const $juiceMeter = document.getElementById('juice-meter');
const $juiceFill = document.getElementById('juice-fill');

let _juiceLow = false;

let toastTimer = 0;
let toastTapHandler = null;   // currently-attached tap listener for tappable toasts

const BEST_KEY = 'zerble-best-smiles';

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
    $start.addEventListener('click', cb, { once: true });
  },

  setSmiles(n) {
    $smiles.textContent = String(Math.floor(n));
  },

  // Bubble-juice gauge. frac 0..1. Scales the fill and flips a low-juice
  // warning state below 22%. Called every frame from the main loop — guards
  // against redundant class writes so it stays cheap.
  setJuice(frac) {
    const f = Math.max(0, Math.min(1, frac || 0));
    if ($juiceFill) $juiceFill.style.transform = `scaleX(${f})`;
    const low = f < 0.22;
    if (low !== _juiceLow) {
      _juiceLow = low;
      if ($juiceMeter) $juiceMeter.classList.toggle('low', low);
    }
  },

  loadBest() {
    const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    $best.textContent = String(v || 0);
    return v || 0;
  },

  saveBest(n) {
    const cur = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    if (n > cur) {
      localStorage.setItem(BEST_KEY, String(Math.floor(n)));
      $best.textContent = String(Math.floor(n));
    }
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
};
