export type Vec = {x:number;y:number;z:number};
export const add=(a:Vec,b:Vec):Vec=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a:Vec,b:Vec):Vec=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a:Vec,n:number):Vec=>({x:a.x*n,y:a.y*n,z:a.z*n});
export const dot=(a:Vec,b:Vec)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const len=(a:Vec)=>Math.sqrt(dot(a,a));
export const unit=(a:Vec)=>mul(a,1/Math.max(len(a),0.001));
export const cap=(a:Vec,n:number)=>mul(a,Math.min(1,n/Math.max(len(a),0.001)));
// Bounded spring + outward radial damping; never replaces tangential velocity.
export function swingForce(position:Vec,anchor:Vec,velocity:Vec,rope:number,look:Vec):Vec {
 const delta=sub(anchor,position), distance=len(delta), inward=unit(delta);
 const tension=Math.max(0,distance-rope)*0.075+Math.max(0,-dot(velocity,inward))*0.18;
 const tangent=sub(look,mul(inward,dot(look,inward)));
 return cap(add(mul(inward,Math.min(0.23,tension)),mul(tangent,0.025)),0.25);
}
