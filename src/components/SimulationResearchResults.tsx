import { useState } from "react";
import type { ResearchComparison, SimulationResearch } from "../games/simulation/simulation-optimizer";

const number = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const rtp = (n: number) => "%" + number(n);
export function Comparison({ value }: { value: ResearchComparison }) {
  return <div className="sim-measured-comparison">
    <div><small>GERİ DÖNÜŞ</small><b>{rtp(value.before.rtp)} → {rtp(value.after.rtp)}</b></div>
    <div><small>ÖDEME GÖRÜLEN TUR</small><b>{rtp(value.before.hitRate * 100)} → {rtp(value.after.hitRate * 100)}</b></div>
    <div><small>KÂRLI TUR</small><b>{rtp(value.before.profitRate * 100)} → {rtp(value.after.profitRate * 100)}</b></div>
    <div><small>ANA TUR BAŞINA BONUS SPİN</small><b>{number(value.before.bonusRate)} → {number(value.after.bonusRate)}</b></div>
    <div><small>BONUSA GİREN ANA TUR</small><b>{rtp(value.before.bonusFrequency * 100)} → {rtp(value.after.bonusFrequency * 100)}</b></div>
    <div><small>RTP FARKI · YAKLAŞIK %95 ARALIK</small><b>{number(value.rtpDelta95[0])} – {number(value.rtpDelta95[1])} puan</b></div>
    <div><small>HEDEFE YAKLAŞMA · YAKLAŞIK %95 ARALIK</small><b>{number(value.improvement95[0])} – {number(value.improvement95[1])} puan</b></div>
  </div>;
}
export default function SimulationResearchResults({ research }: { research: SimulationResearch }) {
  const [showAll, setShowAll] = useState(false);
  const experiments = [...research.experiments].sort((a, b) => Number(a.kind === "scenario") - Number(b.kind === "scenario") || a.score - b.score);
  const selected = experiments.find(e => e.id === research.selectedId);
  const validation = research.diagnosis.recommendations[0]?.validation;
  return <section className="sim-research-results">
    <header><div><small>DENEY DEFTERİ</small><h4>Hangi ayar gerçekten neyi değiştirdi?</h4></div><span>{number(research.totalSimulatedRounds)} araştırma turu · {number(research.durationMs / 1000)} sn</span></header>
    <details className="sim-reading-guide"><summary>Bu sonuçları nasıl okumalıyım?</summary><p>RTP, toplam bahislerin ne kadarının ödeme olarak geri döndüğüdür. Örneğin %96,7: her 100 PR bahis için ortalama 96,7 PR ödeme. Tek turda garanti değildir. %100’ün üzeri bu örnekte kasanın zarar ettiğini gösterir.</p><p>Ödeme görülen tur, herhangi bir ödeme alınan ana turdur; kârlı tur ise ödemenin maliyeti aştığı turdur. Bonus sıklığı, bonusa giren ana turların oranıdır. 1 yüzde puan, örneğin %97’den %96’ya değişimdir.</p><p>Önce: araştırmanın başladığı profil. Sonra: yalnız deney ortamında değiştirilen profil. Bunlar canlı ayar değildir. Küçük veya nadir olaylı örneklerde belirsizlik yüksektir; motor kanıt yetersizse kayda izin vermez.</p></details>
    {research.iterations.length > 0 && <details open className="sim-iteration-list"><summary>Motor kendi denemesini nasıl ilerletti? · {research.iterations.length} adım</summary><p>İlk taramadan sonra en iyi geçici ayarlarla devam edildi. Her adım ilk profille aynı arama tohumlarında kıyaslandı. Hiçbir adım canlıya kaydedilmedi.</p>{research.iterations.map(step => <article key={step.step}><b>{step.step}. adım · {step.accepted ? "Daha iyi geçici profil bulundu" : "İlerleme durdu"}</b><p>{step.label} RTP: {rtp(step.comparison.before.rtp)} → {rtp(step.comparison.after.rtp)} · {step.changes.length} ayar.</p></article>)}</details>}
    <p>Bu araştırmanın hedefi {rtp(research.goal.targetRtp)} RTP; mevcut ödeme sıklığının %{number(research.goal.minHitRetention * 100)}'ini ve bonus sıklığının %{number(research.goal.minBonusRetention * 100)}'ini korumak. Her aday gerçek motorla çalıştırıldı. Arama sonuçları aday seçmek içindir; uygulama kararı ayrı tohumların doğrulamasına dayanır.</p>
    {selected && <div className="sim-research-winner"><small>ARAMADA ÖNE ÇIKAN ADAY</small><h4>{selected.label}</h4><p>{selected.mechanism}</p></div>}
    {validation && <section className="sim-validation">
      <h4>Aramada kullanılmayan {validation.seeds.length} tohumla doğrulama</h4>
      <p>Profil başına {number(validation.seeds.length * validation.runsPerSeed)} ek tur. Pozitif yaklaşma hedefe yakınlaşmayı, negatif değer uzaklaşmayı ifade eder. Aralık sıfırı kapsıyorsa sonuç kesinleştirilmez.</p>
      <Comparison value={validation} />
      <details><summary>Tohumlar ve hedefe yaklaşma sonuçları</summary><div className="sim-seed-results">{validation.seeds.map((seed, i) => <div key={seed}><code>{seed}</code><span>{number(validation.improvements[i])} puan yaklaşma</span></div>)}</div></details>
    </section>}
    <div className="sim-experiment-scroll"><table className="sim-experiment-table">
      <thead><tr><th>Deney / değiştirilen ayar</th><th>Önce RTP</th><th>Sonra RTP</th><th>Ödeme oranı</th><th>RTP fark aralığı</th><th>Ölçüm</th></tr></thead>
      <tbody>{(showAll ? experiments : experiments.slice(0, 8)).map(experiment => <tr key={experiment.id} className={experiment.id === research.selectedId ? "selected" : ""}>
        <td><b>{experiment.label}</b><small>{experiment.kind === "scenario" ? "Oyuncu senaryosu · ayar önerisi değil" : experiment.kind === "combination" ? "Birleşik deney" : "Tek ayar deneyi"}</small>
          <details><summary>Mekanizma ve olay değişimi</summary><p>{experiment.mechanism}</p>
            {experiment.changes.map(change => <p key={change.path}><code>{change.path}</code> · {number(change.before)} → {number(change.after)}</p>)}
            {Object.entries(experiment.comparison.before.causes).filter(([label, before]) => Math.abs(before - (experiment.comparison.after.causes[label] ?? 0)) > .001).slice(0, 12).map(([label, before]) => <p key={label}>{label}: {number(before)} → {number(experiment.comparison.after.causes[label] ?? 0)} / ana tur</p>)}
          </details>
        </td>
        <td>{rtp(experiment.comparison.before.rtp)}</td><td>{rtp(experiment.comparison.after.rtp)}</td>
        <td>{rtp(experiment.comparison.before.hitRate * 100)} → {rtp(experiment.comparison.after.hitRate * 100)}</td>
        <td>{number(experiment.comparison.rtpDelta95[0])} – {number(experiment.comparison.rtpDelta95[1])} puan</td>
        <td>{experiment.comparison.seeds.length} × {number(experiment.comparison.runsPerSeed)} tur</td>
      </tr>)}</tbody>
    </table></div>
    {experiments.length > 8 && <button type="button" onClick={() => setShowAll(!showAll)}>{showAll ? "İLK 8 DENEYİ GÖSTER" : "TÜM " + experiments.length + " DENEYİ GÖSTER"}</button>}
    {research.interactions.map(text => <p className="sim-interaction" key={text}>{text}</p>)}
    {research.crossModes.length > 0 && <details><summary>Ortak ayarın diğer modlara etkisi ({research.crossModes.length} mod)</summary>{research.crossModes.map(mode => <article key={mode.mode}><h4>{mode.mode} · {mode.regression ? "GERİLEME GÖZLENDİ" : "bu örnekte belirgin gerileme saptanmadı"}</h4><Comparison value={mode.comparison} /></article>)}</details>}
    <details className="sim-research-method"><summary>Korunan tasarım, yöntem ve ölçüm sınırları</summary>
      {research.protectedSettings.filter(item => /maxWinX|maxPayoutX|maxMultiplier|globalMultiplierCap/.test(item.path)).map(item => <p key={item.path}><code>{item.path}</code>: {number(item.value)}× · değişmedi</p>)}
      {research.limitations.map(text => <p key={text}>{text}</p>)}
    </details>
  </section>;
}
