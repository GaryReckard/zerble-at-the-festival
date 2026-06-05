// Zerble: the anthropomorphic golf cart. Geometry + arcade physics.

import * as THREE from 'three';
import { Input } from './input.js';
import { PERF } from './perf.js';
import { buildBubbleJug } from './models/bubbleJug.js';

// --- Driving feel knobs ---
const ACCEL = 18;          // m/s^2 throttle
const BRAKE = 28;          // m/s^2 when reversing throttle vs current direction
const MAX_SPEED = 18;      // m/s
const BOOST_MULT = 1.55;
const REVERSE_MAX = 7;
// DRAG: multiplicative coefficient applied each second when no throttle.
// 0.78 = ~63% velocity loss per second. Sharper than the old 0.92 (~28%)
// so the cart locks to a clean stop instead of creeping for ages. Pairs
// with a bumped SPEED_SNAP threshold below — anything under 30cm/sec
// snaps to zero, killing the visible "drift to a stop" tail entirely.
const DRAG = 0.78;
const SPEED_SNAP = 0.3;    // |speed| below this snaps to 0 (was 0.05)
const TURN_RATE = 2.1;     // rad/s at full speed
const WORLD_BOUND = 230;

// --- Visual palette (matches the reference image) ---
const COLOR_BODY = 0xe63b3b;
const COLOR_ROOF = 0xf2c14e;   // warm gold
const COLOR_SEAT = 0x2563d6;
const COLOR_FRAME = 0x2a1f3a;
const COLOR_WHEEL = 0x1c1c20;
const COLOR_MUSTACHE = 0x9b59d6;
const COLOR_EYE_GLOW = 0xa6ecff;
const COLOR_IRIS = 0x1e9bff;

const LED_HUES = [0xff5577, 0xffaa33, 0xffe066, 0x66ff88, 0x66d9ff, 0xc080ff];

// Reusable color object for disco light updates — avoids per-frame churn.
const _tmpDiscoColor = new THREE.Color();
const _tmpWellColor = new THREE.Color();   // wheel-well underglow hue cycle

