import { Tabs } from 'expo-router';
import { FileText, Folder, Star } from 'lucide-react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
export default function TabLayout(){return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.accent,tabBarInactiveTintColor:colors.muted,tabBarStyle:{height:88,backgroundColor:colors.surface,borderTopWidth:1,borderTopColor:colors.divider,paddingTop:10,paddingBottom:20},tabBarLabelStyle:{fontFamily:fonts.semibold,fontSize:12,marginTop:4}}}>
 <Tabs.Screen name="index" options={{title:'Notlar',tabBarIcon:({color})=><FileText size={24} color={color}/>}}/>
 <Tabs.Screen name="folders" options={{title:'Klasörler',tabBarIcon:({color})=><Folder size={24} color={color}/>}}/>
 <Tabs.Screen name="favorites" options={{title:'Favoriler',tabBarIcon:({color})=><Star size={24} color={color}/>}}/>
 </Tabs>}
