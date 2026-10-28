// Recording scene boundary, not a geometry/matrix oracle. Native ownership
// contracts construct real Three.js rigs and verify their publications separately.
export class Vector {
 constructor(x=0,y=0,z=0){this.set(x,y,z);}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 copy(p){return this.set(p.x,p.y,p.z);}clone(){return new Vector(this.x,this.y,this.z);}
 distanceTo(p){return Math.hypot(this.x-p.x,this.y-p.y,this.z-p.z);}
 distanceToSquared(p){return (this.x-p.x)**2+(this.y-p.y)**2+(this.z-p.z)**2;}
 add(p){this.x+=p.x;this.y+=p.y;this.z+=p.z;return this;}
 subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z);}
 normalize(){const d=Math.hypot(this.x,this.y,this.z)||1;this.x/=d;this.y/=d;this.z/=d;return this;}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this;}
 addScaledVector(p,s){this.x+=p.x*s;this.y+=p.y*s;this.z+=p.z*s;return this;}
 lerpVectors(a,b,t){return this.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);}
}
export class Node {
 constructor(){this.position=new Vector();this.rotation={x:0,y:0,z:0};this.userData={};this.children=[];this.visible=true;}
 add(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;}return this;}
 removeFromParent(){if(this.parent){const index=this.parent.children.indexOf(this);if(index>=0)this.parent.children.splice(index,1);}this.parent=null;}
 clear(){for(const node of [...this.children])node.removeFromParent();}
 traverse(visit){visit(this);for(const child of this.children)child.traverse(visit);}updateMatrixWorld(){}
 getWorldPosition(out){out.copy(this.position);for(let p=this.parent;p;p=p.parent){const c=Math.cos(p.rotation.y),s=Math.sin(p.rotation.y),x=out.x,z=out.z;out.set(x*c+z*s+p.position.x,out.y+p.position.y,-x*s+z*c+p.position.z);}return out;}
}
