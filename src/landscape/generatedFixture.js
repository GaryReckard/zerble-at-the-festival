import { createLandscapeForm,createFormSurface,formVertexHeight } from './forms.js';
import { createFormCamping,freezeLandscapePlan } from './campingPlan.js';
import { buildHeightGrid } from './geometry.js';
export function createGeneratedFixture(seed=1977,family='paired-meadows') {
  const form=createLandscapeForm(seed,family),surface=createFormSurface(form),local=createFormCamping(form);
  if(!local.valid)throw new Error(`Generated fixture camping rejected: ${local.reason}`);
  const bounds=Object.freeze({...form.bounds,minX:Math.floor(form.bounds.minX/10)*10,maxX:Math.ceil(form.bounds.maxX/10)*10}),vertexHeight=(x,z)=>formVertexHeight(form,x,z),start=form.route[0];
  const stops=[{name:'Start · finite stream crossing',...start},...form.shelves.map((s,i)=>({name:`Meadow ${i+1} · ${s.height}m`,x:(s.minX+s.maxX)/2,z:(s.minZ+s.maxZ)/2})),
    {name:'Wooded clearing',...form.route.at(-1)},{name:'Bridge · deck support',x:start.x,z:-30,surfaceId:form.bridge.id}];
  return Object.freeze({...surface,form,bounds,step:10,vertexHeight,deck:form.bridge,stream:form.stream,stops:Object.freeze(stops.map(Object.freeze)),
    districtPlan:freezeLandscapePlan({...local,version:2}),buildStrip:(minZ,maxZ)=>buildHeightGrid(vertexHeight,{minX:bounds.minX,maxX:bounds.maxX,minZ,maxZ,stepX:10,stepZ:10})});
}
