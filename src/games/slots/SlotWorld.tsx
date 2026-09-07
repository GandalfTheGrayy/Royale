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
import { askRocco, roccoEventLine } from "../../ai/rocco";
import {
  createRecordId,
  recordAIConversation,
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
import {
  evaluateSlot,
  gridFromStops,
  nextStops,
  SLOT_PAYLINES,
  SLOT_SYMBOLS,
  winningCellSet,
  type SlotSpinResult,
} from "./slot-engine";
import NeonVault from "./NeonVault";
import FishermanSlot from "./FishermanSlot";
import Sekerhane1024 from "./Sekerhane1024";
import AllahinLutfu from "./AllahinLutfu";
import BaykusMadeni from "./BaykusMadeni";
import "./slots.css";
import "./neon-responsive.css";
import { CASINO_BET_STEPS } from "../wagering";
import { waitForPresentation } from "./cascade-presentation";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  aiOnline: boolean;
};

type Message = { speaker: "Rocco" | "Sen"; text: string; moment: string };
type GameId =
  | "kiraz-77"
  | "neon-kasa"
  | "kaptan-mercan"
  | "sekerhane-1024"
  | "allahin-lutfu"
  | "baykus-madeni"
  | "sokak-patileri"
  | "meyve-lab"
  | "pinball";

const money = new Intl.NumberFormat("tr-TR");
const KIRAZ_BET_STEPS = CASINO_BET_STEPS;
const now = () =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const games: Array<{
  id: GameId;
  order: string;
  name: string;
  mechanic: string;
  mood: string;
  volatility: string;
  available: boolean;
}> = [
  {
    id: "kiraz-77",
    order: "01",
    name: "Kiraz Kulübü 77",
    mechanic: "3×3 · 5 çizgi · Hold",
    mood: "RETRO DİNER",
    volatility: "ORTA",
    available: true,
  },
  {
    id: "neon-kasa",
    order: "02",
    name: "Neon Kasası",
    mechanic: "7×7 · Cluster · Cascade · Çarpan hücreleri",
    mood: "SİBER SOYGUN",
    volatility: "ORTA/YÜKSEK",
    available: true,
  },
  {
    id: "kaptan-mercan",
    order: "03",
    name: "Kaptan Mercan",
    mechanic: "5×4 · Para balığı · Kaptan toplama",
    mood: "GECE LİMANI",
    volatility: "YÜKSEK",
    available: true,
  },
  {
    id: "sekerhane-1024",
    order: "04",
    name: "Şekerhane 1024",
    mechanic: "7×7 · Küme · Kalıcı hücre çarpanları",
    mood: "GECE ŞEKERHANESİ",
    volatility: "ÇOK YÜKSEK",
    available: true,
  },
  {
    id: "allahin-lutfu",
    order: "05",
    name: "Allah’ın Lütfu",
    mechanic: "5×6 · 28 çizgi · Nur Gözü · Coin collect · 4 bonus",
    mood: "NUR DİVANI",
    volatility: "ÇOK YÜKSEK",
    available: true,
  },
  {
    id: "baykus-madeni",
    order: "06",
    name: "Baykuş Madeni",
    mechanic: "5×3 düşüş · 5×6 blok · Kalıcı kazı bonusu",
    mood: "PİKSEL GALERİ",
    volatility: "YÜKSEK",
    available: true,
  },
  {
    id: "sokak-patileri",
    order: "07",
    name: "Sokak Patileri",
    mechanic: "5×5 cluster · Sticky çarpan wild",
    mood: "NEON MAHALLE",
    volatility: "YÜKSEK",
    available: false,
  },
  {
    id: "meyve-lab",
    order: "08",
    name: "Meyve Laboratuvarı",
    mechanic: "5×5 · Büyüyen wild · Zincir bonus",
    mood: "TROPİK DENEY",
    volatility: "ORTA",
    available: false,
  },
  {
    id: "pinball",
    order: "09",
    name: "Pehlevan Pinball",
    mechanic: "Slot · Fizik bonusu",
    mood: "ARCADE",
    volatility: "DEĞİŞKEN",
    available: false,
  },
];

function speakBrowser(text: string) {
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
  utterance.rate = 0.98;
  utterance.pitch = 0.82;
  window.speechSynthesis.speak(utterance);
}

