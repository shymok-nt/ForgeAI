import { Pressable,Text,View,StyleSheet } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { dateLabel } from '@/utils/notebook';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Notebook,ViewMode } from '@/types/notebook';
export function NotebookCard({notebook,width,viewMode,onOpen,onOptions}:{notebook:Notebook;width:number;viewMode:ViewMode;onOpen:()=>void;onOptions:()=>void}){
 const coverWidth=viewMode==='list'?48:width;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini aç`} onPress={onOpen} onLongPress={onOptions} delayLongPress={350} style={viewMode==='list'?styles.list:styles.grid}>
 <NotebookCover notebook={notebook} width={coverWidth}/><View style={viewMode==='list'?styles.listText:styles.gridText}><Text numberOfLines={1} style={styles.title}>{notebook.title}</Text><Text style={styles.meta}>{dateLabel(notebook.updatedAt)} · {notebook.pageCount} sayfa</Text></View>
 {viewMode==='list'&&<Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} seçenekleri`} style={styles.more} onPress={onOptions}><MoreHorizontal size={22} color={colors.ink}/></Pressable>}
 </Pressable>
}
const styles=StyleSheet.create({grid:{minWidth:0},gridText:{paddingTop:10},list:{minHeight:88,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:10},listText:{flex:1,minWidth:0},title:{fontFamily:fonts.semibold,fontSize:14,color:colors.ink},meta:{fontFamily:fonts.body,fontSize:12,color:colors.muted,marginTop:5},more:{width:44,height:44,alignItems:'center',justifyContent:'center'}});
