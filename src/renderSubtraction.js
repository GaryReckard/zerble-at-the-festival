// Diagnostic only: partition the current scene without touching registry,
// population, collision or resource ownership. Call again after streaming.
export function renderSubtractionTargets(game) {
  const labels=new WeakMap(),targets=new Map();
  const mark=(family,roots)=>{
    for(const root of roots.flat())if(root)labels.set(root,family);
  };
  mark('adults',[game.crowd?.group]);
  mark('children',[game.kids?.group]);
  mark('other-people',[game.wooks?.group,game.puppets?.group,game.band?.group,
    game.hoopers?.group,game.frisbees?.group,game.oneWheels?.riders?.map(r=>r.group)??[]]);
  mark('vehicles',[game.zerble?.root,game.lurleen?.root,game.nutWagon?.root]);
  mark('effects',[game.bubbles?.mesh,game.bubbles?.specialRoot,game.smiles?.group,game.fireworks?.group]);
  function visit(node,family='world',visible=true){
    family=labels.get(node)??family;visible=visible&&node.visible!==false;
    if(node.isMesh&&visible){
      if(!targets.has(family))targets.set(family,[]);
      targets.get(family).push(node);
    }
    for(const child of node.children??[])visit(child,family,visible);
  }
  visit(game.scene);
  return targets;
}

// A subtraction is deliberately not an optimization or an equal-content
// benchmark. Snapshot each flag and restore it even when drawing throws.
export async function withoutRendering(nodes,measure) {
  const previous=new Map([...new Set(nodes)].map(node=>[node,node.visible]));
  try{
    for(const node of previous.keys())node.visible=false;
    return await measure();
  }finally{
    for(const [node,visible]of previous)node.visible=visible;
  }
}
