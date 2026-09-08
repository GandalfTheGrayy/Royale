import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { askMira, miraEventLine } from "../../ai/mira";
import {
  createRecordId,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
} from "../../data/casino-database";
import {
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import { SlotAudio } from "./slot-audio";
import GameMusicControls from "../../audio/GameMusicControls";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { CASINO_BET_STEPS, compactWager } from "../wagering";
import SlotProgressPanel from "./SlotProgressPanel";
import { recordSlotProgress } from "./slot-progression";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
  slotFlowTelemetry,
} from "./slot-flow-engine";
import {
  cascadeCellDelay,
  createCascadeIdentity,
  createInitialFallRows,
  playCascadeTimeline,
  reconcileCascadeIdentity,
  waitForPresentation,
} from "./cascade-presentation";
import {
  createNeonGrid,
  emptyPowerGrid,
  NEON_MATH_PROFILE,
  NEON_SYMBOLS,
  powerSpriteIndex,
  runNeonSpin,
  type NeonSpinResult,
} from "./neon-engine";
import "./cascade-presentation.css";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onBack: () => void;
  aiOnline: boolean;
};

type Message = { speaker: "Mira" | "Sen"; text: string; moment: string };
type MotionPhase = "idle" | "dropping" | "bursting";
type PowerEvent = {
  values: number[];
  landed: number;
  multiplier: number;
  previousMultiplier: number;
  baseReturn: number;
  totalReturn: number;
  bonusMode: boolean;
  stage: "collecting" | "impact" | "counting";
};
type BonusSummary = {
  total: number;
  spins: number;
  multiplier: number;
  source: "won" | "bought";
};
const WIN_TIERS = [
  { minimum: 10, label: "BÜYÜK KAZANÇ", className: "buyuk" },
  { minimum: 25, label: "MUHTEŞEM KAZANÇ", className: "muhtesem" },
  { minimum: 100, label: "EFSANEVİ VURGUN", className: "efsanevi" },
  { minimum: 500, label: "AKILALMAZ KAZANÇ", className: "akilalmaz" },
  { minimum: 1000, label: "TARİHİ VURGUN", className: "tarihi" },
] as const;
type WinTier = (typeof WIN_TIERS)[number];
type WinCelebration = {
  amount: number;
  multiple: number;
  referenceBet: number;
  tier: WinTier;
};
type RetriggerEvent = { scatters: number; awarded: number; remaining: number };
type ClusterPayoutBurst = { id: number; row: number; column: number; amount: number };

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
const BET_STEPS = CASINO_BET_STEPS;

function winCelebrationFor(
  amount: number,
  referenceBet: number,
): WinCelebration | undefined {
  if (amount <= 0 || referenceBet <= 0) return undefined;
  const multiple = amount / referenceBet;
  const tier = [...WIN_TIERS]
    .reverse()
    .find((candidate) => multiple >= candidate.minimum);
  return tier ? { amount, multiple, referenceBet, tier } : undefined;
}

function speakMira(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith("tr") &&
        /emel|female|kadın/i.test(voice.name),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("tr")) ??
    null;
  utterance.lang = "tr-TR";
  utterance.rate = 1.02;
  utterance.pitch = 1.06;
  window.speechSynthesis.speak(utterance);
}

