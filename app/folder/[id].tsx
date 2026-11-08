import { useState } from 'react';
import { router,useLocalSearchParams } from 'expo-router';
import { ArrowLeft,MoreHorizontal } from 'lucide-react-native';
import { Alert,Pressable,SafeAreaView,ScrollView,Text,View,useWindowDimensions } from 'react-native';
import { NotebookCard } from '@/components/NotebookCard';
import { FolderEditorSheet } from '@/components/FolderEditorSheet';
import { folderRepository } from '@/db/repositories/folderRepository';
import { useNotebookStore } from '@/store/notebookStore';
import { useTheme } from '@/theme/ThemeProvider';
import { sortNotebooks } from '@/utils/notebook';
export default function FolderDetail(){
 const {id}=useLocalSearchParams<{id:string}>();const {colors}=useTheme(),folders=useNotebookStore(s=>s.folders),notebooks=useNotebookStore(s=>s.notebooks),sortBy=useNotebookStore(s=>s.sortBy),viewMode=useNotebookStore(s=>s.viewMode),refresh=useNotebookStore(s=>s.refreshFolders);
 const [editing,setEditing]=useState(false);const folder=folders.find(f=>f.id===id);const title=id==='all'?'Tüm defterler':id==='none'?'Klasörsüz':folder?.name??'Klasör';
 const list=sortNotebooks(notebooks.filter(n=>id==='all'||(id==='none'?!n.folderId:n.folderId===id)),sortBy);
 const {width}=useWindowDimensions(),columns=viewMode==='grid'?Math.max(2,Math.min(4,Math.floor((width-40+20)/170))):1,cardWidth=(width-40-(columns-1)*20)/columns;
 const erase=()=>{if(!folder)return;Alert.alert('Klasörü sil','Bu klasör silinecek. İçindeki defterler silinmez, Klasörsüz\'e taşınır.',[{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:async()=>{try{await folderRepository.remove(folder.id);await refresh();router.back()}catch{Alert.alert('Hata','Klasör silinemedi')}}}])};
 const options=()=>Alert.alert(title,'Klasör işlemleri',[{text:'Yeniden adlandır',onPress:()=>setEditing(true)},{text:'Sil',style:'destructive',onPress:erase},{text:'Vazgeç',style:'cancel'}]);
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{height:66,flexDirection:'row',alignItems:'center',paddingHorizontal:12}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable><Text numberOfLines={1} style={{flex:1,fontSize:20,fontWeight:'700',color:colors.ink,textAlign:'center'}}>{title}</Text>{folder?<Pressable accessibilityRole="button" accessibilityLabel="Klasör seçenekleri" onPress={options} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><MoreHorizontal color={colors.ink}/></Pressable>:<View style={{width:44}}/>}</View><ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:60}}><Text style={{color:colors.muted,marginBottom:18}}>{list.length} defter</Text>{list.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:20}}>{list.map(n=><View key={n.id} style={{width:cardWidth}}><NotebookCard notebook={n} width={cardWidth} viewMode={viewMode} onOpen={()=>router.push({pathname:'/note/[id]',params:{id:n.id}})} onOptions={()=>router.push({pathname:'/notebook-editor',params:{id:n.id}})}/></View>)}</View>:<Text style={{color:colors.muted,textAlign:'center',marginTop:90}}>Bu klasörde henüz defter yok</Text>}</ScrollView><FolderEditorSheet key={folder?.id} visible={editing} initialName={folder?.name??''} onClose={()=>setEditing(false)} onSave={async name=>{if(folder){await folderRepository.rename(folder.id,name);await refresh()}}}/></SafeAreaView>
}
