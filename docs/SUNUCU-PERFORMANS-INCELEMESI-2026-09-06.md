# Canlı sunucu incelemesi — 6 Eylül 2026

İnceleme SSH üzerinden, yaklaşık 19:49–19:53 UTC arasında yapıldı. Canlı servisler, kullanıcılar ve veriler değiştirilmedi. CANLIYA-AL.cmd çalıştırılmadı; çağırdığı PowerShell betiği ve dağıtım yapılandırmaları okundu. Yerel ve sunucu commit'i f23cef1. Yerelde önceden bulunan iki slot dosyası değişikliğine dokunulmadı.

## 1. Doğrulanan kaynak sıkışması

- Sunucu: 3 vCPU, 3911 MiB RAM.
- İlk örnek: 3203 MiB RAM kullanımda, 386 MiB kullanılabilir; 2047 MiB swap'ın 2045 MiB'ı kullanımda.
- Yük ortalaması: 6.63 / 6.30 / 5.90. Beş saniyelik vmstat örneğinde CPU boşta oranı %0; çalışmayı bekleyen süreç sayısı 4–17.
- Disk %94 dolu, yaklaşık 2.3 GiB boş. /var/log 16 GiB; syslog.1 10 GiB, mevcut syslog 1.2 GiB, journal 4 GiB.
- Güncel syslog örneğinde SosyalSanathane uygulamasının yoğun SQL UPDATE kayıtları var. Tüm eski logların aynı kaynaktan geldiği ayrıca doğrulanmadı.
- Kernel aynı gün 14:15 ve 14:19 UTC'de PostgreSQL konteynerindeki olağandışı adlı süreçleri RAM yetersizliğinden öldürmüş.

## 2. PostgreSQL konteynerinde güçlü ihlal belirtileri

Konteyner: sosyal-sanathane-postgres, image postgres:16-alpine. PostgreSQL portu hem IPv4 hem IPv6 üzerinde tüm arayüzlere yayımlanmış; dışarıdan erişimin firewall tarafından engellenip engellenmediği bu incelemede test edilmedi.

PID 2905158:

- Komut satırında postgres görünürken gerçek dosyası /tmp/.perf.c/rmdirmktemp.
- Yaklaşık %171 CPU ve 2.04 GiB resident RAM tüketiyor. ps CPU yüzdesi süreç ömrü ortalamasıdır.
- Başlangıç: 17:32:12 UTC.
- SHA-256: 2b6fc36166d78080c4d3bd9759fe6e5b827e46963e85991b4a4f15d7198776ba.

PID 2904896 kendisini postgres autovacuum launcher olarak gösteriyor fakat gerçek dosyası /tmp/.perf.c/postgres. Karşılaştırılan gerçek PostgreSQL süreci /usr/local/bin/postgres dosyasından çalışıyor. Konteynerde ayrıca bitpingd, cli ve ayrı Node programı ile dış bağlantılar mevcut.

Bu bulgular normal PostgreSQL yüküyle açıklanamaz; yetkisiz yazılım çalıştırıldığına dair güçlü belirtilerdir. Zararlı ailesi, ilk giriş yöntemi, kalıcılık ve ana makineye yayılım henüz belirlenmedi. Yalnız süreç öldürmek kalıcı çözüm sayılmaz. Diğer uygulamanın veritabanı da burada olduğundan inceleme sırasında konteyner durdurulmadı.

## 3. Donmanın HTTP kanıtı

Caddy kayıtlarında hem connection refused hem de 127.0.0.1:4173 bağlantısı için yaklaşık üç saniyelik i/o timeout kaynaklı 502 yanıtları var. Son altı saatlik hata kayıtlarında:

- GET /api/admin/accounts/users: 3 zaman aşımı.
- GET /api/admin/accounts/audit: 3 zaman aşımı.
- GET /api/admin/accounts/profiles: 2 zaman aşımı.
- GET /api/casino-data/competition/admin: 2 zaman aşımı.
- Rekabet dashboard ve oyun JavaScript dosyasında da zaman aşımı görüldü.

