import { ScrollView,Pressable,Text,StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { FolderFilter } from '@/types/notebook';
import { useNotebookStore } from '@/store/notebookStore';

export function FolderChips({value,onChange,includeAll=true}:{value:FolderFilter;onChange:(value:FolderFilter)=>void;includeAll?:boolean}){
 const {colors,scheme}=useTheme();
 const styles=makeStyles(colors,scheme);
 const available=useNotebookStore(s=>s.folders).map(f=>f.name as FolderFilter);
 const folders:FolderFilter[]=includeAll?['Tümü',...available,'Klasörsüz']:['Klasörsüz',...available];
 return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
  {folders.map(folder=><Pressable key={folder} accessibilityRole="button" accessibilityLabel={`${folder} klasörü`} accessibilityState={{selected:value===folder}} onPress={()=>onChange(folder)} style={[styles.chip,value===folder&&styles.active]}><Text style={[styles.text,value===folder&&styles.activeText]}>{folder}</Text></Pressable>)}
 </ScrollView>;
}
const makeStyles=(colors:ThemeColors,scheme:'light'|'dark')=>StyleSheet.create({
 scroll:{flexGrow:0,backgroundColor:scheme==='light'?'#FFFFFF':colors.background},
 row:{gap:8,alignItems:'center',paddingHorizontal:20},
 chip:{height:44,paddingHorizontal:18,borderWidth:1.5,borderColor:colors.border,borderRadius:24,alignItems:'center',justifyContent:'center'},
 active:{backgroundColor:colors.ink,borderColor:colors.ink},
 text:{fontFamily:fonts.medium,fontSize:14,color:colors.ink},
 activeText:{fontFamily:fonts.semibold,color:colors.surface}
});
