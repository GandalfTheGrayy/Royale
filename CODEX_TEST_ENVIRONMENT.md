# Codex test ortamı

Codex tarafından yapılan tarayıcı ve arayüz testleri kullanıcıya ait `5173`
sunucusunda çalıştırılmaz.

- Başlatma komutu: `npm run dev:test`
- Adres: `http://127.0.0.1:5174/`
- Test hesabı: `codex_test` / `Codex Test Müfettişi`
- Rol: `owner`
- Veritabanı: `.codex-local/test-db/pehlevan-royale.sqlite`
- Yerel kimlik kaydı: `.codex-local/test-account.json`
- Test sunucusu localhost üzerinde bu hesaba otomatik oturum açar.

`.codex-local/` Git tarafından yok sayılır. Buradaki test oturumu, bakiye ve oyun
kayıtları 5173'te çalışan kullanıcı ortamından ayrıdır.
