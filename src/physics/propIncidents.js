// Relay only through actual solid contacts with measurable incoming closure.
// Sensors and mere force persistence are not new incidents. Before-step poses
// retain incoming velocity that the solver may have removed during the impact.
export function relayPropIncidents({ledger,events,before,time,minApproach=1.2}) {
 const edges=new Map();
 for(const e of events) {
  if(e.type!=='contact-start'&&!(e.type==='contact-force'&&e.units==='N'&&e.totalForceMagnitude>0))continue;
  const a=before.get(e.a),b=before.get(e.b);if(!a||!b||a.key===b.key)continue;
  const dx=b.position.x-a.position.x,dy=b.position.y-a.position.y,dz=b.position.z-a.position.z,d=Math.hypot(dx,dy,dz);
  if(!d)continue;
  const approach=((a.velocity.x-b.velocity.x)*dx+(a.velocity.y-b.velocity.y)*dy+(a.velocity.z-b.velocity.z)*dz)/d;
  if(approach<=minApproach)continue;
  const pair=[a.key,b.key].sort();edges.set(JSON.stringify(pair),pair);
 }
 const ordered=[...edges].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,edge])=>edge);
 let changes=0;
 // Revisit a bounded graph to remove collider-event ordering from propagation.
 // Shorter paths can reduce hop count, but never extend the original lifetime.
 for(let round=0;round<ledger.stats().capacities.maxHops;round++) {
  let changed=false;
  for(const [a,b] of ordered) {
   const left=ledger.read(a,time),right=ledger.read(b,time);
   if(!left&&!right)continue;
   const source=!right||left&&(left.id>right.id||left.id===right.id&&left.hops<=right.hops)?a:b;
   const result=ledger.propagate(source,source===a?b:a,time);
   if(result.changed){changed=true;changes++;}
  }
  if(!changed)break;
 }
 return {contacts:ordered.length,changes};
}
