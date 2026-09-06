# Pehlevan Royale — Proje Kaide Taşı

> Son güncelleme: 23 Ağustos 2026  
> Durum: React uygulaması ve ilk oynanabilir Blackjack dikey dilimi oluşturuldu; Vera yerel AI modeli kuruldu.  
> Bu dosya, projeye başka bir oturumda veya araçta devam etmek için tek kaynak
> niteliğindeki başlangıç belgesidir.

---

## 1. Projenin özü

**Pehlevan Royale**, Muharrem Pehlevan'a özel, gerçek para içermeyen ve Türkçe öncelikli bir
"canlı casino gecesi" deneyimidir. Amaç sıradan birkaç mini oyun yapmak değil;
oyuncunun oyun seçtiği, krupiyelerle sohbet ettiği, karakterlerin önceki
oyunları hatırladığı, ses/animasyon/yorumların birbirini tamamladığı şık bir
eğlence ortamı kurmaktır.

Uygulama yalnızca **sanal jeton** kullanır. Gerçek para yatırma, çekme,
ödeme, halka açılma, dış oyuncu hesabı veya gerçek para ödülü kapsam dışıdır.

### Kullanıcının açık beklentileri

- Görsellik sıradan olmayacak; güçlü, kaliteli ve özgün bir casino atmosferi
  kurulacak.
- Blackjack, slot, poker ve rulet başta olmak üzere birden çok casino oyunu
  olacak.
- Her oyunda tek, genel amaçlı bir bot yerine ayrı bir **AI karakteri** olacak.
- Karakterler Türkçe konuşacak; sadece kısa tepkiler vermek yerine insan gibi
  espri yapacak, ağır yorum yapacak, sohbeti sürdürecek ve atmosfer kuracak.
- AI kart dağıtımı ya da rulet/spin gibi eylemleri sunabilmeli; bu eylemler
  gerçek oyun motoru aracılığıyla çalışmalı.
- Açık lisanslı, bedava ve kaynak bilgisi korunmuş varlıklar kullanılacak.
- Yerelde çalışan ücretsiz AI ilk tercih; isteğe bağlı daha kaliteli bir bulut
  AI seçeneği sonradan eklenebilir.
- Uygulama kişisel kullanıma özel başlayacak, ancak mimarisi büyümeye elverişli
  olacak.

---

## 2. Ürün ilkeleri

1. **Canlılık:** Boş ekran, sessiz slot ve tek cümlelik bot hissi olmamalı.
   Her masanın ritmi, sesleri, bekleme anları ve karakteri olmalı.
2. **Oyun adaleti / tutarlılığı:** AI dramatik sunucudur; rastgele sonuçları
   uydurmaz. Kart, bahis, ödeme ve kural hesabı test edilen oyun motorundan
   gelir.
3. **Yerel öncelik:** Profil, sanal bakiye, istatistik ve mümkün olduğunda AI
   yerelde kalır. İnternet zorunlu değildir.
4. **Özgün estetik:** Marka/casino logoları veya internetteki rastgele reklam
   görselleri kullanılmaz. Açık lisanslı taban varlıklar yeniden stillenir;
   slot sembolleri ve dekorun büyük bölümü özgün SVG/CSS ile üretilir.
5. **Kontrol oyuncudadır:** AI konuşma yoğunluğu, ses, müzik, mizah sertliği,
   animasyon hızı ve erişilebilirlik ayarlardan değiştirilebilir.

---

## 3. Görsel sanat yönetimi

### Ana tema: `Midnight Art Deco`

- Zemin: kömür siyahı, koyu lacivert ve derin zümrüt kadife.
- Vurgu: fırçalanmış altın, sıcak krem, bordo ve ara sıra neon turkuaz.
- Şekiller: art-deco çizgiler, pirinç çerçeveler, yumuşak spot ışıkları,
  zengin gölgeler; ucuz "Las Vegas neon" görünümü değil.
- Masa yüzeyleri oyun bazında farklılaşır; bütün casino yine aynı markaya ait
  hissedilir.

### Ortak ekran dili

- Sol/üst alan: marka, bulunduğunuz salon, ses ve ayar erişimi.
- Sağ/üst alan: sanal bakiye, günlük istatistik ve profil rozeti.
- Ana alan: oyun masası veya lobinin büyük sinematik görünümü.
- Alt/yan alan: oyun kontrolleri, bahis jetonları, masa olay günlüğü.
- Karakter alanı: krupiye portresi/animasyonu, konuşma balonu, duygu durumu,
  isteğe bağlı ses düğmesi.

### Animasyon yaklaşımı

- Kartlar fiziksel bir desteden geliyormuş gibi yayılır ve döner.
- Jetonlar bahis alanına düşer, kazanımda toplanır; aşırı parlama yapılmaz.
- Slot makaraları gerçek momentum, küçük sarsıntı ve durma sesleri kullanır.
- Rulet topu ve çark ayrı hız eğrileriyle hareket eder.
- `reduced motion` seçeneğinde hareketler kısa fade/scale geçişlerine iner.

---

## 4. Oyun kataloğu

İlk ana katalog **8 oyun deneyiminden** oluşur. Her biri aynı çekirdek oyun
motoru kurallarını paylaşır ama ayrı UI, ses paleti ve AI karakteri taşır.

