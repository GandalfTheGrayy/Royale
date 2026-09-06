import { useCallback, useEffect, useState } from "react";
import {
  getCompetitionAdminState,
  invalidateCompetitionRound,
  saveCompetitionAdminConfig,
  type CompetitionAdminState,
  type CompetitionRuntimeConfig,
} from "../meta/competition-admin-api";
import "./competition-admin.css";
import SocialCompetitionAdmin from "./SocialCompetitionAdmin";

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const gameNames: Record<string, string> = {
  blackjack: "Blackjack",
  roulette: "Rulet",
  poker: "Poker",
  "kiraz-77": "Kiraz 77",
  "neon-kasasi": "Neon Kasası",
  "kaptan-mercan": "Kaptan Mercan",
  "sekerhane-1024": "Şekerhane 1024",
  "allahin-lutfu": "Allah’ın Lütfu",
  "baykus-madeni": "Baykuş Madeni",
  "altin-rota": "Altın Rota",
  "obsidyen-damari": "Obsidyen Damarı",
  "son-on": "Son On",
  plinko: "Plinko",
  hilo: "Hilo",
  "yedi-cevher": "Yedi Cevher",
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function Numeric({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  help: string;
}) {
  return (
    <label className="competition-admin-field">
      <span>
        {label}
        <small>{help}</small>
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function CompetitionAdmin() {
  const [state, setState] = useState<CompetitionAdminState>();
  const [draft, setDraft] = useState<CompetitionRuntimeConfig>();
  const [achievements, setAchievements] = useState<
    CompetitionAdminState["achievements"]
  >([]);
  const [season, setSeason] = useState({ name: "", endsAt: "" });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalidating, setInvalidating] =
    useState<CompetitionAdminState["settlements"][number]>();
  const [reason, setReason] = useState("Rekabet bütünlüğü düzeltmesi");
  const load = useCallback(async () => {
    const next = await getCompetitionAdminState();
    setState(next);
    setDraft(clone(next.config));
    setAchievements(clone(next.achievements));
    setSeason({
      name: next.season.name,
      endsAt: next.season.ends_at.slice(0, 16),
    });
  }, []);
  useEffect(() => {
    void load().catch((error) =>
      setNotice(
        error instanceof Error ? error.message : "Rekabet ayarları açılamadı.",
      ),
    );
  }, [load]);
  if (!state || !draft)
    return (
      <div className="competition-admin-loading">
        Rekabet kumanda masası hazırlanıyor…
      </div>
    );
  const patch = (
    group: keyof CompetitionRuntimeConfig,
    key: string,
    value: unknown,
  ) =>
    setDraft((current) => {
      if (!current) return current;
      const currentGroup = current[group] as unknown as Record<string, unknown>;
      return {
        ...current,
        [group]: { ...currentGroup, [key]: value },
      } as CompetitionRuntimeConfig;
    });
  const preset = (id: "sakin" | "dengeli" | "hararetli") => {
    const base = clone(state.defaults);
    if (id === "sakin") {
      base.scoring = {
        ...base.scoring,
        fiveX: 0,
        tenX: 1,
        twentyFiveX: 2,
        hundredX: 3,
        casinoRecord: 7,
        rivalVictory: 8,
      };
      base.feed.limit = 20;
      base.feed.bigHitMultiplier = 250;
      base.feed.legendaryHitMultiplier = 1000;
      base.feed.winningStreak = 7;
    }
    if (id === "hararetli") {
      base.scoring = {
        ...base.scoring,
        fiveX: 2,
        tenX: 3,
        twentyFiveX: 5,
        hundredX: 8,
        casinoRecord: 16,
        rivalVictory: 20,
        rivalFame: 50,
      };
      base.feed.limit = 40;
      base.feed.bigHitMultiplier = 50;
      base.feed.legendaryHitMultiplier = 250;
      base.feed.winningStreak = 3;
    }
    base.economy.startingPiar = draft.economy.startingPiar;
    setDraft(base);
    setNotice(
      `${id === "sakin" ? "Sakin" : id === "dengeli" ? "Dengeli" : "Hararetli"} rekabet paketi taslağa uygulandı. Kaydetmeden canlıya geçmez.`,
    );
  };
  const save = async () => {
    setBusy(true);
    setNotice("");
    try {
      const result = await saveCompetitionAdminConfig({
        config: draft,
        achievements,
        season: {
          name: season.name,
          endsAt: new Date(season.endsAt).toISOString(),
        },
        reason: "Muharrem Pehlevan rekabet ayarlarını güncelledi",
      });
      setState(result.state);
      setDraft(clone(result.state.config));
      setAchievements(clone(result.state.achievements));
      setNotice("Rekabet ayarları kaydedildi. Yeni turlara uygulanıyor.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Ayarlar kaydedilemedi.",
      );
    } finally {
      setBusy(false);
    }
  };
  const invalidate = async () => {
    if (!invalidating) return;
    setBusy(true);
    try {
      const result = await invalidateCompetitionRound(
        invalidating.eventId,
        reason,
      );
      setState(result.state);
      setInvalidating(undefined);
      setNotice(
        "Sonuç geçmişten silinmeden geçersiz kılındı ve bütün sıralamalar yeniden hesaplandı.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Sonuç geçersiz kılınamadı.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="competition-admin">
      <div className="admin-section-intro">
        <div>
          <small>META GAME / CANLI KUMANDA</small>
          <h2>Rekabet motoru</h2>
          <p>
            Bu ayarlar para ödeme matematiğini değiştirmez; sezon, şöhret,
            başarım, rekor ve sosyal rekabet hızını yönetir.
          </p>
        </div>
        <button onClick={() => void load()}>YENİLE</button>
      </div>
      {notice && <div className="competition-admin-notice">{notice}</div>}
      <section className="competition-presets">
        <header>
          <div>
            <small>HAZIR PAKETLER</small>
            <h3>Tek hamlede rekabet karakteri</h3>
          </div>
          <span>Önce taslağa uygulanır, kaydettiğinde canlıya geçer.</span>
        </header>
        <div>
          <button onClick={() => preset("sakin")}>
            <b>SAKİN</b>
            <small>Daha az bildirim ve daha ağır sezon ilerlemesi.</small>
          </button>
          <button onClick={() => preset("dengeli")}>
            <b>DENGELİ</b>
            <small>Brief için önerilen varsayılan değerler.</small>
          </button>
          <button onClick={() => preset("hararetli")}>
            <b>HARARETLİ</b>
            <small>
              Rekor, rakip ve güçlü vuruşlar sezonu daha hızlı hareket ettirir.
            </small>
          </button>
        </div>
      </section>
      <div className="competition-admin-grid">
        <section>
          <header>
            <small>EKONOMİ VE SEZON</small>
            <h3>Ana çerçeve</h3>
          </header>
          <Numeric
            label="Yeni hesap başlangıç PR"
            value={draft.economy.startingPiar}
            onChange={(value) => patch("economy", "startingPiar", value)}
            help="Yeni üyelik onay ekranındaki varsayılan başlangıç kasası."
          />
          <Numeric
            label="Varsayılan sezon süresi"
            value={draft.season.durationDays}
            min={1}
            max={365}
            onChange={(value) => patch("season", "durationDays", value)}
            help="Yeni sezon açıldığında kullanılacak gün sayısı."
          />
          <label className="competition-admin-field">
            <span>
              Haftalık yarış saat dilimi
              <small>
                Rakip, haftalık kâr ve PR Times pazartesi sınırını buna göre
                kullanır. Değişince geçmiş haftalık tablolar yeniden kurulur.
              </small>
            </span>
            <select
              value={draft.schedule.timeZone}
              onChange={(event) =>
                patch("schedule", "timeZone", event.target.value)
              }
            >
              <option value="Europe/Istanbul">İstanbul</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Londra</option>
              <option value="America/New_York">New York</option>
            </select>
          </label>
          <label className="competition-admin-field">
            <span>
              Aktif sezon adı<small>Yalnız mevcut sezonu değiştirir.</small>
            </span>
            <input
              value={season.name}
              onChange={(event) =>
                setSeason((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="competition-admin-field">
            <span>
              Aktif sezon bitişi
              <small>Bitişte sonuçlar Hall of Fame'e mühürlenir.</small>
            </span>
            <input
              type="datetime-local"
              value={season.endsAt}
              onChange={(event) =>
                setSeason((current) => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
            />
          </label>
        </section>
        <section>
          <header>
            <small>SEZON PUANLAMASI</small>
            <h3>Neyin ne kadar değeri var?</h3>
          </header>
          <Numeric
            label="5× vuruş"
            value={draft.scoring.fiveX}
            onChange={(value) => patch("scoring", "fiveX", value)}
            help="Sıradan minimum bahis spamini ödüllendirmemek için düşük tutulmalı."
          />
          <Numeric
            label="10× vuruş"
            value={draft.scoring.tenX}
            onChange={(value) => patch("scoring", "tenX", value)}
            help="Anlamlı ama sık görülebilen sonuç."
          />
          <Numeric
            label="25× vuruş"
            value={draft.scoring.twentyFiveX}
            onChange={(value) => patch("scoring", "twentyFiveX", value)}
            help="Güçlü tur sezon puanı."
          />
          <Numeric
            label="100× vuruş"
            value={draft.scoring.hundredX}
            onChange={(value) => patch("scoring", "hundredX", value)}
            help="Nadir büyük sonuç sezon puanı."
          />
          <Numeric
            label="Casino rekoru"
            value={draft.scoring.casinoRecord}
            onChange={(value) => patch("scoring", "casinoRecord", value)}
            help="Yeni all-time record başına verilir."
          />
          <Numeric
            label="Rakip galibiyeti"
            value={draft.scoring.rivalVictory}
            onChange={(value) => patch("scoring", "rivalVictory", value)}
            help="Haftalık hesap kapanınca kazanana verilir."
          />
        </section>
        <section>
          <header>
            <small>BAŞARIM EŞİKLERİ</small>
            <h3>Zorluk kapıları</h3>
          </header>
          <Numeric
            label="On Kat başarım eşiği"
            value={draft.thresholds.tenX}
            onChange={(value) => patch("thresholds", "tenX", value)}
            help="Genel 10× başarımının açılacağı çarpan."
          />
          <Numeric
            label="Yüz Kat başarım eşiği"
            value={draft.thresholds.hundredX}
            onChange={(value) => patch("thresholds", "hundredX", value)}
            help="Genel nadir çarpan başarımının eşiği."
          />
          <Numeric
            label="Leviathan balık çarpanı"
            value={draft.thresholds.leviathan}
            onChange={(value) => patch("thresholds", "leviathan", value)}
            help="Kaptan Mercan'ın en nadir başarımı."
          />
          <Numeric
            label="Şeker Fırtınası cascade"
            value={draft.thresholds.sugarCascade}
            onChange={(value) => patch("thresholds", "sugarCascade", value)}
            help="Şekerhane'de gereken patlama zinciri."
          />
          <Numeric
            label="Neon Patronu çarpanı"
            value={draft.thresholds.neonMultiplier}
            onChange={(value) => patch("thresholds", "neonMultiplier", value)}
            help="Neon Kasası başarı eşiği."
          />
          <Numeric
            label="Mines güvenli hücre"
            value={draft.thresholds.minesTiles}
            onChange={(value) => patch("thresholds", "minesTiles", value)}
            help="Yıkım Uzmanı için gereken hücre."
          />
          <Numeric
            label="Pilot cashout çarpanı"
            value={draft.thresholds.pilotCashout}
            onChange={(value) => patch("thresholds", "pilotCashout", value)}
            help="Altın Rota başarı eşiği."
          />
          <Numeric
            label="Comeback düşüş oranı"
            value={draft.thresholds.comebackDropRatio}
            min={0.01}
            max={0.95}
            step={0.01}
            onChange={(value) =>
              patch("thresholds", "comebackDropRatio", value)
            }
            help="0,20: zirvenin %20'sine düşüp geri dönmeli."
          />
        </section>
        <section>
          <header>
            <small>OYUN USTALIĞI</small>
            <h3>XP basamakları</h3>
          </header>
          <Numeric
            label="Silver"
            value={draft.mastery.silver}
            onChange={(value) => patch("mastery", "silver", value)}
            help="İlk uzmanlaşma seviyesi."
          />
          <Numeric
            label="Gold"
            value={draft.mastery.gold}
            onChange={(value) => patch("mastery", "gold", value)}
            help="Pasaport ve profil için güçlü seviye."
          />
          <Numeric
            label="Diamond"
            value={draft.mastery.diamond}
            onChange={(value) => patch("mastery", "diamond", value)}
            help="Nadir uzmanlık."
          />
          <Numeric
            label="Legendary"
            value={draft.mastery.legendary}
            onChange={(value) => patch("mastery", "legendary", value)}
            help="Uzun süreli kariyer hedefi."
          />
          <label className="competition-admin-toggle">
            <span>
              Players vs House
              <small>
                Kapanışta katkı veren oyunculara kozmetik başarım verir.
              </small>
            </span>
            <input
              type="checkbox"
              checked={draft.playersVsHouse.enabled}
              onChange={(event) =>
                patch("playersVsHouse", "enabled", event.target.checked)
              }
            />
          </label>
          <label className="competition-admin-toggle">
            <span>
              Casino Live akışı
              <small>
                Kapatıldığında olay geçmişi korunur fakat oyuncuya gösterilmez.
              </small>
            </span>
            <input
              type="checkbox"
              checked={draft.feed.enabled}
              onChange={(event) =>
                patch("feed", "enabled", event.target.checked)
              }
            />
          </label>
          <Numeric
            label="Casino Live kayıt sayısı"
            value={draft.feed.limit}
            min={5}
            max={100}
            onChange={(value) => patch("feed", "limit", value)}
            help="Oyuncuya gösterilecek son anlamlı olay adedi."
          />
          <Numeric
            label="Tekrar susturma süresi"
            value={draft.feed.repeatWindowMinutes}
            min={0}
            max={1440}
            onChange={(value) => patch("feed", "repeatWindowMinutes", value)}
            help="Aynı tür olayın akışı boğmaması için beklenecek dakika. Sıfır, susturmayı kapatır."
          />
          <Numeric
            label="Büyük vuruş eşiği"
            value={draft.feed.bigHitMultiplier}
            min={5}
            onChange={(value) => patch("feed", "bigHitMultiplier", value)}
            help="Bu çarpandan itibaren sonuç Casino Live akışına güçlü vuruş olarak girer."
          />
          <Numeric
            label="Efsanevi vuruş eşiği"
            value={draft.feed.legendaryHitMultiplier}
            min={5}
            onChange={(value) => patch("feed", "legendaryHitMultiplier", value)}
            help="Bu çarpandan itibaren aynı olay efsanevi vurgu ve görsel öncelik kazanır."
          />
          <Numeric
            label="Galibiyet serisi eşiği"
            value={draft.feed.winningStreak}
            min={2}
            max={100}
            onChange={(value) => patch("feed", "winningStreak", value)}
            help="Oyuncu bu kadar geçerli turu üst üste kazandığında Casino Live duyurusu oluşur."
          />
          <div className="competition-leaderboard-toggles">
            <small>LEADERBOARD GÖRÜNÜRLÜĞÜ</small>
            {Object.entries(draft.leaderboards).map(([key, enabled]) => (
              <label key={key}>
                <span>
                  {key.replace(/([A-Z])/g, " $1").toLocaleUpperCase("tr-TR")}
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    patch("leaderboards", key, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>
        </section>
      </div>
      <section className="competition-config-lists">
        <article>
          <header>
            <small>SERVET MİLESTONE'LARI</small>
            <h3>Kasa barajları</h3>
          </header>
          <div>
            {draft.milestones.map((milestone, index) => (
              <label key={`${milestone.titleId}:${index}`}>
                <span>
                  {milestone.titleId
                    .replaceAll("-", " ")
                    .toLocaleUpperCase("tr-TR")}
                </span>
                <input
                  type="number"
                  min="1"
                  value={milestone.value}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            milestones: current.milestones.map((item, i) =>
                              i === index
                                ? { ...item, value: Number(event.target.value) }
                                : item,
                            ),
                          }
                        : current,
                    )
                  }
                />
                <em>PR</em>
              </label>
            ))}
          </div>
        </article>
        <article>
          <header>
            <small>REKOR TANIMLARI</small>
            <h3>Hangi metrikler yarışsın?</h3>
          </header>
          <div>
            {Object.entries(draft.records).map(([key, enabled]) => (
              <label key={key}>
                <span>
                  {key.replace(/([A-Z])/g, " $1").toLocaleUpperCase("tr-TR")}
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) =>
                    patch("records", key, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>
        </article>
        <article className="competition-eligibility-list">
          <header>
            <small>REKABET UYGUNLUĞU</small>
            <h3>Kimler sıralama dışında?</h3>
          </header>
          <p>
            Seçilen hesapların oyun geçmişi korunur; yeni sonuçları sezon,
            rekor, taç ve sıralamalara girmez. Değişiklik kaydedilince
            türetilmiş tablolar yeniden hesaplanır.
          </p>
          <div>
            {state.users.map((user) => {
              const excluded = draft.eligibility.excludedUserIds.includes(
                user.id,
              );
              return (
                <label key={user.id}>
                  <span>
                    {user.displayName}
                    <small>{user.role.toLocaleUpperCase("tr-TR")}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={excluded}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              eligibility: {
                                excludedUserIds: event.target.checked
                                  ? [
                                      ...current.eligibility.excludedUserIds,
                                      user.id,
                                    ]
                                  : current.eligibility.excludedUserIds.filter(
                                      (id) => id !== user.id,
                                    ),
                              },
                            }
                          : current,
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        </article>
      </section>
      <section className="competition-achievement-admin">
        <header>
          <div>
            <small>BAŞARIM ÖDÜLLERİ</small>
            <h3>Şöhret ve sezon puanı</h3>
          </div>
          <span>
            Koşullar yukarıdaki eşiklerden, ödüller buradan yönetilir.
          </span>
        </header>
        <div>
          {achievements.map((achievement, index) => (
            <article key={achievement.id}>
              <i>
                {achievement.rarity === "mythic"
                  ? "✦"
                  : achievement.rarity === "legendary"
                    ? "◆"
                    : "◇"}
              </i>
              <span>
                <b>{achievement.name}</b>
                <small>{achievement.detail}</small>
              </span>
              <label>
                Şöhret
                <input
                  type="number"
                  min="0"
                  value={achievement.fame}
                  onChange={(event) =>
                    setAchievements((current) =>
                      current.map((item, i) =>
                        i === index
                          ? { ...item, fame: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Sezon
                <input
                  type="number"
                  min="0"
                  value={achievement.seasonPoints}
                  onChange={(event) =>
                    setAchievements((current) =>
                      current.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              seasonPoints: Number(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            </article>
          ))}
        </div>
      </section>
      <section className="competition-admin-history">
        <header>
          <div>
            <small>OTOMATİK KAPANIŞLAR</small>
            <h3>House ve rakip geçmişi</h3>
          </div>
        </header>
        <div>
          <article>
            <h4>PLAYERS VS HOUSE</h4>
            {state.houseHistory.length ? (
              state.houseHistory.map((item) => (
                <span key={item.event_id}>
                  <b>
                    {item.players_won ? "OYUNCULAR KAZANDI" : "KASA KAZANDI"}
                  </b>
                  <small>
                    {item.name} · {item.participants} oyuncu
                  </small>
                  <em>
                    {number.format(item.playersNet)} /{" "}
                    {number.format(item.houseNet)} PR
                  </em>
                </span>
              ))
            ) : (
              <p>Henüz kapanmış hafta yok.</p>
            )}
          </article>
          <article>
            <h4>HAFTALIK RAKİPLER</h4>
            {state.rivalHistory.length ? (
              state.rivalHistory.slice(0, 12).map((item) => (
                <span key={`${item.week_key}:${item.user_id}`}>
                  <b>
                    {item.displayName} ·{" "}
                    {item.result === "win"
                      ? "KAZANDI"
                      : item.result === "loss"
                        ? "KAYBETTİ"
                        : "BERABERE"}
                  </b>
                  <small>
                    {item.rivalName} karşısında · {item.week_key}
                  </small>
                  <em>
                    {number.format(item.playerProfit)} /{" "}
                    {number.format(item.rivalProfit)} PR
                  </em>
                </span>
              ))
            ) : (
              <p>İlk hafta bittiğinde sonuçlar burada görünür.</p>
            )}
          </article>
        </div>
      </section>
      <SocialCompetitionAdmin />
      <section className="competition-telemetry-audit">
        <header>
          <div>
            <small>OYUN VERİ SÖZLEŞMELERİ</small>
            <h3>Tur telemetrisi sağlık kontrolü</h3>
          </div>
          <span>Her oyunun son 20 geçerli kaydı otomatik denetlenir.</span>
        </header>
        <div>
          {state.telemetry.map((item) => (
            <article className={item.status} key={item.gameId}>
              <i />
              <span>
                <b>{item.label}</b>
                <small>
                  {item.status === "healthy"
                    ? "SÖZLEŞME TAM"
                    : item.status === "warning"
                      ? `EKSİK: ${item.missing.map((entry) => entry.field).join(", ") || "eski kayıt"}`
                      : item.status === "legacy"
                        ? "ESKİ FORMAT · YENİ TUR BEKLENİYOR"
                        : "HENÜZ TUR YOK"}
                </small>
              </span>
              <strong>
                {item.complete}/{item.rounds}
                <small>TAM KAYIT</small>
              </strong>
            </article>
          ))}
        </div>
      </section>
      <section className="competition-settlements">
        <header>
          <div>
            <small>BÜTÜNLÜK / AUDIT</small>
            <h3>Son rekabet sonuçları</h3>
          </div>
          <span>Silme yoktur; hatalı sonuç gerekçeyle geçersiz kılınır.</span>
        </header>
        <div>
          {state.settlements.slice(0, 40).map((item) => (
            <article
              className={item.invalidatedAt ? "invalidated" : ""}
              key={item.eventId}
            >
              <time>{new Date(item.settledAt).toLocaleString("tr-TR")}</time>
              <span>
                <b>{item.displayName}</b>
                <small>
                  {gameNames[item.gameId] || item.gameId} · {item.roundId}
                </small>
              </span>
              <em>
                {number.format(item.wager)} → {number.format(item.payout)} PR
              </em>
              {item.invalidatedAt ? (
                <strong>GEÇERSİZ · {item.invalidationReason}</strong>
              ) : (
                <button
                  onClick={() => {
                    setInvalidating(item);
                    setReason("Rekabet bütünlüğü düzeltmesi");
                  }}
                >
                  GEÇERSİZ KIL
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
      <footer className="competition-admin-save">
        <div>
          <small>DEĞİŞİKLİK POLİTİKASI</small>
          <b>
            Ayarlar geçmiş sonucu sessizce değiştirmez. Yeni turlara uygulanır.
          </b>
        </div>
        <button disabled={busy} onClick={() => void save()}>
          {busy ? "İŞLENİYOR…" : "REKABET AYARLARINI KAYDET"}
        </button>
      </footer>
      {invalidating && (
        <div className="competition-invalidate-backdrop">
          <section>
            <small>SONUCU GEÇERSİZ KIL</small>
            <h3>
              {invalidating.displayName} ·{" "}
              {gameNames[invalidating.gameId] || invalidating.gameId}
            </h3>
            <p>
              Sonuç silinmeyecek; gerekçesiyle işaretlenip bütün aggregate,
              başarım, rekor ve sıralamalar yeniden hesaplanacak.
            </p>
            <label>
              Gerekçe
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div>
              <button onClick={() => setInvalidating(undefined)}>VAZGEÇ</button>
              <button
                className="danger"
                disabled={busy || reason.trim().length < 3}
                onClick={() => void invalidate()}
              >
                GEÇERSİZ KIL VE YENİDEN HESAPLA
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
