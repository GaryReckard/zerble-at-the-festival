// A visit borrows movement authority; its frontage reservation carries a full
// person/claim lifetime. Models receive only a small copied display state.
import { mulberry32 } from "../rng.js";
import { laneDodgeTest } from "../steering.js";
const frontageOwners = new WeakMap();
const vector = () => ({
  x: 0,
  y: 0,
  z: 0,
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  },
});
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export class MarketActivity {
  constructor(people, registry, { rngFactory = mulberry32 } = {}) {
    this.people = people;
    this.registry = registry;
    this.rngFactory = rngFactory;
    this.activityKey = "market";
    this.states = new WeakMap();
    this.records = new Map();
    this.disposed = false;
    this.time = 0.25;
    this.starActive = false;
  }
  has(handle) {
    return this.records.has(handle);
  }
  _state(handle) {
    let s = this.states.get(handle);
    if (!s) {
      s = {
        person: handle,
        idx: handle.slot,
        pos: vector(),
        vel: vector(),
        target: vector(),
        publication: false,
        marketVisit: null,
        marketCooldown: 0,
        claim: null,
      };
      this.states.set(handle, s);
    }
    return s;
  }
  tick(dt, handle, cart, time = 0.25, starActive = false) {
    if (this.disposed) return false;
    const s = this._state(handle);
    if (!this.people.readMarketMotion(handle, s)) return false;
    this.time = time;
    this.starActive = starActive;
    s.publication = false;
    s.marketCooldown = Math.max(0, (s.marketCooldown || 0) - dt);
    const consumed = this._tickMarket(dt, s, cart);
    if (s.claim) {
      if (s.marketVisit) {
        if (!this.people.commitMarketMotion(s.claim, s)) return false;
        s.marketVisit.presentation.state = s.state;
      } else {
        const claim = s.claim;
        this.people.finishMarketMotion(claim, s);
      }
    }
    return consumed;
  }
  _acquireVisit(s, visit) {
    const claim = this.people.claimActivity(
      s.person,
      {
        owner: this,
        release: (current) => {
          if (this.records.get(s.person) !== s || s.claim !== current) return;
          this._releaseMarket(s);
          this.records.delete(s.person);
          s.claim = null;
        },
      },
      { preserveMotion: true },
    );
    if (!claim) return false;
    if (
      this.disposed ||
      this.registry.entries.get(visit.entry.id) !== visit.entry ||
      visit.market.customer ||
      frontageOwners.has(visit.market)
    ) {
      this.people.endPersonActivity(claim, { reason: "rest-step" });
      return false;
    }
    s.claim = claim;
    s.marketVisit = visit;
    this.records.set(s.person, s);
    visit.presentation = { state: "market_walking" };
    visit.reservation = {
      owner: this,
      person: s.person,
      claim,
      entry: visit.entry,
      resource: visit.market,
      presentation: visit.presentation,
    };
    frontageOwners.set(visit.market, visit.reservation);
    visit.market.customer = visit.presentation;
    return true;
  }
  _releaseFrontage(s) {
    const v = s.marketVisit;
    if (!v || frontageOwners.get(v.market) !== v.reservation) return false;
    frontageOwners.delete(v.market);
    if (v.market.customer === v.presentation) v.market.customer = null;
    return true;
  }
  _writeMatrices(s) {
    s.publication = true;
  }
  _isSpotBlocked(x, z) {
    let blocked = false;
    this.registry.collidersNear(x, z, 0.35, (entry) => {
      if (
        Math.hypot(x - entry.position.x, z - entry.position.z) <
        entry.collider.radius + 0.349
      )
        blocked = true;
    });
    return blocked;
  }
  release(handle, reason = "rest-interrupted") {
    const s = this.records.get(handle);
    if (!s) return false;
    if (this.people.readMarketMotion(handle, s)) {
      s.publication = false;
      this._releaseMarket(s);
      return this.people.finishMarketMotion(s.claim, s);
    }
    return this.people.endPersonActivity(s.claim, { reason });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors = [];
    for (const s of this.records.values())
      try {
        this.people.endPersonActivity(s.claim, { reason: "market-disposed" });
      } catch (error) {
        errors.push(error);
      }
    this.states = new WeakMap();
    if (errors.length)
      throw new AggregateError(errors, "Market activity cleanup failed.");
  }
  _releaseMarket(npc) {
    const visit = npc.marketVisit;
    if (!visit) return;
    this._releaseFrontage(npc);
    npc.marketVisit = null;
    npc.marketCooldown = 30 + (npc.marketRng?.() ?? 0.5) * 25;
    if (npc.state.startsWith("market_")) {
      npc.state = "idle";
      npc.stateTimer = 2;
    }
  }

  _tickMarket(dt, npc, zerble) {
    const t = this.time;
    const open = t >= 0.04 && t < 0.735;
    let visit = npc.marketVisit;
    if (
      visit &&
      (!open ||
        !visit.market.open ||
        this.registry.entries.get(visit.entry.id) !== visit.entry ||
        visit.entry.vendor?.userData.market !== visit.market ||
        frontageOwners.get(visit.market) !== visit.reservation ||
        visit.market.customer !== visit.presentation ||
        !npc.state.startsWith("market_") ||
        npc.frownTimer > 0 ||
        laneDodgeTest(
          npc.pos.x - zerble.position.x,
          npc.pos.z - zerble.position.z,
          zerble.forwardWorld.x,
          zerble.forwardWorld.z,
          zerble.speed,
        ))
    ) {
      this._releaseMarket(npc);
      return false;
    }
    if (!visit) {
      if (
        !open ||
        this.starActive ||
        npc.cheerTimer > 0 ||
        npc.frownTimer > 0 ||
        npc.claimed ||
        npc.grouped ||
        npc.camping ||
        npc.jamming ||
        npc.marketCooldown ||
        npc.shoppingBagTime ||
        !["idle", "walking"].includes(npc.state)
      )
        return false;
      // Separate seeded behavior stream, independent of appearance and world layout.
      npc.marketRng ||= this.rngFactory((npc.behaviorSeed ^ 0x53484f50) >>> 0);
      npc.marketCooldown = 3 + npc.marketRng() * 3;
      let chosen = null,
        nearest = 16;
      for (const id of this.registry.byKind.get("tent") || []) {
        const entry = this.registry.entries.get(id),
          booth = entry?.vendor;
        const market = booth?.userData.market;
        if (!market?.open || market.customer || frontageOwners.has(market))
          continue;
        const yaw = booth.rotation.y;
        const x = entry.position.x + Math.sin(yaw) * 3.2;
        const z = entry.position.z + Math.cos(yaw) * 3.2;
        const d = Math.hypot(x - npc.pos.x, z - npc.pos.z);
        if (d < nearest && !this._isSpotBlocked(x, z)) {
          nearest = d;
          chosen = { entry, market, x, z, yaw, age: 0 };
        }
      }
      if (!chosen) return false;
      if (!this._acquireVisit(npc, chosen)) return false;
      visit = npc.marketVisit;
      npc.state = "market_walking";
      npc.stateTimer = 24;
    }
    npc.onDancefloor = false;
    visit.age += dt;
    if (npc.state === "market_walking") {
      const dx = visit.x - npc.pos.x,
        dz = visit.z - npc.pos.z,
        d = Math.hypot(dx, dz);
      if (d < 0.22) {
        npc.vel.set(0, 0, 0);
        npc.state = "market_browsing";
        npc.stateTimer = 5 + npc.marketRng() * 7;
      } else if (npc.stateTimer <= 0) {
        this._releaseMarket(npc);
        return false;
      } else {
        const step = Math.min(d, dt * (1.1 + npc.energy));
        let nx = npc.pos.x + (dx / d) * step,
          nz = npc.pos.z + (dz / d) * step;
        // Slide around solid booths instead of walking through the canopy center.
        this.registry.collidersNear(nx, nz, 0.35, (entry) => {
          const r = entry.collider.radius + 0.35;
          const ox = nx - entry.position.x,
            oz = nz - entry.position.z,
            od = Math.hypot(ox, oz);
          if (od < r) {
            const a =
              Math.atan2(oz || dz, ox || dx) +
              (step / r) * (npc.idx % 2 ? 1 : -1);
            nx = entry.position.x + Math.cos(a) * r;
            nz = entry.position.z + Math.sin(a) * r;
          }
        });
        if (!this._isSpotBlocked(nx, nz)) {
          npc.vel.set(
            (nx - npc.pos.x) / Math.max(dt, 0.001),
            0,
            (nz - npc.pos.z) / Math.max(dt, 0.001),
          );
          npc.pos.x = nx;
          npc.pos.z = nz;
        } else npc.vel.set(0, 0, 0);
        npc.yaw +=
          wrapAngle(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, dt * 6);
      }
    } else {
      npc.vel.set(0, 0, 0);
      // Crowd faces -Z, while the booth's opening is +Z.
      const yaw =
        visit.yaw +
        (npc.state === "market_browsing"
          ? Math.sin(visit.age * 0.8) * 0.16
          : 0);
      npc.yaw += wrapAngle(yaw - npc.yaw) * Math.min(1, dt * 5);
      if (npc.stateTimer <= 0) {
        if (npc.state === "market_browsing") {
          npc.state = "market_chatting";
          npc.stateTimer = 3 + npc.marketRng() * 3;
        } else if (npc.state === "market_chatting" && npc.marketRng() < 0.65) {
          npc.state = "market_buying";
          npc.stateTimer = 2.5;
        } else {
          if (npc.state === "market_buying") {
            npc.shoppingBagTime = 55;
            npc.marketPurchases = (npc.marketPurchases || 0) + 1;
          }
          this._releaseMarket(npc);
          // Give the frontage back, then walk out toward the aisle.
          npc.target.set(
            visit.x + Math.sin(visit.yaw) * 4,
            0,
            visit.z + Math.cos(visit.yaw) * 4,
          );
          npc.state = "walking";
          npc.stateTimer = 8;
        }
      }
    }
    this._writeMatrices(npc);
    return true;
  }
}
