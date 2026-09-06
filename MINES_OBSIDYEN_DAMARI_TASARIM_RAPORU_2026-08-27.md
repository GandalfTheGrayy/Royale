# Pehlevan Royale — Mines Oyun Tasarım Raporu

> Tarih: 27 Ağustos 2026  
> Durum: Araştırma ve tasarım; **henüz uygulama yapılmadı, varlık indirilmedi**  
> Önerilen oyun adı: **OBSIDYEN DAMARI**  
> Kategori: **Anlık Oyunlar**  
> Ürün sınırı: Yalnızca kişisel eğlence ve sanal PR bakiyesi

## 1. Kısa karar özeti

Standart Mines oyunu tek başına 25 kapalı kare, seçilebilir mayın sayısı, güvenli
karelerde büyüyen çarpan ve istenilen anda kazancı alma kararından oluşuyor. Bu
çekirdek güçlü fakat tek başına Pehlevan Royale kalite çıtası için fazla çıplak.

Önerdiğim nihai oda şu dört katmandan oluşacak:

1. **Serbest Kazı:** 5×5 klasik Mines. Oyuncu 1–24 tehlike seçer, istediği kareyi
   açar ve her güvenli seçimden sonra devam etmek veya brüt ödemeyi almak arasında
   karar verir.
2. **Derin Hat:** 5 sütun × 12 kademe ilerlemeli ayrı mod. Her sırada kapalı
   seçeneklerden biri seçilir; bir sonraki derinliğe inildikçe ödeme yükselir.
   Kolay/Orta/Zor sözleşmeleri her sıradaki tehlike sayısını değiştirir.
3. **Keşif donanımları:** Tarayıcı ve tek kullanımlık zırh, klasik oyuna sonradan
   yamalanmayacak; ayrı ve açık kurallı sözleşmeler olacak. Matematikleri dinamik
   programlama/simülasyonla doğrulanmadan açılmayacak.
4. **Müze ilerlemesi:** Kasaya etki etmeyen, tur başarılarından bulunan obsidyen
   parçaları ve eser koleksiyonu. Uzun vadeli ilerleme verir fakat gizli oran ya da
   yapay “sıcak tahta” üretmez.

Önerilen sanat yönü **obsidyen siyahı + petrol mavisi + bakır + mineral ışıkları**.
Kapalı kareler metalik taş mühürler, güvenli kareler kristal damarları, tehlikeler
ise basınçlı patlayıcı cevher cepleri olacak. Oyunun Türkçe karakteri **Ayla** adlı
jeolog ve kontrollü patlatma uzmanı olacak.

Varsayılan matematik önerim **%97 RTP / %3 kasa avantajı**. Bu oran gerçek
sağlayıcı aralığına oturuyor: SPRIBE Mines %97; Gaming Corps Mining Madness
%96,59–%97,32; BGaming'in yol tipi Minesweeper/Mine Gems oyunları ise yaklaşık
%98,4 RTP yayımlıyor. Yönetici paneli oranı değiştirebilir ancak değişiklik yalnız
sonraki turlara uygulanır ve tüm ödeme tablosu yeniden hesaplanır.

## 2. Piyasa ve kural araştırması

### 2.1. Klasik serbest seçim ailesi

