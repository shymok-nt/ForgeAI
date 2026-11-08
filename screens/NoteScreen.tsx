import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNotesStore } from '@/store/notesStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
export default function NoteScreen(){const {id}=useLocalSearchParams<{id:string}>();const note=useNotesStore(s=>s.notes.find(n=>n.id===id));return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" style={styles.back} onPress={()=>router.back()}><ArrowLeft size={24} color={colors.ink}/></Pressable><Text numberOfLines={1} style={styles.title}>{note?.title??'Not'}</Text><View style={styles.back}/></View><View style={styles.page}/></SafeAreaView>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},header:{height:64,flexDirection:'row',alignItems:'center',paddingHorizontal:20},back:{width:44,height:44,justifyContent:'center'},title:{flex:1,fontFamily:fonts.headingMedium,fontSize:18,color:colors.ink,textAlign:'center'},page:{flex:1,backgroundColor:colors.paper,margin:12,borderRadius:12}});
