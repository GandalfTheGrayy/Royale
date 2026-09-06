# Pehlevan Royale — Slot Matematiği ve Oynanış Akışı Denetim Raporu

**Tarih:** 25 Ağustos 2026  
**Kapsam:** Neon Kasası, Kaptan Mercan, slot telemetrisi ve free-spin sonuç pencereleri  
**Durum:** Bu belge teşhis ve hedef tasarımdır. Bu aşamada oyun motorlarının oranları değiştirilmemiştir.

## 1. Yönetici özeti

Kullanıcının “çok fazla karşılığı olmayan spin, ardından bir bonusun birden aşırı ödeme yapması” gözlemi özellikle **Kaptan Mercan için matematiksel olarak doğrulanmıştır**. Sorun yalnızca sıfır ödemeli spin sayısı değildir. Asıl sorun, ekranda ödeme görünen turların çoğunun da bahsin çok küçük bir bölümünü geri vermesidir.

- **Kaptan Mercan:** 600.000 kontrollü turda toplam gözlenen RTP `%90,14`; bunun yalnızca `%12,56` puanı normal oyundan, `%77,58` puanı free-spin özelliğinden gelmiştir. Normal turda herhangi bir ödeme oranı `%34,40` görünse de bahsi geri alma oranı yalnızca `%1,49`, gerçek kâr oranı `%1,43` olmuştur. En uzun “bahsi geri alamama” dizisi 766 turdur. Bu dağılım, oyunun normal bölümünü göstermelik; bonusu ise oyunun neredeyse tamamı hâline getirmiştir.
- **Neon Kasası:** Herhangi bir ödeme oranı `%33,80`, fakat bahsi geri alma/kârlı tur oranı yalnızca `%8,98` olmuştur. Doğal free-spin yaklaşık **475 turda bir** gelmektedir. Bu, kullanıcının özelliğe çok seyrek girdiği hissini doğrular. Ayrıca 500x/1000x güç sembolleri ve biriken bonus çarpanı nedeniyle dağılımın kuyruğu fazlasıyla büyüktür; 600.000 turdaki gözlenen RTP `%99,08` olmasına rağmen daha kısa örneklemlerde `%102–107` aralığına sıçramıştır. Bu kadar oynak bir motorun gerçek beklenen değerini doğrulamak için milyonlarca tur ve güven aralığı gerekir.
- **Veritabanı:** Açık olan Codex tarayıcı profilindeki geçmiş, kullanıcının bahsettiği yüzlerce turu içermemektedir. `localhost:5173` kaynağında slot turu yoktur; `localhost:5175` kaynağında yalnızca iki Kaptan Mercan normal turu vardır ve ikisi de boştur. IndexedDB verisi tarayıcı profili ile origin/port bazında ayrıldığı için normal Chrome’da veya başka portta oynanan geçmiş bu profile taşınmamıştır. Bu, gözlemi çürüten bir sonuç değil; analiz altyapısındaki bir taşınabilirlik kusurudur.
- **Free-spin sonuç penceresi:** Neon penceresi makine alanına göre `position:absolute` konumlanmıştır; Kaptan penceresi ise dönüşüm uygulanan bir bileşen ağacının içinde kalmaktadır. Her ikisi de `document.body` üzerine React portal ile çıkarılmalı ve gerçek görünüm alanının merkezine sabitlenmelidir.

## 2. Ölçüm yöntemi

Motorlara dokunmadan, sabit tohumlu sözde rastgele sayı üreticisi ile her oyun için **600.000 ücretli tur** çalıştırıldı. Doğal bonus tetiklendiğinde bütün free-spin oturumu tamamlandı; uzatmalar, biriken çarpanlar, balık toplama ve kaptan kademeleri toplam sonuca eklendi.

Kalıcı tekrar üretim aracı: `scripts/slot-math-report.ts`

Ölçülen başlıca değerler:

- Normal oyun, bonus ve toplam RTP katkısı
- Herhangi bir ödeme, bahsi geri alma ve gerçek kâr oranı
- Sıfır ödeme ve bahsin altında ödeme serileri
- Doğal özellik sıklığı ve ortalama free-spin sayısı
- Kazançların medyan, P90, P99 ve maksimum bet katları
- Bonus oturumlarının düşük ve aşırı sonuç dağılımı

