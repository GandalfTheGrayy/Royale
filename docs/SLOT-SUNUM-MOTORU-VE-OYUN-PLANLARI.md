# Slot Sunum Motoru ve Oyun Planları

> Durum: Baykuş Madeni uygulamada. Bu belge, oyunun matematiğini veya gerçek ödeme sonucunu değiştirmeyen sunum geliştirmeleri için kalıcı yol haritasıdır.

## Değişmez ilkeler

- Görsel anlatım, yalnızca motorun ürettiği sonucu açıklar; RNG, ödeme, bakiye veya olasılıkları değiştirmez.
- Oyuncuya olmayan bir kazanma ihtimali, sahte yakın-kazanç veya gizli potansiyel gösterilmez.
- Her tur anlaşılır bir çizgide ilerler: sonuç doğar, oyun içindeki sebebi gösterilir, sonra kazanım görünür biçimde toplanır.
- Hareket hassasiyeti için `prefers-reduced-motion` korunur; hız ayarı açıklığı yok edecek kadar agresif olmaz.
- Ekranda aynı anda tek ana olay ve en fazla yaklaşık üç ikincil efekt bulunur. Bu, ödülün kaybolmasını ve görsel gürültüyü engeller.

## Ortak sunum dili

### Kazanç kademeleri

| Çarpan | Metin |
| --- | --- |
| 5–9,99× | Güzel Kazanç |
| 10–24,99× | Büyük Kazanç |
| 25–99,99× | Muhteşem Kazanç |
| 100–499,99× | Efsanevi Vurgun |
| 500–999,99× | Akılalmaz Kazanç |
| 1.000×+ | Tarihi Vurgun |

Kademeler yalnızca gerçek, kesinleşmiş tur sonucu üzerinde değerlendirilir. Sayı sıfırdan hedefe hızlı ama okunabilir şekilde yükselir; kademe metni sayı geçişi sırasında değişir.

### Ortak motor parçaları

1. Sonuç adaptörü: Her motorun olaylarını değişmeden ortak sunum olaylarına dönüştürür.
2. Olay orkestratörü: Kaskad, çarpan, toplayıcı ve bonus olaylarını sıraya koyar.
3. Sayım ve final katmanı: Tur kazancı ile büyük kazanımı doğruca gerçek sonuçtan üretir.
4. Tema paketi: Her oyunun rengi, yazısı, arka plan görseli ve seslerini taşır.
5. Kontrol katmanı: Normal, Turbo ve Azaltılmış Hareket profilleri ile otomatik turda güvenli geçişler sağlar.

### Hız ilkesi

Normal modda sonuç anlatılır; Turbo yalnızca beklemeleri kısaltır, darbe/ödül/sandık gibi anlam taşıyan anları atlamaz. Genel varsayılanlar:

- Makaraların yerleşmesi: 900–1.100 ms
- Düşüş: 500–650 ms
- Darbe: 350–450 ms
- Kırılma ve ödül: 600–850 ms
- Sandık/çarpan: 1.200–1.600 ms

Bu değerler oyun başına uyarlanır; tek bir küresel hız çarpanı kullanılmaz.

## Oyun bazlı planlar

### Baykuş Madeni — ilk pilot

**Sorunlar:** Aynı sütunda birden fazla kazma aynı koordinatta üst üste biniyor; darbe, kırılma, sandık ve ödül aynı anda yaşandığı için okunmuyor; mevcut Turbo oranı fazla sert.

**Uygulama sırası:**

