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

## Tüm slotlara aktarılacak sunum standardı

Bu maddeler oyun temasından bağımsızdır; her oyunun motoru ve gerçek sonucu korunarak uygulanır.

1. **Global çarpan finali:** Ortak çarpan, tek bir son sembole veya ara ödemeye uygulanmış gibi görünmez. Tüm kaskad, darbe, tumble ya da serbest dönüş bittiğinde gerçek ana kasa sabitlenir; çarpan yalnız bir kez bu toplama uygulanır.
2. **Ödül zirvesine zaman ver:** Global çarpan sahnesi hızlı geçilmez. Sıra: toplam PR kasası görünür → çarpan gelir → çarpma darbesi görünür → kesin final tutarı sıfırdan okunabilir hızda sayılır. Turbo bu anı yok etmez; yalnız kısaltır. Boş alana tıklama sunumu güvenle atlar.
3. **İşlevi hareket anlatır:** Scatter, yükseltici, kitap, anahtar, collector veya benzeri semboller açıklama kartıyla anlatılmaz. Kendi rozeti ve gerçek hedefe giden animasyonuyla ne yaptığını gösterir. Metin yalnız `+1 serbest dönüş` gibi sayısal olarak takip edilmesi gereken kazanılmış haklar için kullanılır.
4. **Gerçek hedef animasyonu:** Bir yükseltici/kitap/collector, motorun ürettiği gerçek hedef hücrelere gider; görsel hedefteki değer aynı anda değişir. Dekoratif veya rastgele hedef kullanılmaz.
5. **Ana akış durmaz:** Küçük kırılma, PR etiketi ve ara sayaç; sonraki darbe/kaskad/düşüşü durdurmaz. Aynı turdaki araçlar ve semboller kimliklerini korur; kaybolup yeniden oluşmaz. Aynı hatta birden çok araç şeritlenir.
6. **Bahis ve kontrol standardı:** Bahis klavyeden girilebilir. Kompakt standart tek bir “bet capsule”dır: merkezde doğrudan `PR` tutarı, iki yanında `− / +`, yanında MİN/MAKS ve üç nokta bulunur. Üç nokta, autoplay ile aynı görsel dilde açılan ayrı `Bahis Ayarları` penceresini açar; yarıya bölme, ikiye katlama ve adım seçimi burada kalır. Böylece kontrol dar ekranda yer kaplamaz fakat hiçbir bahis işlevi kaybolmaz. Boş oyun alanına tıklamak yalnız sunumu atlar, oyunun sonucunu değiştirmez.
7. **Kazanım görünür ve dürüsttür:** Kırılan blok/coin/küme gerçek PR tutarını kısa süre gösterir. Büyük kazanım kademesi yalnız kesinleşen sonuçtan belirlenir; sahte yakın kazanım veya ayrı bir ikinci ödeme gösterilmez.
8. **Ses ve erişilebilirlik:** Onaylı temel sesler korunur; yeni sesler oyun içindeki mevcut seslerle birlikte dinlenmeden eklenmez. `prefers-reduced-motion` desteği korunur.
9. **Para ve çarpan ayrımı:** Bakiye, bahis, blok/coin kazancı, ara kasa, tur toplamı ve final ödeme her zaman doğrudan `PR` olarak gösterilir. `×` yalnızca gerçek bir çarpanın kendisi için kullanılır. Oyuncuya `38× × 2×` gibi hesap yaptıran ara değerler gösterilmez; bunun yerine `380 PR × 2× → 760 PR` gibi, paranın sonucu anlaşılır biçimde sunulur.
10. **Büyük kazanım sayacı:** Bir tur, oyunun büyük kazanım eşiğine ulaştığında (örneğin Güzel/Büyük/Muhteşem/Efsanevi kademe), kesin ödeme tutarı ekrana tek karede düşmez. Final para sayacı `0 PR`dan gerçek son `PR` tutarına hızlı fakat okunabilir şekilde yükselir; kademe başlığı sayım sırasında ilgili eşiğe gelince değişir. Sayım ve başlık yalnız kesinleşmiş ödeme üzerinden üretilir; ekranda en az kısa bir onay anı kalır.
11. **Tek tip autoplay menüsü:** Tüm slotlarda Allah’ın Lütfu’ndaki menü kullanılır: `Turbo Spin`, `Quick Spin`, `Ekranları Atla`; 1–1.000 tur sürgüsü, 10/25/50/100/250/500/1.000 hazır seçimleri, toplam `PR` önizlemesi ve belirgin başlat/durdur durumu bulunur. Otomatik tur yetersiz bakiyede veya bonus tetiklenince güvenle durur.
12. **Özellik sonucu vaktinden önce açılmaz:** Kapalı sandık, çarpan madalyonu, gizem sembolü, çark veya benzeri özellikler inişte yalnız kapalı/dormant görselini gösterir. İçindeki değer DOM’da, etikette, başlıkta veya yan sayaçta kendi açılma animasyonundan önce görünmez. Akış `iniş → gerilim → açılma → hedefe taşıma → uygulama` sırasındadır.
13. **Tüketilen özellik geri belirmez:** Anahtar, kitap, sandık ya da tek kullanımlık sembol kaynağından ayrılıp hedefe uçtuğunda kaynak hücre tüketilmiş sayılır. Sonraki ara karede eski yerine bir anlığına geri gelmez; kimliği motor olayları boyunca korunur ve dönüşecekse ayrı, görünür bir dönüşüm olayı kullanılır.
14. **Tek ekranlık duyarlı oyun kabuğu:** Slot ekranı üst bilgi, esnek oyun sahnesi ve sabit kontrol iskelesi olmak üzere üç banttır; sayfa kaydırması üretmez. Oyun alanı yalnız genişliğe göre değil ekranın kısa kenarı ve kullanılabilir yüksekliğine göre ölçeklenir. Yarım genişlikli büyük monitörde ana oyun gereksiz küçülmez; 15 inç laptopta satır/hücre kaybolmaz; telefonda alt kontroller içeriği aşağı doğru uzatmaz.
15. **Dekor yerleşimi yönetmez:** Sunucu, muhafız veya karakter görseli masaüstünde oranı korunan bağımsız bir sahne kartıdır. Tahtayı daraltacak ya da yüksekliği belirleyecek kadar büyüyemez; tablet ve telefonda gizlenebilir. Şeffaf olmayan damalı arka planlar asla şeffaf görsel gibi kullanılmaz.
16. **Ortak sağlayıcı tipi alt iskele:** Temel bahis tutarı ile `− / + / …`, seçili oyun/mod, ana DÖNDÜR/ATLA ve hızlı eylemler tek alt iskelede kalır. Masaüstünde tek satır; orta genişlikte iki kompakt satır; telefonda ana spin sağda sabitken üç ince işlev satırı; kısa yatay ekranda yeniden tek satır kullanılır. `…` bahis ayrıntılarını, Auto Bet kendi penceresini açar; dar ekranda MİN/MAKS gizlenebilir ama işlevleri bahis penceresinde korunur.
17. **Duyarlı kabul matrisi:** Her slot kabuğu en az `1792×1900` yarım büyük monitör, `1366×768` laptop, `1024×768` tablet, `390×844` telefon, `360×640` kısa telefon ve `812×375` yatay telefon boyutlarında tarayıcıda doğrulanır. Belge genişliği/yüksekliği görünüm alanını aşmaz, kontrol iskelesi ekrandan çıkmaz, bütün oyun hücreleri kendi tahtasının içinde kalır ve ana özellik göstergesi tamamen kaybolmaz.