export default function NeonVault({
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
  const gameSettings = admin.games["neon-kasasi"];
  const slotTuning = gameSettings.slot!;
  const mathTuning = {
    ...slotTuning.math,
    valueWeights: slotTuning.valueWeights,
  };
  const initialLandingRef = useRef<ReturnType<typeof createNeonGrid> | null>(
    null,
  );
  if (!initialLandingRef.current)
    initialLandingRef.current = createNeonGrid(
      undefined,
      false,
      false,
      mathTuning,
    );
  const initialLanding = initialLandingRef.current;
  const cellSerial = useRef(49);
  const [wager, setWager] = useState(
    Math.max(gameSettings.minBet, gameSettings.defaultBet),
  );
  const [betStep, setBetStep] = useState(25);
  const [grid, setGrid] = useState(initialLanding.grid);
  const [powerGrid, setPowerGrid] = useState(initialLanding.powerGrid);
  const [cellIds, setCellIds] = useState(() =>
    Array.from({ length: 7 }, (_, row) =>
      Array.from({ length: 7 }, (_, column) => `cell-${row}-${column}`),
    ),
  );
  const [enteringCellIds, setEnteringCellIds] = useState<Set<string>>(
    new Set(),
  );
  const [fallRows, setFallRows] = useState(() => emptyPowerGrid());
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [activePowerCells, setActivePowerCells] = useState<Set<string>>(
    new Set(),
  );
  const [motionPhase, setMotionPhase] = useState<MotionPhase>("idle");
  const [powerEvent, setPowerEvent] = useState<PowerEvent>();
  const [clusterPayoutBursts, setClusterPayoutBursts] = useState<ClusterPayoutBurst[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [cascadeNo, setCascadeNo] = useState(0);
  const [cascadeWin, setCascadeWin] = useState(0);
  const [result, setResult] = useState<NeonSpinResult>();
  const [lastNet, setLastNet] = useState<number>();
  const [freeSpins, setFreeSpins] = useState(0);
  const [bonusMultiplier, setBonusMultiplier] = useState(0);
  const [bonusWin, setBonusWin] = useState(0);
  const bonusWinRef = useRef(0);
  const [bonusSpinsPlayed, setBonusSpinsPlayed] = useState(0);
  const bonusSpinsPlayedRef = useRef(0);
  const [bonusSummary, setBonusSummary] = useState<BonusSummary>();
  const [bonusSummaryDismissed, setBonusSummaryDismissed] = useState(false);
  const [winCelebration, setWinCelebration] = useState<WinCelebration>();
  const [celebrationAmount, setCelebrationAmount] = useState(0);
  const [retriggerEvent, setRetriggerEvent] = useState<RetriggerEvent>();
  const bonusSessionRef = useRef({ id: "", startedAt: "", balanceBefore: 0 });
  const flowStateRef = useRef(createSlotFlowState());
  const [bonusReady, setBonusReady] = useState(false);
  const [bonusSource, setBonusSource] = useState<"won" | "bought">("won");
  const [history, setHistory] = useState<
    Array<{ net: number; cascades: number; multiplier: number }>
  >([]);
  const [spins, setSpins] = useState(0);
  const [totalCascades, setTotalCascades] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [scatterBoost, setScatterBoost] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(
    gameSettings.sound && admin.general.masterSound,
  );
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "neon-kasasi",
    "ai-voice",
  );
  const [autoCount, setAutoCount] = useState(25);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [anticipationCue, setAnticipationCue] = useState("");
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Mira", text: miraEventLine("welcome"), moment: now() },
  ]);
  const audioRef = useRef<SlotAudio | null>(null);
  const activePresentationRef = useRef<NeonSpinResult | undefined>(undefined);
  const clusterBurstSerialRef = useRef(0);
  const skipPresentationRef = useRef(false);
  const cascadeCountFrameRef = useRef<number | undefined>(undefined);
  const cascadeCountResolveRef = useRef<(() => void) | undefined>(undefined);
  const miraAiSessionRef = useRef(
    `ai-neon-${Date.now()}-${crypto.randomUUID()}`,
  );

  const visibleMultiplier = Math.max(1, bonusMultiplier);
  const largestMultiplier = useMemo(
    () => Math.max(1, visibleMultiplier, ...powerGrid.flat()),
    [powerGrid, visibleMultiplier],
  );
  const sessionNet = history.reduce((sum, item) => sum + item.net, 0);
  const lastMiraLine = chat
    .filter((message) => message.speaker === "Mira")
    .at(-1)?.text;
  const bonusCost = wager * slotTuning.math.bonusBuyX;
  const bonusBuySpins = slotTuning.math.bonusBuySpins;
  const paidSpinCost =
    wager * (scatterBoost ? slotTuning.math.enhancedBetCostX : 1);

  useEffect(() => {
    const audio = new SlotAudio("neon-kasasi");
    audioRef.current = audio;
    return () => {
      audio.dispose();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (audioRef.current) audioRef.current.enabled = audioEnabled;
  }, [audioEnabled]);
  useEffect(() => {
    if (!winCelebration) {
      setCelebrationAmount(0);
      return;
    }
    const startedAt = performance.now();
    const duration = Math.min(
      4200,
      slotTuning.presentation.countUpMs + winCelebration.tier.minimum * 0.9,
    );
    let frame = 0;
    const count = (at: number) => {
      const progress = Math.min(1, (at - startedAt) / duration);
      setCelebrationAmount(
        winCelebration.amount * (1 - Math.pow(1 - progress, 3)),
      );
      if (progress < 1) frame = window.requestAnimationFrame(count);
    };
    frame = window.requestAnimationFrame(count);
    const dismiss = window.setTimeout(() => setWinCelebration(undefined), 5600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(dismiss);
    };
  }, [winCelebration]);
  useEffect(() => {
    if (!retriggerEvent) return;
    const dismiss = window.setTimeout(() => setRetriggerEvent(undefined), 3600);
    return () => window.clearTimeout(dismiss);
  }, [retriggerEvent]);

  const announce = (
    text: string,
    useVoice = true,
    aiKind: "assistant" | "system-event" = "system-event",
    latencyMs?: number,
  ) => {
    setChat((messages) => [
      ...messages,
      { speaker: "Mira", text, moment: now() },
    ]);
    void recordAIConversation({
      id: createRecordId(
        "ai-neon",
        bonusSessionRef.current.id || miraAiSessionRef.current,
      ),
      sessionId: miraAiSessionRef.current,
      roundId: bonusSessionRef.current.id || undefined,
      game: "neon-kasasi",
      character: "Mira",
      speaker: aiKind,
      occurredAt: new Date().toISOString(),
      text,
      context: {
        balance,
        wager,
        paidSpinCost,
        lastNet: lastNet ?? null,
        freeSpins,
        bonusMultiplier,
        bonusWin,
        cascadeNo,
        largestMultiplier,
        scatterBoost,
      },
      model:
        aiKind === "assistant"
          ? aiOnline
            ? "local-ai"
            : "fallback-persona"
          : undefined,
      latencyMs,
    });
    if (voiceEnabled && useVoice) speakMira(text);
  };

  const playPowerLandings = (values: number[]) => {
    values.forEach((value, index) =>
      audioRef.current?.play(
        "powerLand",
        Math.min(9, index + Math.floor(Math.log10(value + 1))),
      ),
    );
  };

  const countFinalCascadeWin = (target: number, milliseconds: number) => new Promise<void>((resolve) => {
    if (cascadeCountFrameRef.current !== undefined) window.cancelAnimationFrame(cascadeCountFrameRef.current);
    cascadeCountFrameRef.current = undefined;
    cascadeCountResolveRef.current?.();
    cascadeCountResolveRef.current = resolve;
    if (skipPresentationRef.current || milliseconds <= 0) {
      setCascadeWin(target);
      cascadeCountResolveRef.current = undefined;
      resolve();
      return;
    }
    const startedAt = performance.now();
    const frame = (at: number) => {
      if (skipPresentationRef.current) {
        setCascadeWin(target);
        cascadeCountFrameRef.current = undefined;
        cascadeCountResolveRef.current = undefined;
        resolve();
        return;
      }
      const progress = Math.min(1, (at - startedAt) / milliseconds);
      setCascadeWin(Math.round(target * (1 - (1 - progress) ** 3) * 100) / 100);
      if (progress < 1) cascadeCountFrameRef.current = window.requestAnimationFrame(frame);
      else {
        cascadeCountFrameRef.current = undefined;
        cascadeCountResolveRef.current = undefined;
        resolve();
      }
    };
    cascadeCountFrameRef.current = window.requestAnimationFrame(frame);
  });

  const skipPresentation = () => {
    skipPresentationRef.current = true;
    if (cascadeCountFrameRef.current !== undefined) window.cancelAnimationFrame(cascadeCountFrameRef.current);
    cascadeCountFrameRef.current = undefined;
    cascadeCountResolveRef.current?.();
    cascadeCountResolveRef.current = undefined;
    const finalResult = activePresentationRef.current;
    if (!finalResult) return;
    setGrid(finalResult.finalGrid);
    setPowerGrid(finalResult.finalPowerGrid);
    setWinningCells(new Set());
    setActivePowerCells(new Set());
    setEnteringCellIds(new Set());
    setMotionPhase("idle");
    setCascadeWin(finalResult.grossReturn);
  };

  const stopPresentation = () => {
    setAutoRemaining(0);
    skipPresentation();
  };

  const requestPresentationSkip = (target?: EventTarget | null) => {
    if (!spinning) return;
    if (target instanceof Element && target.closest("button, input, select, label, a")) return;
    skipPresentation();
  };

  const spin = async (fromAuto = false) => {
    const isFreeSpin = freeSpins > 0 && !bonusReady;
    if (
      spinning ||
      bonusReady ||
      winCelebration ||
      retriggerEvent ||
      (!isFreeSpin && balance < paidSpinCost)
    )
      return;
    skipPresentationRef.current = false;
    const startedAt = new Date().toISOString();
    const roundId = `neon-kasasi-${Date.now()}-${crypto.randomUUID()}`;
    const balanceBefore = balance;
    const stake = isFreeSpin ? 0 : paidSpinCost;
    if (fromAuto && !isFreeSpin)
      setAutoRemaining((value) => Math.max(0, value - 1));
    setSpinning(true);
    setWinningCells(new Set());
    setActivePowerCells(new Set());
    setPowerEvent(undefined);
    setClusterPayoutBursts([]);
    setResult(undefined);
    if (!isFreeSpin) {
      setLastNet(undefined);
      setBonusSummary(undefined);
      setBonusSummaryDismissed(false);
    }
    setCascadeNo(0);
    setCascadeWin(0);
    if (!isFreeSpin) setBalance((value) => value - stake);
    audioRef.current?.play("spin");

    const flowStateBefore = flowStateRef.current;
    const flowDecision = planSlotFlow(
      flowStateBefore,
      slotTuning.flow,
      slotTuning.potential,
      { bonusMode: isFreeSpin, lastBonusSpin: isFreeSpin && freeSpins === 1 },
    );
    const nextResult = runNeonSpin(wager, undefined, {
      bonusMode: isFreeSpin,
      bonusMultiplier,
      scatterBoost: !isFreeSpin && scatterBoost,
      tuning: mathTuning,
      flow: flowDecision,
      potential: slotTuning.potential,
    });
    activePresentationRef.current = nextResult;
    flowStateRef.current = settleSlotFlow(
      flowStateBefore,
      flowDecision,
      {
        grossMultiple: wager ? nextResult.grossReturn / wager : 0,
        bonusTriggered: nextResult.freeSpinsAwarded > 0,
        eventOccurred:
          nextResult.cascades.length > 0 ||
          nextResult.freeSpinsAwarded > 0 ||
          Boolean(nextResult.potentialCells?.length),
      },
      slotTuning.flow,
    );
    const nextCellId = () => `cell-${++cellSerial.current}`;
    const initialIdentity = createCascadeIdentity(7, 7, nextCellId);
    let activeIds = initialIdentity.ids;
    setGrid(nextResult.initialGrid);
    setPowerGrid(nextResult.initialPowerGrid);
    setCellIds(activeIds);
    setEnteringCellIds(initialIdentity.entering);
    setFallRows(createInitialFallRows(7, 7, 8));
    playPowerLandings(
      nextResult.initialPowerGrid.flat().filter((value) => value > 0),
    );
    let runningWin = 0;
    const normalStep = slotTuning.presentation.normalStepMs;
    const turboStep = Math.max(480, slotTuning.presentation.turboStepMs);
    await playCascadeTimeline(
      nextResult.cascades,
      turbo,
      {
        shouldSkip: () => skipPresentationRef.current,
        onPhase: (phase, cascade, index) => {
          if (phase === "landing") {
            setMotionPhase("dropping");
          } else if (phase === "focus") {
            setMotionPhase("idle");
            setEnteringCellIds(new Set());
            setCascadeNo((index ?? 0) + 1);
          } else if (phase === "bursting" && cascade) {
            setMotionPhase("bursting");
            setWinningCells(
              new Set(
                cascade.winningCells.map(([row, column]) => `${row}-${column}`),
              ),
            );
            runningWin += cascade.returnAmount;
            setCascadeWin(runningWin);
            const clusterTotal = cascade.clusters.reduce((sum, cluster) => sum + cluster.returnAmount, 0);
            const paidRatio = clusterTotal > 0 ? cascade.returnAmount / clusterTotal : 0;
            const bursts = cascade.clusters.map((cluster) => ({
              id: ++clusterBurstSerialRef.current,
              row: cluster.cells.reduce((sum, cell) => sum + cell[0], 0) / cluster.cells.length,
              column: cluster.cells.reduce((sum, cell) => sum + cell[1], 0) / cluster.cells.length,
              amount: Math.round(cluster.returnAmount * paidRatio * 100) / 100,
            }));
            setClusterPayoutBursts((current) => [...current.slice(-7), ...bursts]);
            window.setTimeout(() => setClusterPayoutBursts((current) => current.filter((burst) => !bursts.some((item) => item.id === burst.id))), turbo ? 580 : 920);
            audioRef.current?.play("cascade");
          } else if (phase === "cleared") {
            setWinningCells(new Set());
          } else if (phase === "falling" && cascade) {
            const reconciled = reconcileCascadeIdentity(
              activeIds,
              cascade.sourceRows,
              nextCellId,
            );
            activeIds = reconciled.ids;
            setGrid(cascade.nextGrid);
            setPowerGrid(cascade.nextPowerGrid);
            setCellIds(activeIds);
            setEnteringCellIds(reconciled.entering);
            setFallRows(cascade.fallRows);
            setMotionPhase("dropping");
            playPowerLandings(
              cascade.nextPowerGrid.flatMap((row, rowIndex) =>
                row.filter(
                  (value, columnIndex) =>
                    value > 0 &&
                    reconciled.entering.has(activeIds[rowIndex][columnIndex]),
                ),
              ),
            );
          }
        },
        afterLanding: async () => {
          setMotionPhase("idle");
          setEnteringCellIds(new Set());
          if (!slotTuning.presentation.anticipation || turbo) return;
          const initialScatters = nextResult.initialGrid
            .flat()
            .filter((symbol) => symbol === "scatter").length;
          const initialPower = Math.max(
            0,
            ...nextResult.initialPowerGrid.flat(),
          );
          const cue =
            initialScatters === 3
              ? "BİR MIRA DAHA · KASA AÇILABİLİR"
              : initialPower >= 100
                ? `${initialPower}× GÜÇ SİNYALİ · ZİNCİR BEKLENİYOR`
                : "";
          if (!cue) return;
          setAnticipationCue(cue);
          audioRef.current?.play("scatter");
          await waitForPresentation(
            slotTuning.presentation.teaseMs,
            () => skipPresentationRef.current,
          );
          setAnticipationCue("");
        },
        afterComplete: () => {
          setMotionPhase("idle");
          setEnteringCellIds(new Set());
        },
      },
      {
        normal: {
          landing: normalStep * 1.8,
          focus: 0,
          bursting: normalStep,
          cleared: 0,
          falling: normalStep * 1.8,
        },
        turbo: {
          landing: turboStep * 1.5,
          focus: 0,
          bursting: turboStep,
          cleared: 0,
          falling: turboStep * 1.5,
        },
      },
    );

    // Fortune/Gates sırası: bütün tumble'lar biter, ekranda kalan güçler daha
    // sonra tek tek toplanır, en son toplam spin kazancına çarpar.
    if (nextResult.multiplierValues.length && nextResult.baseReturn > 0) {
      let revealedTotal = 0;
      for (
        let index = 0;
        index < nextResult.multiplierValues.length;
        index += 1
      ) {
        revealedTotal += nextResult.multiplierValues[index];
        const revealedValues = nextResult.multiplierValues.slice(0, index + 1);
        const multiplier = isFreeSpin
          ? bonusMultiplier + revealedTotal
          : revealedTotal;
        setActivePowerCells(
          new Set(
            nextResult.multiplierCells
              .slice(0, index + 1)
              .map(([row, column]) => `${row}-${column}`),
          ),
        );
        setPowerEvent({
          values: revealedValues,
          landed: revealedTotal,
          multiplier,
          previousMultiplier: isFreeSpin ? bonusMultiplier : 0,
          baseReturn: nextResult.baseReturn,
          totalReturn: nextResult.grossReturn,
          bonusMode: isFreeSpin,
          stage: "collecting",
        });
        audioRef.current?.play("multiplierCollect", Math.min(9, index));
        await waitForPresentation(
          turbo
            ? slotTuning.presentation.multiplierRevealMs * 0.72
            : slotTuning.presentation.multiplierRevealMs,
          () => skipPresentationRef.current,
        );
      }
      const equation: PowerEvent = {
        values: nextResult.multiplierValues,
        landed: nextResult.powerSum,
        multiplier: nextResult.appliedMultiplier,
        previousMultiplier: isFreeSpin ? bonusMultiplier : 0,
        baseReturn: nextResult.baseReturn,
        totalReturn: nextResult.grossReturn,
        bonusMode: isFreeSpin,
        stage: "impact",
      };
      setPowerEvent(equation);
      if (isFreeSpin) setBonusMultiplier(nextResult.finalBonusMultiplier);
      audioRef.current?.play(
        "multiplierImpact",
        Math.min(9, Math.floor(Math.log10(nextResult.appliedMultiplier + 1))),
      );
      await waitForPresentation(
        turbo
          ? slotTuning.presentation.teaseMs * 0.8
          : slotTuning.presentation.teaseMs,
        () => skipPresentationRef.current,
      );
      setPowerEvent({ ...equation, stage: "counting" });
      setCascadeWin(0);
      const finalCountDuration = turbo
        ? 1_050
        : Math.max(1_500, Math.min(2_800, 1_300 + Math.log10(nextResult.grossReturn + 10) * 460));
      await countFinalCascadeWin(nextResult.grossReturn, finalCountDuration);
      await waitForPresentation(turbo ? 700 : 1_300, () => skipPresentationRef.current);
      setActivePowerCells(new Set());
      setPowerEvent(undefined);
    }

    const net = nextResult.grossReturn - stake;
    let nextFreeSpins = isFreeSpin ? Math.max(0, freeSpins - 1) : 0;
    nextFreeSpins += nextResult.freeSpinsAwarded;
    setFreeSpins(nextFreeSpins);
    setBonusMultiplier(
      nextFreeSpins && isFreeSpin ? nextResult.finalBonusMultiplier : 0,
    );
    setPowerGrid(nextResult.finalPowerGrid);
    setResult(nextResult);
    setSpins((value) => value + (isFreeSpin ? 0 : 1));
    setTotalCascades((value) => value + nextResult.cascades.length);
    recordSlotProgress(
      "neon-kasasi",
      {
        win: nextResult.grossReturn > (isFreeSpin ? 0 : stake),
        bonus: nextResult.freeSpinsAwarded > 0,
        specialCount: nextResult.finalPowerGrid
          .flat()
          .filter((value) => value > 0).length,
        discoveries: nextResult.finalPowerGrid
          .flat()
          .filter((value) => value > 0),
      },
      slotTuning.progression,
    );

    let bonusCumulativeAfter = bonusWinRef.current;
    let bonusPlayedAfter = bonusSpinsPlayedRef.current;
    if (isFreeSpin) {
      bonusCumulativeAfter += nextResult.grossReturn;
      bonusPlayedAfter += 1;
      bonusWinRef.current = bonusCumulativeAfter;
      bonusSpinsPlayedRef.current = bonusPlayedAfter;
      setBonusWin(bonusCumulativeAfter);
      setBonusSpinsPlayed(bonusPlayedAfter);
      setLastNet(undefined);
      if (!nextFreeSpins) {
        setBalance((value) => value + bonusCumulativeAfter);
        setLastNet(bonusCumulativeAfter);
        setBonusSummary({
          total: bonusCumulativeAfter,
          spins: bonusPlayedAfter,
          multiplier: nextResult.finalBonusMultiplier,
          source: bonusSource,
        });
        setBonusSummaryDismissed(false);
        setHistory((items) =>
          [
            {
              net: bonusCumulativeAfter,
              cascades: bonusPlayedAfter,
              multiplier: Math.max(1, nextResult.finalBonusMultiplier),
            },
            ...items,
          ].slice(0, 8),
        );
        audioRef.current?.play(
          bonusCumulativeAfter >= wager * 25 ? "bigWin" : "win",
        );
        announce(
          `Bonus tamamlandı. ${bonusPlayedAfter} free spin sonunda kasada ${money.format(bonusCumulativeAfter)} PR birikti.`,
        );
      }
    } else {
      if (nextResult.grossReturn)
        setBalance((value) => value + nextResult.grossReturn);
      setLastNet(net);
      setHistory((items) =>
        [
          {
            net,
            cascades: nextResult.cascades.length,
            multiplier: Math.max(
              1,
              nextResult.maxPowerValue,
              nextResult.appliedMultiplier,
            ),
          },
          ...items,
        ].slice(0, 8),
      );
    }

    if (nextResult.freeSpinsAwarded && !isFreeSpin) {
      setBonusSource("won");
      setBonusReady(true);
      setAutoRemaining(0);
      audioRef.current?.play("scatter");
      announce(
        `Dört MIRA protokolü açtı. ${nextResult.freeSpinsAwarded} free spin hazır; sen Başlat demeden kasa ilerlemeyecek.`,
      );
    } else if (nextResult.freeSpinsAwarded && isFreeSpin) {
      audioRef.current?.play("scatter");
      setRetriggerEvent({
        scatters: nextResult.scatterCount,
        awarded: nextResult.freeSpinsAwarded,
        remaining: nextFreeSpins,
      });
      announce(
        `Üç MIRA yeniden tetikledi: ${nextResult.freeSpinsAwarded} free spin eklendi. Bonus kasası ${money.format(bonusCumulativeAfter)} PR.`,
      );
    } else if (!isFreeSpin) {
      const kind =
        net >= wager * 10
          ? "bigWin"
          : nextResult.grossReturn > 0
            ? "win"
            : "loss";
      if (nextResult.grossReturn)
        audioRef.current?.play(kind === "bigWin" ? "bigWin" : "win");
      announce(
        miraEventLine(kind, {
          lastNet: net,
          cascades: nextResult.cascades.length,
          largestMultiplier: Math.max(
            1,
            nextResult.maxPowerValue,
            nextResult.finalBonusMultiplier,
          ),
        }),
        !fromAuto || kind !== "loss",
      );
    }
    const celebration =
      nextResult.freeSpinsAwarded || (isFreeSpin && !nextFreeSpins)
        ? undefined
        : winCelebrationFor(nextResult.grossReturn, wager);
    if (celebration && gameSettings.features.winTheatre) {
      setWinCelebration(celebration);
      if (slotTuning.presentation.dynamicAudio)
        audioRef.current?.play("winTier", WIN_TIERS.indexOf(celebration.tier));
    }
    const settledAt = new Date().toISOString();
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "neon-kasasi",
      variant: isFreeSpin
        ? "Neon Kasası · 7×7 cascade · free spin"
        : "Neon Kasası · 7×7 cluster cascade",
      source: "player",
      playerParticipated: true,
      startedAt,
      settledAt,
      stake,
      grossPayout: nextResult.grossReturn,
      net,
      outcome: net > 0 ? "win" : net < 0 ? "loss" : "push",
      balanceBefore,
      balanceAfter: isFreeSpin ? balanceBefore : balanceBefore + net,
      result: {
        telemetryVersion: 3,
        mathProfileVersion: slotTuning.math.profileName || NEON_MATH_PROFILE,
        mathParameters: mathTuning,
        rngModel: "neon-cluster-crypto-v3",
        referenceBet: wager,
        paidSpinCost: stake,
        grossReturn: nextResult.grossReturn,
        accountingNet: net,
        winMultiple: wager ? nextResult.grossReturn / wager : 0,
        initialGrid: nextResult.initialGrid,
        initialPowerGrid: nextResult.initialPowerGrid,
        finalGrid: nextResult.finalGrid,
        finalPowerGrid: nextResult.finalPowerGrid,
        scatterCount: nextResult.scatterCount,
        freeSpinsAwarded: nextResult.freeSpinsAwarded,
        baseReturn: nextResult.baseReturn,
        multiplierCells: nextResult.multiplierCells,
        multiplierValues: nextResult.multiplierValues,
        powerSum: nextResult.powerSum,
        appliedMultiplier: nextResult.appliedMultiplier,
        finalBonusMultiplier: nextResult.finalBonusMultiplier,
        cascades: nextResult.cascades.map((cascade, index) => ({
          index: index + 1,
          grid: cascade.grid,
          powerGrid: cascade.powerGrid,
          clusters: cascade.clusters,
          winningCells: cascade.winningCells,
          baseReturn: cascade.baseReturn,
          returnAmount: cascade.returnAmount,
          nextGrid: cascade.nextGrid,
          nextPowerGrid: cascade.nextPowerGrid,
          sourceRows: cascade.sourceRows,
          fallRows: cascade.fallRows,
        })),
      },
      modifiers: {
        source: isFreeSpin ? "free-spin" : "paid-spin",
        auto: fromAuto,
        turbo,
        freeSpin: isFreeSpin,
        scatterBoost: !isFreeSpin && scatterBoost,
        bonusSessionId: isFreeSpin ? bonusSessionRef.current.id : null,
        bonusSource: isFreeSpin ? bonusSource : null,
        bonusSpinIndex: isFreeSpin ? bonusPlayedAfter : null,
        freeSpinsBefore: isFreeSpin ? freeSpins : 0,
        freeSpinsAfter: nextFreeSpins,
        bonusMultiplierBefore: bonusMultiplier,
        bonusMultiplierAfter: nextResult.finalBonusMultiplier,
        bonusCumulativeAfter,
        maxPowerValue: nextResult.maxPowerValue,
        flow: slotFlowTelemetry(flowStateBefore, flowDecision),
        potentialCells: nextResult.potentialCells,
        sessionSpin: spins + (isFreeSpin ? 0 : 1),
      },
    });
    if (stake)
      void recordWalletEntry({
        id: createRecordId("ledger-stake", roundId),
        roundId,
        game: "neon-kasasi",
        occurredAt: startedAt,
        type: "stake",
        amount: -stake,
        balanceBefore,
        balanceAfter: balanceBefore - stake,
        note: "Neon Kasası spin bahsi",
      });
    if (!isFreeSpin && nextResult.grossReturn)
      void recordWalletEntry({
        id: createRecordId("ledger-payout", roundId),
        roundId,
        game: "neon-kasasi",
        occurredAt: settledAt,
        type: "payout",
        amount: nextResult.grossReturn,
        balanceBefore: balanceBefore - stake,
        balanceAfter: balanceBefore + net,
        note: "Neon Kasası spin ödemesi",
      });
    if (isFreeSpin && !nextFreeSpins && bonusCumulativeAfter) {
      const session = bonusSessionRef.current;
      void recordWalletEntry({
        id: createRecordId("ledger-bonus-payout", session.id),
        roundId: session.id,
        game: "neon-kasasi",
        occurredAt: settledAt,
        type: "payout",
        amount: bonusCumulativeAfter,
        balanceBefore,
        balanceAfter: balanceBefore + bonusCumulativeAfter,
        note: `${bonusPlayedAfter} free spin toplam bonus ödemesi`,
      });
      void recordGameEvent({
        id: createRecordId("event-bonus-complete", session.id),
        roundId: session.id,
        game: "neon-kasasi",
        occurredAt: settledAt,
        type: "bonus-completed",
        payload: {
          totalWin: bonusCumulativeAfter,
          spins: bonusPlayedAfter,
          finalMultiplier: nextResult.finalBonusMultiplier,
          source: bonusSource,
        },
      });
    }
    setSpinning(false);
    activePresentationRef.current = undefined;
  };

  useEffect(() => {
    if (spinning || bonusReady || winCelebration || retriggerEvent) return;
    const shouldPlayBonus = freeSpins > 0;
    const shouldPlayAuto = autoRemaining > 0 && balance >= paidSpinCost;
    if (!shouldPlayBonus && !shouldPlayAuto) {
      if (autoRemaining > 0 && balance < paidSpinCost) setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(
      () => {
        void spin(shouldPlayAuto && !shouldPlayBonus);
      },
      turbo ? 460 : 760,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    spinning,
    bonusReady,
    winCelebration,
    retriggerEvent,
    freeSpins,
    autoRemaining,
    balance,
    wager,
    turbo,
    scatterBoost,
    paidSpinCost,
  ]);

  const changeWager = (next: number) => {
    if (spinning || autoRemaining || freeSpins || bonusReady) return;
    const naturalMaximum = Math.max(
      gameSettings.minBet,
      Math.floor(balance / (scatterBoost ? 1.25 : 1) / 5) * 5,
    );
    setWager(
      Math.min(
        naturalMaximum,
        Math.max(gameSettings.minBet, Math.floor(next / 5) * 5),
      ),
    );
  };

  const buyBonus = () => {
    if (
      !gameSettings.features.bonusBuy ||
      spinning ||
      autoRemaining ||
      freeSpins ||
      bonusReady ||
      scatterBoost ||
      balance < bonusCost
    )
      return;
    const occurredAt = new Date().toISOString();
    const roundId = `neon-bonus-buy-${Date.now()}-${crypto.randomUUID()}`;
    setBalance((value) => value - bonusCost);
    setHistory((items) =>
      [{ net: -bonusCost, cascades: 0, multiplier: 1 }, ...items].slice(0, 8),
    );
    setFreeSpins(bonusBuySpins);
    setBonusMultiplier(0);
    setBonusWin(0);
    bonusWinRef.current = 0;
    setBonusSpinsPlayed(0);
    bonusSpinsPlayedRef.current = 0;
    setBonusSummary(undefined);
    setBonusSummaryDismissed(false);
    setBonusSource("bought");
    setBonusReady(true);
    setLastNet(-bonusCost);
    audioRef.current?.play("scatter");
    announce(
      `${money.format(bonusCost)} PR karşılığında ${bonusBuySpins} free spin hazır. Başlat düğmesi sende.`,
    );
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "neon-kasasi",
      variant: `Neon Kasası · ${bonusBuySpins} free spin satın alma`,
      source: "player",
      playerParticipated: true,
      startedAt: occurredAt,
      settledAt: occurredAt,
      stake: bonusCost,
      grossPayout: 0,
      net: -bonusCost,
      outcome: "loss",
      balanceBefore: balance,
      balanceAfter: balance - bonusCost,
      result: {
        telemetryVersion: 3,
        mathProfileVersion: slotTuning.math.profileName || NEON_MATH_PROFILE,
        mathParameters: mathTuning,
        rngModel: "neon-cluster-crypto-v3",
        referenceBet: wager,
        purchasedFreeSpins: bonusBuySpins,
      },
      modifiers: {
        source: "bonus-buy",
        purchaseMultiplier: slotTuning.math.bonusBuyX,
        wager,
      },
    });
    void recordWalletEntry({
      id: createRecordId("ledger-stake", roundId),
      roundId,
      game: "neon-kasasi",
      occurredAt,
      type: "stake",
      amount: -bonusCost,
      balanceBefore: balance,
      balanceAfter: balance - bonusCost,
      note: `${bonusBuySpins} Neon Kasası free spin satın alındı`,
    });
    void recordGameEvent({
      id: createRecordId("event-bonus-buy", roundId),
      roundId,
      game: "neon-kasasi",
      occurredAt,
      type: "bonus-purchased",
      payload: { wager, cost: bonusCost, freeSpins: bonusBuySpins },
    });
  };

  const startBonus = () => {
    if (!bonusReady || !freeSpins) return;
    const startedAt = new Date().toISOString();
    bonusWinRef.current = 0;
    bonusSpinsPlayedRef.current = 0;
    setBonusWin(0);
    setBonusSpinsPlayed(0);
    setBonusSummary(undefined);
    setBonusSummaryDismissed(false);
    setBonusMultiplier(0);
    bonusSessionRef.current = {
      id: `neon-bonus-session-${Date.now()}-${crypto.randomUUID()}`,
      startedAt,
      balanceBefore: balance,
    };
    setBonusReady(false);
    audioRef.current?.play("multiplier");
    announce(
      "Bonus kasası açıldı. Önce bütün tumble zinciri bitecek; sonra ekrandaki güçler sırayla ortak çarpana eklenecek. Kazanç bonus sonuna kadar kasada birikecek.",
      false,
    );
  };

  const sendChat = async () => {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    const userMessage = {
      speaker: "Sen" as const,
      text: prompt,
      moment: now(),
    };
    const recent = [...chat, userMessage];
    setChat(recent);
    void recordAIConversation({
      id: createRecordId(
        "ai-neon-user",
        bonusSessionRef.current.id || miraAiSessionRef.current,
      ),
      sessionId: miraAiSessionRef.current,
      roundId: bonusSessionRef.current.id || undefined,
      game: "neon-kasasi",
      character: "Mira",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: {
        balance,
        wager,
        paidSpinCost,
        lastNet: lastNet ?? null,
        freeSpins,
        bonusMultiplier,
        bonusWin,
        cascades: result?.cascades.length ?? 0,
        largestMultiplier,
        scatterBoost,
      },
    });
    setDraft("");
    setThinking(true);
    const aiStartedAt = performance.now();
    const answer = await askMira(prompt, {
      balance,
      wager,
      lastNet,
      cascades: result?.cascades.length ?? 0,
      largestMultiplier,
      freeSpins,
      recentMessages: recent
        .slice(-6)
        .map((message) => `${message.speaker}: ${message.text}`),
    });
    setThinking(false);
    announce(
      answer,
      true,
      "assistant",
      Math.round(performance.now() - aiStartedAt),
    );
  };

  return (
    <main className="neon-vault" onPointerDown={(event) => requestPresentationSkip(event.target)}>
      <header className="neon-topbar">
        <button
          onClick={() => {
            setTurbo(false);
            onBack();
          }}
        >
          ← <span>Slot Dünyası</span>
        </button>
        <div className="neon-brand">
          <i>NK</i>
          <span>
            NEON KASASI<small>GRID BREACH 7×7</small>
          </span>
        </div>
        <div className="neon-topbar-actions">
          <GameMusicControls game="neon-kasasi" />
          <div className="neon-wallet">
            ✦ {money.format(balance)} <small>PR</small>
          </div>
        </div>
      </header>
      <section className="neon-layout">
        <aside className="mira-panel">
          <div className="mira-orbit" />
          <img
            src="/assets/slots/neon-kasasi/mira-host-v1.png"
            alt="Neon Kasası sunucusu Mira"
          />
          <div className="mira-name">
            <small>KASA OPERATÖRÜ</small>
            <strong>MIRA</strong>
            <p>{lastMiraLine}</p>
          </div>
          <div className="mira-stats">
            <span>
              <small>ÜCRETLİ SPİN</small>
              <b>{spins}</b>
            </span>
            <span>
              <small>TOPLAM CASCADE</small>
              <b>{totalCascades}</b>
            </span>
            <span>
              <small>OTURUM NET</small>
              <b className={sessionNet >= 0 ? "positive" : ""}>
                {sessionNet > 0 ? "+" : sessionNet < 0 ? "−" : ""}
                {money.format(Math.abs(sessionNet))}
              </b>
            </span>
          </div>
          {slotTuning.presentation.progressHud && (
            <SlotProgressPanel
              game="neon-kasasi"
              settings={slotTuning.progression}
              collectionEnabled={slotTuning.presentation.collectionBook}
            />
          )}
        </aside>

        <section
          className={`neon-machine ${spinning ? "is-running" : ""} ${freeSpins > 0 ? "bonus-mode" : ""} ${turbo ? "turbo-mode" : ""} ${lastNet !== undefined && lastNet >= wager * 10 ? "neon-big-win" : ""}`}
        >
          {anticipationCue && (
            <div className="neon-anticipation" role="status">
              <i />
              <strong>{anticipationCue}</strong>
            </div>
          )}
          <header className="neon-machine-head">
            <div>
              <small>
                {freeSpins > 0
                  ? "BONUS KASA PROTOKOLÜ"
                  : "PEHLEVAN ROYALE SUNAR"}
              </small>
              <h1>
                NEON <em>KASASI</em>
              </h1>
              <p>
                {freeSpins > 0
                  ? "GÜÇ SEMBOLLERİNİ TOPLA · ORTAK ÇARPANI BÜYÜT"
                  : "5+ KOMŞU SEMBOL · PATLAT · FİZİKSEL OLARAK DÜŞÜR"}
              </p>
            </div>
            <div className="neon-live-stats">
              <span>
                <small>CASCADE</small>
                <b>{cascadeNo || "—"}</b>
              </span>
              <span>
                <small>SPİN KAZANCI</small>
                <b>{money.format(cascadeWin)} PR</b>
              </span>
              <span className={largestMultiplier > 1 ? "hot" : ""}>
                <small>
                  {freeSpins > 0 ? "BONUS ÇARPANI" : "EKRAN ÇARPANI"}
                </small>
                <b>{freeSpins > 0 ? visibleMultiplier : largestMultiplier}×</b>
              </span>
            </div>
          </header>

          <div className="neon-grid-frame">
            <div className="neon-grid-scan" aria-hidden="true" />
            <div className="neon-feed-rail" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => (
                <i
                  key={index}
                  style={{ "--rail-delay": `${index * 70}ms` } as CSSProperties}
                />
              ))}
            </div>
            <div
              className="neon-grid"
              aria-label="Neon Kasası 7 çarpı 7 sembol alanı"
            >
              {grid.flatMap((row, rowIndex) =>
                row.map((symbol, columnIndex) => {
                  const key = `${rowIndex}-${columnIndex}`;
                  const isWinning = winningCells.has(key);
                  const isPowerActive = activePowerCells.has(key);
                  const dropDistance = fallRows[rowIndex]?.[columnIndex] ?? 0;
                  const powerValue = powerGrid[rowIndex]?.[columnIndex] ?? 0;
                  const sprite = powerSpriteIndex(powerValue);
                  const cellId = cellIds[rowIndex][columnIndex];
                  const isEntering = enteringCellIds.has(cellId);
                  return (
                    <div
                      className={`neon-cell cascade-cell symbol-${symbol} ${isWinning ? "bursting" : ""} ${isPowerActive ? "power-active" : ""} ${motionPhase === "dropping" && dropDistance > 0 ? "cascade-falling" : ""} ${isEntering ? "cascade-entering" : "cascade-survivor"}`}
                      key={cellId}
                      data-cell-id={cellId}
                      data-row={rowIndex}
                      data-column={columnIndex}
                      style={
                        {
                          "--cascade-delay": `${cascadeCellDelay(rowIndex, columnIndex, isEntering, turbo)}ms`,
                          "--cascade-distance": `${-Math.max(1, dropDistance) * 112}%`,
                          "--cascade-duration": turbo ? ".52s" : ".72s",
                        } as CSSProperties
                      }
                    >
                      {symbol === "power" ? (
                        <div className={`multiplier-token sprite-${sprite}`}>
                          <b>{powerValue}×</b>
                        </div>
                      ) : (
                        <img
                          src={NEON_SYMBOLS[symbol].image}
                          alt={NEON_SYMBOLS[symbol].label}
                          draggable={false}
                        />
                      )}
                      {symbol === "scatter" && <span>MIRA · SCATTER</span>}
                      {isWinning && <i aria-hidden="true" />}
                    </div>
                  );
                }),
              )}
            </div>
            {clusterPayoutBursts.map((burst) => (
              <span
                key={burst.id}
                className="neon-cluster-payout"
                style={{
                  "--payout-x": `${((burst.column + .5) / 7) * 100}%`,
                  "--payout-y": `${((burst.row + .5) / 7) * 100}%`,
                } as CSSProperties}
              >+{money.format(burst.amount)} PR</span>
            ))}
            {freeSpins > 0 && (
              <div className="bonus-hud">
                <span>
                  <small>KALAN</small>
                  <strong>{freeSpins}</strong>
                  <em>FREE SPIN</em>
                </span>
                <span className="bonus-bank">
                  <small>BONUS KASASI</small>
                  <strong>{money.format(bonusWin)}</strong>
                  <em>PR · sona kadar birikir</em>
                </span>
                <span className="bonus-total">
                  <small>ORTAK ÇARPAN</small>
                  <strong>{visibleMultiplier}×</strong>
                  <em>güç gelince devreye girer</em>
                </span>
              </div>
            )}
            {powerEvent && (
              <div
                className={`power-event stage-${powerEvent.stage}`}
                role="status"
              >
                <small>
                  {powerEvent.stage === "collecting"
                    ? "TUMBLE BİTTİ · GÜÇLER TOPLANIYOR"
                    : powerEvent.stage === "counting"
                      ? "KESİN KAZANÇ SAYILIYOR"
                    : powerEvent.bonusMode
                      ? "BONUS ÇARPANI KİLİTLENDİ"
                      : "TOPLAM ÇARPAN KAZANCA VURDU"}
                </small>
                {powerEvent.stage === "collecting" && <div className="power-sum">
                  {powerEvent.bonusMode && powerEvent.previousMultiplier > 0 && <span className="power-previous"><b>{powerEvent.previousMultiplier}×</b><em>+</em></span>}
                  {powerEvent.values.map((value, index) => <span className="power-collected" key={`${value}-${index}`} style={{ "--collect-index": index } as CSSProperties}><b>{value}×</b>{index < powerEvent.values.length - 1 && <em>+</em>}</span>)}
                  {(powerEvent.values.length > 1 || powerEvent.previousMultiplier > 0) && <><i>=</i><strong>{powerEvent.multiplier}×</strong></>}
                </div>}
                {powerEvent.stage === "impact" || powerEvent.stage === "counting" ? (
                  <div className="power-equation">
                    <span>
                      {money.format(powerEvent.baseReturn)} <i>PR</i>
                    </span>
                    <em>×</em>
                    <b>{powerEvent.multiplier}×</b>
                    <em>=</em>
                    <strong>
                      {money.format(powerEvent.totalReturn)} <i>PR</i>
                    </strong>
                  </div>
                ) : (
                  <div className="power-charge">
                    <i />
                    <span>
                      {powerEvent.values.length}. güç küresi kasaya bağlandı
                    </span>
                  </div>
                )}
                <p>
                  {powerEvent.stage === "collecting"
                    ? "Ödeme bekliyor; bütün güçler sayılmadan çarpma yapılmaz."
                    : powerEvent.stage === "counting"
                      ? "Toplam ödeme sıfırdan gerçek PR tutarına yükseliyor."
                    : powerEvent.bonusMode
                      ? `Ortak bonus çarpanı ${powerEvent.multiplier}× oldu`
                      : `${powerEvent.landed}× güç bütün tumble kazancına uygulandı`}
                </p>
              </div>
            )}
          </div>

          <div className={`neon-result ${result?.grossReturn ? "profit" : ""}`}>
            {spinning ? (
              <>
                <small>
                  {powerEvent
                    ? "GÜÇ HESABI ÇÖZÜLÜYOR"
                    : cascadeNo
                      ? `${cascadeNo}. CASCADE ÇÖZÜLÜYOR`
                      : "ÜST HAZNE AÇILDI"}
                </small>
                <strong>
                  {money.format(cascadeWin)} <em>PR</em>
                </strong>
                <p>
                  {powerEvent
                    ? "Tüm tumble kazancı son çarpanı bekliyor"
                    : winningCells.size
                      ? `${winningCells.size} sembol patlıyor`
                      : "Yukarıdaki semboller boşluklara düşüyor"}
                </p>
              </>
            ) : freeSpins > 0 ? (
              <>
                <small>
                  BONUS DEVAM EDİYOR · {bonusSpinsPlayed} SPİN OYNANDI
                </small>
                <strong>
                  {money.format(bonusWin)} <em>PR BİRİKTİ</em>
                </strong>
                <p>
                  Kazanç bakiyeye bonus tamamlandığında tek seferde aktarılır.
                </p>
              </>
            ) : result && lastNet !== undefined ? (
              <>
                <small>
                  {bonusSummary
                    ? "FREE SPIN KAZANCI"
                    : result.grossReturn > 0
                      ? "BU SPİNİN TOPLAM ÖDEMESİ"
                      : "BU SPİN ÖDEME YAPMADI"}
                </small>
                <strong>
                  {money.format(
                    bonusSummary ? Math.abs(lastNet) : result.grossReturn,
                  )}{" "}
                  <em>{bonusSummary ? "PR BONUS" : "PR KAZANÇ"}</em>
                </strong>
                <p>
                  {bonusSummary
                    ? `${bonusSummary.spins} free spin · son ortak çarpan ${bonusSummary.multiplier || 1}×`
                    : `${result.cascades.length} cascade · ${result.scatterCount}/4 MIRA · net sonuç soldaki operasyon kaydında`}
                </p>
              </>
            ) : (
              <>
                <small>KASA HAZIR</small>
                <strong>SIZMAYI BAŞLAT</strong>
                <p>
                  Dört MIRA bonusu açar. Güç sembolleri 2× ile 1000×
                  arasındadır.
                </p>
              </>
            )}
          </div>
          <div className="neon-controls">
            <div className="neon-control-rail">
              <button
                className="neon-rules-button"
                onClick={() => setRulesOpen(true)}
              >
                ⓘ<span>KURALLAR</span>
              </button>
              <button
                className="neon-buy-button"
                onClick={buyBonus}
                disabled={
                  !gameSettings.features.bonusBuy ||
                  spinning ||
                  !!autoRemaining ||
                  !!freeSpins ||
                  bonusReady ||
                  scatterBoost ||
                  balance < bonusCost
                }
                title={
                  !gameSettings.features.bonusBuy
                    ? "Bonus satın alma yönetimden kapalı"
                    : scatterBoost
                      ? "MIRA Boost açıkken bonus satın alma kapalıdır"
                      : undefined
                }
              >
                <span>
                  {gameSettings.features.bonusBuy ? "BONUS AL" : "BONUS KAPALI"}
                </span>
                <b>{money.format(bonusCost)} PR</b>
                <small>{slotTuning.math.bonusBuyX}× bahis</small>
              </button>
            </div>
            <div className="neon-wager">
              <small>
                {scatterBoost
                  ? `MIRA BOOST · TOPLAM ${money.format(paidSpinCost)} PR`
                  : `TOPLAM BAHİS · MİN ${money.format(gameSettings.minBet)} PR`}
              </small>
              <div>
                <button
                  onClick={() => changeWager(wager - betStep)}
                  disabled={
                    spinning ||
                    !!autoRemaining ||
                    !!freeSpins ||
                    bonusReady ||
                    wager <= gameSettings.minBet
                  }
                >
                  −
                </button>
                <label>
                  <input
                    aria-label="Neon Kasası toplam bahis"
                    type="number"
                    min={gameSettings.minBet}
                    step="5"
                    max={balance / (scatterBoost ? 1.25 : 1)}
                    value={wager}
                    onChange={(event) =>
                      changeWager(Number(event.target.value))
                    }
                    disabled={
                      spinning || !!autoRemaining || !!freeSpins || bonusReady
                    }
                  />
                  <em>PR</em>
                </label>
                <button
                  onClick={() => changeWager(wager + betStep)}
                  disabled={
                    spinning ||
                    !!autoRemaining ||
                    !!freeSpins ||
                    bonusReady ||
                    (wager + betStep) * (scatterBoost ? 1.25 : 1) > balance
                  }
                >
                  +
                </button>
                <button
                  className="neon-max"
                  onClick={() =>
                    changeWager(balance / (scatterBoost ? 1.25 : 1))
                  }
                  disabled={
                    spinning ||
                    !!autoRemaining ||
                    !!freeSpins ||
                    bonusReady ||
                    balance < gameSettings.minBet
                  }
                >
                  MAX
                </button>
              </div>
              <div className="neon-wager-tools">
                <button
                  onClick={() => changeWager(wager / 2)}
                  disabled={
                    spinning || !!autoRemaining || !!freeSpins || bonusReady
                  }
                >
                  ½
                </button>
                <label>
                  KADEME
                  <select
                    aria-label="Bahis artış kademesi"
                    value={betStep}
                    onChange={(event) => setBetStep(Number(event.target.value))}
                  >
                    {BET_STEPS.map((step) => (
                      <option value={step} key={step}>
                        {compactWager(step)} PR
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => changeWager(wager * 2)}
                  disabled={
                    spinning ||
                    !!autoRemaining ||
                    !!freeSpins ||
                    bonusReady ||
                    wager * 2 * (scatterBoost ? 1.25 : 1) > balance
                  }
                >
                  2×
                </button>
              </div>
            </div>
            <button
              className={`neon-spin-button ${spinning ? "is-stop" : ""}`}
              onClick={() => (spinning ? stopPresentation() : void spin())}
              disabled={
                !spinning &&
                (!!autoRemaining ||
                  !!freeSpins ||
                  bonusReady ||
                  !!winCelebration ||
                  !!retriggerEvent ||
                  balance < paidSpinCost)
              }
            >
              <i>{spinning ? "■" : "⌁"}</i>
              <span>
                {spinning ? "DUR" : bonusReady ? "BONUS HAZIR" : "SPİN"}
              </span>
            </button>
            <div className="neon-toggles">
              <button
                className={turbo ? "active" : ""}
                onClick={() => setTurbo((value) => !value)}
                disabled={!gameSettings.features.turbo}
              >
                ⚡<span>TURBO</span>
              </button>
              <button
                className={audioEnabled ? "active" : ""}
                onClick={() => setAudioEnabled((value) => !value)}
                disabled={!gameSettings.sound || !admin.general.masterSound}
              >
                ♪<span>SES</span>
              </button>
              <button
                className={voiceEnabled ? "active" : ""}
                onClick={() => setVoiceEnabled((value) => !value)}
                disabled={!gameSettings.aiHost || !admin.general.aiEnabled}
              >
                ●<span>MIRA</span>
              </button>
              <button
                className={scatterBoost ? "active boost-active" : ""}
                onClick={() => setScatterBoost((value) => !value)}
                disabled={
                  !gameSettings.features.miraBoost ||
                  spinning ||
                  !!autoRemaining ||
                  !!freeSpins ||
                  bonusReady
                }
                title="%25 ek bahis ile 4-MIRA bonusunun tetiklenme ihtimalini yaklaşık iki katına çıkarır"
              >
                M×2<span>BOOST</span>
              </button>
              <div className="neon-auto">
                <select
                  aria-label="Neon Kasası otomatik spin sayısı"
                  value={autoCount}
                  onChange={(event) => setAutoCount(Number(event.target.value))}
                  disabled={
                    !gameSettings.autoplay ||
                    spinning ||
                    !!autoRemaining ||
                    !!freeSpins ||
                    bonusReady
                  }
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
                <button
                  className={autoRemaining ? "active" : ""}
                  onClick={() =>
                    setAutoRemaining((value) => (value ? 0 : autoCount))
                  }
                  disabled={
                    !gameSettings.autoplay ||
                    (!autoRemaining &&
                      (spinning ||
                        !!freeSpins ||
                        bonusReady ||
                        balance < paidSpinCost))
                  }
                >
                  {autoRemaining ? "■" : "↻"}
                  <span>{autoRemaining ? `DUR ${autoRemaining}` : "AUTO"}</span>
                </button>
              </div>
            </div>
          </div>

          {bonusReady && !winCelebration && (
            <div
              className="bonus-entry"
              role="dialog"
              aria-modal="true"
              aria-label="Free spin hazır"
            >
              <div className="bonus-entry-bolt">M</div>
              <small>
                {bonusSource === "bought"
                  ? "BONUS KASASI SATIN ALINDI"
                  : "4 MIRA AYNI EKRANDA"}
              </small>
              <strong>{freeSpins} FREE SPIN HAZIR</strong>
              <p>
                Satın alınan ve doğal bonus aynı kurallarla oynanır. Her spin
                önce tüm tumble'ları bitirir; görünen güçler sonra ortak çarpana
                eklenir. Kazanç bonus sonuna kadar ayrı kasada birikir.
              </p>
              <button onClick={startBonus}>
                FREE SPIN'İ BAŞLAT <span>→</span>
              </button>
            </div>
          )}
          {winCelebration && (
            <div
              className={`win-celebration tier-${winCelebration.tier.className}`}
              role="dialog"
              aria-modal="true"
              aria-label={winCelebration.tier.label}
            >
              <button
                aria-label="Kazanç ekranını kapat"
                onClick={() => setWinCelebration(undefined)}
              >
                ×
              </button>
              <div className="win-burst" aria-hidden="true">
                {Array.from({ length: 18 }, (_, index) => (
                  <i
                    key={index}
                    style={{ "--spark": index } as CSSProperties}
                  />
                ))}
              </div>
              <small>{winCelebration.tier.label}</small>
              <strong>
                {money.format(celebrationAmount)} <em>PR</em>
              </strong>
              <div className="win-multiple">
                <b>{money.format(winCelebration.multiple)}×</b>
                <span>TOPLAM BAHİS</span>
              </div>
              <p>
                {money.format(winCelebration.referenceBet)} PR bahis üzerinden
              </p>
            </div>
          )}
          {retriggerEvent && (
            <div
              className="retrigger-event"
              role="dialog"
              aria-modal="true"
              aria-label="Free spin uzatıldı"
            >
              <button
                aria-label="Uzatma ekranını kapat"
                onClick={() => setRetriggerEvent(undefined)}
              >
                ×
              </button>
              <small>BONUS YENİDEN TETİKLENDİ</small>
              <div className="retrigger-miras">
                {Array.from({ length: 3 }, (_, index) => (
                  <img
                    key={index}
                    src="/assets/slots/neon-kasasi/mira-scatter-v1.png"
                    alt=""
                  />
                ))}
              </div>
              <strong>
                +{retriggerEvent.awarded} <em>FREE SPIN</em>
              </strong>
              <p>
                {retriggerEvent.scatters} MIRA aynı ekranda · toplam{" "}
                {retriggerEvent.remaining} spin kaldı
              </p>
            </div>
          )}
          {bonusSummary &&
            !bonusSummaryDismissed &&
            !winCelebration &&
            !retriggerEvent &&
            createPortal(
              <div className="neon-bonus-result-backdrop">
                <section
                  className="neon-bonus-result"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Free spin kazancı"
                >
                  <button
                    aria-label="Free spin sonucunu kapat"
                    onClick={() => setBonusSummaryDismissed(true)}
                  >
                    ×
                  </button>
                  <small>BONUS KASASI TAMAMLANDI</small>
                  <strong>
                    {money.format(bonusSummary.total)} <em>PR</em>
                  </strong>
                  <p>
                    {bonusSummary.spins} free spin sonunda biriken toplam kazanç
                  </p>
                  <div>
                    <span>
                      <small>SON ORTAK ÇARPAN</small>
                      <b>{Math.max(1, bonusSummary.multiplier)}×</b>
                    </span>
                    <span>
                      <small>GİRİŞ</small>
                      <b>
                        {bonusSummary.source === "bought"
                          ? "SATIN ALMA"
                          : "4 MIRA"}
                      </b>
                    </span>
                  </div>
                </section>
              </div>,
              document.body,
            )}
        </section>

        <aside className="neon-side">
          <section className="neon-history">
            <header>
              <span>OPERASYON KAYDI</span>
              <small>NET / CASCADE</small>
            </header>
            {history.length ? (
              history.map((item, index) => (
                <div key={index}>
                  <i className={item.net >= 0 ? "up" : ""}>
                    {item.net > 0 ? "+" : item.net < 0 ? "−" : "·"}
                  </i>
                  <span>
                    {item.cascades
                      ? `${item.cascades} cascade`
                      : "Bonus / küme yok"}
                    <small>tepe {item.multiplier}×</small>
                  </span>
                  <b>{money.format(Math.abs(item.net))} PR</b>
                </div>
              ))
            ) : (
              <p>İlk operasyon bekleniyor.</p>
            )}
          </section>
          <section className="mira-chat">
            <header>
              <div>
                <strong>Mira ile konuş</strong>
                <small>
                  {aiOnline ? "YEREL AI · GRIDİ GÖRÜYOR" : "YEDEK KİŞİLİK"}
                </small>
              </div>
              <i className={aiOnline ? "online" : ""}>●</i>
            </header>
            <div>
              {chat.slice(-5).map((message, index) => (
                <article
                  className={message.speaker === "Sen" ? "player" : ""}
                  key={`${message.moment}-${index}`}
                >
                  <span>{message.speaker}</span>
                  <p>{message.text}</p>
                  <small>{message.moment}</small>
                </article>
              ))}
              {thinking && (
                <article>
                  <span>Mira</span>
                  <p>Bağlamı çözüyorum…</p>
                </article>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendChat();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Mira'ya yaz…"
                disabled={thinking}
              />
              <button disabled={thinking} aria-label="Gönder">
                ↑
              </button>
            </form>
          </section>
        </aside>
      </section>

      {rulesOpen && (
        <div
          className="neon-rules-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section
            className="neon-rules"
            role="dialog"
            aria-modal="true"
            aria-label="Neon Kasası kuralları"
          >
            <button
              onClick={() => setRulesOpen(false)}
              aria-label="Kuralları kapat"
            >
              ×
            </button>
            <small>NEON KASASI · GRID BREACH</small>
            <h2>Kasa protokolü</h2>
            <div className="neon-rule-grid">
              <article>
                <b>01</b>
                <strong>Fiziksel cascade</strong>
                <p>
                  Kazananlar patlar. Üstlerindeki mevcut semboller kimliğini
                  koruyarak boşluğa kayar; yalnız en üstte açılan boşluklara
                  yeni sembol girer.
                </p>
              </article>
              <article>
                <b>02</b>
                <strong>Dört MIRA</strong>
                <p>
                  Spin sonundaki 4 / 5 / 6 / 7 MIRA sırasıyla 15 / 20 / 25 / 30
                  free spin açar. Bonus içinde 3+ MIRA beş spin ekler.
                </p>
              </article>
              <article>
                <b>03</b>
                <strong>Tumble sonu güç hesabı</strong>
                <p>
                  2×–1000× güçler ilk ekranda veya sonraki düşüşlerde gelebilir.
                  Bütün tumble zinciri bittikten sonra ekrandaki değerler tek
                  tek toplanır ve toplam spin kazancına bir kez vurur.
                </p>
              </article>
              <article>
                <b>04</b>
                <strong>Bonus ortak çarpanı</strong>
                <p>
                  Kazanan free spin sonunda görünen güçler kalıcı ortak havuza
                  eklenir. Güç gelen o spin, yeni toplam çarpanla ödenir; bonus
                  kazancı özellik bitene kadar ayrı kasada tutulur.
                </p>
              </article>
              <article>
                <b>05</b>
                <strong>Bonus satın alma</strong>
                <p>
                  {slotTuning.math.bonusBuyX}× bahis bedeli {bonusBuySpins} free
                  spin açar. Satın alınan bonus doğal bonusla tamamen aynı
                  motoru kullanır ve oyuncu “Başlat” demeden ilerlemez.
                </p>
              </article>
              <article>
                <b>06</b>
                <strong>Volatilite</strong>
                <p>
                  MIRA sıklığı uzun bonus kuraklığını azaltacak biçimde
                  dengelendi. Yüksek güç değerleri katman katman seyrekleşir;
                  1000× en nadir güçtür.
                </p>
              </article>
            </div>
            <footer>
              Geliştirme RTP'si simülasyonla izlenir; sertifikalı gerçek para
              oyunu değildir. Tek spin toplam kazancı en fazla 15.000× bahisle
              sınırlandırılmıştır.
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
