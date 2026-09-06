# Pehlevan Royale — İlerleme, Mimari ve Kalite Standardı

> Son güncelleme: 30 Ağustos 2026  
> Amaç: Yeni bir Codex oturumu bu dosyayı okuyarak geçmiş konuşmayı tekrar istemeden doğru kalite çıtasından devam etsin.  
> Ürün sınırı: Kişisel eğlence modu, yalnızca sanal PR bakiyesi; gerçek para, ödeme veya para çekme yok.

## 1. Kullanıcının değişmeyecek ana beklentisi

Pehlevan Royale sıradan mini oyunlar koleksiyonu değildir. Her oda kendi görsel
kimliği, tam oyun kuralları, fiziksel hissi olan animasyonları, ses dünyası,
arka plan müziği ve Türkçe AI karakteri bulunan canlı bir özel casino olmalıdır.

Yeni özellik geliştirirken kullanıcıya daha önce söylediği aşağıdaki maddeler
yeniden söyletilmemelidir:

- Arayüz premium, göz doldurucu, eğlenceli ve okunaklı olmalı; birkaç renk ve
  basit kutudan oluşmamalı.
- Oyun gerçek kurallarını ve yaygın ileri özelliklerini taşımalı. Kullanıcının
  verdiği örnekle sınırlı kalınmamalı; oyun önceden araştırılmalı.
- Animasyonlar sonucu anlaşılmaz hızda atlamamalı. Kart, çip, top, makara,
  cascade ve ödeme fiziksel bir sırayla takip edilebilmeli.
- Her oyunun ayrı Türkçe karakteri ve konuşma biçimi olmalı. Karakter mevcut
  bahis, kart, toplam, sonuç, çarpan ve geçmiş eli görerek özel yorum yapmalı;
  aynı genel cümleleri tekrar etmemeli.
- Ses efektleri, karakter sesi ve arka plan müziği birbirinden ayrı kontrol
  edilebilmeli.
- Bahislerde yapay 500 PR benzeri üst sınırlar konmamalı. Gerçek sınır sanal
  bakiye, oyun matematiği ve yönetici ayarıdır.
- Kazanç/kayıp, bahis, çarpan, bonus, boost ve oyun içi aşamalar analiz için
  ayrıntılı biçimde veritabanına yazılmalı.
- Açık lisanslı varlıkların kaynak ve lisans bilgisi korunmalı. Marka taklidi
  yapılmamalı; mekaniklerden ilham alınsa bile görsel kimlik özgün olmalı.

## 2. Mevcut oynanabilir ürün

### Blackjack — Vera’s Private Table

- Çok desteli Blackjack; hit, stand, double, split, surrender ve sigorta.
- Perfect Pairs ve 21+3 yan bahisleri; tekrarlanabilir fiziksel çip yığınları.
- Kart dağıtma/çevirme/karıştırma animasyonları, krupiye Vera, Türkçe AI sohbeti
  ve Türkçe kadın sesi.
- El sonu net kazanç ekranı kapatılabilir; son sonuç tekrar açılabilir.
- Oyun ve AI kayıtları IndexedDB araştırma verisine yazılır.

### Canlı Avrupa Ruleti — Armand / Rouge Salon

- Tek sıfır, iç/dış bahisler, komşu ve ilan bahisleri.
- 30 saniyelik canlı döngü; oyuncu odaya turun ortasında katılabilir.
- Çark/top animasyonu, Pehlevan Surge sayı çarpanları, sonuç ve ayrıntılı kazanan
  bahis özeti.
- Tur kapanınca bahisler kilitlenir; ödeme sonrasında temizlenir; aynı bahis
  yeniden yüklenebilir.
- Arka plandaki oyuncusuz canlı turlar dahil sonuçlar veritabanına yazılır.

### Kiraz Kulübü 77 — Rocco

- 3×3 klasik çizgi slotu, beş ödeme çizgisi, hold, turbo ve otomatik spin.
- Retro kabin, fiziksel makara ritmi, kazanan çizgi ve oturum neti.
- Rocco sohbeti ve oyun olaylarına bağlı karakter yorumları.

### Neon Kasası — MIRA

- 7×7 cluster/cascade alanı. Patlayan hücrenin üstündeki mevcut semboller
  kimliklerini koruyarak aşağı düşer; yalnız açılan üst hücrelere yenileri girer.
- Bağımsız güç/çarpan sembolleri, tumble sonu toplama animasyonu ve denklem.
- Dört MIRA ile free spin, bonus satın alma, bonus içinde retrigger ve bonus
  sonuna kadar biriken ortak çarpan/kazanç.
- M×2 MIRA Boost, ücretli spin maliyetini %25 artırır ve MIRA olasılığını
  yükseltir. Her turda `modifiers.scatterBoost`, gerçek `paidSpinCost`, grid,
  cascade, scatter ve çarpan ayrıntıları kaydedilir.
- Büyük kazanç katmanları yalnız ücretli spin sonucunda; free spin sonunda tek
  bir “Free Spin Kazancı” özeti gösterilir.

## 3. Mevcut teknik mimari

| Alan | Kaynak |
| --- | --- |
| Uygulama ve Blackjack | `src/App.tsx`, `src/lib/blackjack.ts`, `src/lib/side-bets.ts` |
| Rulet | `src/games/roulette/` |
| Slot dünyası | `src/games/slots/` |
| AI karakterleri | `src/ai/vera.ts`, `armand.ts`, `rocco.ts`, `mira.ts` |
| Oyun/AI araştırma DB | `src/data/casino-database.ts` |
| Yönetici ayarları | `src/data/casino-admin.ts`, `src/components/AdminPanel.tsx` |
| Müzik sistemi | `src/audio/casino-music.ts`, `GameMusicControls.tsx` |
| Genel okunabilirlik | `src/readability.css` |
| Tipografi sistemi | `src/typography.css`, `public/assets/fonts/` |
| Varlık lisansları | `THIRD_PARTY_ASSETS.md` |

Teknoloji: React + TypeScript + Vite. Oyun sonucu ve RNG, AI metninden bağımsız
deterministik/test edilebilir motorlarda kalır. RNG tarayıcıda
`crypto.getRandomValues()` kullanır. AI yalnız sunum ve konuşma katmanıdır.

## 4. Ses ve müzik standardı

Arka plan müziği efektlerden ve AI sesinden bağımsızdır.

