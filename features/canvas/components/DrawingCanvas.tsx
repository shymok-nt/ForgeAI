import React,{memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {View,PixelRatio,Platform,TextInput,BackHandler,Keyboard,Animated,Text,type LayoutChangeEvent} from 'react-native';
import {Canvas,Group,Path,Rect,Line,Circle,Image as SkiaImage,Skia,vec,Paragraph,useFonts,TextAlign} from '@shopify/react-native-skia';
import {Gesture,GestureDetector,PointerType} from 'react-native-gesture-handler';
import {Inter_400Regular,Inter_700Bold} from '@expo-google-fonts/inter';
import {useSettingsStore} from '@/store/settingsStore';
import {useDerivedValue,useSharedValue,runOnJS} from 'react-native-reanimated';
import * as Crypto from 'expo-crypto';
import {PAGE_WIDTH,PAGE_HEIGHT,type PageContent,type StrokeElement,type TextElement} from '@/features/canvas/types';
import {makeStroke,strokePath} from '@/features/canvas/engine/geometry';
import {pixelErase} from '@/features/canvas/engine/pixelEraser';
import {recognizeShape} from '@/features/canvas/engine/recognizeShape';
import {shapePath,makeShape,lassoSelect,moveElement,scaleElement,rotateElement} from '@/features/canvas/engine/shapes';
import type {ShapeMode,Element} from '@/features/canvas/types';
import type {PageTemplate,PaperColor} from '@/types/notebook';
export type Tool='pen'|'highlighter'|'eraser'|'hand'|'select'|'shape'|'text';
export type Brush={color:string;width:number;opacity:number};
type Sample=[number,number,number];
type Props={content:PageContent;template:PageTemplate;paperColor:PaperColor;tool:Tool;brush:Brush;eraserSize:number;eraserMode?:'pixel'|'stroke';onChange:(next:PageContent)=>void;onDrawingActive?:(active:boolean)=>void;shapeKind?:ShapeMode;shapeFill?:boolean;onSelectionChange?:(ids:string[])=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color'|'textStyle';value?:number;color?:string;textStyle?:Partial<Pick<TextElement,'fontSize'|'color'|'bold'|'align'>>;version:number};transformMode?:boolean;onImageSelectionChange?:(id:string|null)=>void;imageAction?:{kind:'grow'|'shrink'|'delete';version:number};textStyle?:{fontSize:number;color:string;bold:boolean;align:'left'|'center'|'right'}};
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
 const path=element.type==='stroke'?strokePath(element):element.type==='shape'?shapePath(element):Skia.Path.Make();
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
const InlineTextEditor=memo(function InlineTextEditor({item,left,top,scale,onCommit,onValueChange,onMove}:{item:TextElement;left:number;top:number;scale:number;onCommit:(value:string)=>void;onValueChange:(value:string)=>void;onMove:(dx:number,dy:number)=>void}){
 const [value,setValue]=useState(item.text);
 const [typing,setTyping]=useState(false);
 const [measuredHeight,setMeasuredHeight]=useState(0);
 const valueRef=useRef(value);valueRef.current=value;
 const done=useRef(false);
 const commit=()=>{if(done.current)return;done.current=true;onCommit(valueRef.current)};
 const drag=useRef(new Animated.ValueXY()).current;
 const moveRef=useRef(onMove);moveRef.current=onMove;
 const previousPosition=useRef({x:item.x,y:item.y});
 const dragCommitted=useRef(false);
 // Preserve the preview until React has committed the new page coordinates.
 // Resetting on gesture release caused a one-frame flash at the old position.
 useLayoutEffect(()=>{
  if(previousPosition.current.x!==item.x||previousPosition.current.y!==item.y){
   previousPosition.current={x:item.x,y:item.y};
   drag.setValue({x:0,y:0});
  }
 },[item.x,item.y,drag]);
 const hold=useMemo(()=>Gesture.Pan().minPointers(1).maxPointers(1).minDistance(12).enabled(!typing)
  .onStart(()=>{dragCommitted.current=false;drag.setValue({x:0,y:0})})
  .onUpdate(e=>{drag.setValue({x:e.translationX,y:e.translationY})})
  .onEnd(e=>{if(Math.hypot(e.translationX,e.translationY)>=12){dragCommitted.current=true;moveRef.current(e.translationX,e.translationY)}})
  .onFinalize(()=>{if(!dragCommitted.current)drag.setValue({x:0,y:0})})
  .runOnJS(true),[drag,typing]);
 const tap=useMemo(()=>Gesture.Tap().maxDuration(250).maxDistance(8).numberOfTaps(1).enabled(!typing).onEnd(()=>setTyping(true)).runOnJS(true),[]);
 const textGesture=useMemo(()=>Gesture.Exclusive(hold,tap),[hold,tap]);
 const blankDrag=useMemo(()=>Gesture.Pan().minPointers(1).maxPointers(1).minDistance(8)
  .onStart(()=>{dragCommitted.current=false;drag.setValue({x:0,y:0})})
  .onUpdate(e=>drag.setValue({x:e.translationX,y:e.translationY}))
  .onEnd(e=>{if(Math.hypot(e.translationX,e.translationY)>=8){dragCommitted.current=true;moveRef.current(e.translationX,e.translationY)}})
  .onFinalize(()=>{if(!dragCommitted.current)drag.setValue({x:0,y:0})}).runOnJS(true),[drag]);
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{commit();return true});return()=>sub.remove()},[]);
 const lineHeight=item.fontSize*1.3*scale;
 const minHeight=Math.max(48,lineHeight*3+8);
 const inputHeight=Math.max(lineHeight+4,measuredHeight+4);
 const blankHeight=Math.max(0,minHeight-inputHeight-2);
 const longest=Math.max(0,...value.split('\n').map(line=>line.length));
 const width=Math.max(72,item.w*scale,Math.min((PAGE_WIDTH-item.x)*scale,longest*item.fontSize*scale*0.58+16));
 return <GestureDetector gesture={textGesture}><Animated.View style={{position:'absolute',left,top,width,minHeight:Math.max(minHeight,measuredHeight+8),borderWidth:1,borderColor:'#90959E',borderRadius:0,backgroundColor:'transparent',transform:drag.getTranslateTransform()}}>
  {typing?<><TextInput multiline autoFocus scrollEnabled={false} value={value} onChangeText={next=>{setValue(next);onValueChange(next)}} onContentSizeChange={e=>setMeasuredHeight(e.nativeEvent.contentSize.height)} onBlur={()=>setTyping(false)} underlineColorAndroid="transparent" style={{width:'100%',height:inputHeight,fontSize:item.fontSize*scale,lineHeight,fontFamily:item.bold?'Inter_700Bold':'Inter_400Regular',textAlign:item.align,color:item.color,backgroundColor:'transparent',padding:0,paddingHorizontal:3,textAlignVertical:'top'}}/>{blankHeight>8&&<GestureDetector gesture={blankDrag}><View style={{height:blankHeight,width:'100%',backgroundColor:'transparent'}}/></GestureDetector>}</>:
   <Text style={{minHeight:minHeight-4,paddingHorizontal:3,fontSize:item.fontSize*scale,lineHeight,color:item.color,fontFamily:item.bold?'Inter_700Bold':'Inter_400Regular',textAlign:item.align}}>{value}</Text>}
 </Animated.View></GestureDetector>;
});
const paragraphAlign=(align:TextElement['align']):TextAlign=>align==='center'?TextAlign.Center:align==='right'?TextAlign.Right:TextAlign.Left;
const textLayoutCache=new Map<string,{paragraph:ReturnType<ReturnType<typeof Skia.ParagraphBuilder.Make>['build']>;height:number}>();
const TextLayer=memo(function TextLayer({element,fonts}:{element:TextElement;fonts:ReturnType<typeof useFonts>}){
 const key=[element.id,element.text,element.fontSize,element.w,element.bold,element.align,element.color].join('|');
 const layout=useMemo(()=>{
  if(!fonts)return null;
  const cached=textLayoutCache.get(key);if(cached)return cached;
  const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(element.align)},fonts);
  builder.pushStyle({fontFamilies:[element.bold?'InterBold':'Inter'],fontSize:element.fontSize,color:Skia.Color(element.color)});
  builder.addText(element.text);builder.pop();
  const paragraph=builder.build();paragraph.layout(element.w);
  const result={paragraph,height:paragraph.getHeight()};
  textLayoutCache.set(key,result);
  if(textLayoutCache.size>400){const first=textLayoutCache.keys().next().value;if(first)textLayoutCache.delete(first)}
  return result;
 },[key,fonts]);
 return layout?<Paragraph paragraph={layout.paragraph} x={element.x} y={element.y} width={element.w}/>:null;
});
const StrokeLayer=memo(function StrokeLayer({element}:{element:Element}){
 const path=useMemo(()=>cachedPath(element),[element]);
 if(element.type==='text')return null;
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
const PageImageLayer=memo(function PageImageLayer({item}:{item:import('@/features/canvas/types').PageImage}){
 // Gallery images are persisted as data URLs. useImage expects a URI/source,
 // not a Skia Data object; decode encoded bytes directly on both native and web.
 const image=useMemo(()=>{
  try{
   const encoded=item.uri.includes(',')?item.uri.slice(item.uri.indexOf(',')+1):'';
   if(!encoded)return null;
   const data=Skia.Data.fromBase64(encoded);
   return Skia.Image.MakeImageFromEncoded(data);
  }catch(error){
   console.warn('Notex: image decode failed',error);
   return null;
  }
 },[item.uri]);
 return image?<SkiaImage image={image} x={item.x} y={item.y} width={item.width} height={item.height} fit="contain"/>:null;
});
const Completed=memo(function Completed({content,hiddenIds,fonts}:{content:PageContent;hiddenIds?:string[];fonts:ReturnType<typeof useFonts>}){
 return <>{content.elements.filter(element=>!hiddenIds?.includes(element.id)).map(element=>element.type==='text'?<TextLayer key={element.id} element={element} fonts={fonts}/>:<StrokeLayer key={element.id} element={element}/>)}</>;
});
export function DrawingCanvas({content,template,paperColor,tool,brush,eraserSize,eraserMode='pixel',onChange,onDrawingActive,shapeKind='auto',shapeFill=false,onSelectionChange,selectionAction,transformMode=false,onImageSelectionChange,imageAction,textStyle={fontSize:48,color:'#1B1B2F',bold:false,align:'left'}}:Props){
 const interFonts=useFonts({Inter:[Inter_400Regular],InterBold:[Inter_700Bold]});
 const [editing,setEditing]=useState<TextElement|null>(null);
 const [,setKeyboardLayoutTick]=useState(0);

 const editingRef=useRef<TextElement|null>(null);

 const editValueRef=useRef('');
 const finishText=()=>{
  const current=editingRef.current;if(!current)return;
  editingRef.current=null;setEditing(null);
  const value=editValueRef.current;
   const longest=Math.max(0,...value.split('\n').map(line=>line.length));
   const width=Math.max(current.w,Math.min(PAGE_WIDTH-current.x,longest*current.fontSize*0.58+16));
  const lines=value.split('\n');
  const charsPerLine=Math.max(1,Math.floor(width/(current.fontSize*0.55)));
  const lineCount=lines.reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/charsPerLine)),0);
  let height=Math.max(current.fontSize*1.25,lineCount*current.fontSize*1.25);
  if(interFonts&&value.trim()){
   const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(current.align)},interFonts);
   builder.pushStyle({fontFamilies:[current.bold?'InterBold':'Inter'],fontSize:current.fontSize,color:Skia.Color(current.color)});
   builder.addText(value);builder.pop();
   const paragraph=builder.build();paragraph.layout(width);
   height=Math.max(current.fontSize*1.25,paragraph.getHeight());
  }
  const next={...current,w:width,text:value,bbox:[current.x,current.y,current.x+width,current.y+height] as [number,number,number,number]};
  const elements=content.elements.filter(e=>e.id!==current.id);
  if(value.trim())elements.push(next);
  if(value.trim()||content.elements.some(e=>e.id===current.id))onChange({...content,elements});
 };
 const finishRef=useRef(finishText);finishRef.current=finishText;
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(!editingRef.current)return false;finishRef.current();return true});return()=>sub.remove()},[]);
 const beginText=(x:number,y:number)=>{
   if(editingRef.current){finishRef.current();return;}
  const hit=[...content.elements].reverse().find(e=>e.type==='text'&&x>=e.bbox[0]&&x<=e.bbox[2]&&y>=e.bbox[1]&&y<=e.bbox[3]) as TextElement|undefined;
  const current=hit??{id:Crypto.randomUUID(),type:'text' as const,z:content.elements.length,createdAt:new Date().toISOString(),x,y,w:Math.max(120,Math.min(360,PAGE_WIDTH-x)),text:'',fontSize:textStyle.fontSize,color:textStyle.color,bold:textStyle.bold,align:textStyle.align,bbox:[x,y,x+Math.max(120,Math.min(360,PAGE_WIDTH-x)),y+textStyle.fontSize*1.3*3] as [number,number,number,number]};
  editingRef.current=current;editValueRef.current=current.text;setEditing(current);
 };
 const penSettings=useSettingsStore(state=>state.penSettings);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const selectedRef=useRef<string[]>([]);selectedRef.current=selectedIds;
 const [imageId,setImageId]=useState<string|null>(null);
 const imageIdRef=useRef<string|null>(null);imageIdRef.current=imageId;
 useEffect(()=>{if(!imageAction||!imageIdRef.current)return;const id=imageIdRef.current;
  if(imageAction.kind==='delete'){onChange({...content,images:(content.images??[]).filter(i=>i.id!==id)});setImageId(null);onImageSelectionChange?.(null);return;}
  const factor=imageAction.kind==='grow'?1.2:1/1.2;
  onChange({...content,images:(content.images??[]).map(i=>i.id!==id?i:{...i,width:Math.max(50,Math.min(PAGE_WIDTH*2,i.width*factor)),height:Math.max(50,Math.min(PAGE_HEIGHT*2,i.height*factor))})});
 },[imageAction?.version]);
 useEffect(()=>{if(!selectionAction)return;const ids=new Set(selectedRef.current);if(!ids.size)return;let next:Element[]=content.elements;
 if(selectionAction.kind==='delete')next=next.filter(e=>!ids.has(e.id));
 if(selectionAction.kind==='duplicate')next=[...next,...next.filter(e=>ids.has(e.id)).map(e=>({...moveElement(e,20,20),id:e.id+'-copy-'+selectionAction.version,z:next.length+1}))];
 if(selectionAction.kind==='move')next=next.map(e=>ids.has(e.id)?moveElement(e,selectionAction.value??20,selectionAction.value??20):e);
 if(selectionAction.kind==='scale')next=next.map(e=>ids.has(e.id)?scaleElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??1.1,selectionAction.value??1.1):e);
 if(selectionAction.kind==='rotate')next=next.map(e=>ids.has(e.id)?rotateElement(e,(e.bbox[0]+e.bbox[2])/2,(e.bbox[1]+e.bbox[3])/2,selectionAction.value??Math.PI/12):e);
 if(selectionAction.kind==='color')next=next.map(e=>ids.has(e.id)?e.type==='stroke'||e.type==='text'?{...e,color:selectionAction.color??e.color}:{...e,stroke:{...e.stroke,color:selectionAction.color??e.stroke.color}}:e);
 if(selectionAction.kind==='textStyle'&&selectionAction.textStyle)next=next.map(e=>{if(!ids.has(e.id)||e.type!=='text')return e;const updated={...e,...selectionAction.textStyle};let height=Math.max(updated.fontSize*1.25,e.bbox[3]-e.bbox[1]);if(interFonts){const builder=Skia.ParagraphBuilder.Make({textAlign:paragraphAlign(updated.align)},interFonts);builder.pushStyle({fontFamilies:[updated.bold?'InterBold':'Inter'],fontSize:updated.fontSize,color:Skia.Color(updated.color)});builder.addText(updated.text);builder.pop();const paragraph=builder.build();paragraph.layout(updated.w);height=Math.max(updated.fontSize*1.25,paragraph.getHeight())}return {...updated,bbox:[updated.x,updated.y,updated.x+updated.w,updated.y+height] as [number,number,number,number]};});
 if(next!==content.elements){onChange(withHeight(next));if(selectionAction.kind==='delete'){setSelectedIds([]);onSelectionChange?.([])}}
 },[selectionAction?.version]);
 const [size,setSize]=useState({width:300,height:450});
 const fitWidth=Math.max(0.01,size.width/PAGE_WIDTH);
 const pageHeight=Math.max(PAGE_HEIGHT,content.h??PAGE_HEIGHT,Math.ceil(size.height/fitWidth));
 const withHeight=(elements:Element[],minimum=pageHeight):PageContent=>({v:2,elements,images:content.images,h:Math.max(pageHeight,minimum)});
 const fitAll=Math.max(0.01,Math.min(fitWidth,size.height/pageHeight));
 const minZoom=1;
 const zoom=useSharedValue(1),offsetX=useSharedValue(0),offsetY=useSharedValue(0);
 useEffect(()=>{const adjust=(event:{endCoordinates:{height:number}})=>{const item=editingRef.current;if(!item)return;const scale=fitWidth*zoom.value;const estimatedBottom=offsetY.value+(item.bbox[3]+32)*scale;const visibleBottom=Math.max(80,size.height-event.endCoordinates.height);if(estimatedBottom>visibleBottom){offsetY.value-=estimatedBottom-visibleBottom;setKeyboardLayoutTick(v=>v+1)}};const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',adjust);return()=>show.remove()},[size.height,fitWidth]);
 const awaitingCommit=useSharedValue(false);
 const cursorX=useSharedValue(0),cursorY=useSharedValue(0),cursorOn=useSharedValue(false);
 const eraserWidth=useDerivedValue(()=>eraserSize*1.2/(fitWidth*zoom.value));
 const eraserRadius=useDerivedValue(()=>eraserWidth.value/2);
 const cursorOpacity=useDerivedValue(()=>cursorOn.value?0.6:0);
 const draft=useSharedValue(''),baseZoom=useSharedValue(1),baseX=useSharedValue(0),baseY=useSharedValue(0),pinchX=useSharedValue(0),pinchY=useSharedValue(0);
 const pinchPageX=useSharedValue(0),pinchPageY=useSharedValue(0);
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
 // Keep the preview pose until the final shape is mounted on release.
 const selectionPreviewLive=useSharedValue(false);
 const transformActive=useSharedValue(false),transformPending=useSharedValue(false);
 const [handoff,setHandoff]=useState<{elements:Element[];bounds:readonly [number,number,number,number];rotation:number;dx:number;dy:number;scale:number;angle:number}|null>(null);
 const pendingHandoff=useRef(false);
 const rotateActive=useSharedValue(false),pinchActive=useSharedValue(false);
 const gestureFocalX=useSharedValue(0),gestureFocalY=useSharedValue(0);
 const gestureCenterX=useSharedValue(0),gestureCenterY=useSharedValue(0);

 const selectedElements=useMemo(()=>content.elements.filter(e=>selectedIds.includes(e.id)),[content,selectedIds]);
 // Freeze the selected Skia paths for the entire selection session.
 // Saving a gesture updates document data, NOT the visible path tree.
 const selectionKey=selectedIds.join('|');
 const frozenSelection=useRef<{key:string;elements:Element[];frame:ReturnType<typeof selectionFrame>}|null>(null);
 if(!frozenSelection.current||frozenSelection.current.key!==selectionKey){
  frozenSelection.current={key:selectionKey,elements:selectedElements,frame:selectionFrame(selectedElements)};
 }
 const paintedElements=frozenSelection.current.elements;
 const paintedFrame=frozenSelection.current.frame;
 const committedDX=useSharedValue(0),committedDY=useSharedValue(0);
 const committedScale=useSharedValue(1),committedAngle=useSharedValue(0);
 const resetPaintedTransform=()=>{
  committedDX.value=0;committedDY.value=0;
  committedScale.value=1;committedAngle.value=0;
  dragX.value=0;dragY.value=0;gestureScale.value=1;gestureAngle.value=0;
 };
 useLayoutEffect(()=>{resetPaintedTransform();},[selectionKey,tool]);

 // Only retain a handoff while it represents the same selection.
 const handoffMatchesSelection=!!handoff&&handoff.elements.length===selectedIds.length&&
  handoff.elements.every(e=>selectedIds.includes(e.id));

 // Use the same committed baseline for drawing, hit-testing and the next edit.
 // Parent content can arrive a render later than the locally committed handoff.
 const baselineElements=handoffMatchesSelection?handoff!.elements:selectedElements;
 const selectedFrame=useMemo(()=>selectionFrame(selectedElements),[selectedElements]);
 // Use the same geometry for gesture hit-testing, transform center and rendering.
 // A retained handoff is the current visible baseline until another commit.
 const selectedBounds=handoffMatchesSelection?handoff!.bounds:(selectedFrame?.bounds??null);
 const selectedRotation=handoffMatchesSelection?handoff!.rotation:(selectedFrame?.rotation??0);
 // Match the actual painted outline rather than an arbitrary 10-unit
 // gap. Scaling the shared Group now keeps the frame flush with the stroke.
 const selectionPadding=Math.max(0,...baselineElements.map(e=>e.type==='shape'?e.stroke.width/2:0));
 const selectionPaddingValue=useSharedValue(0);
 useEffect(()=>{selectionPaddingValue.value=selectionPadding;},[selectionPadding]);
 const selectedRotationValue=useSharedValue(0);
 useEffect(()=>{selectedRotationValue.value=selectedRotation;},[selectedRotation]);
 // As soon as persisted geometry arrives, the handoff draws that geometry
 // instead of re-projecting the old path. This prevents stale-size flashes.
 // The handoff always contains the FINAL geometry, never an old path.
 // Switching between old and new paths was the source of the release flash.
 const handoffBounds=handoffMatchesSelection?handoff!.bounds:null;
 const handoffRotation=handoffMatchesSelection?handoff!.rotation:0;
 // The frame and shape share exactly one live Group transform.
 // Avoid double-scaling the frame on the first gesture.
 const selectionBoundsValue=useSharedValue<readonly [number,number,number,number]|null>(null);
 useEffect(()=>{selectionBoundsValue.value=selectedBounds;},[selectedBounds]);
 const dragTransform=useDerivedValue(()=>[{translateX:dragX.value},{translateY:dragY.value}]);
 // A fixed-length transform keeps Skia's animated property binding intact
 // for the first and every subsequent gesture.
 const paintedCenterX=paintedFrame?(paintedFrame.bounds[0]+paintedFrame.bounds[2])/2:0;
 const paintedCenterY=paintedFrame?(paintedFrame.bounds[1]+paintedFrame.bounds[3])/2:0;
 const selectionTransform=useDerivedValue(()=>[
  {translateX:committedDX.value+dragX.value+gestureDX.value},
  {translateY:committedDY.value+dragY.value+gestureDY.value},
  {translateX:paintedCenterX},
  {translateY:paintedCenterY},
  {rotate:committedAngle.value+gestureAngle.value},
  {scale:committedScale.value*gestureScale.value},
  {translateX:-paintedCenterX},
  {translateY:-paintedCenterY}
 ]);
 const deleteSelectedImage=()=>{const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).filter(i=>i.id!==id)});setImageId(null);onImageSelectionChange?.(null);setDisplayImageId(null);paintedImageIdRef.current=null;};
 const selectAt=(x:number,y:number)=>{
  const image=[...(content.images??[])].reverse().find(i=>{const cx=i.x+i.width/2,cy=i.y+i.height/2,a=-(i.rotation??0),dx=x-cx,dy=y-cy,px=dx*Math.cos(a)-dy*Math.sin(a)+cx,py=dx*Math.sin(a)+dy*Math.cos(a)+cy;return px>=i.x&&px<=i.x+i.width&&py>=i.y&&py<=i.y+i.height});
  if(image){setImageId(image.id);onImageSelectionChange?.(image.id);setSelectedIds([]);onSelectionChange?.([]);return;}
  setImageId(null);onImageSelectionChange?.(null);
  const margin=16/fitWidth;
  const hit=[...content.elements].reverse().find(e=>x>=e.bbox[0]-margin&&x<=e.bbox[2]+margin&&y>=e.bbox[1]-margin&&y<=e.bbox[3]+margin);
  if(hit){if(!selectedRef.current.includes(hit.id)){resetPaintedTransform();setHandoff(null);}setSelectedIds([hit.id]);onSelectionChange?.([hit.id]);}
 };
 const commitSelectionMove=(dx:number,dy:number)=>{
  if(Math.hypot(dx,dy)<0.1)return;
  const ids=new Set(selectedRef.current);
  if(!ids.size)return;
  const b=selectedBounds;
  if(!b)return;
  const baseline=new Map(baselineElements.map(e=>[e.id,e]));
  const next=content.elements.map(e=>ids.has(e.id)?moveElement(baseline.get(e.id)??e,dx,dy):e);
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
  const baseline=new Map(baselineElements.map(e=>[e.id,e]));
  const next=content.elements.map(e=>{
   if(!ids.has(e.id))return e;
   let out=baseline.get(e.id)??e;
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
  // The painted geometry stays frozen; the UI worklet has already folded
  // this gesture into its accumulated transform before the JS commit.
  dragPending.value=false;
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
  if(tool==='pen'&&penSettings.pressureEnabled&&points.some(p=>p[2]!==0.5))stroke.renderMode='outline';
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
 const imageDragging=useSharedValue(false),imageDX=useSharedValue(0),imageDY=useSharedValue(0);
 const imageGestureLocked=useSharedValue(false);
 const imagePinching=useSharedValue(false),imageScale=useSharedValue(1),imageAngle=useSharedValue(0),imageRotateActive=useSharedValue(false),imagePinchActive=useSharedValue(false);
 const imageFocalX=useSharedValue(0),imageFocalY=useSharedValue(0),imageFocalDX=useSharedValue(0),imageFocalDY=useSharedValue(0);
 const imageBounds=useSharedValue<[number,number,number,number]|null>(null);
 const imagePaintBounds=useSharedValue<[number,number,number,number]|null>(null);
 const imageRotateHandle=useSharedValue(false),imageRotateStart=useSharedValue(0);
 const imageCorner=useSharedValue(false),imageCornerStart=useSharedValue(1),imageCornerX=useSharedValue(0),imageCornerY=useSharedValue(0);
 const imageCornerAnchorX=useSharedValue(0),imageCornerAnchorY=useSharedValue(0),imageCornerSignX=useSharedValue(1),imageCornerSignY=useSharedValue(1);
 const imageCommittedX=useSharedValue(0),imageCommittedY=useSharedValue(0),imageCommittedScale=useSharedValue(1),imageCommittedAngle=useSharedValue(0);
 const imageHandoff=useRef(false);
 // Keep the selected image's rendered geometry frozen until the Skia preview
 // and persisted geometry can be reconciled together, like shape selection.
 const [paintedImage,setPaintedImage]=useState<import('@/features/canvas/types').PageImage|null>(null);
 const paintedImageRef=useRef<import('@/features/canvas/types').PageImage|null>(null);
 paintedImageRef.current=paintedImage;
 
 const imageTransform=useDerivedValue(()=>{const b=imagePaintBounds.value,cx=b?(b[0]+b[2])/2:0,cy=b?(b[1]+b[3])/2:0;return [{translateX:imageCommittedX.value+imageDX.value+imageFocalDX.value},{translateY:imageCommittedY.value+imageDY.value+imageFocalDY.value},{translateX:cx},{translateY:cy},{rotate:imageCommittedAngle.value+imageAngle.value},{scale:imageCommittedScale.value*imageScale.value},{translateX:-cx},{translateY:-cy}]});
 // Selection chrome is drawn inside the scaled image group. Compensate for
 // image scale so the blue outline and corner handles stay visually constant.
 // Keep the rotation handle on the UI thread; never read a shared value during React render.
 const imageRotateY=useDerivedValue(()=>{const b=imagePaintBounds.value;return b?b[1]-48/Math.max(0.001,imageCommittedScale.value):0;});
 const imageRotatePoint=useDerivedValue(()=>{const b=imagePaintBounds.value;return vec(b?(b[0]+b[2])/2:0,imageRotateY.value);});
 const imageHandleScale=useDerivedValue(()=>1/Math.max(0.001,imageCommittedScale.value*imageScale.value));
 const imageOutlineWidth=useDerivedValue(()=>3*imageHandleScale.value);
 const imageHandleRadius=useDerivedValue(()=>9*imageHandleScale.value);
 const imageDeleteRadius=useDerivedValue(()=>30*imageHandleScale.value);
 const imageDeleteStroke=useDerivedValue(()=>3*imageHandleScale.value);
 const commitImagePinch=(dx:number,dy:number,scale:number,angle:number)=>{imageHandoff.current=true;const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).map(i=>{if(i.id!==id)return i;const w=Math.max(40,i.width*scale),h=Math.max(40,i.height*scale);return {...i,x:i.x+(i.width-w)/2+dx,y:i.y+(i.height-h)/2+dy,width:w,height:h,rotation:(i.rotation??0)+angle}})})};
 const finishImagePinch=()=>{'worklet';const dx=imageFocalDX.value,dy=imageFocalDY.value,scale=imageScale.value,angle=imageAngle.value;imagePinching.value=false;imageCommittedX.value+=dx;imageCommittedY.value+=dy;imageCommittedScale.value*=scale;imageCommittedAngle.value+=angle;imageFocalDX.value=0;imageFocalDY.value=0;imageScale.value=1;imageAngle.value=0;if(Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001)runOnJS(commitImagePinch)(dx,dy,scale,angle)};
 const commitImageMove=(dx:number,dy:number)=>{imageHandoff.current=true;const id=imageIdRef.current;if(!id)return;onChange({...content,images:(content.images??[]).map(i=>i.id===id?{...i,x:i.x+dx,y:i.y+dy}:i)})};
 // Update the selection origin and retire the UI-thread preview in the same
 // layout commit as the persisted image geometry. A later passive effect
 // would shift the transform origin one frame after the image was repainted.
 // Like the proven shape-selection fix, keep one immutable Skia image
 // throughout selection. Repainting updated image geometry and resetting the
 // UI-thread transform in separate frames caused the visible release jitter.
 // Only reset the preview when a DIFFERENT image is selected/deselected.
 const paintedImageIdRef=useRef<string|null>(null);
 const [displayImageId,setDisplayImageId]=useState<string|null>(null);
 useLayoutEffect(()=>{
  const current=(content.images??[]).find(x=>x.id===imageId);
  imageBounds.value=current?[current.x,current.y,current.x+current.width,current.y+current.height]:null;
  // Deselecting must only remove the handles. Switching from the frozen
  // Skia baseline to persisted geometry on that tap caused a visible jump.
  if(imageId===null)return;
  if(paintedImageIdRef.current===imageId)return;
  paintedImageIdRef.current=imageId;
  setDisplayImageId(imageId);
  imageHandoff.current=false;
  imageCommittedX.value=0;imageCommittedY.value=0;
  imageCommittedScale.value=1;imageCommittedAngle.value=0;
  imageDX.value=0;imageDY.value=0;imageScale.value=1;imageAngle.value=0;
  imagePaintBounds.value=current?[current.x,current.y,current.x+current.width,current.y+current.height]:null;
  setPaintedImage(current??null);
 },[imageId,content.images]);
 const pan=Gesture.Pan().minDistance(0).onTouchesDown(e=>{
  if(e.allTouches.length>1){blocked.value=true;imageDragging.value=false;imageDX.value=0;imageDY.value=0;samples.value=[];draft.value='';drawing.value=false}
 }).onBegin(e=>{
  if(e.numberOfPointers!==1||imageGestureLocked.value)return;
  const isStylus=e.pointerType===PointerType.STYLUS;
  if((penSettings.stylusOnly||!penSettings.fingerDraw)&&!isStylus&&['pen','highlighter','eraser','shape'].includes(tool)&&!imageBounds.value){blocked.value=true;samples.value=[];draft.value='';drawing.value=false;return;}
  // A previous two-finger gesture must not disable the next one-finger drag.
  blocked.value=false;
  startX.value=e.x;startY.value=e.y;downTime.value=Date.now();
  if(tool==='hand'){baseX.value=offsetX.value;baseY.value=offsetY.value;return}
  if(imageBounds.value&&imagePaintBounds.value){
   // Hit-test the actually painted image, not the persisted rectangle.
   // The painted geometry is frozen to prevent jitter, so after a pinch
   // the old rectangle no longer matches the image on screen.
   const p=pagePoint(e.x,e.y),bounds=imagePaintBounds.value;
   const cx=(bounds[0]+bounds[2])/2,cy=(bounds[1]+bounds[3])/2;
   const scale=Math.max(0.001,imageCommittedScale.value*imageScale.value);
   const angle=(paintedImageRef.current?.rotation??0)+imageCommittedAngle.value+imageAngle.value;
   const cos=Math.cos(angle),sin=Math.sin(angle);
   const dx=(p[0]-cx-imageCommittedX.value-imageDX.value)/scale;
   const dy=(p[1]-cy-imageCommittedY.value-imageDY.value)/scale;
   const lx=cx+dx*cos+dy*sin,ly=cy-dx*sin+dy*cos;
   const radius=24/(fitWidth*zoom.value)/scale;
   if(Platform.OS==='web'&&Math.hypot(lx-(cx),ly-(bounds[1]-48/scale))<radius){imageRotateHandle.value=true;imageRotateStart.value=Math.atan2(p[1]-cy-imageCommittedY.value,p[0]-cx-imageCommittedX.value);imageAngle.value=0;samples.value=[];drawing.value=false;draft.value='';return;}
   if(Platform.OS==='web'){
    const corners:[[number,number],[number,number],[number,number],[number,number]]=[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[0],bounds[3]],[bounds[2],bounds[3]]];
    for(const [hx,hy] of corners){
     if(Math.hypot(lx-hx,ly-hy)>radius)continue;
     const anchorX=hx===bounds[0]?bounds[2]:bounds[0],anchorY=hy===bounds[1]?bounds[3]:bounds[1];
     imageCorner.value=true;imageCornerAnchorX.value=anchorX;imageCornerAnchorY.value=anchorY;
     imageCornerSignX.value=hx===bounds[0]?-1:1;imageCornerSignY.value=hy===bounds[1]?-1:1;
     // Capture the pointer and the CURRENT painted corner. Using the old
     // untransformed corner made the first update snap the image smaller.
     const vx=(hx-cx)*scale,vy=(hy-cy)*scale;
     const cornerDX=vx*cos-vy*sin,cornerDY=vx*sin+vy*cos;
     imageCornerStart.value=Math.max(1,Math.hypot(cornerDX,cornerDY));
     imageCornerX.value=p[0];imageCornerY.value=p[1];imageScale.value=1;
     samples.value=[];drawing.value=false;draft.value='';blocked.value=false;
     return;
    }
   }
   if(lx>=bounds[0]&&lx<=bounds[2]&&ly>=bounds[1]&&ly<=bounds[3]){imageDragging.value=true;imageDX.value=0;imageDY.value=0;samples.value=[];drawing.value=false;draft.value='';return;}
   // While an image is selected, a missed image hit must never fall
   // through to the pen. Tapping outside can still deselect the image.
   samples.value=[];drawing.value=false;draft.value='';return;
  }
  // Drag an already selected element immediately; don't wait for a long press.
  // The previous zero-distance Pan gesture prevented LongPress from reliably activating.
  if(tool==='select'&&selectionBoundsValue.value){
   const p=pagePoint(e.x,e.y),b=selectionBoundsValue.value;
   const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   const cornerRadius=22/(fitWidth*zoom.value);
   const rotation=selectedRotationValue.value,cos=Math.cos(rotation),sin=Math.sin(rotation);
   const corners:[[number,number],[number,number],[number,number],[number,number]]=[
    [b[0]-selectionPaddingValue.value,b[1]-selectionPaddingValue.value],[b[2]+selectionPaddingValue.value,b[1]-selectionPaddingValue.value],[b[0]-selectionPaddingValue.value,b[3]+selectionPaddingValue.value],[b[2]+selectionPaddingValue.value,b[3]+selectionPaddingValue.value]
   ].map(([x,y])=>[cx+(x-cx)*cos-(y-cy)*sin,cy+(x-cx)*sin+(y-cy)*cos]) as [[number,number],[number,number],[number,number],[number,number]];
   let cornerHit=false;
   for(const corner of corners){
    if(Math.hypot(p[0]-corner[0],p[1]-corner[1])<=cornerRadius){
     cornerHit=true;
     selectionPreviewLive.value=true;
     cornerActive.value=true;cornerMode.value=0;
     cornerCenterX.value=cx;cornerCenterY.value=cy;
     cornerStartX.value=corner[0];cornerStartY.value=corner[1];
     cornerStartPageX.value=p[0];cornerStartPageY.value=p[1];
     cornerStartRadius.value=Math.max(1,Math.hypot(corner[0]-cx,corner[1]-cy));
     cornerStartAngle.value=Math.atan2(p[1]-cy,p[0]-cx);
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
    selectionPreviewLive.value=true;
    draggingSelection.value=true;dragX.value=0;dragY.value=0;
    samples.value=[];drawing.value=false;draft.value='';
    return;
   }
  }
  if(tool==='text'){samples.value=[];drawing.value=false;draft.value='';blocked.value=false;return;}
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
  if(imageRotateHandle.value){const p=pagePoint(e.x,e.y),b=imagePaintBounds.value;if(!b)return;const cx=(b[0]+b[2])/2+imageCommittedX.value,cy=(b[1]+b[3])/2+imageCommittedY.value;imageAngle.value=Math.atan2(p[1]-cy,p[0]-cx)-imageRotateStart.value;return;}
  if(imageCorner.value){
   const p=pagePoint(e.x,e.y),b=imagePaintBounds.value;if(!b)return;
   const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;
   const totalAngle=(paintedImageRef.current?.rotation??0)+imageCommittedAngle.value;
   const cos=Math.cos(totalAngle),sin=Math.sin(totalAngle);
   const vx=imageCornerSignX.value*(b[2]-b[0])/2;
   const vy=imageCornerSignY.value*(b[3]-b[1])/2;
   const ux=(vx*cos-vy*sin)/Math.max(1,Math.hypot(vx,vy));
   const uy=(vx*sin+vy*cos)/Math.max(1,Math.hypot(vx,vy));
   const movement=(p[0]-imageCornerX.value)*ux+(p[1]-imageCornerY.value)*uy;
   // Relative pointer movement starts at scale 1, even after repeated
   // resizes and rotations. Keep the frozen Skia baseline for no jitter.
   imageScale.value=Math.max(0.15,Math.min(8,1+movement/imageCornerStart.value));
   return;
  }
  if(imageDragging.value){imageDX.value=e.translationX/(fitWidth*zoom.value);imageDY.value=e.translationY/(fitWidth*zoom.value);return}
  if(blocked.value||imageBounds.value)return;
  if(tool==='hand'){const [x,y]=clamp(zoom.value,baseX.value+e.translationX,baseY.value+e.translationY);offsetX.value=x;offsetY.value=y;return}
  if(cornerActive.value){
   const p=pagePoint(e.x,e.y),cx=cornerCenterX.value,cy=cornerCenterY.value;
   const dx=p[0]-cornerStartPageX.value,dy=p[1]-cornerStartPageY.value;
   const startX=cornerStartX.value-cx,startY=cornerStartY.value-cy;
   const tangent=(-startY*dx+startX*dy)/cornerStartRadius.value;
   const radial=(startX*dx+startY*dy)/cornerStartRadius.value;
   // Decide the gesture after a small screen-space movement, without an 8px dead zone.
   if(cornerMode.value===0&&Math.hypot(dx,dy)>2/(fitWidth*zoom.value))
    cornerMode.value=Math.abs(tangent)>Math.abs(radial)*1.25?2:1;
   if(cornerMode.value===1){
    // Relative projection ensures scale starts at exactly 1 under the pointer.
    gestureScale.value=Math.max(0.15,Math.min(8,1+radial/cornerStartRadius.value));
    gestureAngle.value=0;
   }else if(cornerMode.value===2){
    // Measure against the initial pointer angle, not the handle center.
    // This prevents the first-frame jump when grabbing off-center.
    const startAngle=Math.atan2(cornerStartPageY.value-cy,cornerStartPageX.value-cx);
    const angle=Math.atan2(p[1]-cy,p[0]-cx);
    let delta=angle-startAngle;
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    gestureAngle.value=delta;gestureScale.value=1;
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
  if(e.pointerType===PointerType.STYLUS&&penSettings.pressureEnabled&&e.stylusData){
   const pressure=Math.max(0.05,Math.min(1,e.stylusData.pressure??0.5));
   p[2]=Math.max(0.05,Math.min(1,0.5+(pressure-0.5)*penSettings.pressureSensitivity));
  }
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
  if(imageRotateHandle.value){const angle=imageAngle.value;imageRotateHandle.value=false;imageCommittedAngle.value+=angle;imageAngle.value=0;if(Math.abs(angle)>0.0001)runOnJS(commitImagePinch)(0,0,1,angle);return;}
  if(imageCorner.value){const scale=imageScale.value;imageCorner.value=false;imageCommittedScale.value*=scale;imageScale.value=1;if(Math.abs(scale-1)>0.0001)runOnJS(commitImagePinch)(0,0,scale,0);return;}
  if(imageDragging.value){const dx=imageDX.value,dy=imageDY.value;imageDragging.value=false;imageDX.value=0;imageDY.value=0;if(!imagePinching.value&&Math.hypot(dx,dy)>0.1){imageCommittedX.value+=dx;imageCommittedY.value+=dy;runOnJS(commitImageMove)(dx,dy);}return;}
  if(cornerActive.value){
   const scale=gestureScale.value,angle=gestureAngle.value;
   cornerActive.value=false;cornerMode.value=0;
   if(!blocked.value&&(Math.abs(scale-1)>0.0001||Math.abs(angle)>0.0001)){
    transformPending.value=true;
    committedScale.value*=scale;
    committedAngle.value+=angle;
    gestureScale.value=1;gestureAngle.value=0;
    runOnJS(commitGesture)(0,0,scale,angle);
   }else {gestureScale.value=1;gestureAngle.value=0;selectionPreviewLive.value=false}
   runOnJS(notify)(false);return;
  }
  if(draggingSelection.value){
   const dx=dragX.value,dy=dragY.value;
   draggingSelection.value=false;
   if(!blocked.value&&Math.hypot(dx,dy)>0.1){committedDX.value+=dx;committedDY.value+=dy;dragX.value=0;dragY.value=0;runOnJS(commitSelectionMove)(dx,dy);}
   else {dragX.value=0;dragY.value=0}
   drawing.value=false;
   runOnJS(notify)(false);return;
  }
  if(!imageBounds.value&&!blocked.value&&tool!=='hand'&&drawing.value&&samples.value.length){awaitingCommit.value=true;runOnJS(complete)(samples.value)}
  samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;cursorOn.value=false;runOnJS(notify)(false);
 }).onFinalize(()=>{samples.value=[];if(!awaitingCommit.value)draft.value='';drawing.value=false;blocked.value=false;cursorOn.value=false;draggingSelection.value=false;cornerActive.value=false;if(!dragPending.value&&!draggingSelection.value){/* Keep the last pose until the JS handoff mounts. */}}).runOnJS(false);
 const pinch=Gesture.Pinch().onBegin(e=>{
  if(imageBounds.value){blocked.value=true;samples.value=[];draft.value='';drawing.value=false;imageGestureLocked.value=true;imagePinching.value=true;imagePinchActive.value=true;imageDragging.value=false;imageDX.value=0;imageDY.value=0;imageScale.value=1;imageFocalDX.value=0;imageFocalDY.value=0;imageFocalX.value=e.focalX;imageFocalY.value=e.focalY;return;}
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
  blocked.value=true;samples.value=[];draft.value='';drawing.value=false;
  baseZoom.value=zoom.value;baseX.value=offsetX.value;baseY.value=offsetY.value;
  pinchX.value=e.focalX;pinchY.value=e.focalY;
  pinchPageX.value=(e.focalX-originX.value)/(fitWidth*zoom.value);
  pinchPageY.value=(e.focalY-originY.value)/(fitWidth*zoom.value);
 }).onUpdate(e=>{
  if(imageGestureLocked.value){// Resize and rotate around the image's fixed center. Finger midpoint drift
   // must not translate the image; moving it is handled by the one-finger pan.
   imageScale.value=Math.max(0.15,Math.min(8,e.scale));imageFocalDX.value=0;imageFocalDY.value=0;return;}
  if(tool==='select'&&selectionBoundsValue.value){
   gestureScale.value=Math.max(0.15,Math.min(8,e.scale));
   gestureDX.value=(e.focalX-gestureFocalX.value)/(fitWidth*zoom.value);
   gestureDY.value=(e.focalY-gestureFocalY.value)/(fitWidth*zoom.value);
   return;
  }
  const z=Math.max(minZoom,Math.min(5,baseZoom.value*e.scale));
  const newWidth=PAGE_WIDTH*fitWidth*z;
  const desiredX=e.focalX-pinchPageX.value*fitWidth*z-(size.width-newWidth)/2;
  const desiredY=e.focalY-pinchPageY.value*fitWidth*z;
  const [x,y]=clamp(z,desiredX,desiredY);
  zoom.value=z;offsetX.value=x;offsetY.value=y;
 }).onEnd(()=>{
  if(imageGestureLocked.value){imagePinchActive.value=false;if(!imageRotateActive.value){finishImagePinch();imageGestureLocked.value=false;}return;}
  if(tool==='select'&&transformActive.value){
   pinchActive.value=false;
   if(!rotateActive.value){
    const dx=gestureDX.value,dy=gestureDY.value,scale=gestureScale.value,angle=gestureAngle.value;
    transformActive.value=false;
    if(Math.abs(dx)+Math.abs(dy)+Math.abs(scale-1)+Math.abs(angle)>0.0001){
     committedDX.value+=dx;committedDY.value+=dy;
     committedScale.value*=scale;committedAngle.value+=angle;
     gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;
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
  if(imageBounds.value){imageGestureLocked.value=true;imagePinching.value=true;imageRotateActive.value=true;blocked.value=true;samples.value=[];drawing.value=false;draft.value='';return;}
  if(tool==='select'&&selectionBoundsValue.value){if(!transformActive.value){gestureScale.value=1;gestureAngle.value=0;gestureDX.value=0;gestureDY.value=0;}transformActive.value=true;selectionPreviewLive.value=true;rotateActive.value=true;blocked.value=true;return;}
 }).onUpdate(e=>{
  if(imageGestureLocked.value){imageAngle.value=e.rotation;return;}
  if(tool==='select'&&transformActive.value)gestureAngle.value=e.rotation;
 }).onEnd(()=>{
  if(imageGestureLocked.value){imageRotateActive.value=false;if(!imagePinchActive.value){finishImagePinch();imageGestureLocked.value=false;}return;}
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
  if(!blocked.value){const p=pagePoint(e.x,e.y);if(tool==='text')runOnJS(beginText)(p[0],p[1]);else runOnJS(selectAt)(p[0],p[1]);}
 }).runOnJS(false);
 const gestures=Gesture.Simultaneous(pan,pinch,rotation,singleTap);

 return <View onLayout={layout} style={{flex:1,overflow:'hidden',touchAction:'none',backgroundColor:paperColor==='krem'?'#FFF5DF':'#FFFFFF'}}>
 <GestureDetector gesture={gestures}><View style={{flex:1,touchAction:'none'}}><Canvas style={{flex:1}}>
 <Group transform={transform}>
 <StaticPaper template={template} paperColor={paperColor} pageHeight={pageHeight} fitWidth={fitWidth}/>
 {(content.images??[]).map(source=>{const item=source.id===displayImageId&&paintedImage?paintedImage:source;const cx=item.x+item.width/2,cy=item.y+item.height/2;const art=<Group origin={vec(cx,cy)} transform={[{rotate:item.rotation??0}]}><PageImageLayer item={item}/>{item.id===imageId&&<><Rect x={item.x} y={item.y} width={item.width} height={item.height} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/>{Platform.OS==='web'&&<><Line p1={vec(cx,item.y)} p2={imageRotatePoint} color="#3388EE" strokeWidth={imageOutlineWidth}/><Circle cx={cx} cy={imageRotateY} r={imageHandleRadius} color="#FFFFFF"/><Circle cx={cx} cy={imageRotateY} r={imageHandleRadius} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/></>}{Platform.OS==='web'&&[[item.x,item.y],[item.x+item.width,item.y],[item.x,item.y+item.height],[item.x+item.width,item.y+item.height]].map(([x,y],index)=><Group key={index}><Circle cx={x} cy={y} r={imageHandleRadius} color="#FFFFFF"/><Circle cx={x} cy={y} r={imageHandleRadius} color="#3388EE" style="stroke" strokeWidth={imageOutlineWidth}/></Group>)}</>}</Group>;return item.id===displayImageId?<Group key={item.id} transform={imageTransform}>{art}</Group>:<Group key={item.id}>{art}</Group>})}
 <Group layer={tool==='eraser'}>
  <Completed content={content} hiddenIds={editing?[editing.id]:tool==='select'?selectedIds:undefined} fonts={interFonts}/>
  {tool==='eraser'&&<Path path={draft} blendMode="clear" color="black" style="stroke" strokeWidth={eraserWidth} strokeCap="round" strokeJoin="round"/>}
 </Group>
 {tool==='select'&&paintedFrame&&<Group transform={selectionTransform}>
  {paintedElements.map(element=>element.type==='text'?<TextLayer key={element.id} element={element} fonts={interFonts}/>:<StrokeLayer key={element.id} element={element}/>)}
  {(()=>{
   const bounds=paintedFrame.bounds;
   const rotation=paintedFrame.rotation;
   const padding=Math.max(0,...paintedElements.map(e=>e.type==='shape'?e.stroke.width/2:0));
   const x=bounds[0]-padding,y=bounds[1]-padding,w=bounds[2]-bounds[0]+2*padding,h=bounds[3]-bounds[1]+2*padding;
   return <Group origin={vec((bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2)} transform={[{rotate:rotation}]}>
    <Rect x={x} y={y} width={w} height={h} color="#3388EE" style="stroke" strokeWidth={1.5}/>

    {[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map((p,i)=><Group key={i}><Circle cx={p[0]} cy={p[1]} r={6} color="#FFFFFF"/><Circle cx={p[0]} cy={p[1]} r={6} color="#3388EE" style="stroke" strokeWidth={2}/></Group>)}
   </Group>;
  })()}
 </Group>}
 {tool!=='eraser'&&tool!=='select'&&<Path path={draft} color={brush.color} opacity={brush.opacity} blendMode={tool==='highlighter'?'multiply':'srcOver'} style="stroke" strokeWidth={brush.width} strokeCap="round" strokeJoin="round"/>}
 {tool==='eraser'&&<Circle cx={cursorX} cy={cursorY} r={eraserRadius} color="#808080" opacity={cursorOpacity} style="stroke" strokeWidth={1.5}/>}
 </Group></Canvas></View></GestureDetector>{editing&&<InlineTextEditor item={editing} left={(size.width-PAGE_WIDTH*fitWidth*zoom.value)/2+offsetX.value+editing.x*fitWidth*zoom.value} top={offsetY.value+editing.y*fitWidth*zoom.value} scale={fitWidth*zoom.value} onCommit={value=>{editValueRef.current=value;finishRef.current()}} onValueChange={value=>{editValueRef.current=value}} onMove={(dx,dy)=>{const current=editingRef.current;if(!current)return;const scale=fitWidth*zoom.value;const x=Math.max(0,Math.min(PAGE_WIDTH-current.w,current.x+dx/scale));const y=Math.max(0,current.y+dy/scale);const next={...current,x,y,bbox:[x,y,x+current.w,y+(current.bbox[3]-current.bbox[1])] as [number,number,number,number]};editingRef.current=next;setEditing(next)}}/>}</View>;
}
