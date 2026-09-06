import type { SlotProgressionSettings } from "../../data/casino-admin";

export type ProgressSlotId = "neon-kasasi" | "kaptan-mercan" | "sekerhane-1024";

export type SlotProgressRecord = {
  game: ProgressSlotId;
  xp: number;
  spins: number;
  wins: number;
  bonuses: number;
  specials: number;
  discoveries: string[];
  updatedAt: string;
};

export type SlotProgressEvent = {
  win?: boolean;
  bonus?: boolean;
  specialCount?: number;
  discoveries?: Array<string | number>;
};

const STORAGE_KEY = "pehlevan-slot-progression-v1";
const listeners = new Set<() => void>();

const emptyRecord = (game: ProgressSlotId): SlotProgressRecord => ({
  game,
  xp: 0,
  spins: 0,
  wins: 0,
  bonuses: 0,
  specials: 0,
  discoveries: [],
  updatedAt: new Date(0).toISOString(),
});

function loadRecords(): Record<ProgressSlotId, SlotProgressRecord> {
  const fallback = {
    "neon-kasasi": emptyRecord("neon-kasasi"),
    "kaptan-mercan": emptyRecord("kaptan-mercan"),
    "sekerhane-1024": emptyRecord("sekerhane-1024"),
  };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<Record<ProgressSlotId, SlotProgressRecord>> | null;
    if (!saved) return fallback;
    return {
      "neon-kasasi": { ...fallback["neon-kasasi"], ...saved["neon-kasasi"] },
      "kaptan-mercan": {
        ...fallback["kaptan-mercan"],
        ...saved["kaptan-mercan"],
      },
      "sekerhane-1024": {
        ...fallback["sekerhane-1024"],
        ...saved["sekerhane-1024"],
      },
    };
  } catch {
    return fallback;
  }
}

let records = loadRecords();

function persist() {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  listeners.forEach((listener) => listener());
}

export function subscribeSlotProgress(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSlotProgress(game: ProgressSlotId) {
  return records[game];
}

export function recordSlotProgress(
  game: ProgressSlotId,
  event: SlotProgressEvent,
  settings: SlotProgressionSettings,
) {
  if (!settings.enabled) return;
  const current = records[game];
  const specialCount = Math.max(0, Math.round(event.specialCount ?? 0));
  const gainedXp =
    settings.xpPerSpin +
    (event.win ? settings.xpPerWin : 0) +
    (event.bonus ? settings.xpPerBonus : 0) +
    specialCount * settings.xpPerSpecial;
  records = {
    ...records,
    [game]: {
      ...current,
      xp: current.xp + Math.max(0, gainedXp),
      spins: current.spins + 1,
      wins: current.wins + (event.win ? 1 : 0),
      bonuses: current.bonuses + (event.bonus ? 1 : 0),
      specials: current.specials + specialCount,
      discoveries: [
        ...new Set([
          ...current.discoveries,
          ...(event.discoveries ?? []).map(String),
        ]),
      ].sort((a, b) => Number(a) - Number(b)),
      updatedAt: new Date().toISOString(),
    },
  };
  persist();
}

export function slotLevel(xp: number, baseXp: number) {
  const safeBase = Math.max(1, baseXp);
  let level = 1;
  let floor = 0;
  let ceiling = safeBase;
  while (xp >= ceiling && level < 250) {
    floor = ceiling;
    level += 1;
    ceiling += safeBase * level;
  }
  return {
    level,
    current: Math.max(0, xp - floor),
    required: Math.max(1, ceiling - floor),
    percent: Math.min(100, ((xp - floor) / Math.max(1, ceiling - floor)) * 100),
  };
}
