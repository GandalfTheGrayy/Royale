# Deneysel oyun araştırması

Owner laboratuvarındaki araştırma, `simulation-optimizer.ts` içindeki gerçek motor
deneylerine dayanır. Ayar kataloğu yalnız hangi sayısal girdinin hangi mekanizmaya
bağlı olduğunu tanımlar; katalog bir ayarın fazla olduğunu veya önerilen değerini
belirlemez.

## Akış

1. Raporun oyun profili ve hedefleri sabitlenir.
2. Üç ayrı tohum grubunda referans ölçülür.
3. Her uygun ayarın %10, %35, %70 ve %150 değerleri ayrı çalıştırılır. Böylece
   küçük değişimde gürültüye karışan bir mekanizma güçlü müdahaleyle de sınanır.
4. Ölçülen en iyi tekil adayın çevresi daraltılır. Farklı ayarlar iyileştirdiyse
   iki ve üç ayarlı birleşimler de ölçülür; birleşik etki ile tekil etkiler
   toplamı raporlanır. Sıralama, hedef hatasının yanında güven aralığı genişliğini
   de cezalandırır; yüksek oynaklıktaki tesadüfi sonuçlar daha geride kalır.
   En iyi geçici profilden en fazla üç ek koordinat arama adımıyla devam edilir;
   ilerleme yoksa durulur. Bu adımlar canlı kayıt yapmaz.
5. Aramada öne çıkan altı farklı profil, aramada kullanılmayan altı tohum
   grubunda sırayla doğrulanır. Umut verici fakat belirsiz profil otomatik olarak
   on tohuma ve en az 5.000 tur/tohum seviyesine büyütülür. Tohum grubu başına
   eşleştirilmiş RTP farkı ve mutlak hedef hatası iyileşmesinin yaklaşık Student-t
   aralıkları hesaplanır. Geçmeyen aday reçete alanına çıkarılmaz.
6. Ortak ayarlar diğer modlarda da karşılaştırılır. Hedefe uzaklaşma, ödeme
   sıklığı veya bonus sıklığı gerilemesi raporlanır.
7. Yalnız bağımsız doğrulamanın alt sınırı pozitif olan, kullanıcının ödeme ve
   bonus sıklığı sınırlarına uyan, eksik oturumu olmayan aday uygulanabilir.
   Profilin matematik alanları değiştiyse eski aday uygulanamaz.

Deneyler Web Worker içinde çalışır. Durdurma worker'ı sonlandırır; yarım sonuç
uygulanabilir reçete oluşturmaz. JSON dışa aktarımı istek, profil anlık görüntüsü,
hedefler, deneyler, tohumlar ve doğrulama sonuçlarını içerir.

## Ortak ayar ve parçalı onay

Oyun Yönetimi ve laboratuvar aynı `casino-admin` deposunu ve seçili oyunu
kullanır. Ortak ayar tablosu canlı değeri, rapor başlangıcındaki değeri ve geçici
öneriyi ayrı gösterir. Araştırma hedefi bir deney talimatıdır; kayıtlı RTP hedefi
değildir. Yeniden araştırma her zaman güncel canlı profilin kopyasıyla başlar.
Sekme değişiminde laboratuvar raporu korunur.

Owner bir veya birkaç ayarı seçer. Seçili alt küme `validateSimulationSelection`
ile o andaki ortak profile karşı altı ayrı tohumda tekrar ölçülür; gerekiyorsa
diğer modlar da sınanır. Bu işlem de kayıt yapmaz. Yalnız açık son onay
`updateAdminGame` çağırır. Onayda doğrulamanın profil parmak izi tekrar kontrol
edilir. Seçilmemiş alanlar korunur, önceden uygulanan değerler atlanır,
araştırmadan sonra değişmiş alanların üzerine yazılmaz. Son kayıt grubunu geri
alma, güncel profil son uygulanan profille aynıysa mümkündür.

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
