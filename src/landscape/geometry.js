// Shared exact triangles for render, support and bounded local plan admission.
const finite=(v,name)=>{if(!Number.isFinite(v))throw new TypeError(`${name} must be finite`);return v;};
export function createTriangleSampler(vertexHeight,{stepX=10,stepZ=10,bounds=null,maxGrade=.45,surfaceClass=()=> 'grass',cacheLimit=8192}={}) {
  if(typeof vertexHeight!=='function')throw new TypeError('A vertex height function is required');
  for(const n of [stepX,stepZ])if(finite(n,'grid step')<=0)throw new RangeError('Grid steps must be positive');
  if(finite(maxGrade,'grade limit')<0 || !Number.isInteger(cacheLimit) || cacheLimit<0 || cacheLimit>65536)throw new RangeError('Invalid terrain work limits');
  if(bounds && (![bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ].every(Number.isFinite)||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ))throw new RangeError('Invalid terrain bounds');
  const cache=new Map();
  function vertex(x,z) {
    if(!cacheLimit)return finite(vertexHeight(x,z),'vertex height');
    const key=`${x},${z}`;
    if(cache.has(key))return cache.get(key);
    const height=finite(vertexHeight(x,z),'vertex height');
    if(cache.size>=cacheLimit)cache.delete(cache.keys().next().value);
    cache.set(key,height);return height;
  }
  function sample(x,z,out={}) {
    finite(x,'x');finite(z,'z');
    const ix=Math.floor(x/stepX)*stepX,iz=Math.floor(z/stepZ)*stepZ,u=(x-ix)/stepX,v=(z-iz)/stepZ;
    const a=vertex(ix,iz),b=vertex(ix+stepX,iz),c=vertex(ix,iz+stepZ),d=vertex(ix+stepX,iz+stepZ);
    if(u+v<=1){out.dx=(b-a)/stepX;out.dz=(c-a)/stepZ;out.height=a+u*(b-a)+v*(c-a);}
    else {out.dx=(d-c)/stepX;out.dz=(d-b)/stepZ;out.height=d+(1-v)*(b-d)+(1-u)*(c-d);}
    const length=Math.hypot(out.dx,1,out.dz);
    out.nx=-out.dx/length;out.ny=1/length;out.nz=-out.dz/length;out.grade=Math.hypot(out.dx,out.dz);
    const inside=!bounds || x>=bounds.minX&&x<=bounds.maxX&&z>=bounds.minZ&&z<=bounds.maxZ;
    out.blockedReason=!inside?'bounds':out.grade>maxGrade?'grade':null;out.traversable=!out.blockedReason;
    out.surfaceClass=surfaceClass(x,z);return out;
  }
  return Object.freeze({sample,vertex,stepX,stepZ,clearCache:()=>cache.clear(),get cachedVertices(){return cache.size;}});
}

export function buildHeightGrid(vertexHeight,{minX,maxX,minZ,maxZ,stepX=10,stepZ=10}) {
  for(const n of [minX,maxX,minZ,maxZ,stepX,stepZ])finite(n,'grid bound/step');
  if(stepX<=0||stepZ<=0||maxX<=minX||maxZ<=minZ||[minX/stepX,maxX/stepX,minZ/stepZ,maxZ/stepZ].some(n=>!Number.isInteger(n)))throw new RangeError('Grid bounds must align with positive grid steps');
  const columns=(maxX-minX)/stepX,rows=(maxZ-minZ)/stepZ,width=columns+1,count=width*(rows+1);
  if(count>65535)throw new RangeError('Bounded grid vertex limit');
  const positions=new Float32Array(count*3),indices=new Uint16Array(columns*rows*6);
  let p=0,t=0;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const x=minX+col*stepX,z=minZ+row*stepZ;positions[p++]=x;positions[p++]=finite(vertexHeight(x,z),'vertex height');positions[p++]=z;
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=row*width+col,b=a+1,c=a+width,d=c+1;
    for(const index of [a,c,b,b,c,d])indices[t++]=index;
  }
  return {positions,indices};
}

export function segmentIntersectsBounds(a,b,bounds,padding=0) {
  let enter=0,exit=1;
  for(const axis of ['X','Z']) {
    const key=axis.toLowerCase(),start=a[key],delta=b[key]-start,min=bounds[`min${axis}`]-padding,max=bounds[`max${axis}`]+padding;
    if(Math.abs(delta)<1e-12){if(start<min||start>max)return false;continue;}
    let lo=(min-start)/delta,hi=(max-start)/delta;
    if(lo>hi)[lo,hi]=[hi,lo];enter=Math.max(enter,lo);exit=Math.min(exit,hi);
    if(enter>exit)return false;
  }
  return true;
}
