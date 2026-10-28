// Opt-in characterization of real frame barriers. No simulation, timer, RNG,
// or retained live actor references; the ordinary game does not instantiate it.
export class PeopleFrameTrace {
  constructor({ limit = 120, maxPickups = 128, maxColliders = 1024 } = {}) {
    for (const [name, value, maximum] of [['limit',limit,600], ['maxPickups',maxPickups,1000], ['maxColliders',maxColliders,4096]]) {
      if (!Number.isInteger(value) || value < 1 || value > maximum) throw new RangeError(`Invalid people trace ${name}.`);
    }
    this.limit = limit;
    this.maxPickups = maxPickups;
    this.maxColliders = maxColliders;
    this.frames = [];
    this.current = null;
  }

  restart(scenario = 'manual') {
    if (this.current) throw new Error('Cannot restart an active people frame.');
    this.frames.length = 0;
    this.scenario = scenario;
  }

  seats(name, cart, wagon, crowd) {
    if (!this.current) return;
    this.current.events.push({name, vehicles:[['cart',cart],['wagon',wagon]].map(([key,vehicle])=>({
      key, state:vehicle.state ?? null,
      seats:(vehicle.seatSlots ?? []).map((slot,index)=>({index,kind:slot.kind,occupied:!!slot.occupied,permanent:!!slot.permanent})),
      riders:crowd.npcs.filter(n=>vehicle.seatSlots?.includes(n.seatSlot)).map(n=>({slot:n.idx,state:n.state,seat:vehicle.seatSlots.indexOf(n.seatSlot)})),
    }))});
  }

  population(name, crowd) {
    if (!this.current) return;
    this.current.events.push({name,count:crowd.npcs.length,truncated:crowd.npcs.length>this.maxColliders,
      people:crowd.npcs.slice(0,this.maxColliders).map(n=>({slot:n.idx,state:n.state,x:n.pos.x,y:n.pos.y,z:n.pos.z,yaw:n.yaw,
        seated:!!n.seatSlot,healing:crowd.isInActivity(n.personHandle,'healing-arts'),monk:!!n.party})),
    });
  }

  begin(dt) {
    if (this.current) throw new Error('People trace frame was not ended.');
    if (this.frames.length >= this.limit) return;
    if (!Number.isFinite(dt) || dt < 0 || dt > .05) throw new RangeError('People trace requires an accepted frame delta.');
    this.current = { index:this.frames.length, dt, events:[] };
    this.frames.push(this.current);
    this.mark('begin');
  }

  mark(name, value = null) {
    if (!this.current) return;
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new TypeError('People trace marks accept scalar values; use a copied-state helper for actors.');
    }
    this.current.events.push({ name, value });
  }

  pickups(name, smiles) {
    if (!this.current) return;
    this.current.events.push({name, count:smiles.active.length,
      truncated:smiles.active.length>this.maxPickups,
      pickups:smiles.active.slice(0,this.maxPickups).map(p => ({
        id:p.mesh.id, age:p.age, lost:!!p.lost, x:p.mesh.position.x, y:p.mesh.position.y, z:p.mesh.position.z,
      })),
    });
  }

  candidates(colliders) {
    if (!this.current) return;
    this.current.events.push({name:'collision-candidates', count:colliders.length,
      truncated:colliders.length>this.maxColliders,
      candidates:colliders.slice(0,this.maxColliders).map(c => ({
        kind:c.kind, radius:c.radius, damage:c.damage, passive:!!c.passive,
        x:c.position.x, y:c.position.y, z:c.position.z,
      })),
    });
  }

  hit(hit) {
    if (!this.current) return;
    this.current.events.push({name:'collision-result',
      value:hit ? {kind:hit.kind,damage:hit.damage,damaging:!!hit.damaging,notify:!!hit.notify} : null});
  }

  end() {
    if (!this.current) return;
    this.mark('render-submitted');
    this.current = null;
    this.onEnd?.(this.frames.length, this.limit);
  }

  report() {
    return JSON.parse(JSON.stringify({version:1,limit:this.limit,complete:this.frames.length===this.limit&&!this.current,
      scenario:this.scenario ?? 'startup',scope:'Observed frame order and copied state; not a performance benchmark.',frames:this.frames}));
  }
}

// Use the existing loopback capture sink instead of a browser download dialog.
// This deadline owns only a diagnostic request, never simulation scheduling.
export async function savePeopleFrameTrace(trace, name, { request = fetch, timeoutMs = 5000 } = {}) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new TypeError('Invalid people trace capture name.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await request('/__capture/' + name, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(trace.report()), signal:controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`People trace save failed (${response.status}): ${text}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}
