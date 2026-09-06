# Baykuş Madeni: bonus sandıkları ve kazanç dengesi

## Düzeltilen hesap

Blok, Süper ve Epik bonuslarda (Gizemli Dönüşten gelenler dahil) ham blok kazancı ve sandık çarpanı oturum boyunca birikir:

`bonus toplamı = min(oturum sınırı, biriken ham blok × bütün sandıkların çarpımı × ödeme ölçeği)`

Her dönüşte bakiye yalnız yeni yuvarlanmış toplam ile daha önce ödenen toplam arasındaki fark kadar artar. Örneğin 10×, 5×, ardından blok ödemesi olmayan 3× sandık ve son elde 2× blok + 2× sandık için ödemeler 10×, 5×, 30×, 57×; toplam 102× olur. Eski hesap yalnız sandığın açıldığı eldeki blokları çarpıyordu.

Doğal tetikleyici elin blok ödemesi ayrı kalır. Devralınan duvarın açık sandıkları bonus çarpanına taşınır; bu sandıklar yeniden açılmaz. Tetikleyici el ve devamındaki bonus toplamı 50.000× sınırını paylaşır. Satın alınan bonuslarda sınır bütün seansa uygulanır. Normal, Elmas ve Obsidyen ücretli dönüşlerinin hesabı tek dönüş kapsamındadır.

Ekrandaki bonus toplamı, sandık hesabı, fark ödemesi ve telemetri aynı birikim hesabını kullanır. Bonus başladığında bahis ve mod değişimi kilitlenir. Ödeme ölçekleri gösterime de uygulanır; sınıra takılan sonuç ayrıca belirtilir.

## Dağılım değişiklikleri

Blok ödülleri, sandık değerleri, kazma dayanıklılıkları ve mod fiyatları değiştirilmedi. Elmas ve özellikle Obsidyen için kazma sıklığı düşürüldü. Bonuslarda sık TNT ve bütün kazmaları yükselten kitaplar, kalıcı sandık çarpımıyla birlikte çok fazla ödeme üretiyordu; bu olaylar seyrekleştirildi ve kazma ağırlıkları yeniden ayarlandı. Normal/Ekstra/Süper Şans göz sıklıkları yeni bonus değerlerine göre dengelendi.

Profil: `baykus-madeni-v3-session-chests-balanced`. Kayıtlı v2 varsayılan sembol dağılımları yüklemede taşınır. Özelleştirilmiş dağılımlar, fiyatlar, animasyonlar ve diğer admin ayarları korunur. Özel ayarlar kullanılıyorsa aşağıdaki varsayılan profil ölçümleri o ayarlara uygulanamaz.

## Ölçüm

Önceki profil, eski tek-el bonus hesabıyla her modda 20.000 seans ve `20260906` tohumu kullanılarak ölçüldü. Obsidyen dönüşünde ortalama geri dönüş %1871,58, kârlı dönüş oranı %91,17 ve azami kazanç oranı %19,52 idi. Blok bonusu %1126,99, Süper bonus %692,95, Gizemli Dönüş %390,03 geri dönüş üretiyordu.

Yeni profilin her modda 500.000 seans ve bağımsız `987654321` tohumu ile kontrolü:

| Mod | Gözlenen geri dönüş | Yaklaşık %95 hata payı (yüzde puan) |
| --- | ---: | ---: |
| Elmas | %93,90 | ±1,89 |
| Obsidyen | %95,72 | ±1,13 |
| Blok bonusu satın alma | %94,50 | ±2,73 |
| Süper bonus satın alma | %97,08 | ±1,83 |
| Gizemli Dönüş | %99,53 | ±1,67 |

Obsidyen kârlı dönüş oranı %13,49; azami kazanç oranı %0,345. Epik bonus koşullu ortalama ödemesi 1240,42×; bağımsız satış fiyatı olmadığından buna ayrı bir satın alma RTP'si atfedilmez.

Bunlar sertifikalı teorik RTP değerleri değildir. Özellikle doğal bonusların seyrek büyük ödemeleri normal ve şans modlarında örneklem belirsizliğini artırır. 2.000.000 normal oyun, `4444444` tohumu ile %98,92 (yaklaşık ±9,08 puan) verdi.

Son göz ağırlıklarıyla (`extra: 3.1`, `super: 3.05`) mod başına 1.000.000 seans ve `5555555` tohumu: Ekstra Şans %100,71 (±12,25 puan), Süper Şans %91,26 (±8,92 puan). Bu geniş aralıklar, bu modlar için kesin %96,7 veya kesin kasa avantajı iddiasını desteklemez; önceki aşırı ödeme düzeltilmiş olmakla birlikte teorik RTP sertifikasyonu yapılmamıştır.

Tekrarlama (PowerShell):

```powershell
$env:MINE_SAMPLES='500000'
$env:MINE_SEED='987654321'
$env:MINE_MODES='diamond,obsidian,buy-block,buy-super,mystery,epic'
npm run math:baykus
```

`MINE_MODES` verilmezse bütün modlar ölçülür. Raporda ücretli oyundan doğal tetiklenen bonuslar da maliyete dahil edilir. Motor ve bonus mutabakatı uygulamayla aynıdır; rapor gerçek hesap bakiyesine veya oyun veritabanına yazmaz.

## Mine Drop 2 karşılaştırmasının sınırı

İnternet taraması yapıldı. [Mine Drop 2 incelemesi](https://demoplay.vip/en/reviews/mine-drop-2) ve [bağımsız oyun rehberi](https://minedrop2.vip/en) bulundu; bunlar geliştiricinin resmi kural dokümanı değildir. Stake oyun sayfaları bu oturumda erişilebilir olmadı ve resmi bonus çarpanı kapsamı bağımsız olarak doğrulanamadı. Bu değişiklik, kullanıcının açıkça istediği bütün-bonus çarpanı davranışını uygular; orijinal oyunun olasılık modelinin veya tüm kurallarının birebir kopyası olduğu iddia edilmez.

## Doğrulama

- Tam test paketi: 37 dosyada 224 test geçti. İlk eşzamanlı simülasyon koşusunda Neon Kasası testlerinden biri süre sınırına takıldı; tek başına ve sonraki tam koşuda geçti. Üretim derlemesi başarılı.
- Geç açılan sandık, sonraki el, boş el, birden çok sandık, üç bonus seviyesi, devralınan sandık, Gizem ödeme ölçeği ve ortak azami kazanç testleri.
- Eski profil göçü, özelleştirilmiş admin ayarlarının korunması ve Obsidyen aşırı ödeme regresyonu.
- 5174 üzerindeki ayrı test hesabında iki adet dört dönüşlü Süper bonus tamamlandı. Ekran sonuçları 103 PR ve 204 PR; bakiye artışları ve SQLite tur kayıtlarıyla aynı. Bu iki UI örneğinde sandık açılmadı; sandık senaryoları deterministik motor testleriyle doğrulandı.
