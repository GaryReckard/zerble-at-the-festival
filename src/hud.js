// Lightweight HUD bindings. Pure DOM, no framework.

const $smiles = document.getElementById('smiles');
const $best = document.getElementById('best');
const $toast = document.getElementById('toast');
const $flash = document.getElementById('hit-flash');
const $title = document.getElementById('title-card');
const $start = document.getElementById('start-btn');
const $juiceMeter = document.getElementById('juice-meter');
const $juiceFill = document.getElementById('juice-fill');
const $juiceReserve = document.getElementById('juice-reserve');

let _juiceState = '';     // '', 'low', or 'empty'
let _juiceReserveN = -1;

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

  // Bubble-juice gauge. `total` is in meters (0..JUICE_STACK_MAX). The bar
  // shows the working meter (min(1, total)); spare whole meters above ~2 show
  // as reserve pips. Below 0.45 (and no reserve) → amber low; ~empty → red
  // pulsing. Called every frame — guards against redundant DOM writes.
  setJuice(total) {
    const t = Math.max(0, total || 0);
    const bar = Math.min(1, t);
    if ($juiceFill) $juiceFill.style.transform = `scaleX(${bar})`;

    const state = t <= 0.02 ? 'empty' : (t < 0.45 ? 'low' : '');
    if (state !== _juiceState) {
      _juiceState = state;
      if ($juiceMeter) {
        $juiceMeter.classList.toggle('low', state === 'low');
        $juiceMeter.classList.toggle('empty', state === 'empty');
      }
    }

    const reserves = Math.max(0, Math.min(3, Math.floor(t) - 1));
    if (reserves !== _juiceReserveN) {
      _juiceReserveN = reserves;
      if ($juiceReserve) {
        $juiceReserve.innerHTML = '';
        for (let i = 0; i < reserves; i++) {
          const pip = document.createElement('span');
          pip.className = 'pip';
          $juiceReserve.appendChild(pip);
        }
      }
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
