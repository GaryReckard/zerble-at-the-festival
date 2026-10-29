import {canSmile,resetSmile} from './smilePolicy.js';
// Independent child population: the main loop supplies execution, this owner keeps
// its scene storage, stable identities, queries and lifetime resources.
import * as THREE from 'three';
import {terrainHeight} from '../worldgen/terrain.js';
import {buildKid,tickKid} from '../models/kid.js';
import {projectOutOfLake,isPointInLake} from '../lakes.js';
import {registry} from '../registry.js';
import {DODGE,laneDodgeTest,laneDodgeDir,laneDodgeUrgency,honkScatterParams} from '../steering.js';
import {StarPower} from '../starPower.js';
import {PeopleRuntime} from './runtime.js';
import {PersonHandles} from './personHandle.js';
import {disposeSceneResources} from './sceneResources.js';
import {_pickPositionAvoidingLakes} from './placement.js';
const TAU=Math.PI*2;
const _kidDodgeOut={x:0,z:0};
const KID_SOFT_SEPARATION=1.4,KID_HARD_SEPARATION=.82;

export class KidGaggle {
  constructor({ gaggleCount = 8, runtime = null, key = 'children', collisionOrder=30, honkOrder=20 } = {}) {
    if (!Number.isInteger(gaggleCount) || gaggleCount < 1 || gaggleCount > 8) {
      throw new RangeError('Kid gaggle count must be an integer between 1 and 8.');
    }
    this.group = new THREE.Group();
    this.group.name = 'Kids';
    this.kids = [];
    this.colliders = [];
    this._disposed=false;this.peopleRuntime=runtime??new PeopleRuntime();
    this.ownerToken=this.peopleRuntime.register({key,controller:this,
      schedule:[{slot:'children',run(dt,frame){this.update(dt,frame.bubbles,frame.zerble,frame.smiles);}}],
      capabilities:{honk:this.scatter,colliders:this.appendColliders,nearby:this.forEachPersonNear},
      capabilityOrder:{nearby:collisionOrder,colliders:collisionOrder,honk:honkOrder},
    });
    this.peopleHandles=new PersonHandles({runtime:this.peopleRuntime,ownerToken:this.ownerToken,read:(kid,out)=>this._readPerson(kid,out)});
    this.peopleView=this.peopleHandles.view;

    // Eight gaggles spread across the festival. The anchor-drift logic in
    // update() pulls each kid's center toward Zerble over time, so wherever
    // the player wanders they'll see roughly this many kids around them.
    // Plus the recycle loop below re-anchors kids that lag too far behind.
    // A bounded preview can use one gaggle; default gameplay draws stay unchanged.
    try {
      const GAGGLE_COUNT = gaggleCount;
      const centers = [];
      for (let i = 0; i < GAGGLE_COUNT; i++) {
        const ang = (i / GAGGLE_COUNT) * TAU + Math.random() * 0.3;
        // 25-75m out from origin so gaggles fan out across the visible startup
        // area rather than all clustering near the stages.
        const r = 25 + Math.random() * 50;
        centers.push(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      }

      for (const c of centers) {
        const gaggleSize = 5 + Math.floor(Math.random() * 4);  // 5-8 kids
        for (let i = 0; i < gaggleSize; i++) {
          const k = buildKid();
          k.position.copy(c);
          k.position.x += (Math.random() - 0.5) * 8;
          k.position.z += (Math.random() - 0.5) * 8;
          k.position.y = terrainHeight(k.position.x, k.position.z);
          k.userData.center = c.clone();
          k.userData.heading = Math.random() * TAU;
          // displayedYaw is what actually rotates the mesh — it lerps toward
          // userData.heading instead of snapping. Without this, any time the
          // heading flips ~180° (chasing a bubble that just passed behind
          // them, or hitting a wander-direction reroll), the model would
          // instantly spin around — looked like a glitch.
          k.userData.displayedYaw = k.userData.heading;
          k.userData.turnTimer = Math.random() * 2;
          k.userData.speed = 3 + Math.random() * 2;
          k.userData.chaseTarget = null;
          // Honk-scatter timer: while > 0, the kid runs away from Zerble at
          // FLEE_SPEED. Set by KidGaggle.scatter() (honk) or the trajectory
          // dodge in update() (cart bearing down). fleeUrgency scales the sprint
          // speed: 1 for a passive lane-dodge, up to ~2 for a full-tilt honk.
          k.userData.scatterTimer = 0;
          k.userData.fleeUrgency = 1;
          // Smile state — same model as crowd NPCs (see crowd.js): happiness
          // ramps when near Zerble/bubbles, spawns a smile + resets at the
          // threshold, then needs Zerble to drive SMILE_RESET_DIST away AND
          // SMILE_TIME_COOLDOWN seconds before this kid can smile again. So
          // parking next to a gaggle gets you one smile burst (one per kid),
          // not a cheaty stream.
          k.userData.happiness = 0;
          k.userData.lastSmilePos = null;
          k.userData.smileTimeCooldown = 0;
          this.group.add(k);
          k.userData.personHandle=this.peopleHandles.create(this.kids.length,k);
          this.kids.push(k);
          this.colliders.push({
            position: new THREE.Vector3(),
            radius: 0.6,
            damage: 3,
            kind: 'kid',
          });
        }
      }
    } catch(error) {
      try {this.dispose('construction-failed');} catch(cleanupError) {
        throw new AggregateError([error,cleanupError],'Child construction and cleanup failed.');
      }
      throw error;
    }
  }

  // Honk-scatter trigger called from main.js when the player honks while
  // parked. Any kid within SCATTER_RANGE flees regardless of which side
  // of Zerble they're on — kids spend most of their time clustered
  // *behind* the cart chasing bubbles, so a front-only cone would miss
  // exactly the cohort that needs to scatter. Each kid's pre-aim gets a
  // ±30° random jitter so the gaggle doesn't all run in a perfect radial
  // starburst — looks like real scared kids, not a particle effect.
  scatter(zerble) {
    if (this._disposed || !zerble) return;
    // Speed-scaled like the crowd's honk (steering.js): a parked/slow honk is
    // a polite hop, a full-tilt honk is an urgent scramble that reaches
    // further. Kids cluster behind the cart chasing bubbles, so unlike the
    // crowd this stays all-directions (no front cone) — only reach + urgency
    // scale. Never tighter than the original 12m radius.
    const { frontRange, urgency } = honkScatterParams(zerble.speed || 0);
    const range = Math.max(frontRange, 12);
    const rangeSq = range * range;
    for (const k of this.kids) {
      const dx = k.position.x - zerble.position.x;
      const dz = k.position.z - zerble.position.z;
      if (dx * dx + dz * dz > rangeSq) continue;
      k.userData.scatterTimer = 1.2;
      k.userData.fleeUrgency = urgency;
      // Pre-aim away from Zerble + ±30° jitter so the scatter pattern
      // isn't a perfect starburst.
      const baseHeading = Math.atan2(dx, -dz);
      k.userData.heading = baseHeading + (Math.random() - 0.5) * (Math.PI / 3);
      k.userData.turnTimer = 0.8;
    }
  }

  get populationSize(){return this.kids.length;}
  inspect(out) {out.population=this.kids.length;out.disposed=this._disposed;}

  _readPerson(kid,out) {
    out.x=kid.position.x;out.y=kid.position.y;out.z=kid.position.z;
    out.heading=kid.userData.heading;out.state=kid.userData.scatterTimer>0?'scattering':'playing';
    out.grouped=true;out.hidden=!kid.visible;
  }
  readPerson(handle,out) {return this.peopleView.read(handle,out);}
  forEachPersonNear(x,z,radius,visit,queryScratch=null) {
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<0||typeof visit!=='function')throw new TypeError('Invalid nearby-person query.');
    if(this._disposed)return;
    const scratch=queryScratch??(this._personQueryScratch??={});
    for(const kid of this.kids){
      const distance=Math.hypot(kid.position.x-x,kid.position.z-z);
      if(distance>=radius)continue;
      this.peopleHandles.readOwnedRecord(kid,scratch);
      if(visit(kid.userData.personHandle,scratch,distance)===false)return;
    }
  }
  appendColliders(out) {if(!this._disposed)for(const collider of this.colliders)out.push(collider);}

