# Pehlevan Royale — Slot Optimizasyonu, Oyun Karakteri ve SQLite Raporu

**Tarih:** 26 Ağustos 2026  
**Kapsam:** Ortak veri mimarisi, casino lehine sabit matematik, oynanış temposu, görsel/işitsel geri bildirim, AI karakterleri, Neon Kasası ve Kaptan Mercan  
**Karar durumu:** SQLite altyapısı uygulanmıştır. Motor oranları bu rapor onaylanmadan değiştirilmemiştir.

## 1. Neden eski kayıtlar ortak değildi?

Eski sistem yalnızca tarayıcı IndexedDB’sine yazıyordu. IndexedDB’nin fiziksel veri alanı şu bileşime bağlıdır:

`protokol + alan adı + port + tarayıcı profili`

Dolayısıyla bunların her biri ayrı bir kasa oluşturuyordu:

- `http://localhost:5173`
- `http://localhost:5175`
- `http://127.0.0.1:5173`
- Normal Chrome profili
- Codex içi tarayıcı profili

Bir tarayıcının başka origin veya profildeki IndexedDB alanını doğrudan okuması güvenlik modeli gereği mümkün değildir. Sorun kayıt kodundaki bir sorgu hatası değil, yanlış depolama mimarisi seçimiydi.

## 2. Uygulanan ortak SQLite mimarisi

Yeni ana veritabanı:

`%LOCALAPPDATA%\PehlevanRoyale\pehlevan-royale.sqlite`

Vite geliştirme sunucusu hangi porttan açılırsa açılsın kendi `/api/casino-data` uç noktasını sunar; bütün Vite süreçleri aynı SQLite dosyasını açar. SQLite WAL modu aynı dosyaya birden fazla yerel sunucunun güvenli biçimde yazabilmesini sağlar.

### Veri akışı

```text
Oyun sonucu
   ├─ IndexedDB'ye yaz → çevrimdışı/kesinti yedeği
   └─ yerel API'ye yaz → ortak SQLite ana kayıt

Uygulama açılışı
   ├─ SQLite sağlık kontrolü
   ├─ o tarayıcıdaki eski IndexedDB kayıtlarını kimlik bazında SQLite'a aktar
   └─ bütün raporları SQLite'tan oku
```

### Ortak tablolar

- `game_rounds`
- `wallet_ledger`
- `game_events`
- `ai_conversations`
- `casino_meta`
- `schema_info`

Kayıt kimlikleri birincil anahtardır. Aynı eski kayıt farklı tarayıcılardan tekrar taşınırsa çoğalmaz; `UPSERT` ile aynı satır güncellenir.

### Doğrulama

Bir entegrasyon kaydı port 5181 üzerinden yazılıp port 5182 üzerinden başarıyla okundu. İki sunucu aynı mutlak SQLite yolunu ve aynı kayıt sayısını bildirdi. Deneme kaydı testten sonra silindi.

## 3. SQLite ne kadar büyür?

20.000’er gerçek motor sonucu üzerinde ölçülen ham JSON telemetri boyutları:

| Kayıt                     | Ortalama |     P90 |     P99 | En büyük örnek |
| ------------------------- | -------: | ------: | ------: | -------------: |
| Neon Kasası spin sonucu   |   1,9 KB |  4,0 KB |  7,0 KB |        14,3 KB |
| Kaptan Mercan spin sonucu |  0,64 KB | 0,81 KB | 1,02 KB |        1,79 KB |

SQLite satır zarfı ve indekslerle pratik tahmin:

| Kullanım                                       | Yaklaşık büyüme |
| ---------------------------------------------- | --------------: |
| 100.000 Neon turu                              |      250–350 MB |
| 100.000 Kaptan turu                            |      110–170 MB |
| 10.000 ortalama AI mesajı                      |        10–30 MB |
| Arka plan ruleti, mevcut ayrıntıyla 24 saat    |     4–10 MB/gün |
| Arka plan ruleti, mevcut ayrıntıyla 1 yıl 24/7 |  1,5–3,7 GB/yıl |

Rulet bugün tarayıcı açık olduğu sürece 30 saniyede bir bir tur ve bir olay kaydı oluşturur. En hızlı büyüyen kalem budur. Oyuncunun ayrıntılı bahis yaptığı tur az, fakat otomatik masa turu günde 2.880 adettir.

### Önerilen saklama modeli

