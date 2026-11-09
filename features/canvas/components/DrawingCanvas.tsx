import React,{memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {View,type LayoutChangeEvent} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,vec} from '@shopify/react-native-skia';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {useDerivedValue,useSharedValue,runOnJS} from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type StrokeElement} from '@/features/canvas/types';
import {makeStroke,strokePath} from '@/features/canvas/engine/geometry';
import {pixelErase} from '@/features/canvas/engine/pixelEraser';
import {shapePath,makeShape,lassoSelect,moveElement,scaleElement,rotateElement} from '@/features/canvas/engine/shapes';
import type {ShapeKind,Element} from '@/features/canvas/types';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand'|'select'|'shape';
export type Brush={color:string;width:number;opacity:number};
type Sample=[number,number,number];
type Props={content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;eraserMode?:'pixel'|'stroke';onChange:(next:PageContent)=>void;onDrawingActive?:(active:boolean)=>void;shapeKind?:ShapeKind;shapeFill?:boolean;onSelectionChange?:(ids:string[])=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color';value?:number;color?:string;version:number}};
const pathCache=new Map<string,{element:Element;path:ReturnType<typeof strokePath>}>();
const cachedPath=(element:Element)=>{
 const hit=pathCache.get(element.id);
 if(hit?.element===element)return hit.path;
 const path=element.type==='stroke'?strokePath(element):shapePath(element);
 pathCache.set(element.id,{element,path});
 if(pathCache.size>2500){for(const id of Array.from(pathCache.keys()).slice(0,500))pathCache.delete(id)}
 return path;
};
const StaticPaper=memo(function StaticPaper({template,paperColor}:{template:PageTemplate;paperColor:PaperColor}){
 const lines=useMemo(()=>{
  const items:{x1:number;y1:number;x2:number;y2:number}[]=[];
  if(template==='çizgili'||template==='kareli')for(let y=56;y<PAGE_HEIGHT;y+=42)items.push({x1:0,y1:y,x2:PAGE_WIDTH,y2:y});
  if(template==='kareli')for(let x=42;x<PAGE_WIDTH;x+=42)items.push({x1:x,y1:0,x2:x,y2:PAGE_HEIGHT});
  return items;
 },[template]);
 const dots=useMemo(()=>template==='noktalı'?Array.from({length:Math.floor(PAGE_HEIGHT/42)*Math.floor(PAGE_WIDTH/42)},(_,i)=>{const cols=Math.floor(PAGE_WIDTH/42);return [i%cols*42+21,Math.floor(i/cols)*42+21] as const}):[],[template]);
 return <>
  <Rect x={0} y={0} width={PAGE_WIDTH} height={PAGE_HEIGHT} color={paperColor==='krem'?'#FFF5DF':'#FFFFFF'}/>
  {lines.map((l,i)=><Line key={i} p1={vec(l.x1,l.y1)} p2={vec(l.x2,l.y2)} color="#D8DFEE" strokeWidth={1.2}/>)}
  {dots.map((p,i)=><Circle key={i} cx={p[0]} cy={p[1]} r={1.5} color="#D8DFEE"/>)}
 </>;
});
const StrokeLayer=memo(function StrokeLayer({element}:{element:Element}){
 const path=useMemo(()=>cachedPath(element),[element]);
 if(element.type==='shape')return <>{element.fill&&<Path path={path} color={element.fill.color} opacity={element.fill.opacity} style="fill"/>}<Path path={path} color={element.stroke.color} opacity={element.stroke.opacity} style="stroke" strokeWidth={element.stroke.width}/></>;
 return <Path path={path} color={element.color} opacity={element.opacity} blendMode={element.tool==='highlighter'?'multiply':'srcOver'} {...(element.renderMode==='centerline'?{style:'stroke' as const,strokeWidth:element.width,strokeCap:'round' as const,strokeJoin:'round' as const}:{})}/>;
});
const Completed=memo(function Completed({content}:{content:PageContent}){
 return <>{content.elements.map(element=><StrokeLayer key={element.id} element={element}/>)}</>;
});
export function DrawingCanvas({content,template,paperColor,tool,brush,eraserSize,eraserMode='pixel',onChange,onDrawingActive,shapeKind='rect',shapeFill=false,onSelectionChange,selectionAction}:Props){
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const selectedRef=useRef<string[]>([]);selectedRef.current=selectedIds;
 useEffect(()=>{if(!selectionAction)return;const ids=new Set(selectedRef.current);if(!ids.size)return;let next:Element[]=content.elements;
 if(selectionAction.kind==='delete')next=next.filter(e=>!ids.has(e.id));
 if(selectionAction.kind==='duplicate')next=[...next,...next.filter(e=>ids.has(e.id)).map(e=>({...moveElement(e,20,20),id:e.id+'-copy-'+selectionAction.version,z:next.length+1}))];
 if(selectionAction.kind==='move')next=next.map(e=>ids.has(e.id)?moveElement(e,selectionAction.value??20,selectionAction.value??20):e);
 if(selectionAction.kind==='scale')next=next.map(e=>ids.has(e.id)?scaleElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??1.1,selectionAction.value??1.1):e);
 if(selectionAction.kind==='rotate')next=next.map(e=>ids.has(e.id)?rotateElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??Math.PI/12):e);
 if(selectionAction.kind==='color')next=next.map(e=>ids.has(e.id)?e.type==='stroke'?{...e,color:selectionAction.color??e.color}:{...e,stroke:{...e.stroke,color:selectionAction.color??e.stroke.color}}:e);
 if(next!==content.elements){onChange({v:2,elements:next});if(selectionAction.kind==='delete'){setSelectedIds([]);onSelectionChange?.([])}}
 },[selectionAction?.version]);
 const [size,setSize]=useState({width:300,height:450});
 const fitWidth=Math.max(0.01,size.width/PAGE_WIDTH);
 const fitAll=Math.max(0.01,Math.min(fitWidth,(size.height-4)/PAGE_HEIGHT));
 const minZoom=Math.max(0.1,fitAll/fitWidth*0.8);
 const zoom=useSharedValue(1),offsetX=useSharedValue(0),offsetY=useSharedValue(0);
 const awaitingCommit=useSharedValue(false);
 const draft=useSharedValue(''),baseZoom=useSharedValue(1),baseX=useSharedValue(0),baseY=useSharedValue(0);
 const samples=useSharedValue<Sample[]>([]),blocked=useSharedValue(false),drawing=useSharedValue(false);
 const selectionStart=useSharedValue<Sample|null>(null);
 const downTime=useSharedValue(0),startX=useSharedValue(0),startY=useSharedValue(0);
 const originX=useDerivedValue(()=>(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value);
 const originY=useDerivedValue(()=>size.height>PAGE_HEIGHT*fitWidth*zoom.value?(size.height-PAGE_HEIGHT*fitWidth*zoom.value)/2+offsetY.value:offsetY.value);
 const transform=useDerivedValue(()=>[{translateX:originX.value},{translateY:originY.value},{scale:fitWidth*zoom.value}]);
 const clamp=useCallback((z:number,x:number,y:number):[number,number]=>{ 'worklet';
  const pw=PAGE_WIDTH*fitWidth*z,ph=PAGE_HEIGHT*fitWidth*z;
  const limitX=Math.max(0,(pw-size.width)/2+32);
  const baseY=ph<size.height?(size.height-ph)/2:0;
  const minY=Math.min(0,size.height-ph-32)-baseY,maxY=32-baseY;
  return [Math.max(-limitX,Math.min(limitX,x)),Math.max(minY,Math.min(maxY,y))];
 },[size.width,size.height,fitWidth]);
 const layout=(e:LayoutChangeEvent)=>{const {width,height}=e.nativeEvent.layout;if(width===size.width&&height===size.height)return;setSize({width,height});zoom.value=1;offsetX.value=0;offsetY.value=0};
 const pagePoint=(x:number,y:number):Sample=>{ 'worklet';return [(x-originX.value)/(fitWidth*zoom.value),(y-originY.value)/(fitWidth*zoom.value),0.5]};
 const endStroke=(points:Sample[])=>{if(!points.length)return;
 if(tool==='select'){
  const poly=points.flatMap(p=>[p[0],p[1]]);
  const ids=lassoSelect(content.elements,poly);
  if(!ids.length&&points.length<=3){const p=points[0];const hit=content.elements.filter(e=>p[0]>=e.bbox[0]-12&&p[0]<=e.bbox[2]+12&&p[1]>=e.bbox[1]-12&&p[1]<=e.bbox[3]+12).at(-1);if(hit)ids.push(hit.id)}
  setSelectedIds(ids);onSelectionChange?.(ids);return;
 }
 if(tool==='shape'){
  const first=points[0],last=points[points.length-1];let w=last[0]-first[0],h=last[1]-first[1];if(Math.abs(Math.abs(w)-Math.abs(h))/Math.max(1,Math.abs(w),Math.abs(h))<0.05){h=Math.sign(h||1)*Math.abs(w)}
  const shape=makeShape(shapeKind,first[0],first[1],w,h,brush.color,brush.width,brush.opacity,shapeFill);shape.z=content.elements.length;
  onChange({v:2,elements:[...content.elements,shape]});return;
 }
 if(tool==='eraser'){const next=pixelErase(content.elements,points,eraserSize/2,eraserMode==='stroke');if(next!==content.elements)onChange({v:2,elements:next});return}
  const stroke=makeStroke(points,{tool:tool==='highlighter'?'highlighter':'pen',...brush},Crypto.randomUUID(),content.elements.length);
  onChange({v:2,elements:[...content.elements,stroke]});
 };
 const notify=(active:boolean)=>onDrawingActive?.(active);
 const complete=(points:Sample[])=>{endStroke(points);};
 useLayoutEffect(()=>{if(awaitingCommit.value){draft.value='';awaitingCommit.value=false}},[content]);
 const pan=Gesture.Pan().minDistance(0).onTouchesDown(e=>{
  if(e.allTouches.length>1){blocked.value=true;samples.value=[];draft.value='';drawing.value=false}
 }).onBegin(e=>{
  if(blocked.value||e.numberOfPointers!==1)return;
  startX.value=e.x;startY.value=e.y;downTime.value=Date.now();
  if(tool==='hand'){baseX.value=offsetX.value;baseY.value=offsetY.value;return}
  samples.value=[pagePoint(e.x,e.y)];drawing.value=false;draft.value='';
 }).onUpdate(e=>{
  if(blocked.value||e.numberOfPointers!==1)return;
  if(tool==='hand'){const [x,y]=clamp(zoom.value,baseX.value+e.translationX,baseY.value+e.translationY);offsetX.value=x;offsetY.value=y;return}
  const p=pagePoint(e.x,e.y),prev=samples.value[samples.value.length-1];
  if(prev&&Math.hypot((p[0]-prev[0])*fitWidth*zoom.value,(p[1]-prev[1])*fitWidth*zoom.value)<1.5)return;
  samples.value=[...samples.value,p];
  if(!drawing.value&&Date.now()-downTime.value<70&&Math.hypot(e.x-startX.value,e.y-startY.value)<6)return;
  if(!drawing.value){drawing.value=true;runOnJS(notify)(true)}
  if(tool==='eraser')return;
  const pts=samples.value;
  draft.value=pts.map((v,i)=>`${i===0?'M':'L'}${Math.round(v[0]*10)/10} ${Math.round(v[1]*10)/10}`).join(' ');
 }).onEnd(()=>{
  if(!blocked.value&&tool!=='hand'&&drawing.value&&samples.value.length){awaitingCommit.value=true;runOnJS(complete)(samples.value)}
  samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;runOnJS(notify)(false);
 }).onFinalize(()=>{samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;blocked.value=false}).runOnJS(false);
 const pinch=Gesture.Pinch().onBegin(()=>{blocked.value=true;samples.value=[];draft.value='';drawing.value=false;baseZoom.value=zoom.value;baseX.value=offsetX.value;baseY.value=offsetY.value}).onUpdate(e=>{
  const z=Math.max(minZoom,Math.min(5,baseZoom.value*e.scale));
  const [x,y]=clamp(z,baseX.value,baseY.value);zoom.value=z;offsetX.value=x;offsetY.value=y;
 }).onEnd(()=>{blocked.value=true}).runOnJS(false);
 const doubleTap=Gesture.Tap().numberOfTaps(2).onEnd(()=>{
  const z=zoom.value===1?fitAll/fitWidth:zoom.value<1?2:1;
  zoom.value=z;offsetX.value=0;offsetY.value=0;
 });
 const gestures=Gesture.Simultaneous(pan,pinch,doubleTap);

 return <View onLayout={layout} style={{flex:1,overflow:'hidden',backgroundColor:paperColor==='krem'?'#FFF5DF':'#FFFFFF'}}>
 <GestureDetector gesture={gestures}><View style={{flex:1}}><Canvas style={{flex:1}}>
 <Group transform={transform}>
 <StaticPaper template={template} paperColor={paperColor}/>
 <Completed content={content}/>
 {selectedIds.length>0&&(()=>{const es=content.elements.filter(e=>selectedIds.includes(e.id));if(!es.length)return null;const b=[Math.min(...es.map(e=>e.bbox[0])),Math.min(...es.map(e=>e.bbox[1])),Math.max(...es.map(e=>e.bbox[2])),Math.max(...es.map(e=>e.bbox[3]))];return <><Rect x={b[0]} y={b[1]} width={b[2]-b[0]} height={b[3]-b[1]} color="#3388EE" style="stroke" strokeWidth={2}/>{[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]].map((p,i)=><Circle key={i} cx={p[0]} cy={p[1]} r={7} color="#FFFFFF"/>)}</>})()}

 <Path path={draft} color={brush.color} opacity={brush.opacity} blendMode={tool==='highlighter'?'multiply':'srcOver'} style="stroke" strokeWidth={brush.width} strokeCap="round" strokeJoin="round"/>
 </Group></Canvas></View></GestureDetector></View>;
}
