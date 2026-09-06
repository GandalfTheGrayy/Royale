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
import { askArmand, armandEventLine } from "../../ai/armand";
import {
  EUROPEAN_WHEEL,
  announcedBets,
  betStake,
  betUnits,
  columns,
  compactChipStack,
  cornerBet,
  dozens,
  neighbourBet,
  numberColour,
  outsideBets,
  settleBets,
  sixLineBet,
  splitBet,
  straightBet,
  streetBet,
  totalStake,
  type BetDefinition,
  type LuckyNumber,
  type PlacedBet,
} from "./roulette-engine";
import { RouletteAudio, type RouletteAudioSettings } from "./roulette-audio";
import { visibleRouletteBetLayers } from "./roulette-bet-layers";
import {
  getLiveRouletteState,
  submitLiveRouletteTicket,
  subscribeLiveRoulette,
  type LiveRoulettePhase,
} from "./live-roulette";
import {
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import GameMusicControls from "../../audio/GameMusicControls";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { useAuth } from "../../auth/auth-client";
import {
  createRecordId,
  recordAIConversation,
} from "../../data/casino-database";
import {
  CASINO_CHIP_VALUES,
  compactWager,
  normalizeWagerInput,
} from "../wagering";
import "./roulette.css";

type RoulettePhase = LiveRoulettePhase;
type MobileBetMode = "straight" | "split" | "corner" | "street" | "six-line";
type RouletteSurface = "layout" | "racetrack";
type Message = { speaker: "Armand" | "Sen"; text: string; moment: string };
type SpinResult = ReturnType<typeof settleBets> & {
  number: number;
  stake: number;
  luckyNumbers: LuckyNumber[];
};

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  aiOnline: boolean;
};

const money = new Intl.NumberFormat("tr-TR");
const chips = CASINO_CHIP_VALUES;
// The physical rack is deliberately concise. The custom field and MAX keep the
// table uncapped without turning every viewport into a wall of denominations.
const rouletteRackChips = [
  25, 50, 100, 250, 500, 1_000, 10_000, 100_000, 1_000_000,
];
const wheelStep = 360 / EUROPEAN_WHEEL.length;
const racetrackPoints = (() => {
  const sampleCount = 4096;
  const radiusX = 44;
  const radiusY = 39;
  // The drawn rail is roughly six times wider than it is tall. Arc length is
  // therefore sampled in screen-space proportions, not percentage-space;
  // otherwise numbers bunch at both ends of the ellipse.
  const distanceRadiusX = radiusX * 6;
  const distanceRadiusY = radiusY;
  const samples: Array<{ angle: number; distance: number }> = [];
  let distance = 0;
  let previousX = 0;
  let previousY = -distanceRadiusY;

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = -Math.PI / 2 + (index / sampleCount) * Math.PI * 2;
    const x = Math.cos(angle) * distanceRadiusX;
    const y = Math.sin(angle) * distanceRadiusY;
    if (index > 0) distance += Math.hypot(x - previousX, y - previousY);
    samples.push({ angle, distance });
    previousX = x;
    previousY = y;
  }

  let sampleIndex = 0;
  return EUROPEAN_WHEEL.map((_, index) => {
    const target = (distance * index) / EUROPEAN_WHEEL.length;
    while (samples[sampleIndex + 1]?.distance < target) sampleIndex += 1;
    const before = samples[sampleIndex];
    const after = samples[Math.min(sampleIndex + 1, samples.length - 1)];
    const span = after.distance - before.distance;
    const ratio = span > 0 ? (target - before.distance) / span : 0;
    const angle = before.angle + (after.angle - before.angle) * ratio;
    return {
      left: 50 + Math.cos(angle) * radiusX,
      top: 50 + Math.sin(angle) * radiusY,
    };
  });
})();
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
const colourLabel = (number: number) =>
  ({ green: "YEŞİL", red: "KIRMIZI", black: "SİYAH" })[numberColour(number)];

