import type { CasinoGameId } from "../../data/casino-database";
import type { CasinoAdminSettings } from "../../data/casino-admin";
import { createDeck, handValue, isBlackjack, type Card } from "../../lib/blackjack";
import {
  EUROPEAN_WHEEL,
  dozens,
  outsideBets,
  settleBets,
  straightBet,
} from "../roulette/roulette-engine";
import { dealCasinoHoldem, resolveCasinoHoldem } from "../poker/casino-holdem-engine";
import { KIRAZ_REELS, evaluateSlot } from "../slots/slot-engine";
import { runSlotSimulation, type SimulatableSlotId } from "../slots/slot-simulation-engine";
import {
  ALLAH_SYMBOLS,
  defaultAllahPersistentState,
  prepareAllahSpinPersistent,
  runAllahSpin,
  type AllahBonusState,
  type AllahPurchaseMode,
} from "../slots/allahin-lutfu-engine";
import {
  accrueMineBonusSpin,
  createMine,
  createMineBonusProgress,
  runMineSpin,
  rollMysteryOutcome,
  settleMineBonusFinal,
  type MineBonusTier,
  type MinePaidMode,
} from "../slots/baykus-madeni-engine";
import { limboResultFromUnit } from "../limbo/limbo-engine";
import { kenoPaytable } from "../keno/keno-engine";
import { plinkoMultipliers } from "../plinko/plinko-engine";
import { batchMultiplier, batchWinProbability } from "../mines-original/mines-original-engine";
import { depthMultiplier, freeMultiplier, freeSurvivalProbability } from "../mines/mines-engine";
import { countdownMultiplier, countdownSafeChance } from "../countdown/son-on-engine";
import { GEM_IDS, classifyGems, gemPayoutTable } from "../diamonds/yedi-cevher-engine";
import { roundHiloMultiplier, roundHiloMoney } from "../hilo/hilo-engine";

export type SimulationMode = { id: string; label: string; description: string };
export type SimulationParameter = {
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  suffix: string;
};

export type SimulationGameDefinition = {
  id: CasinoGameId;
  group: "Masa" | "Slot" | "Anlık" | "Originals";
  modes: SimulationMode[];
  parameter?: SimulationParameter;
};

const mode = (id: string, label: string, description: string): SimulationMode => ({ id, label, description });

