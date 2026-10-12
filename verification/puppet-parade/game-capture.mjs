import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const session = process.env.ZERBLE_BROWSER_SESSION;
if (!session) throw new Error('Set ZERBLE_BROWSER_SESSION.');
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { timeout: 25000, encoding: 'utf8' });
const evaluate = code => {
  const r = JSON.parse(run('--json', 'eval', code));
  if (!r.success) throw new Error(JSON.stringify(r));
  return r.data.result;
};
const output = new URL('./', import.meta.url).pathname;
const records = [];
for (const tier of ['low', 'mid', 'high']) {
  run('open', `http://127.0.0.1:8765/?perf=${tier}&seed=3948869160`);
  run('wait', '--fn', '!!window.__dbg');
  run('screenshot', `${output}game-${tier}-title.png`);
  run('click', '#start-btn');
  run('wait', '--fn', '__dbg.game.puppets.puppets[0].userData.time > 1');
  evaluate(`__dbg.game.sound.setMuted(true); __dbg.debug.god(true); const p=__dbg.game.puppets.puppets[2].position; __dbg.teleport(p.x+12,p.z+12); true`);
  run('wait', '--fn', '__dbg.game.puppets.puppets[0].userData.time > 3');
  for (const [name, time] of [['noon', 0.30], ['midnight', 0.75]]) {
    evaluate(`(()=>{__dbg.tod(${time}); const p=__dbg.game.puppets.puppets[1].position; __dbg.camLock(p.x+14,8,p.z+17,p.x,2.5,p.z); return true;})()`);
    run('screenshot', `${output}game-${tier}-${name}.png`);
    records.push(evaluate(`({tier:${JSON.stringify(tier)},tod:__dbg.game.getTimeOfDay().t,roots:__dbg.game.puppets.puppets.map(p=>({kind:p.userData.kind,position:p.position.toArray(),time:p.userData.time})),colliders:__dbg.game.puppets.colliders.map(c=>({kind:c.kind,radius:c.radius,position:c.position.toArray()})),camera:__dbg.game.camera.position.toArray(),memory:__dbg.game.renderer.info.memory})`));
  }
  evaluate('__dbg.debug.pause(false); true');
  const errors = run('errors'), console = run('console');
  if (errors.trim() || /\[error\]/i.test(console)) throw new Error(errors + console);
  records.push({ tier, errors, console });
}
writeFileSync(`${output}game-results.json`, JSON.stringify(records, null, 2) + '\n');
process.stdout.write('Saved Low/Mid/High real-start game renders and clean console records.\n');
