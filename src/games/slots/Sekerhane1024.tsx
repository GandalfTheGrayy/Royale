import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { askNarin, narinEventLine } from "../../ai/narin";
import GameMusicControls from "../../audio/GameMusicControls";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import {
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import {
  createRecordId,
  getCasinoMeta,
  recordAIConversation,
  recordGameRound,
  recordGameEvent,
  recordWalletEntry,
  setCasinoMeta,
} from "../../data/casino-database";
import {
  CASINO_BET_STEPS,
  compactWager,
  maximumAffordableWager,
  normalizeWagerInput,
} from "../wagering";
import SlotProgressPanel from "./SlotProgressPanel";
import { recordSlotProgress } from "./slot-progression";
import { SlotAudio } from "./slot-audio";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
  slotFlowTelemetry,
} from "./slot-flow-engine";
import {
  createCascadeIdentity,
  cascadeGridDistance,
  createInitialFallRows,
  createNumberGrid,
  playCascadeTimeline,
  reconcileCascadeIdentity,
  waitForPresentation,
  type CascadePhase,
} from "./cascade-presentation";
import {
  DEFAULT_SEKERHANE_PROFILE,
  SEKERHANE_SYMBOLS,
  emptySekerhaneSpots,
  runSekerhaneSpin,
  superSekerhaneSpots,
  type SekerhaneCluster,
  type SekerhaneGrid,
  type SekerhaneSpot,
  type SekerhaneSpinResult,
  type SekerhaneSymbolId,
} from "./sekerhane-engine";
import "./cascade-presentation.css";
import "./sekerhane.css";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onBack: () => void;
  aiOnline: boolean;
};

type Phase = CascadePhase | "bonus-ready" | "bonus-playing" | "bonus-summary";
type Message = { speaker: "Narin" | "Sen"; text: string; moment: string };
type BonusSource = "natural" | "normal-buy" | "super-buy";
type BonusSession = {
  id: string;
  source: BonusSource;
  referenceBet: number;
  purchaseCost: number;
  balanceBefore: number;
  remaining: number;
  totalSpins: number;
  totalPayout: number;
  spots: SekerhaneSpot[][];
};
type BonusSummary = {
  payout: number;
  referenceBet: number;
  totalSpins: number;
  hottestSpot: number;
  activeSpots: number;
  source: BonusSource;
};
type WinTheatre = {
  amount: number;
  multiple: number;
  title: string;
};
type RetriggerNotice = {
  awarded: number;
  remaining: number;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
const BONUS_META_KEY = "sekerhane-1024-active-bonus-v1";
const initialCandyIds = () =>
  Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => `candy-${row}-${column}`),
  );
const sekerhaneCascadeDelay = (
  row: number,
  column: number,
  entering: boolean,
  turbo: boolean,
) => column * (turbo ? 1 : 8) + (entering ? row * (turbo ? 1 : 7) : 0);

function CandyGlyph({ symbol }: { symbol: SekerhaneSymbolId }) {
  const info = SEKERHANE_SYMBOLS[symbol];
  return (
    <span
      className={`candy-glyph candy-image-glyph ${symbol} ${symbol === "scatter" ? "scatter-glyph" : ""}`}
      aria-hidden="true"
    >
      <img src={info.image} alt="" draggable={false} />
    </span>
  );
}

function highestSpot(spots: SekerhaneSpot[][]) {
  return Math.max(0, ...spots.flat().map((spot) => spot.multiplier));
}

function mergeProfile(
  settings: ReturnType<typeof getAdminSettings>["games"]["sekerhane-1024"],
) {
  const math = settings.slot!.math;
  return {
    ...DEFAULT_SEKERHANE_PROFILE,
    payoutScale: math.payoutScale,
    bonusPayoutScale: math.bonusPayoutScale,
    baseScatterRate: math.baseScatterRate,
    bonusScatterRate: math.bonusScatterRate,
    maxCascades: math.maxCascades,
    minimumCluster: math.minimumCluster,
    maxWinX: math.maxWinX,
    cascadeAffinityPercent: math.cascadeAffinityPercent,
    retriggerSpins: math.retriggerSpins,
    valueWeights: settings.slot!.valueWeights,
  };
}

