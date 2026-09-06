# Baykuş Madeni — araştırma ve uygulama kaydı

Bu belge, MineDrop 2'nin halka açık oynanış bilgileri ve video gözlemleri temel alınarak Pehlevan Royale için oluşturulan özgün uyarlamanın karar kaydıdır. Oyun yalnız sanal PR jetonuyla çalışır.

## Doğrulanan temel akış

- Üstte 5×3 sembol paneli, altta beş sütun ve altı mantıksal derinlikten oluşan kırılabilir duvar, en altta sütun başına bir sandık bulunur. Duvarın üst yüzeyi 0–2 boş sıra ile basamaklı başlar; bütün sütunların tam dolu görünmesi gerekmez.
- Bir sütun tamamen temizlendiğinde sandık değeri o turun kırılan bloklardan oluşan toplam kazancını çarpar; aynı turda açılan birden fazla sandık çarpanları sırayla uygular.
- Kazmalar panelden aşağı düşer; yalnız kendi sütunundaki ilk sağlam bloğa her salınımda tam bir hasar verir. Her darbeden sonra yukarı seker ve dayanıklılığı kaldıysa aynı dikey hatta yeniden düşer.
- Bronz, Demir, Altın, Elmas ve Obsidyen kazmalar sırasıyla 1, 2, 3, 5 ve 7 salınım yapar.
- TNT bütün kazmalardan sonra çalışır, 3×3 alanı etkiler ve iki hasar verir.
- Patlayıcı cevher kırılınca komşu bloklara zincir hasarı yollar.
- Blok can/ödeme tablosu: Toprak 1/0×, Taş 2/0,1×, Patlayıcı 2/0,5×, Kızıl 4/1×, Gizem 4/2,5–100×, Altın 5/3×, Elmas 6/5×, Obsidyen 7/25×.
- Bir sütunun altı bloğu kırılınca o sütunun sandığı açılır.
- Üç göz 4 dönüşlü Blok Bonusu, dört göz Süper Blok Bonusu, beş göz Epik Blok Bonusu açar. Bonus boyunca duvar kalıcıdır; gözler ek dönüş kazandırır.
- Geliştirme kitabı bütün kazmaları Elmas'a, maksimum kitap Obsidyen'e yükseltir.

## Satın alma ve özel modlar

| Mod | Maliyet | Davranış |
| --- | ---: | --- |
| Ekstra Şans | 3× | Göz ihtimali yükselir |
| Süper Şans | 6× | Tetiklenen bonus en az Süper olur |
| Elmas Dönüş | 250× | Üst iki sıra açık, kazmalar Elmas/Obsidyen |
| Obsidyen Dönüş | 1000× | Üst dört sıra açık, yalnız Obsidyen kazma |
| Blok Bonusu | 100× | Dört dönüş, kalıcı duvar |
| Süper Blok Bonusu | 300× | Bronz yok; Demir en düşük kazma |
| Gizemli Dönüş | 500× | Boş, Süper veya Epik mühür sonucu |

## Uygulanan Pehlevan Royale akışı

`drop → bounce → hit → crack → break/blast → chest → count-up`

Her hasar ayrı motor olayı ve ayrı animasyondur. Turbo sonuç sırasını değiştirmez, yalnız süreleri ölçekler. Satın alma; mağaza, tutar onayı, özellik giriş sahnesi, otomatik dönüşler ve sonuç özeti olarak ayrı ekranlara bölünmüştür.

Yönetici paneli; bütün maliyetleri, kazma salınımlarını, blok can/ödemelerini, her bağlamın sembol ve kazma ağırlıklarını, altı katmanın blok dağılımını, gizem/sandık sonuçlarını, hazır kazı derinliklerini, bağlam ödeme ölçeklerini ve dokuz animasyon süresini canlı değiştirir.

## Kaynaklar

- Stake oyun sayfası: https://stake.com/casino/games/paperclip-minedrop-2
- Ayrıntılı bağımsız oynanış rehberi: https://minecraftslot.site/minedrop-2/
- Stake İspanyolca oyun sayfası: https://stake.krd/es/casino/games/paperclip-minedrop-2
- Görsel akış incelemesi: https://www.youtube.com/watch?v=_hpdL-i-IrE
- Bonus menüsü ve MineDrop/MineDrop 2 karşılaştırması: https://www.youtube.com/watch?v=mNh-2PvrinA

Not: Yayıncıya ait gizli RNG/reel-strip verileri erişilebilir olmadığı için olasılık ağırlıkları kamuya açık mekaniklere göre özgün biçimde kurulmuş ve yönetici paneline açılmıştır. RTP alanı kalibrasyon hedefidir; doğrulanmış sertifikalı matematik iddiası değildir.
