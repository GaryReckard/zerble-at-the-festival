#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { buildSnapshot, resolveCommit, git, ROOT, SOURCE_URL } from '../tooling/time-machine/build.mjs';
import { renderTimeline } from '../tooling/time-machine/site.mjs';

const args = process.argv.slice(2), option = key => args[args.indexOf(key)+1];
for (let index=0;index<args.length;index++) {
  if(args[index] === '--milestones') continue;
  if(!['--output','--ref'].includes(args[index]) || !args[index+1] || args[index+1].startsWith('--')) throw Error('Invalid archive command arguments.');
  index++;
}
if(args.includes('--ref') && args.includes('--milestones')) throw Error('Choose one commit or the milestone collection.');
if (!args.includes('--output') || (!args.includes('--ref') && !args.includes('--milestones'))) {
  console.error('Usage: node bin/time-machine.mjs --output <site-directory> (--milestones | --ref <commit-or-tag>)');
  process.exit(1);
}
const destination = resolve(option('--output'));
if (destination === ROOT || ROOT.startsWith(destination + '/') || destination.startsWith(ROOT + '/')) throw Error('Output must be separate from the source repository.');
let snapshots = [];
try { snapshots = JSON.parse(await readFile(join(destination,'snapshots.json'),'utf8')).snapshots; }
catch(error) { if(error.code !== 'ENOENT') throw error; }
const milestones = JSON.parse(await readFile(resolve(ROOT,'tooling/time-machine/milestones.json'),'utf8'));
const refs = args.includes('--ref') ? [option('--ref')] : [...milestones.map(item => item.ref),
  ...git('tag','--list','time-machine/*').split('\n').filter(Boolean)];
for (const ref of [...new Set(refs.map(resolveCommit))]) {
  console.log(`Preparing ${ref.slice(0,12)}…`);
  const snapshot = await buildSnapshot(ref,destination);
  const tag = git('tag','--points-at',snapshot.source,'--list','time-machine/*').split('\n').filter(Boolean)[0];
  if (tag) snapshot.milestoneTag = tag;
  // Changelog dates describe changes, while the snapshot date is the actual
  // integrated commit date. Never silently map a dated entry to another tree.
  try {
    git('cat-file','-e',`${snapshot.source}:CHANGELOG.md`);
    snapshot.changelogURL = `${SOURCE_URL}/blob/${snapshot.source}/CHANGELOG.md`;
  } catch { /* The first few commits predate the changelog. */ }
  const previous = snapshots.findIndex(item => item.id === snapshot.id);
  if(previous >= 0) snapshots[previous] = snapshot; else snapshots.push(snapshot);
  console.log(`Ready: ${snapshot.id}/`);
}
const chapters = await renderTimeline(destination,snapshots);
console.log(`Time Machine: ${chapters.length} curated chapters, ${snapshots.length} immutable snapshots in ${destination}`);
