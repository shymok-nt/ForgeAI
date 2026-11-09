export const PAGE_WIDTH=1000;
export const PAGE_HEIGHT=1414;
export type Point=[number,number,number];
export type StrokeElement={id:string;type:'stroke';z:number;createdAt:string;tool:'pen'|'highlighter';color:string;width:number;opacity:number;points:number[];bbox:[number,number,number,number]};
export type Element=StrokeElement;
export type PageContent={v:2;elements:Element[]};
export const emptyContent=():PageContent=>({v:2,elements:[]});
