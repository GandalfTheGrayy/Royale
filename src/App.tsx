import { openingReward } from "./games/wagering";
import { reconcileWalletBalance } from "./auth/wallet-reconciliation";
import {
  useEffect,
  lazy,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  Suspense,
  type CSSProperties,
} from "react";
import { askVera, checkLocalAI } from "./ai/vera";
import {
  Card,
  createShoe,
  draw,
  formatCard,
  handValue,
  isBlackjack,
  shuffle,
} from "./lib/blackjack";
import {
  chooseFresh,
  classifyResult,
  hitLines,
  type LastHand,
  resultComment,
  shuffleLines,
  standLines,
} from "./lib/vera-commentary";
import {
  resolveSideBets,
  type SideBetKey,
  type SideBetResult,
} from "./lib/side-bets";
import { startLiveRoulette } from "./games/roulette/live-roulette";
import { startLiveAltinRota } from "./games/instant/live-altin-rota";
import {
  createRecordId,
  getCasinoSummary,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
} from "./data/casino-database";
import {
  getAdminSettings,
  subscribeAdminSettings,
  syncAdminSettings,
} from "./data/casino-admin";
import GameMusicControls from "./audio/GameMusicControls";
import { playGameSfx } from "./audio/game-sfx";
import { useGameAudioPreference } from "./audio/useGameAudioPreference";
import {
  CASINO_CHIP_VALUES,
  compactWager,
  normalizeWagerInput,
} from "./games/wagering";
import { useAuth } from "./auth/auth-client";
import { accountRequest } from "./auth/auth-api";
import CompetitionCenter, {
  LobbyCompetitionStrip,
} from "./components/CompetitionCenter";

type View =
  | "lobby"
  | "competition"
  | "blackjack"
  | "roulette"
  | "poker"
  | "slots"
  | "instant";
const InstantWorld = lazy(() => import("./games/instant/InstantWorld"));
const RouletteRoom = lazy(() => import("./games/roulette/RouletteRoom"));
const SlotWorld = lazy(() => import("./games/slots/SlotWorld"));
const PokerRoom = lazy(() => import("./games/poker/PokerRoom"));
const CasinoResearch = lazy(() => import("./components/CasinoResearch"));
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const AccountCenter = lazy(() => import("./auth/AccountCenter"));
type Phase =
  "idle" | "dealing" | "insurance" | "player" | "dealer" | "complete";
type DealerMotion = "idle" | "shuffle" | "deal" | "speak";
type Message = { speaker: "Vera" | "Sen"; text: string; moment: string };
type BetTarget = "main" | SideBetKey;
type HistoryMark = "W" | "L" | "P" | "M" | "BJ";
type RoundFinance = {
  stake: number;
  sideReturn: number;
  returns: number;
  net: number;
  settled: boolean;
};

interface Round {
  deck: Card[];
  playerHands: Card[][];
  handBets: number[];
  activeHand: number;
  dealer: Card[];
  insuranceBet: number;
  phase: Phase;
  outcome?: string;
}

const storageKey = (userId: string) => `pehlevan-royale-profile-v2:${userId}`;
const voiceServerUrl = (
  (import.meta.env.VITE_VOICE_URL as string | undefined) ?? "/api/local-voice"
).replace(/\/$/, "");
const money = new Intl.NumberFormat("tr-TR");
const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
const chipValues = CASINO_CHIP_VALUES;
const emptyFinance: RoundFinance = {
  stake: 0,
  sideReturn: 0,
  returns: 0,
  net: 0,
  settled: false,
};

const lines = {
  welcome: "Hoş geldin Muharrem. Ben Vera. Hazırsan başlayalım.",
};

function pickFemaleVoice(voices: SpeechSynthesisVoice[]) {
  const femaleNames =
    /emel|aylin|selin|filiz|zira|susan|samantha|aria|jenny|female|kadın/i;
  const maleNames = /ahmet|tolga|david|mark|male|erkek/i;
  return (
    [...voices].sort((a, b) => {
      const score = (voice: SpeechSynthesisVoice) => {
        const turkish = voice.lang.toLocaleLowerCase().startsWith("tr");
        const female = femaleNames.test(voice.name);
        const male = maleNames.test(voice.name);
        return (
          (turkish ? 100 : 0) +
          (female ? 80 : 0) -
          (male ? 160 : 0) +
          (voice.default ? 2 : 0)
        );
      };
      return score(b) - score(a);
    })[0] ?? null
  );
}

function speechText(text: string) {
  return text.replace(/^\s*\([^)]{1,120}\)\s*/g, "").replace(/[“”"]/g, "");
}

function loadProfile(userId: string): { hands: number; wins: number } {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : { hands: 0, wins: 0 };
  } catch {
    return { hands: 0, wins: 0 };
  }
}

function playSound(file: "shuffle" | "slide" | "chip", volume = 0.55) {
  const settings = getAdminSettings();
  if (!settings.general.masterSound || !settings.games.blackjack.sound) return;
  playGameSfx("blackjack",`/assets/audio/${file === "shuffle" ? "card-shuffle" : file === "slide" ? "card-slide" : "chip-lay"}.ogg`,volume);
}

function cardImagePath(card: Card) {
  const suits = {
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs",
  } as const;
  const ranks: Record<Card["rank"], string> = {
    A: "ace",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "5",
    "6": "6",
    "7": "7",
    "8": "8",
    "9": "9",
    "10": "10",
    J: "jack",
    Q: "queen",
    K: "king",
  };
  const suit = suits[card.suit];
  return `/assets/cards/opendecks-game/card fronts/${suit}/${ranks[card.rank]} of ${suit}.png`;
}

