# Pehlevan Royale — Şekerhane 1024 Araştırma ve Entegrasyon Planı

**Tarih:** 30 Ağustos 2026  
**Belge durumu:** Araştırma ve tasarım tamamlandı; uygulama başlamadı  
**Onay kapısı:** Bu belge kullanıcı tarafından incelenip onaylanmadan oyun kodu, görsel veya ses üretimine geçilmeyecek.

---

## 1. Kısa karar özeti

Önerilen oyun, Sugar Rush 1000'in doğrulanmış ana mekaniklerini temel alan fakat marka,
karakter, sembol, arka plan, ses ve matematik ayarları Pehlevan Royale'e ait olan özgün bir
slot olacaktır.

| Başlık | Önerilen karar |
| --- | --- |
| Çalışma adı | **Şekerhane 1024** |
| Katalog | Royal Reels / Slot Dünyası |
| Ana mekanik | 7×7 grid, 5+ yatay/dikey cluster, tumble/cascade |
| Ayırt edici mekanik | Aynı hücre tekrar tekrar kazandıkça `2× → 4× → … → 1024×` |
| Bonuslar | Doğal/100× Normal Free Spins ve yalnız satın alınabilen 500× Super Free Spins |
| Maksimum ödeme | Başlangıç önerisi `25.000× toplam bahis` |
| Matematik karakteri | Yüksek volatilite; varsayılan hedef RTP önerisi `%95,50` |
| Sunucu karakteri | **Narin — Gece Şekerhanesi'nin baş şeker ustası** |
| Görsel dünya | Midnight Art Deco + Osmanlı şekerhanesi + ölçülü baykuş/altı köşeli yıldız mimarisi |
| Uygulama yaklaşımı | Neon motorunu kopyalamayan, ayrı saf TypeScript motoru |
| İlk sürüme alınmayacak | Super Scatter anlık ödül mekaniği; v1 dengelendikten sonra ayrı faz |

Bu oyunun asıl eğlence eğrisi yalnız “semboller patlıyor” olmayacaktır. Oyuncu aynı anda:

1. İlk kümeyi kurar.
2. Patlayan hücrelerin şeker sırını/izini görür.
3. Aynı hücrelere yeniden sembol düşmesini takip eder.
4. Tek hücrenin 2×, 4×, 8× diye büyümesini izler.
5. Bir cluster birden fazla çarpan hücresine oturduğunda toplamı anlaşılır bir denklemle görür.
6. Bonus boyunca giderek ısınan 49 hücrelik haritayı korur.

---

## 2. Araştırılan oyun ailesi ve kaynak güveni

### 2.1 Sugar Rush — ilk sürüm

Pragmatic Play'in resmî ürün sayfasına göre ilk oyun:

- 7×7 grid kullanır.
- Yalnız yatay veya dikey bağlı 5+ aynı sembol cluster'ı öder.
- Kazanan semboller kalkar, semboller yukarıdan düşer ve yeni kazanç kalmayana kadar tumble sürer.
- Aynı hücre ikinci kez kazanan patlamaya katıldığında 2× başlar; sonraki vuruşlarda ikiye katlanarak 128×'e çıkar.
- 3/4/5/6/7 scatter sırasıyla 10/12/15/20/30 free spin verir.
- Bonus içinde işaretli hücreler ve çarpanlar bütün tur boyunca kalır.