Tek bir anlık /api/auth/status ölçümü 200 ve 12 ms döndü. Bu hafif uç noktanın başarılı olması aralıklı donmayı dışlamıyor. Eski servis kayıtlarında .vite-temp dosyası için EACCES ile açılış hataları da var; güncel dağıtım betiği bu dizinin sahipliğini ayarlıyor. Servis inceleme anında 16:04 UTC'den beri çalışıyor.

## 4. Oyuncu onay panelindeki uygulama kaynaklı gecikme

src/auth/AccountAdmin.tsx içindeki load(), kullanıcılar, profiller, denetim kayıtları ve tüm rekabet yönetim raporunu Promise.all ile bekliyor. Bir istek başarısız olursa kullanıcı listesi dahil hiçbir state güncellenmiyor. Onay POST'u başarılı olsa dahi sonraki load() başarısızlığı işlem hatası gibi gösterilebiliyor. busy durumu bu yenileme bitene kadar tüm işlem düğmelerini kapatıyor.

src/auth/auth-api.ts içindeki fetch için uygulamanın belirlediği bir zaman aşımı yok. Bağlantı beklerken busy uzun süre açık kalabilir.

server/competition-system.mjs:getCompetitionAdminState içinde her oyun için son 20 kaydı almak amacıyla tüm geçerli meta_round_settlements kayıtlarını ROW_NUMBER ile dolaşan sorgu var. Canlı SQLite dosyasında yalnız okuma bağlantısıyla:

- Toplam settlement: 67.494.
- Sorgu sonucu: 352 satır.
- Tek ölçüm süresi: 4.093 saniye, mevcut sunucu baskısı altında.
- EXPLAIN QUERY PLAN, idx_meta_settlement_game_time üzerinden tarama gösteriyor.

Uygulama DatabaseSync kullandığından bu sorgu çalışırken Node ana iş parçacığı başka istekleri işleyemez. Python SQLite ile alınan süre Node içinde birebir ölçüm değildir; pahalı taramanın canlı veri üzerindeki etkisini gösterir. İlgili rapor ayrıca finalizeHouseEvents/finalizeRivalries çağırır; bunlar canlıda doğrudan çağrılmadı.

Veritabanında 4 aktif, 1 bekleyen kullanıcı; 3 başarılı user.approve denetim kaydı var. Son onay 16:56:59 UTC. Belirli başarısız onay POST'unun yanıtı yakalanmadığından onun kesin hatası saptanmadı. Handler 500 hatasını istemciye döndürüyor ancak catch içinde loglamıyor. Gerçek kullanıcı onayı veya bakiye değişikliği test amacıyla yapılmadı.

## Önerilen müdahale sırası

1. Şüpheli konteynerin kanıtlarını ve veritabanı yedeğini koruyarak izolasyon/temiz kurulum planlamak; SosyalSanathane üzerindeki kesinti etkisini hesaba katmak. PostgreSQL port yayımını gerekli erişimle sınırlamak, etkilenen erişim bilgilerini temiz bir ortamdan yenilemek ve kalıcılığı araştırmak.
2. Log büyümesini kaynağında azaltmak, saklama sınırları belirlemek ve gerekli kanıtlar korunduktan sonra eski logları arşivlemek/temizlemek.
3. Üyelik listesini rekabet raporundan ayırmak; başlangıç bakiyesi için hafif yapılandırma yanıtı kullanmak. Başarılı onay ile yenileme hatasını ayrı göstermek. Zaman aşımında POST'un gerçekleşmiş olabileceğini dikkate alıp otomatik tekrar yerine kullanıcı durumunu yeniden okumak.
4. Telemetriyi oyun başına indeksli LIMIT sorgularıyla sınırlamak; senkron ağır raporları önbelleğe almak veya ana iş parçacığından ayırmak.
5. Gerçek yönetim ve oyun istekleriyle gecikme ölçmek; yalnız auth/status sağlık kontrolüne güvenmemek. HTTP süreleri ve sunucu hataları için kişisel veri/oturum anahtarı içermeyen gözlemlenebilirlik eklemek.

Bu çalışma teşhistir; canlıda düzeltme veya yeniden dağıtım yapılmadı.
