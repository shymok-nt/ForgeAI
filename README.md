# Notex

Expo SDK 58, TypeScript ve expo-router ile geliştirilmiş çevrimdışı not uygulaması.

## Çalıştırma

```bash
npm install
npx expo start --clear
```

Expo Go ile QR kodunu tarayarak Android veya iOS'ta açabilirsin.

## Ana ekran

Uygulama boş başlar. **Notlar** sekmesindeki **+** düğmesine basıp not adını, klasörünü ve sayfa şablonunu seçerek **Oluştur** ile not ekle. **Tümü / Ders / İş / Kişisel** çipleriyle filtrele. Kartı açarak boş not ekranına git; karta uzun basarak yeniden adlandır, favorilere ekle/çıkar veya onayla sil. **Favoriler** sekmesi işaretlenen notları listeler; **Klasörler** sekmesi şimdilik yer tutucudur. Arama ve menü butonları henüz etkin değildir.

Notlar şimdilik yalnızca Zustand belleğinde tutulur; uygulama yeniden açılınca kaybolur. SQLite kalıcılığı ve el yazısı çizimi sonraki görevlerde eklenecek.

## Klasörler

- `app/`: expo-router rotaları ve sekmeler
- `screens/`: Not listesi ve boş not ekranı
- `components/`: Kart, SVG şablon önizleme, oluşturma ve işlemler
- `theme/`: Renk ve yazı tipi token'ları
- `types/`: Note veri modeli
- `store/`: Zustand durum yönetimi
- `db/`: İleride eklenecek SQLite
