import { useEffect, useMemo, useState } from "react";
import {
  getCompetitionDashboard,
  getCompetitionProfile,
  setCompetitionShowcase,
  setCompetitionTitle,
  type CompetitionDashboard,
  type LeaderboardEntry,
  type PublicCompetitionProfile,
} from "../meta/meta-api";
import { sharePiarTimesCard } from "../meta/piar-times-card";
import "./competition-center.css";
import CasinoAvatar from "./CasinoAvatar";
import {
  AvatarPicker,
  ClubsPage,
  PokerCareerPage,
} from "./SocialCompetitionPages";

type Tab =
  | "overview"
  | "leaderboards"
  | "records"
  | "career"
  | "clubs"
  | "poker"
  | "season"
  | "hall";
type Board =
  | "wealth"
  | "profit"
  | "seasonProfit"
  | "weekly"
  | "growth"
  | "crown"
  | "season"
  | "career";

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const boards: Record<Board, { label: string; note: string }> = {
  wealth: { label: "En Zenginler", note: "Geçerli rekabet kasası" },
  profit: { label: "Net Kâr", note: "Tüm zamanlar" },
  seasonProfit: { label: "Sezon Kârı", note: "Bu sezonun gerçek oyun neti" },
  weekly: { label: "Haftalık Kâr", note: "Pazartesi sıfırlanır" },
  growth: { label: "Bankroll Growth", note: "Başlangıç kasasına göre" },
  crown: { label: "Taç Süresi", note: "Kasa tacını taşıma süresi" },
  season: { label: "Sezon", note: "Başarı odaklı yarış" },
  career: { label: "Kariyer", note: "Ömür boyu şöhret" },
};
const tabs: Array<[Tab, string]> = [
  ["overview", "MERKEZ"],
  ["leaderboards", "SIRALAMALAR"],
  ["records", "REKORLAR"],
  ["career", "KARİYER"],
  ["clubs", "KULÜPLER"],
  ["poker", "POKER"],
  ["season", "SEZON"],
  ["hall", "TARİH"],
];

