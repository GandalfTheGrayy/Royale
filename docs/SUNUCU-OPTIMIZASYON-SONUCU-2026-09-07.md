# Canlı optimizasyon sonucu — 7 Eylül 2026

Canlı ve GitHub main sürümü: `b981a4a`. Önceki sürüm: `f23cef1`. Oyunlar, AI, rekabet, kullanıcı yönetimi ve diğer uygulamaların özellikleri korunmuştur. Kullanıcıya ait iki slot dosyasındaki mevcut değişiklik dağıtıma dahil edilmemiştir.

## Uygulanan değişiklikler

- Rekabet yönetim telemetrisi tüm geçmişi sıralamak yerine oyun başına indeks üzerinden son 20 geçerli kaydı okuyor. Canlı veride aynı 352 sonuç: eski sorgu 4.160 saniye, yeni sorgu 0.00339 saniye. Bu ölçüm yalnız ilgili sorgunundur.
- Son kayıt, geçerli oyun kayıtları, en büyük ödeme ve en yüksek çarpan sorgularına dört indeks eklendi.
- Üyelik paneli başlangıç bakiyesini küçük, yetki kontrollü yapılandırma uç noktasından alıyor. Kullanıcı listesi diğer isteklerden bağımsız güncelleniyor.
- Başarılı onay sonrası liste yenileme hatası artık onay başarısızmış gibi gösterilmiyor. Aynı başvurunun tekrar onaylanarak bakiyesinin sıfırlanması engellendi.
- Hesap isteklerinde 20 saniye zaman aşımı var. Yazma isteği zaman aşımında otomatik tekrarlanmıyor; işlem gerçekleşmiş olabileceği belirtiliyor.
- Oturum ve yetki her istekte kontrol edilmeye devam ediyor. Son görülme bilgisi dakikada bir yazılıyor; sık sorgular iki gereksiz SQLite yazımı üretmiyor.
- Kullanıcı ve rekabet sekmelerinde üst panelin oyun geçmişi indirmesi duruyor. Rapor yenilemeleri üst üste binmiyor; gizli tarayıcı sekmesinde durup görünür olduğunda devam ediyor.
- Hafta hesaplarında tarih biçimlendiricileri tekrar kullanılıyor. Haftalık kayıt döngüsünde her kayıt için yapılandırma okunmuyor.
- Statik dosyalar Caddy tarafından doğrudan sunuluyor; Node veritabanı işi dosya iletimini bekletmiyor. WebP seçimi, PNG alternatifi, sürümlü dosya önbelleği ve eski JavaScript parçaları korunuyor. Yapılandırma yaklaşımı [Caddy file_server belgesine](https://caddyserver.com/docs/caddyfile/directives/file_server) göre doğrulandı.
- Royale systemd hizmetinde CPUWeight/IOWeight 500 ve MemoryLow 256M ayarlandı. Bu mutlak kaynak garantisi değildir.

## Sunucu düzenlemeleri

- Büyük eski syslog sıkıştırıldı. Logrotate aynı anda dosya adını değiştirdiği için ilk gzip komutu sonlandırmada dosya-adı uyarısı verdi; nihai `/var/log/syslog.2.gz` arşivinin `gzip -t` bütünlük kontrolü başarılıdır. Arşiv yaklaşık 553 MB.
- Rsyslog günlük döndürme, 100 MB boyut eşiği, 14 arşiv ve gecikmesiz sıkıştırma kullanıyor; boyut kontrolü saatlik. Journal için 1 GB sınır, 2 GB boş alan hedefi ve 14 gün saklama ayarlandı. Bu politika eski journal kayıtlarını yaş/boyut sınırında temizler.
- Disk yaklaşık %95 doluluktan %59–60'a indi; boş alan yaklaşık 2.2 GB'tan 16 GB'a çıktı.
- `/tmp/.perf.c/` altından çalışan iki sürecin nice değeri 19 yapıldı; süreçler durdurulmadı. Bu yalnız mevcut süreç ömrü boyunca önceliği düşürür; yeniden doğan süreçlere otomatik uygulanmaz.
- SosyalSanathane API, admin, Expo ve PostgreSQL hizmetleri son kontrolde aktifti.

## Doğrulama

- Son kodla 39 test dosyasında 229 test geçti; TypeScript ve üretim derlemesi başarılı.
- Onay tekrarı, bakiye koruması, oturum iptalinin anında uygulanması, gereksiz oturum yazımlarının engellenmesi, CSRF, zaman aşımı ve telemetri seçim davranışı test edildi.
- Ayrı yerel test ortamında kullanıcılar, profiller, audit, hafif yapılandırma ve tam rekabet raporu HTTP 200; oturumsuz yapılandırma HTTP 401.
- Canlı son sürümde 4 eşzamanlı işçiyle 16 HTTPS isteğinin tamamı başarılı; medyan yaklaşık 89 ms, maksimum 263 ms. Bu kısa kontrol kapasite/yük testi değildir.
- Canlı PNG/WebP, dosya önbellek başlıkları, eksik dosyada 404, oturumsuz yönetim erişiminde 401 doğrulandı.
- Son kontrol aralığında yeni Royale Caddy hatası yoktu. Gerçek bir bekleyen kullanıcı test amacıyla onaylanmadı; hesaplar ve bakiyeler değiştirilmedi.
- Canlı verinin ayrı kopyasında tam yönetim raporu sıcak ölçümlerde 5–28 ms; oyuncu dashboard'u 147–262 ms. Dashboard ilk ölçümü 1.67 saniyeydi; ilk erişim ve sistem kaynak baskısı hâlâ etkili.

## Kalan kısıt

22:24 UTC ölçümünde 3 vCPU sunucunun yük ortalaması 5.21; kullanılabilir RAM yaklaşık 385 MB; swap 1923/2047 MB. PID 2905158 hâlâ yaklaşık 2.04 GB resident RAM tutuyor. Öncelik düşürmek bu belleği serbest bırakmaz. Bu sürecin neye hizmet ettiği doğrulanmadığından, aktif diğer uygulamanın özelliklerini koruma talebi kapsamında kapatılmadı. Kaynak tüketimi sürerken kesintisiz performans garantisi verilemez. Kalıcı kapasite rahatlığı için bu programın gerekliliği belirlenmeli veya diğer iş yükü ayrı sunucuya taşınmalı/kaynak artırılmalıdır.

## Yedek ve geri dönüş

Sunucuda `/root/royale-optimization-20260907/` altında işlem öncesi SQLite yedeği, Caddy ve systemd yapılandırmaları, önceki HTML ve dağıtım paketleri tutuluyor. Oyun verisi değişmeye devam ettiği için kod geri dönüşünde eski veritabanını yerine koymak yeni oyunları kaybettirir; normal kod geri dönüşü veritabanı geri yüklemesi gerektirmez. Ek indeksler eski kodla uyumludur.

Kaynak değişiklikleri `1f6fab9` ve `b981a4a` commit'lerinde, GitHub main'e gönderildi. Standart CANLIYA-AL akışı sonraki dağıtımlarda bu uygulama/Caddy/systemd ayarlarını korur. Sunucu log politikaları `/etc` altında ayrıca kalıcıdır.