- Her oyun `GameMusicControls` taşır: müzik aç/kapa ve oyuncu ses seviyesi.
- Admin > Oyun Yönetimi: oyun bazlı açık/kapalı, seviye, hazır katalog, URL,
  yerel dosya yükleme, önizleme ve silme.
- Admin > Sistem: ana ses sistemi, tüm müzikleri aç/kapa ve ana müzik seviyesi.
- Yerel yüklenen ses Blob olarak `pehlevan-royale-music` IndexedDB’sinde tutulur.
- Oyun geçişlerinde müzik yeniden çözülür ve yumuşak açılır. Tarayıcı autoplay
  engellerse ilk kullanıcı dokunuşunda başlar.
- Efektler anlaşılır kalmalı; varsayılan müzik seviyesi efektlerden belirgin
  biçimde düşük tutulmalıdır.
- Yeni oyun eklerken varsayılan parça, kaynak sayfası, sanatçı ve lisans hem
  `casino-music.ts` hem `THIRD_PARTY_ASSETS.md` içine eklenmelidir.

Yerleşik CC0 müzikler:

| Oyun | Parça | Ton |
| --- | --- | --- |
| Blackjack | Forget Me Not — Kistol | Zarif neoklasik piyano |
| Rulet | Hello from the Children of Planet Earth — hatmix | Lounge |
| Kiraz 77 | 8Bit Title Screen — Joth | Retro chiptune |
| Neon Kasası | PYNCHON — James Gargette | Lo-fi cyberpunk |

## 5. Görsel ve responsive kalite standardı

- CSS’te olağan arayüz metni için alt sınır 12 px; gövde/sohbet çoğunlukla
  13–16 px olmalıdır. Mikro dekor metni okunabilirliği bozamaz.
- Çipin değeri, hangi alana konduğu ve kaldırma işlemi aynı anda görünmelidir.
- Masa sonuçları ortayı sonsuza kadar kapatamaz; her modal/sonuç katmanında
  görünür `×` bulunur.
- Uzun ve bölünmüş 43 inç ekran kullanımı birincil senaryodur. Ekranın altını
  anlamsız boş bırakmak ya da oyunu aşırı germek kabul edilmez.
- Zorunlu görsel kontrol ölçüleri: `1978×1871`, `1440×900`, `980×1400`.
- Yatay sayfa taşması olmamalı. Dar görünümde oyun ve sohbet mantıklı sırayla
  dikey dizilir; kritik kontrol görünmez hale gelmez.
- Hareket azaltma tercihi (`prefers-reduced-motion`) desteklenir.

### Tipografi rolleri

- Uzun metin, sohbet, form ve buton: **Manrope** (400–700). Türkçe cümleler
  serif ya da monospace ile yazılmaz.
- Masa baskısı, kısa durum etiketi, oran, bahis ve sayaç: **Barlow Condensed**
  (500–700). Dar alanda güçlü görünür; aşırı `letter-spacing` kullanılmaz.
- Karakter adı, salon başlığı ve büyük sonuç: **Playfair Display**. 12–14 px
  mikro metinde kullanılmaz.
- **DM Mono** yalnız saat, tur kimliği, ham veri ve teknik kayıt için saklanır.
  Oyuncunun okuyacağı normal masa metninin varsayılanı değildir.
- Slotların büyük dijital sonuçlarında **Bebas Neue** kullanılabilir; gövde ve
  açıklama yine Manrope'tur.
- Fontlar Google Fonts deposundaki SIL OFL sürümleriyle yerel barındırılır;
  oyun açılırken dış font servisine bağımlılık yoktur.

### Blackjack dar ekran düzeni

- `720–1100 px` geniş, `1000 px+` yüksek pencerede masa dört bağımsız dikey
  bölgeye ayrılır: Vera/dealer, kural baskısı, ana+yan bahisler, oyuncu eli.
- El adı ve toplam rozeti kartların üstünde tek satırlı bir meta gruptur; skor
  rozeti kartın veya başka bir yazının üzerine bindirilemez.
- Sınırsız bahis korunur. Fiziksel kule en fazla 7 ana, 5 yan bahis çipi çizer;
  kalan gerçek çip sayısı `+N` rozetiyle gösterilir. Bahis tutarı ayrıca tam
  değer olarak görünür ve hesaplamada hiçbir yuvarlama/gruplama yapılmaz.
- Zorunlu portre testi artık kullanıcıdaki gerçek yarım ekran ölçüsünü de içerir:
  `837×1418`.

## 6. AI karakter standardı

Her yeni oyunun Persona Pack’i şunları içermelidir:

1. Benzersiz isim, görsel, Türkçe ses ve konuşma ritmi.
2. Son olayların yapılandırılmış bağlamı: bahis, sonuç, özel mekanik, geçmiş
   turlar ve oyuncu mesajı.
3. En az kazanma, kaybetme, olağanüstü el, bonus, bekleme, geri dönüş ve seriye
   özel olay sınıfları.
4. Yakın geçmiş tekrar filtresi; aynı cümleyi her tur söylememe.
5. Oyuncu argo/küfür kullandığında bağlamı kaybetmeyen doğal Türkçe. Karakter
   robotik nasihat veya anlamsız çeviri üretmemeli.
6. AI cevabı oyun sonucunu değiştiremez ve uydurma kart/çarpan söyleyemez.
7. Kullanıcı ve AI mesajları model, gecikme ve oyun bağlamıyla DB’ye kaydedilir.

## 7. Veri kaydı standardı

Her tur için asgari kayıt:

- `roundId`, oyun, varyant, kaynak, başlangıç/bitiş zamanı.
- Bahis, gerçek ücret, brüt ödeme, net, önceki/sonraki bakiye, sonuç.
- İlk ve son oyun durumu; uygulanabiliyorsa tüm ara aşamalar.
- Özel değiştiriciler: turbo, autoplay, free spin, bonus kaynağı, M×2/boost,
  scatter sayısı, çarpan hücreleri/değerleri, toplam çarpan, yan bahisler.
- Oyun sonunda hesaplanan `winMultiple` ve kullanılan referans bahis.
- Cüzdan bahis ve ödeme hareketleri ayrı ledger kayıtları.
- Büyük olaylar `game_events`, AI konuşmaları `ai_conversations` içinde.

Yeni ayar eklendiğinde sadece UI’da kalmamalı; sonuç analizini etkiliyorsa tur
kaydının `result` veya `modifiers` alanına eklenmelidir.

