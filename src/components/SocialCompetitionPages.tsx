import { useRef, useState, type ChangeEvent } from "react";
import {
  createCompetitionClub,
  joinCompetitionClub,
  joinCompetitionTournament,
  leaveCompetitionClub,
  setCompetitionAvatar,
  uploadCompetitionAvatar,
  type CompetitionDashboard,
} from "../meta/meta-api";
import CasinoAvatar from "./CasinoAvatar";
import { casinoAvatars } from "./casino-avatar-catalog";
import "./competition-phase7.css";

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function remaining(ms: number) {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days ? `${days} gün ${hours} saat` : `${hours} saat`;
}

export function AvatarPicker({
  dashboard,
  onReload,
}: {
  dashboard: CompetitionDashboard;
  onReload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const select = async (avatarId: string) => {
    setBusy(avatarId);
    setNotice("");
    try {
      await setCompetitionAvatar(avatarId);
      await onReload();
      setNotice("Avatarın casino profilinde ve sıralamalarda güncellendi.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Avatar kaydedilemedi.",
      );
    } finally {
      setBusy("");
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setNotice("Yalnız PNG, JPEG veya WebP yükleyebilirsin.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("Avatar en fazla 2 MB olabilir.");
      return;
    }
    setBusy("custom");
    setNotice("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Dosya okunamadı."));
        reader.readAsDataURL(file);
      });
      await uploadCompetitionAvatar(dataUrl);
      await onReload();
      setNotice("Fotoğrafın doğrulandı ve casino avatarın olarak kaydedildi.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Fotoğraf yüklenemedi.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="avatar-picker career-section">
      <header>
        <div>
          <small>CASINO KİMLİĞİ</small>
          <h2>Avatarını seç</h2>
        </div>
        <span>Profil, kulüp ve poker masalarında görünür.</span>
      </header>
      <div className="avatar-picker-grid">
        <button
          className={`avatar-upload-card ${dashboard.profile.user.avatarId === "custom" ? "active" : ""}`}
          disabled={Boolean(busy)}
          onClick={() => fileInput.current?.click()}
        >
          <CasinoAvatar
            avatarId={dashboard.profile.user.avatarId}
            userId={dashboard.profile.user.id}
            name={dashboard.profile.user.displayName}
          />
          <span>
            <b>Kendi fotoğrafın</b>
            <small>
              {busy === "custom"
                ? "YÜKLENİYOR…"
                : dashboard.profile.user.avatarId === "custom"
                  ? "DEĞİŞTİR"
                  : "FOTOĞRAF YÜKLE"}
            </small>
          </span>
        </button>
        <input
          ref={fileInput}
          className="avatar-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void upload(event)}
        />
        {casinoAvatars.map((avatar) => (
          <button
            className={
              dashboard.profile.user.avatarId === avatar.id ? "active" : ""
            }
            disabled={Boolean(busy)}
            onClick={() => void select(avatar.id)}
            key={avatar.id}
          >
            <CasinoAvatar
              avatarId={avatar.id}
              name={dashboard.profile.user.displayName}
            />
            <span>
              <b>{avatar.label}</b>
              <small>
                {busy === avatar.id
                  ? "Mühürleniyor…"
                  : dashboard.profile.user.avatarId === avatar.id
                    ? "SEÇİLİ"
                    : "SEÇ"}
              </small>
            </span>
          </button>
        ))}
      </div>
      {notice && <p className="phase7-notice">{notice}</p>}
    </section>
  );
}

