// Player-facing Settings panel — a tabbed DOM overlay (no three.js cost) opened
// by the title-card "Settings" link or the in-game gear.
//
// Tabs:
//   Performance — graphics quality tier (SEOMatic-style override, reload to
//     apply) + per-effect tri-state controls (Off / Auto / On) for the effects
//     the adaptive-quality governor manages live (Glow, Detailed bubbles) +
//     Advanced reload toggles (Shadows, extra lights).
//   Sound        — Master / Music / SFX, wired to the existing Sound buses.
//   Accessibility — reduced motion + colorblind cues (via the A11y module).
//
// The per-effect tri-state is the key model: "Auto" hands the effect to the
// governor; "Off"/"On" pin it so the governor leaves THAT effect alone while
// still managing pixel ratio + anything left on Auto to defend the frame rate.
// The governor never fully stops. (AdaptiveQuality.setOverride / bloomAllowed /
// effectiveCheap implement the per-effect respect.)
//
// Control kinds by how they apply:
//   * Live, instant — quality mode tri-states (Glow, Detailed bubbles), volumes,
//     accessibility toggles.
//   * Reload to apply — the quality tier, Shadows, extra lights (PERF is baked
//     at boot). These persist immediately; the shared "Apply & restart" button
//     reloads when any differs from what booted — and preserves the live session
//     (seed/position/score/juice) across the reload via captureState.

import { PERF, DETECTED_TIER } from './perf.js';
import * as AdaptiveQuality from './adaptiveQuality.js';
import { Sound } from './sound.js';
import { A11y } from './a11y.js';
import { Leaderboard } from './leaderboard.js';

const K = {
  tier: 'zerble.perfOverride',
  bloom: 'zerble.gfx.bloom',                 // 'on' | 'off' | absent(=Auto)
  detailBubbles: 'zerble.gfx.detailBubbles', // 'on' | 'off' | absent(=Auto)
  shadows: 'zerble.gfx.shadows',             // '1' | '0' | absent  (on/off, reload)
  context: 'zerble.contextLights',
  fancy: 'zerble.fancyLights',
};

const TIER_LABEL = { low: 'Low', mid: 'Medium', high: 'High' };
const TIER_RANK = { low: 1, mid: 2, high: 3 };
const VOL_MAX = { master: 1.0, music: 1.6, sfx: 1.5 };

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

let refs = null;       // { bubbles, captureState }
let bootSnap = null;   // reload-required settings as they booted
let $overlay = null;

export const Settings = {
  init(opts) {
    refs = opts || {};
    this.applyBootOverrides();
    bootSnap = {
      tier: lsGet(K.tier) || 'auto',
      context: !!PERF.contextLights,
      fancy: !!PERF.fancyLights,
    };
    this._build();
    this._wire();
  },

  // Re-apply the persisted LIVE per-effect overrides at boot. The reload-required
  // ones (tier, shadows, lights) are already baked by perf.js reading localStorage.
  applyBootOverrides() {
    const b = lsGet(K.bloom);
    if (b === 'on' || b === 'off') AdaptiveQuality.setOverride('bloom', b === 'on');
    const db = lsGet(K.detailBubbles);
    if (db === 'on' || db === 'off') {
      AdaptiveQuality.setOverride('bubbles', db === 'on');
      refs.bubbles?.setCheapMaterial?.(AdaptiveQuality.currentCheap());
    }
    const sh = lsGet(K.shadows);
    if (sh === 'on' || sh === 'off') AdaptiveQuality.setOverride('shadows', sh === 'on');
  },

  open() { if ($overlay) { this._sync(); this._refreshDiagnostics(); $overlay.classList.remove('hidden'); } },
  close() { if ($overlay) $overlay.classList.add('hidden'); },

  _build() {
    const gear = document.createElement('button');
    gear.id = 'settings-gear';
    gear.setAttribute('aria-label', 'Open settings');
    gear.innerHTML = GEAR_SVG;
    document.body.appendChild(gear);

    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
      <div class="settings-backdrop"></div>
      <div class="settings-card" role="dialog" aria-modal="true" aria-label="Settings">
        <button class="settings-close" aria-label="Close settings">&times;</button>
        <div class="settings-accent"></div>
        <h2 class="settings-title">Settings</h2>

        <div class="settings-tabs" role="tablist">
          <button class="settings-tab-btn active" data-tab="performance" role="tab">Performance</button>
          <button class="settings-tab-btn" data-tab="sound" role="tab">Sound</button>
          <button class="settings-tab-btn" data-tab="accessibility" role="tab">Accessibility</button>
          <button class="settings-tab-btn" data-tab="howto" role="tab">How to play</button>
        </div>

        <div class="settings-tab" data-tab="performance" role="tabpanel">
          <div class="settings-cols">
            <div class="settings-col">
              <div class="settings-section">
                <div class="settings-section-label">Graphics quality <span class="settings-reload-note">reload to apply</span></div>
                <div id="set-quality" role="radiogroup" aria-label="Graphics quality">
                  ${tierRow('auto', 'Auto')}
                  ${tierRow('low', 'Low')}
                  ${tierRow('mid', 'Medium')}
                  ${tierRow('high', 'High')}
                </div>
              </div>
            </div>
            <div class="settings-col">
              <div class="settings-section">
                <div class="settings-section-label">Effects</div>
                <p class="settings-hint">Auto lets the game ease these down to stay smooth. Pin Off or On to take control.</p>
                ${triRow('set-glow', 'Glow', 'soft light bloom at night')}
                ${triRow('set-bubbles', 'Detailed bubbles', 'shinier, costlier bubbles')}
                ${triRow('set-shadows', 'Shadows', 'cast shadows on the ground')}
              </div>
              <div class="settings-section">
                <div class="settings-section-label">Extra lights <span class="settings-reload-note">reload to apply</span></div>
                ${toggleRow('set-context', 'Warm extra lights', 'firepits &amp; lamps glow for real')}
                ${toggleRow('set-fancy', 'Extra detail lights', 'every torch &amp; bulb — heaviest')}
              </div>
            </div>
          </div>
        </div>

        <div class="settings-tab is-hidden" data-tab="sound" role="tabpanel">
          <div class="settings-section">
            ${sliderRow('set-vol-master', 'Master')}
            ${sliderRow('set-vol-music', 'Music')}
            ${sliderRow('set-vol-sfx', 'Sound effects')}
          </div>
        </div>

        <div class="settings-tab is-hidden" data-tab="accessibility" role="tabpanel">
          <div class="settings-section">
            ${toggleRow('set-reduced-motion', 'Reduced motion', 'calm the strobes, warp &amp; pulses')}
            ${toggleRow('set-colorblind', 'Colorblind-friendly cues', 'mark a lost smile by shape, not just colour')}
          </div>
        </div>

        <div class="settings-tab settings-howto is-hidden" data-tab="howto" role="tabpanel"></div>

        <details class="settings-diagnostics" id="set-board-diagnostics">
          <summary>Leaderboard diagnostics</summary>
          <p class="settings-hint" id="set-board-help">A local-only log of the last 100 leaderboard events, with no player name or run token. Refresh reads this device's log without contacting the leaderboard. Clear removes the log, not your scores.</p>
          <p class="settings-diagnostics-summary" id="set-board-summary"></p>
          <div class="settings-diagnostics-actions">
            <button type="button" class="settings-trigger" id="set-board-refresh">Refresh</button>
            <button type="button" class="settings-trigger" id="set-board-copy">Copy</button>
            <button type="button" class="settings-trigger" id="set-board-clear">Clear</button>
          </div>
          <label for="set-board-log">Diagnostic report (JSON)</label>
          <textarea id="set-board-log" readonly rows="8" spellcheck="false" aria-describedby="set-board-help"></textarea>
          <p class="settings-diagnostics-status" id="set-board-status" role="status" aria-live="polite" aria-atomic="true"></p>
        </details>

        <div class="settings-restart is-hidden">
          <span class="settings-restart-text">A couple of these need a quick restart — you'll pick up right where you left off.</span>
          <button class="settings-apply">Restart now</button>
        </div>
      </div>`;
    // The "How to play" tab CLONES the title card's instructions page (minus
    // its header/back button) — one source of truth for the controls lists and
    // the juice/vendor hints, readable mid-game without a reload. The global
    // .controls-kbd/.controls-touch CSS swap applies to the clones too, so the
    // right list shows for the device.
    const howtoSrc = document.getElementById('title-page-howto');
    const howtoPane = overlay.querySelector('.settings-tab[data-tab="howto"]');
    if (howtoSrc && howtoPane) {
      for (const el of howtoSrc.querySelectorAll('.controls, .hint')) {
        howtoPane.appendChild(el.cloneNode(true));
      }
    }
    document.body.appendChild(overlay);
    $overlay = overlay;
  },

  _wire() {
    const $ = (s) => $overlay.querySelector(s);
    // Keep native pane/textarea scrolling out of the window-level camera zoom.
    $overlay.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    const gear = document.getElementById('settings-gear');
    const titleTrigger = document.getElementById('settings-open-title');
    if (gear) gear.addEventListener('click', () => this.open());
    if (titleTrigger) titleTrigger.addEventListener('click', () => this.open());
    document.getElementById('settings-open-score')?.addEventListener('click', () => {
      this.open();
      $('#set-board-diagnostics').open = true;
      $('#set-board-diagnostics summary').focus();
      $('#set-board-diagnostics').scrollIntoView({ block: 'start' });
    });
    $('.settings-close').addEventListener('click', () => this.close());
    $('.settings-backdrop').addEventListener('click', () => this.close());

    $('#set-board-diagnostics').addEventListener('toggle', () => {
      if ($('#set-board-diagnostics').open) this._refreshDiagnostics();
    });
    $('#set-board-refresh').addEventListener('click', () => this._refreshDiagnostics());
    $('#set-board-clear').addEventListener('click', () => {
      Leaderboard.clearDiagnostics();
      this._refreshDiagnostics();
      $('#set-board-status').textContent = 'Diagnostic history cleared; scores are unchanged.';
    });
    $('#set-board-copy').addEventListener('click', async () => {
      const button = $('#set-board-copy');
      const log = $('#set-board-log');
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(log.value);
        $('#set-board-status').textContent = 'Diagnostic report copied.';
      } catch {
        log.focus();
        log.select();
        log.setSelectionRange(0, log.value.length);
        $('#set-board-status').textContent = 'Automatic copy was unavailable. The report is selected; use Copy from your device menu or press Ctrl+C / Cmd+C.';
      } finally {
        button.disabled = false;
      }
    });

    // --- Tabs ---
    $('.settings-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-tab-btn');
      if (btn) this._setTab(btn.dataset.tab);
    });

    // --- Graphics quality (reload) ---
    $('#set-quality').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'auto') lsDel(K.tier); else lsSet(K.tier, v);
      this._refreshApply();
    });

    // --- Glow tri-state (live, via the bloom-allow flag main.js honors) ---
    bindTri($('#set-glow'), (v) => {
      AdaptiveQuality.setOverride('bloom', v === 'auto' ? null : v === 'on');
      if (v === 'auto') lsDel(K.bloom); else lsSet(K.bloom, v);
    });

    // --- Detailed bubbles tri-state (live material swap) ---
    bindTri($('#set-bubbles'), (v) => {
      AdaptiveQuality.setOverride('bubbles', v === 'auto' ? null : v === 'on');
      const cheap = AdaptiveQuality.currentCheap();
      refs.bubbles?.setCheapMaterial?.(cheap);
      if (v === 'auto') lsDel(K.detailBubbles); else lsSet(K.detailBubbles, v);
    });

    // --- Shadows tri-state. LIVE on a tier that already has the shadow
    //     machinery (PERF.shadows) — the governor pin adds/removes them with no
    //     reload. On the low tier (no machinery) PERF.shadows is false, so the
    //     live apply is skipped and the choice applies on the next boot (perf.js
    //     forces the machinery on); _refreshApply surfaces that restart. ---
    bindTri($('#set-shadows'), (v) => {
      if (v === 'auto') lsDel(K.shadows); else lsSet(K.shadows, v);
      if (PERF.shadows) AdaptiveQuality.setOverride('shadows', v === 'auto' ? null : v === 'on');
      this._refreshApply();
    });

    // --- Extra lights (reload boot flags) ---
    $('#set-context').addEventListener('change', (e) => {
      lsSet(K.context, e.target.checked ? '1' : '0');
      this._refreshApply();
    });
    $('#set-fancy').addEventListener('change', (e) => {
      lsSet(K.fancy, e.target.checked ? '1' : '0');
      this._refreshApply();
    });

    // --- Volume (live, Sound persists itself) ---
    bindSlider($('#set-vol-master'), 'master', (v) => Sound.setMasterVolume(v));
    bindSlider($('#set-vol-music'), 'music', (v) => Sound.setMusicVolume(v));
    bindSlider($('#set-vol-sfx'), 'sfx', (v) => Sound.setSfxVolume(v));

    // --- Accessibility (live) ---
    $('#set-reduced-motion').addEventListener('change', (e) => A11y.setReducedMotion(e.target.checked));
    $('#set-colorblind').addEventListener('change', (e) => A11y.setColorblind(e.target.checked));

    // --- Restart (only shown when a reload-required change is pending; preserves
    //     the live session across the reload) ---
    $('.settings-apply').addEventListener('click', () => {
      const snap = refs.captureState?.();
      if (snap) { try { sessionStorage.setItem('zerble.resume', JSON.stringify(snap)); } catch (e) {} }
      location.reload();
    });
  },

  _setTab(name) {
    $overlay.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    $overlay.querySelectorAll('.settings-tab').forEach((p) => p.classList.toggle('is-hidden', p.dataset.tab !== name));
  },

  _refreshDiagnostics() {
    const report = Leaderboard.diagnostics();
    const events = report.events.slice().reverse();
    const game = events.find((e) => e?.event === 'game_started');
    const submission = events.find((e) =>
      (e?.event === 'request_finished' || e?.event === 'request_failed') &&
      (e.path === '/run/start' || e.path === '/run/beat' || e.path === '/run/end'));
    let summary = 'No game start in the retained history.';
    if (game) {
      const mode = game.mode === 'festival' ? 'Festival Run' : "Just Cruisin'";
      summary = `Latest game: ${mode}${game.resumed ? ' (resumed)' : ''}. ` +
        (game.submitsScores ? 'Global score submissions enabled.' : 'This game does not submit global scores.');
    }
    if (submission) {
      const outcomes = {
        started: 'Run record created',
        boards_written: 'Both leaderboard writes completed (not a retention guarantee)',
        run_persisted: 'Run saved; no leaderboard write confirmed',
        acknowledged_unverified: 'Request acknowledged; leaderboard write not verified',
        skipped_cadence: 'Update skipped because it arrived too soon',
        skipped_no_change: 'Update skipped because the score did not change',
        quarantined: 'Score held for review, not added to the leaderboard',
        rejected: 'Submission rejected',
        storage_error: 'Leaderboard storage error',
        internal_error: 'Leaderboard server error',
        misconfigured: 'Leaderboard service is misconfigured',
        rate_limited: 'Too many requests',
        turnstile_rejected: 'Verification rejected',
      };
      const result = submission.event === 'request_failed'
        ? (submission.reason === 'timeout' ? 'Request timed out' : 'Network or cross-origin request failed')
        : (outcomes[submission.outcome] || 'Response received; see the report for details');
      const operation = submission.path === '/run/start' ? 'start run' : submission.path === '/run/end' ? 'final score' : 'score update';
      summary += ` Last request result in retained history (${operation}): ${result}` +
        (submission.status ? ` (HTTP ${submission.status})` : '') +
        (submission.reason ? `; reason: ${submission.reason.replace(/_/g, ' ')}` : '') + '.';
    } else {
      summary += ' No score-submission response in the retained history.';
    }
    if (report.finalWaitingForToken) summary += ' The final score is waiting for a run token.';
    $overlay.querySelector('#set-board-summary').textContent = summary;
    $overlay.querySelector('#set-board-log').value = JSON.stringify(report, null, 2);
    $overlay.querySelector('#set-board-status').textContent = `${report.events.length} local events shown.` +
      (report.historyPersisted ? '' : ' Local storage is unavailable; this history may not survive a reload.');
  },

  // Reflect live/persisted state into the controls. Run every time the panel opens.
  _sync() {
    const $ = (s) => $overlay.querySelector(s);
    // Quality tier
    const tier = lsGet(K.tier) || 'auto';
    const r = $(`#set-quality input[value="${tier}"]`);
    if (r) r.checked = true;
    $('#set-quality-detected').textContent = 'detected: ' + (TIER_LABEL[DETECTED_TIER] || 'Low');
    // Effects tri-states (Off / Auto / On)
    setTri($('#set-glow'), triValue(AdaptiveQuality.getOverride('bloom')));
    setTri($('#set-bubbles'), triValue(AdaptiveQuality.getOverride('bubbles')));
    // Shadows reflects the persisted CHOICE (reload-required), not a live override.
    setTri($('#set-shadows'), lsGet(K.shadows) || 'auto');
    // Extra lights (booted state)
    $('#set-context').checked = !!PERF.contextLights;
    $('#set-fancy').checked = !!PERF.fancyLights;
    // Volume
    setSlider($('#set-vol-master'), Sound.getMasterVolume(), 'master');
    setSlider($('#set-vol-music'), Sound.getMusicVolume(), 'music');
    setSlider($('#set-vol-sfx'), Sound.getSfxVolume(), 'sfx');
    // Accessibility
    $('#set-reduced-motion').checked = A11y.reducedMotion;
    $('#set-colorblind').checked = A11y.colorblind;
    this._refreshApply();
  },

  _refreshApply() {
    const $ = (s) => $overlay.querySelector(s);
    const tierNow = ($('#set-quality input:checked') || {}).value || 'auto';
    // Shadows is live on a shadow-capable tier; the ONLY restart case is turning
    // it On on the low tier, whose shadow machinery ships off and can't be built
    // live (it needs every material to recompile).
    const shadowsNeedRestart = getTri($('#set-shadows')) === 'on' && !PERF.shadows;
    const pending =
      tierNow !== bootSnap.tier ||
      shadowsNeedRestart ||
      $('#set-context').checked !== bootSnap.context ||
      $('#set-fancy').checked !== bootSnap.fancy;
    // Contextual: the restart bar only exists when something actually needs one.
    $('.settings-restart').classList.toggle('is-hidden', !pending);
  },
};

// ---- DOM template helpers ----

function tierRow(value, label) {
  const warn = value !== 'auto' && TIER_RANK[value] > TIER_RANK[DETECTED_TIER];
  const chip = value === 'auto'
    ? `<span class="settings-chip" id="set-quality-detected">detected: Low</span>` : '';
  const warnEl = warn
    ? `<div class="settings-warn"><span class="settings-warn-ico">&#9888;</span> may run slower on this device</div>` : '';
  return `
    <label class="settings-radio">
      <input type="radio" name="set-quality" value="${value}">
      <span class="settings-dot"></span>
      <span class="settings-radio-body">
        <span class="settings-radio-head"><span class="settings-radio-label">${label}</span>${chip}</span>
        ${warnEl}
      </span>
    </label>`;
}

function triRow(id, label, sub) {
  return `
    <div class="settings-tri-row">
      <div class="settings-tri-body">
        <span class="settings-tri-label">${label}</span>
        <span class="settings-tri-sub">${sub}</span>
      </div>
      <div class="settings-tri" id="${id}" role="radiogroup" aria-label="${label}">
        <button type="button" data-v="off">Off</button>
        <button type="button" data-v="auto">Auto</button>
        <button type="button" data-v="on">On</button>
      </div>
    </div>`;
}

function toggleRow(id, label, sub) {
  return `
    <label class="settings-toggle-row">
      <span class="settings-toggle-body">
        <span class="settings-toggle-label">${label}</span>
        <span class="settings-toggle-sub">${sub}</span>
      </span>
      <input type="checkbox" id="${id}" class="settings-switch">
    </label>`;
}

function sliderRow(id, label) {
  return `
    <div class="settings-slider-row">
      <span class="settings-slider-label">${label}</span>
      <input type="range" id="${id}" min="0" max="100" value="60" class="settings-slider">
    </div>`;
}

// Map a per-effect override (null|true|false) to a tri-state control value.
function triValue(ov) { return ov === null ? 'auto' : ov ? 'on' : 'off'; }

function setTri(el, val) {
  el.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.v === val));
}

function getTri(el) {
  const a = el.querySelector('button.active');
  return a ? a.dataset.v : 'auto';
}

function bindTri(el, onChange) {
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    setTri(el, btn.dataset.v);
    onChange(btn.dataset.v);
  });
}

function bindSlider(input, bus, apply) {
  input.addEventListener('input', () => {
    const pct = Number(input.value) / 100;
    apply(pct * VOL_MAX[bus]);
  });
}

function setSlider(input, gain, bus) {
  const pct = Math.round((gain / VOL_MAX[bus]) * 100);
  input.value = String(Math.max(0, Math.min(100, pct)));
}

const GEAR_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
