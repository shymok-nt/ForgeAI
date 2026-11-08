import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts as useSpaceFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { colors } from '@/theme/colors';
export default function RootLayout(){const [interLoaded,interError]=useInterFonts({Inter_400Regular,Inter_500Medium,Inter_600SemiBold});const [spaceLoaded,spaceError]=useSpaceFonts({SpaceGrotesk_500Medium,SpaceGrotesk_700Bold});if((!interLoaded&&!interError)||(!spaceLoaded&&!spaceError))return null;return <><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}><Stack.Screen name="(tabs)"/><Stack.Screen name="notebook-editor" options={{presentation:'fullScreenModal'}}/><Stack.Screen name="note/[id]"/></Stack><StatusBar style="dark"/></>}