export const SIMULATION_GAMES: SimulationGameDefinition[] = [
  { id: "blackjack", group: "Masa", modes: [mode("basic", "17'de dur", "17 altında kart çek; krupiye 17'de durur. Split / double içermeyen eşik stratejisi."), mode("stand-15", "Temkinli · 15'te dur", "Oyuncu 15 ve üzerinde durur."), mode("hit-18", "Agresif · 18'e kadar çek", "Oyuncu 18'e ulaşana kadar kart çeker.")] },
  { id: "roulette", group: "Masa", modes: [mode("red", "Kırmızı", "Tek dış bahis, 1:1 ödeme."), mode("dozen", "1. düzine", "1–12 aralığı, 2:1 ödeme."), mode("straight", "Tek sayı · 17", "17 numarasına düz bahis, 35:1 ödeme.")] },
  { id: "poker", group: "Masa", modes: [mode("always-call", "Her eli Call", "Ante'nin iki katı Call ile her el sonuna kadar oynanır."), mode("pair-call", "Çift veya üstü Call", "Flop sonrasında yalnız çift ve üstü elde Call yapılır.")] },
  { id: "kiraz-77", group: "Slot", modes: [mode("paid-spins", "Normal spin", "Canlı 3×3 makara ve ödeme çizgileri.")] },
  { id: "neon-kasasi", group: "Slot", modes: [mode("paid-spins", "Normal spin + doğal bonus", "Tetiklenen bonuslar sonuna kadar oynanır."), mode("bonus-sessions", "Bonus oturumu", "Doğrudan bağımsız free-spin oturumları.")] },
  { id: "kaptan-mercan", group: "Slot", modes: [mode("paid-spins", "Normal spin + doğal bonus", "Tetiklenen bonuslar sonuna kadar oynanır."), mode("bonus-sessions", "Bonus oturumu", "Doğrudan bağımsız free-spin oturumları.")] },
  { id: "sekerhane-1024", group: "Slot", modes: [mode("paid-spins", "Normal spin + doğal bonus", "Tetiklenen bonuslar sonuna kadar oynanır."), mode("bonus-sessions", "Bonus oturumu", "Doğrudan bağımsız free-spin oturumları.")] },
  { id: "allahin-lutfu", group: "Slot", modes: [
    mode("base", "Normal spin", "1× maliyetli temel oyun."), mode("enhancer", "Enhancer", "3× maliyetli güçlendirilmiş oyun."),
    mode("degen", "Degen", "25× maliyetli yüksek özellik modu."), mode("trickster", "Trickster", "75× maliyetli gizem/Göz modu."),
    mode("fate", "Kaderin Hükmü", "5.000× maliyetli FU spin."), mode("bonus-buy", "Bonus satın al", "200× maliyetli bonus satın alımı."),
    mode("super-bonus-buy", "Süper bonus satın al", "1.000× maliyetli süper bonus satın alımı."),
  ] },
  { id: "baykus-madeni", group: "Slot", modes: [
    mode("base", "Normal kazı", "1× temel kazı."), mode("extra", "Ekstra kazı", "3× gelişmiş sembol ağırlığı."),
    mode("super", "Süper kazı", "6× ve üç Göz terfisi."), mode("diamond", "Elmas kazı", "250× premium açık katman."),
    mode("obsidian", "Obsidyen kazı", "1.000× premium açık katman."), mode("bonus-block", "Blok bonusu", "Doğrudan 4 spinlik blok bonusu."),
    mode("bonus-super", "Süper bonus", "Doğrudan süper bonus satın alımı."),
    mode("mystery-buy", "Gizemli dönüş satın al", "Canlı boş / süper / epik seçim ağırlıkları ve gerçek satın alım bedeli."),
    mode("bonus-epic", "Epik bonus · koşullu inceleme", "Yalnız epik sonucu gerçekleşmiş oturumlar. Gizemli dönüş bedeli referans alınır; satın alım RTP'si değildir."),
  ] },
  { id: "altin-rota", group: "Anlık", modes: [mode("cashout", "Otomatik nakit çıkış", "Uçak seçilen çarpana gelirse çıkış yapılır.")], parameter: { label: "Nakit çıkış hedefi", min: 1.01, max: 1000, step: .1, defaultValue: 2, suffix: "×" } },
  { id: "limbo", group: "Originals", modes: [mode("target", "Hedef çarpan", "Sonuç seçilen çarpana eşit veya yüksekse kazanır.")], parameter: { label: "Hedef çarpan", min: 1.01, max: 10000, step: .1, defaultValue: 2, suffix: "×" } },
  { id: "obsidyen-damari", group: "Anlık", modes: [mode("free-3", "Serbest · 3 mayın", "5×5 tahtada üç mayın."), mode("free-10", "Serbest · 10 mayın", "5×5 tahtada on mayın."), mode("depth-1", "Derin · temkinli", "Her sırada bir tehlike."), mode("depth-2", "Derin · keskin", "Her sırada iki tehlike."), mode("depth-3", "Derin · uçurum", "Her sırada üç tehlike.")], parameter: { label: "Güvenli seçim / sıra", min: 1, max: 20, step: 1, defaultValue: 3, suffix: "adım" } },
  { id: "mines", group: "Originals", modes: [mode("3", "3 mayın", "5×5 sabit seçim tahtası."), mode("5", "5 mayın", "5×5 sabit seçim tahtası."), mode("10", "10 mayın", "5×5 sabit seçim tahtası."), mode("20", "20 mayın", "5×5 sabit seçim tahtası.")], parameter: { label: "Seçilecek kare", min: 1, max: 20, step: 1, defaultValue: 3, suffix: "kare" } },
  { id: "keno", group: "Originals", modes: [mode("low", "Düşük risk", "Daha düşük kazanma eşiği."), mode("medium", "Orta risk", "Dengeli kazanma eşiği."), mode("high", "Yüksek risk", "Daha seyrek ve yüksek ödeme.")], parameter: { label: "Seçilen yıldız", min: 1, max: 10, step: 1, defaultValue: 6, suffix: "yıldız" } },
  { id: "son-on", group: "Anlık", modes: [mode("temkinli", "Temkinli", "3 seçimde 1 alarm."), mode("keskin", "Keskin", "4 seçimde 2 alarm."), mode("son-saniye", "Son saniye", "5 seçimde 3 alarm.")], parameter: { label: "Nakit çıkış adımı", min: 1, max: 10, step: 1, defaultValue: 3, suffix: "adım" } },
  { id: "plinko", group: "Anlık", modes: [mode("dusuk", "Düşük risk", "Merkez ağırlıklı sakin tablo."), mode("orta", "Orta risk", "Dengeli çarpan eğrisi."), mode("yuksek", "Yüksek risk", "Uç ceplerde yüksek çarpan.")], parameter: { label: "Tahta sırası", min: 8, max: 16, step: 1, defaultValue: 12, suffix: "sıra" } },
  { id: "hilo", group: "Originals", modes: [mode("safest", "En güvenli yön", "Her kartta olasılığı yüksek yön seçilir."), mode("higher", "Daima yüksek", "Her elde Yüksek seçilir."), mode("lower", "Daima düşük", "Her elde Düşük seçilir.")], parameter: { label: "Doğru tahminde çık", min: 1, max: 10, step: 1, defaultValue: 3, suffix: "tahmin" } },
  { id: "yedi-cevher", group: "Originals", modes: [mode("standard", "Beş cevher", "Canlı yedi renk ve beş sembol ödeme tablosu.")] },
];

export type CasinoSimulationRequest = {
  gameId: CasinoGameId;
  mode: string;
  runs: number;
  wager: number;
  seed: number;
  parameter?: number;
};

