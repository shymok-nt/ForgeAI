import type {Bounds,StrokeElement} from '@/features/canvas/types';
export const LINE_Y_FACTOR=0.6;
export const WORD_GAP_FACTOR=0.5;
export type Stroke=StrokeElement;
export type InkWord={strokes:Stroke[];bbox:Bounds};
export type InkLine={words:InkWord[];bbox:Bounds;baseline:number};
const median=(values:number[])=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const bounds=(strokes:Stroke[]):Bounds=>[Math.min(...strokes.map(s=>s.bbox[0])),Math.min(...strokes.map(s=>s.bbox[1])),Math.max(...strokes.map(s=>s.bbox[2])),Math.max(...strokes.map(s=>s.bbox[3]))];
export function groupInk(strokes:Stroke[]):InkLine[]{
 if(!strokes.length)return [];
 const heights=strokes.map(s=>Math.max(1,s.bbox[3]-s.bbox[1]));
 const height=median(heights);
 const ordered=[...strokes].sort((a,b)=>(a.bbox[1]+a.bbox[3])-(b.bbox[1]+b.bbox[3]));
 const rows:Stroke[][]=[];
 for(const stroke of ordered){
  const cy=(stroke.bbox[1]+stroke.bbox[3])/2;
  let best:Stroke[]|undefined;let distance=Infinity;
  for(const row of rows){const center=median(row.map(s=>(s.bbox[1]+s.bbox[3])/2));const d=Math.abs(center-cy);if(d<height*LINE_Y_FACTOR&&d<distance){distance=d;best=row}}
  if(best)best.push(stroke);else rows.push([stroke]);
 }
 return rows.map(row=>{
  const words:InkWord[]=[];
  for(const stroke of [...row].sort((a,b)=>a.bbox[0]-b.bbox[0])){
   const previous=words[words.length-1];
   if(previous&&stroke.bbox[0]-previous.bbox[2]<height*WORD_GAP_FACTOR){previous.strokes.push(stroke);previous.bbox=bounds(previous.strokes)}
   else words.push({strokes:[stroke],bbox:[...stroke.bbox] as Bounds});
  }
  return {words,bbox:bounds(row),baseline:median(words.map(w=>w.bbox[3]))};
 }).sort((a,b)=>a.bbox[1]-b.bbox[1]);
}
