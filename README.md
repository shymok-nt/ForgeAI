# Notex

Expo, TypeScript ve expo-router ile hazırlanmış, çevrimdışı el yazısı not uygulamasının başlangıç projesi.

## Başlatma

```bash
npm install
npx expo start
```

Expo Go ile QR kodunu tarayabilir veya Android/iOS simülatöründe açabilirsin. Skia gibi yerel bağımlılıklarla çalışırken gerektiğinde Expo development build kullan.

## Yapı

- `app/`: expo-router rotaları
- `screens/`: Not listesi ve boş not ekranı
- `components/`: Yeniden kullanılabilir arayüz parçaları
- `store/`: Zustand not durumu
- `db/`: İleride eklenecek SQLite işlemleri

**Not:** Bu ilk iskelette notlar yalnızca bellekte tutulur; uygulama yeniden başlatıldığında kaybolur. Çizim ve kalıcı kayıt henüz uygulanmadı.
