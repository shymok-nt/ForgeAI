import { router } from 'expo-router';
import Constants from 'expo-constants';
import { ArrowLeft,ChevronRight } from 'lucide-react-native';
import { Pressable,SafeAreaView,ScrollView,Text,View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { PagePreview } from '@/components/PagePreview';
import type { PageTemplate,PaperColor } from '@/types/notebook';
export default function SettingsScreen(){
 const {colors,mode}=useTheme();const theme=useSettingsStore(s=>s.theme),setTheme=useSettingsStore(s=>s.setTheme);
 const template=useSettingsStore(s=>s.defaultTemplate),setTemplate=useSettingsStore(s=>s.setDefaultTemplate);
 const paper=useSettingsStore(s=>s.defaultPaperColor),setPaper=useSettingsStore(s=>s.setDefaultPaperColor);
 const heading=(label:string)=><Text style={{fontSize:13,fontWeight:'700',color:colors.muted,marginTop:30,marginBottom:10,marginLeft:8}}>{label}</Text>;
 const segment=(label:string,selected:boolean,onPress:()=>void,preview?:React.ReactNode)=><Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected}} onPress={onPress} style={{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',gap:6,padding:6,borderRadius:10,backgroundColor:selected?colors.accent:colors.surface}}>{preview}<Text style={{color:selected?colors.onAccent:colors.ink,fontSize:12,fontWeight:selected?'700':'500'}}>{label}</Text></Pressable>;
 return <SafeAreaView style={{flex:1,backgroundColor:colors.background}}><View style={{height:60,flexDirection:'row',alignItems:'center',paddingHorizontal:16}}><Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={()=>router.back()} style={{width:44,height:44,justifyContent:'center'}}><ArrowLeft color={colors.ink}/></Pressable><Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Ayarlar</Text></View><ScrollView contentContainerStyle={{paddingHorizontal:20,paddingBottom:60}}>
 {heading('GÖRÜNÜM')}<View style={{backgroundColor:colors.surfaceRaised,padding:14,borderRadius:16,gap:10}}><Text style={{color:colors.ink,fontSize:16}}>Tema</Text><View style={{flexDirection:'row',gap:6}}>{segment('Sistem',theme==='system',()=>void setTheme('system'))}{segment('Açık',theme==='light',()=>void setTheme('light'))}{segment('Koyu',theme==='dark',()=>void setTheme('dark'))}</View><Text style={{color:colors.muted,fontSize:12}}>Sistem seçilirse telefonunun temasını takip eder.</Text></View>
 {heading('YENİ DEFTER VARSAYILANLARI')}<View style={{backgroundColor:colors.surfaceRaised,padding:14,borderRadius:16,gap:12}}><Text style={{color:colors.ink}}>Varsayılan sayfa şablonu</Text><View style={{flexDirection:'row',gap:5}}>{(['boş','çizgili','kareli','noktalı'] as PageTemplate[]).map(v=>segment(v.charAt(0).toUpperCase()+v.slice(1),template===v,()=>void setTemplate(v),<PagePreview template={v} paperColor={paper} width={34} height={44}/>))}</View><Text style={{color:colors.ink}}>Varsayılan kâğıt rengi</Text><View style={{flexDirection:'row',gap:8}}>{(['beyaz','krem'] as PaperColor[]).map(v=>segment(v==='beyaz'?'Beyaz':'Krem',paper===v,()=>void setPaper(v)))}</View></View>
 {heading('DÜZEN')}<Pressable accessibilityRole="button" accessibilityLabel="Klasörleri yönet" onPress={()=>router.push('/(tabs)/folders')} style={{minHeight:56,backgroundColor:colors.surfaceRaised,borderRadius:16,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:colors.ink,fontSize:16}}>Klasörleri yönet</Text><ChevronRight color={colors.muted}/></Pressable>
 {heading('HAKKINDA')}<View style={{backgroundColor:colors.surfaceRaised,borderRadius:16,padding:16,gap:8}}><Text style={{color:colors.ink,fontSize:16,fontWeight:'700'}}>Notex</Text><Text style={{color:colors.muted}}>Sürüm {Constants.expoConfig?.version??'1.0.0'}</Text><Text style={{color:colors.muted}}>Verilerin yalnızca bu cihazda saklanır.</Text></View>
 </ScrollView></SafeAreaView>
}