| # | Oyun | İlk sürüm kapsamı | Salon/karakter tonu |
| --- | --- | --- | --- |
| 1 | Blackjack | Hit, stand, double, split, blackjack, sigorta tercihi, el geçmişi | Şık, zeki, hafif iğneleyici krupiye |
| 2 | Royal Reels Slot Dünyası | Altı farklı oyun kimliği: klasik çizgi, büyük-grid cluster/cascade, balıkçı toplama, sticky çarpan wild, büyüyen wild ve slot-pinball bonusu | Rocco ana kat sunucusu; Neon Kasası'nda MIRA ve ileride her makineye ayrı kişilik |
| 3 | European Roulette | Tek sıfır, iç/dış bahisler, bahis geçmişi, çark/top animasyonu | Tiyatrocu, ağırbaşlı croupier |
| 4 | Video Poker | Jacks or Better; kart değiştirme ve ödeme tablosu | Az konuşan, analitik oyuncu |
| 5 | Baccarat | Player/Banker/Tie, doğal el kuralları, sade hızlı masa | Zarif, sakin ve net sunucu |
| 6 | Sic Bo / Dice Lounge | Zar kombinasyonları, çoklu bahis alanları | Enerjik, ritim seven karakter |
| 7 | Wheel of Fortune | Sanal çark, segment temaları, özel eventler | Gösterişli sahne sunucusu |
| 8 | High-Low Lounge | Hızlı, düşük karmaşıklıkta kart tahmin oyunu | Gece yarısı bar sohbeti tarzında karakter |

### Sonraki genişleme havuzu

- Texas Hold'em: önce tek oyunculu/AI rakipli, daha sonra çok oyunculu.
- Craps: ayrıntılı masa ve öğretici modla.
- Keno, scratchcards, mini turnuvalar, başarı/rozeti koleksiyonları.
- Temalı sezonlar: noir, Osmanlı art-deco, uzay casinoları vb.

### Oyun kuralı notları

- Blackjack, rulet ve poker kuralları kodla tanımlanır; AI bu kuralları
  değiştiremez.
- Rastgelelik tarayıcıda `crypto.getRandomValues()` ile veya uygulama
  sunucusundaki güvenli RNG ile üretilir.
- Kişisel/offline modda istemci tarafı sonuçlar kabul edilebilir. Uygulama
  gelecekte birden fazla kullanıcıya açılırsa oyun sonucu **sunucu otoriteli**
  hale getirilmelidir.
- Her el/spin bir `GameSession` kaydı oluşturur; istatistik ve tekrar izleme
  için sonuç, bahis, zaman ve olaylar tutulur.

---

## 5. Canlı AI casino sistemi

### 5.1 Temel fikir

AI, sohbet penceresine sonradan eklenmiş bir özellik değildir. Casino olaylarını
dinleyen ve sahneyi yöneten bir **performans katmanıdır**. Oyunun gerçek durumu
AI'a okunabilir veri olarak verilir; AI uygun bir tepki üretir veya izinli bir
oyun eylemini ister.

```text
Oyuncu eylemi / oyun olayı
             ↓
       Casino Event Bus
             ↓
Karakter seçici + hafıza + duygu durumu
             ↓
 Yerel veya bulut LLM
             ↓
 Metin / ses / izinli araç çağrısı
             ↓
 Oyun motoru doğrulaması → UI animasyonu → yeni olay
```

### 5.2 Karakter tasarımı

Her karakter için ayrı bir `Persona Pack` bulunur:

- İsim, görünüş, ses, yaş grubu izlenimi ve hitap biçimi.
- Konuşma ritmi, mizah türü, ağırbaşlılık seviyesi ve yasak davranışlar.
- Kısa süreli masa hafızası: son eller, oyuncunun kararları, devam eden şaka.
- Uzun süreli profil hafızası: sevilen oyunlar, tercih edilen bahis seviyesi,
  açılmış karakter replikleri. Oyuncu ayarlardan silebilir.
- Olay yorumları: kazanma/kaybetme, sıra dışı eller, bekleme, geri dönüş,
  oyuncunun sesli/yazılı soruları.
- Sahne komutları: bakış, gülümseme, ciddi duruş, kart uzatma, spot ışığı,
  ses tonu, konuşma balonu önceliği.

Öneri isimler geçicidir ve kullanıcı tarafından değiştirilebilir:

| Salon | Çalışma adı | Karakter özeti |
| --- | --- | --- |
| Blackjack | Vera | Strateji bilen, ince esprili, risk sever oyuncuya saygı duyan krupiye |
| Slots | Rocco | Yüksek enerjili, teatral, kayıpları da eğlenceli kılan showman |
| Neon Kasası | MIRA | Kuru mizahlı, hızlı düşünen robotik güvenlik uzmanı; cascade, MIRA scatter ve bağımsız güç sembollerini görür |
| Roulette | Armand | Düşük sesli, ağır yorumlar yapan, ritüel hissi veren croupier |
| Poker | Selin | Gözlemci, kuru mizahlı, iyi hamleleri gereksiz övmeyen analist |
| Baccarat | Nara | Sakin, zarif, minimal ama yerinde cümleler kuran sunucu |
| Dice | Mert | Hızlı, oyuncuya tempo veren, heyecanı yükselten karakter |
| Wheel | Lola | Sahne enerjisi yüksek, özel kazançlarda performatif sunucu |
| High-Low | Kâhya | Gece barı tarzında samimi, ara sıra felsefi yorum yapan karakter |

### 5.3 AI'ın eylem yetkisi

AI doğrudan veritabanı veya oyun durumunu yazmaz. Aşağıdaki gibi açık ve
doğrulanabilir araçları çağırır:

- `announceDeal`, `dealInitialCards`, `dealPlayerCard`, `revealDealerCard`
- `startSpin`, `revealSpin`, `startRouletteRound`, `releaseBall`
- `setTableMood`, `playSfx`, `triggerAvatarReaction`, `pauseForSpeech`
- `recapSession`, `rememberPreference` (oyuncu izniyle)

Araç çağrısı bir krupiyenin gerçek eylem başlatmasını sağlar. Örneğin AI
"Kartını açıyorum" dediğinde `revealDealerCard` isteği oyun motoruna gider;
motor bunun o aşamada geçerli olup olmadığını denetler ve gerçek kartı üretir.
AI daha sonra sonucu görüp insan gibi yorumlar.

