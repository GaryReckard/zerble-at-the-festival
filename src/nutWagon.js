import * as THREE from 'three';
import {seatBoInWagon} from './models/bo.js';
import {buildNutWagon, setNutWagonNightness, NUT_WAGON_MOUNTS} from './models/nutWagon.js';
import {registry} from './registry.js';
import {nearestHeart} from './worldgen/hearts.js';
import {approachRoadsOf} from './worldgen/roads.js';
import {lakeAt} from './worldgen/water.js';
import {mulberry32, getSessionSeed} from './rng.js';
import {Sound} from './sound.js';
import {NUT_WAGON_TUNING as T, wagonRoutes, sampleWagonRoute, wagonOverlapsCircle, wagonTouchesWater} from './nutWagonRoute.js';

export class NutWagon {
  constructor(scene, crowd, {music = true} = {}) {
    this.scene = scene; this.crowd = crowd; this.musicEnabled = music;
    this.root = null; this.position = new THREE.Vector3(); this.heading = 0;
    this.speed = 0; this.waitReason = null; this.active = false; this.state = 'absent';
    this.rng = mulberry32((getSessionSeed() ^ 0x6e775731) >>> 0);
    this.encounterTimer = 8; this.wasTrip = false; this.ids = []; this.colliders = [];
    this.seatSlots = []; this.sample = {}; this.nextSample = {};
    this._frustum = new THREE.Frustum(); this._matrix = new THREE.Matrix4();
    this._sphere = new THREE.Sphere(new THREE.Vector3(), 8);
    this.clock = 0; this.boardTimer = 0; this.gatherTimer = 0; this.gatheringStop = false;
    this.lastStop = new THREE.Vector3();
  }

  clearAt(x, z, yaw = this.root?.rotation.y || 0) {
    if (wagonTouchesWater(x, z, yaw, lakeAt)) return false;
    let clear = true;
    registry.collidersNear(x, z, 6, e => {
      if (e.kind === 'nut_wagon' || e.kind === 'lurleen' || e.kind === 'puppet' || e.kind === 'brass_band') return;
      if (wagonOverlapsCircle(x, z, yaw, e.position.x, e.position.z, e.collider.radius)) clear = false;
    });
    return clear;
  }