Bu rapordaki RTP, canlı geçmişten değil mevcut motor kodunun simülasyonundan elde edilen **gözlenen örneklem RTP’sidir**. Özellikle Neon’un ağır kuyruğu nedeniyle teorik RTP gibi okunmamalıdır.

## 3. Mevcut motorların ölçüm sonucu

| Ölçüt | Neon Kasası | Kaptan Mercan |
|---|---:|---:|
| Simüle ücretli tur | 600.000 | 600.000 |
| Gözlenen toplam RTP | %99,08 | %90,14 |
| Normal oyun RTP katkısı | %73,88 | %12,56 |
| Bonus RTP katkısı | %25,20 | %77,58 |
| Herhangi bir normal ödeme | %33,80 | %34,40 |
| Bahsi geri alma | %8,98 | %1,49 |
| Gerçek kârlı normal tur | %8,98 | %1,43 |
| Sıfır ödeme | %66,20 | %65,60 |
| En uzun sıfır dizisi | 30 | 29 |
| En uzun bahsin-altı dizisi | 106 | 766 |
| Doğal özellik sıklığı | 1 / 475 | 1 / 111 |
| Ortalama bonus turu | 19,80 | 14,35 |
| Bonus medyanı | 34,88x | 23,58x |
| Bonus P90 | 202,74x | 195,60x |
| Bonus P99 | 1.721,37x | 1.034,95x |
| Örneklemde en büyük bonus | 6.049,72x | 3.621,55x |
| 10x altı bonus oranı | %19,10 | %31,09 |

### “%34 hit rate varken neden boş hissettiriyor?”

Çünkü `hit rate`, yalnızca sıfırdan büyük ödeme sayar. Kaptan Mercan’daki ödeme alan turların medyanı **0,15x**; Neon’da **0,482x** olmuştur. 1.000 PR bahisle 150 PR geri gelmesi teknik olarak ödeme olsa da oyuncu açısından 850 PR kayıptır. Bu yüzden yalnızca hit rate’e bakmak yanıltıcıdır. Motor ve admin paneli en az şu üç oranı ayrı göstermelidir:

1. **Herhangi bir ödeme:** `gross > 0`
2. **Bahsi geri alma:** `gross >= bet`
3. **Gerçek kâr:** `gross > bet`

## 4. Sektör karşılaştırması ve araştırma sonucu