## 8. Yeni oyun için zorunlu Definition of Done

Bir oyun “bitti” denmeden önce:

- [ ] Gerçek kurallar ve piyasadaki ileri mekanikler araştırıldı.
- [ ] Oyun motoru UI/AI’dan bağımsız yazıldı ve birim testleri var.
- [ ] Bahis/ödeme/matematik ve kasa eğilimi simülasyonla kontrol edildi.
- [ ] Masa/grid fiziksel ve takip edilebilir animasyonlara sahip.
- [ ] Çip/bahis ekleme, tekrar, geri alma ve sonuç ekranı eksiksiz.
- [ ] Dar, standart ve uzun ekranlar görsel olarak test edildi.
- [ ] Tüm metinler okunaklı; çakışma ve yatay taşma yok.
- [ ] Özgün AI karakteri, Türkçe sesi ve olay bağlamı tamamlandı.
- [ ] Efekt, konuşma ve müzik ayrı ayrı kontrol ediliyor.
- [ ] Admin panelinde oyunun kuralları/özellikleri/bahsi/sesi/müziği yönetiliyor.
- [ ] Tur, cüzdan, özel mekanik ve AI kayıtları DB’ye ayrıntılı yazılıyor.
- [ ] Açık lisanslı varlıkların kaynak/lisans kaydı tutuldu.
- [ ] Testler ve üretim derlemesi geçti.

## 9. Çalışma yöntemi

Yeni bir oturum önce bu dosyayı, ardından `CASINO_PROJE_KAIDE_TASI.md` ve
`THIRD_PARTY_ASSETS.md` dosyasını okumalıdır. Bir değişiklik yaparken yalnız
kullanıcının o an söylediği tek hatayı yamamak yerine aynı sınıftaki sorunlar
bütün oyunlarda taranmalıdır. Uygulama değişikliği tamamlandıktan sonra bu dosya
güncellenmeli; yeni mekanik, karakter, veri alanı ve kalite kararı kalıcı hale
getirilmelidir.

- Kullanıcının aynı mesajda bildirdiği her hata ayrı bir kabul maddesidir. Bir maddenin
  düzelmesi, aynı oyundaki ya da başka oyundaki diğer maddelerin de tamamlandığı anlamına
  gelmez; her biri ayrı durum, ekran ölçüsü ve kanıtla doğrulanır.
- Birleşik bir istekte maddeler çalışma başında korunur; sonuçta her madde için ayrı
  `düzeltildi / doğrulandı / engelli` durumu verilir. Tek görsel kontrol veya tek başarılı
  turla bir hata grubu topluca kapatılmaz.
- Geçici görsel yama, başka bir fazdaki fiziksel oyun durumunu bozamaz. Özellikle bahis
  yerleştirme, tur içi masa, ödeme animasyonu ve temiz masa birbirinden ayrı kabul
  durumlarıdır.

### Blackjack bahis yaşam döngüsü

- Son oynanan bahis şablonu ile masada fiziksel olarak duran bahis aynı state değildir.
  Şablon yalnız tekrar yerleştirmek içindir; masadaki çip ve tutar yazısı animasyon bitince
  birlikte temizlenir.
- Tur boyunca ana ve yan bahis çipleri görünür kalır. Kaybeden yığın masadan toplanır;
  kazanan yığın bahsin dahil olduğu brüt dönüş tutarına dönüşür ve oyuncuya doğru kayar.
  Çip kaybolup altında eski tutar veya sonuç metni kalamaz.
- `Aynı bahsi yerleştir` yalnız önceki ana ve yan çipleri masaya geri koyar. Kartları
  otomatik dağıtmaz; oyuncu bahsi artırabilir ve turu ayrı ana eylem düğmesiyle başlatır.

## 10. Kaptan Mercan ile eklenen kalıcı dersler

- Oyun değişiminde aynı React ses bileşeni yeniden kullanılsa bile kullanıcı
  müzik tercihi tek bir `muted` state olarak tutulamaz. Tercihler oyun kimliğiyle
  anahtarlanan haritada tutulur; bir odanın sessizliği başka odaya taşınmaz.
- Balıkçı tipi slotta para sembolü tek başına ödeme vaadi değildir: değer,
  toplayıcı kaptan ve uygulanan bonus çarpanı hem animasyonda sırayla hem DB'de
  ayrı alanlar olarak görünmelidir.
- Bonus giriş sonucu, bonus seansı ve her ücretsiz spin ayrı kayıttır. Bonus
  ödemesi ara spinlerde bakiyeye eklenmez; özellik bitince tek ledger hareketi ve
  tek kapanış ekranıyla verilir.
- Ücretsiz spin içinde tek tek büyük-kazanç tiyatrosu açılmaz. Kazanç katmanı
  bonus toplamını bölmemeli; finalde spin sayısı, uzatma, kaptan sayısı, son
  çarpan ve toplam ödeme birlikte gösterilir.
- Bonus ilerlemesi görünür olmalıdır: 4/8/12 kaptan eşikleri, +10 spin ve
  2×/3×/10× toplama basamakları oyun boyunca sabit HUD'da izlenir.
- Piyasa referansı yalnız mekanik öğrenmek içindir. Marka, isim ve korunan sanat
  kopyalanmaz; Kaptan Mercan gibi proje kimliği, özgün üretim ve açık lisanslı sesler
  kullanılır.
- Matematik yalnız hissiyatla ayarlanmaz. Sabit seed'li uzun örnek testi, bonus
  erişilebilirliği ve bonus dahil gözlenen RTP aralığını her build'de doğrular.

## 11. Midnight Poker ile eklenen kalıcı mimari

- Poker odasında iki bağımsız oyun bulunur: resmi Casino Hold'em akışına göre
  Leyla'ya karşı Ante + isteğe bağlı AA Bonus ve 1-8 botlu No-Limit Texas Hold'em.
- Casino Hold'em motoru UI'dan bağımsızdır: 7 kart içinden en iyi beşli eli bulur,
  krupiyenin 4'lü çift veya üstü yeterliliğini, 2× Call'u, Ante ödeme tablosunu ve
  AA Bonus'u ayrı ayrı hesaplar. Kart/ödeme testleri olmadan kural değişmez.
- Texas Hold'em istemcisi doğrudan React state'iyle kural uydurmaz. MIT lisanslı
  `poker-engine-ts` event motoru legal aksiyon, blind, pot/yan pot, all-in, showdown
  ve bot persona kararlarını üretir. UI yalnız motor özeti ve event günlüğünü çizer.
