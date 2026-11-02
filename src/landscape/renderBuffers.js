// Pure non-indexed triangle attributes. Workers prepare these before Three.js
// allocation so streamed roads do not compute thousands of normals on-frame.
export function triangleAttributes(positions,{uv=false}={}){
  const normals=new Float32Array(positions.length),uvs=uv?new Float32Array(positions.length/3*2):null;
  for(let i=0;i<positions.length;i+=9){
    const ax=positions[i+6]-positions[i+3],ay=positions[i+7]-positions[i+4],az=positions[i+8]-positions[i+5],bx=positions[i]-positions[i+3],by=positions[i+1]-positions[i+4],bz=positions[i+2]-positions[i+5];
    const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,length=Math.hypot(x,y,z)||1;
    for(let j=0;j<9;j+=3){normals[i+j]=x/length;normals[i+j+1]=y/length;normals[i+j+2]=z/length;}
  }
  if(uvs)for(let i=0,j=0;i<positions.length;i+=3){uvs[j++]=positions[i]/4;uvs[j++]=positions[i+2]/4;}
  return {normals,uvs};
}
export function finiteRenderBuffer(array){
  if(!(array instanceof Float32Array)||array.byteLength>512000)return false;
  for(let i=0;i<array.length;i++)if(!Number.isFinite(array[i]))return false;
  return true;
}
export function validLandscapeRenderBuffers(data){
  if(!data)return false;
  const {roadPositions:r,waterPositions:w,roadNormals:rn,waterNormals:wn,roadUvs:uv}=data;
  if(!finiteRenderBuffer(r)||!finiteRenderBuffer(w)||!finiteRenderBuffer(rn)||!finiteRenderBuffer(wn)||!finiteRenderBuffer(uv))return false;
  return r.length%9===0&&w.length%9===0&&rn.length===r.length&&wn.length===w.length&&uv.length===r.length/3*2&&r.byteLength+w.byteLength+rn.byteLength+wn.byteLength+uv.byteLength<=512000;
}
