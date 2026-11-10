import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';

export default function NativeTestScreen() {
  const [result, setResult] = useState('Henüz test edilmedi.');
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      if (Platform.OS !== 'android') throw new Error('Bu test yalnızca Android development build üzerinde çalışır.');
      const { hello } = await import('../modules/ink-recognition/src');
      setResult(await hello());
    } catch (error) {
      setResult('Hata: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 }}>
      <Stack.Screen options={{ title: 'Android Native Test' }} />
      <Text style={{ fontSize: 18, textAlign: 'center' }}>Expo Modules Android testi</Text>
      <Pressable accessibilityRole="button" disabled={loading} onPress={run} style={{ padding: 16, backgroundColor: '#2466DD', borderRadius: 12 }}>
        <Text style={{ color: 'white', fontWeight: '600' }}>Native hello çağır</Text>
      </Pressable>
      {loading ? <ActivityIndicator /> : <Text selectable style={{ fontSize: 20 }}>{result}</Text>}
    </View>
  );
}
