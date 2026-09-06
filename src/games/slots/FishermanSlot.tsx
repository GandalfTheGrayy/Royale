import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import GameMusicControls from "../../audio/GameMusicControls";
import { playGameSfx } from "../../audio/game-sfx";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { CASINO_BET_STEPS, maximumAffordableWager } from "../wagering";
import { askMercan, mercanEventLine } from "../../ai/mercan";
import {
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import {
  createRecordId,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
} from "../../data/casino-database";
import {
  advanceFisherBonus,
  createFisherBonus,
  createFisherBonusPickDeck,
  createFisherGrid,
  EMPTY_FISHER_BONUS_MODIFIERS,
  FISHER_MATH_PROFILE,
  FISHER_PAYLINES,
  FISHER_SYMBOLS,
  spinFisher,
  type FisherBonusState,
  type FisherBonusModifierId,
  type FisherBonusModifiers,
  type FisherBonusPickCard,
  type FisherCell,
  type FisherSpinResult,
} from "./fisherman-engine";
import "./fisherman.css";
import SlotProgressPanel from "./SlotProgressPanel";
import { recordSlotProgress } from "./slot-progression";
import { waitForPresentation } from "./cascade-presentation";
import {
  createSlotFlowState,
  planSlotFlow,
  settleSlotFlow,
} from "./slot-flow-engine";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onBack: () => void;
  aiOnline: boolean;
};
type Message = { speaker: "Mercan" | "Sen"; text: string; moment: string };
type HistoryItem = { net: number; gross: number; note: string; bonus: boolean };
type BonusPickCard = FisherBonusPickCard & { revealed: boolean };
type CollectionStep = {
  captainIndex: number;
  fishIndex: number;
  itemAmount: number;
  runningAmount: number;
  activeCell?: string;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
const initialGrid = createFisherGrid(false);
const WAGER_STEPS = CASINO_BET_STEPS;

class FisherAudio {
  enabled = true;
  private effects = {
    splash: "/assets/fisherman/audio/ocean-splash.ogg",
    collect: "/assets/fisherman/audio/coin-splash.ogg",
    bubbles: "/assets/fisherman/audio/bubbles.ogg",
    land: "/assets/fisherman/audio/water-reentry.ogg",
  };
  play(name: keyof FisherAudio["effects"], volume = 0.5, rate = 1) {
    if (!this.enabled) return;
    playGameSfx("kaptan-mercan",this.effects[name],volume,rate);
  }
}

function speakMercan(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase().startsWith("tr") &&
        /ahmet|tolga|male|erkek/i.test(voice.name),
    ) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("tr")) ??
    null;
  utterance.lang = "tr-TR";
  utterance.rate = 0.94;
  utterance.pitch = 0.78;
  window.speechSynthesis.speak(utterance);
}

const modifierCopy: Record<
  FisherBonusModifierId,
  { title: string; detail: string; icon: string }
> = {
  "more-fish": {
    title: "BOL HAZİNE BALIĞI",
    detail: "Hazine balıkları daha sık görünür",
    icon: "/assets/fisherman/ottoman-ai/money-fish-v1.png",
  },
  "more-captains": {
    title: "KALABALIK MÜRETTEBAT",
    detail: "Kaptan Mercan daha sık güverteye çıkar",
    icon: "/assets/fisherman/ottoman-ai/captain-medallion-v2.png",
  },
  "more-features": {
    title: "DOLU CEPHANELİK",
    detail: "Kanca, dinamit ve top salvosu daha sık çalışır",
    icon: "/assets/fisherman/ottoman-ai/anchor-v1.png",
  },
  "extra-spins": {
    title: "+2 GECE SEFERİ",
    detail: "Başlangıca ve her yeni kademeye iki spin eklenir",
    icon: "/assets/fisherman/ottoman-ai/lighthouse-scatter-v1.png",
  },
  "start-level-two": {
    title: "2× İLE BAŞLA",
    detail: "İlk dört kaptan hazır; bonus ikinci kademeden açılır",
    icon: "/assets/fisherman/ottoman-ai/captain-medallion-v2.png",
  },
};

function resultNote(result: FisherSpinResult, wager: number) {
  if (result.bonusSpins)
    return `${result.scatterCount} fener · ${result.bonusSpins} ücretsiz spin`;
  if (result.collectedFishMultiplier)
    return `${result.fishValues.map((value) => `${money.format(value * wager)} PR`).join(" + ")} · ${result.captainCount} kaptan · ${result.collectionMultiplier}×`;
  if (result.lineWins.length) return `${result.lineWins.length} ödeme çizgisi`;
  if (result.fishValues.length)
    return `${result.fishValues.length} para balığı · kaptan yok`;
  return "Ağ boş döndü";
}

