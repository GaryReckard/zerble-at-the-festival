import * as THREE from 'three';

// Prop appearance is independent of either performer rig and activity owner.
export const HULA_HOOP_STYLES = [
  {name:'Hot pink',colors:[0xff44aa]},
  {name:'Lagoon',colors:[0x22eec6]},
  {name:'Sunshine',colors:[0xffd23f]},
  {name:'Candy stripes',colors:[0xff44aa,0xffffff,0x59e5ff]},
  {name:'Rainbow ribbon',colors:[0xff4569,0xff963f,0xffe44a,0x59e89c,0x55baff,0xbb77ff]},
  {name:'Electric spiral',colors:[0xaaff44,0x7733dd,0xffffff]},
  {name:'Sunset bands',colors:[0xff7744,0xff44aa,0x994dff]},
  {name:'Festival checks',colors:[0x55ddff,0xffffff,0xff5599,0xffdd44]},
];

export function buildHulaHoopGeometry(styleIndex=0){
  const style=HULA_HOOP_STYLES[styleIndex%HULA_HOOP_STYLES.length];
  const geometry=new THREE.TorusGeometry(.58,.035,6,24);
  // Match TorusGeometry's major/minor seam grid. Repeated seam colors avoid
  // a discontinuity, while minor-angle offsets give the ribbon a spiral wrap.
  const palette=style.colors.map(hex=>new THREE.Color(hex)),data=new Float32Array(7*25*3);
  for(let j=0;j<=6;j++)for(let i=0;i<=24;i++){
    const u=i%24,v=j%6;
    const band=styleIndex===5?Math.floor(u/3+v/3):styleIndex===7?Math.floor(u/3)+Math.floor(v/2):Math.floor(u/2);
    const color=palette[band%palette.length],offset=(j*25+i)*3;
    data[offset]=color.r;data[offset+1]=color.g;data[offset+2]=color.b;
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(data,3));
  geometry.userData.hoopStyle=style.name;return geometry;
}

export function buildHulaHoopMaterial(){
  const material=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,vertexColors:true,emissiveIntensity:.05,roughness:.5,metalness:.1});
  // Standard and Low's Lambert both expose this chunk. Keep the same pattern
  // in emissive light so the night glow cannot wash every stripe to white.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');};
  material.customProgramCacheKey=()=> 'hula-hoop-colors-v1';return material;
}

