// Render-only road footprints. Layout routes and RNG streams remain untouched.
// Cutting the dirt out of paved footprints removes coplanar competing fragments,
// rather than relying on camera-dependent depth bias to choose a surface.
const EPS = 1e-8;
export function polygonArea(poly) {
  let area=0;
  for(let i=1;i<poly.length-1;i++)area+=(poly[i].x-poly[0].x)*(poly[i+1].z-poly[0].z)-(poly[i].z-poly[0].z)*(poly[i+1].x-poly[0].x);
  return area/2;
}
export function footprintBounds(poly) {
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  for(const p of poly){minX=Math.min(minX,p.x);minZ=Math.min(minZ,p.z);maxX=Math.max(maxX,p.x);maxZ=Math.max(maxZ,p.z);}
  return {minX,minZ,maxX,maxZ};
}
function overlaps(a,b) {
  return a.maxX>b.minX+EPS&&a.minX<b.maxX-EPS&&a.maxZ>b.minZ+EPS&&a.minZ<b.maxZ-EPS;
}
function halfPlane(poly,a,b,sign) {
  if(!poly.length)return [];
  const out=[],distance=p=>sign*((b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x));
  let previous=poly[poly.length-1],pd=distance(previous);
  for(const current of poly){
    const cd=distance(current),inside=cd>=0,wasInside=pd>=0;
    if(inside!==wasInside){const t=pd/(pd-cd);out.push({x:previous.x+(current.x-previous.x)*t,z:previous.z+(current.z-previous.z)*t});}
    if(inside)out.push(current);
    previous=current;pd=cd;
  }
  return out;
}
export function clipFootprint(poly,bounds) {
  const corners=[{x:bounds.minX,z:bounds.minZ},{x:bounds.maxX,z:bounds.minZ},{x:bounds.maxX,z:bounds.maxZ},{x:bounds.minX,z:bounds.maxZ}];
  for(let i=0;i<4;i++)poly=halfPlane(poly,corners[i],corners[(i+1)%4],1);
  return poly;
}
function subtract(poly,cutter) {
  const sign=polygonArea(cutter)>=0?1:-1,out=[];
  for(let i=0;i<cutter.length&&poly.length>=3;i++){
    const a=cutter[i],b=cutter[(i+1)%cutter.length];
    const outside=halfPlane(poly,a,b,-sign);
    if(outside.length>=3&&Math.abs(polygonArea(outside))>EPS)out.push(outside);
    poly=halfPlane(poly,a,b,sign);
  }
  return out;
}
export function trimRoadTriangles(triangles,cutters=[],bounds=null) {
  const result=[];
  for(const triangle of triangles){
    const clipped=bounds?clipFootprint(triangle,bounds):triangle;
    if(clipped.length<3||Math.abs(polygonArea(clipped))<=EPS)continue;
    let pieces=[clipped];const box=footprintBounds(clipped);
    for(const cutter of cutters){
      if(!overlaps(box,cutter.bounds))continue;
      pieces=pieces.flatMap(poly=>overlaps(footprintBounds(poly),cutter.bounds)?subtract(poly,cutter.points):[poly]);
      if(!pieces.length)break;
    }
    for(const poly of pieces)for(let i=1;i<poly.length-1;i++){
      const tri=[poly[0],poly[i],poly[i+1]];
      if(Math.abs(polygonArea(tri))>EPS)result.push(tri);
    }
  }
  return result;
}
export function ribbonTriangles(points,width,step=Infinity) {
  if(points.length<2)return [];
  if(Number.isFinite(step)){
    const fine=[points[0]];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/step));
      for(let j=1;j<=n;j++)fine.push({x:a.x+(b.x-a.x)*j/n,z:a.z+(b.z-a.z)*j/n});
    }
    points=fine;
  }
  const edges=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[i-1],b=points[i+1];let tx,tz;
    if(a&&b){const la=Math.hypot(p.x-a.x,p.z-a.z)||1,lb=Math.hypot(b.x-p.x,b.z-p.z)||1;tx=(p.x-a.x)/la+(b.x-p.x)/lb;tz=(p.z-a.z)/la+(b.z-p.z)/lb;}
    else {const u=a??p,v=b??p;tx=v.x-u.x;tz=v.z-u.z;}
    const len=Math.hypot(tx,tz)||1,dx=-tz/len*width/2,dz=tx/len*width/2;
    edges.push([{x:p.x+dx,z:p.z+dz},{x:p.x-dx,z:p.z-dz}]);
  }
  const triangles=[];
  for(let i=1;i<edges.length;i++){const a=edges[i-1],b=edges[i];triangles.push([a[0],b[0],a[1]],[a[1],b[0],b[1]]);}
  return triangles;
}
export function pavedCutters(roads,bounds=null,step=Infinity,widthScale=1) {
  const cutters=[];
  for(const road of roads){
    if(road.surface!=='asphalt')continue;
    const width=(road.width??9)*widthScale,box=footprintBounds(road.points);
    if(bounds&&!overlaps({minX:box.minX-width/2,minZ:box.minZ-width/2,maxX:box.maxX+width/2,maxZ:box.maxZ+width/2},bounds))continue;
    for(const points of ribbonTriangles(road.points,width,step)){
      const b=footprintBounds(points);if(!bounds||overlaps(b,bounds))cutters.push({points,bounds:b});
    }
  }
  return cutters;
}
