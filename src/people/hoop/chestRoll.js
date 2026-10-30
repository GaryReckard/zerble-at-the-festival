// Contact construction uses the score's +Z-front authoring frame. The score's
// single final reflection converts it to Crowd's -Z-front rendered frame.
const R=.58,TUBE=.035,ARM=.075,BODY=.26,SHOULDER_Y=1.35,CHEST_Y=1.275,HAND=.88;
const VY=.32,VZ=Math.sqrt(1-VY*VY),A=R+ARM+TUBE;
const BODY_V=(CHEST_Y-SHOULDER_Y)*VY;
const BODY_N=(CHEST_Y-SHOULDER_Y)*-VZ;
const B=R+Math.sqrt((BODY+TUBE)**2-BODY_N**2);
const CROSS=Math.sqrt(B*B-(A-BODY_V)**2),ARM_LENGTH=HAND-CROSS;
const THETA_LEFT=Math.acos(-CROSS/B),THETA_RIGHT=Math.acos(CROSS/B),ARC=B*(THETA_LEFT-THETA_RIGHT);
const LENGTH=2*ARM_LENGTH+ARC,WINDOW=.0015;
const MIRROR=Object.freeze({'left-palm':'right-palm','left-forearm':'right-forearm','left-upperarm':'right-upperarm',chest:'chest','right-palm':'left-palm','right-forearm':'left-forearm','right-upperarm':'left-upperarm'});
export const CHEST_ROLL_LENGTH=LENGTH;
export const CHEST_ROLL_SPIN_DELTA=-LENGTH/R;
export const CHEST_ROLL_LEAN_X=.38;
export const CHEST_ROLL_FRAME=Object.freeze({vy:VY,vz:VZ,qx:Math.sin(Math.acos(VY)/2),qy:0,qz:0,qw:Math.cos(Math.acos(VY)/2),crossX:CROSS,firstSwitch:ARM_LENGTH/LENGTH,secondSwitch:(ARM_LENGTH+ARC)/LENGTH,window:WINDOW});
export const CHEST_ROLL_ENTRY=Object.freeze({handX:-HAND,handY:SHOULDER_Y,handZ:0,x:-HAND,y:SHOULDER_Y+A*VY,z:A*VZ,...CHEST_ROLL_FRAME});
export const CHEST_ROLL_EXIT=Object.freeze({handX:HAND,handY:SHOULDER_Y,handZ:0,x:HAND,y:SHOULDER_Y+A*VY,z:A*VZ,...CHEST_ROLL_FRAME});

// The offset shoulder/torso union has two real corners, where the hoop has
// simultaneous arm and chest contacts. A narrow monotone warp lets rolling
// speed reach zero only at that instant, making position/spin C1 without a
// floating smooth-max rail or a perceptible hold at either shoulder.
function rollProgress(u){
  if(u<WINDOW){const x=u/WINDOW;return WINDOW*(2*x*x-x*x*x);}
  if(u>1-WINDOW){const x=(1-u)/WINDOW;return 1-WINDOW*(2*x*x-x*x*x);}
  for(let i=0;i<2;i++){
    const at=i===0?ARM_LENGTH/LENGTH:(ARM_LENGTH+ARC)/LENGTH;
    if(Math.abs(u-at)<WINDOW){const x=(u-at)/WINDOW;return at+WINDOW*(2*x*x*x-x*x*x*x*x);}
  }
  return u;
}
function hands(out){
  out.hands.left.x=-HAND;out.hands.left.y=SHOULDER_Y;out.hands.left.z=0;
  out.hands.right.x=HAND;out.hands.right.y=SHOULDER_Y;out.hands.right.z=0;
  const a=out.arms;a.x=a.leftX=a.elbow=a.leftElbow=0;a.z=Math.PI/2;a.leftZ=-Math.PI/2;
}
export function sampleChestRoll(progress,out,spinStart=0,direction=1){
  if(!Number.isFinite(progress)||progress<0||progress>1||!Number.isFinite(spinStart)||(direction!==1&&direction!==-1))throw new RangeError('Invalid chest roll sample.');
  const p=rollProgress(progress),distance=p*LENGTH,reverse=direction===-1;
  let x,v,angle=-Math.PI/2,contact,radius,t=0;
  if(distance<ARM_LENGTH){x=-HAND+distance;v=A;radius=ARM+TUBE;contact=x<-.59?'left-forearm':'left-upperarm';t=x<-.59?(x+HAND)/.29:(x+.59)/.29;if(progress===0)contact='left-palm';}
  else if(distance>ARM_LENGTH+ARC){x=CROSS+distance-ARM_LENGTH-ARC;v=A;radius=ARM+TUBE;contact=x>.59?'right-forearm':'right-upperarm';t=x>.59?(HAND-x)/.29:(.59-x)/.29;if(progress===1)contact='right-palm';}
  else{
    const theta=THETA_LEFT-(distance-ARM_LENGTH)/B;
    x=B*Math.cos(theta);v=BODY_V+B*Math.sin(theta);angle=theta-Math.PI;radius=BODY+TUBE;contact='chest';t=(distance-ARM_LENGTH)/ARC;
  }
  const h=out.hoops[0],f=CHEST_ROLL_FRAME;
  h.x=reverse?-x:x;h.y=SHOULDER_Y+v*VY;h.z=v*VZ;
  h.qx=f.qx;h.qy=0;h.qz=0;h.qw=f.qw;h.radius=R;
  h.contactAngle=reverse?Math.PI-angle:angle;h.leftContactAngle=h.contactAngle;
  h.supportX=h.x+R*Math.cos(h.contactAngle);h.supportY=h.y+R*Math.sin(h.contactAngle)*VY;h.supportZ=h.z+R*Math.sin(h.contactAngle)*VZ;
  h.supportRadius=radius;h.supportT=t;
  h.contact=reverse?MIRROR[contact]:contact;
  h.spin=spinStart+(reverse?1:-1)*distance/R;
  out.hoopCount=1;out.kind='chest-roll';out.leanX=CHEST_ROLL_LEAN_X;out.leanZ=0;out.headYaw=reverse?.30:-.30;out.headTilt=0;
  hands(out);return out;
}
