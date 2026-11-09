import React from 'react';
import {View,Text,Pressable,ScrollView} from 'react-native';
import {Plus,ChevronUp,ChevronDown,Trash2} from 'lucide-react-native';
import {PagePreview} from '@/components/PagePreview';
import type {Page} from '@/types/page';
import type {ThemeColors} from '@/theme/colors';
type Props={pages:Page[];selectedId?:string;tablet:boolean;colors:ThemeColors;onSelect:(id:string)=>void;onAdd:()=>void;onRemove:(id:string)=>void;onMove:(id:string,index:number)=>void;onActions:(id:string)=>void};
export function CanvasPageStrip({pages,selectedId,tablet,colors,onSelect,onAdd,onRemove,onMove,onActions}:Props){
 return <ScrollView horizontal={!tablet} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} contentContainerStyle={{padding:12,alignItems:'center',gap:12,flexGrow:tablet?0:1}}>
 {pages.map((page,index)=><View key={page.id} style={{alignItems:'center',width:tablet?108:100}}>
 <Pressable accessibilityRole="button" accessibilityLabel={`Sayfa ${index+1}`} accessibilityState={{selected:page.id===selectedId}} onPress={()=>onSelect(page.id)} onLongPress={()=>onActions(page.id)} style={{padding:3,borderRadius:8,borderWidth:2,borderColor:page.id===selectedId?colors.accent:'transparent',backgroundColor:colors.surface}}>
 <PagePreview template={page.template} paperColor={page.paperColor} width={80} height={108}/></Pressable>
 <Text style={{fontSize:12,color:page.id===selectedId?colors.accent:colors.muted,marginTop:4}}>Sayfa {index+1}</Text>
 <View style={{flexDirection:'row'}}>
 <Pressable accessibilityRole="button" accessibilityLabel={`Sayfa ${index+1} yukarı taşı`} disabled={index===0} onPress={()=>onMove(page.id,index-1)} style={{width:44,height:44,alignItems:'center',justifyContent:'center',opacity:index===0?0.3:1}}><ChevronUp size={17} color={colors.ink}/></Pressable>
 <Pressable accessibilityRole="button" accessibilityLabel={`Sayfa ${index+1} aşağı taşı`} disabled={index===pages.length-1} onPress={()=>onMove(page.id,index+1)} style={{width:44,height:44,alignItems:'center',justifyContent:'center',opacity:index===pages.length-1?0.3:1}}><ChevronDown size={17} color={colors.ink}/></Pressable>
 </View></View>)}
 <Pressable accessibilityRole="button" accessibilityLabel="Sayfa ekle" onPress={onAdd} style={{width:90,height:108,borderWidth:1,borderStyle:'dashed',borderColor:colors.border,borderRadius:8,alignItems:'center',justifyContent:'center',gap:5}}><Plus size={24} color={colors.accent}/><Text style={{fontSize:12,color:colors.accent}}>Sayfa ekle</Text></Pressable>
 </ScrollView>;
}