1. **Oyuncu turları ve AI konuşmaları:** ayrıntılı olarak süresiz saklanır.
2. **Neon/Kaptan ham grid telemetrisi:** son 250.000 tur ayrıntılı; daha eskisi sonuç özeti + özellik sayaçları biçiminde kalır.
3. **Arka plan ruleti:** ayrı kompakt tabloya yalnız `roundId, zaman, sayı, renk, çarpanlar` yazılır; aynı sonuç için ayrıca genel olay satırı oluşturulmaz.
4. **Günlük özet:** oyun, motor sürümü, bahis seviyesi, tur sayısı, RTP, hit rate ve özellik sıklığı bir toplama tablosuna yazılır.
5. **Bakım:** aylık `PRAGMA optimize`; arşiv sonrasında `VACUUM`; JSON ve CSV dışa aktarma korunur.

Kompakt rulet satırıyla 24/7 yıllık büyüme yaklaşık 300–700 MB bandına indirilebilir. Bu proje için SQLite yeterlidir; PostgreSQL gibi ayrı bir sunucuya geçmek ancak milyonlarca ayrıntılı grid kaydını yıllarca saklamak veya aynı anda birden fazla fiziksel bilgisayardan erişmek istenirse anlamlı olur.

## 4. Optimizasyonun gerçek hedefi

Amaç yalnız “hit rate’i artırmak” değildir. İyi bir slot aynı anda dört ayrı dağılımı yönetir:

1. **Beklenen değer:** Casino lehine toplam RTP
2. **Geri bildirim sıklığı:** Bir şey olduğunun hissedildiği tur oranı
3. **Anlamlı sonuç sıklığı:** Bahsi geri alan veya kâr ettiren tur oranı
4. **Volatilite:** Ödemenin küçük/orta/büyük sonuçlara nasıl dağıldığı

Bir oyunda `%40` hit rate bulunup sonuçların çoğu `0,1x` ise oyun yine kurak hissedebilir. Kaptan Mercan’ın mevcut sorunu tam olarak budur. Bu nedenle optimizasyon hedef fonksiyonu şöyle kurulmalıdır:

```text
hedef skor =
  anlamlı hit sıklığı
  + orta kazanç sıklığı
  + özellik/cascade çeşitliliği
  + bonus ilerleme görünürlüğü
  - uzun kurak seri cezası
  - tekrarlanan ses/animasyon cezası
  - hedef RTP sapma cezası
  - tek bir uç ödül katmanına aşırı bağımlılık cezası
```

## 5. Casino lehine matematik

İki oyun için önerilen uzun dönem hedefi:

- **Oyuncu RTP:** `%94,5–95,0`
- **Casino avantajı:** `%5,0–5,5`

Örnek: 1.000 PR ile 100 spin, 100.000 PR toplam çevrim demektir. `%95 RTP` altında uzun dönem matematiksel ortalama 95.000 PR geri dönüş, 5.000 PR casino sonucudur. Tek bir 100 spinlik oturumda volatilite nedeniyle sonuç bunun çok üstünde veya altında olabilir; avantaj, her kısa oturumda zorla uygulanmaz.

### Sabit matematik ilkesi

Oyuncu çok kaybetti diye bir sonraki turun olasılığı gizlice artırılmamalı; çok kazandı diye de düşürülmemelidir. Bunun yerine her oyun için sabit ve sürümlenmiş reel/ağırlık profili kullanılır. Casino lehine sonuç zaten RTP ile sağlanır. Bu yaklaşım:

- motoru analiz edilebilir yapar,
- canlı sonuç ile simülasyonu karşılaştırmayı mümkün kılar,
- “oyun beni özel olarak sıkıyor” hissini azaltır,
- admin değişikliklerinin etkisini ölçülebilir kılar.

Birleşik Krallık teknik standardı da RNG çıktılarının beklenen dağılıma uymasını ve adaptif müdahaleyle sonuçların atılmamasını ister. Bu proje lisanslı bir ürün olmasa da test edilebilir motor için iyi bir mühendislik standardıdır. [UK Gambling Commission — RTS 7](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-7-generation-of-random-outcomes)

## 6. Oyunu canlı ve tekrar oynanır yapan katmanlar

### 6.1 Üç zaman ölçekli döngü

**Anlık döngü — 1 spin:** Beklenti, sembol inişi, sonuç, kısa tepki. 1–5 saniye.

