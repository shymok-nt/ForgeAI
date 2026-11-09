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

Galeri kapakları `expo-file-system` ile uygulamanın `documentDirectory/covers/` klasörüne kopyalanır. **Defterler ve sayfalar SQLite'a kaydedilir; Zustand bellek önbelleği olarak kullanılır.** Canvas, arama ve koyu tema sonraki görevlerde eklenecek.

## Yapı

- `app/`: expo-router rotaları, sekmeler, tam ekran defter düzenleyicisi
- `components/`: defter kapağı, kartlar, şablonlar, kütüphane
- `theme/`: renk, kapak paleti ve font token'ları
- `types/notebook.ts`: Notebook modeli
- `store/notebookStore.ts`: bellek içi defter işlemleri
- `utils/`: tarih, sıralama ve kapak dosyaları

## Kalıcı kayıt (SQLite)

Uygulama açılırken `db/database.ts` içindeki `getDatabase()` bağlantıyı kurar, WAL ve foreign key ayarlarını açar ve `db/migrations.ts` migrasyonlarını uygular. Sonra `store/notebookStore.ts` içindeki `hydrate()` defterleri, klasörleri ve ayarları belleğe yükler. Başarısız olursa Türkçe hata ekranından yeniden denenebilir.

Veritabanı: `notex.db`. Şema v1:
- `folders`: sabit kimlikli Ders, İş, Kişisel klasörleri; sıra ve oluşturulma tarihi
- `notebooks`: defter bilgileri, klasör bağlantısı, kapak türü/rengi/göreli dosya yolu, şablon, favori, tarihler
- `pages`: defter bağlantısı, 0'dan başlayan sıra, sayfa şablonu, kâğıt rengi, sonraki çizim özelliği için `{"v":1,"strokes":[]}` JSON içeriği
- `settings`: `sortBy`, `viewMode`, `selectedFolderId` anahtarları

Defterlerin `pageCount` değeri `COUNT(pages.id)` ile sorgulanır; ayrıca kaydedilmez. Kapak resimleri `covers/<uuid>.<uzantı>` şeklinde göreli yolla tutulur; `utils/files.ts` görüntülerken uygulama klasöründen tam URI oluşturur.

### Yeni tablo/sütun eklemek

`db/migrations.ts` içindeki `migrations` listesine mevcut sürümden büyük, sıralı yeni bir kayıt ekle (örneğin `version: 2`). `run(db)` içinde `ALTER TABLE` veya `CREATE TABLE` SQL'ini yaz. Önceki migrasyonları değiştirme. Açılışta `PRAGMA user_version` kontrol edilir ve yalnızca eksik migrasyonlar transaction içinde uygulanır. Mevcut kullanıcı verilerini silme.

### Sayfa yönetimi

Defteri açınca ilk sayfa görüntülenir. Alttaki **Sayfalar** düğmesiyle sayfa ekleme, silme, yukarı/aşağı taşıma ve şablon değiştirme denenebilir. Son sayfa silinemez. Çizim alanı henüz uygulanmadı.

Not: Daha önceki sürümde defterler yalnızca bellekte tutuluyordu. Bu eski oturumlar uygulama kapatılınca zaten kayboluyordu; SQLite öncesi bellek verisini geriye dönük kurtarmak mümkün değildir.

## Tema, klasörler ve arama

`theme/ThemeProvider.tsx` uygulamanın Sistem / Açık / Koyu temasını yönetir. Yeni ekran ve bileşenlerde `const {colors,scheme,mode}=useTheme()` ile aktif renkleri al; arayüz renkleri için sabit hex yerine `colors.background`, `colors.surface`, `colors.ink`, `colors.muted`, `colors.accent` gibi token'ları kullan. Kapak renkleri ve kâğıt şablonları temadan bağımsızdır. Tema tercihi `settings.theme` anahtarında saklanır.

`folderRepository` klasör oluşturma, yeniden adlandırma, silme ve sıralama işlemlerini SQLite'da yapar. Klasör silindiğinde `ON DELETE SET NULL` sayesinde defterler korunur ve Klasörsüz grubuna geçer. `FolderChips` klasörleri Zustand'daki SQLite'dan yüklenmiş listeden alır.

`app/search.tsx` defter başlıklarını bellekte 200 ms gecikmeyle filtreler. `utils/search.ts` Türkçe harfleri ve aksanları normalleştirir. En fazla 8 son arama `settings.recentSearches` içinde JSON olarak saklanır. Sayfa içeriğinde arama yapılmaz.

## Çizim motoru — Parça 1 (geliştirme sürümü)

`features/canvas/types.ts` sayfa boyutunu 1000 × 1414 olarak sabitler. İçerik `{ "v": 2, "elements": [...] }` biçiminde `pages.content` sütununda saklanır. `stroke` elemanı UUID, z sırası, oluşturma tarihi, kalem türü, renk, genişlik, opaklık, düzleştirilmiş [x,y,pressure] nokta dizisi ve bbox içerir. Yeni eleman türleri için `Element` birleşimine yeni bir tür eklenip renderer'a karşılık gelen çizici eklenmelidir.

Render sırası: Skia Canvas üzerinde kâğıt/şablon, bbox ile filtrelenen kalıcı stroke path'leri ve aktif stroke. Path geometrisi `perfect-freehand` ile hazırlanır; nokta örnekleri seyreltilir. Her sayfanın undo/redo geçmişi bellekte tutulur (100 işlem). Çizimler SQLite'a 800 ms gecikmeyle ve sayfadan çıkarken yazılır.

Gerekli Expo bağımlılıklarını yerel makinede `npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets expo-haptics expo-keep-awake` ve `npm install perfect-freehand` komutlarıyla SDK sürümüne uygun kurun. Stylus basıncı/eğimi ve gelişmiş palm rejection için Expo Go yerine development build gerekebilir.

**Henüz tamamlanmamış Parça 1 özellikleri:** gerçek stylus basıncı/palm rejection, iki/üç parmak kısayolları, pixel eraser, çoklu preset kalıcılığı, thumbnail üretimi, odak modu, gelişmiş zoom sınırları ve performans testleri. Bu sürüm temel çizim/çizgi silgi/undo-redo/SQLite kayıt iskeletidir; 60 fps veya tüm cihazlarda sorunsuz çalıştığı doğrulanmamıştır.
