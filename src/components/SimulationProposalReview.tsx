import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getAdminSettings, subscribeAdminSettings } from "../data/casino-admin";
import type { CasinoSimulationRequest } from "../games/simulation/casino-simulation-engine";
import { profileFingerprint, readGameSetting, type ResearchProgress, type SimulationOptimizationGoal, type SimulationRecommendation } from "../games/simulation/simulation-optimizer";
import { settingNumber } from "./GameSettingsBridge";
import { Comparison } from "./SimulationResearchResults";

export default function SimulationProposalReview({ recommendation, request, goal, disabled, onBusy, onApply }: {
  recommendation: SimulationRecommendation; request: CasinoSimulationRequest; goal: SimulationOptimizationGoal;
  disabled: boolean; onBusy: (value: boolean) => void; onApply: (value: SimulationRecommendation) => void;
}) {
  const settings = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings);
  const game = settings.games[request.gameId];
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<SimulationRecommendation>();
  const [progress, setProgress] = useState<ResearchProgress>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => { if (worker.current) { worker.current.terminate(); onBusy(false); } }, [onBusy]);
  const available = recommendation.changes.filter(c => readGameSetting(game, c.path) !== c.after && readGameSetting(game, c.path) === c.before);
  const chosen = available.filter(c => selected.includes(c.path));
  const stale = preview && preview.sourceFingerprint !== profileFingerprint(game);
  const savedCurrent = saved && preview?.changes.every(c => readGameSetting(game, c.path) === c.after);
  const choose = (paths: string[]) => { setSelected(paths); setPreview(undefined); setSaved(false); setError(""); };
  const stop = () => { worker.current?.terminate(); worker.current = null; setProgress(undefined); onBusy(false); };
  const validate = () => {
    setError(""); setSaved(false); setPreview(undefined); onBusy(true);
    setProgress({ phase: "Seçili ayarlar güncel profilin kopyasıyla deneniyor", completed: 0, simulatedRounds: 0 });
    const active = new Worker(new URL("../games/simulation/simulation-worker.ts", import.meta.url), { type: "module" });
    worker.current = active;
    active.onmessage = ({ data }) => {
      if (worker.current !== active) return;
      if (data.type === "progress") setProgress(data.progress);
      if (data.type === "selection") setPreview(data.recommendation);
      if (data.type === "error") setError(data.error);
      if (data.type === "error" || data.type === "done") stop();
    };
    active.onerror = event => { setError(event.message); stop(); };
    active.postMessage({ request, settings: structuredClone(getAdminSettings()), goal, selectedChanges: chosen });
  };
  return <article className="sim-proposal-review">
    <h4>1. Değiştirmek istediğiniz ayarları seçin</h4>
    <p>Öneriyi topluca kabul etmek zorunda değilsiniz. Bir veya birkaç ayarı seçin. Seçmediğiniz değerler aynen korunur; kalan önerileri daha sonra ayrı deneyebilirsiniz.</p>
    <p>{recommendation.summary}</p>
    <button type="button" disabled={disabled} onClick={() => choose(chosen.length === available.length ? [] : available.map(c => c.path))}>{chosen.length === available.length ? "SEÇİMİ TEMİZLE" : "UYGUN AYARLARIN TÜMÜNÜ SEÇ"}</button>
    <div className="sim-proposal-options">{recommendation.changes.map(change => {
      const current = readGameSetting(game, change.path), applied = current === change.after, conflict = current !== change.before && !applied;
      return <label key={change.path}><input type="checkbox" checked={selected.includes(change.path) && !applied && !conflict} disabled={disabled || applied || conflict} onChange={event => choose(event.target.checked ? [...selected, change.path] : selected.filter(p => p !== change.path))} /><span><b>{change.label}</b><small>{change.reason}</small><code>{change.path}</code><strong>Şu an canlı: {settingNumber(current)}{change.unit} → Öneri: {settingNumber(change.after)}{change.unit}</strong>{applied && <em>Bu değer zaten Oyun Yönetimi’nde kayıtlı.</em>}{conflict && <em>Bu ayar sonradan değişti; üzerine yazılmaz. Güncel profille yeniden araştırın.</em>}</span></label>;
    })}</div>
    <h4>2. Yalnız seçiminizin etkisini ölçün</h4>
    <p>Öneri paketinin sonucu, içinden tek bir ayarı uygulamanın sonucu değildir. Bu yüzden seçiminiz güncel canlı profile karşı 6 ayrı tohumla yeniden ölçülür. Ortak ayarlarda diğer modlar da kontrol edilir.</p>
    <button type="button" disabled={disabled || !chosen.length} onClick={validate}>SEÇİLİ {chosen.length} AYARI GEÇİCİ PROFİLDE DENE</button>
    {progress && <div role="status"><p>{progress.phase} · {settingNumber(progress.simulatedRounds)} tur · canlıya kayıt yok</p><button type="button" onClick={() => { stop(); setError("Seçim deneyi durduruldu; canlı ayarlar değişmedi."); }}>DENEMEYİ DURDUR</button></div>}
    {error && <p role="alert">{error}</p>}
    {preview && <section className="sim-selection-preview"><h4>3. Sonucu inceleyin ve yalnız isterseniz kaydedin</h4><p>{preview.expectedEffect}</p>{preview.validation && <Comparison value={preview.validation} />}
      <p>{preview.changes.map(c => c.label + ": " + settingNumber(c.before) + " → " + settingNumber(c.after)).join(" · ")}</p>
      {stale && !savedCurrent && <p role="alert">Canlı profil bu denemeden sonra değişti. Yeni değerleri ezmemek için seçiminizi yeniden deneyin.</p>}
      {!preview.applyable && <p role="alert">Kayıt kapalı: {preview.blockedReason} Daha kapsamlı araştırma yapabilir veya farklı bir seçim deneyebilirsiniz.</p>}
      <button type="button" className="sim-apply" disabled={disabled || !preview.applyable || !!stale || !!savedCurrent} onClick={() => { onApply(preview); if (preview.changes.every(c => readGameSetting(getAdminSettings().games[request.gameId], c.path) === c.after)) { setSaved(true); setSelected([]); } }}> {savedCurrent ? "SEÇİLİ AYARLAR OYUN YÖNETİMİ’NE KAYDEDİLDİ" : "EVET, SEÇİLİ " + preview.changes.length + " AYARI OYUN YÖNETİMİ’NE KAYDET"}</button>
      <p>Bu onay gerçek oyun ayarlarını değiştirir. Rapor geçmiş ölçüm olarak kalır; yeni rapor güncel ayarlarla çalışır. Son kayıt grubunu üstteki geri al düğmesiyle geri alabilirsiniz.</p>
    </section>}
  </article>;
}
