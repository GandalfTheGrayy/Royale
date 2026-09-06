# Pehlevan Royale — çok kullanıcılı hesap, yetki ve cüzdan sistemi

**Durum:** Faz A–B uygulandı; Faz C altyapısı hazır; oyun motorlarının sunucuya taşınması sürüyor  
**Tarih:** 2026-08-28  
**Amaç:** Tailscale Funnel üzerinden yayımlanan eğlence amaçlı Pehlevan Royale'i;
kayıt, owner onayı, ayrı kullanıcı bakiyeleri, yetkilendirme, kullanıcıya özel oyun
profilleri ve denetlenebilir yönetim işlemleri olan gerçek bir çok-kullanıcılı sisteme
dönüştürmek.

## Uygulama kaydı — 2026-08-28

Tamamlananlar:

- Schema v5; `users`, scrypt credentials, session, wallet, ledger v2, profil ve audit tabloları
- Mevcut Muharrem Pehlevan geçmişinin ve eski ortak bakiyenin owner hesabına göçü
- Premium giriş, kayıt, onay bekleme ve ilk yerel owner kurulum ekranları
- HttpOnly/SameSite session, CSRF + Origin kontrolü, login/kayıt hız sınırı
- Owner panelinde gerçek başvuru onayı, red, askı/aktivasyon, rol ve bakiye işlemleri
- Oyuncu hesap merkezinde bakiye, aktif cihazlar, oturum kapatma ve parola değiştirme
- Kullanıcı bazında oyun/ledger/event/AI kayıt ayrımı ve kullanıcıya özel meta alanı
- Sürümlü oyun profili oluşturma/atama arayüzü ve tur başına efektif profil snapshot'ı
- Owner/admin işlem geçmişi (audit) görünümü
- Normal yayında ortak Basic Auth'ın kaldırılması; isteğe bağlı `-EmergencyGate`
- Günlük tutarlı SQLite yedeği ve kapanışta WAL checkpoint
- Masaüstü ve 390×844 iPhone 13 görünüm doğrulaması

Kalan Faz D işi:

- Her oyun motorunu sırayla sunucu-otoriteli `start/action/settle` adapter'ına taşımak
- Efektif profil matematiğini her oyunun sunucu adapter'ında doğrudan uygulatmak

Geçiş sırasında oyun cüzdan hareketleri artık SQLite transaction ve idempotency ile
sunucuda uygulanır. Ancak sonuç üretimi henüz bütün oyunlarda sunucuya taşınmadığı için
tarayıcı geliştirici araçlarına karşı tam hile dayanımı Faz D tamamlandığında sağlanacaktır.

---

## 1. Yönetici özeti

Bugünkü uygulama gerçek anlamda tek hesaptır:

- Dış erişim `BASLAT-UZAKTAN-PAYLAS.ps1` ile Tailscale Funnel üzerinden sağlanır.
- Funnel'ın önünde bütün ziyaretçiler için tek `Pehlivan` Basic Auth parolası vardır.
- Bakiye ve profil `account:pehlivan:profile-v1` anahtarında ortak tutulur.
- Yönetim panelindeki kullanıcı listesi ayar JSON'unun içindedir; giriş yapabilen gerçek
  kullanıcı hesapları değildir.
- Oyunların çoğu sonucu tarayıcıda üretip bakiyeyi React durumunda değiştirir. Çok
  kullanıcı olduğunda bu yapı bakiye otoritesi olarak kullanılamaz.

Yeni sistemde:

1. **Tailscale Funnel yalnızca güvenli internet taşıma katmanı** olur.
2. Uygulama açıldığında önce `Giriş / Kayıt` ekranı görünür.
3. Kayıt olan hesap `pending` durumuna geçer; oyunları açamaz.
4. Owner hesabı kaydı onaylar ve başlangıç bakiyesini belirler.
5. Her kullanıcı kendi oturumu, bakiyesi, geçmişi, AI konuşmaları ve oyun profiliyle
   çalışır.
6. Bakiye yalnız sunucuda ve SQLite transaction'ı içinde değişir. Tarayıcı doğrudan
   bakiye yazamaz.
7. Owner kullanıcıya oyun bazında matematik/deneyim profili atayabilir. Her turun hangi
   profille oynandığı değiştirilemez kayıt olarak saklanır.

