# Kulüpler 2.0 ve Canlı Poker Backlogu

Bu belge, çalışan meta rekabet sisteminin üzerine daha sonra eklenecek kulüp ve gerçek oyuncu-oyuncu poker işlerini tanımlar. Şimdilik uygulanmayacak; mevcut kulüp puanlama, Elo rating ve manuel turnuva sonucu altyapısı korunacaktır.

## 1. Kulüpler 2.0 — ürün mantığı

### Üyelik ve yönetim

- Kulüpler `açık`, `başvurulu` veya `davetli` olabilir.
- Oyuncu aynı anda yalnız bir kulüpte bulunabilir.
- Roller: `lider`, `sağ kol`, `üye`.
- Lider; rol verme, üye çıkarma, başvuru kabulü, arma/açıklama düzenleme ve liderlik devri yapabilir.
- Sağ kol; başvuru kabul edebilir ve üye çıkarabilir fakat lideri/diğer sağ kolları yönetemez.
- Son lider ayrılırsa en eski sağ kola, yoksa en eski üyeye liderlik geçer. Tek üyeyse kulüp arşivlenir.

### Rekabet mantığı

- Puan, bahis hacminden değil doğrulanmış anlamlı oyun sonuçlarından gelir.
- Her haftalık etkinliğin kişi başı katkı sınırı bulunur.
- Oyun/aile çeşitliliği bonusu uygulanabilir; tek oyunu spamlamak en iyi strateji olmamalıdır.
- Haftalık sıralamada kulüp puanı, aktif katkı veren üye sayısı ve beraberlik bozucu olarak başarı çeşitliliği kullanılır.
- Haftalık `Kulüp MVP` en yüksek geçerli katkıyı veren üyedir.
- Ödüller büyük PR dağıtımı yerine arma, unvan, şöhret ve profil kupası ağırlıklı olmalıdır.
- Geçmiş haftaların ilk üçü Hall of Fame’de kalıcı tutulur.

### Arayüz

- Kulüp profil sayfası: arma, etiket, açıklama, üyeler, roller, haftalık/kariyer puanı, son başarılar.
- Başvuru/davet kutusu ve bekleyen işlem sayacı.
- Liderlik yönetimi için yetkiye göre görünür eylemler.
- Haftalık puan dağılımı, kişi sınırı ilerlemesi ve MVP kartı.
- Diğer kulüplerin herkese açık profilini açabilme.
- Admin panelinde etkinlik adı, süre, kişi sınırı, puan kuralları ve ödül paketi.

## 2. Kulüpler 2.0 — teknik plan

### Veri modeli

- `clubs`: `visibility`, `description`, `badge_id`, `member_limit`, `updated_at`.
- `club_members`: mevcut tekil `user_id` kuralı korunur; rol değişiklik tarihi eklenir.
- `club_applications`: başvuran, hedef kulüp, durum, karar veren, zamanlar.
- `club_invites`: davet eden, davet edilen, sona erme ve durum.
- `club_role_audit`: rol/üyelik değişikliklerinin immutable denetim kaydı.
- `club_event_definitions`: puan kuralları ve ödül JSON’u.
- `club_event_results`: mevcut tablo genişletilerek MVP ve tie-break metadata tutulur.
- `club_achievements` ve `user_club_trophies`: kulüp kariyer ödülleri.

### Servis kuralları

- Bütün mutasyonlar sunucuda yetki kontrolünden geçer.
- Başvuru/davet kabulü transaction içinde üyelik tekilliğini tekrar kontrol eder.
- Katkı hesabı `GAME_ROUND_SETTLED` üzerinden idempotent çalışır.
- İptal/geçersiz settlement sonrası kulüp puanı deterministik rebuild ile düzeltilir.
- Liderlik devri ve kulüp arşivleme tek transaction olur.
- Feed olayları rate-limitlidir; her üyelik hareketi Casino Live’ı doldurmaz.

### API taslağı

- `GET /competition/clubs/:id`
- `POST /competition/clubs/:id/apply`
- `POST /competition/clubs/:id/invite`
- `POST /competition/clubs/:id/applications/:userId/decide`
- `POST /competition/clubs/:id/members/:userId/role`
- `DELETE /competition/clubs/:id/members/:userId`
- `POST /competition/clubs/:id/transfer-leadership`
- Admin: etkinlik/config oluşturma, kapatma ve rebuild uçları.

