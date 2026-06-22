// Accessibility preferences — reduced motion + colorblind-friendly cues.
// Read live (so a Settings toggle applies without a reload) and mirrored onto
// `<body>` classes so CSS-only effects can opt out too.
//
//   reducedMotion — damps motion/flash that can trigger discomfort: the
//     star-power end strobe (starPower.js), the wook trip warp intensity
//     (trip.js), and the pulsing CSS overlays (star vignette, empty-juice
//     meter, tappable toast). Defaults to the OS `prefers-reduced-motion`
//     setting until the player makes an explicit choice.
//   colorblind — adds a non-colour tell to cues that otherwise lean on
//     red/green: the lost-smile orb gets a shape marker (smiles.js).

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

const state = { reducedMotion: false, colorblind: false };

export const A11y = {
  // Resolve persisted prefs (reducedMotion falls back to the OS setting) and
  // apply the body classes. Call once at boot, before gameplay systems read it.
  init() {
    const rm = lsGet('zerble.a11y.reducedMotion');
    state.reducedMotion = rm === null
      ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
      : rm === '1';
    state.colorblind = lsGet('zerble.a11y.colorblind') === '1';
    this._apply();
  },

  get reducedMotion() { return state.reducedMotion; },
  get colorblind() { return state.colorblind; },

  setReducedMotion(on) {
    state.reducedMotion = !!on;
    lsSet('zerble.a11y.reducedMotion', on ? '1' : '0');
    this._apply();
  },
  setColorblind(on) {
    state.colorblind = !!on;
    lsSet('zerble.a11y.colorblind', on ? '1' : '0');
    this._apply();
  },

  _apply() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.classList.toggle('reduced-motion', state.reducedMotion);
    document.body.classList.toggle('colorblind', state.colorblind);
  },
};