export default function FishermanSlot({
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
  const settings = admin.games["kaptan-mercan"];
  const slotTuning = settings.slot!;
  const mathTuning = {
    ...slotTuning.math,
    valueWeights: slotTuning.valueWeights,
  };
  const [wager, setWager] = useState(
    Math.max(settings.minBet, settings.defaultBet),
  );
  const [step, setStep] = useState(25);
  const [grid, setGrid] = useState<FisherCell[][]>(initialGrid);
  const [result, setResult] = useState<FisherSpinResult>();
  const [spinning, setSpinning] = useState(false);
  const [rollingReels, setRollingReels] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [collectCount, setCollectCount] = useState(0);
  const [collectionStep, setCollectionStep] = useState<CollectionStep>();
  const [captainMeterDisplay, setCaptainMeterDisplay] = useState<number>();
  const [bonusFeatureCue, setBonusFeatureCue] =
    useState<FisherSpinResult["bonusFeature"]>();
  const [hooking, setHooking] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [spins, setSpins] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [ante, setAnte] = useState(false);
  const [autoCount, setAutoCount] = useState(25);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [effectsEnabled, setEffectsEnabled] = useState(
    settings.sound && admin.general.masterSound,
  );
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "kaptan-mercan",
    "ai-voice",
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [anticipationCue, setAnticipationCue] = useState("");
  const [bonusPending, setBonusPending] = useState<{
    spins: number;
    source: "natural" | "buy";
    triggerRound: string;
  }>();
  const [bonusPickCards, setBonusPickCards] = useState<BonusPickCard[]>([]);
  const [bonusPickComplete, setBonusPickComplete] = useState(false);
  const [bonusModifiers, setBonusModifiers] = useState<FisherBonusModifiers>({
    ...EMPTY_FISHER_BONUS_MODIFIERS,
  });
  const [bonus, setBonus] = useState<FisherBonusState>();
  const [bonusSummary, setBonusSummary] = useState<FisherBonusState>();
  const [stageFlash, setStageFlash] = useState<{
    multiplier: number;
    extra: number;
    queued: boolean;
  }>();
  const [retriggerFlash, setRetriggerFlash] = useState<number>();
  const [winTheatre, setWinTheatre] = useState<{
    title: string;
    amount: number;
    multiple: number;
  }>();
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Mercan", text: mercanEventLine("welcome"), moment: now() },
  ]);
  const audioRef = useRef(new FisherAudio());
  const skipPresentationRef = useRef(false);
  const aiSessionRef = useRef(`ai-mercan-${Date.now()}-${crypto.randomUUID()}`);
  const freeSpinTimer = useRef(0);
  const flowStateRef = useRef(createSlotFlowState());
  const totalNet = history.reduce((sum, item) => sum + item.net, 0);
  const paidStake = wager * (ante ? slotTuning.math.enhancedBetCostX : 1);
  const buyCost = wager * slotTuning.math.bonusBuyX;
  const comfortableTurboStep = Math.max(
    210,
    slotTuning.presentation.turboStepMs,
  );
  const winningCells = useMemo(
    () =>
      new Set(
        result?.lineWins.flatMap((win) =>
          win.cells.map((cell) => `${cell.row}-${cell.reel}`),
        ) ?? [],
      ),
    [result],
  );
  const latestMercan = chat
    .filter((message) => message.speaker === "Mercan")
    .at(-1)?.text;
  const visibleCaptains = captainMeterDisplay ?? bonus?.captainsCollected ?? 0;

  useEffect(
    () => () => {
      window.clearTimeout(freeSpinTimer.current);
      window.speechSynthesis?.cancel();
    },
    [],
  );
  useEffect(() => {
    audioRef.current.enabled = effectsEnabled;
  }, [effectsEnabled]);

  const stopPresentation = () => {
    skipPresentationRef.current = true;
    setAutoRemaining(0);
  };

  const context = (spinResult = result, bonusState = bonus) => ({
    balance,
    wager,
    lastNet: spinResult?.net,
    fishValues: spinResult?.fishValues ?? [],
    captains: spinResult?.captainCount ?? 0,
    bonusRemaining: bonusState?.spinsRemaining ?? 0,
    bonusMultiplier: bonusState?.multiplier ?? 1,
    spins,
    recentMessages: chat
      .slice(-6)
      .map((message) => `${message.speaker}: ${message.text}`),
  });

  const announce = (
    text: string,
    aloud = true,
    speaker: "assistant" | "system-event" = "system-event",
    roundId?: string,
  ) => {
    setChat((items) =>
      [...items, { speaker: "Mercan" as const, text, moment: now() }].slice(
        -24,
      ),
    );
    if (aloud && voiceEnabled) speakMercan(text);
    void recordAIConversation({
      id: createRecordId("ai-mercan", aiSessionRef.current),
      sessionId: aiSessionRef.current,
      roundId,
      game: "kaptan-mercan",
      character: "Mercan",
      speaker,
      occurredAt: new Date().toISOString(),
      text,
      context: context(),
    });
  };

  const animateReels = async (next: FisherCell[][]) => {
    skipPresentationRef.current = false;
    setSpinning(true);
    setResult(undefined);
    setCollectCount(0);
    setRollingReels(5);
    audioRef.current.play("splash", 0.36, turbo ? 1.25 : 1);
    const delay = turbo
      ? comfortableTurboStep
      : slotTuning.presentation.normalStepMs * 0.8;
    for (let reel = 0; reel < 5; reel += 1) {
      if (
        reel === 4 &&
        !turbo &&
        slotTuning.presentation.anticipation &&
        next
          .flatMap((row) => row.slice(0, 4))
          .filter((cell) => cell.id === "scatter").length >= 2
      ) {
        setAnticipationCue("SON FENER · LİMAN SESSİZLEŞTİ");
        audioRef.current.play("bubbles", 0.7, 0.76);
        await waitForPresentation(
          slotTuning.presentation.teaseMs,
          () => skipPresentationRef.current,
        );
      }
      await waitForPresentation(delay, () => skipPresentationRef.current);
      setGrid((current) =>
        current.map((row, rowIndex) =>
          row.map((cell, column) =>
            column === reel ? next[rowIndex][column] : cell,
          ),
        ),
      );
      setRollingReels(4 - reel);
      audioRef.current.play("land", 0.22, 1 + reel * 0.06);
      if (reel === 4) setAnticipationCue("");
    }
    await waitForPresentation(
      turbo
        ? comfortableTurboStep * 0.86
        : slotTuning.presentation.normalStepMs * 0.74,
      () => skipPresentationRef.current,
    );
  };

  const recordRound = (
    roundId: string,
    spinResult: FisherSpinResult,
    details: {
      stake: number;
      gross: number;
      net: number;
      balanceBefore: number;
      bonusState?: FisherBonusState;
      source?: string;
      startedAt: string;
    },
  ) => {
    const settledAt = new Date().toISOString();
    const stage = details.bonusState?.stage ?? 0;
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "kaptan-mercan",
      variant: "Kaptan Mercan · 5×4 · 20 çizgi · Para Balığı Toplama",
      source: "player",
      playerParticipated: true,
      startedAt: details.startedAt,
      settledAt,
      stake: details.stake,
      grossPayout: details.gross,
      net: details.net,
      outcome: details.net > 0 ? "win" : details.net < 0 ? "loss" : "push",
      balanceBefore: details.balanceBefore,
      balanceAfter: details.balanceBefore + details.net,
      result: {
        telemetryVersion: 2,
        mathProfileVersion: slotTuning.math.profileName || FISHER_MATH_PROFILE,
        mathParameters: mathTuning,
        rngModel: "weighted-crypto-grid-v2",
        grid: spinResult.grid,
        lineWins: spinResult.lineWins,
        paylines: FISHER_PAYLINES.length,
        linePayout: spinResult.linePayout,
        scatterCount: spinResult.scatterCount,
        scatterPayout: spinResult.scatterPayout,
        bonusSpinsAwarded: spinResult.bonusSpins,
        hookRescue: spinResult.hookRescue,
        moneyFishValues: spinResult.fishValues,
        moneyFishAmounts: spinResult.fishValues.map((value) => value * wager),
        moneyFishCount: spinResult.fishValues.length,
        captainCount: spinResult.captainCount,
        captainCells: spinResult.captainCells,
        collectorPresent: spinResult.captainCount > 0,
        bonusFeature: spinResult.bonusFeature ?? null,
        collectionMultiplier: spinResult.collectionMultiplier,
        collectedFishMultiplier: spinResult.collectedFishMultiplier,
        potentialCells: spinResult.potentialCells,
        flowDecision: spinResult.flowDecision,
        grossPayout: details.gross,
        net: details.net,
      },
      modifiers: {
        source: details.source ?? "paid-spin",
        wager,
        actualStake: details.stake,
        ante,
        turbo,
        auto: autoRemaining > 0,
        bonusSessionId: details.bonusState?.id,
        bonusSource: details.bonusState?.source,
        bonusSpinIndex: details.bonusState
          ? details.bonusState.spinsPlayed + 1
          : null,
        bonusSpinsRemainingBefore: details.bonusState?.spinsRemaining,
        captainsCollectedBefore: details.bonusState?.captainsCollected,
        bonusStageBefore: stage,
        bonusUnlockedStageBefore: details.bonusState?.unlockedStage,
        bonusMultiplierBefore: details.bonusState?.multiplier,
        currentBatchRemainingBefore: details.bonusState?.currentBatchRemaining,
        queuedBatchesBefore: details.bonusState?.queuedBatches,
        bonusModifiers: details.bonusState?.modifiers,
      },
    });
    if (details.stake)
      void recordWalletEntry({
        id: createRecordId("ledger-mercan-stake", roundId),
        roundId,
        game: "kaptan-mercan",
        occurredAt: details.startedAt,
        type: "stake",
        amount: -details.stake,
        balanceBefore: details.balanceBefore,
        balanceAfter: details.balanceBefore - details.stake,
        note:
          details.source === "bonus-buy"
            ? "Kaptan Mercan bonus satın alma"
            : `Kaptan Mercan spin bahsi${ante ? " · Fener Şansı" : ""}`,
      });
    if (details.gross && !details.bonusState)
      void recordWalletEntry({
        id: createRecordId("ledger-mercan-payout", roundId),
        roundId,
        game: "kaptan-mercan",
        occurredAt: settledAt,
        type: "payout",
        amount: details.gross,
        balanceBefore: details.balanceBefore - details.stake,
        balanceAfter: details.balanceBefore + details.net,
        note: "Kaptan Mercan spin ödemesi",
      });
  };

  const queueBonus = (pending: {
    spins: number;
    source: "natural" | "buy";
    triggerRound: string;
  }) => {
    setBonusPending(pending);
    setBonusPickCards(
      createFisherBonusPickDeck().map((card) => ({ ...card, revealed: false })),
    );
    setBonusModifiers({ ...EMPTY_FISHER_BONUS_MODIFIERS });
    setBonusPickComplete(false);
  };

  const revealBonusPick = (cardId: string) => {
    if (bonusPickComplete) return;
    const card = bonusPickCards.find((item) => item.id === cardId);
    if (!card || card.revealed) return;
    setBonusPickCards((cards) =>
      cards.map((item) =>
        item.id === cardId ? { ...item, revealed: true } : item,
      ),
    );
    audioRef.current.play(card.reward === "boot" ? "land" : "collect", 0.72);
    if (card.reward === "boot") {
      setBonusPickComplete(true);
      return;
    }
    setBonusModifiers((current) => ({ ...current, [card.reward]: true }));
    const unrevealedRewards = bonusPickCards.filter(
      (item) => !item.revealed && item.id !== cardId && item.reward !== "boot",
    );
    if (!unrevealedRewards.length) setBonusPickComplete(true);
  };

  const playSpin = async (free = false, fromAuto = false) => {
    if (
      spinning ||
      bonusPending ||
      bonusSummary ||
      (free && !bonus) ||
      (!free && (bonus || balance < paidStake))
    )
      return;
    const startedAt = new Date().toISOString();
    const roundId = `kaptan-mercan-${Date.now()}-${crypto.randomUUID()}`;
    const balanceBefore = balance;
    const currentBonus = bonus;
    if (free && currentBonus)
      setCaptainMeterDisplay(currentBonus.captainsCollected);
    const stake = free ? 0 : paidStake;
    if (!free) setBalance((value) => value - stake);
    if (fromAuto) setAutoRemaining((value) => Math.max(0, value - 1));
    const flowStateBefore = flowStateRef.current;
    const flowDecision = planSlotFlow(
      flowStateBefore,
      slotTuning.flow,
      slotTuning.potential,
      {
        bonusMode: free,
        lastBonusSpin: free && (currentBonus?.spinsRemaining ?? 0) === 1,
      },
    );
    const next = spinFisher(wager, {
      bonus: free,
      bonusMultiplier: currentBonus?.multiplier ?? 1,
      bonusModifiers: currentBonus?.modifiers,
      ante: !free && ante,
      tuning: mathTuning,
      flow: flowDecision,
      potential: slotTuning.potential,
    });
    flowStateRef.current = settleSlotFlow(
      flowStateBefore,
      flowDecision,
      {
        grossMultiple: wager ? next.grossPayout / wager : 0,
        bonusTriggered: next.bonusSpins > 0,
        eventOccurred:
          next.lineWins.length > 0 ||
          next.bonusSpins > 0 ||
          next.fishValues.length > 0,
      },
      slotTuning.flow,
    );
    await animateReels(next.grid);
    if (next.bonusFeature) {
      setBonusFeatureCue(next.bonusFeature);
      audioRef.current.play(
        next.bonusFeature === "bazooka" ? "splash" : "bubbles",
        0.82,
        next.bonusFeature === "hook" ? 0.76 : 1,
      );
      await waitForPresentation(
        turbo ? comfortableTurboStep * 2.3 : slotTuning.presentation.teaseMs,
        () => skipPresentationRef.current,
      );
      setBonusFeatureCue(undefined);
    }
    if (next.hookRescue) {
      setHooking(true);
      audioRef.current.play("splash", 0.7, 0.82);
      await waitForPresentation(
        turbo
          ? comfortableTurboStep * 2.47
          : slotTuning.presentation.normalStepMs * 2.74,
        () => skipPresentationRef.current,
      );
      setHooking(false);
    }
    setResult(next);

    if (next.captainCount > 0) {
      setCollecting(true);
      if (next.collectedFishMultiplier)
        announce(
          mercanEventLine("collect", context(next, currentBonus)),
          false,
          "system-event",
          roundId,
        );
      let runningAmount = 0;
      for (
        let captainIndex = 0;
        captainIndex < next.captainCount;
        captainIndex += 1
      ) {
        setCollectCount(0);
        if (!next.fishCells.length) {
          setCollectionStep({
            captainIndex,
            fishIndex: -1,
            itemAmount: 0,
            runningAmount,
          });
          audioRef.current.play("land", 0.48, 0.84 + captainIndex * 0.05);
          await waitForPresentation(
            turbo
              ? comfortableTurboStep * 1.15
              : slotTuning.presentation.normalStepMs * 0.9,
            () => skipPresentationRef.current,
          );
        }
        for (
          let fishIndex = 0;
          fishIndex < next.fishCells.length;
          fishIndex += 1
        ) {
          const fish = next.fishCells[fishIndex];
          const itemAmount = wager * fish.value * next.collectionMultiplier;
          runningAmount += itemAmount;
          setCollectCount(fishIndex + 1);
          setCollectionStep({
            captainIndex,
            fishIndex,
            itemAmount,
            runningAmount,
            activeCell: `${fish.row}-${fish.reel}`,
          });
          audioRef.current.play("collect", 0.56, 0.9 + fishIndex * 0.035);
          await waitForPresentation(
            turbo
              ? comfortableTurboStep * 1.15
              : Math.max(520, slotTuning.presentation.normalStepMs),
            () => skipPresentationRef.current,
          );
        }
        if (free && currentBonus) {
          setCaptainMeterDisplay(
            Math.min(
              slotTuning.math.stageInterval * 3,
              currentBonus.captainsCollected + captainIndex + 1,
            ),
          );
        }
        audioRef.current.play("collect", 0.5, 0.92 + captainIndex * 0.05);
        await waitForPresentation(
          turbo
            ? comfortableTurboStep * 1.35
            : slotTuning.presentation.normalStepMs * 0.8,
          () => skipPresentationRef.current,
        );
      }
      if (next.collectedFishMultiplier)
        await waitForPresentation(
          turbo
            ? comfortableTurboStep * 1.15
            : slotTuning.presentation.multiplierRevealMs,
          () => skipPresentationRef.current,
        );
      setCollecting(false);
      setCollectionStep(undefined);
    }

    setSpins((value) => value + 1);
    recordSlotProgress(
      "kaptan-mercan",
      {
        win: next.grossPayout > stake,
        bonus: next.bonusSpins > 0,
        specialCount: next.captainCount,
        discoveries: next.fishValues,
      },
      slotTuning.progression,
    );
    if (free && currentBonus) {
      const progress = advanceFisherBonus(currentBonus, next, mathTuning);
      setHistory((items) =>
        [
          {
            net: next.grossPayout,
            gross: next.grossPayout,
            note: resultNote(next, wager),
            bonus: true,
          },
          ...items,
        ].slice(0, 14),
      );
      recordRound(roundId, next, {
        stake: 0,
        gross: next.grossPayout,
        net: next.grossPayout,
        balanceBefore,
        bonusState: currentBonus,
        source: "free-spin",
        startedAt,
      });
      if (progress.scatterExtra > 0) {
        setRetriggerFlash(progress.scatterExtra);
        audioRef.current.play("bubbles", 0.82, 1.08);
        announce(
          `${next.scatterCount} fener yandı; gece seferi ${progress.scatterExtra} spin uzadı.`,
          true,
          "system-event",
          roundId,
        );
        await waitForPresentation(
          turbo
            ? comfortableTurboStep * 3
            : slotTuning.presentation.teaseMs * 1.15,
          () => skipPresentationRef.current,
        );
        setRetriggerFlash(undefined);
      }
      const freeSpinMultiple = wager ? next.grossPayout / wager : 0;
      if (freeSpinMultiple >= 10) {
        const title =
          freeSpinMultiple >= 100
            ? "EFSANE FREE SPİN"
            : freeSpinMultiple >= 50
              ? "DEV FREE SPİN"
              : freeSpinMultiple >= 25
                ? "BÜYÜK FREE SPİN"
                : "GÜÇLÜ FREE SPİN";
        setWinTheatre({
          title,
          amount: next.grossPayout,
          multiple: freeSpinMultiple,
        });
        audioRef.current.play("collect", 0.78, 0.68);
        await waitForPresentation(
          turbo ? 2600 : 5200,
          () => skipPresentationRef.current,
        );
        setWinTheatre(undefined);
      }
      if (progress.stagesAdvanced || progress.batchActivated) {
        setStageFlash({
          multiplier: progress.unlockedMultiplier ?? progress.state.multiplier,
          extra: progress.stagesAdvanced
            ? progress.extraSpins
            : progress.state.currentBatchRemaining,
          queued: progress.stagesAdvanced > 0 && !progress.batchActivated,
        });
        audioRef.current.play("collect", 0.8, 0.7);
        announce(
          progress.batchActivated
            ? `${progress.state.multiplier}× güverte şimdi başladı; sıradaki ${progress.state.currentBatchRemaining} spin bu çarpanla oynanacak.`
            : mercanEventLine("stage", context(next, progress.state)),
          true,
          "system-event",
          roundId,
        );
        await waitForPresentation(
          turbo
            ? slotTuning.presentation.teaseMs * 0.48
            : slotTuning.presentation.teaseMs,
          () => skipPresentationRef.current,
        );
        setStageFlash(undefined);
      }
      if (progress.state.spinsRemaining <= 0) {
        setBalance((value) => value + progress.state.totalWin);
        setBonus(undefined);
        setCaptainMeterDisplay(undefined);
        setBonusSummary(progress.state);
        setSpinning(false);
        void recordWalletEntry({
          id: createRecordId("ledger-mercan-bonus", progress.state.id),
          roundId: progress.state.id,
          game: "kaptan-mercan",
          occurredAt: new Date().toISOString(),
          type: "payout",
          amount: progress.state.totalWin,
          balanceBefore,
          balanceAfter: balanceBefore + progress.state.totalWin,
          note: `Kaptan Mercan ücretsiz spin toplam ödemesi · ${progress.state.spinsPlayed} spin`,
        });
        void recordGameEvent({
          id: createRecordId("event-mercan-bonus-end", progress.state.id),
          roundId: progress.state.id,
          game: "kaptan-mercan",
          occurredAt: new Date().toISOString(),
          type: "bonus-session-completed",
          payload: {
            source: progress.state.source,
            spinsPlayed: progress.state.spinsPlayed,
            retriggeredSpins: progress.state.retriggeredSpins,
            captainsCollected: progress.state.captainsCollected,
            finalStage: progress.state.stage,
            finalUnlockedStage: progress.state.unlockedStage,
            finalMultiplier: progress.state.multiplier,
            modifiers: progress.state.modifiers,
            totalWin: progress.state.totalWin,
            wager,
          },
        });
        announce(
          mercanEventLine("bonusEnd", {
            ...context(next, progress.state),
            lastNet: progress.state.totalWin,
          }),
          true,
          "system-event",
          progress.state.id,
        );
        return;
      }
      setBonus(progress.state);
      setCaptainMeterDisplay(undefined);
      setSpinning(false);
      return;
    }

    if (next.grossPayout) setBalance((value) => value + next.grossPayout);
    const net = next.grossPayout - stake;
    setHistory((items) =>
      [
        {
          net,
          gross: next.grossPayout,
          note: resultNote(next, wager),
          bonus: false,
        },
        ...items,
      ].slice(0, 14),
    );
    recordRound(roundId, next, {
      stake,
      gross: next.grossPayout,
      net,
      balanceBefore,
      source: ante ? "ante-spin" : "paid-spin",
      startedAt,
    });
    if (next.bonusSpins) {
      setAutoRemaining(0);
      queueBonus({
        spins: next.bonusSpins,
        source: "natural",
        triggerRound: roundId,
      });
      audioRef.current.play("bubbles", 0.7);
      announce(
        mercanEventLine("scatter", context(next)),
        true,
        "system-event",
        roundId,
      );
    } else {
      const multiple = next.grossPayout / wager;
      if (multiple >= 10) {
        const title =
          multiple >= 100
            ? "EFSANE AVLAMA"
            : multiple >= 50
              ? "DEV VURGUN"
              : multiple >= 25
                ? "BÜYÜK YAKALAYIŞ"
                : "SAĞLAM AĞ";
        setWinTheatre({ title, amount: next.grossPayout, multiple });
        audioRef.current.play("collect", 0.72, 0.65);
      }
      const kind = net >= wager * 8 ? "bigWin" : net > 0 ? "win" : "loss";
      announce(
        mercanEventLine(kind, { ...context(next), lastNet: net }),
        !fromAuto || kind !== "loss",
        "system-event",
        roundId,
      );
    }
    setSpinning(false);
  };

  useEffect(() => {
    if (!bonus || spinning || bonusPending || bonusSummary || winTheatre) return;
    freeSpinTimer.current = window.setTimeout(
      () => {
        void playSpin(true);
      },
      turbo
        ? comfortableTurboStep * 4
        : slotTuning.presentation.normalStepMs * 3.4,
    );
    return () => window.clearTimeout(freeSpinTimer.current);
    // The timer is intentionally recreated from the newest bonus snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bonus?.id,
    bonus?.spinsRemaining,
    spinning,
    bonusPending,
    bonusSummary,
    winTheatre,
    turbo,
  ]);

  useEffect(() => {
    if (
      !autoRemaining ||
      spinning ||
      bonus ||
      bonusPending ||
      bonusSummary ||
      winTheatre
    )
      return;
    if (balance < paidStake) {
      setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(
      () => {
        void playSpin(false, true);
      },
      turbo ? 280 : 720,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoRemaining,
    spinning,
    balance,
    paidStake,
    turbo,
    bonus,
    bonusPending,
    bonusSummary,
    winTheatre,
  ]);

  useEffect(() => {
    if (!winTheatre) return;
    const timer = window.setTimeout(
      () => setWinTheatre(undefined),
      turbo ? 2600 : 5200,
    );
    return () => window.clearTimeout(timer);
  }, [winTheatre, turbo]);

  const startBonus = () => {
    if (!bonusPending || !bonusPickComplete) return;
    const next = createFisherBonus(
      `mercan-bonus-${Date.now()}-${crypto.randomUUID()}`,
      bonusPending.spins,
      bonusPending.source,
      bonusModifiers,
      mathTuning,
    );
    setBonusPending(undefined);
    setBonusPickCards([]);
    setBonus(next);
    setResult(undefined);
    announce(mercanEventLine("bonusStart"), true, "system-event", next.id);
    void recordGameEvent({
      id: createRecordId("event-mercan-bonus-start", next.id),
      roundId: next.id,
      game: "kaptan-mercan",
      occurredAt: new Date().toISOString(),
      type: "bonus-session-started",
      payload: {
        source: next.source,
        initialSpins: next.spinsRemaining,
        wager,
        purchaseCost: next.source === "buy" ? buyCost : 0,
        modifiers: next.modifiers,
        initialStage: next.stage,
        initialUnlockedStage: next.unlockedStage,
        initialMultiplier: next.multiplier,
        initialBatchSpins: next.currentBatchRemaining,
      },
    });
  };

  const buyBonus = async () => {
    if (
      spinning ||
      bonus ||
      bonusPending ||
      balance < buyCost ||
      !settings.features.bonusBuy
    )
      return;
    const startedAt = new Date().toISOString();
    const roundId = `mercan-buy-${Date.now()}-${crypto.randomUUID()}`;
    const balanceBefore = balance;
    setBalance((value) => value - buyCost);
    setAutoRemaining(0);
    const trigger = spinFisher(wager, {
      forceScatters: 3,
      tuning: mathTuning,
    });
    await animateReels(trigger.grid);
    setResult({
      ...trigger,
      grossPayout: 0,
      net: -buyCost,
      linePayout: 0,
      scatterPayout: 0,
    });
    setHistory((items) =>
      [
        { net: -buyCost, gross: 0, note: "Bonus satın alındı", bonus: false },
        ...items,
      ].slice(0, 14),
    );
    recordRound(roundId, trigger, {
      stake: buyCost,
      gross: 0,
      net: -buyCost,
      balanceBefore,
      source: "bonus-buy",
      startedAt,
    });
    queueBonus({
      spins: slotTuning.math.bonusBuySpins,
      source: "buy",
      triggerRound: roundId,
    });
    setSpinning(false);
    audioRef.current.play("bubbles", 0.75);
    announce(
      mercanEventLine("scatter", context(trigger)),
      true,
      "system-event",
      roundId,
    );
  };

  const changeWager = (value: number) => {
    if (spinning || bonus || bonusPending || autoRemaining) return;
    setWager(
      Math.max(
        settings.minBet,
        Math.floor((Number.isFinite(value) ? value : settings.minBet) / 5) * 5,
      ),
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
    setDraft("");
    setThinking(true);
    void recordAIConversation({
      id: createRecordId("ai-mercan-user", aiSessionRef.current),
      sessionId: aiSessionRef.current,
      game: "kaptan-mercan",
      character: "Mercan",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: context(),
    });
    const started = performance.now();
    const answer = await askMercan(prompt, {
      ...context(),
      recentMessages: recent
        .slice(-6)
        .map((message) => `${message.speaker}: ${message.text}`),
    });
    setThinking(false);
    setChat((items) =>
      [
        ...items,
        { speaker: "Mercan" as const, text: answer, moment: now() },
      ].slice(-24),
    );
    if (voiceEnabled) speakMercan(answer);
    void recordAIConversation({
      id: createRecordId("ai-mercan-answer", aiSessionRef.current),
      sessionId: aiSessionRef.current,
      game: "kaptan-mercan",
      character: "Mercan",
      speaker: "assistant",
      occurredAt: new Date().toISOString(),
      text: answer,
      context: context(),
      model: aiOnline ? "yerel-ollama" : "fallback",
      latencyMs: Math.round(performance.now() - started),
    });
  };

  return (
    <main
      className={`fisher-game ${bonus ? "bonus-mode" : ""} ${collecting ? "is-collecting" : ""}`}
    >
      <header className="fisher-topbar">
        <button
          onClick={() => {
            setTurbo(false);
            onBack();
          }}
        >
          ← <span>Slot Dünyası</span>
        </button>
        <div className="fisher-brand">
          <img src="/assets/fisherman/ottoman-ai/anchor-v1.png" alt="" />
          <span>
            KAPTAN MERCAN<small>OSMANLI GECE LİMANI · 5×4</small>
          </span>
        </div>
        <div className="fisher-top-actions">
          <GameMusicControls game="kaptan-mercan" />
          <div className="fisher-wallet">
            ✦ {money.format(balance)} <small>PR</small>
          </div>
        </div>
      </header>

      <section className="fisher-layout">
        <aside className="fisher-captain-panel">
          <div className="moon" />
          <div className="captain-scene">
            <img
              className="captain-avatar"
              src="/assets/fisherman/ottoman-ai/kaptan-mercan-host-v1.png"
              alt="Osmanlı denizcisi Kaptan Mercan"
            />
          </div>
          <div className="captain-copy">
            <small>GECE VARDİYASI · OSMANLI LİMANI</small>
            <h2>
              KAPTAN
              <br />
              MERCAN
            </h2>
            <p>{latestMercan}</p>
          </div>
          <div className="captain-stats">
            <span>
              <small>SPİN</small>
              <b>{spins}</b>
            </span>
            <span>
              <small>OTURUM NET</small>
              <b className={totalNet >= 0 ? "positive" : ""}>
                {totalNet > 0 ? "+" : totalNet < 0 ? "−" : ""}
                {money.format(Math.abs(totalNet))}
              </b>
            </span>
          </div>
          {slotTuning.presentation.progressHud && (
            <SlotProgressPanel
              game="kaptan-mercan"
              settings={slotTuning.progression}
              collectionEnabled={slotTuning.presentation.collectionBook}
            />
          )}
        </aside>

        <section className="fisher-machine">
          {anticipationCue && (
            <div className="fisher-anticipation" role="status">
              <i>✦</i>
              <strong>{anticipationCue}</strong>
            </div>
          )}
          <header className="fisher-machine-title">
            <div>
              <small>PEHLEVAN ROYALE SUNAR</small>
              <h1>
                KAPTAN <em>MERCAN</em>
              </h1>
              <p>HAZİNE BALIĞI · KAPTAN TOPLAMA · 20 ÇİZGİ</p>
            </div>
            {bonus ? (
              <div className="bonus-hud">
                <span>
                  <small>BU KADEME</small>
                  <b>{bonus.currentBatchRemaining}</b>
                </span>
                <span>
                  <small>TOPLAM KALAN</small>
                  <b>{bonus.spinsRemaining}</b>
                </span>
                <span>
                  <small>BONUS TOPLAMI</small>
                  <b>{money.format(bonus.totalWin)} PR</b>
                </span>
                <span>
                  <small>TOPLAMA</small>
                  <b>{bonus.multiplier}×</b>
                </span>
                {bonus.queuedBatches[0] && (
                  <span className="queued-batch">
                    <small>SIRADAKİ PAKET</small>
                    <b>{bonus.queuedBatches[0].multiplier}×</b>
                    <em>+{bonus.queuedBatches[0].spins} spin</em>
                  </span>
                )}
              </div>
            ) : (
              <div className="fener-chance">
                <small>FENER ŞANSI</small>
                <button
                  className={ante ? "active" : ""}
                  onClick={() => setAnte((value) => !value)}
                  disabled={spinning}
                >
                  {ante
                    ? `AÇIK · ${slotTuning.math.enhancedBetCostX.toLocaleString("tr-TR")}× BAHİS`
                    : "KAPALI"}
                </button>
              </div>
            )}
          </header>

          {bonus && (
            <div className="captain-progress">
              <header>
                <span>KAPTAN TOPLAMA ROTASI</span>
                <b>
                  {visibleCaptains}/{slotTuning.math.stageInterval * 3} KAPTAN
                </b>
              </header>
              <div className="captain-stage-track">
                {slotTuning.math.stageMultipliers
                  .slice(1, 4)
                  .map((stageMultiplier, index) => {
                    const target = slotTuning.math.stageInterval * (index + 1);
                    const stageStart = index * slotTuning.math.stageInterval;
                    return (
                      <section
                        className={
                          visibleCaptains >= target
                            ? "complete"
                            : visibleCaptains >= stageStart
                              ? "current"
                              : ""
                        }
                        key={target}
                      >
                        <div className="captain-medallions">
                          {Array.from({
                            length: slotTuning.math.stageInterval,
                          }).map((_, captainIndex) => {
                            const absoluteIndex = stageStart + captainIndex + 1;
                            return (
                              <i
                                className={
                                  visibleCaptains >= absoluteIndex ? "lit" : ""
                                }
                                key={absoluteIndex}
                              >
                                <img
                                  src="/assets/fisherman/ottoman-ai/captain-medallion-v2.png"
                                  alt=""
                                />
                                <small>{absoluteIndex}</small>
                              </i>
                            );
                          })}
                        </div>
                        <div className="stage-reward">
                          <span>{stageMultiplier}×</span>
                          <small>
                            +
                            {slotTuning.math.stageAwardSpins +
                              (bonus.modifiers["extra-spins"] ? 2 : 0)}{" "}
                            SPİN
                          </small>
                        </div>
                      </section>
                    );
                  })}
              </div>
              <p>
                Her kaptan görünür para balıklarını sırayla toplar. Dördüncü
                kaptan yeni seferleri ve sonraki çarpanı açar.
              </p>
            </div>
          )}

          <div className={`fisher-reel-window ${spinning ? "spinning" : ""}`}>
            <div className="water-caustics" aria-hidden="true" />
            {hooking && (
              <div className="hook-rescue">
                <i>⚓</i>
                <strong>KANCA KURTARMASI</strong>
                <span>Üçüncü fener güverteye çekiliyor</span>
              </div>
            )}
            <div className="fisher-reels">
              {[0, 1, 2, 3, 4].map((reel) => (
                <div
                  className={`fisher-reel ${rollingReels > 4 - reel ? "rolling" : ""}`}
                  style={{ "--reel-delay": reel } as React.CSSProperties}
                  key={reel}
                >
                  {grid.map((row, rowIndex) => {
                    const cell = row[reel];
                    const symbol = FISHER_SYMBOLS[cell.id];
                    const fishIndex =
                      result?.fishCells.findIndex(
                        (fish) => fish.row === rowIndex && fish.reel === reel,
                      ) ?? -1;
                    const captainIndex =
                      result?.captainCells.findIndex(
                        (captain) =>
                          captain.row === rowIndex && captain.reel === reel,
                      ) ?? -1;
                    return (
                      <div
                        className={`fisher-symbol symbol-${cell.id} ${winningCells.has(`${rowIndex}-${reel}`) ? "winner" : ""} ${collecting && cell.id === "money-fish" && fishIndex >= 0 && fishIndex < collectCount ? "collected" : ""} ${collectionStep?.activeCell === `${rowIndex}-${reel}` ? "collecting-current" : ""} ${collecting && cell.id === "captain" && captainIndex === collectionStep?.captainIndex ? "captain-collecting" : ""}`}
                        key={`${rowIndex}-${reel}`}
                      >
                        <img src={symbol.image} alt={symbol.label} />
                        {cell.id === "money-fish" && (
                          <b>
                            {money.format((cell.cashMultiplier ?? 0) * wager)}
                            <small>PR</small>
                          </b>
                        )}
                        {cell.id === "captain" && <span>KAPTAN</span>}
                        {cell.id === "scatter" && <span>FENER</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {collecting && result && (
              <div className="collection-theatre">
                <small>
                  KAPTAN{" "}
                  {Math.min(
                    result.captainCount,
                    (collectionStep?.captainIndex ?? 0) + 1,
                  )}
                  /{result.captainCount} · HAZİNE TOPLANIYOR
                </small>
                {result.fishValues.length ? (
                  <>
                    <div className="collection-ledger">
                      <span>
                        BALIK
                        <b>
                          +{money.format(collectionStep?.itemAmount ?? 0)} PR
                        </b>
                      </span>
                      <i>× {result.collectionMultiplier} TOPLAMA</i>
                    </div>
                    <strong>
                      {money.format(collectionStep?.runningAmount ?? 0)}
                      <i> PR</i>
                    </strong>
                    <p>SEFER KASASINA AKTARILAN</p>
                  </>
                ) : (
                  <>
                    <strong className="empty-catch">KAPTAN GELDİ</strong>
                    <p>
                      Görünür hazine balığı yok; kaptan sayacı yine ilerledi.
                    </p>
                  </>
                )}
              </div>
            )}
            {bonusFeatureCue && (
              <div className={`fisher-feature-cue feature-${bonusFeatureCue}`}>
                <i>
                  {bonusFeatureCue === "hook"
                    ? "⚓"
                    : bonusFeatureCue === "dynamite"
                      ? "✦"
                      : "☄"}
                </i>
                <strong>
                  {bonusFeatureCue === "hook"
                    ? "KANCAYLA HAZİNE"
                    : bonusFeatureCue === "dynamite"
                      ? "DİNAMİT AVI"
                      : "TOP SALVOSU"}
                </strong>
                <span>Kaçan para balıkları yeniden güverteye çağrıldı</span>
              </div>
            )}
          </div>

          <div
            className={`fisher-result ${result?.grossPayout ? "has-win" : ""}`}
          >
            {!result ? (
              <>
                <div>
                  <small>
                    {spinning
                      ? "AĞ SUDA"
                      : bonus
                        ? "ÜCRETSİZ SEFER HAZIR"
                        : "GECE ROTASI HAZIR"}
                  </small>
                  <strong>
                    {spinning
                      ? "Makaralar sırayla yanaşıyor…"
                      : "Bahsini seç, ağı suya bırak."}
                  </strong>
                </div>
                <b>
                  {bonus
                    ? `${bonus.multiplier}× TOPLAMA`
                    : `${money.format(paidStake)} PR SEFER`}
                </b>
              </>
            ) : (
              <>
                <div>
                  <small>
                    {result.bonusSpins
                      ? "FENERLER YANDI"
                      : result.collectedFishMultiplier
                        ? "KAPTAN TOPLADI"
                        : result.grossPayout
                          ? "BU SPİN ÖDEMESİ"
                          : "AĞ BOŞ"}
                  </small>
                  <strong>{resultNote(result, wager)}</strong>
                </div>
                <b>
                  {money.format(result.grossPayout)} <em>PR</em>
                </b>
              </>
            )}
          </div>

          <div className="fisher-controls">
            <button className="fisher-info" onClick={() => setRulesOpen(true)}>
              ⓘ<span>KURALLAR</span>
            </button>
            <button
              className="bonus-buy"
              onClick={() => void buyBonus()}
              disabled={
                spinning ||
                !!bonus ||
                !!bonusPending ||
                balance < buyCost ||
                !settings.features.bonusBuy
              }
            >
              <small>BONUS AL · {slotTuning.math.bonusBuyX}×</small>
              <b>{money.format(buyCost)} PR</b>
              <span>{slotTuning.math.bonusBuySpins} ücretsiz sefer</span>
            </button>
            <div className="fisher-bet">
              <small>TOPLAM BAHİS · ÜST SINIR YALNIZCA BAKİYE</small>
              <div>
                <button
                  onClick={() => changeWager(wager - step)}
                  disabled={spinning || wager <= settings.minBet}
                >
                  −
                </button>
                <label>
                  <input
                    aria-label="Kaptan Mercan toplam bahis"
                    type="number"
                    min={settings.minBet}
                    step="5"
                    value={wager}
                    onChange={(event) =>
                      changeWager(Number(event.target.value))
                    }
                    disabled={spinning || !!bonus}
                  />
                  <i>PR</i>
                </label>
                <button
                  onClick={() => changeWager(wager + step)}
                  disabled={spinning}
                >
                  +
                </button>
              </div>
              <label>
                ADIM
                <select
                  value={step}
                  onChange={(event) => setStep(Number(event.target.value))}
                >
                  {WAGER_STEPS.map((value) => (
                    <option value={value} key={value}>
                      {money.format(value)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() =>
                  changeWager(
                    maximumAffordableWager(
                      balance,
                      ante ? slotTuning.math.enhancedBetCostX : 1,
                      5,
                    ),
                  )
                }
              >
                MAX
              </button>
            </div>
            <button
              className={`fisher-spin ${spinning ? "is-stop" : ""}`}
              onClick={() => (spinning ? stopPresentation() : void playSpin())}
              disabled={
                !spinning &&
                (!!bonus ||
                  !!bonusPending ||
                  !!bonusSummary ||
                  balance < paidStake)
              }
            >
              <i>{spinning ? "■" : "↻"}</i>
              <span>{spinning ? "DUR" : "ÇEVİR"}</span>
            </button>
            <div className="fisher-toggles">
              <button
                className={turbo ? "active" : ""}
                onClick={() => setTurbo((value) => !value)}
              >
                ⚡<span>TURBO</span>
              </button>
              <button
                className={effectsEnabled ? "active" : ""}
                onClick={() => setEffectsEnabled((value) => !value)}
              >
                ♪<span>EFEKT</span>
              </button>
              <button
                className={voiceEnabled ? "active" : ""}
                onClick={() => setVoiceEnabled((value) => !value)}
              >
                ●<span>MERCAN</span>
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
                  disabled={spinning || !!bonus}
                >
                  {autoRemaining ? `DUR ${autoRemaining}` : "AUTO"}
                </button>
              </label>
            </div>
          </div>
        </section>

        <aside className="fisher-side">
          <section className="fisher-log">
            <header>
              <span>SEYİR DEFTERİ</span>
              <small>NET / BONUS AYRI</small>
            </header>
            {history.length ? (
              history.map((item, index) => (
                <article key={index}>
                  <i
                    className={item.net > 0 ? "up" : item.net < 0 ? "down" : ""}
                  >
                    {item.bonus
                      ? "B"
                      : item.net > 0
                        ? "+"
                        : item.net < 0
                          ? "−"
                          : "·"}
                  </i>
                  <div>
                    <strong>{item.note}</strong>
                    <small>
                      {item.bonus
                        ? "ücretsiz spin"
                        : `${money.format(item.gross)} PR dönüş`}
                    </small>
                  </div>
                  <b>
                    {item.net > 0 ? "+" : item.net < 0 ? "−" : ""}
                    {money.format(Math.abs(item.net))}
                  </b>
                </article>
              ))
            ) : (
              <p>İlk sefer bekleniyor.</p>
            )}
            <footer>
              <span>OTURUM NETİ</span>
              <b className={totalNet >= 0 ? "positive" : ""}>
                {totalNet > 0 ? "+" : totalNet < 0 ? "−" : ""}
                {money.format(Math.abs(totalNet))} PR
              </b>
            </footer>
          </section>
          <section className="mercan-chat">
            <header>
              <div>
                <span>Mercan ile konuş</span>
                <small>
                  {aiOnline ? "YEREL AI · OYUNU GÖRÜYOR" : "YEDEK KİŞİLİK"}
                </small>
              </div>
              <i className={aiOnline ? "online" : ""}>●</i>
            </header>
            <div>
              {chat.slice(-6).map((message, index) => (
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
                  <span>Mercan</span>
                  <p>Dur, ağzımdaki lafı düğümden çıkarıyorum…</p>
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
                placeholder="Mercan'a yaz…"
                disabled={thinking}
              />
              <button disabled={thinking} aria-label="Gönder">
                ↑
              </button>
            </form>
          </section>
        </aside>
      </section>

      {bonusPending && (
        <div className="fisher-modal-backdrop">
          <section
            className="bonus-ready bonus-pick-game"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <img
                src="/assets/fisherman/ottoman-ai/lighthouse-scatter-v1.png"
                alt=""
              />
              <div>
                <small>
                  {bonusPending.source === "buy"
                    ? "BONUS SATIN ALINDI"
                    : `${result?.scatterCount ?? 3} FENER YANDI`}
                </small>
                <h2>
                  SEFER <em>FERMANLARI</em>
                </h2>
                <p>
                  Bir ferman seç. Güçlendirmeler üst üste eklenir; eski çizme
                  açıldığında seçim biter ve {bonusPending.spins} ücretsiz gece
                  seferi hazır olur.
                </p>
              </div>
            </header>
            <div className="bonus-pick-grid">
              {bonusPickCards.map((card, index) => {
                const reward =
                  card.reward === "boot"
                    ? undefined
                    : modifierCopy[card.reward];
                return (
                  <button
                    className={`${card.revealed ? "revealed" : ""} ${card.reward === "boot" && card.revealed ? "boot" : ""}`}
                    disabled={card.revealed || bonusPickComplete}
                    onClick={() => revealBonusPick(card.id)}
                    key={card.id}
                  >
                    <span className="pick-card-back">
                      <i>MP</i>
                      <small>{index + 1}. FERMAN</small>
                    </span>
                    <span className="pick-card-face">
                      {reward ? (
                        <>
                          <img src={reward.icon} alt="" />
                          <b>{reward.title}</b>
                          <small>{reward.detail}</small>
                        </>
                      ) : (
                        <>
                          <i className="boot-icon">♜</i>
                          <b>ESKİ ÇİZME</b>
                          <small>Seçim tamamlandı; sefer başlıyor</small>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="picked-modifiers">
              {Object.entries(bonusModifiers)
                .filter(([, active]) => active)
                .map(([id]) => (
                  <span key={id}>
                    {modifierCopy[id as FisherBonusModifierId].title}
                  </span>
                ))}
              {!Object.values(bonusModifiers).some(Boolean) && (
                <small>Henüz güçlendirme açılmadı.</small>
              )}
            </div>
            <footer>
              <span>
                {bonusPickComplete
                  ? "Fermanlar mühürlendi. Sefer rotası hazır."
                  : "Çizme çıkana kadar bir ferman daha seç."}
              </span>
              <button onClick={startBonus} disabled={!bonusPickComplete}>
                {bonusPickComplete ? "SEFERE BAŞLA" : "FERMAN SEÇ"} <b>→</b>
              </button>
            </footer>
          </section>
        </div>
      )}
      {stageFlash && (
        <div className="stage-flash">
          <small>
            {stageFlash.queued ? "SIRAYA ALINDI" : "YENİ GÜVERTE BAŞLADI"}
          </small>
          <strong>{stageFlash.multiplier}×</strong>
          <span>
            {stageFlash.queued
              ? "MEVCUT KADEME BİTİNCE AÇILIR"
              : "TOPLAMA ÇARPANI ŞİMDİ AKTİF"}
          </span>
          <b>+{stageFlash.extra} SPİN PAKETİ</b>
        </div>
      )}
      {retriggerFlash && (
        <div className="stage-flash retrigger-flash" role="status">
          <small>FENERLER YENİDEN YANDI</small>
          <strong>+{retriggerFlash}</strong>
          <span>GECE SEFERİ UZADI</span>
          <b>FREE SPİN EKLENDİ</b>
        </div>
      )}
      {bonusSummary &&
        createPortal(
          <div className="fisher-bonus-result-backdrop">
            <section
              className="fisher-bonus-result"
              role="dialog"
              aria-modal="true"
            >
              <button
                className="close"
                aria-label="Free spin sonucunu kapat"
                onClick={() => {
                  setBonusSummary(undefined);
                  setResult(undefined);
                }}
              >
                ×
              </button>
              <small>GECE SEFERİ TAMAMLANDI</small>
              <h2>
                {money.format(bonusSummary.totalWin)} <em>PR</em>
              </h2>
              <p>
                {bonusSummary.spinsPlayed} ücretsiz spin ·{" "}
                {bonusSummary.captainsCollected} kaptan ·{" "}
                {bonusSummary.retriggeredSpins} uzatma · son toplama{" "}
                {bonusSummary.multiplier}×
              </p>
              <button
                onClick={() => {
                  setBonusSummary(undefined);
                  setResult(undefined);
                }}
              >
                LİMANA DÖN <span>→</span>
              </button>
            </section>
          </div>,
          document.body,
        )}
      {winTheatre &&
        createPortal(
          <div className="fisher-win-theatre-backdrop" role="presentation">
            <section
              className="fisher-win-theatre"
              role="dialog"
              aria-modal="true"
              aria-label="Büyük kazanç"
            >
              <button
                onClick={() => setWinTheatre(undefined)}
                aria-label="Kazanç ekranını kapat"
              >
                ×
              </button>
              <small>{winTheatre.title}</small>
              <strong>
                {money.format(winTheatre.amount)} <em>PR</em>
              </strong>
              <span>
                {winTheatre.multiple.toLocaleString("tr-TR", {
                  maximumFractionDigits: 1,
                })}
                × bahis dönüşü
              </span>
              <i>
                {turbo
                  ? "2,6 saniye sonra devam eder"
                  : "Devam etmek için kapat veya bekle"}
              </i>
            </section>
          </div>,
          document.body,
        )}
      {rulesOpen && (
        <div
          className="fisher-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="fisher-rules" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>KAPTAN MERCAN</small>
            <h2>Kurallar ve ödeme</h2>
            <div className="rule-grid">
              <article>
                <b>3 / 4 / 5 FENER</b>
                <p>
                  10 / 15 / 20 ücretsiz spin verir. Bonus yalnızca “Sefere
                  başla” düğmesiyle başlar.
                </p>
              </article>
              <article>
                <b>HAZİNE BALIĞI + KAPTAN</b>
                <p>
                  Balıkların üzerinde doğrudan PR tutarı yazar. Her kaptan
                  görünür balıkları tek tek toplar; ekranda iki kaptan varsa
                  aynı balık kasası iki kez toplanır.
                </p>
              </article>
              <article>
                <b>HER 4 KAPTAN</b>
                <p>
                  +10 spin ve sırasıyla 2×, 3×, 10× toplama çarpanı verir.
                  Bonusta 3 fener ayrıca +5 spin uzatır.
                </p>
              </article>
              <article>
                <b>KANCA KURTARMASI</b>
                <p>
                  Temel oyunda iki fener varsa nadiren üçüncü fener makaraya
                  çekilebilir.
                </p>
              </article>
              <article>
                <b>SEFER FERMANLARI</b>
                <p>
                  Bonus başlamadan daha fazla balık, daha fazla kaptan, daha çok
                  ekipman, +2 spin veya doğrudan 2× başlangıç açılabilir. Çizme
                  ferman seçimini bitirir.
                </p>
              </article>
              <article>
                <b>KANCA · DİNAMİT · TOP</b>
                <p>
                  Kaptan balıksız gelirse bu ekipmanlardan biri para balığı
                  çağırabilir. Dolu Cephanelik fermanı olasılığı yükseltir.
                </p>
              </article>
            </div>
            <div className="paytable">
              {Object.values(FISHER_SYMBOLS)
                .filter((symbol) => symbol.payouts)
                .map((symbol) => (
                  <article key={symbol.id}>
                    <img src={symbol.image} alt="" />
                    <span>
                      <b>{symbol.label}</b>
                      <small>3 / 4 / 5 aynı</small>
                    </span>
                    <strong>{symbol.payouts!.join("× · ")}×</strong>
                  </article>
                ))}
            </div>
            <footer>
              20 çizginin tamamı oynanır. Fener Şansı toplam bahsi 1,5× yapıp
              bonus sembolü sıklığını artırır. Bonus alımı{" "}
              {slotTuning.math.bonusBuyX}× bahistir. Yalnızca sanal PR
              kullanılır.
              <br />
              <small>
                Karakter, liman ve semboller bu proje için Imagegen ile özgün
                üretildi. Sesler: OpenGameArt · CC0 1.0.
              </small>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
