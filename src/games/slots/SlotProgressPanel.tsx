import { useSyncExternalStore } from "react";
import type { SlotProgressionSettings } from "../../data/casino-admin";
import {
  getSlotProgress,
  slotLevel,
  subscribeSlotProgress,
  type ProgressSlotId,
} from "./slot-progression";
import "./slot-progression.css";

type Props = {
  game: ProgressSlotId;
  settings: SlotProgressionSettings;
  collectionEnabled: boolean;
};

const titles: Record<
  ProgressSlotId,
  { eyebrow: string; rank: string; collection: string }
> = {
  "neon-kasasi": {
    eyebrow: "KASA ERİŞİMİ",
    rank: "Güvenlik seviyesi",
    collection: "Keşfedilen güçler",
  },
  "kaptan-mercan": {
    eyebrow: "SEYİR DEFTERİ",
    rank: "Kaptanlık rütbesi",
    collection: "Avlanan değerler",
  },
  "sekerhane-1024": {
    eyebrow: "TARİF DEFTERİ",
    rank: "Şeker ustalığı",
    collection: "Keşfedilen sırlar",
  },
};

export default function SlotProgressPanel({
  game,
  settings,
  collectionEnabled,
}: Props) {
  const progress = useSyncExternalStore(
    subscribeSlotProgress,
    () => getSlotProgress(game),
    () => getSlotProgress(game),
  );
  if (!settings.enabled) return null;
  const level = slotLevel(progress.xp, settings.levelBaseXp);
  const copy = titles[game];
  return (
    <section className={`slot-progress-panel ${game}`}>
      <header>
        <small>{copy.eyebrow}</small>
        <b>LV {level.level}</b>
      </header>
      <strong>{copy.rank}</strong>
      <div className="slot-progress-track">
        <i style={{ width: `${level.percent}%` }} />
      </div>
      <p>
        {Math.floor(level.current)} / {Math.floor(level.required)} XP ·{" "}
        {progress.wins} kazanç · {progress.bonuses} bonus
      </p>
      {collectionEnabled && (
        <div className="slot-progress-collection">
          <small>{copy.collection}</small>
          <span>
            {progress.discoveries.slice(-7).map((item) => (
              <i key={item}>{item}×</i>
            ))}
            {!progress.discoveries.length && (
              <em>İlk özel sembol bekleniyor</em>
            )}
          </span>
        </div>
      )}
    </section>
  );
}