export default function SlotWorld({
  balance,
  setBalance,
  onExit,
  aiOnline,
}: Props) {
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const [activeGame, setActiveGame] = useState<GameId>();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeGame]);

  if (activeGame === "kiraz-77" && admin.games["kiraz-77"].enabled)
    return (
      <KirazSlot
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
        aiOnline={aiOnline && admin.games["kiraz-77"].aiHost}
      />
    );
  if (activeGame === "neon-kasa" && admin.games["neon-kasasi"].enabled)
    return (
      <NeonVault
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
        aiOnline={aiOnline && admin.games["neon-kasasi"].aiHost}
      />
    );
  if (activeGame === "kaptan-mercan" && admin.games["kaptan-mercan"].enabled)
    return (
      <FishermanSlot
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
        aiOnline={aiOnline && admin.games["kaptan-mercan"].aiHost}
      />
    );
  if (activeGame === "sekerhane-1024" && admin.games["sekerhane-1024"].enabled)
    return (
      <Sekerhane1024
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
        aiOnline={aiOnline && admin.games["sekerhane-1024"].aiHost}
      />
    );
  if (activeGame === "allahin-lutfu" && admin.games["allahin-lutfu"].enabled)
    return (
      <AllahinLutfu
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
        aiOnline={false}
      />
    );
  if (activeGame === "baykus-madeni" && admin.games["baykus-madeni"].enabled)
    return (
      <BaykusMadeni
        balance={balance}
        setBalance={setBalance}
        onBack={() => setActiveGame(undefined)}
      />
    );

  return (
    <main className="slot-world">
      <header className="slot-world-topbar">
        <button onClick={onExit}>
          ← <span>Casino lobisi</span>
        </button>
        <div className="slot-world-brand">
          <i>RR</i>
          <span>
            ROYAL REELS<small>SLOT DISTRICT</small>
          </span>
        </div>
        <div className="slot-world-balance">
          ✦ {money.format(balance)} <small>PR</small>
        </div>
      </header>

      <section className="slot-world-hero">
        <div className="slot-world-copy">
          <small>PEHLEVAN ROYALE · KAT 02</small>
          <h1>
            Bir salon değil.
            <br />
            <em>Yedi ayrı dünya.</em>
          </h1>
          <p>
            Her makinenin matematiği, ritmi ve görsel dili farklı. Retro
            çizgiden büyük-grid patlamalara, balıkçı toplamadan sticky wild’a
            kadar aynı oyunun makyajları değil.
          </p>
          <button
            disabled={!admin.games["allahin-lutfu"].enabled}
            onClick={() => setActiveGame("allahin-lutfu")}
          >
            {admin.games["allahin-lutfu"].enabled
              ? "Allah’ın Lütfu’nu aç"
              : "Nur Divanı hazırlanıyor"}{" "}
            <span>→</span>
          </button>
        </div>
        <div className="rocco-lobby">
          <div className="rocco-light" />
          <img
            src="/assets/characters/rocco-slot-host-v1.png"
            alt="Royal Reels slot katı sunucusu Rocco"
          />
          <div className="rocco-lobby-line">
            <strong>ROCCO</strong>
            <p>
              Yeşil keçeyi aşağı katta bıraktık. Burada her kapının başka bir
              huyu var.
            </p>
          </div>
        </div>
        <div className="slot-world-marquee" aria-hidden="true">
          <span>JACKPOT</span>
          <span>HOLD</span>
          <span>CASCADE</span>
          <span>BONUS</span>
        </div>
      </section>

      <section className="slot-game-grid" aria-label="Slot makineleri">
        {games.map((game) => {
          const enabled =
            game.id === "kiraz-77"
              ? admin.games["kiraz-77"].enabled
              : game.id === "neon-kasa"
                ? admin.games["neon-kasasi"].enabled
                : game.id === "kaptan-mercan"
                  ? admin.games["kaptan-mercan"].enabled
                  : game.id === "sekerhane-1024"
                    ? admin.games["sekerhane-1024"].enabled
                    : game.id === "allahin-lutfu"
                      ? admin.games["allahin-lutfu"].enabled
                      : game.id === "baykus-madeni"
                        ? admin.games["baykus-madeni"].enabled
                      : game.available;
          return (
            <button
              className={`slot-game-card theme-${game.id} ${enabled ? "available" : ""}`}
              key={game.id}
              onClick={() => {
                if (enabled) setActiveGame(game.id);
                else {
                  setNotice(`${game.name}: matematik motoru sırada.`);
                  window.setTimeout(() => setNotice(""), 2200);
                }
              }}
            >
              <span className="slot-card-order">{game.order}</span>
              <i className="slot-card-art" aria-hidden="true" />
              <small>{game.mood}</small>
              <strong>{game.name}</strong>
              <p>{game.mechanic}</p>
              <footer>
                <span>VOLATİLİTE · {game.volatility}</span>
                <b>
                  {enabled ? "OYNA →" : game.available ? "BAKIMDA" : "SIRADA"}
                </b>
              </footer>
            </button>
          );
        })}
      </section>
      {notice && (
        <div className="slot-world-notice" role="status">
          {notice}
        </div>
      )}
    </main>
  );
}