// Mini "ZERBLE" novelty plate, baked to a small canvas so it reads at any zoom
// with no external asset (same trick as the seat pattern below). Real Zerble
// sports a tiny "ZERBLE / NORTH CAROLINA" plate at the back of the platform.
function _makeZerblePlateTexture() {
  const cv = document.createElement('canvas');
  cv.width = 160; cv.height = 80;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 160, 80);                 // cream plate
  g.strokeStyle = '#c0392b'; g.lineWidth = 6; g.strokeRect(6, 6, 148, 68);
  g.textAlign = 'center';
  g.fillStyle = '#7a2018'; g.font = 'bold 13px sans-serif';
  g.fillText('NORTH CAROLINA', 80, 22);
  g.fillStyle = '#c0392b'; g.font = 'bold 34px sans-serif';
  g.fillText('ZERBLE', 80, 58);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class Zerble {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Zerble';

    this.position = this.root.position; // alias
    this.heading = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.radius = 1.9;
    this.invulnLeft = 0;
    this.honkCooldown = 0;

    // Eye-glow brightness scalar (0..1). Default 0.75 per the spec. Held
    // I-key ramps it toward 1, held O ramps it toward 0. Eased so the full
    // range takes a touch under 2s.
    this.eyeGlowLevel = 0.5;
    // Bubble-juice meter level (0..JUICE_STACK_MAX, in meters), fed from main.js
    // each frame. Drives the bubble-machine liquid level + reserve jugs. Default
    // full so the sandbox shows liquid without the bubbles module wired in.
    this._juiceLevel = 1.0;

    // For bubbles & smile attraction: a stable world point on Zerble.
    this.nozzleWorld = new THREE.Vector3();
    this.forwardWorld = new THREE.Vector3();

    this._build();
  }

  // ---------- BUILD ----------

  _build() {
    const mat = (color, opts = {}) =>
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: opts.roughness ?? 0.6,
        metalness: opts.metalness ?? 0.05,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 0,
      });

    // ----- Chassis: split into a full-height FRONT section and a lower REAR
    // "pickup bed" so back-seat riders have foot room. The rear gets a
    // black floorboard on top with LED light trim.
    const chassisFront = new THREE.Mesh(
      this._roundedBoxGeometry(2.6, 0.9, 2.6, 0.18),
      mat(COLOR_BODY, { roughness: 0.55 })
    );
    chassisFront.position.set(0, 0.85, -0.8);
    chassisFront.castShadow = true;
    chassisFront.receiveShadow = true;
    this.root.add(chassisFront);

    const chassisRear = new THREE.Mesh(
      this._roundedBoxGeometry(2.6, 0.45, 1.6, 0.12),
      mat(COLOR_BODY, { roughness: 0.55 })
    );
    chassisRear.position.set(0, 0.6, 1.3);
    chassisRear.castShadow = true;
    chassisRear.receiveShadow = true;
    this.root.add(chassisRear);

    // Hood front (a small bulge at the front)
    const hood = new THREE.Mesh(
      this._roundedBoxGeometry(2.6, 0.45, 1.0, 0.14),
      mat(COLOR_BODY, { roughness: 0.55 })
    );
    hood.position.set(0, 1.2, -1.8);
    hood.castShadow = true;
    this.root.add(hood);

    // ----- Front bench seat -----
    const frontSeat = new THREE.Mesh(
      this._roundedBoxGeometry(2.2, 0.55, 1.0, 0.1),
      mat(COLOR_SEAT, { roughness: 0.85 })
    );
    frontSeat.position.set(0, 1.45, -0.4);
    // Seats sit inside the cart — chassis + roof already cast the cart's
    // silhouette shadow on the ground.
    this.root.add(frontSeat);

    const frontSeatBack = new THREE.Mesh(
      this._roundedBoxGeometry(2.2, 1.0, 0.22, 0.08),
      mat(COLOR_SEAT, { roughness: 0.85 })
    );
    frontSeatBack.position.set(0, 1.95, 0.1);
    this.root.add(frontSeatBack);

    // ----- Back bench — REAR-FACING (EZ-GO style), passengers face out the back -----
    // The back seat-back sits IN FRONT of the back cushion, immediately behind the
    // front seat-back (back-to-back). Riders straddle the cushion facing +Z.
    const backSeat = new THREE.Mesh(
      this._roundedBoxGeometry(2.2, 0.28, 1.0, 0.08),   // half-thickness so reserve jugs show underneath
      mat(0xd7c79a, { roughness: 0.9 })   // classic beige golf-cart back bench
    );
    backSeat.position.set(0, 1.585, 1.1);   // raised so the seating surface stays put; clearance opens below
    this.root.add(backSeat);

    const backSeatBack = new THREE.Mesh(
      this._roundedBoxGeometry(2.2, 0.9, 0.22, 0.08),
      mat(0xd7c79a, { roughness: 0.9 })   // classic beige golf-cart back bench
    );
    backSeatBack.position.set(0, 1.9, 0.5);  // in front of the cushion (rear-facing)
    this.root.add(backSeatBack);

    // ----- Roof poles — only over the FRONT seat. Back poles come up BETWEEN
    // the front and back seats (at z=0.4) so the back bench is open-air. -----
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8);
    const poleMat = mat(COLOR_FRAME, { roughness: 0.4, metalness: 0.5 });
    for (const [x, z] of [
      [-1.3, -1.6],
      [1.3, -1.6],
      [-1.3, 0.4],
      [1.3, 0.4],
    ]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(x, 2.5, z);
      // Slim roof pole — roof itself casts the shadow.
      this.root.add(p);
    }

    // ----- Roof (gold) — shorter, covers only the front-seat area -----
    const roof = new THREE.Mesh(
      this._roundedBoxGeometry(3.4, 0.25, 2.4, 0.12),
      mat(COLOR_ROOF, { roughness: 0.5 })
    );
    roof.position.set(0, 3.75, -0.6);
    roof.castShadow = true;
    this.root.add(roof);

    // ----- Black floorboard sitting ON the lower rear chassis -----
    const floorboard = new THREE.Mesh(
      this._roundedBoxGeometry(2.4, 0.08, 1.6, 0.04),
      mat(0x141418, { roughness: 0.6 })
    );
    floorboard.position.set(0, 0.88, 1.4);
    // Floorboard sits low between the chassis halves — chassis already
    // dominates the shadow; keep receive on for the bubble-machine glow.
    floorboard.receiveShadow = true;
    this.root.add(floorboard);

    // ----- LED light trim along the floorboard's edge (real-Zerble vibe) -----
    const LED_TRIM_COLORS = [0xff5577, 0xffaa33, 0xffe066, 0x66ff88, 0x66d9ff, 0xc080ff, 0xff66cc];
    const trimGeo = new THREE.SphereGeometry(0.045, 6, 6);
    this._floorLeds = [];
    const placeLed = (x, z, hueIdx) => {
      const hue = LED_TRIM_COLORS[hueIdx % LED_TRIM_COLORS.length];
      const ledMat = new THREE.MeshStandardMaterial({
        color: hue,
        emissive: hue,
        emissiveIntensity: 1.8,
        roughness: 0.4,
      });
      const led = new THREE.Mesh(trimGeo, ledMat);
      led.position.set(x, 0.94, z);
      led.userData = { phase: hueIdx * 0.7, mat: ledMat };
      this.root.add(led);
      this._floorLeds.push(led);
    };
    // LEDs line only the BACK HALF of the rear platform (back edge + the rear
    // stretch of each side) — on the real cart they don't wrap all the way
    // around. Platform spans z 0.6..2.2; "back half" starts at z≈1.4.
    const ledSpacing = 0.22;
    const halfW = 1.15;
    let i = 0;
    for (let x = -halfW; x <= halfW + 0.001; x += ledSpacing) placeLed(x, 2.2, i++);   // back edge
    for (let z = 1.4; z <= 2.2 - ledSpacing + 0.001; z += ledSpacing) {                 // rear half of the sides
      placeLed(-halfW, z, i++);
      placeLed( halfW, z, i++);
    }

    // ----- "Oh-shit" bar — narrow centered handle (~6" wide) anchored to the
    //       black platform behind the back seat. This is what the bubble
    //       machine mounts to. -----
    const ohPoints = [
      new THREE.Vector3(-0.22, 0.85, 1.95),
      new THREE.Vector3(-0.22, 2.5,  1.95),
      new THREE.Vector3(-0.12, 2.78, 1.95),
      new THREE.Vector3( 0.0,  2.85, 1.95),
      new THREE.Vector3( 0.12, 2.78, 1.95),
      new THREE.Vector3( 0.22, 2.5,  1.95),
      new THREE.Vector3( 0.22, 0.85, 1.95),
    ];
    const ohCurve = new THREE.CatmullRomCurve3(ohPoints);
    const ohBar = new THREE.Mesh(
      new THREE.TubeGeometry(ohCurve, 48, 0.06, 10, false),
      mat(COLOR_FRAME, { roughness: 0.35, metalness: 0.75 })
    );
    // Thin curved bar — skip shadow casting.
    this.root.add(ohBar);

    // ----- Wheels — big knobby off-road tires. The real Zerble runs aftermarket
    // AT tires on its EZ-GO, so the tread is the signature. Each wheel: a fat
    // tire carcass + a ring of chunky tread lugs collapsed into ONE InstancedMesh
    // (all the tread is a single draw call per wheel — this is the hero vehicle,
    // always on screen against the tight draw budget) + a small dark off-road rim
    // with a bright center cap.
    this.wheels = [];
    const TIRE_R = 0.62;     // up from 0.55 — chunkier
    const TIRE_W = 0.50;     // up from 0.45 — fatter
    this._tireR = TIRE_R;    // wheel-spin calc reads this so rolling matches ground speed

    const tireGeo = new THREE.CylinderGeometry(TIRE_R, TIRE_R, TIRE_W, 20);
    tireGeo.rotateZ(Math.PI / 2);   // axle along X
    const tireMat = mat(COLOR_WHEEL, { roughness: 0.95 });

    // Tread lug box: local X = axial (along axle), Y = radial protrusion, Z = tangential.
    const LUG_ROWS = 2;
    const LUGS_PER_ROW = 14;
    const lugGeo = new THREE.BoxGeometry(TIRE_W * 0.40, 0.14, 0.18);
    const lugMat = mat(0x101013, { roughness: 1.0 });   // matte-black tread

    // Small off-road rim + bright center cap.
    const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, TIRE_W + 0.04, 14);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMat = mat(0xd9a93a, { roughness: 0.3, metalness: 0.9 });    // gold rim
    const capGeo = new THREE.CylinderGeometry(0.11, 0.11, TIRE_W + 0.10, 10);
    capGeo.rotateZ(Math.PI / 2);
    const capMat = mat(0xf2e09a, { roughness: 0.3, metalness: 0.9 });    // bright gold cap

    const wheelPositions = [
      { x: -1.45, z: -1.5, front: true },
      { x: 1.45, z: -1.5, front: true },
      { x: -1.6, z: 1.4, front: false },
      { x: 1.6, z: 1.4, front: false },
    ];

    const _lugObj = new THREE.Object3D();
    for (const wp of wheelPositions) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wp.x, TIRE_R, wp.z);   // sit the tire on the ground

      // Spin pivot holds everything that rotates with the tire, so steering
      // (wheelGroup.rotation.y) and roll (spinPivot.rotation.x) compose cleanly.
      const spinPivot = new THREE.Group();

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      spinPivot.add(tire);

      // Knobby tread — two staggered rows of lugs orbiting the axle, all in one
      // InstancedMesh. Orbit each lug's position by hand and set rotation = angle
      // so its +Y face points radially outward.
      const lugs = new THREE.InstancedMesh(lugGeo, lugMat, LUG_ROWS * LUGS_PER_ROW);
      lugs.castShadow = false;
      let li = 0;
      for (let row = 0; row < LUG_ROWS; row++) {
        const xOff = (row === 0 ? -1 : 1) * TIRE_W * 0.22;
        const angOff = row === 0 ? 0 : Math.PI / LUGS_PER_ROW;   // stagger rows
        for (let k = 0; k < LUGS_PER_ROW; k++) {
          const a = angOff + (k / LUGS_PER_ROW) * Math.PI * 2;
          const r = TIRE_R + 0.04;
          _lugObj.position.set(xOff, Math.cos(a) * r, Math.sin(a) * r);
          _lugObj.rotation.set(a, 0, 0);
          _lugObj.updateMatrix();
          lugs.setMatrixAt(li++, _lugObj.matrix);
        }
      }
      lugs.instanceMatrix.needsUpdate = true;
      spinPivot.add(lugs);

      spinPivot.add(new THREE.Mesh(rimGeo, rimMat));
      spinPivot.add(new THREE.Mesh(capGeo, capMat));

      wheelGroup.add(spinPivot);
      this.root.add(wheelGroup);
      this.wheels.push({ group: wheelGroup, spin: spinPivot, front: wp.front, baseY: wheelGroup.position.y });
    }

    // ----- Fender flares — a body-coloured arch over each wheel so the chunky
    // tires read as sitting in wheel wells instead of clipping the body sides
    // (EZ-GO style). Half-torus in the wheel's plane, widened along the axle to
    // span the tire, arcing just outside the tire's top.
    const fenderGeo = new THREE.TorusGeometry(0.80, 0.12, 8, 20, Math.PI);
    fenderGeo.rotateY(Math.PI / 2);     // ring into the Y-Z plane → arch over the top
    const fenderMat = mat(COLOR_BODY, { roughness: 0.55 });
    for (const wp of wheelPositions) {
      const fender = new THREE.Mesh(fenderGeo, fenderMat);
      fender.position.set(wp.x, TIRE_R, wp.z);
      fender.scale.set(2.3, 1.06, 1.06);   // widen along the axle to span the tire width
      fender.castShadow = true;
      this.root.add(fender);
    }

    // ----- Wheel-well LED underglow — a bright rocker strip down each side, level
    // with the wheel wells, so the ground + tires wash with color at night
    // (real-Zerble signature). Emissive + bloom carry the glow; intensity ramps
    // with nightness (subtle by day, vivid after dark) and the hue slow-cycles.
    // Plus a downward colored PointLight per side for actual ground/tire wash —
    // gated by nightness so it costs nothing in daylight. Cheap: 2 strips + 2 lights.
    this._wellLeds = [];
    const wellGeo = new THREE.BoxGeometry(0.07, 0.06, 3.5);
    for (let side = 0; side < 2; side++) {
      const sx = side === 0 ? -1.5 : 1.5;
      const wellMat = new THREE.MeshStandardMaterial({
        color: 0xff3b6b, emissive: 0xff3b6b, emissiveIntensity: 0.4, roughness: 0.4,
      });
      const strip = new THREE.Mesh(wellGeo, wellMat);
      strip.position.set(sx, 0.5, -0.1);          // lower body edge, over the wheels
      strip.rotation.z = sx < 0 ? -0.3 : 0.3;     // cant the glow down-and-out
      strip.userData = { phase: side * 1.6, mat: wellMat };
      this.root.add(strip);
      this._wellLeds.push(strip);
    }
    // One downward wash light gives the ground/tires actual colour at night.
    // Real lights are the per-frame budget hog (see .claude/rules/performance.md)
    // and the cart already runs 3 (two headlights + disco), so this 4th light is
    // mid/high only — low tier leans on the emissive strips + bloom alone.
    this._wellLight = null;
    if (PERF.shadows) {   // shadows on == mid/high tier
      const wl = new THREE.PointLight(0xff3b6b, 0, 5.5, 1.5);
      wl.position.set(0, 0.3, 0.2);
      wl.castShadow = false;
      this.root.add(wl);
      this._wellLight = wl;
    }

    // ----- Rear brake/tail lights — two red emissive blocks low on the back of
    // the red body. Glow faintly by day, brighter at night.
    this._brakeLights = [];
    const brakeGeo = new THREE.BoxGeometry(0.46, 0.26, 0.12);
    for (const bx of [-0.9, 0.9]) {
      const brakeMat = new THREE.MeshStandardMaterial({
        color: 0xff2a2a, emissive: 0xff0a0a, emissiveIntensity: 0.7, roughness: 0.4,
      });
      const bl = new THREE.Mesh(brakeGeo, brakeMat);
      bl.position.set(bx, 0.62, 2.06);   // rear face of the red body
      bl.userData = { mat: brakeMat };
      this.root.add(bl);
      this._brakeLights.push(bl);
    }

    // ----- Mini "ZERBLE" license plate at the very back, below the tail lights -----
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.26, 0.04),
      new THREE.MeshStandardMaterial({ map: _makeZerblePlateTexture(), roughness: 0.6 }),
    );
    plate.position.set(0, 0.32, 2.12);
    this.root.add(plate);

    // ----- Eyes — big globes with VISIBLE black pupils in front of blue irises -----
    this.eyes = [];
    // Collect glowing materials so the day/night + i/o-key brightness
    // controls can crank them at runtime.
    this._eyeGlowMats = [];
    for (const ex of [-0.78, 0.78]) {
      const eye = new THREE.Group();
      eye.position.set(ex, 2.15, -1.95);

      // ----- Sclera — front hemisphere only -----
      // The driver sits BEHIND the eyes; a full glowing sphere lights up
      // the cab from inside (Gary "can't see the road"). Make the sclera
      // a front-facing hemisphere and cap the back with an opaque black
      // dome so the cab stays dark.
      const scleraMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: COLOR_EYE_GLOW,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        // Translucent — the eye reads as a glowing dome, not a plastic ball.
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      // SphereGeometry phi mapping in three.js: phi=0 → -X, π/2 → +Z, π → +X, 3π/2 → -Z.
      // The eye looks down -Z; a hemisphere covering -Z is phiStart = π, phiLength = π
      // (covers +X → -Z → -X, the FRONT half).
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 24, 16, Math.PI, Math.PI),
        scleraMat,
      );
      sclera.castShadow = false;
      eye.add(sclera);
      this._eyeGlowMats.push(scleraMat);

      // Back cap covers the +Z (rear) half so the cab interior stays dark.
      // phiStart=0, phiLength=π covers -X → +Z → +X.
      const backCapMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a, roughness: 0.9, side: THREE.DoubleSide,
      });
      const backCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.71, 24, 16, 0, Math.PI),
        backCapMat,
      );
      eye.add(backCap);

      // Iris — front-facing hemisphere matching the sclera (covers -Z front).
      const irisMat = new THREE.MeshStandardMaterial({
        color: COLOR_IRIS,
        emissive: COLOR_IRIS,
        emissiveIntensity: 0.6,
        roughness: 0.3,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      });
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 18, 12, Math.PI, Math.PI),
        irisMat,
      );
      iris.position.z = -0.45;
      eye.add(iris);
      this._eyeGlowMats.push(irisMat);

      // Pupil — opaque black, the only solid element. Front face at
      // z = -0.94 (~9cm past the iris).
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 14, 12),
        new THREE.MeshStandardMaterial({
          color: 0x000000,
          roughness: 1,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      pupil.position.z = -0.70;
      eye.add(pupil);

      // (highlight catch-light removed — was floating in front of the eye)

      this.root.add(eye);
      this.eyes.push({ root: eye, pupil, iris, basePos: eye.position.clone() });
    }

    // ----- Mustache -----
    this._buildMustache();

    // ----- LED headlight bar — a row of warm-yellow lamps across the front bumper -----
    // (Used to be drawn as "teeth" — repurposed per the cart's actual headlight strip.)
    this._headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfff0c4,
      emissive: 0xffe28a,
      emissiveIntensity: 1.2,
      roughness: 0.4,
    });
    // Chrome backing strip behind the lamps
    const chromeStrip = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.22, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x55525a, roughness: 0.4, metalness: 0.7 })
    );
    chromeStrip.position.set(0, 0.78, -2.13);
    this.root.add(chromeStrip);
    // Four warm-yellow lamps along the strip
    for (const tx of [-0.55, -0.18, 0.18, 0.55]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.06), this._headlightMat);
      lamp.position.set(tx, 0.78, -2.15);
      this.root.add(lamp);
    }

    // ----- Night-only headlight cones — two SpotLights firing forward -----
    // Off during the day (intensity ramps with nightness). Targets sit a few
    // meters ahead so the cones spread out on the ground.
    this._headlightLights = [];
    for (const tx of [-0.4, 0.4]) {
      const light = new THREE.SpotLight(0xffeac4, 0, 28, Math.PI / 6, 0.45, 1.0);
      light.position.set(tx, 0.95, -2.0);
      const target = new THREE.Object3D();
      target.position.set(tx * 1.5, 0, -8);   // shine a few meters ahead
      this.root.add(target);
      light.target = target;
      // Shadows on the headlights would tank perf; the moonlit ambient is fine.
      this.root.add(light);
      this._headlightLights.push(light);
    }


    // ----- Bubble machine — a HOLLOW purple box, black inside, with a real open
    // circular hole in the rear face. The wand wheel is recessed on a white axle
    // that runs to the inner back wall, and bubble liquid pools in the bottom
    // (its level tracks the juice meter; set each frame in update()). Sits over
    // the platform, its back just past the oh-shit bar. BM_Z drives the disco too.
    const BM_Z = 2.0;
    const BM_Y = 3.08;
    const BM_W = 0.9, BM_H = 0.62, BM_D = 0.55;
    const wall = 0.04;
    const hw = BM_W / 2, hh = BM_H / 2, hd = BM_D / 2;
    const HOLE_R = 0.18;
    const HOLE_CY = 0.11;                  // hole centre, box-local +y (leaves room for liquid below)

    const bmGroup = new THREE.Group();
    bmGroup.position.set(0, BM_Y, BM_Z);
    this.root.add(bmGroup);

    const purpleMat = mat(0x6b4ea0, { roughness: 0.4 });

    // Black interior: a BackSide box renders its inner walls, so you see black
    // through the hole. The purple shell occludes it from every other angle.
    const interior = new THREE.Mesh(
      new THREE.BoxGeometry(BM_W - wall, BM_H - wall, BM_D - wall),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.95, side: THREE.BackSide }),
    );
    bmGroup.add(interior);

    // Purple outer shell — 5 solid panels (open at +Z, which gets the holed face).
    const addPanel = (w, h, d, x, y, z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), purpleMat);
      p.position.set(x, y, z);
      p.castShadow = true;
      bmGroup.add(p);
    };
    addPanel(BM_W, wall, BM_D, 0,  hh, 0);   // top
    addPanel(BM_W, wall, BM_D, 0, -hh, 0);   // bottom
    addPanel(wall, BM_H, BM_D, -hw, 0, 0);   // left
    addPanel(wall, BM_H, BM_D,  hw, 0, 0);   // right
    addPanel(BM_W, BM_H, wall, 0, 0, -hd);   // front (-Z)

    // Rear (+Z) face with a real circular hole (rect outline minus a circle).
    const rectShape = new THREE.Shape();
    rectShape.moveTo(-hw, -hh);
    rectShape.lineTo(hw, -hh);
    rectShape.lineTo(hw, hh);
    rectShape.lineTo(-hw, hh);
    rectShape.closePath();
    const holePath = new THREE.Path();
    holePath.absarc(0, HOLE_CY, HOLE_R, 0, Math.PI * 2, true);
    rectShape.holes.push(holePath);
    const rear = new THREE.Mesh(new THREE.ShapeGeometry(rectShape), purpleMat);
    rear.position.set(0, 0, hd);             // ShapeGeometry lies in XY, normal +Z (out the back)
    bmGroup.add(rear);

    // Strap from box down to the bar (world space).
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.08, 0.18),
      mat(COLOR_FRAME, { roughness: 0.5, metalness: 0.4 })
    );
    strap.position.set(0, BM_Y - hh - 0.05, BM_Z - 0.05);
    this.root.add(strap);

    const wandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xdfe2ff, emissiveIntensity: 0.3, roughness: 0.45,
    });

    // White axle from the recessed wheel back to the inner rear wall.
    const WHEEL_Z = hd - 0.05;               // recessed ~the same distance it used to sit proud
    const axleBackZ = -hd + wall;
    const axleLen = WHEEL_Z - axleBackZ;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, axleLen, 8), wandMat);
    axle.rotation.x = Math.PI / 2;           // along Z
    axle.position.set(0, HOLE_CY, (WHEEL_Z + axleBackZ) / 2);
    bmGroup.add(axle);

    // Wand wheel: a central hub with spokes, each tipped with a small loop.
    // Recessed in the hole, aligned with its centre. Spins on the axle in update().
    const wheel = new THREE.Group();
    wheel.position.set(0, HOLE_CY, WHEEL_Z);
    bmGroup.add(wheel);
    this._bubbleWheel = wheel;
    const SPOKES = 9;
    const rSpoke = 0.135;                    // loop-centre radius
    const rLoop = 0.032;                     // wand-loop radius (outer edge ≈ 0.167 < HOLE_R 0.18)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 12), wandMat);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    const loopGeo = new THREE.TorusGeometry(rLoop, 0.007, 6, 16);
    // Stick runs from the hub out to the loop and overlaps its inner edge a
    // touch so the handle and ring visibly join (Gary: the sticks should meet
    // the outer ring now, not stop short of it).
    const spokeLen = (rSpoke - rLoop) + rLoop / 4;
    const spokeGeo = new THREE.CylinderGeometry(0.007, 0.007, spokeLen, 6);
    for (let k = 0; k < SPOKES; k++) {
      const a = (k / SPOKES) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, wandMat);
      spoke.position.set(Math.cos(a) * spokeLen / 2, Math.sin(a) * spokeLen / 2, 0);
      spoke.rotation.z = a - Math.PI / 2;
      wheel.add(spoke);
      const loop = new THREE.Mesh(loopGeo, wandMat);
      loop.position.set(Math.cos(a) * rSpoke, Math.sin(a) * rSpoke, 0);
      wheel.add(loop);
    }

    // Bubble liquid pooling in the bottom — level set each frame from the meter
    // (see update()). Floor = interior bottom; full = the hole's bottom lip.
    this._liqFloorY = -hh + wall;
    this._liqRange = (HOLE_CY - HOLE_R) - this._liqFloorY;   // full-meter column height
    const liquid = new THREE.Mesh(
      new THREE.BoxGeometry(BM_W - 2 * wall, 1, BM_D - 2 * wall),   // unit height, scaled in update()
      new THREE.MeshStandardMaterial({
        color: 0x49d0ff, transparent: true, opacity: 0.72, roughness: 0.2,
        emissive: 0x1a6ea0, emissiveIntensity: 0.35,
      }),
    );
    bmGroup.add(liquid);
    this._bubbleLiquid = liquid;

    // Reserve bubble-juice jugs stashed in the cavity under the back seat — one
    // shown per stockpiled meter (matches the HUD reserve pips), revealed by
    // count in update(). Placement: each jug drops into a random spot in the
    // cavity that doesn't clip an already-placed jug; if no clear spot turns up
    // after a bunch of tries, it goes down anyway (clipping) — so a big stockpile
    // just packs the cavity full. Pool is generous so it scales if the stockpile
    // cap ever rises; only `reserves` are visible at a time.
    this._reserveJugs = [];
    const JUG_POOL = 12;
    const JUG_R = 0.14;                 // footprint radius for the non-clip check
    const cav = { x0: -0.85, x1: 0.85, z0: 0.8, z1: 1.5, y: 0.95 };
    const jugSpots = [];
    for (let i = 0; i < JUG_POOL; i++) {
      let px = 0, pz = 0;
      for (let tries = 0; tries < 24; tries++) {
        px = cav.x0 + Math.random() * (cav.x1 - cav.x0);
        pz = cav.z0 + Math.random() * (cav.z1 - cav.z0);
        const clear = jugSpots.every((s) => (s.x - px) ** 2 + (s.z - pz) ** 2 >= (2 * JUG_R) ** 2);
        if (clear) break;              // found a non-clipping spot
      }                                 // ...otherwise keep the last candidate (let it clip)
      jugSpots.push({ x: px, z: pz });
      const jug = buildBubbleJug();
      jug.scale.setScalar(0.5);
      jug.position.set(px, cav.y, pz);
      jug.rotation.y = Math.random() * Math.PI * 2;
      jug.visible = false;
      this.root.add(jug);
      this._reserveJugs.push(jug);
    }

    // ----- RGB disco light — replaces the old white nozzle ring -----
    // Faceted hemisphere atop a small black base, like the USB DJ ball
    // Gary referenced. Aims backwards + DOWN at ~45° so the beam splashes
    // colored light onto the ground behind Zerble. Colors cycle (RGB
    // chase) and a SpotLight pointed in the same direction throws actual
    // illumination at night.
    const discoGroup = new THREE.Group();
    // Tucked just under the bubble machine (bm bottom ≈ y=2.775).
    // z=1.95 matches the bubble machine's z so it mounts cleanly beneath it.
    discoGroup.position.set(0, 2.7, BM_Z);   // stacked directly under the bubble machine
    // 135° around X: hemisphere open face points DOWN+back so the SpotLight
    // (target at local +Y=5) throws light onto the ground behind the cart.
    discoGroup.rotation.x = (3 * Math.PI) / 4;
    this.root.add(discoGroup);

    // Small black housing cup
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.20, 0.22, 0.14, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x161616, roughness: 0.85, metalness: 0.3, side: THREE.DoubleSide,
      }),
    );
    // Local +Y of the disco group points "out" the aim direction; the cup
    // sits at +Y=0 with the dome at +Y=0.08.
    housing.position.y = 0;
    discoGroup.add(housing);

    // Faceted dome — IcosahedronGeometry detail 1 gives the chunky-prism
    // look of a real disco-ball dome. Emissive material that cycles colors.
    const discoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.0,
      transparent: true,
      opacity: 0.85,
    });
    const dome = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 1),
      discoMat,
    );
    // Squash to a hemisphere by clipping below the cup (visual approximation
    // via positioning + slight Y-scale).
    dome.scale.set(1, 0.85, 1);
    dome.position.y = 0.08;
    discoGroup.add(dome);

    // SpotLight that throws actual colored light backwards/down at night.
    const discoLight = new THREE.SpotLight(
      0xff3380,             // initial color (cycled in update)
      0,                    // intensity (ramped with nightness)
      14,                   // distance
      Math.PI / 4,          // cone half-angle (~45°)
      0.55,                 // penumbra
      1.2,                  // decay
    );
    // SpotLight aims from itself toward .target.position. Position the
    // light at the dome and target a point further along the disco
    // group's +Y axis.
    discoLight.position.set(0, 0.08, 0);
    const discoTarget = new THREE.Object3D();
    discoTarget.position.set(0, 5, 0);
    discoGroup.add(discoLight);
    discoGroup.add(discoTarget);
    discoLight.target = discoTarget;

    this._disco = {
      group: discoGroup,
      dome,
      domeMat: discoMat,
      light: discoLight,
      // Animation state — pattern phase + color phase tick separately so
      // the dome's hue cycle isn't locked to its spin.
      phase: 0,
      colorPhase: 0,
      // Bubble-blast mode (G key) — when true, the disco light gets much
      // brighter, locks to a bright white-pink, and the dome strobes. Eased
      // toward this value in update() so toggling doesn't pop the light.
      blastLevel: 0,
    };

    // (Round headlights removed — the new LED bar above replaces them.)

    // A grounded shadow disc for fallback (in case shadow map quality drops)
    const shadowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    this.root.add(shadowDisc);

    // ----- Permanent bearded driver in the front-left seat -----
    this._buildDriver();

    // ----- Passenger seat slots (local space, ordered: drivers seat is occupied) -----
    // Each slot is a local position + facing. Passengers attach here.
    this.seatSlots = [
      // Front row — face forward (cart's forward = -Z, so yaw=0)
      { name: 'front-right',  x:  0.55, y: 1.75, z: -0.35, yaw: 0,           occupied: false, kind: 'driver_seat' },
      // Back row — REAR-FACING. Riders face +Z (out the back), so yaw=Math.PI
      { name: 'back-left',    x: -0.65, y: 1.75, z:  1.1,  yaw: Math.PI,     occupied: false, kind: 'bench' },
      { name: 'back-center',  x:  0.0,  y: 1.75, z:  1.1,  yaw: Math.PI,     occupied: false, kind: 'bench' },
      { name: 'back-right',   x:  0.65, y: 1.75, z:  1.1,  yaw: Math.PI,     occupied: false, kind: 'bench' },
      // Running-board / side-rider slots
      { name: 'side-left',    x: -1.55, y: 1.4,  z:  0.4,  yaw: -Math.PI/2,  occupied: false, kind: 'standing' },
      { name: 'side-right',   x:  1.55, y: 1.4,  z:  0.4,  yaw:  Math.PI/2,  occupied: false, kind: 'standing' },
      // Roof riders (the brave ones) — the shorter roof spans z=-1.8 to z=0.6
      { name: 'roof-front',   x:  0.0,  y: 3.95, z: -1.2,  yaw: 0,           occupied: false, kind: 'roof' },
      { name: 'roof-back',    x:  0.0,  y: 3.95, z:  0.0,  yaw: 0,           occupied: false, kind: 'roof' },
    ];
  }

  _buildDriver() {
    const driver = new THREE.Group();
    driver.position.set(-0.55, 1.75, -0.35); // sitting in the front-left seat

    // Body — flannel shirt
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.55, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xa84a3b, roughness: 0.95, flatShading: true })
    );
    body.position.y = 0.05;
    body.castShadow = true;
    driver.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 1),
      new THREE.MeshStandardMaterial({ color: 0xd9a26e, roughness: 0.9, flatShading: true })
    );
    head.position.y = 0.75;
    // Tiny driver head — body shadow already represents the driver.
    driver.add(head);

    // (No hat — driver wears their own hair instead.)

    // Brown hair, parted on the LEFT. Driver faces -Z, so driver-left = -X.
    // Built as TWO icosahedra: a fuller main mass covering crown + back +
    // right side, plus a smaller, shorter patch on the left. The size
    // asymmetry reads as a side-part silhouette without needing a literal
    // "part line" mesh (which wouldn't read at game-camera distance).
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x4a3220, roughness: 1.0, flatShading: true,
    });
    const hairMain = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.30, 1), hairMat,
    );
    // Slight +X offset = "swept to the right". Scale flattens it into a
    // crown shape; the head's icosa-radius of 0.28 + this 0.30 leaves a
    // ~2cm fluffy halo.
    hairMain.position.set(0.025, 0.86, 0.03);
    hairMain.scale.set(1.05, 0.62, 1.05);
    driver.add(hairMain);
    // Shorter, flatter left-side patch — the bit of hair that lies down
    // across the part line. Without it the silhouette reads symmetric.
    const hairLeft = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 0), hairMat,
    );
    hairLeft.position.set(-0.16, 0.78, 0.02);
    hairLeft.scale.set(1.0, 0.55, 1.0);
    driver.add(hairLeft);

    // Beard — dense cluster of icospheres, wide arc under chin hanging well below the head
    const beardMatA = new THREE.MeshStandardMaterial({ color: 0x4a352a, roughness: 1, flatShading: true });
    const beardMatB = new THREE.MeshStandardMaterial({ color: 0x5d4435, roughness: 1, flatShading: true });
    const beardMatC = new THREE.MeshStandardMaterial({ color: 0x2e1e14, roughness: 1, flatShading: true }); // dark accent
    const beardClusters = 40;
    for (let i = 0; i < beardClusters; i++) {
      // Arc spans from one cheek across the chin to the other (~220°), centered facing -Z
      const ang = (i / beardClusters) * Math.PI * 1.22 + Math.PI * 0.39;
      const r = 0.20 + Math.random() * 0.08;
      // dy range: -0.05 near the chin line down to -0.45 for the hanging beard
      const dy = -0.05 - Math.random() * 0.40;
      const radius = 0.10 + Math.random() * 0.05;
      const matIdx = i % 5;
      const mat = matIdx === 4 ? beardMatC : (i % 2 === 0 ? beardMatA : beardMatB);
      const tuft = new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius, 0),
        mat
      );
      tuft.position.set(
        Math.cos(ang) * r * 0.75,
        0.62 + dy,
        Math.sin(ang) * r * 0.75 - 0.06
      );
      tuft.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      driver.add(tuft);
    }

    // Handlebar mustache — two mirrored CatmullRom tubes, brown, curling up at tips
    // Sits just under the nose (head center at y=0.75), in front of the face (-Z side).
    const driverMustacheMat = new THREE.MeshStandardMaterial({ color: 0x4a352a, roughness: 0.95, flatShading: true });
    for (const side of [-1, 1]) {
      const pts = [
        new THREE.Vector3(side * 0.03, 0.68, -0.27),   // near center under nose
        new THREE.Vector3(side * 0.12, 0.67, -0.28),
        new THREE.Vector3(side * 0.22, 0.65, -0.26),
        new THREE.Vector3(side * 0.28, 0.63, -0.24),   // widest point
        new THREE.Vector3(side * 0.30, 0.66, -0.23),   // starts curling up
        new THREE.Vector3(side * 0.28, 0.70, -0.23),   // tip curled up
      ];
      const mCurve = new THREE.CatmullRomCurve3(pts);
      const mTube = new THREE.Mesh(
        new THREE.TubeGeometry(mCurve, 20, 0.04, 7, false),
        driverMustacheMat
      );
      // Mustache tube on the driver — thin curl, skip shadow casting.
      driver.add(mTube);
    }

    // Blue eyes — sclera + iris on the front face of the head
    // Head is at y=0.75; eyes sit slightly above center, pushed forward (-Z)
    const eyeSclMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5, flatShading: true });
    const eyeIrisMat = new THREE.MeshStandardMaterial({ color: 0x2a6fb8, roughness: 0.4, flatShading: true });
    for (const ex of [-0.10, 0.10]) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeSclMat);
      sclera.position.set(ex, 0.78, -0.22);
      driver.add(sclera);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 5), eyeIrisMat);
      iris.position.set(ex, 0.78, -0.25);
      driver.add(iris);
    }

    // ---- Mondrian-pattern Wayfarer shades ----
    // White frame with primary-color rectangles + black grid lines (the
    // pattern is painted into a canvas texture); blue-tinted gradient
    // lenses at 60% opacity so the eyes still peek through. Sits just
    // forward of the eyes — `glasses.position.z = -0.26` puts the lens
    // plane in front of both iris (z=-0.25) and sclera (z=-0.22).
    const glasses = new THREE.Group();
    glasses.position.set(0, 0.78, -0.26);
    // +20% chunkier per Gary's "embiggen" request — frames widen, lenses
    // grow, temples lengthen all in proportion.
    glasses.scale.setScalar(1.2);
    driver.add(glasses);

    // Mondrian frame texture — drawn into a canvas once per shack-er,
    // er, per Zerble. Small enough (256² · ~6KB) that we don't bother
    // hoisting to module level.
    const mondrianCanvas = document.createElement('canvas');
    mondrianCanvas.width = 256;
    mondrianCanvas.height = 256;
    const mc = mondrianCanvas.getContext('2d');
    mc.fillStyle = '#ffffff';
    mc.fillRect(0, 0, 256, 256);
    mc.fillStyle = '#f5a623';
    mc.fillRect(140, 20, 90, 80);
    mc.fillRect(20, 180, 80, 60);
    mc.fillStyle = '#d04030';
    mc.fillRect(0, 0, 50, 60);
    mc.fillRect(180, 180, 76, 76);
    mc.fillStyle = '#4a90e2';
    mc.fillRect(60, 60, 60, 90);
    mc.fillStyle = '#f5e030';
    mc.fillRect(120, 150, 40, 30);
    mc.strokeStyle = '#1a1a1a';
    mc.lineWidth = 10;
    mc.beginPath();
    mc.moveTo(0, 60);  mc.lineTo(256, 60);
    mc.moveTo(0, 150); mc.lineTo(256, 150);
    mc.moveTo(60, 0);  mc.lineTo(60, 256);
    mc.moveTo(140, 0); mc.lineTo(140, 256);
    mc.moveTo(180, 0); mc.lineTo(180, 256);
    mc.stroke();
    const mondrianTex = new THREE.CanvasTexture(mondrianCanvas);
    mondrianTex.colorSpace = THREE.SRGBColorSpace;
    // RepeatWrapping fixes the gray inner-rim faces: the ExtrudeGeometry's
    // side walls have UVs that often exceed 1.0 (cumulative arc length /
    // depth), and with the default ClampToEdge they were sampling a single
    // column of the texture. Repeat tiling lets the inner walls catch the
    // Mondrian colors instead of looking flat gray.
    mondrianTex.wrapS = THREE.RepeatWrapping;
    mondrianTex.wrapT = THREE.RepeatWrapping;
    const frameMat = new THREE.MeshStandardMaterial({
      map: mondrianTex, roughness: 0.45, metalness: 0.1, flatShading: true,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x6fa9e8,
      emissive: 0x1a2f55,
      emissiveIntensity: 0.25,
      roughness: 0.15,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    // Eye-rim shape — rounded rectangle with a rounded rectangular hole.
    // ExtrudeGeometry gives us a chunky frame in one mesh per side.
    const FRAME_W = 0.105;   // each lens width
    const FRAME_H = 0.075;   // each lens height
    const FRAME_T = 0.014;   // rim thickness
    const FRAME_D = 0.018;   // extrusion depth (front-to-back)
    function makeRimShape() {
      const w = FRAME_W / 2, h = FRAME_H / 2, r = 0.012;
      const outer = new THREE.Shape();
      outer.moveTo(-w + r, -h);
      outer.lineTo( w - r, -h);
      outer.quadraticCurveTo( w, -h,  w, -h + r);
      outer.lineTo( w, h - r);
      outer.quadraticCurveTo( w, h,  w - r, h);
      outer.lineTo(-w + r, h);
      outer.quadraticCurveTo(-w, h, -w, h - r);
      outer.lineTo(-w, -h + r);
      outer.quadraticCurveTo(-w, -h, -w + r, -h);
      const iw = w - FRAME_T, ih = h - FRAME_T, ir = 0.008;
      const inner = new THREE.Path();
      inner.moveTo(-iw + ir, -ih);
      inner.lineTo( iw - ir, -ih);
      inner.quadraticCurveTo( iw, -ih,  iw, -ih + ir);
      inner.lineTo( iw, ih - ir);
      inner.quadraticCurveTo( iw, ih,  iw - ir, ih);
      inner.lineTo(-iw + ir, ih);
      inner.quadraticCurveTo(-iw, ih, -iw, ih - ir);
      inner.lineTo(-iw, -ih + ir);
      inner.quadraticCurveTo(-iw, -ih, -iw + ir, -ih);
      outer.holes.push(inner);
      return outer;
    }
    const rimGeo = new THREE.ExtrudeGeometry(makeRimShape(), {
      depth: FRAME_D, bevelEnabled: false, curveSegments: 4,
    });
    const lensGeo = new THREE.PlaneGeometry(FRAME_W - FRAME_T * 2, FRAME_H - FRAME_T * 2);

    // Two eye frames + lenses — moved inward from ±0.10 to ±0.085 so the
    // bridge between them is short enough to be a single connecting piece.
    const FRAME_X = 0.085;
    for (const lx of [-FRAME_X, FRAME_X]) {
      const rim = new THREE.Mesh(rimGeo, frameMat);
      // Extrusion extends +Z by default; offset back so the rim is
      // centered around the lens plane (lens at z=0 in glasses-local).
      rim.position.set(lx, 0, -FRAME_D / 2);
      glasses.add(rim);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(lx, 0, 0);
      glasses.add(lens);
    }

    // Nose bridge — sized to actually span the gap between the two rims'
    // inner edges. Inner edges sit at ±(FRAME_X - FRAME_W/2) = ±0.0325;
    // bridge width 0.075 gives a small overlap into each rim so the join
    // reads continuous rather than two pieces almost touching.
    const bridgeWidth = (FRAME_X - FRAME_W / 2) * 2 + 0.012;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(bridgeWidth, 0.014, FRAME_D),
      frameMat,
    );
    bridge.position.set(0, 0.018, -FRAME_D / 2);
    glasses.add(bridge);

    // Temple arms — chunky boxes attached to the outer edges of the rims
    // and splayed outward at ~9° so the far ends sit wider than the
    // mounting points. BoxGeometry has proper UVs on all six faces so the
    // Mondrian texture wraps the arm cleanly on every visible side.
    //
    // Rotating the box around its center shifts the near end INWARD
    // (toward the centerline) by arm-half-length × sin(splay) ≈ 17.5mm.
    // If we mounted the box at the rim's outer edge, the near end would
    // land back inside the lens area and clip. Compensate by pushing the
    // mount center outward by that same shift PLUS a small margin so the
    // arm visibly tucks just outside the rim/lens edge.
    const ARM_LEN = 0.22;
    const armGeo = new THREE.BoxGeometry(0.018, 0.014, ARM_LEN);
    const ARM_SPLAY = 0.16;                              // ~9° outward
    const splayShift = (ARM_LEN / 2) * Math.sin(ARM_SPLAY);
    const armOuterX = FRAME_X + FRAME_W / 2 + splayShift + 0.004;
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(side * armOuterX, 0.004, 0.09);
      // Positive rotation.y tilts local +Z (the arm's long axis) toward
      // +X. Right arm (+X side) wants +Z to tilt MORE +X as it extends
      // back → positive rotation. Left arm (-X side) wants +Z to tilt
      // toward -X → negative rotation. `side * ARM_SPLAY` gives both.
      arm.rotation.y = side * ARM_SPLAY;
      glasses.add(arm);
    }

    // Hands on a steering wheel (just suggested)
    const handMat = new THREE.MeshStandardMaterial({ color: 0xd9a26e, roughness: 0.9 });
    for (const hx of [-0.18, 0.18]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), handMat);
      hand.position.set(hx, 0.15, -0.45);
      driver.add(hand);
    }
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.04, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.4 })
    );
    wheel.position.set(0, 0.15, -0.5);
    wheel.rotation.x = Math.PI / 2;
    driver.add(wheel);

    this.root.add(driver);
    this.driver = driver;
  }

  // Convert a local seat slot to a world position. Used by the passenger system.
  worldSeatPosition(slot, out) {
    const cos = Math.cos(this.heading);
    const sin = Math.sin(this.heading);
    out.set(
      this.position.x + slot.x * cos + slot.z * sin,
      this.position.y + slot.y,
      this.position.z - slot.x * sin + slot.z * cos
    );
    return out;
  }

  _buildMustache() {
    // Two mirrored handlebar curls — sweep out wide, dip down at the cheeks,
    // then curl up and back at the tips. Beefier and fuzzier than before.

    const mustacheMat = new THREE.MeshStandardMaterial({
      color: COLOR_MUSTACHE,
      roughness: 0.95,
      flatShading: true,
    });
    const fuzzMatA = new THREE.MeshStandardMaterial({
      color: 0x8244c8, roughness: 1, flatShading: true,
    });
    const fuzzMatB = new THREE.MeshStandardMaterial({
      color: 0xb285e8, roughness: 1, flatShading: true,
    });

    this._mustacheLeds = [];
    const ledGeo = new THREE.SphereGeometry(0.07, 8, 6);
    // Hair strands: thin tapered cones. Two length variants for variety.
    const strandGeoLong = new THREE.ConeGeometry(0.025, 0.42, 5, 1);
    const strandGeoShort = new THREE.ConeGeometry(0.022, 0.28, 5, 1);
    // ConeGeometry centers the cone at origin with base at -y/2 and tip at +y/2.
    // Translate so the BASE sits at the origin and the tip is at +y * length —
    // this lets us position the strand by its emergence point directly.
    strandGeoLong.translate(0, 0.21, 0);
    strandGeoShort.translate(0, 0.14, 0);

    // Position the whole mustache near the front of the cart, below the eyes.
    const baseY = 1.35;
    const baseZ = -2.30;

    for (const side of [-1, 1]) {
      const pts = [];
      // Curve starts at center (t=0) and grows OUTWARD as t increases.
      // The OUTER tip ends at the outer side — then curls upward from there.
      for (let t = 0; t <= 1.0001; t += 1 / 30) {
        const x = side * (0.05 + t * 1.85);                   // monotonically outward
        const y = -0.22 * Math.sin(Math.PI * t);              // sag/dip at the cheek
        const z = 0.08 * Math.sin(Math.PI * t);               // slight forward bulge mid-sweep
        pts.push(new THREE.Vector3(x, y, z));
      }
      // The outer tip — now curl up & inward over the cheek, handlebar style
      const tip = pts[pts.length - 1];
      pts.push(new THREE.Vector3(tip.x + side * 0.08, tip.y + 0.35, tip.z));
      pts.push(new THREE.Vector3(tip.x + side * 0.02, tip.y + 0.72, tip.z));
      pts.push(new THREE.Vector3(tip.x - side * 0.35, tip.y + 0.78, tip.z));
      pts.push(new THREE.Vector3(tip.x - side * 0.65, tip.y + 0.50, tip.z));
      pts.push(new THREE.Vector3(tip.x - side * 0.70, tip.y + 0.18, tip.z));

      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.22, 6, false),
        mustacheMat
      );
      tube.position.set(0, baseY, baseZ);
      tube.castShadow = true;
      this.root.add(tube);

      // ----- Hair strands along the tube — thin cones flowing ALONG the tube -----
      // Previous version was too spikey (60% radial outward). Now the strands
      // mostly follow the tangent direction (75%), with only a small radial
      // component (20%) and slight up-bias (5%). 96 per side (halved from 192)
      // — still reads as dense hair, better perf.
      const _ref = new THREE.Vector3();
      const _side = new THREE.Vector3();
      const _normal = new THREE.Vector3();
      const _radial = new THREE.Vector3();
      const _dir = new THREE.Vector3();
      const _yAxis = new THREE.Vector3(0, 1, 0);
      const strandCount = 96;
      for (let i = 0; i < strandCount; i++) {
        const u = (i + 0.5) / strandCount;
        const p = curve.getPoint(u);
        const tangent = curve.getTangent(u).normalize();

        _ref.set(0, 1, 0);
        if (Math.abs(tangent.y) > 0.9) _ref.set(1, 0, 0);
        _side.crossVectors(tangent, _ref).normalize();
        _normal.crossVectors(_side, tangent).normalize();

        const theta = (i * 2.39996) % (Math.PI * 2);
        _radial.copy(_side).multiplyScalar(Math.cos(theta))
               .addScaledVector(_normal, Math.sin(theta));

        // Tangent-dominant: strands lie close to the tube, flowing along its
        // length. The radial component is small (20%) so they don't spike
        // outward.
        _dir.copy(tangent).multiplyScalar(0.75)
            .addScaledVector(_radial, 0.20)
            .addScaledVector(_yAxis, 0.05);
        // Smaller jitter so the cloud reads as combed hair.
        _dir.x += (Math.random() - 0.5) * 0.06;
        _dir.y += (Math.random() - 0.5) * 0.06;
        _dir.z += (Math.random() - 0.5) * 0.06;
        _dir.normalize();

        const useShort = i % 3 === 0;
        const strand = new THREE.Mesh(
          useShort ? strandGeoShort : strandGeoLong,
          i % 2 === 0 ? fuzzMatA : fuzzMatB,
        );
        strand.quaternion.setFromUnitVectors(_yAxis, _dir);
        // Anchor closer to the tube surface (was 0.7, now 0.55) so strands
        // appear to emerge from within the hair mass rather than floating in
        // space around the tube.
        const tubeR = 0.22;
        strand.position.copy(p)
              .addScaledVector(_radial, tubeR * 0.55);
        // Many hair-strand cones per mustache half — Zerble's main mustache
        // tube already casts the iconic shadow. Skip these.
        tube.add(strand);
      }

      // ----- LEDs along the curve -----
      const steps = 14;
      for (let i = 0; i < steps; i++) {
        const u = i / (steps - 1);
        const p = curve.getPoint(u);
        const hue = LED_HUES[i % LED_HUES.length];
        const ledMat = new THREE.MeshStandardMaterial({
          color: hue,
          emissive: hue,
          emissiveIntensity: 1.7,
        });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.copy(p);
        led.position.y -= 0.18;
        led.userData = { phase: Math.random() * Math.PI * 2, baseIntensity: 1.7, mat: ledMat };
        tube.add(led);
        this._mustacheLeds.push(led);
      }
    }
  }

  // Simple rounded-box-ish geometry. We fake the bevel via BoxGeometry + slight scale on a wrapping shape.
  // For a real bevel we'd use BufferGeometryUtils.mergeVertices on a higher-segment box, but BoxGeometry
  // with flatShading already reads as faceted/low-poly which is the look we want.
  _roundedBoxGeometry(w, h, d /* , r */) {
    return new THREE.BoxGeometry(w, h, d, 2, 1, 2);
  }

  // ---------- UPDATE ----------

  update(dt, input, nightness = 0) {
    // ----- Drive -----
    const throttle = input.throttle;
    const steer = input.steer;
    const wantBoost = input.boost && throttle > 0;
    // Expose so the engine sound (and anything else that cares) can react.
    this.isBoosting = wantBoost;

    const maxFwd = MAX_SPEED * (wantBoost ? BOOST_MULT : 1);
    const maxRev = -REVERSE_MAX;

    if (throttle !== 0) {
      // If throttle opposes current velocity direction, brake harder.
      const sameSign = Math.sign(throttle) === Math.sign(this.speed) || this.speed === 0;
      const a = sameSign ? ACCEL : BRAKE;
      this.speed += throttle * a * dt;
    } else {
      this.speed *= Math.pow(DRAG, dt * 4);
      if (Math.abs(this.speed) < SPEED_SNAP) this.speed = 0;
    }
    this.speed = THREE.MathUtils.clamp(this.speed, maxRev, maxFwd);

    // Steering scales with speed — feels arcade-y and forgiving.
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / 6, 0.2, 1);
    // Steer relative to throttle INTENT, not leftover velocity. Pressing forward
    // re-orients steering to forward-style instantly, even while the cart is still
    // drifting backward after a reverse — kills the "left does the opposite" lag
    // during a reverse→forward direction switch. Falls back to velocity when coasting.
    const dir = throttle !== 0 ? Math.sign(throttle) : (Math.sign(this.speed) || 1);
    this.heading += steer * TURN_RATE * speedFactor * dir * dt;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, steer * 0.35, Math.min(1, dt * 10));

    // Move. Visual rotation in three.js: rotating Object3D by +heading around Y rotates
    // its local -Z (cart's nose) to world (-sin(h), 0, -cos(h)). Movement must match.
    const fx = -Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
    this.root.rotation.y = this.heading;

    // (World is infinite — no clamp. Ground + mountains follow the player.)
    // Cart Y stays at 0 since the followed ground is flattened to a 0-center.
    this.position.y = 0;

    // Cache useful world data for other systems
    this.forwardWorld.set(fx, 0, fz);
    // Nozzle local is (0, 3.0, 2.7) — rotate by heading around Y.
    this.nozzleWorld.set(
      this.position.x + Math.sin(this.heading) * 2.7,
      this.position.y + 3.0,
      this.position.z + Math.cos(this.heading) * 2.7
    );

    // ----- Animate wheels -----
    const wheelAngularSpeed = this.speed / (this._tireR || 0.55); // rad/s, matches tire radius
    for (const w of this.wheels) {
      // Negative: with the tire axis along +X, forward travel (-Z) rolls the
      // wheel tops toward -Z, which is a negative rotation about +X. (Was +=,
      // which made the tires visibly spin backward while driving forward.)
      w.spin.rotation.x -= wheelAngularSpeed * dt;
      // Front wheels steer
      if (w.front) {
        w.group.rotation.y = THREE.MathUtils.lerp(w.group.rotation.y, this.steerAngle, Math.min(1, dt * 10));
      }
      // Tiny bounce to feel alive
      w.group.position.y = w.baseY + Math.sin(performance.now() * 0.01 + w.group.position.x) * 0.02;
    }

    // ----- Animate eyes (idle wobble + look ahead) -----
    // Smaller pupil oscillation (±0.02) keeps the pupil cleanly in front of
    // the iris throughout the cycle.
    const t = performance.now() * 0.001;
    for (const eye of this.eyes) {
      eye.root.position.y = eye.basePos.y + Math.sin(t * 1.5 + eye.basePos.x) * 0.05;
      eye.pupil.position.z = -0.70 + Math.sin(t * 0.7) * 0.02;
      eye.pupil.position.x = Math.sin(t * 0.4) * 0.06;
    }

    // ----- Animate mustache + floor LEDs (rainbow chase) -----
    for (let i = 0; i < this._mustacheLeds.length; i++) {
      const led = this._mustacheLeds[i];
      const phase = led.userData.phase + t * 3 + i * 0.4;
      led.userData.mat.emissiveIntensity = 1.0 + 0.9 * (0.5 + 0.5 * Math.sin(phase));
    }
    if (this._floorLeds) {
      for (let i = 0; i < this._floorLeds.length; i++) {
        const led = this._floorLeds[i];
        const phase = led.userData.phase + t * 4 + i * 0.55;
        led.userData.mat.emissiveIntensity = 1.2 + 1.0 * (0.5 + 0.5 * Math.sin(phase));
      }
    }

    // ----- Wheel-well underglow — slow hue cycle, brightness ramps with night.
    if (this._wellLeds) {
      const wellNight = THREE.MathUtils.smoothstep(nightness, 0.15, 0.7);
      for (let i = 0; i < this._wellLeds.length; i++) {
        const led = this._wellLeds[i];
        const hue = ((t * 0.12) + i * 0.5) % 1;
        const col = _tmpWellColor.setHSL(hue, 0.9, 0.55);
        led.userData.mat.color.copy(col);
        led.userData.mat.emissive.copy(col);
        led.userData.mat.emissiveIntensity =
          0.35 + wellNight * 2.1 * (0.7 + 0.3 * Math.sin(t * 3 + led.userData.phase));
      }
      // Single wash light (mid/high only) — colour tracks the cycle, intensity
      // ramps in after dark so daylight pays nothing.
      if (this._wellLight) {
        this._wellLight.color.copy(_tmpWellColor.setHSL((t * 0.12) % 1, 0.9, 0.55));
        this._wellLight.intensity = wellNight * 4.0 * (0.85 + 0.15 * Math.sin(t * 3));
      }
    }

    // ----- Bubble-machine wand wheel — always turning, faster during a blast.
    if (this._bubbleWheel) {
      this._bubbleWheel.rotation.z += dt * (2.4 + (this._bubbleBlast ? 4.0 : 0));
    }

    // ----- Bubble-machine liquid level + reserve jugs track the juice meter.
    const juice = this._juiceLevel != null ? this._juiceLevel : 1.0;
    if (this._bubbleLiquid) {
      const frac = Math.max(0, Math.min(1, juice));   // working meter (0..1), matches the HUD bar
      const h = Math.max(0.0001, frac * this._liqRange);
      this._bubbleLiquid.scale.y = h;
      this._bubbleLiquid.position.y = this._liqFloorY + h / 2;
      this._bubbleLiquid.visible = frac > 0.01;
    }
    if (this._reserveJugs) {
      // Reserve = whole meters beyond the working one (same as the HUD pips).
      const reserves = Math.max(0, Math.min(this._reserveJugs.length, Math.floor(juice) - 1));
      for (let i = 0; i < this._reserveJugs.length; i++) {
        this._reserveJugs[i].visible = i < reserves;
      }
    }

    // ----- Brake/tail lights — faint red glow by day, brighter at night.
    if (this._brakeLights) {
      const brakeI = 0.5 + nightness * 1.8;
      for (const bl of this._brakeLights) bl.userData.mat.emissiveIntensity = brakeI;
    }

    // ----- Disco light — color cycle + slow spin + nightness-gated spot --
    if (this._disco) {
      // Blast mode (G held): ease toward target so the transition is smooth.
      const blastTarget = this._bubbleBlast ? 1 : 0;
      this._disco.blastLevel += (blastTarget - this._disco.blastLevel) * Math.min(1, dt * 8);
      const bl = this._disco.blastLevel;

      // In blast mode the dome spins faster and the hue cycle accelerates so
      // the strobe is unmistakable. Normal: 0.7 + 2.1; blast: ~2× both.
      this._disco.phase += dt * (0.7 + bl * 1.8);
      this._disco.colorPhase += dt * (2.1 + bl * 4.0);
      this._disco.dome.rotation.y = this._disco.phase;

      // Hue cycle. Blast mode pushes saturation to 1.0 and lightness up so
      // the dome looks like it's "white-hot" rather than tinted.
      const hue = (this._disco.colorPhase * 0.15) % 1;
      const sat = 0.95;
      const lit = 0.55 + bl * 0.30;
      const c = _tmpDiscoColor.setHSL(hue, sat, lit);
      this._disco.domeMat.color.copy(c);
      this._disco.domeMat.emissive.copy(c);
      // Blast strobes the dome much faster + brighter (4-7 vs 1.5-2.1).
      const baseE = 1.5 + Math.sin(t * 5) * 0.6;
      const blastE = 4.0 + Math.sin(t * 18) * 3.0;
      this._disco.domeMat.emissiveIntensity = baseE * (1 - bl) + blastE * bl;

      // SpotLight follows the dome color, intensity scales with night + blast.
      // Blast adds a +14 daytime kicker so the spot is visible even at noon
      // (normal gating ramps from night only). Easy "more bubbles, more party"
      // feedback signal even in bright sun.
      const discoNight = THREE.MathUtils.smoothstep(nightness, 0.2, 0.8);
      this._disco.light.color.copy(c);
      const nightI = discoNight * 6.5 * (0.7 + 0.3 * Math.sin(t * 3 + 1.2));
      const blastI = (3 + Math.abs(Math.sin(t * 14)) * 14) * bl;  // strobing kicker
      this._disco.light.intensity = nightI + blastI;
    }

    // ----- Eye-glow brightness key control (I/O) ----------------------
    // Hold I to ramp up, O to ramp down. Easing: approach target at ~0.65/s
    // so the full 0..1 ramp takes ~1.55s.
    let targetEyeLevel = this.eyeGlowLevel;
    if (Input.isDown('I')) targetEyeLevel = 1.0;
    else if (Input.isDown('O')) targetEyeLevel = 0.0;
    // Hold I/O for ~0.5s to traverse the full 0..1 range. Was 0.65/s
    // (~1.5s full traversal) which felt sluggish to Gary.
    const eyeStep = 2.0 * dt;
    if (this.eyeGlowLevel < targetEyeLevel) {
      this.eyeGlowLevel = Math.min(targetEyeLevel, this.eyeGlowLevel + eyeStep);
    } else if (this.eyeGlowLevel > targetEyeLevel) {
      this.eyeGlowLevel = Math.max(targetEyeLevel, this.eyeGlowLevel - eyeStep);
    }

    // ----- Headlights — much brighter at night -----
    // The bloom pass benefits more from SpotLight intensity than from lamp
    // emissive, so the SpotLight gets the big bump. Lamp lenses still light
    // up so the bulbs read from behind.
    const headlightIntensity = THREE.MathUtils.smoothstep(nightness, 0.25, 0.8) * 8.5;
    if (this._headlightLights) {
      for (const l of this._headlightLights) l.intensity = headlightIntensity;
    }
    if (this._headlightMat) {
      this._headlightMat.emissiveIntensity = 1.2 + nightness * 3.8;
    }
    // ----- Eyes — dramatic I/O range so key presses are visibly impactful -----
    // eyeBase: always-on minimum so the eyes read even at level=0.
    // eyeGlowLevel boost: at level=1 the eyes are MUCH brighter (full bloom).
    // At level=0 only eyeBase remains — dim but visible.
    if (this._eyeGlowMats) {
      // Always-on minimum so eyes read even at level=0. At level=1 eyes are
      // dramatically brighter but stay below blown-out bloom range.
      const eyeBase = 0.10 + nightness * 0.15;
      const intensity = eyeBase + this.eyeGlowLevel * (0.45 + nightness * 0.55);
      for (const m of this._eyeGlowMats) {
        m.emissiveIntensity = intensity;
      }
    }

    // ----- Tick timers -----
    if (this.invulnLeft > 0) this.invulnLeft -= dt;
    if (this.honkCooldown > 0) this.honkCooldown -= dt;
  }

  // Called by main on collision.
  applyHit(pushDir) {
    // Bounce back. Old kickback of -4 m/s combined with soft drag meant
    // ~3 full seconds of unwanted reverse momentum after a bonk —
    // genuinely hard to recover from. Knocked down to -2.5 m/s; combined
    // with the new stronger DRAG, the cart settles back to a stop in
    // ~1.5s instead.
    this.speed = -Math.sign(this.speed || 1) * 2.5;
    this.position.x += pushDir.x * 0.6;
    this.position.z += pushDir.z * 0.6;
    this.invulnLeft = 0.7;
  }

  canHonk() {
    return this.honkCooldown <= 0;
  }

  // Bubble-blast (G key) toggle. Sets a boolean that the disco-light tick
  // eases toward, so the visual ramps in/out smoothly. main.js calls this
  // every frame with Input.isDown('G').
  setBubbleBlast(on) {
    this._bubbleBlast = !!on;
  }

  // Current bubble-juice meter (0..JUICE_STACK_MAX, in meters). Drives the
  // bubble-machine liquid level + how many reserve jugs show under the seat.
  setJuiceLevel(meters) {
    this._juiceLevel = meters;
  }

  honk() {
    // Short cooldown to prevent overlapping ring animations from stomping each
    // other — but low enough that mashing the key feels responsive.
    this.honkCooldown = 0.15;
  }
}
