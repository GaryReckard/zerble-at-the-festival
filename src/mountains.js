// Keep the entire mesh inside the 850 m star shell, so stars remain behind
// every ridgeline at night. Distant scenery is separate from reachable terrain. A single
// opaque, indexed mesh replaces the old 234 independently rounded hill shapes.
import * as THREE from 'three';
import {getSessionSeed, hash2, mulberry32} from './rng.js';
import {buildRidgeCanopy,CANOPY_TILE_METERS} from './ridgeCanopy.js';

export const RIDGE_SEGMENTS = 256;
export const RIDGE_ROWS = 6;
export const RIDGE_CAP_SEGMENTS = Object.freeze([1024,768]);
export const RIDGE_LAYERS = Object.freeze([
  Object.freeze({radius: 560, height: 29, relief: 19, color: 0x496746, night: 0x141f29}),
  Object.freeze({radius: 635, height: 52, relief: 25, color: 0x52746c, night: 0x192332}),
  Object.freeze({radius: 710, height: 80, relief: 31, color: 0x6c8a9a, night: 0x20283e}),
  Object.freeze({radius: 795, height: 111, relief: 37, color: 0x8b9eb5, night: 0x292d47}),
]);
export const RIDGE_VERTEX_COUNT = RIDGE_LAYERS.length*(RIDGE_SEGMENTS+1)*RIDGE_ROWS + RIDGE_CAP_SEGMENTS.reduce((n,s)=>n+2*(s+1),0);
export const RIDGE_TRIANGLE_COUNT = RIDGE_LAYERS.length*RIDGE_SEGMENTS*(RIDGE_ROWS-1)*2 + RIDGE_CAP_SEGMENTS.reduce((n,s)=>n+2*s,0);
const FOOT_Y = -220;
const TAU = Math.PI * 2;
const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };

// Full top-down has no horizon. Lower the silhouette into its fog-colored foot
// during the transition, then skip the draw rather than showing a circular wall.
export function ridgeViewVisibility(downward) {
  return 1 - smooth((downward - .48) / .30);
}

