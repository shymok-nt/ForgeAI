import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNotesStore } from '@/store/useNotesStore';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNotesStore((state) => state.notes.find((item) => item.id === id));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Notlara dön" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Notlarım</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{note?.title ?? 'Not'}</Text>
        <View style={styles.spacer} />
      </View>
      <View style={styles.canvas} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minWidth: 100, paddingVertical: 10 },
  backText: { color: '#5659D8', fontSize: 16, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', color: '#202238', fontSize: 16, fontWeight: '700' },
  spacer: { width: 100 },
  canvas: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18 },
});
