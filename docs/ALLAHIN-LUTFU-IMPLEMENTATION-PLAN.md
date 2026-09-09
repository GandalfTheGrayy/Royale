# Allah’ın Lütfu — eksiksiz uygulama planı

Bu belge, Valkyrie’nin **Odin’s Vault** oyunundaki doğrulanmış kuralları ve yoğun özellik/animasyon akışını Pehlevan Royale’e özgün bir sanat diliyle taşıyacak **Allah’ın Lütfu** oyununun kalıcı uygulama kaydıdır. Uygulama yarıda kalırsa bu dosyadaki durum tablosundan devam edilir.

## 1. Kaynak ve güven düzeyi

- **[RESMÎ]** Stake oyun sayfası: 5×6 grid, 28 ödeme çizgisi, 96,70 RTP, yüksek volatilite, 500.000× üst sınır, 0,10–50 bahis aralığı, sembol/coin tabloları, dört free-spin modu ve satın alma bedelleri.
  - https://stake.com/tr/casino/games/valkyrie-odins-vault
- **[OYUN KAYDI]** Win.gg’deki gerçek FU Spin ekranı: sol Eye paneli, merkez 5×6 alan, üst Global Multiplier hattı, sağ karakter, coin/modifier ağırlıklı tek-spin-respin akışı.
  - https://win.gg/xqc-hits-200000-dream-board-on-odins-vault/
- **[OYUN KAYDI]** Aynı kayıtta iki Coin Upgrader + Collector + Super Collector ile başlayan bir spin; Collector sonrasında Mystery alanlarının tekrar dolması, respin’ler, Board Multiplier’ın bir hücre yarıçapındaki coin’lere uygulanması ve aynı “spin”in yaklaşık bir dakika sürmesi açıklanıyor.
- **[OYUNCU GÖZLEMİ + CANLI UYGULAMA DOĞRULAMASI]** Coin/semboller yukarıdan kayarak gelir; Göz sağa/sola ve hedef ızgaraya bakar, M işaretlerini hedeflere yollar. Mystery sonuçları soldan sağa ve her sütunda yukarıdan aşağıya tek tek akar. Anahtar üç haneyi sırayla döndürür; çarpan hedefe, coin değerleri collector’a görünür uçuşlarla taşınır.
- **[2026-09-03 TAM AKIŞ DENETİMİ]** Resmî özellik listesi ve gerçek FU Spin kaydı motor olaylarıyla yeniden karşılaştırıldı. Normal/premium semboller temel makara/sol Göz seçimine aittir; Mystery çözüm havuzu yalnız coin ve özel özelliklerden oluşur. Collector’ın topladığı coin konumları yeni Mystery ödülleri için tekrar döner; Upgrader yalnız sonraki üretim tabanını değiştirir.
- **[2026-09-03 MATEMATİK DENETİMİ]** Canlı veritabanındaki 206 turda eski profil yaklaşık %22.195 gözlenen RTP ve 37 max-win üretti. Ayrıntılı kayıt `ALLAHIN-LUTFU-MATH-AUDIT.md` dosyasındadır. Normal/Mystery şeritleri ayrıldı, Collector çoğalma oranı düşürüldü, bütün ara değerler sınırlandı ve her maliyet profili sabit seed simülasyonuyla ayrı kalibre edildi.
- **[2026-09-03 COIN ÖDEME DÜZELTMESİ]** Resmî sayfadaki ayrı “coin wins” tanımı ve FU oyun kaydı yeniden karşılaştırıldı. Keseye girmeden final tahtasında kalan coin’ler kendi yüz değerleriyle öder; Collector önceki değerleri hafızasına alır ve yalnız o zincirin aktif Mystery kökenli hücrelerini yeniden döndürür. Normal makara hücreleri değişmez; keseye daha önce yazılmış doğrudan coin finalde ikinci kez sayılmaz. Final ödeme `çizgi + ödenmemiş final-tahta coin + Collector` toplamıdır.
- **[2026-09-03 MYSTERY YAŞAM DÖNGÜSÜ DENETİMİ]** Resmî özellik listesi ile gerçek FU kaydı yeniden karşılaştırıldı. Tricksterspin ayrı bir volatilite modudur; Collector normal makaraya serbestçe bırakılamaz, yalnız Mystery’den açılır. Mystery’den açılan Göz, çarpan, yükseltici, Redrop ve anahtar önce görevini tamamlar, bütün okuma sırası bittikten sonra aynı hücre yeniden dönerek coin’e yerleşir; Collector bu dönüşümlerden sonra çalışır. Yazılı resmî sayfa son coin dönüşünün zamanlamasını açıkça tarif etmediği için bu ayrıntı oyun kaydı ve gözlenen istemci akışıyla doğrulanmış uygulama çıkarımıdır.
- **[2026-09-05 NORMAL TAMBUR + ÖZEL MENÜ DENETİMİ]** Normal tamburdan doğrudan coin tamamen kaldırıldı; açılış şeridi yalnız ödeme sembolü, Odin’s Eye karşılığı Nur Gözü ve Scatter üretir. Coin ve bütün coin modifier’ları Eye/FU/Collector kaynaklı Mystery çözüm şeridine aittir. Resmî sayfa enhancer maliyetlerini ve bunların volatilite anahtarı olduğunu açıklar fakat kapalı RNG yüzdelerini yayımlamaz; bu nedenle Eye ve Scatter olasılıkları her mod için ayrı, şeffaf admin ayarlarıdır. Hilebaz Dönüş Eye ağırlıklı; Lütuf Arttırıcı Scatter ağırlıklı varsayılan profille gelir. Altı seçenekli özel oyun menüsü resmî 3×/25×/75×/5.000×/200×/1.000× yapısını tek ekranda gösterir.
- **[2026-09-08 GÖZ TABLETİ + COLLECTOR ZİNCİRİ DENETİMİ]** Resmî açıklama ve referans ekran yeniden incelendi. Nur Gözü rastgele hücre seçmez: normal/premium sembol listesinden bir tür seçip soldaki sabit dokuz yuvalı tablete ekler; tahtada yalnız seçilen türün bütün eşleri Mystery olur. Altın/Zümrüt Göz ile açılmış türler bonusun sonraki tahtalarında kalır ve yeni eşlerini tetikler. Mystery’den çıkan yeni Göz de aynı kuralı kullanır. Collector’lar okuma sırasıyla çalışır; sonraki kese coin’lerle birlikte daha önce değer taşımış keseyi de toplar. Kese-keseye uçuşu ayrı görsel kaynak olarak gösterilir.
- **[2026-09-09 SUNUM VE BİLGİ SIZINTISI DENETİMİ]** Resmî özellik listesi, FU Spin kaydı ve oyun içi tarayıcı akışı yeniden karşılaştırıldı. Çarpan Madalyonu değerini inişte göstermez; kapalı/mühürlü yüzle bekler, yalnız hedefe uygulanacağı sırada açılır. Semavi Anahtar üst haneye uçtuktan sonra kaynak hücrede yeniden görünmez. Üst global hane kilitli başlar, ilk anahtar geldiğinde açılır; hane toplamı gerilim karesinden sonra ayrı bir uygulama karesiyle global değere yazılır. Böylece RNG sonucu hiçbir sahnede kendi animasyonundan önce görünmez.
- **[2026-09-05 ORİJİNAL TEMPO DÜZELTMESİ]** Normal sunumda Göz bakışları, hedef ışını, Mystery’nin inişi/dikey dönüşü/açılışı, işlevin coin’e dönüşü ve Collector uçuşları artık görsel animasyon tamamlanmadan sonraki olaya geçmez. Mystery hücreleri tek tek okunabilecek tempoda ilerler. Turbo süreleri ayrı tutulduğu için hızlı oyun seçeneği etkilenmez.
- Arama motorunda görülen 5×3 / 20 çizgi / %98 bilgileri resmî sayfayla çeliştiği için kullanılmaz.