function KirazSlot({
  balance,
  setBalance,
  onBack,
  aiOnline,
}: Omit<Props, "onExit"> & { onBack: () => void }) {
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const gameSettings = admin.games["kiraz-77"];
  const [wager, setWager] = useState<number>(
    Math.max(gameSettings.minBet, gameSettings.defaultBet),
  );
  const [betStep, setBetStep] = useState(25);
  const [stops, setStops] = useState([7, 15, 25]);
  const [held, setHeld] = useState([false, false, false]);
  const [holdAvailable, setHoldAvailable] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(3);
  const [result, setResult] = useState<SlotSpinResult>();
  const [history, setHistory] = useState<
    Array<{ net: number; gross: number; symbol?: string }>
  >([]);
  const [spins, setSpins] = useState(0);
  const [profitableSpins, setProfitableSpins] = useState(0);
  const [turbo, setTurbo] = useState(false);
  const [autoCount, setAutoCount] = useState(25);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(
    gameSettings.sound && admin.general.masterSound,
  );
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "kiraz-77",
    "ai-voice",
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chat, setChat] = useState<Message[]>([
    { speaker: "Rocco", text: roccoEventLine("welcome"), moment: now() },
  ]);
  const audioRef = useRef<SlotAudio | null>(null);
  const skipPresentationRef = useRef(false);
  const roccoAiSessionRef = useRef(
    `ai-kiraz-${Date.now()}-${crypto.randomUUID()}`,
  );
  const grid = useMemo(() => gridFromStops(stops), [stops]);
  const winningCells = useMemo(
    () => winningCellSet(result?.wins ?? []),
    [result],
  );
  const totalNet = history.reduce((sum, spin) => sum + spin.net, 0);
  const hitRate = spins
    ? Math.round(
        (history.filter((spin) => spin.gross > 0).length / spins) * 100,
      )
    : 0;

  useEffect(() => {
    const audio = new SlotAudio("kiraz-77");
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

  const aiContext = () => ({
    balance,
    wager,
    lastNet: result?.net ?? null,
    spins,
    held,
    holdAvailable,
    turbo,
    autoRemaining,
  });

  const announce = (
    text: string,
    useVoice = true,
    aiKind: "assistant" | "system-event" = "system-event",
    latencyMs?: number,
  ) => {
    setChat((messages) => [
      ...messages,
      { speaker: "Rocco", text, moment: now() },
    ]);
    void recordAIConversation({
      id: createRecordId("ai-kiraz", roccoAiSessionRef.current),
      sessionId: roccoAiSessionRef.current,
      game: "kiraz-77",
      character: "Rocco",
      speaker: aiKind,
      occurredAt: new Date().toISOString(),
      text,
      context: aiContext(),
      model:
        aiKind === "assistant"
          ? aiOnline
            ? "local-ai"
            : "fallback-persona"
          : undefined,
      latencyMs,
    });
    if (voiceEnabled && useVoice) speakBrowser(text);
  };

  const spin = async (fromAuto = false) => {
    if (spinning || balance < wager) return;
    skipPresentationRef.current = false;
    const startedAt = new Date().toISOString();
    const roundId = `kiraz-77-${Date.now()}-${crypto.randomUUID()}`;
    const payoutScale = getAdminSettings().games["kiraz-77"].slot?.math.payoutScale ?? 1;
    const balanceBefore = balance;
    if (fromAuto) setAutoRemaining((value) => Math.max(0, value - 1));
    setSpinning(true);
    setStoppedReels(0);
    setResult(undefined);
    setBalance((value) => value - wager);
    audioRef.current?.play("spin");
    const next = nextStops(stops, held);
    setStops(next);
    const stopTimes = turbo ? [300, 500, 700] : [620, 920, 1220];
    for (let reel = 0; reel < 3; reel += 1) {
      await waitForPresentation(
        reel === 0 ? stopTimes[0] : stopTimes[reel] - stopTimes[reel - 1],
        () => skipPresentationRef.current,
      );
      setStoppedReels(reel + 1);
      audioRef.current?.play("stop", reel);
    }
    await waitForPresentation(
      turbo ? 140 : 180,
      () => skipPresentationRef.current,
    );
    const nextResult = evaluateSlot(next, wager, undefined, payoutScale);
    if (nextResult.grossReturn)
      setBalance((value) => value + nextResult.grossReturn);
    setResult(nextResult);
    setSpins((value) => value + 1);
    if (nextResult.net > 0) setProfitableSpins((value) => value + 1);
    setHistory((items) =>
      [
        {
          net: nextResult.net,
          gross: nextResult.grossReturn,
          symbol: nextResult.wins[0]
            ? SLOT_SYMBOLS[nextResult.wins[0].symbol].label
            : undefined,
        },
        ...items,
      ].slice(0, 10),
    );
    setHoldAvailable(nextResult.grossReturn === 0);
    setHeld([false, false, false]);
    setSpinning(false);
    const labels = [
      ...new Set(nextResult.wins.map((win) => SLOT_SYMBOLS[win.symbol].label)),
    ];
    const kind =
      nextResult.net >= wager * 8
        ? "bigWin"
        : nextResult.grossReturn > 0
          ? "win"
          : "loss";
    if (nextResult.grossReturn)
      audioRef.current?.play(kind === "bigWin" ? "bigWin" : "win");
    announce(
      roccoEventLine(kind, { lastNet: nextResult.net, lastWinLabels: labels }),
      !fromAuto || kind !== "loss",
    );
    const settledAt = new Date().toISOString();
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "kiraz-77",
      variant: "Kiraz Kulübü 77 · 3×3 · 5 çizgi · Hold",
      source: "player",
      playerParticipated: true,
      startedAt,
      settledAt,
      stake: wager,
      grossPayout: nextResult.grossReturn,
      net: nextResult.net,
      outcome:
        nextResult.net > 0 ? "win" : nextResult.net < 0 ? "loss" : "push",
      balanceBefore,
      balanceAfter: balanceBefore + nextResult.net,
      result: {
        telemetryVersion: 2,
        rngModel: "independent-crypto-stop-v1",
        wager,
        lineBet: wager / SLOT_PAYLINES.length,
        paylineCount: SLOT_PAYLINES.length,
        stopsBefore: stops,
        stopsAfter: next,
        heldReels: held
          .map((value, reel) => (value ? reel : null))
          .filter((reel) => reel !== null),
        grid: gridFromStops(next),
        wins: nextResult.wins,
        winningLines: nextResult.wins.map((win) => win.line),
        grossReturn: nextResult.grossReturn,
        net: nextResult.net,
        winMultiple: wager ? nextResult.grossReturn / wager : 0,
      },
      modifiers: {
        auto: fromAuto,
        turbo,
        holdUsed: held.some(Boolean),
        autoRemainingBefore: autoRemaining,
        sessionSpin: spins + 1,
      },
    });
    void recordWalletEntry({
      id: createRecordId("ledger-stake", roundId),
      roundId,
      game: "kiraz-77",
      occurredAt: startedAt,
      type: "stake",
      amount: -wager,
      balanceBefore,
      balanceAfter: balanceBefore - wager,
      note: "Kiraz Kulübü 77 spin bahsi",
    });
    if (nextResult.grossReturn)
      void recordWalletEntry({
        id: createRecordId("ledger-payout", roundId),
        roundId,
        game: "kiraz-77",
        occurredAt: settledAt,
        type: "payout",
        amount: nextResult.grossReturn,
        balanceBefore: balanceBefore - wager,
        balanceAfter: balanceBefore + nextResult.net,
        note: "Kiraz Kulübü 77 spin ödemesi",
      });
  };

  useEffect(() => {
    if (!autoRemaining || spinning) return;
    if (balance < wager) {
      setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(
      () => {
        void spin(true);
      },
      turbo ? 240 : 560,
    );
    return () => window.clearTimeout(timer);
    // `spin` deliberately reads the latest render state each time this timer is installed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRemaining, spinning, balance, wager, turbo]);

  const changeWager = (next: number) => {
    if (spinning || autoRemaining) return;
    const naturalMaximum = Math.max(
      gameSettings.minBet,
      Math.floor(balance / 5) * 5,
    );
    setWager(
      Math.min(
        naturalMaximum,
        Math.max(gameSettings.minBet, Math.floor(next / 5) * 5),
      ),
    );
  };

  const toggleHold = (reel: number) => {
    if (!gameSettings.features.hold || !holdAvailable || spinning) return;
    const selected = held.filter(Boolean).length;
    if (!held[reel] && selected >= 2) return;
    setHeld((current) =>
      current.map((value, index) => (index === reel ? !value : value)),
    );
    audioRef.current?.play("button");
  };

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
      id: createRecordId("ai-kiraz-user", roccoAiSessionRef.current),
      sessionId: roccoAiSessionRef.current,
      game: "kiraz-77",
      character: "Rocco",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: aiContext(),
    });
    setDraft("");
    setThinking(true);
    const aiStartedAt = performance.now();
    const answer = await askRocco(prompt, {
      game: "Kiraz Kulübü 77",
      balance,
      wager,
      lastNet: result?.net,
      lastWinLabels:
        result?.wins.map((win) => SLOT_SYMBOLS[win.symbol].label) ?? [],
      spins,
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

  const stopPresentation = () => {
    skipPresentationRef.current = true;
    setAutoRemaining(0);
  };

  return (
    <main className="kiraz-slot">
      <header className="kiraz-topbar">
        <button
          onClick={() => {
            setTurbo(false);
            onBack();
          }}
        >
          ← <span>Slot Dünyası</span>
        </button>
        <div className="kiraz-logo">
          <i>77</i>
          <span>
            KİRAZ KULÜBÜ<small>FIVE LINE DELUXE</small>
          </span>
        </div>
        <div className="kiraz-topbar-actions">
          <GameMusicControls game="kiraz-77" />
          <div className="kiraz-wallet">
            ✦ {money.format(balance)} <small>PR</small>
          </div>
        </div>
      </header>

      <section className="kiraz-layout">
        <aside className="kiraz-host">
          <div className="host-neon">
            ROCCO'S
            <br />
            PICK
          </div>
          <img
            src="/assets/characters/rocco-slot-host-v1.png"
            alt="Slot sunucusu Rocco"
          />
          <div className="host-caption">
            <strong>ROCCO</strong>
            <p>
              {
                chat.filter((message) => message.speaker === "Rocco").at(-1)
                  ?.text
              }
            </p>
          </div>
          <div className="kiraz-session">
            <small>BU OTURUM</small>
            <div>
              <span>
                SPİN<b>{spins}</b>
              </span>
              <span>
                ARTIDA<b>{profitableSpins}</b>
              </span>
              <span>
                HIT<b>%{hitRate}</b>
              </span>
            </div>
          </div>
        </aside>

        <section
          className={`slot-cabinet ${spinning ? "is-spinning" : ""} ${result?.net && result.net > wager * 8 ? "big-win" : ""}`}
        >
          <div className="cabinet-bulbs" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <i key={index} style={{ "--bulb": index } as CSSProperties} />
            ))}
          </div>
          <div className="cabinet-title">
            <small>ROCCO SUNAR</small>
            <h1>
              KİRAZ <em>77</em>
            </h1>
            <p>5 ÇİZGİ · HOLD DELUXE</p>
          </div>
          <div className="reel-window">
            <span className="payline-number left">
              1<br />4<br />2<br />5<br />3
            </span>
            <span className="payline-number right">
              1<br />4<br />2<br />5<br />3
            </span>
            <svg
              className="win-lines"
              viewBox="0 0 300 300"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {result?.wins.map((win) => (
                <polyline
                  key={win.line}
                  points={SLOT_PAYLINES[win.line].rows
                    .map((row, reel) => `${50 + reel * 100},${50 + row * 100}`)
                    .join(" ")}
                />
              ))}
            </svg>
            <div className="reels">
              {[0, 1, 2].map((reel) => (
                <div
                  className={`slot-reel ${stoppedReels <= reel ? "rolling" : "stopped"} ${held[reel] ? "held" : ""}`}
                  key={reel}
                >
                  <div className="reel-strip">
                    {grid.map((row, rowIndex) => (
                      <div
                        className={`slot-symbol ${winningCells.has(`${rowIndex}-${reel}`) ? "winner" : ""}`}
                        key={`${rowIndex}-${row[reel]}-${stops[reel]}`}
                      >
                        <img
                          src={SLOT_SYMBOLS[row[reel]].image}
                          alt={SLOT_SYMBOLS[row[reel]].label}
                        />
                        <span>{SLOT_SYMBOLS[row[reel]].label}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    className={held[reel] ? "active" : ""}
                    onClick={() => toggleHold(reel)}
                    disabled={
                      !gameSettings.features.hold || !holdAvailable || spinning
                    }
                  >
                    {gameSettings.features.hold
                      ? held[reel]
                        ? "KİLİTLİ"
                        : "HOLD"
                      : "HOLD KAPALI"}
                    <small>MAKARA {reel + 1}</small>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`slot-result-panel ${result ? (result.net > 0 ? "profit" : result.grossReturn ? "return" : "loss") : ""}`}
          >
            {!result && (
              <>
                <small>{spinning ? "MAKARALAR DÖNÜYOR" : "MAKİNE HAZIR"}</small>
                <strong>{spinning ? "···" : "ÇEVİR"}</strong>
                <p>
                  {holdAvailable
                    ? "En fazla iki makarayı HOLD ile kilitleyebilirsin."
                    : "Bahis seç ve ışıkları uyandır."}
                </p>
              </>
            )}
            {result && (
              <>
                <small>
                  {result.grossReturn
                    ? "BU SPİNİN TOPLAM ÖDEMESİ"
                    : "BU SPİN ÖDEME YAPMADI"}
                </small>
                <strong>
                  {money.format(result.grossReturn)} <em>PR ÖDEME</em>
                </strong>
                <p>
                  {money.format(wager)} PR bahis · net{" "}
                  {result.net > 0 ? "+" : result.net < 0 ? "−" : ""}
                  {money.format(Math.abs(result.net))} PR
                </p>
                {result.wins.length > 0 && (
                  <div>
                    {result.wins.map((win) => (
                      <span key={win.line}>
                        <b>
                          {win.line + 1}. çizgi ·{" "}
                          {SLOT_SYMBOLS[win.symbol].label}
                          {win.count === 2 ? " ×2" : ""}
                        </b>
                        <em>{money.format(win.returnAmount)} PR</em>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="slot-controls">
            <button className="rules-button" onClick={() => setRulesOpen(true)}>
              ⓘ<span>ÖDEMELER</span>
            </button>
            <div className="wager-control">
              <small>
                TOPLAM BAHİS · MİN {money.format(gameSettings.minBet)} PR
              </small>
              <div>
                <button
                  onClick={() => changeWager(wager - betStep)}
                  disabled={
                    spinning || !!autoRemaining || wager <= gameSettings.minBet
                  }
                >
                  −
                </button>
                <label>
                  <input
                    aria-label="Toplam bahis"
                    type="number"
                    min={gameSettings.minBet}
                    step="5"
                    max={balance}
                    value={wager}
                    onChange={(event) =>
                      changeWager(Number(event.target.value))
                    }
                    disabled={spinning || !!autoRemaining}
                  />
                  <em>PR</em>
                </label>
                <button
                  onClick={() => changeWager(wager + betStep)}
                  disabled={
                    spinning || !!autoRemaining || wager + betStep > balance
                  }
                >
                  +
                </button>
                <select
                  className="kiraz-bet-step"
                  aria-label="Bahis artış kademesi"
                  value={betStep}
                  onChange={(event) => setBetStep(Number(event.target.value))}
                >
                  {KIRAZ_BET_STEPS.map((step) => (
                    <option key={step} value={step}>
                      {step >= 1000 ? `${step / 1000}K` : step}
                    </option>
                  ))}
                </select>
                <button
                  className="max-wager"
                  onClick={() => changeWager(balance)}
                  disabled={
                    spinning || !!autoRemaining || balance < gameSettings.minBet
                  }
                >
                  MAX
                </button>
              </div>
              <span>
                Adım {money.format(betStep)} PR · üst sınır yalnızca bakiyen ·
                çizgi başı {money.format(wager / 5)} PR
              </span>
            </div>
            <button
              className={`spin-button ${spinning ? "is-stop" : ""}`}
              onClick={() => (spinning ? stopPresentation() : void spin())}
              disabled={!spinning && (!!autoRemaining || balance < wager)}
            >
              <i>{spinning ? "■" : "↻"}</i>
              <span>{spinning ? "DUR" : "ÇEVİR"}</span>
            </button>
            <div className="machine-toggles">
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
                ♪<span>{audioEnabled ? "SES" : "SESSİZ"}</span>
              </button>
              <button
                className={voiceEnabled ? "active" : ""}
                onClick={() => setVoiceEnabled((value) => !value)}
                disabled={!gameSettings.aiHost || !admin.general.aiEnabled}
              >
                ●<span>ROCCO</span>
              </button>
              <label className="auto-control">
                <select
                  aria-label="Otomatik spin sayısı"
                  value={autoCount}
                  onChange={(event) => setAutoCount(Number(event.target.value))}
                  disabled={
                    spinning || !!autoRemaining || !gameSettings.autoplay
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
                    (!autoRemaining && (spinning || balance < wager))
                  }
                >
                  {autoRemaining ? "■" : "↻"}
                  <span>{autoRemaining ? `DUR ${autoRemaining}` : "AUTO"}</span>
                </button>
              </label>
            </div>
          </div>
        </section>

        <aside className="slot-side-panel">
          <div className="slot-history">
            <header>
              <span>SON SPİNLER</span>
              <small>NET SONUÇ</small>
            </header>
            {history.length ? (
              history.map((item, index) => (
                <div key={index}>
                  <i
                    className={item.net > 0 ? "up" : item.net < 0 ? "down" : ""}
                  >
                    {item.net > 0 ? "+" : item.net < 0 ? "−" : "·"}
                  </i>
                  <span>{item.symbol ?? "Boş spin"}</span>
                  <b>{money.format(Math.abs(item.net))} PR</b>
                </div>
              ))
            ) : (
              <p>İlk spin bekleniyor.</p>
            )}
            <footer>
              <span>OTURUM NETİ</span>
              <strong className={totalNet >= 0 ? "positive" : ""}>
                {totalNet > 0 ? "+" : totalNet < 0 ? "−" : ""}
                {money.format(Math.abs(totalNet))} PR
              </strong>
            </footer>
          </div>
          <div className="rocco-chat">
            <header>
              <div>
                <span>Rocco ile konuş</span>
                <small>
                  {aiOnline ? "YEREL AI · MAKİNEYİ GÖRÜYOR" : "YEDEK KİŞİLİK"}
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
                  <span>Rocco</span>
                  <p>Bir saniye, lafı makaradan çıkarıyorum…</p>
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
                placeholder="Rocco'ya yaz…"
                disabled={thinking}
              />
              <button aria-label="Gönder" disabled={thinking}>
                ↑
              </button>
            </form>
          </div>
        </aside>
      </section>

      {rulesOpen && (
        <div
          className="slot-rules-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section
            className="slot-rules"
            role="dialog"
            aria-modal="true"
            aria-label="Kiraz Kulübü ödeme tablosu"
          >
            <button
              onClick={() => setRulesOpen(false)}
              aria-label="Ödeme tablosunu kapat"
            >
              ×
            </button>
            <small>KİRAZ KULÜBÜ 77</small>
            <h2>Ödeme tablosu</h2>
            <p>
              Beş çizgi aynı anda oynanır. Toplam bahis beşe eşit bölünür;
              ödemeler soldan sağa hesaplanır.
            </p>
            <div>
              {Object.values(SLOT_SYMBOLS).map((symbol) => (
                <article key={symbol.id}>
                  <img src={symbol.image} alt="" />
                  <span>
                    <strong>{symbol.label}</strong>
                    <small>Üç aynı sembol</small>
                  </span>
                  <b>{symbol.multiplier}×</b>
                </article>
              ))}
            </div>
            <footer>
              <span>İki soldan kiraz</span>
              <b>8×</b>
              <p>
                Temel oyunun teorik geri dönüşü %93,49'dur. Kazançsız spinden
                sonra en fazla iki makarayı bir sonraki spin için HOLD ile
                tutabilirsin. Bu uygulamada yalnızca sanal PR kullanılır.
              </p>
              <small>
                Semboller: Molly “Cougarmint” Willits · CC BY / CC BY-SA 3.0
              </small>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
