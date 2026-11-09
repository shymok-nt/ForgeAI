import {Skia,type SkPath} from '@shopify/react-native-skia';
import type {Element,ShapeElement,ShapeKind,Bounds} from '@/features/canvas/types';
export function shapeBounds(p:ShapeElement['params']):Bounds{
 const {x,y,w,h}=p;return [Math.min(x,x+w),Math.min(y,y+h),Math.max(x,x+w),Math.max(y,y+h)];
}
export function shapePath(s:ShapeElement):SkPath{
 const {x,y,w,h,points}=s.params;const p=Skia.Path.Make();
 if(s.kind==='line'||s.kind==='arrow'){p.moveTo(x,y);p.lineTo(x+w,y+h);
 if(s.kind==='arrow'){const a=Math.atan2(h,w),r=Math.max(14,s.stroke.width*4);p.moveTo(x+w-r*Math.cos(a-0.5),y+h-r*Math.sin(a-0.5));p.lineTo(x+w,y+h);p.lineTo(x+w-r*Math.cos(a+0.5),y+h-r*Math.sin(a+0.5))}}
 else if(s.kind==='rect')p.addRect(Skia.XYWHRect(Math.min(x,x+w),Math.min(y,y+h),Math.abs(w),Math.abs(h)));
 else if(s.kind==='ellipse')p.addOval(Skia.XYWHRect(Math.min(x,x+w),Math.min(y,y+h),Math.abs(w),Math.abs(h)));
 else if(s.kind==='triangle'){p.moveTo(x+w/2,y);p.lineTo(x+w,y+h);p.lineTo(x,y+h);p.close()}
 else if(points&&points.length>=4){p.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)p.lineTo(points[i],points[i+1]);p.close()}
 return p;
}
export function makeShape(kind:ShapeKind,x:number,y:number,w:number,h:number,color:string,width:number,opacity:number,fill=false):ShapeElement{
 const params={x,y,w,h,rotation:0};return {id:'shape-'+Date.now()+'-'+Math.random().toString(36).slice(2),type:'shape',kind,params,stroke:{color,width,opacity},fill:fill?{color,opacity:0.2}:null,bbox:shapeBounds(params),z:0,createdAt:new Date().toISOString()};
}
export function moveElement(e:Element,dx:number,dy:number):Element{
 if(e.type==='stroke'){const points=e.points.map((v,i)=>i%3===0?v+dx:i%3===1?v+dy:v);const b=e.bbox;return {...e,points,bbox:[b[0]+dx,b[1]+dy,b[2]+dx,b[3]+dy]}}
 const params={...e.params,x:e.params.x+dx,y:e.params.y+dy,points:e.params.points?.map((v,i)=>v+(i%2===0?dx:dy))};return {...e,params,bbox:shapeBounds(params)};
}
export function scaleElement(e:Element,cx:number,cy:number,sx:number,sy:number):Element{
 if(e.type==='stroke'){const points=e.points.map((v,i)=>i%3===0?cx+(v-cx)*sx:i%3===1?cy+(v-cy)*sy:v);const b=e.bbox;return {...e,points,bbox:[Math.min(cx+(b[0]-cx)*sx,cx+(b[2]-cx)*sx),Math.min(cy+(b[1]-cy)*sy,cy+(b[3]-cy)*sy),Math.max(cx+(b[0]-cx)*sx,cx+(b[2]-cx)*sx),Math.max(cy+(b[1]-cy)*sy,cy+(b[3]-cy)*sy)]}}
 const p=e.params;const params={...p,x:cx+(p.x-cx)*sx,y:cy+(p.y-cy)*sy,w:p.w*sx,h:p.h*sy};return {...e,params,bbox:shapeBounds(params)};
}
export function rotateElement(e:Element,cx:number,cy:number,angle:number):Element{
 const rotate=(x:number,y:number):[number,number]=>[cx+(x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle),cy+(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle)];
 if(e.type==='stroke'){const points=[...e.points];for(let i=0;i<points.length;i+=3)[points[i],points[i+1]]=rotate(points[i],points[i+1]);const xs=points.filter((_,i)=>i%3===0),ys=points.filter((_,i)=>i%3===1);return {...e,points,bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}}
 const p=e.params;const [x,y]=rotate(p.x,p.y);const params={...p,x,y,rotation:p.rotation+angle};return {...e,params,bbox:shapeBounds(params)};
}
export function pointInside(poly:number[],x:number,y:number){let inside=false;for(let i=0,j=poly.length-2;i<poly.length;j=i,i+=2){const xi=poly[i],yi=poly[i+1],xj=poly[j],yj=poly[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside}return inside}
export function lassoSelect(elements:Element[],poly:number[]):string[]{
 if(poly.length<6)return [];
 return elements.filter(e=>{const samples:number[][]=[];if(e.type==='stroke'){for(let i=0;i<e.points.length;i+=Math.max(3,Math.floor(e.points.length/120/3)*3))samples.push([e.points[i],e.points[i+1]])}
 else{const b=e.bbox;for(let i=0;i<=4;i++)for(let j=0;j<=4;j++)samples.push([b[0]+(b[2]-b[0])*i/4,b[1]+(b[3]-b[1])*j/4])}
 return samples.length>0&&samples.filter(p=>pointInside(poly,p[0],p[1])).length>=samples.length*0.5
 }).map(e=>e.id);
}
