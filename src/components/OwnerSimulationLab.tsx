import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "../auth/auth-client";
import { getAdminSettings, subscribeAdminSettings, updateAdminGame, type AdminGameSettings } from "../data/casino-admin";
import type { CasinoGameId } from "../data/casino-database";
import {
  SIMULATION_GAMES,
  type CasinoSimulationReport,
} from "../games/simulation/casino-simulation-engine";
import {
  buildSimulationDiagnosis,
  patchGameWithRecommendation,
  profileFingerprint,
  protectedGameSettings,
  type OptimizationPriority,
  type ResearchProgress,
  type SimulationResearch,
  type SimulationRecommendation,
} from "../games/simulation/simulation-optimizer";
import SimulationResearchResults from "./SimulationResearchResults";
import "./owner-simulation-lab.css";

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 2 });
const percent = (value: number) => `%${number.format(value)}`;
const x = (value: number) => `${number.format(value)}×`;
const rtpMultiple = (value: number) => x(value / 100);

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, note, tone = "" }: { label: string; value: string; note?: string; tone?: string }) {
  return <article className={`sim-metric ${tone}`}><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</article>;
}

export default function OwnerSimulationLab() {
  const { user } = useAuth();
  const settings = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings);
  const [gameId, setGameId] = useState<CasinoGameId>("allahin-lutfu");
  const definition = SIMULATION_GAMES.find((game) => game.id === gameId)!;
  const [modeByGame, setModeByGame] = useState<Partial<Record<CasinoGameId, string>>>({});
  const [parameterByGame, setParameterByGame] = useState<Partial<Record<CasinoGameId, number>>>({});
  const [runs, setRuns] = useState(10_000);
  const [wager, setWager] = useState(settings.games[gameId].defaultBet);
  const [seed, setSeed] = useState(20260909);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<CasinoSimulationReport>();
  const [reportGameSettings, setReportGameSettings] = useState<AdminGameSettings>();
  const [research, setResearch] = useState<SimulationResearch>();
  const [history, setHistory] = useState<Array<{ report: CasinoSimulationReport; game: AdminGameSettings; research?: SimulationResearch }>>([]);
  const [view, setView] = useState<"optimizer" | "summary" | "distribution" | "causes" | "technical">("optimizer");
  const [goalRtp, setGoalRtp] = useState(settings.games[gameId].targetRtp);
  const [minHitRetention, setMinHitRetention] = useState(.8);
  const [minBonusRetention, setMinBonusRetention] = useState(.5);
  const [allowPayoutChanges, setAllowPayoutChanges] = useState(false);
  const [batchRuns, setBatchRuns] = useState(500);
  const [autoResearch, setAutoResearch] = useState(true);
  const [progress, setProgress] = useState<ResearchProgress>();
  const [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const [optimizationPriority, setOptimizationPriority] = useState<OptimizationPriority>("balanced");
  const [appliedRecommendations, setAppliedRecommendations] = useState<string[]>([]);
  const [rollback, setRollback] = useState<{ gameId: CasinoGameId; game: AdminGameSettings; appliedFingerprint: string }>();
  const [needsVerification, setNeedsVerification] = useState(false);
  const selectedMode = modeByGame[gameId] ?? definition.modes[0].id;
  const parameter = parameterByGame[gameId] ?? definition.parameter?.defaultValue;
  const modeInfo = definition.modes.find((entry) => entry.id === selectedMode) ?? definition.modes[0];
  const diagnosis = useMemo(() => research?.diagnosis ?? (report ? buildSimulationDiagnosis(report, reportGameSettings ?? settings.games[report.request.gameId], {
    targetRtp: goalRtp,
    minHitRetention, minBonusRetention, allowPayoutChanges, batchRuns,
    priority: optimizationPriority,
  }) : undefined), [research, report, reportGameSettings, settings, goalRtp, minHitRetention, minBonusRetention, allowPayoutChanges, batchRuns, optimizationPriority]);

  const groups = useMemo(() => ["Slot", "Anlık", "Originals", "Masa"] as const, []);
  if (user.role !== "owner") return null;

  const chooseGame = (next: CasinoGameId) => {
    setGameId(next);
    setWager(settings.games[next].defaultBet);
    setGoalRtp(settings.games[next].targetRtp);
    setResearch(undefined);
    setReport(undefined);
    setReportGameSettings(undefined);
    setAppliedRecommendations([]);
    setNeedsVerification(false);
  };

  const run = (researchOnly = false, repeatReport = false) => {
    worker.current?.terminate();
    setBusy(true);
    setError("");
    setResearch(undefined);
    setProgress({ phase: "Ana simülasyon çalışıyor", completed: 0, simulatedRounds: 0 });
    const request = (researchOnly || repeatReport) && report ? report.request : { gameId, mode: selectedMode, runs, wager, seed, parameter };
    const gameSnapshot = structuredClone(researchOnly && reportGameSettings ? reportGameSettings : settings.games[request.gameId]);
    const settingsSnapshot = { ...settings, games: { ...settings.games, [request.gameId]: gameSnapshot } };
    const activeWorker = new Worker(new URL("../games/simulation/simulation-worker.ts", import.meta.url), { type: "module" });
    worker.current = activeWorker;
    let activeReport: CasinoSimulationReport | undefined;
    activeWorker.onmessage = ({ data }) => {
      if (worker.current !== activeWorker) return;
      if (data.type === "report") {
        activeReport = data.report;
        setReport(data.report);
        setReportGameSettings(gameSnapshot);
        setHistory(current => [{ report: data.report, game: gameSnapshot }, ...current].slice(0, 8));
        setView("optimizer"); setAppliedRecommendations([]); setNeedsVerification(false);
      } else if (data.type === "progress") setProgress(data.progress);
      else if (data.type === "research") {
        setResearch(data.research);
        setHistory(current => current.map(item => item.report === activeReport ? { ...item, research: data.research } : item));
      } else if (data.type === "error" || data.type === "done") {
        if (data.type === "error") setError(data.error);
        setBusy(false); setProgress(undefined); activeWorker.terminate(); worker.current = null;
      }
    };
    activeWorker.onerror = event => { setError(event.message); setBusy(false); setProgress(undefined); activeWorker.terminate(); worker.current = null; };
    activeWorker.postMessage({
      request, settings: settingsSnapshot, report: researchOnly ? report : undefined,
      goal: autoResearch || researchOnly ? { targetRtp: goalRtp, priority: optimizationPriority, minHitRetention, minBonusRetention, allowPayoutChanges, batchRuns } : undefined,
    });
  };
  const cancel = () => {
    worker.current?.terminate(); worker.current = null; setBusy(false); setProgress(undefined);
    setError("Araştırma durduruldu. Tamamlanmamış deneyden öneri uygulanmaz.");
  };

  const exportJson = () => report && download(
    `simulasyon-${report.request.gameId}-${Date.now()}.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), report, gameProfile: reportGameSettings, research }, null, 2),
    "application/json;charset=utf-8",
  );

  const exportCsv = () => {
    if (!report) return;
    const rows = [["etken", "gorus", "tur_orani", "etkenli_ortalama_x", "ortalama_kati", "dogrudan_katki_x"], ...report.causes.map((cause) => [cause.label, cause.occurrences, cause.roundRate, cause.averagePayoutX, cause.lift, cause.contributionX])];
    download(`simulasyon-etkenleri-${report.request.gameId}.csv`, `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n")}`, "text/csv;charset=utf-8");
  };

  const applyRecommendation = (recommendation: SimulationRecommendation) => {
    if (!recommendation.applyable || !recommendation.changes.length || !report) return;
    const current = settings.games[report.request.gameId];
    try {
      const patched = patchGameWithRecommendation(current, recommendation);
      updateAdminGame(report.request.gameId, patched);
      setRollback({ gameId: report.request.gameId, game: structuredClone(current), appliedFingerprint: profileFingerprint(patched) });
      setAppliedRecommendations((items) => [...new Set([...items, recommendation.id])]);
      setNeedsVerification(true); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  };

  const undoOptimization = () => {
    if (!rollback) return;
    if (profileFingerprint(settings.games[rollback.gameId]) !== rollback.appliedFingerprint) {
      setError("Profil uygulamadan sonra değişmiş; geri alma güncel ayarları ezemez."); return;
    }
    const current = settings.games[rollback.gameId];
    const previous = rollback.game;
    updateAdminGame(rollback.gameId, { ...current, targetRtp: previous.targetRtp, slot: previous.slot, allah: previous.allah, mineDrop: previous.mineDrop, crash: previous.crash, mines: previous.mines, countdown: previous.countdown, plinko: previous.plinko });
    setRollback(undefined);
    setAppliedRecommendations([]);
    setNeedsVerification(true);
  };

  return <div className="owner-sim-lab">
    <section className="sim-hero">
      <div><small>OWNER ONLY · İZOLE MATEMATİK LABORATUVARI</small><h2>Oyun Simülasyon Motoru</h2><p>Canlı oyun kuralları ve kayıtlı yönetim profilleriyle binlerce turu bakiyeye dokunmadan çalıştır; sonucu hangi sembol, özellik veya kararın taşıdığını gör.</p></div>
      <div className="sim-hero-seal"><span>MP</span><b>SAHİP ERİŞİMİ</b><small>Gerçek cüzdan ve geçmiş etkilenmez</small></div>
    </section>

    <fieldset className="sim-workbench" disabled={busy}>
      <aside className="sim-game-catalog">
        <header><small>01 · OYUN</small><strong>{SIMULATION_GAMES.length} motor hazır</strong></header>
        {groups.map((group) => <div key={group}><b>{group}</b>{SIMULATION_GAMES.filter((game) => game.group === group).map((game) => <button type="button" key={game.id} className={game.id === gameId ? "active" : ""} onClick={() => chooseGame(game.id)}><i>{game.group === "Slot" ? "◆" : game.group === "Masa" ? "♠" : game.group === "Anlık" ? "◉" : "✦"}</i><span>{settings.games[game.id].name}<small>{settings.games[game.id].volatility} volatilite · hedef %{number.format(settings.games[game.id].targetRtp)}</small></span></button>)}</div>)}
      </aside>

      <div className="sim-setup">
        <header><div><small>02 · SENARYO</small><h3>{settings.games[gameId].name}</h3></div><span className={settings.games[gameId].enabled ? "online" : "offline"}>{settings.games[gameId].enabled ? "CANLI PROFİL" : "DEVRE DIŞI PROFİL"}</span></header>
        <p className="sim-mode-description">{modeInfo.description}</p>
        <div className="sim-fields">
          <label className="wide"><span>Oynanış / satın alım türü</span><select value={selectedMode} onChange={(event) => setModeByGame((current) => ({ ...current, [gameId]: event.target.value }))}>{definition.modes.map((entry) => <option value={entry.id} key={entry.id}>{entry.label}</option>)}</select></label>
          <label><span>Deneme sayısı</span><input type="number" min="1" max="100000" value={runs} onChange={(event) => setRuns(Math.max(1, Math.min(100_000, Number(event.target.value) || 1)))} /></label>
          <label><span>Temel bahis</span><div className="sim-unit-input"><input type="number" min={settings.games[gameId].minBet} step="1" value={wager} onChange={(event) => setWager(Math.max(.01, Number(event.target.value) || .01))} /><em>PR</em></div></label>
          {definition.parameter && <label><span>{definition.parameter.label}</span><div className="sim-unit-input"><input type="number" min={definition.parameter.min} max={definition.parameter.max} step={definition.parameter.step} value={parameter} onChange={(event) => setParameterByGame((current) => ({ ...current, [gameId]: Number(event.target.value) }))} /><em>{definition.parameter.suffix}</em></div></label>}
          <label><span>Tekrar üretim tohumu</span><input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} /></label>
        </div>
        <div className="sim-presets"><span>HIZLI HACİM</span>{[100, 1_000, 10_000, 100_000].map((value) => <button type="button" key={value} className={runs === value ? "active" : ""} onClick={() => setRuns(value)}>{value.toLocaleString("tr-TR")}</button>)}<button type="button" onClick={() => setSeed(Math.floor(Math.random() * 2_147_483_647))}>YENİ TOHUM</button></div>
        <details className="sim-goal" open>
          <summary>OPTİMİZASYON HEDEFİ <span>Motor önerileri bu hedefe göre üretir</span></summary>
          <div>
            <label><span>İstenen RTP</span><div className="sim-unit-input"><input type="number" min="1" max="100" step="0.1" value={goalRtp} onChange={(event) => setGoalRtp(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /><em>%</em></div></label>
            <label><span>Mevcut ödeme sıklığını en az koru</span><select value={minHitRetention} onChange={event => setMinHitRetention(Number(event.target.value))}><option value={.95}>%95'ini koru</option><option value={.8}>%80'ini koru</option><option value={.6}>%60'ını koru</option><option value={0}>Alt sınır koyma</option></select></label>
            <label><span>Önceliğiniz</span><select value={optimizationPriority} onChange={(event) => setOptimizationPriority(event.target.value as OptimizationPriority)}><option value="balanced">Dengeli deneyim</option><option value="engagement">Daha hareketli oyun</option><option value="house">Kasa güvenliği</option></select></label>
          </div>
          <div>
            <label><span>Araştırma derinliği</span><select value={batchRuns} onChange={event => setBatchRuns(Number(event.target.value))}><option value={500}>Keşif · deney başına 500 tur / tohum</option><option value={2000}>Ayrıntılı · 2.000 tur / tohum</option><option value={10000}>Derin · 10.000 tur / tohum</option></select></label>
            <label><span>Mevcut bonus sıklığını en az koru</span><select value={minBonusRetention} onChange={event => setMinBonusRetention(Number(event.target.value))}><option value={.8}>%80'ini koru</option><option value={.5}>%50'sini koru</option><option value={0}>Alt sınır koyma</option></select></label>
            <label><span>Değiştirilebilecek ayarlar</span><select value={String(allowPayoutChanges)} onChange={event => setAllowPayoutChanges(event.target.value === "true")}><option value="false">Özellik sıklıkları ve olasılıklar</option><option value="true">Ödeme ölçekleri de araştırılsın</option></select></label>
            <label><span>Çalıştırma kapsamı</span><select value={String(autoResearch)} onChange={event => setAutoResearch(event.target.value === "true")}><option value="true">Simülasyon + neden araştırması</option><option value="false">Yalnız simülasyon</option></select></label>
          </div>
          <p className="sim-protected">Oyun kimliği korunur: kazanç tavanı, satın alım bedelleri ve jackpot ödül ayarları değiştirilemez. {protectedGameSettings(settings.games[gameId]).filter(item => item.path.endsWith("maxWinX")).map(item => <b key={item.path}>Mevcut tavan {x(item.value)} · kilitli </b>)}</p>
        </details>
        <button type="button" className="sim-run" disabled={busy} onClick={() => run()}>{busy ? <><i /> MOTOR ÇALIŞIYOR</> : <>{autoResearch ? "SİMÜLE ET VE NEDENLERİ ARAŞTIR" : "SİMÜLASYONU ÇALIŞTIR"} <b>→</b></>}</button>
        {runs >= 100_000 && <p className="sim-volume-note">100.000 tur; özellik zinciri uzun slotlarda birkaç saniye sürebilir.</p>}
      </div>
    </fieldset>

    {progress && <div className="sim-research-progress" role="status"><div><b>{progress.phase}</b><span>{number.format(progress.simulatedRounds)} araştırma turu · {progress.completed} tohum grubu tamamlandı</span></div><button type="button" onClick={cancel}>DURDUR</button></div>}
    {error && <p className="sim-research-error" role="alert">{error}</p>}
    {history.length > 0 && <section className="sim-history"><header><small>SON KOŞULAR</small><span>Aynı oturumdaki raporlar</span></header><div>{history.map((item, index) => <button type="button" disabled={busy} key={`${item.report.request.seed}-${index}`} onClick={() => { setReport(item.report); setReportGameSettings(item.game); setResearch(item.research); setAppliedRecommendations([]); setNeedsVerification(false); }}><b>{item.report.gameName}</b><span>{item.report.modeName} · {compact.format(item.report.request.runs)} tur</span><strong>{rtpMultiple(item.report.observedRtp)} geri dönüş</strong></button>)}</div></section>}

    {report && <section className="sim-results">
      <header><div><small>03 · RAPOR</small><h3>{report.gameName} <i>/</i> {report.modeName}</h3><p>{report.request.runs.toLocaleString("tr-TR")} ana tur · {report.bonusRounds.toLocaleString("tr-TR")} ek/bonus tur · {number.format(report.durationMs)} ms</p></div><div><button type="button" onClick={exportCsv}>CSV</button><button type="button" onClick={exportJson}>JSON RAPOR</button></div></header>
      <nav className="sim-report-nav">{(["optimizer", "summary", "distribution", "causes", "technical"] as const).map((id) => <button type="button" key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{id === "optimizer" ? "AKILLI TEŞHİS & ÖNERİ" : id === "summary" ? "SONUÇ ÖZETİ" : id === "distribution" ? "DAĞILIM & RİSK" : id === "causes" ? "NEDEN VERİSİ" : "TEKNİK KAYIT"}</button>)}</nav>

      {view === "optimizer" && diagnosis && <div className="sim-optimizer">
        <section className={`sim-diagnosis ${diagnosis.status}`}>
          <div className="sim-diagnosis-mark">{diagnosis.status === "healthy" ? "✓" : "!"}</div>
          <div><small>MOTORUN KARARI</small><h4>{diagnosis.verdict}</h4><p>{diagnosis.explanation}</p></div>
          <span>{diagnosis.status === "uncertain" ? "KANIT BEKLENİYOR" : diagnosis.status === "warning" ? "SAPMA GÖZLENDİ" : "İYİLEŞME ÖLÇÜLDÜ"}</span>
        </section>
        <div className="sim-diagnosis-grid">
          <section><header><i>↑</i><b>Fazla olanlar</b></header>{diagnosis.tooHigh.length ? diagnosis.tooHigh.map((item) => <p key={item}>{item}</p>) : <p className="muted">Belirgin bir fazlalık saptanmadı.</p>}</section>
          <section><header><i>↓</i><b>Eksik olanlar</b></header>{diagnosis.tooLow.length ? diagnosis.tooLow.map((item) => <p key={item}>{item}</p>) : <p className="muted">Belirgin bir eksiklik saptanmadı.</p>}</section>
          <section><header><i>◎</i><b>Motor kanıtı</b></header>{diagnosis.evidence.map((item) => <p key={item}>{item}</p>)}</section>
        </div>
        <button type="button" className="sim-research-again" disabled={busy} onClick={() => run(true)}>{research ? "HEDEFLERİMLE YENİDEN ARAŞTIR" : "NEDENLERİ DENEYLERLE ARAŞTIR"}</button>
        {research && <SimulationResearchResults research={research} />}
        <section className="sim-prescriptions">
          <header><div><small>UYGULANABİLİR REÇETELER</small><h4>Önce gör, sonra siz onaylarsanız uygula</h4></div>{rollback && <button type="button" className="sim-undo" onClick={undoOptimization}>↶ SON DEĞİŞİKLİKLERİ GERİ AL</button>}</header>
          {needsVerification && <div className="sim-verify"><b>Profil değişti.</b><span>Güncel profille aynı senaryonun yeni raporunu alın.</span><button type="button" disabled={busy} onClick={() => run(false, true)}>YENİDEN SİMÜLE ET</button></div>}
          <div>{diagnosis.recommendations.map((recommendation) => {
            const applied = appliedRecommendations.includes(recommendation.id);
            return <article className={`${recommendation.priority} ${applied ? "applied" : ""}`} key={recommendation.id}>
              <header><span>BAĞIMSIZ DOĞRULAMA</span><em>Kanıt gücü: {recommendation.confidence}</em></header>
              <h5>{recommendation.title}</h5><p>{recommendation.summary}</p>
              {recommendation.changes.length > 0 && <div className="sim-change-list">{recommendation.changes.map((item) => <div key={item.path}><span><b>{item.label}</b><small>{item.reason}</small></span><code>{number.format(item.before)}{item.unit}</code><i>→</i><code>{number.format(item.after)}{item.unit}</code></div>)}</div>}
              <div className="sim-expected"><b>Yeni tohumlarda ölçülen etki</b><span>{recommendation.expectedEffect}</span></div>
              <button type="button" className="sim-apply" disabled={busy || !recommendation.applyable || applied || profileFingerprint(settings.games[report.request.gameId]) !== recommendation.sourceFingerprint} onClick={() => applyRecommendation(recommendation)}>{applied ? "✓ UYGULANDI" : recommendation.applyable ? "ÖLÇÜLMÜŞ AYARLARI UYGULA" : recommendation.blockedReason}</button>
              {profileFingerprint(settings.games[report.request.gameId]) !== recommendation.sourceFingerprint && !applied && <p>Bu rapordan sonra profil değişmiş. Güncel profille yeniden simüle edin.</p>}
            </article>;
          })}</div>
        </section>
      </div>}

      {view === "summary" && <>
        <div className="sim-metrics">
          <Metric label="ORTALAMA GERİ DÖNÜŞ" value={rtpMultiple(report.observedRtp)} note={`RTP ${percent(report.observedRtp)} · hedef ${rtpMultiple(report.targetRtp)}`} tone={report.observedRtp > report.targetRtp + 5 ? "danger" : "primary"} />
          <Metric label={report.net > 0 ? "KASA ZARARI" : "KASA KAZANCI"} value={`${report.net > 0 ? "−" : "+"}${compact.format(Math.abs(report.net))} PR`} note={`${x(Math.abs(report.net) / Math.max(1, report.totalStake))} net · oyuncu ${report.net > 0 ? "önde" : "geride"}`} tone={report.net > 0 ? "danger" : ""} />
          <Metric label="HİT / KÂRLI TUR" value={`${percent(report.hitRate * 100)} / ${percent(report.profitRate * 100)}`} note={`Push ${percent(report.pushRate * 100)}`} />
          <Metric label="EN BÜYÜK SONUÇ" value={x(report.maxWinX)} note={`P99 ${x(report.quantiles.p99)}`} />
          <Metric label="TOPLAM BAHİS" value={`${compact.format(report.totalStake)} PR`} note={`${report.actualRounds.toLocaleString("tr-TR")} fiziksel tur`} />
          <Metric label="%95 GÜVEN ARALIĞI" value={`${rtpMultiple(report.confidence95[0])} – ${rtpMultiple(report.confidence95[1])}`} note="Ortalama geri dönüş çarpanı" />
        </div>
        <div className="sim-insights">{report.insights.map((insight) => <article className={insight.tone} key={insight.title}><i>{insight.tone === "good" ? "✓" : insight.tone === "danger" ? "!" : insight.tone === "warn" ? "△" : "i"}</i><div><b>{insight.title}</b><p>{insight.body}</p></div></article>)}</div>
      </>}

      {view === "distribution" && <div className="sim-distribution-view">
        <section><header><div><small>ÖDEME DAĞILIMI</small><h4>Her çarpan bandındaki tur payı</h4></div></header><div className="sim-bars">{report.distribution.map((bucket) => <div key={bucket.label}><span>{bucket.label}</span><i><b style={{ width: `${Math.max(bucket.rate * 100, bucket.count ? .35 : 0)}%` }} /></i><strong>{percent(bucket.rate * 100)} <small>{bucket.count.toLocaleString("tr-TR")}</small></strong></div>)}</div></section>
        <section className="sim-risk-grid"><Metric label="ORTALAMA ÖDEME" value={x(report.averagePayoutX)} /><Metric label="STANDART SAPMA" value={x(report.standardDeviationX)} /><Metric label="MEDYAN" value={x(report.quantiles.p50)} /><Metric label="P90 / P95" value={`${x(report.quantiles.p90)} / ${x(report.quantiles.p95)}`} /><Metric label="EN UZUN KAYIP SERİSİ" value={`${report.maxLossStreak} tur`} /></section>
      </div>}

      {view === "causes" && <div className="sim-causes">
        <header><div><small>ETKEN / SEMBOL / ÖZELLİK</small><h4>Sonucun nereden geldiğini oku</h4></div><p>“Ortalama katı”, etkenin görüldüğü turların ödemesini tüm turların ortalamasıyla karşılaştırır. Doğrudan katkı yalnız motorun kesin ayırabildiği ödemedir; korelasyonla karıştırılmaz.</p></header>
        <div className="sim-cause-table"><div className="head"><span>Etken</span><span>Görülme</span><span>Tur oranı</span><span>Etkenli ort.</span><span>Ort. katı</span><span>Doğrudan pay</span></div>{report.causes.map((cause) => <div key={cause.label}><b>{cause.label}</b><span>{cause.occurrences.toLocaleString("tr-TR")}</span><span>{percent(cause.roundRate * 100)}</span><span>{x(cause.averagePayoutX)}</span><span className={cause.lift >= 2 ? "hot" : ""}>{number.format(cause.lift)}×</span><span>{cause.contributionShare > 0 ? percent(cause.contributionShare * 100) : "korelasyon"}</span></div>)}</div>
        {!report.causes.length && <p className="sim-empty">Bu senaryoda ayrıştırılabilir bir özellik olayı görülmedi. Daha yüksek deneme hacmiyle tekrar çalıştır.</p>}
      </div>}

      {view === "technical" && <div className="sim-technical">
        <section>{report.metadata.map((item) => <div key={item.label}><small>{item.label}</small><code>{item.value}</code></div>)}<div><small>İstek</small><code>{JSON.stringify(report.request)}</code></div></section>
        <article><b>Tekrar üretilebilirlik</b><p>Aynı oyun profili, mod, bahis, deneme sayısı ve tohum aynı sonucu üretir. Simülasyon bakiye, gerçek oyun geçmişi, rekabet sistemi veya oyuncu profillerine kayıt yazmaz.</p><b>Yorum sınırı</b><p>%95 aralığı örnek ortalamasının Monte Carlo belirsizliğini gösterir. Nadir jackpot ve uzun özellik zincirlerinde 100.000 tur bile kuyruk riskini bütünüyle temsil etmeyebilir.</p></article>
      </div>}
    </section>}
  </div>;
}
