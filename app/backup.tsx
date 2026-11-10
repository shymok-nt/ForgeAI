import { useState } from 'react';
import { ActivityIndicator,Alert,Platform,Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { File,Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
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
 const create=()=>void run(async()=>{
  const bytes=await createBackup(progress);
  const date=new Date().toISOString().slice(0,10);
  const name='Notex-yedek-'+date+'.notex';
  if(Platform.OS==='web')webDownload(bytes,name);
  else{
   const file=new File(Paths.cache,name);
   try{file.write(bytes);if(!await Sharing.isAvailableAsync())throw new Error('Paylaşma bu cihazda kullanılamıyor');await Sharing.shareAsync(file.uri,{mimeType:'application/octet-stream',dialogTitle:'Notex yedeğini kaydet'})}
   finally{if(file.exists)file.delete()}
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
  }else bytes=await new File(asset.uri).bytes();
  const {manifest}=await inspectBackup(bytes);
  setPending({bytes,summary:`${manifest.counts.notebooks} defter, ${manifest.counts.pages} sayfa, ${manifest.counts.files} resim bulundu`});
 });
 const restore=()=>{if(!pending)return;const bytes=pending.bytes;setPending(null);void run(async()=>{await importBackup(bytes,progress);await refreshFolders();await refresh();Alert.alert('Tamamlandı','Defterler mevcut verilere eklendi.')})};
 const button=(text:string,onPress:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy} onPress={onPress} style={{backgroundColor:colors.surfaceRaised,borderRadius:14,padding:18,marginTop:12,opacity:disabled||busy?.5:1}}><Text style={{color:colors.ink,fontSize:16,fontWeight:'600'}}>{text}</Text></Pressable>;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable><Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Yedekle ve geri yükle</Text></View><ScrollView contentContainerStyle={{padding:20}}>
  <Text style={{color:colors.muted}}>Defterler, sayfalar, çizimler ve resimler tek bir .notex dosyasına kaydedilir. Silinenler yedeğe dahil edilmez.</Text>
  {button('Yedek oluştur',create)}{button('Yedekten geri yükle',pick)}
  {busy&&<View style={{marginTop:20,gap:10}}><ActivityIndicator color={colors.accent}/><Text style={{color:colors.ink}}>{label} %{percent}</Text><View style={{height:6,backgroundColor:colors.border,borderRadius:4}}><View style={{height:6,width:`${percent}%`,backgroundColor:colors.accent,borderRadius:4}}/></View></View>}
  {!!error&&<Text style={{color:colors.coral,marginTop:16}}>{error}</Text>}
  {pending&&<View style={{marginTop:24,padding:16,backgroundColor:colors.surfaceRaised,borderRadius:16,gap:12}}><Text style={{color:colors.ink,fontSize:17,fontWeight:'700'}}>Yedek bulundu</Text><Text style={{color:colors.ink}}>{pending.summary}</Text><Text style={{color:colors.muted}}>Mevcut verilere ekle: Hiçbir defterin üzerine yazılmaz, kopyalar oluşturulur.</Text>{button('Mevcut verilere ekle',restore)}{button('İptal',()=>setPending(null))}</View>}
 </ScrollView></SafeAreaView>;
}
