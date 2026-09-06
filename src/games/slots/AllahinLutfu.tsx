import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import GameMusicControls from "../../audio/GameMusicControls";
import {
  DEFAULT_ALLAH_TUNING,
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import {
  createRecordId,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
} from "../../data/casino-database";
import {
  CASINO_BET_STEPS,
  compactWager,
  maximumAffordableWager,
  normalizeWagerInput,
} from "../wagering";
import { SlotAudio } from "./slot-audio";
import {
  ALLAH_COIN_TIERS,
  ALLAH_SYMBOLS,
  allahPurchaseCost,
  createSeededAllahRandom,
  defaultAllahPersistentState,
  runAllahSpin,
  type AllahBonusState,
  type AllahCell,
  type AllahFeatureEvent,
  type AllahGrid,
  type AllahPersistentState,
  type AllahPurchaseMode,
  type AllahSpinResult,
} from "./allahin-lutfu-engine";
import "./allahin-lutfu.css";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onBack: () => void;
  aiOnline: boolean;
};

type SpecialSummary = {
  kind: "bonus" | "fate";
  eyebrow: string;
  title: string;
  spins: number;
  payout: number;
  cost: number;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const modeLabels: Record<AllahPurchaseMode, string> = {
  base: "Normal Dönüş",
  enhancer: "Lütuf Arttırıcı",
  degen: "Deli Cesareti",
  trickster: "Hilebaz Dönüş",
  fate: "Kaderin Hükmü",
  "bonus-buy": "Lütuf Satın Al",
  "super-bonus-buy": "Büyük Lütuf Satın Al",
};

const modeArt: Record<Exclude<AllahPurchaseMode, "bonus-buy" | "super-bonus-buy">, string> = {
  base: "/assets/slots/allahin-lutfu/symbols/gate-of-light.png",
  enhancer: "/assets/slots/allahin-lutfu/symbols/scatter.png",
  degen: "/assets/slots/allahin-lutfu/symbols/eye-gold.png",
  trickster: "/assets/slots/allahin-lutfu/symbols/mystery-orb.png",
  fate: "/assets/slots/allahin-lutfu/symbols/max-win-coin.png",
};

const winScenes = {
  nice: {
    image: "/assets/slots/allahin-lutfu/wins/win-book.png",
    eyebrow: "KUTLU SAYFA AÇILDI",
    title: "LÜTUF YAZILDI",
  },
  great: {
    image: "/assets/slots/allahin-lutfu/wins/win-book.png",
    eyebrow: "KUTLU SAYFA AÇILDI",
    title: "LÜTUF YAZILDI",
  },
  epic: {
    image: "/assets/slots/allahin-lutfu/wins/win-parted-sea.png",
    eyebrow: "SULAR YOL VERDİ",
    title: "YOL AÇILDI",
  },
  insane: {
    image: "/assets/slots/allahin-lutfu/wins/win-split-moon.png",
    eyebrow: "GÖKLER ŞAHİT",
    title: "AY YARILDI",
  },
  divine: {
    image: "/assets/slots/allahin-lutfu/wins/win-ark.png",
    eyebrow: "EN BÜYÜK LÜTUF",
    title: "TUFAN KAZANCI",
  },
} as const;

const autoSkippableEvents = new Set<AllahFeatureEvent["type"]>([
  "guardian-ack",
  "bonus-portal",
  "bonus-upgrade",
  "payout-count",
  "settlement",
  "return-idle",
]);

const eyeImages = {
  blue: "/assets/slots/allahin-lutfu/symbols/eye-blue.png",
  gold: "/assets/slots/allahin-lutfu/symbols/eye-gold.png",
  emerald: "/assets/slots/allahin-lutfu/symbols/eye-emerald.png",
};

const mysteryFlowImages = [
  "/assets/slots/allahin-lutfu/symbols/coin-bronze.png",
  "/assets/slots/allahin-lutfu/symbols/coin-silver.png",
  "/assets/slots/allahin-lutfu/symbols/coin-gold.png",
  "/assets/slots/allahin-lutfu/symbols/coin-sapphire.png",
  "/assets/slots/allahin-lutfu/symbols/coin-ruby.png",
  "/assets/slots/allahin-lutfu/symbols/coin-diamond.png",
  "/assets/slots/allahin-lutfu/symbols/celestial-key.png",
  "/assets/slots/allahin-lutfu/symbols/collector.png",
  "/assets/slots/allahin-lutfu/symbols/coin-upgrader.png",
  "/assets/slots/allahin-lutfu/symbols/multiplier-medallion.png",
] as const;

const mysteryFlowLoop = [...mysteryFlowImages, ...mysteryFlowImages];

function cellVisual(cell: AllahCell, collectedValue = 0, maxWinX = 500_000) {
  if (cell.kind === "symbol")
    return { image: ALLAH_SYMBOLS[cell.symbol].image, label: ALLAH_SYMBOLS[cell.symbol].label };
  if (cell.kind === "coin")
    return {
      image: `/assets/slots/allahin-lutfu/symbols/coin-${cell.tier}.png`,
      label: `${cell.tier} ${cell.value}×`,
      value: `${compactWager(cell.value)}×`,
    };
  if (cell.kind === "eye")
    return { image: eyeImages[cell.variant], label: `${cell.variant} Nur Gözü` };
  if (cell.kind === "mystery")
    return { image: "/assets/slots/allahin-lutfu/symbols/mystery-orb.png", label: "Gizem Küresi" };
  if (cell.kind === "collector")
    return {
      image: `/assets/slots/allahin-lutfu/symbols/${cell.super ? "super-collector" : "collector"}.png`,
      label: cell.super ? "Çifte Lütuf Toplayıcı" : "Lütuf Toplayıcı",
      value: collectedValue > 0 ? `${compactWager(collectedValue)}×` : undefined,
    };
  if (cell.kind === "upgrader")
    return { image: "/assets/slots/allahin-lutfu/symbols/coin-upgrader.png", label: "Lütuf Yükseltici" };
  if (cell.kind === "redrop")
    return { image: "/assets/slots/allahin-lutfu/symbols/redrop.png", label: "Redrop · Yeniden Düşürme" };
  if (cell.kind === "multiplier")
    return {
      image: "/assets/slots/allahin-lutfu/symbols/multiplier-medallion.png",
      label: `${cell.value}× alan çarpanı`,
      value: `${cell.value}×`,
    };
  if (cell.kind === "scatter")
    return { image: "/assets/slots/allahin-lutfu/symbols/scatter.png", label: "Yedi Kat Lütuf Scatter" };
  if (cell.kind === "global-key")
    return { image: "/assets/slots/allahin-lutfu/symbols/celestial-key.png", label: "Global Çarpan Anahtarı" };
  if (cell.kind === "empty") return { image: "", label: "Boş alan" };
  return { image: "/assets/slots/allahin-lutfu/symbols/max-win-coin.png", label: `${money.format(maxWinX)}× Max Lütuf`, value: "MAX" };
}

function eventSound(audio: SlotAudio | null, event: AllahFeatureEvent) {
  if (!audio) return;
  if (event.type === "spin-commit") audio.play("spin");
  if (event.type === "reel-impact") audio.play("stop", Number(event.payload.column ?? 0));
  if (event.type === "eye-wake") audio.play("eye");
  if (event.type === "mystery-reveal" || event.type === "modifier-coin-roll") audio.play("mystery");
  if (event.type === "modifier-coin-land") audio.play("coin");
  if (event.type === "key-flight") audio.play("key");
  if (event.type === "redrop-fall") audio.play("cascade");
  if (event.type === "scatter-lock" || event.type === "bonus-portal") audio.play("scatter");
  if (event.type === "key-slot-lock" || event.type === "wheel-spin" || event.type === "global-merge")
    audio.play("multiplier", Number(event.payload.value ?? 0));
  if (event.type === "coin-flight") audio.play("coin", event.cells[0]?.column ?? 0);
  if (event.type === "collector-wake" || event.type === "collector-merge") audio.play("collector");
  if (event.type === "board-multiplier-apply" || event.type === "coin-upgrader-charge" || event.type === "coin-upgrader-apply") audio.play("multiplierImpact");
  if (event.type === "global-row-charge") audio.play("multiplier", Number(event.payload.row ?? 0));
  if (event.type === "global-row-apply") audio.play("multiplierImpact", Number(event.payload.row ?? 0));
  if (event.type === "win-tier") audio.play("winTier", Math.min(4, Math.floor(Number(event.payload.grossMultiplier ?? 0) / 100)));
}

function bonusLabel(tier?: AllahBonusState["tier"]) {
  if (tier === "super") return "Büyük Lütuf";
  if (tier === "legendary") return "Efsanevi Lütuf";
  if (tier === "mythic") return "Mitik Lütuf";
  return "Lütuf Dönüşleri";
}

export default function AllahinLutfu({
  balance,
  setBalance,
  onBack,
}: Props) {
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const settings = admin.games["allahin-lutfu"];
  const tuning = settings.allah ?? DEFAULT_ALLAH_TUNING;
  const [wager, setWager] = useState(Math.max(settings.minBet, settings.defaultBet));
  const [betStep, setBetStep] = useState(25);
  const [mode, setMode] = useState<AllahPurchaseMode>("base");
  const [grid, setGrid] = useState<AllahGrid>(() =>
    runAllahSpin(
      { wager: 0, runId: "allah-preview", tuning },
      createSeededAllahRandom(786),
    ).initialGrid,
  );
  const [persistent, setPersistent] = useState<AllahPersistentState>(
    defaultAllahPersistentState,
  );
  const [bonus, setBonus] = useState<AllahBonusState>();
  const [phase, setPhase] = useState<"idle" | "playing" | "bonus-ready">("idle");
  const [activeEvent, setActiveEvent] = useState<AllahFeatureEvent>();
  const [activeCells, setActiveCells] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const [displayEyeSlots, setDisplayEyeSlots] = useState<AllahPersistentState["eyeSlots"]>([]);
  const [displayKeySlots, setDisplayKeySlots] = useState<Array<number | null>>([null, null, null]);
  const [displayMinTier, setDisplayMinTier] = useState(0);
  const [displayGlobalMultiplier, setDisplayGlobalMultiplier] = useState(1);
  const [displayCollectorValues, setDisplayCollectorValues] = useState<Record<string, number>>({});
  const [globalAppliedValues, setGlobalAppliedValues] = useState<Record<string, number>>({});
  const [eventDuration, setEventDuration] = useState(0);
  const [displayWin, setDisplayWin] = useState(0);
  const [specialSummary, setSpecialSummary] = useState<SpecialSummary>();
  const [spinSpeed, setSpinSpeed] = useState<"normal" | "quick" | "turbo">("normal");
  const [autoSkipScreens, setAutoSkipScreens] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoCount, setAutoCount] = useState(25);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<SlotAudio | null>(null);
  const mountedRef = useRef(true);
  const spinLockRef = useRef(false);
  const skipPresentationRef = useRef(false);
  const waitersRef = useRef(new Set<() => void>());
  const bonusRef = useRef<AllahBonusState | undefined>(undefined);
  const bonusEntryCostRef = useRef(0);
  const autoRemainingRef = useRef(0);
  const autoTimerRef = useRef(0);
  const spinRef = useRef<(automatic?: boolean) => Promise<void>>(async () => {});
  const spinSpeedRef = useRef<"normal" | "quick" | "turbo">("normal");
  const autoSkipScreensRef = useRef(false);
  const leavingRef = useRef(false);
  const currentModeCostX = tuning.modeCosts[mode];
  const currentCost = bonus ? 0 : allahPurchaseCost(wager, mode, tuning.modeCosts);
  const bonusBuyCost = allahPurchaseCost(wager, "bonus-buy", tuning.modeCosts);
  const superBonusBuyCost = allahPurchaseCost(wager, "super-bonus-buy", tuning.modeCosts);
  const maxWager = maximumAffordableWager(balance, currentModeCostX, 1);
  const busy = phase === "playing";

  useEffect(() => {
    bonusRef.current = bonus;
  }, [bonus]);
  useEffect(() => {
    autoRemainingRef.current = autoRemaining;
  }, [autoRemaining]);

  useEffect(() => {
    mountedRef.current = true;
    const audio = new SlotAudio("allahin-lutfu");
    audioRef.current = audio;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(autoTimerRef.current);
      for (const resolve of waitersRef.current) resolve();
      waitersRef.current.clear();
      audio.dispose();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current)
      audioRef.current.enabled =
        settings.sound && admin.general.masterSound;
  }, [settings.sound, admin.general.masterSound]);

  const eyeVariant = (activeEvent?.payload.variant as keyof typeof eyeImages | undefined) ?? persistent.persistentEye ?? "blue";
  const eventClass = activeEvent ? `event-${activeEvent.type}` : "event-idle";
  const eventSideClass = activeEvent?.payload.side ? `event-side-${activeEvent.payload.side}` : "";
  const activeWinScene = activeEvent?.type === "win-tier"
    ? winScenes[String(activeEvent.payload.tier) as keyof typeof winScenes]
    : undefined;
  const displayedEyeSlots = activeEvent ? displayEyeSlots : persistent.eyeSlots;
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        waitersRef.current.delete(finish);
        resolve();
      };
      const timer = window.setTimeout(finish, Math.max(0, ms));
      waitersRef.current.add(finish);
    });

  const skipPresentation = () => {
    skipPresentationRef.current = true;
    for (const resolve of [...waitersRef.current]) resolve();
  };

  const playResult = async (result: AllahSpinResult, automatic: boolean) => {
    const accumulatedBefore = bonusRef.current?.totalPayout ?? 0;
    const settledDisplayWin = bonusRef.current
      ? (result.nextBonus?.totalPayout ?? accumulatedBefore + result.payout)
      : result.payout;
    skipPresentationRef.current = false;
    setDisplayWin(accumulatedBefore);
    setGrid(result.initialGrid);
    setVisibleColumns(new Set());
    setDisplayEyeSlots([]);
    setDisplayKeySlots([null, null, null]);
    setDisplayMinTier(0);
    setDisplayGlobalMultiplier(1);
    setDisplayCollectorValues({});
    setGlobalAppliedValues({});
    for (let index = 0; index < result.events.length; index += 1) {
      if (skipPresentationRef.current) break;
      const event = result.events[index];
      if (automatic && autoSkipScreensRef.current && autoSkippableEvents.has(event.type))
        continue;
      if (!mountedRef.current) return;
      setActiveEvent(event);
      setActiveCells(new Set(event.cells.map(({ row, column }) => `${row}-${column}`)));
      setGrid(event.grid);
      setDisplayEyeSlots(event.eyeSlots);
      setDisplayKeySlots(event.globalKeySlots);
      setDisplayMinTier(event.minimumCoinTier);
      setDisplayGlobalMultiplier(event.globalMultiplier);
      setDisplayCollectorValues(event.collectorValues);
      setGlobalAppliedValues(event.globalAppliedValues);
      if (event.type === "payout-count") setDisplayWin(settledDisplayWin);
      if (event.type === "spin-commit") setVisibleColumns(new Set());
      if (event.type === "column-feed" || event.type === "reel-impact") {
        const column = Number(event.payload.column ?? 0);
        setVisibleColumns((current) => new Set([...current, column]));
      }
      eventSound(audioRef.current, event);
      const speed = spinSpeedRef.current;
      const baseDuration = skipPresentationRef.current
        ? 0
        : speed === "turbo"
          ? Math.max(10, Math.round(event.durationTurbo * tuning.turboAnimationScale))
          : speed === "quick"
            ? Math.max(24, Math.round(event.durationTurbo * 0.82))
            : Math.max(20, Math.round(event.durationNormal * tuning.normalAnimationScale));
      setEventDuration(baseDuration);
      await wait(baseDuration);
    }
    setGrid(result.finalGrid);
    setActiveEvent(undefined);
    setActiveCells(new Set());
    setVisibleColumns(new Set([0, 1, 2, 3, 4]));
    setDisplayEyeSlots(result.persistent.eyeSlots);
    setDisplayKeySlots(result.globalKeySlots);
    setDisplayMinTier(result.persistent.minimumCoinTier);
    setDisplayGlobalMultiplier(result.globalMultiplier);
    setDisplayCollectorValues(result.collectorValues);
    setGlobalAppliedValues(result.globalAppliedValues);
    setDisplayWin(settledDisplayWin);
    skipPresentationRef.current = false;
  };

  const scheduleNext = (delay = 420) => {
    window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current || spinLockRef.current) return;
      if (bonusRef.current?.remaining || autoRemainingRef.current > 0)
        void spinRef.current(true);
    }, delay);
  };

  const writeRound = (
    roundId: string,
    startedAt: string,
    balanceBefore: number,
    cost: number,
    result: AllahSpinResult,
    inBonus: boolean,
  ) => {
    const settledAt = new Date().toISOString();
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "allahin-lutfu",
      variant: `Allah’ın Lütfu · 5×6 · ${inBonus ? bonusLabel(result.nextBonus?.tier) : modeLabels[result.mode]}`,
      source: "player",
      playerParticipated: true,
      startedAt,
      settledAt,
      stake: cost,
      grossPayout: result.payout,
      net: result.payout - cost,
      outcome:
        result.payout > cost ? "win" : result.payout < cost ? "loss" : "push",
      balanceBefore,
      balanceAfter: balanceBefore - cost + result.payout,
      result: {
        telemetryVersion: 1,
        rngModel: "weighted-feature-queue-v8-chained-eye-multi-key",
        targetRtp: 96.7,
        referenceBet: wager,
        mode: result.mode,
        initialGrid: result.initialGrid,
        finalGrid: result.finalGrid,
        lineWins: result.lineWins,
        lineWinX: result.lineWinX,
        coinWinX: result.coinWinX,
        collectorWinX: result.collectorWinX,
        globalMultiplier: result.globalMultiplier,
        grossMultiplier: result.grossMultiplier,
        featureCycles: result.featureCycles,
        scatterCount: result.scatterCount,
        triggeredBonus: result.triggeredBonus,
        bonusUpgrade: result.bonusUpgrade,
        maxWin: result.maxWin,
      },
      modifiers: {
        bonus: inBonus,
        bonusTier: result.nextBonus?.tier,
        purchaseCostX: tuning.modeCosts[result.mode],
      },
    });
    if (cost)
      void recordWalletEntry({
        id: createRecordId("ledger-stake", roundId),
        roundId,
        game: "allahin-lutfu",
        occurredAt: startedAt,
        type: "stake",
        amount: -cost,
        balanceBefore,
        balanceAfter: balanceBefore - cost,
        note: `Allah’ın Lütfu · ${modeLabels[result.mode]}`,
      });
    if (result.payout)
      void recordWalletEntry({
        id: createRecordId("ledger-payout", roundId),
        roundId,
        game: "allahin-lutfu",
        occurredAt: settledAt,
        type: "payout",
        amount: result.payout,
        balanceBefore: balanceBefore - cost,
        balanceAfter: balanceBefore - cost + result.payout,
        note: "Allah’ın Lütfu ödeme",
      });
  };

  const spin = async (automatic = false) => {
    if (spinLockRef.current) {
      skipPresentation();
      return;
    }
    const currentBonus = bonusRef.current;
    const spinMode: AllahPurchaseMode = currentBonus ? "base" : mode;
    const cost = currentBonus ? 0 : allahPurchaseCost(wager, spinMode, tuning.modeCosts);
    if (!currentBonus && balance < cost) {
      setNotice(`Yetersiz bakiye · gereken ${money.format(cost)} PR`);
      return;
    }
    if (automatic && !currentBonus) {
      const next = Math.max(0, autoRemainingRef.current - 1);
      autoRemainingRef.current = next;
      setAutoRemaining(next);
    }
    spinLockRef.current = true;
    setPhase("playing");
    setNotice("");
    const roundId = `allahin-lutfu-${Date.now()}-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();
    const balanceBefore = balance;
    if (cost) setBalance((value) => value - cost);

    const spinPersistent: AllahPersistentState = {
      ...persistent,
      minimumCoinTier: 0,
      globalMultiplier: 1,
      eyeSlots: currentBonus ? persistent.eyeSlots : [],
      persistentEye: currentBonus ? persistent.persistentEye : undefined,
    };
    const result = runAllahSpin({
      wager,
      mode: spinMode,
      persistent: spinPersistent,
      bonus: currentBonus,
      runId: roundId,
      tuning,
    });
    await playResult(result, automatic);
    if (!mountedRef.current) return;

    setBalance((value) => value + result.payout);
    setPersistent(result.persistent);
    writeRound(roundId, startedAt, balanceBefore, cost, result, Boolean(currentBonus));

    let nextBonus = result.nextBonus;
    if (result.triggeredBonus)
      nextBonus = {
        tier: result.triggeredBonus,
        remaining: tuning.bonusSpins,
        totalSpins: 0,
        totalPayout: 0,
      };
    if (result.triggeredBonus) {
      bonusEntryCostRef.current = 0;
      setDisplayWin(0);
    }
    let openedSpecialSummary = false;
    if (nextBonus?.remaining) {
      bonusRef.current = nextBonus;
      setBonus(nextBonus);
      setPhase("bonus-ready");
    } else {
      if (currentBonus && nextBonus && !leavingRef.current) {
        openedSpecialSummary = true;
        setSpecialSummary({
          kind: "bonus",
          eyebrow: "ÖZEL OYUN TAMAMLANDI",
          title: `${bonusLabel(nextBonus.tier)} sona erdi.`,
          spins: nextBonus.totalSpins,
          payout: nextBonus.totalPayout,
          cost: bonusEntryCostRef.current,
        });
      }
      bonusRef.current = undefined;
      setBonus(undefined);
      setPhase("idle");
      setPersistent(defaultAllahPersistentState());
    }
    if (!currentBonus && spinMode === "fate" && !leavingRef.current) {
      openedSpecialSummary = true;
      setSpecialSummary({
        kind: "fate",
        eyebrow: "KADERİN HÜKMÜ TAMAMLANDI",
        title: "FU Spin sonucu",
        spins: 1,
        payout: result.payout,
        cost,
      });
    }
    spinLockRef.current = false;

    if (!leavingRef.current && !openedSpecialSummary && (nextBonus?.remaining || autoRemainingRef.current > 0))
      scheduleNext(spinSpeedRef.current === "turbo" ? 35 : spinSpeedRef.current === "quick" ? 140 : 360);
  };

  spinRef.current = spin;

  const purchaseBonus = (tier: "free" | "super") => {
    if (busy || bonus) return;
    const purchaseMode: AllahPurchaseMode = tier === "super" ? "super-bonus-buy" : "bonus-buy";
    const cost = allahPurchaseCost(wager, purchaseMode, tuning.modeCosts);
    if (balance < cost) {
      setNotice(`Yetersiz bakiye · gereken ${money.format(cost)} PR`);
      return;
    }
    const id = `allahin-lutfu-buy-${Date.now()}-${crypto.randomUUID()}`;
    const occurredAt = new Date().toISOString();
    const balanceBefore = balance;
    setBalance((value) => value - cost);
    bonusEntryCostRef.current = cost;
    void recordWalletEntry({
      id: createRecordId("ledger-stake", id),
      roundId: id,
      game: "allahin-lutfu",
      occurredAt,
      type: "stake",
      amount: -cost,
      balanceBefore,
      balanceAfter: balanceBefore - cost,
      note: `Allah’ın Lütfu · ${modeLabels[purchaseMode]}`,
    });
    void recordGameEvent({
      id: createRecordId("event-allahin-lutfu-buy", id),
      roundId: id,
      game: "allahin-lutfu",
      occurredAt,
      type: "bonus-purchased",
      payload: { tier, referenceBet: wager, cost, costX: tuning.modeCosts[purchaseMode] },
    });
    const session: AllahBonusState = {
      tier,
      remaining: tuning.bonusSpins,
      totalSpins: 0,
      totalPayout: 0,
    };
    bonusRef.current = session;
    setBonus(session);
    setDisplayWin(0);
    setPersistent({
      ...defaultAllahPersistentState(),
      persistentEye: tier === "super" ? "gold" : undefined,
    });
    setBuyOpen(false);
    setAutoRemaining(0);
    autoRemainingRef.current = 0;
    setPhase("bonus-ready");
    scheduleNext(650);
  };

  const activateSpinMode = (nextMode: Exclude<AllahPurchaseMode, "bonus-buy" | "super-bonus-buy">) => {
    if (busy || bonus) return;
    setMode(nextMode);
    setBuyOpen(false);
    setAutoRemaining(0);
    autoRemainingRef.current = 0;
  };

  const startAuto = () => {
    if (busy || bonus) return;
    autoRemainingRef.current = Math.max(1, autoCount);
    setAutoRemaining(Math.max(1, autoCount));
    setAutoOpen(false);
    scheduleNext(80);
  };

  const stopAuto = () => {
    window.clearTimeout(autoTimerRef.current);
    autoRemainingRef.current = 0;
    setAutoRemaining(0);
  };

  const closeSpecialSummary = () => {
    setSpecialSummary(undefined);
    if (bonusRef.current?.remaining && !spinLockRef.current) scheduleNext(420);
  };

  const exitRoom = () => {
    stopAuto();
    leavingRef.current = true;
    skipPresentation();
    audioRef.current?.dispose();
    window.speechSynthesis?.cancel();
    onBack();
  };

  return (
    <main className={`allah-slot ${eventClass} ${eventSideClass} is-${spinSpeed}`} style={{ "--allah-event-duration": `${eventDuration}ms` } as CSSProperties}>
      <header className="allah-topbar">
        <button className="allah-back" onClick={exitRoom}>← <span>Slot salonu</span></button>
        <div className="allah-brand">
          <small>ROYAL REELS · NUR DİVANI</small>
          <strong>ALLAH’IN LÜTFU</strong>
        </div>
        <div className="allah-audio-tools">
          <GameMusicControls game="allahin-lutfu" />
        </div>
        <div className="allah-balance"><small>BAKİYE</small><strong>{money.format(balance)} PR</strong></div>
      </header>

      <section className="allah-game-stage">
        <section className="allah-machine">
          <div className="allah-global-bar">
            <div className="allah-wheel might"><img src="/assets/slots/allahin-lutfu/ui/might-wheel.png" alt="Kudret Çarkı" /><span>KUDRET</span></div>
            <div className="allah-global-core">
              <div className="allah-key-slots" aria-label="Semavi Anahtar üçlü çarpan hanesi">
                {displayKeySlots.map((value, index) => {
                  const active = (activeEvent?.type === "key-slot-spin" || activeEvent?.type === "key-slot-lock") && Number(activeEvent.payload.slot) === index;
                  return <span className={`${value !== null ? "locked" : ""} ${active ? "active" : ""}`} key={index} style={{ "--key-slot": index } as CSSProperties}>
                    <i><b>2×</b><b>5×</b><b>10×</b><b>20×</b></i>
                    <strong>{value === null ? "—" : `${value}×`}</strong>
                  </span>;
                })}
              </div>
              <div className="allah-global-value"><small>GLOBAL ÇARPAN</small><strong>{displayGlobalMultiplier}×</strong></div>
              {(activeEvent?.type === "global-row-charge" || activeEvent?.type === "global-row-apply") && <div className="allah-global-row-caption" role="status">
                {Number(activeEvent.payload.row) + 1}. SATIR · {money.format(Number(activeEvent.payload.before))}× × {displayGlobalMultiplier} = {money.format(Number(activeEvent.payload.after))}×
              </div>}
            </div>
            <div className="allah-wheel mercy"><img src="/assets/slots/allahin-lutfu/ui/mercy-wheel.png" alt="Rahmet Çarkı" /><span>RAHMET</span></div>
          </div>

          <div
            className={`allah-win-meter ${bonus ? `is-bonus tier-${bonus.tier}` : ""} ${displayWin > 0 ? "has-win" : ""}`}
            aria-live="polite"
            aria-label={bonus ? `Biriken bonus kazancı ${money.format(displayWin)} PR` : `Tur kazancı ${money.format(displayWin)} PR`}
          >
            <span>KAZANÇ</span>
            <strong>{money.format(displayWin)} <small>PR</small></strong>
            <em>{bonus ? `${bonus.remaining} DÖNÜŞ` : "SON TUR"}</em>
          </div>

          <aside className="allah-eye-console" aria-label="Nur Gözü seçili sembolleri">
            <div className="allah-eye-orbit">
              <img src={eyeImages[eyeVariant]} alt={`${eyeVariant} Nur Gözü`} />
              <i className="allah-eye-pupil" />
            </div>
            <div className="allah-eye-console-copy">
              <strong>NUR GÖZÜ</strong>
              <small>{persistent.persistentEye ? "BONUS BOYUNCA KALICI" : "HEDEFİ TAKİP EDER"}</small>
              <div className="allah-eye-slots">
                {Array.from({ length: 10 }, (_, index) => {
                  const symbol = displayedEyeSlots[index];
                  return (
                    <span key={index} className={`${symbol ? "filled" : ""} ${activeEvent?.type === "eye-slot-fill" && Number(activeEvent.payload.slot) === index ? "active" : ""}`}>
                      {symbol ? <img src={ALLAH_SYMBOLS[symbol].image} alt={ALLAH_SYMBOLS[symbol].label} /> : <i />}
                    </span>
                  );
                })}
              </div>
              <div className="allah-min-tier">
                <small>ASA KADEMESİ</small>
                <b>{ALLAH_COIN_TIERS[displayMinTier].toLocaleUpperCase("tr-TR")}</b>
                <em>{displayMinTier}/{ALLAH_COIN_TIERS.length - 1}</em>
              </div>
            </div>
          </aside>

          <div className="allah-grid" aria-label="5 reel 6 satır oyun alanı">
            {grid.map((row, rowIndex) =>
              row.map((cell, column) => {
                const visual = cellVisual(cell, displayCollectorValues[cell.id] ?? 0, tuning.maxWinX);
                const key = `${rowIndex}-${column}`;
                const globalTarget = activeCells.has(key) && (activeEvent?.type === "global-row-charge" || activeEvent?.type === "global-row-apply");
                const appliedValue = globalAppliedValues[cell.id];
                const displayedValue = appliedValue === undefined ? visual.value : `${compactWager(appliedValue)}×`;
                const mysterySequenceActive = activeEvent?.type === "mystery-roll" || activeEvent?.type === "mystery-reveal";
                const streamsUntilResolved = mysterySequenceActive && cell.kind === "mystery";
                const modifierIsRolling = activeEvent?.type === "modifier-coin-roll" && activeCells.has(key);
                const showMysteryFlow = streamsUntilResolved || modifierIsRolling;
                return (
                  <div
                    className={`allah-cell kind-${cell.kind} ${cell.fromMystery ? "mystery-born" : ""} ${activeCells.has(key) ? "event-target" : ""} ${appliedValue !== undefined ? "global-applied" : ""} ${visibleColumns.has(column) ? "is-visible" : "is-awaiting"}`}
                    key={cell.id}
                    style={{ "--row": rowIndex, "--column": column } as CSSProperties}
                    title={appliedValue === undefined ? visual.label : `${visual.label} · Global ${displayGlobalMultiplier}× → ${money.format(appliedValue)}×`}
                  >
                    {visual.image && <img src={visual.image} alt="" draggable={false} />}
                    {displayedValue && <b className={globalTarget && activeEvent?.type === "global-row-apply" ? "allah-global-new-value" : undefined}>{displayedValue}</b>}
                    {globalTarget && <span className="allah-global-coin-equation" key={activeEvent!.id} aria-hidden="true">
                      {visual.value} <i>× {displayGlobalMultiplier}</i>
                    </span>}
                    {cell.kind === "redrop" && <span className="allah-feature-tag">REDROP</span>}
                    {cell.kind === "eye" && <i className="allah-cell-eye-pupil" />}
                    {showMysteryFlow && (
                      <span
                        className={`allah-mystery-reel ${streamsUntilResolved ? "is-streaming" : "is-converting"}`}
                        style={{ "--mystery-phase": `${-((column * 6 + rowIndex) % 10) * 73}ms` } as CSSProperties}
                        aria-hidden="true"
                      >
                        <span className="allah-mystery-track">
                          {mysteryFlowLoop.map((image, imageIndex) => (
                            <img src={image} alt="" draggable={false} key={`${image}-${imageIndex}`} />
                          ))}
                        </span>
                      </span>
                    )}
                  </div>
                );
              }),
            )}
            {(activeEvent?.type === "global-row-charge" || activeEvent?.type === "global-row-apply") && <div
              key={activeEvent.id}
              className="allah-global-row-wave"
              aria-hidden="true"
              style={{ "--global-row": Number(activeEvent.payload.row) } as CSSProperties}
            ><span>×{displayGlobalMultiplier}</span></div>}
            {activeEvent?.type === "coin-flight" && activeEvent.cells.length > 1 && (() => {
              const target = activeEvent.cells[activeEvent.cells.length - 1];
              return <div className="allah-flight-layer" aria-hidden="true">
                {activeEvent.cells.slice(0, -1).map((source, index) => (
                  <i
                    key={`${source.row}-${source.column}-${index}`}
                    style={{
                      "--x0": `${(source.column + .5) * 20}%`,
                      "--y0": `${(source.row + .5) * (100 / 6)}%`,
                      "--x1": `${(target.column + .5) * 20}%`,
                      "--y1": `${(target.row + .5) * (100 / 6)}%`,
                      "--flight-delay": `${Math.min(index * 34, 360)}ms`,
                    } as CSSProperties}
                  ><b>{compactWager(Number(activeEvent.payload.value ?? 0))}×</b></i>
                ))}
              </div>;
            })()}
            {activeEvent?.type === "eye-ray" && activeEvent.cells.length === 2 && (() => {
              const [source, target] = activeEvent.cells;
              return <i className="allah-eye-projectile" aria-hidden="true" style={{
                "--x0": `${(source.column + .5) * 20}%`,
                "--y0": `${(source.row + .5) * (100 / 6)}%`,
                "--x1": `${(target.column + .5) * 20}%`,
                "--y1": `${(target.row + .5) * (100 / 6)}%`,
              } as CSSProperties}>M</i>;
            })()}
            {activeEvent?.type === "board-multiplier-cast" && activeEvent.cells.length === 2 && (() => {
              const [source, target] = activeEvent.cells;
              return <i className="allah-multiplier-projectile" aria-hidden="true" style={{
                "--x0": `${(source.column + .5) * 20}%`,
                "--y0": `${(source.row + .5) * (100 / 6)}%`,
                "--x1": `${(target.column + .5) * 20}%`,
                "--y1": `${(target.row + .5) * (100 / 6)}%`,
              } as CSSProperties}>×{Number(activeEvent.payload.value ?? 2)}</i>;
            })()}
            {activeEvent?.type === "board-multiplier-wave" && activeEvent.cells[0] && <div className="allah-board-wave" aria-hidden="true" style={{
              "--wave-x": `${(activeEvent.cells[0].column + .5) * 20}%`,
              "--wave-y": `${(activeEvent.cells[0].row + .5) * (100 / 6)}%`,
            } as CSSProperties} />}
          </div>

          {activeWinScene && <div
            className={`allah-win-overlay tier-${String(activeEvent?.payload.tier)}`}
            style={{ "--win-scene": `url(${activeWinScene.image})` } as CSSProperties}
          >
            <div className="allah-win-copy">
              <small>{activeWinScene.eyebrow}</small>
              <strong>{activeWinScene.title}</strong>
              <b>{money.format(Number(activeEvent?.payload.payout ?? 0))} PR</b>
              <em>{money.format(Number(activeEvent?.payload.grossMultiplier ?? 0))}×</em>
            </div>
          </div>}

        </section>
      </section>

      <section className="allah-controls">
        <div className="allah-bet-control">
          <label htmlFor="allah-wager">BAHİS</label>
          <button onClick={() => setWager(settings.minBet)} disabled={busy || Boolean(bonus)}>MİN</button>
          <input
            id="allah-wager"
            inputMode="decimal"
            type="number"
            min={settings.minBet}
            value={wager}
            disabled={busy || Boolean(bonus)}
            onChange={(event) => setWager(normalizeWagerInput(Number(event.target.value), settings.minBet))}
          />
          <button onClick={() => setWager(Math.max(settings.minBet, maxWager))} disabled={busy || Boolean(bonus)}>MAKS</button>
          <button onClick={() => setWager((value) => Math.max(settings.minBet, value - betStep))} disabled={busy || Boolean(bonus)}>−{compactWager(betStep)}</button>
          <button onClick={() => setWager((value) => Math.min(Math.max(settings.minBet, maxWager), value + betStep))} disabled={busy || Boolean(bonus)}>+{compactWager(betStep)}</button>
          <button onClick={() => setWager((value) => Math.max(settings.minBet, Math.floor(value / 2)))} disabled={busy || Boolean(bonus)}>½</button>
          <button onClick={() => setWager((value) => Math.min(Math.max(settings.minBet, maxWager), value * 2))} disabled={busy || Boolean(bonus)}>2×</button>
          <select value={betStep} onChange={(event) => setBetStep(Number(event.target.value))} disabled={busy || Boolean(bonus)} aria-label="Bahis artış adımı">
            {CASINO_BET_STEPS.map((step) => <option key={step} value={step}>Adım {compactWager(step)}</option>)}
          </select>
        </div>

        <div className="allah-mode-control">
          <label>SEÇİLİ OYUN</label>
          <button
            className="allah-mode-opener"
            type="button"
            onClick={() => setBuyOpen(true)}
            disabled={busy || Boolean(bonus) || autoRemaining > 0}
            aria-label="Görselli bonus al ve özel oyun menüsünü aç"
          >
            <img src={modeArt[mode as Exclude<AllahPurchaseMode, "bonus-buy" | "super-bonus-buy">]} alt="" />
            <span><strong>{bonus ? bonusLabel(bonus.tier) : modeLabels[mode]}</strong><small>{bonus ? "Ücretsiz dönüş" : `${tuning.modeCosts[mode]}× · ${money.format(currentCost)} PR`}</small></span>
            <b>DEĞİŞTİR</b>
          </button>
        </div>

        <button
          className={`allah-spin ${busy ? "is-stop" : ""}`}
          onClick={() => void spin(false)}
          disabled={!busy && !bonus && balance < currentCost}
        >
          <i />
          <strong>{busy ? "ATLA" : bonus ? `${bonus.remaining}. LÜTUF` : "DÖNDÜR"}</strong>
          <small>{busy ? "SONUCU HEMEN GÖR" : bonus ? bonusLabel(bonus.tier) : `${money.format(currentCost)} PR`}</small>
        </button>

        <div className="allah-quick-actions">
          <button
            className={spinSpeed === "turbo" ? "active" : ""}
            onClick={() => {
              const next = spinSpeed === "turbo" ? "normal" : "turbo";
              spinSpeedRef.current = next;
              setSpinSpeed(next);
            }}
            aria-pressed={spinSpeed === "turbo"}
          >⚡ <span>TURBO</span></button>
          <button className="allah-buy-shortcut" onClick={() => setBuyOpen(true)} disabled={busy || Boolean(bonus)}>✦ <span>BONUS AL</span></button>
          <button className={autoRemaining > 0 ? "active" : ""} onClick={() => autoRemaining > 0 ? stopAuto() : setAutoOpen(true)} disabled={busy && autoRemaining === 0}>↻ <span>{autoRemaining > 0 ? `DUR · ${autoRemaining}` : "AUTO BET"}</span></button>
          <button onClick={() => setRulesOpen(true)}>i <span>KURALLAR</span></button>
        </div>
      </section>

      {notice && <div className="allah-notice" role="alert">{notice}</div>}

      {specialSummary && (
        <div className="allah-modal-backdrop" role="presentation">
          <section className={`allah-modal allah-summary-modal ${specialSummary.kind}`} role="dialog" aria-modal="true" aria-labelledby="allah-bonus-summary-title">
            <i className="allah-summary-aura" />
            <div className="allah-summary-emblem">
              <img
                src={specialSummary.kind === "fate" ? "/assets/slots/allahin-lutfu/symbols/mystery-orb.png" : "/assets/slots/allahin-lutfu/bonus/free-spins.png"}
                alt=""
              />
            </div>
            <small>{specialSummary.eyebrow}</small>
            <h2 id="allah-bonus-summary-title">{specialSummary.title}</h2>
            <div className="allah-summary-hero">
              <span>KAZANÇ</span>
              <strong>{money.format(specialSummary.payout)} PR</strong>
            </div>
            <div className="allah-summary-grid">
              <span><small>DÖNÜŞ</small><b>{specialSummary.spins}</b></span>
              <span><small>MALİYET</small><b>{money.format(specialSummary.cost)} PR</b></span>
            </div>
            <button className="allah-modal-primary" onClick={closeSpecialSummary}>DEVAM ET</button>
          </section>
        </div>
      )}

      {buyOpen && (
        <div className="allah-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBuyOpen(false)}>
          <section className="allah-modal allah-buy-modal" role="dialog" aria-modal="true" aria-labelledby="allah-buy-title">
            <button className="allah-modal-close" onClick={() => setBuyOpen(false)}>×</button>
            <small>BONUS AL · ÖZEL DÖNÜŞLER</small>
            <h2 id="allah-buy-title">Oyun türünü görselden seç.</h2>
            <div className="allah-feature-toolbar">
              <div className="allah-feature-wager">
                <span><small>BAHİS</small><strong>{money.format(wager)} PR</strong></span>
                <button onClick={() => setWager((value) => Math.max(settings.minBet, value - betStep))}>−</button>
                <button onClick={() => setWager((value) => Math.min(maximumAffordableWager(balance, 1, 1), value + betStep))}>+</button>
              </div>
              <button className={`allah-normal-mode ${mode === "base" ? "selected" : ""}`} onClick={() => activateSpinMode("base")}>
                <img src={modeArt.base} alt="" />
                <span><small>NORMAL OYUN</small><strong>{mode === "base" ? "SEÇİLİ" : "NORMALE DÖN"}</strong></span>
              </button>
            </div>
            <div className="allah-feature-grid">
              {([
                { mode: "enhancer", title: "LÜTUF ARTTIRICI", detail: "Scatter şansı yükselir", image: "/assets/slots/allahin-lutfu/symbols/scatter.png", tone: "purple" },
                { mode: "degen", title: "DELİ CESARETİ", detail: "Scatter ve Eye birlikte güçlenir", image: "/assets/slots/allahin-lutfu/symbols/eye-gold.png", tone: "purple" },
                { mode: "trickster", title: "HİLEBAZ DÖNÜŞ", detail: "Eye ağırlıklı Mystery avı", image: "/assets/slots/allahin-lutfu/symbols/mystery-orb.png", tone: "purple" },
                { mode: "fate", title: "KADERİN HÜKMÜ", detail: "Tam ekran Mystery tek dönüş", image: "/assets/slots/allahin-lutfu/symbols/max-win-coin.png", tone: "purple" },
              ] as const).map((option) => {
                const cost = allahPurchaseCost(wager, option.mode, tuning.modeCosts);
                return <article className={`allah-feature-card ${option.tone} ${mode === option.mode ? "selected" : ""}`} key={option.mode}>
                  <h3>{option.title}</h3>
                  <div className="allah-feature-art"><img src={option.image} alt="" />{option.mode === "enhancer" && <b>+</b>}{option.mode === "degen" && <b>↑</b>}</div>
                  <p>{option.detail}</p>
                  <strong>{money.format(cost)} PR</strong>
                  <button onClick={() => activateSpinMode(option.mode)} disabled={balance < cost}>{mode === option.mode ? "SEÇİLDİ" : "SEÇ"}</button>
                </article>;
              })}
              <article className="allah-feature-card gold">
                <h3>LÜTUF DÖNÜŞLERİ</h3>
                <div className="allah-feature-art"><img src="/assets/slots/allahin-lutfu/bonus/free-spins.png" alt="" /></div>
                <p>{tuning.bonusSpins} ücretsiz dönüş</p>
                <strong>{money.format(bonusBuyCost)} PR</strong>
                <button onClick={() => purchaseBonus("free")} disabled={balance < bonusBuyCost}>SATIN AL</button>
              </article>
              <article className="allah-feature-card gold">
                <h3>BÜYÜK LÜTUF</h3>
                <div className="allah-feature-art"><img src="/assets/slots/allahin-lutfu/bonus/super-free-spins.png" alt="" /></div>
                <p>{tuning.bonusSpins} dönüş · Kalıcı Altın Göz</p>
                <strong>{money.format(superBonusBuyCost)} PR</strong>
                <button onClick={() => purchaseBonus("super")} disabled={balance < superBonusBuyCost}>SATIN AL</button>
              </article>
            </div>
            <div className="allah-bonus-ladder-preview" aria-label="Doğal scatter ile açılan bonus seviyeleri">
              {([
                ["free", "3 SCATTER", "LÜTUF", "/assets/slots/allahin-lutfu/bonus/free-spins.png"],
                ["super", "4 SCATTER", "BÜYÜK", "/assets/slots/allahin-lutfu/bonus/super-free-spins.png"],
                ["legendary", "5 SCATTER", "EFSANEVİ", "/assets/slots/allahin-lutfu/bonus/legendary-free-spins.png"],
                ["mythic", "DÜZ / V 5", "MİTİK", "/assets/slots/allahin-lutfu/bonus/mythic-free-spins.png"],
              ] as const).map(([tier, trigger, label, image]) => <span className={`tier-${tier}`} key={tier}>
                <img src={image} alt="" /><i>{trigger}</i><b>{label}</b>
              </span>)}
            </div>
            <footer>Enhancer seçenekleri sonraki ücretli dönüşün türünü seçer; Bonus seçenekleri tutarı hemen çekip özel oyunu başlatır.</footer>
          </section>
        </div>
      )}

      {autoOpen && (
        <div className="allah-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAutoOpen(false)}>
          <section className="allah-modal allah-auto-modal" role="dialog" aria-modal="true" aria-labelledby="allah-auto-title">
            <button className="allah-modal-close" onClick={() => setAutoOpen(false)}>×</button>
            <small>PRAGMATIC DÜZENİ</small>
            <h2 id="allah-auto-title">AUTOPLAY AYARLARI</h2>
            <div className="allah-auto-speed" role="group" aria-label="Otomatik dönüş hızı">
              <button
                className={spinSpeed === "turbo" ? "active" : ""}
                aria-pressed={spinSpeed === "turbo"}
                onClick={() => {
                  const next = spinSpeed === "turbo" ? "normal" : "turbo";
                  spinSpeedRef.current = next;
                  setSpinSpeed(next);
                }}
              ><i>{spinSpeed === "turbo" ? "✓" : ""}</i><span>TURBO SPIN</span></button>
              <button
                className={spinSpeed === "quick" ? "active" : ""}
                aria-pressed={spinSpeed === "quick"}
                onClick={() => {
                  const next = spinSpeed === "quick" ? "normal" : "quick";
                  spinSpeedRef.current = next;
                  setSpinSpeed(next);
                }}
              ><i>{spinSpeed === "quick" ? "✓" : ""}</i><span>QUICK SPIN</span></button>
              <button
                className={autoSkipScreens ? "active" : ""}
                aria-pressed={autoSkipScreens}
                onClick={() => {
                  const next = !autoSkipScreens;
                  autoSkipScreensRef.current = next;
                  setAutoSkipScreens(next);
                }}
              ><i>{autoSkipScreens ? "✓" : ""}</i><span>EKRANLARI ATLA</span></button>
            </div>
            <div className="allah-auto-count">
              <div><span>OTOMATİK DÖNÜŞ SAYISI</span><strong>{autoCount}</strong></div>
              <input
                aria-label="Otomatik dönüş sayısı"
                type="range"
                min={1}
                max={1000}
                step={1}
                value={autoCount}
                style={{ "--auto-progress": `${((autoCount - 1) / 999) * 100}%` } as CSSProperties}
                onChange={(event) => setAutoCount(Math.min(1000, Math.max(1, Number(event.target.value))))}
              />
              <div className="allah-auto-presets">
                {[10, 25, 50, 100, 250, 500, 1000].map((count) => (
                  <button key={count} className={autoCount === count ? "active" : ""} onClick={() => setAutoCount(count)}>{count}</button>
                ))}
              </div>
            </div>
            <div className="allah-auto-preview"><span>TOPLAM BAHİS</span><b>{money.format(currentCost * autoCount)} PR</b></div>
            <button className="allah-modal-primary" onClick={startAuto} disabled={balance < currentCost}>AUTOPLAY’İ BAŞLAT ({autoCount})</button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="allah-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setRulesOpen(false)}>
          <section className="allah-modal allah-rules-modal" role="dialog" aria-modal="true" aria-labelledby="allah-rules-title">
            <button className="allah-modal-close" onClick={() => setRulesOpen(false)}>×</button>
            <small>OYUN KURALLARI · RTP %96,70 · YÜKSEK VOLATİLİTE</small>
            <h2 id="allah-rules-title">Bir spin, uzun bir lütuf zincirine dönüşebilir.</h2>
            <div className="allah-rules-grid">
              <article><b>5×6 · 28 çizgi</b><p>3+ aynı sembol en soldan başlayıp bitişik reellerde sürerse öder.</p></article>
              <article><b>Coin’ler</b><p>Bronz 1×–4× ile başlar; Elmas 10.000×–50.000×. Max Coin {money.format(tuning.maxWinX)}× sınırıdır.</p></article>
              <article><b>Nur Gözü</b><p>Makaraya indiğinde alanı tarar, rastgele hücrelere Mystery yollar. Mystery’ler soldan sağa ve yukarıdan aşağıya tek tek dönerek yalnız coin veya özelliklere açılır; Mystery’den yeni bir Göz gelirse o da yeni Mystery alanları açarak zinciri büyütür. Normal ödeme sembolü üretemez. İşlev sembolleri görevleri tamamlanınca yeniden dönüp coin olur.</p></article>
              <article><b>Collector</b><p>Normal makaraya doğrudan düşmez; Mystery’den açılır. Bütün coin ve dolu Collector değerlerini, diğer işlevler bittikten sonra sırayla kendine çeker. Ardından yalnız o özellikte aktif olan `M` kökenli hücreler yeniden Mystery dönmeye başlar; normal makara alanları değişmez. Çifte Lütuf bunu iki kez yapar.</p></article>
              <article><b>Kaderin Hükmü</b><p>5.000× maliyetli FU Spin karşılığıdır: ilk 5×6 ekranın tamamı Mystery gelir ve tek bahis içinde özellik zincirine açılır.</p></article>
              <article><b>Yükseltici / Redrop</b><p>Yükseltici açıldığı anda en düşük coin katmanını kaldırır; aynı Mystery akışında ondan sonra açılan coin bile yeni tabanı kullanır. Redrop, Odin’s Vault’taki Redrop özelliğinin karşılığıdır: normal/premium ödeme sembollerini siler, coin ve özellikleri korur, boşluklara yeni sonuçları yukarıdan indirir.</p></article>
              <article><b>Alan / Global Çarpan</b><p>Alan Çarpanı bir hücre yarıçapındaki coin ve dolu keseleri tek tek büyütür. Her Semavi Anahtar üç haneyi sırayla yeniden döndürür; aynı zincirde ikinci anahtar gelirse üç yeni değer mevcut hanelere eklenir. Hane toplamı çizgi ile coin kazancına global uygulanır.</p></article>
              <article><b>4 bonus makamı</b><p>3/4/5 Scatter Lütuf, Büyük ve Efsanevi modu; düz/V beş Scatter Mitik modu açar. Her biri {tuning.bonusSpins} spin.</p></article>
              <article><b>Bonus yükseltme</b><p>Bonus içindeki Scatter modu bir üst seviyeye çıkarır. Mitik modun ilk coin özelliğinde Upgrader garantidir.</p></article>
            </div>
            <footer>Ödeme üst sınırı <b>{money.format(tuning.maxWinX)}×</b>. Auto Bet ve tüm satın almalar gerçek çekilecek tutarı spin öncesinde gösterir.</footer>
          </section>
        </div>
      )}
    </main>
  );
}
