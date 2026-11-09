import {useMemo,useRef,useState} from 'react';
import {View,type LayoutChangeEvent} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,vec} from '@shopify/react-native-skia';
import {Gesture,GestureDetector} from 'react-native-gesture-handler';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type StrokeElement} from '@/features/canvas/types';
import {makeStroke,strokePath,strokeHit} from '@/features/canvas/engine/geometry';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand';
export type Brush={color:string;width:number;opacity:number};
type Props={content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;onChange:(next:PageContent)=>void};
export function DrawingCanvas({content,template,paperColor,tool,brush,eraserSize,onChange}:Props){
 const [size,setSize]=useState({width:300,height:450}),[draft,setDraft]=useState<number[]>([]),[zoom,setZoom]=useState(1),[offset,setOffset]=useState({x:0,y:0});
 const points=useRef<[number,number,number][]>([]),removed=useRef(new Set<string>()),start=useRef({x:0,y:0}),baseZoom=useRef(1),baseOffset=useRef({x:0,y:0});
 const fit=Math.min((size.width-24)/PAGE_WIDTH,(size.height-24)/PAGE_HEIGHT);const scale=fit*zoom;
 const originX=(size.width-PAGE_WIDTH*scale)/2+offset.x,originY=(size.height-PAGE_HEIGHT*scale)/2+offset.y;
 const toPage=(x:number,y:number):[number,number,number]=>[(x-originX)/scale,(y-originY)/scale,0.5];
 const visible=(s:StrokeElement)=>{const [l,t,r,b]=s.bbox;return r>=-originX/scale&&l<=(size.width-originX)/scale&&b>=-originY/scale&&t<=(size.height-originY)/scale};
 const paths=useMemo(()=>content.elements.map(s=>({element:s,path:strokePath(s)})),[content]);
 const draftPath=useMemo(()=>draft.length?strokePath(makeStroke(Array.from({length:draft.length/3},(_,i)=>[draft[i*3],draft[i*3+1],draft[i*3+2]] as [number,number,number]),{tool:tool==='highlighter'?'highlighter':'pen',...brush},'draft',0)):null,[draft,brush,tool]);
 const layout=(e:LayoutChangeEvent)=>setSize({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height});
 const pan=Gesture.Pan().minDistance(0).onBegin(e=>{if(tool==='hand'){start.current={x:e.x,y:e.y};baseOffset.current=offset;return}points.current=[toPage(e.x,e.y)];removed.current=new Set();setDraft(points.current.flat())}).onUpdate(e=>{
  if(tool==='hand'){setOffset({x:baseOffset.current.x+e.translationX,y:baseOffset.current.y+e.translationY});return}
  const point=toPage(e.x,e.y);points.current.push(point);if(tool==='eraser'){const hits=content.elements.filter(s=>strokeHit(s,point[0],point[1],eraserSize));hits.forEach(s=>removed.current.add(s.id))}else setDraft(points.current.flat());
 }).onEnd(()=>{
  if(tool==='hand')return;
  if(tool==='eraser'){if(removed.current.size)onChange({v:2,elements:content.elements.filter(s=>!removed.current.has(s.id))})}
  else if(points.current.length){const stroke=makeStroke(points.current,{tool:tool==='highlighter'?'highlighter':'pen',...brush},Crypto.randomUUID(),content.elements.length);onChange({v:2,elements:[...content.elements,stroke]})}
  points.current=[];setDraft([]);
 }).runOnJS(true);
 const pinch=Gesture.Pinch().onBegin(()=>{baseZoom.current=zoom;points.current=[];setDraft([])}).onUpdate(e=>setZoom(Math.min(5,Math.max(0.5,baseZoom.current*e.scale)))).runOnJS(true);
 const paper=paperColor==='krem'?'#FFF5DF':'#FFFFFF';const line='#D8DFEE';
 const templateLines=useMemo(()=>{const items:{x1:number;y1:number;x2:number;y2:number}[]=[];if(template==='çizgili'||template==='kareli')for(let y=56;y<PAGE_HEIGHT;y+=42)items.push({x1:0,y1:y,x2:PAGE_WIDTH,y2:y});if(template==='kareli')for(let x=42;x<PAGE_WIDTH;x+=42)items.push({x1:x,y1:0,x2:x,y2:PAGE_HEIGHT});return items},[template]);
 return <View onLayout={layout} style={{flex:1,overflow:'hidden'}}>
 <GestureDetector gesture={Gesture.Simultaneous(pan,pinch)}><View style={{flex:1}}>
 <Canvas style={{flex:1}}><Group transform={[{translateX:originX},{translateY:originY},{scale}]}>
 <Rect x={0} y={0} width={PAGE_WIDTH} height={PAGE_HEIGHT} color={paper}/>
 {templateLines.map((l,i)=><Line key={i} p1={vec(l.x1,l.y1)} p2={vec(l.x2,l.y2)} color={line} strokeWidth={1.2}/>)}
 {template==='noktalı'&&Array.from({length:Math.floor(PAGE_HEIGHT/42)*Math.floor(PAGE_WIDTH/42)},(_,i)=>{const cols=Math.floor(PAGE_WIDTH/42);return <Circle key={i} cx={(i%cols)*42+21} cy={Math.floor(i/cols)*42+21} r={1.5} color={line}/>})}
 {paths.filter(p=>visible(p.element)).sort((a,b)=>(a.element.tool==='highlighter'?0:1)-(b.element.tool==='highlighter'?0:1)).map(({element,path})=><Path key={element.id} path={path} color={element.color} opacity={element.opacity} blendMode={element.tool==='highlighter'?'multiply':'srcOver'}/>)}
 {draftPath&&<Path path={draftPath} color={brush.color} opacity={brush.opacity} blendMode={tool==='highlighter'?'multiply':'srcOver'}/>}
 </Group></Canvas></View></GestureDetector></View>
}
