// Frozen pre-ownership pair/disc controller for Task 2.12 differential verification.
// Verification only; never imported by the game.
const TAU=Math.PI*2;
const FRISBEE_PAIR_COUNT = 5;
const FRISBEE_PLAYER_SEPARATION_MIN = 10;
const FRISBEE_PLAYER_SEPARATION_MAX = 18;
const FRISBEE_RECYCLE_MIN = 35;
const FRISBEE_RECYCLE_MAX = 90;
const FRISBEE_RECYCLE_DIST2 = 200 * 200;
const FRISBEE_TOSS_SPEED = 9.5;            // horizontal m/s
const FRISBEE_TOSS_GRAVITY = 9.8;          // m/s²
const FRISBEE_CATCH_RADIUS = 0.7;
const FRISBEE_AIM_JITTER = 0.20;           // rad — toss aim spread
const FRISBEE_PLAYER_SPEED = 2.6;          // m/s — how fast they chase the landing spot

export class Frisbees {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Frisbees';
    this.pairs = [];
    this.colliders = [];

    for (let i = 0; i < FRISBEE_PAIR_COUNT; i++) {
      const pair = this._buildPair();
      this.group.add(pair.playerA);
      this.group.add(pair.playerB);
      this.group.add(pair.disc);
      this.pairs.push(pair);
      // One soft collider per player so Zerble bumps them as he would a regular person
      for (const p of [pair.playerA, pair.playerB]) {
        const col = {
          position: new THREE.Vector3(),
          radius: 0.5,
          damage: 1,
          kind: 'person',
        };
        p.userData.collider = col;
        this.colliders.push(col);
      }
      // Place this pair far away initially; the first update will recycle them near Zerble.
      pair.anchor.set(9999, 0, 9999);
      pair.playerA.position.copy(pair.anchor);
      pair.playerB.position.copy(pair.anchor);
      pair.disc.position.copy(pair.anchor);
    }
  }

  _buildPair() {
    const playerA = buildFrisbeePlayer();
    const playerB = buildFrisbeePlayer();
    const disc = buildFrisbeeDisc();
    const pauseTimer = 1 + Math.random() * 1.5;
    return {
      playerA,
      playerB,
      disc,
      anchor: new THREE.Vector3(),
      // disc state: 'flying' (in the air toward target), 'held' (resting in
      // the thrower's hand position), 'landed' (on the ground awaiting catcher arrival)
      discState: 'held',
      discHolder: playerA,
      discCatcher: playerB,
      // Where the disc is headed if 'flying' / where it landed if 'landed':
      target: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      // Catch/toss timing
      pauseTimer,
      pauseDuration: pauseTimer,
      // The catcher's own predicted-landing spot (recomputed each frame while flying)
      catcherTarget: new THREE.Vector3(),
      handPosition: new THREE.Vector3(),
    };
  }

  update(dt, zerblePos, nightness = 0) {
    // Recycle pairs that drifted too far from Zerble
    if (zerblePos) {
      for (const p of this.pairs) {
        const dx = p.anchor.x - zerblePos.x;
        const dz = p.anchor.z - zerblePos.z;
        if (dx * dx + dz * dz > FRISBEE_RECYCLE_DIST2) this._recycle(p, zerblePos);
      }
    }

    const tMs = performance.now() * 0.001;

    for (const p of this.pairs) {
      let actionA = 'relaxed';
      let actionB = 'relaxed';
      let amountA = 0;
      let amountB = 0;

      if (p.discState === 'held') {
        const duration = Math.min(0.72, p.pauseDuration || p.pauseTimer || 0.72);
        const throwPhase = THREE.MathUtils.clamp(1 - p.pauseTimer / duration, 0, 1);
        if (p.discHolder === p.playerA) {
          actionA = 'throw';
          amountA = throwPhase;
        } else {
          actionB = 'throw';
          amountB = throwPhase;
        }
      } else if (p.discState === 'flying') {
        const dx = p.disc.position.x - p.discCatcher.position.x;
        const dz = p.disc.position.z - p.discCatcher.position.z;
        const reach = THREE.MathUtils.clamp(1 - Math.hypot(dx, dz) / 3, 0, 1);
        if (p.discCatcher === p.playerA) {
          actionA = 'catch';
          amountA = reach;
        } else {
          actionB = 'catch';
          amountB = reach;
        }
      }

      p.playerA.position.y = terrainHeight(p.playerA.position.x, p.playerA.position.z);
      p.playerB.position.y = terrainHeight(p.playerB.position.x, p.playerB.position.z);
      tickFrisbeePlayer(p.playerA, dt, actionA, amountA);
      tickFrisbeePlayer(p.playerB, dt, actionB, amountB);
      tickFrisbeeDisc(p.disc, dt, p.discState, nightness);

      // Face each other (or the disc, if flying/landed)
      const lookAt = (player, tx, tz) => {
        player.rotation.y = Math.atan2(tx - player.position.x, tz - player.position.z) + Math.PI;
      };

      if (p.discState === 'held') {
        // Players look at each other while waiting
        lookAt(p.playerA, p.playerB.position.x, p.playerB.position.z);
        lookAt(p.playerB, p.playerA.position.x, p.playerA.position.z);
        getFrisbeeHandPosition(p.discHolder, p.handPosition);
        p.disc.position.copy(p.handPosition);

        p.pauseTimer -= dt;
        if (p.pauseTimer <= 0) this._toss(p);
      } else if (p.discState === 'flying') {
        // Integrate disc with simple ballistic motion against the shared terrain surface.
        p.disc.position.x += p.vel.x * dt;
        p.disc.position.y += p.vel.y * dt;
        p.disc.position.z += p.vel.z * dt;
        p.vel.y -= FRISBEE_TOSS_GRAVITY * dt * 0.6;     // softer gravity so the arc reads slow + floaty

        // Update catcher's predicted landing spot. We solve for time-to-hit-y≈0.4
        // (catch height ≈ 0.4m above ground) using current vel.y and y.
        //   y(t) = y + vy*t − 0.5*g*t²   →  solve for catch height
        const g = FRISBEE_TOSS_GRAVITY * 0.6;
        const catchY = terrainHeight(p.discCatcher.position.x, p.discCatcher.position.z) + 0.4;
        const vy = p.vel.y;
        const y0 = p.disc.position.y;
        // Quadratic: −0.5*g*t² + vy*t + (y0 − catchY) = 0
        const A = -0.5 * g;
        const B = vy;
        const C = y0 - catchY;
        const disc = B * B - 4 * A * C;
        let tHit = 0;
        if (disc >= 0) {
          const r1 = (-B - Math.sqrt(disc)) / (2 * A);
          const r2 = (-B + Math.sqrt(disc)) / (2 * A);
          // Pick the smallest positive root. If both roots are non-positive
          // (the disc has already passed the catch height going down), leave
          // tHit at 0 so catcherTarget falls back to disc.position rather
          // than computing position + vel * Infinity, which propagates NaN.
          const candidates = [];
          if (r1 > 0 && isFinite(r1)) candidates.push(r1);
          if (r2 > 0 && isFinite(r2)) candidates.push(r2);
          if (candidates.length) tHit = Math.min(...candidates);
        }
        p.catcherTarget.set(
          p.disc.position.x + p.vel.x * tHit,
          0,
          p.disc.position.z + p.vel.z * tHit,
        );

        // Catcher walks toward the predicted landing spot
        const dx = p.catcherTarget.x - p.discCatcher.position.x;
        const dz = p.catcherTarget.z - p.discCatcher.position.z;
        const dPlanar = Math.hypot(dx, dz);
        if (dPlanar > 0.05) {
          const inv = 1 / dPlanar;
          const step = Math.min(dPlanar, FRISBEE_PLAYER_SPEED * dt);
          p.discCatcher.position.x += dx * inv * step;
          p.discCatcher.position.z += dz * inv * step;
        }
        // Catcher faces the disc; holder stays still but turns to track
        lookAt(p.discCatcher, p.disc.position.x, p.disc.position.z);
        lookAt(p.discHolder, p.disc.position.x, p.disc.position.z);

        // Check catch: disc within radius of catcher's hand area
        const dxD = p.disc.position.x - p.discCatcher.position.x;
        const dzD = p.disc.position.z - p.discCatcher.position.z;
        const planarHand = Math.hypot(dxD, dzD);
        if (
          p.disc.position.y < terrainHeight(p.discCatcher.position.x, p.discCatcher.position.z) + 1.7 &&
          p.disc.position.y > terrainHeight(p.discCatcher.position.x, p.discCatcher.position.z) + 0.6 &&
          planarHand < FRISBEE_CATCH_RADIUS
        ) {
          // Caught! Swap roles, brief pause, then toss back.
          this._catch(p);
        } else if (p.disc.position.y <= terrainHeight(p.disc.position.x, p.disc.position.z) + 0.05) {
          // Hit the ground — disc lies there, catcher walks over to pick it up
          p.disc.position.y = terrainHeight(p.disc.position.x, p.disc.position.z) + 0.05;
          p.discState = 'landed';
          p.target.set(p.disc.position.x, 0, p.disc.position.z);
        }
      } else if (p.discState === 'landed') {
        // Catcher walks to the disc, picks it up, then becomes the holder.
        const dx = p.disc.position.x - p.discCatcher.position.x;
        const dz = p.disc.position.z - p.discCatcher.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7) {
          // Pick up — disc becomes "held", swap roles.
          const oldHolder = p.discHolder;
          p.discHolder = p.discCatcher;
          p.discCatcher = oldHolder;
          p.discState = 'held';
          p.pauseTimer = 0.8 + Math.random() * 1.2;
          p.pauseDuration = p.pauseTimer;
        } else {
          const inv = 1 / d;
          const step = Math.min(d, FRISBEE_PLAYER_SPEED * dt);
          p.discCatcher.position.x += dx * inv * step;
          p.discCatcher.position.z += dz * inv * step;
        }
        lookAt(p.discCatcher, p.disc.position.x, p.disc.position.z);
        lookAt(p.discHolder, p.discCatcher.position.x, p.discCatcher.position.z);
      }

      p.playerA.position.y = terrainHeight(p.playerA.position.x, p.playerA.position.z);
      p.playerB.position.y = terrainHeight(p.playerB.position.x, p.playerB.position.z);
      // Update collider positions
      if (p.playerA.userData.collider) {
        p.playerA.userData.collider.position.copy(p.playerA.position);
        p.playerA.userData.collider.position.y += 0.9;
      }
      if (p.playerB.userData.collider) {
        p.playerB.userData.collider.position.copy(p.playerB.position);
        p.playerB.userData.collider.position.y += 0.9;
      }
    }
  }

  _toss(p) {
    // Aim at catcher with a small angular jitter so the toss doesn't always
    // land in their lap. The disc starts at the animated throwing hand.
    const fromX = p.disc.position.x;
    const fromZ = p.disc.position.z;
    const toX = p.discCatcher.position.x;
    const toZ = p.discCatcher.position.z;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const baseAng = Math.atan2(dx, dz);
    const jitter = (Math.random() - 0.5) * 2 * FRISBEE_AIM_JITTER;
    const ang = baseAng + jitter;
    const dist = Math.hypot(dx, dz);
    // Add a small undershoot/overshoot to the planar speed as well, so the
    // disc can land short or long, not just left/right.
    const speedFactor = 0.85 + Math.random() * 0.35;     // 0.85..1.20
    const planarSpeed = FRISBEE_TOSS_SPEED * speedFactor;
    p.vel.set(
      Math.sin(ang) * planarSpeed,
      4.5 + Math.random() * 1.6,    // lob upward
      Math.cos(ang) * planarSpeed,
    );
    p.discState = 'flying';
  }

  _catch(p) {
    // Disc goes back in the catcher's hand; roles swap; pause then toss back.
    const oldHolder = p.discHolder;
    p.discHolder = p.discCatcher;
    p.discCatcher = oldHolder;
    p.discState = 'held';
    p.pauseTimer = 0.7 + Math.random() * 1.0;
    p.pauseDuration = p.pauseTimer;
  }

  _recycle(p, zerblePos) {
    // Place the pair at a random nearby spot, oriented at a random angle,
    // with each player FRISBEE_PLAYER_SEPARATION_MIN..MAX apart. Reject anchors
    // on water — a pair playing catch in the middle of a lake looked broken
    // (Gary 2026-06-16). Try a few angles; the band loop already does the same
    // via pickLakeFreePosition, the frisbee recycle just never did.
    let cx, cz;
    for (let attempt = 0; attempt < 6; attempt++) {
      const ang = Math.random() * TAU;
      const dist = FRISBEE_RECYCLE_MIN + Math.random() * (FRISBEE_RECYCLE_MAX - FRISBEE_RECYCLE_MIN);
      cx = zerblePos.x + Math.cos(ang) * dist;
      cz = zerblePos.z + Math.sin(ang) * dist;
      if (!isPointInLake(cx, cz)) break;
    }
    p.anchor.set(cx, 0, cz);
    const sep = FRISBEE_PLAYER_SEPARATION_MIN +
      Math.random() * (FRISBEE_PLAYER_SEPARATION_MAX - FRISBEE_PLAYER_SEPARATION_MIN);
    const pairAng = Math.random() * TAU;
    p.playerA.position.set(cx + Math.cos(pairAng) * sep * 0.5, 0, cz + Math.sin(pairAng) * sep * 0.5);
    p.playerB.position.set(cx - Math.cos(pairAng) * sep * 0.5, 0, cz - Math.sin(pairAng) * sep * 0.5);
    p.playerA.position.y = terrainHeight(p.playerA.position.x, p.playerA.position.z);
    p.playerB.position.y = terrainHeight(p.playerB.position.x, p.playerB.position.z);
    p.discHolder = p.playerA;
    p.discCatcher = p.playerB;
    p.discState = 'held';
    p.pauseTimer = 0.6 + Math.random() * 1.4;
    p.pauseDuration = p.pauseTimer;
    getFrisbeeHandPosition(p.playerA, p.handPosition);
    p.disc.position.copy(p.handPosition);
  }
}
