import { useMemo, useState, useSyncExternalStore } from "react";
import { getAdminSettings, subscribeAdminSettings, updateAdminGame, type AdminGameSettings } from "../data/casino-admin";
import type { CasinoGameId } from "../data/casino-database";
import { SIMULATION_GAMES } from "../games/simulation/casino-simulation-engine";
import { readGameSetting, researchKnobs, type OptimizationChange } from "../games/simulation/simulation-optimizer";

export const settingNumber = (value: number) => Number.isFinite(value) ? value.toLocaleString("tr-TR", { maximumFractionDigits: 6 }) : "—";
const terms: Record<string, string> = {
  targetRtp: "Kayıtlı RTP hedefi", allah: "Allah’ın Lütfu", mineDrop: "Baykuş Madeni", slot: "Slot", math: "Matematik",
  flow: "Oyun akışı", maxWinX: "Azami ödeme", maxPayoutX: "Azami ödeme", maxMultiplier: "Azami çarpan",
  globalMultiplierCap: "Global çarpan tavanı", base: "Normal", enhancer: "Lütuf Arttırıcı", degen: "Deli Cesareti", trickster: "Hilebaz",
  fate: "Kaderin Hükmü", modeCosts: "Dönüş maliyeti", bonusCosts: "Bonus maliyeti", payoutScales: "Ödeme ölçekleri",
  symbolWeights: "Makara sembol ağırlıkları", toolWeights: "Kazma ağırlıkları", mysteryWeights: "Mystery içeriği",
  fateMysteryWeights: "Kaderin Hükmü içeriği", eye: "Nur Gözü", collector: "Kese", coin: "Coin", upgrader: "Yükseltici Asa",
  redrop: "Yeniden Düşür", multiplier: "Yerel Çarpan", key: "Global Anahtar", maxCoin: "Max Coin",
  plinko: "Plinko", crash: "Crash", mines: "Mines", countdown: "Son On",
  minRows: "En az sıra", maxRows: "En fazla sıra", defaultRows: "Varsayılan sıra", maxConcurrentBalls: "Eşzamanlı top sınırı",
  animationMs: "Animasyon süresi (ms)", minMultiplier: "En düşük çarpan", defaultCashoutX: "Varsayılan çıkış çarpanı",
  payoutScale: "Temel ödeme ölçeği", bonusPayoutScale: "Bonus ödeme ölçeği", baseScatterRate: "Normal scatter sıklığı",
  bonusScatterRate: "Bonus scatter sıklığı", baseSpecialRate: "Normal özel sembol sıklığı", bonusSpecialRate: "Bonus özel sembol sıklığı",
  basePrizeRate: "Normal ödül sembolü sıklığı", bonusPrizeRate: "Bonus ödül sembolü sıklığı", cascadeAffinityPercent: "Ardışık eşleşme eğilimi",
};
export function commonGameFields(game: AdminGameSettings) {
  const definitions = SIMULATION_GAMES.find(d => d.id === game.id)!;
  const known = new Map(definitions.modes.flatMap(mode => researchKnobs(game, mode.id, true).map(k => [k.path, { ...k, label: k.global ? k.label : mode.label + " · " + k.label }] as const)));
  const fields: Array<{ path: string; label: string; unit: string; max?: number }> = [];
  const visit = (value: unknown, path: string) => {
    if (typeof value === "number") {
      const knob = known.get(path);
      fields.push({ path, label: knob?.label ?? path.split(".").map(p => terms[p] ?? p).join(" › "), unit: knob?.unit ?? (/maxWinX|maxPayoutX|Multiplier|Scale|Costs|bonusBuyX/.test(path) ? "×" : /Percent|targetRtp/.test(path) ? "%" : ""), max: knob?.max });
    } else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => visit(entry, path + "." + key));
  };
  visit(game.targetRtp, "targetRtp");
  for (const key of ["allah", "mineDrop", "slot", "crash", "mines", "countdown", "plinko"] as const) {
    if (!game[key]) continue;
    const source = { ...game[key] } as Record<string, unknown>;
    for (const omit of ["animation", "presentation", "music"]) delete source[omit];
    visit(source, key);
  }
  return fields;
}

export default function GameSettingsBridge({ gameId, snapshot, changes = [], editable = false, onOpenSettings }: {
  gameId: CasinoGameId; snapshot?: AdminGameSettings; changes?: OptimizationChange[];
  editable?: boolean; onOpenSettings?: () => void;
}) {
  const settings = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings);
  const game = settings.games[gameId];
  const [search, setSearch] = useState("");
  const fields = useMemo(() => commonGameFields(game), [game]);
  const displayed = fields.filter(f => (f.label + f.path).toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  const save = (path: string, value: number, max?: number) => {
    if (!Number.isFinite(value) || value < (path === "targetRtp" ? 1 : 0) || max !== undefined && value > max || path === "targetRtp" && value > 100) return;
    const current = getAdminSettings().games[gameId], next = structuredClone(current);
    const parts = path.split(".");
    let target = next as unknown as Record<string, unknown>;
    for (const key of parts.slice(0, -1)) target = target[key] as Record<string, unknown>;
    target[parts.at(-1)!] = value;
    updateAdminGame(gameId, next);
  };
  return <details className="sim-settings-bridge">
    <summary>Oyun Yönetimi ile ortak ayarlar · {game.name}</summary>
    <p>{editable ? "Burada kaydettiğiniz değerler Oyun Yönetimi’nin gerçek ayarlarıdır. Simülasyon da yeni araştırmaya bu değerlerle başlar." : "Canlı sütunu doğrudan Oyun Yönetimi’nden okunur. Deneydeki değerler geçici öneridir; onaylanmadıkça canlı sütununa yazılmaz."}</p>
    <div className="sim-bridge-controls"><label>Ayar ara<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Örn. göz, ödeme, scatter" /></label>{onOpenSettings && <button type="button" onClick={onOpenSettings}>BU OYUNU YÖNETİMDE AÇ</button>}</div>
    <div className="sim-bridge-table"><table><thead><tr><th>Aynı ayar</th><th>Şu an canlı</th>{snapshot && <th>Araştırma başladığında</th>}{changes.length > 0 && <th>Deneyde önerilen · henüz kayıt değil</th>}</tr></thead>
      <tbody>{displayed.map(field => {
        const current = readGameSetting(game, field.path), original = snapshot && readGameSetting(snapshot, field.path);
        const change = changes.find(c => c.path === field.path);
        return <tr key={field.path}><td><b>{field.label}</b><small>{field.path}</small></td>
          <td>{editable ? <input aria-label={field.label} type="number" min={field.path === "targetRtp" ? 1 : 0} max={field.max} step="any" value={current} onChange={event => { if (event.target.value !== "") save(field.path, Number(event.target.value), field.max); }} /> : <strong>{settingNumber(current)}</strong>} {field.unit}</td>
          {snapshot && <td>{settingNumber(original!)} {field.unit}{current !== original && <small>Canlı değer sonradan değişti</small>}</td>}
          {changes.length > 0 && <td>{change ? settingNumber(change.after) + " " + field.unit : "Değişiklik önerilmiyor"}</td>}
        </tr>;
      })}</tbody></table></div>
  </details>;
}