export default function Sekerhane1024({
  balance,
  setBalance,
  onBack,
  aiOnline,
}: Props) {
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const settings = admin.games["sekerhane-1024"];
  const slot = settings.slot!;
  const profile = useMemo(() => mergeProfile(settings), [settings]);
  const [wager, setWager] = useState(
    Math.max(settings.minBet, settings.defaultBet),
  );
  const [betStep, setBetStep] = useState(25);
  const [grid, setGrid] = useState<SekerhaneGrid>(
    () =>
      runSekerhaneSpin(0, undefined, {
        profile: {
          ...profile,
          payoutScale: 0,
          bonusPayoutScale: 0,
          maxCascades: 0,
        },
      }).initialGrid,
  );
  const [spots, setSpots] = useState<SekerhaneSpot[][]>(() =>
    emptySekerhaneSpots(),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [fallRows, setFallRows] = useState<number[][]>(() =>
    createNumberGrid(7, 7),
  );
  const [candyIds, setCandyIds] = useState<string[][]>(initialCandyIds);
  const [enteringCandyIds, setEnteringCandyIds] = useState<Set<string>>(
    new Set(),
  );
  const [receipt, setReceipt] = useState<SekerhaneCluster[]>([]);
  const [cascadeWin, setCascadeWin] = useState(0);
  const [spinWin, setSpinWin] = useState(0);
  const [lastResult, setLastResult] = useState<SekerhaneSpinResult>();
  const [lastPayout, setLastPayout] = useState(0);
  const [sessionNet, setSessionNet] = useState(0);
  const [spins, setSpins] = useState(0);
  const [autoCount, setAutoCount] = useState(25);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [buyChoice, setBuyChoice] = useState<"normal" | "super">();
  const [bonus, setBonus] = useState<BonusSession>();
  const [bonusSummary, setBonusSummary] = useState<BonusSummary>();
  const [retriggerNotice, setRetriggerNotice] = useState<RetriggerNotice>();
  const [winTheatre, setWinTheatre] = useState<WinTheatre>();
  const [effectsEnabled, setEffectsEnabled] = useGameAudioPreference(
    "sekerhane-1024",
    "effects",
  );
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "sekerhane-1024",
    "ai-voice",
  );
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Narin", text: narinEventLine("welcome"), moment: now() },
  ]);
  const audioRef = useRef<SlotAudio | null>(null);
  const candyDropBarrierRef = useRef<
    | { pending: Set<string>; promise: Promise<void>; resolve: () => void }
    | undefined
  >(undefined);
  const skipPresentationRef = useRef(false);
  const mountedRef = useRef(true);
  const bonusRunningRef = useRef(false);
  const candySerialRef = useRef(49);
  const sessionIdRef = useRef(
    `ai-sekerhane-${Date.now()}-${crypto.randomUUID()}`,
  );
  const flowStateRef = useRef(createSlotFlowState());
  const busy =
    (phase !== "idle" && phase !== "bonus-ready") || Boolean(winTheatre);
  const mathBonusBuyX = Math.max(1, slot.math.bonusBuyX);
  const superBonusBuyX = Math.max(mathBonusBuyX, slot.math.enhancedBetCostX);
  const bonusBuySpins = Math.max(1, Math.floor(slot.math.bonusBuySpins));
  const normalBonusCost = wager * mathBonusBuyX;
  const superBonusCost = wager * superBonusBuyX;

  useEffect(() => {
    mountedRef.current = true;
    const audio = new SlotAudio("sekerhane-1024");
    audioRef.current = audio;
    return () => {
      mountedRef.current = false;
      candyDropBarrierRef.current?.resolve();
      audio.dispose();
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (audioRef.current)
      audioRef.current.enabled =
        effectsEnabled && settings.sound && admin.general.masterSound;
  }, [effectsEnabled, settings.sound, admin.general.masterSound]);

  useEffect(() => {
    void getCasinoMeta<BonusSession | null>(BONUS_META_KEY).then((saved) => {
      if (!saved || !mountedRef.current) return;
      setBonus(saved);
      setSpots(saved.spots);
      setPhase("bonus-ready");
    });
  }, []);

  const announce = (
    text: string,
    speak = true,
    speaker: "assistant" | "system-event" = "system-event",
  ) => {
    setChat((items) =>
      [...items, { speaker: "Narin" as const, text, moment: now() }].slice(-10),
    );
    void recordAIConversation({
      id: createRecordId("ai-sekerhane", sessionIdRef.current),
      sessionId: sessionIdRef.current,
      game: "sekerhane-1024",
      character: "Narin",
      speaker,
      occurredAt: new Date().toISOString(),
      text,
      context: {
        wager,
        balance,
        spins,
        phase,
        bonusRemaining: bonus?.remaining ?? 0,
        lastPayout,
      },
    });
    if (voiceEnabled && speak && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = 0.96;
      utterance.pitch = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  };

  const beginCandyDropBarrier = (ids: string[][], distances: number[][]) => {
    candyDropBarrierRef.current?.resolve();
    const pending = new Set(
      ids.flatMap((row, rowIndex) =>
        row.filter(
          (_, columnIndex) => (distances[rowIndex]?.[columnIndex] ?? 0) > 0,
        ),
      ),
    );
    let resolvePromise = () => {};
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const barrier = {
      pending,
      promise,
      resolve: () => {
        resolvePromise();
        if (candyDropBarrierRef.current === barrier)
          candyDropBarrierRef.current = undefined;
      },
    };
    candyDropBarrierRef.current = barrier;
    if (!pending.size) barrier.resolve();
    return promise;
  };

  const finishCandyDrop = (
    event: AnimationEvent<HTMLDivElement>,
    candyId: string,
  ) => {
    if (
      event.target !== event.currentTarget ||
      (event.animationName !== "cascadePhysicalDrop" &&
        event.animationName !== "cascadeFeedDrop")
    )
      return;
    const barrier = candyDropBarrierRef.current;
    if (!barrier?.pending.delete(candyId) || barrier.pending.size) return;
    barrier.resolve();
  };

  const stopPresentation = () => {
    skipPresentationRef.current = true;
    candyDropBarrierRef.current?.resolve();
    setAutoRemaining(0);
  };

  const animateResult = async (
    result: SekerhaneSpinResult,
    settledPhase: "idle" | "bonus-playing",
  ) => {
    skipPresentationRef.current = false;
    const nextCandyId = () => `candy-${++candySerialRef.current}`;
    const initialIdentity = createCascadeIdentity(7, 7, nextCandyId);
    let activeCandyIds = initialIdentity.ids;
    let runningWin = 0;
    const initialFallRows = createInitialFallRows(7, 7, 8);
    let dropCompletion = beginCandyDropBarrier(activeCandyIds, initialFallRows);
    setGrid(result.initialGrid);
    setSpots(result.initialSpots);
    setWinningCells(new Set());
    setReceipt([]);
    setCascadeWin(0);
    setSpinWin(0);
    setCandyIds(activeCandyIds);
    setEnteringCandyIds(initialIdentity.entering);
    setFallRows(initialFallRows);
    audioRef.current?.play("spin");

    const completed = await playCascadeTimeline(
      result.cascades,
      turbo,
      {
        isActive: () => mountedRef.current,
        shouldSkip: () => skipPresentationRef.current,
        onPhase: (nextPhase, cascade) => {
          setPhase(nextPhase);
          if (!cascade) return;
          if (nextPhase === "focus") {
            setGrid(cascade.grid);
            setEnteringCandyIds(new Set());
            setWinningCells(new Set(cascade.winningCells));
            setReceipt(cascade.clusters);
            setCascadeWin(cascade.payout);
            audioRef.current?.play("cascade", cascade.index);
          } else if (nextPhase === "bursting") {
            audioRef.current?.play(
              cascade.index > 0 ? "multiplier" : "win",
              cascade.index,
            );
          } else if (nextPhase === "cleared") {
            runningWin += cascade.payout;
            setSpinWin(runningWin);
            setSpots(cascade.nextSpots);
          } else if (nextPhase === "falling") {
            const reconciled = reconcileCascadeIdentity(
              activeCandyIds,
              cascade.sourceRows,
              nextCandyId,
            );
            activeCandyIds = reconciled.ids;
            dropCompletion = skipPresentationRef.current
              ? Promise.resolve()
              : beginCandyDropBarrier(activeCandyIds, cascade.fallRows);
            setFallRows(cascade.fallRows);
            setGrid(cascade.nextGrid);
            setCandyIds(activeCandyIds);
            setEnteringCandyIds(reconciled.entering);
            setWinningCells(new Set());
          }
        },
        afterLanding: () =>
          skipPresentationRef.current ? Promise.resolve() : dropCompletion,
        afterFalling: () =>
          skipPresentationRef.current ? Promise.resolve() : dropCompletion,
      },
      {
        normal: {
          landing: 950,
          focus: 700,
          bursting: 700,
          cleared: 1550,
          falling: 1000,
        },
        turbo: {
          landing: 120,
          focus: 70,
          bursting: 80,
          cleared: 120,
          falling: 120,
        },
      },
    );
    if (!completed) return;
    setPhase(settledPhase);
    setGrid(result.finalGrid);
    setSpots(result.finalSpots);
    setWinningCells(new Set());
    setFallRows(createNumberGrid(7, 7));
    setEnteringCandyIds(new Set());
    setLastResult(result);
    setLastPayout(result.grossReturn);
    setSpinWin(result.grossReturn);
    setCascadeWin(0);
    setReceipt([]);
  };

  const writeRound = (
    roundId: string,
    startedAt: string,
    stake: number,
    grossPayout: number,
    balanceBefore: number,
    result: SekerhaneSpinResult,
    modifiers: Record<string, unknown>,
    ledger = true,
  ) => {
    const settledAt = new Date().toISOString();
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "sekerhane-1024",
      variant: "Şekerhane 1024 · 7×7 Küme ve Kalıcı Hücre Çarpanları",
      source: "player",
      playerParticipated: true,
      startedAt,
      settledAt,
      stake,
      grossPayout,
      net: grossPayout - stake,
      outcome:
        grossPayout > stake ? "win" : grossPayout < stake ? "loss" : "push",
      balanceBefore,
      balanceAfter: balanceBefore - stake + grossPayout,
      result: {
        telemetryVersion: 1,
        rngModel: "crypto-weighted-cluster-v1",
        initialGrid: result.initialGrid,
        finalGrid: result.finalGrid,
        initialSpots: result.initialSpots,
        finalSpots: result.finalSpots,
        cascades: result.cascades,
        scatterCount: result.scatterCount,
        freeSpinsAwarded: result.freeSpinsAwarded,
        grossReturn: result.grossReturn,
        winMultiple: result.winMultiple,
        capped: result.capped,
      },
      modifiers,
    });
    if (ledger && stake)
      void recordWalletEntry({
        id: createRecordId("ledger-stake", roundId),
        roundId,
        game: "sekerhane-1024",
        occurredAt: startedAt,
        type: "stake",
        amount: -stake,
        balanceBefore,
        balanceAfter: balanceBefore - stake,
        note: "Şekerhane 1024 bahis",
      });
    if (ledger && grossPayout)
      void recordWalletEntry({
        id: createRecordId("ledger-payout", roundId),
        roundId,
        game: "sekerhane-1024",
        occurredAt: settledAt,
        type: "payout",
        amount: grossPayout,
        balanceBefore: balanceBefore - stake,
        balanceAfter: balanceBefore - stake + grossPayout,
        note: "Şekerhane 1024 ödeme",
      });
  };

  const spin = async (fromAuto = false) => {
    if (busy || bonus || balance < wager) return;
    if (fromAuto) setAutoRemaining((value) => Math.max(0, value - 1));
    const startedAt = new Date().toISOString();
    const roundId = `sekerhane-${Date.now()}-${crypto.randomUUID()}`;
    const balanceBefore = balance;
    setBalance((value) => value - wager);
    setLastPayout(0);
    setBonusSummary(undefined);
    announce(narinEventLine("spin"), false);
    const flowStateBefore = flowStateRef.current;
    const flowDecision = planSlotFlow(
      flowStateBefore,
      slot.flow,
      slot.potential,
    );
    const result = runSekerhaneSpin(wager, undefined, {
      profile,
      flow: flowDecision,
      potential: slot.potential,
    });
    flowStateRef.current = settleSlotFlow(
      flowStateBefore,
      flowDecision,
      {
        grossMultiple: result.winMultiple,
        bonusTriggered: result.freeSpinsAwarded > 0,
        eventOccurred:
          result.cascades.length > 0 ||
          result.freeSpinsAwarded > 0 ||
          Boolean(result.potentialCells?.length),
      },
      slot.flow,
    );
    await animateResult(result, "idle");
    if (!mountedRef.current) return;
    if (result.grossReturn) setBalance((value) => value + result.grossReturn);
    setSessionNet((value) => value + result.grossReturn - wager);
    setSpins((value) => value + 1);
    writeRound(
      roundId,
      startedAt,
      wager,
      result.grossReturn,
      balanceBefore,
      result,
      {
        source: "paid-spin",
        auto: fromAuto,
        turbo,
        flow: slotFlowTelemetry(flowStateBefore, flowDecision),
        potentialCells: result.potentialCells,
      },
    );
    const discoveries = [
      ...new Set(
        result.finalSpots
          .flat()
          .map((spot) => spot.multiplier)
          .filter(Boolean),
      ),
    ];
    recordSlotProgress(
      "sekerhane-1024",
      {
        win: result.grossReturn > 0,
        bonus: result.freeSpinsAwarded > 0,
        specialCount: discoveries.length,
        discoveries,
      },
      slot.progression,
    );
    if (result.freeSpinsAwarded) {
      const session: BonusSession = {
        id: `sekerhane-bonus-${Date.now()}-${crypto.randomUUID()}`,
        source: "natural",
        referenceBet: wager,
        purchaseCost: 0,
        balanceBefore: balanceBefore - wager + result.grossReturn,
        remaining: result.freeSpinsAwarded,
        totalSpins: result.freeSpinsAwarded,
        totalPayout: 0,
        spots: emptySekerhaneSpots(),
      };
      audioRef.current?.play("scatter");
      setBonus(session);
      setSpots(session.spots);
      setSpinWin(0);
      setPhase("bonus-ready");
      void setCasinoMeta(BONUS_META_KEY, session);
      announce(
        narinEventLine("bonusReady", { freeSpins: result.freeSpinsAwarded }),
      );
    } else {
      setPhase("idle");
      const kind =
        result.grossReturn >= wager * 15
          ? "bigWin"
          : result.grossReturn
            ? "win"
            : "loss";
      if (settings.features.winTheatre && result.grossReturn >= wager * 15) {
        const multiple = result.grossReturn / Math.max(1, wager);
        setWinTheatre({
          amount: result.grossReturn,
          multiple,
          title:
            multiple >= 100
              ? "EFSANEVİ KAZANÇ"
              : multiple >= 50
                ? "SÜPER KAZANÇ"
                : "BÜYÜK KAZANÇ",
        });
      }
      announce(narinEventLine(kind, { lastPayout: result.grossReturn }));
    }
  };

  useEffect(() => {
    if (!autoRemaining || busy || bonus) return;
    if (balance < wager) {
      setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(
      () => {
        void spin(true);
      },
      turbo ? 35 : 520,
    );
    return () => window.clearTimeout(timer);
    // spin intentionally reads the newest rendered state for each scheduled round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRemaining, busy, bonus, balance, wager, turbo]);

  const confirmBonusBuy = () => {
    if (!buyChoice || busy || bonus) return;
    const multiplier = buyChoice === "super" ? superBonusBuyX : mathBonusBuyX;
    const cost = wager * multiplier;
    if (balance < cost) return;
    const startedAt = new Date().toISOString();
    const id = `sekerhane-buy-${Date.now()}-${crypto.randomUUID()}`;
    const balanceBefore = balance;
    setBalance((value) => value - cost);
    void recordWalletEntry({
      id: createRecordId("ledger-stake", id),
      roundId: id,
      game: "sekerhane-1024",
      occurredAt: startedAt,
      type: "stake",
      amount: -cost,
      balanceBefore,
      balanceAfter: balanceBefore - cost,
      note:
        buyChoice === "super"
          ? "Şekerhane Süper Tarif satın alma"
          : "Şekerhane Gece Tarifi satın alma",
    });
    const session: BonusSession = {
      id,
      source: buyChoice === "super" ? "super-buy" : "normal-buy",
      referenceBet: wager,
      purchaseCost: cost,
      balanceBefore,
      remaining: bonusBuySpins,
      totalSpins: bonusBuySpins,
      totalPayout: 0,
      spots:
        buyChoice === "super" ? superSekerhaneSpots() : emptySekerhaneSpots(),
    };
    audioRef.current?.play("scatter");
    setBuyChoice(undefined);
    setBonus(session);
    setSpots(session.spots);
    setSpinWin(0);
    setPhase("bonus-ready");
    setAutoRemaining(0);
    setLastPayout(0);
    void setCasinoMeta(BONUS_META_KEY, session);
    void recordGameEvent({
      id: createRecordId("event-sekerhane-buy", id),
      roundId: id,
      game: "sekerhane-1024",
      occurredAt: startedAt,
      type: "bonus-purchased",
      payload: {
        source: session.source,
        referenceBet: wager,
        purchaseCost: cost,
        initialSpins: bonusBuySpins,
        allCellsStartAt2x: buyChoice === "super",
      },
    });
    announce(narinEventLine("bonusReady", { freeSpins: bonusBuySpins }));
  };

  const runBonus = async () => {
    if (!bonus || bonusRunningRef.current) return;
    bonusRunningRef.current = true;
    setPhase("bonus-playing");
    announce(narinEventLine("bonusStart"));
    let session = {
      ...bonus,
      spots: bonus.spots.map((row) => row.map((spot) => ({ ...spot }))),
    };
    let lastBonusResult: SekerhaneSpinResult | undefined;
    while (session.remaining > 0 && mountedRef.current) {
      const flowStateBefore = flowStateRef.current;
      const flowDecision = planSlotFlow(
        flowStateBefore,
        slot.flow,
        slot.potential,
        { bonusMode: true, lastBonusSpin: session.remaining === 1 },
      );
      const result = runSekerhaneSpin(session.referenceBet, undefined, {
        bonusMode: true,
        superBonus: session.source === "super-buy",
        purchaseMode:
          session.source === "normal-buy"
            ? "normal"
            : session.source === "super-buy"
              ? "super"
              : undefined,
        spots: session.spots,
        profile,
        flow: flowDecision,
        potential: slot.potential,
      });
      flowStateRef.current = settleSlotFlow(
        flowStateBefore,
        flowDecision,
        {
          grossMultiple: session.referenceBet
            ? result.grossReturn / session.referenceBet
            : 0,
          bonusTriggered: result.freeSpinsAwarded > 0,
          eventOccurred:
            result.cascades.length > 0 || result.freeSpinsAwarded > 0,
        },
        slot.flow,
      );
      lastBonusResult = result;
      await animateResult(result, "bonus-playing");
      if (!mountedRef.current) break;
      const retrigger = result.freeSpinsAwarded;
      session = {
        ...session,
        remaining: session.remaining - 1 + retrigger,
        totalSpins: session.totalSpins + retrigger,
        totalPayout: session.totalPayout + result.grossReturn,
        spots: result.finalSpots,
      };
      setBonus(session);
      setLastPayout(result.grossReturn);
      setSpinWin(0);
      setSpots(session.spots);
      void setCasinoMeta(BONUS_META_KEY, session);
      if (retrigger) {
        setRetriggerNotice({
          awarded: retrigger,
          remaining: session.remaining,
        });
        audioRef.current?.play("scatter");
        announce(narinEventLine("retrigger", { freeSpins: retrigger }), true);
        await waitForPresentation(
          turbo ? 720 : 2600,
          () => skipPresentationRef.current,
        );
        if (!mountedRef.current) break;
        setRetriggerNotice(undefined);
      }
      await waitForPresentation(
        turbo ? 35 : 800,
        () => skipPresentationRef.current,
      );
    }
    if (!mountedRef.current || !lastBonusResult) {
      bonusRunningRef.current = false;
      return;
    }
    setBalance((value) => value + session.totalPayout);
    setSessionNet(
      (value) => value + session.totalPayout - session.purchaseCost,
    );
    setBonusSummary({
      payout: session.totalPayout,
      referenceBet: session.referenceBet,
      totalSpins: session.totalSpins,
      hottestSpot: highestSpot(session.spots),
      activeSpots: session.spots.flat().filter((spot) => spot.hits > 0).length,
      source: session.source,
    });
    setLastPayout(session.totalPayout);
    setPhase("bonus-summary");
    const startedAt = new Date(
      Date.now() - Math.max(1, session.totalSpins) * 1000,
    ).toISOString();
    writeRound(
      session.id,
      startedAt,
      session.purchaseCost,
      session.totalPayout,
      session.balanceBefore,
      lastBonusResult,
      {
        source:
          session.source === "natural" ? "free-spin-session" : "bonus-buy",
        purchaseMultiplier: session.purchaseCost
          ? session.purchaseCost / session.referenceBet
          : 0,
        referenceBet: session.referenceBet,
        totalFreeSpins: session.totalSpins,
        initialFreeSpins:
          session.source === "natural" ? session.totalSpins : bonusBuySpins,
        persistentSpots: session.spots,
        bonusSessionId: session.id,
      },
      session.purchaseCost === 0,
    );
    if (session.purchaseCost && session.totalPayout)
      void recordWalletEntry({
        id: createRecordId("ledger-payout", session.id),
        roundId: session.id,
        game: "sekerhane-1024",
        occurredAt: new Date().toISOString(),
        type: "payout",
        amount: session.totalPayout,
        balanceBefore: session.balanceBefore - session.purchaseCost,
        balanceAfter:
          session.balanceBefore - session.purchaseCost + session.totalPayout,
        note: "Şekerhane bonus satın alma ödemesi",
      });
    recordSlotProgress(
      "sekerhane-1024",
      {
        win: session.totalPayout > 0,
        bonus: true,
        specialCount: session.spots.flat().filter((spot) => spot.multiplier)
          .length,
        discoveries: [
          ...new Set(
            session.spots
              .flat()
              .map((spot) => spot.multiplier)
              .filter(Boolean),
          ),
        ],
      },
      slot.progression,
    );
    announce(narinEventLine("bonusEnd", { lastPayout: session.totalPayout }));
    setBonus(undefined);
    void setCasinoMeta(BONUS_META_KEY, null);
    bonusRunningRef.current = false;
  };

  const closeSummary = () => {
    setBonusSummary(undefined);
    setSpots(emptySekerhaneSpots());
    setPhase("idle");
  };
  const changeWager = (next: number) => {
    if (busy || bonus) return;
    const max = maximumAffordableWager(balance, 1, 5);
    setWager(
      Math.min(
        max,
        Math.ceil(normalizeWagerInput(next, settings.minBet) / 5) * 5,
      ),
    );
  };

  const sendChat = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    setDraft("");
    setThinking(true);
    const next = [
      ...chat,
      { speaker: "Sen" as const, text: prompt, moment: now() },
    ];
    setChat(next.slice(-10));
    void recordAIConversation({
      id: createRecordId("ai-sekerhane-user", sessionIdRef.current),
      sessionId: sessionIdRef.current,
      game: "sekerhane-1024",
      character: "Narin",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: { wager, balance, phase },
    });
    const answer = await askNarin(prompt, {
      balance,
      wager,
      lastPayout,
      cascades: lastResult?.cascades.length ?? 0,
      freeSpins: bonus?.remaining ?? 0,
      highestSpot: highestSpot(spots),
      recentMessages: next
        .slice(-6)
        .map((item) => `${item.speaker}: ${item.text}`),
    });
    if (mountedRef.current) {
      setThinking(false);
      announce(answer, true, "assistant");
    }
  };

  const activeSpotCount = spots.flat().filter((spot) => spot.multiplier).length;
  const hottestSpot = highestSpot(spots);
  const showCascadeCalculation = receipt.length > 0 && phase === "cleared";
  const bigCascade = cascadeWin >= wager * 15;
  const cascadePhaseActive =
    phase === "landing" ||
    phase === "focus" ||
    phase === "bursting" ||
    phase === "cleared" ||
    phase === "falling";
  const visibleWin = bonus
    ? bonus.totalPayout + (cascadePhaseActive ? spinWin : 0)
    : spinWin;
  const statusText =
    phase === "idle"
      ? "En az 5 komşu şeker bir küme kurar."
      : phase === "landing"
        ? "Yeni tepsi yukarıdan doluyor…"
        : phase === "focus"
          ? "Kazanan şekerler kilitlendi."
          : phase === "bursting"
            ? "Şekerler patlıyor."
            : phase === "cleared"
              ? "Çarpanlar paketlerden merkeze toplanıyor."
              : phase === "falling"
                ? "Yeni şekerler boşluklara iniyor."
                : phase === "bonus-ready"
                  ? "Tarif hazır; sen başlat."
                  : phase === "bonus-playing"
                    ? "Bonus kasası spinler boyunca birikiyor."
                    : "Bonus tamamlandı.";

  return (
    <main
      className={`sekerhane-room phase-${phase} ${turbo ? "is-turbo" : ""} ${bonus ? (bonus.source === "super-buy" ? "bonus-mode bonus-super" : "bonus-mode bonus-free") : ""}`}
    >
      <header className="sekerhane-topbar">
        <button
          className="sekerhane-back"
          onClick={() => {
            setTurbo(false);
            onBack();
          }}
          disabled={phase === "bonus-playing"}
        >
          ← <span>Slot Dünyası</span>
        </button>
        <div className="sekerhane-brand">
          <i aria-hidden="true">✦</i>
          <span>
            ŞEKERHANE <b>1024</b>
            <small>GECE VARDİYASI</small>
          </span>
        </div>
        <div className="sekerhane-top-actions">
          <GameMusicControls game="sekerhane-1024" />
          <button
            className={effectsEnabled ? "active" : ""}
            onClick={() => setEffectsEnabled((value) => !value)}
          >
            ♪ <span>{effectsEnabled ? "FX AÇIK" : "FX KAPALI"}</span>
          </button>
          <button
            className={voiceEnabled ? "active" : ""}
            onClick={() => setVoiceEnabled((value) => !value)}
          >
            ● <span>NARİN SESİ</span>
          </button>
          <div className="sekerhane-balance">
            ✦ {money.format(balance)} <small>PR</small>
          </div>
        </div>
      </header>

      <section className="sekerhane-stage">
        <aside className="narin-host">
          <img
            src="/assets/sekerhane/narin-host-v1.png"
            alt="Şekerhane sunucusu Narin"
          />
          <div>
            <small>GECE USTASI</small>
            <strong>NARİN</strong>
            <p>
              {
                chat.filter((message) => message.speaker === "Narin").at(-1)
                  ?.text
              }
            </p>
          </div>
          <form onSubmit={sendChat}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Narin'e sor…"
              disabled={thinking}
            />
            <button aria-label="Gönder">↑</button>
          </form>
        </aside>

        <section className="sekerhane-machine">
          <div className="sekerhane-machine-head">
            <div>
              <small>7×7 KÜME OYUNU</small>
              <strong>
                {bonus
                  ? bonus.source === "super-buy"
                    ? "SÜPER TARİF"
                    : "GECE TARİFİ"
                  : "VİTRİN AÇIK"}
              </strong>
            </div>
            {bonus && (
              <div className="bonus-counter">
                <span>KALAN</span>
                <b>{bonus.remaining}</b>
                <small>/ {bonus.totalSpins}</small>
              </div>
            )}
            <button onClick={() => setRulesOpen(true)}>
              i <span>NASIL OYNANIR?</span>
            </button>
          </div>
          <div className="sekerhane-grid-wrap">
            <div className="sekerhane-glass-star" aria-hidden="true" />
            <div className="sekerhane-grid-stack">
              <div
                className="sekerhane-grid sekerhane-underlay-grid"
                aria-hidden="true"
              >
                {spots.flatMap((row, rowIndex) =>
                  row.map((spot, columnIndex) => {
                    const positionKey = `${rowIndex}-${columnIndex}`;
                    return (
                      <div
                        className={`sekerhane-cell ${winningCells.has(positionKey) ? "is-winning" : ""} ${spot.hits ? "is-marked" : ""} ${spot.multiplier ? "has-multiplier" : ""}`}
                        key={positionKey}
                        data-position={positionKey}
                        style={
                          {
                            "--spot-level": Math.min(
                              1,
                              Math.log2(Math.max(2, spot.multiplier || 2)) / 10,
                            ),
                          } as CSSProperties
                        }
                      >
                        <span className="cell-underlay">
                          <span className="sugar-glaze" />
                          {spot.hits > 0 && (
                            <span
                              className={`spot-wrapper ${spot.multiplier ? "is-active" : "is-primed"}`}
                            >
                              {spot.multiplier > 0 && (
                                <span
                                  className={
                                    spot.multiplier >= 128 ? "is-long" : ""
                                  }
                                >
                                  {spot.multiplier}X
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  }),
                )}
              </div>
              <div
                className="sekerhane-grid sekerhane-candy-grid"
                role="grid"
                aria-label="Şekerhane 7 çarpı 7 oyun alanı"
              >
                {grid.flatMap((row, rowIndex) =>
                  row.map((symbol, columnIndex) => {
                    const positionKey = `${rowIndex}-${columnIndex}`;
                    const candyId = candyIds[rowIndex][columnIndex];
                    const fallDistance = fallRows[rowIndex]?.[columnIndex] ?? 0;
                    const isEntering = enteringCandyIds.has(candyId);
                    const isCascadeRefill =
                      phase === "falling" && fallDistance > 0;
                    const isFalling = phase === "landing" || isCascadeRefill;
                    return (
                      <div
                        className={`sekerhane-candy-cell cascade-cell family-${SEKERHANE_SYMBOLS[symbol].family} ${winningCells.has(positionKey) ? "is-winning" : ""} ${isFalling ? "cascade-falling" : ""} ${isEntering ? "cascade-entering is-fresh-candy" : "cascade-survivor"}`}
                        role="gridcell"
                        aria-label={SEKERHANE_SYMBOLS[symbol].label}
                        key={candyId}
                        data-candy-id={candyId}
                        data-position={positionKey}
                        onAnimationEnd={(event) =>
                          finishCandyDrop(event, candyId)
                        }
                        style={
                          {
                            "--cascade-distance": cascadeGridDistance(
                              fallDistance,
                              "var(--sekerhane-grid-gap)",
                            ),
                            "--cascade-delay": `${sekerhaneCascadeDelay(rowIndex, columnIndex, isEntering, turbo)}ms`,
                            "--cascade-duration": turbo ? ".085s" : ".82s",
                          } as CSSProperties
                        }
                      >
                        <CandyGlyph symbol={symbol} />
                        {winningCells.has(positionKey) && (
                          <span className="candy-crackle" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                            <i />
                          </span>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
              <div
                className={`cascade-math-show ${showCascadeCalculation ? "visible" : ""} ${bigCascade ? "is-big" : "is-small"}`}
                aria-live="polite"
              >
                <span className="seker-coin-burst" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <small>
                  {receipt.length > 1
                    ? `${receipt.length} KÜME ÖDEMESİ`
                    : receipt[0]
                      ? `${SEKERHANE_SYMBOLS[receipt[0].symbol].label} ÖDEMESİ`
                      : "KAZANÇ"}
                </small>
                <div className="multiplier-streams" aria-hidden="true">
                  {receipt.flatMap((cluster, clusterIndex) =>
                    cluster.spotMultiplierSources.map((source, sourceIndex) => (
                      <span
                        className="source-multiplier"
                        key={`${clusterIndex}-${source.row}-${source.column}`}
                        style={
                          {
                            left: `${((source.column + 0.5) / 7) * 100}%`,
                            top: `${((source.row + 0.5) / 7) * 100}%`,
                            "--source-delay": `${clusterIndex * 90 + sourceIndex * 34}ms`,
                            "--target-y": `${50 + (clusterIndex - (receipt.length - 1) / 2) * 19}%`,
                          } as CSSProperties
                        }
                      >
                        {source.multiplier}X
                      </span>
                    )),
                  )}
                </div>
                <div className="cluster-impacts">
                  {receipt.map((cluster, index) => {
                    const baseWin = Math.max(
                      0,
                      Math.round(
                        (wager * cluster.payoutX) /
                          Math.max(1, cluster.spotMultiplier),
                      ),
                    );
                    const multipliedWin = Math.max(
                      0,
                      Math.round(wager * cluster.payoutX),
                    );
                    return (
                      <div
                        className="cluster-impact"
                        key={`${cluster.symbol}-${index}`}
                        style={
                          {
                            "--impact-delay": `${index * 110}ms`,
                          } as CSSProperties
                        }
                      >
                        <span className="impact-base">
                          {money.format(baseWin)} <em>PR</em>
                        </span>
                        <b className="impact-multiplier">
                          {cluster.spotMultiplier}X
                        </b>
                        <i className="impact-flash" aria-hidden="true" />
                        <strong className="impact-win">
                          {money.format(multipliedWin)} <em>PR</em>
                        </strong>
                        <small>
                          {SEKERHANE_SYMBOLS[cluster.symbol].shortLabel} ·{" "}
                          {cluster.cells.length} ŞEKER
                        </small>
                      </div>
                    );
                  })}
                </div>
                <footer>
                  <span>BU PATLAMA</span>
                  <strong>
                    {money.format(cascadeWin)} <em>PR</em>
                  </strong>
                </footer>
              </div>
            </div>
          </div>
          <div
            className={`sekerhane-result-strip ${bonus ? "is-bonus" : ""}`}
            aria-live="polite"
          >
            <p>{statusText}</p>
            <span>
              <small>
                {bonus
                  ? "TOPLAM FREE SPİN KAZANCI"
                  : cascadePhaseActive
                    ? "BU SPİN BİRİKİYOR"
                    : "SON SPİN KAZANCI"}
              </small>
              <strong>
                {money.format(visibleWin)} <em>PR</em>
              </strong>
            </span>
            <b>
              {activeSpotCount} sıcak hücre · en yüksek {hottestSpot || "—"}X
            </b>
          </div>
        </section>

        <aside className="sekerhane-session">
          <header>
            <small>BU OTURUM</small>
            <strong>
              {sessionNet >= 0 ? "+" : "−"}
              {money.format(Math.abs(sessionNet))} PR
            </strong>
          </header>
          <div>
            <span>
              SPİN<b>{spins}</b>
            </span>
            <span>
              SON ÖDEME<b>{money.format(lastPayout)}</b>
            </span>
            <span>
              PATLAMA<b>{lastResult?.cascades.length ?? 0}</b>
            </span>
          </div>
          <SlotProgressPanel
            game="sekerhane-1024"
            settings={slot.progression}
            collectionEnabled={settings.features.recipeBook}
          />
          <section>
            <small>ATEŞ HARİTASI</small>
            <p>
              İlk kırılış hücreyi şekerler. İkinci kırılış 2×, sonra 4×…1024×.
            </p>
            <div className="heat-legend">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </section>
        </aside>
      </section>

      <footer className="sekerhane-controls">
        <div className="sekerhane-wager">
          <small>BAHİS</small>
          <button
            onClick={() => changeWager(wager - betStep)}
            disabled={busy || !!bonus}
          >
            −
          </button>
          <label>
            <input
              value={wager}
              inputMode="numeric"
              onChange={(event) =>
                changeWager(Number(event.target.value.replace(/\D/g, "")))
              }
            />
            <span>PR</span>
          </label>
          <button
            onClick={() => changeWager(wager + betStep)}
            disabled={busy || !!bonus}
          >
            +
          </button>
          <select
            value={betStep}
            onChange={(event) => setBetStep(Number(event.target.value))}
          >
            {CASINO_BET_STEPS.map((step) => (
              <option value={step} key={step}>
                ± {compactWager(step)}
              </option>
            ))}
          </select>
          <button
            onClick={() => changeWager(maximumAffordableWager(balance, 1, 5))}
            disabled={busy || !!bonus}
          >
            MAX
          </button>
        </div>
        <div className="sekerhane-buys">
          <button
            onClick={() => setBuyChoice("normal")}
            disabled={busy || !!bonus || balance < normalBonusCost}
          >
            <span>GECE TARİFİ</span>
            <b>{compactWager(normalBonusCost)} PR</b>
            <small>{bonusBuySpins} FREE SPİN</small>
          </button>
          <button
            className="super"
            onClick={() => setBuyChoice("super")}
            disabled={busy || !!bonus || balance < superBonusCost}
          >
            <span>SÜPER TARİF</span>
            <b>{compactWager(superBonusCost)} PR</b>
            <small>{bonusBuySpins} FREE SPİN</small>
          </button>
        </div>
        <button
          className={`sekerhane-spin ${busy ? "is-stop" : ""}`}
          onClick={() => (busy ? stopPresentation() : void spin(false))}
          disabled={!busy && (!!bonus || balance < wager)}
        >
          <i>{busy ? "■" : "✦"}</i>
          <span>{busy ? "DUR" : "TEPSİYİ ÇEVİR"}</span>
          <small>
            {busy ? "ANİMASYONU BİTİR" : `${money.format(wager)} PR`}
          </small>
        </button>
        <div className="sekerhane-modes">
          <button
            className={turbo ? "active" : ""}
            onClick={() => setTurbo((value) => !value)}
            disabled={!settings.features.turbo}
            aria-pressed={turbo}
          >
            ⚡<span>TURBO</span>
          </button>
          <label>
            <select
              value={autoCount}
              onChange={(event) => setAutoCount(Number(event.target.value))}
            >
              <option>10</option>
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
            <button
              className={autoRemaining ? "active" : ""}
              onClick={() =>
                setAutoRemaining((value) => (value ? 0 : autoCount))
              }
              disabled={!settings.autoplay || busy || !!bonus}
            >
              {autoRemaining ? `DUR ${autoRemaining}` : "AUTO"}
            </button>
          </label>
        </div>
      </footer>

      {phase === "bonus-ready" && bonus && (
        <div className="sekerhane-overlay result-overlay bonus-entry-overlay">
          <section
            className={`sekerhane-result-card bonus-intro bonus-entry-card ${bonus.source === "super-buy" ? "super" : ""}`}
          >
            <span className="result-stars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <small>
              {bonus.source === "super-buy"
                ? "ALTIN TEPSİLER UYANDI"
                : "NARİN MÜHÜRLERİ TAMAMLANDI"}
            </small>
            <div className="bonus-entry-scatters" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <img
                  key={index}
                  src="/assets/slots/sekerhane-1024/narin-scatter-v1.png"
                  alt=""
                />
              ))}
            </div>
            <h2 className="bonus-entry-title">
              <span>FREE SPİN’E</span>
              <b>GİRDİN!</b>
            </h2>
            <div className="result-payout bonus-spin-award">
              <strong>+{bonus.remaining}</strong>
              <span>FREE SPİN</span>
            </div>
            <div className="result-stats intro-stats">
              <span>
                <b>{bonus.source === "super-buy" ? "49" : "1."}</b>
                {bonus.source === "super-buy" ? "HÜCRE 2X" : "PATLAMA İZ"}
              </span>
              <span>
                <b>1024X</b>ÇARPAN ZİRVESİ
              </span>
              <span>
                <b>{money.format(slot.math.maxWinX)}X</b>MAKSİMUM
              </span>
            </div>
            <p>
              {bonus.source === "super-buy"
                ? "Bütün hücreler 2X paketle başlar; her yeni kırılış paketi ikiye katlar."
                : "Paketler spinler arasında kalır; aynı hücre yeniden kırıldıkça 2X, 4X, 8X diye büyür."}
            </p>
            <button onClick={() => void runBonus()}>
              GECE VARDİYASINI BAŞLAT <span>→</span>
            </button>
          </section>
        </div>
      )}
      {retriggerNotice &&
        createPortal(
          <div
            className="sekerhane-retrigger-layer"
            role="status"
            aria-live="assertive"
            aria-label={`Free spin ${retriggerNotice.awarded} tur uzatıldı`}
          >
            <section className="sekerhane-retrigger-card">
              <span className="retrigger-rays" aria-hidden="true" />
              <span className="result-stars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <small>TARİF YENİDEN TETİKLENDİ</small>
              <div className="retrigger-owls" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <img
                    key={index}
                    src="/assets/slots/sekerhane-1024/narin-scatter-v1.png"
                    alt=""
                  />
                ))}
              </div>
              <strong>+{retriggerNotice.awarded}</strong>
              <h2>FREE SPİN</h2>
              <p>
                Gece vardiyası uzadı · toplam <b>{retriggerNotice.remaining}</b>{" "}
                spin kaldı
              </p>
            </section>
          </div>,
          document.body,
        )}
      {phase === "bonus-summary" &&
        bonusSummary &&
        createPortal(
          <div className="sekerhane-overlay result-overlay">
            <section
              className={`sekerhane-result-card bonus-summary ${bonusSummary.source === "super-buy" ? "super" : ""}`}
            >
              <span className="result-stars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <img
                className="result-owl result-owl-summary"
                src="/assets/slots/sekerhane-1024/narin-scatter-v1.png"
                alt=""
              />
              <small>GECE VARDİYASI TAMAMLANDI</small>
              <h2>
                {bonusSummary.payout > 0 ? "Şeker Yağmuru!" : "Tepsi Kapandı"}
              </h2>
              <div className="result-payout result-payout-win">
                <strong>{money.format(bonusSummary.payout)}</strong>
                <span>PR KAZANÇ</span>
              </div>
              <div className="result-stats">
                <span>
                  <b>{bonusSummary.totalSpins}</b>TOPLAM SPİN
                </span>
                <span>
                  <b>
                    {bonusSummary.hottestSpot
                      ? `${bonusSummary.hottestSpot}X`
                      : "—"}
                  </b>
                  EN SICAK PAKET
                </span>
                <span>
                  <b>
                    {(
                      bonusSummary.payout /
                      Math.max(1, bonusSummary.referenceBet)
                    ).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                    X
                  </b>
                  BAHİS ÖDEMESİ
                </span>
              </div>
              <p>
                {bonusSummary.activeSpots} hücre paketlendi. Toplam ödeme
                bakiyene işlendi.
              </p>
              <button onClick={closeSummary}>
                KAZANCI AL VE DÖN <span>→</span>
              </button>
            </section>
          </div>,
          document.body,
        )}
      {winTheatre &&
        createPortal(
          <div className="sekerhane-overlay result-overlay win-theatre-overlay">
            <section className="sekerhane-result-card big-win-theatre">
              <span className="result-stars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="theatre-coin-rain" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <img
                className="result-owl result-owl-summary"
                src="/assets/slots/sekerhane-1024/narin-scatter-v1.png"
                alt=""
              />
              <small>{winTheatre.title}</small>
              <h2>Tepsi Taştı!</h2>
              <div className="result-payout result-payout-win">
                <strong>{money.format(winTheatre.amount)}</strong>
                <span>PR KAZANÇ</span>
              </div>
              <div className="theatre-multiple">
                {winTheatre.multiple.toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })}
                X <span>BAHİS ÖDEMESİ</span>
              </div>
              <p>
                Kazanç bakiyene işlendi. Otomatik oyun bu ekran kapanana kadar
                bekler.
              </p>
              <button onClick={() => setWinTheatre(undefined)}>
                KAZANCI AL VE DEVAM ET <span>→</span>
              </button>
            </section>
          </div>,
          document.body,
        )}
      {buyChoice && (
        <div
          className="sekerhane-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBuyChoice(undefined);
          }}
        >
          <section
            className={`buy-confirm ${buyChoice === "super" ? "super" : ""}`}
          >
            <button className="close" onClick={() => setBuyChoice(undefined)}>
              ×
            </button>
            <small>
              {buyChoice === "super" ? "SÜPER TARİF" : "GECE TARİFİ"}
            </small>
            <h2>
              {money.format(
                wager *
                  (buyChoice === "super" ? superBonusBuyX : mathBonusBuyX),
              )}{" "}
              PR
            </h2>
            <p>
              {buyChoice === "super"
                ? `${bonusBuySpins} ücretsiz spin; bütün hücreler 2× başlar.`
                : `${bonusBuySpins} ücretsiz spin; hücre haritası boş başlar ve oturum boyunca korunur.`}
            </p>
            <button onClick={confirmBonusBuy}>SATIN AL VE HAZIRLA</button>
          </section>
        </div>
      )}
      {rulesOpen && (
        <div
          className="sekerhane-overlay rules"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="sekerhane-rules">
            <button className="close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>ŞEKERHANE 1024</small>
            <h2>Tarif defteri</h2>
            <p>
              Yatay veya dikey bağlı en az 5 aynı şeker ödeme yapar ve kırılır.
              Yeni şekerler yukarıdan düşer; yeni küme varsa zincir sürer.
            </p>
            <div className="rule-cards">
              <article>
                <b>1</b>
                <strong>İZ</strong>
                <span>Bir hücre ilk kez kazanırsa şekerlenir.</span>
              </article>
              <article>
                <b>2×</b>
                <strong>ATEŞ</strong>
                <span>İkinci kazanışta 2× açılır.</span>
              </article>
              <article>
                <b>1024×</b>
                <strong>ZİRVE</strong>
                <span>Sonraki kazanışlar çarpanı ikiye katlar.</span>
              </article>
            </div>
            <p>
              Aynı kümedeki aktif hücre çarpanları toplanır. 3/4/5/6/7 Narin
              mührü 10/12/15/20/30 ücretsiz spin verir. Gece Tarifi güncel
              bahisle {money.format(normalBonusCost)} PR, bütün hücreleri 2×
              başlatan Süper Tarif {money.format(superBonusCost)} PR tutar.
              En yüksek ödeme {money.format(slot.math.maxWinX)}× bahistir.
            </p>
            <footer>
              Teorik RTP %{settings.targetRtp.toLocaleString("tr-TR")} · Çok
              yüksek volatilite · Yalnızca sanal PR
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
