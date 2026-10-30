// Pure, seekable choreography in the person's unscaled presentation frame.
// Crowd faces local -Z (eyes, nose and shoe toes in crowd.js). Authoring uses
// a positive-depth construction frame, then reflects the entire coordinated
// sample into that actual performer frame exactly once at publication.
// The rendered torus starts in XY with normal +Z. Material spin never changes
// the geometric contact angle. No Three.js, clock, RNG draw or shared scratch
// belongs to sampling; callers own one createHoopSample() per reader.
import {compileDance,createFoot,createDanceFrame,sampleDance,inversePoint,inverseOrientation,verticalOffset,feetReachable,HOOP_REST_ROOT_Y} from './dance.js';
import {sampleChestRoll,CHEST_ROLL_FRAME,CHEST_ROLL_SPIN_DELTA,CHEST_ROLL_LEAN_X} from './chestRoll.js';
export const HOOP_SCORE_VERSION=6;
export const HOOP_RADIUS=.58;
const TAU=Math.PI*2, L=.29, SHOULDER_Y=1.35, WAIST_OFFSET=.285, GRAVITY=9.81, TOSS_HAND_Y=1.62;
const PROFILES=Object.freeze({
  lyrical:Object.freeze({amplitude:.045,tilt:.10,spin:2.1,isolation:2.8,orbit:3.4,overhead:1.8,turns:1}),
  playful:Object.freeze({amplitude:.075,tilt:.17,spin:3.8,isolation:1.5,orbit:2.7,overhead:1.6,turns:2}),
  aerial:Object.freeze({amplitude:.055,tilt:.14,spin:2.8,isolation:1.8,orbit:2.8,overhead:3.4,turns:1}),
});
const KINDS=Object.freeze(['entrance','hand-orbit','isolation','transfer','answer-orbit','overhead-rise','overhead-orbit','overhead-return','return-transfer','motif-return','resolution']);
const smooth=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
// Performer-frame weight targets: X/Z travel, heading, X/Z lean and gaze.
// These persist across related contacts. Isolation and flight have their own
// moving body curves while their contact targets remain in an inertial frame.
const BODY_POSES=Object.freeze({
  neutral:Object.freeze([0,0,0,0,0,0,0]),
  right:Object.freeze([.04,0,-.06,-.005,-.03,-.10,-.015]),
  left:Object.freeze([-.06,-.02,.10,-.01,.04,.12,-.015]),
  answer:Object.freeze([-.06,-.04,.12,-.01,.04,.12,-.02]),
  overhead:Object.freeze([-.035,-.04,.08,.035,.025,.08,-.045]),
  threading:Object.freeze([-.04,.025,.06,.02,.025,.10,-.015]),
  waist:Object.freeze([0,.03,0,.015,0,0,.015]),
  feeding:Object.freeze([.06,0,-.10,.015,-.04,-.10,.02]),
  support:Object.freeze([-.08,.015,.14,.02,.055,.16,.025]),
  chestLeft:Object.freeze([0,0,0,CHEST_ROLL_LEAN_X,0,.22,-.03]),
  chestRight:Object.freeze([0,0,0,CHEST_ROLL_LEAN_X,0,-.22,-.03]),
});
const BODY_END=Object.freeze({
  entrance:'right','hand-orbit':'neutral',isolation:'neutral',transfer:'left','answer-orbit':'answer',
  'overhead-rise':'overhead','overhead-orbit':'overhead','overhead-return':'left','return-transfer':'right',
  'motif-return':'right',resolution:'neutral','thread-down':'threading','waist-lower':'waist','waist-feed':'feeding',
  'body-orbit':'feeding','waist-catch':'waist','waist-lift':'overhead','thread-up':'overhead',
  'chest-enter':'chestLeft','chest-seat':'chestLeft','chest-roll':'chestRight','chest-regrip':'chestRight','chest-return':'right','chest-handoff':'left','chest-lift':'overhead',
  'roll-enter':'support','roll-seat':'support','forearm-roll':'support','roll-regrip':'support','roll-return':'overhead',
});
function bodyTarget(name,gain){
  const p=BODY_POSES[name];return {travelX:p[0]*gain,travelZ:p[1]*gain,turn:p[2]*gain,leanX:name.startsWith('chest')?p[3]:p[3]*gain,leanZ:p[4]*gain,headYaw:p[5]*gain,headTilt:p[6]*gain};
}
const ROLL=makeRollFrame();
function makeRollFrame(){
  const hand={x:-.80,y:1.40,z:.20},arms={};solveHand(hand,true,arms);
  const ex=-.30+L*Math.sin(arms.leftZ),ey=SHOULDER_Y-L*Math.cos(arms.leftZ)*Math.cos(arms.leftX),ez=-L*Math.cos(arms.leftZ)*Math.sin(arms.leftX);
  // U follows the real forearm toward the elbow. V is its upper/back support
  // normal, obtained by projecting the desired normal off that tangent.
  const ux=(ex-hand.x)/L,uy=(ey-hand.y)/L,uz=(ez-hand.z)/L;
  const dot=uy*.8-uz*.6;
  let vx=-dot*ux,vy=.8-dot*uy,vz=-.6-dot*uz;
  const length=Math.hypot(vx,vy,vz);vx/=length;vy/=length;vz/=length;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const q=2*Math.sqrt(1+ux+vy+nz);
  return Object.freeze({x:hand.x,y:hand.y,z:hand.z,ex,ey,ez,ux,uy,uz,vx,vy,vz,
    qx:(vz-ny)/q,qy:(nx-uz)/q,qz:(uy-vx)/q,qw:q/4});
}
function bounded(v,min,max,label,integer=false){
  if(!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw new RangeError(`Invalid hoop ${label}`);
  return v;
}
// Independent named salts keep future vocabulary choices from changing this
// phrase's existing draws or the activity/world generation streams.
function random(seed,slot,generation,salt){
  let h=(seed^Math.imul(slot+1,0x9e3779b1)^Math.imul(generation,0x85ebca6b)^salt)>>>0;
  h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/4294967296;
}
function freeze(score){
  if(score&&typeof score==='object'&&!Object.isFrozen(score)){
    for(const value of Object.values(score))freeze(value);Object.freeze(score);
  }
  return score;
}

export function compileHoopScore({seed=1,slot=0,generation=1,profile='lyrical',duration=22,hoops=1}={}){
  bounded(seed,-2147483648,4294967295,'seed',true);bounded(slot,0,1048576,'slot',true);
  bounded(generation,1,2147483647,'generation',true);bounded(duration,4,120,'duration');
  bounded(hoops,1,2,'count',true);
  if(!Object.hasOwn(PROFILES,profile))throw new RangeError('Invalid hoop profile');
  const p=PROFILES[profile];
  const parameters={
    amplitude:p.amplitude*(.85+.15*random(seed,slot,generation,0x484f4f50)),
    tilt:p.tilt*(.8+.2*random(seed,slot,generation,0x504c414e)),
    spinRate:p.spin*(.9+.2*random(seed,slot,generation,0x5350494e)),
    direction:random(seed,slot,generation,0x48414e44)<.5?-1:1,
    phase:TAU*random(seed,slot,generation,0x50484153),turns:p.turns,
    variation:Math.floor(3*random(seed,slot,generation,0x56415259)),
    bodyGain:(profile==='lyrical'?.9:profile==='aerial'?.95:1)*(.9+.1*random(seed,slot,generation,0x424f4459)),
  };
  parameters.tossRise=.65+1.75*random(seed,slot,generation,0x544f5353)**.85;
  parameters.tossSpeed=Math.sqrt(2*GRAVITY*parameters.tossRise);
  parameters.tossDuration=2*parameters.tossSpeed/GRAVITY;
  // Fixed velocity*duration bounds the reachable preparation/recovery dip.
  parameters.tossPrepDuration=1.15/parameters.tossSpeed;
  parameters.tossRecoverDuration=parameters.tossPrepDuration;
  const entries=KINDS.map((kind,i)=>({kind,weight:[1.2,p.orbit,p.isolation,.45,p.orbit*.82,1.4,p.overhead,1.4,.45,p.orbit*.75,1.2][i]}));
  if(hoops===1){
    const development=[{kind:'thread-down',weight:1.5},{kind:'waist-lower',weight:1.3},{kind:'waist-feed',weight:.9},
      {kind:'body-orbit',weight:profile==='playful'?2.8:1.8},{kind:'waist-catch',weight:.9},{kind:'waist-lift',weight:1.3},{kind:'thread-up',weight:1.5}];
    // Forearm support has its own grip and seating transitions, so it never
    // silently changes a hand contact into a point elsewhere along the arm.
    if(parameters.variation===1)development.push({kind:'chest-enter',weight:1.2},{kind:'chest-seat',weight:.3},{kind:'chest-roll',weight:2.6},
      {kind:'chest-regrip',weight:.3},{kind:'chest-return',weight:1.2},{kind:'chest-handoff',weight:.4},{kind:'chest-lift',weight:1.2});
    else development.push({kind:'roll-enter',weight:1.2},{kind:'roll-seat',weight:.35},{kind:'forearm-roll',weight:profile==='lyrical'?2:1.3},
      {kind:'roll-regrip',weight:.35},{kind:'roll-return',weight:1.2});
    if(profile==='aerial')development.unshift({kind:'toss-prepare',fixed:parameters.tossPrepDuration},{kind:'toss',fixed:parameters.tossDuration},{kind:'toss-recover',fixed:parameters.tossRecoverDuration});
    // Both sides of this insertion share the same reachable overhead anchor.
    // A named seed draw changes whether body development answers or precedes
    // the held overhead flourish without introducing an unvalidated join.
    entries.splice(parameters.variation===2?6:7,0,...development);
  }
  const fixed=entries.reduce((sum,e)=>sum+(e.fixed||0),0),total=entries.reduce((sum,e)=>sum+(e.weight||0),0);let start=0;
  let spin=parameters.phase,body=bodyTarget('neutral',parameters.bodyGain);
  const segments=entries.map((entry,i)=>{
    const {kind}=entry,length=i===entries.length-1?duration-start:entry.fixed||(duration-fixed)*entry.weight/total;
    const segment={kind,start,duration:length,motif:kind==='motif-return'?'return':kind==='answer-orbit'?'answer':kind==='entrance'?'entrance':kind==='resolution'?'resolution':kind.includes('waist')||kind==='body-orbit'||kind.startsWith('chest-')?'body-development':kind.includes('overhead')||kind.includes('thread')||kind.includes('toss')?'flourish':'motif',candidateChecks:1};
    segment.spinStart=spin;
    const stopped=kind==='roll-seat'||kind==='roll-regrip'||kind==='forearm-roll'||kind==='chest-seat'||kind==='chest-regrip';
    const ramp=kind==='roll-enter'||kind==='roll-return'||kind==='chest-enter'||kind==='chest-return';
    spin+=kind==='chest-roll'?CHEST_ROLL_SPIN_DELTA:stopped?0:parameters.direction*parameters.spinRate*length*(ramp?.5:1);
    segment.spinEnd=spin;
    segment.bodyFrom=body;
    const next=entries[i+1]?.kind;
    const settled=kind==='isolation'||kind.startsWith('toss')||next==='isolation'||next?.startsWith('toss');
    body=bodyTarget(settled?'neutral':BODY_END[kind]||'neutral',parameters.bodyGain);
    segment.bodyTo=body;
    start+=length;return segment;
  });
  const bridges=hoops===1?compileBridges({parameters,segments}):[];
  const bodySource={parameters},stepCount=compileDance(segments,(segment,u,out)=>sampleBody(bodySource,segment,u,out,true),parameters.bodyGain);
  return freeze({version:HOOP_SCORE_VERSION,seed,slot,generation,profile,duration,hoops,parameters,segments,bridges,stepCount,
    // Includes torus sweeps, phrase travel, torso lean, sole support and tube.
    envelope:{radius:2.8,height:profile==='aerial'&&hoops===1?Math.max(3.4,TOSS_HAND_Y+2*HOOP_RADIUS+parameters.tossRise+.12):3.4},candidateChecks:segments.length,
    vocabulary:hoops===2?'separated-twin-v1':'hand-body-flight-v1'});
}

// Importing JSON is a trust boundary. The replay format stores accepted
// descriptors, but only this version's bounded, proven parameter space is legal.
export function validateHoopScore(score){
  if(!score||score.version!==HOOP_SCORE_VERSION)throw new RangeError('Unsupported hoop score version');
  const canonical=compileHoopScore(score);
  if(score.vocabulary!==canonical.vocabulary||score.candidateChecks!==canonical.candidateChecks||score.stepCount!==canonical.stepCount)throw new RangeError('Invalid hoop vocabulary');
  if(!score.parameters||!score.envelope||!Array.isArray(score.segments)||score.segments.length!==canonical.segments.length)throw new RangeError('Invalid hoop score descriptors');
  for(const key of Object.keys(canonical.parameters))if(score.parameters[key]!==canonical.parameters[key])throw new RangeError(`Invalid hoop parameter ${key}`);
  for(const key of ['radius','height'])if(score.envelope[key]!==canonical.envelope[key])throw new RangeError('Invalid hoop envelope');
  if(!sameDescriptor(score.bridges,canonical.bridges))throw new RangeError('Invalid hoop bridges');
  for(let i=0;i<canonical.segments.length;i++)if(!sameDescriptor(score.segments[i],canonical.segments[i]))throw new RangeError(`Invalid hoop segment ${i}`);
  return score;
}
function sameDescriptor(actual,expected){
  if(expected&&typeof expected==='object'){
    if(!actual||typeof actual!=='object'||(Array.isArray(expected)&&(!Array.isArray(actual)||actual.length!==expected.length)))return false;
    for(const key of Object.keys(expected))if(!sameDescriptor(actual[key],expected[key]))return false;
    return true;
  }
  return actual===expected;
}

function hoop(){return {x:0,y:0,z:0,qx:0,qy:0,qz:0,qw:1,spin:0,contact:'none',contactAngle:0,leftContactAngle:0,radius:HOOP_RADIUS,supportX:0,supportY:0,supportZ:0,supportRadius:0,supportT:0};}
export function createHoopSample(){
  return {style:'flow',bob:0,leanX:0,leanZ:0,travelX:0,travelZ:0,turn:0,stride:0,rootY:0,compression:0,waistPhase:0,waistDrive:0,inertialContacts:false,headYaw:0,headTilt:0,feet:{left:createFoot(),right:createFoot()},frame:createDanceFrame(),arms:{x:0,z:0,elbow:0,leftX:0,leftZ:0,leftElbow:0},
    hoopCount:0,hoops:[hoop(),hoop()],hands:{right:{x:0,y:0,z:0},left:{x:0,y:0,z:0}},
    time:0,segment:0,motif:'entrance',kind:'entrance',generation:0,version:HOOP_SCORE_VERSION};
}

// This is exactly R_x(shoulderX) * R_z(shoulderZ) * the elbow chain from
// personMotion.armShader. A plain caller-owned XYZ object is sufficient.
export function sampleHoopHand(arms,side,out){
  const left=side==='left',e=left?arms.leftElbow:arms.elbow,z=left?arms.leftZ:arms.z,x=left?arms.leftX:arms.x;
  const ex=L*Math.sin(e),ey=-L*(1+Math.cos(e));
  const px=Math.cos(z)*ex-Math.sin(z)*ey,py=Math.sin(z)*ex+Math.cos(z)*ey;
  out.x=(left?-.30:.30)+px;out.y=SHOULDER_Y+Math.cos(x)*py;out.z=Math.sin(x)*py;return out;
}

// Exact inverse of that restricted rig, not an unconstrained three-axis IK.
// Shoulder X rotates the arm's negative-Y plane into the target Y/Z ray;
// the two equal segments then reduce to a planar triangle. All authored targets
// stay inside the reachable ball and in front of the shoulder. The deliberate
// straight T pose used by chest rolls has a free shoulder-X angle; its approach
// curves converge to zero, and the roundoff-only pole branch preserves that
// choice. The tiny acos clamp never repairs an unreachable authored target.
function solveHand(hand,left,arms){
  const dx=hand.x-(left?-.30:.30),dy=hand.y-SHOULDER_Y,dz=hand.z;
  // Choose the elbow-out branch. The mathematically equivalent elbow-in
  // branch would drive the elbow through the torso when feeding the waist.
  const straight=Math.abs(dy)<5e-14&&Math.abs(dz)<5e-14&&Math.abs(Math.abs(dx)-.58)<5e-14;
  const reach=Math.hypot(dx,dy,dz),e=straight?0:(left?1:-1)*2*Math.acos(Math.min(1,reach/(2*L)));
  const x=straight?0:Math.atan2(-dz,-dy),z=Math.atan2(dx,Math.hypot(dy,dz))-e/2;
  if(left){arms.leftX=x;arms.leftZ=z;arms.leftElbow=e;}
  else{arms.x=x;arms.z=z;arms.elbow=e;}
}
function setHand(hand,x,y,z){hand.x=x;hand.y=y;hand.z=z;}
function resetHoop(h,spin){h.x=0;h.y=0;h.z=0;h.qx=0;h.qy=0;h.qz=0;h.qw=1;h.spin=spin;h.contact='none';h.contactAngle=0;h.leftContactAngle=0;h.radius=HOOP_RADIUS;h.supportX=0;h.supportY=0;h.supportZ=0;h.supportRadius=0;h.supportT=0;}
function plane(h,x,y){
  const sx=Math.sin(x/2),cx=Math.cos(x/2),sy=Math.sin(y/2),cy=Math.cos(y/2);
  // qY * qX, with all authored angles < pi, keeps a stable quaternion sign.
  h.qx=cy*sx;h.qy=sy*cx;h.qz=-sy*sx;h.qw=cy*cx;
}
function supportPlane(h,amount){
  // Interpolate the actual support normal before orthogonalizing the tangent.
  // Generic quaternion slerp introduces a sideways sweep of this large rim.
  let vx=ROLL.vx*amount,vy=1+(ROLL.vy-1)*amount,vz=ROLL.vz*amount;
  const vl=Math.hypot(vx,vy,vz);vx/=vl;vy/=vl;vz/=vl;
  let ux=1+(ROLL.ux-1)*amount,uy=ROLL.uy*amount,uz=ROLL.uz*amount;
  const dot=ux*vx+uy*vy+uz*vz;ux-=dot*vx;uy-=dot*vy;uz-=dot*vz;
  const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,q=2*Math.sqrt(1+ux+vy+nz);
  h.qx=(vz-ny)/q;h.qy=(nx-uz)/q;h.qz=(uy-vx)/q;h.qw=q/4;
}
function fromHand(h,hand,angle,contact){
  const x=HOOP_RADIUS*Math.cos(angle),y=HOOP_RADIUS*Math.sin(angle);
  const tx=-2*h.qz*y,ty=2*h.qz*x,tz=2*(h.qx*y-h.qy*x);
  h.x=hand.x-(x+h.qw*tx+h.qy*tz-h.qz*ty);
  h.y=hand.y-(y+h.qw*ty+h.qz*tx-h.qx*tz);
  h.z=hand.z-(h.qw*tz+h.qx*ty-h.qy*tx);
  h.contact=contact;h.contactAngle=angle;
}

function single(score,index,u,out){
  const segment=score.segments[index],kind=segment.kind;
  index=KINDS.indexOf(kind);
  const s=smooth(u),p=score.parameters,a=p.amplitude,d=p.direction;
  const wave=Math.sin(TAU*s),bump=Math.sin(Math.PI*s),h=out.hoops[0],right=out.hands.right,left=out.hands.left;
  setHand(right,.58,1.35,.34);setHand(left,-.58,1.35,.34);
  if(kind==='chest-roll'){
    sampleChestRoll(u,out,segment.spinStart,1);
  }else if(kind==='chest-enter'){
    const lateral=smooth(Math.min(1,s*2)),tip=smooth(Math.max(0,s*2-1));
    if(s<=.5)setHand(left,mix(-.22,-.76,lateral),mix(1.78,1.35,lateral),mix(.32,.30,lateral));
    else setHand(left,-.88+.12*(1-tip)**2,1.35-.04*Math.sin(Math.PI*tip),.30*(1-tip)**2);
    setHand(right,.88-.30*(1-s)**2,1.35-.07*Math.sin(Math.PI*s),.34*(1-s)**2);
    plane(h,Math.acos(CHEST_ROLL_FRAME.vy)*tip,0);fromHand(h,left,Math.PI*1.5,'left');
  }else if(kind==='chest-seat'||kind==='chest-regrip'){
    setHand(left,-.88,1.35,0);setHand(right,.88,1.35,0);
    const seated=kind==='chest-seat',hand=seated?left:right,radius=.11*(seated?s:1-s),f=CHEST_ROLL_FRAME;
    h.qx=f.qx;h.qy=0;h.qz=0;h.qw=f.qw;
    fromHand(h,hand,-Math.PI/2,seated?'left-palm':'right-palm');
    h.y+=radius*f.vy;h.z+=radius*f.vz;
    h.supportX=hand.x;h.supportY=hand.y+radius*f.vy;h.supportZ=hand.z+radius*f.vz;h.supportRadius=radius;h.supportT=0;
  }else if(kind==='chest-return'){
    const tip=smooth(Math.min(1,s*2)),carry=smooth(Math.max(0,s*2-1));
    if(s<=.5)setHand(right,.88-.12*tip*tip,1.35-.04*Math.sin(Math.PI*tip),.30*tip*tip);
    else setHand(right,mix(.76,.58,carry),1.35,mix(.30,.34,carry));
    setHand(left,-.88+.30*s*s,1.35-.07*Math.sin(Math.PI*s),.34*s*s);
    plane(h,Math.acos(CHEST_ROLL_FRAME.vy)*(1-tip),0);
    fromHand(h,right,Math.PI*1.5+Math.PI/2*carry,'right');
  }else if(kind==='chest-handoff'){
    h.x=0;h.y=1.35+.075*bump*bump;h.z=.34;h.contact='both';h.contactAngle=0;h.leftContactAngle=Math.PI;
    right.y=h.y;left.y=h.y;
  }else if(kind==='chest-lift'){
    setHand(left,mix(-.58,-.22,s),mix(1.35,1.78,s),mix(.34,.32,s));
    right.y-=.12*Math.sin(Math.PI*s)**2;fromHand(h,left,Math.PI+Math.PI/2*s,'left');
  }else if(kind==='roll-enter'||kind==='roll-return'){
    const amount=kind==='roll-enter'?s:1-s;
    // Clear the head laterally while the ring is still vertical, then tip it
    // onto the forearm. A direct quaternion/hand blend cuts through the head.
    const lateral=smooth(Math.min(1,amount*2)),tip=smooth(Math.max(0,amount*2-1));
    setHand(left,-.22+(-.76+.22)*lateral+(ROLL.x+.76)*tip,1.78+(ROLL.y-1.78)*lateral,.32-.02*lateral+(ROLL.z-.30)*tip);
    supportPlane(h,tip);
    fromHand(h,left,Math.PI*1.5,'left');
  }else if(kind==='roll-seat'||kind==='forearm-roll'||kind==='roll-regrip'){
    setHand(left,ROLL.x,ROLL.y,ROLL.z);
    h.qx=ROLL.qx;h.qy=ROLL.qy;h.qz=ROLL.qz;h.qw=ROLL.qw;
    const travel=kind==='forearm-roll'?.8*bump*bump:0;
    const radius=.11*(kind==='roll-seat'?s:kind==='roll-regrip'?1-s:1);
    // The short palm seating passes through the gripping hand's volume; only
    // the forearm phase claims surface support. There the centerline offset
    // is exactly arm capsule .075 + torus tube .035, with no penetration.
    h.supportX=ROLL.x+L*travel*ROLL.ux+radius*ROLL.vx;
    h.supportY=ROLL.y+L*travel*ROLL.uy+radius*ROLL.vy;
    h.supportZ=ROLL.z+L*travel*ROLL.uz+radius*ROLL.vz;
    h.supportT=travel;h.supportRadius=radius;
    h.x=h.supportX+HOOP_RADIUS*ROLL.vx;h.y=h.supportY+HOOP_RADIUS*ROLL.vy;h.z=h.supportZ+HOOP_RADIUS*ROLL.vz;
    h.contact=kind==='forearm-roll'?'left-forearm':'left-palm';h.contactAngle=Math.PI*1.5;
    if(kind==='forearm-roll')h.spin=segment.spinStart-L*travel/HOOP_RADIUS;
  }else if(kind==='thread-down'||kind==='thread-up'){
    const amount=kind==='thread-down'?s:1-s,arch=Math.sin(Math.PI*amount)**2;
    setHand(left,mix(-.22,-.58,amount),mix(1.78,1.60,amount)+.04*arch,mix(.32,.10,amount)+.18*arch);
    setHand(right,.58,mix(1.35,1.60,amount),mix(.34,.10,amount));
    plane(h,-Math.PI/2*amount,0);
    fromHand(h,left,Math.PI*1.5-Math.PI/2*amount,'left');
  }else if(kind==='waist-lower'||kind==='waist-lift'){
    const amount=kind==='waist-lower'?s:1-s;
    h.x=0;h.y=mix(1.60,1,amount);h.z=mix(.10,0,amount);plane(h,-Math.PI/2,0);
    h.contact='both';h.contactAngle=0;h.leftContactAngle=Math.PI;
    setHand(right,.58,h.y,h.z);setHand(left,-.58,h.y,h.z);
  }else if(kind==='waist-feed'||kind==='waist-catch'){
    const amount=kind==='waist-feed'?s:1-s;
    h.x=-WAIST_OFFSET*amount;h.y=1;h.z=0;plane(h,-Math.PI/2,0);
    h.contact='right';h.contactAngle=0;
    setHand(right,.58+h.x,1,0);setHand(left,mix(-.58,-.40,amount),mix(1,1.12,amount),.25*amount);
  }else if(kind==='body-orbit'){
    const angle=TAU*s*d*(p.variation===1?2:1);
    h.x=-WAIST_OFFSET*Math.cos(angle);h.y=1;h.z=-WAIST_OFFSET*Math.sin(angle);plane(h,-Math.PI/2,0);
    h.contact='waist';h.contactAngle=-angle;
    setHand(right,.58-WAIST_OFFSET+.10*bump*bump,1+.10*bump*bump,.20*bump*bump);
    setHand(left,-.40,1.12,.25);
  }else if(kind==='toss-prepare'||kind==='toss-recover'||kind==='toss'){
    let handLift=0,ringLift=0;const speed=p.tossSpeed,curve=u*u*(3-2*u);
    if(kind==='toss-prepare')handLift=(TOSS_HAND_Y-1.78)*curve+speed*segment.duration*(u*u*u-u*u);
    else if(kind==='toss-recover')handLift=TOSS_HAND_Y-1.78+(1.78-TOSS_HAND_Y)*curve-speed*segment.duration*(u*u*u-2*u*u+u);
    else{
      const seconds=u*segment.duration;
      ringLift=speed*seconds-.5*GRAVITY*seconds*seconds;
      // Match release/catch velocity without following the high hoop out of
      // reach. a*exp(-k*a) has a known .12m maximum for every selected apex.
      const a=u*(1-u),distance=speed*segment.duration,k=distance/(.12*Math.E);
      handLift=TOSS_HAND_Y-1.78+distance*a*Math.exp(-k*a);
    }
    const launchDepth=.32+.08*(kind==='toss'?1:kind==='toss-prepare'?smooth(u):1-smooth(u));
    setHand(left,-.22,1.78+handLift,launchDepth);
    fromHand(h,left,Math.PI*1.5,'left');
    if(kind==='toss'){h.y=TOSS_HAND_Y+HOOP_RADIUS+ringLift;h.contact='none';}
  }else if(index===0||index===10){
    right.y+=.045*bump*bump;left.y-=.07*bump*bump;
    fromHand(h,right,0,'right');
  }else if(index===1||index===4||index===9){
    const isLeft=index===4,side=isLeft?-1:1,hand=isLeft?left:right,other=isLeft?right:left;
    const angle=TAU*s*p.turns*d*(isLeft?-1:1),amount=index===9?.65:1;
    hand.x+=side*a*Math.sin(angle)*amount;hand.y+=a*1.5*Math.sin(angle*(p.variation===1?3:2))*amount;hand.z+=.02*bump*bump;
    // Give the newly articulated forward knee room during the low circle.
    // The supporting hand carries the whole ring outward, preserving contact.
    const bottom=hand.y-HOOP_RADIUS*Math.sin((isLeft?Math.PI:0)+angle)-HOOP_RADIUS;
    const lowArc=smooth(Math.max(0,Math.min(1,(.72-bottom)/.22)));
    hand.z+=.085*lowArc;hand.y+=.045*lowArc;
    other.y-=.12*bump*bump;other.x-=side*.04*bump*bump;
    plane(h,p.tilt*.1*Math.sin(angle),p.tilt*.2*Math.sin(angle));
    fromHand(h,hand,(isLeft?Math.PI:0)+angle,isLeft?'left':'right');
  }else if(index===2){
    // A true isolation: the silhouette is stationary while the hand tracks
    // the rim and the colored tape keeps turning independently.
    const angle=.32*wave*d;
    h.x=0;h.y=1.35;h.z=.34;h.contact='right';h.contactAngle=angle;
    setHand(right,HOOP_RADIUS*Math.cos(angle),1.35+HOOP_RADIUS*Math.sin(angle),.34);
    left.y-=.10*bump*bump;
  }else if(index===3||index===8){
    h.x=0;h.y=1.35+.075*bump*bump;h.z=.34;
    h.contact='both';h.contactAngle=0;h.leftContactAngle=Math.PI;
    right.y=h.y;left.y=h.y;
  }else if(index===5||index===7){
    const amount=index===5?s:1-s;
    setHand(left,mix(-.58,-.22,amount),mix(1.35,1.78,amount),mix(.34,.32,amount));
    right.y-=.12*Math.sin(Math.PI*amount)**2;
    fromHand(h,left,Math.PI+Math.PI/2*amount,'left');
  }else{
    setHand(left,-.22-a*bump*bump,1.78+.025*Math.sin(2*TAU*s),.32+.025*bump*bump);
    right.y-=.10*bump*bump;
    plane(h,p.tilt*.1*wave,p.tilt*.2*wave);
    fromHand(h,left,Math.PI*1.5+.32*wave*d,'left');
  }
}

// Round compatible hand-owned corners by carrying their geometric grip angle.
// Proven hand/plane curves remain intact, and the ring center follows the exact
// grip. Integrating a nonnegative speed profile prevents a cubic from moving
// the original stop to a new place. Opposed directions use an explicit turn.
// No runtime neighbor sampling, allocation or stateful blending is needed.
const BRIDGE_KINDS=new Set(['entrance','hand-orbit','transfer','answer-orbit','overhead-rise','overhead-orbit','overhead-return','return-transfer','motif-return','resolution','thread-down','thread-up','roll-enter','roll-return','chest-enter','chest-return','chest-handoff','chest-lift']);
function bridgeState(score,index,u,side){
  const out=createHoopSample();single(score,index,u,out);
  const h=out.hoops[0],a=out.hands.left,b=out.hands.right;
  return [a.x,a.y,a.z,b.x,b.y,b.z,h.qx,h.qy,h.qz,h.qw,h.contact==='both'&&side==='left'?h.leftContactAngle:h.contactAngle];
}
function compileBridges(score){
  const result=[],segments=score.segments,e=1e-5;
  for(let i=1;i<segments.length;i++){
    const before=segments[i-1],after=segments[i];
    if(!BRIDGE_KINDS.has(before.kind)||!BRIDGE_KINDS.has(after.kind))continue;
    const previous=createHoopSample(),next=createHoopSample();single(score,i-1,1,previous);single(score,i,0,next);
    const aContact=previous.hoops[0].contact,bContact=next.hoops[0].contact;
    const sharedLeft=(aContact==='left'||aContact==='both')&&(bContact==='left'||bContact==='both');
    const sharedRight=(aContact==='right'||aContact==='both')&&(bContact==='right'||bContact==='both');
    if(!sharedLeft&&!sharedRight)continue;
    const side=sharedLeft?'left':'right';
    const aU=.65,bU=.35,start=before.start+aU*before.duration,end=after.start+bU*after.duration;
    const a=bridgeState(score,i-1,aU,side)[10],b=bridgeState(score,i,bU,side)[10];
    const da=(bridgeState(score,i-1,aU+e,side)[10]-bridgeState(score,i-1,aU-e,side)[10])/(2*e*before.duration);
    const db=(bridgeState(score,i,bU+e,side)[10]-bridgeState(score,i,bU-e,side)[10])/(2*e*after.duration);
    const edgeA=bridgeState(score,i-1,1,side)[10],edgeB=bridgeState(score,i,0,side)[10];
    const delta=b+TAU*Math.round((edgeA-edgeB)/TAU)-a,m=da*(end-start),n=db*(end-start);
    const sign=Math.sign(delta),monotone=sign!==0&&m*sign>=-1e-10&&n*sign>=-1e-10;
    const exponent=monotone?Math.max(2,Math.ceil((m+n)/delta)):2;
    const bump=30*(delta-(m+n)/(exponent+1));
    result.push({start,end,boundary:after.start,side,monotone,exponent,bump,angle:[a,m,3*delta-2*m-n,-2*delta+m+n],endSlope:n});
  }
  return result;
}
function sampleBridge(bridge,time,out){
  const u=(time-bridge.start)/(bridge.end-bridge.start),c=bridge.angle;
  const h=out.hoops[0],hand=out.hands[bridge.side];
  const degree=bridge.exponent+1;
  const angle=bridge.monotone?c[0]+c[1]*(1-(1-u)**degree)/degree+bridge.endSlope*u**degree/degree+bridge.bump*(u**3/3-u**4/2+u**5/5):c[0]+u*(c[1]+u*(c[2]+u*c[3]));
  fromHand(h,hand,angle,bridge.side);
  // The rounded angular path can reach the low arc before the original hand
  // curve. Carry its gripping hand forward/up through that same safe corridor.
  const low=smooth(Math.max(0,Math.min(1,(.72-(h.y-HOOP_RADIUS))/.22)));
  const gap=.34+.085*low-hand.z;
  if(low>0&&gap>0){const clearance=gap*gap/(gap+.005);hand.z+=clearance;hand.y+=.5*clearance;fromHand(h,hand,angle,bridge.side);}
}

// Two-hoop vocabulary has a separate occupancy proof. Each hoop remains wholly
// outside its same-side hand (center X magnitude >= 1.13), so their bounding
// spheres are separated by at least 1.10 even during opposed butterfly planes.
// It never borrows a hand that is already supporting the other hoop.
function twins(score,index,u,out){
  const s=smooth(u),p=score.parameters,w=Math.sin(TAU*s);
  const isolation=index===2,high=index>=5&&index<=7;
  let lift=0;
  if(index===5)lift=s;else if(index===6)lift=1;else if(index===7)lift=1-s;
  const a=isolation?0:p.amplitude,phase=index===4||index===9?-1:1;
  for(let i=0;i<2;i++){
    const side=i===0?1:-1,hand=i===0?out.hands.right:out.hands.left,h=out.hoops[i];
    const wave=high?0:w*phase*(i===0?1:-1);
    setHand(hand,side*(mix(.68,.55,lift)+a*wave),mix(1.35,1.72,lift)+a*Math.sin(2*TAU*s)*(high?0:1),mix(.25,.20,lift));
    plane(h,isolation?0:side*p.tilt*3*w,0);
    fromHand(h,hand,i===0?Math.PI:0,i===0?'right':'left');
  }
}

function sampleBody(score,segment,u,out,planningFeet=false){
  const s=smooth(u),b=Math.sin(Math.PI*s)**2,w=Math.sin(TAU*s),g=score.parameters.bodyGain;
  const a=segment.bodyFrom,z=segment.bodyTo,kind=segment.kind;
  out.travelX=mix(a.travelX,z.travelX,s);out.travelZ=mix(a.travelZ,z.travelZ,s);
  out.turn=mix(a.turn,z.turn,s);out.leanX=mix(a.leanX,z.leanX,s);out.leanZ=mix(a.leanZ,z.leanZ,s);
  out.headYaw=mix(a.headYaw,z.headYaw,s);out.headTilt=mix(a.headTilt,z.headTilt,s);
  // Shift the hips forward as the chest leans back, while the planned stance
  // stays at its original anchors. This is body weight transfer, not a new
  // footstep chasing the root. The entrance/return weights have zero endpoint
  // derivatives and vanish before either neighboring non-chest phrase.
  if(!planningFeet&&kind.startsWith('chest-')){
    const weight=mix(a.leanX===CHEST_ROLL_LEAN_X?1:0,z.leanX===CHEST_ROLL_LEAN_X?1:0,s);
    out.travelX-=.28*weight*Math.sin(out.turn);out.travelZ-=.28*weight*Math.cos(out.turn);
  }
  out.bob=0;out.stride=0;out.compression=0;out.waistPhase=0;out.waistDrive=0;
  // Body motion is independent of the inertial ring/hand trajectories. The
  // caller countertransforms those targets after the complete body/foot pose.
  if(kind==='isolation'){
    out.travelX=.035*b*g;out.travelZ=.035*b*g;out.turn=-.08*w*g;
    out.leanZ=-.025*b*g;out.leanX=.01*w*g;out.compression=.012*b*g;
    out.headYaw=.045*w*g;out.headTilt=.02*b*g;return;
  }
  if(kind==='toss-prepare'){
    out.travelX=-.035*b*g;out.travelZ=.035*b*g;out.turn=.07*b*g;
    out.leanZ=.015*b*g;out.leanX=-.025*b*g;out.compression=.01*b*g;out.headTilt=-.03*b*g;return;
  }
  if(kind==='toss'){
    out.travelX=-.018*b*g;out.travelZ=.025*b*g;out.turn=.035*w*g;
    out.leanX=.012*w*g;out.leanZ=.015*b*g;out.headTilt=-.045*b*g;return;
  }
  if(kind==='toss-recover'){
    out.travelX=-.04*b*g;out.travelZ=.03*b*g;out.turn=.08*b*g;
    out.leanX=.02*b*g;out.leanZ=.02*b*g;out.compression=.012*b*g;out.headTilt=.025*b*g;return;
  }
  if(kind==='hand-orbit'||kind==='motif-return'){
    const answer=kind==='motif-return'?.8:1;
    out.travelX+=.10*b*g*answer;out.travelZ-=.34*b*g*answer;
    out.turn-=.58*b*g*answer;out.leanZ-=.065*b*g;out.leanX-=.025*b*g;
    out.stride=.42*w*g*answer;out.headYaw-=.10*b*g;
  }else if(kind==='answer-orbit'){
    out.travelX-=.12*b*g;out.travelZ-=.38*b*g;
    out.turn+=.62*b*g;out.leanZ+=.05*b*g;out.leanX-=.025*b*g;
    out.stride=-.44*w*g;out.headYaw+=.10*b*g;
  }else if(kind==='body-orbit'){
    const weight=Math.sin(TAU*s*score.parameters.direction),angle=TAU*s*score.parameters.direction*(score.parameters.variation===1?2:1);
    out.travelX+=.035*weight*g;out.travelZ-=.20*b*g;out.turn+=.50*weight*g;
    out.waistPhase=angle;out.waistDrive=-.055*Math.sin(angle)*g;
    // The push axis is performer-forward (-Z), carried through the authored
    // turn. Its phase comes from the same contact cycle as the waist hoop.
    out.travelX+=Math.sin(out.turn)*out.waistDrive;out.travelZ+=Math.cos(out.turn)*out.waistDrive;
    out.leanX-=.045*Math.sin(angle)*g;out.leanZ-=.045*weight*g;out.compression=.012*Math.sin(angle)**2*g;
    out.stride=.40*weight*g;out.headYaw+=.08*weight*g;
  }else if(kind==='overhead-orbit'){
    out.travelX-=.05*b*g;out.travelZ-=.16*b*g;
    out.turn+=.42*b*g;out.leanX+=.025*b*g;out.stride=.28*w*g;
    out.headTilt-=.02*b*g;
  }else if(kind==='overhead-rise'||kind==='overhead-return'){
    out.travelZ+=.12*b*g;out.turn+=.12*b*g;out.stride=-.24*w*g;
  }else if(kind==='transfer'||kind==='return-transfer'){
    out.stride=.20*w*g;
  }else if(kind==='forearm-roll'){
    out.leanZ+=.02*b*g;out.turn+=.10*b*g;out.headTilt+=.025*b*g;
  }else if(kind==='entrance'||kind==='resolution'){
    out.stride=.18*Math.sin(Math.PI*s)*g*(kind==='entrance'?1:-1);
  }
}

export function sampleHoopScore(score,time,out){
  if(!Number.isFinite(time))throw new RangeError('Invalid hoop sample time');
  const t=Math.max(0,Math.min(score.duration,time));let index=0;
  while(index+1<score.segments.length&&t>=score.segments[index+1].start)index++;
  const segment=score.segments[index],u=Math.max(0,Math.min(1,(t-segment.start)/segment.duration));
  out.style='flow';out.time=t;out.segment=index;out.motif=segment.motif;out.kind=segment.kind;
  out.generation=score.generation;out.version=score.version;out.hoopCount=score.hoops;
  let fraction=u;
  if(segment.kind==='roll-enter'||segment.kind==='chest-enter')fraction=2*(u-2.5*u**4+3*u**5-u**6);
  else if(segment.kind==='roll-return'||segment.kind==='chest-return')fraction=2*(2.5*u**4-3*u**5+u**6);
  const spin=mix(segment.spinStart,segment.spinEnd,fraction);
  resetHoop(out.hoops[0],spin);resetHoop(out.hoops[1],-spin);
  if(score.hoops===2)twins(score,index,u,out);else {
    single(score,index,u,out);
    for(const bridge of score.bridges)if(t>=bridge.start&&t<=bridge.end){sampleBridge(bridge,t,out);break;}
  }
  solveHand(out.hands.right,false,out.arms);solveHand(out.hands.left,true,out.arms);
  // Reflection S=diag(1,1,-1) is applied to every geometric field, including
  // support markers. R_x(-x) mirrors the rendered arm exactly; conjugating
  // the hoop orientation by S negates quaternion X/Y while preserving Z/W.
  // A person/prop heading rotation would also move the face and is incorrect.
  out.hands.right.z=-out.hands.right.z||0;out.hands.left.z=-out.hands.left.z||0;
  out.arms.x=-out.arms.x||0;out.arms.leftX=-out.arms.leftX||0;
  for(let i=0;i<2;i++){
    const h=out.hoops[i];h.z=-h.z||0;h.qx=-h.qx||0;h.qy=-h.qy||0;h.supportZ=-h.supportZ||0;
  }
  // Body descriptors are authored directly in Crowd's final -Z-facing frame.
  sampleBody(score,segment,u,out);
  sampleDance(segment,u,out);
  out.inertialContacts=segment.kind==='isolation'||segment.kind.startsWith('toss');
  if(out.inertialContacts){
    out.hands.left.y+=HOOP_REST_ROOT_Y;out.hands.right.y+=HOOP_REST_ROOT_Y;
    inversePoint(out.hands.left,out);inversePoint(out.hands.right,out);
    for(let i=0;i<out.hoopCount;i++){const h=out.hoops[i];h.y+=HOOP_REST_ROOT_Y;inversePoint(h,out);inverseOrientation(h,out);}
    solveHand(out.hands.right,false,out.arms);solveHand(out.hands.left,true,out.arms);
  }
  return out;
}

// Apply once to a fresh sample. All deltas are unscaled session-frame Y;
// callers discard the sample and end/decline the performance on false.
export function applyHoopGround(out,rootDelta=0,leftDelta=0,rightDelta=0){
  if(!Number.isFinite(rootDelta)||!Number.isFinite(leftDelta)||!Number.isFinite(rightDelta))return false;
  verticalOffset(out.feet.left,leftDelta,out);verticalOffset(out.feet.right,rightDelta,out);
  if(out.inertialContacts){
    verticalOffset(out.hands.left,-rootDelta,out);verticalOffset(out.hands.right,-rootDelta,out);
    for(let i=0;i<out.hoopCount;i++)verticalOffset(out.hoops[i],-rootDelta,out);
    for(let i=0;i<2;i++){
      const h=i===0?out.hands.left:out.hands.right,reach=Math.hypot(h.x-(i===0?-.30:.30),h.y-SHOULDER_Y,h.z);
      if(!Number.isFinite(reach)||reach>=.58-1e-6||reach<.01)return false;
    }
    solveHand(out.hands.right,false,out.arms);solveHand(out.hands.left,true,out.arms);
    for(let i=0;i<out.hoopCount;i++){
      const h=out.hoops[i];
      if(ringDistance(h,0,1.65,0)<.295-1e-10)return false;
      // Half the .025 spacing bounds the unsampled capsule centerline gap.
      for(let j=0;j<=22;j++)if(ringDistance(h,0,.725+j*.025,0)<.3075)return false;
    }
    if(!safeArm(out,false)||!safeArm(out,true))return false;
  }
  return feetReachable(out);
}
function ringDistance(h,x,y,z){
  x-=h.x;y-=h.y;z-=h.z;
  const nx=2*(h.qx*h.qz+h.qw*h.qy),ny=2*(h.qy*h.qz-h.qw*h.qx),nz=1-2*(h.qx*h.qx+h.qy*h.qy);
  const plane=x*nx+y*ny+z*nz;
  return Math.hypot(plane,Math.sqrt(Math.max(0,x*x+y*y+z*z-plane*plane))-h.radius);
}
function headSegmentDistance(ax,ay,az,bx,by,bz){
  const x=bx-ax,y=by-ay,z=bz-az;
  const t=Math.max(0,Math.min(1,(-ax*x+(1.65-ay)*y-az*z)/(x*x+y*y+z*z)));
  return Math.hypot(ax+t*x,ay+t*y-1.65,az+t*z);
}
function safeArm(out,left){
  const a=out.arms,h=out.hands[left?'left':'right'],sx=left?-.30:.30,z=left?a.leftZ:a.z,x=left?a.leftX:a.x;
  const ex=sx+.29*Math.sin(z),ey=1.35-.29*Math.cos(z)*Math.cos(x),ez=-.29*Math.cos(z)*Math.sin(x);
  if(headSegmentDistance(ex,ey,ez,h.x,h.y,h.z)<.335||headSegmentDistance(sx,1.35,0,ex,ey,ez)<.335)return false;
  return Math.hypot(ex,ey-Math.max(.725,Math.min(1.275,ey)),ez)>=.335;
}
