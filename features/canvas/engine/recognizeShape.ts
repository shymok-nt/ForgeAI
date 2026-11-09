import type {Point} from '@/features/canvas/types';

export type RecognizedShape={
 kind:'line'|'rect'|'ellipse'|'polygon';
 x:number;y:number;w:number;h:number;points?:number[];
};

const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const pointLineDistance=(p:Point,a:Point,b:Point)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 if(den===0)return distance(p,a);
 const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den));
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};

// Simplify a closed outline into its meaningful corners before testing for a rectangle.
const simplify=(points:Point[],tolerance:number):Point[]=>{
 const recurse=(start:number,end:number,out:number[])=>{
  let far=-1,index=-1;
  for(let i=start+1;i<end;i++){
   const d=pointLineDistance(points[i],points[start],points[end]);
   if(d>far){far=d;index=i}
  }
  if(far>tolerance&&index>start){recurse(start,index,out);recurse(index,end,out)}
  else out.push(start);
 };
 const out:number[]=[];
 recurse(0,points.length-1,out);
 out.push(points.length-1);
 return out.map(i=>points[i]);
};
const rectangleCorners=(points:Point[],diagonal:number):Point[]|null=>{
 // Start the closed contour at its most distant point from the centroid.
 const cx=points.reduce((s,p)=>s+p[0],0)/points.length;
 const cy=points.reduce((s,p)=>s+p[1],0)/points.length;
 let anchor=0,best=-1;
 for(let i=0;i<points.length;i++){
  const d=Math.hypot(points[i][0]-cx,points[i][1]-cy);
  if(d>best){best=d;anchor=i}
 }
 const ordered=[...points.slice(anchor),...points.slice(0,anchor),points[anchor]];
 const corners=simplify(ordered,diagonal*0.055);
 // First and last are the same corner.
 if(corners.length!==5)return null;
 const vertices=corners.slice(0,4);
 for(let i=0;i<4;i++){
  const a=vertices[(i+3)%4],b=vertices[i],c=vertices[(i+1)%4];
  const ux=a[0]-b[0],uy=a[1]-b[1],vx=c[0]-b[0],vy=c[1]-b[1];
  const len1=Math.hypot(ux,uy),len2=Math.hypot(vx,vy);
  if(Math.min(len1,len2)<diagonal*0.18)return null;
  const cosine=(ux*vx+uy*vy)/(len1*len2);
  if(Math.abs(cosine)>0.45)return null;
 }
 return vertices;
};
export function recognizeShape(points:Point[]):RecognizedShape|null{
 if(points.length<3)return null;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const x=Math.min(...xs),y=Math.min(...ys);
 const w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 const diagonal=Math.hypot(w,h);
 if(diagonal<12)return null;
 const first=points[0],last=points[points.length-1];
 const maxDeviation=Math.max(...points.map(p=>pointLineDistance(p,first,last)));
 if(distance(first,last)>diagonal*0.7&&maxDeviation<Math.max(5,diagonal*0.07)){
  return {kind:'line',x:first[0],y:first[1],w:last[0]-first[0],h:last[1]-first[1]};
 }
 if(w<15||h<15||points.length<8)return null;
 const closed=distance(first,last)<diagonal*0.22;
 if(!closed)return null;
 const perimeter=points.slice(1).reduce((n,p,i)=>n+distance(p,points[i]),0);
 if(perimeter<diagonal*1.5)return null;
 // Corners are more reliable than axis-aligned edges for tilted, hand-drawn rectangles.
 // Keep the original edge check as a fallback for uneven sampling.
 const corners=rectangleCorners(points,diagonal);
 if(corners)return {kind:'rect',x,y,w,h};
 const edgeTolerance=Math.max(7,Math.min(w,h)*0.14);
 const onRectEdge=points.filter(p=>Math.min(Math.abs(p[0]-x),Math.abs(p[0]-(x+w)),Math.abs(p[1]-y),Math.abs(p[1]-(y+h)))<edgeTolerance).length/points.length;
 if(onRectEdge>0.78)return {kind:'rect',x,y,w,h};
 const cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2;
 const ellipseError=points.reduce((sum,p)=>sum+Math.abs(Math.hypot((p[0]-cx)/rx,(p[1]-cy)/ry)-1),0)/points.length;
 if(ellipseError<0.17)return {kind:'ellipse',x,y,w,h};
 return null;
}
