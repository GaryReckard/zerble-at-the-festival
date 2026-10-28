// Resource release only. Callers stop execution, revoke person authority and
// release borrowers before handing their owned scene subtree to this helper.
export function disposeSceneResources(root) {
  const resources=new Set(),errors=[];
  const release=fn=>{try{fn();}catch(error){errors.push(error);}};
  root.traverse(object=>{
    if(object.isInstancedMesh)release(()=>object.dispose());
    if(object.geometry&&!object.geometry.userData?.shared)resources.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])if(material&&!material.userData?.shared)resources.add(material);
  });
  for(const resource of resources)release(()=>resource.dispose());
  if(errors.length)throw new AggregateError(errors,'Owned scene resource cleanup failed.');
}