## Oyun bazlı planlar

### Baykuş Madeni — ilk pilot

**Sorunlar:** Aynı sütunda birden fazla kazma aynı koordinatta üst üste biniyor; darbe, kırılma, sandık ve ödül aynı anda yaşandığı için okunmuyor; mevcut Turbo oranı fazla sert.

**Uygulama sırası:**

1. Her `(dalga, sütun)` için kararlı şerit hesaplanır. İki kazma `- / +`, üç kazma `- / 0 / +` yatay şeritlere yerleşir; kaynak satırı üzerinden sonraki darbelerde aynı şeridi korur.
2. Düşüşler küçük bir gecikmeyle girer. Böylece aynı sütundaki araçların ikisi de görünür kalır.
3. Sunum evrelere ayrılır: makara → düşüş → darbe → blok kırılması/ödül → sandık → tur toplamı.
4. Blok ödülü ve sandık matematiği mevcut gerçek ödeme değerlerinden üretilir. Normal turda sandık tur sonucuna uygulanır. Özel oyunda blok kasası birikir; bonus içinde açılan sandık `×` değerleri birbiriyle çarpılmaz, toplanır. Finalde bu tek toplam çarpan animasyonla kasaya uygulanır ve bakiye o anda güncellenir.
5. Kitap geliştirmesi bağımsız kısa sahne, TNT ise ayrı şok ve hasar özeti olarak görünür.
6. Normal/Turbo için okunabilir taban süreler kullanılır; azaltılmış hareket medya tercihi korunur.
7. Kazma, blok, sandık ve kitap için CC0 ses katmanı eklenir; lisans kaynağı asset klasöründe saklanır.

**Kabul kriterleri:** Aynı sütundaki iki/üç kazma görünür; deterministik sonuç/ödeme değişmez; Turbo’da olay sırası okunur; sayaç gerçek sonuca eşit biter; mobil ve azaltılmış hareket görünümü bozulmaz.

### Neon Kasası

**Mevcut zincir:** 7×7 komşu sembol kümeleri patlar, boşluklar fiziksel olarak dolar, ekranda kalan güç küreleri tumble sonunda toplanır ve son toplam çarpan ana kasaya uygulanır.

**Neon uygulama sırası:**

