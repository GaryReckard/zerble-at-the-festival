// Real population-internal group boundary with only terrain sampling replaced.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../../src/people/groupParticipation.js',import.meta.url),'utf8').replace(/^import\s[\s\S]*?;\s*$/gm,'').replace(/export (class|function) /g,'$1 ');
export function loadGroupParticipation(terrainHeight=()=>0){return runInNewContext(source+';({GroupParticipation,publishGroupBinding,hideGroupBinding,releaseGroupBinding})',{terrainHeight,TypeError,AggregateError});}