### 5.4 İnsan gibi konuşma kuralları

- Cevaplar bağlama göre kısa, orta veya uzun olur; her spin'de konuşmak zorunda
  değildir.
- Tekrarlayan repliklere karşı yakın geçmiş benzerlik filtresi uygulanır.
- Ciddi anlarda sakinleşir; büyük elde veya iyi şakada daha güçlü konuşabilir.
- Oyuncunun söylediğine cevap verir, uydurma anılar veya gerçek dünyaya dair
  doğrulanamaz iddialar üretmez.
- Türkçe varsayılandır; ayarlardan İngilizce veya iki dilli mod eklenebilir.
- Mizah seviyesi: `sakin`, `esprili`, `acımasız değil ama sivri`, `sessiz`.

### 5.5 Model stratejisi

**Varsayılan: yerel ve ücretsiz.**

- Ollama, bilgisayarda yerel HTTP servis olarak çalışır.
- Ollama `0.32.15` kuruldu. Üretimde düşünme metnini kullanıcıya sızdırmayan
  `gemma3:4b` tabanlı özel `vera-pehlevan` modeli kullanılıyor. Ollama, bu
  bilgisayardaki sorunlu CUDA yolunu kullanmaması için CPU kipine sabitlendi.
- Vera'nın kişiliği `ai/Modelfile.vera` içinde tanımlıdır. Bu aşamada fine-tune
  yerine sistem talimatı + oyun bağlamı kullanmak daha güvenli ve hızlıdır.
- Bu bilgisayarda 16 GB sistem RAM tespit edilmiştir; ekran kartı belleği
  doğrulanmadığı için küçük modelle başlanıp gecikme ölçülmelidir.
- Hedef: ilk kelime için kısa gecikme, Türkçe tutarlılığı ve farklı karakter
  seslerinin birbirinden ayrılması.
- Ölçüm: CPU kipinde ilk 7B yükleme ve kısa yanıt yaklaşık 26 saniye; model
  bellekteyken kısa yanıtlar yaklaşık 6–21 saniye sürdü. Oyun içi el yorumları
  anlık ve deterministik cevap katmanından gecikmesiz gelir.
- `aya-expanse:8b` Türkçe/argo/ilişki örnekleriyle yerelde denendi; model küfre
  ahlak dersi verip ilişki bağlamını oyuna çevirdiği için reddedildi ve test
  dosyaları kaldırıldı. `gemma3:12b` daha güçlü fakat bu 16 GB/CPU sistemde
  sohbet gecikmesini belirgin artıracağı için şimdilik aktif edilmedi.
- Bir sonraki isteğe bağlı sağlayıcı adayı ücretsiz kotası bulunan Gemini Flash
  API'dir. Anahtar olmadan etkinleştirilmeyecek ve yerel Gemma her zaman yedek
  kalacaktır.

**İsteğe bağlı premium: bulut AI.**

- Daha akıcı veya sesli konuşma gerektiğinde API anahtarı kullanıcının kendi
  ayarlarında tutulur.
- Bulut anahtarı kaynak koduna yazılmaz; yerel `.env` veya güvenli sunucu
  değişkeninde tutulur.
- Sesli gerçek zamanlı mod ayrıca açılıp kapatılabilir; maliyet limiti,
  karakter başına günlük token bütçesi ve yanıt uzunluğu tanımlanır.

**Ses hattı (ikinci aşama):** Mikrofon → yerel konuşmayı yazıya çevirme → LLM
→ yerel/bulut TTS → karakter ağzı/konuşma animasyonu. Ses gelene kadar metin
balonu anında gösterilmelidir.

---

## 6. Teknik mimari

### 6.1 Tercih edilen teknoloji seti

| Katman | Seçim | Neden |
| --- | --- | --- |
| Uygulama kabuğu | React + TypeScript + Vite | Hızlı, bakım kolay, PWA için güçlü temel |
| Oyun sahneleri | Phaser | 2D kart/slot/rulet animasyonları, input ve ses için uygun |
| Stil | CSS variables + modern CSS; gerekirse Tailwind | Art-deco temayı tutarlı biçimde yönetmek |
| Durum | Zustand veya Redux Toolkit | Profil, ayarlar ve salonlar arası kalıcı durum |
| Yerel kalıcılık | IndexedDB (Dexie önerilir) | Profil, sanal bakiye, kayıtlar ve AI tercihleri |
| Oyun mantığı | Saf TypeScript domain modülleri | UI/AI'dan bağımsız test edilebilir kurallar |
| AI yerel geçidi | Node/Fastify küçük BFF + Ollama | Tarayıcı CORS/sır yönetimi ve API anahtarı izolasyonu |
| Ses | Web Audio API + Phaser Audio | Müzik, foley, katmanlı ambience |
| Test | Vitest + Playwright | Kural testi ve kritik oyun akışları |
| Paketleme (sonra) | Tauri | Aynı web uygulamasını küçük masaüstü uygulamasına dönüştürmek |

Başlangıçta tam bir sunucu zorunlu değildir. Tek kullanıcı için oyunlar ve
profil PWA içinde çalışır; yalnızca AI geçidi gerekli olabilir. Çok oyunculu
poker veya ortak liderlik tablosu istenirse ayrı backend eklenir.

### 6.2 Önerilen klasör düzeni