- [Stake Mines](https://stake.com/casino/games/mines): 5×5, toplam 25 kare,
  1–24 mayın, her güvenli kareden sonra artan çarpan ve istenilen anda cash-out.
  Yayımlanan RTP %99 ve kasa avantajı %1.
- [SPRIBE Mines](https://spribe.co/games/mines): yıldız/mayın temalı aynı temel
  karar, otomatik oyun ayarları, canlı bahis/sohbet katmanı ve %97 RTP.
- [Gaming Corps Mining Madness](https://gamingcorps.com/game/mining-madness/):
  5×5 alan, 1–24 dinamit, 9/10 volatilite ve belirli risk ayarlarında çalışan
  Treasure Boost özelliği. Yayımlanan RTP aralığı %96,59–%97,32.

Bu ailenin kuvveti, oyuncunun **hangi kareyi açacağına ve ne zaman duracağına**
doğrudan karar vermesi. Zayıflığı ise sunum iyi değilse birkaç tur içinde aynı
animasyonun tekrarına dönüşmesi.

### 2.2. Rota/merdiven ailesi

- [BGaming Minesweeper kuralları](https://bgaming.com/wp-content/uploads/2025/04/63f20166064ae9a63e9f30f2_minesweeper.pdf)
  2×3 ile 6×15 arasında farklı alanlar kullanıyor; oyuncu her vurgulanan sırada
  bir kare seçip ilerliyor ve istediği anda topluyor.
- [BGaming Mine Gems](https://bgaming.com/games/mine-gems) 5×12 alanda her sırada
  dört güvenli taş ve bir patlayıcı kullanıyor. On iki aşamalı çarpan merdiveni,
  dinamik cash-out tutarı ve bütün alanı gösteren mini haritası var.

Bu aile daha yönetilen bir dramatik ritim sağlıyor: seçim alanı her adımda aynı
kalırken oyuncunun haritada fiziksel olarak aşağı/yukarı ilerlediği görülüyor.
Serbest 5×5 ile aynı odada ikinci mod olması, tekrar hissini ciddi biçimde azaltır.

### 2.3. Alınacak ve alınmayacak dersler

Alınacaklar:

- Risk seviyesi oyun başlamadan açıkça seçilir.
- Güncel brüt ödeme ve bir sonraki güvenli seçimin ödemesi sürekli görünür.
- Cash-out her güvenli seçimden sonra erişilebilirdir.
- Tur başlamadan tahta kilitlenir; seçimden sonra tehlike yeri değiştirilmez.
- Otomatik seçim, turbo ve tur geçmişi isteğe bağlıdır.
- Bir bonus özelliği kullanılacaksa ayrı matematik ve ayrı sözleşme adı taşır.

Alınmayacaklar:

- Başka sağlayıcının adı, ikonları, arayüzü veya karakteri kopyalanmayacak.
- İlk tıklamayı sonradan zorla güvenli yapan ya da oyuncunun seçimine göre tahtayı
  yeniden üreten bir yapı olmayacak.
- Geçmiş kare ısı haritası geleceği tahmin ediyormuş gibi sunulmayacak.
- Her güvenli karede büyük modal açıp karar akışı kesilmeyecek.

## 3. Önerilen oyun kimliği

### 3.1. İsim ve dünya

**OBSIDYEN DAMARI — Yeraltı Araştırma İstasyonu**

Bu oda mevcut oyunlardan bilinçli olarak ayrışıyor:

- Blackjack'in yeşil klasik masası değil.
- Ruletin kırmızı salonu değil.
- Neon Kasası'nın parlak cyberpunk ızgarası değil.
- Kaptan Mercan'ın Osmanlı deniz dünyası değil.
- Altın Rota'nın İstanbul gökyüzü değil.

Mekân, yerin altında bulunan çağdaş ve lüks bir mineral araştırma istasyonu.
Arka planda gerçekçi fakat stilize bazalt sütunlar, bakır borular, yavaş hareket
eden toz, uzakta kristal yansımaları ve derinlik göstergeleri bulunacak. Merkezdeki
tahta fiziksel bir taş/metal cihaz gibi hissedilecek.

### 3.2. Ayla — oyun karakteri

Rol: jeolog, patlatma uzmanı ve kazı lideri.

Karakter tonu:

- Sakin, kendinden emin, kuru mizahlı ve doğal Türkçe.
- Sonucu bildiğini ya da tehlikeyi gördüğünü iddia etmez.
- Her karede konuşmaz; kararın anlamlılaştığı eşiklerde konuşur.
- Seçilen tehlike sayısını, açılmış güvenli kareleri, güncel/sonraki ödeme oranını,
  son turları ve oyuncunun mesajını bilir.
- Aynı cümleyi yakın geçmişte tekrar etmeyen olay havuzu + yerel AI üretimi kullanır.

Örnek olay dili:

- 1 tehlike: “Sakin sözleşme. Burada sabır, cesaretten daha pahalı olabilir.”
- 10 tehlike ve ilk güvenli kare: “İlk mühür temiz. Bunu şans diye küçümseme ama
  bütün ocağı da fethettik sanma.”
- Çok riskli devam kararı: “Şu an aldığın şey ödeme değil, bir sonraki kareyi
  reddetme hakkı. Kullanıp kullanmamak sana kalmış.”
- Kayıp: Kare ve önceki potansiyel ödeme özel olarak anılır; genel “bu el bende”
  cümlesi dönmez.
- Cash-out: Brüt ödeme, güvenli kare sayısı ve risk seviyesi birlikte yorumlanır.

## 4. Ayrıntılı oyun modları

### 4.1. Mod A — Serbest Kazı

Temel akış:

1. Bahis miktarı girilir.
2. Tehlike sayısı 1–24 arasında seçilir. Hızlı seçimler: 1, 3, 5, 8, 12, 18, 24.
3. “Kazıyı başlat” ile bahis düşülür ve 25 karenin tamamı önceden belirlenir.
4. Güvenli kare kristal açar; çarpan ve brüt ödeme artar.
5. Oyuncu başka kare açar veya “Kazancı Al” der.
6. Tehlike açılırsa tur biter; kalan tehlikeler okunabilir sırayla gösterilir.
7. Tüm güvenli kareler açılırsa otomatik ödeme yapılır.

Görünen bilgiler:

- Mevcut tehlike/güvenli kare sayısı.
- Açılan güvenli kare sayısı.
- **Bir sonraki karenin güvenli olma ihtimali.**
- Güncel çarpan ve **şimdi alınacak brüt PR**.
- Bir sonraki güvenli seçimden sonraki çarpan/PR.
- Tur taahhüt özeti ve doğrulama düğmesi.

### 4.2. Mod B — Derin Hat

Alan 5 sütun × 12 derinlikten oluşur. Oyuncu her aktif sırada yalnız bir kare
seçer; güvenli seçim yapılınca matkap platformu bir sonraki seviyeye iner.

Sözleşmeler:

| Sözleşme | Her sıradaki tehlike | Tek adım güvenli olasılığı | Karakter |
| --- | ---: | ---: | --- |
| Temkinli | 1 / 5 | %80 | Daha sık küçük ilerleme |
| Keskin | 2 / 5 | %60 | Orta-yüksek volatilite |
| Uçurum | 3 / 5 | %40 | Seyrek fakat çok büyük ödeme |

Her derinlikte güncel ve bir sonraki ödeme rayın yanında büyük yazıyla görünür.
Tur sonunda mini harita bütün yolun ve tehlikelerin yerini gösterir. On ikinci
derinlik güvenli geçilirse otomatik ödeme yapılır.

Bu modun görsel avantajı, sadece kare açmak yerine istasyonun gerçekten aşağı
indiğini göstermesidir: arka duvar yukarı kayar, derinlik metreleri değişir,
ışık sıcaklığı koyulaşır ve müzik katmanları artar.

### 4.3. Mod C — Donanımlı Sefer (ikinci geliştirme dalgası)

Bu mod yalnız temel iki mod tamamlanıp milyonlarca simülasyonla doğrulandıktan
sonra açılacak. İki ayrı sözleşme düşünülüyor:

- **Tarayıcı:** Turda bir defa seçilen 2×2 bölgedeki toplam tehlike sayısını söyler;
  hangi karede olduğunu söylemez. Bilgi geldiği anda kalan koşullu olasılıklar ve
  ödeme planı yeniden hesaplanır.
- **Sarsıntı Zırhı:** İlk tehlike doğrudan turu bitirmek yerine zırhı kırar. Bunun
  bedeli ve daha düşük ödeme eğrisi oyun başında nettir. Zırh kırıldıktan sonra
  devam/cash-out kararı tekrar oyuncuya verilir.

Bu özellikler klasik modun içine gizli bonus olarak karıştırılmayacak. Aksi halde
oyuncu neden farklı ödeme aldığını anlayamaz ve RTP denetimi zorlaşır.

### 4.4. Müze ve görevler

Bu katman ana bakiyeyi ve tahta sonucunu değiştirmez:

- 3, 6, 10 ve 15 güvenli karelik başarı mühürleri.
- Farklı risklerde bulunan obsidyen eser koleksiyonu.
- “5 tehlikeyle 5 güvenli kare”, “Derin Hat'ta 8. seviyeye in” gibi şeffaf görevler.
- Koleksiyon tamamlandıkça tahta çerçevesi, kristal rengi ve Ayla'nın oda dekoru açılır.

Bu sayede oyun uzun vadede ilerleme hissi verir; ödeme motoruna açıklanamayan
şans eklenmez.

## 5. Matematik modeli

### 5.1. Serbest Kazı formülü

Toplam kare `N=25`, tehlike sayısı `M`, başarıyla açılan güvenli kare sayısı `k`
olsun.

```text
Hayatta kalma olasılığı = C(N-M, k) / C(N, k)
Brüt ödeme çarpanı      = RTP × C(N, k) / C(N-M, k)
```

Bu, piyasadaki denetlenebilir Mines ödeme matrislerinde kullanılan kombinasyon
modelidir. Ayrıntılı örnek ve hesaplayıcı:
[ProvablySmart Mines Payout Matrix](https://provablysmart.com/tools/mines-payout-matrix/).

%97 RTP önerisiyle örnek brüt çarpanlar:

| Tehlike | 1 güvenli | 2 güvenli | 3 güvenli | 5 güvenli |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 1,0104× | 1,0543× | 1,1023× | 1,2125× |
| 3 | 1,1023× | 1,2597× | 1,4487× | 1,9570× |
| 5 | 1,2125× | 1,5316× | 1,9570× | 3,3241× |
| 10 | 1,6167× | 2,7714× | 4,9033× | 17,1615× |
| 15 | 2,4250× | 6,4667× | 18,5917× | 204,5083× |

Önemli uygulama kararları:

- Hesaplama JS kayan noktasına bırakılmayacak; para küçük birimi tamsayı,
  kombinasyon/çarpan yüksek hassasiyetli decimal veya rasyonel hesaplanacak.
- Ekran çarpanı 2–4 basamak yuvarlansa da ledger gerçek hassas değerle ödenecek.
- Gösterilen ana kazanç **brüt ödeme** olacak. Net kâr ikincil ayrıntıda gösterilecek.
- Bahis için yapay 500/1.000 PR tavanı olmayacak. Hızlı tutarlar ortak Pehlevan
  standardına göre 25'ten 500K'ya ve MAX'a kadar çıkacak.
- Bir kasa maruziyet sınırı konursa oyuncu bahsi yatırmadan önce görünen azami bahis
  değişecek; tur başladıktan sonra ödeme kırpılmayacak.

### 5.2. Derin Hat formülü

Her sırada `c` sütun ve `h` tehlike varsa tek adım güvenli olasılığı
`p=(c-h)/c` olur. `r` güvenli kademe sonrası çarpan:

```text
Brüt çarpan = RTP / p^r
```

RTP her adımda tekrar tekrar kesilmeyecek; bütün rota için bir defa uygulanacak.
Bu, uzun rota seçen oyuncuyu gizli biçimde ek kasa avantajıyla cezalandırmaz.

### 5.3. Adil ve tekrar üretilebilir tahta

Önerilen protokol:

1. Yerel Node servisi `serverSeed` üretir ve tur başlamadan yalnız SHA-256
   taahhüdünü istemciye gönderir.
2. `clientSeed + nonce + serverSeed`, HMAC-SHA256 girdisi olur.
3. HMAC akışından Fisher–Yates karıştırmasıyla 0–24 kare sırası üretilir.
4. İlk `M` indeks tehlikedir. Tahta ilk seçimden önce sabittir.
5. Tur bitince server seed açıklanır; oyuncu aynı tahtayı doğrulama ekranında
   yeniden üretebilir.

[Stake'in provably fair açıklaması](https://stake.com/provably-fair/overview) da
sunucu katkısının önceden hash ile kilitlenmesi ve oyuncu katkısıyla sonuç
üretme yaklaşımını açıklar. Uygulamada algoritma sürümü de kaydedilecek; sonradan
kod değişse bile eski turun doğrulaması bozulmayacak.

## 6. Arayüz ve responsive düzen

### 6.1. Geniş masaüstü

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Geri     OBSİDYEN DAMARI        Ses/Müzik              Bakiye        │
├───────────────┬────────────────────────────────┬─────────────────────┤
│ AYLA          │                                │ RİSK / ÖDEME RAYI   │
│ Portre        │          5 × 5 TAHTA           │ Sonraki güvenli %   │
│ Kısa yorum    │                                │ Şimdi al / Sonraki │
│ Sohbet        │                                │ Tur günlüğü         │
├───────────────┴────────────────────────────────┴─────────────────────┤
│ Bahis · Tehlike · Hızlı tutarlar     KAZIYI BAŞLAT / KAZANCI AL      │
└──────────────────────────────────────────────────────────────────────┘
```

- Tahta ekranın görsel merkezi; yan raylar tahtayı küçültmeyecek.
- Cash-out kontrolü sabit alt rayda kalacak, kart/modal tarafından örtülmeyecek.
- Sonuç penceresi ekranın gerçek merkezinde olacak, görünür `×` ile her zaman
  kapanabilecek.
- Arayüz gövde yazısı 13–16 px; mikro teknik bilgi dışında 12 px altına inmeyecek.

### 6.2. Kullanıcının uzun yarım ekranı

`837×1418` ve benzer görünümde:

1. Üstte kompakt Ayla banner'ı.
2. Altında tam genişlikte, kare oranını koruyan tahta.
3. Sonraki güvenli ihtimali + güncel/sonraki ödeme tek satırlı güçlü HUD.
4. Sabit fakat içerik kapatmayan bahis/cash-out rayı.
5. Sohbet ve ayrıntılı tur geçmişi aşağıda açılır paneller.

Tahta `min()` ve `clamp()` ile hem genişliğe hem kullanılabilir yüksekliğe göre
ölçeklenecek. Sadece `vw` ile büyütülmeyecek; alt yarıda anlamsız boşluk da
bırakılmayacak.

### 6.3. Etkileşim ayrıntıları

- Açılmamış kareler 44 px altına düşmez; geniş ekranda 96–128 px olabilir.
- Kare üstüne gelince yalnız fiziksel baskı/ışık tepkisi olur; yanlış “bu daha
  güvenli” sinyali verilmez.
- Sağ tık/uzun basma ile işaret koyma seçeneği yalnız kişisel nottur, sonucu etkilemez.
- Klavye: oklarla gezinme, Enter ile açma, `C` ile cash-out; görünür odak halkası.
- `prefers-reduced-motion` için patlama ve kamera sarsıntısı azaltılır.

## 7. Animasyon tasarımı

### 7.1. Tur başlangıcı

- Tahta mekanizması 25 mührü dıştan merkeze doğru kapatır.
- Üst rayda tehlike sayısı kilitlenir ve seed taahhüdü kısa bir mühür animasyonu alır.
- Ayla'nın eli/pointer'ı ilk turda kontrolü gösterir; sonraki turlarda tekrarlanmaz.

### 7.2. Güvenli kare

Normal hızda toplam 550–750 ms:

1. Kare 80 ms aşağı çöker.
2. Taş yüzey çatlar, toz parçacıkları çıkar.
3. Mühür 3B dönüşle açılır; var olan diğer kareler yeniden çizilmez.
4. Kristal kendi hücresinden yükselir ve ödeme rayına ince bir ışık izi gönderir.
5. Güncel ödeme sayacı eski değerden yeni değere akar.

Turbo 260–340 ms olacak; “anında DOM değişimi” gibi görünmeyecek.

### 7.3. Tehlike

- Kısa metalik basınç sesi, çatlakta kızıl ışık ve kontrollü ekran sarsıntısı.
- Patlama 700–900 ms; ardından kalan tehlikeler 70–100 ms aralıkla açılır.
- Açılan güvenli yol silinmez. Kaybedilen potansiyel brüt ödeme, son güvenli kare
  ve patlayan koordinat sonuç panelinde net görünür.

### 7.4. Cash-out

- Açılan kristaller tek tek kasaya ışık/partikül iziyle akar.
- Brüt ödeme büyük sayı olarak sayar; bahis ve net sonuç aşağıda ikincil satırdır.
- 2×, 5×, 20×, 100× eşiklerinde farklı ama kısa kazanım başlıkları kullanılır;
  her turda “sansasyonel” modal açılmaz.

### 7.5. Derin Hat

- Platform güvenli seçimden sonra fiziksel olarak bir kademe iner.
- Arka katman yukarı kayar; yeni sıra görünmeyen alandan gelir.
- Derinlik arttıkça müzikte vurmalı katman, kenar ışıklarında basınç ve duvar
  parçacıklarında hareket artar.
- Hiçbir adımda bütün grid silinip yeniden doğmuş gibi görünmez.

## 8. Ses ve müzik varlık planı

Onaydan önce hiçbir dosya indirilmeyecek. Onaydan sonra kaynak dosya, lisans metni,
indirme URL'si ve SHA-256 özeti `THIRD_PARTY_ASSETS.md` ile oyunun kendi
`AUDIO_LICENSES.md` dosyasına yazılacak.

### 8.1. Hazır, lisansı temiz adaylar

| Kullanım | Kaynak | Lisans | Plan |
| --- | --- | --- | --- |
| Buton, seçim, geçiş | [Kenney UI Audio](https://kenney.nl/assets/ui-audio) — 50 dosya | CC0 | Menü, hover, onay |
| Taş/metal darbe | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) — 130 dosya | CC0 | Kare basma, çatlama, patlama gövdesi |
| Metal mandal/para/foley | [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) — 50 dosya | CC0 | Mühür, kasa, donanım |
| Kristal ikon prototipi | [OpenGameArt Gems & Jewels](https://opengameart.org/content/gems-jewels) — 100 adet 128×128 | CC0 | Yedek/prototip; final stile uyarsa kullanılır |
| Mağara ambience | [Dark Cavern Ambient](https://opengameart.org/content/dark-cavern-ambient) | CC0 | Düşük seviyeli sürekli ortam katmanı |
| Müzik adayı | [Cave Explorer](https://opengameart.org/content/cave-explorer) | CC0 | Sakin ana loop; oyuna uygun mastering yapılır |
| Alternatif müzik | [Deep Humidity](https://opengameart.org/content/deep-humidity) | CC0 | Daha karanlık seçenek, adminden atanabilir |
| Taş/metal yüzey | [ambientCG Rock koleksiyonu](https://ambientcg.com/list?category=Rock) | CC0 | CSS/SVG üstüne düşük çözünürlüklü doku |

[ambientCG lisans sayfası](https://docs.ambientcg.com/license/) indirilebilir
varlıkların CC0 olduğunu ve ham dosyanın oyuna dahil edilebildiğini açıkça belirtiyor.

### 8.2. Özgün üretilecek görseller

Hazır ikonların sanat yönü birbirini tutmazsa ana oyun yüzü olarak kullanılmayacak.
Imagegen ile aynı sanat kılavuzunda şu set üretilecek:

1. Ayla tam/yarım boy şeffaf karakter portresi.
2. Geniş yeraltı istasyonu arka planı (lobby ve oda varyantları).
3. Kapalı obsidyen mühür; normal/hover/basılı/çatlak durumları.
4. En az altı kristal damar varyantı.
5. Patlayıcı cevher/tehlike ve zırh/tarayıcı ikonları.
6. Lobi kartı, sonuç rozeti ve müze eserleri.

3B dönüş, ışık izi, çatlak, toz ve patlama parçacıkları mümkün olduğunca
CSS/SVG/Canvas ile yapılacak. Böylece her hareket için ayrı ağır video/GIF
indirilmez, çözünürlük ve responsive kalite korunur.

### 8.3. Ses miksajı

- Müzik, efekt, ortam ve Ayla sesi dört ayrı kanal.
- Müzik tercihi yalnız `obsidyen-damari` oyun kimliğiyle saklanır; başka oyunu
  susturmaz ve yeni turda kendiliğinden açılmaz.
- Gerilim, açılan güvenli kare sayısına göre düşük frekanslı ritim katmanıyla artar.
- Tehlike sesi tek yüksek patlama olmayacak: ön basınç, darbe ve taş döküntüsü üç
  katman olarak çalacak.
- Sesler Web Audio ile preload edilir; ilk tıklamada gecikmeli dosya yüklenmez.

## 9. Veri tabanı ve analiz

Oyun farklı localhost adreslerinden de aynı yerel SQLite servisine yazılacak.
Tarayıcıya özgü IndexedDB, gerçek kaynak olmayacak; yalnız bağlantı kesilirse
geçici kuyruk olabilir.

### 9.1. Tur kaydı

Her turda asgari alanlar:

- `roundId`, `userId`, `game=obsidyen-damari`, mod/sözleşme, algoritma sürümü.
- Başlangıç/bitiş zamanı, bahis, brüt ödeme, net, önce/sonra bakiye.
- Alan boyutu, tehlike sayısı, hedef RTP, ödeme hassasiyeti.
- Tahta sırası veya sonuç sonrasında açıklanabilir mine indeksleri.
- `serverSeedHash`, açıklanan seed, client seed, nonce ve HMAC digest.
- Cash-out nedeni: manuel, otomatik hedef, tam temizlik, maruziyet sınırı, tehlike.
- Turbo, otomatik seçim, tarayıcı/zırh ve erişilebilirlik ayarları.

### 9.2. Her tıklama olayı

- Sıra numarası, kare indeksi, satır/sütun.
- Tıklamadan önce kalan kare/tehlike/güvenli sayısı.
- Önceki ve sonraki güvenli olasılığı.
- Önceki/sonraki çarpan ve brüt potansiyel ödeme.
- Sonuç: güvenli, tehlike, tarayıcı bilgisi, zırh kırılması.
- Giriş biçimi ve istemci animasyon modu.
- Olay zamanı ve tur başlangıcından geçen süre.

Bu ayrıntı sonradan “oyuncu genellikle kaçıncı karede çıkıyor?”, “hangi risk
sözleşmesi ne kadar oynanıyor?”, “gözlenen RTP hedefe yaklaşıyor mu?” ve
“animasyon temposu kararı anlaşılır kılıyor mu?” sorularını cevaplar.

### 9.3. AI kaydı

Kullanıcı mesajı, Ayla cevabı, kullanılan model/fallback, gecikme, tur bağlamı,
son olaylar ve tekrar filtresi sonucu `ai_conversations` içinde saklanır.

## 10. Admin paneli

`Oyunlar > Obsidyen Damarı` seçildiğinde tek bir geniş çalışma alanı açılacak:

### Oyun ve bahis

- Oyun açık/kapalı, bakım modu.
- Minimum bahis; maksimum bahis yerine bakiye ve açıkça görünen maruziyet limiti.
- Hızlı bahis değerleri: 25, 50, 100, 250, 500, 1K, 5K, 10K, 20K, 50K,
  100K, 250K, 500K ve MAX.

### Matematik

- Hedef RTP (önerilen %97).
- İzinli tehlike sayıları ve varsayılan tehlike.
- Çarpan gösterim/ödeme hassasiyeti.
- Derin Hat sözleşmeleri ve satır/sütun/tehlike ayarları.
- Donanım maliyetleri ve özellik anahtarları.
- Değişiklik önizlemesi: seçili ayarın örnek ödeme matrisi, teorik RTP ve volatilitesi.
- Ayar kaydetmeden zorunlu hızlı simülasyon; tolerans dışıysa uyarı.

### Sunum

- Normal/turbo animasyon süreleri.
- Kamera sarsıntısı ve parça yoğunluğu.
- Büyük kazanım eşikleri ve başlıkları.
- Ayla konuşma sıklığı, sessiz olaylar ve persona sürümü.

### Ses ve müzik

- Hazır katalog, URL ve yerel dosya yükleme.
- Müzik/ambience/SFX/Ayla varsayılan seviyeleri.
- Önizleme, varsayılana dönme ve oyun bazlı aç/kapa.

### Analiz

- Tur sayısı, toplam bahis/ödeme/net, gözlenen RTP.
- Tehlike sayısına ve moda göre hit/cash-out dağılımı.
- Ortalama güvenli seçim, medyan tur süresi, cash-out eşikleri.
- En büyük ödemeler ve doğrulanamayan/yarım kalan tur alarmı.
- Teorik ödeme matrisi ile gerçek sonuç karşılaştırması.

## 11. Teknik mimari

Önerilen dosya yerleşimi:

```text
src/games/mines/
  ObsidyenDamariRoom.tsx
  MinesWorldCard.tsx
  mines-engine.ts
  mines-fairness.ts
  mines-math.ts
  mines-types.ts
  mines-audio.ts
  mines.css
  mines-engine.test.ts
  mines-math.test.ts
  mines-fairness.test.ts

src/ai/ayla.ts
public/assets/instant/obsidyen-damari/
  AUDIO_LICENSES.md
  ASSET_PROMPTS.md
  SOURCE_AND_LICENSE.md
```

Motor React'tan bağımsız olacak. UI yalnız motor komutlarını (`startRound`,
`revealTile`, `cashOut`, `scanArea`) çağırıp değişmez snapshot çizecek. Cüzdan
bahis ve ödeme hareketleri SQLite transaction içinde atomik yazılacak; çift
tıklama/double-submit ikinci ödeme üretemeyecek.

## 12. Test ve kabul ölçütleri

### Matematik

- 1–24 tehlike ve bütün mümkün güvenli seçim sayılarında kombinasyon testi.
- Her cash-out noktasında teorik EV'nin hedef RTP'ye tolerans içinde eşitliği.
- En az 10 milyon sabit-seed simülasyonu; risk/mod bazında gözlenen RTP ve dağılım.
- Derin Hat üç sözleşmesinin ayrı simülasyonu.
- Donanımlı modlar açılmadan exhaustive/dinamik programlama kontrolü.

### Adillik ve veri

- Aynı seed/client seed/nonce aynı tahtayı üretir.
- Tek karakter farkı farklı tahta üretir.
- Tıklamadan sonra tahta değişmez.
- Her ledger stake kaydı en fazla bir settlement ile eşleşir.
- Yarım kalan tur yeniden açıldığında doğru durumda devam eder veya açık kuralına
  göre otomatik cash-out olur.

### Görsel

- Zorunlu ekranlar: 1978×1871, 1440×900, 980×1400 ve 837×1418.
- Kare, HUD, cash-out, sonuç modalı ve Ayla hiçbir ölçüde üst üste binmez.
- Normal animasyonda seçim sonucu takip edilebilir; turbo hâlâ hareket gösterir.
- Sonuç paneli ortalanır ve her zaman kapatılabilir.
- Bütün Türkçe metinler okunur; yatay taşma yoktur.

### Ses

- Yeni tur başlayınca susturulmuş müzik kendiliğinden açılmaz.
- Obsidyen Damarı'nı susturmak diğer oyunları etkilemez.
- Müzik, ambience, SFX ve konuşma ayrı ayrı kontrol edilir.
- İlk güvenli kare, tehlike ve cash-out sesleri görsel olayla senkron çalışır.

## 13. Uygulama sırası

1. **Varlık kilidi:** Ayla/görsel yön için tek bir mockup, CC0 ses denemeleri ve
   lisans dosyaları. Kullanıcı ana görünümü onaylamadan bütün set üretilmez.
2. **Matematik çekirdeği:** Serbest Kazı + Derin Hat, fairness ve birim testleri.
3. **SQLite:** tur, tıklama, fairness, ledger ve AI kayıtları.
4. **Ana arayüz:** responsive tahta, bahis/risk/cash-out rayları ve sonuç ekranı.
5. **Fiziksel sunum:** mühür açma, kristal, patlama, toplama ve Derin Hat kayması.
6. **Ses dünyası:** CC0 paketlerin seçimi, mastering, kanal kontrolleri ve admin.
7. **Ayla:** persona, olay bağlamı, doğal Türkçe, yerel ses ve DB kaydı.
8. **Admin ve analiz:** ödeme matrisi, simülasyon, mod/asset/AI ayarları.
9. **Görsel kabul:** dört ekran ölçüsü, reduced motion, performans ve son düzeltme.
10. **İkinci dalga:** Tarayıcı + Zırh matematiği ve Müze koleksiyonu.

## 14. Onay için önerilen karar paketi

Uygulamaya başlanması için önerdiğim varsayılan paket:

- Ad: **Obsidyen Damarı**
- Karakter: **Ayla**, jeolog/patlatma uzmanı
- İlk sürüm modları: **Serbest Kazı + Derin Hat**
- Alanlar: 5×5 ve 5×12
- Varsayılan RTP: **%97**
- Görsel: obsidyen/bakır/mineral, özgün AI ana varlıklar + CC0 doku/SFX
- Müzik: CC0 Cave Explorer veya Deep Humidity, uygulama sırasında A/B dinleme
- İkinci dalga: Tarayıcı, Sarsıntı Zırhı ve Müze
- Kategori: Anlık Oyunlar içinde Altın Rota'nın yanında ayrı kart

Bu paket onaylanırsa önce tek ekranlık yüksek kaliteli sanat denemesi ve matematik
çekirdeği yapılacak; kullanıcı görsel yönü görmeden onlarca uyumsuz varlık
üretilmeyecek veya indirilmeyecek.