function loadStoredBets(key: string): PlacedBet[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]") as PlacedBet[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function RouletteChip({
  value,
  interactive,
  selected,
  disabled,
  onClick,
}: {
  value: number;
  interactive?: boolean;
  selected?: boolean;
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
        className={`casino-chip chip-${value} ${selected ? "selected-chip" : ""}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${value} PR rulet çipi seç`}
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

function BetChips({
  bet,
  onRemove,
  layer = "current",
}: {
  bet?: PlacedBet;
  onRemove?: () => void;
  layer?: "current" | "locked" | "next";
}) {
  if (!bet?.chips.length) return null;
  return (
    <span className={`roulette-bet-stack layer-${layer}`}>
      {compactChipStack(bet.chips).map((chip, index) => (
        <span
          key={`${chip}-${index}`}
          style={{ "--chip-index": index } as CSSProperties}
        >
          <RouletteChip value={chip} />
        </span>
      ))}
      <b>{money.format(betStake(bet))}</b>
      {onRemove && (
        <span
          className="roulette-remove-chip"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          aria-label={`${bet.definition.label} bahisinden son çipi geri al`}
        >
          −
        </span>
      )}
    </span>
  );
}

function Wheel({
  rotation,
  phase,
  winner,
  luckyNumbers,
}: {
  rotation: number;
  phase: RoulettePhase;
  winner?: number;
  luckyNumbers: LuckyNumber[];
}) {
  const gradient = useMemo(
    () =>
      `conic-gradient(${EUROPEAN_WHEEL.map((number, index) => {
        const start = index * wheelStep;
        const end = (index + 1) * wheelStep;
        const colour =
          numberColour(number) === "green"
            ? "#176f4a"
            : numberColour(number) === "red"
              ? "#9d2730"
              : "#151716";
        return `${colour} ${start}deg ${end}deg`;
      }).join(",")})`,
    [],
  );
  return (
    <div className={`roulette-wheel-scene phase-${phase}`}>
      <div className="wheel-pointer">◆</div>
      <div className="wheel-outer">
        <div className="wheel-ball-track">
          <span
            className="roulette-ball"
            style={{ "--ball-angle": "1800deg" } as CSSProperties}
          />
        </div>
        <div
          className="wheel-disk"
          style={{ background: gradient, transform: `rotate(${rotation}deg)` }}
        >
          {EUROPEAN_WHEEL.map((number, index) => {
            const centreAngle = (index + 0.5) * wheelStep;
            const lucky = luckyNumbers.find((entry) => entry.number === number);
            return (
              <span
                className={`wheel-number ${numberColour(number)} ${lucky ? "lucky-wheel-number" : ""}`}
                key={number}
                style={{
                  transform: `rotate(${centreAngle}deg) translateY(calc(var(--wheel-size) * -.32)) rotate(90deg)`,
                }}
              >
                {number}
                {lucky && <b>{lucky.multiplier}×</b>}
              </span>
            );
          })}
          <div className="wheel-bowl">
            <i />
            <b>MP</b>
          </div>
        </div>
      </div>
      <div className="wheel-caption">
        <small>AVRUPA TEK SIFIR</small>
        <strong>
          {phase === "surge"
            ? "PEHLEVAN SURGE AKTİF"
            : phase === "spinning"
              ? "BAHİSLER KAPANDI"
              : phase === "betting"
                ? "37 CEP · 2,70% KASA AVANTAJI"
                : winner === undefined
                  ? "SONUÇ BEKLENİYOR"
                  : `${winner} · ${colourLabel(winner)}`}
        </strong>
      </div>
    </div>
  );
}

export default function RouletteRoom({
  balance,
  setBalance,
  onExit,
  aiOnline,
}: Props) {
  const { user } = useAuth();
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const gameSettings = admin.games.roulette;
  const live = useSyncExternalStore(
    subscribeLiveRoulette,
    getLiveRouletteState,
    getLiveRouletteState,
  );
  const phase: RoulettePhase = live.phase;
  const countdown = live.countdown;
  const winner = live.winner;
  const history = live.history.slice(0, 24);
  const luckyNumbers = phase === "betting" ? [] : live.luckyNumbers;
  const [selectedChip, setSelectedChip] = useState<number>(
    () =>
      [...chips]
        .filter((chip) => chip >= gameSettings.minBet)
        .sort(
          (a, b) =>
            Math.abs(a - gameSettings.defaultBet) -
            Math.abs(b - gameSettings.defaultBet),
        )[0] ?? chips.at(-1)!,
  );
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [previousBets, setPreviousBets] = useState<PlacedBet[]>([]);
  const [placementHistory, setPlacementHistory] = useState<string[]>([]);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult>();
  const [resultDismissed, setResultDismissed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const favoriteStorageKey = `account:${user.id}:pehlevan-roulette-favorite`;
  const [favoriteBets, setFavoriteBets] = useState<PlacedBet[]>(() =>
    loadStoredBets(favoriteStorageKey),
  );
  const [audioSettings, setAudioSettings] = useState<RouletteAudioSettings>({
    effects: gameSettings.sound && admin.general.masterSound,
    ambience: gameSettings.sound && admin.general.masterSound,
  });
  const [tableNotice, setTableNotice] = useState("");
  const [hovered, setHovered] = useState<BetDefinition>();
  const [mobileBetMode, setMobileBetMode] = useState<MobileBetMode>("straight");
  const [neighbourNumber, setNeighbourNumber] = useState(0);
  const [selectedCallBetId, setSelectedCallBetId] = useState("voisins");
  const [betSurface, setBetSurface] = useState<RouletteSurface>("layout");
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Armand", text: armandEventLine("welcome"), moment: now() },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "roulette",
    "ai-voice",
  );
  const audioRef = useRef<RouletteAudio | null>(null);
  const lastTickRef = useRef<number | undefined>(undefined);
  const submittedRoundRef = useRef("");
  const playerTicketRoundRef = useRef("");
  const lockedBetsRef = useRef<PlacedBet[]>([]);
  const mountedRef = useRef(true);
  const armandAiSessionRef = useRef(
    `ai-roulette-${Date.now()}-${crypto.randomUUID()}`,
  );
  const stake = totalStake(bets);
  const bettingOpen = phase === "betting";
  const preparingNextRound =
    phase === "result" ||
    (!bettingOpen && submittedRoundRef.current === live.roundId);
  const betEditingOpen = bettingOpen || preparingNextRound;
  // The ticket already accepted for the spinning wheel is immutable and stays
  // on the felt until its result. New clicks during that time belong to the
  // next round and render as a separate, removable chip layer.
  const lockedBets = bettingOpen ? [] : lockedBetsRef.current;
  const currentRoundBets = bettingOpen ? bets : lockedBets;
  const currentRoundStake = totalStake(currentRoundBets);
  const currentRoundChipCount = currentRoundBets.reduce(
    (sum, bet) => sum + bet.chips.length,
    0,
  );

  const statistics = useMemo(() => {
    const counts = Array.from({ length: 37 }, (_, number) => ({
      number,
      count: history.filter((value) => value === number).length,
      last: history.indexOf(number),
    }));
    const hot = [...counts]
      .filter((item) => item.count)
      .sort((a, b) => b.count - a.count || a.last - b.last)
      .slice(0, 3);
    const cold = [...counts]
      .sort(
        (a, b) =>
          (b.last < 0 ? history.length + 1 : b.last) -
          (a.last < 0 ? history.length + 1 : a.last),
      )
      .slice(0, 3);
    const red = history.filter(
      (number) => numberColour(number) === "red",
    ).length;
    const black = history.filter(
      (number) => numberColour(number) === "black",
    ).length;
    const firstColour =
      history[0] === undefined ? undefined : numberColour(history[0]);
    const colourStreak = firstColour
      ? history.findIndex((number) => numberColour(number) !== firstColour)
      : 0;
    return {
      hot,
      cold,
      red,
      black,
      colourStreak: colourStreak < 0 ? history.length : colourStreak,
      firstColour,
    };
  }, [history]);

  const winningBreakdown = useMemo(() => {
    if (!result) return [];
    return result.winners
      .map(({ bet, returnAmount }) => {
        const placedStake = betStake(bet);
        const surge =
          bet.definition.kind === "straight" &&
          result.hitMultiplier?.number === bet.definition.numbers[0] &&
          result.multiplierReturn > 0;
        return {
          id: bet.definition.id,
          label: bet.definition.label,
          placedStake,
          returnAmount,
          profit: returnAmount - placedStake,
          surge,
          multiplier: surge ? result.hitMultiplier?.multiplier : undefined,
        };
      })
      .sort((a, b) => b.returnAmount - a.returnAmount);
  }, [result]);

  useEffect(() => {
    const audio = new RouletteAudio();
    audioRef.current = audio;
    audio.preload();
    audio.setSettings(audioSettings);
    const unlock = () => void audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    // React StrictMode runs an extra setup/cleanup cycle in development. Reset
    // the flag on every setup so live settlement callbacks are not discarded.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      phase !== "betting" ||
      countdown > 5 ||
      countdown === lastTickRef.current
    )
      return;
    lastTickRef.current = countdown;
    audioRef.current?.countdown(countdown <= 3);
  }, [countdown, phase]);

  const speak = (
    text: string,
    aiKind: "assistant" | "system-event" = "system-event",
    latencyMs?: number,
  ) => {
    setChat((messages) => [
      ...messages,
      { speaker: "Armand", text, moment: now() },
    ]);
    void recordAIConversation({
      id: createRecordId("ai-roulette", live.roundId),
      sessionId: armandAiSessionRef.current,
      roundId: live.roundId,
      game: "roulette",
      character: "Armand",
      speaker: aiKind,
      occurredAt: new Date().toISOString(),
      text,
      context: {
        phase,
        balance,
        activeStake: stake,
        selectedChip,
        lastNumber: winner,
        lastNet: result?.net ?? null,
        luckyNumbers,
      },
      model:
        aiKind === "assistant"
          ? aiOnline
            ? "local-ai"
            : "fallback-persona"
          : undefined,
      latencyMs,
    });
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
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
  };

  const addBet = (definition: BetDefinition) => {
    if (!betEditingOpen) return;
    if (selectedChip < gameSettings.minBet) {
      showTableNotice(`Minimum çip ${money.format(gameSettings.minBet)} PR`);
      return;
    }
    const cost = selectedChip * betUnits(definition);
    if (stake + cost > balance)
      return speak(
        "Bu bahsi koyarsan masadaki toplam bakiyeyi geçiyor. Çipi küçült ya da bir şey geri al.",
      );
    setResultDismissed(true);
    setHovered(definition);
    if (definition.kind === "call") setSelectedCallBetId(definition.id);
    setBets((current) => {
      const existing = current.find(
        (bet) => bet.definition.id === definition.id,
      );
      if (existing)
        return current.map((bet) =>
          bet.definition.id === definition.id
            ? { ...bet, chips: [...bet.chips, selectedChip] }
            : bet,
        );
      return [...current, { definition, chips: [selectedChip] }];
    });
    setPlacementHistory((items) => [...items, definition.id]);
    audioRef.current?.play("chip", 0.58, 0.96 + Math.random() * 0.08);
  };

  const removeLastChip = (id: string) => {
    if (!betEditingOpen) return;
    setBets((current) =>
      current.flatMap((bet) => {
        if (bet.definition.id !== id) return [bet];
        const next = bet.chips.slice(0, -1);
        return next.length ? [{ ...bet, chips: next }] : [];
      }),
    );
    setPlacementHistory((items) => {
      const reverseIndex = [...items]
        .reverse()
        .findIndex((item) => item === id);
      if (reverseIndex < 0) return items;
      const index = items.length - 1 - reverseIndex;
      return items.filter((_, itemIndex) => itemIndex !== index);
    });
    audioRef.current?.play("chipRattle", 0.38);
  };

  const undo = () => {
    const id = placementHistory.at(-1);
    if (id) removeLastChip(id);
  };

  const clearBets = () => {
    if (!betEditingOpen) return;
    setBets([]);
    setPlacementHistory([]);
    setResultDismissed(true);
    audioRef.current?.play("chipSweep", 0.35);
  };

  const repeatBets = () => {
    const cost = totalStake(previousBets);
    if (!previousBets.length || cost > balance || !betEditingOpen) return;
    setBets(previousBets.map((bet) => ({ ...bet, chips: [...bet.chips] })));
    setPlacementHistory(
      previousBets.flatMap((bet) => bet.chips.map(() => bet.definition.id)),
    );
    setResultDismissed(true);
    audioRef.current?.play("chipRattle", 0.5);
  };

  const doubleBets = () => {
    if (!bets.length || stake * 2 > balance || !betEditingOpen) return;
    setBets((current) =>
      current.map((bet) => ({ ...bet, chips: [...bet.chips, ...bet.chips] })),
    );
    setPlacementHistory((items) => [...items, ...items]);
    setResultDismissed(true);
    audioRef.current?.play("chipRattle", 0.52);
  };

  const showTableNotice = (message: string) => {
    setTableNotice(message);
    window.setTimeout(
      () => setTableNotice((current) => (current === message ? "" : current)),
      2400,
    );
  };

  const saveFavorite = () => {
    if (!bets.length || !betEditingOpen) return;
    const saved = bets.map((bet) => ({ ...bet, chips: [...bet.chips] }));
    setFavoriteBets(saved);
    localStorage.setItem(favoriteStorageKey, JSON.stringify(saved));
    showTableNotice(`Favori masa kaydedildi · ${saved.length} alan`);
    audioRef.current?.play("chipWin", 0.42);
  };

  const placeFavorite = () => {
    const cost = totalStake(favoriteBets);
    if (!favoriteBets.length || cost > balance || !betEditingOpen) return;
    setBets(favoriteBets.map((bet) => ({ ...bet, chips: [...bet.chips] })));
    setPlacementHistory(
      favoriteBets.flatMap((bet) => bet.chips.map(() => bet.definition.id)),
    );
    setResultDismissed(true);
    showTableNotice(`Favori masa kuruldu · ${money.format(cost)} PR`);
    audioRef.current?.play("chipRattle", 0.56);
  };

  useEffect(() => {
    if (
      phase === "betting" ||
      phase === "result" ||
      submittedRoundRef.current === live.roundId
    )
      return;
    const lockedBets = bets.map((bet) => ({ ...bet, chips: [...bet.chips] }));
    const lockedStake = totalStake(lockedBets);

    // Register the ticket before clearing the editable layout. The live clock
    // can advance from Surge to spinning while React is committing this effect;
    // submitLiveRouletteTicket deliberately accepts that closed-table grace
    // window for bets that were already placed during betting.
    const ticketId = lockedBets.length
      ? `${live.roundId}-${crypto.randomUUID()}`
      : "";
    const accepted =
      !lockedBets.length ||
      submitLiveRouletteTicket({
        ticketId,
        roundId: live.roundId,
        bets: lockedBets,
        balanceBefore: balance,
        onSettled: (settled) => {
          if (settled.grossReturn)
            setBalance((value) => value + settled.grossReturn);
          if (!mountedRef.current) return;
          setResult(settled);
          setResultDismissed(false);
          if (settled.grossReturn)
            audioRef.current?.win(
              settled.net >= Math.max(1000, lockedStake * 4) ||
                settled.multiplierReturn > 0,
            );
          else if (settled.number === 0) audioRef.current?.zero();
          else audioRef.current?.loss();
          const placedLuckyStraight = lockedBets.some(
            (bet) =>
              bet.definition.kind === "straight" &&
              settled.luckyNumbers.some(
                (lucky) => lucky.number === bet.definition.numbers[0],
              ),
          );
          const event =
            settled.multiplierReturn > 0
              ? "surgeHit"
              : placedLuckyStraight
                ? "surgeMiss"
                : lockedStake === 0
                  ? "noBet"
                  : settled.number === 0
                    ? "zero"
                    : settled.net >= Math.max(1000, lockedStake * 4)
                      ? "bigWin"
                      : settled.net >= 0
                        ? "win"
                        : "loss";
          speak(
            armandEventLine(event, {
              lastNumber: settled.number,
              lastNet: settled.net,
              luckyNumbers: settled.luckyNumbers,
              hitMultiplier: settled.hitMultiplier?.multiplier,
            }),
          );
        },
      });

    if (!accepted) {
      showTableNotice(
        "Bahis bileti kilitlenemedi · çiplerin bakiyeden düşülmedi",
      );
      return;
    }

    submittedRoundRef.current = live.roundId;
    if (lockedBets.length) playerTicketRoundRef.current = live.roundId;
    lockedBetsRef.current = lockedBets;
    if (lockedBets.length) setPreviousBets(lockedBets);
    setBets([]);
    setPlacementHistory([]);
    setResult(undefined);
    setResultDismissed(false);
    audioRef.current?.betsClosed();
    audioRef.current?.surge();
    speak(armandEventLine("surge", { luckyNumbers: live.luckyNumbers }));
    if (!lockedBets.length) return;
    if (lockedStake) setBalance((value) => value - lockedStake);
    // The phase edge is the authoritative live-table lock event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, live.roundId]);

  useEffect(() => {
    if (phase !== "spinning") return;
    const index = EUROPEAN_WHEEL.indexOf(
      live.winner as (typeof EUROPEAN_WHEEL)[number],
    );
    setRotation((current) => {
      const currentAngle = ((current % 360) + 360) % 360;
      const targetAngle = (360 - (index + 0.5) * wheelStep + 360) % 360;
      const correction = (targetAngle - currentAngle + 360) % 360;
      return current + 1440 + correction;
    });
    audioRef.current?.play("spin", 0.48);
    audioRef.current?.startBallRun();
  }, [phase, live.roundId, live.winner]);

  useEffect(() => {
    if (phase === "betting") {
      lastTickRef.current = undefined;
      lockedBetsRef.current = [];
      setResultDismissed(true);
      return;
    }
    // A submitted player ticket has its own authoritative settlement callback.
    // Never overwrite it with the zero-stake spectator fallback while React is
    // committing the live result phase.
    if (
      phase !== "result" ||
      result?.number === live.winner ||
      playerTicketRoundRef.current === live.roundId
    )
      return;
    const observed = {
      ...settleBets([], live.winner, live.luckyNumbers),
      number: live.winner,
      stake: 0,
      luckyNumbers: live.luckyNumbers,
    };
    setResult(observed);
    setResultDismissed(false);
  }, [phase, live.roundId, live.winner, live.luckyNumbers, result?.number]);

  const sendChat = async () => {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    const nextMessage = {
      speaker: "Sen" as const,
      text: prompt,
      moment: now(),
    };
    const recent = [...chat, nextMessage];
    setChat(recent);
    void recordAIConversation({
      id: createRecordId("ai-roulette-user", live.roundId),
      sessionId: armandAiSessionRef.current,
      roundId: live.roundId,
      game: "roulette",
      character: "Armand",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: {
        phase,
        balance,
        activeStake: stake,
        selectedChip,
        lastNumber: winner,
        lastNet: result?.net ?? null,
        luckyNumbers,
      },
    });
    setDraft("");
    setThinking(true);
    const aiStartedAt = performance.now();
    const answer = await askArmand(prompt, {
      phase,
      balance,
      totalStake: stake,
      selectedChip,
      lastNumber: winner,
      lastNet: result?.net,
      recentNumbers: history,
      luckyNumbers,
      hitMultiplier: result?.hitMultiplier?.multiplier,
      recentMessages: recent
        .slice(-6)
        .map((message) => `${message.speaker}: ${message.text}`),
    });
    setThinking(false);
    speak(answer, "assistant", Math.round(performance.now() - aiStartedAt));
  };

  const renderBetButton = (definition: BetDefinition, className = "") => {
    const {
      lockedBet,
      editableBet,
      editableDirectBet: placedDirectly,
    } = visibleRouletteBetLayers({
      bettingOpen,
      lockedBets,
      editableBets: bets,
      definition,
    });
    const previewCall = hovered?.kind === "call" ? hovered : undefined;
    const previewUnits =
      previewCall?.components?.reduce((total, component) => {
        const componentNumbers = [...component.numbers].sort((a, b) => a - b);
        const targetNumbers = [...definition.numbers].sort((a, b) => a - b);
        const isSameTarget =
          component.payout === definition.payout &&
          componentNumbers.length === targetNumbers.length &&
          componentNumbers.every(
            (number, index) => number === targetNumbers[index],
          );
        return total + (isSameTarget ? (component.units ?? 1) : 0);
      }, 0) ?? 0;
    const coveredByCall =
      definition.kind !== "call" &&
      Boolean(
        previewCall &&
        ((definition.kind === "straight" &&
          previewCall.numbers.includes(definition.numbers[0])) ||
          previewCall.components?.some((component) => {
            const componentNumbers = [...component.numbers].sort(
              (a, b) => a - b,
            );
            const targetNumbers = [...definition.numbers].sort((a, b) => a - b);
            return (
              component.payout === definition.payout &&
              componentNumbers.length === targetNumbers.length &&
              componentNumbers.every(
                (number, index) => number === targetNumbers[index],
              )
            );
          })),
      );
    const lucky =
      definition.kind === "straight"
        ? luckyNumbers.find((entry) => entry.number === definition.numbers[0])
        : undefined;
    const wasPlayed =
      result?.winners.some(({ bet }) => bet.definition.id === definition.id) ??
      false;
    const isWinningNumber =
      definition.kind === "straight" && definition.numbers[0] === winner;
    const isWinning =
      phase === "result" &&
      winner !== undefined &&
      definition.numbers.includes(winner) &&
      (isWinningNumber || wasPlayed);
    return (
      <button
        className={`roulette-bet ${className} ${lockedBet || editableBet ? "has-bet" : ""} ${lockedBet ? "has-locked-bet" : ""} ${editableBet && !bettingOpen ? "has-next-bet" : ""} ${isWinning ? "winning-bet" : ""} ${lucky ? "surge-bet" : ""} ${coveredByCall ? "call-preview-covered" : ""}`}
        key={definition.id}
        onClick={() => addBet(definition)}
        onMouseEnter={() => setHovered(definition)}
        disabled={!betEditingOpen}
        title={`${definition.label} · ${definition.payout !== undefined ? `${definition.payout}:1` : `${betUnits(definition)} birim`}`}
      >
        <span>{definition.shortLabel}</span>
        {lucky && <em className="surge-multiplier">{lucky.multiplier}×</em>}
        {previewUnits > 0 && !lockedBet && !editableBet && (
          <i className="call-preview-chip" aria-hidden="true">
            <small>MP</small>
            <b>{previewUnits > 1 ? `${previewUnits}×` : "1"}</b>
          </i>
        )}
        <BetChips bet={lockedBet} layer="locked" />
        <BetChips
          bet={editableBet}
          layer={bettingOpen ? "current" : "next"}
          onRemove={
            placedDirectly ? () => removeLastChip(definition.id) : undefined
          }
        />
      </button>
    );
  };

  const horizontalSplits = Array.from({ length: 33 }, (_, index) => {
    const row = index % 3;
    const column = Math.floor(index / 3);
    const a = column * 3 + row + 1;
    return {
      definition: splitBet(a, a + 3),
      x: ((column + 1) / 12) * 100,
      y: ((2.5 - row) / 3) * 100,
    };
  });
  const verticalSplits = Array.from({ length: 24 }, (_, index) => {
    const column = Math.floor(index / 2);
    const lower = column * 3 + (index % 2) + 1;
    return {
      definition: splitBet(lower, lower + 1),
      x: ((column + 0.5) / 12) * 100,
      y: index % 2 === 0 ? 66.666 : 33.333,
    };
  });
  const corners = Array.from({ length: 22 }, (_, index) => {
    const column = Math.floor(index / 2);
    const lower = column * 3 + (index % 2) + 1;
    return {
      definition: cornerBet(lower),
      x: ((column + 1) / 12) * 100,
      y: index % 2 === 0 ? 66.666 : 33.333,
    };
  });
  const mobileHorizontalSplits = horizontalSplits.map(
    ({ definition }, index) => {
      const logicalRow = index % 3;
      const triplet = Math.floor(index / 3);
      return {
        definition,
        x: ((logicalRow + 0.5) / 3) * 100,
        y: ((triplet + 1) / 12) * 100,
      };
    },
  );
  const mobileVerticalSplits = verticalSplits.map(({ definition }, index) => {
    const triplet = Math.floor(index / 2);
    return {
      definition,
      x: (((index % 2) + 1) / 3) * 100,
      y: ((triplet + 0.5) / 12) * 100,
    };
  });
  const mobileCorners = corners.map(({ definition }, index) => {
    const triplet = Math.floor(index / 2);
    return {
      definition,
      x: (((index % 2) + 1) / 3) * 100,
      y: ((triplet + 1) / 12) * 100,
    };
  });

  return (
    <main
      className={`app-shell roulette-room responsive-game-shell responsive-game-shell--roulette phase-${phase} ${result?.multiplierReturn ? "surge-winner-room" : ""}`}
    >
      <header className="topbar roulette-topbar">
        <button className="back-button" onClick={onExit}>
          ← <span>Salonlar</span>
        </button>
        <button className="brand" onClick={onExit}>
          <span className="brand-mark">MP</span>
          <span>
            PEHLEVAN <em>ROYALE</em>
          </span>
        </button>
        <div className="topbar-actions">
          <GameMusicControls game="roulette" />
          <button
            className="voice-toggle"
            onClick={() => setVoiceEnabled((value) => !value)}
          >
            {voiceEnabled ? "🔊 ARMAND · TR" : "🔇 SES KAPALI"}
          </button>
          <span className={`ai-pill ${aiOnline ? "online" : ""}`}>
            ● {aiOnline ? "ARMAND AI YEREL" : "YEDEK KİŞİLİK"}
          </span>
          <span className="balance-chip">
            ✦ {money.format(balance)} <small>PR</small>
          </span>
        </div>
      </header>

      <section className="roulette-layout responsive-game-shell__content">
        <section className="roulette-live responsive-game-stage responsive-roulette-stage">
          <div className="roulette-show-stage">
            <div className={`armand-stage armand-${phase}`}>
              <div className="armand-aura" />
              <img
                src="/assets/characters/armand-roulette-v2.png"
                alt="Rouge Salon rulet sunucusu Armand"
              />
              <div className="armand-name">
                <strong>ARMAND</strong>
                <small>MAÎTRE DE ROULETTE · AI</small>
              </div>
              <div className="armand-line">
                <span>ARMAND</span>
                <p>
                  {
                    chat
                      .filter((message) => message.speaker === "Armand")
                      .at(-1)?.text
                  }
                </p>
              </div>
            </div>
            <Wheel
              rotation={rotation}
              phase={phase}
              winner={winner}
              luckyNumbers={luckyNumbers}
            />
            <div className="roulette-cinematic" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            {phase === "surge" && (
              <div className="surge-announcement" role="status">
                <small>PEHLEVAN ROYALE SUNAR</small>
                <strong>
                  PEHLEVAN <em>SURGE</em>
                </strong>
                <p>Şimşek sayıları seçiliyor</p>
                <div>
                  {luckyNumbers.map((lucky, index) => (
                    <span
                      key={lucky.number}
                      style={{ "--surge-index": index } as CSSProperties}
                    >
                      <b>{lucky.number}</b>
                      <em>{lucky.multiplier}×</em>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="roulette-history">
              <small>SON SAYILAR</small>
              <div>
                {history.length ? (
                  history.slice(0, 10).map((number, index) => (
                    <span
                      className={numberColour(number)}
                      key={`${number}-${index}`}
                    >
                      {number}
                    </span>
                  ))
                ) : (
                  <em>Henüz spin yok</em>
                )}
              </div>
            </div>
          </div>

          <div className={`roulette-table-wrap surface-${betSurface}`}>
            <div className="roulette-table-toolbar">
              <div className="roulette-table-heading">
                <div>
                  <small>ROUGE SALON · AVRUPA RULETİ</small>
                  <strong>
                    {hovered
                      ? hovered.label
                      : betSurface === "layout"
                        ? "Bahis alanını seç"
                        : "Komşu ve ilan bahisleri"}
                  </strong>
                </div>
                <div>
                  <span>
                    {hovered?.payout !== undefined
                      ? `${hovered.payout}:1 ÖDEME`
                      : hovered?.components
                        ? `${betUnits(hovered)} ÇİP BİRİMİ`
                        : "TEK SIFIR"}
                  </span>
                  <button
                    onClick={() => setRulesOpen(true)}
                    aria-label="Rulet masa kurallarını aç"
                  >
                    ⓘ
                  </button>
                </div>
              </div>
              <nav
                className="roulette-surface-tabs"
                aria-label="Rulet bahis görünümü"
              >
                <button
                  type="button"
                  className={betSurface === "layout" ? "active" : ""}
                  aria-pressed={betSurface === "layout"}
                  onClick={() => setBetSurface("layout")}
                >
                  <span>▦</span> SAYI MASASI
                </button>
                {gameSettings.features.callBets && (
                  <button
                    type="button"
                    className={betSurface === "racetrack" ? "active" : ""}
                    aria-pressed={betSurface === "racetrack"}
                    onClick={() => setBetSurface("racetrack")}
                  >
                    <span>◉</span> RACETRACK
                  </button>
                )}
              </nav>
            </div>
            <div className="roulette-stats-strip">
              <div>
                <small>SICAK SAYILAR</small>
                <strong>
                  {statistics.hot.length
                    ? statistics.hot
                        .map((item) => `${item.number}·${item.count}`)
                        .join("  ")
                    : "Veri birikiyor"}
                </strong>
              </div>
              <div>
                <small>GECİKENLER</small>
                <strong>
                  {history.length >= 5
                    ? statistics.cold.map((item) => item.number).join("  ·  ")
                    : "5 tur sonra"}
                </strong>
              </div>
              <div>
                <small>RENK DAĞILIMI</small>
                <strong>
                  <i className="stat-red" />
                  {statistics.red} <i className="stat-black" />
                  {statistics.black}
                </strong>
              </div>
              <div>
                <small>AKTİF SERİ</small>
                <strong>
                  {statistics.colourStreak > 1
                    ? `${statistics.colourStreak}× ${statistics.firstColour === "red" ? "KIRMIZI" : statistics.firstColour === "black" ? "SİYAH" : "SIFIR"}`
                    : "—"}
                </strong>
              </div>
              {result && (phase !== "result" || resultDismissed) && (
                <button
                  className="roulette-last-result"
                  onClick={() => {
                    if (phase === "result") setResultDismissed(false);
                  }}
                >
                  <span className={numberColour(result.number)}>
                    {result.number}
                  </span>
                  <small>{result.stake ? "SON BAHİS" : "SON SPİN"}</small>
                  <strong>
                    {result.stake
                      ? `${money.format(result.grossReturn)} PR`
                      : "BAHİS YOK"}
                  </strong>
                  {winningBreakdown[0] && (
                    <em>
                      {winningBreakdown[0].label} ·{" "}
                      {money.format(winningBreakdown[0].returnAmount)} PR
                    </em>
                  )}
                </button>
              )}
            </div>
            {betSurface === "layout" && (
              <>
                <div className="roulette-board">
                  <div className="zero-zone">
                    {renderBetButton(
                      straightBet(0),
                      "number-bet green zero-main",
                    )}
                    <div className="zero-specials">
                      {[1, 2, 3].map((number) =>
                        renderBetButton(splitBet(0, number), "micro-bet"),
                      )}
                      {renderBetButton(
                        {
                          id: "basket-0-1-2-3",
                          label: "0/1/2/3 ilk dörtlü",
                          shortLabel: "0▦",
                          kind: "corner",
                          numbers: [0, 1, 2, 3],
                          payout: 8,
                        },
                        "micro-bet",
                      )}
                    </div>
                  </div>
                  <div className="number-matrix">
                    {Array.from({ length: 36 }, (_, index) => index + 1).map(
                      (number) => {
                        const row = 4 - (((number - 1) % 3) + 1);
                        const column = Math.floor((number - 1) / 3) + 1;
                        return (
                          <div
                            className="number-cell"
                            key={number}
                            style={{ gridColumn: column, gridRow: row }}
                          >
                            {renderBetButton(
                              straightBet(number),
                              `number-bet ${numberColour(number)}`,
                            )}
                          </div>
                        );
                      },
                    )}
                    <div className="intersection-layer">
                      {horizontalSplits.map(({ definition, x, y }) => (
                        <div
                          className="hotspot horizontal"
                          key={definition.id}
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          {renderBetButton(definition, "micro-bet")}
                        </div>
                      ))}
                      {verticalSplits.map(({ definition, x, y }) => (
                        <div
                          className="hotspot vertical"
                          key={definition.id}
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          {renderBetButton(definition, "micro-bet")}
                        </div>
                      ))}
                      {corners.map(({ definition, x, y }) => (
                        <div
                          className="hotspot corner"
                          key={definition.id}
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          {renderBetButton(definition, "micro-bet")}
                        </div>
                      ))}
                    </div>
                    <div className="street-layer">
                      {Array.from({ length: 12 }, (_, column) => (
                        <div
                          key={`street-${column}`}
                          style={{ left: `${((column + 0.5) / 12) * 100}%` }}
                        >
                          {renderBetButton(
                            streetBet(column * 3 + 1),
                            "micro-bet street-hotspot",
                          )}
                        </div>
                      ))}
                      {Array.from({ length: 11 }, (_, column) => (
                        <div
                          key={`six-${column}`}
                          className="six-hotspot"
                          style={{ left: `${((column + 1) / 12) * 100}%` }}
                        >
                          {renderBetButton(
                            sixLineBet(column * 3 + 1),
                            "micro-bet",
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="column-bets">
                    {columns.map((definition) =>
                      renderBetButton(definition, "column-bet"),
                    )}
                  </div>
                  <div className="dozen-bets">
                    {dozens.map((definition) =>
                      renderBetButton(definition, "outside-bet dozen-bet"),
                    )}
                  </div>
                  <div className="outside-bets">
                    {outsideBets.map((definition) =>
                      renderBetButton(
                        definition,
                        `outside-bet ${definition.id}`,
                      ),
                    )}
                  </div>
                </div>

                <div
                  className="roulette-mobile-table"
                  aria-label="Mobil Avrupa ruleti bahis masası"
                >
                  <nav
                    className="roulette-mobile-bet-modes"
                    aria-label="İç bahis dokunma modu"
                  >
                    {(
                      [
                        ["straight", "TEK SAYI"],
                        ["split", "SPLİT"],
                        ["corner", "KÖŞE"],
                        ["street", "SOKAK"],
                        ["six-line", "6’LI"],
                      ] as Array<[MobileBetMode, string]>
                    ).map(([mode, label]) => (
                      <button
                        className={mobileBetMode === mode ? "selected" : ""}
                        key={mode}
                        onClick={() => setMobileBetMode(mode)}
                        aria-pressed={mobileBetMode === mode}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      className="mobile-roulette-info"
                      onClick={() => setRulesOpen(true)}
                      aria-label="Rulet masa kurallarını aç"
                    >
                      ⓘ
                    </button>
                  </nav>
                  <div
                    className={`roulette-mobile-board mode-${mobileBetMode}`}
                  >
                    <div className="mobile-zero">
                      {renderBetButton(straightBet(0), "number-bet green")}
                      {mobileBetMode === "split" && (
                        <div className="mobile-zero-specials">
                          {[1, 2, 3].map((number) =>
                            renderBetButton(splitBet(0, number), "micro-bet"),
                          )}
                        </div>
                      )}
                      {mobileBetMode === "corner" && (
                        <div className="mobile-zero-specials basket">
                          {renderBetButton(
                            {
                              id: "basket-0-1-2-3",
                              label: "0/1/2/3 ilk dörtlü",
                              shortLabel: "0▦",
                              kind: "corner",
                              numbers: [0, 1, 2, 3],
                              payout: 8,
                            },
                            "micro-bet",
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mobile-number-shell">
                      <div className="mobile-number-grid">
                        {Array.from(
                          { length: 36 },
                          (_, index) => index + 1,
                        ).map((number) =>
                          renderBetButton(
                            straightBet(number),
                            `number-bet ${numberColour(number)}`,
                          ),
                        )}
                      </div>
                      {mobileBetMode === "split" && (
                        <div className="mobile-intersection-layer split-layer">
                          {mobileHorizontalSplits.map(
                            ({ definition, x, y }) => (
                              <div
                                className="mobile-hotspot horizontal"
                                key={definition.id}
                                style={{ left: `${x}%`, top: `${y}%` }}
                              >
                                {renderBetButton(definition, "micro-bet")}
                              </div>
                            ),
                          )}
                          {mobileVerticalSplits.map(({ definition, x, y }) => (
                            <div
                              className="mobile-hotspot vertical"
                              key={definition.id}
                              style={{ left: `${x}%`, top: `${y}%` }}
                            >
                              {renderBetButton(definition, "micro-bet")}
                            </div>
                          ))}
                        </div>
                      )}
                      {mobileBetMode === "corner" && (
                        <div className="mobile-intersection-layer corner-layer">
                          {mobileCorners.map(({ definition, x, y }) => (
                            <div
                              className="mobile-hotspot corner"
                              key={definition.id}
                              style={{ left: `${x}%`, top: `${y}%` }}
                            >
                              {renderBetButton(definition, "micro-bet")}
                            </div>
                          ))}
                        </div>
                      )}
                      {mobileBetMode === "street" && (
                        <div className="mobile-street-rail">
                          {Array.from({ length: 12 }, (_, triplet) => (
                            <div key={`mobile-street-${triplet}`}>
                              {renderBetButton(
                                streetBet(triplet * 3 + 1),
                                "micro-bet street-hotspot",
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {mobileBetMode === "six-line" && (
                        <div className="mobile-sixline-rail">
                          {Array.from({ length: 11 }, (_, triplet) => (
                            <div
                              key={`mobile-six-${triplet}`}
                              style={{ top: `${((triplet + 1) / 12) * 100}%` }}
                            >
                              {renderBetButton(
                                sixLineBet(triplet * 3 + 1),
                                "micro-bet six-hotspot",
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mobile-columns">
                      {columns.map((definition, index) => (
                        <div key={definition.id}>
                          {renderBetButton(definition, "column-bet")}
                          <small>{index + 1}. SÜTUN</small>
                        </div>
                      ))}
                    </div>
                    <div className="mobile-dozens">
                      {dozens.map((definition) =>
                        renderBetButton(definition, "outside-bet dozen-bet"),
                      )}
                    </div>
                    <div className="mobile-outside">
                      {outsideBets.map((definition) =>
                        renderBetButton(
                          definition,
                          `outside-bet ${definition.id}`,
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {betSurface === "racetrack" && gameSettings.features.callBets && (
              <div className="roulette-call-console">
                <div
                  className="roulette-racetrack"
                  aria-label="Rulet komşu sayılar seçicisi"
                >
                  <div className="racetrack-title">
                    <span>RACETRACK</span>
                    <small>
                      Yuvarlağa dokun: tek sayı · Sağdaki düğme: ±2 komşu
                    </small>
                  </div>
                  <div className="racetrack-numbers">
                    {EUROPEAN_WHEEL.map((number, index) => {
                      const definition = straightBet(number);
                      const {
                        lockedBet,
                        editableBet,
                        editableDirectBet: placedDirectly,
                      } = visibleRouletteBetLayers({
                        bettingOpen,
                        lockedBets,
                        editableBets: bets,
                        definition,
                      });
                      const point = racetrackPoints[index];
                      return (
                        <button
                          type="button"
                          className={`${numberColour(number)} ${neighbourNumber === number ? "selected" : ""} ${lockedBet || editableBet ? "has-bet" : ""} ${lockedBet ? "has-locked-bet" : ""} ${editableBet && !bettingOpen ? "has-next-bet" : ""}`}
                          key={number}
                          style={{
                            left: `${point.left}%`,
                            top: `${point.top}%`,
                          }}
                          disabled={!betEditingOpen}
                          aria-label={`${number} tek sayı bahsi`}
                          title={`${number} tek sayı · 35:1`}
                          onClick={() => {
                            setNeighbourNumber(number);
                            setHovered(undefined);
                            setSelectedCallBetId(`neighbours-${number}`);
                            addBet(definition);
                          }}
                        >
                          <span>{number}</span>
                          <BetChips bet={lockedBet} layer="locked" />
                          <BetChips
                            bet={editableBet}
                            layer={bettingOpen ? "current" : "next"}
                            onRemove={
                              placedDirectly
                                ? () => removeLastChip(definition.id)
                                : undefined
                            }
                          />
                        </button>
                      );
                    })}
                    <div className="racetrack-core">
                      <small>DOKUN · TEK SAYI OYNA</small>
                      <strong>{neighbourNumber}</strong>
                      <span>Komşular için sağdaki düğme</span>
                    </div>
                  </div>
                  {gameSettings.features.neighbours &&
                    renderBetButton(
                      {
                        ...neighbourBet(neighbourNumber),
                        shortLabel: `${neighbourNumber}±2 · 5 ÇİP`,
                      },
                      "call-bet neighbour-bet racetrack-place",
                    )}
                </div>
                <div className="call-bet-rail">
                  <div className="call-heading">
                    <span>İLAN BAHİSLERİ</span>
                    <small>Çipler kapsanan alanlara dağıtılır</small>
                  </div>
                  {announcedBets.map((definition) =>
                    renderBetButton(
                      definition,
                      `call-bet ${selectedCallBetId === definition.id ? "selected-call" : ""}`,
                    ),
                  )}
                </div>
                {(() => {
                  const preview =
                    hovered?.kind === "call"
                      ? hovered
                      : (announcedBets.find(
                          (item) => item.id === selectedCallBetId,
                        ) ?? neighbourBet(neighbourNumber));
                  return (
                    <div className="call-bet-receipt">
                      <strong>{preview.label}</strong>
                      <span>
                        {preview.components
                          ?.map(
                            (component) =>
                              `${component.numbers.join("/")} · ${component.units ?? 1} çip`,
                          )
                          .join("  +  ")}
                      </span>
                      <b>
                        {betUnits(preview)} birim ·{" "}
                        {money.format(selectedChip * betUnits(preview))} PR
                        toplam
                      </b>
                      <button
                        type="button"
                        onClick={() => {
                          setHovered(preview);
                          setBetSurface("layout");
                          window.setTimeout(
                            () =>
                              setHovered((current) =>
                                current?.id === preview.id
                                  ? undefined
                                  : current,
                              ),
                            1800,
                          );
                        }}
                      >
                        ÇİPLERİ MASADA GÖR →
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
            {tableNotice && (
              <div className="roulette-table-notice" role="status">
                ★ {tableNotice}
              </div>
            )}
          </div>

          {phase === "result" && result && !resultDismissed && (
            <div
              className={`roulette-result ${result.net > 0 ? "profit" : result.net < 0 ? "loss" : "push"} ${result.multiplierReturn ? "surge-profit" : ""}`}
              role="status"
            >
              <button
                onClick={() => setResultDismissed(true)}
                aria-label="Rulet sonuç ekranını kapat"
              >
                ×
              </button>
              {result.multiplierReturn > 0 && (
                <div className="payout-flight" aria-hidden="true">
                  {Array.from({ length: 14 }, (_, index) => (
                    <i
                      key={index}
                      style={{ "--payout-index": index } as CSSProperties}
                    >
                      ◆
                    </i>
                  ))}
                </div>
              )}
              <small>
                {result.multiplierReturn
                  ? "PEHLEVAN SURGE VURDU"
                  : "KAZANAN SAYI"}
              </small>
              <div className={`winning-number ${numberColour(result.number)}`}>
                {result.number}
                {result.hitMultiplier && (
                  <em>{result.hitMultiplier.multiplier}×</em>
                )}
              </div>
              <strong>
                {result.stake ? (
                  <>
                    {money.format(result.grossReturn)} <em>PR TOPLAM ÖDEME</em>
                  </>
                ) : (
                  <>BAHİS YOK</>
                )}
              </strong>
              <p>
                {result.stake
                  ? `${money.format(result.stake)} PR bahis · net ${result.net > 0 ? "+" : result.net < 0 ? "−" : ""}${money.format(Math.abs(result.net))} PR`
                  : "Bu tur bahis koymadın"}
              </p>
              {result.hitMultiplier && (
                <b className="surge-result-note">
                  {result.multiplierReturn
                    ? `${result.hitMultiplier.multiplier}× çarpan ödemeye uygulandı`
                    : `${result.hitMultiplier.multiplier}× sayı vurdu · tek sayı bahsi yoktu`}
                </b>
              )}
              <div className="roulette-winning-breakdown">
                <div className="winning-breakdown-heading">
                  <span>KAZANAN BAHİSLER</span>
                  <small>
                    {winningBreakdown.length
                      ? `${winningBreakdown.length} alan ödeme yaptı`
                      : "ÖDEME YOK"}
                  </small>
                </div>
                {winningBreakdown.length ? (
                  winningBreakdown.map((item) => (
                    <div
                      className={`winning-breakdown-row ${item.surge ? "surge-row" : ""}`}
                      key={item.id}
                    >
                      <div>
                        <strong>{item.label}</strong>
                        <small>
                          {money.format(item.placedStake)} PR bahis
                          {item.multiplier
                            ? ` · ${item.multiplier}× Surge`
                            : ""}
                        </small>
                      </div>
                      <div>
                        <span>{money.format(item.returnAmount)} PR</span>
                        <small>
                          {item.profit >= 0 ? "+" : "−"}
                          {money.format(Math.abs(item.profit))} PR kâr
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-winning-bets">
                    {result.stake
                      ? "Bu tur kazanan bahsin yok."
                      : "Kazanç görmek için yeni turda masaya çip koy."}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <aside className="roulette-chat">
          <div className="panel-heading">
            <div>
              <span>Armand ile konuş</span>
              <small>ÇARKI, BAHİSLERİ VE GEÇMİŞİ GÖRÜYOR</small>
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
                <span>ARMAND</span>
                <p>Bir saniye; lafı tartıyorum…</p>
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
              placeholder="Armand'a yaz…"
              disabled={thinking}
            />
            <button aria-label="Gönder" disabled={thinking}>
              ↑
            </button>
          </form>
        </aside>
      </section>

      <section className="roulette-controls responsive-game-dock">
        <div className="roulette-chip-rack">
          <div>
            <small>ÇİP · ÖZEL TUTAR</small>
            <label className="roulette-custom-chip">
              <input
                aria-label="Özel rulet çip değeri"
                type="number"
                min={gameSettings.minBet}
                value={selectedChip}
                disabled={!betEditingOpen}
                onChange={(event) =>
                  setSelectedChip(
                    normalizeWagerInput(
                      Number(event.target.value),
                      gameSettings.minBet,
                    ),
                  )
                }
              />
              <span>PR</span>
            </label>
            <button
              className="roulette-chip-max"
              disabled={
                !betEditingOpen || balance - stake < gameSettings.minBet
              }
              onClick={() =>
                setSelectedChip(Math.max(gameSettings.minBet, balance - stake))
              }
            >
              MAX
            </button>
            <div className="roulette-audio-toggles">
              <button
                className={audioSettings.effects ? "active" : ""}
                disabled={!gameSettings.sound || !admin.general.masterSound}
                onClick={() =>
                  setAudioSettings((value) => ({
                    ...value,
                    effects: !value.effects,
                  }))
                }
              >
                {audioSettings.effects ? "FX" : "FX KAPALI"}
              </button>
              <button
                className={audioSettings.ambience ? "active" : ""}
                disabled={!gameSettings.sound || !admin.general.masterSound}
                onClick={() =>
                  setAudioSettings((value) => ({
                    ...value,
                    ambience: !value.ambience,
                  }))
                }
              >
                {audioSettings.ambience ? "ORTAM" : "ORTAM KAPALI"}
              </button>
            </div>
          </div>
          <div className="roulette-chip-selector">
            {rouletteRackChips.map((chip) => (
              <RouletteChip
                key={chip}
                value={chip}
                interactive
                selected={selectedChip === chip}
                disabled={
                  !betEditingOpen ||
                  chip < gameSettings.minBet ||
                  chip > balance - stake
                }
                onClick={() => setSelectedChip(chip)}
              />
            ))}
          </div>
        </div>
        <div className="roulette-edit-actions">
          <button
            title="Son yerleştirilen çipi geri al"
            onClick={undo}
            disabled={!placementHistory.length || !betEditingOpen}
          >
            <i>↶</i>
            <span>Geri al</span>
          </button>
          <button
            title="Masadaki bütün bahisleri temizle"
            onClick={clearBets}
            disabled={!bets.length || !betEditingOpen}
          >
            <i>×</i>
            <span>Temizle</span>
          </button>
          <button
            title="Önceki turun bahsini yeniden yerleştir"
            onClick={repeatBets}
            disabled={
              !previousBets.length ||
              totalStake(previousBets) > balance ||
              !betEditingOpen
            }
          >
            <i>↻</i>
            <span>Aynı bahis</span>
          </button>
          <button
            title="Masadaki bütün bahisleri ikiye katla"
            onClick={doubleBets}
            disabled={!bets.length || stake * 2 > balance || !betEditingOpen}
          >
            <i>2×</i>
            <span>İkiye katla</span>
          </button>
          <button
            title="Mevcut bahis düzenini favori olarak kaydet"
            onClick={saveFavorite}
            disabled={!bets.length || !betEditingOpen}
          >
            <i>◇</i>
            <span>Kaydet</span>
          </button>
          <button
            title="Favori bahis düzenini masaya yerleştir"
            onClick={placeFavorite}
            disabled={
              !favoriteBets.length ||
              totalStake(favoriteBets) > balance ||
              !betEditingOpen
            }
          >
            <i>◆</i>
            <span>Favoriyi oyna</span>
          </button>
        </div>
        <div className={`auto-round-command phase-${phase}`}>
          <div
            className="round-countdown"
            style={
              {
                "--countdown-progress": `${phase === "betting" ? (countdown / 20) * 360 : phase === "result" ? (countdown / 3) * 360 : 360}deg`,
              } as CSSProperties
            }
          >
            <span>
              {phase === "surge"
                ? "⚡"
                : phase === "spinning"
                  ? "●"
                  : countdown}
            </span>
            <small>
              {phase === "betting"
                ? "SN"
                : phase === "result"
                  ? "YENİ TUR"
                  : phase === "surge"
                    ? "SURGE"
                    : "TOP"}
            </small>
          </div>
          <div className="round-command-copy">
            <small>
              {phase === "betting"
                ? "BAHİSLER AÇIK"
                : phase === "surge"
                  ? "ŞİMŞEK SAYILARI"
                  : phase === "spinning"
                    ? "BAHİSLER KAPANDI"
                    : "SONUÇ MASADA"}
            </small>
            <strong>
              {phase === "betting"
                ? "Otomatik spin hazırlanıyor"
                : phase === "surge"
                  ? "Çarpanlar masaya iniyor"
                  : phase === "spinning"
                    ? "Top çarkta dönüyor"
                    : `${countdown} saniye sonra yeni tur`}
            </strong>
            <em>
              {phase === "betting"
                ? "Süre bitince çark kendiliğinden döner"
                : phase === "result"
                  ? "Sonuçlanan çipler masada · sonraki turu hazırlayabilirsin"
                  : "Mevcut tur kilitli · çiplerin sonraki tur için hazırlanır"}
            </em>
          </div>
          <div className="round-stake">
            <small>
              {bettingOpen ? "MASADAKİ TOPLAM" : "DÖNEN TURUN BAHİSİ"}
            </small>
            <strong>{money.format(currentRoundStake)} PR</strong>
            <em>
              {currentRoundChipCount} çip · {currentRoundBets.length} alan
            </em>
            {!bettingOpen && (
              <span className="next-round-stake">
                SONRAKİ TUR · {money.format(stake)} PR
              </span>
            )}
          </div>
        </div>
      </section>
      {rulesOpen && (
        <div
          className="roulette-rules-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section
            className="roulette-rules-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Avrupa ruleti masa kuralları"
          >
            <button
              className="modal-close"
              onClick={() => setRulesOpen(false)}
              aria-label="Kuralları kapat"
            >
              ×
            </button>
            <small>ROUGE SALON · TEK SIFIR</small>
            <h2>Çip masada nereye konur?</h2>
            <div>
              <article>
                <b>TEK SAYI · 35:1</b>
                <p>
                  Sayının ortasına dokun. Mobil masada “Tek Sayı” modu bunu hep
                  açık tutar.
                </p>
              </article>
              <article>
                <b>SPLİT · 17:1</b>
                <p>İki komşu sayının ortak çizgisindeki altın noktaya dokun.</p>
              </article>
              <article>
                <b>SOKAK · 11:1</b>
                <p>
                  Aynı yatay sıradaki üç sayıyı kapsar. Sokak modunda sağ kenar
                  noktaları açılır.
                </p>
              </article>
              <article>
                <b>KÖŞE · 8:1</b>
                <p>Dört sayının kesiştiği köşeye dokun.</p>
              </article>
              <article>
                <b>6’LI · 5:1</b>
                <p>Yan yana iki sokağı, toplam altı sayıyı kapsar.</p>
              </article>
              <article>
                <b>SÜTUN / DÜZİNE · 2:1</b>
                <p>
                  2:1 satırı sütunları; 1–12, 13–24 ve 25–36 alanları düzineleri
                  oynar.
                </p>
              </article>
            </div>
            <p>
              Kırmızı/siyah, tek/çift ve 1–18/19–36 bahisleri 1:1 öder. Avrupa
              tek sıfırlı masa 37 ceptir.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
