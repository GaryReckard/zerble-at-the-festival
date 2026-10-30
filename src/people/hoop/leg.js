// Foot descriptors locate the sole origin. The ankle sits at the shoe top,
// leaving the existing lower-leg cylinder overlapped with the shoe's cuff.
export const HOOP_LEG_LENGTH=.325;
export const HOOP_ANKLE_HEIGHT=.07;
export const HOOP_HIP_HEIGHT=.65;

export function sampleHoopAnkle(foot,out){
  const h=HOOP_ANKLE_HEIGHT,x=foot.qx,y=foot.qy,z=foot.qz,w=foot.qw;
  out.x=foot.x+2*(x*y-w*z)*h;
  out.y=foot.y+(1-2*(x*x+z*z))*h;
  out.z=foot.z+2*(y*z+w*x)*h;return out;
}

const ankle={x:0,y:0,z:0};
const SIDES=Object.freeze(['left','right']);
const FIELDS=Object.freeze(['x','y','z','qx','qy','qz','qw']);
export function validateHoopFeet(feet){
  if(!feet)return false;
  for(let i=0;i<2;i++){
    const side=SIDES[i],foot=feet[side];
    if(!foot)throw new TypeError('Flow feet require both sole targets.');
    for(let field=0;field<FIELDS.length;field++)if(!Number.isFinite(foot[FIELDS[field]]))throw new TypeError('Flow feet require finite sole targets and quaternions.');
    const norm=Math.hypot(foot.qx,foot.qy,foot.qz,foot.qw);
    if(Math.abs(norm-1)>2e-5)throw new RangeError('Flow foot quaternions must be normalized.');
    sampleHoopAnkle(foot,ankle);
    const reach=Math.hypot(ankle.x-(side==='left'?-.12:.12),ankle.y-HOOP_HIP_HEIGHT,ankle.z);
    if(Math.hypot(ankle.x-(side==='left'?-.12:.12),ankle.y-HOOP_HIP_HEIGHT)<1e-6||reach>.650002||reach<.001)throw new RangeError('Flow ankle is outside the fixed-length leg workspace.');
  }
  return true;
}

// CPU inspection reference for the same two-bone construction as the shader.
// Tests also reconstruct the triangle independently from the actual foot data.
export function sampleHoopKnee(foot,side,out){
  sampleHoopAnkle(foot,ankle);
  const hx=side==='left'?-.12:.12,dx=ankle.x-hx,dy=ankle.y-HOOP_HIP_HEIGHT,dz=ankle.z;
  const distance=Math.hypot(dx,dy,dz);
  if(Math.hypot(dx,dy)<1e-6||distance>.650002||distance<.001)throw new RangeError('Flow ankle is outside the fixed-length leg workspace.');
  const ux=dx/distance,uy=dy/distance,uz=dz/distance;
  // Project local forward (-Z) onto the plane perpendicular to hip -> ankle.
  const bx=uz*ux,by=uz*uy,bz=-1+uz*uz,length=Math.hypot(bx,by,bz);
  const height=Math.sqrt(Math.max(0,HOOP_LEG_LENGTH**2-distance**2/4));
  out.x=hx+dx*.5+bx/length*height;out.y=HOOP_HIP_HEIGHT+dy*.5+by/length*height;out.z=dz*.5+bz/length*height;
  return out;
}