- Maksimum masa 9 koltuktur: Muharrem + 1-8 bot. Bot sayısı, buy-in ve blind masa
  kurulurken seçilir; her bot farklı tight/loose/aggressive/passive/exploitative
  profile ve görünür masa okumasına sahiptir.
- Online'a geçiş için oyun bileşeni `PokerSessionTransport` sözleşmesine bağlıdır.
  Yerel taşıyıcı ile HTTP taşıyıcı aynı `create / action / advanceBot` arayüzünü
  uygular. Online sürümde kapalı kartlar ve bot kararları sunucu otoritesinde kalır.
- Texas cash game buy-in'i ana bakiyeden escrow gibi ayrılır, masadan kalkarken
  kalan stack tek hareketle geri döner. Her el motor event günlüğü, kartlar, board,
  pot ödemeleri, başlangıç/son stack ve net sonuçla DB'ye kaydedilir.
- Poker sunucusu Leyla ayrı bir yerel-model prompt'una, doğal Türkçe karaktere ve
  sohbet kutusuna sahiptir. Kullanıcı, cevap ve el olayı mesajları model/gecikme/
  masa bağlamıyla `ai_conversations` tablosuna yazılır.
- Büyük oyunlarda ortak çip standardı en az 25, 50, 100, 250, 500, 1K, 5K, 10K
  ve 20K değerlerini içerir. Çip rafı dar ekranda taşmak yerine satıra kırılır.
- Poker görsel kabulünde bahis halkaları ortak kartlardan, oyuncu koltuğu aksiyon
  panelinden ayrılmalı; 2-9 koltuk düzenlerinin her biri ayrı CSS yerleşimine sahip
  olmalıdır.
- Pokerde bahis yalnız sayısal pot etiketiyle anlatılamaz. Casino modunda Ante/AA
  fiziksel çip kuleleri, Call'un pota gidişi ve geri dönüşün oyuncuya kayışı; Texas
  modunda her oyuncunun katkısı, koltuktan pota uçuşu ve potun kazanana dağıtılması
  görünür olmalıdır.
- Showdown sonucu yalnız “kazandın/kaybettin” yazamaz. Her tarafın el sınıfı ve en
  iyi beş kartı yan yana karşılaştırılır; kazanan kombinasyondaki kartlar masada
  vurgulanır, kullanılmayanlar geri çekilir. Ante, Call ve bonus dönüşleri ayrı
  kalemler halinde gösterilir. Fold halinde kapalı kart uydurulmaz/açılmaz; kaybın
  karar nedeniyle olduğu açıkça yazılır.
- Poker aksiyonları İngilizce terimle bırakılmaz. FOLD/CHECK/CALL/BET/RAISE/ALL-IN
  düğmelerinde kısa Türkçe anlam görünür; hover ve klavye odağında tutar, sonuç ve
  riskin ne olduğu uzun açıklamayla açılır.
- Community kartı henüz dağıtılmadıysa kart arkası çizilmez. FLOP/TURN/RIVER yazılı
  boş yuva gösterilir; kart arkası yalnız gerçekten dağıtılmış kapalı kart demektir.
- Ortak yüksek bahis kademeleri 5K, 10K ve 20K Blackjack, rulet, poker ve slotların
  adım seçicilerinde birlikte bulunur. Yeni oyun eski 1K tavanını kopyalamaz.
- Pokerde karar paneli hiçbir ekran oranında oyuncunun kapalı/açık kartlarının üzerine
  gelemez. Casino Hold'em Call/Fold kararı masa katmanında değil, sabit kontrol rayında
  gösterilir; kart alanı yalnız kart, bahis noktası ve fiziksel çip animasyonuna ayrılır.
- Casino Hold'em kuralında flop sonrası tek Call/Fold kararı vardır. Bu kural heyecan
  uğruna değiştirilmez; Call sonrasında turn ve river ayrı bekleme, ses, animasyon ve
  `game_events` kaydıyla tek tek açılır. Çok aşamalı bahis istenirse ayrı Ultimate
  Texas Hold'em varyantı olarak tasarlanır.
- Bot kararı görünür ve deterministik tempoda en az bir saniye bekler. Persona seçimi
  hata verse bile motor aynı snapshot'ı döndürüp masayı kilitlemez; yasal rastgele karar
  yedeğiyle tam bir event ilerler. Sokak değişimlerinde bir sonraki karar açılmadan kart
  animasyonunun okunabilmesi için ayrıca tempo payı bırakılır.
- Botlar yalnız mutlak el sınıfına göre call/fold yapmaz. Yapılmış el gücü, pot odds,
  call'un kalan stack'e oranı, persona looseness/aggression değeri ve oyuncunun o eldeki
  agresyon sıklığı birlikte değerlendirilir. Pair/two-pair gibi eller düşük ölçeklenip
  otomatik fold zinciri üretmemelidir.
- Her Texas aksiyonu tur sonundaki büyük JSON'a ek olarak ayrı `poker-player-action`
  event'idir: actor, bot profili, sokak, bahis türü/tutarı, legal seçenekler, önce/sonra
  stack, katkı, sonraki pot, snapshot ve karar gecikmesi kaydedilir. Her el başlangıcı
  da koltuklar, blind, stack modu ve başlangıç stack'leriyle ayrı olaydır.
- Eşit buy-in yanında `Açık Kasa · No Limit` bulunur. Oyuncu bütün cüzdanıyla, botlar
  kendi farklı kasalarıyla oturur; el içindeki maksimum bahis yalnız masadaki kalan
  stack'tir. Yüksek masa seçimi 20K/100K/MAX kısayollarına ve blind değiştiğinde görünür
  minimum stack doğrulamasına sahiptir.
- Yüksek değerli masa çipleri yalnız 20K'da bitmez. Ana masa oyunlarında 50K, 100K,
  250K ve 500K fiziksel çipleri de bulunur; renkleri ve üzerindeki K etiketi birbirinden
  ayırt edilebilir olmalıdır.

## 12. Anlık Oyunlar ve Altın Rota ile eklenen kalıcı mimari

- Slot, masa ve pokerden ayrı `Anlık Oyunlar` kategorisi vardır. İlk oyun Altın Rota;
  özgün 1930'lar retro-fütürist İstanbul gece uçuşu kimliğine sahip crash oyunudur.
