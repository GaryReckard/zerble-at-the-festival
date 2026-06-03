// Chase camera with arrow-key orbit/tilt.
//
// Default behavior: sits behind Zerble at a fixed offset, smoothly following.
// Arrow keys add user-driven yaw/pitch offsets that PERSIST when released —
// they don't auto-snap-back. Press the opposite arrow to undo, or hold the
// HOME chord (configurable below) to recenter.

import * as THREE from 'three';

const DEFAULT_DISTANCE = 12;
const DEFAULT_HEIGHT = 6.5;
const LOOK_HEIGHT = 1.8;
const LOOK_AHEAD = 4;

const YAW_RATE = 1.8;      // rad/s when an arrow is held
const PITCH_RATE = 1.0;
const MAX_PITCH = 0.7;     // ~40°
const MIN_PITCH = -0.25;   // ~-14° — camera shouldn't go below the cart
const POSITION_LERP = 6;
const LOOK_LERP = 9;

// First-person view: camera mounted between Zerble's eyes (cart-local z=-2.5,
// y=2.15), looking forward. Pitch lets you look up/down; yaw lets you look
// around without changing where the cart is facing. Pitch range is wider than
// chase mode since clipping isn't an issue here.
const FPV_LOCAL = { x: 0, y: 2.15, z: -2.5 };
const FPV_MIN_PITCH = -0.5;
const FPV_MAX_PITCH = 0.9;

// Top-down view: camera floats above Zerble at a configurable height, tilted
// slightly off-vertical so the world has some depth (a true 90° straight-down
// view feels flat and disorienting at speed). UP/DOWN arrows zoom; LEFT/RIGHT
// rotate the view around the vertical axis. Mouse wheel also zooms.
const TOP_DEFAULT_HEIGHT = 80;
const TOP_MIN_HEIGHT = 30;
const TOP_MAX_HEIGHT = 220;
const TOP_TILT = 0.18;        // ~10° off vertical, gives depth
const TOP_ZOOM_RATE = 1.4;    // (height units per second while UP/DOWN held) → multiplier
const TOP_POSITION_LERP = 5;
const TOP_LOOK_LERP = 7;

// Zoom (mouse wheel + two-finger pinch). Top-down already zooms via topHeight;
// chase and first-person didn't until now. UP/DOWN arrows are pitch in those
// modes, so the wheel + pinch are the zoom axis there (see _applyZoom).
//   - Chase: `chaseZoom` is a dolly multiplier on the default distance/height
//     (1.0 = tuned default, <1 pulls in low + close, >1 backs out + up).
//   - First-person: the camera is rigidly mounted on Zerble's head and can't
//     dolly, so zoom is a FOV (telephoto) change instead — smaller FOV = more
//     zoomed in. Top of the range is the camera's natural lens.
// Both persist across mode switches, same as topHeight.
const CHASE_MIN_ZOOM = 0.5;
const CHASE_MAX_ZOOM = 2.4;
const FPV_MIN_FOV = 28;
const WHEEL_ZOOM_STEP = 1.10;   // one wheel notch → ±10% zoom

// ---- Opening "drawing comes to life" intro ----
// On game start the camera snaps to a front-quarter "match" pose that lines the
// 3D model up behind assets/zerble.png, holds while the PNG cross-dissolves,
// then orbits around to the chase pose while the FOV widens from a long lens
// (which flattens perspective toward the flat 2D art) back to the gameplay
// default. All four numbers below are tuned against the PNG overlay; treat them
// as the knobs for the match.
const INTRO_MATCH_FOV    = 32;            // long lens ≈ the cartoon's near-orthographic look
const INTRO_MATCH_AZIM   = Math.PI - 0.5; // front-right 3/4 (matches the PNG's facing)
const INTRO_MATCH_RADIUS = 15.5;          // horizontal distance from Zerble
const INTRO_MATCH_HEIGHT = 2.4;           // camera sits BELOW the roofline (3.75m)…
const INTRO_MATCH_LOOK_H = 2.7;           // …and aims up, so the canopy underside shows (like the PNG)

