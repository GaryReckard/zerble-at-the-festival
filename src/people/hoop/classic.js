import {sampleHulaMotion} from '../../personMotion.js';
import {createFoot,createDanceFrame,writeDanceFrame,inversePoint,inverseOrientation} from './dance.js';

// Waist hooping and flow use the same articulated performer contract. These
// feet stay in the session frame while the hips compress and lean above them.
export function sampleClassicHoopMotion(phase,spin,out) {
  if(!Number.isFinite(phase)||!Number.isFinite(spin)||spin<=0)throw new RangeError('Classic hoop motion needs a finite phase and positive spin.');
  sampleHulaMotion(phase,spin,out);
  out.style='classic';out.articulated=true;out.inertialContacts=false;out.hoopCount=0;
  out.time=phase/5.25;out.segment=-1;out.kind='classic-waist';out.motif='waist-groove';
  out.travelX=out.travelZ=out.turn=out.stride=out.compression=out.waistDrive=0;out.waistPhase=phase;
  const sine=Math.sin(phase),cosine=Math.cos(phase);
  out.bob=0;out.leanX=.035*cosine;out.leanZ=.045*sine;out.rootY=-.025-.012*sine*sine;
  out.headYaw=.12*Math.sin(phase+.35);out.headTilt=.045*Math.cos(phase+.2);
  const a=out.arms??={};
  a.x=-.16+.11*sine;a.z=2.32+.18*sine;a.elbow=-.42-.18*Math.sin(phase+Math.PI/3);
  a.leftX=-.15-.10*sine;a.leftZ=-2.38+.15*cosine;a.leftElbow=.46+.12*Math.sin(phase+Math.PI/3);
  const feet=out.feet??={left:createFoot(),right:createFoot()};out.frame??=createDanceFrame();writeDanceFrame(out);
  for(let side=0;side<2;side++) {
    const foot=side?feet.right:feet.left;
    foot.x=side?.13:-.13;foot.y=foot.z=0;foot.qx=foot.qy=foot.qz=0;foot.qw=1;
    foot.plantId=side;foot.planted=true;inversePoint(foot,out);inverseOrientation(foot,out);
  }
  return out;
}