Pragmatic Play’in kendi tanımı, yüksek volatil oyunların daha seyrek ödediğini fakat kısa sürede büyük ödül ihtimalini artırdığını açıkça söyler. Örnek resmi oyunda teorik RTP `%96,46` olarak verilir. Bu, “yüksek volatil = normal oyunun anlamsız olması” demek değildir; RTP ile ödül dağılımının ayrı eksenler olduğunu gösterir. [Pragmatic Play — Bomb Bonanza game overview](https://client.pragmaticplay.com/wp-content/uploads/2022/05/Game-overview-Bomb-Bonanza.pdf)

Neon’un esinlendiği mekaniklerde resmi kurallar şöyledir:

- Gates of Olympus’ta 8–30 eşleşen sembol, tumble, 500x’e kadar bağımsız çarpan ve 4+ scatter ile 15 free spin vardır; free-spin sırasında gelen çarpanlar çalışan toplam çarpana eklenir. [Pragmatic Play — Gates of Olympus](https://www.pragmaticplay.com/en/games/gates-of-olympus/)
- Sweet Bonanza’da 8–12+ sembol öder; 4–6 scatter 10 free spin verir ve tumble dizisinin sonunda bütün 2x–100x çarpanlar toplanır. Bu, mevcut Neon’daki “bütün patlamalar bittikten sonra çarpanları sırayla say ve uygula” beklentisini destekler. [Pragmatic Play — Sweet Bonanza](https://www.pragmaticplay.com/en/games/sweet-bonanza-slot/)

Kaptan Mercan’ın esinlendiği resmi yapı:

- Bigger Bass Bonanza’da 3/4/5 scatter 10/15/20 free spin verir; wild bütün para sembollerini toplar; her dördüncü wild 10 tur daha ve sırasıyla 2x/3x/10x kademe verir. [Pragmatic Play — Bigger Bass Bonanza](https://www.pragmaticplay.com/en/games/bigger-bass-bonanza/)
- Big Bass Bonanza 1000’de iki scatter’dan üçüncünün rastgele çekilmesi, 1.000x’e kadar para sembolleri ve free-spin sonunda ek wild/para sembolü düşebilmesi vardır. [Pragmatic Play — Big Bass Bonanza 1000](https://www.pragmaticplay.com/en/games/big-bass-bonanza-1000/)

Akış ve algı araştırmalarından çıkan kullanılabilir sonuçlar:

- Aynı RTP’de farklı volatilite, oyuncunun yaşadığı kazanma/kaybetme serilerini ciddi biçimde değiştirir; bu yüzden yalnız RTP hedeflemek yeterli değildir, seri uzunlukları ve dağılım yüzdelikleri de simüle edilmelidir. [Palomäki ve diğerleri, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10562822/)
- Gerçek ödeme sıklığı yeterince farklı olduğunda daha yüksek geri bildirim sıklığı daha yüksek oyun etkileşimiyle ilişkilidir. [Harris ve Griffiths, 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4735408/)
- Bahisten küçük geri dönüşleri büyük kazanç gibi ses ve ışıkla sunmak, oyuncunun gerçek kazanma sayısını olduğundan fazla algılamasına yol açar. Pehlevan Royale’de bunun yerine küçük geri dönüş ile net kâr ayrı sunulmalıdır; böylece oyun canlı kalırken telemetri ve sonuç dili dürüst kalır. [Dixon ve diğerleri, 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6209046/)
- Bir oyun motorunda olasılıkların oyuncunun geçmişine göre tur ortasında adaptif biçimde değiştirilmesi yerine sabit, sürümlenmiş reel/dağılım setleri kullanılmalıdır. Bu sayede simülasyon ile canlı sonuç gerçekten karşılaştırılabilir. Birleşik Krallık teknik standardı da RNG çıktılarının beklenen dağılıma uymasını, adaptif müdahaleyle sayıların atılmamasını ve sonucun yeterince uzun/açık gösterilmesini ister. [UK Gambling Commission — RTS 7](https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-7-generation-of-random-outcomes)

## 5. Önerilen oyun karakterleri

Buradaki yüzdeler rakip oyunlardan kopyalanmış gizli değerler değildir; mevcut motor, resmi mekanik örnekleri ve kullanıcının istediği tempo kullanılarak Pehlevan Royale için belirlenen **kalibrasyon hedefleridir**.

### 5.1 Neon Kasası — “Seyrek değil, zincir patlamalı yüksek volatil”

**Duygu:** Normal turda sürekli küçük bir ihtimal ve zincir beklentisi; asıl heyecan tumble uzadığında ve güç sembolleri ekrana indiğinde büyür. Bonus daha seyrek ve güçlüdür ama 475 tur bekletmez.

| Hedef | Önerilen aralık |
|---|---:|
| Toplam RTP | %94,5–95,0 |
| Herhangi bir normal ödeme | %36–40 |
| Bahsi geri alma | %12–15 |
| Doğal free-spin | 1 / 180–230 |
| Normal oyun RTP katkısı | %60–66 |
| Bonus RTP katkısı | %28–34 |
| Bonus medyanı | 30–55x |
| Bonus P90 | 180–300x |
| Bonus P99 | 900–1.800x |
| Nadir tepe | 5.000x+ mümkün; 15.000x motor tavanı |

**Motor değişiklik planı:**

1. Base scatter hücre ağırlığı, 1/475 özelliği yaklaşık 1/200 bandına getirecek şekilde kademeli artırılacak; ilk kalibrasyon adayı 108/10.000’den yaklaşık 130–138/10.000 bandıdır.
2. Cluster devamlılığını sağlayan komşu sembol yeniden kullanım oranı hafif artırılacak; karşılığında düşük küme ödemeleri yeniden ölçeklenecek. Amaç daha fazla gerçek 1–2 cascade, aynı toplam RTP’dir.
3. 500x ve 1000x güç ağırlıklarının RTP katkısı ayrı raporlanacak ve uç kuyruktan alınan pay 2x–10x katmanlarına dağıtılacaktır. Nadir büyük çarpan imkânsız yapılmayacaktır.
4. Bonus içindeki biriken global çarpan korunacak. Ancak bütün cascade’ler bitmeden uygulanmayacak; `3x + 2x = 5x`, ardından `tur kazancı × 5` sunumu sıralı ses/animasyonla yapılacaktır.
5. Free-spin başlangıcı kullanıcı onayıyla başlayacak; oturum kazancı tur tur birikecek; normal “büyük kazanç” pencereleri bonus içinde açılmayacak, yalnız finalde “Free Spin Kazancı” özeti gösterilecektir.
6. 0–1x geri dönüşler “kazanç” diye sınıflandırılmayacak. Küçük geri dönüş için daha kısa ses; net kâr için bet katına göre ayrı seviye kullanılacaktır.

**Neon’un kimliği:** Kaptan’dan daha volatil, daha uzun cascade, daha seyrek ama daha etkili bonus, daha büyük P99. Fakat mevcut 475 tur özellik bekleme süresi ve kontrolsüz 1000x katkısı korunmamalıdır.

### 5.2 Kaptan Mercan — “Sık av, canlı normal oyun, orta-yüksek volatil bonus”

**Duygu:** Normal spin gerçekten oyunun bir parçası olmalı; küçük/orta hat kazançları, kaptan wild’ı ve gerçek iki-scatter kanca olayı daha sık aksiyon üretmeli. Bonus hâlâ büyük balığın geldiği yer olmalı ama toplam RTP’nin `%86` civarını tek başına taşımamalıdır.

| Hedef | Önerilen aralık |
|---|---:|
| Toplam RTP | %94,5–95,2 |
| Herhangi bir normal ödeme | %38–43 |
| Bahsi geri alma | %12–17 |
| Doğal free-spin | 1 / 85–110 |
| Normal oyun RTP katkısı | %58–64 |
| Bonus RTP katkısı | %31–37 |
| Bonus medyanı | 25–45x |
| Bonus P90 | 120–220x |
| Bonus P99 | 700–1.500x |
| Nadir tepe | 3.000x+ korunur; gelecekte 20.000x sert tavan düşünülebilir |

**Motor değişiklik planı:**

1. Hat ödeme tablosu yeniden kurulacak. Şu an 20 çizgiye bölünen bahis nedeniyle en yaygın üçlü eşleşmeler yaklaşık 0,075x–0,4x veriyor; bu, görünür kazançların çoğunu anlamsızlaştırıyor. Düşük ve orta sembol ödemeleri artırılacak, gerekirse sembol ağırlıklarıyla dengelenecek.
2. Bonusun toplam RTP katkısı `%77,58` puandan `%31–37` bandına indirilecek. Para balığı değer dağılımındaki uç katkı ile kaptan/para eşzamanlılığı ayrı ayrı simüle edilerek azaltılacak; çıkarılan RTP normal hat oyununa aktarılacak.
3. 1.000x ve daha nadir balıklar korunacak. Fakat sık bonusların medyanı yükselirken P99 kontrol edilecek; yani “çoğu 0–10x, arada tek dev ödeme” yerine daha dolgun 25–45x merkez dağılımı oluşturulacak.
4. İki scatter’dan gerçek kanca kurtarışı korunacak ve görsel olarak ayrı olay yapılacak. Sonuç sonradan sahte near-miss’e çevrilmeyecek; motorun baştan ürettiği gerçek olay animasyonla sunulacaktır.
5. Bonus sırasında bazı turlarda para balığı veya kaptan eksik kaldığında, önceden tanımlı düşük olasılıklı “Lodos Avı” dönüşümü uygulanabilir: tur sonucu içinde gerçek bir özellik olarak ek para balığı/kaptan düşer. Bu özellik ayrı telemetri alanıyla kaydedilir ve RTP hesabına dahildir.
6. Kaptan kademelerinde her dördüncü kaptan için +10 spin ve 2x/3x/10x kimliği korunur. Kademe yaklaşımı her tur görünür sayaç ve ses motifiyle anlatılır.

**Kaptan’ın kimliği:** Neon’dan daha sık gerçek geri dönüş, daha erişilebilir bonus, daha düşük boşluk hissi; büyük ödül ağırlığı daha düşük ama “balık yakalama” olayları daha düzenli.

## 6. Oynanışı daha canlı kılacak sistemler

Bu sistemler yalnız görsel süs değil, motor sonucu ile senkron gerçek geri bildirim olmalıdır:

1. **Bet-katına göre sonuç merdiveni:**
   - `<1x`: “Geri dönüş” — kısa, sakin ses
   - `1x–5x`: “Temiz Kazanç”
   - `5x–20x`: “Güçlü Vuruş”
   - `20x–100x`: “Büyük Kazanç”
   - `100x–500x`: “Muhteşem”
   - `500x+`: oyuna özel en üst sahne
2. **Gerçek olay sesleri:** scatter sayacı, son scatter beklentisi, güç düşüşü, cascade devamı, kaptan toplaması, kademe atlama ve final çarpma birbirinden farklı kısa motifler kullanmalı.
3. **Ritim:** Normal/turbo hızları sonuçları okunamaz hâle getirmemeli. Büyük olaylar turbo modda bile minimum görünür süreye sahip olmalı.
4. **Bonus ilerleme alanı:** Neon’da çalışan toplam çarpan ve bonus toplamı; Kaptan’da kaptan sayacı, bir sonraki kademe ve bonus toplamı sürekli görünür olmalı.
5. **Kazanç geçmişi:** Sol listede gross, bet, net ve bet katı ayrı gösterilmeli. Alt ana sonuç alanında negatif değer büyük “kazanç” biçiminde sunulmamalı.
6. **Oyun karakterine özgü AI:** Mira cascade’in matematiğine, güçlerin toplamına ve kaç turdur bonus görülmediğine doğal yorum yapabilir; Kaptan Mercan karakteri ise balık değeri, kaptan kademesi ve av ritmi üzerinden konuşmalıdır. AI sonucu değiştirmez, telemetriden bağlam alır.
7. **Nadir ama gerçek sahneler:** 100x, 500x ve tepe ödüller için ayrı kamera/ışık/ses katmanları; aynı sahne her kazançta kullanılmamalı.

## 7. Veritabanı ve admin panelinde eksik olanlar

### 7.1 Mevcut canlı geçmiş neden yeterli değil?

IndexedDB anahtarı protokol + host + port + tarayıcı profiline bağlıdır. Bu nedenle:

- `localhost:5173` ile `localhost:5175` iki ayrı kasa gibi davranır.
- Codex içi tarayıcı ile normal Chrome aynı geçmişi paylaşmaz.
- Şu an ihracat olsa da içe aktarma/migrasyon akışı yoktur.

### 7.2 Zorunlu altyapı düzeltmeleri

1. Tek kanonik adres kullanılmalı; geliştirmede bile port sabitlenmeli.
2. Veritabanına `installationId`, `profileId`, `appBuild`, `engineVersion`, `mathProfileVersion` eklenmeli.
3. JSON dışa aktarmanın yanına **içe aktar ve birleştir** eklenmeli; tekrar kayıtlar tur kimliğiyle engellenmeli.
4. Her turda aktif reel/ağırlık profili ve RNG/özellik sürümü kaydedilmeli.
5. Admin paneli canlı geçmişi motor simülasyonuyla yan yana göstermeli.

### 7.3 Her slot için admin ölçümleri

- Toplam/base/bonus RTP ve güven aralığı
- Any-hit, geri dönüş ve gerçek kâr oranı
- 0x, 0–1x, 1–5x, 5–20x, 20–100x, 100x+ dağılımı
- En uzun sıfır ve bahsin-altı serisi
- Scatter görünme, 2-scatter, kurtarış ve gerçek bonus oranı
- Bonus medyan/P75/P90/P99/maksimum
- Cascade derinliği ve her derinliğin RTP katkısı
- Her çarpan katmanının görünme ve ödeme katkısı
- Free-spin uzatma ve ortalama oturum uzunluğu
- Bonus satın alma maliyeti, RTP’si ve dağılımı
- Motor sürümü kırılımı; eski ve yeni oranları aynı tabloda karıştırmama

## 8. Free-spin final penceresi teşhisi

### Neon Kasası

`.bonus-summary`, oyun yüzeyinin içinde `position:absolute` ve yüzdesel `inset` ile konumlanıyor. Bu yüzden pencere görünüm alanının değil, slot makinesinin merkezini kullanıyor.

### Kaptan Mercan

Arka plan `position:fixed` olsa da modal dönüştürülmüş/ölçeklenmiş oyun ağacının içinde render ediliyor. CSS transform, fixed öğe için yeni bir containing block oluşturabildiğinden merkez hesaplama yine oyun paneline bağlanıyor. Ayrıca iki oyunda aynı `.bonus-summary` adı kullanıldığı için stil sızıntısı riski var.

### Kesin çözüm

- Her iki final penceresini `createPortal(..., document.body)` ile uygulama kabuğunun dışına çıkarmak
- Ayrı ad alanları kullanmak: `.neon-bonus-result-*`, `.fisher-bonus-result-*`
- Dış katman: `position:fixed; inset:0; display:grid; place-items:center; z-index` üst sistem katmanı
- İç kart: `max-width`, `max-height`, `overflow:auto`, yatay/dikey güvenli boşluk
- Açılışta odağı modal içine almak; Escape ve görünür kapatma düğmesi eklemek
- Telefon, uzun yarım ekran, 16:9 ve 43 inç yarım pencere ölçülerinde görsel test

## 9. Uygulama sırası

1. DB origin/sürüm kimliği ve içe aktarma temeli
2. Motor öncesi kalibrasyon test takımını kalıcı hâle getirme
3. Kaptan Mercan: normal oyun/bonus RTP yeniden dağıtımı
4. Neon Kasası: özellik sıklığı ve güç kuyruğu kalibrasyonu
5. Her oyun için 2–5 milyon tur; RTP güven aralığı ve kuyruk raporu
6. Free-spin portal pencereleri
7. Sonuç sınıfları, ses katmanları ve animasyon süreleri
8. Admin panelinde canlı sonuç–simülasyon karşılaştırması
9. Gerçek tarayıcıda uzun oyun oturumu ve kullanıcı hissi kontrolü

## 10. Kabul ölçütleri

Motor düzenlemesi “RTP yaklaşık doğru” denilerek tamamlanmayacaktır. Her oyun için:

- Hedef RTP aralığında en az 2 milyon tur
- Any-hit, geri dönüş ve gerçek kâr hedefleri ayrı ayrı sağlanmış
- Feature frequency ve bonus yüzdelikleri hedef aralıkta
- Aşırı ödül imkânı korunmuş fakat RTP’nin ezici bölümü tek uç katmandan gelmiyor
- Turbo dâhil olaylar izlenebilir
- Free-spin finali bir kez, ekranın gerçek merkezinde, doğru toplamla açılıyor
- Bütün sonuçlar `mathProfileVersion` ile veritabanına yazılıyor
- Admin panelinde canlı sapma görülebiliyor

---

## Son karar

Kullanıcının temel teşhisi doğrudur: iki oyunda da “ödeme var” metriği, hissedilen değeri olduğundan iyi göstermektedir. **Kaptan Mercan’da dağılım yapısal olarak bozuktur**; normal oyun yalnızca `%12,56` RTP katkısı üretirken bonus `%77,58` puan taşır. **Neon Kasası ise bonusu gereğinden seyrek ve üst çarpan kuyruğunu gereğinden oynak üretmektedir.**

Önerilen yön, iki oyunu aynılaştırmak değildir:

- Neon: daha zincirli, daha volatil, çarpanı ve bonusu büyük; ama 1/475 kadar kurak değil.
- Kaptan: daha sık gerçek geri dönüş, daha canlı normal oyun, daha erişilebilir bonus; ama nadir büyük balık imkânı korunmuş.

Bu hedefler onaylandıktan sonra motor değişiklikleri sürümlü, simülasyonla doğrulanmış ve admin panelinden izlenebilir biçimde uygulanmalıdır.
