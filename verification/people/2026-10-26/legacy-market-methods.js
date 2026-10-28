// Recorded before Task 2.16 market migration.
export class MarketOracle {
  _releaseMarket(npc) {
    const visit = npc.marketVisit;
    if (!visit) return;
    if (visit.market.customer === npc) visit.market.customer = null;
    npc.marketVisit = null;
    npc.marketCooldown = 30 + (npc.marketRng?.() ?? .5) * 25;
    if (npc.state.startsWith('market_')) { npc.state = 'idle'; npc.stateTimer = 2; }
  }

  _tickMarket(dt, npc, zerble) {
    const t = this.campTimeOfDay?.t ?? getTimeOfDay()?.t ?? .25;
    const open = t >= .04 && t < .735;
    let visit = npc.marketVisit;
    if (visit && (!open || !visit.market.open || registry.entries.get(visit.entry.id) !== visit.entry ||
        !npc.state.startsWith('market_') || npc.frownTimer > 0 ||
        laneDodgeTest(npc.pos.x - zerble.position.x, npc.pos.z - zerble.position.z,
          zerble.forwardWorld.x, zerble.forwardWorld.z, zerble.speed))) {
      this._releaseMarket(npc);
      return false;
    }
    if (!visit) {
      if (!open || this.starActive || npc.cheerTimer > 0 || npc.frownTimer > 0 || npc.party || npc.campSlot || npc.campJam || npc.marketCooldown ||
          npc.shoppingBagTime || !['idle', 'walking'].includes(npc.state)) return false;
      // Separate seeded behavior stream, independent of appearance and world layout.
      npc.marketRng ||= mulberry32((npc.behaviorSeed ^ 0x53484f50) >>> 0);
      npc.marketCooldown = 3 + npc.marketRng() * 3;
      let chosen = null, nearest = 16;
      for (const id of registry.byKind.get('tent') || []) {
        const entry = registry.entries.get(id), booth = entry?.vendor;
        const market = booth?.userData.market;
        if (!market?.open || market.customer) continue;
        const yaw = booth.rotation.y;
        const x = entry.position.x + Math.sin(yaw) * 3.2;
        const z = entry.position.z + Math.cos(yaw) * 3.2;
        const d = Math.hypot(x - npc.pos.x, z - npc.pos.z);
        if (d < nearest && !isMarketSpotBlocked(x, z)) {
          nearest = d; chosen = {entry, market, x, z, yaw, age: 0};
        }
      }
      if (!chosen) return false;
      visit = npc.marketVisit = chosen;
      visit.market.customer = npc;
      npc.state = 'market_walking'; npc.stateTimer = 24;
    }
    npc.onDancefloor = false;
    visit.age += dt;
    if (npc.state === 'market_walking') {
      const dx = visit.x - npc.pos.x, dz = visit.z - npc.pos.z, d = Math.hypot(dx, dz);
      if (d < .22) {
        npc.vel.set(0, 0, 0);
        npc.state = 'market_browsing'; npc.stateTimer = 5 + npc.marketRng() * 7;
      } else if (npc.stateTimer <= 0) {
        this._releaseMarket(npc); return false;
      } else {
        const step = Math.min(d, dt * (1.1 + npc.energy));
        let nx = npc.pos.x + dx / d * step, nz = npc.pos.z + dz / d * step;
        // Slide around solid booths instead of walking through the canopy center.
        registry.collidersNear(nx, nz, .35, entry => {
          const r = entry.collider.radius + .35;
          const ox = nx - entry.position.x, oz = nz - entry.position.z, od = Math.hypot(ox, oz);
          if (od < r) {
            const a = Math.atan2(oz || dz, ox || dx) + step / r * (npc.idx % 2 ? 1 : -1);
            nx = entry.position.x + Math.cos(a) * r; nz = entry.position.z + Math.sin(a) * r;
          }
        });
        if (!isMarketSpotBlocked(nx, nz)) {
          npc.vel.set((nx - npc.pos.x) / Math.max(dt, .001), 0, (nz - npc.pos.z) / Math.max(dt, .001));
          npc.pos.x = nx; npc.pos.z = nz;
        } else npc.vel.set(0, 0, 0);
        npc.yaw += wrapAngle(Math.atan2(-dx, -dz) - npc.yaw) * Math.min(1, dt * 6);
      }
    } else {
      npc.vel.set(0, 0, 0);
      // Crowd faces -Z, while the booth's opening is +Z.
      const yaw = visit.yaw + (npc.state === 'market_browsing' ? Math.sin(visit.age * .8) * .16 : 0);
      npc.yaw += wrapAngle(yaw - npc.yaw) * Math.min(1, dt * 5);
      if (npc.stateTimer <= 0) {
        if (npc.state === 'market_browsing') {
          npc.state = 'market_chatting'; npc.stateTimer = 3 + npc.marketRng() * 3;
        } else if (npc.state === 'market_chatting' && npc.marketRng() < .65) {
          npc.state = 'market_buying'; npc.stateTimer = 2.5;
        } else {
          if (npc.state === 'market_buying') {
            npc.shoppingBagTime = 55;
            npc.marketPurchases = (npc.marketPurchases || 0) + 1;
          }
          this._releaseMarket(npc);
          // Give the frontage back, then walk out toward the aisle.
          npc.target.set(visit.x + Math.sin(visit.yaw) * 4, 0, visit.z + Math.cos(visit.yaw) * 4);
          npc.state = 'walking'; npc.stateTimer = 8;
        }
      }
    }
    this._writeMatrices(npc);
    return true;
  }

}
function isMarketSpotBlocked(x, z) {
  let blocked = false;
  registry.collidersNear(x, z, .35, entry => {
    if (Math.hypot(x - entry.position.x, z - entry.position.z) < entry.collider.radius + .349) blocked = true;
  });
  return blocked;
}