## 2. Tema ve özgün eşleme

| Odin’s Vault işlevi | Allah’ın Lütfu adı / varlığı |
|---|---|
| Odin’s Eye | Nur Gözü: mavi / altın / zümrüt |
| Mystery | Gizem Küresi |
| Collector | Lütuf Toplayıcı |
| Super Collector | Çifte Lütuf Toplayıcı |
| Coin Upgrader | Lütuf Yükseltici |
| Redrop | Redrop · Yeniden Düşürme |
| Board Multiplier | Çarpan Madalyonu, 2×–20× |
| Global Multiplier Key | Semavi Anahtar |
| Dragon Scatter | Yedi Kat Lütuf Scatter |
| left/right wheels | Kudret Çarkı / Rahmet Çarkı |
| Odin character | Nur Muhafızı v3: sarık, sakal, kaftan, tek Davut Yıldızı, tek baykuş |

Kutsal metin, Arapça hat ve gerçek bir tanrı/peygamber portresi kullanılmaz. Nur Muhafızı kurgusal ve ölümlü bir oyun muhafızıdır.

## 3. Kesin oyun kuralları

### Ana alan ve çizgi ödemeleri

- 5 reel × 6 satır; 28 sabit çizgi.
- Aynı sembolden 3+ adet, en soldaki reelden başlayıp bitişik reellerde devam ederse öder.
- Bir bahis birimi için 3/4/5 eşleşme tablosu:
  - rozet: 0,10 / 0,20 / 0,40
  - kandil: 0,10 / 0,20 / 0,50
  - hilal: 0,10 / 0,20 / 0,70
  - hayat ağacı: 0,20 / 0,50 / 1,00
  - altın baykuş: 1 / 2 / 3
  - Davut Yıldızı: 1 / 2 / 4
  - nur kapısı: 1 / 2 / 5
  - bereket eli: 2 / 3 / 10
  - yakut nar: 2,2 / 5 / 15
  - semavi anahtar: 2,5 / 10 / 25 (normal sembol olarak geldiği durumda)