// easeInOutCubic — smooth accel/decel for the orbit + FOV sweep.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class ChaseCamera {
  constructor(camera, zerble) {
    this.camera = camera;
    this.zerble = zerble;

    this.yawOffset = 0;
    this.pitchOffset = 0.05;
    this.mode = 'third';
    // Top-down state: persistent across mode switches so the view comes back
    // exactly as the user left it last time they were in top-down.
    this.topHeight = TOP_DEFAULT_HEIGHT;
    // Chase / first-person zoom (wheel + pinch). Persist across mode switches.
    this.chaseZoom = 1;        // dolly multiplier on default distance/height
    this.fpvFov = camera.fov;  // first-person telephoto FOV

    // Debug camera lock (window.__dbg.camLock) — when set, the per-frame update
    // re-asserts a fixed pose every frame and ignores chase/intro logic, so a
    // close-up screenshot pose can't be stolen back by the chase follow.
    this._dbgCamLocked = false;
    this._dbgPos = new THREE.Vector3();
    this._dbgLook = new THREE.Vector3();

    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();
    this._currentLook = new THREE.Vector3();

    // Opening intro state. `_introPhase`: null (normal) | 'match' (holding the
    // PNG-match pose while the cutout fades) | 'orbit' (sweeping to chase).
    this._introPhase = null;
    this._introT = 0;
    this._introDur = 2.0;
    this._introOnDone = null;
    this._introMatch = null;   // cached {pos, look, fov} for the hold
    this._introCache = null;   // cached {match, chase} polar poses for the orbit
    this._defaultFov = camera.fov;

    this._wireWheelZoom();
    this.snap();
  }

  // Cycle: third → first → top → third. The HUD toast in main.js shows
  // a friendly name; we expose `modeLabel` to keep the label logic in one place.
  toggleMode() {
    const next = { third: 'first', first: 'top', top: 'third' };
    this.mode = next[this.mode] || 'third';
    // Reset yaw offset when entering first-person so you start looking forward.
    // Top-down keeps its own yaw — entering it from chase should preserve any
    // orbit the user already dialed in.
    if (this.mode === 'first') this.yawOffset = 0;
    this.snap();
  }

  get modeLabel() {
    if (this.mode === 'first') return 'First-person view';
    if (this.mode === 'top') return 'Top-down view';
    return 'Chase view';
  }

  // Mouse-wheel zoom — active in every mode now. _applyZoom routes the factor
  // to whatever the current mode's zoom axis is (top height / chase dolly /
  // FPV fov). Disabled during the intro and while the debug cam is locked.
  _wireWheelZoom() {
    window.addEventListener('wheel', (e) => {
      if (this._introPhase || this._dbgCamLocked) return;
      // deltaY > 0 = scroll down = zoom OUT. factor > 1 = zoom in (closer).
      const factor = e.deltaY > 0 ? 1 / WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP;
      this._applyZoom(factor);
      // Prevent the page from scrolling when interacting with the canvas.
      e.preventDefault();
    }, { passive: false });
  }

  // Apply a zoom factor to the active mode. factor > 1 zooms IN (subject gets
  // bigger); < 1 zooms out. Each mode maps it to its own axis: top-down lowers
  // altitude, chase pulls the dolly in, first-person tightens the FOV.
  _applyZoom(factor) {
    if (!(factor > 0) || factor === 1) return;
    if (this.mode === 'top') {
      this.topHeight = THREE.MathUtils.clamp(this.topHeight / factor, TOP_MIN_HEIGHT, TOP_MAX_HEIGHT);
    } else if (this.mode === 'first') {
      this.fpvFov = THREE.MathUtils.clamp(this.fpvFov / factor, FPV_MIN_FOV, this._defaultFov);
    } else {
      this.chaseZoom = THREE.MathUtils.clamp(this.chaseZoom / factor, CHASE_MIN_ZOOM, CHASE_MAX_ZOOM);
    }
  }

  // ---- Debug camera lock (window.__dbg.camLock / camUnlock) -------------
  // Pin the camera to a fixed world pose for close-up screenshots. update()
  // re-asserts it every frame so the chase follow can't drag it back.
  dbgCamLock(px, py, pz, tx, ty, tz) {
    this._dbgPos.set(px, py, pz);
    this._dbgLook.set(tx, ty, tz);
    this._dbgCamLocked = true;
    // Predictable framing: drop any FPV telephoto / intro lens back to default.
    if (this.camera.fov !== this._defaultFov) {
      this.camera.fov = this._defaultFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.copy(this._dbgPos);
    this.camera.lookAt(this._dbgLook);
  }

  dbgCamUnlock() {
    this._dbgCamLocked = false;
    this.snap();
  }

  snap() {
    this._computeTargets();
    this.camera.position.copy(this._desiredPos);
    this._currentLook.copy(this._desiredLook);
    this.camera.lookAt(this._currentLook);
  }

  // ---- Opening intro ----------------------------------------------------

  // Polar description of the front-quarter PNG-match shot.
  _introMatchPose() {
    const P = this.zerble.position;
    const phi = this.zerble.heading + INTRO_MATCH_AZIM;
    const r = INTRO_MATCH_RADIUS;
    return {
      phi, r, height: INTRO_MATCH_HEIGHT, fov: INTRO_MATCH_FOV,
      pos: new THREE.Vector3(
        P.x + Math.sin(phi) * r,
        P.y + INTRO_MATCH_HEIGHT,
        P.z + Math.cos(phi) * r,
      ),
      look: new THREE.Vector3(P.x, P.y + INTRO_MATCH_LOOK_H, P.z),
    };
  }

  // Polar description of the default chase shot (yaw/pitch offsets neutral).
  _introChasePose() {
    const P = this.zerble.position;
    const h = this.zerble.heading;
    const pitch = 0.05;
    return {
      phi: h,
      r: DEFAULT_DISTANCE * Math.cos(pitch),
      height: DEFAULT_HEIGHT + Math.sin(pitch) * DEFAULT_DISTANCE,
      fov: this._defaultFov,
      look: new THREE.Vector3(
        P.x - Math.sin(h) * LOOK_AHEAD,
        P.y + LOOK_HEIGHT,
        P.z - Math.cos(h) * LOOK_AHEAD,
      ),
    };
  }

  _applyPose(pos, look, fov) {
    this.camera.position.copy(pos);
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this._currentLook.copy(look);
    this.camera.lookAt(look);
  }

  // Snap to the PNG-match pose and hold there (the cutout overlay covers the
  // model during this phase, so the snap is invisible).
  poseIntroMatch() {
    this.mode = 'third';
    this.yawOffset = 0;
    this.pitchOffset = 0.05;
    this._introPhase = 'match';
    this._introMatch = this._introMatchPose();
    this._applyPose(this._introMatch.pos, this._introMatch.look, this._introMatch.fov);
  }

  // Begin the orbit from the match pose around to chase, widening FOV as it
  // goes. Calls onDone when the sweep completes (hand control back to player).
  beginIntroOrbit(durationSec = 2.0, onDone = null) {
    this._introPhase = 'orbit';
    this._introT = 0;
    this._introDur = durationSec;
    this._introOnDone = onDone;
    this._introCache = { match: this._introMatchPose(), chase: this._introChasePose() };
  }

  // Abort the intro immediately and settle into chase (used by a skip tap/key).
  skipIntro() {
    if (!this._introPhase) return;
    this._introPhase = null;
    this.yawOffset = 0;
    this.pitchOffset = 0.05;
    this.camera.fov = this._defaultFov;
    this.camera.updateProjectionMatrix();
    this.snap();
    const cb = this._introOnDone;
    this._introOnDone = null;
    if (cb) cb();
  }

  introActive() {
    return this._introPhase !== null;
  }

  // Drives match-hold / orbit; returns true if it consumed the frame so update()
  // can skip the normal chase logic (and ignore player input) during the intro.
  _updateIntro(dt) {
    if (this._introPhase === 'match') {
      const m = this._introMatch;
      this._applyPose(m.pos, m.look, m.fov);
      return true;
    }
    if (this._introPhase === 'orbit') {
      this._introT = Math.min(this._introDur, this._introT + dt);
      const s = easeInOutCubic(this._introT / this._introDur);
      const { match: a, chase: b } = this._introCache;
      const P = this.zerble.position;
      const phi = a.phi + (b.phi - a.phi) * s;   // linear sweep (not shortest-arc)
      const r = a.r + (b.r - a.r) * s;
      const height = a.height + (b.height - a.height) * s;
      this._desiredPos.set(P.x + Math.sin(phi) * r, P.y + height, P.z + Math.cos(phi) * r);
      this._currentLook.lerpVectors(a.look, b.look, s);
      const fov = a.fov + (b.fov - a.fov) * s;
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(this._desiredPos);
      this.camera.lookAt(this._currentLook);
      if (this._introT >= this._introDur) {
        this._introPhase = null;
        this.camera.fov = this._defaultFov;
        this.camera.updateProjectionMatrix();
        const cb = this._introOnDone;
        this._introOnDone = null;
        if (cb) cb();
      }
      return true;
    }
    return false;
  }

  update(dt, input) {
    // Debug cam lock owns the camera entirely — re-assert the pinned pose so
    // nothing (chase follow, intro) can drag it back, and ignore everything else.
    if (this._dbgCamLocked) {
      this.camera.position.copy(this._dbgPos);
      this.camera.lookAt(this._dbgLook);
      return;
    }

    // Opening intro owns the camera + ignores player input until it finishes.
    if (this._updateIntro(dt)) return;

    // FOV management: first-person uses fpvFov (telephoto zoom); every other
    // mode uses the default lens. Kept in sync here so a mode switch out of
    // first-person restores the natural FOV no matter how we got there.
    const wantFov = this.mode === 'first' ? this.fpvFov : this._defaultFov;
    if (this.camera.fov !== wantFov) {
      this.camera.fov = wantFov;
      this.camera.updateProjectionMatrix();
    }

    // Two-finger pinch zoom (touch) — one multiplicative factor accumulated
    // since last frame. Same axis-routing as the mouse wheel via _applyZoom.
    if (typeof input.consumeZoom === 'function') {
      this._applyZoom(input.consumeZoom());
    }

    // Keyboard arrow keys: rate-based yaw/pitch. In top-down mode the up/down
    // arrows mean ZOOM rather than pitch, so we route them differently.
    this.yawOffset += input.camYaw * YAW_RATE * dt;

    if (this.mode === 'top') {
      // UP arrow = zoom in (lower altitude), DOWN = zoom out.
      // input.camPitch is +1 for UP, -1 for DOWN, so multiplier > 1 when DOWN.
      const zoomDelta = -input.camPitch;  // UP shrinks height, DOWN grows it
      const factor = Math.exp(zoomDelta * TOP_ZOOM_RATE * dt);
      this.topHeight = THREE.MathUtils.clamp(
        this.topHeight * factor,
        TOP_MIN_HEIGHT,
        TOP_MAX_HEIGHT,
      );
    } else {
      let nextPitch = this.pitchOffset + input.camPitch * PITCH_RATE * dt;

      // Touch drag: one-shot deltas in radians accumulated since last frame.
      // Only applied in chase/first — top-down has its own yaw and uses zoom for the y-axis.
      if (typeof input.consumeCamDeltas === 'function') {
        const d = input.consumeCamDeltas();
        this.yawOffset += d.yaw;
        nextPitch += d.pitch;
      }

      const [minP, maxP] = this.mode === 'first'
        ? [FPV_MIN_PITCH, FPV_MAX_PITCH]
        : [MIN_PITCH, MAX_PITCH];
      this.pitchOffset = THREE.MathUtils.clamp(nextPitch, minP, maxP);
    }

    // Top-down still consumes touch deltas for yaw — pitch deltas become zoom.
    if (this.mode === 'top' && typeof input.consumeCamDeltas === 'function') {
      const d = input.consumeCamDeltas();
      this.yawOffset += d.yaw;
      // Repurpose pitch drag as a soft zoom — a drag-down zooms out, drag-up zooms in.
      if (d.pitch !== 0) {
        const f = Math.exp(-d.pitch * 1.5);
        this.topHeight = THREE.MathUtils.clamp(this.topHeight * f, TOP_MIN_HEIGHT, TOP_MAX_HEIGHT);
      }
    }

    this._computeTargets();

    if (this.mode === 'first') {
      // No lerp in FPV — the camera is rigidly mounted on Zerble's head.
      // Lerping would lag behind sharp steering, breaking the head-cam feel.
      this.camera.position.copy(this._desiredPos);
      this._currentLook.copy(this._desiredLook);
    } else if (this.mode === 'top') {
      // Slightly looser lerp than chase so big altitude swings don't whip,
      // and slower look-lerp so the cart can travel without the camera
      // playing catch-up in a distracting way.
      this.camera.position.lerp(this._desiredPos, Math.min(1, dt * TOP_POSITION_LERP));
      this._currentLook.lerp(this._desiredLook, Math.min(1, dt * TOP_LOOK_LERP));
    } else {
      this.camera.position.lerp(this._desiredPos, Math.min(1, dt * POSITION_LERP));
      // Smooth the look target so quick steering doesn't whip the camera
      this._currentLook.lerp(this._desiredLook, Math.min(1, dt * LOOK_LERP));
    }
    this.camera.lookAt(this._currentLook);
  }

  _computeTargets() {
    if (this.mode === 'first') {
      this._computeFirstPerson();
      return;
    }
    if (this.mode === 'top') {
      this._computeTopDown();
      return;
    }
    // ---- Third-person chase (default) ----
    // Effective camera yaw around Zerble (heading + user offset). Pitch tilts up/down.
    // chaseZoom dollies the whole rig in/out along its ray (distance + height
    // scale together so the look angle stays roughly constant).
    const yaw = this.zerble.heading + this.yawOffset;
    const pitch = this.pitchOffset;
    const z = this.chaseZoom;
    const dist = DEFAULT_DISTANCE * z * Math.cos(pitch);
    const height = (DEFAULT_HEIGHT + Math.sin(pitch) * DEFAULT_DISTANCE) * z;

    // Behind Zerble. forward = (-sin(yaw), 0, -cos(yaw)), back = (sin, 0, cos).
    this._desiredPos.set(
      this.zerble.position.x + Math.sin(yaw) * dist,
      this.zerble.position.y + height,
      this.zerble.position.z + Math.cos(yaw) * dist
    );

    // Look slightly ahead of Zerble in his actual heading (not the user's yaw), so
    // when the user orbits the camera the cart still feels centered.
    const aimYaw = this.zerble.heading;
    this._desiredLook.set(
      this.zerble.position.x - Math.sin(aimYaw) * LOOK_AHEAD,
      this.zerble.position.y + LOOK_HEIGHT,
      this.zerble.position.z - Math.cos(aimYaw) * LOOK_AHEAD
    );
  }

  _computeTopDown() {
    // Camera sits above Zerble at this.topHeight. Tilt slightly off vertical
    // so the world has depth — at 90° straight down everything looks like a
    // map screen and you can't tell what's in front of you. The tilt direction
    // follows yawOffset so the user can orbit around Zerble.
    const z = this.zerble.position;
    const yaw = this.zerble.heading + this.yawOffset;
    // Tilt offsets the camera horizontally in the OPPOSITE direction of where
    // it's looking — so it sits a bit behind/north/whatever and tilts forward
    // toward Zerble.
    const tiltOffsetHoriz = this.topHeight * Math.sin(TOP_TILT);
    this._desiredPos.set(
      z.x - Math.sin(yaw) * tiltOffsetHoriz,
      z.y + this.topHeight * Math.cos(TOP_TILT),
      z.z - Math.cos(yaw) * tiltOffsetHoriz,
    );
    // Look directly at Zerble.
    this._desiredLook.set(z.x, z.y + 0.5, z.z);
  }

  _computeFirstPerson() {
    // Mount the camera at FPV_LOCAL in Zerble's frame, rotated by his heading.
    const h = this.zerble.heading;
    const cos = Math.cos(h);
    const sin = Math.sin(h);
    const lx = FPV_LOCAL.x;
    const lz = FPV_LOCAL.z;
    this._desiredPos.set(
      this.zerble.position.x + lx * cos + lz * sin,
      this.zerble.position.y + FPV_LOCAL.y,
      this.zerble.position.z - lx * sin + lz * cos
    );

    // Look forward along (heading + yawOffset), tilted by pitchOffset.
    // Zerble's forward is (-sin(h), 0, -cos(h)) when yawOffset = 0.
    const lookYaw = h + this.yawOffset;
    const pitch = this.pitchOffset;
    const ahead = 8;
    const cosPitch = Math.cos(pitch);
    this._desiredLook.set(
      this._desiredPos.x - Math.sin(lookYaw) * ahead * cosPitch,
      this._desiredPos.y + Math.sin(pitch) * ahead,
      this._desiredPos.z - Math.cos(lookYaw) * ahead * cosPitch
    );
  }
}
