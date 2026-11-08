import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
export default function FoldersScreen(){return <SafeAreaView style={styles.container}><Text style={styles.title}>Klasörler</Text><Text style={styles.message}>Yakında</Text></SafeAreaView>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:colors.background,padding:20},title:{fontFamily:fonts.heading,fontSize:32,color:colors.ink,marginTop:24},message:{flex:1,textAlign:'center',textAlignVertical:'center',fontFamily:fonts.medium,fontSize:18,color:colors.muted}});