function remaining(ms: number) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return `${days} gün ${hours} saat`;
}
function duration(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days}g ${hours}s` : `${hours}s`;
}
function score(entry?: LeaderboardEntry) {
  if (!entry) return "—";
  if (entry.valueType === "PR") return `${compact.format(entry.score)} PR`;
  if (entry.valueType === "POINT") return `${number.format(entry.score)} SP`;
  if (entry.valueType === "FAME") return `${number.format(entry.score)} ŞÖHRET`;
  if (entry.valueType === "RATIO") return `${number.format(entry.score)}×`;
  return duration(entry.score);
}
function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

function RankList({
  entries,
  selfId,
  onPlayer,
}: {
  entries: LeaderboardEntry[];
  selfId: string;
  onPlayer: (id: string) => void;
}) {
  return (
    <div className="competition-rank-list">
      {entries.map((entry) => (
        <button
          className={entry.userId === selfId ? "is-self" : ""}
          key={entry.userId}
          onClick={() => onPlayer(entry.userId)}
        >
          <em>#{entry.rank}</em>
          <i>{initials(entry.displayName)}</i>
          <span>
            <b>{entry.displayName}</b>
            <small>{entry.title || "Unvansız"}</small>
          </span>
          <strong>{score(entry)}</strong>
        </button>
      ))}
    </div>
  );
}

function BankrollGraph({ rows }: { rows: CompetitionDashboard["snapshots"] }) {
  const points = useMemo(() => {
    if (!rows.length) return "";
    const values = rows.map((row) => row.close);
    const min = Math.min(...values),
      max = Math.max(...values),
      range = Math.max(1, max - min);
    return values
      .map(
        (value, index) =>
          `${(index / Math.max(1, values.length - 1)) * 100},${90 - ((value - min) / range) * 75}`,
      )
      .join(" ");
  }, [rows]);
  return (
    <div className="bankroll-graph">
      <header>
        <span>KASA HİKÂYESİ</span>
        <b>
          {rows.length
            ? `${compact.format(rows[0].open)} → ${compact.format(rows.at(-1)!.close)} PR`
            : "İlk kayıt bekleniyor"}
        </b>
      </header>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bankroll-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8b55d" stopOpacity=".4" />
            <stop offset="1" stopColor="#e8b55d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points && (
          <>
            <polygon
              points={`0,100 ${points} 100,100`}
              fill="url(#bankroll-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#efbe66"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
    </div>
  );
}

function ProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PublicCompetitionProfile>();
  const [error, setError] = useState("");
  useEffect(() => {
    setData(undefined);
    setError("");
    void getCompetitionProfile(userId)
      .then(setData)
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Profil açılamadı.",
        ),
      );
  }, [userId]);
  return (
    <div className="profile-modal-backdrop" onMouseDown={onClose}>
      <section
        className="public-profile-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="profile-close" onClick={onClose}>
          ×
        </button>
        {error ? (
          <p>{error}</p>
        ) : !data ? (
          <div className="profile-loading">Oyuncu dosyası açılıyor…</div>
        ) : (
          <>
            <header>
              <CasinoAvatar
                avatarId={data.profile.user.avatarId}
                userId={data.profile.user.id}
                name={data.profile.user.displayName}
              />
              <div>
                <small>CASINO KARİYER DOSYASI</small>
                <h2>{data.profile.user.displayName}</h2>
                <p>
                  {data.profile.career.title || "Unvansız"} ·{" "}
                  {data.profile.career.fame} şöhret
                  {data.profile.user.role !== "player" && (
                    <b className="profile-role-badge">
                      MUHARREM PEHLEVAN · YÖNETİM
                    </b>
                  )}
                </p>
              </div>
            </header>
            <div className="public-profile-ranks">
              <span>
                <small>SERVET</small>
                <b>#{data.ranks.wealth?.rank ?? "—"}</b>
              </span>
              <span>
                <small>SEZON</small>
                <b>#{data.ranks.season?.rank ?? "—"}</b>
              </span>
              <span>
                <small>KARİYER</small>
                <b>#{data.ranks.career?.rank ?? "—"}</b>
              </span>
            </div>
            <div className="public-profile-stats">
              <span>
                <small>KASA</small>
                <b>
                  {compact.format(
                    data.profile.account?.competitiveBalance ?? 0,
                  )}{" "}
                  PR
                </b>
              </span>
              <span>
                <small>KARİYER NETİ</small>
                <b>{compact.format(data.profile.stats.netProfit)} PR</b>
              </span>
              <span>
                <small>EN BÜYÜK VURUŞ</small>
                <b>{number.format(data.profile.stats.maxMultiplier)}×</b>
              </span>
              <span>
                <small>FAVORİ OYUN</small>
                <b>{data.profile.stats.favoriteGame || "—"}</b>
              </span>
              <span>
                <small>REKOR</small>
                <b>{data.profile.recordsOwned}</b>
              </span>
              <span>
                <small>TAÇ SÜRESİ</small>
                <b>{duration(data.profile.crown.totalSeconds)}</b>
              </span>
              <span>
                <small>BAŞLANGIÇ KASASI</small>
                <b>
                  {compact.format(data.profile.account?.startingBalance ?? 0)}{" "}
                  PR
                </b>
              </span>
              <span>
                <small>KASA BÜYÜMESİ</small>
                <b>{number.format(data.profile.account?.growth ?? 0)}×</b>
              </span>
              <span>
                <small>SEZON ŞAMPİYONLUĞU</small>
                <b>{data.profile.career.championships}</b>
              </span>
            </div>
            {data.profile.multiplayer.find(
              (item) => item.gameId === "poker",
            ) && (
              <div className="public-poker-record">
                <small>POKER KARİYERİ</small>
                <b>
                  {
                    data.profile.multiplayer.find(
                      (item) => item.gameId === "poker",
                    )!.rating
                  }{" "}
                  RATING
                </b>
                <span>
                  {
                    data.profile.multiplayer.find(
                      (item) => item.gameId === "poker",
                    )!.wins
                  }{" "}
                  galibiyet ·{" "}
                  {
                    data.profile.multiplayer.find(
                      (item) => item.gameId === "poker",
                    )!.tournamentWins
                  }{" "}
                  şampiyonluk
                </span>
              </div>
            )}
            <div className="public-showcase">
              <small>VİTRİN</small>
              {data.profile.showcase.length ? (
                <div>
                  {data.profile.showcase.map((entry) => (
                    <article key={entry.slot}>
                      <i>
                        {entry.item.itemType === "achievement"
                          ? "◆"
                          : entry.item.itemType === "mastery"
                            ? "◇"
                            : "♜"}
                      </i>
                      <b>{entry.item.label}</b>
                      <span>{entry.item.detail}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p>Henüz vitrine parça koymadı.</p>
              )}
            </div>
            <div className="public-career-history">
              <section>
                <small>SAHİP OLDUĞU REKORLAR</small>
                {data.profile.ownedRecords.length ? (
                  data.profile.ownedRecords.slice(0, 6).map((record) => (
                    <span key={`${record.gameId}:${record.metricId}`}>
                      <b>{record.gameLabel}</b>
                      <em>{record.metricLabel}</em>
                      <strong>{number.format(record.value)}</strong>
                    </span>
                  ))
                ) : (
                  <p>Yaşayan casino rekoru yok.</p>
                )}
              </section>
              <section>
                <small>SEZON GEÇMİŞİ</small>
                {data.profile.seasonHistory.length ? (
                  data.profile.seasonHistory.map((season) => (
                    <span key={`${season.name}:${season.endsAt}`}>
                      <b>{season.name}</b>
                      <em>
                        #{season.rank} · {season.seasonPoints} SP
                      </em>
                      <strong>{compact.format(season.netProfit)} PR</strong>
                    </span>
                  ))
                ) : (
                  <p>İlk sezon hâlâ devam ediyor.</p>
                )}
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ShowcaseEditor({
  dashboard,
  reload,
}: {
  dashboard: CompetitionDashboard;
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState(() =>
    dashboard.profile.showcase.map(
      (entry) => `${entry.item_type}:${entry.item_id}`,
    ),
  );
  const [saving, setSaving] = useState(false);
  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : current.length < 3
          ? [...current, key]
          : current,
    );
  const save = async () => {
    setSaving(true);
    try {
      await setCompetitionShowcase(
        selected.map((key) => {
          const [itemType, ...rest] = key.split(":");
          return { itemType, itemId: rest.join(":") };
        }),
      );
      await reload();
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="career-section showcase-editor">
      <header>
        <div>
          <small>KUPA VİTRİNİ</small>
          <h2>Üç parçayla kim olduğunu göster.</h2>
        </div>
        <button disabled={saving} onClick={() => void save()}>
          {saving ? "KAYDEDİLİYOR" : "VİTRİNİ KAYDET"}
        </button>
      </header>
      <div>
        {dashboard.profile.showcaseCatalog.map((item) => {
          const key = `${item.itemType}:${item.itemId}`;
          return (
            <button
              className={selected.includes(key) ? "selected" : ""}
              key={key}
              onClick={() => toggle(key)}
            >
              <i>
                {item.itemType === "achievement"
                  ? "◆"
                  : item.itemType === "mastery"
                    ? "◇"
                    : "♜"}
              </i>
              <b>{item.label}</b>
              <span>{item.detail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function CompetitionCenter({ onExit }: { onExit: () => void }) {
  const [dashboard, setDashboard] = useState<CompetitionDashboard>();
  const [tab, setTab] = useState<Tab>("overview");
  const [board, setBoard] = useState<Board>("wealth");
  const [recordScope, setRecordScope] = useState<"all" | "season">("all");
  const [profileId, setProfileId] = useState<string>();
  const [error, setError] = useState("");
  const [newspaperNotice, setNewspaperNotice] = useState("");
  const load = async () => {
    try {
      setDashboard(await getCompetitionDashboard());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Rekabet merkezi açılamadı.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  if (!dashboard)
    return (
      <main className="competition-shell competition-loading">
        <i />
        {error ? (
          <>
            <p>{error}</p>
            <button onClick={() => void load()}>TEKRAR DENE</button>
          </>
        ) : (
          <p>Casino kayıtları hazırlanıyor…</p>
        )}
      </main>
    );
  const enabledBoards = (Object.keys(boards) as Board[]).filter(
    (key) => dashboard.config.runtime.leaderboards[key] !== false,
  );
  const selectedBoard = enabledBoards.includes(board)
    ? board
    : (enabledBoards[0] ?? "wealth");
  const selfId = dashboard.profile.user.id,
    currentBoard = dashboard.leaderboards[selectedBoard],
    records =
      recordScope === "all" ? dashboard.records : dashboard.seasonRecords;
  const groupedPassport = Object.entries(
    dashboard.passport.reduce<Record<string, CompetitionDashboard["passport"]>>(
      (groups, item) => {
        (groups[item.gameId] ??= []).push(item);
        return groups;
      },
      {},
    ),
  );
  const houseWinning =
    dashboard.houseEvent.playersNet >= dashboard.houseEvent.houseNet;
  return (
    <main className="competition-shell">
      <header className="competition-topbar">
        <button className="competition-brand" onClick={onExit}>
          <i>MP</i>
          <span>
            PEHLEVAN ROYALE<small>REKABET MERKEZİ</small>
          </span>
        </button>
        <nav>
          {tabs.map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="competition-user">
          <CasinoAvatar
            avatarId={dashboard.profile.user.avatarId}
            userId={dashboard.profile.user.id}
            name={dashboard.profile.user.displayName}
          />
          <div>
            <strong>{dashboard.profile.user.displayName}</strong>
            <small>{dashboard.profile.career.title || "UNVANSIZ"}</small>
          </div>
          <button onClick={onExit}>SALONA DÖN</button>
        </div>
      </header>

      {tab === "overview" && (
        <div className="competition-page">
          <section className="competition-hero">
            <div>
              <small>
                CASINO KARİYERİ /{" "}
                {dashboard.season.name.toLocaleUpperCase("tr-TR")}
              </small>
              <h1>
                Masada para,
                <br />
                <em>salonda itibar.</em>
              </h1>
              <p>
                Her oyun aynı büyük hesaplaşmanın parçası. Kasayı büyüt, rekoru
                al, rakibini geç.
              </p>
            </div>
            <aside>
              <small>KASA TACINI TAŞIYAN</small>
              <i>♛</i>
              <strong>{dashboard.crown?.displayName || "Taç sahipsiz"}</strong>
              <span>
                {dashboard.crown
                  ? `${compact.format(dashboard.crown.balance)} PR ile zirvede`
                  : "İlk patron bekleniyor"}
              </span>
            </aside>
          </section>
          <section className="competition-stat-ribbon">
            <article>
              <small>REKABET KASAN</small>
              <strong>
                {compact.format(
                  dashboard.profile.account?.competitiveBalance ?? 0,
                )}{" "}
                <em>PR</em>
              </strong>
              <span>
                zirve{" "}
                {compact.format(dashboard.profile.account?.peakBalance ?? 0)} PR
              </span>
            </article>
            <article>
              <small>SERVET SIRAN</small>
              <strong>
                #{dashboard.leaderboards.wealth.self?.rank ?? "—"}
              </strong>
              <span>
                {dashboard.leaderboards.wealth.top[0]?.displayName} lider
              </span>
            </article>
            <article>
              <small>SEZON SIRAN</small>
              <strong>
                #{dashboard.leaderboards.season.self?.rank ?? "—"}
              </strong>
              <span>
                {number.format(dashboard.leaderboards.season.self?.score ?? 0)}{" "}
                sezon puanı
              </span>
            </article>
            <article>
              <small>ŞÖHRET</small>
              <strong>{number.format(dashboard.profile.career.fame)}</strong>
              <span>{dashboard.profile.career.title || "İlk ünvanı aç"}</span>
            </article>
            <article>
              <small>SEZON BİTİŞİ</small>
              <strong>
                {remaining(dashboard.season.remainingMs).split(" ")[0]}{" "}
                <em>GÜN</em>
              </strong>
              <span>{remaining(dashboard.season.remainingMs)}</span>
            </article>
          </section>
          <div className="competition-overview-grid">
            <section className="overview-board">
              <header>
                <div>
                  <small>ANA LİSTE</small>
                  <h2>En Zenginler</h2>
                </div>
                <button
                  onClick={() => {
                    setBoard("wealth");
                    setTab("leaderboards");
                  }}
                >
                  TÜM LİSTE →
                </button>
              </header>
              <RankList
                entries={dashboard.leaderboards.wealth.top.slice(0, 5)}
                selfId={selfId}
                onPlayer={setProfileId}
              />
            </section>
            <section className="rival-card">
              <header>
                <small>BU HAFTAKİ HESAPLAŞMAN</small>
                <b>⚔</b>
              </header>
              {dashboard.rival?.rival ? (
                <>
                  <div className="rival-faces">
                    <button onClick={() => setProfileId(selfId)}>
                      <CasinoAvatar
                        avatarId={dashboard.profile.user.avatarId}
                        userId={dashboard.profile.user.id}
                        name={dashboard.profile.user.displayName}
                      />
                      <b>{dashboard.profile.user.displayName}</b>
                    </button>
                    <em>VS</em>
                    <button
                      onClick={() =>
                        setProfileId(dashboard.rival!.rival!.userId)
                      }
                    >
                      <i>{initials(dashboard.rival.rival.displayName)}</i>
                      <b>{dashboard.rival.rival.displayName}</b>
                    </button>
                  </div>
                  <div className="rival-numbers">
                    <span>
                      <small>HAFTALIK KÂR</small>
                      <b>
                        {compact.format(
                          dashboard.rival.player?.weeklyProfit ?? 0,
                        )}{" "}
                        PR
                      </b>
                    </span>
                    <i>
                      {Math.abs(
                        (dashboard.rival.player?.weeklyProfit ?? 0) -
                          dashboard.rival.rival.weeklyProfit,
                      ) < 1000
                        ? "BURUN BURUNA"
                        : "FARK KAPANIYOR"}
                    </i>
                    <span>
                      <small>HAFTALIK KÂR</small>
                      <b>
                        {compact.format(dashboard.rival.rival.weeklyProfit)} PR
                      </b>
                    </span>
                  </div>
                </>
              ) : (
                <p>Yakın rakip için en az iki aktif oyuncu gerekiyor.</p>
              )}
            </section>
            <section
              className={`house-event ${houseWinning ? "players-ahead" : "house-ahead"}`}
            >
              <header>
                <div>
                  <small>HAFTALIK ORTAK HESAPLAŞMA</small>
                  <h2>Players vs House</h2>
                </div>
                <b>{houseWinning ? "THE HOUSE IS FALLING" : "HOUSE AHEAD"}</b>
              </header>
              <div>
                <span>
                  <small>OYUNCULAR</small>
                  <strong>
                    {dashboard.houseEvent.playersNet >= 0 ? "+" : ""}
                    {compact.format(dashboard.houseEvent.playersNet)} PR
                  </strong>
                </span>
                <i>VS</i>
                <span>
                  <small>KASA</small>
                  <strong>
                    {dashboard.houseEvent.houseNet >= 0 ? "+" : ""}
                    {compact.format(dashboard.houseEvent.houseNet)} PR
                  </strong>
                </span>
              </div>
              <footer>
                {number.format(dashboard.houseEvent.eligibleRounds)} geçerli tur
                · {remaining(dashboard.houseEvent.remainingMs)} kaldı
              </footer>
            </section>
            <section className="live-feed">
              <header>
                <div>
                  <small>CASINO LIVE</small>
                  <h2>Salonda ne oluyor?</h2>
                </div>
                <i className="live-dot" />
              </header>
              <div>
                {dashboard.feed.slice(0, 8).map((event) => (
                  <button
                    className={event.severity}
                    key={event.id}
                    onClick={() => event.user_id && setProfileId(event.user_id)}
                  >
                    <i>
                      {event.type === "new-record"
                        ? "♛"
                        : event.type === "achievement"
                          ? "◆"
                          : event.type === "crown-gained"
                            ? "♜"
                            : "●"}
                    </i>
                    <p>
                      {event.message}
                      <small>
                        {new Date(event.occurred_at).toLocaleString("tr-TR")}
                      </small>
                    </p>
                  </button>
                ))}
              </div>
            </section>
            <section className="piar-times">
              <header>
                <div>
                  <small>HAFTALIK BÜLTEN</small>
                  <h2>THE PR TIMES</h2>
                  <span>{dashboard.newspaper.weekKey}</span>
                </div>
                <button
                  disabled={newspaperNotice === "HAZIRLANIYOR"}
                  onClick={() => {
                    setNewspaperNotice("HAZIRLANIYOR");
                    void sharePiarTimesCard(dashboard)
                      .then(setNewspaperNotice)
                      .catch((reason) =>
                        setNewspaperNotice(
                          reason instanceof Error
                            ? reason.message
                            : "Kart hazırlanamadı.",
                        ),
                      );
                  }}
                >
                  {newspaperNotice === "HAZIRLANIYOR"
                    ? "HAZIRLANIYOR…"
                    : "PAYLAŞ / PNG"}
                </button>
              </header>
              <div>
                <article>
                  <small>EN ZENGİN</small>
                  <b>{dashboard.newspaper.richest?.displayName || "—"}</b>
                  <span>{score(dashboard.newspaper.richest)}</span>
                </article>
                <article>
                  <small>HAFTANIN KAZANANI</small>
                  <b>{dashboard.newspaper.weeklyWinner?.displayName || "—"}</b>
                  <span>{score(dashboard.newspaper.weeklyWinner)}</span>
                </article>
                <article>
                  <small>HAFTANIN OYUNU</small>
                  <b>
                    {dashboard.config.games[
                      dashboard.newspaper.hotGame?.gameId ?? ""
                    ]?.label || "—"}
                  </b>
                  <span>{dashboard.newspaper.hotGame?.count ?? 0} tur</span>
                </article>
                <article>
                  <small>EN BÜYÜK VURUŞ</small>
                  <b>{dashboard.newspaper.biggestHit?.displayName || "—"}</b>
                  <span>
                    {dashboard.newspaper.biggestHit
                      ? `${compact.format(dashboard.newspaper.biggestHit.payout)} PR`
                      : "—"}
                  </span>
                </article>
                <article>
                  <small>HAFTANIN GERİ DÖNÜŞÜ</small>
                  <b>{dashboard.newspaper.comeback?.displayName || "—"}</b>
                  <span>
                    {dashboard.newspaper.comeback
                      ? `${compact.format(dashboard.newspaper.comeback.trough)} → ${compact.format(dashboard.newspaper.comeback.anchor)} PR`
                      : "—"}
                  </span>
                </article>
                <article>
                  <small>EN YAKIN HESAPLAŞMA</small>
                  <b>
                    {dashboard.newspaper.closestRace
                      ? `${dashboard.newspaper.closestRace.displayName} / ${dashboard.newspaper.closestRace.rivalName}`
                      : "—"}
                  </b>
                  <span>
                    {dashboard.newspaper.closestRace
                      ? `${compact.format(dashboard.newspaper.closestRace.gap)} PR fark`
                      : "—"}
                  </span>
                </article>
              </div>
              {newspaperNotice && newspaperNotice !== "HAZIRLANIYOR" && (
                <p className="piar-times-notice">{newspaperNotice}</p>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "leaderboards" && (
        <div className="competition-page leaderboard-page">
          <header className="page-heading">
            <small>PARA / PERFORMANS / KARİYER</small>
            <h1>Hesaplaşmanın tamamı.</h1>
            <p>Global zirveyi ve hemen çevrendeki oyuncuları aynı anda gör.</p>
          </header>
          <div className="board-tabs">
            {enabledBoards.map((key) => (
              <button
                className={selectedBoard === key ? "active" : ""}
                onClick={() => setBoard(key)}
                key={key}
              >
                <b>{boards[key].label}</b>
                <small>{boards[key].note}</small>
              </button>
            ))}
          </div>
          <section className="full-leaderboard">
            <header>
              <div>
                <small>{boards[selectedBoard].note}</small>
                <h2>{boards[selectedBoard].label}</h2>
              </div>
              <span>
                GÜNCEL ·{" "}
                {new Date(dashboard.generatedAt).toLocaleTimeString("tr-TR")}
              </span>
            </header>
            <RankList
              entries={currentBoard.top}
              selfId={selfId}
              onPlayer={setProfileId}
            />
            {currentBoard.self && currentBoard.self.rank > 10 && (
              <div className="your-neighborhood">
                <small>SENİN HESAPLAŞMAN</small>
                <RankList
                  entries={currentBoard.around}
                  selfId={selfId}
                  onPlayer={setProfileId}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "records" && (
        <div className="competition-page records-page">
          <header className="page-heading">
            <small>RECORD HOLDER / PERSONAL BEST</small>
            <h1>Duvara adını yaz.</h1>
            <p>
              Her rekorun tek sahibi vardır. Biri kırdığında Casino Live bunu
              herkese duyurur.
            </p>
            <div className="record-scope">
              <button
                className={recordScope === "all" ? "active" : ""}
                onClick={() => setRecordScope("all")}
              >
                TÜM ZAMANLAR
              </button>
              <button
                className={recordScope === "season" ? "active" : ""}
                onClick={() => setRecordScope("season")}
              >
                BU SEZON
              </button>
            </div>
          </header>
          <div className="record-grid">
            {records.map((record) => (
              <button
                onClick={() => setProfileId(record.user_id)}
                key={`${record.game_id}:${record.metric_id}`}
              >
                <header>
                  <span>
                    ♛ {recordScope === "all" ? "CASINO REKORU" : "SEZON REKORU"}
                  </span>
                  <small>
                    {new Date(record.achieved_at).toLocaleDateString("tr-TR")}
                  </small>
                </header>
                <b>{record.gameLabel}</b>
                <h2>{record.metric_label}</h2>
                <strong>
                  {number.format(record.value)}
                  {record.metric_id.includes("payout")
                    ? " PR"
                    : record.metric_id.includes("cascade") ||
                        record.metric_id.includes("tiles")
                      ? ""
                      : "×"}
                </strong>
                <footer>
                  <i>{initials(record.displayName)}</i>
                  <span>
                    <small>RECORD HOLDER</small>
                    {record.displayName}
                  </span>
                </footer>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "career" && (
        <div className="competition-page career-page">
          <header className="page-heading">
            <small>CASINO PASAPORTU / ŞÖHRET</small>
            <h1>{dashboard.profile.user.displayName}</h1>
            <p>
              {dashboard.profile.career.title ||
                "İlk ünvanını almaya hazırlanıyor"}{" "}
              · {dashboard.profile.career.fame} şöhret ·{" "}
              {dashboard.profile.recordsOwned} yaşayan rekor
            </p>
          </header>
          <section className="career-card">
            <div className="career-identity">
              <CasinoAvatar
                avatarId={dashboard.profile.user.avatarId}
                userId={dashboard.profile.user.id}
                name={dashboard.profile.user.displayName}
              />
              <small>AKTİF UNVAN</small>
              <h2>{dashboard.profile.career.title || "UNVANSIZ"}</h2>
              <select
                value={dashboard.profile.career.titleId ?? ""}
                onChange={async (event) => {
                  if (!event.target.value) return;
                  await setCompetitionTitle(event.target.value);
                  await load();
                }}
              >
                <option value="">Ünvan seç</option>
                {dashboard.profile.titles.map((title) => (
                  <option value={title.titleId} key={title.titleId}>
                    {title.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="career-numbers">
              <span>
                <small>TOPLAM TUR</small>
                <b>{number.format(dashboard.profile.stats.rounds)}</b>
              </span>
              <span>
                <small>KARİYER NETİ</small>
                <b>{compact.format(dashboard.profile.stats.netProfit)} PR</b>
              </span>
              <span>
                <small>EN BÜYÜK ÖDEME</small>
                <b>
                  {compact.format(dashboard.profile.stats.biggestPayout)} PR
                </b>
              </span>
              <span>
                <small>EN YÜKSEK ÇARPAN</small>
                <b>{number.format(dashboard.profile.stats.maxMultiplier)}×</b>
              </span>
              <span>
                <small>TAÇTA TOPLAM</small>
                <b>{duration(dashboard.profile.crown.totalSeconds)}</b>
              </span>
              <span>
                <small>FAVORİ OYUN</small>
                <b>{dashboard.profile.stats.favoriteGame || "—"}</b>
              </span>
            </div>
            <BankrollGraph rows={dashboard.snapshots} />
          </section>
          <AvatarPicker dashboard={dashboard} onReload={load} />
          <ShowcaseEditor dashboard={dashboard} reload={load} />
          <section className="career-section">
            <header>
              <small>OYUN USTALIĞI</small>
              <h2>Hangi masanın patronusun?</h2>
            </header>
            <div className="mastery-grid">
              {dashboard.profile.mastery.map((item) => (
                <article key={item.game_id}>
                  <span>{item.tier}</span>
                  <b>{item.gameLabel}</b>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, (item.xp / (item.tier === "Legendary" ? 2000 : item.tier === "Diamond" ? 800 : item.tier === "Gold" ? 300 : 100)) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {item.xp} XP · {item.rounds} tur · rekor{" "}
                    {number.format(item.best_multiplier)}×
                  </small>
                </article>
              ))}
            </div>
          </section>
          <section className="career-section">
            <header>
              <small>BAŞARIMLAR</small>
              <h2>İşler ve itibar</h2>
            </header>
            <div className="achievement-grid">
              {dashboard.profile.achievements.map((item) => (
                <article
                  className={`${item.rarity} ${item.unlockedAt ? "unlocked" : "locked"}`}
                  key={item.id}
                >
                  <i>{item.unlockedAt ? "◆" : "◇"}</i>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.detail}</p>
                    <small>
                      {item.rarity.toLocaleUpperCase("tr-TR")} · +{item.fame}{" "}
                      ŞÖHRET
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="career-section">
            <header>
              <small>CASINO PASAPORTU</small>
              <h2>Bütün oyunları fethet</h2>
            </header>
            <div className="passport-grid">
              {groupedPassport.map(([gameId, goals]) => (
                <article key={gameId}>
                  <header>
                    <b>{dashboard.config.games[gameId]?.label || gameId}</b>
                    <span>
                      {goals.length}/{dashboard.config.passportGoals.length}
                    </span>
                  </header>
                  <div>
                    {dashboard.config.passportGoals.map((goal) => (
                      <i
                        className={
                          goals.some((item) => item.goalId === goal.id)
                            ? "done"
                            : ""
                        }
                        title={goal.label}
                        key={goal.id}
                      />
                    ))}
                  </div>
                  <small>{goals.at(-1)?.label || "İlk iş bekleniyor"}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "clubs" && (
        <ClubsPage dashboard={dashboard} onDashboard={setDashboard} />
      )}

      {tab === "poker" && (
        <PokerCareerPage dashboard={dashboard} onDashboard={setDashboard} />
      )}

      {tab === "season" && (
        <div className="competition-page season-page">
          <header className="season-banner">
            <small>AKTİF SEZON</small>
            <h1>{dashboard.season.name}</h1>
            <p>
              {remaining(dashboard.season.remainingMs)} sonra puanlar
              mühürlenecek. PR bakiyesi sıfırlanmayacak.
            </p>
            <strong>
              {number.format(dashboard.leaderboards.season.self?.score ?? 0)}{" "}
              <em>SEZON PUANI</em>
            </strong>
          </header>
          <div className="season-columns">
            <section>
              <header>
                <small>ŞAMPİYONLUK YARIŞI</small>
                <h2>Sezon sıralaması</h2>
              </header>
              <RankList
                entries={dashboard.leaderboards.season.top}
                selfId={selfId}
                onPlayer={setProfileId}
              />
            </section>
            <section className="hall-of-fame">
              <header>
                <small>GEÇMİŞ SEZONLAR</small>
                <h2>Şampiyonlar</h2>
              </header>
              {dashboard.hall.champions.length ? (
                dashboard.hall.champions.map((row) => (
                  <button
                    onClick={() => setProfileId(row.user_id)}
                    key={`${row.season_id}:${row.rank}`}
                  >
                    <i>{["", "🥇", "🥈", "🥉"][row.rank]}</i>
                    <div>
                      <b>{row.displayName}</b>
                      <small>{row.seasonName}</small>
                    </div>
                    <span>{row.season_points} SP</span>
                  </button>
                ))
              ) : (
                <p>İlk sezon tamamlandığında patronlar burada kalıcı olacak.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "hall" && (
        <div className="competition-page history-page">
          <header className="page-heading">
            <small>PEHLEVAN ROYALE ARŞİVİ</small>
            <h1>Casino unutmaz.</h1>
            <p>
              Taç süreleri, yaşayan rekorlar ve ömür boyu şöhret burada
              mühürlenir.
            </p>
          </header>
          <div className="history-highlights">
            {dashboard.hall.biggestWin && (
              <article>
                <small>EN BÜYÜK ÖDEME</small>
                <b>{dashboard.hall.biggestWin.displayName}</b>
                <strong>
                  {compact.format(dashboard.hall.biggestWin.payout)} PR
                </strong>
                <span>
                  {
                    dashboard.config.games[dashboard.hall.biggestWin.gameId]
                      ?.label
                  }
                </span>
              </article>
            )}
            {dashboard.hall.highestMultiplier && (
              <article>
                <small>EN YÜKSEK ÇARPAN</small>
                <b>{dashboard.hall.highestMultiplier.displayName}</b>
                <strong>
                  {number.format(dashboard.hall.highestMultiplier.multiplier)}×
                </strong>
                <span>
                  {
                    dashboard.config.games[
                      dashboard.hall.highestMultiplier.gameId
                    ]?.label
                  }
                </span>
              </article>
            )}
            <article>
              <small>YAŞAYAN REKORLAR</small>
              <b>{dashboard.hall.recordHolders[0]?.displayName || "—"}</b>
              <strong>{dashboard.hall.recordHolders[0]?.score ?? 0}</strong>
              <span>casino rekoru</span>
            </article>
            {dashboard.hall.biggestComeback && (
              <article>
                <small>EN BÜYÜK GERİ DÖNÜŞ</small>
                <b>{dashboard.hall.biggestComeback.displayName}</b>
                <strong>
                  {compact.format(dashboard.hall.biggestComeback.trough)} →{" "}
                  {compact.format(dashboard.hall.biggestComeback.anchor)} PR
                </strong>
                <span>kasayı yeniden ayağa kaldırdı</span>
              </article>
            )}
            {dashboard.hall.oldestRecord && (
              <article>
                <small>EN UZUN KIRILMAYAN REKOR</small>
                <b>{dashboard.hall.oldestRecord.displayName}</b>
                <strong>
                  {Math.max(0, Math.floor(dashboard.hall.oldestRecord.ageDays))}{" "}
                  GÜN
                </strong>
                <span>{dashboard.hall.oldestRecord.metricLabel}</span>
              </article>
            )}
          </div>
          <div className="history-columns">
            <section>
              <header>
                <small>KASA TACI</small>
                <h2>En uzun saltanat</h2>
              </header>
              {dashboard.hall.crown.map((row, index) => (
                <button
                  onClick={() => setProfileId(row.userId)}
                  key={row.userId}
                >
                  <em>#{index + 1}</em>
                  <span>
                    <b>{row.displayName}</b>
                    <small>
                      en uzun {duration(row.longestSeconds)} · {row.reigns}{" "}
                      saltanat
                    </small>
                  </span>
                  <strong>{duration(row.totalSeconds)}</strong>
                </button>
              ))}
            </section>
            <section>
              <header>
                <small>ÖMÜR BOYU</small>
                <h2>Şöhret duvarı</h2>
              </header>
              {dashboard.hall.fame.map((row, index) => (
                <button
                  onClick={() => setProfileId(row.userId)}
                  key={row.userId}
                >
                  <em>#{index + 1}</em>
                  <span>
                    <b>{row.displayName}</b>
                    <small>casino kariyeri</small>
                  </span>
                  <strong>{number.format(row.score)}</strong>
                </button>
              ))}
            </section>
            <section>
              <header>
                <small>EFSANEVİ İŞLER</small>
                <h2>Nadir başarımlar</h2>
              </header>
              {dashboard.hall.legendaryAchievements
                .slice(0, 10)
                .map((row, index) => (
                  <button
                    onClick={() => setProfileId(row.userId)}
                    key={`${row.userId}:${row.name}:${row.unlockedAt}`}
                  >
                    <em>#{index + 1}</em>
                    <span>
                      <b>{row.displayName}</b>
                      <small>{row.name}</small>
                    </span>
                    <strong>{row.rarity.toLocaleUpperCase("tr-TR")}</strong>
                  </button>
                ))}
            </section>
            <section>
              <header>
                <small>PLAYERS VS HOUSE</small>
                <h2>Geçmiş hesaplaşmalar</h2>
              </header>
              {dashboard.hall.houseHistory.map((row, index) => (
                <div className="house-history-row" key={row.eventId}>
                  <em>#{index + 1}</em>
                  <span>
                    <b>
                      {row.playersWon ? "OYUNCULAR KAZANDI" : "KASA KAZANDI"}
                    </b>
                    <small>
                      {row.name} · {row.participants} oyuncu
                    </small>
                  </span>
                  <strong>
                    {compact.format(
                      row.playersWon ? row.playersNet : row.houseNet,
                    )}{" "}
                    PR
                  </strong>
                </div>
              ))}
            </section>
            <section>
              <header>
                <small>SERVET ARŞİVİ</small>
                <h2>Geçmiş kasa liderleri</h2>
              </header>
              {dashboard.hall.richestSnapshots
                .slice(0, 10)
                .map((row, index) => (
                  <button
                    onClick={() => setProfileId(row.userId)}
                    key={`${row.snapshotDate}:${row.userId}`}
                  >
                    <em>#{index + 1}</em>
                    <span>
                      <b>{row.displayName}</b>
                      <small>
                        {new Date(
                          `${row.snapshotDate}T00:00:00`,
                        ).toLocaleDateString("tr-TR")}
                      </small>
                    </span>
                    <strong>{compact.format(row.balance)} PR</strong>
                  </button>
                ))}
            </section>
            <section>
              <header>
                <small>DERECELİ MASALAR</small>
                <h2>Turnuva şampiyonları</h2>
              </header>
              {dashboard.hall.tournamentChampions.length ? (
                dashboard.hall.tournamentChampions.map((row, index) => (
                  <button
                    onClick={() => setProfileId(row.userId)}
                    key={`${row.tournamentId}:${row.userId}`}
                  >
                    <em>#{index + 1}</em>
                    <span>
                      <b>{row.displayName}</b>
                      <small>
                        {row.tournamentName} · {row.fieldSize} oyuncu
                      </small>
                    </span>
                    <strong>
                      {row.ratingDelta >= 0 ? "+" : ""}
                      {row.ratingDelta} R
                    </strong>
                  </button>
                ))
              ) : (
                <p>İlk turnuva kapandığında şampiyon burada mühürlenecek.</p>
              )}
            </section>
          </div>
        </div>
      )}
      {profileId && (
        <ProfileModal
          userId={profileId}
          onClose={() => setProfileId(undefined)}
        />
      )}
    </main>
  );
}

export function LobbyCompetitionStrip({ onOpen }: { onOpen: () => void }) {
  const [dashboard, setDashboard] = useState<CompetitionDashboard>();
  useEffect(() => {
    void getCompetitionDashboard()
      .then(setDashboard)
      .catch(() => undefined);
  }, []);
  if (!dashboard)
    return (
      <section className="lobby-competition-strip is-loading">
        <span>Rekabet masası hazırlanıyor…</span>
      </section>
    );
  return (
    <section className="lobby-competition-strip">
      <header className="lobby-rail-heading">
        <small>CANLI REKABET</small>
        <h2>Salon hesabı</h2>
        <p>Zirve, senin sıran ve bu gecenin açık hesapları.</p>
      </header>
      <button className="lobby-crown" onClick={onOpen}>
        <i>♛</i>
        <span>
          <small>KASA PATRONU</small>
          <b>{dashboard.crown?.displayName || "Taç sahipsiz"}</b>
        </span>
      </button>
      <div className="lobby-rank-summary">
        <span>
          <small>SENİN SERVET SIRAN</small>
          <b>#{dashboard.leaderboards.wealth.self?.rank ?? "—"}</b>
        </span>
        <span>
          <small>SEZON</small>
          <b>
            #{dashboard.leaderboards.season.self?.rank ?? "—"} ·{" "}
            {number.format(dashboard.leaderboards.season.self?.score ?? 0)} SP
          </b>
        </span>
        <span>
          <small>PLAYERS VS HOUSE</small>
          <b>
            {dashboard.houseEvent.playersNet >= dashboard.houseEvent.houseNet
              ? "OYUNCULAR ÖNDE"
              : "KASA ÖNDE"}
          </b>
        </span>
        <span>
          <small>AKTİF UNVAN</small>
          <b>{dashboard.profile.career.title || "İlk işi yap"}</b>
        </span>
      </div>
      <div className="lobby-richest-column">
        <small>EN ZENGİNLER</small>
        <ol>
          {dashboard.leaderboards.wealth.top.slice(0, 3).map((entry) => (
            <li key={entry.userId}>
              <em>#{entry.rank}</em>
              <span>{entry.displayName}</span>
              <b>{compact.format(entry.score)} PR</b>
            </li>
          ))}
        </ol>
      </div>
      <button className="open-competition" onClick={onOpen}>
        REKABET MERKEZİ <b>→</b>
      </button>
    </section>
  );
}
