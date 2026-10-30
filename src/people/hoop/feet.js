// Exact support height of Crowd's two .16 × .07 × .24 shoes after the
// existing hip-stride shader and body lean. A box support function avoids
// allocating/testing sixteen corners on every pose publication.
export function hoopFootLift(stride,leanX,leanZ){
  const cx=Math.cos(leanX),sx=Math.sin(leanX),cz=Math.cos(leanZ),sz=Math.sin(leanZ);
  let minimum=Infinity;
  for(let side=-1;side<=1;side+=2){
    const angle=side*stride,c=Math.cos(angle),s=Math.sin(angle);
    const y=.65+c*(-.615)-s*(-.06),z=s*(-.615)+c*(-.06);
    const a=cx*sz,b=cx*cz*c-sx*s,d=-cx*cz*s-sx*c;
    const bottom=cx*(sz*side*.12+cz*y)-sx*z-Math.abs(a)*.08-Math.abs(b)*.035-Math.abs(d)*.12;
    minimum=Math.min(minimum,bottom);
  }
  return -minimum;
}