- Crash sonucu bahis kapanmadan önce sunucu seed + client seed + nonce üzerinden
  SHA-256 ile üretilir. Tur başında yalnız sunucu seed taahhüdü gösterilir; tur bitince
  seed ve digest açıklanır. UI veya AI aktif turun sonucunu değiştiremez.
- Altın Rota iki bağımsız bahis paneli taşır. Her panelin miktarı, manuel/otomatik
  katılımı ve otomatik çıkış hedefi ayrıdır. Bahis penceresi açıkken rezerv iptal edilip
  eksiksiz bakiyeye döner; uçuş başlayınca kilitlenir.
- Canlı tur döngüsü bahis penceresi, uçuş ve sonuç sahnesinden oluşur. Geçmiş çarpan
  şeridi, salon oyuncuları, canlı çıkış listesi, uçuş eğrisi ve Lâle'nin kule yorumu
  aynı sonucu farklı, birbirini doğrulayan katmanlarda anlatır.
- Admin paneli RTP, azami çarpan, bahis süresi, sonuç sahnesi süresi, uçuş eğrisi ve
  salon oyuncusu sayısını yönetir. Ayar değişikliği aktif sonucu bozmaz; sonraki tura
  uygulanır.
- Her tur oyuncu katılmasa da `live-table` olarak kaydedilebilir. Oyunculu turda her
  panelin miktarı, auto-bet, auto-cashout hedefi, gerçek çıkış çarpanı, ödeme ve neti;
  ayrıca commitment, seed, digest, nonce, eğri ve hedef RTP DB'de tutulur. Stake ve
  ödeme ledger'a ayrı hareketlerdir.
- Kule operatörü Lâle ayrı persona prompt'una ve fallback diline sahiptir. Mevcut faz,
  canlı çarpan, son çöküş, son net, aktif bahis ve yakın tur geçmişini görür; gelecekteki
  çarpanı bildiğini iddia etmez. Kullanıcı ve cevaplar AI veritabanına kaydedilir.
- Oyun müziği Altın Rota'ya özel kullanıcı aç/kapa ve seviye tercihi taşır. Kalkış,
  motor, nakit çıkış ve kaza efektleri müzikten bağımsızdır. Görseller özgün Imagegen,
  müzik CC0'dır ve kaynak/prompt kayıtları varlık dizininde korunur.
- Dar/uzun ekranda yan ray kaybolmaz: uçuşun altına iki sütun/tek sütun olarak taşınır.
  Bahis panelleri yatay taşmak yerine alt alta dizilir; Lâle sohbeti erişilebilir kalır.
- Aynı kategori için sonraki özgün yönler: `Derinlik` (basınç/submarine crash),
  `Kervan` (kum fırtınası öncesi çıkış) ve `Kasa Nabzı` (limbo/hedef çarpan).

## 13. Obsidyen Damarı ile eklenen kalıcı Mines standardı

- Anlık Oyunlar içindeki Mines yalnız 5×5 kare açma demosu değildir. `Serbest Kazı`
  1–24 basınç çekirdekli serbest seçim; `Derin Hat` ise her sırada beş seçenekli,
  Temkinli/Keskin/Uçurum sözleşmeli ilerleme modudur.
- Tahta, oyuncunun ilk seçimi öncesinde server seed + client seed + nonce ile
  HMAC-SHA256 üzerinden üretilir. UI, AI, animasyon ve otomatik kazı sonucu
  değiştiremez. Aktif turda yalnız taahhüt; tur bittiğinde seed, digest ve yeniden
  üretme doğrulaması görünür.
- Serbest Kazı ödemesi kombinasyon olasılığına, Derin Hat ödemesi satırdaki güvenli
  seçenek oranına dayanır. RTP yalnız bir kez uygulanır. Para iki ondalıkta standart
  yuvarlanır; çarpan ve satır sınırları turun içine kilitlenir.
- Bahis aktif tahta boyunca değiştirilemez. İlk güvenli seçimden sonra brüt ödeme
  görünür ve kullanıcı istediği anda kasaya döner. Sonuç modalı bahis, brüt ödeme,
  çarpan, güvenli mühür ve net muhasebeyi birbirinden ayırır; her zaman kapatılabilir.
- Otomatik kazı yalnız kullanıcı tarafından başlatılır, seçilen güvenli hedefte
  otomatik kasaya döner ve her mühür normal `reveal` olay zincirinden geçer. Turbo
  yalnız sunum süresini değiştirir, sonuç dağılımını değiştirmez.
- Sağ tıkla işaretleme yalnız görsel nottur ve sonucu etkilemez. İlerleme/müze
  kayıtları sanal bakiye sağlamaz; toplam güvenli seçim, tek tur derinliği, en yüksek
  çarpan ve eser eşikleri yerel meta + SQLite üzerinde tutulur.
- Oyun turu JSON kaydında bütün tehlike dizilimi, seçim sırası, risk sözleşmesi,
  çarpan tavanı, RTP, seed/commitment/digest, otomatik/turbo durumu ve sonuç bulunur.
  Stake ve ödeme ledger'da ayrı; başlatma, her açılış ve settlement olay tablosunda
  ayrı kayıttır. Ayla'nın kullanıcı/yardımcı/olay konuşmaları AI tablosuna yazılır.
- Ayla kurgusal jeolog ve kazı lideridir. Mekanik bağlamı bilir, bir sonraki mührü
  bildiğini iddia etmez, olay repliklerinde son seçim/çarpan/sonuç ayrıntısını kullanır.
  Türkçe kadın sesi ve sohbet, oyun efektlerinden ve arka plan müziğinden bağımsızdır.
- Müzik tercihi yalnız `obsidyen-damari` oyun kimliğinde saklanır. Müzik, ambiyans,
  SFX ve konuşma dört ayrı katmandır; admin oyun kartından müzik ile SFX'i yönetir,
  kullanıcı oyun içinde müzik ve efekt seviyesini ayrı ayarlar.
- Admin kartı RTP, minimum/varsayılan bahis, varsayılan/azami çekirdek, azami çarpan,
  Derin Hat sıra sayısı ve bütün mühür açma sürelerini yönetir. Ayarlar aktif turu
  geriye dönük değiştirmez; yeni turda kilitlenir.
