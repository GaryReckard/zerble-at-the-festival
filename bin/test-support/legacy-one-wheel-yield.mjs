// Frozen raw-record oracle from pre-refactor 9eaf2e5d73419f7c926c11ab06882f007b2bf1e4.
// Test both the current pedestrian position and a short velocity prediction.
// The envelope grows with speed so ordinary approaches stop before contact.
export function riderYieldReason(x,z,heading,speed,player,pedestrians) {
  const fx=Math.sin(heading),fz=Math.cos(heading),look=2.2+speed*.8;
  const threatens=(px,pz,radius)=>{
    const dx=px-x,dz=pz-z,along=dx*fx+dz*fz,side=Math.abs(dx*fz-dz*fx);
    return Math.hypot(dx,dz)<radius || (along>0&&along<look+radius&&side<radius);
  };
  if(player&&threatens(player.x,player.z,2.4))return 'yielding to Zerble';
  for(const n of pedestrians||[]){
    if(n.state==='riding'||n.state==='hammock_riding'||n.state==='table_seated')continue;
    if(threatens(n.pos.x,n.pos.z,1.35)||threatens(n.pos.x+(n.vel?.x||0)*.7,n.pos.z+(n.vel?.z||0)*.7,1.35))return 'yielding to pedestrians';
  }
  return null;
}

// Same envelope, consuming the adult population's public copied query. This
// deliberately retains the existing adult-only policy and seated exclusions.
