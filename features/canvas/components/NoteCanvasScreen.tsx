import {SafeAreaView} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Modal,Pressable,ScrollView,Text,View,useWindowDimensions} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {ArrowLeft,Undo2,Redo2,Ellipsis,Eye,Palette,ChevronLeft,ChevronRight,X,Move,RotateCw,Maximize2,Copy,Trash2,Minus,Plus} from 'lucide-react-native';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/fonts';
import {useNotebookStore} from '@/store/notebookStore';
import {usePageStore} from '@/store/pageStore';
import {settingsRepository} from '@/db/repositories/settingsRepository';
import {DrawingCanvas,type Tool,type Brush} from './DrawingCanvas';
import {CanvasToolbar} from './CanvasToolbar';
import {CanvasPageStrip} from './CanvasPageStrip';
import {parseContent} from '@/features/canvas/engine/content';
import {useAutosave} from '@/features/canvas/hooks/useAutosave';
import {record,undo,redo,historyState} from '@/features/canvas/store/history';
import type {PageContent,ShapeMode} from '@/features/canvas/types';
import type {Page} from '@/types/page';
import type {PageTemplate} from '@/types/notebook';
import {useCanvasAwake} from '@/features/canvas/hooks/useCanvasAwake';
const templates:PageTemplate[]=['boş','çizgili','kareli','noktalı'];
const swatches=['#1B1B2F','#3347D9','#FF6B5A','#3E8E5A','#F2B632','#7B5CD6','#FF8BBD','#16A6B6','#FFFFFF','#6D6D6D','#F48C35','#7947AB'];
const hit={width:48,height:56,alignItems:'center' as const,justifyContent:'center' as const};
type CanvasController={back:()=>void;forward:()=>void;flush:()=>Promise<void>;canUndo:boolean;canRedo:boolean;error:boolean;saving:boolean;retry:()=>Promise<void>};
export default function NoteCanvasScreen(){
 const {colors,scheme}=useTheme();const {id}=useLocalSearchParams<{id:string}>();const {width,height}=useWindowDimensions();const tablet=width>=600||width>height;
 const notebook=useNotebookStore(s=>s.notebooks.find(n=>n.id===id));
 const pages=usePageStore(s=>s.pages),load=usePageStore(s=>s.load),add=usePageStore(s=>s.add),remove=usePageStore(s=>s.remove),move=usePageStore(s=>s.move),changeTemplate=usePageStore(s=>s.updateTemplate);
 const [selectedId,setSelectedId]=useState<string|null>(null),[tool,setTool]=useState<Tool>('pen'),[brush,setBrush]=useState<Brush>({color:'#1B1B2F',width:5,opacity:1});
 const [templatePageId,setTemplatePageId]=useState<string|null>(null);
 const [moreOpen,setMoreOpen]=useState(false);const [panel,setPanel]=useState<'tool'|'palette'|null>(null),[sheet,setSheet]=useState(false),[focus,setFocus]=useState(false),[eraserSize,setEraserSize]=useState(24),[eraserMode,setEraserMode]=useState<'pixel'|'stroke'>('pixel');
 const [controller,setController]=useState<CanvasController|null>(null);
 const [imageRequest,setImageRequest]=useState<{uri:string;width:number;height:number;version:number}|null>(null);
 const [shapeKind,setShapeKind]=useState<ShapeMode>('auto'),[shapeFill,setShapeFill]=useState(false),[ruler,setRuler]=useState(false);
 const [selectedElements,setSelectedElements]=useState<string[]>([]),[selectionAction,setSelectionAction]=useState<{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color';value?:number;color?:string;version:number}>();
 const action=(kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color',value?:number,color?:string)=>setSelectionAction({kind,value,color,version:Date.now()});
 const [recent,setRecent]=useState<string[]>([]);
 const controllerRef=useRef<CanvasController|null>(null);controllerRef.current=controller;
 useEffect(()=>{if(id){setSelectedId(null);void load(id)}},[id]);
 useEffect(()=>{let live=true;void settingsRepository.get('canvasToolSettings').then(raw=>{if(!raw||!live)return;try{const s=JSON.parse(raw) as {tool?:Tool;brush?:Brush;recent?:string[];eraserMode?:'pixel'|'stroke';eraserSize?:number};if(s.tool&&['pen','highlighter','eraser','hand'].includes(s.tool))setTool(s.tool);if(s.brush&&typeof s.brush.color==='string'&&typeof s.brush.width==='number'&&typeof s.brush.opacity==='number')setBrush(s.brush);if(Array.isArray(s.recent))setRecent(s.recent);if(s.eraserMode==='pixel'||s.eraserMode==='stroke')setEraserMode(s.eraserMode);if(typeof s.eraserSize==='number')setEraserSize(s.eraserSize)}catch{}}).catch(()=>{});return()=>{live=false}},[]);
 useEffect(()=>{void settingsRepository.set('canvasToolSettings',JSON.stringify({tool,brush,recent,eraserMode,eraserSize})).catch(()=>{})},[tool,brush,recent,eraserMode,eraserSize]);
 const selected=pages.find(p=>p.id===selectedId)??pages[0];const index=selected?pages.findIndex(p=>p.id===selected.id):0;
 const select=(pageId:string)=>{if(pageId===selected?.id)return;void controllerRef.current?.flush();setSelectedId(pageId);setController(null);setPanel(null);setSheet(false)};
 const addPage=async()=>{await controllerRef.current?.flush();const count=pages.length;await add(index);const next=usePageStore.getState().pages;if(next.length>count)select(next[Math.min(index+1,next.length-1)].id)};
 const askRemove=(pageId:string)=>{if(pages.length<=1){Alert.alert('Son sayfa','Defterin son sayfası silinemez.');return}Alert.alert('Sayfayı sil','Bu sayfa silinsin mi?',[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{await controllerRef.current?.flush();await remove(pageId);const next=usePageStore.getState().pages;if(pageId===selected?.id&&next.length)setSelectedId(next[Math.min(index,next.length-1)].id)}}])};
 const chooseTemplate=(pageId:string)=>{setTemplatePageId(pageId);};
 const pageActions=(pageId:string)=>Alert.alert('Sayfa işlemleri','İşlem seç',[{text:'Şablon',onPress:()=>chooseTemplate(pageId)},{text:'Yukarı taşı',onPress:()=>void move(pageId,Math.max(0,pages.findIndex(p=>p.id===pageId)-1))},{text:'Aşağı taşı',onPress:()=>void move(pageId,Math.min(pages.length-1,pages.findIndex(p=>p.id===pageId)+1))},{text:'Sil',style:'destructive',onPress:()=>askRemove(pageId)},{text:'Vazgeç',style:'cancel'}]);
 const more=()=>{setPanel(null);setMoreOpen(true);};
 const moreItems=[
  {label:'Şablonu değiştir',onPress:()=>selected&&chooseTemplate(selected.id)},
  {label:'Sayfa ekle',onPress:()=>void addPage()},
  {label:'Sayfalar',onPress:()=>setSheet(true)},
  {label:'Cetvel aç/kapat',onPress:()=>setRuler(v=>!v)},
  {label:'Odak modu',onPress:()=>setFocus(v=>!v)},
  {label:'Defteri düzenle',onPress:()=>router.push({pathname:'/notebook-editor',params:{id}})}
 ];

 const insertImage=async()=>{
  if(!selected)return;
  try{
   const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.65,base64:true});
   if(result.canceled||!result.assets[0])return;
   const asset=result.assets[0];
   if(!asset.base64){Alert.alert('Resim eklenemedi','Resim verisi okunamadı.');return;}
   const mime=asset.mimeType==='image/png'?'image/png':'image/jpeg';
   const ratio=Math.max(0.1,(asset.width||1)/(asset.height||1));
   const w=Math.min(650,Math.max(150,ratio*450));const h=w/ratio;
   setImageRequest({uri:`data:${mime};base64,${asset.base64}`,width:w,height:h,version:Date.now()});
  }catch{Alert.alert('Resim eklenemedi','Galeriden resim seçilirken bir hata oluştu.');}
 };
 const chooseTool=(t:Tool)=>{if(tool===t)setPanel(p=>p==='tool'?null:'tool');else{setTool(t);setPanel(null)}};
 const chooseColor=(color:string)=>{setBrush(b=>({...b,color}));setRecent(r=>[color,...r.filter(x=>x!==color)].slice(0,8))};
 const ink=colors.ink,muted=colors.muted;const backdrop=scheme==='dark'?'#0B0B10':'#EEE9DF';
 const control=(name:string,Icon:typeof ArrowLeft,onPress:()=>void,disabled=false)=> <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{disabled}} disabled={disabled} hitSlop={4} onPress={onPress} style={[hit,{opacity:disabled?0.35:1}]}><Icon size={22} color={ink}/></Pressable>;
 const undoButton=control('Geri al',Undo2,()=>controllerRef.current?.back(),!controller?.canUndo);
 const redoButton=control('Yinele',Redo2,()=>controllerRef.current?.forward(),!controller?.canRedo);
 const status=controller?.error?'Kaydedilemedi, tekrar denenecek':controller?.saving?'Kaydediliyor…':'Kaydedildi';
 const goBack=()=>{
  // The header must navigate immediately on desktop too: waiting for a
  // pending autosave can leave the arrow apparently unresponsive.
  void controllerRef.current?.flush().catch(error=>console.error('Canvas save before navigation failed:',error));
  router.replace('/(tabs)');
 };
 const heading=<View style={{flexDirection:'row',alignItems:'center',minWidth:0,flex:tablet?0:1,width:tablet?220:undefined,zIndex:10}}>
 {control('Geri dön',ArrowLeft,goBack)}
 <Pressable accessibilityRole="button" accessibilityLabel="Defteri düzenle" onPress={()=>router.push({pathname:'/notebook-editor',params:{id}})} style={{flex:1,minWidth:0,justifyContent:'center',minHeight:56}}>
 <Text numberOfLines={1} style={{fontFamily:fonts.heading,fontSize:17,color:ink}}>{notebook?.title??'Defter'}</Text>
 <Text numberOfLines={1} style={{fontFamily:fonts.body,fontSize:12,color:controller?.error?colors.coral:muted}}>{`Sayfa ${pages.length?index+1:0} / ${pages.length} · ${status}`}</Text></Pressable></View>;
 const palette=<View style={{gap:10}}><Text style={{fontFamily:fonts.semibold,color:ink}}>Renkler</Text><View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>{swatches.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={color+' renk'} accessibilityState={{selected:brush.color===color}} onPress={()=>chooseColor(color)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:color,borderWidth:brush.color===color?3:1,borderColor:brush.color===color?colors.accent:colors.border}}/></Pressable>)}</View>{recent.length>0&&<><Text style={{color:muted}}>Son kullanılanlar</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{recent.map(color=><Pressable key={color} accessibilityRole="button" accessibilityLabel={color+' son kullanılan renk'} onPress={()=>chooseColor(color)} style={hit}><View style={{width:30,height:30,borderRadius:15,backgroundColor:color,borderWidth:1,borderColor:colors.border}}/></Pressable>)}</View></>}</View>;
 const toolPanel=<View style={{gap:10}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontFamily:fonts.headingMedium,fontSize:17,color:ink}}>{tool==='pen'?'Kalem':tool==='highlighter'?'Vurgulayıcı':tool==='eraser'?'Silgi':tool==='shape'?'Şekil':'Kaydırma'}</Text><Text style={{color:muted}}>{tool==='eraser'?'Boyut':`Kalınlık ${brush.width} pt`}</Text></View>
 {tool==='shape'&&<><Text style={{color:muted,fontSize:12}}>Otomatik: çiz, bırak, düzeltsin. Diğerleri: sürükleyerek çiz.</Text><View style={{flexDirection:'row',flexWrap:'wrap'}}>{(['auto','line','arrow','rect','ellipse','triangle'] as ShapeMode[]).map(kind=>{const label=({auto:'Otomatik',line:'Çizgi',arrow:'Ok',rect:'Dikdörtgen',ellipse:'Elips',triangle:'Üçgen'} as const)[kind as 'auto'|'line'|'arrow'|'rect'|'ellipse'|'triangle'];return <Pressable key={kind} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:shapeKind===kind}} onPress={()=>setShapeKind(kind)} style={{minHeight:44,minWidth:52,paddingHorizontal:6,justifyContent:'center',backgroundColor:shapeKind===kind?colors.accent+'22':'transparent',borderRadius:10}}><Text style={{color:ink}}>{label}</Text></Pressable>})}</View><Pressable accessibilityRole="button" accessibilityLabel="Şekil dolgusu" accessibilityState={{selected:shapeFill}} onPress={()=>setShapeFill(v=>!v)} style={hit}><Text style={{color:ink}}>{shapeFill?'Dolgu açık':'Dolgu kapalı'}</Text></Pressable></>}
 {tool==='eraser'?<View style={{gap:8}}><View style={{flexDirection:'row',justifyContent:'space-around'}}>{(['pixel','stroke'] as const).map(mode=><Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode==='pixel'?'Piksel silgi':'Çizgi silgi'} accessibilityState={{selected:eraserMode===mode}} onPress={()=>setEraserMode(mode)} style={[hit,{minWidth:100,borderRadius:12,backgroundColor:eraserMode===mode?colors.accent+'22':'transparent'}]}><Text style={{color:ink}}>{mode==='pixel'?'Piksel':'Çizgi'}</Text></Pressable>)}</View><View style={{flexDirection:'row',justifyContent:'space-around'}}>{[12,24,48].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={n===12?'Küçük silgi':n===24?'Orta silgi':'Büyük silgi'} accessibilityState={{selected:eraserSize===n}} onPress={()=>setEraserSize(n)} style={[hit,{borderRadius:12,backgroundColor:eraserSize===n?colors.accent+'1F':'transparent'}]}><Text style={{color:ink}}>{n===12?'S':n===24?'M':'L'}</Text></Pressable>)}</View></View>:<><Text style={{color:muted}}>Kalınlık</Text><View style={{flexDirection:'row',justifyContent:'space-between'}}>{[2,3,5,8,12].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={n+' pt kalınlık'} accessibilityState={{selected:brush.width===n}} onPress={()=>setBrush(b=>({...b,width:n}))} style={[hit,{borderRadius:12,backgroundColor:brush.width===n?colors.accent+'1F':'transparent'}]}><Text style={{color:ink}}>{n}</Text></Pressable>)}</View>{tool==='highlighter'&&<View style={{flexDirection:'row',justifyContent:'space-between'}}>{[0.2,0.35,0.5,0.7].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={'Opaklık yüzde '+n*100} onPress={()=>setBrush(b=>({...b,opacity:n}))} style={hit}><Text style={{color:ink}}>{Math.round(n*100)}%</Text></Pressable>)}</View>}{palette}<Pressable accessibilityRole="button" accessibilityLabel="Tüm renkleri aç" onPress={()=>setPanel('palette')} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>Tüm renkler</Text></Pressable></>}</View>;
 const popover=panel&&<View style={{position:'absolute',zIndex:20,bottom:tablet?undefined:112,top:tablet?8:undefined,right:tablet?16:24,left:tablet?undefined:24,width:tablet?300:undefined,padding:16,borderRadius:20,backgroundColor:colors.surfaceRaised,shadowColor:'#000',shadowOpacity:0.15,shadowRadius:16,elevation:8}}><Pressable accessibilityRole="button" accessibilityLabel="Paneli kapat" onPress={()=>setPanel(null)} style={{alignSelf:'flex-end',width:44,height:36,alignItems:'center',justifyContent:'center'}}><X size={20} color={ink}/></Pressable>{panel==='tool'?toolPanel:palette}</View>;
 return <SafeAreaView style={{flex:1,backgroundColor:backdrop}}>
 {!focus&&<View style={{minHeight:tablet?82:80,paddingTop:10,paddingBottom:8,flexDirection:'row',alignItems:'center',paddingHorizontal:tablet?12:4,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.divider}}>
 {heading}{tablet&&<View style={{flex:1,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8}}><CanvasToolbar tablet tool={tool} colors={colors} onTool={chooseTool} onPages={()=>setSheet(true)} onImage={()=>void insertImage()}/><Pressable accessibilityRole="button" accessibilityLabel="Renk paleti" onPress={()=>setPanel(p=>p==='palette'?null:'palette')} style={[hit,{width:44}]}><View style={{width:32,height:32,borderRadius:16,backgroundColor:brush.color,borderWidth:3,borderColor:colors.border}}/></Pressable></View>}
 {undoButton}{redoButton}{control('Diğer',Ellipsis,more)}{tablet&&control('Odak modu',Eye,()=>setFocus(true))}
 </View>}
 <View style={{flex:1,flexDirection:'row'}}>
 {tablet&&!focus&&<View style={{width:132,backgroundColor:colors.background,borderRightWidth:1,borderRightColor:colors.divider}}><CanvasPageStrip tablet pages={pages} selectedId={selected?.id} colors={colors} onSelect={select} onAdd={()=>void addPage()} onRemove={askRemove} onMove={(p,i)=>void move(p,i)} onActions={pageActions}/></View>}
 <View style={{flex:1,marginHorizontal:0,marginTop:0,marginBottom:0,borderRadius:0,overflow:'hidden'}}>
 {selected?<CanvasPage key={selected.id} page={selected} tool={tool} brush={brush} eraserSize={eraserSize} eraserMode={eraserMode} onController={setController} onHistory={()=>{}} onDrawStart={()=>setPanel(null)} shapeKind={shapeKind} shapeFill={shapeFill} onSelectionChange={setSelectedElements} selectionAction={selectionAction} imageRequest={imageRequest}/>:<Text style={{color:ink}}>Sayfalar yükleniyor…</Text>}
 </View>
 <View pointerEvents="none" style={{position:'absolute',bottom:tablet?22:110,right:24,backgroundColor:'#1B1B2FBB',borderRadius:20,paddingHorizontal:12,paddingVertical:7}}><Text style={{color:'#FFFFFF',fontSize:12}}>{index+1} / {pages.length}</Text></View>
 {focus&&<Pressable accessibilityRole="button" accessibilityLabel="Araç çubuklarını göster" onPress={()=>setFocus(false)} style={{position:'absolute',top:0,left:0,right:0,height:44,alignItems:'center',justifyContent:'center'}}><Eye color={colors.accent} size={20}/></Pressable>}
 {!tablet&&!focus&&<View style={{position:'absolute',bottom:28,left:12,right:12}}><CanvasToolbar tablet={false} tool={tool} colors={colors} onTool={chooseTool} onPages={()=>setSheet(true)}/></View>}

 {ruler&&<View pointerEvents="none" style={{position:'absolute',top:'45%',left:'15%',width:'70%',height:64,backgroundColor:colors.accent+'55',borderWidth:1,borderColor:colors.accent,borderRadius:6,justifyContent:'center',alignItems:'center'}}><Text style={{color:ink}}>0°   | | | | | | | | | | | |</Text></View>}
 {popover}
 </View>
 <Modal visible={sheet} transparent animationType="slide" onRequestClose={()=>setSheet(false)}><View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}><View style={{backgroundColor:colors.surfaceRaised,borderTopLeftRadius:24,borderTopRightRadius:24,paddingBottom:28,maxHeight:height*0.65}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingTop:12}}><Text style={{fontFamily:fonts.heading,fontSize:20,color:ink}}>Sayfalar</Text>{control('Kapat',X,()=>setSheet(false))}</View><CanvasPageStrip tablet={false} pages={pages} selectedId={selected?.id} colors={colors} onSelect={select} onAdd={()=>void addPage()} onRemove={askRemove} onMove={(p,i)=>void move(p,i)} onActions={pageActions}/></View></View></Modal>
 <Modal visible={templatePageId!==null} transparent animationType="fade" onRequestClose={()=>setTemplatePageId(null)}>
 <View style={{flex:1,justifyContent:'center',paddingHorizontal:20,backgroundColor:colors.overlay}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Şablon seçimini kapat" onPress={()=>setTemplatePageId(null)} style={{position:'absolute',top:0,bottom:0,left:0,right:0}}/>
 <View style={{backgroundColor:colors.surfaceRaised,borderRadius:24,padding:20,maxWidth:520,width:'100%',alignSelf:'center',gap:16}}>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
 <View style={{gap:4,flex:1}}><Text style={{fontFamily:fonts.heading,fontSize:21,color:ink}}>Sayfa şablonu</Text><Text style={{fontFamily:fonts.body,fontSize:13,color:muted}}>Sayfan için bir görünüm seç</Text></View>
 <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={()=>setTemplatePageId(null)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X size={22} color={ink}/></Pressable>
 </View>
 <View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}>
 {templates.map(t=>{const active=pages.find(p=>p.id===templatePageId)?.template===t;return <Pressable key={t} accessibilityRole="button" accessibilityLabel={t+' sayfa şablonu'} accessibilityState={{selected:active}} onPress={()=>{const page=pages.find(p=>p.id===templatePageId);setTemplatePageId(null);if(page)void changeTemplate(page.id,t,page.paperColor)}} style={{width:'47%',flexGrow:1,gap:9,padding:10,borderRadius:16,borderWidth:active?2:1,borderColor:active?colors.accent:colors.divider,backgroundColor:active?colors.accent+'10':colors.surface}}>
 <View style={{height:112,backgroundColor:'#FFFFFF',borderRadius:9,borderWidth:1,borderColor:'#E5E6EB',overflow:'hidden',paddingHorizontal:12,paddingVertical:10,justifyContent:'space-evenly'}}>
 {t==='boş'?<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><View style={{width:35,height:2,backgroundColor:'#E7E9EF',borderRadius:2}}/></View>:t==='çizgili'?Array.from({length:7},(_,i)=><View key={i} style={{height:1,backgroundColor:'#D5DDF1'}}/>):t==='kareli'?<View style={{flex:1,justifyContent:'space-evenly'}}>{Array.from({length:7},(_,i)=><View key={i} style={{height:1,backgroundColor:'#D5DDF1'}}/>)}<View pointerEvents="none" style={{position:'absolute',top:0,bottom:0,left:0,right:0,flexDirection:'row',justifyContent:'space-evenly'}}>{Array.from({length:8},(_,i)=><View key={i} style={{width:1,backgroundColor:'#D5DDF1'}}/>)}</View></View>:<View style={{flex:1,justifyContent:'space-evenly'}}>{Array.from({length:6},(_,i)=><View key={i} style={{flexDirection:'row',justifyContent:'space-evenly'}}>{Array.from({length:7},(_,j)=><View key={j} style={{width:3,height:3,borderRadius:2,backgroundColor:'#B7C4E4'}}/>)}</View>)}</View>}
 </View>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontFamily:fonts.semibold,fontSize:15,color:ink,textTransform:'capitalize'}}>{t}</Text>{active&&<Text style={{color:colors.accent,fontSize:12,fontFamily:fonts.semibold}}>Seçili ✓</Text>}</View>
 </Pressable>})}
 </View>
 </View></View></Modal>
 <Modal visible={moreOpen} transparent animationType="fade" onRequestClose={()=>setMoreOpen(false)}>
 <View style={{flex:1,justifyContent:'flex-end',backgroundColor:colors.overlay}}>
 <Pressable accessibilityRole="button" accessibilityLabel="Menüyü kapat" onPress={()=>setMoreOpen(false)} style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
 <View style={{backgroundColor:colors.surfaceRaised,borderTopLeftRadius:22,borderTopRightRadius:22,paddingHorizontal:20,paddingTop:16,paddingBottom:32}}>
 <Text style={{fontFamily:fonts.heading,fontSize:19,color:ink,marginBottom:12}}>Diğer işlemler</Text>
 {moreItems.map(item=><Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>{setMoreOpen(false);item.onPress()}} style={{minHeight:52,justifyContent:'center',borderBottomWidth:1,borderBottomColor:colors.divider}}><Text style={{fontSize:16,color:ink}}>{item.label}</Text></Pressable>)}
 <Pressable accessibilityRole="button" accessibilityLabel="Vazgeç" onPress={()=>setMoreOpen(false)} style={{minHeight:52,justifyContent:'center'}}><Text style={{fontSize:16,color:colors.accent}}>Vazgeç</Text></Pressable>
 </View></View></Modal>
 </SafeAreaView>;
}
function CanvasPage({page,tool,brush,eraserSize,eraserMode,onController,onHistory,onDrawStart,shapeKind,shapeFill,onSelectionChange,selectionAction,imageRequest}:{page:Page;tool:Tool;brush:Brush;eraserSize:number;eraserMode:'pixel'|'stroke';onController:(value:CanvasController|null)=>void;onHistory:()=>void;onDrawStart:()=>void;shapeKind:ShapeMode;shapeFill:boolean;onSelectionChange:(ids:string[])=>void;selectionAction?:{kind:'delete'|'duplicate'|'move'|'scale'|'rotate'|'color';value?:number;color?:string;version:number};imageRequest?:{uri:string;width:number;height:number;version:number}|null}){
 useCanvasAwake();const [content,setContent]=useState<PageContent>(()=>parseContent(page.content));
 const {error,saving,retry,flush,setDrawingActive}=useAutosave(page.id,content);
 const change=(next:PageContent)=>{record(page.id,content);setContent(next);onHistory()};
 useEffect(()=>{if(!imageRequest)return;setContent(previous=>{record(page.id,previous);return {...previous,images:[...(previous.images??[]),{id:Crypto.randomUUID(),uri:imageRequest.uri,x:175,y:240,width:imageRequest.width,height:imageRequest.height}]}});onHistory()},[imageRequest?.version]);
 const back=()=>{const next=undo(page.id,content);if(next){setContent(next);onHistory()}};
 const forward=()=>{const next=redo(page.id,content);if(next){setContent(next);onHistory()}};
 const h=historyState(page.id);
 const controller:CanvasController={back,forward,flush,canUndo:h.canUndo,canRedo:h.canRedo,error,saving,retry};
 useEffect(()=>{onController(controller)},[error,saving,h.canUndo,h.canRedo]);
 useEffect(()=>()=>{void flush();onController(null)},[]);
 return <DrawingCanvas content={content} template={page.template} paperColor={page.paperColor} tool={tool} brush={tool==='highlighter'?{...brush,width:brush.width*5}:brush} eraserSize={eraserSize} eraserMode={eraserMode} onChange={change} onDrawingActive={setDrawingActive} shapeKind={shapeKind} shapeFill={shapeFill} onSelectionChange={onSelectionChange} selectionAction={selectionAction}/>;
}
