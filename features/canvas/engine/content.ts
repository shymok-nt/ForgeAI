import {emptyContent,type PageContent,type Element} from '@/features/canvas/types';
export function parseContent(raw:string):PageContent{
 try{const data:unknown=JSON.parse(raw);if(!data||typeof data!=='object')return emptyContent();
 const obj=data as Record<string,unknown>;
 if(obj.v!==2||!Array.isArray(obj.elements))return emptyContent();
 const elements=obj.elements.filter((item):item is Element=>{
 if(!item||typeof item!=='object')return false;
 const e=item as Record<string,unknown>;
 if(typeof e.id!=='string'||!Array.isArray(e.bbox)||e.bbox.length!==4||!e.bbox.every(n=>typeof n==='number'&&Number.isFinite(n)))return false;
 if(e.type==='stroke')return Array.isArray(e.points)&&e.points.length%3===0&&e.points.every(n=>typeof n==='number'&&Number.isFinite(n));
 if(e.type==='shape'){const p=e.params as Record<string,unknown>|undefined;return ['line','arrow','rect','ellipse','triangle','polygon'].includes(String(e.kind))&&!!p&&['x','y','w','h','rotation'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]))&&!!e.stroke}
 return false;
 });
 return {v:2,elements};
 }catch{return emptyContent()}
}
export function serializeContent(content:PageContent){return JSON.stringify(content)}
export const round=(v:number)=>Math.round(v*10)/10;
