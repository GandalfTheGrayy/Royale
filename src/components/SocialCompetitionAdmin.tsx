import { useEffect, useState } from "react";
import { accountRequest } from "../auth/auth-api";
import {
  createCompetitionTournament,
  recordVerifiedPokerMatch,
  settleCompetitionTournament,
} from "../meta/competition-admin-api";
import {
  getCompetitionDashboard,
  type CompetitionDashboard,
} from "../meta/meta-api";
import "./competition-phase7-admin.css";

type AdminUser = { id: string; displayName: string; status: string };
const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

export default function SocialCompetitionAdmin() {
  const [dashboard, setDashboard] = useState<CompetitionDashboard>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(() => ({
    name: "Cuma Gecesi Ana Masa",
    startsAt: localInput(new Date(Date.now() + 3600000)),
    endsAt: localInput(new Date(Date.now() + 25 * 3600000)),
    buyIn: 0,
  }));
  const [placements, setPlacements] = useState<
    Record<string, Record<string, number>>
  >({});
  const [match, setMatch] = useState({ first: "", second: "", winner: "" });
  const load = async () => {
    const [next, people] = await Promise.all([
      getCompetitionDashboard(),
      accountRequest<{ users: AdminUser[] }>("/api/admin/accounts/users"),
    ]);
    setDashboard(next);
    const active = people.users.filter((user) => user.status === "active");
    setUsers(active);
    setMatch((current) => ({
      first: current.first || active[0]?.id || "",
      second: current.second || active[1]?.id || "",
      winner: current.winner || active[0]?.id || "",
    }));
  };
  useEffect(() => {
    void load().catch((error) =>
      setNotice(
        error instanceof Error
          ? error.message
          : "Sosyal yarışma yönetimi açılamadı.",
      ),
    );
  }, []);
  const create = async () => {
    setBusy(true);
    setNotice("");
    try {
      const result = await createCompetitionTournament({
        ...draft,
        gameId: "poker",
        startsAt: new Date(draft.startsAt).toISOString(),
        endsAt: new Date(draft.endsAt).toISOString(),
      });
      setDashboard(result.dashboard);
      setNotice("Turnuva açıldı; oyuncular Poker sekmesinden kayıt olabilir.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Turnuva açılamadı.");
    } finally {
      setBusy(false);
    }
  };
  const settle = async (
    tournament: CompetitionDashboard["social"]["tournaments"][number],
  ) => {
    const rows = tournament.entries.map((entry, index) => ({
      userId: entry.userId,
      placement: placements[tournament.id]?.[entry.userId] ?? index + 1,
    }));
    setBusy(true);
    setNotice("");
    try {
      const result = await settleCompetitionTournament(tournament.id, rows);
      setDashboard(result.dashboard);
      setNotice(
        `${tournament.name} sonuçları rating, sezon ve kariyere işlendi.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Turnuva kapatılamadı.",
      );
    } finally {
      setBusy(false);
    }
  };
  const recordMatch = async () => {
    if (!match.first || !match.second || match.first === match.second) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await recordVerifiedPokerMatch({
        matchId: `verified-poker-${crypto.randomUUID()}`,
        participants: [
          {
            userId: match.first,
            placement: match.winner === match.first ? 1 : 2,
          },
          {
            userId: match.second,
            placement: match.winner === match.second ? 1 : 2,
          },
        ],
      });
      setDashboard(result.dashboard);
      setNotice("Doğrulanmış heads-up sonucu poker rating’ine işlendi.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Maç kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };
  if (!dashboard)
    return (
      <section className="phase7-admin-loading">
        Kulüp ve poker kumandası hazırlanıyor…
      </section>
    );
  return (
    <section className="phase7-admin">
      <header>
        <div>
          <small>PHASE 7 · ÇOK OYUNCULU REKABET</small>
          <h3>Kulüp, rating ve turnuva masası</h3>
        </div>
        <button onClick={() => void load()}>YENİLE</button>
      </header>
      {notice && <p>{notice}</p>}
      <div className="phase7-admin-grid">
        <article>
          <small>YENİ POKER TURNUVASI</small>
          <h4>Şampiyonluk masası aç</h4>
          <label>
            Turnuva adı
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Başlangıç
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  startsAt: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Bitiş
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  endsAt: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Buy-in (şimdilik tahsil edilmez)
            <input
              type="number"
              min="0"
              value={draft.buyIn}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  buyIn: Number(event.target.value),
                }))
              }
            />
          </label>
          <button
            disabled={busy || draft.name.trim().length < 3}
            onClick={() => void create()}
          >
            TURNUVAYI AÇ
          </button>
        </article>
        <article>
          <small>DOĞRULANMIŞ HEADS-UP</small>
          <h4>Gerçek masa sonucunu işle</h4>
          <label>
            Birinci oyuncu
            <select
              value={match.first}
              onChange={(event) =>
                setMatch((current) => ({
                  ...current,
                  first: event.target.value,
                  winner: event.target.value,
                }))
              }
            >
              {users.map((user) => (
                <option value={user.id} key={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            İkinci oyuncu
            <select
              value={match.second}
              onChange={(event) =>
                setMatch((current) => ({
                  ...current,
                  second: event.target.value,
                }))
              }
            >
              {users.map((user) => (
                <option value={user.id} key={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kazanan
            <select
              value={match.winner}
              onChange={(event) =>
                setMatch((current) => ({
                  ...current,
                  winner: event.target.value,
                }))
              }
            >
              <option value={match.first}>
                {users.find((user) => user.id === match.first)?.displayName}
              </option>
              <option value={match.second}>
                {users.find((user) => user.id === match.second)?.displayName}
              </option>
            </select>
          </label>
          <button
            disabled={
              busy ||
              !match.first ||
              !match.second ||
              match.first === match.second
            }
            onClick={() => void recordMatch()}
          >
            RATING'E İŞLE
          </button>
          <p>
            Bot masaları buraya girmez. Yalnız oynanıp doğrulanmış oyuncu-oyuncu
            sonucu kaydet.
          </p>
        </article>
      </div>
      <div className="phase7-tournament-admin">
        {dashboard.social.tournaments
          .filter((item) => item.status !== "completed")
          .map((tournament) => (
            <article key={tournament.id}>
              <header>
                <span>
                  <small>{tournament.status.toLocaleUpperCase("tr-TR")}</small>
                  <h4>{tournament.name}</h4>
                </span>
                <b>{tournament.entries.length} OYUNCU</b>
              </header>
              {tournament.entries.length ? (
                <div>
                  {tournament.entries.map((entry, index) => (
                    <label key={entry.userId}>
                      <span>{entry.displayName}</span>
                      <input
                        type="number"
                        min="1"
                        max={tournament.entries.length}
                        value={
                          placements[tournament.id]?.[entry.userId] ?? index + 1
                        }
                        onChange={(event) =>
                          setPlacements((current) => ({
                            ...current,
                            [tournament.id]: {
                              ...current[tournament.id],
                              [entry.userId]: Number(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p>Oyuncu kaydı bekleniyor.</p>
              )}
              <button
                disabled={busy || tournament.entries.length < 2}
                onClick={() => void settle(tournament)}
              >
                SONUÇLARI MÜHÜRLE
              </button>
            </article>
          ))}
      </div>
    </section>
  );
}