  dispose(reason='population-disposed') {
    if(this._disposed)return;this._disposed=true;
    const errors=[],release=fn=>{try{fn();}catch(error){errors.push(error);}};
    if(this.peopleRuntime.isRegistered(this.ownerToken))release(()=>this.peopleRuntime.unregister(this.ownerToken,reason));
    release(()=>this.peopleHandles.dispose());
    release(()=>disposeSceneResources(this.group));
    this.group.removeFromParent();this.kids.length=0;this.colliders.length=0;
    if(errors.length)throw new AggregateError(errors,'Children teardown failed.');
  }

  // dt: frame delta. bubbles/zerble are optional — when present, kids go
  // gaga for bubbles (steer toward the nearest one) and the whole gaggle
  // slowly drifts toward wherever Zerble is so they don't get stuck at
  // their birth anchor once he's wandered off. When `smiles` is also
  // passed, a kid who catches a bubble (gets within BUBBLE_GRAB_RANGE)
  // spawns a smile at their position — that's the joy moment that earns
  // the player a point. Per-kid cooldown prevents one bubble-popping kid
  // from spamming smiles every frame they're inside the grab radius.
  update(dt, bubbles, zerble, smiles) {
    if(this._disposed)return;
    // Recycle kids whose position has fallen far behind Zerble. The anchor
    // lerp drags centers toward the player but individual wandering can
    // still leave a kid stranded after a fast drive. Mirrors the wook
    // recycle behavior — re-anchor to a fresh spot 30-80m around Zerble.
    if (zerble) {
      const RECYCLE_DIST2 = 200 * 200;
      const RECYCLE_NEAR = 30;
      const RECYCLE_FAR  = 80;
      for (const k of this.kids) {
        const ddx = k.position.x - zerble.position.x;
        const ddz = k.position.z - zerble.position.z;
        if (ddx * ddx + ddz * ddz > RECYCLE_DIST2) {
          const p = _pickPositionAvoidingLakes(
            zerble.position.x, zerble.position.z, RECYCLE_NEAR, RECYCLE_FAR,
          );
          k.position.set(p.x, 0, p.z);
          k.userData.center.set(p.x, 0, p.z);
          k.userData.scatterTimer = 0;
        }
      }
    }

    // Per-frame safety net: any kid that ended up inside a lake (slow drift
    // pushed them past the steering repulsion, or the anchor follow-Zerble
    // lerp dropped them into a lobe) gets projected to the shore. Cheap
    // bounding-circle reject first, then exact in-outline check via
    // isPointInLake; only a handful of kids will ever hit this fallback.
    for (const k of this.kids) {
      if (isPointInLake(k.position.x, k.position.z)) {
        const shore = projectOutOfLake(k.position.x, k.position.z, 3.0);
        if (shore) {
          k.position.x = shore.x;
          k.position.z = shore.z;
          // Re-anchor so they don't immediately wander back in.
          k.userData.center.x = shore.x;
          k.userData.center.z = shore.z;
        }
      }
    }

    // Ground before bubble/smile height queries, including recycled children.
    for (const kid of this.kids) kid.position.y = terrainHeight(kid.position.x, kid.position.z);

    // Collect live bubble positions once per frame so we don't iterate the
    // whole pool inside every kid's loop.
    const bubblePositions = [];
    if (bubbles) bubbles.forEachAlive((b) => bubblePositions.push(b.pos));

    // Kid gaggles drift their anchor toward Zerble so they follow him
    // around the festival. The pull is stronger when Zerble is parked
    // (lerp ~3× faster) so the gaggle actually congregates around him for
    // bubble play instead of lagging way behind. Anchor TARGETS the bubble
    // vent (zerble.nozzleWorld), not the cart center — that way wander
    // naturally happens around the back where the bubbles spawn, without
    // forcing kids onto an explicit orbit. They still chase any bubble in
    // range; if no bubble is near, they just play / mill around behind.
    const REST_SPEED = 0.5;                // |zerble.speed| below this = parked
    const isParked = zerble && Math.abs(zerble.speed || 0) < REST_SPEED;
    if (zerble) {
      const targetX = isParked && zerble.nozzleWorld ? zerble.nozzleWorld.x : zerble.position.x;
      const targetZ = isParked && zerble.nozzleWorld ? zerble.nozzleWorld.z : zerble.position.z;
      const lerpRate = isParked ? 0.8 : 0.25;
      const lerpAmt = Math.min(1, dt * lerpRate);
      for (const k of this.kids) {
        k.userData.center.x += (targetX - k.userData.center.x) * lerpAmt;
        k.userData.center.z += (targetZ - k.userData.center.z) * lerpAmt;
      }
    }

    const BUBBLE_ATTRACT_RANGE = 9;        // start chasing a bubble within this
    const BUBBLE_GRAB_RANGE = 0.7;         // close enough to "play with" it
    const BUBBLE_ATTRACT_SPEED = 4.2;      // sprint speed when chasing
    const FLEE_SPEED = 5.0;                // honk-scatter sprint speed
    // Smile economy — mirrors crowd.js. A kid must be within KID_SMILE_RANGE
    // of Zerble (or right next to a bubble) for happiness to accrue; smile
    // fires when happiness crosses KID_HAPPINESS_THRESHOLD, then locks out
    // until Zerble has driven KID_SMILE_RESET_DIST away AND the time
    // cooldown elapses.
    const KID_HAPPINESS_THRESHOLD = 0.7;
    const KID_SMILE_RANGE = 12;
    const KID_SMILE_RESET_DIST = 28;
    const KID_SMILE_TIME_COOLDOWN = 3;
    const KID_BUBBLE_GAIN_RANGE = 1.5;     // bubble must be within this for gain
    const KID_BUBBLE_GAIN = 0.6;           // happiness/sec at point-blank to a bubble
    const KID_PROXIMITY_GAIN = 0.4;        // happiness/sec next to Zerble (linear falloff)
    // Star power suppresses fleeing (everyone's smitten) — same rule as the crowd.
    const dodgeOk = zerble && !!zerble.forwardWorld && !StarPower.isActive();

    for (let i = 0; i < this.kids.length; i++) {
      const k = this.kids[i];

      // ---- Find nearest live bubble (if any) ----
      let chaseD = Infinity, nearestTarget = null, trackedD = Infinity;
      for (const bp of bubblePositions) {
        const dx = bp.x - k.position.x;
        const dz = bp.z - k.position.z;
        const d = Math.hypot(dx, dz);
        if (d < chaseD && d < BUBBLE_ATTRACT_RANGE) {
          chaseD = d; nearestTarget = bp;
        }
        if (bp === k.userData.chaseTarget) trackedD = d;
      }
      // Keep a real target, rather than blending old and new directions.
      // A new bubble must be appreciably closer before the kid switches.
      if (trackedD >= BUBBLE_ATTRACT_RANGE || chaseD + 0.8 < trackedD) {
        k.userData.chaseTarget = nearestTarget;
      }
      const target = k.userData.chaseTarget;
      const targetDx = target ? target.x - k.position.x : 0;
      const targetDz = target ? target.z - k.position.z : 0;
      const targetD = target === nearestTarget ? chaseD : trackedD;

      // Tick scatter timer first so the test below sees a fresh value.
      if (k.userData.scatterTimer > 0) k.userData.scatterTimer -= dt;
      if (k.userData.smileTimeCooldown > 0) k.userData.smileTimeCooldown -= dt;

      // Trajectory dodge — if not already scattering and a cart's bearing down
      // at speed, sidestep out of its lane (shared corridor test with the
      // crowd). Personality-independent; overrides bubble-chase below since it
      // sets scatterTimer. fleeUrgency 1 = calm (a honk would raise it).
      if (dodgeOk && k.userData.scatterTimer <= 0) {
        const toX = k.position.x - zerble.position.x;
        const toZ = k.position.z - zerble.position.z;
        if (laneDodgeTest(toX, toZ, zerble.forwardWorld.x, zerble.forwardWorld.z, zerble.speed)) {
          laneDodgeDir(toX, toZ, zerble.forwardWorld.x, zerble.forwardWorld.z, (i & 1) === 1, _kidDodgeOut);
          k.userData.heading = Math.atan2(_kidDodgeOut.x, -_kidDodgeOut.z);
          k.userData.scatterTimer = DODGE.LOCK;
          k.userData.fleeUrgency = laneDodgeUrgency(zerble.speed);
          k.userData.turnTimer = DODGE.LOCK;   // hold the dodge heading, don't re-wander mid-step
        }
      }

      const fleeing = k.userData.scatterTimer > 0 && zerble;

      // Smile economy — same model as crowd NPCs in crowd.js. Gates:
      //   1. Time cooldown elapsed (3s since last smile from this kid)
      //   2. Zerble has moved at least RESET_DIST from where this kid last
      //      smiled, OR this kid has never smiled
      //   3. Kid is within SMILE_RANGE of Zerble (so they're "with" him)
      // Then happiness ramps with proximity + nearby bubbles. When it
      // crosses threshold, spawn a smile and reset.
      if (smiles && zerble && !fleeing) {
        const dxZ = k.position.x - zerble.position.x;
        const dzZ = k.position.z - zerble.position.z;
        const dToZerble = Math.hypot(dxZ, dzZ);
        if (
          canSmile(k.userData,zerble.position,dToZerble,KID_SMILE_RANGE,KID_SMILE_RESET_DIST)
        ) {
          let gain = 0;
          // Proximity to Zerble — linear falloff over SMILE_RANGE
          gain += KID_PROXIMITY_GAIN * (1 - dToZerble / KID_SMILE_RANGE);
          // Nearest bubble bonus: if any live bubble is within
          // KID_BUBBLE_GAIN_RANGE, add proportional gain. Caps even if
          // multiple bubbles are nearby — kids are excited about bubbles,
          // not exponentially.
          // The chase search covers the smaller happiness range before movement.
          if (chaseD < KID_BUBBLE_GAIN_RANGE) {
            gain += KID_BUBBLE_GAIN * (1 - chaseD / KID_BUBBLE_GAIN_RANGE);
          }
          k.userData.happiness += gain * dt;
          if (k.userData.happiness >= KID_HAPPINESS_THRESHOLD) {
            resetSmile(k.userData,zerble.position,KID_SMILE_TIME_COOLDOWN);
            smiles.spawn(k.position);
          }
        } else {
          // Out of range / on cooldown — decay happiness slowly
          k.userData.happiness = Math.max(0, k.userData.happiness - dt * 0.2);
        }
      }

      if (fleeing) {
        // Run away from Zerble. Lock heading on entry (set by scatter() or the
        // trajectory dodge) and just sprint along it. fleeUrgency scales the
        // speed: 1 for a passive lane-dodge, up to ~2 for a full-tilt honk.
        const fleeSpeed = FLEE_SPEED * (k.userData.fleeUrgency || 1);
        k.position.x += Math.sin(k.userData.heading) * fleeSpeed * dt;
        k.position.z += -Math.cos(k.userData.heading) * fleeSpeed * dt;
      } else if (target) {
        // Stop at arm's reach. Crossing that radius used to enter wander
        // immediately, which sent the kid out and back every few frames.
        if (targetD > BUBBLE_GRAB_RANGE) {
          const step = Math.min(BUBBLE_ATTRACT_SPEED * dt, targetD - BUBBLE_GRAB_RANGE);
          k.userData.heading = Math.atan2(targetDx, -targetDz);
          k.userData.turnTimer = 0.4;
          k.position.x += targetDx / targetD * step;
          k.position.z += targetDz / targetD * step;
        }
      } else {
        // Default wander behavior with periodic course changes
        k.userData.turnTimer -= dt;
        if (k.userData.turnTimer <= 0) {
          k.userData.heading += (Math.random() - 0.5) * 1.8;
          k.userData.turnTimer = 0.5 + Math.random() * 1.5;
        }

        const dx = Math.sin(k.userData.heading);
        const dz = -Math.cos(k.userData.heading);
        k.position.x += dx * k.userData.speed * dt;
        k.position.z += dz * k.userData.speed * dt;

        // Stay within ~12m of their gaggle center
        const cx = k.position.x - k.userData.center.x;
        const cz = k.position.z - k.userData.center.z;
        const cd = Math.hypot(cx, cz);
        if (cd > 12) {
          k.userData.heading = Math.atan2(-cx, cz) + (Math.random() - 0.5) * 0.4;
        }
      }

      // ---- Respect hard colliders (stages, food trucks, tents, etc.) ----
      // Push the kid radially out of any collider they overlap. Also nudge
      // their heading away so they don't keep marching into the same wall
      // every frame. Kid radius treated as 0.4m for the overlap check.
      pushOutOfHardColliders(k, 0.4);

      // Children can share a bubble target, so add a small personal-space
      // nudge after their goal movement. The hard pass below is the guarantee
      // that a crowded gaggle cannot collapse into one point.
      nudgeKidFromNeighbors(this.kids, i, dt);

      // Visual animation (smooth yaw + bounce) lives in tickKid so the
      // sandbox and game can't drift apart. See models/kid.js.


    }

    // Resolve all pair overlaps after movement, including exact coincidences
    // where a direction cannot be derived from the positions. Bounded passes
    // let dense groups settle; ordinary frames exit as soon as no correction
    // is needed, without adding allocations or a frame-sized lag.
    for (let pass = 0; pass < 128; pass++) {
      let foundOverlap = false;
      for (let i = 0; i < this.kids.length; i++) {
        const a = this.kids[i].position;
        for (let j = i + 1; j < this.kids.length; j++) {
          const b = this.kids[j].position;
          let dx = a.x - b.x, dz = a.z - b.z;
          let d2 = dx * dx + dz * dz;
          // Leave a sub-millimeter tolerance so floating-point settling does
          // not burn the full iteration cap chasing an exact boundary.
          const resolveDistance = KID_HARD_SEPARATION - 0.0005;
          if (d2 >= resolveDistance * resolveDistance) continue;
          foundOverlap = true;
          let d;
          if (d2 < 1e-10) {
            // Stable pair-specific direction prevents RNG jitter and gives
            // coincident kids opposite, deterministic correction vectors.
            const angle = ((i * 31 + j * 17) % 360) * (Math.PI / 180);
            dx = Math.cos(angle); dz = Math.sin(angle); d = 0;
          } else {
            d = Math.sqrt(d2);
            dx /= d; dz /= d;
          }
          const push = (KID_HARD_SEPARATION - d) * 0.5;
          a.x += dx * push; a.z += dz * push;
          b.x -= dx * push; b.z -= dz * push;
        }
      }
      // Pair corrections can cross a lake shore or a hard world collider.
      // Reapply those constraints before deciding this pass has settled.
      let worldCorrection = false;
      for (const kid of this.kids) {
        const x = kid.position.x, z = kid.position.z;
        if (isPointInLake(x, z)) {
          const shore = projectOutOfLake(x, z, 3.0);
          if (shore) {
            kid.position.x = shore.x;
            kid.position.z = shore.z;
          }
        }
        pushOutOfHardColliders(kid, 0.4, false);
        if (kid.position.x !== x || kid.position.z !== z) worldCorrection = true;
      }
      if (!foundOverlap && !worldCorrection) break;
    }
    // The broad-phase/player colliders must follow the final resolved poses.
    for (let i = 0; i < this.kids.length; i++) {
      const kid = this.kids[i];
      kid.position.y = terrainHeight(kid.position.x, kid.position.z);
      tickKid(kid,dt,{excited:!!kid.userData.chaseTarget,targetYaw:kid.userData.heading});
      this.colliders[i].position.copy(kid.position);
      this.colliders[i].position.y += 0.6;
    }
  }
}

