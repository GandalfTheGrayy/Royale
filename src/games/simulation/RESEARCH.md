# Deneysel oyun araştırması

Owner laboratuvarındaki araştırma, `simulation-optimizer.ts` içindeki gerçek motor
deneylerine dayanır. Ayar kataloğu yalnız hangi sayısal girdinin hangi mekanizmaya
bağlı olduğunu tanımlar; katalog bir ayarın fazla olduğunu veya önerilen değerini
belirlemez.

## Akış

1. Raporun oyun profili ve hedefleri sabitlenir.
2. Üç ayrı tohum grubunda referans ölçülür.
3. Her uygun ayarın daha düşük ve daha yüksek değerleri ayrı çalıştırılır.
4. Ölçülen en iyi tekil adayın çevresi daraltılır. Farklı iki ayar iyileştirdiyse
   birlikte de ölçülür; birleşik etki ile tekil etkiler toplamı raporlanır.
5. Seçilen tek aday, aramada kullanılmayan altı tohum grubunda iki kat örnekle
   doğrulanır. Tohum grubu başına eşleştirilmiş RTP farkı ve mutlak hedef hatası
   iyileşmesinin yaklaşık Student-t aralıkları hesaplanır.
6. Ortak ayarlar diğer modlarda da karşılaştırılır. Hedefe uzaklaşma, ödeme
   sıklığı veya bonus sıklığı gerilemesi raporlanır.
7. Yalnız bağımsız doğrulamanın alt sınırı pozitif olan, kullanıcının ödeme ve
   bonus sıklığı sınırlarına uyan, eksik oturumu olmayan aday uygulanabilir.
   Profilin matematik alanları değiştiyse eski aday uygulanamaz.

Deneyler Web Worker içinde çalışır. Durdurma worker'ı sonlandırır; yarım sonuç
uygulanabilir reçete oluşturmaz. JSON dışa aktarımı istek, profil anlık görüntüsü,
hedefler, deneyler, tohumlar ve doğrulama sonuçlarını içerir.

## Tasarım sınırları

Kazanç tavanları, global çarpan tavanı, satın alım bedelleri ve jackpot ödül
ayarları arama kataloğuna alınmaz ve uygulama katmanında da korunur. Ödeme
ölçekleri varsayılan olarak kapalıdır; owner araştırma kapsamına ekleyebilir.
Tavanı korumak jackpotun gerçekleşme olasılığını sabit tutmak demek değildir.

## Oyun kapsamı

- Allah: makara göz/scatter, Mystery kaynaklı göz/collector/yeniden düşüş/
  yükseltici/çarpan/anahtar, Trickster ve bonus girişleri; isteğe bağlı ödeme ölçekleri.
- Baykuş: makara özellikleri, kazma türleri, gizemli satın alım kapısı ağırlıkları,
  bonus özellikleri; isteğe bağlı ödeme ölçekleri.
- Neon, Kaptan, Şekerhane: özellik/scatter sıklıkları, düşüş, kurtarma, akış
  ayarları ve isteğe bağlı ödeme ölçekleri. Etkisiz alanlar da deneyde görünür.
- Kiraz: canlı profilde değiştirilebilen ödeme ölçeği; ölçek araştırması kapalıysa
  düzenlenebilir uygun alan olmadığı açıkça gösterilir.
- Formül oyunları: motorun RTP girdisi ve oyuncunun risk/hedef/adım senaryoları.
  Senaryo değişiklikleri canlı profil önerisi olarak uygulanmaz.
- Blackjack, rulet, poker: sabit kurallarla oyuncu stratejisi/bahis karşılaştırması.
  Blackjack adaptörü split/double içermeyen eşik stratejileridir.

## Ölçüm doğruluğu

Çarpan, ödeme / ücretli maliyettir. Bonus dahil ana tur veya satın alım oturumu
tek gözlemdir. Klasik slot motorundan gerçek oturum bitişinde gözlem alınır;
fiziksel spin sayısı ayrıca tutulur. Allah'ta canlı ekran ve laboratuvar aynı
`prepareAllahSpinPersistent` sınırını kullanır. Bonus satın alımı ücretsiz
oturumla başlar; hayali ücretli tetik spin üretilmez. Mystery içinden üretilen
gözler ve özellik yolları ayrıca sayılır. Allah ödeme bileşenleri tavan sonrası
gerçek ödemeye göre ayrıştırılır.

Araştırma sonlu örnekli, kara kutu müdahale analizidir; bütün oyun matematiğinin
ispatı veya sertifikalı teorik RTP hesabı değildir. Aynı tohum kullanımı, farklı
özellik dallarında her rastgele çekilişin eşleşeceği anlamına gelmez. Aralıklar
spin farkından değil tohum gruplarının farkından hesaplanır. Uzun kuyruklarda
küçük örnek ve altı doğrulama grubu sınırlıdır; derinlik artırılabilir.
Şekerhane/Neon 500 spin ve Allah 100 bonus spin işlem korumasında tamamlanmayan
oturumlar işaretlenir ve bunlarla uygulama engellenir. Canlı kuralın kendi yasal
oturum tavanı ile yarım bırakılmış hesap ayrı sayaçlardır.

Baykuş'un koşullu epik oturumu doğrudan satılan ürün değildir; bu modda
uygulanabilir öneri üretilmez. Gerçek satın alım araştırması `mystery-buy`
modunda boş/süper/epik ağırlıklarını ve gerçek bedeli birlikte ölçer.
