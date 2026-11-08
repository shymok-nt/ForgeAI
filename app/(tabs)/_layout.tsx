import { Tabs } from 'expo-router';
import { BookOpen,Folder,Star } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/fonts';
export default function TabLayout(){const {colors}=useTheme();return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:colors.accent,tabBarInactiveTintColor:colors.muted,tabBarStyle:{height:88,backgroundColor:colors.surfaceRaised,borderTopWidth:1,borderTopColor:colors.divider,paddingTop:10,paddingBottom:20},tabBarLabelStyle:{fontFamily:fonts.semibold,fontSize:12,marginTop:4}}}><Tabs.Screen name="index" options={{title:'Defterler',tabBarIcon:({color})=><BookOpen size={24} color={color}/>}}/><Tabs.Screen name="folders" options={{title:'Klasörler',tabBarIcon:({color})=><Folder size={24} color={color}/>}}/><Tabs.Screen name="favorites" options={{title:'Favoriler',tabBarIcon:({color})=><Star size={24} color={color}/>}}/></Tabs>}
