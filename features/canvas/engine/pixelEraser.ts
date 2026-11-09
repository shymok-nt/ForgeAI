import type {Element,StrokeElement,Point,Bounds} from '@/features/canvas/types';
import {round} from './content';

type P=Point;
const distanceToSegment=(p:P,a:P,b:P)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
 return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
};
const near=(p:P,path:P[],radius:number)=>{
 if(path.length===1)return Math.hypot(p[0]-path[0][0],p[1]-path[0][1])-radius;
 let d=Infinity;for(let i=1;i<path.length;i++)d=Math.min(d,distanceToSegment(p,path[i-1],path[i]));return d-radius;
};
const lerp=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const bbox=(points:P[],pad:number):Bounds=>{
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return [Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad];
};
const overlaps=(a:Bounds,b:Bounds)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const pathLength=(points:P[])=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
export function pixelErase(elements:Element[],path:P[],radius:number,wholeStroke=false):Element[]{
 if(!path.length)return elements;
 const eraserBox=bbox(path,radius);
 let changed=false;
 const result:Element[]=[];
 for(const e of elements){
  if(!overlaps(e.bbox,eraserBox)){result.push(e);continue}
  if(e.type==='shape'){
   // Vector shapes retain whole-element erasing until outline clipping is supported.
   const corners:P[]=[[e.bbox[0],e.bbox[1],0.5],[e.bbox[2],e.bbox[1],0.5],[e.bbox[0],e.bbox[3],0.5],[e.bbox[2],e.bbox[3],0.5]];
   if(corners.some(p=>near(p,path,radius+e.stroke.width/2)<=0)){changed=true;continue}
   result.push(e);continue;
  }
  const original:P[]=[];
  for(let i=0;i<e.points.length;i+=3)original.push([e.points[i],e.points[i+1],e.points[i+2]]);
  if(!original.length){result.push(e);continue}
  const r=radius+e.width/2;
  // Resample long segments to prevent fast eraser movements from leaving gaps.
  const dense:P[]=[original[0]];
  for(let i=1;i<original.length;i++){
   const a=original[i-1],b=original[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const count=Math.max(1,Math.ceil(length/Math.max(0.8,r/3)));
   for(let j=1;j<=count;j++)dense.push(lerp(a,b,j/count));
  }
  const flags=dense.map(p=>near(p,path,r)<=0);
  if(!flags.some(Boolean)){result.push(e);continue}
  changed=true;
  if(wholeStroke)continue;
  const chunks:P[][]=[];let current:P[]=[];
  for(let i=0;i<dense.length;i++){
   const point=dense[i],inside=flags[i];
   if(i>0&&inside!==flags[i-1]){
    const a=dense[i-1],b=point;
    let lo=0,hi=1;
    for(let k=0;k<12;k++){
     const mid=(lo+hi)/2;
     if((near(lerp(a,b,mid),path,r)<=0)===flags[i-1])lo=mid;else hi=mid;
    }
    const boundary=lerp(a,b,(lo+hi)/2);
    if(inside){current.push(boundary);if(current.length>1)chunks.push(current);current=[]}
    else current=[boundary];
   }
   if(!inside)current.push(point);
  }
  if(current.length>1)chunks.push(current);
  for(let i=0;i<chunks.length;i++){
   const pts=chunks[i];if(pathLength(pts)<e.width*1.5)continue;
   const newStroke:StrokeElement={...e,id:e.id+'-cut-'+i+'-'+Date.now(),points:pts.flatMap(p=>p.map(round)),bbox:bbox(pts,e.width/2)};
   result.push(newStroke);
  }
 }
 return changed?result:elements;
}
