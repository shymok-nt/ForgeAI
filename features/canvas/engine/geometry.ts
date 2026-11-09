import {Skia,type SkPath} from '@shopify/react-native-skia';
import {getStroke} from 'perfect-freehand';
import {round} from './content';
import type {StrokeElement} from '@/features/canvas/types';
type Sample=[number,number,number];
const distance=(a:Sample,b:Sample)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function segmentDistance(p:Sample,a:Sample,b:Sample){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;if(!len)return distance(p,a);const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
export function simplify(samples:Sample[],threshold=0.9):Sample[]{
 if(samples.length<3)return samples;
 const filtered=[samples[0]];for(let i=1;i<samples.length-1;i++)if(distance(samples[i],filtered[filtered.length-1])>0.55)filtered.push(samples[i]);filtered.push(samples[samples.length-1]);
 const rdp=(a:Sample[]):Sample[]=>{if(a.length<3)return a;let best=0,index=0;for(let i=1;i<a.length-1;i++){const d=segmentDistance(a[i],a[0],a[a.length-1]);if(d>best){best=d;index=i}}if(best<=threshold)return [a[0],a[a.length-1]];return [...rdp(a.slice(0,index+1)).slice(0,-1),...rdp(a.slice(index))]};
 return rdp(filtered);
}
export function makeStroke(samples:Sample[],options:Pick<StrokeElement,'tool'|'color'|'width'|'opacity'>,id:string,z:number):StrokeElement{
 const points=simplify(samples).flatMap(p=>p.map(round));const xs=samples.map(p=>p[0]),ys=samples.map(p=>p[1]);const pad=options.width/2;
 return {...options,id,type:'stroke',z,createdAt:new Date().toISOString(),points,bbox:[Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)+pad,Math.max(...ys)+pad]};
}
export function strokePath(stroke:StrokeElement):SkPath{
 const points:Sample[]=[];for(let i=0;i<stroke.points.length;i+=3)points.push([stroke.points[i],stroke.points[i+1],stroke.points[i+2]]);
 const outline=getStroke(points,{size:stroke.width,thinning:stroke.tool==='pen'?0.55:0,smoothing:0.55,streamline:0.45,simulatePressure:points.every(p=>p[2]===0.5),start:{cap:true,taper:0},end:{cap:true,taper:0}});
 if(!outline.length)return Skia.Path.Make();
 const coordinates:[number,number][]=outline.map((point:readonly number[]):[number,number]=>[Number(point[0]),Number(point[1])]);
 const svg=coordinates.map(([x,y]:[number,number],index:number)=>`${index===0?'M':'L'}${x} ${y}`).join(' ')+' Z';
 return Skia.Path.MakeFromSVGString(svg)??Skia.Path.Make();
}
export function strokeHit(stroke:StrokeElement,x:number,y:number,radius:number){const b=stroke.bbox;if(x<b[0]-radius||x>b[2]+radius||y<b[1]-radius||y>b[3]+radius)return false;const p:[number,number,number]=[x,y,0.5];for(let i=0;i<stroke.points.length;i+=3){const a:[number,number,number]=[stroke.points[i],stroke.points[i+1],0.5],j=Math.min(i+3,stroke.points.length-3),b:[number,number,number]=[stroke.points[j],stroke.points[j+1],0.5];if(segmentDistance(p,a,b)<radius+stroke.width/2)return true}return false}