// Soft repulsion keeps shared-target chasing from continually pressing kids
// into one another. The final pair pass in KidGaggle.update is the hard floor.
function nudgeKidFromNeighbors(kids, index, dt) {
  const kid = kids[index];
  let sx = 0, sz = 0, count = 0;
  for (let j = 0; j < kids.length; j++) {
    if (j === index) continue;
    const other = kids[j];
    let dx = kid.position.x - other.position.x;
    let dz = kid.position.z - other.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= KID_SOFT_SEPARATION * KID_SOFT_SEPARATION) continue;
    let d;
    if (d2 < 1e-10) {
      const angle = ((index * 31 + j * 17) % 360) * (Math.PI / 180);
      dx = Math.cos(angle); dz = Math.sin(angle); d = 0;
    } else {
      d = Math.sqrt(d2);
      dx /= d; dz /= d;
    }
    const weight = (KID_SOFT_SEPARATION - d) / KID_SOFT_SEPARATION;
    sx += dx * weight; sz += dz * weight; count++;
  }
  const length = Math.hypot(sx, sz);
  if (count && length > 1e-5) {
    const step = Math.min(0.025, dt * 0.9);
    kid.position.x += sx / length * step;
    kid.position.z += sz / length * step;
  }
}

// Push a kid (or any small object with .position + .userData.heading) out
// of every registry collider it currently overlaps. Mutates position +
// flips heading so the next step isn't right back into the wall.
function pushOutOfHardColliders(obj, kidRadius, adjustHeading = true) {
  // Localized: only colliders in nearby cells (reach padded internally by the
  // registry's max collider radius). Same overlap-resolve math as the old full
  // registry.colliders() scan.
  registry.collidersNear(obj.position.x, obj.position.z, kidRadius, (c) => {
    const r = c.collider.radius;
    const dx = obj.position.x - c.position.x;
    const dz = obj.position.z - c.position.z;
    const minD = r + kidRadius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minD * minD) return;
    const d = Math.sqrt(d2) || 0.001;
    const inv = 1 / d;
    // Hard-resolve the overlap so the kid is exactly outside the radius.
    const overlap = minD - d;
    obj.position.x += dx * inv * overlap;
    obj.position.z += dz * inv * overlap;
    // Aim their next step outward + jitter so they don't stutter against
    // the surface.
    if (adjustHeading && obj.userData) {
      obj.userData.heading = Math.atan2(dx * inv, -dz * inv)
        + (Math.random() - 0.5) * 0.6;
      obj.userData.turnTimer = 0.3 + Math.random() * 0.4;
    }
  });
}