- Son tahtada görünen bütün coin yüz değerleri, Collector gelmemiş olsa bile doğrudan `coin win` olarak öder.
- Daha önce Collector’a uçmuş coin’ler final tahtadan silindiği için yalnız kesenin sakladığı `collector win` kalemine girer; yeni tahtadaki coin’lerle çakışmaz.
- Toplam ödeme `(çizgi + final-tahta coin + Collector) × Global Multiplier` formülüdür ve 500.000× ile sınırlandırılır.

### Coin ve modifier katmanı

- Mystery normal makaraya bağımsız bir sonuç olarak inmez; yalnız Göz, FU Spin veya Collector yeniden dağıtımı tarafından üretilir.
- Normal makaraya coin, Collector, Global Key, Board Multiplier, Coin Upgrader, Redrop veya Max Coin doğrudan inmez. Bunlar yalnız Mystery sonuç şeridine aittir; normal şerit normal sembol, Göz ve Scatter ile sınırlıdır. Bu kural Hilebaz Dönüş dahil bütün ücretli modlarda aynıdır.
- Mystery hiçbir zaman rozet, kandil, hilal, ağaç, baykuş, Davut Yıldızı, kapı, el, yakut nar veya normal semavi-anahtar ödeme sembolüne açılamaz. Yalnız coin, Göz, Collector, Super Collector, Upgrader, Redrop, Board Multiplier, Scatter, Global Key veya Max Coin üretebilir.
- Mystery’den açılmış hücre `fromMystery` kökenini özellik zinciri boyunca korur. Arayüz bu hücreleri turkuaz/lacivert ayrı zemin ve köşede metinsiz, soyut bir köken rünüyle gösterir.
- Mystery’den açılan geçici işlevler okuma sırasındaki görevlerini tamamlar. Göz, Board Multiplier, Upgrader, Redrop ve Global Key hücreleri daha sonra yeniden dikey dönerek geçerli minimum katmandan coin olur; Collector/Super Collector yerinde kalır ve bu dönüşümler tamamlandıktan sonra toplar. Scatter ve Max Coin kendi kapanış kurallarını korur.
- Bronz: 1×, 2×, 3×, 4×
- Gümüş: 5×, 10×, 15×
- Altın: 25×, 50×, 100×
- Safir: 150×, 200×, 250×, 500×
- Yakut: 750×, 1.000×, 2.500×, 5.000×
- Elmas: 10.000×, 25.000×, 50.000×
- Max Lütuf Coin doğrudan 500.000× üst sınıra gider.
- Çarpan Madalyonu coin ve dolu collector/kese değerlerine 2×–20× uygular.
- Board Multiplier kendi çevresindeki bir hücre yarıçapındaki hedeflere önce çarpan rozetini fırlatır, sonra değeri ve gerekiyorsa coin rengini yeni katmana geçirir.
- Lütuf Yükseltici ekranda zaten görünen coin’lerin değerine/rengine dokunmaz ve her asa ayrı bir kademe biriktirir: ilk asa bronzu, ikinci asa gümüşü, üçüncü asa altını sonraki üretim havuzundan çıkarır; sırasıyla minimum gümüş, altın, safir, yakut ve elmas tabanına ilerler. Mystery açılışında asa görülür görülmez uygulanır; aynı soldan sağa, sütun içinde yukarıdan aşağı sırada ondan sonra üretilen coin yeni tabanı kullanır. Bu durum aynı bahis içindeki bütün sonraki Mystery, Collector-respin ve Redrop üretimlerinde korunur.
- Redrop · Yeniden Düşürme, Odin’s Vault’taki `Redrop` sembolünün doğrudan karşılığıdır: bütün normal/premium ödeme sembollerini temizler, coin/modifier/collector hücrelerini korur ve boşlukları yukarıdan yeniden doldurur.
- Lütuf Toplayıcı alandaki coin’leri ve diğer dolu collector değerlerini soldan sağa, her sütunda yukarıdan aşağıya sırayla kendi sayacına çeker; sayaç her uçuşta artar ve kese üzerinde `K` kısaltmasıyla canlı görünür. Toplama bittiğinde yalnız aynı özellik zincirinde aktif `fromMystery` kökeni taşıyan, Collector olmayan hücreler yeniden Mystery’ye döner. Normal makara sembolleri yerinde kalır. Yeni Mystery sonuçları o ana kadar birikmiş minimum coin katmanıyla üretilir.
- Collector zinciri bittiğinde son yeniden-dönüş tahtasında kalan coin’ler keseye girmemiş olsalar da yüz değerleriyle ödenir. Böylece kesesiz FU sonucu sıfıra düşmez; kese uzatma/toplama işlevini görür.
- Çifte Lütuf Toplayıcı aynı toplamayı iki tur çalıştırır; ilk toplama sonrası oluşan yeni mystery/coin sonuçları ikinci turda tekrar toplanabilir.
- Collector’ın tetiklediği özellik zinciri bitmedikçe bahis kapanmaz; tek bahis çok sayıda iç-respin üretebilir.

