import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { NoteGrid } from '@/components/NoteGrid';
import { NoteActions } from '@/components/NoteActions';
import { useNotesStore } from '@/store/notesStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Note } from '@/types/note';
export default function FavoritesScreen(){const notes=useNotesStore(s=>s.notes).filter(n=>n.favorite).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));const [selected,setSelected]=useState<Note|null>(null);return <SafeAreaView style={styles.safe}><View style={styles.body}><Text style={styles.heading}>Favoriler</Text><Text style={styles.count}>{notes.length} not</Text><NoteGrid notes={notes} onOpen={id=>router.push({pathname:'/note/[id]',params:{id}})} onOptions={setSelected}/></View><NoteActions note={selected} onClose={()=>setSelected(null)}/></SafeAreaView>}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.background},body:{flex:1,paddingHorizontal:20},heading:{fontFamily:fonts.heading,fontSize:32,color:colors.ink,marginTop:24},count:{fontFamily:fonts.body,fontSize:13,color:colors.muted,marginTop:8,marginBottom:20}});
