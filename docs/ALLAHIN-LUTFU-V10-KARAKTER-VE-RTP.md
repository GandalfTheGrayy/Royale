# Allah'ın Lütfu v12 — Karakter, Trickster Eye temposu ve RTP

## Hedef

Tek tek Mystery sonuçları üretmek yerine, her gerçek tur başlamadan önce sabit ve denetlenebilir bir "tur karakteri" seçilir. Böylece animasyon yoğunluğu ile ödeme yoğunluğu birbirinden ayrılır; özellikli bir tur heyecanlı görünebilir ama her seferinde büyük ödeme yapmak zorunda kalmaz.

Referans oyunun yayımlanan omurgası korunmuştur: 5×6 alan, 28 ödeme çizgisi, %96,70 RTP, 500.000× tavan; Eye, coin, collector, board multiplier, global multiplier ve dört bonus seviyesi. Kaynak: [Stake — Odin's Vault](https://stake.com/casino/games/valkyrie-odins-vault).

## Uygulanan tur karakterleri

| Karakter | Oyuncuda oluşturduğu beklenti | Kontrollü sonuç yapısı |
| --- | --- | --- |
| `quiet` | Nefes alan normal tur | Eye yok, düşük olağan ödeme |
| `line` | Küçük fakat okunaklı kazanım | İlk üç makarada çizgi kurulumu |
| `eye-spark` | Kısa özellik dokunuşu | Coin ağırlığı, seyrek board multiplier |
| `coin-rain` | Çok coin/kese, sınırlı değer | Collector yok; yoğunluk ayrı, ödeme ölçeği düşük |
| `collector-parade` | Kese zinciri beklentisi | İlk açılışlarda en az iki Collector |
| `multiplier-pressure` | Çarpan gerilimi | Birden fazla board multiplier, coin tabanı |
| `global-tension` | Tüm turun büyüme ihtimali | Global key ile coin/multiplier bağlantısı |
| `climb` | Basamaklı yükseliş | Upgrader → redrop → collector sırası |
| `synergy` | Birkaç sistemin birleşmesi | Upgrader, multiplier, collector ve global key |
| `dream` | Çok nadir büyük hikâye | En yoğun zincir; ayrı tavan ve çok düşük frekans |

Normal oyunda `quiet + line` yaklaşık %65'tir; yaklaşık %35 tur gerçek bir özellik akışına sahiptir. Trickster'da `quiet + line` %42'ye iner ve turların yaklaşık %58'i Eye taşır. Eye turlarının çoğunda 1 Eye, `synergy` sahnesinde 2 Eye; çok nadir `dream` sahnesinde 3 Eye görülür. Böylece Hilebaz Dönüş normal oyundan belirgin biçimde daha hareketli olur fakat her hücreyi Eye ile dolduran tekdüze bir akışa dönüşmez. Göz sıklığı ile ödeme bütçesi birbirinden ayrıdır; her modun toplam uzun dönem dönüşü kendi maliyetine göre ayrıca ölçeklenir.

## Tekdüzeliği gideren kurallar

- Coin yağmuru ile Collector zinciri artık aynı bağımsız zarların tesadüfi birleşimi değildir; ayrı karakterlerdir.
- `collector-parade`, oyuncuya açılış sırasında gerçekten en az iki kese gösterir.
- `line`, yoğun efekt gerektirmeden küçük ve anlaşılır bir kazanım verir.
- Hedef coin yoksa board multiplier uzun bekleme, uyanma ve dalga animasyonu oynatmaz; kısa bir "dormant" açıklamasıyla geçer.
- Eye, ayarlarda zaten bulunan minimum/maksimum hedef adetlerini kullanır ve görünür semboller arasından bu aralığa en yakın olanı seçer.
- Coin, Collector, çarpan uygulaması ve coin uçuşları para birimiyle değil ham çarpanla gösterilir. Coin yüzleri yalnız resmî sabit merdivenden gelir: `1×, 2×, 3×, 4× ... 750× ... 50.000×`.
- Bonus satın alma profili seviye yükselince değişmez; satın alınan 200× veya 1.000× profil bütün oturum boyunca korunur.
- Doğrudan 500.000× Max Coin genel sahne tavanını aşabilir; diğer sonuçlar tur karakterinin maliyet tabanlı tavanına uyar.

## Sabit örneklem doğrulaması

| Mod | Örneklem | Gözlenen RTP |
| --- | ---: | ---: |
| Base | 20.000 tur | %96,69 |
| Enhancer (3×) | 20.000 tur | %96,72 |
| Degen (25×) | 20.000 tur | %96,74 |
| Trickster (75×) | 60.000 tur | %96,70; %58,26 Eye'lı tur; 0,667 Eye/tur |
| Fate (5.000×) | 30.000 tur | %97,12 |
| Free Bonus Buy (200×) | 3.000 oturum / 30.000 tur | %96,57 |
| Super Bonus Buy (1.000×) | 3.000 oturum / 30.000 tur | %96,95 |

Bu değerler sabit seed'li regresyon örneklemleridir. Yüksek volatilite nedeniyle kısa canlı oturumların RTP'si doğal olarak çok daha geniş sapar; hedef uzun dönem matematiğidir.

## Denetim

Karakter raporu:

```powershell
npx vite-node scripts/allahin-lutfu-character-report.ts 20000 paid
```

Bonus oturum raporu:

```powershell
npx vite-node scripts/allahin-lutfu-simulation.mjs 30000 bonus
```

Her sonuç telemetriye `scene` ve `rngModel: character-scenes-v12-trickster-eye-uplift` alanlarıyla yazılır. Bu sayede RTP sapması yalnız toplamda değil, hangi karakterin katkı yaptığına göre de incelenebilir.
