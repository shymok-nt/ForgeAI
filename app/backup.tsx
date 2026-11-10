import { useState } from 'react';
import { ActivityIndicator,Alert,Platform,Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { File,Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { createBackup,inspectBackup,importBackup,webDownload } from '@/services/notexBackup';
import { settingsRepository } from '@/db/repositories/settingsRepository';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';

type Pending={bytes:Uint8Array;summary:string};
export default function BackupScreen(){
 const {colors}=useTheme();const [busy,setBusy]=useState(false),[label,setLabel]=useState(''),[percent,setPercent]=useState(0),[pending,setPending]=useState<Pending|null>(null),[error,setError]=useState('');
 const refresh=useNotebookStore(s=>s.refresh),refreshFolders=useNotebookStore(s=>s.refreshFolders);
 const progress=(text:string,value:number)=>{setLabel(text);setPercent(value)};
 const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn()}catch(e){const msg=e instanceof Error?e.message:'İşlem tamamlanamadı';setError(msg);console.error('Yedekleme hatası',e)}finally{setBusy(false)}};
 const saveAndroid=async(bytes:Uint8Array,name:string)=>{
  const permission=await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if(!permission.granted)return false;
  const destination=await LegacyFileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri,name,'application/zip');
  // SAF writes require a base64-encoded string; avoid interpreting ZIP bytes as UTF-8.
  let base64='';for(let i=0;i<bytes.length;i+=8192){const chunk=bytes.subarray(i,i+8192);base64+=String.fromCharCode(...chunk)}
  await LegacyFileSystem.writeAsStringAsync(destination,btoa(base64),{encoding:LegacyFileSystem.EncodingType.Base64});
  const saved=await LegacyFileSystem.readAsStringAsync(destination,{encoding:LegacyFileSystem.EncodingType.Base64});
  if(saved!==btoa(base64))throw new Error('Kaydedilen yedek doğrulanamadı. Lütfen başka klasör seç.');
  return true;
 };
 const create=()=>void run(async()=>{
  const bytes=await createBackup(progress);
  const date=new Date().toISOString().slice(0,10);
  // Android document providers recognize .zip reliably with application/zip.
  // The internal ZIP format remains the same as .notex backups on web.
  const name='Notex-yedek-'+date+(Platform.OS==='android'?'.zip':'.notex');
  if(Platform.OS==='web')webDownload(bytes,name);
  else if(Platform.OS==='android'){
   progress('Kaydedilecek klasörü seç…',95);
   const saved=await saveAndroid(bytes,name);
   if(!saved){setLabel('Kaydetme iptal edildi');return}
  }
  else{
   const file=new File(Paths.cache,name);
   await file.write(bytes);
   if(!await Sharing.isAvailableAsync())throw new Error('Paylaşma bu cihazda kullanılamıyor');
   // ZIP MIME lets Android/iOS file providers recognize the archive instead of a generic .bin.
   // Keep the cache file briefly after the share sheet closes: some targets read it asynchronously.
   try{await Sharing.shareAsync(file.uri,{mimeType:'application/zip',UTI:'public.zip-archive',dialogTitle:'Notex yedeğini kaydet'});}
   finally{setTimeout(()=>{try{if(file.exists)file.delete()}catch(e){console.warn('Geçici yedek temizlenemedi',e)}},60000)}
  }
  await settingsRepository.set('lastBackupAt',new Date().toISOString());
  setLabel('Yedek oluşturuldu');setPercent(100);
 });
 const pick=()=>void run(async()=>{
  const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false});
  if(result.canceled)return;
  const asset=result.assets[0];if(!asset)throw new Error('Bu dosya okunamadı');
  let bytes:Uint8Array;
  if(Platform.OS==='web'){
   if(!asset.file)throw new Error('Bu dosya okunamadı');
   bytes=new Uint8Array(await asset.file.arrayBuffer());
  }else if(Platform.OS==='android'){
   // DocumentPicker has already copied the selected document into its cache.
   // Use the legacy base64 reader for both file:// and content:// URI schemes;
   // it avoids File.bytes() permission differences between Android providers.
   try{
    const encoded=await LegacyFileSystem.readAsStringAsync(asset.uri,{encoding:LegacyFileSystem.EncodingType.Base64});
    const binary=atob(encoded);
    bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   }catch(primaryError){
    try{
     bytes=await new File(asset.uri).bytes();
    }catch(fallbackError){
     console.error('Android yedek URI:',asset.uri,'dosya:',asset.name,'boyut:',asset.size);
     console.error('Base64 okuma hatası:',primaryError,'File.bytes hatası:',fallbackError);
     throw new Error('Android seçilen dosyayı okuyamadı: '+(primaryError instanceof Error?primaryError.message:String(primaryError)));
    }
   }
   // Report actual bytes instead of incorrectly treating every read failure as a bad backup.
   const header=Array.from(bytes.subarray(0,8)).map(n=>n.toString(16).padStart(2,'0')).join(' ');
   console.info('Notex Android import',asset.name,'bytes:',bytes.length,'header:',header);
   if(bytes.length<4||bytes[0]!==80||bytes[1]!==75){
    throw new Error('Seçilen dosya ZIP içeriği taşımıyor ('+bytes.length+' bayt, ilk baytlar: '+header+'). Android üzerinde yeni oluşturulmuş .zip yedeğini seç.');
   }
  }else bytes=await new File(asset.uri).bytes();
  let manifest:Awaited<ReturnType<typeof inspectBackup>>['manifest'];
  try{({manifest}=await inspectBackup(bytes))}catch(e){console.error('Notex ZIP doğrulama hatası',e);throw new Error('ZIP okundu ancak Notex yedek yapısı doğrulanamadı: '+(e instanceof Error?e.message:String(e)))}
  setPending({bytes,summary:`${manifest.counts.notebooks} defter, ${manifest.counts.pages} sayfa, ${manifest.counts.files} resim bulundu`});
 });
 const restore=()=>{if(!pending)return;const bytes=pending.bytes;setPending(null);void run(async()=>{await importBackup(bytes,progress);await refreshFolders();await refresh();Alert.alert('Tamamlandı','Defterler mevcut verilere eklendi.')})};
 const button=(text:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={{backgroundColor:colors.surfaceRaised,borderRadius:14,padding:18,marginTop:12,opacity:(disabled||busy)?0.5:1}}><Text style={{color:colors.ink,fontSize:16,fontWeight:'600'}}>{text}</Text></Pressable>;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable><Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Yedekle ve geri yükle</Text></View><ScrollView contentContainerStyle={{padding:20}}>
  <Text style={{color:colors.muted}}>Defterler, sayfalar, çizimler ve resimler tek bir .notex dosyasına kaydedilir. Silinenler yedeğe dahil edilmez.</Text>
  {Platform.OS==='android'&&<Text style={{color:colors.muted,marginTop:12}}>Android: Yedek oluştur dediğinde kaydedilecek klasörü seç. Dosya doğrudan o klasöre yazılır; paylaşım ekranı kullanılmaz.</Text>}
  {button('Yedek oluştur',create)}{button('Yedekten geri yükle',pick)}
  {busy&&<View style={{marginTop:20,gap:10}}><ActivityIndicator color={colors.accent}/><Text style={{color:colors.ink}}>{label} %{percent}</Text><View style={{height:6,backgroundColor:colors.border,borderRadius:4}}><View style={{height:6,width:`${percent}%`,backgroundColor:colors.accent,borderRadius:4}}/></View></View>}
  {!!error&&<Text style={{color:colors.coral,marginTop:16}}>{error}</Text>}
  {pending&&<View style={{marginTop:24,padding:16,backgroundColor:colors.surfaceRaised,borderRadius:16,gap:12}}><Text style={{color:colors.ink,fontSize:17,fontWeight:'700'}}>Yedek bulundu</Text><Text style={{color:colors.ink}}>{pending.summary}</Text><Text style={{color:colors.muted}}>Mevcut verilere ekle: Hiçbir defterin üzerine yazılmaz, kopyalar oluşturulur.</Text>{button('Mevcut verilere ekle',restore)}{button('İptal',()=>setPending(null))}</View>}
 </ScrollView></SafeAreaView>;
}