1. Her kaskadın patlayan kümesi kısa neon patlaması ve gerçek `PR` etiketiyle görünür; bir sonraki düşüş bu etiket yüzünden durmaz.
2. Tüm kaskad bitmeden güç küresi kasaya uygulanmış gibi gösterilmez. Kümeler bittiğinde küreler kendi hücrelerinden merkez kasaya sırayla uçar.
3. Final güç sahnesi dört okunabilir adımda oynar: biriken `PR` kasa → kürelerden oluşan gerçek `×` toplamı → çarpma darbesi → `0 PR`dan kesin son ödeme sayacı. Sonuç, büyük kazanım eşiğinde kısa süre sahnede kalır.
4. MIRA yalnız scatter ve yüksek güç/kazanım olayında kısa, anlam taşıyan giriş yapar; sıradan kayıplarda gereksiz konuşma veya sahne oluşmaz.
5. Boş oyun alanına tıklama, o anki grid, kasa ve sağ paneli doğrudan gerçek son hâle taşır; kalan sayım/efekt baştan oynamaz.
6. Autoplay ve bahis kapsülü, ortak Allah’ın Lütfu menü/pencere standardını kullanır.

### Kaptan Mercan

Balıkların tek tek uzun gecikmeyle toplanması yerine kısa dalgalar ve kaptan sayacı kullan. Kanca/çekme anı yalnızca gerçek toplama sonucunda gösterilir.

### Şekerhane 1024

7×7 kaskad ve yapışkan çarpan noktalarını görünür odak yap. İlk kaskad daha uzun, sonrakiler daha kısa akar; mevcut normal/turbo uç değerleri dengelenir.

### Allah’ın Lütfu

Zengin olay sırasını koru. Tekrarlanan küçük olaylar özetlenir; anahtar, toplayıcı ve küresel çarpan tam sahne olarak kalır.

**Allah’ın Lütfu uygulama kuralları:**

1. Nur Gözü rastgele hücre seçmez. Soldaki sabit dokuz normal/premium sembol tabletinden bir tür açar; yalnız tahtadaki aynı tür semboller gerçek hedef olur. Altın/Zümrüt Göz seçimi bonus boyunca saklar ve sonraki tahtalarda yeni eşlerini tetikler.
2. Collector coin’leri ve daha önce değer taşımış diğer Collector’ları sütun okuma sırasıyla toplar. Coin uçuşu ile kese-keseye uçuşu görsel olarak ayrılır; ikinci kese önceki kesenin birikimini gerçek kaynak olarak alır.
3. Global kapanış dört okunabilir sahnedir: ana `PR` bankası → Global `×` gelişi → çarpma darbesi → `0 PR`dan kesin son ödemeye sayaç. Bu, turun en hızlı geçilen kısmı olamaz.
4. 5× ve üzeri büyük kazanımlarda sayaçla birlikte `Güzel / Büyük / Muhteşem / Efsanevi / Akılalmaz / Tarihi Kazanç` unvanı eşik geçildikçe değişir. Son tutar `PR` olarak görünür; kullanıcı ödeme için `×` hesabı yapmaz.
5. Boş oyun alanına tıklama, aktif animasyonu ve bütün sayaçları tek hamlede gerçek final değerine taşır. Etkileşim düğmeleri bu genel atlama alanını yanlışlıkla tetiklemez.
6. Bahis ana ekranda `MİN / − / yazılabilir PR / + / MAKS / …` kapsülüdür. Yarım, iki kat ve artış adımı `…` penceresindedir; autoplay mevcut ortak Allah’ın Lütfu düzenini korur.
7. Sol Göz tableti masaüstünde dikey, dar mobilde grid üstünde yataydır; hiçbir ekran genişliğinde oyunun ana özelliği tamamen gizlenmez. Kısa yatay ekranlarda grid, panel ve alt kontroller beraber ölçeklenir.
8. Çarpan Madalyonu inişte kapalı teal/altın mühürlü yüz taşır. `×` değeri yalnız çarpacağı anda kepenk açılışıyla görünür; ardından rozet gerçek coin/kese hedeflerine gider. Sonucun önceden görünmesi yasaktır.
9. Global anahtar hattı başlangıçta kilitlidir. Anahtar hücreden bara uçar, kaynak hücre kaybolur, mühür kırılır, üç hane tek tek döner; eski global değer gerilim boyunca korunur ve yeni toplam yalnız birleşme darbesinde yazılır.
10. Coin, Collector ve Max Coin yüzleri para tutarını doğrudan `PR` gösterir. Board/Global çarpan yüzleri `×` gösterir. Aynı görsel sayı iki farklı matematik türüymüş gibi kullanılmaz.
11. Nur Muhafızı masaüstünde oyun tahtasının sağındaki canlı sahne eşidir; küçük ekranda tahtayı daraltmamak için gizlenebilir. Bonus portalı, bonus yükseltme, Max Coin ve scatter kilitleri bir anda değişen statik metin yerine kendi geçiş sahnelerine sahiptir.

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

Baykuş için olası ek bonus sesleri [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) üzerinden araştırılır; paket CC0 lisanslıdır. Normal kazı sesleri mevcut, beğenilmiş ses eşlemelerinde kalır. Yeni bir bonus jingle'ı ancak oyun içindeki mevcut seslerle birlikte dinlenip uygun bulunduğunda eklenir.
