import {emptyContent,type PageContent,type StrokeElement} from '@/features/canvas/types';
export function parseContent(raw:string):PageContent{
 try{const data:unknown=JSON.parse(raw);if(!data||typeof data!=='object')return emptyContent();
  const obj=data as Record<string,unknown>;
  if(obj.v===1&&Array.isArray(obj.strokes))return emptyContent();
  if(obj.v!==2||!Array.isArray(obj.elements))return emptyContent();
  const elements=obj.elements.filter((item):item is StrokeElement=>{
   if(!item||typeof item!=='object')return false;
   const e=item as Partial<StrokeElement>;
   return e.type==='stroke'&&typeof e.id==='string'&&Array.isArray(e.points)&&e.points.length%3===0&&e.points.every(n=>typeof n==='number'&&Number.isFinite(n))&&Array.isArray(e.bbox)&&e.bbox.length===4;
  });
  return {v:2,elements};
 }catch{return emptyContent()}
}
export function serializeContent(content:PageContent){return JSON.stringify(content)}
export const round=(v:number)=>Math.round(v*10)/10;