**Orta döngü — özellik:** Cascade, güç çarpanı, iki scatter kancası, kaptan sayacı, free-spin ilerlemesi. 5–120 saniye.

**Uzun döngü — casino koleksiyonu:** Oyunlar arasında çalışan koleksiyon parçaları, haftalık vitrin, karakter ilişkisi ve nadir kozmetik açılımları. Birden fazla oturum.

Pragmatic Play’in güncel POP ürün çizgisi daha sık kazanç, basit mekanik, renkli karakter ve hızlı animasyonları özellikle casual oyuncu etkileşimi için birlikte kullanıyor. Bu bize “daha sık geri bildirim + kolay okunur aksiyon”un ayrı bir oyun karakteri olarak bilinçli kullanıldığını gösterir. [Pragmatic Play POP](https://www.pragmaticplay.com/en/pragmatic-play-pop/)

### 6.2 Pehlevan Koleksiyonu

Pragmatic Play’in Wheel Drops ve Collect & Win sistemlerinde oyunlar arasında parça biriktirme, set tamamlama ve sandık/çark açma katmanı vardır. Şirket bu katmanları doğrudan etkileşim ve retention aracı olarak tanımlar. [Collect & Win](https://www.pragmaticplay.com/en/news/pragmatic-play-expands-enhance-gamification-tools-with-collect-win/), [Wheel Drops](https://www.pragmaticplay.com/en/news/pragmatic-play-unveils-new-ways-to-win-with-wheel-drops/)

Pehlevan Royale karşılığı:

- Neon’dan “veri parçası”, Kaptan’dan “harita parçası”, rulet ve blackjack’ten kendi tematik parçaları düşer.
- Set tamamlanınca dokuz sandıktan biri seçilir veya Pehlevan Çarkı açılır.
- Ödüller: sanal PR, oyun içi kozmetik, yeni masa ışığı, karakter repliği paketi, ücretsiz spin bileti.
- Para ödüllerinin beklenen değeri toplam `%95 RTP` bütçesinin içinde tutulur; örneğin `%0,5` RTP bu ortak katmana ayrılır.
- Kozmetik/karakter ödülleri RTP’yi etkilemeden uzun vadeli amaç verir.

### 6.3 Sonuçların doğru hiyerarşisi

| Brüt dönüş | Sunum                               |
| ---------- | ----------------------------------- |
| `0x`       | kısa sessizlik/ortam tepkisi        |
| `0–1x`     | “geri dönüş”; büyük kazanç sesi yok |
| `1–5x`     | temiz kazanç                        |
| `5–20x`    | güçlü vuruş                         |
| `20–100x`  | büyük kazanç                        |
| `100–500x` | muhteşem/sansasyonel                |
| `500x+`    | oyuna özel tepe sahnesi             |

Sesli slotların deneklerin `%72,5`’i tarafından sessiz sürüme tercih edildiği ve sesi açık oyunun daha uyarıcı bulunduğu ölçülmüştür. Aynı çalışma, bahisten küçük geri dönüşe de kazanç sesi çalmanın gerçek kazanma sayısını olduğundan fazla algılattığını gösterir. Bu nedenle ses kesinlikle güçlü kullanılmalı, fakat `0–1x` ile gerçek kâr aynı jingle’ı kullanmamalıdır. [Dixon ve diğerleri — The Impact of Sound](https://pmc.ncbi.nlm.nih.gov/articles/PMC4225056/)

### 6.4 Tempo hedefleri

- Normal temel spin: `1,8–2,6 sn`
- Turbo temel spin: `0,9–1,2 sn`
- Her cascade inişi: normal `420–600 ms`, turbo `230–340 ms`
- Çarpan toplama adımı: en az `350 ms`; bütün değerler sırayla okunabilir
- Büyük sonuç finali: kullanıcı kapatana kadar veya en az `2,5 sn`
- Free-spin final özeti: yalnız bir kez; gerçek viewport merkezinde

Turbo hızlandırır fakat sonucu görünmez kılmaz. Scatter, 100x+ çarpan, bonus tetikleme ve bonus finali turbo tarafından atlanmaz.

### 6.5 Gerçek beklenti olayları

- İki/üç scatter görünmesi
- Tumble sonrasında görünmeyen üst alandan güç sembolü inmesi
- Kaptan sayacının dördüncü adıma yaklaşması
- Ekranda para balığı varken kaptan inişi

Sunum yalnız motorun gerçekten ürettiği sonucu dramatize eder. Kaybeden sonuç sonradan sahte near-miss görüntüsüne çevrilmez. Böylece beklenti anı güçlü kalırken telemetri ve görünen sonuç aynı şeyi anlatır.

## 7. Neon Kasası — önerilen karakter ve motor profili

### Karakter cümlesi

**“Bir anda açılan zincirli yüksek voltaj.”** Kaptan’a göre daha yüksek volatilite, daha uzun cascade ve daha büyük P99; fakat mevcut 475 turda bir bonus kadar kurak değil.

### Hedef matematik profili

| Ölçüt                    |                  Mevcut gözlem |                      Hedef |
| ------------------------ | -----------------------------: | -------------------------: |
| Toplam RTP               | %99,08, ağır kuyrukla kararsız |                      %94,7 |
| Normal oyun RTP katkısı  |                         %73,88 |                     %61–64 |
| Bonus/koleksiyon katkısı |                         %25,20 | %30–33 + ortak katman %0,5 |
| Herhangi bir ödeme       |                         %33,80 |                     %37–40 |
| Bahsi geri alma          |                          %8,98 |                     %13–16 |
| Doğal free-spin          |                          1/475 |                  1/190–220 |
| Bonus medyanı            |                         34,88x |                     35–55x |
| Bonus P90                |                        202,74x |                   180–300x |
| Bonus P99                |                         1.721x |                 900–1.800x |

### Sonuç dağılım hedefi

- Sıfır dönüş: `%60–63`
- Bahisten küçük dönüş: `%22–25`
- Bahsi geri alma / küçük kâr: `%9–11`
- 5x üzeri: `%3–5`
- 20x üzeri: `%0,8–1,4`
- 100x üzeri: seyrek, fakat görünür tepe olayları

### Motor optimizasyonu

1. Base scatter oranı yaklaşık 108/10.000’den ilk testte 132–136/10.000 bandına alınır; kesin değer 5 milyon turla bulunur.
2. Komşu sembol devam seçimi `%31`den `%34–36` bandına denenir. Daha fazla gerçek ikinci cascade üretirken düşük küme ödemeleri RTP’ye göre azaltılır.
3. 500x/1000x güçlerin toplam RTP katkısı ayrı ölçülür. Uç katkının bir bölümü 2x/3x/4x/5x/10x katmanlarına taşınır.
4. Çarpan yalnız bütün tumble dizisi bittikten sonra sayılır: `2x → +3x → toplam 5x → tur kazancı ×5`.
5. Bonus çalışan toplam çarpanı korunur; her güç inişi ayrı ses imzasına sahiptir.
6. Normal oyunda “enerji eşiği” yalnız görsel değildir: art arda cascade olduğunda sabit kural çerçevesinde bir sonraki düşüşte güç sembolü reel seti devreye girebilir. Bu olay telemetride `surgeTier` olarak yazılır ve RTP’ye dahildir.

### Görsel ve ses kimliği

- Ana ritim: düşük elektronik nabız
- Güç inişi: konuma doğru stereo enerji sesi
- Cascade: her adımda tonal olarak yükselen kısa nota
- Çarpan toplamı: her sayı için ayrı darbe; finalde bass hit
- 100x+: ekranı kapatmayan veri kırılması, Mira portresi ve sayacın merkezde büyümesi

### Mira AI kimliği

- Soğukkanlı, kendine güvenen, hafif alaycı siber-kasa operatörü
- Cascade derinliği, önceki güçler, çalışan bonus çarpanı ve gerçek net sonucu bilir
- Aynı olay için en az 20 varyant; son 10 cümle DB’den bağlam olarak verilir
- `0–1x` sonucunu büyük başarı diye satmaz; “bir kısmını geri aldın” gibi doğal konuşur
- Büyük güç ekrana indiğinde sonucu bilmeden önce beklenti kurar; sonuçtan sonra gerçek katı söyler

## 8. Kaptan Mercan — önerilen karakter ve motor profili

### Karakter cümlesi

**“Sık av, dolu normal oyun, arada efsanevi büyük balık.”** Neon’a göre daha fazla gerçek geri dönüş, daha erişilebilir bonus ve daha düşük kuraklık; yine de 1.000x balık ve 10x son kademe mümkün.

### Hedef matematik profili

| Ölçüt                    | Mevcut gözlem |                      Hedef |
| ------------------------ | ------------: | -------------------------: |
| Toplam RTP               |        %90,14 |                      %94,7 |
| Normal oyun RTP katkısı  |        %12,56 |                     %58–61 |
| Bonus/koleksiyon katkısı |        %77,58 | %33–36 + ortak katman %0,5 |
| Herhangi bir ödeme       |        %34,40 |                     %40–44 |
| Bahsi geri alma          |         %1,49 |                     %15–18 |
| Doğal free-spin          |         1/111 |                   1/90–105 |
| Bonus medyanı            |        23,58x |                     28–45x |
| Bonus P90                |       195,60x |                   120–220x |
| Bonus P99                |     1.034,95x |                 700–1.500x |

### Sonuç dağılım hedefi

- Sıfır dönüş: `%56–60`
- Bahisten küçük dönüş: `%23–27`
- Bahsi geri alma / küçük kâr: `%11–14`
- 5x üzeri: `%3–5`
- 20x üzeri: `%0,6–1,1`
- Çok büyük balık: Neon’dan daha seyrek

### Motor optimizasyonu

1. Hat ödemeleri yeniden ölçeklenir. Mevcut 20 çizgi bölümü yaygın eşleşmeleri 0,075x–0,4x bandına sıkıştırıyor; normal oyun RTP’si `%12,56`da kalıyor.
2. Bonus para balığı dağılımının beklenen değeri düşürülür; çıkarılan yaklaşık 40–45 RTP puanı normal çizgi ödemelerine aktarılır.
3. 1.000x ve nadir 2.500x balık tamamen kaldırılmaz. Gelme olasılığı ile maksimum oturum katkısı ayrı test edilir.
4. İki scatter’dan kanca kurtarması korunur. Tetiklenme oranı yaklaşık `%10–14` bandında sabit özellik olarak sürümlenir.
5. Free-spin’de para balığı var/kaptan yok veya kaptan var/balık yok durumunda düşük olasılıklı **Lodos Avı** devreye girer: önceden seçilmiş semboller gerçekten para balığına veya kaptana dönüşür.
6. Bu yaklaşım Pragmatic’in Big Bass türevlerindeki “bir taraf eksikse sembol dönüşümü” yapısına benzer; resmi ürün açıklamasında bu olay açıkça anlatılır. [Big Bass Football Bonanza](https://www.pragmaticplay.com/en/news/pragmatic-play-finds-the-net-in-big-bass-football-bonanza/)
7. Her dördüncü kaptanda +10 spin ve 2x/3x/10x kademeleri korunur. Kademe yaklaşımı masanın üzerinde sürekli görünür.
8. Bonus satın alma, doğal bonusla aynı sonuç dağılımını kullanmazsa ayrı `mathProfileVersion` alır; maliyet ve satın alma RTP’si admin panelinde ayrı gösterilir.

### Görsel ve ses kimliği

- Ana ritim: ud/ney dokusu, liman gıcırtısı ve hafif dalga
- Reel inişi: ahşap/tambur vurumu
- Para balığı: metal sikke + su damlası
- Kaptan: uzaktan düdük; toplamada halat çekme sesi
- Dördüncü kaptan: yelken açma ve harita mührü
- 100x+: fırtına ışığı, güverte sarsıntısı, büyük ağın ekrana gelişi

### Mercan AI kimliği

- Osmanlı denizcisi havasında, hikâyeci, neşeli ve biraz palavracı
- Para balıklarının toplamını, eksik kaptanı, yaklaşan kademeyi ve net kazancı bilir
- Kötü spinlerde aynı “ağ boş” cümlesini tekrarlamaz; deniz, rüzgâr, liman ve mürettebat temalı farklı tepkiler verir
- Mira’dan daha sıcak ve oyuncuyla takım arkadaşı gibi; büyük kayıpta yapay pozitiflik yapmaz
- Free-spin bittiğinde bütün oturum için tek bir final yorumu üretir

Pragmatic Play, Bigger Bass’ı anlatırken büyük sonuçların free-spin koleksiyonundan, daha düşük sonuçların ise normal çizgi kazançlarından gelebileceğini özellikle vurgular. Mevcut Kaptan motorumuzun eksikliği tam olarak bu ikinci kısmın çok zayıf olmasıdır. [Bigger Bass Bonanza resmi açıklaması](https://www.pragmaticplay.com/en/news/pragmatic-play-heads-out-to-deep-waters-in-bigger-bass-bonanza/)

## 9. Oyunların birbirinden ayrılması

| Boyut               | Neon Kasası                     | Kaptan Mercan                 |
| ------------------- | ------------------------------- | ----------------------------- |
| Ana haz             | Tumble zinciri ve güç patlaması | Sık av ve koleksiyon          |
| Volatilite          | Çok yüksek                      | Orta-yüksek                   |
| Normal tempo        | Zincir başlayınca uzar          | Düzenli çizgi sonuçları       |
| Bonus erişimi       | Daha seyrek                     | Daha sık                      |
| Büyük sonuç kaynağı | Toplanan güç çarpanı            | Para balığı + kaptan kademesi |
| Uzun sayaç          | Bonus global çarpanı            | Dördüncü kaptana ilerleme     |
| Sunucu kişiliği     | Keskin, siber, alaycı Mira      | Sıcak, hikâyeci Mercan        |
| Ses dünyası         | Elektronik/enerji               | Liman/Osmanlı denizciliği     |

Gelecekteki her slot için bu sekiz satırlık “karakter sözleşmesi” yazılmadan motor ve asset üretimine başlanmamalıdır.

## 10. Admin paneli optimizasyon ekranı

Her `mathProfileVersion` için şunlar canlı gösterilmelidir:

- Toplam, base, bonus ve promosyon RTP
- Casino avantajı
- 0x / 0–1x / 1–5x / 5–20x / 20–100x / 100x+ kovaları
- Any-hit, bahsi geri alma ve gerçek kâr oranı
- P50/P75/P90/P99/max sonuç
- En uzun sıfır ve bahsin-altı serisi
- Bonus tetikleme, satın alma, uzatma ve ortalama bonus uzunluğu
- Cascade derinliği dağılımı
- Her çarpan katmanının görünme ve RTP katkısı
- Ses/animasyon olaylarının tur başına tekrar sıklığı
- Simülasyon sonucu ile gerçek SQLite sonucu arasındaki fark
- Son 10 bin / 100 bin / tüm zaman pencereleri

## 11. Kalibrasyon yöntemi

1. Her oyun için yeni `mathProfileVersion` oluşturulur.
2. Parametre ızgarası en az 2 milyon turluk hızlı taramadan geçirilir.
3. En iyi 10 profil, 10–20 milyon turla tekrar simüle edilir.
4. RTP yanında kurak seri, anlamlı hit, bonus medyanı ve P99 kabul ölçütlerine bakılır.
5. Seçilen profil motor testlerine sabitlenir.
6. Eski ve yeni canlı kayıtlar SQLite’ta sürüm bazında ayrılır.
7. 10.000 gerçek kullanıcı turundan sonra simülasyon–canlı sapması admin panelinde değerlendirilir.

### Kabul ölçütü

- RTP `%94,5–95,0`
- Hiçbir ana RTP kaynağı toplamın `%70`inden fazlasını tek başına taşımıyor
- Kaptan’da bahsi geri alma `%15`in altında değil
- Neon doğal bonusu 1/230’dan seyrek değil
- P99 ve maksimum arasında kontrolsüz uçurum yok
- Turbo dâhil bütün büyük olaylar izlenebilir
- Free-spin toplamı yalnız bir final penceresiyle ve viewport merkezinde sunuluyor
- Her sonuç SQLite’a motor sürümüyle yazılıyor

## 12. Önerilen uygulama sırası

1. SQLite şema v4, sayfalı sorgular ve tek-seferlik IndexedDB migrasyonu — **tamamlandı**
2. Arka plan ruleti kompakt tablo ve saklama işi
3. Motor profil sürümleme ve admin dağılım grafikleri
4. Kaptan Mercan RTP yeniden dağıtımı
5. Neon Kasası scatter/cluster/güç kalibrasyonu
6. 10 milyon turluk doğrulama
7. Free-spin portal sonuç pencereleri
8. Sonuç ses hiyerarşisi ve turbo minimum süreleri
9. Pehlevan Koleksiyonu
10. AI karakterlerine son tur/seri/özellik bağlamı ve tekrar önleme

---

## Nihai öneri

Her iki oyunu aynı `%94,7` hedef RTP çevresinde tutup haz kaynağını tamamen ayırmak en doğru tasarımdır:

- **Neon Kasası:** zincir, yükselen ses, ekrana sonradan inen güç, seyrek ama büyük bonus.
- **Kaptan Mercan:** daha sık anlamlı çizgi sonucu, daha erişilebilir bonus, kaptan koleksiyonu ve nadir dev balık.

Casino avantajı küçük sonuçları kazanç gibi göstererek değil, bütün reel/özellik dağılımının sabit `%5,3` matematiksel avantajıyla sağlanır. Tekrar oynama isteği ise yalnız RTP’den değil; okunur beklenti anları, gerçek ilerleme sayaçları, karaktere özgü ses/animasyon, oyunlar arası koleksiyon ve birbirinden belirgin oyun kişiliklerinden üretilir.

## 13. Uygulama eki - 26 Ağustos 2026

Bu rapordaki slot motoru ve yönetim önerilerinin ilk uygulanabilir sürümü tamamlandı.

### Canlı motor profilleri

| Oyun          | Profil                         | 1.000.000 tur RTP | Base / bonus katkısı | Doğal bonus | Bonus medyanı |       P99 |
| ------------- | ------------------------------ | ----------------: | -------------------: | ----------: | ------------: | --------: |
| Neon Kasası   | `neon-v4-frequent-flow-948`    |          `%94,87` |    `%55,43 / %39,44` |  `1/155,13` |      `39,70x` | `343,03x` |
| Kaptan Mercan | `fisher-v5-queued-voyages-948` |          `%94,80` |    `%55,94 / %38,86` |  `1/103,44` |      `13,22x` | `378,07x` |

Kaptan'ın v5 profilinde bonus öncesi Sefer Fermanları, ekrandaki her kaptanın balıkları ayrı toplaması, kanca/dinamit/top kurtarma olayları ve 12 portreli kademe şeridi aynı simülasyona dahil edildi. Kademe ilerlemesi artık etkin bonus paketini geriye dönük değiştirmiyor: örneğin elde kalan 5 adet `1x` tur önce tamamlanıyor, ardından kazanılan 10 adet `2x` paket başlıyor. Bir milyon ücretli turda `%94,80` RTP ölçüldü. Nadir 500x/1000x/2500x para balığı katmanları olasılık tablosunda korunuyor. 20.000 satın alınmış bonus simülasyonunda ortalama dönüş `68,57x`; canlı fiyat `72,5x` ve ölçülen satın alma RTP'si yaklaşık `%94,57` oldu.

Neon'un gerçek SQLite geçmişinde son v3 bonus spinlerinin `%69,09`unun tamamen boş kaldığı, bazı oturumlarda ortak çarpanın `163x`e ve tek oturum toplamının `808,66x`e çıktığı görüldü. v4 profili küme eşiğini 5'ten 4'e indirdi; düşük çarpan ağırlığını yükseltip büyük çarpan kuyruğunu ve özel sembol sıklığını azalttı. Bir milyon turda ücretli hit `%67,11`, bonus içi boş spin yaklaşık `%33,69`, bonus sonu çarpan P99'u `99x` ölçüldü. Erişilebilir tutulan çok nadir `500x` güç nedeniyle tek uç örnekte maksimum final çarpanı `529x` oldu. Oyun daha sık küçük/orta sonuç üretirken P99 özellik kazancı `343,03x`e indi; nadir büyük sonuç olasılığı tamamen kaldırılmadı. 20.000 satın alınmış bonus simülasyonunda ortalama dönüş `55,34x`; canlı fiyat `58,5x` ve satın alma RTP'si yaklaşık `%94,59` oldu.

Gerçek veriyi tekrar üretmek için `scripts/actual-slot-audit.mjs`, aday matematik profillerini karşılaştırmak için `scripts/neon-tuning-report.ts` ve `scripts/fisher-tuning-report.ts`, satın alma fiyatını denetlemek için `scripts/bonus-buy-report.ts` kullanılabilir.

### Admin paneli

- Oyunlar tek bir yatay/seçilebilir katalogda gösteriliyor; aynı anda yalnız seçilen oyunun ayrıntıları açılıyor.
- Genel, matematik motoru, deneyim/ilerleme ve müzik alanları ayrı sekmelere bölündü.
- Scatter, özel sembol, para balığı, değer ağırlıkları, cluster, cascade, bonus turu, retrigger, kademe, maksimum kazanç, ödeme ölçeği, sunum süreleri ve XP ekonomisi canlı düzenlenebiliyor.
- Her değişiklik mevcut motor çağrılarına bağlandı; tur telemetrisine profil adı ve kullanılan matematik parametrelerinin tam anlık görüntüsü yazılıyor.
- Arayüzde değişikliklerin simülasyon doğrulaması olmadan kalıcı profil olarak değerlendirilmemesi gerektiği açıkça gösteriliyor.

### Oynanış katmanları

- Neon'da güvenlik seviyesi ve keşfedilmiş güçler; Kaptan'da kaptan rütbesi ve yakalanmış değerler kalıcı ilerleme olarak tutuluyor.
- Gerçek motor sonucuna bağlı scatter/güç beklenti sahneleri eklendi; sonuç sonradan değiştirilmiyor.
- Dinamik ses, beklenti, koleksiyon kitabı ve ilerleme HUD'u oyun bazında admin panelinden açılıp kapatılabiliyor.
- Normal/turbo iniş, beklenti, çarpan sunumu ve kazanç sayımı süreleri oyun bazında ayarlanabiliyor.

### Doğrulama

- Üretim derlemesi başarılı.
- 9 test dosyasında 38 test başarılı.
- Motor kalibrasyon raporu `scripts/fisher-tuning-report.ts`, birleşik uzun koşu raporu `scripts/slot-math-report.ts` üzerinden yeniden üretilebilir.

## 14. Canlı veri denetimi ve Kaptan Mercan v6 — 27 Ağustos 2026

SQLite'taki son 400 Kaptan Mercan kaydı incelendi. Pencere 328 ücretli spin ve 72 free spin içeriyordu. Free spinlerde 22 kaptan ve 25 para balığı görünmesine rağmen kaptan bulunan 21 ekranın yalnızca 7'sinde balık da vardı. Kaptan ekranlarının üçte ikisi toplama üretmeden geçiyordu. İki bonus oturumundan biri 10× kademesine ulaştı ve 48 spine uzadı. Mevcut v5 profilinin daha geniş örneğinde 10× oturum oranı yaklaşık `%25` olsa da, ulaşılan oturumların uzun süre 10× oynaması bu kademeyi olduğundan daha sıradan hissettiriyordu.

Bu bulgu üzerine `fisher-v6-fish-forward-945` profili oluşturuldu:

- Bonus para balığı ağırlığı `0,87`den `1,65`e çıkarıldı.
- Bonus kaptan ağırlığı `0,735`ten `0,52`ye indirildi.
- Balıksız kaptanın ekrana balık çağırma ihtimali `%48` olarak ayrı ve admin panelinden değiştirilebilir bir parametreye bağlandı.
- Ana oyun ödeme ölçeği `1,122`, bonus çizgi ölçeği `1,05` olarak kalibre edildi.
- Kademe paketlerinin sıraya alınma kuralı ve 10 spinlik paketler korunurken 10×'e ulaşma doğal olarak seyrekleştirildi.

Sefer Fermanı mini oyunu ve bütün güçlendirmeler dahil 1.000.000 turluk sabit tohumlu doğrulama sonucu:

| Ölçüm | v6 sonucu |
| --- | ---: |
| Toplam RTP | `%94,49` |
| Base / bonus katkısı | `%62,35 / %32,13` |
| Doğal bonus sıklığı | `1/102,44` |
| Ortalama bonus uzunluğu | `13,47 spin` |
| Balık görülen bonus spini | `%49,31` |
| Kaptan görülen bonus spini | `%16,39` |
| Kaptan + balık toplama spini | `%12,51` |
| Balıksız kaptan spini | `%3,88` |
| 2× / 3× / 10× oturum erişimi | `%55,44 / %9,83 / %3,31` |

Neon Kasası'nın son 400 kaydında güncel v4 profilinden 317 tur vardı. Güncel profilde minimum küme eşiğinin tamamında `4` olarak kaydedildiği ve 4 sembollü 361 geçerli küme üretildiği doğrulandı; 4 altı hiçbir küme ödeme almadı. Ücretli spinlerin `%60,22`si bir dönüş üretti, en uzun tamamen boş seri 4 spin ve ortalama cascade sayısı `1,37` oldu. Bu nedenle Neon'un 4'lü küme değişikliği korunmuştur.

Denetim tekrarları için `scripts/recent-slot-window-audit.mjs`; Kaptan aday profillerini gerçek Sefer Fermanı akışıyla karşılaştırmak için `scripts/fisher-character-lab.ts` kullanılabilir.