- Görsel kalite standardı: özgün arka plan/karakter/ödül/tehlike varlıkları, 5×5 için
  gerçek flip/çatlak/açılma akışı, tehlike patlaması, kalan çekirdeklerin gecikmeli
  gösterimi, merkeze oturan sonuç tiyatrosu ve 9 px altına düşmeyen kritik UI yazıları.
  1920×1080'de tek ekranda; dar/uzun pencerede tahta, yatay Ayla paneli, veri rayı ve
  kontrol iskelesi sıralı fakat yatay taşmasız çalışır.

## 14. Mobil Safari oynanabilirlik ve oyun kimliği standardı

- Mobil kabul testi yalnız responsive emülatörün uzun ekranında yapılmaz.
  iPhone 13 için 390×664 (Safari çubukları açık kısa görsel alan), 390×844
  ve 844×390 yatay görünüm ayrı ayrı denenir. Yatay taşma sıfır olmalı;
  ana oyun alanı, karar tuşu ve tur durumu aynı viewport'ta kalmalıdır.
- `viewport-fit=cover`, `interactive-widget=resizes-content`, `100dvh` ve dört yöndeki
  safe-area inset'leri ortak kabukta uygulanır. Form alanları iOS'un istemsiz yakınlaşmasını
  önlemek için 16 px'ten küçük hesaplanmaz.
- Mobil sadeleştirme, oyunun temel mekaniklerini silme izni değildir. Müzik aç/kapa,
  kural/yardım, autoplay, turbo, özel mod ve otomatik çıkış gibi gerçek oynanış
  kontrolleri kompakt şerit, sekme veya erişilebilir modal olarak korunur.
- Altın Rota mobilde iki bağımsız bahis panelini sekmelerle taşır. Her sekmede
  miktar, hızlı bahis, oto bahis, oto çıkış ve hedef çarpan gerçekten çalışır;
  ikinci panel ekran darlığı gerekçesiyle kaldırılamaz.
- Rulet portrede masa listesini taklit etmez. Standart 1–36 triplet yapısı, sıfır,
  üç 2:1 sütun, üç düzine ve altı dış bahis fiziksel masa ilişkisini korur.
  Split, köşe, sokak ve altılı bahisler mod seçildiğinde ortak çizgi/kesişim
  noktalarında dokunulabilir olur. Yatay telefonda sıkıştırılmış liste yerine
  standart 12×3 Avrupa masa geometrisi kullanılır.
- Slotlarda grid'i büyütmek için autoplay, ses, sunucu, turbo, boost veya bonus kontrolü
  yok edilmez. Portrede ana kontrol ve kompakt özellik şeridi alt alta; yatayda yan yana
  yerleşir. Geniş yatay boşluk, sembolleri gereksiz yere esnetmek yerine oyuna ait
  karakter sanatıyla sahne kimliği kazandırmak için kullanılır.
- Mines kontrol iskelesinde bahis, risk, başlat/kazanç al ve otomatik kazı aynı anda
  erişilebilir kalır. Bir komponenti `display:none` yapmak, onun yerine dokunulabilir
  bir mobil karşılık sunulmadıkça kabul edilmez.
- Mobil kalite yalnız kutuların çakışmaması değildir: fiziksel masa oranı, karakter
  kimliği, çip hareketi, okunur tur sayacı, brüt ödeme anlatımı ve kritik aksiyonun
  başparmak erişiminde olması birlikte kontrol edilir.

## 15. Oyun sesi kanalları standardı

- Arka plan müziği, oyun efektleri ve AI karakter sesi birbirinden bağımsız kanallardır;
  birini kapatmak diğerini etkilemez.
- Tercihler oyun başına saklanır. Masaüstü ve mobil aynı React durumunu ve aynı kalıcı
  tercihi kullanır; ayrı mobil ses mantığı yazılmaz.
- AI karakter sesi varsayılan olarak kapalı başlar. Kullanıcı açtığında yalnızca ilgili
  oyunun karakteri konuşur.
- AI sesi kapatıldığı anda bekleyen tarayıcı konuşması iptal edilir; yeni tur, spin veya
  AI cevabı sesi kendiliğinden açamaz.
- Efekt düğmesi gerçek efekt zincirini durdurur: tek vuruşlar kadar uçak motoru gibi
  döngüsel sesler de anında kesilir.
- Dar ekranda aynı düğmeler ikon hâline gelir; masaüstünde kanal adı ve açık/kapalı
  durumu yazıyla görünür.

## 16. Son On ile eklenen kalıcı Countdown standardı

- Countdown adı tek bir slot kuralına sabitlenmez. Yeni oyun önce mevcut countdown,
  respin, crash ve bank-or-risk örneklerinden araştırılır; sonra katalogdaki mevcut
  oyunları tekrar etmeyen özgün bir karar çekirdeğine dönüştürülür.
- `Son On` 10→0 çalışan, her adımda açık güvenli-göz oranı sunan üç risk profiline
  sahiptir. Çarpan hedef RTP’nin kümülatif güvenli kalma olasılığına bölünmesiyle
  hesaplanır; animasyon, AI ve süre çarpanı değiştiremez.
- Alarm dizisi tur başında HMAC-SHA256 ile kilitlenir. Commitment seçimden önce,
  server seed turdan sonra görünür. Tam hazard dizisi, seçim sırası, süre sebebi,
  auto-bank hedefi ve ses/tempo bağlamı SQLite’a yazılır.
- Süre biterse davranış gizli değildir: oyuncu otomatik banka veya rastgele seçim
  politikasını turdan önce belirler. En az bir güvenli kapaktan sonra brüt ödeme her
  an kasaya alınabilir; sonuç sahnesi bahis dahil brüt ödemeyi açıkça belirtir.
- Nihal ayrı karakter ve konuşma kaydı taşır. Türkçe AI sesi varsayılan kapalıdır;
  müzik, mekanik efekt ve konuşma üç bağımsız oyun-başına kanaldır.
- Mobil kabulte 390×844 görünümde yatay taşma sıfır, ana sayaç/mühür/zaman/kasa
  eylemi aynı viewport’tadır. Ayrıntılı risk, bahis ve geçmiş rayları ana oyunun
  altında kalabilir; kritik karar için kaydırma gerekmez.
- Admin paneli Son On için RTP, bahis, aşama sayısı, ilk/son karar süresi,
  normal/turbo kapak açılışı ve azami ödeme tavanını canlı olarak yönetir.

## 17. Pehlevan Royale görsel kimliği ve ortak oyun kontrol iskelesi

