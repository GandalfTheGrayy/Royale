# Plinko — teknik ve oyun tasarım raporu

## Konumlandırma

Plinko, slot değil; Mines, Altın Rota ve Son On ile birlikte **Anlık Oyunlar**
kategorisindedir. Tur çok kısadır fakat karar yüzeyi nettir: bahis, 8–16 sıra ve
düşük/orta/yüksek risk. Sıra arttıkça olası cepler ve dağılım genişler; risk profili
ise merkezin sıklığı ile uçlardaki azami çarpanı değiştirir.

## Seçilen teknoloji

Tahta React içinde yüksek DPI destekli Canvas 2D ile çizilir. Canvas her karede
`requestAnimationFrame` ile güncellenir ve cihaz piksel oranına göre ölçeklenir.
Bu seçim binlerce DOM elemanı üretmeden peg, ışık izi ve aynı anda birden çok topu
akıcı çizer; masaüstü ve mobil Safari için ayrıca bir oyun motoru kurulmasını gerektirmez.

Matter.js benzeri fizik motoru bilinçli olarak kullanılmamıştır. Fizik motorunun kare
hızı ve yuvarlama farklarının sonucu değiştirmesi yerine, sonuç HMAC-SHA256 ile önceden
kilitlenir; Canvas yalnızca bu doğrulanabilir sol/sağ yolunu doğal bir sekme hareketiyle
görselleştirir. Böylece matematik, animasyon ve cihaz performansı birbirinden ayrılır.

## Matematik ve doğrulanabilirlik

- Her yol eş olasılıklı sol/sağ kararlardan oluşur; cep olasılıkları binom dağılımıdır.
- Çarpan tabloları her sıra ve risk için hedef RTP'ye sayısal olarak normalize edilir.
- Admin RTP, sıra aralığı, azami ödeme, animasyon süresi ve eşzamanlı top sayısını yönetir.
- Server seed commitment turdan önce, açık seed ve digest turdan sonra gösterilir.
- Doğrulama ekranı aynı seed/nonce ile yolu ve cebi yeniden hesaplar.
- Bahis, brüt ödeme, net sonuç, cep, yön dizisi, tüm çarpan tablosu, risk, sıra,
  commitment/digest ve bakiye hareketleri SQLite'a ayrı kayıtlar hâlinde yazılır.

## Premium oynanış

- Tahtada aktif top izi, peg teması ve cep vurgusu bulunur.
- Aynı anda birden fazla top ve 5/10/25/50 otomatik bırakma desteklenir.
- Son 30 sonuç, oturum brüt ödemesi/neti ve cep ısı haritası görünürdür.
- 10× ve üzeri sonuçlar kısa bir büyük-kazanç sahnesiyle vurgulanır.
- Müzik ve mekanik efekt ayrı, oyun-başına kalıcı kanallardır.
- Serbest bahis alanı ve MAX vardır; hızlı kupürler hiçbir zaman bahis tavanı değildir.

## Görsel kimlik kararı

Baykuş ve altı köşeli yıldız kontrol ikonlarına veya her cebe yapıştırılmamıştır.
Baykuşlar yalnızca salon kolonlarının mimari başlıklarında, tek geometrik yıldız örgüsü
ise üst kemerin yapısında görünür. Oyun yüzeyinin kimliği esas olarak pirinç mekanizma,
zümrüt salon, ışık ve malzeme diliyle kurulur.

## Kaynaklar

- Stake Plinko ürün sayfası: 8–16 sıra, risk seçimi ve merkez/uç dağılımı davranışı.
  https://stake.com/casino/games/plinko
- MDN Canvas optimizasyonu: cihaz piksel oranı ve çizim performansı.
  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- MDN requestAnimationFrame: tarayıcı yenileme döngüsüyle senkron animasyon.
  https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame

