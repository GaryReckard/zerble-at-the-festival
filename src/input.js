// Keyboard + touch input. Tracks held keys + edge events for the keyboard,
// and blends in axis values + edge presses from the Touch module so the rest
// of the game can stay input-source-agnostic.
//
// WASD steers Zerble; arrow keys orbit/tilt the camera.
// On touch devices: left thumbstick steers + throttles, right buttons honk +
// boost, drag-canvas orbits the camera.

import { Touch } from './touch.js';
import { steerDirFor, touchSteerDirFor } from './steering.js';

const held = new Set();
let diagnostic = null;
const edges = new Set();
const untilRelease = new Set();

function normalize(e) {
  if (e.key === ' ') return 'SPACE';
  if (e.key === 'Shift') return 'SHIFT';
  if (e.key === 'Control') return 'CONTROL';
  if (e.key === 'ArrowUp') return 'UP';
  if (e.key === 'ArrowDown') return 'DOWN';
  if (e.key === 'ArrowLeft') return 'LEFT';
  if (e.key === 'ArrowRight') return 'RIGHT';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key.toUpperCase();
}

const BLOCK_DEFAULT = new Set(['W', 'A', 'S', 'D', 'SPACE', 'SHIFT', 'UP', 'DOWN', 'LEFT', 'RIGHT']);

window.addEventListener('keydown', (e) => {
  if(diagnostic){untilRelease.add(normalize(e));e.preventDefault();if(e.key==='Escape')diagnostic.abort();return;}
  // Never let a keystroke aimed at a text field drive the cart. Without this,
  // typing a marker note (or any future input) fires V/B/H/Y/M/G/I/O as game
  // actions — the camera flips while you type. Editable target = not gameplay.
  if (e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]')) return;
  const k = normalize(e);
  if ((k === 'M' || k === 'J') && (e.metaKey || e.ctrlKey || e.altKey)) return;
  if (untilRelease.has(k)) {
    if (e.repeat) return;
    untilRelease.delete(k);
  }
  if (!held.has(k)) edges.add(k);
  held.add(k);
  if (BLOCK_DEFAULT.has(k)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  const k = normalize(e);
  held.delete(k);
  untilRelease.delete(k);
});

window.addEventListener('blur', () => {
  held.clear();
  edges.clear();
});

window.addEventListener('focusin', e => {
  if(e.target?.matches?.('input, textarea, select, [contenteditable]')){held.clear();edges.clear();}
});

// Combine a keyboard {-1,0,1} digital axis with a touch [-1..1] analog axis.
// Touch wins when active; otherwise keyboard. Clamped to [-1, 1].
function blendAxis(kbd, touch) {
  if (touch !== 0) return Math.max(-1, Math.min(1, touch));
  return kbd;
}

export const Input = {
  acquireDiagnostic(source, abort = () => {}) {
    if(diagnostic)throw new Error('Input already owned');
    this.clear();const owner={source,abort};diagnostic=owner;
    return ()=>{if(diagnostic===owner){diagnostic=null;this.clear();}};
  },
  get brake() { return diagnostic ? !!diagnostic.source.brake : false; },
  clear() {
    for (const key of held) untilRelease.add(key);
    held.clear();
    edges.clear();
    Touch.reset();
  },

  isDown(k) {
    return diagnostic ? false : held.has(k);
  },

  // Edge press: keyboard keydown OR a per-key touch latch this frame. SPACE
  // is honk; J is music-toggle. Other keys are keyboard-only.
  consumePressed(k) {
    if(diagnostic)return false;
    const kbdEdge = edges.has(k);
    if (kbdEdge) edges.delete(k);
    if (k === 'SPACE') {
      const touchEdge = Touch._consumeHonk();
      return kbdEdge || touchEdge;
    }
    if (k === 'J') {
      const touchEdge = Touch._consumeMusic();
      return kbdEdge || touchEdge;
    }
    return kbdEdge;
  },

  // ----- Driving (WASD + thumbstick) -----
  get throttle() {
    if(diagnostic)return diagnostic.source.throttle||0;
    const kbd = (held.has('W') ? 1 : 0) - (held.has('S') ? 1 : 0);
    return blendAxis(kbd, Touch.state.throttle);
  },
  get steer() {
    if(diagnostic)return diagnostic.source.steer||0;
    const kbd = (held.has('A') ? 1 : 0) - (held.has('D') ? 1 : 0);
    return blendAxis(kbd, Touch.state.steer);
  },
  steeringDirection(speed) {
    if(diagnostic)return steerDirFor(diagnostic.source.throttle||0,speed);
    return Touch.state.steer !== 0
      ? touchSteerDirFor(speed)
      : steerDirFor(this.throttle, speed);
  },
  get boost() {
    if(diagnostic)return !!diagnostic.source.boost;
    return held.has('SHIFT') || Touch.state.boost;
  },
  get slow() {
    if(diagnostic)return !!diagnostic.source.slow;
    return held.has('CONTROL') || Touch.state.slow;
  },

  // ----- Camera (arrow keys — rate-based, persistent) -----
  get camYaw() {
    if(diagnostic)return 0;
    // LEFT yaws the camera left around Zerble; RIGHT yaws right.
    return (held.has('LEFT') ? 1 : 0) - (held.has('RIGHT') ? 1 : 0);
  },
  get camPitch() {
    if(diagnostic)return 0;
    // UP tilts the camera up; DOWN tilts down.
    return (held.has('UP') ? 1 : 0) - (held.has('DOWN') ? 1 : 0);
  },

  // ----- Camera drag (touch — direct one-shot deltas in radians) -----
  // ChaseCamera consumes these each frame in addition to camYaw/camPitch.
  consumeCamDeltas() {
    if(diagnostic){Touch._consumeCamDeltas();return {yaw:0,pitch:0};}
    return Touch._consumeCamDeltas();
  },

  // ----- Camera zoom (touch pinch — multiplicative factor since last frame) -----
  // 1 = no change, >1 = zoom in (fingers spreading), <1 = zoom out.
  // ChaseCamera routes this to the active mode's zoom axis via _applyZoom.
  consumeZoom() {
    if(diagnostic){Touch._consumeZoom();return 1;}
    return Touch._consumeZoom();
  },
};