Kaynak: [Pragmatic Play — Sugar Rush](https://www.pragmaticplay.com/en/games/sugar-rush/)

### 2.2 Sugar Rush 1000 — bu planın mekanik temeli

Resmî ürün sayfası ve oyun yardım metni birlikte değerlendirildiğinde:

- Grid ve cluster/tumble çekirdeği korunur.
- Hücre başına çarpan tavanı 128×'den **1024×**'e çıkar.
- Aynı cluster içindeki birden fazla aktif hücre çarpanı **birbiriyle çarpılmaz; toplanır**.
- Base oyunda hücre izleri yalnız mevcut tumble dizisi boyunca yaşar.
- Free Spins içinde iz ve çarpan haritası tüm bonus boyunca kalır.
- Bonus içinde 3–7 scatter tekrar 10/12/15/20/30 spin ekler.
- Örnek yardım metninde maksimum ödeme 25.000×'tir.
- Normal bonus satın alma 100×, Super Free Spins satın alma 500× toplam bahis bedelidir.
- Super Free Spins için yardım metni 49 hücrenin tamamında başlangıçta 2× bulunduğunu söyler.

Kaynaklar:

- [Pragmatic Play — Sugar Rush 1000](https://www.pragmaticplay.com/en/games/sugar-rush-1000/)
- [Sugar Rush 1000 — oyun yardım/rules PDF'i](https://yesplay.bet/assets/documents/pragmatic-play-Sugar-Rush-1000-rules.pdf)

### 2.3 Sugar Rush Super Scatter — araştırıldı, v1'e alınmadı

2026 tarihli resmî Super Scatter sürümü:

- 1024× hücre çarpanını korur.
- Normal scatter ve Super Scatter birleşimleriyle bonus tetikler.
- En az bir Super Scatter ile bonus tetiklenirse 50.000×'e kadar anlık ödül katmanı ekler.

Bu özellik Şekerhane 1024 v1'e eklenmeyecektir. Nedeni teknik yetersizlik değil; Normal Free
Spins, Super Free Spins, persistent 49-hücre haritası ve 1024× tavanı zaten ilk sürüm için
yeterince güçlü bir karar alanı oluşturur. Super Scatter aynı sürüme eklenirse matematik,
anlatım ve admin paneli gereksiz yere bulanır. v1 canlı verisi oturduktan sonra “Şekerhane:
Gece Mührü” gibi ayrı bir varyant olarak planlanabilir.

Kaynak: [Pragmatic Play — Sugar Rush Super Scatter](https://www.pragmaticplay.com/en/games/sugar-rush-super-scatter/)

### 2.4 Araştırmada bulunan çelişki ve alınan karar

Bir PokerStars incelemesi Super Free Spins başlangıcını merkezden dışarı `16× / 8× / 4× /
2×` halkaları şeklinde anlatıyor. Buna karşılık Pragmatic oyun yardımından dışarı aktarılan
kural PDF'i açıkça “bütün hücrelerde 2× başlangıç çarpanı” diyor. Başka oyun sayfalarında da
iki farklı anlatım tekrarlanıyor.

Bu planda **daha resmî ve doğrudan oyun yardım metni** esas alınmıştır:

> Super Free Spins: 49 hücrenin tamamı başlangıçta 2×.

Halkalı 16×/8×/4×/2× model uygulamaya alınmayacaktır. İleride orijinal oyunun canlı yardım
ekranından doğrudan doğrulanır ve kullanıcı özellikle isterse ayrı bir admin preset'i olarak
yeniden değerlendirilebilir.

İkincil kaynak: [PokerStars Casino Blog — Sugar Rush 1000 incelemesi](https://www.pokerstars.com/casino/news/sugar-rush-1000-a-sweet-slot-surprise/2947/)

### 2.5 RTP hakkında önemli kaynak notu

İncelenen yardım PDF'inde örnek yapılandırma için şu değerler yazıyor:

- Normal oyun: `%95,50`
- 100× Normal Free Spins alımı: `%95,51`
- 500× Super Free Spins alımı: `%95,43`

Başka operatör ve inceleme sayfalarında daha yüksek veya farklı RTP konfigürasyonları
bulunuyor. Dolayısıyla bunlar “Sugar Rush 1000 her yerde kesin bu RTP'dedir” anlamına gelmez.
Şekerhane 1024 kendi sembol ağırlıkları ve ödeme tablosuyla bağımsız simüle edilecek; resmî
oyunun raporlanmış sayısı yalnız başlangıç hedefi/referansıdır.

---

## 3. Şekerhane 1024 için kesinleşmesi önerilen oyun kuralları

### 3.1 Grid, semboller ve cluster

- Oyun alanı **7 sütun × 7 satır = 49 hücre** olacaktır.
- Yedi normal ödeme sembolü ve bir scatter bulunacaktır.
- Wild ilk sürümde olmayacaktır.
- Kazanç için en az **5 aynı sembol** gereklidir.
- Bağlantı yalnız dört yönde hesaplanır: üst, alt, sol ve sağ.
- Çapraz temas aynı cluster'a dahil değildir.
- Bağlı bütün semboller tek bir connected-component/cluster oluşturur.
- Aynı landing üzerinde oluşan farklı cluster'ların kazançları toplanır.
- Her cluster yalnız büyüklüğüne karşılık gelen en yüksek ödeme kademesini alır.

### 3.2 Tumble dizisi

Her ücretli spin veya free spin şu sırayla çözülür:

1. 49 hücrelik ilk landing üretilir.
2. Bütün cluster'lar aynı snapshot üzerinde bulunur.
3. Her cluster'ın taban ödemesi ve hücre çarpanı hesaplanır.
4. Kazanan bütün semboller aynı anda patlar.
5. Kalan semboller kendi sütunlarında gerçek düşüş mesafeleri kadar aşağı iner.
6. Açılan hücrelere yukarıdan yeni semboller girer.
7. Yeni cluster varsa 2. adıma dönülür.
8. Kazanç kalmadığında tumble dizisi kapanır.
9. Base oyunda multiplier haritası temizlenir; bonus içinde korunur.
10. Bütün tumble kazancı tek spin sonucu olarak bakiyeye/bonus kasasına yazılır.

Animasyon hiçbir zaman sonucu üretmez. Motor tüm sonucu önceden ve tek kez üretir; UI yalnız
motorun cascade listesi ve hücre kimliklerini oynatır.

### 3.3 Hücre işareti ve çarpan ilerlemesi

Her hücre şu durumlardan birini taşır:

- `unmarked`: Henüz kazanan patlama görmedi.
- `marked`: Bir kez kazanan patlama gördü; görünür sır/şeffaf iz var fakat çarpan yok.
- `2x, 4x, 8x, …, 1024x`: İki veya daha fazla kazanan patlama gördü.

İlerleme tablosu:

| Aynı hücredeki kazanan patlama sayısı | Hücre durumu |
| ---: | --- |
| 0 | işaretsiz |
| 1 | işaretli, çarpansız |
| 2 | 2× |
| 3 | 4× |
| 4 | 8× |
| 5 | 16× |
| 6 | 32× |
| 7 | 64× |
| 8 | 128× |
| 9 | 256× |
| 10 | 512× |
| 11+ | 1024× tavan |

İkinci patlamada doğan 2× aynı patlamayı üreten kazanca uygulanır. Sonraki patlamalarda da
önce hücre değeri yükselir, sonra o cluster'ın çarpan toplamına katılır.

### 3.4 Bir cluster'da birden fazla çarpan

Çarpanlar toplanır. Örnek:

- Cluster taban ödemesi: `1.250 PR`
- Cluster içindeki aktif hücreler: `2× + 8× + 16×`
- Uygulanan toplam: `26×`
- Cluster brüt ödemesi: `1.250 × 26 = 32.500 PR`

Cluster aktif çarpan hücresine değmiyorsa örtük çarpan `1×` kabul edilir. Aynı cascade'deki
her cluster kendi değdiği hücreleri ayrı hesaplar; bütün ekran için tek ortak multiplier
havuzu kullanılmaz.

### 3.5 Scatter ve bonus tetikleme

- Scatter normal cluster ödeme sembolü değildir.
- Scatter bütün sütun/hücrelerde görünebilir.
- Bir tumble landing'inde görünen 3/4/5/6/7 scatter sırasıyla 10/12/15/20/30 free spin verir.
- Bonus başlangıcı mevcut tumble dizisi tamamen anlatıldıktan sonra açılır; cascade ortasında
  sahne kesilmez.
- Aynı ücretli spin dizisinde birden çok landing scatter eşiğini gösterirse yalnız en yüksek
  görünür scatter sayısı tek kez ödüllendirilir.

Bu son iki madde, kaynak metindeki “herhangi bir yerde/landing” ifadesini teknik olarak
belirsiz bırakmamak için Şekerhane 1024'e ait açık uygulama kararıdır.

### 3.6 Normal Free Spins

Giriş yolları:

- Base oyunda doğal 3–7 scatter.
- Toplam bahsin `100×` bedeliyle satın alma.

Kurallar:

- Başlangıç multiplier haritası boştur.
- Hücre işaretleri ve çarpanlar bonus boyunca spinler arasında korunur.
- 3/4/5/6/7 scatter bonus içinde 10/12/15/20/30 ek spin verir.
- Bonus için ayrı, önceden simüle edilmiş sembol ağırlık profili kullanılır.
- Her free spin kazancı “bonus kasası”na eklenir; cüzdana ara ara yatırılmaz.
- Finalde toplam brüt bonus ödemesi tek ledger hareketiyle hesaba geçer.

### 3.7 Super Free Spins

Giriş yolu:

- Yalnız toplam bahsin `500×` bedeliyle satın alma.

Kurallar:

- 49 hücrenin tamamı başlangıçta `2×` olur.
- İlk kazanan patlamada ilgili 2× hücre 4×'e yükselir.
- Scatter sayısına göre 10/12/15/20/30 başlangıç spini ve aynı retrigger tablosu geçerlidir.
- Normal bonusla aynı motoru kullanır; yalnız `entryType`, maliyet ve başlangıç multiplier
  snapshot'ı farklıdır.
- Super mod doğal olarak tetiklenmez.

### 3.8 Maksimum ödeme

- Önerilen ilk tavan toplam bahis üzerinden `25.000×`'tir.
- Base spin bu tavana ulaşırsa tumble dizisi kontrollü biçimde kapanır ve tavan ödeme verilir.
- Bonus toplamı tavana ulaşırsa kalan free spinler oynatılmaz; final sahnesinde `MAKSİMUM
  KAZANÇ · 25.000×` açıkça gösterilir.
- Kesilmiş cascade/spin sayısı DB'de `capReached` ve `forfeitedSpins` olarak saklanır.

### 3.9 Oyuncuya gösterilen para

- Ana sahne brüt dönüşü gösterir: bahis dahil cüzdana geri giren toplam tutar.
- Son spin geçmişi ayrıca net sonucu gösterebilir.
- Örnek: 10.000 PR bahis, 24.000 PR brüt ödeme → ana tiyatro `24.000 PR KAZANÇ`, geçmiş
  satırı `+14.000 PR net`.
- Free spinlerde ara ödeme cüzdana geçmiş gibi gösterilmez; “Bonus Kasası” büyür.

---

## 4. Referans ödeme eğrisi ve özgün paytable kararı

Sugar Rush 1000 referansında yedi sembol 5 ile 15+ cluster arasında yükselen ödeme eğrilerine
sahiptir. En değerli sembol yaklaşık 1×–150×, en düşük sembol yaklaşık 0,2×–20× aralığındadır.

Şekerhane 1024'te referans oyunun marka sembolleri ve birebir ödeme tablosu kopyalanmayacaktır.
Önerilen özgün sembol ailesi:

| Değer sırası | Özgün sembol | Şekil/okunurluk görevi |
| ---: | --- | --- |
| 1 | Ayva lokumu mührü | Yuvarlak, kehribar, en değerli |
| 2 | Nar kalbi akidesi | Kalp, koyu kırmızı |
| 3 | Menekşe jelibon | Fasulye/kıvrım, mor |
| 4 | Antep yıldızı şekeri | Yıldız, fıstık yeşili |
| 5 | Gül ayıcığı | Ayıcık, gül pembe |
| 6 | Safran ayıcığı | Ayıcık, sarı/turuncu, farklı iç desen |
| 7 | Vişne ayıcığı | Ayıcık, bordo, farklı dış çizgi |
| Özel | Şekerhane kazanı | Scatter; mimari bakır kazan/şeker makinesi |

Üç ayıcık yalnız renkle ayrılmayacaktır; kulak, karın mührü ve dış siluetleri de farklı olur.
Renk körlüğünde semboller şekil ve doku üzerinden seçilebilmelidir.

İlk paytable bir “başlangıç tohumu” olacaktır. Kesin değerler ancak sembol ağırlıkları,
scatter profili, bonus profili ve 10 milyon+ spin simülasyonu birlikte tamamlanınca
kilitlenir. Admin panelinde görünen RTP, sabit yazı değil en son onaylanan simülasyon
raporunun kimliğine bağlı olacaktır.

---

## 5. Oyunu daha eğlenceli ve daha anlaşılır yapan özgün katmanlar

### 5.1 Şeker sır haritası

İlk patlamadan sonra hücrenin arkasında yalnız saydam bir renk bırakmak yerine, ince bir cam
şeker sırrı çatlağı oluşur. İkinci vuruşta 2× pirinç rakam görünür. Her ikiye katlanmada:

- sır rengi soğuktan sıcağa değişir,
- hücre kısa bir basınç dalgası verir,
- rakam fiziksel kabartma gibi yükselir,
- 32× ve üstünde oyun müziğine yeni bir vurmalı katman eklenir.

Bu harita sembollerin altında kalır ama sembol okunurluğunu bozmaz.

### 5.2 Kazanç makbuzu

Oyuncu “nereden kazandım?” diye tahmin etmek zorunda kalmaz. Her cluster çözümünde kısa bir
makbuz gösterilir:

`9 Nar Kalbi · 2,5× taban · hücreler 2× + 8× = 10× · 25.000 PR`

Normal modda makbuz 900–1300 ms, Turbo'da 320–500 ms görünür. Turbo matematik adımını
atlamaz; yalnız süreyi kısaltır.

### 5.3 Isı/odak kamerası

Bonus boyunca sağ/üst küçük HUD yerine grid'in kendi üzerinde yaşayan bir “aktif hücre
haritası” bulunur:

- kaç hücrenin işaretli olduğu,
- en yüksek hücre,
- toplam aktif çarpan sayısı,
- kalan free spin,
- bonus kasası

tek bakışta izlenir. Özellikle yüksek çarpanlı hücreye yaklaşan cluster'ın kenarı hafifçe
parlar; sonuç değişmez, yalnız oyuncunun dikkati doğru yere yönelir.

### 5.4 Narin'in fiziksel tepkileri

Narin sonuç üretmez ve matematiği değiştirmez. Oyun olaylarına tepki verir:

- ilk işaretli hücrede cam şeker çekiciyle tezgâha vurur,
- 16×/32× hücrede kazan ateşini yükseltir,
- scatter beklentisinde tezgâhtaki bakır kapakları açar,
- bonus başında multiplier haritasını oyuncuya sergiler,
- büyük cluster denkleminde kısa ve tekrarsız Türkçe cümle kurar.

AI sesinin varsayılanı kapalıdır. Yazılı tepki açık kalabilir; konuşma ayrı tercihtir.

### 5.5 Şekerhane Tarif Defteri — yalnız kozmetik meta ilerleme

Oturumlar arasında korunabilecek, sonucu etkilemeyen bir koleksiyon önerilir:

- ilk 32× hücre,
- tek cluster'da 3 aktif multiplier,
- 8+ tumble dizisi,
- doğal bonus,
- 15+ sembollü cluster

gibi başarılar yeni vitrin kartı, arka plan ışığı veya Narin repliği açar. Gizli RTP artışı,
“sıra sende” telafisi veya oyuncu geçmişine göre sonuç değiştirme yapmaz.

### 5.6 Büyük kazanç tiyatrosu

Pehlevan Royale ortak kademeleri korunur fakat şekerhane görsel diliyle uygulanır:

| Brüt ödeme / referans bahis | Sahne |
| ---: | --- |
| 10× | Büyük Kazanç |
| 25× | Muhteşem Kazanç |
| 100× | Şekerhane Vurgunu |
| 500× | Efsanevi Tarif |
| 1000×+ | Geceye Kazınan Kazanç |

Overlay viewport merkezine portal ile bağlanır. Açıkken arkadaki tumble durur. Turbo'da da
overlay grid'in altında kalamaz ve arkada cascade akamaz.

---

## 6. Sanat yönetimi

### 6.1 Ana dünya

Klasik çocuk şeker diyarı kopyalanmayacaktır. Önerilen dünya:

> Gece yarısı açık olan, cam tavanlı bir Osmanlı-Art Deco şekerhanesi. Ortada yediye yedi
> kristal şeker tezgâhı, arkada bakır kazanlar, vitray pencereler ve loş şehir manzarası.

Palet:

- zemin: mürdüm, gece laciverti, koyu kakao;
- metal: fırçalanmış pirinç ve sıcak bakır;
- şeker: nar kırmızısı, fıstık yeşili, safran, menekşe ve gül;
- multiplier: 2×'te bal rengi, 32×'te sıcak pembe, 256×+'ta beyaz-altın çekirdek.

### 6.2 Baykuş ve altı köşeli yıldız kullanımı

Tema “her düğmeye motif yapıştırmak” değildir.

- Altı köşeli yıldız yalnız ana vitray tavan geometrisinde ve scatter kazanının metal
  kakmasında kullanılır.
- Baykuş yalnız Narin'in tezgâhındaki pirinç kabartma/mekanik sayaç olarak görünür.
- Normal şeker sembollerinin üstüne tekrar tekrar motif konmaz.
- Bir sahnede bir güçlü mimari kullanım, onlarca küçük ikondan daha değerlidir.

### 6.3 Üretilecek asset seti — onay sonrasındaki faz

Bu belge kapsamında asset üretilmeyecek. Uygulama fazında:

- 7 normal şeker sembolü: şeffaf arka plan, aynı ışık yönü, 1:1 master PNG/WebP;
- 1 scatter kazanı: normal/anticipation/trigger üç hâl;
- Narin: idle, dikkat, kutlama, bonus ve büyük-kazanç varyantları;
- gece şekerhanesi arka planı: masaüstü 16:9 ve güvenli merkez kırpımlı dikey master;
- multiplier sırları: mümkünse CSS/SVG; bitmap sprite'a gereksiz bağımlılık yok;
- parçacıklar: 6–8 küçük atlas, sınırlı sayıda;
- lobi kartı ve açılış splash'i;
- bütün Imagegen prompt'ları `public/assets/slots/sekerhane-1024/ASSET_PROMPTS.md` içinde
  sürümlenecek.

Gerçek Sugar Rush görselleri, logosu, müziği veya sesleri indirilmeyecek/kullanılmayacaktır.

---

## 7. Ses tasarımı

Üç bağımsız kanal zorunludur:

1. **Müzik:** gece şekerhanesi lounge; santur/cam armonika, kontrbas ve hafif perküsyon.
2. **Efekt:** jel kırılması, şeker çatlağı, düşüş, multiplier yükselişi, scatter, ödeme.
3. **Narin AI sesi:** varsayılan kapalı; kullanıcı açarsa yalnız bu oyunda açılır.

Dinamik müzik katmanları:

- base idle;
- tumble 2+ için ritim;
- 16×+ hücre için gerilim katmanı;
- free spins için daha yüksek tempo;
- 100×+ ödeme için kısa kazanım sting'i.

Müzik, efekt ve konuşma oyun kimliği `sekerhane-1024` ile ayrı ayrı saklanır. Yeni spin,
tumble, bonus veya sayfa değişimi kapatılan kanalı kendiliğinden açamaz.

Ücretsiz ses bulunursa yalnız açık lisansla kullanılacak ve `THIRD_PARTY_ASSETS.md` ile
oyuna ait `AUDIO_LICENSES.md` güncellenecektir. Lisans belirsiz ses kullanılmayacaktır.

---

## 8. Ekran ve responsive düzen

### 8.1 Tek React ağacı

- Masaüstü, tablet ve telefon için ayrı oyun kopyaları yazılmayacak.
- Aynı semantik bileşen ağacı CSS Grid/Flex ve container query ile yeniden akacaktır.
- Kalıcı bölgeler mutlak `top/left/scale` koordinatlarıyla dizilmeyecektir.
- Mutlak konum yalnız geçici parçacık, kazanç overlay'i ve düşüş hareketinde kullanılabilir.

### 8.2 Sahne sırası

Semantik sıra her boyutta aynıdır:

`üst bar → oyun başlığı/bonus durumu → 7×7 grid → spin sonucu → ana kontrol iskelesi → ikincil geçmiş/AI`

### 8.3 Masaüstü

- Grid ana odaktır ve kullanılabilir yüksekliğe göre `min(width, height)` ile kare kalır.
- Narin/şekerhane sanatı geniş ekranda grid'i küçültmeden sol veya arka sahneyi doldurur.
- Sağ ikincil rayda oturum özeti ve yazılı AI bulunur; oyun alanı daralırsa önce bu ray
  drawer'a dönüşür.
- Alt kontrol iskelesi grid'i örtmez.

### 8.4 Mobil portre

- 390×844 ve Safari çubukları açık 390×664 ayrı kabul senaryolarıdır.
- Grid, bahis ve spin düğmesi aynı oynanış viewport'unda kalır.
- Üst bar yalnız geri, kısa logo, ses menüsü ve bakiye gösterir.
- Normal/Super bonus alımı tam ekran değil, alttan açılan doğrulama sheet'idir.
- Geçmiş, paytable ve Narin sohbeti ikincil drawer'dadır.
- Hücreler en az 42–46 CSS px dokunma/okuma alanı hedefler; sembol görseli hücreyi doldurur.

### 8.5 Mobil yatay / kısa ekran

- 625×292 ve 844×390'da grid solda kare, kontrol rayı sağda kompakt düzenlenir.
- Kalan spin, bonus kasası ve en yüksek hücre tek satır HUD olur.
- İkincil sohbet ve koleksiyon görünmez olmaz; ikonla açılan drawer'a taşınır.
- Yatay kaydırma sıfırdır.

### 8.6 Kabul matrisi

En az şu ölçüler test edilir:

- `390×664`
- `390×844`
- `844×390`
- `625×292`
- `1366×768`
- `1440×900`
- `837×1418`
- `1978×1871`

Her ölçüde otomatik DOM kontrolü:

- yatay/dikey taşma,
- grid–kontrol çakışması,
- minimum dokunma hedefi,
- önemli metin kesilmesi,
- modal/overlay viewport merkezi,
- grid kareliği ve hücre en-boy oranı

ile birlikte ekran görüntüsü incelemesi yapılır.

---

## 9. Teknik mimari

### 9.1 Neon motoru neden kullanılmayacak?

Neon Kasası da 7×7 cluster/cascade kullanıyor fakat matematiği farklıdır:

- Neon'da özel güç sembolleri vardır.
- Güç değerleri bağımsız iner ve tumble sonunda ortak şekilde toplanır.
- Bonus içinde ortak multiplier havuzu büyür.

Şekerhane 1024'te ise:

- özel güç sembolü yoktur;
- çarpan belirli fiziksel hücreye aittir;
- aynı hücredeki tekrar patlamayla ikiye katlanır;
- yalnız o cluster'ın değdiği aktif hücreler toplanır.

Bu yüzden ortak kod yalnız genel servislerde paylaşılır; oyun motoru ayrı yazılır.

### 9.2 Önerilen motor dosyaları

```text
src/games/slots/sekerhane/
  sekerhane-types.ts
  sekerhane-engine.ts
  sekerhane-engine.test.ts
  sekerhane-simulation.ts
  sekerhane-simulation.test.ts
  Sekerhane1024.tsx
  SekerhaneGrid.tsx
  SekerhaneControls.tsx
  sekerhane-audio.ts
  sekerhane.css
  sekerhane-responsive.css

src/ai/
  narin.ts

public/assets/slots/sekerhane-1024/
  ASSET_PROMPTS.md
  AUDIO_LICENSES.md
```

### 9.3 Saf motor sözleşmesi

Önerilen temel tipler:

```ts
type SekerhaneSymbolId =
  | 'ayva' | 'nar' | 'menekse' | 'antep-yildizi'
  | 'gul-ayicigi' | 'safran-ayicigi' | 'visne-ayicigi'
  | 'scatter'

type MultiplierSpot = {
  hits: number
  multiplier: 0 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024
}

type SekerhaneCluster = {
  id: string
  symbol: Exclude<SekerhaneSymbolId, 'scatter'>
  cells: Array<[number, number]>
  size: number
  baseWinX: number
  activeMultiplierCells: Array<[number, number]>
  multiplierSum: number
  winAmount: number
}

type SekerhaneCascade = {
  gridBefore: SekerhaneSymbolId[][]
  spotsBefore: MultiplierSpot[][]
  clusters: SekerhaneCluster[]
  removedCells: Array<[number, number]>
  spotsAfter: MultiplierSpot[][]
  gridAfter: SekerhaneSymbolId[][]
  sourceRows: Array<Array<number | null>>
  fallRows: number[][]
  cascadeWin: number
}

type SekerhaneSpinResult = {
  initialGrid: SekerhaneSymbolId[][]
  initialSpots: MultiplierSpot[][]
  cascades: SekerhaneCascade[]
  finalGrid: SekerhaneSymbolId[][]
  finalSpots: MultiplierSpot[][]
  scatterCount: number
  freeSpinsAwarded: number
  grossPayout: number
  capReached: boolean
}
```

Motor:

- UI, ses, AI, zamanlayıcı ve React import etmez.
- RNG fonksiyonunu dışarıdan dependency olarak alır.
- Aynı seed/config ile aynı sonucu verir.
- Sonucu bir defa üretir; animasyon tekrar RNG çağırmaz.
- Base, normal bonus ve super bonus aynı cluster/collapse fonksiyonlarını kullanır.
- `maxCascades` güvenlik sınırı yalnız sonsuz döngü korumasıdır; görünür sonuçları sessizce
  keserse test başarısız sayılır.

### 9.4 Üretim RNG ve gelecekte sunucu otoritesi

- Şimdiki kişisel sürümde sonuç `crypto.getRandomValues()` tabanlı adapter ile üretilebilir.
- Simülasyon/testte sabit seed'li hızlı PRNG adapter kullanılır.
- Çok kullanıcılı uzaktan yayında sonuç üretimi sunucu endpoint'ine taşınabilecek şekilde
  `SekerhaneOutcomeProvider` arayüzü baştan ayrılır.
- İstemci yalnız imzalı/kimlikli spin sonucunu oynatır; bakiye sonucu iki kere uygulayamaz.

### 9.5 UI durum makinesi

Önerilen açık durumlar:

```text
idle
→ committing-bet
→ landing
→ cluster-focus
→ bursting
→ spot-upgrade
→ falling
→ landing (yeni cascade varsa)
→ scatter-ceremony (varsa)
→ settling
→ win-theatre (eşik varsa)
→ idle

bonus-ready
→ bonus-intro
→ bonus-playing
→ retrigger-ceremony (varsa)
→ bonus-playing
→ bonus-summary
→ idle
```

Tek bir `busy` boolean yerine bu state machine kullanılmalıdır. Böylece Turbo'da overlay açıkken
arkada cascade ilerlemesi, bonus ödemesinin iki kez yazılması veya sonuç ekranının yanlış yerde
kalması önlenir.

### 9.6 Render ve performans

49 hücre için Phaser veya tam Canvas zorunlu değildir. Öneri:

- gerçek semboller: stabil kimlikli 49 React/DOM hücresi;
- düşüş/patlama: CSS transform + Web Animations API;
- hücre sırları: CSS/SVG;
- yalnız parçacıklar: düşük çözünürlüklü, limiti olan Canvas overlay;
- görseller: AVIF/WebP, açılışta kritik asset preload;
- aynı efektte sürekli yeni `Audio` üretmek yerine pool/Web Audio buffer;
- `prefers-reduced-motion` için kısa fade/scale;
- görünmeyen sohbet/geçmiş raylarında gereksiz render engeli.

---

## 10. Matematik profili ve simülasyon planı

### 10.1 Önerilen ilk karakter

| Ölçü | Başlangıç önerisi |
| --- | --- |
| Hedef RTP | `%95,50` |
| Volatilite | Yüksek |
| Maksimum ödeme | `25.000×` |
| Normal bonus alımı | `100×` |
| Super bonus alımı | `500×` |
| Hücre tavanı | `1024×` |
| Minimum cluster | `5` |

Bu değerler uygulama koduna sabitlenmiş gerçek sonuçlar değil, simülasyon hedefleridir.

### 10.2 Hissiyat hedefleri

Kullanıcının önceki slotlarda bildirdiği “çok uzun boş spin, sonra tek devasa bonus” sorununu
ölçmek için yalnız RTP yeterli değildir. Ayrı izlenecek hedef bantlar:

- herhangi bir brüt dönüş hit rate'i: başlangıç hedefi `%28–34`;
- bahis üstü kârlı spin oranı: başlangıç hedefi `%15–21`;
- ilk kazançtan sonra en az bir ek tumble: `%35–50`;
- doğal bonus sıklığı: başlangıç araştırma bandı yaklaşık `1/180–1/260` ücretli spin;
- en uzun sıfır ödeme serisinin P95/P99 dağılımı;
- 5×, 10×, 25×, 100×, 500× ve 1000×+ sonuç oranları;
- bonus medyanı, P90, P99 ve maksimumu;
- normal buy ve super buy için maliyeti geri çıkarma oranları;
- multiplier haritasında 2×/4×/8×/…/1024× görülme oranı.

Bu bantlar kullanıcı oynanışı ve simülasyon çıktısıyla ayarlanabilir. Geçmişte kaybedene gizli
yardım, kazanana fren veya kullanıcıya göre spin sonucu değiştirme yapılmaz; profil bir tur
başlamadan önce sabit matematik konfigürasyonu seçer ve round kaydına yazılır.

### 10.3 Simülasyon kapıları

1. **Hızlı geliştirme:** Her mod için en az 100.000 spin.
2. **Kalibrasyon:** Base/natural bonus, 100× buy ve 500× buy için ayrı ayrı en az 1 milyon tur.
3. **Sürüm adayı:** Toplam en az 10 milyon ücretli eşdeğer örnek.
4. **Uç test:** Max multiplier, 25.000× cap, 30-spin trigger, retrigger ve cascade limiti için
   zorlanmış seed testleri.

Her rapor şunları içermelidir:

- config/profile kimliği ve hash'i;
- toplam stake ve payout;
- RTP ve güven aralığı;
- hit/profit/zero oranları;
- bonus frekansı;
- dead-spin streak histogramı;
- kazanç quantile'ları;
- cascade uzunluğu dağılımı;
- multiplier hücre dağılımı;
- cap sayısı ve cap'e giden yollar;
- CPU süresi ve bellek tüketimi.

Normal oyun, normal buy ve super buy RTP'leri birbirinden bağımsız doğrulanmadan admin
panelinde “hazır” görünmemelidir.

---

## 11. Admin paneli entegrasyonu

Mevcut `SlotMathSettings` Neon ve Kaptan Mercan için ortak alanlar taşıyor fakat iki ayrı
bonus buy ve hücreye bağlı multiplier matrisi için yetersizdir. Her alanı anlamsız biçimde
genel tipe eklemek yerine yeni bir özel ayar grubu önerilir:

```ts
type ClusterMultiplierSlotTuning = {
  profileName: string
  configVersion: string
  targetRtp: number
  maxWinX: number
  minimumCluster: number
  maxCascades: number
  maxSpotMultiplier: 128 | 256 | 512 | 1024
  symbolWeights: Record<SekerhaneSymbolId, number>
  bonusSymbolWeights: Record<SekerhaneSymbolId, number>
  clusterPays: Record<Exclude<SekerhaneSymbolId, 'scatter'>, Record<string, number>>
  freeSpins: Record<'3' | '4' | '5' | '6' | '7', number>
  regularBuyX: number
  superBuyX: number
  superStartPreset: 'all-2x'
  normalStepMs: number
  turboStepMs: number
  receiptMs: number
  winTheatreThresholds: number[]
}
```

Admin oyun seçicisinde Şekerhane 1024 seçildiğinde bölümler:

1. **Genel:** açık/bakım, min/default bahis, autoplay, karakter, ses, müzik.
2. **Matematik:** hedef RTP, cap, min cluster, sembol ağırlıkları, paytable.
3. **Multiplier:** ilerleme, hücre tavanı, base/bonus kalıcılığı.
4. **Free Spins:** 3–7 tablosu, bonus reel/ağırlık profili, retrigger.
5. **Bonus Alımı:** 100× ve 500× ayrı aç/kapa, maliyet ve başlangıç preset'i.
6. **Sunum:** normal/turbo süreleri, anticipation, makbuz, büyük kazanç tiyatrosu.
7. **Simülasyon:** son rapor, örneklem, gözlenen RTP, uyarı ve config hash.

Validasyon:

- negatif ağırlık ve ödeme reddedilir;
- ağırlık toplamı sıfır olamaz;
- multiplier sırası iki kat artmalıdır;
- `regularBuyX` ve `superBuyX` oyuncunun bakiyesine göre alınabilir tutarı etkiler; sabit bahis
  tavanı yaratmaz;
- aktif bonus sırasında config değişikliği mevcut oturuma uygulanmaz;
- kaydetme yeni immutable `configVersion` üretir;
- yayınlamadan önce simülasyon raporu zorunludur.

Kullanıcıya özel profil atanacaksa round başlamadan `gameProfileId → configVersion` çözülür.
O round ve bonus bitene kadar snapshot değişmez.

---

## 12. SQLite, cüzdan ve yeniden bağlanma

### 12.1 Yeni oyun kimliği

Ortak tip ve servislerde `CasinoGameId` içine `sekerhane-1024` eklenecektir.

### 12.2 Ücretli spin kaydı

Her ücretli spin `CasinoRoundRecord` içinde en az şunları taşır:

```text
telemetryVersion
engineVersion
configVersion / configHash / gameProfileId
rngModel / seedDigest / nonce
entryType: base | natural-bonus-trigger | regular-buy | super-buy
wager / totalCost / balanceBefore / balanceAfter
initialGrid / finalGrid
initialSpots / finalSpots
cascades[]
  gridBefore / gridAfter
  clusters[]
  removedCells
  spotsBefore / spotsAfter
  cascadeWin
scatterCount / freeSpinsAwarded
grossPayout / net / winMultiple
capReached
turbo / autoplay / sessionSpin
```

### 12.3 Bonus session kaydı

Bonus tek dev round blob'u olmayacaktır:

- bonus giriş/alış round'u;
- `bonusSessionId` taşıyan bonus session meta kaydı;
- her free spin için ayrı event/round ayrıntısı;
- retrigger event'i;
- final bonus summary round'u;
- tek final payout ledger girdisi.

Bonus state sunucu/SQLite tarafında hesap kimliğiyle saklanır:

```text
bonusSessionId
userId
entryType
referenceBet
configSnapshot
remainingSpins / playedSpins / awardedSpins
multiplierSpots[7][7]
bonusTotal
capReached
updatedAt
```

Sayfa yenileme, cihaz değişimi veya tünelden yeniden girişte bonus kaldığı yerden açılır.
`localStorage` yalnız ses/UI tercihi gibi önbellek için kullanılabilir; bakiye veya aktif bonusun
otoritesi olamaz.

### 12.4 Cüzdan kuralları

- Base spin: bir `stake`, sonuçta varsa bir `payout`.
- Natural bonus: base stake bir kez; free spinlerde stake yok; finalde tek bonus payout.
- 100× buy: tek `stake = wager × 100`; finalde tek payout.
- 500× buy: tek `stake = wager × 500`; finalde tek payout.
- UI tekrar render olduğunda ledger hareketi tekrarlanamaz; idempotency key `roundId + type`.
- Bakiye yalnız hesap sunucusunun döndürdüğü authoritative değerden güncellenir.

### 12.5 Araştırma paneli

`SlotMathAudit` yalnız Neon/Kaptan Mercan union'ına sabit kalmamalıdır. Şekerhane için:

- paid base,
- natural free spins,
- regular buy,
- super buy

ayrı segmentler raporlanır. Bonus RTP'si base turundan kopuk veya iki kere sayılmaz.

---

## 13. Ortak bahis ve kontrol standardı

- `src/games/wagering.ts` ve `CASINO_BET_STEPS` kullanılacaktır.
- Hızlı kupürler bahis tavanı değildir.
- Serbest sayısal giriş ve `MAX` her zaman bulunur.
- Normal spin için maksimum bahis kullanılabilir bakiyedir.
- 100× buy için maksimum referans bahis `bakiye / 100`.
- 500× buy için maksimum referans bahis `bakiye / 500`.
- Kesir ve minimum bahis kuralları ortak wager yardımcılarıyla normalize edilir.
- Ana alt iskelede tek bakışta `bahis → maliyet → eylem` görünür.
- Bonus satın alma doğrudan tek tıkla para düşürmez; maliyeti yazan kısa doğrulama gerekir.
- Autoplay normal spin içindir; bonus satın almayı otomatik tekrar etmez.

---

## 14. Test planı ve tamamlanma ölçütü

### 14.1 Motor birim testleri

- 4 yönlü komşuluk; çaprazın reddi.
- Ayrı cluster'ların birleşmemesi.
- 5–15+ pay tier seçimi.
- Aynı anda birden çok cluster toplamı.
- İlk vuruş `marked`, ikinci `2×`, sonra ikiye katlanma ve 1024× tavanı.
- Bir cluster'daki çarpanların toplanması, çarpılmaması.
- Çarpansız cluster için 1× davranışı.
- Survivor/source row ve gerçek düşüş mesafesi.
- Scatter'ın cluster'a girmemesi.
- 3–7 scatter başlangıç/retrigger tablosu.
- Base sonunda harita reseti.
- Normal bonus içinde persistent harita.
- Super bonus başlangıcında 49 adet 2× hücre.
- 25.000× cap ve kalan spinlerin kapanması.
- Aynı seed/config için aynı sonuç.

### 14.2 Akış testleri

- Normal spin → stake → cascade → payout.
- Doğal bonus → intro → bütün free spinler → tek payout.
- 100× buy → doğru maliyet → boş başlangıç haritası.
- 500× buy → doğru maliyet → tüm hücreler 2×.
- Bonus sırasında reload ve başka cihazda resume.
- Turbo açıkken makbuz/spot-upgrade aşamalarının atlanmaması.
- Büyük-kazanç overlay'i açıkken arkada cascade ilerlememesi.
- Ses kapalıyken yeni spin/bonusun kanalı açmaması.
- Ledger idempotency ve kullanıcı hesap izolasyonu.

### 14.3 Görsel kabul

- 49 hücre her ölçüde kare ve okunur.
- Grid sembolü, multiplier rakamı ve kazanma outline'ı birbirini kapatmaz.
- Sonuç denklemi cluster'ın üstüne rastgele binmez.
- Bonus kasası ve kalan spin aynı anda görünür.
- Scatter intro ve bonus final overlay'i gerçek viewport merkezindedir.
- Mobilde yatay kaydırma yoktur.
- Ana spin/bahis kontrolü grid ile aynı oynanış viewport'undadır.
- Uzun ekranda grid ortada küçücük kalmaz; geniş ekranda da gereksiz esnemez.
- Narin ve dekor, oyun alanının önceliğini bozmaz.

### 14.4 Definition of Done

Oyun ancak aşağıdakilerin tamamı sağlanınca “bitti” sayılır:

- [ ] Bu plan kullanıcı tarafından onaylandı.
- [ ] Özgün ad, karakter ve sanat yönü onaylandı.
- [ ] Saf motor ve birim testleri tamamlandı.
- [ ] Base/normal buy/super buy simülasyon raporları geçti.
- [ ] Bütün animasyon fazları oynanabilir ve anlaşılır.
- [ ] Müzik, efekt ve AI sesi ayrı kontrol ediliyor.
- [ ] Admin ayarları config version ve validasyonla çalışıyor.
- [ ] SQLite round/event/ledger kayıtları ve bonus resume çalışıyor.
- [ ] Hesaplar arası bakiye/bonus karışmıyor.
- [ ] Responsive kabul matrisi geçti.
- [ ] Asset kaynak ve lisans kayıtları tamamlandı.
- [ ] Üretim build'i ve bütün testler geçti.

---

## 15. Önerilen uygulama sırası — onay sonrasında

### Faz 1 — Matematik ve motor

1. Oyun tipleri ve saf cluster motoru.
2. Hücre multiplier state'i.
3. Base tumble ve scatter.
4. Normal/Super bonus state'i.
5. Seed'li test ve simülasyon CLI'ı.
6. İlk 1 milyonluk kalibrasyon.

### Faz 2 — Veri ve admin

1. Game ID, varsayılan config ve profile version.
2. Admin özel tuning paneli.
3. Round/event/ledger telemetrisi.
4. Aktif bonus persistence/resume.
5. Araştırma paneli segmentleri.

### Faz 3 — Görsel prototip

1. Asset üretim prompt'ları ve kaynak/lisans planı.
2. Narin + arka plan + sembol seti.
3. Stabil kimlikli 7×7 DOM grid.
4. Tumble, patlama ve multiplier sır animasyonları.
5. Kazanç makbuzu ve bonus HUD.

### Faz 4 — Ses ve AI

1. Üç ayrı ses kanalı.
2. Dinamik müzik katmanları.
3. Narin olay sözlüğü ve yerel AI bağlamı.
4. Varsayılan kapalı AI sesi.

### Faz 5 — Responsive ve kalite

1. Ortak responsive game shell.
2. Mobil portre/yatay düzen.
3. Tüm kabul ölçülerinde otomatik geometri testi.
4. Görsel inceleme ve ritim ayarı.
5. 10 milyon+ sürüm adayı simülasyonu.

---

## 16. Kullanıcı onayına sunulan kararlar

Önerilen varsayılanların tamamı:

1. Ad: **Şekerhane 1024**.
2. Dünya: çocuk şeker diyarı değil, gece Osmanlı–Art Deco şekerhanesi.
3. Sunucu: **Narin**, baş şeker ustası.
4. Matematik temeli: Sugar Rush **1000**; hücre tavanı 1024×.
5. Normal Free Spins: doğal veya 100× buy; boş multiplier haritasıyla başlar.
6. Super Free Spins: yalnız 500× buy; 49 hücrenin tamamı 2× başlar.
7. Maksimum ödeme: 25.000×.
8. Başlangıç hedef RTP: %95,50; kesin değer simülasyon sonrası kilitlenir.
9. Super Scatter: v1 dışında, daha sonraki ayrı varyant.
10. Özgün ekstra: Şeker Sır Haritası, Kazanç Makbuzu, Narin tepkileri ve kozmetik Tarif
    Defteri.

Kullanıcı bu kararları onayladığında uygulama Faz 1'den başlayacaktır. Bir karar değiştirilirse
önce bu belge revize edilir; motor ve asset üretimi revize edilmiş sürüme göre yürütülür.

---

## 17. Kaynakça

Birincil/resmî:

- [Pragmatic Play — Sugar Rush](https://www.pragmaticplay.com/en/games/sugar-rush/)
- [Pragmatic Play — Sugar Rush 1000](https://www.pragmaticplay.com/en/games/sugar-rush-1000/)
- [Pragmatic Play — Sugar Rush Super Scatter](https://www.pragmaticplay.com/en/games/sugar-rush-super-scatter/)
- [Pragmatic Play — Sugar Rush lansman yazısı](https://www.pragmaticplay.com/en/news/pragmatic-play-delivers-a-real-treat-in-sugar-rush/)
- [Pragmatic Play — Sugar Rush Super Scatter lansman yazısı](https://www.pragmaticplay.com/en/news/pragmatic-play-unwraps-sweet-series-addition-in-sugar-rush-super-scatter/)

Oyun yardım/regülasyon metinleri:

- [Sugar Rush 1000 — oyun rules PDF'i](https://yesplay.bet/assets/documents/pragmatic-play-Sugar-Rush-1000-rules.pdf)
- [Sugar Rush — oyun rules PDF'i](https://yesplay.bet/assets/documents/pragmatic-play-Sugar-Rush-rules.pdf)
- [Litvanya düzenleyici onay eki — oyun kuralları derlemesi](https://lpt.lrv.lt/public/canonical/1743681644/1141/patvirtintas%20OC_nuotoliniu_2_priedo%2Bpapildymas_originalas.pdf)

Çelişki kontrolü için kullanılan ikincil kaynak:

- [PokerStars Casino Blog — Sugar Rush 1000 incelemesi](https://www.pokerstars.com/casino/news/sugar-rush-1000-a-sweet-slot-surprise/2947/)

Kaynak önceliği: doğrudan oyun yardım metni ve resmî sağlayıcı sayfası, ikincil inceleme
yazılarından üstündür. Şekerhane 1024'ün gerçek matematik değeri bu kaynaklardan kopyalanmış
bir iddia değil, kendi simülasyon raporuyla doğrulanacaktır.

---

## 18. Uygulama durumu · 30 Ağustos 2026

Plan onaylandı ve v1 uygulaması tamamlandı. Saf 7×7 motor, 5+ ortogonal küme, tumble,
kalıcı hücre izleri, 2×…1024× yükseliş, küme içi çarpan toplamı, doğal bonus, 100× Gece
Tarifi, 500× bütün hücreleri 2× başlatan Süper Tarif ve 25.000× tavanı kodlandı.

Şekerhane; lobi, admin parametreleri, oyun bazlı müzik/FX/AI tercihleri, Narin sunucusu,
SQLite tur/ledger/event kaydı, kullanıcıya özel standart profil tohumu, araştırma paneli ve
Tarif Defteri ilerleme sistemine bağlandı. Özgün Narin ve gece şekerhanesi rasterları
Imagegen ile üretildi; semboller ve çarpan hücreleri kod-native CSS olarak çizildi.

Sabit tohum motor testleri, 50.000 ücretli spin temel örneklemi, bonus dahil birleşik
örneklem, üretim TypeScript/Vite derlemesi ve tarayıcıda masaüstü + 390×844 iPhone 13
kabul akışı çalıştırıldı. Kabul turu; ücretli spin, turbo, auto, bonus satın alma onayı,
10 ücretsiz spin, kalıcı hücre haritası ve tek seferlik bonus ödemesini kapsadı.
