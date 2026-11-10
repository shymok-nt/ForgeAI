import {Skia,PaintStyle,StrokeCap,StrokeJoin} from '@shopify/react-native-skia';
import type {InkLine} from '@/lib/ink/grouping';

const cache=new Map<string,string>();
const MAX_DIMENSION=1200;
const PADDING=18;
const keyFor=(line:InkLine)=>JSON.stringify(line.words.flatMap(w=>w.strokes.map(s=>[s.points,s.width,s.bbox])));
const endpoint=()=>((process.env.EXPO_PUBLIC_API_URL??'').trim().replace(/\/$/,'')||'')+'/api/recognize';

function renderLine(line:InkLine):string{
 const [left,top,right,bottom]=line.bbox;
 const naturalWidth=Math.max(1,right-left),naturalHeight=Math.max(1,bottom-top);
 const scale=Math.min(3,(MAX_DIMENSION-2*PADDING)/Math.max(naturalWidth,naturalHeight));
 const width=Math.max(64,Math.ceil(naturalWidth*scale+PADDING*2));
 const height=Math.max(64,Math.ceil(naturalHeight*scale+PADDING*2));
 const surface=Skia.Surface.MakeOffscreen(width,height);
 if(!surface)throw new Error('Satır görüntüsü oluşturulamadı.');
 const canvas=surface.getCanvas();
 canvas.clear(Skia.Color('#FFFFFF'));
 const paint=Skia.Paint();paint.setColor(Skia.Color('#000000'));paint.setStyle(PaintStyle.Stroke);paint.setStrokeCap(StrokeCap.Round);paint.setStrokeJoin(StrokeJoin.Round);
 const yOffset=(height-naturalHeight*scale)/2;
 for(const stroke of line.words.flatMap(w=>w.strokes)){
  const pts=stroke.points;if(pts.length<3)continue;
  const x=(pts[0]-left)*scale+PADDING,y=(pts[1]-top)*scale+yOffset;
  paint.setStrokeWidth(Math.max(1,stroke.width*scale));
  if(pts.length===3){const dot=Skia.Paint();dot.setColor(Skia.Color('#000000'));canvas.drawCircle(x,y,Math.max(1,stroke.width*scale/2),dot);continue}
  const commands=[`M ${x} ${y}`];
  for(let i=3;i+2<pts.length;i+=3)commands.push(`L ${(pts[i]-left)*scale+PADDING} ${(pts[i+1]-top)*scale+yOffset}`);
  const path=Skia.Path.MakeFromSVGString(commands.join(' '));if(path)canvas.drawPath(path,paint);
 }
 const png=surface.makeImageSnapshot().encodeToBase64();
 if(!png)throw new Error('Satır PNG görüntüsü oluşturulamadı.');
 return png;
}

export async function recognizeLines(lines:InkLine[]):Promise<string[]>{
 if(!lines.length)return [];
 const keys=lines.map(keyFor);
 const missing:number[]=[];const seen=new Set<string>();
 keys.forEach((key,i)=>{if(!cache.has(key)&&!seen.has(key)){seen.add(key);missing.push(i)}});
 if(missing.length){
  const base=(process.env.EXPO_PUBLIC_API_URL??'').trim();
  if(!base)throw new Error('Tanıma sunucusu ayarlanmamış. EXPO_PUBLIC_API_URL değerini girin.');
  const images:string[]=[];
  for(let i=0;i<missing.length;i++){images.push(renderLine(lines[missing[i]]));if((i+1)%4===0)await new Promise<void>(resolve=>setTimeout(resolve,0))}
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
  let response:Response;
  try{response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({images,lang:'tr'}),signal:controller.signal})}
  catch{throw new Error('El yazısı tanıma sunucusuna bağlanılamadı. Sunucuyu ve bağlantıyı kontrol edin.')}
  finally{clearTimeout(timeout)}
  if(!response.ok)throw new Error('El yazısı tanıma başarısız ('+response.status+'). Orijinal yazı korundu.');
  let payload:unknown;try{payload=await response.json()}catch{throw new Error('Tanıma sunucusundan geçersiz JSON geldi.')}
  const linesResult=(payload as {lines?:unknown})?.lines;
  if(!Array.isArray(linesResult)||linesResult.length!==missing.length||!linesResult.every(v=>typeof v==='string'&&v.trim()))throw new Error('Tanıma sonucu eksik veya geçersiz. Orijinal yazı korundu.');
  missing.forEach((i,j)=>cache.set(keys[i],(linesResult[j] as string).trim()));
  while(cache.size>250){const first=cache.keys().next().value;if(first===undefined)break;cache.delete(first)}
 }
 return keys.map(k=>cache.get(k)??'');
}
