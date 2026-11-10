import { useState } from 'react';
import { ScrollView,Pressable,Text,StyleSheet,View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
 const [offset,setOffset]=useState(0);
 const [viewport,setViewport]=useState(0);
 const [contentWidth,setContentWidth]=useState(0);
 const hasOverflow=contentWidth>viewport+2;
 const showLeft=hasOverflow&&offset>3;
 const showRight=hasOverflow&&offset+viewport<contentWidth-3;
 const bg=scheme==='light'?'#FFFFFF':colors.background;
 return <View style={styles.container}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}
   scrollEventThrottle={16}
   onLayout={e=>setViewport(e.nativeEvent.layout.width)}
   onContentSizeChange={w=>setContentWidth(w)}
   onScroll={e=>setOffset(e.nativeEvent.contentOffset.x)}
   style={styles.scroll} contentContainerStyle={styles.row}>
   {folders.map(folder=><Pressable key={folder} accessibilityRole="button" accessibilityLabel={`${folder} klasörü`} accessibilityState={{selected:value===folder}} onPress={()=>onChange(folder)} style={[styles.chip,value===folder&&styles.active]}><Text style={[styles.text,value===folder&&styles.activeText]}>{folder}</Text></Pressable>)}
  </ScrollView>
  {showLeft&&<LinearGradient pointerEvents="none" colors={[bg+'FF',bg+'00']} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.fade,styles.left]}/>}
  {showRight&&<LinearGradient pointerEvents="none" colors={[bg+'00',bg+'FF']} start={{x:0,y:0}} end={{x:1,y:0}} style={[styles.fade,styles.right]}/>}
 </View>;
}
const makeStyles=(colors:ThemeColors,scheme:'light'|'dark')=>StyleSheet.create({
 container:{position:'relative',backgroundColor:scheme==='light'?'#FFFFFF':colors.background},
 scroll:{flexGrow:0,backgroundColor:scheme==='light'?'#FFFFFF':colors.background},
 row:{gap:8,alignItems:'center',paddingLeft:0,paddingRight:20},
 chip:{height:44,paddingHorizontal:18,borderWidth:1.5,borderColor:colors.border,borderRadius:24,alignItems:'center',justifyContent:'center'},
 active:{backgroundColor:colors.ink,borderColor:colors.ink},
 text:{fontFamily:fonts.medium,fontSize:14,color:colors.ink},
 activeText:{fontFamily:fonts.semibold,color:colors.surface},
 fade:{position:'absolute',top:0,bottom:0,width:32},
 left:{left:0},
 right:{right:0}
});