### Nur Gözü ve sol panel

- Gridde duran Göz uyanır; sağ/sol bakışlarından sonra normal/premium sembol tabletinden henüz açılmamış bir tür seçer. Öncelik o an tahtada eşi bulunan türe verilir; yalnız seçilen türün bütün eşleri Mystery olur ve coin, anahtar, collector/kese, çarpan, upgrader, redrop veya başka bir Göz açabilir.
- Sol panel rastgele hedef listesi değil, dokuz normal/premium sembolün sabit tabletidir. Kapalı türler silik; seçilen tür kendi sabit yuvasında renkli ve parlayan hâle gelir.
- Mavi Göz normal tur sonunda temizlenebilir.
- Altın ve Zümrüt Göz Super, Legendary ve Mythic bonus boyunca seçilmiş türleri kalıcı tutar; her yeni bonus tahtasında açılmış türlerin yeni eşleri topluca tetiklenir.
- Bakış animasyonu `look-left` → `look-right` → `look-up` → `look-down-grid` sırasını izler; ardından seçilen sembol görseli her gerçek eşleşme hücresine ayrı uçar. Bağımsız/rastgele `M` hedefi üretilmez.

### Global Multiplier

- Üçlü global hane oyun başında mühürlüdür. İlk Semavi Anahtar hücreden üst bara uçar, kaynak hücre tüketilir ve mühür kırılmadan haneler dönmez.
- Semavi Anahtar üstteki üç ayrı çarpan hanesini açar. Haneler 1 → 2 → 3 sırasında dikey slot gibi döner ve tek tek kilitlenir.
- Aynı özellik zincirinde birden fazla Semavi Anahtar çok düşük ihtimalle bulunabilir. Her anahtar üç hanenin tamamını yeniden çevirir; yeni üç değer mevcut hanelere eklenir. Örneğin iki anahtar altı çarpan sonucu üretir. Hane toplamı (varsayılan 100× tavanıyla) ekranda görülen Global Multiplier olur.
- Kudret (sol/kırmızı karşılığı) ve Rahmet (sağ/beyaz karşılığı) çarkları ayrı dönüş olayı üretir.
- Çark sonucu global değere eklenir/uygulanır; aktif değer hem çizgi hem coin kazançlarını çarpar.
- Çarpan sonucu ödeme sayımından önce görünür. `global-merge` gerilim karesinde üst bar eski değeri korur; yalnız sonraki `global-merge-apply` karesinde yeni toplam sayı birleştirme animasyonuyla yazılır.

### Free-spin modları

- 3 Scatter: 10 Lütuf Dönüşü.
- 4 Scatter: 10 Büyük Lütuf.
- 5 Scatter: 10 Efsanevi Lütuf.
- Düz çizgide veya V deseninde 5 Scatter: 10 Mitik Lütuf.
- Super/Efsanevi/Mitik modda Nur Gözü sabit/persistent kalır.
- Bonus sırasında gelen Scatter modu bir üst seviyeye yükseltir; Mythic üst sınırdır.
- Mitik Lütuf’ta ilk coin-feature zinciri Lütuf Yükseltici garantilidir.

### Satın alma / enhancer seçenekleri

- Lütuf Arttırıcı: tur başına 3×.
- Deli Cesareti: tur başına 25×.
- Hilebaz Dönüş: tur başına 75×.
- FU Spin karşılığı **Kaderin Hükmü**: tur başına 5.000×; ilk 5×6 alanın tamamını Mystery doldurur.
- Bonus Buy: 200×.
- Super Bonus Buy: 1.000×.
- Satın alma tutarı onay penceresinde bahis × maliyet, kalan bakiye ve hedef modla açıkça gösterilir.

## 4. Deterministik motor modeli

Motor UI’dan ayrıdır ve tek bir seed/RNG akışı alır.

