import React,{memo,useCallback,useMemo,useRef,useState} from 'react';
import {View,type LayoutChangeEvent} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,vec} from '@shopify/react-native-skia';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import {useDerivedValue,useSharedValue,runOnJS} from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type StrokeElement} from '@/features/canvas/types';
import {makeStroke,strokePath,strokeHit} from '@/features/canvas/engine/geometry';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand';
export type Brush={color:string;width:number;opacity:number};
type Sample=[number,number,number];
type Props={content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;onChange:(next:PageContent)=>void;onDrawingActive?:(active:boolean)=>void};
const Completed=memo(function Completed({content,view}:{content:PageContent;view:[number,number,number,number]}){
 const paths=useMemo(()=>content.elements.filter(s=>{const b=s.bbox;return b[2]>=view[0]&&b[0]<=view[2]&&b[3]>=view[1]&&b[1]<=view[3]}).map(s=>({element:s,path:strokePath(s)})).sort((a,b)=>(a.element.tool==='highlighter'?0:1)-(b.element.tool==='highlighter'?0:1)),[content,view[0],view[1],view[2],view[3]]);
 return <>{paths.map(({element,path})=><Path key={element.id} path={path} color={element.color} opacity={element.opacity} blendMode={element.tool==='highlighter'?'multiply':'srcOver'}/>)}</>;
});
export function DrawingCanvas({content,template,paperColor,tool,brush,eraserSize,onChange,onDrawingActive}:Props){
 const [size,setSize]=useState({width:300,height:450});
 const fitWidth=Math.max(0.01,(size.width-4)/PAGE_WIDTH);
 const fitAll=Math.max(0.01,Math.min(fitWidth,(size.height-4)/PAGE_HEIGHT));
 const minZoom=Math.max(0.1,fitAll/fitWidth*0.8);
 const zoom=useSharedValue(1),offsetX=useSharedValue(0),offsetY=useSharedValue(0);
 const draft=useSharedValue(''),baseZoom=useSharedValue(1),baseX=useSharedValue(0),baseY=useSharedValue(0);
 const samples=useSharedValue<Sample[]>([]),blocked=useSharedValue(false),drawing=useSharedValue(false);
 const downTime=useSharedValue(0),startX=useSharedValue(0),startY=useSharedValue(0);
 const originX=useDerivedValue(()=>(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value);
 const originY=useDerivedValue(()=>size.height>PAGE_HEIGHT*fitWidth*zoom.value?(size.height-PAGE_HEIGHT*fitWidth*zoom.value)/2+offsetY.value:offsetY.value);
 const transform=useDerivedValue(()=>[{translateX:originX.value},{translateY:originY.value},{scale:fitWidth*zoom.value}]);
 const clamp=useCallback((z:number,x:number,y:number):[number,number]=>{
  const pw=PAGE_WIDTH*fitWidth*z,ph=PAGE_HEIGHT*fitWidth*z;
  const limitX=Math.max(0,(pw-size.width)/2+32);
  const baseY=ph<size.height?(size.height-ph)/2:0;
  const minY=Math.min(0,size.height-ph-32)-baseY,maxY=32-baseY;
  return [Math.max(-limitX,Math.min(limitX,x)),Math.max(minY,Math.min(maxY,y))];
 },[size.width,size.height,fitWidth]);
 const layout=(e:LayoutChangeEvent)=>{const {width,height}=e.nativeEvent.layout;if(width===size.width&&height===size.height)return;setSize({width,height});zoom.value=1;offsetX.value=0;offsetY.value=0};
 const pagePoint=(x:number,y:number):Sample=>{ 'worklet';return [(x-originX.value)/(fitWidth*zoom.value),(y-originY.value)/(fitWidth*zoom.value),0.5]};
 const endStroke=(points:Sample[])=>{if(!points.length)return;if(tool==='eraser'){const hits=new Set<string>();for(const p of points)for(const s of content.elements)if(strokeHit(s,p[0],p[1],eraserSize))hits.add(s.id);if(hits.size)onChange({v:2,elements:content.elements.filter(s=>!hits.has(s.id))});return}
  const stroke=makeStroke(points,{tool:tool==='highlighter'?'highlighter':'pen',...brush},Crypto.randomUUID(),content.elements.length);
  onChange({v:2,elements:[...content.elements,stroke]});
 };
 const notify=(active:boolean)=>onDrawingActive?.(active);
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
  draft.value=pts.map((v,i)=>`${i===0?'M':'L'}${v[0]} ${v[1]}`).join(' ');
 }).onEnd(()=>{
  if(!blocked.value&&tool!=='hand'&&samples.value.length){runOnJS(endStroke)(samples.value)}
  samples.value=[];draft.value='';drawing.value=false;runOnJS(notify)(false);
 }).onFinalize(()=>{samples.value=[];draft.value='';drawing.value=false;blocked.value=false}).runOnJS(false);
 const pinch=Gesture.Pinch().onBegin(()=>{blocked.value=true;samples.value=[];draft.value='';drawing.value=false;baseZoom.value=zoom.value;baseX.value=offsetX.value;baseY.value=offsetY.value}).onUpdate(e=>{
  const z=Math.max(minZoom,Math.min(5,baseZoom.value*e.scale));
  const [x,y]=clamp(z,baseX.value,baseY.value);zoom.value=z;offsetX.value=x;offsetY.value=y;
 }).onEnd(()=>{blocked.value=true}).runOnJS(false);
 const doubleTap=Gesture.Tap().numberOfTaps(2).onEnd(()=>{
  const z=zoom.value===1?fitAll/fitWidth:zoom.value<1?2:1;
  zoom.value=z;offsetX.value=0;offsetY.value=0;
 });
 const gestures=Gesture.Simultaneous(pan,pinch,doubleTap);
 const paper=paperColor==='krem'?'#FFF5DF':'#FFFFFF',line='#D8DFEE';
 const templateLines=useMemo(()=>{const items:{x1:number;y1:number;x2:number;y2:number}[]=[];if(template==='çizgili'||template==='kareli')for(let y=56;y<PAGE_HEIGHT;y+=42)items.push({x1:0,y1:y,x2:PAGE_WIDTH,y2:y});if(template==='kareli')for(let x=42;x<PAGE_WIDTH;x+=42)items.push({x1:x,y1:0,x2:x,y2:PAGE_HEIGHT});return items},[template]);
 const view:[number,number,number,number]=[-PAGE_WIDTH,-PAGE_HEIGHT,PAGE_WIDTH*2,PAGE_HEIGHT*2];
 return <View onLayout={layout} style={{flex:1,overflow:'hidden'}}>
 <GestureDetector gesture={gestures}><View style={{flex:1}}><Canvas style={{flex:1}}>
 <Group transform={transform}>
 <Rect x={0} y={0} width={PAGE_WIDTH} height={PAGE_HEIGHT} color={paper}/>
 {templateLines.map((l,i)=><Line key={i} p1={vec(l.x1,l.y1)} p2={vec(l.x2,l.y2)} color={line} strokeWidth={1.2}/>)}
 {template==='noktalı'&&Array.from({length:Math.floor(PAGE_HEIGHT/42)*Math.floor(PAGE_WIDTH/42)},(_,i)=>{const cols=Math.floor(PAGE_WIDTH/42);return <Circle key={i} cx={(i%cols)*42+21} cy={Math.floor(i/cols)*42+21} r={1.5} color={line}/>})}
 <Completed content={content} view={view}/>
 <Path path={draft} color={brush.color} opacity={tool==='highlighter'?0.35:brush.opacity} style="stroke" strokeWidth={tool==='highlighter'?brush.width*5:brush.width} strokeCap="round" strokeJoin="round"/>
 </Group></Canvas></View></GestureDetector></View>;
}
