const PROMPT='Bu görüntülerdeki el yazısı satırlarını aynen, sırayla, Türkçe karakterleri (ı, İ, ş, ğ, ç, ö, ü) koruyarak oku. Her görüntü için bir satır metni üret. Sadece JSON dizisi döndür; açıklama, Markdown veya başka hiçbir şey yazma.';
const MAX_IMAGES=30;
const MAX_IMAGE_LENGTH=1_500_000;

export async function POST(request:Request):Promise<Response>{
 try{
  const key=process.env.OPENAI_API_KEY;
  if(!key){console.error('[Notex API] OPENAI_API_KEY sunucuda tanımlı değil');return Response.json({error:'Tanıma sunucusu yapılandırılmamış.'},{status:503})}
  let body:unknown;
  try{body=await request.json()}catch{return Response.json({error:'Geçersiz JSON.'},{status:400})}
  const data=body as {images?:unknown;lang?:unknown};
  if(data?.lang!=='tr'||!Array.isArray(data.images)||!data.images.length||data.images.length>MAX_IMAGES||!data.images.every(v=>typeof v==='string'&&v.length<MAX_IMAGE_LENGTH&&/^[A-Za-z0-9+/=]+$/.test(v)))return Response.json({error:'Geçersiz satır görüntüleri.'},{status:400});
  const images=data.images as string[];
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',
   headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:process.env.VISION_MODEL||'gpt-4.1-mini',temperature:0,max_tokens:2000,messages:[{role:'user',content:[{type:'text',text:PROMPT},...images.map(image=>({type:'image_url',image_url:{url:'data:image/png;base64,'+image}}))]}]})
  });
  if(!response.ok){console.error('[Notex API] Vision API status',response.status);return Response.json({error:'Görsel tanıma servisi hata verdi.'},{status:502})}
  const result=await response.json() as {choices?:{message?:{content?:string|null}}[]};
  const raw=result.choices?.[0]?.message?.content?.trim()??'';
  let parsed:unknown;
  try{parsed=JSON.parse(raw)}catch{return Response.json({error:'Tanıma servisi beklenen JSON yanıtını vermedi.'},{status:502})}
  if(!Array.isArray(parsed)||parsed.length!==images.length||!parsed.every(x=>typeof x==='string'&&x.trim()))return Response.json({error:'Satır tanıma sonucu eksik.'},{status:502});
  return Response.json({lines:parsed});
 }catch(error){console.error('[Notex API] Recognition failed',error);return Response.json({error:'Tanıma işlemi tamamlanamadı.'},{status:500})}
}