```text
SpinRequest
  wager, mode, bonusState?, forcedScenario?
      ↓
InitialDrop (5×6)
      ↓
LineEvaluation
      ↓
FeatureQueue[]
      ↓
EyeLook → TabletSymbolUnlock → MatchingSymbolFlights → MysteryRoll/Reveal (sütun-okuma sırası)
    → KeySlots(1→2→3) → BoardMultiplierCast/Apply
    → CoinUpgrade → RedropColumns
    → CompletedModifierRerollToCoin
    → CollectorFlights/Merge → SuperCollectorPass2 → Respins (gerekirse döngü)
      ↓
GlobalMultiplier
      ↓
Scatter/BonusUpgrade
      ↓
Settlement (500.000× cap)
```

Ana tipler:

- `AllahSymbolId`, `AllahCell`, `AllahGrid`
- `CoinTier`, `CoinValue`, `CollectorState`
- `AllahFeatureEvent` (UI’nın oynatacağı değişmez olay günlüğü)
- `AllahSpinRequest`, `AllahSpinResult`
- `AllahBonusState`, `AllahPersistentState`
- `AllahPurchaseMode`

Motor, final grid dışında **her ara durumu** olay kaydına yazar. UI rastgele karar vermez; yalnızca motor olaylarını sırayla oynatır.

## 5. Animasyon olay kuyruğu

Her olay `id`, `type`, `durationNormal`, `durationTurbo`, `cells`, `payload` taşır. Kullanıcı “atla” dediğinde süre sıfırlanabilir fakat olay sırası ve ödeme değişmez.

1. `spin-commit`: bakiye düşer, spin düğmesi kilitlenir.
2. `guardian-ack`: Muhafız nefes/baş hareketi, baykuş göz kırpması.
3. `column-feed`: her sütun üstten 80–120 ms şaşırtmalı kayar; semboller tek tek esneyerek oturur.
4. `reel-impact`: sütun tabanında ışık/toz halkası.
5. `payline-trace`: kazanan çizgi soldan sağa çizilir.
6. `symbol-pulse`: kazanan semboller sıralı nefes alır.
7. `eye-wake`: Göz kapağı açılır, iris parlar.
8. `eye-look-*`: hedef konumuna bakış; 150 ms overshoot + merkezleme.
9. `eye-slot-fill`: seçilen sembol dokuzlu tablette kendi sabit yuvasında açılır.
10. `eye-ray`: seçilen sembol görseli Göz’den yalnız tahtadaki gerçek eşlerine uçar.
11. `eye-symbol-trigger`: bonus boyunca kalıcı tablette açık olan sembol, yeni tahtadaki bütün eşlerini tek dalgada tetikler.
12. `mystery-seed`: Gizem Küreleri yalnız bu eşleşen hedef hücrelere dalga halinde yerleşir.
13. `mystery-roll`: hücre içindeki yalnız coin/özellik şeridi dikey akar. Hücreler sütun okuma sırasını izler; normal ödeme sembolleri bu şeritte bulunmaz.
14. `mystery-reveal`: yalnız o anki tek hücre kilitlenir, coin/özellik sonucunu açar ve hücreye kalıcı `fromMystery` kökeni yazar.
15. `key-flight` → `key-vault-open`: Semavi Anahtar üst bara uçar ve üç haneyi açar.
16. `key-slot-spin` → `key-slot-lock`: haneler soldan sağa dikey döner ve değerleri tek tek kilitler.
17. `wheel-anticipation` → `wheel-spin` → `global-merge` → `global-merge-apply`: çark ve üç hane toplamı önce bekletilir, sonra görünür Global Multiplier’a birleşir; yeni değer erken karede sızmaz.
18. `board-multiplier-anticipation`: madalyon mühürlü yüzle titrer; gerçek `×` değeri DOM’da/görselde henüz açılmaz.
19. `board-multiplier-reveal` → `board-multiplier-wake`: mühür iki yana açılır, gerçek çarpan görünür ve hedef listesi belirlenir.
20. `board-multiplier-cast`: `×N` rozeti kaynaktan her coin/dolu keseye ayrı uçar.
21. `board-multiplier-apply` → `board-multiplier-wave`: hedef değeri ve coin katman rengi güncellenir; son halka yayılır.
22. `coin-upgrader-charge` → `coin-upgrader-apply`: mevcut coin’ler değişmeden kalır; üretici minimumu bir katman yükselir ve sol panelde yeni taban gösterilir.
23. `redrop-clear`: yalnız normal/premium semboller nur parçacığına dönüşür.
24. `redrop-fall`: korunmuş feature hücreleri sabit kalır; her sütun ayrı olayla yukarıdan doldurulur.
25. `modifier-coin-roll`: Mystery’den açılmış ve görevini bitirmiş geçici işlev hücresi yeniden dikey döner.
26. `modifier-coin-land`: aynı hücre, o andaki Upgrader tabanına uyan yeni coin’e yerleşir.
27. `collector-wake`: çanta/collector bütün geçici işlevlerin coin dönüşü bittikten sonra açılır, sayaç büyür.
28. `coin-flight`: her kaynak üzerindeki gerçek para tutarı `PR` olarak sütun okuma sırasıyla keseye uçar; yalnız gerçek çarpanlar `×` ile yazılır.
29. `collector-merge`: her uçuş sonrasında kese sayacı anında artar; son olay birleşme vurgusudur.
30. `super-collector-reset`: kısa geri tepme ve ikinci çekim halkası.
31. `feature-respin`: Yalnız aktif Mystery kökenli, Collector olmayan hücreler Mystery’ye dönüp aynı sırayla yeniden açılır; normal makara hücreleri korunur, upgrader tabanı saklanır ve özellik kuyruğuna geri dönülür.
32. `scatter-lock`: scatter’lar sırayla kilitlenir, 3/4/5 gerilim katmanı.
33. `bonus-portal`: seçilen bonus görseli açılır; grid/sol panel durumuna göre geçiş.
34. `bonus-upgrade`: mevcut bonus kartı parçalanıp bir üst kartla birleşir.
35. `payout-count`: çizgi + coin + collector × global hesabı ayrı satırlar halinde sayılır.
36. `win-tier`: Nice / Great / Epic / Insane / Divine win katmanı; büyük başlık gridin tamamını kalıcı kapatmaz.
37. `settlement`: net sonuç, bakiye, geçmiş ve telemetri tek atomik adımda yazılır.
38. `return-idle`: bütün geçici sınıflar ve sesler temizlenir.