Bu proje için ayrı bir bulut veritabanı gerekmez. Tek bilgisayarda çalışan Node/Vite
sunucusu ve yerel SQLite, beklenen arkadaş çevresi ölçeğinde yeterlidir.

---

## 2. Temel mimari

```text
Telefon / PC tarayıcısı
        │ HTTPS
        ▼
Tailscale Funnel (.ts.net)
        │ yerel reverse proxy
        ▼
Pehlevan Royale Node sunucusu
  ├─ Auth ve session middleware
  ├─ Rol / yetki kontrolü
  ├─ Owner yönetim API'si
  ├─ Sunucu-otoriteli cüzdan servisi
  ├─ Oyun profil çözücüsü
  ├─ Oyun motoru adapter'ları
  └─ Audit / telemetri servisi
        │ tek yazma otoritesi
        ▼
Yerel SQLite (WAL)
```

### Neden bu yapı?

- Funnel genel internete açık HTTPS adresi verir; ziyaretçinin Tailscale kurması gerekmez.
- Kimlik doğrulama uygulamanın kendisinde yapılır; ortak site parolası kayıt ekranını
  engellemez.
- SQLite WAL aynı bilgisayardaki çok sayıda okuyucu ile tek yazıcı için uygundur.
- Tek Node süreci bütün bakiye transaction'larını sıralar; çift ödeme ve yarış durumu
  engellenir.

### Tailscale değişikliği

Mevcut `PEHLEVAN_SHARE_USER/PASSWORD_HASH` Basic Auth kapısı normal yayında kaldırılacak.
Yerine uygulama oturumu zorunlu olacak. İstenirse owner için ayrı bir **acil bakım kapısı**
başlatma parametresi olarak korunabilir; normal kullanıcı akışında açık olmayacak.

---

## 3. Roller ve yetki matrisi

| İşlem | Owner | Yetkili admin | Player | Pending |
|---|---:|---:|---:|---:|
| Kendi profilini görme | ✓ | ✓ | ✓ | sınırlı |
| Oyun oynama | ✓ | ✓ | ✓ | — |
| Kendi geçmişini görme | ✓ | ✓ | ✓ | — |
| Kullanıcıları görme | ✓ | izin verilirse | — | — |
| Kaydı onaylama/reddetme | ✓ | `users.approve` izni | — | — |
| Bakiye ekleme/düşme | ✓ | `wallet.adjust` izni | — | — |
| Genel oyun ayarı | ✓ | `games.global` izni | — | — |
| Kullanıcıya özel profil | ✓ | `games.assignProfile` izni | — | — |
| Admin atama/yetki değiştirme | ✓ | — | — | — |
| Owner hesabını silme/askıya alma | — | — | — | — |

İlk sürümde tek gerçek yönetici Muharrem Pehlevan/owner olur. `admin` rolü şemada hazır
bulunur fakat owner atamadıkça kimse yönetim yetkisi kazanmaz.

---

## 4. Kayıt, onay ve giriş akışı

### Kayıt

Kullanıcı şu alanları doldurur:

- Benzersiz kullanıcı adı
- Görünen ad
- Parola ve parola tekrarı
- İsteğe bağlı owner'a not

E-posta ilk sürümde zorunlu değildir. Kayıt sonucu:

```text
Kayıt formu → sunucu doğrulaması → users.status=pending
           → owner panelinde “Bekleyen başvurular”
           → kullanıcıda “Onay bekleniyor” ekranı
```

### Owner onayı

Owner başvuruyu açınca aynı ekranda:

- Onayla / reddet
- İlk bakiye
- Rol (`player` varsayılan)
- İsteğe bağlı başlangıç oyun profili
- Yönetici notu

seçer. Onay ve başlangıç bakiyesi tek SQLite transaction'ında yapılır.

### Giriş

- `active`: oturum açılır ve lobiye geçilir.
- `pending`: yalnız onay bekleme ekranı gösterilir.
- `suspended`: sebep gösterilir, oyun/API erişimi verilmez.
- `rejected`: yeni kayıt veya owner iletişimi mesajı gösterilir.

### Parola sıfırlama

E-posta servisi olmadığı için owner tek kullanımlık, kısa ömürlü parola kurma bağlantısı
üretir. Owner kullanıcının yeni parolasını göremez. Token bir kez kullanılır ve yalnız
hash'i veritabanında tutulur.

---

## 5. Oturum ve güvenlik tasarımı

### Parola saklama