```text
src/
  app/                 # Router, PWA, global providers
  casino/              # Ortak lobi, profil, para birimi, event bus
  games/
    blackjack/         # domain, UI, Phaser scene, testler
    slots/
    roulette/
    poker/
    baccarat/
    sic-bo/
    wheel/
    high-low/
  ai/
    personas/          # Her karakterin yapılandırması ve prompt'u
    memory/            # Kısa/uzun hafıza politikası
    tools/             # Doğrulanabilir oyun eylemleri
    providers/         # Ollama / opsiyonel bulut sağlayıcı
  audio/
  components/
  design-system/
  db/
  lib/
assets/
  third-party/         # İndirilen ham açık lisanslı varlıklar
  curated/             # Uygulamada gerçekten kullanılan, optimize edilmiş varlıklar
THIRD_PARTY_ASSETS.md
CASINO_PROJE_KAIDE_TASI.md
```

### 6.3 Kritik veri modelleri

- `PlayerProfile`: takma ad, ayarlar, seçilen dil, erişilebilirlik tercihleri.
- `WalletLedger`: başlangıç bakiyesi, sanal chip ekleme, bahis, ödül, sıfırlama.
- `GameSession`: oyun türü, başlangıç/bitiş zamanı, bahisler, sonuç, seed/olaylar.
- `CasinoEvent`: oyun olayının standart şekli; AI ve UI aynı olayı dinler.
- `PersonaState`: anlık duygu, konuşma sırası, kısa hafıza, sessizlik süresi.
- `PersonaMemory`: kullanıcının izin verdiği kalıcı tercih/hatıralar.

### 6.4 Sınırlar ve güvenlik

- Sanal bakiye hiçbir şekilde para birimi, cüzdan, ödeme ya da çekim özelliğine
  dönüşmez.
- AI'a ham kullanıcı dosyası, sistem komutu, API anahtarı veya sınırsız ağ
  erişimi verilmez.
- Her AI araç çağrısı JSON şemasıyla denetlenir ve oyun fazına göre reddedilir.
- Kişisel veriler mümkünse cihaz dışına çıkmaz; bulut AI modu açıkça belirtilir.
- Oyuncu tek tıkla AI sohbet geçmişini/hatıralarını temizleyebilir.

---

## 7. Asset stratejisi ve mevcut indirmeler