Erişilebilirlik: `prefers-reduced-motion` açıkken kaymalar cross-fade’e, sayaçlar tek adıma iner; sonuç sırası değişmez.

## 6. UI yerleşimi

- Sol: dikey uzun Nur Gözü kulesi + dokuz sembollü sabit seçim tableti + asa kademesi; dar mobilde bu alan gizlenmez, grid üstünde yatay şeride dönüşür.
- Orta: ekranın açık ara en büyük bölümü olan 5×6 oyun alanı; üstünde Global Multiplier hattı ve iki küçük çark.
- Sağ: daraltılmış Nur Muhafızı v3; mobilde gridin arkasına değil, görünüm dışındaki yardımcı panele taşınır.
- Alt: merkezde doğrudan yazılabilir kompakt `PR` bahis kapsülü, `MİN / − / + / MAKS / …`; `…` penceresinde artış adımı, ½ ve 2×; yanında mod seçimi, Auto Bet, Turbo ve spin/atla.
- Sonuç özeti: “Bu el”, “Toplam coin”, “Global ×”, “Ödeme”, “Net” açıkça görünür.
- Bilgi/rules paneli oyun ekranını kalıcı sıkıştırmaz; katman olarak açılır.

## 7. Ses ve yaşam döngüsü

- Ayrı müzik ve FX ses seviyeleri; ikisinde de kapatma.
- Olay imzaları: sütun düşüşü, göz açılışı/bakışı, mystery çatlama, anahtar, iki çark, upgrader, redrop, coin uçuşu, collector darbesi, scatter gerilimi, bonus yükseltme, win tier.
- `onBack`, component unmount ve oyun değişiminde:
  - HTMLAudioElement durdurulur, `src` kaldırılır.
  - AudioContext kapanır.
  - tüm timeout/RAF/animation waiter çözümlenir.
  - speech synthesis iptal edilir.
  - auto bet durur.

## 8. Test matrisi

- 28 çizginin her biri için 3/4/5 eşleşme.
- Soldan başlamayan ve arada boşluk olan eşleşmenin ödememesi.
- Her coin katmanı ve sınır değeri.
- Board Multiplier yalnız 1 hücre yarıçapını etkiler.
- Upgrader en düşük aktif katmanı kaldırır.
- Redrop feature hücrelerini korur.
- Collector ve Super Collector sıralaması / ikinci geçişi.
- Collector kaynaklı respin üst sınırı ve sonsuz döngü koruması.
- Global Multiplier çizgi + coin toplamına uygulanır.
- Max coin ve toplam 500.000× cap.
- 3/4/5/V/düz scatter mod seçimi.
- Bonus içi scatter upgrade ve Mythic first-coin-feature upgrader garantisi.
- 3× / 25× / 75× / 5.000× / 200× / 1.000× maliyetler.
- Yetersiz bakiye; bonus ortasında yenileme/restore.
- Auto bet stop-on-win/loss/balance; unmount temizliği.
- Normal/turbo/reduced-motion olay sırası eşitliği.
- Mystery’nin normal makara üretim havuzunda bulunmaması; yalnız Göz/FU/Collector kaynaklı olması.
- Coin’in normal makara/Redrop üretim havuzunda bulunmaması; yalnız Mystery çözümünden gelmesi.
- Mystery sonuç havuzunda hiçbir seed altında normal ödeme sembolü bulunmaması ve her açılan hücrenin `fromMystery` kökenini taşıması.
- Hilebaz Dönüş dahil hiçbir normal/ücretli makara sonucunda Collector bulunmaması; Collector’ın yalnız Mystery kökenli olması.
- Mystery kökenli geçici işlevlerin görev sonrası coin’e dönmesi ve Collector’ın bu dönüşümleri sonradan toplaması.
- Build + bütün mevcut testler.

