// A verification driver over production controllers, not another simulation.
// Population owners release their own scene/GPU resources; the sandbox retains
// the remaining place props after claims and registry publications are removed.
export class PeopleWorkshop {
  constructor({ crowd, children, smiles, cart, registry, healing, camp, party,
    ownedRegistryIds = [], trace = null }) {
    this.crowd = crowd;
    this.children = children;
    this.smiles = smiles;
    this.cart = cart;
    this.registry = registry;
    this.healing = healing;
    this.camp = camp;
    this.party = party;
    this.ownedRegistryIds = [...ownedRegistryIds];
    this.trace = trace;
    this.elapsed = 0;
    this.frames = 0;
    this.collected = 0;
    this.paused = false;
    this.disposed = false;
    this.onCollect = count => { this.collected += count; };
  }

  update(dt, tod) {
    if (!this.paused) this.step(dt, tod);
  }

  step(dt, tod) {
    if (this.disposed) return;
    if (!Number.isFinite(dt) || dt < 0 || dt > .05) throw new RangeError('Workshop delta must be between 0 and 0.05 seconds.');
    this.elapsed += dt;
    this.registry.rebuildSpatialIndex();
    this.trace?.('spatial');
    // Match the real game's adult -> smile collection -> children barrier.
    // Crowd itself ticks camp sessions and monk intent before its individuals.
    this.crowd.update(dt, this.cart, null);
    this.trace?.('adults');
    this.smiles.update(dt, this.cart, this.onCollect);
    this.trace?.('collection');
    this.children.update(dt, null, this.cart, this.smiles);
    this.trace?.('children');
    if (this.healing) {
      this.healing.activity.update(dt, this.elapsed, tod.nightness);
      this.trace?.('healing-activity');
      this.healing.activity.sample(this.elapsed,tod.nightness);
      this.trace?.('healing-sample');
      // Preserve the legacy previous-sample read before the model samples again.
      this.healing.animate(dt, this.elapsed, tod.nightness);
      this.trace?.('healing-display');
    }
    this.camp?.animate(this.elapsed, tod);
    this.frames++;
  }

  honk() {
    if (this.disposed) return;
    this.crowd.applyHonk(this.cart);
    this.children.scatter(this.cart);
  }

  unloadHealing() {
    if (!this.healing) return;
    const healing = this.healing;
    this.healing = null;
    healing.activity.dispose();
    for (const id of healing.registryIds) this.registry.remove(id);
    healing.group.visible = false;
  }

  status() {
    return {
      disposed: this.disposed, paused: this.paused, frames: this.frames,
      adults: this.crowd.populationSize, children: this.disposed ? 0 : this.children.populationSize,
      monks: this.party?.members.length ?? 0,
      visitors: this.healing?.activity.visitors.size ?? 0,
      campJobs: this.crowd.campJams.jobs.size,
      collected: this.collected,
      ownedEntries: this.ownedRegistryIds.filter(id => this.registry.entries.has(id)).length,
      registryEntries: this.registry.entries.size,
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.paused = true;
    this.unloadHealing();
    this.party?.dispose();
    this.children.dispose?.();
    this.crowd.campJams.dispose();
    const people=[];this.crowd.forEachPersonNear(0,0,Number.MAX_VALUE,handle=>{people.push(handle);});
    for(const handle of people)this.crowd.removePerson(handle);
    this.crowd.dispose?.();
    for (const id of this.ownedRegistryIds) this.registry.remove(id);
    this.smiles.dispose();
  }
}