- Düz metin veya hızlı SHA-256 parola hash'i kullanılmaz.
- Yerleşik Node `crypto.scrypt` ile kullanıcı başına benzersiz salt kullanılır.
- Önerilen taban: `N=2^17, r=8, p=1`; gerçek bilgisayarda açılış öncesi ölçülür.
- Hash formatı algoritma ve parametreleri içerir; daha sonra yükseltilebilir.
- Mevcut paylaşım parolasının yalnız SHA-256 hash'i bulunduğu için güvenli biçimde
  dönüştürülemez. Owner ilk geçişte yeni parola belirler.

### Session

- 32 bayt kriptografik rastgele session token üretilir.
- Tarayıcıda yalnız `HttpOnly` cookie bulunur; token `localStorage`'a yazılmaz.
- Funnel/HTTPS: `Secure; HttpOnly; SameSite=Strict; Path=/`.
- Yerel HTTP geliştirme için ayrı, `Secure` olmayan development cookie adı kullanılır.
- Veritabanında token'ın kendisi değil SHA-256 hash'i tutulur.
- Varsayılan: 12 saat boşta kalma, 7 gün mutlak süre. “Beni hatırla” seçilirse 30 gün.
- Çıkış, askıya alma veya “tüm cihazlardan çıkış” bütün ilgili session'ları iptal eder.

### Yazma istekleri

- `POST/PATCH/DELETE` istekleri session'a bağlı CSRF token ve aynı-origin kontrolü ister.
- Login: kullanıcı adı + IP tabanlı artan gecikme ve geçici limit.
- Registration: IP başına hız sınırı.
- Bütün JSON gövdeleri boyut ve şema doğrulamasından geçer.
- Owner işlemleri yeniden parola doğrulaması gerektirebilen “yüksek riskli” işlem sınıfına
  alınır: rol verme, owner parolası, büyük bakiye düzeltmesi, veri silme.

---

## 6. Cüzdan ve bakiye modeli

### Temel kurallar

- Kullanıcı bakiyesini kendisi yükseltemez.
- Owner veya izinli admin bakiye ekler/düşer; sebep alanı zorunludur.
- Oyun bahsi ve ödemesi yalnız sunucu oyun motoru tarafından yapılır.
- Bakiye negatif olamaz.
- Cüzdan hareketleri silinmez; yanlış işlem ters kayıt ile düzeltilir.
- Aynı istek iki kere ulaşırsa `idempotency_key` ikinci kez para değiştirmez.

### Para birimi

Kayan nokta hatalarını kaldırmak için sunucuda `INTEGER` kullanılır:

```text
1 PR = 1.000.000 micro-PR
```

API kullanıcıya normal PR sayısı döndürür; hesap ve transaction'lar micro-PR ile yapılır.

### Transaction örneği

```sql
BEGIN IMMEDIATE;
SELECT balance_micro FROM wallets WHERE user_id = ?;
-- bakiye ve oyun koşulu doğrula
UPDATE wallets SET balance_micro = balance_micro - ? WHERE user_id = ?;
INSERT INTO wallet_ledger (..., type, amount_micro, balance_after_micro, ...);
COMMIT;
```

Ödeme de aynı şekilde ayrı ve idempotent transaction'dır. Tur kaydı, bahis ve ödeme aynı
`round_id` ile ilişkilendirilir.

---

## 7. Kullanıcıya özel oyun profilleri

### Katmanlar

Efektif ayar şu sırayla çözülür:

```text
Kod güvenlik sınırları
  → Genel oyun profili
  → Atanmış kullanıcı profili
  → Kullanıcıya özel izinli alan override'ları
  → Tur başlangıcında değişmez profil snapshot'ı
```

### İki ayrı profil türü

1. **Matematik profili**
   - Hedef RTP/house edge
   - Volatilite
   - Hit/bonus/scatter/freespin ağırlıkları
   - Aviator crash dağılımı ve azami çarpan
   - Mines/Plinko/Countdown risk eğrileri
   - Oyun bazında izin verilen diğer parametreler

2. **Deneyim profili**
   - Animasyon ritmi
   - Kutlama eşiği
   - Müzik/karakter yoğunluğu
   - Görevler, bedava turlar, görünür bonuslar
   - Kullanıcıya özel tema ve AI kişilik ayarı

### Owner deneyimi

Owner hazır profiller oluşturabilir:

- `Standart Salon`
- `Daha Sık Küçük Kazanç`
- `Seyrek Büyük Vurgun`
- `Festival / Cömert Demo`
- Tamamen özel profil

Profil oyun bazında atanır. Örneğin aynı kullanıcı Aviator'da `Festival`, Neon Kasası'nda
`Standart` kullanabilir.

### Kritik bütünlük kuralları

- Owner başlamış bir turun sonucunu veya “sonraki sonuç şu olsun” değerini seçemez.
- Profil değişikliği yalnız bir sonraki turdan itibaren etkilidir.
- Her tur `effective_profile_id`, `profile_version` ve tam matematik snapshot'ını kaydeder.
- Profil değişiklikleri `admin_audit_log` tablosuna önceki/sonraki değer ve sebep ile yazılır.
- Kullanıcıya özel profil, analiz ekranlarında ayrı segment olur; genel RTP istatistiğini
  sessizce bozmaz.
- Eğlence amaçlı kişiselleştirilmiş matematik kullanıldığında arayüzde owner'ın seçimine
  göre en azından `Özel Salon Profili` rozeti gösterilmesi önerilir. Kullanıcıyı mutlu
  etmenin daha anlaşılır yolu; görünür bonus PR, bedava tur veya Festival modu vermektir.

---

## 8. Önerilen SQLite şeması

### Kimlik ve erişim

```sql
users(
  id TEXT PRIMARY KEY,
  username_normalized TEXT UNIQUE NOT NULL,
  username_display TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,               -- owner/admin/player
  status TEXT NOT NULL,             -- pending/active/suspended/rejected
  registration_note TEXT,
  admin_note TEXT,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  suspended_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT
);

user_credentials(
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_changed_at TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

sessions(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  csrf_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent_label TEXT,
  ip_hash TEXT
);

password_reset_tokens(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id)
);
```

### Cüzdan

```sql
wallets(
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  currency TEXT NOT NULL DEFAULT 'PR',
  balance_micro INTEGER NOT NULL CHECK(balance_micro >= 0),
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

wallet_ledger_v2(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  round_id TEXT,
  actor_user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL,               -- stake/payout/admin_credit/admin_debit/reversal
  amount_micro INTEGER NOT NULL,
  balance_before_micro INTEGER NOT NULL,
  balance_after_micro INTEGER NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);
```

### Oyun profili ve denetim

```sql
game_profiles(
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,               -- global/custom
  version INTEGER NOT NULL,
  math_json TEXT NOT NULL,
  experience_json TEXT NOT NULL,
  active INTEGER NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(game_id, name, version)
);

user_game_profiles(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES game_profiles(id),
  override_json TEXT,
  assigned_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY(user_id, game_id)
);

admin_audit_log(
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  occurred_at TEXT NOT NULL
);
```

Mevcut `game_rounds`, `wallet_ledger`, `game_events` ve `ai_conversations` tablolarına
`user_id` eklenir. `game_rounds` ayrıca profil ID/sürüm/snapshot alanlarını alır.

---

## 9. API yüzeyi