- Yeni oyunlarda Pehlevan Royale ev kimliği; özgün, törensel baykuş ve altı köşeli
  yıldız motifleriyle kurulacaktır. Bu motifler rastgele yapıştırılmış ikon değil;
  mimari kabartma, metal kakma, mühür, çip deseni, ışık veya mekanik parça gibi
  oyunun dünyasına ait malzemeler olarak kullanılacaktır. Mevcut oyunların dönüşümü
  ayrı kalite geçişlerinde yapılacak; bu karar yeni oyunlar için bugünden zorunludur.
- Oyun üst çubuğunun sağ tarafı bakiye, müzik, efekt, AI sesi ve çıkış gibi oyunlar
  arası genel durumlara ayrılır. Bahis miktarı üst köşelerde dolaştırılmaz.
- Bahis değeri, hızlı çipler ve turun birincil eylemi aynı alt kontrol iskelesinde
  bulunur. Oyuncu hangi tutarı seçtiğini ve o tutarla hangi düğmeye bastığını tek
  bakışta görür. Tur başlayınca kontrol yer değiştirmez; yalnız eylemin etiketi ve
  durumu `oyna / kasaya al / tekrar` olarak değişir.
- Otomatik oyun, risk profili ve ayrıntılı geçmiş ikincil rayda kalabilir; ana oyun
  kararı, bahis ve olası/brüt ödeme masaüstünde de mobilde de aynı görsel kümenin
  parçasıdır. Mobilde alt iskele başparmak erişiminde ve ana mekanikle aynı viewport'ta
  kalır.
- Oyun sonucu doğrudan modal sıçramasıyla verilmez. Bahsin masaya/oyuna girişi,
  seçim veya spin çözümü, kazanç/tehlike vurgusu, ödemenin bakiyeye geçişi ve sonuç
  raporu okunabilecek ayrı ritimlere sahiptir. Turbo bu ritmi kısaltır ama aşamaları
  atlamaz.
- Döngüsel gerilim ambiyansı yalnız aktif turda çalışır; ilerlemeye göre şiddet veya
  tempo değişebilir. Müzik, mekanik efekt ve AI sesi yine birbirinden bağımsızdır ve
  oyun başına saklanır.

## 18. Sabit kupür bahis tavanı değildir

- `500K` veya başka bir hızlı çip/kademe değeri hiçbir oyunda bahis tavanı olarak
  kullanılamaz. Hızlı çipler yalnız kullanım kolaylığıdır; ortak kupür rayı 100M'a kadar
  uzanır ve aynı çip istenildiği kadar tekrarlanabilir.
- Her oyunda serbest sayısal bahis girişi ile `MAX` bulunur. Oyuncu, yönetimdeki minimum
  bahis koşulunu sağlayan istediği tutarı girebilir; tek doğal üst sınır kullanılabilir
  bakiyedir.
- Boost, ante veya bonus satın alma gibi maliyet çarpanlarında azami referans bahis,
  sabit bir sayıdan değil `bakiye / toplam maliyet çarpanı` hesabından türetilir. Bonus
  satın alma bedeli de aynı kurala tabidir; ayrıca gizli kupür tavanı konulamaz.
- Tur aktifken bahis kilitlenebilir; tur sonuçlandığında aynı kontrol yeniden açılır.
  Gelecek bütün oyunlar `src/games/wagering.ts` ortak standardını kullanır; oyun içinde
  yeni, bağımsız bir 500K/1M benzeri yapay limit dizisi yazılmaz.

## 19. Plinko ve Canvas tabanlı anlık oyun standardı

- Plinko `Anlık Oyunlar` içindedir. Tahta yüksek DPI Canvas 2D ve
  `requestAnimationFrame` ile çizilir; ayrı bir masaüstü/mobil fizik motoru kurulmaz.
- Matematik ile sunum ayrıdır. HMAC-SHA256 sonucu ve sol/sağ yolunu tur başında kilitler;
  kare hızı, animasyon gecikmesi, ekran ölçüsü veya efektler sonucu değiştiremez.
- 8–16 sıra ve düşük/orta/yüksek risk desteklenir. Her tablo binom cep olasılıklarıyla
  hedef RTP'ye normalize edilir ve bütün sıra/risk kombinasyonları otomatik test edilir.
- Çoklu top ve otomatik bırakma aynı bakiye ve eşzamanlılık kilidini paylaşır. Her topun
  bahis/ödeme bakiye hareketleri, yol dizisi, cep, tablo, seed, nonce ve digest'i ayrı
  SQLite kayıtlarıdır; görsel olarak düşmeyen top ödenmiş sayılamaz.
- Mobilde tahta, risk/sıra, bahis ve `TOPU BIRAK` aynı oynanış viewport'unda kalır.
  İstatistik ve ayrıntılı geçmiş aşağı taşınabilir; yatay taşma ve küçücük hedef kabul edilmez.
- Ev motifleri yoğunluk hedefi değildir. Baykuş veya altı köşeli yıldız ancak mimari,
  mekanik ya da malzeme mantığı varsa kullanılır; kontrol düğmelerine, ceplere ve boş
  alanlara tekrar tekrar ikon yapıştırılmaz. Bir sahnede tek güçlü yapısal motif,
  onlarca dekoratif tekrardan üstündür.

## 20. Responsive Game Shell sözleşmesi

- Yeni oyunlar cihaz modeli veya tekil ekran çözünürlüğü için ayrı DOM/CSS kopyası
  üretmez. Masaüstü, tablet ve mobil aynı React bileşen ağacını kullanır.
- Kalıcı oyun bölgeleri mutlak `top`, `bottom` ve `scale` koordinatlarıyla birbirinden
  bağımsız yerleştirilemez. Sahne; CSS Grid/Flex bölgeleriyle krupiye, oyun alanı,
  bahis, oyuncu ve durum bölümlerine ayrılır. Mutlak konum yalnız animasyon ve geçici
  efekt katmanlarında kullanılabilir.
- Yerleşim kararı cihaz adına göre değil `container-type`, kullanılabilir genişlik,
  yükseklik ve en-boy oranına göre verilir. Ortak sözleşmenin kaynağı
  `src/responsive-game-shell.css` dosyasıdır.
- Oyun nesnelerinin boyutu yalnız `cqh` ile belirlenmez. Kart, çark, karakter ve bahis
  halkası gibi oranı korunması gereken öğeler `cqmin` veya hem genişlik hem yükseklik
  sınırı taşıyan `min()/clamp()` ile boyutlanır. Fazla pencere yüksekliği nesneleri
  birbirinden koparmak ya da masanın ortasında boş bant üretmek için kullanılamaz.