### Test zorunlulukları

- Aynı anda iki kulübe girilememe yarışı.
- Lider/sağ kol/üye yetki matrisi.
- Son lider ayrılışında deterministik devir.
- Kişi sınırı ve duplicate settlement koruması.
- Invalidation sonrası doğru yeniden hesaplama.
- Eşit puan tie-break ve haftalık arşivleme.

## 3. Canlı poker — ürün mantığı

- Mevcut bot Texas Hold’em ayrı mod olarak kalır ve skill rating’i etkilemez.
- Canlı masa yalnız gerçek, oturum açmış oyuncularla çalışır.
- Modlar: özel davetli masa, açık cash masa, turnuva masası.
- Oyuncu bağlantısı koparsa karar süresi boyunca yeniden bağlanabilir; süre dolunca otomatik check/fold uygulanır.
- Kapalı kartlar yalnız sahibi tarafından görülebilir.
- Masa sonucu sunucu otoriterdir; istemci kart, RNG, pot veya kazanan belirleyemez.
- Cash masa PR hareketleri escrow mantığıyla; buy-in, rebuy ve cashout aynı masa defterinde izlenir.
- Rating yalnız dereceli masa/turnuva sonucundan değişir. Arkadaş cash masası varsayılan olarak rating dışıdır.
- Turnuva: kayıt, masa dağıtımı, kör bahis seviyesi, elenme, yeniden masa dengeleme, final masa ve otomatik şampiyonluk.

## 4. Canlı poker — teknik plan

### Sunucu otoritesi

- `poker-engine-ts` sunucuda çalıştırılır; istemci yalnız niyet gönderir.
- Oda state’i SQLite’a snapshot + immutable event log olarak yazılır.
- Her aksiyonda `expectedSnapshotVersion` ile optimistic concurrency kontrolü yapılır.
- RNG seed/hash sunucuda üretilir; el bitince denetim için reveal edilebilir.
- Oyuncuya gönderilen snapshot kapalı kartları filtreler.

### Realtime taşıma

- İlk sürüm: kısa polling + uzun beklemeli event endpoint’i.
- Sonraki sürüm: WebSocket/SSE; API komut modeli değişmez.
- Her istemci `lastEventIndex` ile kaçırdığı olayları tamamlar.
- Presence heartbeat masa sandalyesinden ve oyun state’inden ayrıdır.

### Veri modeli

- `poker_rooms`, `poker_room_seats`, `poker_hands`, `poker_hand_events`.
- `poker_table_ledger`: buy-in, rebuy, pot settlement, cashout.
- `poker_presence`: son heartbeat ve disconnect zamanı.
- `tournament_tables`, `tournament_seats`, `tournament_blind_levels`.
- Mevcut `multiplayer_matches`, `multiplayer_ratings`, `tournaments` ve `tournament_results` tabloları sonuç katmanı olarak kullanılır.

### Güvenlik ve bütünlük

- Bir kullanıcı aynı anda tek canlı poker sandalyesinde olabilir.
- Aksiyon yalnız sırası gelen sandalyenin aktif oturumu tarafından gönderilebilir.
- CSRF, session, version ve idempotency anahtarı zorunludur.
- Wallet/escrow hareketi ile masa state değişimi aynı transaction içinde sonuçlanır.
- Sunucu yeniden başlarsa açık masalar son snapshot/event’ten toparlanır.
- Tamamlanan el bir kez rating ve meta sisteme aktarılır.

### Uygulama sırası

1. İki kişilik özel, ratingsiz canlı masa.
2. Disconnect/reconnect ve süre aşımı.
3. Çok oyunculu cash masa ve side pot regresyonları.
4. Dereceli heads-up.
5. Otomatik turnuva masaları ve final sonuç zinciri.
6. Spectator/replay ve el geçmişi.

## 5. Kabul kriteri

- İki ayrı hesap aynı masada farklı kapalı kartlarla aynı ortak state’i görür.
- Aynı aksiyon iki kez uygulanamaz.
- Yanlış sıradaki oyuncu aksiyon gönderemez.
- Disconnect sonrası el kilitlenmez.
- Pot toplamı ve wallet/escrow toplamı her adımda korunur.
- Tamamlanan dereceli el rating’e tam bir kez gider.
- Turnuva sonucu sezon, şöhret, profil ve Hall of Fame’e otomatik yansır.
