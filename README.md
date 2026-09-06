# Pehlevan Royale

Muharrem Pehlevan'a özel, sanal jetonlu AI casino uygulaması.

## Çalıştırma

```powershell
npm install
npm run dev
```

Tarayıcıda Vite'ın gösterdiği yerel adresi açın.

## Oyun veritabanı ve canlı rulet

Lobideki **Veri Kasası** bütün tamamlanan blackjack, rulet ve slot turlarını
`%LOCALAPPDATA%\PehlevanRoyale\pehlevan-royale.sqlite` içindeki ortak SQLite
veritabanında tutar. Veritabanı OneDrive dışında kaldığı için WAL yazımları dosya
senkronizasyonuna takılmaz. Vite'ın
hangi yerel porttan açıldığı veya hangi tarayıcının kullanıldığı önemli değildir;
bütün geliştirme sunucuları aynı dosyaya yazar. IndexedDB çevrimdışı yedek olarak
kalır ve tarayıcıdaki eski kayıtlar ilk bağlantıda kimlik bazında SQLite'a taşınır.

Admin paneli harcama, brüt geri dönüş, net sonuç, oyun bazlı gözlenen RTP ve son
sonuçları gösterir; tam araştırma verisi JSON, tur tablosu CSV olarak indirilebilir.
SQLite servisi `npm run dev` ile Vite'ın içinde otomatik başlar; ayrı bir komut gerekmez.

Rulet uygulama açık olduğu sürece odadan bağımsız ortak bir saatle 30 saniyede bir
döner. Odaya girildiğinde mevcut tura katılınır. Çarpanlar ve bahis konmayan canlı
masa sonuçları da kaydedilir; kapanmış oyuncu bahsi oda değişse bile sonuçlandırılır.

## Yerel AI (opsiyonel)

Ollama kuruluyken `.env.example` dosyasını `.env` olarak kopyalayın ve model
adını cihazınıza göre değiştirin. Örnek:

```powershell
ollama pull gemma3:4b
ollama create vera-pehlevan -f ai/Modelfile.vera
```

İlk konuşma model belleğe yüklenirken yaklaşık bir dakika, sonraki yanıtlar bu bilgisayarda genellikle 10–20 saniye sürebilir.

`.env` yoksa Vera'nın sohbeti yerel, bağlama duyarlı bir yedek kişilikle
çalışır. Oyun sonuçları her zaman uygulamanın blackjack motorundan gelir.

## Türkçe kadın sesi

Vera'nın ana sesi `tr-TR-EmelNeural`dır. Bir kez kurmak ve ses köprüsünü
başlatmak için:

```powershell
py -3.12 -m venv .venv-voice
.\.venv-voice\Scripts\python.exe -m pip install edge-tts
npm run voice
```

Ses köprüsü `127.0.0.1:8765` adresinde çalışır. Emel sesi çevrimiçi Microsoft
Edge TTS hizmetini kullanır; internet yoksa uygulama işletim sistemindeki
tarayıcı sesine geri döner.

## Belgeler

- `CASINO_PROJE_KAIDE_TASI.md`: ürün, teknoloji ve geliştirme yol haritası.
- `THIRD_PARTY_ASSETS.md`: indirilen assetlerin kaynak ve lisans kayıtları.

## GitHub ve canlı sunucu dağıtımı

Windows'ta `CANLIYA-AL.cmd` dosyasına çift tıklamak şu işlemleri tek seferde yapar:

1. Testleri ve üretim derlemesini çalıştırır.
2. Yerel değişiklikleri commit edip `main` dalını GitHub'a gönderir.
3. Sunucunun Git deposunu günceller, yeni sürümü derler ve systemd servisini yeniden başlatır.
4. HTTPS adresinin sağlık kontrolünü yapar.

Canlı adres: `https://royale.141-98-51-125.sslip.io`

Canlı SQLite verisi kod deposunun dışında `/var/lib/pehlevan-royale` dizininde tutulur.
Dağıtım sırasında başarısız bir sağlık kontrolü olursa önceki çalışan `dist` sürümüne otomatik dönülür.
Parolalar hiçbir dağıtım dosyasına yazılmaz; Windows'un mevcut SSH anahtarı ve Git Credential Manager kullanılır.
