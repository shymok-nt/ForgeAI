import { router,useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable,SafeAreaView,StyleSheet,Text,View } from 'react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { useNotebookStore } from '@/store/notebookStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
export default function NoteScreen(){const {id}=useLocalSearchParams<{id:string}>();const notebook=useNotebookStore(s=>s.notebooks.find(n=>n.id===id));return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" style={styles.back} onPress={()=>router.back()}><ArrowLeft size={24} color={colors.ink}/></Pressable><Text numberOfLines={1} style={styles.title}>{notebook?.title??'Defter'}</Text><View style={styles.back}/></View><View style={styles.center}>{notebook?<><NotebookCover notebook={notebook} width={180}/><Text style={styles.name}>{notebook.title}</Text><Text style={styles.info}>Çizim alanı yakında</Text></>:<Text style={styles.info}>Defter bulunamadı</Text>}</View></SafeAreaView>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},header:{height:64,flexDirection:'row',alignItems:'center',paddingHorizontal:20},back:{width:44,height:44,justifyContent:'center'},title:{flex:1,fontFamily:fonts.headingMedium,fontSize:18,color:colors.ink,textAlign:'center'},center:{flex:1,alignItems:'center',justifyContent:'center',paddingBottom:60},name:{fontFamily:fonts.heading,fontSize:20,color:colors.ink,marginTop:28},info:{fontFamily:fonts.body,fontSize:14,color:colors.muted,marginTop:10}});
