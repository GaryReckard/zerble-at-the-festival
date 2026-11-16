// Review-only reproduction of dd1516c defects, not desired-behavior tests.
// From the repository root:
// node openspec/changes/passenger-quests/reviews/002-follow-up-audit/gameplay-probes.mjs .claude/worktrees/passenger-quests-audit-2
// Pass the reviewed checkout explicitly. No source files are modified.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

assert(process.argv[2], 'Pass the dd1516c source checkout path.');
const checkout = path.resolve(process.argv[2]);
const { QuestRuntime } = await import(pathToFileURL(path.join(checkout, 'src/quests/runtime.js')));
const source = fs.readFileSync(path.join(checkout, 'src/crowd.js'), 'utf8');
// Extract exact production methods to avoid creating Three.js renderer/model
// resources. Their injected collaborators below are intentionally minimal.
function method(name, next) {
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`  ${next}`, start);
  assert(start >= 0 && end > start, `Cannot locate ${name}; review source drift.`);
  return vm.runInNewContext(`({${source.slice(start, end)}})`, {
    ORDINARY_SOCIAL_STATES: new Set(['idle', 'walking', 'watching', 'approaching']),
  })[name];
}
const endRide = method('endRide', '// A relieved rider');
const sendToPotty = method('sendToPotty', '_landPassenger(');
const candidates = method('forEachHailCandidate', '// Where is');
const hailBoard = method('hailBoard', 'setRideMood(');
const results = [];

// An unbound rider makes this specifically reproduce the newly added physics
// guard: the previous unbound _exitRide path would have released the seat.
{
  const seat = { occupied: true };
  const npc = { state: 'riding', seatSlot: seat, rideHold: true, rideTimer: 100 };
  let exitCalls = 0, rewardPickups = 0, pottyAttempts = 0;
  const crowd = {
    peopleHandles: { resolve: () => npc },
    bathrooms: { has: () => false, tryClaim: () => { pottyAttempts++; return false; } },
    endRide, sendToPotty,
    // This must never run while airborne. A call fails the probe immediately.
    _exitRide() { exitCalls++; throw new Error('Unsafe physical exit attempted'); },
    riderInfo: () => npc.state === 'riding',
    forEachHailCandidate() {},
    holdRide() {},
  };
  const zerble = {
    position: { x: 0, y: 0, z: 0 }, speed: 0,
    physicsDriven: true, grounded: false, engineState: { immersion: 0 },
  };
  const runtime = new QuestRuntime({ crowd, zerble,
    smiles: { spawn() { rewardPickups++; } }, worldgen: false,
    registry: { byKind: new Map(), entries: new Map() }, random: () => 0.5,
  });
  runtime.engine.offer('rider', { x: 0, z: 100 },
    { kind: 'porta_potty', x: 0, z: 0 }, { type: 'urgent' });
  runtime.update(0.1);
  // These assertions characterize the DEFECT, not the intended behavior.
  assert.equal(exitCalls, 0);
  assert.equal(npc.state, 'idle');
  assert.equal(npc.seatSlot, seat);
  assert.equal(seat.occupied, true);
  assert.equal(pottyAttempts, 1);
  assert.equal(rewardPickups, 15);
  assert.equal(runtime.engine.completed, 1);
  assert.equal(runtime.active.length, 0);
  results.push({ probe: 'unsafe-urgent-arrival', defectReproduced: true,
    grounded: zerble.grounded, state: npc.state, stillHasSeat: !!npc.seatSlot,
    exitCalls, pottyAttempts, rewardPickups, completed: runtime.engine.completed,
    active: runtime.active.length });
}

{
  let leaves = 0;
  const runtime = new QuestRuntime({
    crowd: { holdRide() { throw new Error('No solo riders in this fixture'); } },
    zerble: { position: { x: 0, y: 0, z: 0 }, speed: 0,
      physicsDriven: true, grounded: true, engineState: { immersion: 0 } },
    smiles: { spawn() { throw new Error('Shutdown must not reward'); } },
    registry: { byKind: new Map(), entries: new Map() }, worldgen: false,
    random: () => 0.5,
  });
  // Mirrors the live party hold and reentrant onLeaveZerble cancellation.
  const party = { questHold: true, leave() {
    leaves++; this.questHold = false; runtime.cancel(this);
  } };
  runtime.engine.offer(party, { x: 0, z: 0 },
    { kind: 'beach', x: 0, z: 150 }, { type: 'party' });
  runtime.parties.set(party, party);
  runtime.stop(); runtime.stop();
  assert.equal(party.questHold, true); // DEFECT: owner hold survived shutdown.
  assert.equal(leaves, 0);
  assert.equal(runtime.active.length, 0);
  assert.equal(runtime.parties.size, 0);
  assert.equal(runtime.enabled, false);
  results.push({ probe: 'stop-party-hold', defectReproduced: true,
    questHold: party.questHold, leaves, active: runtime.active.length,
    partyOwners: runtime.parties.size, enabled: runtime.enabled });
}

{
  const npc = { personHandle: 'delivered', state: 'idle', curiosity: 0.7,
    pos: { x: 0, z: 0 }, disinterestedUntil: 145, cheerTimer: 0, frownTimer: 0 };
  const seat = { occupied: false };
  const crowd = { actorTime: 104, npcs: [npc], bubblesEmpty: false,
    activityClaims: { current: new Map() }, peopleHandles: { resolve: () => npc },
    // Deliberately valid free-seat mock; this probe tests cooldown gating,
    // not seat-reservation implementation or terrain reachability.
    _claimFreeSeat() { assert.equal(seat.occupied, false); seat.occupied = true; return seat; },
  };
  const cart = { position: { x: 12, y: 0, z: 0 }, speed: 0,
    physicsDriven: true, grounded: true, engineState: { immersion: 0 } };
  const chosen = [];
  candidates.call(crowd, cart, 10, 75, handle => chosen.push(handle));
  const boarded = hailBoard.call(crowd, 'delivered', cart);
  assert.deepEqual(chosen, ['delivered']); // DEFECT: selected during cooldown.
  assert.equal(boarded, true); // DEFECT: pickup also ignores cooldown.
  assert.equal(npc.state, 'boarding');
  assert.equal(npc.seatSlot, seat);
  assert.equal(npc.disinterestedUntil - crowd.actorTime, 41);
  results.push({ probe: 'delivery-cooldown-bypass', defectReproduced: true,
    chosen, boarded, state: npc.state, remainingDisinterest: 41 });
}

console.log(JSON.stringify({ checkout, reviewedCommit: 'dd1516c',
  note: 'Assertions intentionally verify defective states; this is not a passing correctness suite.',
  results }, null, 2));
