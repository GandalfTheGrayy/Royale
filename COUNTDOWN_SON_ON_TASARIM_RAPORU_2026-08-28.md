# Countdown araştırması ve Pehlevan Royale “Son On” tasarımı

## Araştırma sonucu

“Countdown” adı tek bir casino standardını tanımlamıyor. İncelenen güncel ve tarihsel örnekler üç ayrı aileye ayrılıyor:

- Atlantic Lottery `Cash Countdown`: 5×4 cascade, tur sonunda toplanan çarpanlar, üç sembolle 10 free go ve üç dilimli bonus çarkı.
- Naga Games `Countdown to Fortune`: üç haklı respin, yeni özel sembolde sayacın yeniden üçe dönmesi ve takım bazlı mini özellikler.
- NYX `The Final Countdown`: 6 makara/4096 yol, 10’dan geriye inen scatter sayacı, retrigger ile büyüyen wild çarpanı.
- Crash/limbo ailesi: zaman penceresi, hedef veya anlık cashout; kullanıcı kararının tur sonucuyla yarışması.
- Eski `COUNTDOWN` arcade düzeni: 9’dan 1’e eşleştirme; 4’te küçük ödülü bankaya alma veya 3→1 için riske devam etme.

Bu nedenle Pehlevan Royale sürümü mevcut bir slotu veya Aviator’ı tekrar etmiyor. Cascade, respin ve game-show örneklerinden alınan “geri sayım, büyüyen değer, kontrol noktası ve seçim” ilkeleri özgün bir kasa karar oyununda birleşiyor.

## Son On kural seti

- Tur 10’dan başlar ve hedef 0’a ulaşmaktır.
- Her adımda oyuncuya risk profiline göre 3, 4 veya 5 mühürlü kasa gözü gösterilir.
- Temkinli: 3 göz / 1 alarm / %66,67 güvenli.
- Keskin: 4 göz / 2 alarm / %50 güvenli.
- Son Saniye: 5 göz / 3 alarm / %40 güvenli.
- Güvenli göz çarpanı büyütür ve sayacı bir azaltır. Alarm turu sıfır ödeme ile kapatır.
- En az bir güvenli seçimden sonra oyuncu istediği an brüt ödemeyi kasaya alabilir.
- Her kararın süresi vardır. Süre 10’dan 1’e kademeli olarak kısalır.
- Süre sonu davranışı oyuncu tarafından önceden seçilir: mümkünse otomatik kasaya al veya rastgele göz seç.
- Otomatik hedef, belirlenen güvenli kapıya ulaşıldığında ödemeyi alır.
- Turbo yalnızca kapağın açılma süresini değiştirir; olasılık ve ödeme değişmez.

## Matematik ve adillik

Her profilde tek-adım güvenli kalma olasılığı açıktır. `n` güvenli adımdaki çarpan:

`çarpan = hedef RTP / (tek-adım güvenli olasılığı ^ n)`

RTP yüzde değeri formülde ondalık kullanılır. Azami ödeme admin tavanıyla sınırlanır. Alarm dizisi, tur başında server seed + client seed + nonce ile HMAC-SHA256 üzerinden üretilir. Oyuncuya seçimden önce server seed’in SHA-256 commitment değeri verilir; tur sonunda seed açılır ve aynı dizilim yeniden üretilebilir.

## Sistem entegrasyonu

- Oyun kimliği: `son-on`
- Salon: Anlık Oyunlar
- Karakter: Nihal, Saat Muhafızı
- SQLite: stake, payout, tam tur, her kapak seçimi, süre sonu sebebi, seçim süresi, otomatik hedef, turbo, ses tercihleri ve bütün seed/commitment alanları ayrı kaydedilir.
- Admin: RTP, minimum/varsayılan bahis, aşama sayısı, ilk/son karar süresi, normal/turbo kapak süresi ve azami ödeme değiştirilebilir.
- Ses: müzik, efekt ve Nihal’in Türkçe sesi birbirinden bağımsızdır; AI sesi varsayılan kapalıdır.
- Mobil: 390×844’te yatay taşma yoktur; sayaç, karar gözleri, zaman şeridi ve kritik eylem aynı viewport’ta kalır.

## Kaynaklar

- https://www.alc.ca/content/alc/en/play-online/instant-win-games/cash-countdown.html
- https://nagagames.com/games/countdown-to-fortune/
- https://help.danskespil.dk/en/casino-help/slots/nyxthefinalcountdown
- https://stake.com/casino/games/crash
- https://stake.com/casino/games/limbo
- https://www.pacodeandbulletin.gov/Display/pacode?d=reduce&file=%2Fsecure%2Fpacode%2Fdata%2F058%2Fchapter690%2Fs690.8.html
- https://www.teamplayinc.com/wp-content/uploads/2018/01/match_it_manual.pdf