export function buildRidgeGeometry(seed = getSessionSeed()) {
  const rng = mulberry32(hash2(seed, 0x52494447));
  const count = RIDGE_VERTEX_COUNT;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const nights = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2), canopyData = new Float32Array(count * 2);
  const indices = new Uint16Array(RIDGE_TRIANGLE_COUNT*3);
  const base = new THREE.Color(), tint = new THREE.Color(), autumn = new THREE.Color(0x8a7944);
  let vertex = 0, index = 0;
  for (let layer = 0; layer < RIDGE_LAYERS.length; layer++) {
    const spec = RIDGE_LAYERS[layer], offset = vertex;
    const phases = Array.from({length: 6}, () => rng() * TAU);
    const day = new THREE.Color(spec.color), night = new THREE.Color(spec.night);
    const repeats = Math.round(TAU*spec.radius/CANOPY_TILE_METERS);
    const canopyDetail = [1,.35,.10,0][layer];
    for (let i = 0; i <= RIDGE_SEGMENTS; i++) {
      // Exact duplicated seam, including canopy colors and height.
      const a = (i === RIDGE_SEGMENTS ? 0 : i) / RIDGE_SEGMENTS * TAU;
      const broad = .48*Math.sin(3*a+phases[0]) + .30*Math.sin(5*a+phases[1])
        + .16*Math.sin(9*a+phases[2]) + .06*Math.sin(19*a+phases[3]);
      const canopy = layer === 0 ? .65*Math.sin(97*a+phases[4]) + .35*Math.sin(71*a+phases[5]) : 0;
      const crest = spec.height + spec.relief * broad + canopy;
      const radius = spec.radius + Math.sin(4*a+phases[4])*9;
      for (let j = 0; j < RIDGE_ROWS; j++) {
        const v = j / (RIDGE_ROWS-1);
        const r = radius - (1-v)*95;
        // Put almost all radial width ABOVE ground, so these read as sloping
        // wooded foothills instead of a near-vertical curtain. Only row zero
        // is a buried skirt, for elevated/downward viewpoints.
        const slope = j === 0 ? 0 : (j-1)/(RIDGE_ROWS-2);
        const spur = .10*(Math.sin(7*a+phases[1])+Math.sin(11*a+phases[2]));
        const y = j === 0 ? FOOT_Y : -8 + (crest+8) *
          (Math.sin(slope*Math.PI/2) + spur*Math.sin(slope*Math.PI));
        const k = vertex*3;
        positions[k] = Math.cos(a)*r; positions[k+1] = y; positions[k+2] = Math.sin(a)*r;
        // Continuous broad woodland patches, not per-face rainbow noise. The
        // nearest range keeps a little Lake Eden autumn color; haze quiets it.
        const patch = Math.sin(27*a+v*9+phases[4]) * Math.sin(13*a-v*7+phases[5]);
        const warmth = layer === 0 ? smooth((patch-.12)/.88)*.20 : 0;
        base.copy(day).lerp(autumn,warmth);
        const grain = hash2((i%RIDGE_SEGMENTS)+layer*4099,j+seed)/4294967295-.5;
        tint.copy(base).multiplyScalar(1 + patch * (.10-layer*.02) + grain * (.22-layer*.06));
        tint.toArray(colors,k); night.toArray(nights,k);
        uvs[vertex*2]=i/RIDGE_SEGMENTS*repeats;
        uvs[vertex*2+1]=Math.hypot(r-(radius-95),y+8)/CANOPY_TILE_METERS;
        canopyData[vertex*2]=canopyDetail;
        // Only the outer crest is clipped. Interior spurs can rise above it
        // without accidentally cutting holes in the hillside.
        canopyData[vertex*2+1]=layer<2?1000:(j===RIDGE_ROWS-1?0:Math.max(3,crest-y));
        vertex++;
      }
    }
    for (let i=0;i<RIDGE_SEGMENTS;i++) for (let j=0;j<RIDGE_ROWS-1;j++) {
      const a=offset+i*RIDGE_ROWS+j, b=a+RIDGE_ROWS;
      // Inward/upward facing slope, as viewed from the festival inside it.
      indices[index++]=a;indices[index++]=b;indices[index++]=a+1;
      indices[index++]=b;indices[index++]=b+1;indices[index++]=a+1;
    }
  }
  // A narrow continuous treetop fringe on the two nearer ranges. Its base
  // interpolates the existing crest exactly; no cracks, tree objects or draws.
  const capStarts=[];
  for(let layer=0;layer<RIDGE_CAP_SEGMENTS.length;layer++){
    const segments=RIDGE_CAP_SEGMENTS[layer],start=vertex;
    capStarts.push(start);
    const phase=hash2(seed,layer+0x54524545)/4294967295*TAU;
    for(let i=0;i<=segments;i++){
      const q=i/segments*RIDGE_SEGMENTS,left=Math.min(RIDGE_SEGMENTS-1,Math.floor(q)),t=q-left;
      const a=layer*(RIDGE_SEGMENTS+1)*RIDGE_ROWS+left*RIDGE_ROWS+RIDGE_ROWS-1,b=a+RIDGE_ROWS;
      const angle=(i===segments?0:i/segments)*TAU;
      const height=Math.max(.7,2.8+1.5*Math.sin(angle*(layer?193:263)+phase)+.8*Math.sin(angle*(layer?271:373)+phase*2))*(layer?.70:1);
      for(let top=0;top<2;top++){
        for(let k=0;k<3;k++){
          positions[vertex*3+k]=positions[a*3+k]+(positions[b*3+k]-positions[a*3+k])*t+(k===1?height*top:0);
          colors[vertex*3+k]=colors[a*3+k]+(colors[b*3+k]-colors[a*3+k])*t;
          nights[vertex*3+k]=nights[a*3+k]+(nights[b*3+k]-nights[a*3+k])*t;
        }
        uvs[vertex*2]=uvs[a*2]+(uvs[b*2]-uvs[a*2])*t;
        uvs[vertex*2+1]=uvs[a*2+1]+(uvs[b*2+1]-uvs[a*2+1])*t+height*top/CANOPY_TILE_METERS;
        canopyData[vertex*2]=layer?.35:1;canopyData[vertex*2+1]=top?0:8;
        vertex++;
      }
    }
    for(let i=0;i<segments;i++){
      const a=start+i*2,b=a+2;
      indices[index++]=a;indices[index++]=b;indices[index++]=a+1;
      indices[index++]=b;indices[index++]=b+1;indices[index++]=a+1;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setAttribute('nightColor',new THREE.BufferAttribute(nights,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geo.setAttribute('canopyData',new THREE.BufferAttribute(canopyData,2));
  geo.setIndex(new THREE.BufferAttribute(indices,1));
  geo.computeVertexNormals();
  // Normal averaging cannot cross the duplicated angular seam by itself.
  for(let layer=0;layer<RIDGE_LAYERS.length;layer++)for(let row=0;row<RIDGE_ROWS;row++){
    const a=layer*(RIDGE_SEGMENTS+1)*RIDGE_ROWS+row,b=a+RIDGE_SEGMENTS*RIDGE_ROWS;
    const n=geo.attributes.normal;
    const x=n.getX(a)+n.getX(b),y=n.getY(a)+n.getY(b),z=n.getZ(a)+n.getZ(b),length=Math.hypot(x,y,z)||1;
    n.setXYZ(a,x/length,y/length,z/length);n.setXYZ(b,x/length,y/length,z/length);
  }
  // Match normals on the high-resolution canopy seam too.
  for(let layer=0;layer<capStarts.length;layer++)for(let i=0;i<=RIDGE_CAP_SEGMENTS[layer];i++)for(let top=0;top<2;top++){
    const vertex=capStarts[layer]+i*2+top,x=positions[vertex*3],z=positions[vertex*3+2],y=Math.hypot(x,z)*.35;
    const length=Math.hypot(x,y,z);
    geo.attributes.normal.setXYZ(vertex,-x/length,y/length,-z/length);
  }
  geo.computeBoundingBox();geo.computeBoundingSphere();
  return geo;
}

export function buildMountains(scene, {seed = getSessionSeed()} = {}) {
  const root = new THREE.Group();root.name='Mountains';
  const canopy=buildRidgeCanopy();
  const material = new THREE.ShaderMaterial({
    name:'Blue Ridge atmosphere',vertexColors:true,
    uniforms:{
      nightness:{value:0},visibility:{value:1},
      canopyMap:{value:canopy},canopyEnabled:{value:1},
      fogColor:{value:new THREE.Color(0x94aaa0)},
      sunDirection:{value:new THREE.Vector3(.3,.8,.4).normalize()},
    },
    vertexShader: /* glsl */ `
      attribute vec3 nightColor;
      attribute vec2 canopyData;
      uniform float nightness;
      uniform float visibility;
      uniform vec3 sunDirection;
      varying vec3 vRidgeColor;
      varying float vAltitude;
      varying vec2 vCanopyUV;
      varying vec2 vCanopyData;
      void main(){
        vec3 p=position;
        p.y=mix(-220.0,p.y,visibility);
        vec4 world=modelMatrix*vec4(p,1.0);
        float shade=.70+.30*max(0.0,dot(normal,sunDirection));
        vRidgeColor=mix(color*shade,nightColor,nightness);
        vAltitude=world.y;
        vCanopyUV=uv;vCanopyData=canopyData;
        gl_Position=projectionMatrix*viewMatrix*world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 fogColor;
      uniform sampler2D canopyMap;
      uniform float canopyEnabled;
      uniform float nightness;
      varying vec3 vRidgeColor;
      varying float vAltitude;
      varying vec2 vCanopyUV;
      varying vec2 vCanopyData;
      void main(){
        // Actual ground is opaque with this same fog color at 520 m. The
        // buried foot blends into it; elevated terrain naturally occludes us.
        float foot=1.0-smoothstep(-12.0,10.0,vAltitude);
        vec3 forest=vRidgeColor;
        if(canopyEnabled>.5 && vCanopyData.x>0.0){
          vec4 crowns=texture2D(canopyMap,vCanopyUV);
          // Cut the outer leaf edge within the same opaque fringe draw,
          // without transparent sorting. Mips quiet distant crowns.
          if(vCanopyData.y<(1.0-crowns.a)*2.8*vCanopyData.x)discard;
          float detail=vCanopyData.x*(1.0-nightness*.84);
          vec3 leafTint=mix(vec3(.77,.88,.71),vec3(1.10,1.06,.91),crowns.g);
          vec3 crownShade=leafTint*(.50+crowns.r*1.05);
          forest*=mix(vec3(1.0),crownShade,detail);
        }
        gl_FragColor=vec4(mix(forest,fogColor,foot),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  // The texture is instance-owned like the geometry. Generic subtree cleanup
  // disposes the material, whose event releases its one texture exactly once.
  let canopyDisposed=false;
  material.addEventListener('dispose',()=>{if(!canopyDisposed){canopyDisposed=true;canopy.dispose();}});
  root.userData.setCanopyEnabled=enabled=>{material.uniforms.canopyEnabled.value=enabled?1:0;};
  const mesh=new THREE.Mesh(buildRidgeGeometry(seed),material);
  mesh.name='Blue Ridge ridgelines';mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.renderOrder=-10;root.add(mesh);scene.add(root);
  const forward=new THREE.Vector3();
  root.userData.update=(position,camera,tod)=>{
    root.position.set(position.x,0,position.z);
    const visibility=camera ? ridgeViewVisibility(-camera.getWorldDirection(forward).y) : 1;
    root.visible=visibility>.001;
    material.uniforms.visibility.value=visibility;
    material.uniforms.nightness.value=tod?.nightness??0;
    if(tod?.fog)material.uniforms.fogColor.value.copy(tod.fog.color);
    if(tod?.sun)material.uniforms.sunDirection.value.copy(tod.sun.position).normalize();
  };
  return root;
}
