import React,{memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {View,PixelRatio,type LayoutChangeEvent} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,vec} from '@shopify/react-native-skia';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {useDerivedValue,useSharedValue,runOnJS} from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type StrokeElement} from '@/features/canvas/types';
import {makeStroke,strokePath} from '@/features/canvas/engine/geometry';
import {pixelErase} from '@/features/canvas/engine/pixelEraser';
import {recognizeShape} from '@/features/canvas/engine/recognizeShape';
import {shapePath,makeShape,lassoSelect,moveElement,scaleElement,rotateElement} from '@/features/canvas/engine/shapes';
import type {ShapeMode,Element} from '@/features/canvas/types';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand'|'select'|'shape';
export type Brush={color:string;width:number;opacity:number};
type Sample=[number,number,number];
type Props={content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;eraserMode?:'pixel'|'stroke';onChange:(next:PageContent)=>void;onDrawingActive?:(active:boolean)=>void;shapeKind?:ShapeMode;shapeFill?:boolean;onSelectionChange?:(ids:string[])=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color';value?:number;color?:string;version:number};transformMode?:boolean};
const PAPER_STEP=80;
const normalizeShapeSize=(kind:string,w:number,h:number):[number,number]=>{ 'worklet';
 if(kind==='triangle'){
  const side=Math.max(Math.abs(w),Math.abs(h)*2/Math.sqrt(3));
  return [Math.sign(w||1)*side,Math.sign(h||1)*side*Math.sqrt(3)/2];
 }
 if((kind==='rect'||kind==='ellipse')&&Math.min(Math.abs(w),Math.abs(h))/Math.max(1,Math.abs(w),Math.abs(h))>=0.76){
  const side=(Math.abs(w)+Math.abs(h))/2;
  return [Math.sign(w||1)*side,Math.sign(h||1)*side];
 }
 return [w,h];
};
const previewShape=(kind:string,x0:number,y0:number,x1:number,y1:number):string=>{ 'worklet';
 if(kind==='triangle'||kind==='rect'||kind==='ellipse'){
  const size=normalizeShapeSize(kind,x1-x0,y1-y0);
  x1=x0+size[0];y1=y0+size[1];
 }
 const l=Math.min(x0,x1),r=Math.max(x0,x1),t=Math.min(y0,y1),b=Math.max(y0,y1);
 if(kind==='line'||kind==='arrow'){
  let s='M '+x0+' '+y0+' L '+x1+' '+y1;
  if(kind==='arrow'){const a=Math.atan2(y1-y0,x1-x0),h=24;s+=' M '+(x1-h*Math.cos(a-0.5))+' '+(y1-h*Math.sin(a-0.5))+' L '+x1+' '+y1+' L '+(x1-h*Math.cos(a+0.5))+' '+(y1-h*Math.sin(a+0.5))}
  return s}
 if(kind==='rect')return 'M '+l+' '+t+' L '+r+' '+t+' L '+r+' '+b+' L '+l+' '+b+' Z';
 if(kind==='triangle')return 'M '+((x0+x1)/2)+' '+y0+' L '+x1+' '+y1+' L '+x0+' '+y1+' Z';
 const rx=(r-l)/2,ry=(b-t)/2,cx=l+rx,cy=t+ry;
 if(rx<1||ry<1)return '';
 return 'M '+(cx+rx)+' '+cy+' A '+rx+' '+ry+' 0 1 0 '+(cx-rx)+' '+cy+' A '+rx+' '+ry+' 0 1 0 '+(cx+rx)+' '+cy+' Z';
};
// For a single shape, the selection frame follows its local axes rather
// than the axis-aligned bounding box of the rotated geometry.
const selectionFrame=(elements:Element[]):{bounds:readonly [number,number,number,number];rotation:number}|null=>{
 if(!elements.length)return null;
 if(elements.length===1&&elements[0].type==='shape'){
  const p=elements[0].params;
  return {bounds:[Math.min(p.x,p.x+p.w),Math.min(p.y,p.y+p.h),Math.max(p.x,p.x+p.w),Math.max(p.y,p.y+p.h)],rotation:p.rotation};
 }
 return {bounds:[
  Math.min(...elements.map(e=>e.bbox[0])),Math.min(...elements.map(e=>e.bbox[1])),
  Math.max(...elements.map(e=>e.bbox[2])),Math.max(...elements.map(e=>e.bbox[3]))
 ],rotation:0};
};
const pathCache=new Map<string,{element:Element;path:ReturnType<typeof strokePath>}>();
const cachedPath=(element:Element)=>{
 const hit=pathCache.get(element.id);
 if(hit?.element===element)return hit.path;
 const path=element.type==='stroke'?strokePath(element):shapePath(element);
 pathCache.set(element.id,{element,path});
 if(pathCache.size>2500){for(const id of Array.from(pathCache.keys()).slice(0,500))pathCache.delete(id)}
 return path;
};
const StaticPaper=memo(function StaticPaper({template,paperColor,pageHeight,fitWidth}:{template:PageTemplate;paperColor:PaperColor;pageHeight:number;fitWidth:number}){
 const ratio=PixelRatio.get();
 const stepPx=Math.max(8,Math.round(PAPER_STEP*fitWidth*ratio));
 const stepPage=stepPx/ratio/fitWidth;
 const linePx=Math.max(1,Math.round(ratio*0.75));
 const lineW=linePx/ratio/fitWidth;
 const half=(linePx%2)?0.5/ratio/fitWidth:0;
 const lines=useMemo(()=>{
  const items:{x1:number;y1:number;x2:number;y2:number}[]=[];
  if(template==='çizgili'||template==='kareli')for(let y=stepPage+half;y<pageHeight;y+=stepPage)items.push({x1:0,y1:y,x2:PAGE_WIDTH,y2:y});
  if(template==='kareli')for(let x=stepPage+half;x<PAGE_WIDTH;x+=stepPage)items.push({x1:x,y1:0,x2:x,y2:pageHeight});
  return items;
 },[template,fitWidth,pageHeight,stepPage,half]);
 const dots=useMemo(()=>{
  if(template!=='noktalı')return [] as [number,number][];
  const items:[number,number][]=[];
  for(let y=stepPage+half;y<pageHeight;y+=stepPage)for(let x=stepPage+half;x<PAGE_WIDTH;x+=stepPage)items.push([x,y]);
  return items;
 },[template,fitWidth,pageHeight,stepPage,half]);
 return <>
  <Rect x={0} y={0} width={PAGE_WIDTH} height={pageHeight} color={paperColor==='krem'?'#FFF5DF':'#FFFFFF'}/>
  {lines.map((l,i)=><Line key={i} p1={vec(l.x1,l.y1)} p2={vec(l.x2,l.y2)} color="#C4CCDD" strokeWidth={lineW}/>)}
  {dots.map((p,i)=><Circle key={i} cx={p[0]} cy={p[1]} r={lineW*1.2} color="#C4CCDD"/>)}
 </>;
});
const StrokeLayer=memo(function StrokeLayer({element}:{element:Element}){
 const path=useMemo(()=>cachedPath(element),[element]);
 if(element.type==='shape'){
  const {x,y,w,h,rotation}=element.params;
  const center=vec(x+w/2,y+h/2);
  return <Group origin={center} transform={[{rotate:rotation}]}>
   {element.fill&&<Path path={path} color={element.fill.color} opacity={element.fill.opacity} style="fill"/>}
   <Path path={path} color={element.stroke.color} opacity={element.stroke.opacity} style="stroke" strokeWidth={element.stroke.width}/>
  </Group>;
 }
 return <Path path={path} color={element.color} opacity={element.opacity} blendMode={element.tool==='highlighter'?'multiply':'srcOver'} {...(element.renderMode==='centerline'?{style:'stroke' as const,strokeWidth:element.width,strokeCap:'round' as const,strokeJoin:'round' as const}:{})}/>;
});
const Completed=memo(function Completed({content,hiddenIds}:{content:PageContent;hiddenIds?:string[]}){
 return <>{content.elements.filter(element=>!hiddenIds?.includes(element.id)).map(element=><StrokeLayer key={element.id} element={element}/>)}</>;
});
export function DrawingCanvas({content,template,paperColor,tool,brush,eraserSize,eraserMode='pixel',onChange,onDrawingActive,shapeKind='auto',shapeFill=false,onSelectionChange,selectionAction,transformMode=false}:Props){
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const selectedRef=useRef<string[]>([]);selectedRef.current=selectedIds;
 useEffect(()=>{if(!selectionAction)return;const ids=new Set(selectedRef.current);if(!ids.size)return;let next:Element[]=content.elements;
 if(selectionAction.kind==='delete')next=next.filter(e=>!ids.has(e.id));
 if(selectionAction.kind==='duplicate')next=[...next,...next.filter(e=>ids.has(e.id)).map(e=>({...moveElement(e,20,20),id:e.id+'-copy-'+selectionAction.version,z:next.length+1}))];
 if(selectionAction.kind==='move')next=next.map(e=>ids.has(e.id)?moveElement(e,selectionAction.value??20,selectionAction.value??20):e);
 if(selectionAction.kind==='scale')next=next.map(e=>ids.has(e.id)?scaleElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??1.1,selectionAction.value??1.1):e);
 if(selectionAction.kind==='rotate')next=next.map(e=>ids.has(e.id)?rotateElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??Math.PI/12):e);
 if(selectionAction.kind==='color')next=next.map(e=>ids.has(e.id)?e.type==='stroke'?{...e,color:selectionAction.color??e.color}:{...e,stroke:{...e.stroke,color:selectionAction.color??e.stroke.color}}:e);
 if(next!==content.elements){onChange(withHeight(next));if(selectionAction.kind==='delete'){setSelectedIds([]);onSelectionChange?.([])}}
 },[selectionAction?.version]);
 const [size,setSize]=useState({width:300,height:450});
 const fitWidth=Math.max(0.01,size.width/PAGE_WIDTH);
 const pageHeight=Math.max(PAGE_HEIGHT,content.h??PAGE_HEIGHT,Math.ceil(size.height/fitWidth));
 const withHeight=(elements:Element[],minimum=pageHeight):PageContent=>({v:2,elements,h:Math.max(pageHeight,minimum)});
 const fitAll=Math.max(0.01,Math.min(fitWidth,size.height/pageHeight));
 const minZoom=1;
 const zoom=useSharedValue(1),offsetX=useSharedValue(0),offsetY=useSharedValue(0);
 const awaitingCommit=useSharedValue(false);
 const cursorX=useSharedValue(0),cursorY=useSharedValue(0),cursorOn=useSharedValue(false);
 const eraserWidth=useDerivedValue(()=>eraserSize*1.2/(fitWidth*zoom.value));
 const eraserRadius=useDerivedValue(()=>eraserWidth.value/2);
 const cursorOpacity=useDerivedValue(()=>cursorOn.value?0.6:0);
 const draft=useSharedValue(''),baseZoom=useSharedValue(1),baseX=useSharedValue(0),baseY=useSharedValue(0),pinchX=useSharedValue(0),pinchY=useSharedValue(0);
 const samples=useSharedValue<Sample[]>([]),blocked=useSharedValue(false),drawing=useSharedValue(false);
 const dragX=useSharedValue(0),dragY=useSharedValue(0),draggingSelection=useSharedValue(false);
 const dragPending=useSharedValue(false);
 const cornerActive=useSharedValue(false),cornerStartX=useSharedValue(0),cornerStartY=useSharedValue(0);
 const cornerCenterX=useSharedValue(0),cornerCenterY=useSharedValue(0);
 const cornerStartRadius=useSharedValue(1),cornerStartAngle=useSharedValue(0);
 const cornerLastAngle=useSharedValue(0),cornerAccumAngle=useSharedValue(0);
 const cornerMode=useSharedValue(0); // 0 undecided, 1 resize, 2 rotate
 const cornerStartPageX=useSharedValue(0),cornerStartPageY=useSharedValue(0);
 const gestureScale=useSharedValue(1),gestureAngle=useSharedValue(0);
 const gestureDX=useSharedValue(0),gestureDY=useSharedValue(0);
 const transformActive=useSharedValue(false),transformPending=useSharedValue(false);
 const [handoff,setHandoff]=useState<{elements:Element[];bounds:readonly [number,number,number,number];rotation:number;dx:number;dy:number;scale:number;angle:number}|null>(null);
 const pendingHandoff=useRef(false);
 const rotateActive=useSharedValue(false),pinchActive=useSharedValue(false);
 const gestureFocalX=useSharedValue(0),gestureFocalY=useSharedValue(0);
 const gestureCenterX=useSharedValue(0),gestureCenterY=useSharedValue(0);

 const selectedElements=useMemo(()=>content.elements.filter(e=>selectedIds.includes(e.id)),[content,selectedIds]);
 // Only retain a handoff while it represents the same selection.
 const handoffMatchesSelection=!!handoff&&handoff.elements.length===selectedIds.length&&
  handoff.elements.every(e=>selectedIds.includes(e.id));

 const selectedFrame=useMemo(()=>selectionFrame(selectedElements),[selectedElements]);
 // Use the same geometry for gesture hit-testing, transform center and rendering.
 // A retained handoff is the current visible baseline until another commit.
 const selectedBounds=handoffMatchesSelection?handoff!.bounds:(selectedFrame?.bounds??null);
 const selectedRotation=handoffMatchesSelection?handoff!.rotation:(selectedFrame?.rotation??0);
 const selectedRotationValue=useSharedValue(0);
 useEffect(()=>{selectedRotationValue.value=selectedRotation;},[selectedRotation]);
 // As soon as persisted geometry arrives, the handoff draws that geometry
 // instead of re-projecting the old path. This prevents stale-size flashes.
 // The handoff always contains the FINAL geometry, never an old path.
 // Switching between old and new paths was the source of the release flash.
 const handoffElements=handoffMatchesSelection?handoff!.elements:[];
 const handoffBounds=handoffMatchesSelection?handoff!.bounds:null;
 const handoffRotation=handoffMatchesSelection?handoff!.rotation:0;
 // The selection border has a constant screen-space inset while the
 // shape scales. Without this correction its 10px padding scales too,
 // so the frame visibly jumps when the saved geometry replaces the preview.
 const selectionInset=useDerivedValue(()=>10/Math.max(0.15,gestureScale.value));
 const selectionHandleRadius=useDerivedValue(()=>6/Math.max(0.15,gestureScale.value));
 const selectionFrameX=useDerivedValue(()=>(selectedBounds?.[0]??0)-selectionInset.value);
 const selectionFrameY=useDerivedValue(()=>(selectedBounds?.[1]??0)-selectionInset.value);
 const selectionFrameW=useDerivedValue(()=>(selectedBounds?.[2]??0)-(selectedBounds?.[0]??0)+2*selectionInset.value);
 const selectionFrameH=useDerivedValue(()=>(selectedBounds?.[3]??0)-(selectedBounds?.[1]??0)+2*selectionInset.value);
 const selectionCorners=[
  [useDerivedValue(()=>selectionFrameX.value),useDerivedValue(()=>selectionFrameY.value)],
  [useDerivedValue(()=>selectionFrameX.value+selectionFrameW.value),useDerivedValue(()=>selectionFrameY.value)],
  [useDerivedValue(()=>selectionFrameX.value),useDerivedValue(()=>selectionFrameY.value+selectionFrameH.value)],
  [useDerivedValue(()=>selectionFrameX.value+selectionFrameW.value),useDerivedValue(()=>selectionFrameY.value+selectionFrameH.value)]
 ] as const;
 const selectionBoundsValue=useSharedValue<readonly [number,number,number,number]|null>(null);
 useEffect(()=>{selectionBoundsValue.value=selectedBounds;},[selectedBounds]);
 const dragTransform=useDerivedValue(()=>[{translateX:dragX.value},{translateY:dragY.value}]);
 // A fixed-length transform keeps Skia's animated property binding intact
 // for the first and every subsequent gesture.
 const selectionTransform=useDerivedValue(()=>[
  {translateX:dragX.value+gestureDX.value},
  {translateY:dragY.value+gestureDY.value},
  {translateX:gestureCenterX.value},
  {translateY:gestureCenterY.value},
  {rotate:gestureAngle.value},
  {scale:gestureScale.value},
  {translateX:-gestureCenterX.value},
  {translateY:-gestureCenterY.value}
 ]);
 const selectAt=(x:number,y:number)=>{
  const margin=16/fitWidth;
  const hit=[...content.elements].reverse().find(e=>x>=e.bbox[0]-margin&&x<=e.bbox[2]+margin&&y>=e.bbox[1]-margin&&y<=e.bbox[3]+margin);
  if(hit){if(!selectedRef.current.includes(hit.id))setHandoff(null);setSelectedIds([hit.id]);onSelectionChange?.([hit.id]);}
 };
 const commitSelectionMove=(dx:number,dy:number)=>{
  if(Math.hypot(dx,dy)<0.1)return;
  const ids=new Set(selectedRef.current);
  if(!ids.size)return;
  const b=selectedBounds;
  if(!b)return;
  const next=content.elements.map(e=>ids.has(e.id)?moveElement(e,dx,dy):e);
  const finalElements=next.filter(e=>ids.has(e.id));
  const finalFrame=selectionFrame(finalElements);
  if(!finalFrame)return;
  pendingHandoff.current=true;
  setHandoff({elements:finalElements,bounds:finalFrame.bounds,rotation:finalFrame.rotation,dx:0,dy:0,scale:1,angle:0});
  onChange(withHeight(next));
 };
 const commitGesture=(dx:number,dy:number,scale:number,angle:number)=>{
  const ids=new Set(selectedRef.current);
  if(!ids.size)return;
  const b=selectedBounds;
  if(!b)return;
  const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const next=content.elements.map(e=>{
   if(!ids.has(e.id))return e;
   let out=e;
   if(Math.abs(scale-1)>0.0001)out=scaleElement(out,cx,cy,scale,scale);
   if(Math.abs(angle)>0.0001){
    out=rotateElement(out,cx,cy,angle);
    if(out.type==='shape'){
     const p=out.params;
     const sx=p.x+p.w/2,sy=p.y+p.h/2;
     const rx=cx+(sx-cx)*cos-(sy-cy)*sin;
     const ry=cy+(sx-cx)*sin+(sy-cy)*cos;
     out=moveElement(out,rx-sx,ry-sy);
    }
   }
   if(Math.abs(dx)+Math.abs(dy)>0.0001)out=moveElement(out,dx,dy);
   return out;
  });
  // Publish the final path and its matching selection frame together.
  // No stale geometry is ever drawn while React/Skia apply the update.
  const finalElements=next.filter(e=>ids.has(e.id));
  const finalFrame=selectionFrame(finalElements);
  if(!finalFrame)return;
  pendingHandoff.current=true;
  setHandoff({elements:finalElements,bounds:finalFrame.bounds,rotation:finalFrame.rotation,dx:0,dy:0,scale:1,angle:0});
  onChange(withHeight(next));
 };
 // React commits the final path and its selection frame as ONE Skia group.
 // Reset worklet transforms only after that group has switched to final geometry.
 useLayoutEffect(()=>{
  if(!handoff)return;
  dragX.value=0;dragY.value=0;dragPending.value=false;
  gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
  transformPending.value=false;
  
 },[handoff]);
 // Keep the committed geometry mounted as the selected shape's baseline.
 // Removing the handoff after React's commit caused a second Skia scene
 // replacement, briefly repainting the previous geometry on CanvasKit.
 // It is cleared only when selection/tool identity changes.
 useEffect(()=>{
  if(tool!=='select'||selectedIds.length===0){
   pendingHandoff.current=false;
   setHandoff(null);
  }
 },[tool,selectedIds.length]);
 const selectionStart=useSharedValue<Sample|null>(null);
 const downTime=useSharedValue(0),startX=useSharedValue(0),startY=useSharedValue(0);
 const originX=useDerivedValue(()=>(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value);
 const originY=useDerivedValue(()=>offsetY.value);
 const transform=useDerivedValue(()=>[{translateX:originX.value},{translateY:originY.value},{scale:fitWidth*zoom.value}]);
 const clamp=useCallback((z:number,x:number,y:number):[number,number]=>{ 'worklet';
  const pw=PAGE_WIDTH*fitWidth*z,ph=pageHeight*fitWidth*z;
  const limitX=Math.max(0,(pw-size.width)/2);
  const minY=Math.min(0,size.height-ph),maxY=0;
  return [Math.max(-limitX,Math.min(limitX,x)),Math.max(minY,Math.min(maxY,y))];
 },[size.width,size.height,fitWidth,pageHeight]);
 const layout=(e:LayoutChangeEvent)=>{const {width,height}=e.nativeEvent.layout;if(width===size.width&&height===size.height)return;setSize({width,height});zoom.value=1;offsetX.value=0;offsetY.value=0};
 const pagePoint=(x:number,y:number):Sample=>{ 'worklet';return [(x-originX.value)/(fitWidth*zoom.value),(y-originY.value)/(fitWidth*zoom.value),0.5]};
 const endStroke=(points:Sample[])=>{if(!points.length)return;
 if(tool==='select'){
  awaitingCommit.value=false;draft.value='';
  const poly=points.flatMap(p=>[p[0],p[1]]);
  const ids=lassoSelect(content.elements,poly);
  if(!ids.length&&points.length<=3){const p=points[0];const hit=content.elements.filter(e=>p[0]>=e.bbox[0]-12&&p[0]<=e.bbox[2]+12&&p[1]>=e.bbox[1]-12&&p[1]<=e.bbox[3]+12).at(-1);if(hit)ids.push(hit.id)}
  setSelectedIds(ids);onSelectionChange?.(ids);return;
 }
 if(tool==='shape'){
  if(__DEV__){
   const step=Math.max(1,Math.floor(points.length/150));
   const pts=points.filter((_,i)=>i%step===0).map(p=>[Math.round(p[0]),Math.round(p[1])]);
   console.log('SHAPE_DEBUG',JSON.stringify({mode:shapeKind,count:points.length,pts}));
  }
  const first=points[0],last=points[points.length-1];
  if(shapeKind==='auto'){
   const r=recognizeShape(points);
   if(__DEV__)console.log('SHAPE_RESULT',JSON.stringify(r?{kind:r.kind,x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.w),h:Math.round(r.h)}:null));
   if(r){
    const s=makeShape(r.kind,r.x,r.y,r.w,r.h,brush.color,brush.width,brush.opacity,shapeFill);
    if(r.kind==='polygon'&&r.points)s.params={...s.params,points:r.points};
    s.z=content.elements.length;
    onChange(withHeight([...content.elements,s],s.bbox[3]+400));return;
   }
   // Unrecognized input falls through to the freehand stroke.
  }else{
   let w=last[0]-first[0],h=last[1]-first[1];
   if(Math.hypot(w,h)<8){draft.value='';awaitingCommit.value=false;return}
   [w,h]=normalizeShapeSize(shapeKind,w,h);
   const shape=makeShape(shapeKind,first[0],first[1],w,h,brush.color,brush.width,brush.opacity,shapeFill);shape.z=content.elements.length;
   onChange(withHeight([...content.elements,shape],shape.bbox[3]+400));return;
  }
 }
 if(tool==='eraser'){
     const radius=eraserSize*1.2/2/(fitWidth*zoom.value);
     const next=pixelErase(content.elements,points,radius,eraserMode==='stroke');
     if(next!==content.elements)onChange(withHeight(next));
     else{draft.value='';awaitingCommit.value=false}
     return;
   }
  const stroke=makeStroke(points,{tool:tool==='highlighter'?'highlighter':'pen',...brush},Crypto.randomUUID(),content.elements.length);
  onChange(withHeight([...content.elements,stroke],stroke.bbox[3]+400));
 };
 const notify=(active:boolean)=>onDrawingActive?.(active);
 const complete=(points:Sample[])=>{endStroke(points);};
 useEffect(()=>{
     if(!awaitingCommit.value)return;
     let r2=0;
     const r1=requestAnimationFrame(()=>{r2=requestAnimationFrame(()=>{draft.value='';awaitingCommit.value=false})});
     return()=>{cancelAnimationFrame(r1);cancelAnimationFrame(r2)};
   },[content]);
 const pan=Gesture.Pan().minDistance(0).onTouchesDown(e=>{
  if(e.allTouches.length>1){blocked.value=true;samples.value=[];draft.value='';drawing.value=false}
 }).onBegin(e=>{
  if(blocked.value||e.numberOfPointers!==1)return;
  startX.value=e.x;startY.value=e.y;downTime.value=Date.now();
  if(tool==='hand'){baseX.value=offsetX.value;baseY.value=offsetY.value;return}
  // Drag an already selected element immediately; don't wait for a long press.
  // The previous zero-distance Pan gesture prevented LongPress from reliably activating.
  if(tool==='select'&&selectionBoundsValue.value){
   const p=pagePoint(e.x,e.y),b=selectionBoundsValue.value;
   const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   const cornerRadius=22/(fitWidth*zoom.value);
   const rotation=selectedRotationValue.value,cos=Math.cos(rotation),sin=Math.sin(rotation);
   const corners:[[number,number],[number,number],[number,number],[number,number]]=[
    [b[0]-10,b[1]-10],[b[2]+10,b[1]-10],[b[0]-10,b[3]+10],[b[2]+10,b[3]+10]
   ].map(([x,y])=>[cx+(x-cx)*cos-(y-cy)*sin,cy+(x-cx)*sin+(y-cy)*cos]) as [[number,number],[number,number],[number,number],[number,number]];
   let cornerHit=false;
   for(const corner of corners){
    if(Math.hypot(p[0]-corner[0],p[1]-corner[1])<=cornerRadius){
     cornerHit=true;
     cornerActive.value=true;cornerMode.value=0;
     cornerCenterX.value=cx;cornerCenterY.value=cy;
     cornerStartX.value=corner[0];cornerStartY.value=corner[1];
     cornerStartPageX.value=p[0];cornerStartPageY.value=p[1];
     cornerStartRadius.value=Math.max(1,Math.hypot(corner[0]-cx,corner[1]-cy));
     cornerStartAngle.value=Math.atan2(corner[1]-cy,corner[0]-cx);
     cornerLastAngle.value=cornerStartAngle.value;cornerAccumAngle.value=0;
     gestureCenterX.value=cx;gestureCenterY.value=cy;
     gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
     break;
    }
   }
   if(cornerHit){samples.value=[];drawing.value=false;draft.value='';return;}
   const hitSlop=12/(fitWidth*zoom.value);
   // Reuse the rotation matrix from the handle hit test above.
    const localX=cx+(p[0]-cx)*cos+(p[1]-cy)*sin;
    const localY=cy-(p[0]-cx)*sin+(p[1]-cy)*cos;
    if(localX>=b[0]-hitSlop&&localX<=b[2]+hitSlop&&localY>=b[1]-hitSlop&&localY<=b[3]+hitSlop){
    draggingSelection.value=true;dragX.value=0;dragY.value=0;
    samples.value=[];drawing.value=false;draft.value='';
    return;
   }
  }
  if(tool==='select'){
   samples.value=[pagePoint(e.x,e.y)];drawing.value=false;draft.value='';
   return;
  }
  samples.value=[pagePoint(e.x,e.y)];drawing.value=false;draft.value='';
  if(tool==='eraser'){
    const q=samples.value[0];
    draft.value='M'+q[0]+' '+q[1]+' L'+(q[0]+0.01)+' '+q[1];
    cursorX.value=q[0];cursorY.value=q[1];cursorOn.value=true;drawing.value=true;runOnJS(notify)(true);
  }
 }).onUpdate(e=>{
  if(blocked.value||e.numberOfPointers!==1)return;
  if(tool==='hand'){const [x,y]=clamp(zoom.value,baseX.value+e.translationX,baseY.value+e.translationY);offsetX.value=x;offsetY.value=y;return}
  if(cornerActive.value){
   const p=pagePoint(e.x,e.y),cx=cornerCenterX.value,cy=cornerCenterY.value;
   const dx=p[0]-cornerStartPageX.value,dy=p[1]-cornerStartPageY.value;
   const startX=cornerStartX.value-cx,startY=cornerStartY.value-cy;
   const tangent=(-startY*dx+startX*dy)/cornerStartRadius.value;
   const radial=(startX*dx+startY*dy)/cornerStartRadius.value;
   // Dragging away from the center grows; dragging toward it shrinks on every corner.
   if(cornerMode.value===0&&Math.hypot(dx,dy)>8/(fitWidth*zoom.value))
    cornerMode.value=Math.abs(tangent)>Math.abs(radial)*1.25?2:1;
   if(cornerMode.value===1){
    gestureScale.value=Math.max(0.15,Math.min(8,Math.hypot(p[0]-cx,p[1]-cy)/cornerStartRadius.value));
    gestureAngle.value=0;
   }else if(cornerMode.value===2){
    const angle=Math.atan2(p[1]-cy,p[0]-cx);
    let delta=angle-cornerLastAngle.value;
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    cornerAccumAngle.value+=delta;cornerLastAngle.value=angle;
    gestureAngle.value=cornerAccumAngle.value;gestureScale.value=1;
   }
   return;
  }
  if(draggingSelection.value){
   dragX.value=e.translationX/(fitWidth*zoom.value);
   dragY.value=e.translationY/(fitWidth*zoom.value);
   return;
  }
  if(tool==='select')return;
  const p=pagePoint(e.x,e.y),prev=samples.value[samples.value.length-1];
  if(prev&&Math.hypot((p[0]-prev[0])*fitWidth*zoom.value,(p[1]-prev[1])*fitWidth*zoom.value)<1.5)return;
  samples.value=[...samples.value,p];
  if(!drawing.value&&Date.now()-downTime.value<70&&Math.hypot(e.x-startX.value,e.y-startY.value)<6)return;
  if(!drawing.value){drawing.value=true;runOnJS(notify)(true)}
  if(tool==='shape'&&shapeKind!=='auto'){
    const a=samples.value[0],x0=a[0],y0=a[1],x1=p[0],y1=p[1];
    draft.value=previewShape(shapeKind,x0,y0,x1,y1);
    return;
  }
  if(draft.value===''){
    draft.value='M'+samples.value.map(v=>Math.round(v[0]*10)/10+' '+Math.round(v[1]*10)/10).join(' L');
  }else{
    draft.value=draft.value+' L'+Math.round(p[0]*10)/10+' '+Math.round(p[1]*10)/10;
  }
  if(tool==='eraser'){cursorX.value=p[0];cursorY.value=p[1];cursorOn.value=true}
 }).onEnd(()=>{
  if(cornerActive.value){
   const scale=gestureScale.value,angle=gestureAngle.value;
   cornerActive.value=false;cornerMode.value=0;
   if(!blocked.value&&(Math.abs(scale-1)>0.0001||Math.abs(angle)>0.0001)){
    transformPending.value=true;
    runOnJS(commitGesture)(0,0,scale,angle);
   }else {gestureScale.value=1;gestureAngle.value=0}
   runOnJS(notify)(false);return;
  }
  if(draggingSelection.value){
   const dx=dragX.value,dy=dragY.value;
   draggingSelection.value=false;
   if(!blocked.value&&Math.hypot(dx,dy)>0.1){runOnJS(commitSelectionMove)(dx,dy);}
   else {dragX.value=0;dragY.value=0}
   drawing.value=false;
   runOnJS(notify)(false);return;
  }
  if(!blocked.value&&tool!=='hand'&&drawing.value&&samples.value.length){awaitingCommit.value=true;runOnJS(complete)(samples.value)}
  samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;cursorOn.value=false;runOnJS(notify)(false);
 }).onFinalize(()=>{samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;blocked.value=false;cursorOn.value=false;draggingSelection.value=false;cornerActive.value=false;if(!dragPending.value&&!draggingSelection.value){/* Keep the last pose until the JS handoff mounts. */}}).runOnJS(false);
 const pinch=Gesture.Pinch().onBegin(e=>{
  if(tool==='select'&&selectionBoundsValue.value){
   blocked.value=true;samples.value=[];draft.value='';drawing.value=false;
   transformActive.value=true;pinchActive.value=true;
   gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
   gestureFocalX.value=e.focalX;gestureFocalY.value=e.focalY;
   const bounds=selectionBoundsValue.value;
   gestureCenterX.value=(bounds[0]+bounds[2])/2;
   gestureCenterY.value=(bounds[1]+bounds[3])/2;
   runOnJS(notify)(true);return;
  }
  blocked.value=true;samples.value=[];draft.value='';drawing.value=false;baseZoom.value=zoom.value;baseX.value=offsetX.value;baseY.value=offsetY.value;pinchX.value=0;pinchY.value=0}).onUpdate(e=>{
  if(tool==='select'&&selectionBoundsValue.value){
   gestureScale.value=Math.max(0.15,Math.min(8,e.scale));
   gestureDX.value=(e.focalX-gestureFocalX.value)/(fitWidth*zoom.value);
   gestureDY.value=(e.focalY-gestureFocalY.value)/(fitWidth*zoom.value);
   return;
  }
  const z=Math.max(minZoom,Math.min(5,baseZoom.value*e.scale));
  if(pinchX.value===0&&pinchY.value===0){pinchX.value=e.focalX;pinchY.value=e.focalY}
  const [x,y]=clamp(z,baseX.value+e.focalX-pinchX.value,baseY.value+e.focalY-pinchY.value);zoom.value=z;offsetX.value=x;offsetY.value=y;
 }).onEnd(()=>{
  if(tool==='select'&&transformActive.value){
   pinchActive.value=false;
   if(!rotateActive.value){
    const dx=gestureDX.value,dy=gestureDY.value,scale=gestureScale.value,angle=gestureAngle.value;
    transformActive.value=false;
    if(Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001){
     runOnJS(commitGesture)(dx,dy,scale,angle);
    }
    else {gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0}
    runOnJS(notify)(false);
   }
   return;
  }
  blocked.value=true;
 }).runOnJS(false);
 const rotation=Gesture.Rotation().onBegin(()=>{
  if(tool==='select'&&selectionBoundsValue.value){rotateActive.value=true;}
 }).onUpdate(e=>{
  if(tool==='select'&&transformActive.value)gestureAngle.value=e.rotation;
 }).onEnd(()=>{
  if(tool==='select'&&transformActive.value){
   rotateActive.value=false;
   if(!pinchActive.value){
    const dx=gestureDX.value,dy=gestureDY.value,scale=gestureScale.value,angle=gestureAngle.value;
    transformActive.value=false;
    if(Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001)
     runOnJS(commitGesture)(dx,dy,scale,angle);
    else {gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;}
    runOnJS(notify)(false);
   }
  }
 }).runOnJS(false);
 const singleTap=Gesture.Tap().numberOfTaps(1).maxDuration(250).maxDistance(12).onEnd(e=>{
  if(tool==='select'&&!blocked.value){const p=pagePoint(e.x,e.y);runOnJS(selectAt)(p[0],p[1]);}
 }).runOnJS(false);
 const gestures=Gesture.Simultaneous(pan,pinch,rotation,singleTap);

 return <View onLayout={layout} style={{flex:1,overflow:'hidden',touchAction:'none',backgroundColor:paperColor==='krem'?'#FFF5DF':'#FFFFFF'}}>
 <GestureDetector gesture={gestures}><View style={{flex:1,touchAction:'none'}}><Canvas style={{flex:1}}>
 <Group transform={transform}>
 <StaticPaper template={template} paperColor={paperColor} pageHeight={pageHeight} fitWidth={fitWidth}/>
 <Group layer={tool==='eraser'}>
  <Completed content={content} hiddenIds={tool==='select'?selectedIds:undefined}/>
  {tool==='eraser'&&<Path path={draft} blendMode="clear" color="black" style="stroke" strokeWidth={eraserWidth} strokeCap="round" strokeJoin="round"/>}
 </Group>
 {tool==='select'&&(handoffBounds||selectedBounds)&&<Group transform={selectionTransform}>
  {(handoffMatchesSelection?handoffElements:selectedElements).map(element=><StrokeLayer key={element.id} element={element}/>)}
  {(()=>{
   const bounds=handoffBounds??selectedBounds!;
   const rotation=handoffMatchesSelection?handoffRotation:selectedRotation;
   const x=bounds[0]-10,y=bounds[1]-10,w=bounds[2]-bounds[0]+20,h=bounds[3]-bounds[1]+20;
   return <Group origin={vec((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2)} transform={[{rotate:rotation}]}>
    {handoffMatchesSelection?
     <Rect x={x} y={y} width={w} height={h} color="#3388EE" style="stroke" strokeWidth={1.5}/>:
     <Rect x={selectionFrameX} y={selectionFrameY} width={selectionFrameW} height={selectionFrameH} color="#3388EE" style="stroke" strokeWidth={1.5}/>}
    {handoffMatchesSelection?
     [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map((p,i)=><Group key={i}><Circle cx={p[0]} cy={p[1]} r={6} color="#FFFFFF"/><Circle cx={p[0]} cy={p[1]} r={6} color="#3388EE" style="stroke" strokeWidth={2}/></Group>):
     selectionCorners.map((p,i)=><Group key={i}><Circle cx={p[0]} cy={p[1]} r={selectionHandleRadius} color="#FFFFFF"/><Circle cx={p[0]} cy={p[1]} r={selectionHandleRadius} color="#3388EE" style="stroke" strokeWidth={2}/></Group>)}
   </Group>;
  })()}
 </Group>}
 {tool!=='eraser'&&tool!=='select'&&<Path path={draft} color={brush.color} opacity={brush.opacity} blendMode={tool==='highlighter'?'multiply':'srcOver'} style="stroke" strokeWidth={brush.width} strokeCap="round" strokeJoin="round"/>}
 {tool==='eraser'&&<Circle cx={cursorX} cy={cursorY} r={eraserRadius} color="#808080" opacity={cursorOpacity} style="stroke" strokeWidth={1.5}/>}
 </Group></Canvas></View></GestureDetector></View>;
}
