import {Skia,PaintStyle,StrokeCap,StrokeJoin} from '@shopify/react-native-skia';
import type {InkWord} from '@/lib/ink/grouping';

const cache=new Map<string,string>();
const MAX_CACHE=300;
const MAX_DIMENSION=768;
const PADDING=12;
const MIN_HEIGHT=64;
const keyFor=(word:InkWord)=>JSON.stringify(word.strokes.map(s=>[s.points,s.width,s.bbox]));
const apiUrl=()=>process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/,'')??'';

function wordToPng(word:InkWord):string{
 const [left,top,right,bottom]=word.bbox;
 const naturalWidth=Math.max(1,right-left),naturalHeight=Math.max(1,bottom-top);
 const scale=Math.min(3,(MAX_DIMENSION-2*PADDING)/Math.max(naturalWidth,naturalHeight));
 const width=Math.max(32,Math.ceil(naturalWidth*scale+PADDING*2));
 const height=Math.max(MIN_HEIGHT,Math.ceil(naturalHeight*scale+PADDING*2));
 const surface=Skia.Surface.MakeOffscreen(width,height);
 if(!surface)throw new Error('Görüntü oluşturulamadı. Lütfen tekrar deneyin.');
 const canvas=surface.getCanvas();
 canvas.clear(Skia.Color('#FFFFFF'));
 const paint=Skia.Paint();
 paint.setColor(Skia.Color('#000000'));
 paint.setStyle(PaintStyle.Stroke);
 paint.setStrokeCap(StrokeCap.Round);
 paint.setStrokeJoin(StrokeJoin.Round);
 for(const stroke of word.strokes){
  const points=stroke.points;
  if(points.length<3)continue;
  const x=(points[0]-left)*scale+PADDING;
  const y=(points[1]-top)*scale+(height-naturalHeight*scale)/2;
  const commands=[`M ${x} ${y}`];
  for(let i=3;i+2<points.length;i+=3){
   commands.push(`L ${(points[i]-left)*scale+PADDING} ${(points[i+1]-top)*scale+(height-naturalHeight*scale)/2}`);
  }
  paint.setStrokeWidth(Math.max(1,stroke.width*scale));
  if(points.length===3){const dot=Skia.Paint();dot.setColor(Skia.Color('#000000'));canvas.drawCircle(x,y,Math.max(1,stroke.width*scale/2),dot)}
  else {
   const path=Skia.Path.MakeFromSVGString(commands.join(' '));
   if(path)canvas.drawPath(path,paint);
  }
 }
 const snapshot=surface.makeImageSnapshot();
 const encoded=snapshot.encodeToBase64();
 if(!encoded)throw new Error('PNG görüntüsü oluşturulamadı.');
 return encoded;
}

export async function recognizeWords(words:InkWord[],lang='tr'):Promise<string[]>{
 if(!words.length)return [];
 const keys=words.map(keyFor);
 const missing:number[]=[];
 const seen=new Set<string>();
 keys.forEach((key,index)=>{if(!cache.has(key)&&!seen.has(key)){missing.push(index);seen.add(key)}});
 if(missing.length){
  const url=apiUrl();
  if(!url)throw new Error('El yazısı tanıma servisi ayarlanmamış. EXPO_PUBLIC_API_URL değerini kontrol edin.');
  const images:string[]=[];
  for(let i=0;i<missing.length;i++){
   images.push(wordToPng(words[missing[i]]));
   if((i+1)%8===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
  }
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),30000);
  let response:Response;
  try{
   response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,lang}),signal:controller.signal});
  }catch{throw new Error('Tanıma servisine bağlanılamadı. İnternet bağlantınızı kontrol edin.')}
  finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error('Tanıma servisi hata verdi ('+response.status+'). Lütfen tekrar deneyin.');
  let payload:unknown;
  try{payload=await response.json()}catch{throw new Error('Tanıma servisinden geçersiz yanıt alındı.')}
  const result=payload as {words?:unknown};
  if(!Array.isArray(result?.words)||result.words.length!==missing.length||!result.words.every(w=>typeof w==='string'))throw new Error('Tanıma sonucu beklenen biçimde değil.');
  missing.forEach((index,i)=>{const value=(result.words as string[])[i].trim();cache.set(keys[index],value)});
  while(cache.size>MAX_CACHE){const first=cache.keys().next().value;if(first===undefined)break;cache.delete(first)}
 }
 return keys.map(key=>cache.get(key)??'');
}
