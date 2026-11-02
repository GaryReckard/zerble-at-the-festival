import { LandscapePlanner } from './planner.js';
import { landscapeVersion,landscapeCandidateAt,landscapeCandidatesInBounds,landscapeToWorld,LANDSCAPE_CELL,LANDSCAPE_QUERY_CELL_LIMIT } from '../worldgen/landscapeCandidates.js';
import { landscapeAdmissionCandidatesInBounds } from '../worldgen/landscape.js';
const intersects=(a,b)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
export class LandscapeMapLayer {
  constructor(changed){this.planner=new LandscapePlanner({onChange:changed});this.disposed=false;}
  nearby(x,z){
    const candidates=landscapeCandidatesInBounds({minX:x-3200,maxX:x+3200,minZ:z-3200,maxZ:z+3200}).filter(c=>c.kind==='mountain-top');
    return candidates.sort((a,b)=>{const ax=(a.bounds.minX+a.bounds.maxX)/2-x,az=(a.bounds.minZ+a.bounds.maxZ)/2-z,bx=(b.bounds.minX+b.bounds.maxX)/2-x,bz=(b.bounds.minZ+b.bounds.maxZ)/2-z;return ax*ax+az*az-bx*bx-bz*bz||a.id.localeCompare(b.id);})[0]||null;
  }
  draw(ctx,{bounds,zoom,x:screenX,z:screenZ}) {
    if(this.disposed||landscapeVersion()!==2)return '';
    const cellsX=Math.floor((bounds.maxX+610)/LANDSCAPE_CELL)-Math.floor((bounds.minX-610)/LANDSCAPE_CELL)+1,cellsZ=Math.floor((bounds.maxZ+610)/LANDSCAPE_CELL)-Math.floor((bounds.minZ-610)/LANDSCAPE_CELL)+1;
    if(cellsX*cellsZ>LANDSCAPE_QUERY_CELL_LIMIT)return 'Landscape plans: zoom in to inspect complete districts.';
    const candidates=landscapeAdmissionCandidatesInBounds(bounds),cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
    candidates.sort((a,b)=>{const acx=(a.bounds.minX+a.bounds.maxX)/2,acz=(a.bounds.minZ+a.bounds.maxZ)/2,bcx=(b.bounds.minX+b.bounds.maxX)/2,bcz=(b.bounds.minZ+b.bounds.maxZ)/2;return (acx-cx)**2+(acz-cz)**2-(bcx-cx)**2-(bcz-cz)**2||a.id.localeCompare(b.id);});
    const stroke=(points,color,width=2,dash=[])=>{
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(screenX(p.x),screenZ(p.z)):ctx.moveTo(screenX(p.x),screenZ(p.z)));ctx.stroke();ctx.setLineDash([]);
    };
    let visible=0;
    ctx.save();ctx.font='11px ui-monospace, monospace';
    for(const candidate of candidates) {
      const state=candidate.kind==='mountain-top'?this.planner.request(candidate):null,plan=state?.status==='ready'?state.plan:null;
      if(!intersects(plan?.bounds||candidate.bounds,bounds))continue;visible++;
      const color=candidate.kind==='wooded-ridge'?'#8bb69c':state?.status==='ready'?'#87e5bc':state?.status==='rejected'?'#e8977c':'#e4c276';
      const b=plan?.bounds||candidate.bounds;
      stroke([{x:b.minX,z:b.minZ},{x:b.maxX,z:b.minZ},{x:b.maxX,z:b.maxZ},{x:b.minX,z:b.maxZ},{x:b.minX,z:b.minZ}],color,1,[5,5]);
      if(candidate.kind==='mountain-top') {
        if(candidate.stream){stroke(candidate.stream.points,'#548db5',Math.max(2,candidate.stream.halfWidth*2*zoom));const r=candidate.stream.receiver;ctx.fillStyle='#416a86';ctx.beginPath();ctx.arc(screenX(r.x),screenZ(r.z),r.radius*zoom,0,Math.PI*2);ctx.fill();}
        const shelves=plan?plan.shelves:candidate.plan.shelves;
        for(const shelf of shelves) {
          const local=[{x:shelf.minX,z:shelf.minZ},{x:shelf.maxX,z:shelf.minZ},{x:shelf.maxX,z:shelf.maxZ},{x:shelf.minX,z:shelf.maxZ}],points=plan?local:local.map(p=>landscapeToWorld(candidate,p.x,p.z));
          // This planned meadow replaces the underlying legacy density dots.
          ctx.fillStyle=shelf.density==='sparse'?'#263a25':'#30482d';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(screenX(p.x),screenZ(p.z)):ctx.moveTo(screenX(p.x),screenZ(p.z)));ctx.closePath();ctx.fill();
          stroke([...points,points[0]],color,1);
          const center=plan?{x:(shelf.minX+shelf.maxX)/2,z:(shelf.minZ+shelf.maxZ)/2}:landscapeToWorld(candidate,(shelf.minX+shelf.maxX)/2,(shelf.minZ+shelf.maxZ)/2);
          ctx.fillStyle='#edf7da';ctx.fillText(`Meadow ${shelves.indexOf(shelf)+1} · ${shelf.height}m`,screenX(center.x)-38,screenZ(center.z));
        }
        if(plan) {
          stroke(plan.mainRoad,'#caa47b',Math.max(2,9*zoom));stroke(plan.narrowPath,'#b8a16d',Math.max(1,5.6*zoom));
          stroke(plan.connection.points,'#8de3d4',Math.max(2,plan.connection.width*zoom));
          for(const p of plan.accessPaths)stroke(p,'#9da97e',Math.max(1,5*zoom));
          for(const camp of plan.camps){ctx.fillStyle=camp.role==='host'?'#ffcc8d':'#e0e5cd';ctx.beginPath();ctx.arc(screenX(camp.x),screenZ(camp.z),Math.max(2,camp.recipe.footprint*zoom*.5),0,Math.PI*2);ctx.fill();}
          ctx.strokeStyle='#ffb780';ctx.beginPath();ctx.arc(screenX(plan.clearing.x),screenZ(plan.clearing.z),plan.clearing.radius*zoom,0,Math.PI*2);ctx.stroke();
        }
      }
      ctx.fillStyle=color;const text=candidate.kind==='wooded-ridge'?`wooded ridge · ${Math.round(candidate.plan.topHeight*candidate.heightScale)}m`: `${candidate.plan.form.replace(/-/g,' ')} · ${state?.status||'pending'}${plan?` · ${plan.camps.length} pitches`:''}`;
      ctx.fillText(text,screenX(b.minX)+5,screenZ(b.minZ)+15);
    }
    ctx.restore();const stats=this.planner.stats();
    return `Landscape v2 · ${visible} in view · ${stats.ready} ready · ${stats.rejected} rejected · ${stats.pending} pending${stats.error?` · ${stats.error}`:''}`;
  }
  inspect(x,z){
    if(landscapeVersion()!==2)return '';
    let candidate=landscapeCandidateAt(x,z);
    if(!candidate)candidate=landscapeAdmissionCandidatesInBounds({minX:x,maxX:x,minZ:z,maxZ:z}).find(c=>{const state=this.planner.read(c);return state?.status==='ready'&&intersects(state.plan.bounds,{minX:x,maxX:x,minZ:z,maxZ:z});});
    if(!candidate)return '';
    const state=this.planner.read(candidate);
    return `\nlandscape  ${candidate.kind} · ${candidate.plan.form}\nowner      ${candidate.id}\naccess     ${state?.status||'not requested'}${state?.reason?` · ${state.reason}`:''}`;
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.planner.dispose();}
}
