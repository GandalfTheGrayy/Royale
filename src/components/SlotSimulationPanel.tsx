import { useState } from "react";
import type { AdminGameSettings } from "../data/casino-admin";
import {
  runSlotSimulation,
  type SimulatableSlotId,
  type SlotSimulationMode,
  type SlotSimulationReport,
} from "../games/slots/slot-simulation-engine";

const percent = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export default function SlotSimulationPanel({
  game,
}: {
  game: AdminGameSettings & { id: SimulatableSlotId };
}) {
  const [mode, setMode] = useState<SlotSimulationMode>("paid-spins");
  const [runs, setRuns] = useState(100);
  const [seed, setSeed] = useState(1296389187);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SlotSimulationReport>();

  const run = () => {
    setBusy(true);
    setReport(undefined);
    window.setTimeout(() => {
      try {
        setReport(
          runSlotSimulation(
            {
              gameId: game.id,
              mode,
              runs,
              wager: Math.max(game.minBet, game.defaultBet),
              seed,
            },
            game,
          ),
        );
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  return (
    <>
      <div className="slot-editor-heading">
        <div>
          <small>YALNIZCA YÖNETİCİ</small>
          <h4>Hızlı slot ve free-spin simülasyonu</h4>
        </div>
        <code>slot-sim-v1</code>
      </div>
      <p className="slot-editor-warning">
        Gerçek bakiye ve oyun geçmişi değişmez. Ücretli spin modu tetiklenen
        bonusları sonuna kadar oynar; free-spin modu seçilen sayıda bağımsız
        bonus oturumu başlatır. O anda kayıtlı matematik ve akış ayarları kullanılır.
      </p>
      <section className="slot-sim-controls">
        <label>
          <span>Simülasyon türü</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as SlotSimulationMode)}
          >
            <option value="paid-spins">Ücretli spin + çıkan bonuslar</option>
            <option value="bonus-sessions">Doğrudan free-spin oturumları</option>
          </select>
        </label>
        <label>
          <span>Deneme sayısı</span>
          <input
            type="number"
            min="1"
            max="100000"
            value={runs}
            onChange={(event) =>
              setRuns(Math.max(1, Math.min(100000, Number(event.target.value))))
            }
          />
        </label>
        <label>
          <span>Sabit tohum</span>
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value))}
          />
        </label>
        <div className="slot-sim-presets">
          {[100, 1000, 10000].map((value) => (
            <button type="button" key={value} onClick={() => setRuns(value)}>
              {value.toLocaleString("tr-TR")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="slot-sim-run"
          disabled={busy}
          onClick={run}
        >
          {busy ? "HESAPLANIYOR…" : "SİMÜLASYONU ÇALIŞTIR"}
        </button>
      </section>
      {report && (
        <section className="slot-sim-report">
          <header>
            <div>
              <small>SON RAPOR</small>
              <h4>
                {report.requestedRuns.toLocaleString("tr-TR")} deneme ·{" "}
                {report.durationMs.toLocaleString("tr-TR", {
                  maximumFractionDigits: 0,
                })}{" "}
                ms
              </h4>
            </div>
            <strong>%{percent.format(report.rtp * 100)} RTP</strong>
          </header>
          <div>
            <span><small>ÜCRETLİ SPİN</small><b>{report.paidSpins.toLocaleString("tr-TR")}</b></span>
            <span><small>BONUS OTURUMU</small><b>{report.bonusSessions.toLocaleString("tr-TR")}</b></span>
            <span><small>FREE SPİN</small><b>{report.freeSpins.toLocaleString("tr-TR")}</b></span>
            <span><small>ORT. BONUS</small><b>{report.averageBonusLength.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</b></span>
            <span><small>EN UZUN BONUS</small><b>{report.maxBonusLength}</b></span>
            <span><small>FENER UZATMASI</small><b>{report.retriggerEvents}</b></span>
            <span><small>EKLENEN SPİN</small><b>{report.extraSpins}</b></span>
            <span><small>HIT ORANI</small><b>%{percent.format(report.hitRate * 100)}</b></span>
            <span><small>10× / 25×</small><b>{report.wins10x} / {report.wins25x}</b></span>
            <span><small>50× / 100×</small><b>{report.wins50x} / {report.wins100x}</b></span>
            <span><small>EN BÜYÜK SPİN</small><b>{report.maxWinX.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}×</b></span>
            <span><small>VİTRİN OLAYI</small><b>{report.visiblePotentialEvents}</b></span>
          </div>
          {report.cappedSessions > 0 && (
            <p className="slot-sim-alert">
              {report.cappedSessions} oturum güvenlik sınırına ulaştı. Bonus
              oturumu sınırını ve retrigger ayarlarını incele.
            </p>
          )}
        </section>
      )}
    </>
  );
}