Kaynak/lisans kaydı: [`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md)

| Kaynak | Yerel konum | Lisans | Karar |
| --- | --- | --- | --- |
| OpenDecks kartları | `assets/third-party/cards/OpenDecks/` | CC0 | Blackjack/poker için ana kart destesi |
| Kenney Casino Audio | `assets/third-party/audio/kenney_casino-audio/` | CC0 | Kart, jeton, zar foley sesleri |
| Kenney UI Pack | `assets/third-party/ui/kenney_ui-pack/` | CC0 | Ham bileşen kaynağı; doğrudan mavi görünüm kullanılmayacak |
| Roulette Casino SVG | `assets/third-party/roulette/roulette_casino.svg` | CC0 | Rulet çarkı için başlangıç/referans |
| Slot Machine Resource Pack | `assets/third-party/slot-reference/slot-machine-resource-pack/` | CC-BY / OGA-BY | Yalnızca referans; semboller kullanılacaksa atıf zorunlu |

### Asset kuralları

- Ham dosyalar `third-party` altında korunur; uygulamanın gerçekten kullandığı
  dosyalar optimize edilerek `assets/curated` altına alınır.
- Her yeni dış varlık, `THIRD_PARTY_ASSETS.md` dosyasına kaynak, lisans,
  sanatçı ve kullanım amacıyla eklenir.
- CC-BY içeriği için uygulama içinde Credits ekranı bulunur.
- Gerçek casino markaları, ünlü kişi yüzleri ve lisansı belirsiz Google görselleri
  kullanılmaz.
- Krupiye portreleri için özgün tasarım veya açık lisanslı kaynak kullanılır.
- Sonraki slot dünyalarında her sembolü tek tek üretmek varsayılan yöntem değildir:
  önce lisansı doğrulanmış ücretsiz/açık paketler toplu olarak indirilip ortak bir
  sanat işleminden geçirilir; yalnız karakter, scatter ve oyunu ayırt eden özel
  mekanik ikonlarındaki boşluklar Imagegen ile tamamlanır.

---

## 8. Aşamalı geliştirme planı

### Faz 0 — Temel kararlar ve hazırlık ✅

- [x] Ürün vizyonu ve kişisel/sanal para kapsamı netleştirildi.
- [x] Web/PWA + React/TypeScript + Phaser yönü seçildi.
- [x] Açık lisanslı kart, ses, UI, rulet ve slot referansları indirildi.
- [x] AI'ın tek bot değil, oyun bazlı karakter sistemi olacağı belirlendi.

### Faz 1 — Casino kabuğu (temel sürüm tamamlandı)

- [x] React/Vite/TypeScript projesini başlat.
- [x] Midnight Art Deco görsel dilini oluştur.
- [x] Pehlevan Royale lobisi, sanal bakiye ve temel profil istatistiklerini yap.
- [ ] IndexedDB şeması ve wallet ledger'ı kur.
- [ ] Genel casino event bus'ı oluştur.

### Faz 2 — Blackjack dikey dilimi

- [x] Hit/stand/double/split/insurance/late surrender/blackjack/push akışlı oyun
  motoru ve iki ayrı split elinin bahis/sonuç hesapları tamamlandı.
- [x] Gerçek 6 destelik (312 kart) kalıcı shoe, son destede kesme kartı ve shoe
  sayacı eklendi; her elde yeniden deste üretme kaldırıldı.
- [x] Perfect Pairs (6:1 / 12:1 / 25:1) ve 21+3
  (5:1 / 10:1 / 30:1 / 40:1 / 100:1) yan bahis motorları eklendi. Yan bahisler
  ana oyundan bağımsız çözülür ve kendi fiziksel çip yığınlarına sahiptir.
- [x] CC0 OpenDecks kartları, yavaşlatılmış dağıtım/açma, fiziksel çip seçici,
  masaya kayan bahis yığını ve toplam rozetleri olan premium CSS/React masası.
- [x] Yan bahis kazanma kutlaması, kayıp/kazanç rozetleri, son sekiz el yolu,
  kazanma serisi ve masa kuralları paneli eklendi.
- [x] Her el için ana bahis, yan bahis, sigorta, double ve split ek bahislerini
  kapsayan finans özeti eklendi: yatırılan tutar, brüt geri dönüş ve canlı sayan
  net kazanç/kayıp sahnesi. Yan bahislerde keyfî 500 PR sınırı kaldırıldı; bahis
  yalnızca mevcut eğlence bakiyesiyle sınırlı ve 1.000 PR çipi destekleniyor.
- [x] Vera persona pack'i, Ollama/Gemma yerel modeli, son-el ve ilişki hafızalı
  bağlama duyarlı Türkçe sohbet.
- [ ] AI → doğrulanmış kart dağıtım aracı akışı.
- [x] Kenney kart/jeton sesleri, el/kazanma sayacı, seri/sonuç geçmişi ve düşük
  hareket CSS'i eklendi.
- [ ] Yan bahis ve blackjack motoru için kalıcı Vitest birim test paketi sırada;
  mevcut ödeme kombinasyonları geliştirme sırasında deterministik olarak doğrulandı.

### Faz 3 — Slot ve rulet

#### Slot mekanik araştırma kararları

Gerçek sağlayıcı adları, karakterleri, logoları, sesleri ve görselleri kopyalanmaz.
Resmî ürün sayfaları yalnızca mekanik araştırmasıdır; her oyun özgün ad, sanat,
sunucu kişiliği ve yeniden kalibre edilmiş matematik kullanır.

| Araştırılan çekirdek | Resmî referans | Pehlevan Royale özgün karşılığı |
| --- | --- | --- |
| 7×7 cluster, tumble ve aynı hücrede büyüyen çarpan | [Sugar Rush](https://www.pragmaticplay.com/en/games/sugar-rush/) | Neon Kasası: siber soygun, 8 sembol, MIRA ve ayrı ödeme tablosu |
| Ekranın herhangi yerindeki semboller + bonus boyunca toplanan ortak çarpan | [Gates of Olympus 1000](https://www.pragmaticplay.com/en/games/gates-of-olympus-1000/) | Neon Kasası bonusundaki özgün güç darbesi havuzu; Zeus, mitoloji ve sağlayıcı görsel dili kullanılmadı |
| 7×7 cluster ve bütün tumble dizisi bittikten sonra görünür çarpanları tek ödemede birleştirme | [Fortune of Olympus](https://www.pragmaticplay.com/en/campaign/fortune-of-olympus/) | Neon Kasası güçleri ilk ekranda veya sonraki düşüşlerde iner; zincir ortasında ödeme yapmaz |
| Para sembollerini wild ile toplama ve kademeli retrigger | [Bigger Bass Bonanza](https://www.pragmaticplay.com/en/games/bigger-bass-bonanza/) | Kaptan Mercan: gece balıkçısı ve özgün deniz canlıları |
| Sticky/raining multiplier wild seçenekleri | [The Dog House Megaways](https://www.pragmaticplay.com/en/games/the-dog-house-megaways-slot/) | Sokak Patileri: neon mahalle ve kurtarma ekibi |
| 5×5 alan ve gittikçe büyüyen wild | [Juicy Fruits](https://www.pragmaticplay.com/en/games/juicy-fruits/) | Meyve Laboratuvarı: tropik deney ve zincir bonusu |
| Hold & collect / karakter yetenekleri | [Money Train](https://www.relax-gaming.com/products/casino/moneytrain) | İleride özgün kasa/soygun oyunu; Western tren teması kopyalanmayacak |

Ortak kalite tabanı: doğrudan yazılabilir ve yalnız bakiyeyle sınırlı bahis,
10/25/50/100 otomatik spin, Turbo, ayrı ses/konuşma kontrolleri, net ve brüt sonucu
ayırt eden ekran, son spin geçmişi, kapanabilir kural paneli ve oyun durumunu gören
ayrı karakter kişiliği.

- [x] Royal Reels Slot Dünyası lobisi; birbirinden ayrılan altı görsel/mekanik tema.
- [x] Kiraz Kulübü 77: 3×3 pencere, 5 çizgi, en fazla iki makara HOLD, turbo, ses, ödeme tablosu, spin geçmişi ve net/brüt sonuç ayrımı.
- [x] Kiraz Kulübü 77 otomatik spin (10/25/50/100) ve doğrudan yazılabilen bahis alanı; keyfî 500 PR tavanı kaldırıldı, tek sınır mevcut sanal bakiye.
- [x] Saf TypeScript makara motoru ve bütün bağımsız durakları tarayan teorik profil testi; temel RTP %93,49.
- [x] Özgün Rocco karakteri ve slot durumunu gören yerel AI sohbet katmanı.
- [x] Neon Kasası: 7×7 yatay/dikey cluster; kazananın patlaması, sütun içindeki hayatta kalanların gerçek mesafesi kadar aşağı kayması ve yeni sembollerin üstten kademeli girişiyle yavaşlatılmış gerçek cascade. Yeni sembollerde kontrollü komşu yakınlığı daha fazla ikinci/üçüncü zincir üretir.
- [x] Neon Kasası bonusu: cascade dizisinin sonunda ekranda 4/5/6/7 MIRA scatter ile 15/20/25/30 free spin; bonus içinde 3+ MIRA beş spin ekler. Doğal veya 100× bahis bedelli satın alımla açılan bonus oyuncu “Başlat” demeden ilerlemez ve iki giriş de aynı bonus motorunu kullanır.
- [x] Eski cascade-başına çarpan kaldırıldı. 2×/3×/4×/5×/10×/15×/25×/50×/100×/500×/1000× bağımsız güç sembolleri ilk ekranda veya sonraki tumble girişlerinde normal sembol yerine inebilir ve güç iniş sesi çalar. Bütün tumble dizisi bittikten sonra görünür güçler yavaşça tek tek toplanır (`17× + 2× = 19×`), ardından bütün spin tabanı tek darbede çarpılır. Büyük değerlerin ağırlığı katman katman düşer ve tek spin toplamı 15.000× bahisle sınırlıdır.
- [x] Free spin sırasında kazanan spin sonunda görünen güçler kalıcı ortak çarpan havuzuna eklenir. Her free spin kazancı ayrı ayrı bakiyeye yazılmaz; bonus kasasında birikir, özellik tamamlanınca tek seferde ödenir ve kapanabilir “Free Spin Kazancı” özeti gösterilir.
- [x] MIRA Boost: %25 ek ücretle 4-MIRA bonusunun toplam tetiklenme ihtimalini yaklaşık iki katına çıkaran özel bahis. Dört sembol gerektiği için hücre ağırlığı matematiksel olarak dördüncü köke göre kalibre edilir; Boost açıkken bonus satın alma kapalıdır.
- [x] Neon Kasası için özgün MIRA scatter jetonu ve dokuz biçimli güç sembolü sprite levhası; MIRA karakteri/yerel AI kişiliği, güç inişi/toplama/final darbesi için üç ayrı ses imzası, Turbo, otomatik spin, sonuç geçmişi ve responsive premium arayüz.
- [x] Bahse oranlı büyük kazanç tiyatrosu eklendi: 10× `Büyük Kazanç`, 25× `Muhteşem Kazanç`, 100× `Efsanevi Vurgun`, 500× `Akılalmaz Kazanç`, 1000× `Tarihi Vurgun`. Tutar canlı sayılır; her katmanın rengi, parçacığı ve müzikal yükselişi ayrıdır. Free spin içindeki 3+ MIRA retrigger'ı otomatik akışı durduran üç-MIRA sahnesiyle `+5 FREE SPIN` ve yeni kalan spin toplamını açıkça gösterir.
- [x] Neon Kasası ana sonuç bandı kumar oynanışına uygun biçimde brüt spin ödemesini gösterir; boş spin `0 PR kazanç` olarak sunulur. Gerçek net kâr/zarar soldaki operasyon kaydında ve araştırma veritabanında korunur; kayıp tutarı ana sahnede ikinci kez eksi olarak öne çıkarılmaz.
- [x] Cascade görsel katmanı kalıcı hücre kimliği kullanır: 49 hücre iç içe satır
  dizileri yerine tek düz React çocuk listesinde render edilir. Böylece yalnız patlayan
  hücreler DOM'dan çıkar; üstteki mevcut semboller opacity kaybetmeden aynı DOM/asset
  kimliğiyle gerçek mesafesi kadar aşağı kayar. Yalnız üst haznede açılan boşluklara
  ayrı `entering` kimlikli yeni semboller doğar. Turbo da bu hareketi izletecek kadar
  yavaşlatıldı; normal moddan belirgin biçimde hızlı kalır.
- [x] Güç sembollerinin çarpan değeri token'ın tam ortasında büyük yazılır. Tumble
  bittikten sonra orta sahne önce değerleri geliş sırasıyla toplar, sonra
  `1.500 PR × 5× = 7.500 PR` final darbesini gösterir; hesap spin sonunda kompakt
  çarpan makbuzunda kalır.
- [x] Neon Kasası motor testleri: komşuluk, survivor kaynak satırı, gerçek düşüş mesafesi, sonraki tumble'dan güç inişi, 4–7 MIRA tablosu, bonus retrigger, 2×–1000× ağırlık uçları, tumble-sonu tek çarpma, bonus çarpanı birikimi, 16 cascade güvenlik sınırı, MIRA Boost ve 100× bonus satın alma profili. Sabit tohumlu 50.000 ücretli spin + organik bonus örnekleminde toplam RTP yaklaşık %93,21; temel oyun %84,13 ve 2+ cascade %11,59. 30.000 Boost spininde maliyet dahil RTP %98,05; 3.000 satın alınmış bonus örnekleminde %88,32'dir. Bunlar sertifikalı gerçek para değerleri değildir.
- [x] Rastgele sonuçlar önceki kazanma/kaybetme geçmişine göre telafi edilmez. Kasa eğilimi ödeme tablosu, sembol/özellik ağırlıkları ve uzun örneklem RTP'siyle kurulur; volatilite nadir büyük ödüllerden gelir.
- [ ] Kaptan Mercan: 5×4 para sembolleri, balıkçı toplama ve kademeli retrigger çarpanı.
- [ ] Sokak Patileri: 5×5 cluster, sticky çarpan wild ve iki farklı bonus seçimi.
- [ ] Meyve Laboratuvarı: 5×5 büyüyen wild, zincir bonusu ve tropik ses sahnesi.
- [ ] Pehlevan Pinball fizik tabanlı bonus sahnesi.
- [x] Rocco ve MIRA birbirinden ayrı slot kişilikleri, olay tepkileri ve oyun bağlamlı yerel AI sohbeti.
- [x] European Roulette tek sıfırlı gerçek çark sırası, çark/top animasyonu ve
  responsive Rouge Salon sahnesi tamamlandı. Tahta; tek sayı, yatay/dikey ayırma,
  sokak, köşe, altılı, düzine, kolon, 1:1 dış bahisler ile Voisins, Tiers,
  Orphelins, Jeu Zéro ve seçilen sayının iki komşusunu kapsıyor.
- [x] Rulet çipleri sınırsız tekrarlı yerleştirme, hedef başına son çipi geri alma,
  genel geri al/temizle, önceki bahsi yinele ve 2× bahis akışlarına sahip. Her bahis
  gerçek birim maliyeti ve kendi ödeme oranıyla çözülüyor; sonuçta brüt dönüş ve net
  kazanç/kayıp ayrı gösteriliyor.
- [x] Canlı rulet turu tam 30 saniyelik ortak saatle ilerliyor: 20 saniye bahis,
  2,4 saniye Surge sunumu, 4,6 saniye çark/top ve 3 saniye sonuç. Motor oda
  bileşeninden bağımsız olarak uygulama seviyesinde çalışıyor; oyuncu salona girdiğinde
  yeni tur başlatmak yerine devam eden turun kalan süresine bağlanıyor. Her dönüşün ardından masa temizleniyor;
  “Aynı bahsi yerleştir” önceki turdaki bahis düzenini isteğe bağlı geri kuruyor.
- [x] Pehlevan Surge özel turu her tur 2–5 rastgele sayıya 50×–500× çarpan atıyor.
  Çarpan yalnızca kazanan tek-sayı bahsine uygulanıyor; masa, çark, sonuç ekranı,
  Armand yorumu ve ödeme motoru aynı olay verisini kullanıyor.
- [x] Sinematik çark yakınlaşması, şimşek/sayı seçimi, Armand hareket durumları,
  çip iniş/ödeme parçacıkları ve çarpanlı büyük-kazanç sahnesi eklendi.
- [x] Katmanlı rulet sesi; ayrı efekt/ortam kontrolleri, son beş saniye uyarısı,
  bahis kapanışı, top sekme dizisi, sıfır, çip süpürme ve büyük ödeme seslerini kapsıyor.
- [x] Son 40 turdan sıcak/geciken sayı, renk ve seri analizi üretiliyor. Tur geçmişi
  ve tek favori bahis düzeni yerel olarak saklanıyor; favori düzen tek tuşla kuruluyor.
- [x] Armand persona pack'i, yerel Ollama bağlantısı, masa/sonuç/geçmiş bağlamı,
  Türkçe erkek sesi ve oyuna özgü kuru mizahlı olay yorumları eklendi.
- [x] Imagegen ile oluşturulan özgün Armand görseli, CC0 Kenney çip/çark sesleri ve
  CC0 rulet referansı production dizinine alındı.
- [x] Araştırma veritabanı IndexedDB şema v2 üzerinde `game_rounds`, `wallet_ledger`,
  `game_events`, `ai_conversations` ve `meta` katmanlarıyla kuruldu. Blackjack, canlı rulet, Kiraz 77 ve
  Neon Kasası; bahis, brüt ödeme, net, sonuç, modifier/çarpan ve oyuna özgü ham veriyi
  kalıcı kaydediyor. Lobi Veri Kasası toplam harcama, toplam dönüş, net, gözlenen RTP,
  oyun kırılımı ve son kayıtları gösteriyor; JSON ve CSV dışa aktarma sunuyor.
- [x] Matematik telemetrisi analiz için ayrıntılandırıldı. Neon Kasası her spin için
  ilk/son grid ve güç gridlerini, her cascade'in cluster, kazanan hücre, düşüş kaynak
  satırı, sonraki grid ve dönüşünü; scatter/free-spin/bonus oturumu ile toplanan ve
  uygulanan çarpanları yazar. Rulet bütün bahis tanımlarını, çipleri, alan bazlı stake
  ve kazançları, Surge sayılarını/çarpanını; Kiraz 77 stop, hold, çizgi ve ödeme
  ayrıntılarını; Blackjack ise dağıtılan kartlarla hit/stand/double/split/sigorta/
  surrender aksiyon sırasını kaydeder.
- [x] Vera, Armand, Rocco ve Mira için oyuncu mesajı, AI cevabı ve otomatik oyun
  repliği ayrı türlerle; karakter, oyun, oturum/tur bağı, o anki oyun bağlamı, model
  etiketi ve cevap gecikmesiyle `ai_conversations` deposuna yazılır. Yönetim paneli
  son konuşmaları ve tur/AI/araştırma veri boyutlarını gösterir; tam JSON dışa aktarım
  konuşmaları da içerir.
- [x] Ruletin bahis konmayan arka plan sonuçları da 30 saniyede bir ayrı `live-table`
  turu olarak yazılıyor. Tarayıcı arka planda zamanlayıcıyı yavaşlatırsa mutlak tur
  saati atlanan aralıkları yakalayıp eksik canlı masa kayıtlarını tamamlıyor. Oyuncu
  bahsi kapanınca bir ticket'a dönüşüyor; oda değişse dahi tur sonunda ödeme ve kayıt
  uygulama seviyesinde tamamlanıyor.
- [x] Oyuncu rulet ticket'ı sonuç anında veritabanı kuyruğunu beklemeden hesaplanır;
  bakiye, net sonuç ve kazanan bahis dökümü senkron güncellenir, kalıcı kayıt arkadan
  tamamlanır. React geliştirme çift-yaşam-döngüsünde callback kaybı giderildi. Bahis
  yapılmayan tur `0 PR net` yerine `Bahis yok` gösterir; son gerçek oyuncu neti yeni
  bahis turunda da kapanabilir küçük sonuç kartında görünür kalır.
- [x] Tam ekran Pehlevan Royale yönetim merkezi eklendi. Genel bakış; canlı KPI, kasa sonucu,
  gözlenen RTP, son-tur grafiği, canlı olay akışı ve oyun sağlığı verir. Oyun yönetimi;
  salon aç/kapat, minimum/varsayılan bahis, RTP kalibrasyon hedefi, volatilite, auto,
  ses, AI ve oyuna özgü feature anahtarlarını kalıcı olarak yönetir. Kullanıcı dizini;
  rol, durum ve sanal cüzdanı; bakiye/kasa bölümü yönetici ekleme-düşme işlemlerini ve
  wallet ledger'ı; veritabanı bölümü filtreli tur inceleme, JSON/CSV dışa aktarma ve
  onay cümleli veri temizlemeyi; sistem bölümü bakım, marka, AI, ses ve veri politikasını kapsar.
- [x] Admin ayarları `pehlevan-royale-admin-v1` yerel yönetim modelinde sürümlü ve kalıcıdır.
  Salon erişimi, bakım modu, varsayılan/minimum bahis, slot auto/hold/turbo/bonus-buy/
  MIRA Boost, Blackjack yan bahis/sigorta/split/teslim ve rulet Surge/ilan/komşu bahisleri
  yeni oyun oturumlarına gerçek zamanlı bağlanır. Yönetici cüzdan işlemleri araştırma
  veritabanına açıklama, önceki bakiye ve sonraki bakiyeyle kaydedilir.

### Faz 4 — Katalog genişletme

- [x] Kaptan Mercan 5×4 video slotu eklendi: 20 çizgi, para balığı, Kaptan
  toplama, 3/4/5 fenerle 10/15/20 ücretsiz spin, kanca kurtarması, Fener Şansı,
  100× bonus satın alma ve 4/8/12 kaptanda +10 spin ile 2×/3×/10× ilerleme.
- [x] Kaptan Mercan'ın karakteri, Osmanlı gece limanı ve bütün aktif makara
  sembolleri proje için özgün Imagegen setine geçirildi; müzik ve efektler CC0
  paketlerden indirildi; üretim görseli kullanılmadı. Mercan kişiliği Türkçe
  yerel AI/fallback, Türkçe erkek sesi ve ayrıntılı konuşma kaydıyla bağlandı.
- [ ] Video poker, baccarat, Sic Bo, wheel ve high-low.
- [ ] Her masanın ayrı ses atmosferi ve karakteri.
- [~] Kalıcı oyun araştırma istatistikleri ve salon geçişleri hazır; başarılar ve
  kişiselleştirme sırada.

### Faz 5 — Ses, kalite ve masaüstü

- [~] `tr-TR-EmelNeural` Türkçe kadın sesi, tarayıcı yedeği ve ses aç/kapat
  ayarı eklendi; mikrofon/STT sırada.
- [~] Özgün Vera portresi, konuşma/karıştırma/dağıtma tepkileri eklendi; gerçek
  dudak senkronu ve iskelet animasyonu sırada.
- [ ] Playwright uçtan uca testleri, performans denetimi.
- [ ] Tauri masaüstü paketi.

### Faz 6 — İsteğe bağlı ileri özellikler

- [ ] Bulut AI sağlayıcısı seçeneği ve maliyet sınırı.
- [ ] Çok oyunculu poker için sunucu otoritesi değerlendirmesi.
- [ ] Temalı sezonlar ve daha zengin lobi.

---

## 9. Mevcut teslim ve sıradaki iş

Blackjack dikey dilimi artık şunları içerir: lobi → Vera'nın masası → ana/yan
bahis seçimi → 312 kartlık shoe → görünür kart dağıtımı → hit/stand/double/split/
insurance/late surrender → yan bahis çözümü ve kutlaması → sonuç geçmişi → yerel
AI sohbeti. Sonraki kalite hedefi kararlı Vitest/Playwright paketi, daha ayrıntılı
oturum istatistikleri ve gerçek zamanlı dudak/kol animasyonudur. Bu dilim; görsel
dilin, AI araçlarının, oyun kurallarının ve asset işleme hattının temelini oluşturur.

---

## 10. Açık kararlar

Uygulama başlamadan önce cevaplanması faydalı, ancak başlangıcı engellemeyen
kararlar:

- Casino adı `Pehlevan Royale` olarak belirlendi.
- Yeni Pehlevan Royale ev kimliği; baykuş ve altı köşeli yıldızın lüks mimari
  kabartma, mühür, çip, kakma ve ışık dili olarak kullanılmasıdır. Yeni oyunlar bu
  dili doğrudan taşır; eski salonlar ayrı geçişlerle daha sonra uyarlanır.
- Oyunlar arası kontrol standardı sabitlendi: bakiye/ses/çıkış üst çubukta; bahis,
  hızlı çipler ve ana tur eylemi oyunun alt kontrol iskelesinde birlikte durur.
- Plinko, `Anlık Oyunlar` kategorisine 8–16 sıra, üç risk, çoklu/otomatik top,
  HMAC doğrulaması ve ayrıntılı SQLite kaydıyla eklendi. Canvas animasyonu sonuç
  motorundan ayrıdır; mobil ve masaüstünde aynı doğrulanabilir turu oynatır.
- Baykuş ve altı köşeli yıldız birer doldurma ikonu değildir. Motifler yalnızca
  mimari veya malzeme dili içinde gerekçeli ve seyrek kullanılır; oyunun temasını
  asıl kuran bütünsel renk, ışık, mekanik ve sahne kompozisyonudur.
- Hızlı çip kupürleri bahis tavanı değildir. Tüm oyunlar serbest tutar girişi ve `MAX`
  sunar; tek doğal üst sınır kullanılabilir bakiye (özellik maliyet çarpanı varsa
  `bakiye / çarpan`) olarak hesaplanır. `500K` dâhil hiçbir sabit değer gizli tavan olamaz.
- Karakterler yalnızca metinle mi başlayacak, yoksa ilk sürümde ses/portre de
  olacak mı?
- Blackjack kural seti klasik American hole-card, S17, blackjack 3:2, insurance
  2:1, double after split ve late surrender olarak sabitlendi.
- Başlangıç sanal bakiyesi, bahis limitleri ve yeniden bakiye ekleme miktarı.
- AI mizah seviyesi varsayılanı ve karakter adları.

Bu kararlar verilene kadar varsayılanlar uygulanır; hiçbiri mimariyi yeniden
yazmayı gerektirmez.
