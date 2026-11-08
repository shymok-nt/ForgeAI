# Notex

Expo SDK 58, TypeScript ve expo-router ile hazırlanmış el yazısı defter uygulaması.

## Çalıştırma

```bash
npm install
npx expo start --clear
```

Expo Go'da QR kodunu tarayarak uygulamayı açabilirsin. Yeni paket yüklenmediyse sonraki kod güncellemelerinde `git pull origin main` ve `npx expo start` yeterlidir.

## Defter kütüphanesi

Uygulama boş başlar. **+** düğmesi tam ekran **Yeni defter** düzenleyicisini açar. Defter adı, 12 kapak rengi veya galeriden resim, kapak başlığı, sayfa şablonu, kâğıt rengi ve klasör seçilir. **Oluştur** defteri ekler ve henüz çizim bulunmayan defter ekranını açar.

Kütüphanede **Tümü / Ders / İş / Kişisel** filtreleri, **Sırala/Görünüm** menüsünde son düzenlenen / ada göre / oluşturma tarihi ve ızgara / liste seçenekleri vardır. Karta uzun basarak düzenleme, favorilere ekleme/çıkarma, çoğaltma veya onaylı silme yapılır. **Favoriler** sekmesi aynı kapakları gösterir. **Klasörler** sekmesi şimdilik yer tutucudur.

Galeri kapakları `expo-file-system` ile uygulamanın `documentDirectory/covers/` klasörüne kopyalanır. **Defterlerin kendisi şimdilik Zustand belleğindedir**: uygulama yeniden başlatıldığında liste sıfırlanır. SQLite, canvas, arama ve koyu tema sonraki görevlerde eklenecek.

## Yapı

- `app/`: expo-router rotaları, sekmeler, tam ekran defter düzenleyicisi
- `components/`: defter kapağı, kartlar, şablonlar, kütüphane
- `theme/`: renk, kapak paleti ve font token'ları
- `types/notebook.ts`: Notebook modeli
- `store/notebookStore.ts`: bellek içi defter işlemleri
- `utils/`: tarih, sıralama ve kapak dosyaları