  trySpawn(player, camera = null, force = false) {
    if (this.active) return true;
    const {heart} = nearestHeart(player.x, player.z);
    if (!heart) return false;
    const routes = wagonRoutes(approachRoadsOf(heart).map(r => r.oriented), player, (x, z, yaw) => this.clearAt(x, z, yaw) && this.clearAt(x, z, yaw + Math.PI));
    if (camera) this._frustum.setFromProjectionMatrix(this._matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const candidates = [];
    for (const route of routes) {
      for (let d = 5; d < route.length - 5; d += 8) {
        sampleWagonRoute(route, d, this.sample);
        const dist = Math.hypot(this.sample.x - player.x, this.sample.z - player.z);
        if (dist < (force ? 12 : T.spawnMin) || dist > T.spawnMax) continue;
        this._sphere.center.set(this.sample.x, 1.5, this.sample.z);
        if (!force && camera && this._frustum.intersectsSphere(this._sphere)) continue;
        candidates.push({route, distance: d, dist});
      }
    }
    if (!candidates.length) return false;
    candidates.sort((a, b) => a.dist - b.dist);
    const choice = force ? candidates[0] : candidates[Math.floor(this.rng() * candidates.length)];
    return this.spawnOnRoute(choice.route, choice.distance);
  }

  spawnOnRoute(route, distance = 0) {
    if (route.points.length < 2 || route.length <= 0) return false;
    this.despawn(); this.route = route; this.distance = distance; this.direction = 1;
    this.root = buildNutWagon(); this.root.scale.setScalar(T.worldScale); this.scene.add(this.root);
    this.active = true; this.state = 'parked'; this.stopTimer = T.stopSeconds; this.cruiseTimer = 0;
    this.gatheringStop = false; this.gatherTimer = 0; this.boardTimer = 0; this.blockedTimer = 0;
    sampleWagonRoute(route, distance, this.sample);
    this.position.set(this.sample.x, 0, this.sample.z); this.root.position.copy(this.position);
    this.root.rotation.y = this.sample.heading; this.heading = this.sample.heading + Math.PI;
    this.root.updateMatrixWorld(true);
    this.seatSlots = NUT_WAGON_MOUNTS.map(m => ({
      name: m.name, x: m.position[0], y: m.position[1], z: m.position[2],
      yaw: m.facing, kind: m.pose === 'standing' ? 'standing' : m.name.startsWith('roof') ? 'roof' : 'bench',
      occupied: false, vehicle: this, permanent: m.name === 'driver',
    }));
    for (const z of [-1.35, .5, 2.5]) {
      const e = {kind: 'nut_wagon', position: new THREE.Vector3(), footprint: 1.5 * T.worldScale,
        collider: {radius: (z === 2.5 ? 1 : 1.25) * T.worldScale, damage: .08}, localZ: z};
      this.colliders.push(e); this.ids.push(registry.add(e));
    }
    this.sync(); this.lastStop.copy(this.position);
    const driver = this.crowd.spawn({pos: this.position.clone(), rng: this.rng});
    if (!driver) { this.despawn(); return false; }
    if (driver) {
      const slot = this.seatSlots[0]; slot.occupied = true; driver.seatSlot = slot;
      driver.scale = .9; // A short driver fits the enclosed cabin's headroom.
      driver.state = 'riding'; driver.rideTimer = Infinity;
      this.driverModel = seatBoInWagon(this.root, NUT_WAGON_MOUNTS[0]);
      this.crowd._writeMatrices(driver);
    }
    if (this.musicEnabled) {
      this.music = Sound.attachStageMusic(this.position.x, 1, this.position.z, 0x6e775731, 'nut_wagon_reggae');
      this.musicEntry = Sound.getStageHandleRegistry().find(e => e.handle === this.music);
    }
    return true;
  }

  worldSeatPosition(slot, out) {
    return out.set(slot.x, slot.y, slot.z).applyMatrix4(this.root.matrixWorld);
  }

  sync() {
    this.root.position.copy(this.position); this.root.updateMatrixWorld(true);
    this.heading = this.root.rotation.y + Math.PI;
    for (const e of this.colliders) e.position.set(0, 0, e.localZ).applyMatrix4(this.root.matrixWorld);
    this.music?.setPosition(this.position.x, 1, this.position.z);
    if (this.musicEntry) { this.musicEntry.x = this.position.x; this.musicEntry.z = this.position.z; }
  }

  boardNearby() {
    if (this.state !== 'parked' || this.stopTimer < 14) return;
    let slot, npc;
    for (const candidate of this.crowd.npcs) {
      if (!['idle', 'walking', 'watching'].includes(candidate.state) || candidate.party || candidate.seatSlot
          || (candidate.wagonCooldownUntil || 0) > this.clock
          || Math.hypot(candidate.pos.x - this.position.x, candidate.pos.z - this.position.z) >= 12) continue;
      // The crowd has deliberately exaggerated height variation. Tall riders
      // use the open roof bench instead of clipping through the cabin roof.
      slot = this.seatSlots.find(s => !s.occupied && !s.permanent
        && (s.kind === 'roof' || s.kind === 'standing' || candidate.scale <= .97));
      if (slot) { npc = candidate; break; }
    }
    if (!npc) return;
    slot.occupied = true; npc.seatSlot = slot; npc.state = 'boarding'; npc.stateTimer = 14;
    npc.wagonCooldownUntil = this.clock + 100;
  }

  update(dt, player, trip, nightness, camera = null) {
    this.clock += dt;
    const tripStarted = trip && !this.wasTrip; this.wasTrip = trip;
    if (!this.active) {
      this.encounterTimer -= dt;
      if (tripStarted || this.encounterTimer <= 0) {
        this.encounterTimer = T.encounterSeconds;
        if (this.rng() < (trip ? T.tripChance : T.normalChance)) this.trySpawn(player, camera);
      }
      return;
    }
    if (this.position.distanceToSquared(player) > T.despawnDistance ** 2) {
      if (camera) {
        this._frustum.setFromProjectionMatrix(this._matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        this._sphere.center.copy(this.position); this._sphere.center.y = 2;
      }
      if (!camera || !this._frustum.intersectsSphere(this._sphere)) {
        this.despawn(); this.encounterTimer = 8; return;
      }
    }
    setNutWagonNightness(this.root, nightness);
    this.speed = 0; this.waitReason = null;
    this.gatherTimer -= dt;
    if (this.gatherTimer <= 0) {
      this.gatherTimer = 1; this.gatheringStop = false;
      if (this.position.distanceToSquared(this.lastStop) > 12 * 12) {
        let nearby = 0;
        for (const n of this.crowd.npcs) {
          if (!n.seatSlot && Math.hypot(n.pos.x - this.position.x, n.pos.z - this.position.z) < 9) nearby++;
        }
        this.gatheringStop = nearby >= 3;
        for (const a of registry.attractors()) {
          if (Math.hypot(a.position.x - this.position.x, a.position.z - this.position.z) < Math.min(a.radius + 5, 18)) {
            this.gatheringStop = true; break;
          }
        }
      }
    }
    this.boardTimer -= dt;
    if (this.boardTimer <= 0) { this.boardTimer = 1.5; this.boardNearby(); }
    if (this.state === 'parked') {
      const boardingParty = this.crowd.npcs.some(n => n.party && n.state === 'boarding' && n.seatSlot?.vehicle === this);
      this.waitReason = boardingParty ? 'boarding party' : 'scheduled stop';
      if (!boardingParty) this.stopTimer -= dt;
      if (this.stopTimer <= 0) { this.state = 'cruising'; this.cruiseTimer = 0; }
    } else {
      const next = Math.max(6, Math.min(this.route.length - 6, this.distance + this.direction * T.speed * dt));
      sampleWagonRoute(this.route, next, this.nextSample);
      const targetYaw = this.nextSample.heading;
      const delta = Math.atan2(Math.sin(targetYaw - this.root.rotation.y), Math.cos(targetYaw - this.root.rotation.y));
      const nextYaw = this.root.rotation.y + Math.max(-dt * .6, Math.min(dt * .6, delta));
      const canTurn = this.clearAt(this.position.x, this.position.z, nextYaw);
      const travelX = Math.sin(this.nextSample.heading) * this.direction;
      const travelZ = Math.cos(this.nextSample.heading) * this.direction;
      const playerAhead = (player.x - this.position.x) * travelX + (player.z - this.position.z) * travelZ > 0;
      const nearPlayer = playerAhead && wagonOverlapsCircle(
        this.nextSample.x, this.nextSample.z, nextYaw, player.x, player.z, 1.8,
      );
      this.waitReason = nearPlayer ? 'yielding to Zerble'
        : !canTurn ? 'blocked turn'
        : Math.abs(delta) >= .12 ? 'aligning with road' : null;
      if (canTurn && !nearPlayer) this.root.rotation.y = nextYaw;
      if (canTurn && Math.abs(delta) < .12 && !nearPlayer && this.clearAt(this.nextSample.x, this.nextSample.z, nextYaw)) {
        this.distance = next; this.position.set(this.nextSample.x, 0, this.nextSample.z); this.speed = this.direction * T.speed;
        for (const wheel of this.root.userData.wheels) wheel.rotation.x += this.speed * dt / (.315 * T.worldScale);
        this.cruiseTimer += dt; this.blockedTimer = 0;
      } else if (canTurn && Math.abs(delta) >= .12 && !nearPlayer) {
        this.blockedTimer = 0; // A deliberate turn is progress, not a stalled route.
      } else if (nearPlayer) {
        this.blockedTimer = 0; // A player in the lane should not trigger a reversing/parking loop.
      } else {
        this.blockedTimer += dt; this.waitReason = 'blocked road';
      }
      if (this.blockedTimer >= T.stallSeconds) {
        this.direction *= -1;
        this.state = 'parked'; this.stopTimer = T.stopSeconds; this.blockedTimer = 0;
        this.lastStop.copy(this.position); this.gatheringStop = false;
      }
      const atEnd = this.direction < 0 ? this.distance <= 6 : this.distance >= this.route.length - 6;
      if (this.state === 'cruising' && (atEnd || this.cruiseTimer >= T.cruiseSeconds
          || (this.gatheringStop && this.cruiseTimer >= T.minCruiseSeconds))) {
        if (atEnd) this.direction *= -1;
        this.state = 'parked'; this.stopTimer = T.stopSeconds;
        this.lastStop.copy(this.position); this.gatheringStop = false;
      }
    }
    this.sync();
  }

  despawn() {
    for (const npc of this.crowd.npcs) {
      if (npc.seatSlot?.vehicle !== this) continue;
      npc.seatSlot.occupied = false; npc.seatSlot = null; npc.seatY = undefined;
      npc.state = 'idle'; npc.stateTimer = 2;
    }
    for (const id of this.ids) registry.remove(id);
    this.ids.length = 0; this.colliders.length = 0; this.seatSlots.length = 0;
    Sound.detachStageMusic(this.music); this.music = null; this.musicEntry = null;
    this.root?.removeFromParent(); this.root = null; this.driverModel = null;
    this.active = false; this.state = 'absent'; this.speed = 0;
  }

  status() {
    return {active: this.active, state: this.state, speed: this.speed, gear: this.direction < 0 ? 'reverse' : 'forward',
      waitReason: this.waitReason, routeDistance: this.distance, routeLength: this.route?.length,
      stopRemaining: this.state === 'parked' ? this.stopTimer : 0,
      position: this.position.toArray(), passengers: this.seatSlots.filter(s => s.occupied).length,
      capacity: this.seatSlots.length, tuning: T};
  }
}
