import { CHALLENGE, SPECIAL } from './bubbleTypes.js';

const RING_COS = [1, 0.7071067811865476, 0, -0.7071067811865476, -1, -0.7071067811865476, 0, 0.7071067811865476];
const RING_SIN = [0, 0.7071067811865476, 1, 0.7071067811865476, 0, -0.7071067811865476, -1, -0.7071067811865476];

function distanceSq(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

function positionKey(x, z) {
  return Math.round(x) + ',' + Math.round(z);
}

function getMode(world) {
  const mode = typeof world.mode === 'function' ? world.mode() : world.mode;
  return mode === 'festival' ? 'festival' : 'cruisin';
}

export class ChallengeTracker {
  constructor(progress, world, activeTypes = null) {
    this.progress = progress;
    this.world = world || {};
    this.activeTypes = activeTypes ? new Set(activeTypes) : null;
    this.stagesSeen = new Set();
    this.hubsSeen = new Set();
    this.context = {
      nightness: 0,
      lurleenNear: false,
      nearStage: false,
      nearDrum: false,
      nearShore: false,
      nearParade: false,
      nearBand: false,
      tripActive: false,
    };
    this._tickDebt = 0;
    this._stageX = 0;
    this._stageZ = 0;
    this._drumX = 0;
    this._drumZ = 0;
    this._paradeX = 0;
    this._paradeZ = 0;
    this._bandX = 0;
    this._bandZ = 0;
    this._nearStage = false;
    this._nearDrum = false;
    this._nearParade = false;
    this._nearBand = false;
    this._atDrum = false;
    this._atParade = false;
    this._atBand = false;
    this._stageCallback = this._visitStage.bind(this);
    this._drumCallback = this._visitDrum.bind(this);
    this._paradeCallback = this._visitParade.bind(this);
    this._bandCallback = this._visitBand.bind(this);
  }

  _unlock(id) { return this.activeTypes && !this.activeTypes.has(id) ? false : this.progress.unlock(id, getMode(this.world)); }

  onLurleenFound() { return this._unlock('heart'); }
  onFireworksFinale() { return this._unlock('sparkler'); }
  onTripAccepted() { return this._unlock('mushroom'); }

  onRunDay(day) {
    if (getMode(this.world) !== 'festival' || day < 2) return false;
    return this._unlock('confetti');
  }

  onSmilesCollected(count) {
    if (!Number.isFinite(count) || count <= 0) return false;
    this.progress.addLifetimeSmiles(count);
    if (this.progress.lifetimeSmiles >= CHALLENGE.lifetimeSmiles) return this._unlock('smile');
    return false;
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this._tickDebt += dt;
    while (this._tickDebt >= CHALLENGE.tickSec) {
      this._tickDebt -= CHALLENGE.tickSec;
      this._evaluate();
    }
  }

  _evaluate() {
    const world = this.world;
    const pos = typeof world.zerblePos === 'function' ? world.zerblePos() : null;
    const x = Number.isFinite(pos?.x) ? pos.x : 0;
    const z = Number.isFinite(pos?.z) ? pos.z : 0;
    const nightness = typeof world.nightness === 'function' ? world.nightness() : 0;
    const night = Number.isFinite(nightness) ? Math.max(0, Math.min(1, nightness)) : 0;
    const lurleenNear = !!(typeof world.lurleenNear === 'function' && world.lurleenNear());

    this._stageX = x; this._stageZ = z; this._drumX = x; this._drumZ = z;
    this._paradeX = x; this._paradeZ = z; this._bandX = x; this._bandZ = z;
    this._nearStage = false; this._nearDrum = false; this._nearParade = false; this._nearBand = false;
    this._atDrum = false; this._atParade = false; this._atBand = false;
    if (typeof world.stageFronts === 'function') world.stageFronts(this._stageCallback);
    if (typeof world.drumCircles === 'function') world.drumCircles(this._drumCallback);
    if (typeof world.paradePositions === 'function') world.paradePositions(this._paradeCallback);
    if (typeof world.bandPositions === 'function') world.bandPositions(this._bandCallback);

    const nearShore = this._isNearShore(x, z, world);
    const tripActive = !!(typeof world.tripActive === 'function' && world.tripActive());
    const context = this.context;
    context.nightness = night;
    context.lurleenNear = lurleenNear;
    context.nearStage = this._nearStage;
    context.nearDrum = this._nearDrum;
    context.nearShore = nearShore;
    context.nearParade = this._nearParade;
    context.nearBand = this._nearBand;
    context.tripActive = tripActive;

    if (this.stagesSeen.size >= CHALLENGE.musicStages) this._unlock('music');
    if (night >= SPECIAL.nightMin && this._atDrum) this._unlock('ember');
    if (night >= SPECIAL.nightMin && nearShore) this._unlock('firefly');
    if (typeof world.heartAt === 'function') {
      const heart = world.heartAt(x, z);
      if (heart && Number.isFinite(heart.dist) && heart.dist <= heart.coreR) {
        const key = heart.key ?? (Number.isFinite(heart.cx) && Number.isFinite(heart.cz)
          ? heart.cx + ',' + heart.cz
          : positionKey(x - (heart.dx || 0), z - (heart.dz || 0)));
        this.hubsSeen.add(String(key));
      }
    }
    if (this.hubsSeen.size >= CHALLENGE.rainbowHubs) this._unlock('rainbow');
    if (this._atParade) this._unlock('lantern');
    if (this._atBand) this._unlock('brass');
  }

  _visitStage(stageX, stageZ) {
    if (!Number.isFinite(stageX) || !Number.isFinite(stageZ)) return;
    const d2 = distanceSq(this._stageX, this._stageZ, stageX, stageZ);
    if (d2 <= 40 ** 2) this._nearStage = true;
    if (d2 <= CHALLENGE.stageRadius ** 2) {
      this.stagesSeen.add(positionKey(stageX, stageZ));
    }
  }

  _visitDrum(drumX, drumZ) {
    if (!Number.isFinite(drumX) || !Number.isFinite(drumZ)) return;
    const d2 = distanceSq(this._drumX, this._drumZ, drumX, drumZ);
    if (d2 <= 30 ** 2) this._nearDrum = true;
    if (d2 <= CHALLENGE.drumRadius ** 2) this._atDrum = true;
  }

  _visitParade(paradeX, paradeZ) {
    if (!Number.isFinite(paradeX) || !Number.isFinite(paradeZ)) return;
    const d2 = distanceSq(this._paradeX, this._paradeZ, paradeX, paradeZ);
    if (d2 <= 40 ** 2) this._nearParade = true;
    if (d2 <= CHALLENGE.paradeRadius ** 2) this._atParade = true;
  }

  _visitBand(bandX, bandZ) {
    if (!Number.isFinite(bandX) || !Number.isFinite(bandZ)) return;
    const d2 = distanceSq(this._bandX, this._bandZ, bandX, bandZ);
    if (d2 <= 30 ** 2) this._nearBand = true;
    if (d2 <= CHALLENGE.bandRadius ** 2) this._atBand = true;
  }

  _isNearShore(x, z, world) {
    if (typeof world.isPointInLake !== 'function' || world.isPointInLake(x, z)) return false;
    const radius = CHALLENGE.shoreRing;
    for (let i = 0; i < 8; i++) {
      if (world.isPointInLake(x + RING_COS[i] * radius, z + RING_SIN[i] * radius)) return true;
    }
    return false;
  }

  debugState() {
    return {
      stagesSeen: this.stagesSeen.size,
      stageKeys: Array.from(this.stagesSeen),
      hubsSeen: this.hubsSeen.size,
      hubKeys: Array.from(this.hubsSeen),
      context: { ...this.context },
      lifetimeSmiles: this.progress.lifetimeSmiles,
    };
  }
}
