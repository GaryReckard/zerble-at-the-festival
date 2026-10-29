// Diagnostic only: dump the exact values hashed by the road layout regression.
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const load=file=>import(pathToFileURL(root+'/src/'+file));
const {setSessionSeed}=await load('rng.js');
const {nearestRoad}=await load('worldgen/roads.js');
const {queryPoint}=await load('worldgen/index.js');
const {heartsInBounds}=await load('worldgen/hearts.js');
const {festivalPlan}=await load('worldgen/festival.js');
const all={};
for(const seed of [0,42,1234,3248888364]){
 setSessionSeed(seed);
 const records=[];
 for(let z=-300;z<=300;z+=37)for(let x=-300;x<=300;x+=41){const {onRoad,tier,dist,dirAngle}=nearestRoad(x,z);records.push([queryPoint(x,z),{onRoad,tier,dist,dirAngle}]);}
 const plans=heartsInBounds(-600,-600,600,600).map(h=>festivalPlan(h));
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 all[seed]={records,plans};
 console.error(seed,hash(records),hash(plans));
}
process.stdout.write(JSON.stringify(all));