1. Her `(dalga, sütun)` için kararlı şerit hesaplanır. İki kazma `- / +`, üç kazma `- / 0 / +` yatay şeritlere yerleşir; kaynak satırı üzerinden sonraki darbelerde aynı şeridi korur.
2. Düşüşler küçük bir gecikmeyle girer. Böylece aynı sütundaki araçların ikisi de görünür kalır.
3. Sunum evrelere ayrılır: makara → düşüş → darbe → blok kırılması/ödül → sandık → tur toplamı.
4. Blok ödülü ve sandık matematiği mevcut gerçek ödeme değerlerinden üretilir. Tur çarpanı kademeli sayılır; bakiye yalnızca mevcut ödeme akışında güncellenir.
5. Kitap geliştirmesi bağımsız kısa sahne, TNT ise ayrı şok ve hasar özeti olarak görünür.
6. Normal/Turbo için okunabilir taban süreler kullanılır; azaltılmış hareket medya tercihi korunur.
7. Kazma, blok, sandık ve kitap için CC0 ses katmanı eklenir; lisans kaynağı asset klasöründe saklanır.

**Kabul kriterleri:** Aynı sütundaki iki/üç kazma görünür; deterministik sonuç/ödeme değişmez; Turbo’da olay sırası okunur; sayaç gerçek sonuca eşit biter; mobil ve azaltılmış hareket görünümü bozulmaz.

### Neon Kasası

Mevcut kaskad ve güç toplamını koru. Anlatım: sembol çözülmesi → güç kürelerinin toplanması → denklem/çarpan → final. Mira yalnızca scatter veya yüksek olay için sahneye girer.

### Kaptan Mercan

Balıkların tek tek uzun gecikmeyle toplanması yerine kısa dalgalar ve kaptan sayacı kullan. Kanca/çekme anı yalnızca gerçek toplama sonucunda gösterilir.

### Şekerhane 1024

7×7 kaskad ve yapışkan çarpan noktalarını görünür odak yap. İlk kaskad daha uzun, sonrakiler daha kısa akar; mevcut normal/turbo uç değerleri dengelenir.

### Allah’ın Lütfu

Zengin olay sırasını koru. Tekrarlanan küçük olaylar özetlenir; anahtar, toplayıcı ve küresel çarpan tam sahne olarak kalır.

### Kiraz Kulübü 77

Klasik 3×3 kimliğini koru: kazanan ödeme çizgileri sırayla taranır, tutma/retro öğeler vurgulanır; kaskad hissi eklenmez.

## Yayın sırası

1. Baykuş Madeni: görünürlük, tempo, ödül ve ses pilotu.
2. Birlikte kontrol ve onay.
3. Ortak sunum motoru çıkarımı.
4. Neon Kasası pilotu, sonra Kaptan Mercan, Şekerhane, Allah’ın Lütfu ve Kiraz Kulübü.

## Test kontrol listesi

- Sabit tohumla sonuç, ödeme ve kayıtlar değişmiyor.
- Aynı sütundaki 2 ve 3 araç farklı şeritlerde görünür.
- Normal/Turbo sıralaması, otomatik tur, mobil ve düşük güçlü cihazlar kontrol edilir.
- `prefers-reduced-motion` ile efektler güvenli biçimde sadeleşir.
- Sayım tam ödeme sonucunda biter; çift kredi veya çift ses oluşmaz.

## Araştırma notları

Sunum örnekleri, yalnızca tasarım davranışını incelemek için kullanıldı: [Sweet Bonanza](https://www.pragmaticplay.com/en/games/sweet-bonanza-slot/), [Gates of Olympus](https://www.pragmaticplay.com/en/games/gates-of-olympus-1000/), [Sugar Rush 1000](https://www.pragmaticplay.com/en/games/sugar-rush-1000/), [Bigger Bass Bonanza](https://www.pragmaticplay.com/en/games/bigger-bass-bonanza/), [Fire in the Hole 3](https://nolimitcity.com/games/fire-in-the-hole-3) ve [Money Train 4](https://www.relax-gaming.com/products/casino/moneytrain4). Hareket azaltma yaklaşımı için [W3C açıklaması](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) izlenir.

Baykuş için yeni sesler [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) ve [CC0 Sounds / Kenney RPG Audio](https://cc0-sounds.exi.software/collection/kenney_rpgaudio/) üzerinden CC0 kaynakla seçilir. Her indirilen dosyanın kaynak kaydı kendi `LICENSES.md` dosyasında tutulur.