- Oyun yüzeyleri semantik ve sıralı bölgelere sahiptir. Blackjack sırası
  `krupiye → krupiye eli → ana bahis → oyuncu eli → durum`; rulet sırası
  `sunucu/çark tiyatrosu → masa başlığı → istatistik → oranı korunan bahis tahtası →
  ilan bahisleri` şeklindedir. Bir faz değişikliği mevcut bahis çipini gizleyemez veya
  aynı bölgeleri ekran ortasında yeniden gruplayamaz.
- Üst bar, oyun sahnesi ve kontrol iskelesi aynı `100dvh` yükseklik bütçesini paylaşır.
  Kontroller sahneyi örtemez; sahne de kontrol iskelesinin altına taşamaz.
- Yardımcı sohbet/istatistik rayı, oyun alanı okunamayacak kadar sıkışmadan önce
  kapanır. Oyun, bahis ve ana eylem düğmesi her zaman önceliklidir.
- Boyutlar `clamp()`, `min()`, `max()`, konteyner birimleri ve güvenli alanlarla
  ölçeklenir. Yatay sayfa kaydırması veya cihaz-modeline özel piksel yaması kabul edilmez.
- Kabul matrisi en az `390×844`, `625×292`, `1366×768`, `1440×900`, `837×1418` ve
  `1978×1871` ölçülerini kapsar. Kritik bölgeler için DOM dikdörtgen çakışma kontrolü,
  yatay/dikey taşma kontrolü ve ekran görüntüsü incelemesi birlikte yapılır.
- Blackjack ve rulet bu sözleşmenin ilk uygulamalarıdır. Eski oyunlar aşamalı olarak
  aynı kabuğa taşınacak; bundan sonra eklenen her oyun ilk sürümünden itibaren bu
  sözleşmeye uymadan tamamlanmış sayılmayacaktır.

## 21. Hesap verisi, önbellek ve SQLite kaynak sınırı

- Kullanıcı bakiyesi, cüzdan sürümü, tur sonuçları, oyun olayları, AI konuşmaları ve
  hesap profilleri için tek kalıcı gerçek kaynak bilgisayardaki SQLite'tır. Tarayıcı
  verisi bu alanlarda yetkili kaynak veya geri-yükleme kaynağı olamaz.
- Cüzdan yazıları çağrılma sırasıyla tek kuyrukta işlenir. Sunucu her yanıtta bakiye
  ile monoton cüzdan sürümünü birlikte döndürür; istemci daha eski sürümü ekrana
  uygulamaz. Aynı turdaki bahis ve ödeme birlikte bekliyorsa yalnız kuyruğun son
  doğrulanmış bakiyesi yayımlanır.
- IndexedDB yalnız SQLite'a gerçekten ulaşılamayan yazılar için geçici çıkış kutusu
  olabilir. Ortak bir tarayıcıdaki eski kayıtlar başka kullanıcı adına otomatik
  yeniden oynatılamaz ve yönetim raporlarına SQLite yerine kaynak olamaz.
- Devam eden parasal turlar, favori bahisler, istemci seed'i ve nonce gibi kullanıcı
  bağlamlı tarayıcı değerlerinin anahtarında mutlaka `user.id` bulunur. Müzik/efekt
  gibi cihaz tercihi açıkça cihaz tercihi olarak bırakılabilir; bakiye veya tur
  durumuyla aynı depolama sınıfına konulmaz.
- Görsel, kart, ses ve font dosyaları HTTP tarayıcı önbelleğine uygundur; hesap JSON'u
  uygun değildir. Büyük özgün görseller arşivlenebilir fakat oyun çalışma zamanında
  gerçek çizim boyutuna uygun optimize edilmiş türev kullanılır.
- Yeni sayısal kayıtlar SQLite'a gitmeden önce `Number.isFinite` eşdeğeri doğrulamadan
  geçer. `NaN`/sonsuz değerlerin JSON'da `null` olup yönetim ekranına sızmasına izin
  verilmez; eski bozuk kayıtlar şema yükseltmesinde deterministik olarak onarılır.

## 22. Şekerhane 1024 ile kilitlenen küme oyunu standardı

- Küme, ödeme ve tumble motoru saf TypeScript'te tutulur; React yalnız sonucu fazlar
  halinde oynatır. RNG enjeksiyonu, sabit tohum testi ve uzun örneklem simülasyonu olmadan
  yeni küme oyunu yayına hazır sayılmaz.
- Oyuncu bir kazancın hesabını tek bakışta okuyabilmelidir: sembol adedi, sembol ödeme
  katsayısı, aktif hücre çarpanı ve PR karşılığı aynı geçici fişte gösterilir. Çarpanlar
  toplanıyorsa arayüz ve yardım metni bunu açıkça söyler; gizli çarpım uygulanmaz.
- Kalıcı hücre durumu grid sembolünden ayrı veri katmanıdır. Tumble sembolü taşır, hücre
  izini taşımaz. Bonus oturumu kesilirse kalan spin, toplam ödeme ve hücre haritası
  kullanıcı kapsamlı SQLite meta kaydından geri yüklenir.
- Bonus satın alma iki aşamalıdır: seçim yalnız onay penceresini açar; bakiye onaydan sonra
  düşer. Satın alma bedeli ve tek seferlik bonus ödemesi aynı `roundId` altında ledger,
  tur ve olay kayıtlarında uzlaştırılabilir olmalıdır.
- Eğlence ritmi `landing → focus → burst → glaze upgrade → falling` sırasıyla kurulur.
  Turbo aynı semantik fazları korur, yalnız süreleri kısaltır. Büyük kazanç ve bonus özeti
  arka plandaki spin akışını mutlaka durdurur.
- Ev teması dozunda kalır: Şekerhane'de altı köşeli yıldız tek ana vitray geometrisidir;
  baykuş tek küçük pirinç mühür/broş ayrıntısıdır. Kontrol, her sembol ve her boşluk aynı
  motiflerle doldurulmaz.
- Aynı React ağacı masaüstü ve mobilde kullanılır. 7×7 grid hem genişlik hem kullanılabilir
  `dvh` bütçesiyle sınırlanır; sabit kontrol iskelesi hiçbir satırı örtemez. Mobilde grid,
  bahis, satın alma ve ana spin eylemi ilk viewport içinde kalır; sohbet/progres detayı
  sadeleşebilir.
