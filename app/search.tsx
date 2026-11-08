import { useEffect,useMemo,useState } from 'react';
import { router } from 'expo-router';
import { ArrowLeft,X } from 'lucide-react-native';
import { Alert,Keyboard,Pressable,SafeAreaView,ScrollView,Text,TextInput,View,useWindowDimensions } from 'react-native';
import { NotebookCard } from '@/components/NotebookCard';
import { FolderChips } from '@/components/FolderChips';
import { useNotebookStore } from '@/store/notebookStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme/ThemeProvider';
import { matchesSearch } from '@/utils/search';
import { sortNotebooks } from '@/utils/notebook';
export default function SearchScreen(){
 const {colors}=useTheme(),[query,setQuery]=useState(''),[debounced,setDebounced]=useState(''),[folder,setFolder]=useState('Tümü');
 const all=useNotebookStore(s=>s.notebooks),viewMode=useNotebookStore(s=>s.viewMode),sortBy=useNotebookStore(s=>s.sortBy);
 const toggle=useNotebookStore(s=>s.toggleFavorite),duplicate=useNotebookStore(s=>s.duplicateNotebook),remove=useNotebookStore(s=>s.deleteNotebook),move=useNotebookStore(s=>s.moveNotebook),folders=useNotebookStore(s=>s.folders);
 const recent=useSettingsStore(s=>s.recentSearches),addSearch=useSettingsStore(s=>s.addSearch),clear=useSettingsStore(s=>s.clearSearches);
 const {width}=useWindowDimensions();const columns=viewMode==='grid'?Math.max(2,Math.min(4,Math.floor((width-40+20)/170))):1;const cardWidth=(width-40-(columns-1)*20)/columns;
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(query),200);return()=>clearTimeout(timer)},[query]);
 const data=useMemo(()=>sortNotebooks(all.filter(n=>matchesSearch(n.title,debounced)&&(folder==='Tümü'||n.folder===folder)),sortBy),[all,debounced,folder,sortBy]);
 const options=(id:string)=>{const n=all.find(x=>x.id===id);if(!n)return;Alert.alert(n.title,'Defter işlemleri',[{text:'Düzenle',onPress:()=>router.push({pathname:'/notebook-editor',params:{id}})},{text:n.favorite?'Favoriden çıkar':'Favorilere ekle',onPress:()=>void toggle(id)},{text:'Klasöre taşı',onPress:()=>Alert.alert('Klasöre taşı','Hedef klasör',[{text:'Klasörsüz',onPress:()=>void move(id,null)},...folders.map(f=>({text:f.name,onPress:()=>void move(id,f.id)})),{text:'Vazgeç',style:'cancel'}])},{text:'Çoğalt',onPress:()=>void duplicate(id)},{text:'Sil',style:'destructive',onPress:()=>Alert.alert('Defteri sil','Bu defter silinsin mi?', [{text:'Vazgeç',style:'cancel'},{text:'Sil',style:'destructive',onPress:()=>void remove(id)}])},{text:'Vazgeç',style:'cancel'}])};
 const open=async(id:string)=>{Keyboard.dismiss();await addSearch(query);router.push({pathname:'/note/[id]',params:{id}})};
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingTop:12,gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center',alignItems:'center'}}><ArrowLeft color={colors.ink}/></Pressable><TextInput autoFocus accessibilityLabel="Defterlerde ara" placeholder="Defterlerde ara" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={{flex:1,height:48,backgroundColor:colors.surfaceRaised,color:colors.ink,borderRadius:12,paddingHorizontal:14}}/>{query.length>0&&<Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={()=>setQuery('')} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><X color={colors.ink}/></Pressable>}</View>
 <View style={{paddingHorizontal:20,paddingVertical:14}}><FolderChips value={folder} onChange={setFolder}/></View>
 {!query.trim()?<ScrollView contentContainerStyle={{padding:20,gap:12}}>{recent.length?<><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={{color:colors.ink,fontWeight:'700',fontSize:18}}>Son aramalar</Text><Pressable accessibilityRole="button" accessibilityLabel="Son aramaları temizle" onPress={()=>void clear()} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>Temizle</Text></Pressable></View>{recent.map(s=><Pressable key={s} accessibilityRole="button" accessibilityLabel={s+' aramasını aç'} onPress={()=>setQuery(s)} style={{minHeight:48,justifyContent:'center',borderBottomWidth:1,borderBottomColor:colors.divider}}><Text style={{color:colors.ink}}>{s}</Text></Pressable>)}</>:<Text style={{color:colors.muted,textAlign:'center',marginTop:80}}>Defter adı yazarak ara</Text>}</ScrollView>:<ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:70}}><Text style={{color:colors.muted,marginBottom:18}}>{data.length} sonuç</Text>{data.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:20}}>{data.map(n=><View key={n.id} style={{width:cardWidth}}><NotebookCard notebook={n} width={cardWidth} viewMode={viewMode} onOpen={()=>void open(n.id)} onOptions={()=>options(n.id)} highlight={debounced}/></View>)}</View>:<Text style={{color:colors.muted,textAlign:'center',marginTop:80}}>'{debounced}' için sonuç bulunamadı</Text>}</ScrollView>}
 </SafeAreaView>
}