export function ClubsPage({
  dashboard,
  onDashboard,
}: {
  dashboard: CompetitionDashboard;
  onDashboard: (dashboard: CompetitionDashboard) => void;
}) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const hub = dashboard.social.clubs;
  const action = async (id: "create" | "join" | "leave", clubId?: string) => {
    setBusy(clubId || id);
    setNotice("");
    try {
      const result =
        id === "create"
          ? await createCompetitionClub(name, tag)
          : id === "join"
            ? await joinCompetitionClub(clubId!)
            : await leaveCompetitionClub();
      onDashboard(result.dashboard);
      setName("");
      setTag("");
      setNotice(
        id === "create"
          ? "Kulübün açıldı. Liderlik mührü sende."
          : id === "join"
            ? "Kulübe katıldın. Yeni anlamlı vuruşların haftalık puana yazılacak."
            : "Kulüpten ayrıldın.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Kulüp işlemi tamamlanamadı.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="competition-page clubs-page">
      <header className="page-heading">
        <small>MASA BİRLİKLERİ</small>
        <h1>Tek kasa, ortak nam.</h1>
        <p>
          Bahis hacmi değil; 5× ve üzeri anlamlı sonuçlar kulübüne puan getirir.
          Kişi başı haftalık sınır rekabeti dengede tutar.
        </p>
      </header>
      <section className="club-event-banner">
        <div>
          <small>AKTİF HAFTALIK HESAP</small>
          <h2>{hub.event.name}</h2>
          <p>
            {remaining(hub.event.remainingMs)} kaldı · kişi başı en fazla{" "}
            {hub.event.perPlayerCap} puan
          </p>
        </div>
        <strong>
          {hub.myClub ? `#${hub.myClub.weeklyRank ?? "—"}` : "—"}
          <small>KULÜP SIRAN</small>
        </strong>
      </section>
      {notice && <p className="phase7-notice">{notice}</p>}
      {hub.myClub ? (
        <section className="my-club-card">
          <header>
            <span>
              <small>BENİM KULÜBÜM</small>
              <h2>
                {hub.myClub.name} <em>[{hub.myClub.tag}]</em>
              </h2>
            </span>
            <button
              disabled={Boolean(busy)}
              onClick={() => void action("leave")}
            >
              AYRIL
            </button>
          </header>
          <div className="club-score-ribbon">
            <span>
              <small>HAFTALIK PUAN</small>
              <b>{number.format(hub.myClub.weeklyScore)}</b>
            </span>
            <span>
              <small>SENİN KATKIN</small>
              <b>{number.format(hub.myClub.myWeeklyScore)}</b>
            </span>
            <span>
              <small>KARİYER KATKIN</small>
              <b>{number.format(hub.myClub.contributionPoints)}</b>
            </span>
          </div>
          <div className="club-roster">
            {hub.myClub.members.map((member) => (
              <article key={member.userId}>
                <CasinoAvatar
                  avatarId={member.avatarId}
                  userId={member.userId}
                  name={member.displayName}
                />
                <span>
                  <b>{member.displayName}</b>
                  <small>
                    {member.role === "leader"
                      ? "LİDER"
                      : member.role === "officer"
                        ? "SAĞ KOL"
                        : "ÜYE"}
                  </small>
                </span>
                <strong>+{member.weeklyScore}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="club-create-card">
          <div>
            <small>KENDİ MASANI AÇ</small>
            <h2>Bir isim, bir etiket, bir haftalık hesap.</h2>
            <p>
              Kulübü kuran lider olur. Aynı anda yalnız bir kulüpte
              bulunabilirsin.
            </p>
          </div>
          <label>
            Kulüp adı
            <input
              value={name}
              maxLength={32}
              placeholder="Örn. Kara Masa"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Etiket
            <input
              value={tag}
              maxLength={6}
              placeholder="KARA"
              onChange={(event) =>
                setTag(event.target.value.toLocaleUpperCase("tr-TR"))
              }
            />
          </label>
          <button
            disabled={
              Boolean(busy) || name.trim().length < 3 || tag.trim().length < 2
            }
            onClick={() => void action("create")}
          >
            KULÜBÜ KUR
          </button>
        </section>
      )}
      <div className="phase7-columns">
        <section className="club-standings">
          <header>
            <small>BU HAFTA</small>
            <h2>Kulüp sıralaması</h2>
          </header>
          {hub.standings.length ? (
            hub.standings.map((club) => (
              <article
                className={club.clubId === hub.myClub?.clubId ? "self" : ""}
                key={club.clubId}
              >
                <em>#{club.rank}</em>
                <span>
                  <b>{club.name}</b>
                  <small>
                    [{club.tag}] · {club.members} üye
                  </small>
                </span>
                <strong>{club.score} PUAN</strong>
              </article>
            ))
          ) : (
            <p>İlk kulüp açıldığında yarış burada başlayacak.</p>
          )}
        </section>
        <section className="club-directory">
          <header>
            <small>KULÜP DEFTERİ</small>
            <h2>Açık birlikler</h2>
          </header>
          {hub.clubs.map((club) => (
            <article key={club.id}>
              <span>
                <b>{club.name}</b>
                <small>
                  [{club.tag}] · {club.members} üye · {club.lifetimeScore}{" "}
                  kariyer puanı
                </small>
              </span>
              {!hub.myClub && (
                <button
                  disabled={Boolean(busy)}
                  onClick={() => void action("join", club.id)}
                >
                  {busy === club.id ? "KATILIYOR…" : "KATIL"}
                </button>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export function PokerCareerPage({
  dashboard,
  onDashboard,
}: {
  dashboard: CompetitionDashboard;
  onDashboard: (dashboard: CompetitionDashboard) => void;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const poker = dashboard.social.poker;
  const join = async (tournamentId: string) => {
    setBusy(tournamentId);
    setNotice("");
    try {
      const result = await joinCompetitionTournament(tournamentId);
      onDashboard(result.dashboard);
      setNotice("Turnuva kaydın mühürlendi.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Turnuvaya kayıt olunamadı.",
      );
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="competition-page poker-career-page">
      <header className="page-heading">
        <small>DERECELİ MASALAR</small>
        <h1>Para ayrı, maharet ayrı.</h1>
        <p>
          Poker rating’i yalnız doğrulanmış oyuncu-oyuncu masaları ve turnuva
          sonuçlarından değişir. Bot oyunları bu hesabı etkilemez.
        </p>
      </header>
      <section className="poker-rating-hero">
        <CasinoAvatar
          avatarId={dashboard.profile.user.avatarId}
          userId={dashboard.profile.user.id}
          name={dashboard.profile.user.displayName}
        />
        <div>
          <small>SENİN POKER RATING'İN</small>
          <h2>{poker.self?.rating ?? 1000}</h2>
          <p>
            Casino sırası #{poker.self?.rank ?? "—"} · {poker.self?.wins ?? 0}{" "}
            galibiyet / {poker.self?.losses ?? 0} mağlubiyet
          </p>
        </div>
        <div className="poker-career-trophies">
          <span>
            <b>{poker.self?.tournamentWins ?? 0}</b>
            <small>ŞAMPİYONLUK</small>
          </span>
          <span>
            <b>{poker.self?.finalTables ?? 0}</b>
            <small>FİNAL MASASI</small>
          </span>
          <span>
            <b>{compact.format(poker.self?.largestPot ?? 0)} PR</b>
            <small>EN BÜYÜK POT</small>
          </span>
        </div>
      </section>
      {notice && <p className="phase7-notice">{notice}</p>}
      <div className="phase7-columns">
        <section className="poker-rating-board">
          <header>
            <small>SKILL LEADERBOARD</small>
            <h2>Poker ustaları</h2>
          </header>
          {poker.leaderboard.map((player) => (
            <article
              className={
                player.userId === dashboard.profile.user.id ? "self" : ""
              }
              key={player.userId}
            >
              <em>#{player.rank}</em>
              <CasinoAvatar
                avatarId={player.avatarId}
                userId={player.userId}
                name={player.displayName}
              />
              <span>
                <b>{player.displayName}</b>
                <small>
                  {player.wins}G · {player.losses}M · {player.draws}B
                </small>
              </span>
              <strong>{player.rating}</strong>
            </article>
          ))}
        </section>
        <section className="tournament-list">
          <header>
            <small>TURNUVA TAKVİMİ</small>
            <h2>Şampiyonluk masaları</h2>
          </header>
          {dashboard.social.tournaments.length ? (
            dashboard.social.tournaments.map((tournament) => (
              <article
                className={`tournament-card ${tournament.status}`}
                key={tournament.id}
              >
                <div>
                  <small>
                    {tournament.status === "completed"
                      ? "TAMAMLANDI"
                      : tournament.status === "active"
                        ? "MASA AÇIK"
                        : "KAYIT AÇIK"}
                  </small>
                  <h3>{tournament.name}</h3>
                  <p>
                    {new Date(tournament.startsAt).toLocaleString("tr-TR")} ·{" "}
                    {tournament.entrants} oyuncu
                  </p>
                </div>
                {tournament.results.length ? (
                  <ol>
                    {tournament.results.slice(0, 3).map((result) => (
                      <li key={result.userId}>
                        <b>
                          #{result.placement} {result.displayName}
                        </b>
                        <span>
                          {result.ratingDelta >= 0 ? "+" : ""}
                          {result.ratingDelta} rating
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : tournament.joined ? (
                  <strong>KAYDIN MÜHÜRLÜ</strong>
                ) : (
                  <button
                    disabled={
                      Boolean(busy) || tournament.status === "completed"
                    }
                    onClick={() => void join(tournament.id)}
                  >
                    {busy === tournament.id ? "KAYDEDİLİYOR…" : "KAYIT OL"}
                  </button>
                )}
              </article>
            ))
          ) : (
            <p>
              Henüz planlanmış turnuva yok. Muharrem Pehlevan yönetim masasından
              ilk turnuvayı açabilir.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