## 9. Uygulama durumu

- [x] 33 özgün oyun varlığı üretildi.
- [x] Nur Gözü tabletinin dokuzuncu gerçek normal sembolü olarak şeffaf zeminli `Yakut Nar` üretildi; Global Anahtarın sahte normal sembol olarak tekrar kullanımı kaldırıldı.
- [x] Nur Muhafızı İslami kaftan/sarık/sakal, belirgin baykuş ve tek Davut Yıldızıyla v3’e yükseltildi.
- [x] Resmî kurallar, gerçek FU Spin ekranı ve bilinen uzun collector zinciri incelendi.
- [x] `allahin-lutfu-engine.ts` + deterministik testler; ara olaylar kendi grid/çarpan/collector snapshot'ını taşıyor.
- [x] `AllahinLutfu.tsx` + sütun sütun açılan, ara sonucu sızdırmayan olay kuyruğu oynatıcısı.
- [x] `allahin-lutfu.css` + responsive/reduced-motion.
- [x] Nur Gözü için sabit dokuz sembollü tablet; yalnız seçilen sembolün gerçek grid eşlerine görselli uçuş, bonus tahtalarında kalıcı seçimin yeniden tetiklenmesi ve rastgele hedef üretiminin kaldırılması.
- [x] Mystery sonuç havuzundan bütün normal ödeme sembolleri çıkarıldı; çoklu seed regresyon testi eklendi.
- [x] Mystery normal makara havuzundan çıkarıldı; yalnız Göz/FU/Collector kaynaklı üretim için regresyon testi eklendi.
- [x] Collector, Global Key, Board Multiplier, Coin Upgrader, Redrop ve Max Coin normal makara/Redrop üretiminden çıkarıldı; yalnız Mystery sonuçlarına bağlandı.
- [x] `weighted-feature-queue-v5-active-mystery-respin` ile kese yeniden dönüşü aktif Mystery hücreleriyle sınırlandı; final tahta coin ödemesi Collector birikiminden ayrıldı.
- [x] Mitik garantili Upgrader normal ilk düşüşten çıkarıldı; ilk gerçek Mystery açılışına taşındı.
- [x] Mystery ve Mystery’den açılmış hücrelere ayrı zemin, çerçeve ve açıklama yazısı gibi görünmeyen küçük soyut köken rünü eklendi.
- [x] Üç sıralı anahtar hanesi; her anahtarda üç yeni sonuç, çoklu anahtarda hane bazında birikim ve hane toplamıyla Global Multiplier.
- [x] Board Multiplier’ın hedefe görünür `×N` atışı; coin/kese değer ve coin-renk güncellemesi.
- [x] Board Multiplier için özgün şeffaf kapalı madalyon varlığı; iniş/gerilim sırasında değeri saklayan çift kepenk ve yalnız uygulama anında açılan yüz.
- [x] Semavi Anahtar hanesinin mühürlü başlangıcı, anahtar uçuşundan sonra kaynak hücrenin tüketilmesi ve global toplamın gerilim/uygulama olarak iki ayrı karede gösterilmesi.
- [x] Coin/collector değerlerinin okuma sırasıyla keseye uçması ve kesenin her uçuşta canlı `K` sayımı.
- [x] Sonraki Collector’ın daha önce dolmuş Collector’ı toplaması için motor regresyonu ve coin uçuşundan ayırt edilen kese-keseye görsel uçuş.
- [x] Her Upgrader’ın ayrı kademe biriktirerek bronze → silver → gold → sapphire → ruby → diamond tabanına ilerlemesi; Mystery sırasında anında uygulanıp sıradaki hücrenin üretim tabanını değiştirmesi ve mevcut coin’lere dokunmaması.
- [x] Collector sonrasında yalnız aktif Mystery kökenli hücrelerin yeniden dönmesi; normal makara alanlarının yerinde kalması ve yükseltilmiş tabanın korunması.
- [x] Mystery kökenli Göz/çarpan/yükseltici/Redrop/anahtarın görev sonrasında sırayla coin’e dönmesi; Collector’ın bütün bu dönüşümlerden sonra çalışması.
- [x] Oyuna giriş bildirimi; 10×/100×/1.000×/10.000× katmanlarında kitap, yarılan deniz, yarılan ay ve gemi temalı özel kazanç sahneleri; FU ve free-spin bitiş toplamı. Salona çıkışta gereksiz oturum özeti gösterilmez.
- [x] Collector olmasa da final tahtadaki coin toplamının ödenmesi; kesedeki geçmiş değerlerle final coin’lerin iki kez sayılmaması ve arayüzde `COIN + KESE` toplamının gösterilmesi.
- [x] Yan paneller daraltıldı; 5×6 oyun tahtası masaüstü görünümün baskın/ana bölümü yapıldı.
- [x] Mevcut şeffaf/koyu Nur Muhafızı kaynağı masaüstü sağ paneline yeniden oturtuldu; damalı türev kullanılmıyor.
- [x] `ATLA` tek tıkla kalan olay kuyruğunu final duruma geçiriyor.
- [x] Boş oyun alanına tıklama da sayaçlar dahil bütün sunumu gerçek final kareye taşıyor; 5× üstü sahnelerde `PR` sayacı ve kazanım unvanı ortak eşiklerle ilerliyor.
- [x] Global çarpan kapanışı `ana PR bankası → gerçek × → darbe → 0'dan kesin PR` sırasıyla ayrı, uzun sahne olarak çalışıyor.
- [x] Masaüstünde sabit panel, telefonda yatay sembol tableti, 380 px altı sıkı düzen ve kısa-yatay ekran ölçeği için responsive kurallar eklendi.
- [x] Ortak `slot-game-shell` altyapısı eklendi: tek görünüm yüksekliğinde üst bar + esnek sahne + sağlayıcı tipi kontrol iskelesi; masaüstü, orta genişlik, portre telefon, kısa portre ve kısa yatay yerleşimleri ayrı sözleşmelere bağlandı.
- [x] `1793×1902`, `1366×768`, `390×844`, `360×640` ve `812×375` görünümleri gerçek tarayıcıda ölçüldü; 5×6 hücrelerin tahta içinde kaldığı, belgenin kaydırma üretmediği ve alt iskelenin görünüm alanında bittiği doğrulandı.
- [x] Nur Muhafızı panelinin yüksekliği oyunu belirleyen uzun şeritten 2:3 oranlı sahne kartına çevrildi. Piksellerine dama deseni gömülü sahte şeffaf türev kaldırıldı; temiz koyu arka planlı kaynak kullanıldı ve küçük ekranlarda tahta lehine gizlendi.
- [x] Kısa yatay ekranda Nur Gözü + Global çarpan + kazanç bilgisi sol sütuna, 5×6 tahta sağ sütuna taşındı; kontroller tek alt satırda tutuldu. Böylece tahta okunamaz bir küçük resme dönüşmeden ana özellik tablosu görünür kaldı.
- [x] Mobil yatay Göz tabletinde Upgrader’ın minimum coin katmanı kaybolmadan kompakt üçüncü sütunda korunuyor.
- [x] Coin ve kese uçuşlarında kaynak/hedef ayrımı; Collector final birleşmesi ve Super Collector ikinci geçişi için ayrı okunabilir vurgu eklendi.
- [x] Normal tambur coin’den arındırıldı; Eye/Scatter her mod için ayrı oranlandı, Hilebaz Eye ağırlıklı yapıldı ve altı kartlı özel oyun menüsü eklendi.
- [x] lobi, admin, veritabanı ve müzik entegrasyonu.
- [x] Mixkit tabanlı yeni sihir/coin/makara FX paketi, Pixabay sinematik Orta Doğu müziği, ayrı müzik/FX seviyesi ve ses yaşam döngüsü.
- [x] Masaüstü ve mobil tarayıcıda normal/Fate akışı, Mystery açılışı, collector zinciri ve kontroller doğrulandı.
- [x] tam test/build temizliği (44 dosya, 250 test); tarayıcıda FU final ödemesi, oyun alanına tıklayarak anında atlama, `PR` yüz değerleri ve sonuç özetinin kullanıcı kapatana kadar görünür kalması doğrulandı; konsol hata/uyarı üretmedi.

## 10. Devam protokolü

Yeni bir turda önce bu dosyanın **Uygulama durumu** bölümü ve test çıktısı okunur. Tamamlanan kutular geri alınmaz; bilinmeyen bir kural motor içine gizlice uydurulmaz, `assumption` olarak ayrıca belgelenir. İlk sıradaki açık kutu bir sonraki çalışma noktasıdır.