### Public/auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
POST /api/auth/reset-password/:token
```

### Oyuncu

```text
GET  /api/me/profile
GET  /api/me/wallet
GET  /api/me/wallet/ledger
GET  /api/me/rounds
GET  /api/me/game-config/:gameId
GET  /api/me/sessions
DELETE /api/me/sessions/:sessionId
```

### Owner/admin

```text
GET   /api/admin/registrations
POST  /api/admin/users/:id/approve
POST  /api/admin/users/:id/reject
PATCH /api/admin/users/:id
POST  /api/admin/users/:id/suspend
POST  /api/admin/users/:id/activate
POST  /api/admin/users/:id/wallet-adjustments
POST  /api/admin/users/:id/revoke-sessions
POST  /api/admin/users/:id/password-reset-link
GET   /api/admin/game-profiles
POST  /api/admin/game-profiles
POST  /api/admin/users/:id/game-profiles/:gameId
GET   /api/admin/audit-log
```

### Oyun

Her oyun doğrudan tarayıcıda para değiştirmek yerine sunucu adapter'ı kullanır:

```text
POST /api/games/:gameId/rounds/start
POST /api/games/:gameId/rounds/:roundId/action
GET  /api/games/:gameId/rounds/:roundId
```

Slot/spin veya Plinko gibi tek kararlı oyunlar `start` cevabında sonucu alabilir.
Blackjack/poker gibi çok adımlı oyunlar `action` ile ilerler. Sunucu her aksiyonda session
kullanıcısını, aktif profili ve cüzdanı doğrular.

---

## 10. Frontend ekranları

### Giriş kapısı

- Premium Pehlevan Royale giriş ekranı
- `Giriş yap` ve `Kayıt ol` sekmeleri
- Kayıt sonrası onay bekleme ekranı
- Askı/red durum ekranı
- Mobil Safari'de tek viewport ve 16 px minimum form fontu

### Kullanıcı alanı

- Avatar/isim, bakiye, son hareketler
- Kendi oyun geçmişi ve istatistikleri
- Aktif oyun profili rozetleri
- Oturum/cihaz listesi ve çıkış
- Parola değiştirme

### Owner paneli

Mevcut sıkışık tek kullanıcı listesinin yerine:

1. **Bekleyen kayıtlar** — onay/red ve başlangıç bakiyesi
2. **Kullanıcılar** — arama, filtre, bakiye, durum, son görülme
3. **Kullanıcı detayı**
   - Özet
   - Cüzdan ve ledger
   - Oyun geçmişi
   - Oyun profilleri
   - AI konuşmaları
   - Oturumlar/güvenlik
   - Owner işlem geçmişi
4. **Oyun profilleri** — oyun seç, profil listesi, sürüm karşılaştırması
5. **Audit log** — kim, kimi, ne zaman, neden değiştirdi

---

## 11. Oyun motorlarının sunucuya taşınması

Çok kullanıcılı sistemin en önemli teknik şartı budur. Login ekleyip mevcut React
`setBalance` yapısını bırakmak güvenli bir kullanıcı sistemi oluşturmaz.

Önerilen adapter sözleşmesi:

```ts
type GameAdapter = {
  validateConfig(profile: EffectiveGameProfile): void
  startRound(input, context): Promise<ServerRound>
  applyAction?(round, action, context): Promise<ServerRound>
  verifySettlement(round): void
}
```

Geçiş sırası:

1. Plinko, Mines, Countdown — sınırlı ve deterministik durum makineleri
2. Aviator ve canlı rulet — ortak sunucu saatine bağlı oyunlar
3. Slotlar — matematik motoru ve bonus session'ları
4. Blackjack — çok adımlı state machine
5. Poker — bot/masa otoritesi ve gelecekte online oyuncu desteği

Bir oyun taşınana kadar yeni player hesaplarında “yerel güven modu” ile para üretemez;
owner test hesabında çalışmaya devam edebilir. Böylece yarım geçişte bakiye açığı oluşmaz.

---

## 12. Mevcut verinin göçü

### Schema migration

Yeni sürüm örneğin `schema_version=5` olur ve tek transaction içinde:

1. Owner `users` kaydı oluşturulur.
2. `account:pehlivan:profile-v1` bakiyesi owner `wallets` kaydına çevrilir.
3. Mevcut bütün oyun/ledger/event/AI kayıtlarına owner `user_id` atanır.
4. Yönetim JSON'undaki `users` dizisi kaldırılır; gerçek `users` tablosu kullanılır.
5. Global oyun ayarları ilk sürümlü `game_profiles` kayıtlarına çevrilir.
6. Owner yeni güvenli parola kurar.
7. Göç başarıyla commit edilmeden eski meta anahtarları silinmez; yalnız `legacy` işareti
   alır.

### Geri dönüş

- Göçten önce WAL checkpoint ve SQLite backup alınır.
- Backup adı tarih/saat ve schema sürümü içerir.
- Göç başarısızsa transaction rollback olur ve mevcut tek hesap çalışmaya devam eder.

---

## 13. Kapasite ve kaynak kullanımı

Mevcut aktif SQLite yaklaşık **55,9 MB**. Kimlik, session ve kullanıcı profil tabloları
çok küçüktür; 100 kullanıcıda bile genellikle birkaç MB düzeyindedir. Asıl büyüme oyun
tur/event ve AI konuşmalarından gelir.

Mevcut kayıt yoğunluğuna dayanarak kaba planlama:

- 10.000 ayrıntılı tur: yaklaşık 15–35 MB
- 100.000 tur: yaklaşık 150–350 MB
- Büyük sembol grid'leri veya uzun AI bağlamları bu aralığı yükseltir.

Öneri:

- Son 12 ay canlı SQLite'ta.
- Daha eski ayrıntılar aylık sıkıştırılmış JSONL/SQLite arşivinde.
- Özet tablolar kalıcı tutulur.
- Günlük `PASSIVE`, uygulama kapanışında `TRUNCATE` WAL checkpoint.
- Günlük dönen backup: 7 günlük + 4 haftalık kopya.

Beklenen arkadaş grubu kullanımı için SQLite yeterlidir. Aynı anda yüzlerce aktif yazıcı
veya birden fazla sunucu bilgisayarı gerekirse PostgreSQL'e geçiş düşünülür; şimdilik bu
gereksiz karmaşıklıktır.

---

## 14. Uygulama fazları

### Faz A — veri ve auth omurgası

- Schema v5 migration ve backup
- User/credentials/session/audit tabloları
- Scrypt parola, cookie session, CSRF, rate limit
- Owner bootstrap ve kayıt/onay akışı

### Faz B — gerçek cüzdan

- Wallet/ledger v2
- Owner bakiye ekranı
- Kullanıcıya özel bakiye ve profil hidrasyonu
- Eski ortak `account:pehlivan:*` akışının kapatılması

### Faz C — oyun profilleri

- Sürümlü global ve kullanıcı profilleri
- Admin profil editörü ve atama matrisi
- Tur snapshot/segment analizi

### Faz D — oyun motoru geçişi

- Oyunlar önerilen adapter sırasıyla sunucu otoritesine alınır
- Her oyun için transaction, tekrar istek ve eşzamanlılık testleri

### Faz E — yayın ve kalite

- Basic Auth yerine uygulama login'i
- Tailscale Funnel başlatıcısının güncellenmesi
- iPhone Safari, masaüstü, iki kullanıcı eşzamanlı test
- Backup/restore ve owner hesap kurtarma testi

---

## 15. Kabul kriterleri

- Kayıt olan kullanıcı owner onayı olmadan oyun açamaz.
- Owner başlangıç bakiyesini onay ekranında belirleyebilir.
- İki kullanıcı farklı cihazlarda aynı anda farklı bakiye görür.
- Kullanıcı API çağrısıyla kendi bakiyesini doğrudan yükseltemez.
- Aynı bahis isteği iki kez gönderilince bakiye yalnız bir kez düşer.
- Askıya alınan kullanıcının bütün session'ları kapanır.
- Owner'ın her bakiye ve profil işlemi audit log'a yazılır.
- Her oyun turu doğru `user_id` ve profil sürümüyle kaydedilir.
- Kullanıcı profili değişikliği başlamış turu etkilemez.
- Tailscale Funnel adresinde kayıt/giriş ekranı ortak Basic Auth istemeden açılır.
- Mevcut Muharrem bakiyesi ve geçmişi göçten sonra kaybolmaz.

---

## 16. Onay bekleyen ürün kararları

Tasarımda önerilen varsayılanlar:

- Yeni kayıt bakiyesi: **0 PR**, owner onay sırasında belirler.
- Roller: owner/admin/player.
- Kullanıcı adı büyük-küçük harfe duyarsız benzersizdir.
- E-posta zorunlu değildir.
- Session: 12 saat idle, 7 gün mutlak; “beni hatırla” 30 gün.
- Kullanıcı özel matematik profili atanırsa `Özel Salon Profili` rozeti görünür.
- Bakiye yalnız owner veya açıkça `wallet.adjust` izni verilmiş admin tarafından ayarlanır.

Bu kararlar owner tarafından onaylandığında Faz A kodlamasına başlanabilir.

---

## 17. Referanslar

- Tailscale Funnel — genel internetten yerel servise HTTPS tüneli:
  https://tailscale.com/docs/features/tailscale-funnel
- OWASP Password Storage — Argon2id/scrypt ve yavaş, salt'lı parola hash'i:
  https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP Session Management — Secure/HttpOnly/SameSite cookie ve localStorage yasağı:
  https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- SQLite WAL — okuyucu/yazıcı eşzamanlılığı ve checkpoint davranışı:
  https://www.sqlite.org/wal.html
- SQLite transactions — tek yazıcı ve `BEGIN IMMEDIATE` davranışı:
  https://www.sqlite.org/lang_transaction.html
- SQLite foreign keys:
  https://www.sqlite.org/foreignkeys.html
