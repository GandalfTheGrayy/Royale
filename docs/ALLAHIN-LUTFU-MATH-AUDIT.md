# Allah’ın Lütfu — motor ve ödeme denetimi

Tarih: 3 Eylül 2026

## Canlı veritabanı bulgusu

Denetim, uygulamanın gerçekten kullandığı `%LOCALAPPDATA%\PehlevanRoyale\pehlevan-royale.sqlite` dosyasında son 48 saatteki `allahin-lutfu` turlarını salt okunur olarak inceledi.

- 206 tur, 155 ücretli tur
- Toplam bahis: 6.693.476.112.666.100 PR
- Toplam ödeme: 1.485.617.150.283.210.800 PR
- Gözlenen ödeme/bahis oranı: 221,95 (yaklaşık %22.195)
- 37 adet 500.000× sonuç
- 56 adet 10.000× üzeri sonuç
- 33 turda Collector toplamı 1 trilyon × sınırını aştı
- En büyük ham Collector toplamı yaklaşık 9,12 kentilyon ×

Bu sonuçlar örneklem hatasıyla açıklanamaz. Eski `weighted-feature-queue-v1` profilinde Mystery içinden yeni Collector üretme oranı, Collector’ın yanlışlıkla bütün tahtayı yeniden Mystery yapmasıyla süperkritik bir zincir oluşturuyordu. Collector ve Board Multiplier ara değerleri de yalnız final ödeme aşamasında sınırlandığı için telemetri ve cüzdan tutarları finalden önce üstel büyüyordu.

Denetim komutu:

```powershell
node scripts/allahin-lutfu-audit.mjs 48
```

## Uygulanan v5 motor profili

- Normal makara ile Mystery sonuç şeridi fiziksel olarak ayrıldı.
- Normal ilk düşüş/Redrop şeridi yalnız normal sembol, Göz ve Scatter üretebilir. Coin yalnız Eye/FU/Collector kaynaklı Mystery çözümünden doğar.
- Collector, Global Key, Board Multiplier, Coin Upgrader, Redrop ve Max Coin yalnız Mystery açılışından gelebilir; bu ayrım Hilebaz Dönüş için de geçerlidir.
- Eski sürümde Global Key görselini paylaşan normal `celestial-key` şerit ağırlığı sıfırlandı; kullanıcı normal turda özellik anahtarının kopyasını göremez.
- Mystery hiçbir zaman normal ödeme sembolüne açılamaz.
- Mystery’den açılan Göz, Board Multiplier, Coin Upgrader, Redrop ve Global Key görevini tamamladıktan sonra aynı hücre yeniden dönerek coin olur. Collector bütün bu dönüşümlerden sonra çalışır ve yeni coin’leri de toplayabilir.
- Base, 3×, 25×, 75×, FU ve dört bonus seviyesi ayrı yoğunluk profilleri kullanır.
- Collector’ın yeni Collector üretme oranı kendi kendini kontrolsüz çoğaltmayacak seviyeye indirildi; tahta yenileme kuralı korunmuştur.
- Collector artık coin ödemesinin ön koşulu değildir. Final tahtada kalan coin yüz değerleri `coinWinX`, geçmiş tahtalardan keseye taşınan değerler `collectorWinX` olarak ayrı hesaplanır; final formül `(lineWinX + coinWinX + collectorWinX) × globalMultiplier` olur.
- Bir Collector geçişinde yalnız aktif Mystery kökenli hücreler yeniden döner. Normal makara hücreleri korunur; keseye daha önce yazılmış Mystery coin kimlikleri final coin toplamından çıkarılarak çift sayım engellenir.
- Her coin/Collector çarpımı, her Collector birikimi ve final Collector toplamı 500.000× güvenlik sınırına tabi tutuldu.
- 2×–20× Board Multiplier ve Global Key değerleri küçük sonuçlara ağırlıklı dağılıma geçirildi.
- Mitik garantili Upgrader normal makaraya eklenmez; ilk gerçek Mystery açılışında uygulanır.
- Yeni turlar `weighted-feature-queue-v5-active-mystery-respin` olarak kaydedilir; eski bozuk turlar geçmiş kayıt olarak korunur.

## Uzun dönem simülasyonu

Sabit seed’li motor simülasyonu ödeme profillerini gerçek bahis maliyetine bölerek ölçer. Yüksek volatilite nedeniyle alt örneklemlerde oran dalgalanabilir; tekrar üretilebilir seed aralıkları kullanılır.

```powershell
node --experimental-strip-types scripts/allahin-lutfu-simulation.mjs 200000 paid
node --experimental-strip-types scripts/allahin-lutfu-simulation.mjs 100000 bonus
```

Coin ödeme düzeltmesinden sonra eski v2 olasılıklarıyla yapılan ilk 20.000 turluk kontrol normal modda yaklaşık %2.245 RTP üretti; dolayısıyla yalnız ödeme formülünü değiştirmenin ekonomiyi yeniden bozduğu doğrulandı. v5’te doğrudan Collector kaldırıldı, işlev→coin yaşam döngüsü eklendi ve Collector yeniden dönüşü yalnız aktif Mystery hücreleriyle sınırlandı.

Son sabit-seed doğrulaması:

- 100.000’er ücretli tur: Normal %96,70; 3× %98,43; 75× %97,73; FU %95,72. Daha değişken 25× profili 200.000 turda %98,37 ölçüldü.
- Free Bonus satın alımı 200.000 dönüşte %97,54; Super Bonus satın alımı 100.000 dönüşte %96,53 ölçüldü. Yüksek volatilite ve seyrek üst-kuyruk sonuçları nedeniyle kısa örneklemlerde birkaç puanlık oynama beklenir.

Kod doğrulaması 33 test dosyasında 184 test ve temiz üretim derlemesiyle tamamlandı. Deterministik regresyonlar kesesiz final coin ödemesini, doğrudan Collector yasağını, Mystery işlevinin görev sonrası coin’e dönüşmesini, Collector’ın dönüşen coin’i sonradan toplamasını, Collector sonrası yeni tahta + geçmiş kese değerinin bir kez sayılmasını, Global Multiplier formülünü ve Collector respin’iyle kapanan Max Coin hakkını kapsar.

Bu bir bağımsız kumar matematiği sertifikası değildir. Üretim ortamında yayınlanacak gerçek para oyunu için RNG, RTP ve her satın alma profilinin bağımsız laboratuvar sertifikasyonu gerekir.
