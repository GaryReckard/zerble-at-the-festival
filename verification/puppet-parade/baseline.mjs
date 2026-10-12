import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const session = process.env.ZERBLE_BROWSER_SESSION;
if (!session) throw new Error('Set ZERBLE_BROWSER_SESSION to the owned sandbox session.');
const source = execFileSync('git', ['show', 'd505cb9:src/models/puppet.js'], { encoding: 'utf8' });
const code = `(async()=>{
  const THREE=await import('three');
  const old=await import(${JSON.stringify('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))});
  const current=await import('/src/models/puppet.js');
  const {disposePuppet}=await import('/verification/puppet-parade/check.mjs');
  const measure=(build)=>{const root=new THREE.Group();let draws=0,triangles=0;for(let i=0;i<6;i++)root.add(build(i));root.traverse(n=>{if(n.isMesh){draws++;triangles+=(n.geometry.index?.count??n.geometry.attributes.position.count)/3;}});disposePuppet(root);return {draws,triangles};};
  return {baselineRef:'d505cb9',old:measure(i=>old.buildPuppet(i)),current:measure(i=>current.buildPuppet(current.PARADE_ROSTER[i],i))};
})()`;
const r = JSON.parse(execFileSync('agent-browser', ['--session', session, '--json', 'eval', code], { timeout: 25000, encoding: 'utf8' }));
if (!r.success) throw new Error(JSON.stringify(r));
writeFileSync(new URL('./baseline.json', import.meta.url), JSON.stringify(r.data.result, null, 2) + '\n');
process.stdout.write(JSON.stringify(r.data.result) + '\n');
