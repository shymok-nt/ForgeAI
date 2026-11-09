import '@expo/metro-runtime';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// Expo Router eagerly evaluates routes. Initialize CanvasKit first so the
// drawing screen never mounts a Skia Canvas before the WASM runtime is ready.
LoadSkiaWeb()
  .then(async () => {
    const { App } = await import('expo-router/build/qualified-entry');
    const { renderRootComponent } = await import('expo-router/build/renderRootComponent');
    renderRootComponent(App);
  })
  .catch(error => {
    console.error('CanvasKit web initialization failed:', error);
    const root = document.getElementById('root');
    if (root) root.textContent = 'Çizim motoru yüklenemedi. Sayfayı yenileyin veya bağlantınızı kontrol edin.';
  });
