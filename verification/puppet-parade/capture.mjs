import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const session = process.env.ZERBLE_BROWSER_SESSION;
if (!session) throw new Error('Set ZERBLE_BROWSER_SESSION to the owned browser session.');
const run = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { timeout: 25000, encoding: 'utf8' });
const evaluate = code => {
  const response = JSON.parse(run('--json', 'eval', code));
  if (!response.success) throw new Error(JSON.stringify(response));
  return response.data.result;
};
const output = new URL('./', import.meta.url).pathname;
const records = [];
for (const tier of ['high', 'low', 'mid']) {
  run('open', `http://127.0.0.1:8765/sandbox.html?entity=puppet_heron&perf=${tier}`);
  run('wait', '--fn', '!!window.__sandbox?.entityRoot');
  records.push({ tier, tests: evaluate('import("/verification/puppet-parade/check.mjs").then(m=>m.checkParade())') });
  const subjects = tier === 'high' ? ['heron', 'dragon', 'seahorse', 'jellyfish', 'moon', 'star', 'lineup'] : ['heron', 'lineup'];
  for (const subject of subjects) for (const [name, time] of [['noon', 0.30], ['midnight', 0.75]]) {
    const key = `puppet_${subject}`;
    evaluate(`__sandbox.loadEntity(${JSON.stringify(key)}); __sandbox.tod.setT(${time}); document.getElementById('hud').hidden=true; __sandbox.cam.pitch=0.12; __sandbox.applyCam(); true`);
    run('screenshot', `${output}${subject}-${tier}-${name}.png`);
    records.push(evaluate(`({subject:${JSON.stringify(subject)},tier:${JSON.stringify(tier)},tod:__sandbox.tod.t,nightness:__sandbox.tod.nightness,viewport:[innerWidth,innerHeight],camera:__sandbox.camera.position.toArray(),target:__sandbox.cam.target.toArray(),render:__sandbox.renderer.__sceneInfo,memory:__sandbox.renderer.info.memory})`));
  }
  const samples = [];
  for (let i = 0; i < 7; i++) {
    evaluate('__sandbox.loadEntity("puppet_lineup"); true');
    run('wait', '--fn', '__sandbox.renderer.__sceneInfo.calls > 0');
    samples.push(evaluate('({...__sandbox.renderer.info.memory})'));
  }
  records.push({ tier, lifecycle: samples });
  if (tier === 'high') {
    evaluate('__sandbox.loadEntity("puppet_heron"); __sandbox.tod.setT(0.75); true');
    for (const t of [0, 0.45, 0.9, 1.35]) {
      evaluate(`import('/src/models/puppet.js').then(m=>m.setPuppetTime(__sandbox.entityRoot,${t}))`);
      run('screenshot', `${output}heron-pose-${t}.png`);
    }
  }
  if (tier === 'low') {
    run('set', 'viewport', '390', '844');
    evaluate('__sandbox.loadEntity("puppet_heron"); __sandbox.cam.dist=16; __sandbox.applyCam(); __sandbox.tod.setT(0.75); true');
    run('screenshot', `${output}heron-mobile-low.png`);
    run('set', 'viewport', '1000', '720');
  }
  const errors = run('errors');
  const console = run('console');
  if (errors.trim() || /\[error\]/i.test(console)) throw new Error(errors + console);
  records.push({ tier, errors, console });
}
writeFileSync(`${output}results.json`, JSON.stringify(records, null, 2) + '\n');
process.stdout.write('Saved subject captures, real-Three tests, lifecycle samples, and console records.\n');