function splitValue(card: Card) {
  if (["10", "J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return Number(card.rank);
}

function CasinoChip({
  value,
  interactive = false,
  disabled = false,
  onClick,
}: {
  value: number;
  interactive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="chip-edge" />
      <span className="chip-center">
        <small>MP</small>
        <strong>{compactWager(value)}</strong>
      </span>
    </>
  );
  if (interactive)
    return (
      <button
        className={`casino-chip chip-${value}`}
        disabled={disabled}
        onClick={onClick}
        aria-label={`${value} PR çip ekle`}
      >
        {content}
      </button>
    );
  return (
    <span className={`casino-chip chip-${value}`} aria-hidden="true">
      {content}
    </span>
  );
}

function compactChipStack(chips: number[], visibleLimit = 7) {
  return {
    hiddenCount: Math.max(0, chips.length - visibleLimit),
    visible: chips.slice(-visibleLimit),
  };
}

function payoutChipStack(amount: number, visibleLimit = 7) {
  let remaining = Math.max(0, Math.floor(amount));
  const payoutChips: number[] = [];
  const denominations = [...chipValues].sort((a, b) => b - a);
  for (const denomination of denominations) {
    const count = Math.floor(remaining / denomination);
    for (let index = 0; index < count; index += 1)
      payoutChips.push(denomination);
    remaining -= count * denomination;
  }
  if (remaining > 0) payoutChips.push(remaining);
  return compactChipStack(payoutChips, visibleLimit);
}

function PlayingCard({
  card,
  hidden = false,
  revealed = false,
  order = 0,
}: {
  card?: Card;
  hidden?: boolean;
  revealed?: boolean;
  order?: number;
}) {
  const style = { "--deal-order": order } as CSSProperties;
  if (hidden || !card)
    return (
      <div
        className="playing-card back dealt"
        style={style}
        aria-label="Kapalı kart"
      >
        <span className="card-back-seal">MP</span>
      </div>
    );
  return (
    <div
      className={`playing-card dealt ${revealed ? "revealed" : ""}`}
      style={style}
      aria-label={formatCard(card)}
    >
      <img
        src={cardImagePath(card)}
        alt=""
        draggable="false"
        decoding="async"
      />
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  const [saved] = useState(() => loadProfile(user.id));
  const adminSettings = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const [view, setView] = useState<View>("lobby");
  const [balance, setBalance] = useState(user.balance);
  const serverWalletRef = useRef({ balance: user.balance, acknowledgedDelta: user.walletAcknowledgedDelta ?? 0 });
  const [hands, setHands] = useState(saved.hands);
  const [wins, setWins] = useState(saved.wins);
  const [profileReady, setProfileReady] = useState(false);
  const [betChips, setBetChips] = useState<number[]>(() => [
    [...chipValues]
      .filter((chip) => chip >= adminSettings.games.blackjack.minBet)
      .sort(
        (a, b) =>
          Math.abs(a - adminSettings.games.blackjack.defaultBet) -
          Math.abs(b - adminSettings.games.blackjack.defaultBet),
      )[0] ?? chipValues.at(-1)!,
  ]);
  const [customBetChip, setCustomBetChip] = useState(1_000_000);
  const [sideBetChips, setSideBetChips] = useState<
    Record<SideBetKey, number[]>
  >({ perfectPairs: [], twentyOneThree: [] });
  const [betTarget, setBetTarget] = useState<BetTarget>("main");
  const [round, setRound] = useState<Round>({
    deck: [],
    playerHands: [[]],
    handBets: [adminSettings.games.blackjack.defaultBet],
    activeHand: 0,
    dealer: [],
    insuranceBet: 0,
    phase: "idle",
  });
  const [lastHand, setLastHand] = useState<LastHand | undefined>();
  const [relationship, setRelationship] = useState<"flirty" | "lover">(
    "flirty",
  );
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Vera", text: lines.welcome, moment: now() },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [dealerMotion, setDealerMotion] = useState<DealerMotion>("idle");
  const [aiOnline, setAiOnline] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "blackjack",
    "ai-voice",
  );
  const [femaleVoice, setFemaleVoice] = useState<SpeechSynthesisVoice | null>(
    null,
  );
  const [turkishVoiceOnline, setTurkishVoiceOnline] = useState(false);
  const [flyingChips, setFlyingChips] = useState<
    Array<{ value: number; id: number; target: BetTarget }>
  >([]);
  const [sideBetResults, setSideBetResults] = useState<SideBetResult[]>([]);
  const [mainSettlementReturn, setMainSettlementReturn] = useState(0);
  const [settlementVisualsVisible, setSettlementVisualsVisible] =
    useState(false);
  const [lastBetChips, setLastBetChips] = useState<number[]>([]);
  const [lastSideBetChips, setLastSideBetChips] = useState<
    Record<SideBetKey, number[]>
  >({ perfectPairs: [], twentyOneThree: [] });
  const [bonusCelebration, setBonusCelebration] =
    useState<SideBetResult | null>(null);
  const [history, setHistory] = useState<HistoryMark[]>([]);
  const [streak, setStreak] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [roundFinance, setRoundFinance] = useState<RoundFinance>(emptyFinance);
  const [animatedNet, setAnimatedNet] = useState(0);
  const [roundMoneyDismissed, setRoundMoneyDismissed] = useState(false);
  const [rebetting, setRebetting] = useState(false);
  const [balancePulse, setBalancePulse] = useState<"credit" | "debit" | null>(
    null,
  );
  const [researchOpen, setResearchOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const veraAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRequestRef = useRef(0);
  useEffect(()=>()=>{
    voiceRequestRef.current+=1;
    const audio=veraAudioRef.current;
    if(audio){
      audio.pause();
      if(audio.src.startsWith("blob:"))URL.revokeObjectURL(audio.src);
      audio.removeAttribute("src");
      veraAudioRef.current=null;
    }
    window.speechSynthesis?.cancel();
  },[]);
  const lastGameLineRef = useRef("");
  const financeRef = useRef<RoundFinance>(emptyFinance);
  const previousBalanceRef = useRef(balance);
  const blackjackRoundRef = useRef({ id: "", startedAt: "", balanceBefore: 0, openingBoost: 0 });
  const blackjackAiSessionRef = useRef(
    `ai-blackjack-${Date.now()}-${crypto.randomUUID()}`,
  );
  const blackjackActionsRef = useRef<Array<Record<string, unknown>>>([]);
  const settlementClearTimerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (settlementClearTimerRef.current !== undefined)
        window.clearTimeout(settlementClearTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const previous = serverWalletRef.current;
    const acknowledgedDelta = user.walletAcknowledgedDelta ?? 0;
    serverWalletRef.current = { balance: user.balance, acknowledgedDelta };
    setBalance(current => reconcileWalletBalance(current, previous.balance, user.balance, acknowledgedDelta - previous.acknowledgedDelta));
  }, [user.balance, user.walletAcknowledgedDelta]);

  useEffect(() => {
    setProfileReady(true);
    void syncAdminSettings();
    void getCasinoSummary("me").then((summary) => {
      setHands(summary.playedRounds);
      setWins(summary.wins);
    });
  }, [user.id]);

  useEffect(() => {
    if (!profileReady) return;
    localStorage.setItem(storageKey(user.id), JSON.stringify({ hands, wins }));
  }, [hands, profileReady, user.id, wins]);
  useEffect(() => {
    if (adminSettings.games.blackjack.features.sideBets) return;
    setSideBetChips({ perfectPairs: [], twentyOneThree: [] });
    setBetTarget("main");
  }, [adminSettings.games.blackjack.features.sideBets]);
  useEffect(() => {
    const stopRoulette = startLiveRoulette();
    const stopAltinRota = startLiveAltinRota();
    return () => {
      stopRoulette();
      stopAltinRota();
    };
  }, []);
  useEffect(() => {
    void checkLocalAI().then(setAiOnline);
  }, []);
  useEffect(() => {
    void fetch(`${voiceServerUrl}/health`, {
      signal: AbortSignal.timeout(1500),
    })
      .then((response) => setTurkishVoiceOnline(response.ok))
      .catch(() => setTurkishVoiceOnline(false));
  }, []);
  useEffect(() => {
    if (!roundFinance.settled) {
      setAnimatedNet(0);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const duration = 1050;
    const animate = (time: number) => {
      const progress = Math.min(1, (time - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedNet(Math.round(roundFinance.returns * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [roundFinance.returns, roundFinance.settled]);
  useEffect(() => {
    const previous = previousBalanceRef.current;
    previousBalanceRef.current = balance;
    if (previous === balance) return;
    const direction = balance > previous ? "credit" : "debit";
    setBalancePulse(null);
    const start = window.setTimeout(() => setBalancePulse(direction), 20);
    const stop = window.setTimeout(() => setBalancePulse(null), 900);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(stop);
    };
  }, [balance]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoice = () =>
      setFemaleVoice(pickFemaleVoice(window.speechSynthesis.getVoices()));
    loadVoice();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoice);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoice);
  }, []);

  const bet = betChips.reduce((total, value) => total + value, 0);
  const pendingBet = flyingChips.reduce((total, chip) => total + chip.value, 0);
  const sideBets: Record<SideBetKey, number> = {
    perfectPairs: sideBetChips.perfectPairs.reduce(
      (total, value) => total + value,
      0,
    ),
    twentyOneThree: sideBetChips.twentyOneThree.reduce(
      (total, value) => total + value,
      0,
    ),
  };
  const pendingByTarget = (target: BetTarget) =>
    flyingChips
      .filter((chip) => chip.target === target)
      .reduce((total, chip) => total + chip.value, 0);
  const sideBetTotal = sideBets.perfectPairs + sideBets.twentyOneThree;
  const totalWager = bet + sideBetTotal;
  const lastTableWager =
    lastBetChips.reduce((sum, value) => sum + value, 0) +
    lastSideBetChips.perfectPairs.reduce((sum, value) => sum + value, 0) +
    lastSideBetChips.twentyOneThree.reduce((sum, value) => sum + value, 0);
  const activeTargetBet = betTarget === "main" ? bet : sideBets[betTarget];
  const betTargetLabel =
    betTarget === "main"
      ? "Ana bahis"
      : betTarget === "perfectPairs"
        ? "Perfect Pairs"
        : "21+3";
  const potentialReturn =
    betTarget === "perfectPairs" && activeTargetBet
      ? `${money.format(activeTargetBet * 7)}–${money.format(activeTargetBet * 26)} PR`
      : betTarget === "twentyOneThree" && activeTargetBet
        ? `${money.format(activeTargetBet * 6)}–${money.format(activeTargetBet * 101)} PR`
        : null;
  const activePlayer = round.playerHands[round.activeHand] ?? [];
  const playerValue = handValue(activePlayer);
  const currentHandBet = round.handBets[round.activeHand] ?? bet;
  const canDouble =
    round.phase === "player" &&
    activePlayer.length === 2 &&
    balance >= currentHandBet;
  const canSplit =
    adminSettings.games.blackjack.features.split &&
    round.phase === "player" &&
    round.playerHands.length === 1 &&
    activePlayer.length === 2 &&
    splitValue(activePlayer[0]) === splitValue(activePlayer[1]) &&
    balance >= currentHandBet;
  const canSurrender =
    adminSettings.games.blackjack.features.surrender &&
    round.phase === "player" &&
    round.playerHands.length === 1 &&
    activePlayer.length === 2;
  const tableLimit = balance;
  const shoeRemaining = round.deck.length || 312;
  const shoePercent = Math.round((shoeRemaining / 312) * 100);
  const perfectPairsStatus = sideBetResults.find(
    (result) => result.key === "perfectPairs",
  );
  const twentyOneThreeStatus = sideBetResults.find(
    (result) => result.key === "twentyOneThree",
  );

  const updateFinance = (next: RoundFinance) => {
    financeRef.current = next;
    setRoundFinance(next);
  };

  const addFinanceStake = (amount: number) => {
    const current = financeRef.current;
    updateFinance({
      ...current,
      stake: current.stake + amount,
      net: current.returns - current.stake - amount,
    });
  };
  const dealerValue = handValue(round.dealer);
  const dealerVisible = round.phase === "complete" || round.phase === "dealer";
  const dealerShownTotal = dealerVisible
    ? dealerValue.total
    : handValue(round.dealer.slice(0, 1)).total;
  const winRate = hands ? Math.round((wins / hands) * 100) : 0;
  const lastVeraMessage =
    [...chat].reverse().find((message) => message.speaker === "Vera")?.text ??
    lines.welcome;

  const tableStatus = useMemo(() => {
    if (round.phase === "idle")
      return "Bahsini yerleştir. Vera hazır olduğunda kartları karacak.";
    if (round.phase === "dealing") return "Kartlar dağıtılıyor…";
    if (round.phase === "insurance")
      return "Krupiye as gösteriyor. Sigorta kararını bekliyor.";
    if (round.phase === "player")
      return round.playerHands.length > 1
        ? `Sıra sende · ${round.activeHand + 1}. el / ${round.playerHands.length}`
        : "Sıra sende.";
    if (round.phase === "dealer") return "Vera kapalı kartını açıyor…";
    return round.outcome ?? "El tamamlandı.";
  }, [round]);
  const lockedMainStake = round.handBets.reduce((sum, wager) => sum + wager, 0);
  const lockedStackMultiplier =
    round.phase === "idle" || bet <= 0
      ? 1
      : Math.max(1, Math.round(lockedMainStake / bet));
  const chipsOnTable = Array.from(
    { length: lockedStackMultiplier },
    () => betChips,
  ).flat();
  const settlementTableCleared =
    round.phase === "complete" && !settlementVisualsVisible;
  const mainChipStack = compactChipStack(
    settlementTableCleared ? [] : chipsOnTable,
  );
  const mainTableOutcome =
    round.phase !== "complete"
      ? "active"
      : history[0] === "W" || history[0] === "BJ"
        ? "win"
        : history[0] === "P"
          ? "push"
          : history[0] === "M"
            ? "mixed"
            : "loss";
  const perfectPairsChipStack = compactChipStack(
    settlementTableCleared ? [] : sideBetChips.perfectPairs,
    5,
  );
  const twentyOneThreeChipStack = compactChipStack(
    settlementTableCleared ? [] : sideBetChips.twentyOneThree,
    5,
  );
  const mainReturnChipStack = payoutChipStack(mainSettlementReturn);
  const sideBetVisualsReady =
    round.phase === "complete" && settlementVisualsVisible;
  const perfectPairsVisualStatus = sideBetVisualsReady
    ? perfectPairsStatus
    : undefined;
  const twentyOneThreeVisualStatus = sideBetVisualsReady
    ? twentyOneThreeStatus
    : undefined;
  const perfectPairsReturnStack = payoutChipStack(
    perfectPairsStatus?.payout ?? 0,
    5,
  );
  const twentyOneThreeReturnStack = payoutChipStack(
    twentyOneThreeStatus?.payout ?? 0,
    5,
  );

  const speakWithBrowser = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText(text));
    utterance.lang = "tr-TR";
    utterance.voice = femaleVoice;
    utterance.rate = 0.97;
    utterance.pitch = 1.04;
    window.speechSynthesis.speak(utterance);
  };

  const speakVera = async (text: string) => {
    const requestId = ++voiceRequestRef.current;
    window.speechSynthesis?.cancel();
    veraAudioRef.current?.pause();
    try {
      const response = await fetch(`${voiceServerUrl}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: speechText(text) }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error("Türkçe ses servisi çevrimdışı.");
      const audioUrl = URL.createObjectURL(await response.blob());
      if (requestId !== voiceRequestRef.current || !voiceEnabled) {
        URL.revokeObjectURL(audioUrl);
        return;
      }
      const audio = new Audio(audioUrl);
      veraAudioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
      setTurkishVoiceOnline(true);
    } catch {
      setTurkishVoiceOnline(false);
      if (requestId === voiceRequestRef.current && voiceEnabled)
        speakWithBrowser(text);
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled((enabled) => {
      if (enabled) {
        voiceRequestRef.current += 1;
        veraAudioRef.current?.pause();
        window.speechSynthesis?.cancel();
      }
      return !enabled;
    });
  };

  const say = (
    text: string,
    speaker: "Vera" | "Sen" = "Vera",
    animate = true,
    aiKind: "assistant" | "system-event" = "system-event",
    latencyMs?: number,
  ) => {
    setChat((messages) => [
      ...messages.slice(-11),
      { speaker, text, moment: now() },
    ]);
    void recordAIConversation({
      id: createRecordId(
        "ai-blackjack",
        blackjackRoundRef.current.id || blackjackAiSessionRef.current,
      ),
      sessionId: blackjackAiSessionRef.current,
      roundId: blackjackRoundRef.current.id || undefined,
      game: "blackjack",
      character: "Vera",
      speaker: speaker === "Sen" ? "user" : aiKind,
      occurredAt: new Date().toISOString(),
      text,
      context: {
        phase: round.phase,
        balance,
        playerTotal: activePlayer.length ? playerValue.total : null,
        dealerShowing: round.dealer[0] ? formatCard(round.dealer[0]) : null,
        relationship,
        totalWager,
        handCount: round.playerHands.length,
      },
      model:
        aiKind === "assistant"
          ? aiOnline
            ? "local-ai"
            : "fallback-persona"
          : undefined,
      latencyMs,
    });
    if (speaker === "Vera") {
      if (voiceEnabled) void speakVera(text);
      if (animate) {
        setDealerMotion("speak");
        window.setTimeout(
          () => setDealerMotion("idle"),
          Math.min(6500, Math.max(2400, text.length * 48)),
        );
      }
    }
  };

  const sayGame = (options: string[], animate = true) => {
    const line = chooseFresh(options, lastGameLineRef.current);
    lastGameLineRef.current = line;
    say(line, "Vera", animate);
    return line;
  };

  const trackBlackjackAction = (
    type: string,
    payload: Record<string, unknown> = {},
  ) => {
    blackjackActionsRef.current.push({
      sequence: blackjackActionsRef.current.length + 1,
      type,
      occurredAt: new Date().toISOString(),
      ...payload,
    });
  };

  const settle = (
    playerHands: Card[][],
    dealer: Card[],
    handBets: number[],
    forced?: "blackjack" | "dealerBlackjack" | "push",
    insurancePayout = 0,
  ) => {
    const d = handValue(dealer).total;
    const results = playerHands.map((player, index) => {
      let handForced = forced;
      if (
        forced === "dealerBlackjack" &&
        playerHands.length === 1 &&
        isBlackjack(player)
      )
        handForced = "push";
      if (forced === "blackjack" && index > 0) handForced = undefined;
      return classifyResult(player, dealer, handForced);
    });
    const p = handValue(playerHands[0]).total;
    const result = results[0];
    const completedHand: LastHand = {
      playerTotal: p,
      dealerTotal: d,
      playerCards: playerHands[0].map(formatCard),
      dealerCards: dealer.map(formatCard),
      result,
      bet: handBets[0],
    };
    let mainAward = 0;
    let award = insurancePayout;
    let won = false;
    results.forEach((handResult, index) => {
      const wager = handBets[index];
      if (handResult === "player-blackjack") {
        mainAward += Math.floor(wager * 2.5);
        won = true;
      } else if (handResult === "push") mainAward += wager;
      else if (handResult === "win" || handResult === "dealer-bust") {
        mainAward += wager * 2;
        won = true;
      }
    });
    const openingBonus = openingReward(financeRef.current.sideReturn + mainAward + insurancePayout, financeRef.current.stake, blackjackRoundRef.current.openingBoost);
    mainAward += openingBonus;
    award += mainAward;
    setMainSettlementReturn(mainAward);
    const finance = financeRef.current;
    const totalReturns = finance.sideReturn + mainAward + insurancePayout;
    updateFinance({
      ...finance,
      returns: totalReturns,
      net: totalReturns - finance.stake,
      settled: true,
    });
    const outcome =
      playerHands.length === 1
        ? `${insurancePayout ? `Sigorta ödedi; ${money.format(insurancePayout)} PR geri geldi. ` : ""}${chooseFresh(resultComment(completedHand), lastGameLineRef.current)}`
        : results
            .map((handResult, index) => {
              const total = handValue(playerHands[index]).total;
              const label = index === 0 ? "İlk el" : "İkinci el";
              if (handResult === "win" || handResult === "dealer-bust")
                return `${label} ${total} ile kazandı`;
              if (handResult === "push")
                return `${label} ${total} ile berabere`;
              if (handResult === "player-bust")
                return `${label} ${total}’ye geçti`;
              return `${label} ${total} ile kaybetti`;
            })
            .join("; ") + `. Benim toplamım ${d}.`;
    lastGameLineRef.current = outcome;
    setBalance((value) => value + award);
    setHands((value) => value + 1);
    if (won) setWins((value) => value + 1);
    const mainStake = handBets.reduce((total, wager) => total + wager, 0);
    const historyMark: HistoryMark =
      results[0] === "player-blackjack" && playerHands.length === 1
        ? "BJ"
        : playerHands.length > 1 &&
            results.some(
              (value) => value === "win" || value === "dealer-bust",
            ) &&
            results.some((value) => value === "lose" || value === "player-bust")
          ? "M"
          : mainAward > mainStake
            ? "W"
            : mainAward === mainStake
              ? "P"
              : "L";
    setHistory((entries) => [historyMark, ...entries].slice(0, 8));
    setStreak((value) =>
      historyMark === "W" || historyMark === "BJ"
        ? value + 1
        : historyMark === "P"
          ? value
          : 0,
    );
    setLastHand(completedHand);
    setSettlementVisualsVisible(true);
    setRound((state) => ({
      ...state,
      playerHands,
      handBets,
      dealer,
      phase: "complete",
      outcome,
    }));
    if (settlementClearTimerRef.current !== undefined)
      window.clearTimeout(settlementClearTimerRef.current);
    // The chips are the settlement receipt. Clear the stacks and their labels
    // together only after the house-collection / player-return motion ends.
    settlementClearTimerRef.current = window.setTimeout(() => {
      setSettlementVisualsVisible(false);
      setBetChips([]);
      setSideBetChips({ perfectPairs: [], twentyOneThree: [] });
      setMainSettlementReturn(0);
      setSideBetResults([]);
      settlementClearTimerRef.current = undefined;
    }, 2400);
    say(outcome);
    const tracked = blackjackRoundRef.current;
    const settledAt = new Date().toISOString();
    const net = totalReturns - finance.stake;
    if (tracked.id) {
      void recordGameRound({
        id: `round:${tracked.id}`,
        roundId: tracked.id,
        game: "blackjack",
        variant: "Vera’s Private Table · 6 deste · yan bahisler",
        source: "player",
        playerParticipated: true,
        startedAt: tracked.startedAt,
        settledAt,
        stake: finance.stake,
        grossPayout: totalReturns,
        net,
        outcome: net > 0 ? "win" : net < 0 ? "loss" : "push",
        balanceBefore: tracked.balanceBefore,
        balanceAfter: tracked.balanceBefore + net,
        result: {
          telemetryVersion: 2,
          ruleset: "european-6-deck-s17-v1",
          playerHands: playerHands.map((hand) => hand.map(formatCard)),
          playerTotals: playerHands.map((hand) => handValue(hand).total),
          dealer: dealer.map(formatCard),
          dealerTotal: d,
          handResults: results,
          handBets,
          insurancePayout,
          sideBets: sideBetResults,
          actions: blackjackActionsRef.current,
          grossReturn: totalReturns,
          net,
          winMultiple: finance.stake ? totalReturns / finance.stake : 0,
        },
        modifiers: {
          openingBonus,
          openingBoost: tracked.openingBoost,
          initialMainBet: bet,
          sideBets,
          insuranceBet: round.insuranceBet,
          split: playerHands.length > 1,
          blackjack: results.includes("player-blackjack"),
          forced: forced ?? null,
        },
      });
      void recordWalletEntry({
        id: createRecordId("ledger-stake", tracked.id),
        roundId: tracked.id,
        game: "blackjack",
        occurredAt: tracked.startedAt,
        type: "stake",
        amount: -finance.stake,
        balanceBefore: tracked.balanceBefore,
        balanceAfter: tracked.balanceBefore - finance.stake,
        note: "Blackjack ana, yan, double/split ve sigorta bahisleri",
      });
      if (totalReturns)
        void recordWalletEntry({
          id: createRecordId("ledger-payout", tracked.id),
          roundId: tracked.id,
          game: "blackjack",
          occurredAt: settledAt,
          type: "payout",
          amount: totalReturns,
          balanceBefore: tracked.balanceBefore - finance.stake,
          balanceAfter: tracked.balanceBefore + net,
          note: "Blackjack el ödemesi",
        });
      void recordGameEvent({
        id: createRecordId("event-settle", tracked.id),
        roundId: tracked.id,
        game: "blackjack",
        occurredAt: settledAt,
        type: "hand-settled",
        payload: { results, net, outcome },
      });
      blackjackRoundRef.current = { id: "", startedAt: "", balanceBefore: 0, openingBoost: 0 };
    }
  };

  const dealerTurn = async (
    playerHands: Card[][],
    startingDealer: Card[],
    startingDeck: Card[],
    handBets: number[],
    insuranceBet = 0,
  ) => {
    setRound((state) => ({ ...state, playerHands, handBets, phase: "dealer" }));
    setDealerMotion("deal");
    playSound("slide");
    await wait(1150);
    let dealer = [...startingDealer];
    let deck = [...startingDeck];
    while (
      playerHands.some((hand) => handValue(hand).total <= 21) &&
      handValue(dealer).total < 17
    ) {
      const next = draw(deck);
      dealer = [...dealer, next.card];
      deck = next.deck;
      setRound((state) => ({ ...state, dealer, deck, phase: "dealer" }));
      setDealerMotion("deal");
      playSound("slide");
      await wait(1050);
    }
    setDealerMotion("idle");
    await wait(700);
    settle(playerHands, dealer, handBets, undefined, insuranceBet);
  };

  const advanceOrDealer = async (
    playerHands: Card[][],
    handBets: number[],
    deck: Card[],
    completedHand: number,
  ) => {
    const nextHand = completedHand + 1;
    if (nextHand < playerHands.length) {
      setRound((state) => ({
        ...state,
        playerHands,
        handBets,
        deck,
        activeHand: nextHand,
        phase: "player",
      }));
      say(
        `İlk eli kapattık. Şimdi ikinci elin: toplam ${handValue(playerHands[nextHand]).total}.`,
      );
      return;
    }
    await dealerTurn(
      playerHands,
      round.dealer,
      deck,
      handBets,
      round.insuranceBet,
    );
  };

  const dealRound = async () => {
    if (
      ["dealing", "dealer", "insurance"].includes(round.phase) ||
      flyingChips.length
    )
      return;
    if (bet <= 0) return say("Önce masaya bir çip koyman lazım.");
    if (bet < adminSettings.games.blackjack.minBet)
      return say(
        `Bu masanın minimum ana bahsi ${money.format(adminSettings.games.blackjack.minBet)} PR.`,
      );
    if (balance < totalWager)
      return say("Ana bahis ve yan bahislerin toplamı için jeton yetmiyor.");
    if (settlementClearTimerRef.current !== undefined) {
      window.clearTimeout(settlementClearTimerRef.current);
      settlementClearTimerRef.current = undefined;
    }
    setLastBetChips([...betChips]);
    setLastSideBetChips({
      perfectPairs: [...sideBetChips.perfectPairs],
      twentyOneThree: [...sideBetChips.twentyOneThree],
    });
    setSettlementVisualsVisible(false);
    const needsShuffle = round.deck.length < 62;
    const shoe = needsShuffle ? shuffle(createShoe(6)) : round.deck;
    setRoundMoneyDismissed(false);
    const startedAt = new Date().toISOString();
    blackjackRoundRef.current = {
      openingBoost: getAdminSettings().games.blackjack.openingPayoutBoost ?? 0,
      id: `blackjack-${Date.now()}-${crypto.randomUUID()}`,
      startedAt,
      balanceBefore: balance,
    };
    blackjackActionsRef.current = [
      {
        sequence: 1,
        type: "bet-locked",
        occurredAt: startedAt,
        mainBet: bet,
        sideBets,
        totalWager,
      },
    ];
    updateFinance({
      stake: totalWager,
      sideReturn: 0,
      returns: 0,
      net: -totalWager,
      settled: false,
    });
    setBalance((value) => value - totalWager);
    setSideBetResults([]);
    setMainSettlementReturn(0);
    setBonusCelebration(null);
    setRound({
      deck: shoe,
      playerHands: [[]],
      handBets: [bet],
      activeHand: 0,
      dealer: [],
      insuranceBet: 0,
      phase: "dealing",
    });
    if (needsShuffle) {
      setDealerMotion("shuffle");
      sayGame(shuffleLines(lastHand), false);
      playSound("shuffle", 0.7);
      await wait(1150);
    } else {
      setDealerMotion("deal");
      sayGame(
        [
          "Shoe devam ediyor. Kartlar soğumadan yeni eli açıyorum.",
          "Deste hâlâ sıcak. Aynı shoe’dan devam ediyoruz.",
          "Kesme kartına daha var. Yeni el geliyor.",
        ],
        false,
      );
      await wait(420);
    }
    let deck = shoe;
    const player: Card[] = [];
    const dealer: Card[] = [];
    for (const recipient of ["player", "dealer", "player", "dealer"] as const) {
      const next = draw(deck);
      deck = next.deck;
      if (recipient === "player") player.push(next.card);
      else dealer.push(next.card);
      trackBlackjackAction("card-dealt", {
        recipient,
        card: formatCard(next.card),
        order: player.length + dealer.length,
      });
      setDealerMotion("deal");
      playSound("slide", 0.5);
      setRound({
        deck,
        playerHands: [[...player]],
        handBets: [bet],
        activeHand: 0,
        dealer: [...dealer],
        insuranceBet: 0,
        phase: "dealing",
      });
      await wait(820);
    }
    setDealerMotion("idle");
    const resolvedSideBets = resolveSideBets(
      player,
      dealer[0],
      adminSettings.games.blackjack.features.sideBets
        ? sideBets
        : { perfectPairs: 0, twentyOneThree: 0 },
    );
    setSideBetResults(resolvedSideBets);
    const bonusWin = [...resolvedSideBets]
      .filter((result) => result.won)
      .sort((a, b) => b.payout - a.payout)[0];
    const sideBetAward = resolvedSideBets.reduce(
      (total, result) => total + result.payout,
      0,
    );
    const financeAfterSideBets = financeRef.current;
    updateFinance({
      ...financeAfterSideBets,
      sideReturn: sideBetAward,
      returns: sideBetAward,
      net: sideBetAward - financeAfterSideBets.stake,
    });
    if (sideBetAward > 0) setBalance((value) => value + sideBetAward);
    if (bonusWin) {
      setBonusCelebration(bonusWin);
      playSound("chip", 0.95);
      say(
        `${bonusWin.label} tuttu: ${bonusWin.hand}, ${bonusWin.odds}:1! ${money.format(bonusWin.payout)} PR masaya geri geldi.`,
      );
      window.setTimeout(
        () =>
          setBonusCelebration((current) =>
            current?.key === bonusWin.key ? null : current,
          ),
        4600,
      );
    }
    if (
      dealer[0].rank === "A" &&
      adminSettings.games.blackjack.features.insurance
    ) {
      setRound({
        deck,
        playerHands: [player],
        handBets: [bet],
        activeHand: 0,
        dealer,
        insuranceBet: 0,
        phase: "insurance",
      });
      say(
        `Açık kartım as. ${money.format(Math.floor(bet / 2))} PR sigorta ister misin?`,
        "Vera",
        true,
      );
      return;
    }
    const playerNatural = isBlackjack(player);
    const dealerNatural = isBlackjack(dealer);
    if (playerNatural || dealerNatural) {
      setRound({
        deck,
        playerHands: [player],
        handBets: [bet],
        activeHand: 0,
        dealer,
        insuranceBet: 0,
        phase: "dealing",
      });
      await wait(500);
      if (playerNatural && dealerNatural)
        settle([player], dealer, [bet], "push");
      else if (playerNatural) settle([player], dealer, [bet], "blackjack");
      else settle([player], dealer, [bet], "dealerBlackjack");
      return;
    }
    setRound({
      deck,
      playerHands: [player],
      handBets: [bet],
      activeHand: 0,
      dealer,
      insuranceBet: 0,
      phase: "player",
    });
  };

  const placePreviousBet = async () => {
    if (round.phase !== "complete" || rebetting || flyingChips.length) return;
    const repeatedTotal =
      lastBetChips.reduce((sum, value) => sum + value, 0) +
      lastSideBetChips.perfectPairs.reduce((sum, value) => sum + value, 0) +
      lastSideBetChips.twentyOneThree.reduce((sum, value) => sum + value, 0);
    if (!lastBetChips.length || repeatedTotal > balance) {
      say("Son bahsi yeniden yerleştirmek için bakiye yeterli değil.");
      return;
    }
    setRebetting(true);
    if (settlementClearTimerRef.current !== undefined) {
      window.clearTimeout(settlementClearTimerRef.current);
      settlementClearTimerRef.current = undefined;
    }
    setSettlementVisualsVisible(false);
    setMainSettlementReturn(0);
    setSideBetResults([]);
    setBonusCelebration(null);
    setBetChips([...lastBetChips]);
    setSideBetChips({
      perfectPairs: [...lastSideBetChips.perfectPairs],
      twentyOneThree: [...lastSideBetChips.twentyOneThree],
    });
    setRound((state) => ({
      ...state,
      playerHands: [[]],
      activeHand: 0,
      dealer: [],
      insuranceBet: 0,
      phase: "idle",
      outcome: undefined,
    }));
    playSound("chip", 0.72);
    await wait(360);
    setRebetting(false);
  };

  const resolveInsurance = async (takeInsurance: boolean) => {
    if (round.phase !== "insurance") return;
    const wager = Math.floor(round.handBets[0] / 2);
    if (takeInsurance && balance < wager)
      return say("Sigorta için yeterli jetonun yok.");
    if (takeInsurance) {
      addFinanceStake(wager);
      setBalance((value) => value - wager);
      playSound("chip", 0.7);
    }
    const insuranceBet = takeInsurance ? wager : 0;
    trackBlackjackAction("insurance-decision", {
      taken: takeInsurance,
      wager: insuranceBet,
    });
    const dealerNatural = isBlackjack(round.dealer);
    const playerNatural = isBlackjack(round.playerHands[0]);
    setRound((state) => ({ ...state, insuranceBet }));
    await wait(650);
    if (dealerNatural) {
      settle(
        round.playerHands,
        round.dealer,
        round.handBets,
        playerNatural ? "push" : "dealerBlackjack",
        takeInsurance ? wager * 3 : 0,
      );
      return;
    }
    say(
      takeInsurance
        ? "Sigortayı aldın ama blackjack bende değil. Sigorta gitti; ana el devam ediyor."
        : "Sigorta yok. Güzel, ana ele devam ediyoruz.",
    );
    if (playerNatural)
      settle(round.playerHands, round.dealer, round.handBets, "blackjack");
    else setRound((state) => ({ ...state, phase: "player", insuranceBet }));
  };

  const hit = async () => {
    if (round.phase !== "player") return;
    const next = draw(round.deck);
    const player = [...activePlayer, next.card];
    const playerHands = round.playerHands.map((hand, index) =>
      index === round.activeHand ? player : hand,
    );
    const total = handValue(player).total;
    trackBlackjackAction("hit", {
      handIndex: round.activeHand,
      card: formatCard(next.card),
      total,
    });
    setDealerMotion("deal");
    playSound("slide");
    setRound((state) => ({
      ...state,
      playerHands,
      deck: next.deck,
      phase: "dealing",
    }));
    sayGame(hitLines(next.card, total), false);
    await wait(850);
    setDealerMotion("idle");
    if (total >= 21)
      await advanceOrDealer(
        playerHands,
        round.handBets,
        next.deck,
        round.activeHand,
      );
    else setRound((state) => ({ ...state, phase: "player" }));
  };

  const stand = async () => {
    if (round.phase !== "player") return;
    trackBlackjackAction("stand", {
      handIndex: round.activeHand,
      total: playerValue.total,
    });
    setRound((state) => ({ ...state, phase: "dealing" }));
    sayGame(standLines(playerValue.total, round.dealer[0]), false);
    await wait(650);
    await advanceOrDealer(
      round.playerHands,
      round.handBets,
      round.deck,
      round.activeHand,
    );
  };

  const doubleDown = async () => {
    const currentBet = round.handBets[round.activeHand];
    if (
      round.phase !== "player" ||
      activePlayer.length !== 2 ||
      balance < currentBet
    )
      return;
    addFinanceStake(currentBet);
    setBalance((value) => value - currentBet);
    const next = draw(round.deck);
    const player = [...activePlayer, next.card];
    const playerHands = round.playerHands.map((hand, index) =>
      index === round.activeHand ? player : hand,
    );
    const handBets = round.handBets.map((wager, index) =>
      index === round.activeHand ? wager * 2 : wager,
    );
    trackBlackjackAction("double", {
      handIndex: round.activeHand,
      addedStake: currentBet,
      card: formatCard(next.card),
      total: handValue(player).total,
    });
    setDealerMotion("deal");
    playSound("chip");
    await wait(180);
    playSound("slide");
    setRound((state) => ({
      ...state,
      playerHands,
      handBets,
      deck: next.deck,
      phase: "dealing",
    }));
    sayGame(
      [
        `Bahsi ikiye katladın; ${formatCard(next.card)} geldi ve toplamın ${handValue(player).total}. Artık bu elle yaşayacağız.`,
        `${formatCard(next.card)} tek hakkındı. Bahis iki kat, elin şimdi ${handValue(player).total}.`,
      ],
      false,
    );
    await wait(600);
    await advanceOrDealer(playerHands, handBets, next.deck, round.activeHand);
  };

  const splitHand = async () => {
    const currentBet = round.handBets[0];
    if (
      round.phase !== "player" ||
      round.playerHands.length !== 1 ||
      activePlayer.length !== 2 ||
      splitValue(activePlayer[0]) !== splitValue(activePlayer[1]) ||
      balance < currentBet
    )
      return;
    addFinanceStake(currentBet);
    setBalance((value) => value - currentBet);
    setRound((state) => ({ ...state, phase: "dealing" }));
    playSound("chip", 0.75);
    const first = draw(round.deck);
    const second = draw(first.deck);
    const playerHands = [
      [activePlayer[0], first.card],
      [activePlayer[1], second.card],
    ];
    const handBets = [currentBet, currentBet];
    trackBlackjackAction("split", {
      addedStake: currentBet,
      sourceCards: activePlayer.map(formatCard),
      resultingCards: playerHands.map((hand) => hand.map(formatCard)),
    });
    setDealerMotion("deal");
    playSound("slide");
    await wait(750);
    setRound((state) => ({
      ...state,
      playerHands: [playerHands[0], [activePlayer[1]]],
      handBets,
      deck: first.deck,
      activeHand: 0,
    }));
    setDealerMotion("deal");
    playSound("slide");
    await wait(750);
    setRound((state) => ({
      ...state,
      playerHands,
      handBets,
      deck: second.deck,
      activeHand: 0,
      phase: "player",
    }));
    setDealerMotion("idle");
    say(
      `Eli ikiye böldün. İlk el ${handValue(playerHands[0]).total}, ikinci el ${handValue(playerHands[1]).total}; önce soldakini oynuyoruz. İki elin kararını da ayrı ayrı vereceksin.`,
    );
  };

  const surrender = () => {
    if (!canSurrender) return;
    const wager = round.handBets[0];
    const refund = Math.floor(wager / 2);
    trackBlackjackAction("surrender", {
      wager,
      refund,
      total: playerValue.total,
    });
    const completedHand: LastHand = {
      playerTotal: playerValue.total,
      dealerTotal: handValue(round.dealer).total,
      playerCards: activePlayer.map(formatCard),
      dealerCards: round.dealer.map(formatCard),
      result: "surrender",
      bet: wager,
    };
    const outcome = `Eli teslim ettin; ${money.format(refund)} PR geri döndü. Bazen yarısını kurtarmak, tamamını masada bırakmaktan iyidir.`;
    const finance = financeRef.current;
    const totalReturns = finance.sideReturn + refund;
    updateFinance({
      ...finance,
      returns: totalReturns,
      net: totalReturns - finance.stake,
      settled: true,
    });
    setMainSettlementReturn(refund);
    setBalance((value) => value + refund);
    setHands((value) => value + 1);
    setStreak(0);
    setHistory((entries) => ["L" as HistoryMark, ...entries].slice(0, 8));
    setLastHand(completedHand);
    setRound((state) => ({ ...state, phase: "complete", outcome }));
    say(outcome);
    const tracked = blackjackRoundRef.current;
    const settledAt = new Date().toISOString();
    const net = totalReturns - finance.stake;
    if (tracked.id) {
      void recordGameRound({
        id: `round:${tracked.id}`,
        roundId: tracked.id,
        game: "blackjack",
        variant: "Vera’s Private Table · 6 deste · yan bahisler",
        source: "player",
        playerParticipated: true,
        startedAt: tracked.startedAt,
        settledAt,
        stake: finance.stake,
        grossPayout: totalReturns,
        net,
        outcome: net < 0 ? "loss" : net > 0 ? "win" : "push",
        balanceBefore: tracked.balanceBefore,
        balanceAfter: tracked.balanceBefore + net,
        result: {
          telemetryVersion: 2,
          ruleset: "european-6-deck-s17-v1",
          playerHands: [activePlayer.map(formatCard)],
          playerTotals: [playerValue.total],
          dealer: round.dealer.map(formatCard),
          dealerTotal: handValue(round.dealer).total,
          handResults: ["surrender"],
          handBets: [wager],
          sideBets: sideBetResults,
          actions: blackjackActionsRef.current,
          grossReturn: totalReturns,
          net,
          winMultiple: finance.stake ? totalReturns / finance.stake : 0,
        },
        modifiers: { initialMainBet: bet, sideBets, surrender: true },
      });
      void recordWalletEntry({
        id: createRecordId("ledger-stake", tracked.id),
        roundId: tracked.id,
        game: "blackjack",
        occurredAt: tracked.startedAt,
        type: "stake",
        amount: -finance.stake,
        balanceBefore: tracked.balanceBefore,
        balanceAfter: tracked.balanceBefore - finance.stake,
        note: "Blackjack bahsi",
      });
      if (totalReturns)
        void recordWalletEntry({
          id: createRecordId("ledger-payout", tracked.id),
          roundId: tracked.id,
          game: "blackjack",
          occurredAt: settledAt,
          type: "payout",
          amount: totalReturns,
          balanceBefore: tracked.balanceBefore - finance.stake,
          balanceAfter: tracked.balanceBefore + net,
          note: "Teslim iadesi ve yan bahis dönüşü",
        });
      blackjackRoundRef.current = { id: "", startedAt: "", balanceBefore: 0, openingBoost: 0 };
    }
  };

  const sendChat = async () => {
    const question = draft.trim();
    if (!question || thinking) return;
    const relationshipForTurn =
      /(biz sevgiliyiz|sevgiliyiz biz|sevgilim|ben senin sevgilinim|sen benim sevgilimsin)/i.test(
        question,
      )
        ? "lover"
        : relationship;
    if (relationshipForTurn !== relationship)
      setRelationship(relationshipForTurn);
    say(question, "Sen");
    setDraft("");
    setThinking(true);
    const aiStartedAt = performance.now();
    const answer = await askVera(question, {
      playerTotal: activePlayer.length ? playerValue.total : undefined,
      dealerShowing: round.dealer[0] ? formatCard(round.dealer[0]) : undefined,
      phase: round.phase,
      balance,
      lastHand,
      relationship: relationshipForTurn,
      recentMessages: chat
        .slice(-5)
        .map((message) => `${message.speaker}: ${message.text}`),
    });
    setThinking(false);
    say(
      answer,
      "Vera",
      true,
      "assistant",
      Math.round(performance.now() - aiStartedAt),
    );
    setAiOnline(await checkLocalAI());
  };

  const addChips = async () => {
    if (user.role !== "owner") return;
    const result = await accountRequest<{ balance: number; version: number }>(
      `/api/admin/accounts/users/${encodeURIComponent(user.id)}/wallet`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: 2500,
          reason: "Muharrem Pehlevan eğlence bakiyesi ekledi",
        }),
      },
    );
    window.dispatchEvent(
      new CustomEvent("pehlevan-wallet-updated", {
        detail: { userId: user.id, balance: result.balance, version: result.version },
      }),
    );
    playSound("chip");
    say("Tamam, 2.500 jeton ekledim.");
  };

  const addBetChip = (value: number) => {
    const target = betTarget;
    const startsFreshLayout = round.phase === "complete";
    const currentTableWager = startsFreshLayout ? 0 : totalWager;
    if (target === "main" && value < adminSettings.games.blackjack.minBet)
      return;
    if (target !== "main" && !adminSettings.games.blackjack.features.sideBets)
      return;
    if (
      !["idle", "complete"].includes(round.phase) ||
      currentTableWager + pendingBet + value > tableLimit
    )
      return;
    if (startsFreshLayout) {
      if (settlementClearTimerRef.current !== undefined) {
        window.clearTimeout(settlementClearTimerRef.current);
        settlementClearTimerRef.current = undefined;
      }
      setSettlementVisualsVisible(false);
      setBetChips([]);
      setSideBetChips({ perfectPairs: [], twentyOneThree: [] });
      setMainSettlementReturn(0);
      setSideBetResults([]);
      setBonusCelebration(null);
      setRound((state) => ({
        ...state,
        playerHands: [[]],
        activeHand: 0,
        dealer: [],
        insuranceBet: 0,
        phase: "idle",
        outcome: undefined,
      }));
    }
    setRoundMoneyDismissed(true);
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFlyingChips((chips) => [...chips, { value, id, target }]);
    playSound("chip", 0.72);
    window.setTimeout(() => {
      if (target === "main") setBetChips((chips) => [...chips, value]);
      else
        setSideBetChips((bets) => ({
          ...bets,
          [target]: [...bets[target], value],
        }));
      setFlyingChips((chips) => chips.filter((chip) => chip.id !== id));
      playSound("chip", 0.5);
    }, 720);
  };

  const clearBet = () => {
    if (!["idle", "complete"].includes(round.phase) || flyingChips.length)
      return;
    setRoundMoneyDismissed(true);
    if (betTarget === "main") setBetChips([]);
    else setSideBetChips((bets) => ({ ...bets, [betTarget]: [] }));
    playSound("chip", 0.35);
  };

  const clearAllBets = () => {
    if (!["idle", "complete"].includes(round.phase) || flyingChips.length)
      return;
    setRoundMoneyDismissed(true);
    setBetChips([]);
    setSideBetChips({ perfectPairs: [], twentyOneThree: [] });
    playSound("chip", 0.35);
  };

  const Brand = () => (
    <button className="brand" onClick={() => setView("lobby")}>
      <span className="brand-mark">MP</span>
      <span>
        PEHLEVAN <em>ROYALE</em>
      </span>
    </button>
  );

  if (adminOpen && ["owner", "admin"].includes(user.role))
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <div className="room-loading">Yönetim hazırlanıyor…</div>
          </main>
        }
      >
        <AdminPanel
          balance={balance}
          setBalance={setBalance}
          onClose={() => setAdminOpen(false)}
        />
      </Suspense>
    );

  if (view === "competition")
    return <CompetitionCenter onExit={() => setView("lobby")} />;

  if (view === "lobby")
    return (
      <main className="app-shell lobby">
        <header className="topbar">
          <Brand />
          <div className="topbar-actions">
            {["owner", "admin"].includes(user.role) && (
              <button
                className="voice-toggle admin-trigger"
                onClick={() => setAdminOpen(true)}
              >
                ⚙ YÖNETİM
              </button>
            )}
            <button
              className="voice-toggle competition-trigger"
              onClick={() => setView("competition")}
            >
              ♛ REKABET
            </button>
            <button
              className="voice-toggle research-trigger"
              onClick={() => setResearchOpen(true)}
            >
              ▦ VERİ KASASI
            </button>
            <button
              className="voice-toggle"
              title={
                turkishVoiceOnline
                  ? "Emel · Türkçe kadın sesi"
                  : (femaleVoice?.name ?? "Tarayıcı yedek sesi")
              }
              onClick={toggleVoice}
              aria-pressed={voiceEnabled}
            >
              {voiceEnabled
                ? `🔊 ${turkishVoiceOnline ? "EMEL · TR" : "KADIN SES"}`
                : "🔇 SES KAPALI"}
            </button>
            <span
              className={`balance-chip ${balancePulse ? `balance-${balancePulse}` : ""}`}
            >
              ✦ {money.format(balance)} <small>PR</small>
            </span>
            <button
              className="voice-toggle account-logout"
              onClick={() => setAccountOpen(true)}
              title={`${user.displayName} hesap ayarları`}
            >
              HESAP
            </button>
          </div>
        </header>
        <div className="lobby-atrium">
          <div className="lobby-main-column">
            <section className="lobby-hero">
              <div className="lobby-hero-content">
                <p className="eyebrow">PEHLEVAN ROYALE · ÖZEL SALON</p>
                <h1>
                  Geceye
                  <br />
                  <i>hükmünü koy.</i>
                </h1>
                <p className="hero-copy">
                  Beş kapı, tek kasa. Masanı seç, hesabını büyüt ve bu salonun
                  zirvesine adını yazdır.
                </p>
                <div className="lobby-hero-tags">
                  <span>KASA TACI</span>
                  <span>REKOR MASASI</span>
                  <span>SEZON HESABI</span>
                </div>
                <div className="lobby-hero-actions">
                  <button
                    className="gold-button"
                    disabled={
                      !adminSettings.games.blackjack.enabled ||
                      adminSettings.general.maintenanceMode
                    }
                    onClick={() => setView("blackjack")}
                  >
                    {adminSettings.games.blackjack.enabled &&
                    !adminSettings.general.maintenanceMode
                      ? "İlk masaya otur"
                      : "Masa bakımda"}{" "}
                    <span>→</span>
                  </button>
                  <button
                    className="lobby-secondary-action"
                    onClick={() => setView("competition")}
                  >
                    SALON HESABINI AÇ
                  </button>
                </div>
              </div>
              <div className="lobby-house-stamp" aria-hidden="true">
                <small>GECE NÖBETİ</small>
                <b>SALON AÇIK</b>
              </div>
            </section>
            <div className="lobby-lower-deck">
              <LobbyCompetitionStrip onOpen={() => setView("competition")} />
              <div className="lobby-salon-directory">
                <header className="lobby-section-heading">
                  <div>
                    <small>SALON KAPILARI</small>
                    <h2>Hesabını seç.</h2>
                  </div>
                  <p>Beş ayrı kat. Tek kasa, tek kariyer.</p>
                </header>
                <section className="salon-grid" aria-label="Casino salonları">
                  <button
                    className={`salon-card blackjack-entry ${adminSettings.games.blackjack.enabled && !adminSettings.general.maintenanceMode ? "active" : ""}`}
                    disabled={
                      !adminSettings.games.blackjack.enabled ||
                      adminSettings.general.maintenanceMode
                    }
                    onClick={() => setView("blackjack")}
                  >
                    <span className="salon-number">01 · CANLI MASA</span>
                    <img
                      className="salon-sigil"
                      src="/assets/lobby-premium/blackjack-muhur-v1.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <strong>Gece Masası</strong>
                    <small>
                      BLACKJACK ·{" "}
                      {adminSettings.games.blackjack.enabled &&
                      !adminSettings.general.maintenanceMode
                        ? "AÇIK"
                        : "BAKIMDA"}
                    </small>
                    <i>→</i>
                  </button>
                  <button
                    className={`salon-card slots-entry ${(adminSettings.games["kiraz-77"].enabled || adminSettings.games["neon-kasasi"].enabled || adminSettings.games["kaptan-mercan"].enabled || adminSettings.games["sekerhane-1024"].enabled || adminSettings.games["allahin-lutfu"].enabled || adminSettings.games["baykus-madeni"].enabled) && !adminSettings.general.maintenanceMode ? "active" : ""}`}
                    disabled={
                      adminSettings.general.maintenanceMode ||
                      (!adminSettings.games["kiraz-77"].enabled &&
                        !adminSettings.games["neon-kasasi"].enabled &&
                        !adminSettings.games["kaptan-mercan"].enabled &&
                        !adminSettings.games["sekerhane-1024"].enabled &&
                        !adminSettings.games["allahin-lutfu"].enabled &&
                        !adminSettings.games["baykus-madeni"].enabled)
                    }
                    onClick={() => setView("slots")}
                  >
                    <span className="salon-number">02 · SLOT DÜNYASI</span>
                    <img
                      className="salon-sigil"
                      src="/assets/lobby-premium/slot-muhur-v1.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <strong>Makineler Katı</strong>
                    <small>
                      9 MAKİNE ·{" "}
                      {adminSettings.general.maintenanceMode
                        ? "BAKIMDA"
                        : `${Number(adminSettings.games["kiraz-77"].enabled) + Number(adminSettings.games["neon-kasasi"].enabled) + Number(adminSettings.games["kaptan-mercan"].enabled) + Number(adminSettings.games["sekerhane-1024"].enabled) + Number(adminSettings.games["allahin-lutfu"].enabled) + Number(adminSettings.games["baykus-madeni"].enabled)}'Ü AÇIK`}
                    </small>
                    <i>→</i>
                  </button>
                  <button
                    className={`salon-card roulette-entry ${adminSettings.games.roulette.enabled && !adminSettings.general.maintenanceMode ? "active" : ""}`}
                    disabled={
                      !adminSettings.games.roulette.enabled ||
                      adminSettings.general.maintenanceMode
                    }
                    onClick={() => setView("roulette")}
                  >
                    <span className="salon-number">03 · CANLI ÇARK</span>
                    <img
                      className="salon-sigil"
                      src="/assets/lobby-premium/rulet-muhur-v1.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <strong>Kırmızı Çark</strong>
                    <small>
                      AVRUPA RULETİ ·{" "}
                      {adminSettings.games.roulette.enabled &&
                      !adminSettings.general.maintenanceMode
                        ? "AÇIK"
                        : "BAKIMDA"}
                    </small>
                    <i>→</i>
                  </button>
                  <button
                    className={`salon-card poker-entry ${adminSettings.games.poker.enabled && !adminSettings.general.maintenanceMode ? "active" : ""}`}
                    disabled={
                      !adminSettings.games.poker.enabled ||
                      adminSettings.general.maintenanceMode
                    }
                    onClick={() => setView("poker")}
                  >
                    <span className="salon-number">04 · POKER KULÜBÜ</span>
                    <img
                      className="salon-sigil"
                      src="/assets/lobby-premium/poker-muhur-v1.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <strong>Midnight Poker</strong>
                    <small>
                      2 OYUN MODU ·{" "}
                      {adminSettings.games.poker.enabled &&
                      !adminSettings.general.maintenanceMode
                        ? "AÇIK"
                        : "BAKIMDA"}
                    </small>
                    <i>→</i>
                  </button>
                  <button
                    className={`salon-card instant-entry ${(adminSettings.games["altin-rota"].enabled || adminSettings.games.limbo.enabled || adminSettings.games["obsidyen-damari"].enabled || adminSettings.games.mines.enabled || adminSettings.games.keno.enabled || adminSettings.games["son-on"].enabled || adminSettings.games.plinko.enabled || adminSettings.games.hilo.enabled || adminSettings.games["yedi-cevher"].enabled) && !adminSettings.general.maintenanceMode ? "active" : ""}`}
                    disabled={
                      (!adminSettings.games["altin-rota"].enabled &&
                        !adminSettings.games.limbo.enabled &&
                        !adminSettings.games["obsidyen-damari"].enabled &&
                        !adminSettings.games.mines.enabled &&
                        !adminSettings.games.keno.enabled &&
                        !adminSettings.games["son-on"].enabled &&
                        !adminSettings.games.plinko.enabled &&
                        !adminSettings.games.hilo.enabled &&
                        !adminSettings.games["yedi-cevher"].enabled) ||
                      adminSettings.general.maintenanceMode
                    }
                    onClick={() => setView("instant")}
                  >
                    <span className="salon-number">05 · ANLIK OYUNLAR</span>
                    <img
                      className="salon-sigil"
                      src="/assets/lobby-premium/anlik-muhur-v1.png"
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <strong>Hızlı Oyunlar</strong>
                    <small>
                      CRASH · LIMBO · OBSİDYEN · MINES · KENO · COUNTDOWN · PLINKO · HILO · YEDİ CEVHER · 9 OYUN ·{" "}
                      {(adminSettings.games["altin-rota"].enabled ||
                        adminSettings.games.limbo.enabled ||
                        adminSettings.games["obsidyen-damari"].enabled ||
                        adminSettings.games.mines.enabled ||
                        adminSettings.games.keno.enabled ||
                        adminSettings.games["son-on"].enabled ||
                        adminSettings.games.plinko.enabled ||
                        adminSettings.games.hilo.enabled ||
                        adminSettings.games["yedi-cevher"].enabled) &&
                      !adminSettings.general.maintenanceMode
                        ? "AÇIK"
                        : "BAKIMDA"}
                    </small>
                    <i>→</i>
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
        <footer className="lobby-footer">
          <span>SADECE EĞLENCE İÇİN · SANAL JETON</span>
          <span>
            {hands} el · %{winRate} kazanma oranı
          </span>
        </footer>
        {researchOpen && (
          <Suspense fallback={null}>
            <CasinoResearch onClose={() => setResearchOpen(false)} />
          </Suspense>
        )}
        {accountOpen && (
          <Suspense fallback={null}>
            <AccountCenter onClose={() => setAccountOpen(false)} />
          </Suspense>
        )}
      </main>
    );

  if (view === "roulette")
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <div className="room-loading">Rulet masası hazırlanıyor…</div>
          </main>
        }
      >
        <RouletteRoom
          balance={balance}
          setBalance={setBalance}
          onExit={() => setView("lobby")}
          aiOnline={
            aiOnline &&
            adminSettings.general.aiEnabled &&
            adminSettings.games.roulette.aiHost
          }
        />
      </Suspense>
    );
  if (view === "slots")
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <div className="room-loading">Slot dünyası hazırlanıyor…</div>
          </main>
        }
      >
        <SlotWorld
          balance={balance}
          setBalance={setBalance}
          onExit={() => setView("lobby")}
          aiOnline={aiOnline && adminSettings.general.aiEnabled}
        />
      </Suspense>
    );
  if (view === "poker")
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <div className="room-loading">Poker masası hazırlanıyor…</div>
          </main>
        }
      >
        <PokerRoom
          balance={balance}
          setBalance={setBalance}
          onExit={() => setView("lobby")}
          aiOnline={
            aiOnline &&
            adminSettings.general.aiEnabled &&
            adminSettings.games.poker.aiHost
          }
        />
      </Suspense>
    );
  if (view === "instant")
    return (
      <Suspense
        fallback={
          <main className="app-shell">
            <div className="room-loading">Anlık oyunlar hazırlanıyor…</div>
          </main>
        }
      >
        <InstantWorld
          balance={balance}
          setBalance={setBalance}
          onExit={() => setView("lobby")}
          aiOnline={aiOnline}
        />
      </Suspense>
    );

  return (
    <main className="app-shell table-view responsive-game-shell responsive-game-shell--blackjack">
      <header className="topbar">
        <button className="back-button" onClick={() => setView("lobby")}>
          ← <span>Salonlar</span>
        </button>
        <Brand />
        <div className="topbar-actions">
          <GameMusicControls game="blackjack" />
          <button
            className="voice-toggle"
            title={
              turkishVoiceOnline
                ? "Emel · Türkçe kadın sesi"
                : (femaleVoice?.name ?? "Tarayıcı yedek sesi")
            }
            onClick={toggleVoice}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled
              ? `🔊 ${turkishVoiceOnline ? "EMEL · TR" : "KADIN SES"}`
              : "🔇 SES KAPALI"}
          </button>
          <span className={`ai-pill ${aiOnline ? "online" : ""}`}>
            ● {aiOnline ? "VERA AI YEREL" : "YEDEK KİŞİLİK"}
          </span>
          <span
            className={`balance-chip ${balancePulse ? `balance-${balancePulse}` : ""}`}
          >
            ✦ {money.format(balance)} <small>PR</small>
          </span>
        </div>
      </header>
      <section className="game-layout responsive-game-shell__content">
        <section
          className={`blackjack-stage responsive-game-stage responsive-blackjack-stage phase-${round.phase} ${roundMoneyDismissed ? "money-dismissed" : ""}`}
          onClickCapture={(event) => {
            if (
              (event.target as HTMLElement).closest(
                ".betting-spot, .side-bet-spot",
              )
            )
              setRoundMoneyDismissed(true);
          }}
        >
          <div className="table-glow" />
          <div className="wood-rail" />
          <div className="table-ambience" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          {round.phase === "complete" &&
            roundFinance.settled &&
            !roundMoneyDismissed && (
              <button
                className="round-money-close"
                onClick={() => setRoundMoneyDismissed(true)}
                aria-label="Kazanç ekranını kapat"
                title="Kazanç ekranını kapat"
              >
                ×
              </button>
            )}
          {round.phase === "complete" &&
            roundFinance.settled &&
            roundMoneyDismissed && (
              <button
                className={`last-result-pill ${roundFinance.net > 0 ? "profit" : roundFinance.net < 0 ? "loss" : "push"}`}
                onClick={() => setRoundMoneyDismissed(false)}
              >
                <small>SON EL</small>
                <strong>{money.format(roundFinance.returns)} PR</strong>
              </button>
            )}
          <div className="table-label">
            <span>MUHARREM PEHLEVAN'IN ÖZEL MASASI</span>
            <button onClick={() => setRulesOpen(true)}>
              MASA KURALLARI · ⓘ
            </button>
          </div>
          <div className={`dealer-figure motion-${dealerMotion}`}>
            <div className="dealer-halo" />
            <img
              src="/assets/characters/vera-dealer-felt-v2.png"
              alt="Krupiye Vera kart dağıtırken"
            />
            <div className="dealer-nameplate">
              <strong>VERA</strong>
              <small>PRIVATE DEALER · AI</small>
            </div>
          </div>
          <div
            className={`speech-bubble ${dealerMotion === "speak" ? "visible" : ""}`}
          >
            <span>VERA</span>
            <p>{lastVeraMessage}</p>
          </div>
          <div
            className={`card-shoe ${dealerMotion === "shuffle" ? "shuffling" : ""}`}
          >
            <div className="shoe-stack">
              <i />
              <i />
              <i />
              <i />
            </div>
            <span>
              {dealerMotion === "shuffle"
                ? "KARIŞTIRILIYOR"
                : `${shoeRemaining} KART`}
            </span>
            <div className="shoe-meter">
              <i style={{ width: `${shoePercent}%` }} />
            </div>
          </div>
          <div className="hand dealer-hand">
            <div className="hand-meta">
              <span className="seat-title">
                KRUPİYE{" "}
                <em>
                  {round.dealer.length
                    ? `${round.dealer.length} KART`
                    : "BEKLİYOR"}
                </em>
              </span>
              {round.dealer.length > 0 && (
                <span className="score-orb">
                  <small>{dealerVisible ? "TOPLAM" : "AÇIK"}</small>
                  <b>{dealerShownTotal}</b>
                </span>
              )}
            </div>
            <div className="cards">
              {round.dealer.map((card, index) => (
                <PlayingCard
                  key={`${formatCard(card)}-${index}`}
                  card={card}
                  hidden={!dealerVisible && index === 1}
                  revealed={dealerVisible && index === 1}
                  order={index}
                />
              ))}
            </div>
          </div>
          <div className="table-insignia">
            <span>
              BLACKJACK <strong>3:2</strong> ÖDER
            </span>
            <b>
              <i>MP</i>
            </b>
            <span>
              KRUPİYE <strong>17</strong>'DE DURUR
            </span>
          </div>
          <button
            className={`betting-spot ${bet || pendingByTarget("main") ? "has-bet" : ""} ${betTarget === "main" ? "selected-bet" : ""} settlement-${mainTableOutcome}`}
            onClick={() => setBetTarget("main")}
          >
            <span className="betting-caption">ANA BAHİS</span>
            <span className="betting-ring">
              <span className="table-chip-stack">
                {mainChipStack.visible.map((value, index) => (
                  <span
                    className="stacked-chip"
                    style={
                      {
                        "--stack-index": index,
                        zIndex: index + 1,
                      } as CSSProperties
                    }
                    key={`${value}-${index}`}
                  >
                    <CasinoChip value={value} />
                  </span>
                ))}
                {mainChipStack.hiddenCount > 0 && (
                  <span className="chip-stack-count">
                    +{mainChipStack.hiddenCount}
                  </span>
                )}
              </span>
              <strong>
                {round.phase === "complete"
                  ? !settlementVisualsVisible
                    ? "BAHİS SEÇ"
                    : mainSettlementReturn > 0
                      ? `${money.format(mainSettlementReturn)} PR`
                      : "KAYBETTİ"
                  : bet || pendingByTarget("main")
                    ? `${money.format(bet + pendingByTarget("main"))} PR`
                    : "ÇİP KOY"}
              </strong>
              <small>PEHLEVAN ROYALE</small>
            </span>
            {round.phase === "complete" && mainSettlementReturn > 0 && (
              <span
                className={`blackjack-chip-return return-${mainTableOutcome}`}
                aria-hidden="true"
              >
                {mainReturnChipStack.visible.map((value, index) => (
                  <span
                    className="returning-chip"
                    style={{ "--return-index": index } as CSSProperties}
                    key={`return-${value}-${index}`}
                  >
                    <CasinoChip value={value} />
                  </span>
                ))}
                {mainReturnChipStack.hiddenCount > 0 && (
                  <span className="return-stack-count">
                    +{mainReturnChipStack.hiddenCount}
                  </span>
                )}
              </span>
            )}
          </button>
          {adminSettings.games.blackjack.features.sideBets && (
            <div className="side-bet-spots">
              <button
                className={`side-bet-spot pairs ${betTarget === "perfectPairs" ? "selected-bet" : ""} ${perfectPairsVisualStatus ? (perfectPairsVisualStatus.won ? "won" : "lost") : ""}`}
                onClick={() => setBetTarget("perfectPairs")}
              >
                <small>PERFECT</small>
                <strong>PAIRS</strong>
                <em>6:1 · 12:1 · 25:1</em>
                <span className="mini-chip-stack">
                  {perfectPairsChipStack.visible.map((value, index) => (
                    <span
                      className="mini-stacked-chip"
                      style={
                        {
                          "--stack-index": index,
                          zIndex: index + 1,
                        } as CSSProperties
                      }
                      key={`${value}-${index}`}
                    >
                      <CasinoChip value={value} />
                    </span>
                  ))}
                  {perfectPairsChipStack.hiddenCount > 0 && (
                    <span className="chip-stack-count">
                      +{perfectPairsChipStack.hiddenCount}
                    </span>
                  )}
                </span>
                <b>
                  {perfectPairsVisualStatus
                    ? `${money.format(perfectPairsVisualStatus.payout)} PR`
                    : sideBets.perfectPairs
                      ? `${money.format(sideBets.perfectPairs)} PR`
                      : "BAHİS SEÇ"}
                </b>
                {perfectPairsVisualStatus?.won && (
                  <span className="side-bet-chip-return" aria-hidden="true">
                    {perfectPairsReturnStack.visible.map((value, index) => (
                      <span
                        className="returning-side-chip"
                        style={{ "--return-index": index } as CSSProperties}
                        key={`pairs-return-${value}-${index}`}
                      >
                        <CasinoChip value={value} />
                      </span>
                    ))}
                    {perfectPairsReturnStack.hiddenCount > 0 && (
                      <span className="return-stack-count">
                        +{perfectPairsReturnStack.hiddenCount}
                      </span>
                    )}
                  </span>
                )}
                {perfectPairsVisualStatus && (
                  <span
                    className={`side-bet-result ${perfectPairsVisualStatus.won ? "win" : "loss"}`}
                  >
                    {perfectPairsVisualStatus.won
                      ? `${perfectPairsVisualStatus.hand} · ${money.format(perfectPairsVisualStatus.payout)} PR`
                      : "BU EL KAÇTI"}
                  </span>
                )}
              </button>
              <button
                className={`side-bet-spot twenty-one-three ${betTarget === "twentyOneThree" ? "selected-bet" : ""} ${twentyOneThreeVisualStatus ? (twentyOneThreeVisualStatus.won ? "won" : "lost") : ""}`}
                onClick={() => setBetTarget("twentyOneThree")}
              >
                <small>POKER BONUSU</small>
                <strong>21+3</strong>
                <em>FLOŞ · KENT · ÜÇLÜ</em>
                <span className="mini-chip-stack">
                  {twentyOneThreeChipStack.visible.map((value, index) => (
                    <span
                      className="mini-stacked-chip"
                      style={
                        {
                          "--stack-index": index,
                          zIndex: index + 1,
                        } as CSSProperties
                      }
                      key={`${value}-${index}`}
                    >
                      <CasinoChip value={value} />
                    </span>
                  ))}
                  {twentyOneThreeChipStack.hiddenCount > 0 && (
                    <span className="chip-stack-count">
                      +{twentyOneThreeChipStack.hiddenCount}
                    </span>
                  )}
                </span>
                <b>
                  {twentyOneThreeVisualStatus
                    ? `${money.format(twentyOneThreeVisualStatus.payout)} PR`
                    : sideBets.twentyOneThree
                      ? `${money.format(sideBets.twentyOneThree)} PR`
                      : "BAHİS SEÇ"}
                </b>
                {twentyOneThreeVisualStatus?.won && (
                  <span className="side-bet-chip-return" aria-hidden="true">
                    {twentyOneThreeReturnStack.visible.map((value, index) => (
                      <span
                        className="returning-side-chip"
                        style={{ "--return-index": index } as CSSProperties}
                        key={`twenty-one-three-return-${value}-${index}`}
                      >
                        <CasinoChip value={value} />
                      </span>
                    ))}
                    {twentyOneThreeReturnStack.hiddenCount > 0 && (
                      <span className="return-stack-count">
                        +{twentyOneThreeReturnStack.hiddenCount}
                      </span>
                    )}
                  </span>
                )}
                {twentyOneThreeVisualStatus && (
                  <span
                    className={`side-bet-result ${twentyOneThreeVisualStatus.won ? "win" : "loss"}`}
                  >
                    {twentyOneThreeVisualStatus.won
                      ? `${twentyOneThreeVisualStatus.hand} · ${money.format(twentyOneThreeVisualStatus.payout)} PR`
                      : "BU EL KAÇTI"}
                  </span>
                )}
              </button>
            </div>
          )}
          {flyingChips.map((chip, index) => (
            <span
              className={`flying-chip target-${chip.target}`}
              style={{ "--flight-index": index } as CSSProperties}
              key={chip.id}
            >
              <CasinoChip value={chip.value} />
            </span>
          ))}
          {round.insuranceBet > 0 && (
            <div className="insurance-marker">
              <span>♢</span>
              <strong>{money.format(round.insuranceBet)} PR</strong>
              <small>SİGORTA</small>
            </div>
          )}
          <div className={`player-hands count-${round.playerHands.length}`}>
            {round.playerHands.map((hand, handIndex) => {
              const value = handValue(hand);
              const isActive =
                round.phase === "player" && handIndex === round.activeHand;
              return (
                <div
                  className={`hand player-hand ${isActive ? "active-hand" : ""}`}
                  key={`hand-${handIndex}`}
                >
                  <div className="hand-meta">
                    <span className="seat-title">
                      {round.playerHands.length > 1
                        ? `${handIndex + 1}. EL`
                        : "MUHARREM"}{" "}
                      <em>
                        {hand.length
                          ? `${hand.length} KART · ${money.format(round.handBets[handIndex] ?? bet)} PR`
                          : "OYUNCU"}
                      </em>
                    </span>
                    {hand.length > 0 && (
                      <span
                        className={`score-orb ${value.total > 21 ? "bust-score" : ""}`}
                      >
                        <small>{value.soft ? "SOFT" : "TOPLAM"}</small>
                        <b>{value.total}</b>
                      </span>
                    )}
                  </div>
                  <div className="cards">
                    {hand.length ? (
                      hand.map((card, index) => (
                        <PlayingCard
                          key={`${formatCard(card)}-${index}`}
                          card={card}
                          order={index}
                        />
                      ))
                    ) : (
                      <div className="empty-cards">
                        <span>♠</span>
                        <strong>Bahsini koy</strong>
                        <small>Kartlar birazdan burada</small>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {round.phase === "insurance" && (
            <div
              className="insurance-offer"
              role="dialog"
              aria-modal="true"
              aria-label="Sigorta teklifi"
            >
              <span className="offer-icon">A♠</span>
              <div>
                <small>KRUPİYE AS GÖSTERİYOR</small>
                <strong>Sigorta ister misin?</strong>
                <p>
                  {money.format(Math.floor(round.handBets[0] / 2))} PR ile
                  krupiye blackjack’ine karşı 2:1 koruma.
                </p>
              </div>
              <div className="offer-actions">
                <button
                  onClick={() => void resolveInsurance(true)}
                  disabled={balance < Math.floor(round.handBets[0] / 2)}
                >
                  Sigorta al
                </button>
                <button
                  className="outlined"
                  onClick={() => void resolveInsurance(false)}
                >
                  Pas geç
                </button>
              </div>
            </div>
          )}
          {round.phase === "complete" && roundFinance.settled && (
            <div
              className={`round-money ${roundFinance.net > 0 ? "profit" : roundFinance.net < 0 ? "loss" : "push"}`}
              role="status"
            >
              <div className="money-rain" aria-hidden="true">
                {Array.from({ length: 10 }, (_, index) => (
                  <i key={index}>◆</i>
                ))}
              </div>
              <small>BU ELDEN KASAYA DÖNEN</small>
              <strong>
                {money.format(animatedNet)} <em>PR TOPLAM ÖDEME</em>
              </strong>
              <div className="finance-breakdown">
                <span>
                  Masaya koydun <b>{money.format(roundFinance.stake)} PR</b>
                </span>
                <span>
                  Net sonuç{" "}
                  <b>
                    {roundFinance.net > 0
                      ? "+"
                      : roundFinance.net < 0
                        ? "−"
                        : ""}
                    {money.format(Math.abs(roundFinance.net))} PR
                  </b>
                </span>
                {roundFinance.sideReturn > 0 && (
                  <span>
                    Toplamın içindeki yan bahis{" "}
                    <b>{money.format(roundFinance.sideReturn)} PR</b>
                  </span>
                )}
              </div>
              <p>{round.outcome}</p>
            </div>
          )}
          <div className="table-history">
            <div>
              <small>SERİ</small>
              <strong>{streak ? `${streak}×` : "—"}</strong>
            </div>
            <div>
              <small>SON ELLER</small>
              <span>
                {history.length ? (
                  history.map((mark, index) => (
                    <i
                      className={`mark-${mark.toLowerCase()}`}
                      key={`${mark}-${index}`}
                    >
                      {mark}
                    </i>
                  ))
                ) : (
                  <em>Henüz el yok</em>
                )}
              </span>
            </div>
          </div>
          {bonusCelebration && (
            <div className="bonus-celebration" role="status">
              <div className="bonus-particles" aria-hidden="true">
                {Array.from({ length: 12 }, (_, index) => (
                  <i key={index} />
                ))}
              </div>
              <small>YAN BAHİS VURDU</small>
              <strong>{bonusCelebration.hand}</strong>
              <b>
                {bonusCelebration.odds}:1 · +
                {money.format(bonusCelebration.payout)} PR
              </b>
            </div>
          )}
          {rulesOpen && (
            <div
              className="rules-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Masa kuralları"
            >
              <div className="rules-card">
                <button
                  className="rules-close"
                  onClick={() => setRulesOpen(false)}
                  aria-label="Kuralları kapat"
                >
                  ×
                </button>
                <small>PEHLEVAN ROYALE · MASA 01</small>
                <h2>Masa kuralları</h2>
                <div className="rules-grid">
                  <section>
                    <strong>Ana oyun</strong>
                    <p>
                      6 deste · Blackjack 3:2 · Sigorta 2:1 · Krupiye soft 17’de
                      durur · Geç teslimiyette bahsin yarısı döner · Eşit
                      değerli kartlar bölünebilir · Bölmeden sonra double
                      serbest.
                    </p>
                  </section>
                  <section>
                    <strong>Perfect Pairs</strong>
                    <p>
                      Karışık çift 6:1 · Aynı renk çift 12:1 · Aynı tür kusursuz
                      çift 25:1.
                    </p>
                  </section>
                  <section>
                    <strong>21+3</strong>
                    <p>
                      Floş 5:1 · Kent 10:1 · Üçlü 30:1 · Floş kent 40:1 · Aynı
                      tür üçlü 100:1.
                    </p>
                  </section>
                  <section>
                    <strong>Shoe</strong>
                    <p>
                      312 kart tek shoe içinde devam eder. Son desteye
                      girildiğinde kesme kartı gelir ve Vera yeniden karıştırır.
                    </p>
                  </section>
                </div>
              </div>
            </div>
          )}
          <div className="table-status">
            <i className={round.phase === "dealing" ? "pulse" : ""} />
            {tableStatus}
          </div>
        </section>
        <aside className="dealer-panel">
          <div className="panel-heading">
            <div>
              <span>Vera ile konuş</span>
              <small>MASAYI VE ELLERİNİ GÖRÜYOR</small>
            </div>
            <i className={aiOnline ? "online" : ""}>
              ● {aiOnline ? "YEREL AI" : "YEDEK MOD"}
            </i>
          </div>
          <div className="chat-log">
            {chat.map((message, index) => (
              <div
                className={`message ${message.speaker === "Sen" ? "player-message" : ""}`}
                key={`${message.moment}-${index}`}
              >
                <span>{message.speaker}</span>
                <p>{message.text}</p>
                <small>{message.moment}</small>
              </div>
            ))}
            {thinking && (
              <div className="message thinking">
                <span>VERA</span>
                <p>Cevabını tartıyor…</p>
              </div>
            )}
          </div>
          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendChat();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Vera'ya yaz…"
              disabled={thinking}
            />
            <button aria-label="Gönder" disabled={thinking}>
              ↑
            </button>
          </form>
        </aside>
      </section>
      <section className="control-deck responsive-game-dock">
        <div className="chip-rack">
          <div className="rack-heading">
            <span>
              ÇİP → {betTargetLabel.toLocaleUpperCase("tr-TR")} · MİN{" "}
              {money.format(adminSettings.games.blackjack.minBet)} PR
            </span>
            <div>
              <button
                onClick={clearBet}
                disabled={
                  !activeTargetBet ||
                  !["idle", "complete"].includes(round.phase) ||
                  Boolean(flyingChips.length)
                }
              >
                Seçileni temizle
              </button>
              <button
                onClick={clearAllBets}
                disabled={
                  !totalWager ||
                  !["idle", "complete"].includes(round.phase) ||
                  Boolean(flyingChips.length)
                }
              >
                Tümü
              </button>
            </div>
          </div>
          <div className="chip-selector">
            {chipValues.map((value) => (
              <CasinoChip
                key={value}
                value={value}
                interactive
                onClick={() => addBetChip(value)}
                disabled={
                  !["idle", "complete"].includes(round.phase) ||
                  totalWager + pendingBet + value > tableLimit ||
                  (betTarget === "main" &&
                    value < adminSettings.games.blackjack.minBet)
                }
              />
            ))}
            <div className="custom-chip-entry">
              <label>
                <small>ÖZEL ÇİP</small>
                <input
                  aria-label="Özel blackjack çip değeri"
                  type="number"
                  min={
                    betTarget === "main"
                      ? adminSettings.games.blackjack.minBet
                      : 1
                  }
                  value={customBetChip}
                  disabled={!["idle", "complete"].includes(round.phase)}
                  onChange={(event) =>
                    setCustomBetChip(
                      normalizeWagerInput(
                        Number(event.target.value),
                        betTarget === "main"
                          ? adminSettings.games.blackjack.minBet
                          : 1,
                      ),
                    )
                  }
                />
              </label>
              <button
                disabled={
                  !["idle", "complete"].includes(round.phase) ||
                  customBetChip <= 0 ||
                  totalWager + pendingBet + customBetChip > tableLimit
                }
                onClick={() => addBetChip(customBetChip)}
              >
                KOY
              </button>
              <button
                disabled={
                  !["idle", "complete"].includes(round.phase) ||
                  tableLimit - totalWager - pendingBet <= 0
                }
                onClick={() => addBetChip(tableLimit - totalWager - pendingBet)}
              >
                MAX
              </button>
            </div>
          </div>
        </div>
        {round.phase === "player" ? (
          <div className="game-actions">
            <button onClick={() => void hit()}>Kart al</button>
            <button className="outlined" onClick={() => void stand()}>
              Dur
            </button>
            <button
              className="outlined"
              onClick={() => void doubleDown()}
              disabled={!canDouble}
            >
              İkiye katla
            </button>
            <button
              className={`outlined split-action ${canSplit ? "available" : ""}`}
              onClick={() => void splitHand()}
              disabled={!canSplit}
            >
              İkiye böl
            </button>
            <button
              className="outlined surrender-action"
              onClick={surrender}
              disabled={!canSurrender}
              title="Bahsin yarısı geri döner"
            >
              Teslim ol
            </button>
          </div>
        ) : round.phase === "insurance" ? (
          <div className="game-actions decision-wait">
            <span>Sigorta kararı masada</span>
          </div>
        ) : (
          <div className="game-actions">
            <button
              className="gold-button"
              onClick={() =>
                void (round.phase === "complete"
                  ? placePreviousBet()
                  : dealRound())
              }
              disabled={
                (round.phase === "complete"
                  ? lastTableWager <= 0 || lastTableWager > balance
                  : bet <= 0 || balance < totalWager) ||
                Boolean(flyingChips.length) ||
                rebetting ||
                ["dealing", "dealer"].includes(round.phase)
              }
            >
              {rebetting
                ? "Bahis yerleştiriliyor…"
                : round.phase === "complete"
                  ? "Aynı bahsi yerleştir"
                  : round.phase === "dealing"
                    ? "Dağıtılıyor…"
                    : "Kartları dağıt"}{" "}
              <span>→</span>
            </button>
          </div>
        )}
        <div className="wallet-actions">
          <strong>{money.format(totalWager + pendingBet)} PR</strong>
          <small>TOPLAM MASA BAHİSİ · BAKİYEYE KADAR</small>
          {potentialReturn && <em>OLASI YAN BAHİS DÖNÜŞÜ {potentialReturn}</em>}
          {user.role === "owner" && (
            <button onClick={() => void addChips()}>+ 2.500 PR ekle</button>
          )}
        </div>
      </section>
    </main>
  );
}
