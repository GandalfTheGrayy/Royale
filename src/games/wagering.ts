/**
 * Pehlevan Royale ortak bahis standardı.
 * Hızlı kupürler kolaylıktır; bahis tavanı değildir.
 */
export const CASINO_CHIP_VALUES = [
  25, 50, 100, 250, 500,
  1_000, 5_000, 10_000, 20_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000,
] as const;

export const CASINO_BET_STEPS = [
  5, 25, 100, 500, 1_000, 5_000, 10_000, 20_000,
  50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000,
] as const;

export function compactWager(value: number) {
  if (value >= 1_000_000_000) return `${trimCompact(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `${trimCompact(value / 1_000_000)}M`;
  if (value >= 1_000) return `${trimCompact(value / 1_000)}K`;
  return `${Math.round(value)}`;
}

function trimCompact(value: number) {
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: value < 10 && !Number.isInteger(value) ? 1 : 0,
  });
}

export function maximumAffordableWager(balance: number, costMultiplier = 1, unit = 1) {
  const safeBalance = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  const safeMultiplier = Number.isFinite(costMultiplier) && costMultiplier > 0 ? costMultiplier : 1;
  const safeUnit = Number.isFinite(unit) && unit > 0 ? unit : 1;
  return Math.floor(safeBalance / safeMultiplier / safeUnit) * safeUnit;
}

export function normalizeWagerInput(value: number, minimum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, value);
}

export function openingReward(gross: number, stake: number, boost = 0) {
  if (!Number.isFinite(boost) || boost <= 0) return 0;
  return Math.round(Math.max(0, gross - stake) * Math.min(0.25, boost) * 100) / 100;
}
