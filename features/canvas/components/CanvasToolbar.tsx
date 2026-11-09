import React from 'react';
import {Pressable,Text,View,ScrollView} from 'react-native';
import {Pen,Highlighter,Eraser,Hand,Scan,Shapes,Type,Image as ImageIcon,PanelsTopLeft} from 'lucide-react-native';
import type {Tool} from './DrawingCanvas';
import type {ThemeColors} from '@/theme/colors';

export type UiTool=Tool|'select'|'shape'|'text'|'image'|'pages';
export const tools:{id:UiTool;label:string;icon:typeof Pen;enabled:boolean}[]=[
 {id:'pen',label:'Kalem',icon:Pen,enabled:true},
 {id:'highlighter',label:'Vurgulayıcı',icon:Highlighter,enabled:true},
 {id:'eraser',label:'Silgi',icon:Eraser,enabled:true},
 {id:'select',label:'Seçim',icon:Scan,enabled:false},
 {id:'shape',label:'Şekil',icon:Shapes,enabled:false},
 {id:'text',label:'Metin',icon:Type,enabled:false},
 {id:'image',label:'Resim',icon:ImageIcon,enabled:false},
 {id:'hand',label:'Kaydırma',icon:Hand,enabled:true},
 {id:'pages',label:'Sayfalar',icon:PanelsTopLeft,enabled:true}
];
type Props={tablet:boolean;tool:Tool;colors:ThemeColors;onTool:(tool:Tool)=>void;onPages:()=>void};
export function CanvasToolbar({tablet,tool,colors,onTool,onPages}:Props){
 const shown=tablet?tools.filter(t=>t.id!=='pages'):tools.filter(t=>t.id!=='image'&&t.id!=='hand');
 return <View style={{flexDirection:'row',alignItems:'center',backgroundColor:tablet?colors.background:colors.surfaceRaised,borderRadius:tablet?18:24,paddingHorizontal:4,paddingVertical:tablet?2:8,shadowColor:'#000',shadowOpacity:tablet?0:0.12,shadowRadius:14,elevation:tablet?0:6}}>
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems:'center',flexGrow:1,justifyContent:'space-around'}}>
 {shown.map(t=>{const Icon=t.icon;const active=t.id===tool;return <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{selected:active,disabled:!t.enabled}} disabled={!t.enabled} onPress={()=>t.id==='pages'?onPages():onTool(t.id as Tool)} style={{width:tablet?48:46,height:tablet?44:48,alignItems:'center',justifyContent:'center',borderRadius:16,opacity:t.enabled?1:0.4,backgroundColor:active?colors.accent+'1F':'transparent'}}>
 <Icon size={22} color={active?colors.accent:colors.ink}/></Pressable>})}
 </ScrollView></View>;
}
