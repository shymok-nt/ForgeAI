import { Pressable,Text,View,StyleSheet } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { NotebookCover } from '@/components/NotebookCover';
import { dateLabel } from '@/utils/notebook';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import type { Notebook,ViewMode } from '@/types/notebook';
export function NotebookCard({notebook,width,viewMode,onOpen,onOptions,highlight}:{notebook:Notebook;width:number;viewMode:ViewMode;onOpen:()=>void;onOptions:()=>void;highlight?:string}){
 const {colors}=useTheme();const styles=makeStyles(colors);
 const coverWidth=viewMode==='list'?48:width;
 const query=highlight?.trim()??'';const match=query?notebook.title.toLocaleLowerCase('tr-TR').indexOf(query.toLocaleLowerCase('tr-TR')):-1;
 const label=match<0?notebook.title:<>{notebook.title.slice(0,match)}<Text style={{backgroundColor:colors.highlight,color:'#1B1B2F'}}>{notebook.title.slice(match,match+query.length)}</Text>{notebook.title.slice(match+query.length)}</>;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} defterini aç`} onPress={onOpen} onLongPress={onOptions} delayLongPress={350} style={viewMode==='list'?styles.list:styles.grid}>
 <NotebookCover notebook={notebook} width={coverWidth}/><View style={viewMode==='list'?styles.listText:styles.gridText}><Text numberOfLines={1} style={styles.title}>{label}</Text><Text style={styles.meta}>{dateLabel(notebook.updatedAt)} · {notebook.pageCount} sayfa</Text></View>
 {viewMode==='list'&&<Pressable accessibilityRole="button" accessibilityLabel={`${notebook.title} seçenekleri`} style={styles.more} onPress={onOptions}><MoreHorizontal size={22} color={colors.ink}/></Pressable>}
 </Pressable>
}
const makeStyles=(colors:ThemeColors)=>StyleSheet.create({grid:{minWidth:0},gridText:{paddingTop:10},list:{minHeight:88,flexDirection:'row',alignItems:'center',gap:14,borderBottomWidth:1,borderBottomColor:colors.divider,paddingVertical:10},listText:{flex:1,minWidth:0},title:{fontFamily:fonts.semibold,fontSize:14,color:colors.ink},meta:{fontFamily:fonts.body,fontSize:12,color:colors.muted,marginTop:5},more:{width:44,height:44,alignItems:'center',justifyContent:'center'}});