export type SimulationCause = {
  label: string;
  occurrences: number;
  roundRate: number;
  averagePayoutX: number;
  lift: number;
  contributionX: number;
  contributionShare: number;
};

export type SimulationInsight = { tone: "good" | "warn" | "danger" | "info"; title: string; body: string };

export type CasinoSimulationReport = {
  request: CasinoSimulationRequest;
  gameName: string;
  modeName: string;
  targetRtp: number;
  observedRtp: number;
  houseEdge: number;
  totalStake: number;
  totalPayout: number;
  net: number;
  hitRate: number;
  profitRate: number;
  pushRate: number;
  averagePayoutX: number;
  standardDeviationX: number;
  confidence95: [number, number];
  maxWinX: number;
  maxLossStreak: number;
  quantiles: { p50: number; p90: number; p95: number; p99: number };
  distribution: Array<{ label: string; count: number; rate: number }>;
  causes: SimulationCause[];
  insights: SimulationInsight[];
  durationMs: number;
  actualRounds: number;
  paidRounds: number;
  bonusRounds: number;
  incompleteSessions: number;
  metadata: Array<{ label: string; value: string }>;
};

type CauseInput = { label: string; occurrences?: number; contributionX?: number };
type Observation = { stake: number; payout: number; causes?: CauseInput[]; bonusRounds?: number };
type CauseMutable = { occurrences: number; rounds: number; payoutX: number; contributionX: number };

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function shuffled<T>(source: readonly T[], random: () => number) {
  const result = [...source];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function percentile(sorted: number[], fraction: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

class Accumulator {
  payouts: number[] = [];
  totalStake = 0;
  totalPayout = 0;
  hits = 0;
  profits = 0;
  pushes = 0;
  maxLossStreak = 0;
  currentLossStreak = 0;
  bonusRounds = 0;
  incompleteSessions = 0;
  causes = new Map<string, CauseMutable>();
  distributionOverride?: Array<{ label: string; count: number; rate: number }>;
  quantilesOverride?: { p50: number; p90: number; p95: number; p99: number };
  standardDeviationOverride?: number;
  maxWinOverride?: number;
  measuredRoundsOverride?: number;

  add(observation: Observation) {
    const stake = Math.max(0, observation.stake);
    const payout = Math.max(0, observation.payout);
    const x = stake > 0 ? payout / stake : 0;
    this.totalStake += stake;
    this.totalPayout += payout;
    this.payouts.push(x);
    if (payout > 0) this.hits += 1;
    if (payout > stake) this.profits += 1;
    if (Math.abs(payout - stake) < .000001) this.pushes += 1;
    if (payout < stake) {
      this.currentLossStreak += 1;
      this.maxLossStreak = Math.max(this.maxLossStreak, this.currentLossStreak);
    } else this.currentLossStreak = 0;
    this.bonusRounds += observation.bonusRounds ?? 0;
    const roundCauses = new Map<string, { occurrences: number; contributionX: number }>();
    for (const cause of observation.causes ?? []) {
      const combined = roundCauses.get(cause.label) ?? { occurrences: 0, contributionX: 0 };
      combined.occurrences += cause.occurrences ?? 1;
      combined.contributionX += cause.contributionX ?? 0;
      roundCauses.set(cause.label, combined);
    }
    for (const [label, combined] of roundCauses) {
      const current = this.causes.get(label) ?? { occurrences: 0, rounds: 0, payoutX: 0, contributionX: 0 };
      current.occurrences += combined.occurrences;
      current.rounds += 1;
      current.payoutX += x;
      current.contributionX += combined.contributionX;
      this.causes.set(label, current);
    }
  }
}

const fixedSlotIds = new Set<CasinoGameId>(["neon-kasasi", "kaptan-mercan", "sekerhane-1024"]);

function simulateLegacySlot(request: CasinoSimulationRequest, settings: CasinoAdminSettings, accumulator: Accumulator) {
  const result = runSlotSimulation({
    gameId: request.gameId as SimulatableSlotId,
    mode: request.mode as "paid-spins" | "bonus-sessions",
    runs: request.runs,
    wager: request.wager,
    seed: request.seed,
  }, settings.games[request.gameId], session => accumulator.add({
    stake: session.stake, payout: session.payout, bonusRounds: session.bonusRounds,
    causes: [
      ...(session.bonusSessions ? [{ label: "Bonus oturumu", occurrences: session.bonusSessions }] : []),
      ...(session.retriggers ? [{ label: "Yeniden tetikleme", occurrences: session.retriggers }] : []),
      ...(session.potentialEvents ? [{ label: "Görünür potansiyel olayı", occurrences: session.potentialEvents }] : []),
    ],
  }));
  accumulator.incompleteSessions = result.truncatedSessions;
}

function simulateBlackjack(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator) {
  const stop = request.mode === "stand-15" ? 15 : request.mode === "hit-18" ? 18 : 17;
  for (let run = 0; run < request.runs; run += 1) {
    const deck = shuffled(Array.from({ length: 6 }, () => createDeck()).flat(), random);
    const player: Card[] = [deck[0], deck[2]];
    const dealer: Card[] = [deck[1], deck[3]];
    let cursor = 4;
    while (handValue(player).total < stop) player.push(deck[cursor++]);
    while (handValue(dealer).total < 17) dealer.push(deck[cursor++]);
    const pv = handValue(player).total;
    const dv = handValue(dealer).total;
    const natural = isBlackjack(player);
    const won = pv <= 21 && (dv > 21 || pv > dv);
    const push = pv <= 21 && pv === dv;
    const payout = natural && !isBlackjack(dealer) ? request.wager * 2.5 : won ? request.wager * 2 : push ? request.wager : 0;
    accumulator.add({ stake: request.wager, payout, causes: [
      ...(natural ? [{ label: "Doğal Blackjack", contributionX: 2.5 }] : []),
      ...(pv > 21 ? [{ label: "Oyuncu patladı" }] : []),
      ...(dv > 21 ? [{ label: "Krupiye patladı" }] : []),
      { label: `Oyuncu ${pv}` },
    ] });
  }
}

function simulateRoulette(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator) {
  const definition = request.mode === "straight" ? straightBet(17) : request.mode === "dozen" ? dozens[0] : outsideBets.find((bet) => bet.id === "red")!;
  for (let run = 0; run < request.runs; run += 1) {
    const winner = EUROPEAN_WHEEL[Math.floor(random() * EUROPEAN_WHEEL.length)];
    const settled = settleBets([{ definition, chips: [request.wager] }], winner);
    accumulator.add({ stake: request.wager, payout: settled.grossReturn, causes: [{ label: winner === 0 ? "Sıfır" : settled.grossReturn ? "Bahis alanı tuttu" : "Bahis alanı kaçtı" }] });
  }
}

function simulatePoker(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator) {
  for (let run = 0; run < request.runs; run += 1) {
    const deal = dealCasinoHoldem(random);
    const preview = resolveCasinoHoldem(deal, request.wager, 0, true);
    const called = request.mode === "always-call" || preview.playerHand.category >= 1;
    const result = resolveCasinoHoldem(deal, request.wager, 0, called);
    accumulator.add({ stake: result.stake, payout: result.grossPayout, causes: [
      { label: `Oyuncu eli · ${result.playerHand.label}`, contributionX: result.anteGross / request.wager },
      { label: result.dealerQualifies ? "Krupiye açıldı" : "Krupiye açılmadı" },
      { label: called ? "Call oynandı" : "Fold" },
    ] });
  }
}

function simulateKiraz(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator, settings: CasinoAdminSettings) {
  const scale = settings.games[request.gameId].slot?.math.payoutScale ?? 1;
  for (let run = 0; run < request.runs; run += 1) {
    const stops = KIRAZ_REELS.map((reel) => Math.floor(random() * reel.length));
    const result = evaluateSlot(stops, request.wager, KIRAZ_REELS, scale);
    accumulator.add({ stake: request.wager, payout: result.grossReturn, causes: result.wins.map((win) => ({ label: `Sembol · ${win.symbol}`, contributionX: win.returnAmount / request.wager })) });
  }
}

function simulateAllah(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator, settings: CasinoAdminSettings) {
  const tuning = settings.games[request.gameId].allah!;
  const purchaseMode = request.mode as AllahPurchaseMode;
  for (let run = 0; run < request.runs; run += 1) {
    let persistent = defaultAllahPersistentState();
    const purchaseTier = purchaseMode === "bonus-buy" ? "free" : purchaseMode === "super-bonus-buy" ? "super" : undefined;
    if (purchaseTier === "super") persistent.persistentEye = "gold";
    let result = purchaseTier ? undefined : runAllahSpin({ wager: request.wager, mode: purchaseMode, persistent: prepareAllahSpinPersistent(persistent), tuning, runId: `lab-${request.seed}-${run}` }, random);
    const stake = request.wager * tuning.modeCosts[purchaseMode];
    let payout = result?.payout ?? 0;
    let bonusRounds = 0;
    const causes: CauseInput[] = [];
    const collect = (spin: ReturnType<typeof runAllahSpin>) => {
      const initial = spin.initialGrid.flat();
      const eyes = initial.filter((cell) => cell.kind === "eye").length;
      const scatters = initial.filter((cell) => cell.kind === "scatter").length;
      if (eyes) causes.push({ label: "Göz sembolü", occurrences: eyes });
      const revealEyes = spin.events.filter(event => event.type === "mystery-reveal" && event.payload.revealedKind === "eye").length;
      const activatedEyes = spin.events.filter(event => event.type === "eye-wake").length;
      if (revealEyes) causes.push({ label: "Mystery kaynaklı göz", occurrences: revealEyes });
      if (activatedEyes) causes.push({ label: "Etkinleşen göz (tüm kaynaklar)", occurrences: activatedEyes });
      for (const source of ["eye", "collector", "fate", "redrop"]) {
        const reveals = spin.events.filter(event => event.type === "mystery-reveal" && event.payload.source === source).length;
        if (reveals) causes.push({ label: source + " → Mystery açılımı", occurrences: reveals });
      }
      for (const kind of ["collector", "upgrader", "redrop", "multiplier", "key"]) {
        const count = spin.events.filter(event => event.type === "mystery-reveal" && event.payload.revealedKind === kind).length;
        if (count) causes.push({ label: "Mystery → " + kind, occurrences: count });
      }
      if (scatters) causes.push({ label: "Scatter", occurrences: scatters });
      if (spin.featureCycles) causes.push({ label: "Özellik çevrimi", occurrences: spin.featureCycles });
      // Attribute the actual settled money, including cap/rounding, rather than
      // reporting pre-cap components whose shares can exceed 100%.
      const maxCoin = spin.events.some(event => event.type === "mystery-reveal" && event.payload.revealedKind === "max-coin");
      const components = spin.lineWinX + spin.coinWinX + spin.collectorWinX;
      const settledX = spin.payout / request.wager;
      const factor = !maxCoin && components > 0 ? settledX / components : 0;
      if (maxCoin) causes.push({ label: "Max Coin jackpot ödemesi", contributionX: settledX });
      if (spin.collectorWinX) causes.push({ label: "Collector ödemesi", contributionX: spin.collectorWinX * factor });
      if (spin.coinWinX) causes.push({ label: "Coin ödemesi", contributionX: spin.coinWinX * factor });
      if (spin.lineWinX) causes.push({ label: "Çizgi ödemesi", contributionX: spin.lineWinX * factor });
      if (spin.maxWin) causes.push({ label: "Kazanç tavanına ulaşan spin" });
      if (spin.globalMultiplier > 1) causes.push({ label: "Global çarpan", occurrences: 1 });
      for (const win of spin.lineWins) causes.push({ label: `Sembol · ${ALLAH_SYMBOLS[win.symbol].label}` });
    };
    if (result) collect(result);
    const tier = purchaseTier ?? result?.triggeredBonus;
    let bonus: AllahBonusState | undefined = tier ? { tier, remaining: tuning.bonusSpins, totalSpins: 0, totalPayout: 0 } : undefined;
    persistent = result?.persistent ?? persistent;
    let guard = 0;
    while (bonus?.remaining && guard < 100) {
      result = runAllahSpin({ wager: request.wager, mode: "base", persistent: prepareAllahSpinPersistent(persistent, bonus), bonus, tuning, runId: `lab-${request.seed}-${run}-b${guard}` }, random);
      collect(result);
      payout += result.payout;
      persistent = result.persistent;
      bonus = result.nextBonus;
      bonusRounds += 1;
      guard += 1;
    }
    if (bonusRounds) causes.push({ label: "Bonus oturumu" });
    if (bonus?.remaining) accumulator.incompleteSessions += 1;
    accumulator.add({ stake, payout, causes, bonusRounds });
  }
}

function simulateBaykus(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator, settings: CasinoAdminSettings) {
  const tuning = settings.games[request.gameId].mineDrop!;
  const mysteryBuy = request.mode === "mystery-buy";
  const directBonus = request.mode.startsWith("bonus-") || mysteryBuy;
  for (let run = 0; run < request.runs; run += 1) {
    const mysteryOutcome = mysteryBuy ? rollMysteryOutcome(random, tuning) : undefined;
    const tier = mysteryBuy ? mysteryOutcome === "none" ? undefined : mysteryOutcome
      : directBonus ? request.mode.replace("bonus-", "") as MineBonusTier : undefined;
    const paidMode = directBonus ? "base" : request.mode as MinePaidMode;
    let mine = createMine(random, tuning, paidMode === "diamond" || paidMode === "obsidian" ? paidMode : undefined);
    const costX = directBonus
      ? mysteryBuy ? tuning.bonusCosts.mystery : tier === "block" ? tuning.bonusCosts.block : tier === "super" ? tuning.bonusCosts.super : tuning.bonusCosts.mystery
      : tuning.modeCosts[paidMode];
    let stake = request.wager * costX;
    let payoutX = 0;
    let bonusRounds = 0;
    const causes: CauseInput[] = [];
    if (mysteryBuy) causes.push({ label: "Gizemli kapı · " + mysteryOutcome });
    let initial = directBonus ? undefined : runMineSpin({ mine, mode: paidMode, random, tuning });
    if (initial) {
      payoutX += initial.totalWinX;
      mine = initial.mine;
      const tools = initial.reel.flat().filter((symbol) => symbol.kind === "tool").length;
      if (tools) causes.push({ label: "Kazma sembolü", occurrences: tools });
      if (initial.eyeCount) causes.push({ label: "Göz sembolü", occurrences: initial.eyeCount });
      if (initial.blockWinX) causes.push({ label: "Kırılan blok" });
      if (initial.totalWinX) causes.push({ label: "Ücretli kazı ödemesi", contributionX: initial.totalWinX });
      if (initial.openedChests.length) causes.push({ label: "Açılan sandık", occurrences: initial.openedChests.length });
    }
    const activeTier = tier ?? initial?.triggeredBonus;
    if (activeTier) {
      let progress = createMineBonusProgress(mine);
      for (let spin = 0; spin < tuning.bonusSpins; spin += 1) {
        const bonusResult = runMineSpin({ mine, mode: "base", bonusTier: activeTier, random, tuning });
        progress = accrueMineBonusSpin(progress, bonusResult);
        mine = bonusResult.mine;
        bonusRounds += 1;
        if (bonusResult.eyeCount) causes.push({ label: "Bonus göz sembolü", occurrences: bonusResult.eyeCount });
        if (bonusResult.openedChests.length) causes.push({ label: "Bonus açılan sandık", occurrences: bonusResult.openedChests.length });
        const tools = bonusResult.reel.flat().filter(symbol => symbol.kind === "tool").length;
        if (tools) causes.push({ label: "Bonus kazma sembolü", occurrences: tools });
      }
      const sourceScale = tuning.payoutScales[`bonus-${activeTier}`];
      const final = settleMineBonusFinal(progress, sourceScale, tuning.maxWinX - payoutX);
      payoutX += final.totalWinX;
      causes.push({ label: "Bonus oturumu" });
      causes.push({ label: `${activeTier} bonusu`, occurrences: bonusRounds, contributionX: final.totalWinX });
    }
    accumulator.add({ stake, payout: request.wager * payoutX, causes, bonusRounds });
  }
}

function simulateFormulaGames(request: CasinoSimulationRequest, random: () => number, accumulator: Accumulator, settings: CasinoAdminSettings) {
  const game = settings.games[request.gameId];
  const rtp = game.targetRtp;
  const parameter = request.parameter ?? 2;
  for (let run = 0; run < request.runs; run += 1) {
    let payoutX = 0;
    const causes: CauseInput[] = [];
    if (request.gameId === "altin-rota" || request.gameId === "limbo") {
      const cap = request.gameId === "altin-rota" ? game.crash?.maxMultiplier ?? 10_000 : 10_000;
      const result = limboResultFromUnit(1 - random(), rtp, cap);
      payoutX = result >= parameter ? parameter : 0;
      causes.push({ label: result < parameter ? "Hedef öncesi sonuç" : "Hedefe ulaştı" });
      if (result >= 10) causes.push({ label: "10×+ ham sonuç" });
    } else if (request.gameId === "plinko") {
      const rows = Math.round(parameter);
      const multipliers = plinkoMultipliers(rows, request.mode as "dusuk" | "orta" | "yuksek", rtp, game.plinko?.maxPayoutX ?? 1_000);
      let bucket = 0;
      for (let row = 0; row < rows; row += 1) if (random() >= .5) bucket += 1;
      payoutX = multipliers[bucket];
      causes.push({ label: bucket === 0 || bucket === rows ? "Uç cep" : Math.abs(bucket - rows / 2) <= 1 ? "Merkez cep" : "Ara cep", contributionX: payoutX });
    } else if (request.gameId === "keno") {
      const selectedCount = Math.round(parameter);
      const selected = new Set(Array.from({ length: selectedCount }, (_, index) => index));
      const draw = shuffled(Array.from({ length: 40 }, (_, index) => index), random).slice(0, 10);
      const hits = draw.filter((value) => selected.has(value)).length;
      payoutX = kenoPaytable(selectedCount, request.mode as "low" | "medium" | "high", rtp)[hits] ?? 0;
      causes.push({ label: `${hits} isabet`, occurrences: hits || 1, contributionX: payoutX });
    } else if (request.gameId === "mines") {
      const mineCount = Number(request.mode);
      const picks = Math.min(25 - mineCount, Math.round(parameter));
      const probability = batchWinProbability(mineCount, picks);
      payoutX = random() < probability ? batchMultiplier(mineCount, picks, rtp) : 0;
      causes.push({ label: payoutX ? `${picks} güvenli kare` : "Mayına temas", contributionX: payoutX });
    } else if (request.gameId === "obsidyen-damari") {
      const steps = Math.round(parameter);
      if (request.mode.startsWith("free")) {
        const mines = Number(request.mode.split("-")[1]);
        const probability = freeSurvivalProbability(mines, steps);
        payoutX = random() < probability ? freeMultiplier(mines, steps, rtp) : 0;
        causes.push({ label: payoutX ? `${steps} güvenli kazı` : "Çekirdeğe temas", contributionX: payoutX });
      } else {
        const hazards = Number(request.mode.split("-")[1]);
        const safeChance = (5 - hazards) / 5;
        let safe = true;
        for (let step = 0; step < steps; step += 1) safe &&= random() < safeChance;
        payoutX = safe ? depthMultiplier(hazards, steps, rtp) : 0;
        causes.push({ label: safe ? `${steps} güvenli sıra` : "Tehlikeli sütun", contributionX: payoutX });
      }
    } else if (request.gameId === "son-on") {
      const safeChance = countdownSafeChance(request.mode as "temkinli" | "keskin" | "son-saniye");
      let safe = true;
      const steps = Math.round(parameter);
      for (let step = 0; step < steps; step += 1) safe &&= random() < safeChance;
      payoutX = safe ? countdownMultiplier(request.mode as "temkinli" | "keskin" | "son-saniye", steps, rtp, game.countdown?.maxPayoutX) : 0;
      causes.push({ label: safe ? `${steps}. adımda çıkış` : "Alarm", contributionX: payoutX });
    } else if (request.gameId === "hilo") {
      const deck = shuffled(Array.from({ length: 52 }, (_, index) => 2 + (index % 13)), random);
      let current = deck[0];
      let position = 1;
      let multiplier = 1;
      let won = true;
      const steps = Math.round(parameter);
      for (let step = 0; step < steps && won; step += 1) {
        const remaining = deck.slice(position);
        const higher = remaining.filter((rank) => rank > current).length;
        const lower = remaining.filter((rank) => rank < current).length;
        const guess = request.mode === "safest" ? (higher >= lower ? "higher" : "lower") : request.mode;
        const chance = (guess === "higher" ? higher : lower) / remaining.length;
        const next = deck[position++];
        won = guess === "higher" ? next > current : next < current;
        if (won) multiplier = Math.min(1_000_000, roundHiloMultiplier(multiplier * roundHiloMultiplier((rtp / 100) / Math.max(Number.EPSILON, chance))));
        current = next;
      }
      payoutX = won ? roundHiloMoney(request.wager * multiplier) / request.wager : 0;
      causes.push({ label: won ? `${steps} doğru tahmin` : "Yanlış/eşit kart", contributionX: payoutX });
    } else if (request.gameId === "yedi-cevher") {
      const gems = Array.from({ length: 5 }, () => GEM_IDS[Math.floor(random() * GEM_IDS.length)]);
      const combination = classifyGems(gems);
      payoutX = gemPayoutTable(rtp).find((entry) => entry.combination === combination)?.multiplier ?? 0;
      causes.push({ label: `Kombinasyon · ${combination}`, contributionX: payoutX });
    }
    accumulator.add({ stake: request.wager, payout: request.wager * payoutX, causes });
  }
}

function buildInsights(report: Omit<CasinoSimulationReport, "insights">): SimulationInsight[] {
  const insights: SimulationInsight[] = [];
  const gap = report.observedRtp - report.targetRtp;
  insights.push({
    tone: Math.abs(gap) <= 2 ? "good" : Math.abs(gap) <= 5 ? "warn" : "danger",
    title: Math.abs(gap) <= 2 ? "Hedefe yakın örnek" : gap > 0 ? "Hedef üstü ödeme" : "Hedef altı ödeme",
    body: `Gözlenen RTP hedefin ${Math.abs(gap).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} yüzde puan ${gap >= 0 ? "üzerinde" : "altında"}. Bu gözlem bir ayarın neden olduğunu kanıtlamaz; deneysel araştırma ve bağımsız tohumlarla doğrulama gerekir.`,
  });
  const strongest = [...report.causes].sort((a, b) => (b.contributionShare + Math.max(0, b.lift - 1) * .1) - (a.contributionShare + Math.max(0, a.lift - 1) * .1))[0];
  if (strongest) insights.push({
    tone: strongest.lift >= 2 ? "warn" : "info",
    title: `Başlıca etken: ${strongest.label}`,
    body: `Turların %${(strongest.roundRate * 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}'inde görüldü. Görüldüğü turlar genel ortalamanın ${strongest.lift.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} katı ödedi${strongest.contributionShare > 0 ? `; doğrudan izlenebilen ödemenin %${(strongest.contributionShare * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}'ini taşıdı` : ""}.`,
  });
  insights.push({
    tone: report.maxLossStreak >= 20 ? "warn" : "info",
    title: "Oyuncu deneyimi ritmi",
    body: `En uzun ödeme-altı seri ${report.maxLossStreak} tur. Standart sapma ${report.standardDeviationX.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}×; bu değer büyüdükçe sonuçlar daha sert ve seyrek hissedilir.`,
  });
  return insights;
}

export function runCasinoSimulation(raw: CasinoSimulationRequest, settings: CasinoAdminSettings): CasinoSimulationReport {
  const started = performance.now();
  const definition = SIMULATION_GAMES.find((entry) => entry.id === raw.gameId)!;
  const selectedMode = definition.modes.find((entry) => entry.id === raw.mode) ?? definition.modes[0];
  const request: CasinoSimulationRequest = {
    ...raw,
    mode: selectedMode.id,
    runs: Math.max(1, Math.min(100_000, Math.round(raw.runs))),
    wager: Math.max(.01, raw.wager),
    parameter: definition.parameter ? Math.max(definition.parameter.min, Math.min(definition.parameter.max, raw.parameter ?? definition.parameter.defaultValue)) : undefined,
  };
  const random = seeded(request.seed);
  const accumulator = new Accumulator();
  if (fixedSlotIds.has(request.gameId)) simulateLegacySlot(request, settings, accumulator);
  else if (request.gameId === "blackjack") simulateBlackjack(request, random, accumulator);
  else if (request.gameId === "roulette") simulateRoulette(request, random, accumulator);
  else if (request.gameId === "poker") simulatePoker(request, random, accumulator);
  else if (request.gameId === "kiraz-77") simulateKiraz(request, random, accumulator, settings);
  else if (request.gameId === "allahin-lutfu") simulateAllah(request, random, accumulator, settings);
  else if (request.gameId === "baykus-madeni") simulateBaykus(request, random, accumulator, settings);
  else simulateFormulaGames(request, random, accumulator, settings);

  const paidRounds = request.runs;
  const measured = accumulator.measuredRoundsOverride ?? Math.max(1, accumulator.payouts.length);
  const observedRtp = accumulator.totalStake ? accumulator.totalPayout / accumulator.totalStake * 100 : 0;
  const averagePayoutX = accumulator.totalStake ? accumulator.totalPayout / accumulator.totalStake : 0;
  const variance = accumulator.payouts.length > 1 ? accumulator.payouts.reduce((sum, value) => sum + (value - averagePayoutX) ** 2, 0) / (accumulator.payouts.length - 1) : 0;
  const standardDeviationX = accumulator.standardDeviationOverride ?? Math.sqrt(variance);
  const margin = 1.96 * standardDeviationX / Math.sqrt(Math.max(1, request.runs)) * 100;
  const sorted = [...accumulator.payouts].sort((a, b) => a - b);
  const ranges = [
    { label: "0×", test: (x: number) => x === 0 }, { label: "0–1×", test: (x: number) => x > 0 && x < 1 },
    { label: "1×", test: (x: number) => Math.abs(x - 1) < .000001 }, { label: "1–2×", test: (x: number) => x > 1 && x < 2 },
    { label: "2–5×", test: (x: number) => x >= 2 && x < 5 }, { label: "5–10×", test: (x: number) => x >= 5 && x < 10 },
    { label: "10–50×", test: (x: number) => x >= 10 && x < 50 }, { label: "50–100×", test: (x: number) => x >= 50 && x < 100 },
    { label: "100×+", test: (x: number) => x >= 100 },
  ];
  const causes = [...accumulator.causes.entries()].map(([label, value]) => {
    const average = value.rounds ? value.payoutX / value.rounds : 0;
    return {
      label,
      occurrences: value.occurrences,
      roundRate: value.rounds / Math.max(1, paidRounds),
      averagePayoutX: average,
      lift: averagePayoutX > 0 ? average / averagePayoutX : 0,
      contributionX: value.contributionX,
      contributionShare: accumulator.totalPayout / request.wager > 0 ? value.contributionX / (accumulator.totalPayout / request.wager) : 0,
    };
  }).sort((a, b) => b.occurrences - a.occurrences);

  const base = {
    request,
    gameName: settings.games[request.gameId].name,
    modeName: selectedMode.label,
    targetRtp: settings.games[request.gameId].targetRtp,
    observedRtp,
    houseEdge: 100 - observedRtp,
    totalStake: accumulator.totalStake,
    totalPayout: accumulator.totalPayout,
    net: accumulator.totalPayout - accumulator.totalStake,
    hitRate: accumulator.hits / measured,
    profitRate: accumulator.profits / measured,
    pushRate: accumulator.pushes / measured,
    averagePayoutX,
    standardDeviationX,
    confidence95: [Math.max(0, observedRtp - margin), observedRtp + margin] as [number, number],
    maxWinX: accumulator.maxWinOverride ?? sorted.at(-1) ?? 0,
    maxLossStreak: accumulator.maxLossStreak,
    quantiles: accumulator.quantilesOverride ?? { p50: percentile(sorted, .5), p90: percentile(sorted, .9), p95: percentile(sorted, .95), p99: percentile(sorted, .99) },
    distribution: accumulator.distributionOverride ?? ranges.map((range) => { const count = accumulator.payouts.filter(range.test).length; return { label: range.label, count, rate: count / measured }; }),
    causes,
    durationMs: performance.now() - started,
    actualRounds: paidRounds + accumulator.bonusRounds,
    paidRounds,
    bonusRounds: accumulator.bonusRounds,
    incompleteSessions: accumulator.incompleteSessions,
    metadata: [
      { label: "Tohum", value: String(request.seed) },
      { label: "Motor", value: fixedSlotIds.has(request.gameId) ? "canlı slot akış adaptörü" : "canlı matematik / kural adaptörü" },
      { label: "Ölçüm birimi", value: "ana tur / satın alım + doğurduğu bonus toplamı; çarpan = ödeme / ücretli maliyet" },
      { label: "Tamamlanamayan oturum", value: String(accumulator.incompleteSessions) },
      { label: "Bakiye etkisi", value: "yok · izole laboratuvar" },
    ],
  };
  return { ...base, insights: buildInsights(base) };
}
