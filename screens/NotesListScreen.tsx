import { router } from 'expo-router';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NoteListItem } from '@/components/NoteListItem';
import { useNotesStore } from '@/store/useNotesStore';

export default function NotesListScreen() {
  const notes = useNotesStore((state) => state.notes);
  const addNote = useNotesStore((state) => state.addNote);

  const handleAddNote = () => {
    const id = addNote();
    router.push({ pathname: '/note/[id]', params: { id } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>NOTEX</Text><Text style={styles.heading}>Notlarım</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Yeni not oluştur" onPress={handleAddNote} style={styles.addButton}>
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        </View>
        <FlatList
          data={notes}
          keyExtractor={(note) => note.id}
          renderItem={({ item }) => <NoteListItem title={item.title} subtitle="Yeni not" onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })} />}
          contentContainerStyle={notes.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyIcon}>✎</Text><Text style={styles.emptyTitle}>Henüz notun yok</Text><Text style={styles.emptyDescription}>İlk notunu oluşturmak için sağ üstteki + düğmesine dokun.</Text></View>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F8FC' },
  container: { flex: 1, paddingHorizontal: 22 },
  header: { paddingTop: 28, paddingBottom: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#6467D9' },
  heading: { fontSize: 32, fontWeight: '800', color: '#202238', marginTop: 4 },
  addButton: { width: 48, height: 48, backgroundColor: '#5659D8', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { fontSize: 30, color: 'white', lineHeight: 34 },
  list: { paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 90 },
  emptyIcon: { fontSize: 64, color: '#A4A6E8', marginBottom: 16 },
  emptyTitle: { fontSize: 21, fontWeight: '700', color: '#202238' },
  emptyDescription: { fontSize: 15, color: '#777C90', textAlign: 'center', marginTop: 10, lineHeight: 22 },
});
