import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import GameMusicControls from "../../audio/GameMusicControls";
import { playGameSfx } from "../../audio/game-sfx";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { gameSfxLevel } from "../../audio/user-sfx-preferences";
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
import { askLale } from "../../ai/lale";
import {
  canCashOut,
  adjustBetAmount,
  adaptiveBetStep,
  buildCrashChart,
  multiplierTone,
} from "./altin-rota-engine";
import {
  getLiveAltinRotaState,
  subscribeLiveAltinRota,
} from "./live-altin-rota";
import "./instant.css";
import { CASINO_CHIP_VALUES, compactWager } from "../wagering";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  onBackToWorld: () => void;
  aiOnline: boolean;
};

type Phase = "betting" | "flying" | "crashed";
type BetPanel = {
  amount: number;
  activeAmount: number;
  autoBet: boolean;
  autoCashoutEnabled: boolean;
  autoCashout: number;
  queued: boolean;
  active: boolean;
  inRound: boolean;
  cashedOut: boolean;
  cashoutMultiplier: number | null;
  payout: number;
};
type SalonPlayer = {
  id: string;
  name: string;
  bet: number;
  target: number;
  cashedAt: number | null;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const multiplierFormat = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const quickBets = CASINO_CHIP_VALUES;
const salonNames = [
  "Derya",
  "Atlas",
  "Ece",
  "Rüzgâr",
  "Nehir",
  "Mert",
  "Selin",
  "Baran",
  "Hazal",
  "Kuzey",
  "Aylin",
  "Rocco",
  "Deniz",
  "Eylül",
  "Sarp",
  "İdil",
  "Umut",
  "Lina",
  "Poyraz",
  "Cem",
];
const initialPanel = (amount: number): BetPanel => ({
  amount,
  activeAmount: 0,
  autoBet: false,
  autoCashoutEnabled: true,
  autoCashout: 2,
  queued: false,
  active: false,
  inRound: false,
  cashedOut: false,
  cashoutMultiplier: null,
  payout: 0,
});

const delay = (ms: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));
function makeSalon(count: number): SalonPlayer[] {
  return Array.from({ length: count }, (_, index) => {
    const rare = Math.random() < 0.08;
    const target = rare
      ? 5 + Math.random() * 20
      : 1.15 + Math.random() ** 2.1 * 3.8;
    const betSteps = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];
    return {
      id: `${Date.now()}-${index}`,
      name: `${salonNames[index % salonNames.length]}${index >= salonNames.length ? index : ""}`,
      bet: betSteps[Math.floor(Math.random() * betSteps.length)],
      target: Math.round(target * 100) / 100,
      cashedAt: null,
    };
  });
}

function phaseCopy(
  phase: Phase,
  countdown: number,
  multiplier: number,
  crashPoint: number,
) {
  if (phase === "betting")
    return `Bahisler açık · kalkışa ${Math.max(0, countdown / 1000).toFixed(1)} saniye`;
  if (phase === "flying") {
    if (multiplier >= 10)
      return "Lâle: “Bu irtifada gözün rakamda, elin çıkışta olsun.”";
    if (multiplier >= 3)
      return "Lâle: “Rota uzadı Muharrem; karar artık tamamen sende.”";
    if (multiplier >= 1.6)
      return "Lâle: “İstanbul aşağıda küçülüyor. Çıkış hâlâ açık.”";
    return "Lâle: “Kalkış temiz. İstediğin an kazancı alabilirsin.”";
  }
  return crashPoint <= 1.1
    ? `Lâle: “Daha pistten ayrılırken rota kesildi: ${crashPoint.toFixed(2)}×.”`
    : `Lâle: “Rota ${crashPoint.toFixed(2)}× noktasında kapandı. Yeni uçuş hazırlanıyor.”`;
}

export default function AltinRotaRoom({
  balance,
  setBalance,
  onExit,
  onBackToWorld,
  aiOnline,
}: Props) {
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const live = useSyncExternalStore(
    subscribeLiveAltinRota,
    getLiveAltinRotaState,
    getLiveAltinRotaState,
  );
  const game = admin.games["altin-rota"];
  const tuning = game.crash!;
  const phase: Phase = live.phase;
  const countdown = live.countdownMs;
  const multiplier = live.multiplier;
  const round = live.ready ? live.round : null;
  const history = live.history;
  const [panels, setPanels] = useState<BetPanel[]>([
    initialPanel(Math.max(game.minBet, game.defaultBet)),
    initialPanel(Math.max(game.minBet, game.defaultBet)),
  ]);
  const [mobilePanel, setMobilePanel] = useState(0);
  const [salon, setSalon] = useState<SalonPlayer[]>(() =>
    makeSalon(tuning.livePlayerCount),
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fairOpen, setFairOpen] = useState(false);
  const [lastNet, setLastNet] = useState<number | null>(null);
  const [lastSettlement, setLastSettlement] = useState<{
    stake: number;
    grossPayout: number;
    net: number;
  } | null>(null);
  const [flash, setFlash] = useState<"cashout" | "crash" | null>(null);
  const [chat, setChat] = useState<
    Array<{ speaker: "Lâle" | "Sen"; text: string }>
  >([
    {
      speaker: "Lâle",
      text: "Hoş geldin Muharrem. İki panel de senin; rota kesilmeden hangisini kasaya çekeceğine sen karar verirsin.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useGameAudioPreference(
    "altin-rota",
    "effects",
    true,
  );
  const phaseRef = useRef(phase);
  const multiplierRef = useRef(multiplier);
  const panelsRef = useRef(panels);
  const balanceRef = useRef(balance);
  const roundRef = useRef(round);
  const settingsRef = useRef({ game, tuning });
  const audioContextRef = useRef<AudioContext | null>(null);
  const humRef = useRef<HTMLAudioElement | null>(null);
  const sfxEnabledRef = useRef(sfxEnabled);
  const previousLiveRef = useRef({
    roundId: live.round.roundId,
    phase: live.phase,
  });
  const settledPlayerRoundsRef = useRef(new Set<string>());
  const cashOutRef = useRef<
    (index: number, at: number, automatic?: boolean) => void
  >(() => undefined);
  const reserveRef = useRef<(index: number, automatic?: boolean) => void>(
    () => undefined,
  );
  const chatSessionRef = useRef(
    `ai-altin-rota-${Date.now()}-${crypto.randomUUID()}`,
  );
  const roundBalanceBeforeRef = useRef(balance);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    multiplierRef.current = multiplier;
  }, [multiplier]);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(() => {
    settingsRef.current = { game, tuning };
  }, [game, tuning]);
  useEffect(() => {
    sfxEnabledRef.current = sfxEnabled;
    if (!sfxEnabled) stopHum();
  }, [sfxEnabled]);

  const updatePanels = (updater: (current: BetPanel[]) => BetPanel[]) => {
    const next = updater(panelsRef.current);
    panelsRef.current = next;
    setPanels(next);
  };

  const tone = (kind: "bet" | "takeoff" | "cashout" | "crash") => {
    const current = settingsRef.current.game;
    if (!sfxEnabledRef.current || !admin.general.masterSound || !current.sound)
      return;
    if (kind === "crash") {
      playGameSfx("altin-rota","/assets/instant/altin-rota/plane-crash.mp3",0.42);
      return;
    }
    if (kind === "takeoff") return;
    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioContextRef.current ?? new AudioCtor();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain).connect(context.destination);
    const now = context.currentTime;
    const config = kind === "bet" ? [260, 390, 0.08] : [520, 980, 0.24];
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(config[0], now);
    oscillator.frequency.exponentialRampToValueAtTime(
      config[1],
      now + config[2],
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gameSfxLevel("altin-rota",0.09), now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config[2]);
    oscillator.start(now);
    oscillator.stop(now + config[2] + 0.03);
  };

  const stopHum = () => {
    const hum = humRef.current;
    if (!hum) return;
    hum.pause();
    hum.currentTime = 0;
    humRef.current = null;
  };

  const startHum = () => {
    if (
      !sfxEnabledRef.current ||
      !admin.general.masterSound ||
      !settingsRef.current.game.sound
    )
      return;
    stopHum();
    const engine = new Audio("/assets/instant/altin-rota/plane-engine.ogg");
    engine.loop = true;
    engine.volume = gameSfxLevel("altin-rota",0.2);
    engine.playbackRate = 0.88;
    humRef.current = engine;
    void engine.play().catch(() => undefined);
  };

  reserveRef.current = (index, automatic = false) => {
    const panel = panelsRef.current[index];
    if (!panel || panel.queued) return;
    const amount = Math.max(
      settingsRef.current.game.minBet,
      Math.round(panel.amount * 100) / 100,
    );
    if (amount > balanceRef.current) return;
    const before = balanceRef.current;
    balanceRef.current = before - amount;
    setBalance(balanceRef.current);
    updatePanels((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              amount,
              queued: true,
              payout: 0,
              cashedOut: false,
              cashoutMultiplier: null,
            }
          : item,
      ),
    );
    tone("bet");
    void recordGameEvent({
      id: createRecordId("event-altin-rota", roundRef.current?.roundId),
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      occurredAt: new Date().toISOString(),
      type: automatic ? "auto_bet_queued" : "bet_queued",
      payload: {
        panel: index + 1,
        amount,
        balanceBefore: before,
        balanceAfter: balanceRef.current,
      },
    });
  };

  const cancelBet = (index: number) => {
    const panel = panelsRef.current[index];
    if (!panel?.queued) return;
    const before = balanceRef.current;
    balanceRef.current += panel.amount;
    setBalance(balanceRef.current);
    updatePanels((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, queued: false } : item,
      ),
    );
    void recordGameEvent({
      id: createRecordId("event-altin-rota", roundRef.current?.roundId),
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      occurredAt: new Date().toISOString(),
      type: "bet_cancelled",
      payload: {
        panel: index + 1,
        amount: panel.amount,
        balanceBefore: before,
        balanceAfter: balanceRef.current,
      },
    });
  };

  cashOutRef.current = (index, at, automatic = false) => {
    if (phaseRef.current !== "flying") return;
    const panel = panelsRef.current[index];
    if (!panel?.active || panel.cashedOut) return;
    const crashPoint = roundRef.current?.crashPoint;
    if (!crashPoint || !canCashOut(at, crashPoint)) return;
    const preciseAt = at;
    const activeAmount = panel.activeAmount || panel.amount;
    const payout = Math.round(activeAmount * preciseAt * 100) / 100;
    const before = balanceRef.current;
    balanceRef.current += payout;
    setBalance(balanceRef.current);
    updatePanels((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              active: false,
              cashedOut: true,
              cashoutMultiplier: preciseAt,
              payout,
            }
          : item,
      ),
    );
    setFlash("cashout");
    window.setTimeout(() => setFlash(null), 720);
    tone("cashout");
    void recordWalletEntry({
      id: createRecordId("wallet-altin-rota-payout", roundRef.current?.roundId),
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      occurredAt: new Date().toISOString(),
      type: "payout",
      amount: payout,
      balanceBefore: before,
      balanceAfter: balanceRef.current,
      note: `Altın Rota ${index + 1}. bahis ${preciseAt.toFixed(2)}× ${automatic ? "otomatik" : "manuel"} çıkış`,
    });
    void recordGameEvent({
      id: createRecordId("event-altin-rota-cashout", roundRef.current?.roundId),
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      occurredAt: new Date().toISOString(),
      type: automatic ? "auto_cashout" : "manual_cashout",
      payload: {
        panel: index + 1,
        amount: activeAmount,
        multiplier: preciseAt,
        payout,
      },
    });
  };

  /* Legacy room-owned loop retained in history during the live-service migration.
  useEffect(() => {
    let cancelled = false
    let countdownTimer = 0
    let animationFrame = 0

    const run = async () => {
      while (!cancelled) {
        const currentSettings = settingsRef.current
        const nextNonce = nonceRef.current + 1
        nonceRef.current = nextNonce
        localStorage.setItem('altin-rota-nonce', String(nextNonce))
        const fairRound = await createFairCrashRound({
          targetRtp: currentSettings.game.targetRtp,
          maxMultiplier: currentSettings.tuning.maxMultiplier,
          curveMs: currentSettings.tuning.curveMs,
        }, clientSeedRef.current, nextNonce)
        if (cancelled) return
        roundRef.current = fairRound
        roundBalanceBeforeRef.current = balanceRef.current
        setRound(fairRound)
        phaseRef.current = 'betting'
        setPhase('betting')
        multiplierRef.current = 1
        setMultiplier(1)
        setSalon(makeSalon(currentSettings.tuning.livePlayerCount))
        updatePanels((current) => current.map((panel) => ({
          ...panel,
          active: false,
          inRound: false,
          cashedOut: false,
          cashoutMultiplier: null,
          payout: 0,
          activeAmount: 0,
          queued: panel.queued,
        })))
        const deadline = Date.now() + currentSettings.tuning.bettingWindowMs
        setCountdown(currentSettings.tuning.bettingWindowMs)
        void recordGameEvent({
          id: createRecordId('event-altin-rota-commit', fairRound.roundId),
          roundId: fairRound.roundId,
          game: 'altin-rota',
          occurredAt: fairRound.createdAt,
          type: 'round_committed',
          payload: {
            commitment: fairRound.commitment,
            nonce: fairRound.nonce,
            bettingWindowMs: currentSettings.tuning.bettingWindowMs,
            closesAt: new Date(deadline).toISOString(),
          },
        })
        countdownTimer = window.setInterval(() => setCountdown(Math.max(0, deadline - Date.now())), 80)
        await delay(180)
        if (cancelled) return
        panelsRef.current.forEach((panel, index) => { if (panel.autoBet) reserveRef.current(index, true) })
        await delay(Math.max(0, deadline - Date.now()))
        window.clearInterval(countdownTimer)
        if (cancelled) return

        phaseRef.current = 'flying'
        setPhase('flying')
        const lockedPanels = panelsRef.current.map((panel) => panel.queued
          ? { ...panel, queued: false, active: true, inRound: true }
          : { ...panel, queued: false, active: false, inRound: false })
        updatePanels(() => lockedPanels)
        for (const [index, panel] of lockedPanels.entries()) {
          if (!panel.inRound) continue
          void recordWalletEntry({
            id: createRecordId('wallet-altin-rota-stake', fairRound.roundId),
            roundId: fairRound.roundId,
            game: 'altin-rota',
            occurredAt: new Date().toISOString(),
            type: 'stake',
            amount: -panel.amount,
            balanceAfter: balanceRef.current,
            note: `Altın Rota ${index + 1}. bahis kilitlendi`,
          })
        }
        tone('takeoff')
        startHum()
        const flightStarted = performance.now()
        let lastSalonUpdate = 0
        await new Promise<void>((resolve) => {
          const animate = (now: number) => {
            const live = multiplierAt(now - flightStarted, currentSettings.tuning.curveMs)
            const shown = Math.min(live, fairRound.crashPoint)
            multiplierRef.current = shown
            setMultiplier(shown)
            panelsRef.current.forEach((panel, index) => {
              if (panel.active && panel.autoCashoutEnabled && shown >= panel.autoCashout && panel.autoCashout < fairRound.crashPoint) {
                cashOutRef.current(index, panel.autoCashout, true)
              }
            })
            if (now - lastSalonUpdate > 110) {
              lastSalonUpdate = now
              setSalon((current) => current.map((player) => !player.cashedAt && shown >= player.target && player.target < fairRound.crashPoint
                ? { ...player, cashedAt: player.target }
                : player))
            }
            if (live >= fairRound.crashPoint) { resolve(); return }
            animationFrame = requestAnimationFrame(animate)
          }
          animationFrame = requestAnimationFrame(animate)
        })
        if (cancelled) return
        stopHum()
        tone('crash')
        phaseRef.current = 'crashed'
        setPhase('crashed')
        setFlash('crash')
        window.setTimeout(() => setFlash(null), 850)
        const settledPanels = panelsRef.current.map((panel) => ({ ...panel, active: false }))
        updatePanels(() => settledPanels)
        const participated = settledPanels.flatMap((panel, panelIndex) => panel.inRound ? [{ panel, panelIndex }] : [])
        const stake = participated.reduce((sum, entry) => sum + entry.panel.amount, 0)
        const grossPayout = participated.reduce((sum, entry) => sum + entry.panel.payout, 0)
        const net = Math.round((grossPayout - stake) * 100) / 100
        setLastNet(stake ? net : null)
        setLastSettlement(stake ? { stake, grossPayout, net } : null)
        setHistory((current) => [fairRound.crashPoint, ...current].slice(0, 18))
        const settledAt = new Date().toISOString()
        void recordGameRound({
          id: createRecordId('round-altin-rota', fairRound.roundId),
          roundId: fairRound.roundId,
          game: 'altin-rota',
          variant: 'dual-bet-provably-fair-crash',
          source: stake ? 'player' : 'live-table',
          playerParticipated: stake > 0,
          startedAt: fairRound.createdAt,
          settledAt,
          stake,
          grossPayout,
          net,
          outcome: !stake ? 'watch' : net > 0 ? 'win' : net < 0 ? 'loss' : 'push',
          balanceBefore: roundBalanceBeforeRef.current,
          balanceAfter: balanceRef.current,
          result: {
            telemetryVersion: 2,
            crashPoint: fairRound.crashPoint,
            durationMs: Math.round(performance.now() - flightStarted),
            commitment: fairRound.commitment,
            serverSeed: fairRound.serverSeed,
            clientSeed: fairRound.clientSeed,
            nonce: fairRound.nonce,
            digest: fairRound.digest,
            algorithm: 'SHA-256 / first-52-bit inverse distribution',
          },
          modifiers: {
            targetRtp: currentSettings.game.targetRtp,
            maxMultiplier: currentSettings.tuning.maxMultiplier,
            curveMs: currentSettings.tuning.curveMs,
            bettingWindowMs: currentSettings.tuning.bettingWindowMs,
            resultWindowMs: currentSettings.tuning.resultWindowMs,
            bets: participated.map(({ panel, panelIndex }) => ({
              panel: panelIndex + 1,
              amount: panel.amount,
              autoBet: panel.autoBet,
              autoCashoutEnabled: panel.autoCashoutEnabled,
              autoCashoutTarget: panel.autoCashout,
              cashoutMultiplier: panel.cashoutMultiplier,
              payout: panel.payout,
              net: panel.payout - panel.amount,
            })),
            salon: { players: currentSettings.tuning.livePlayerCount, visibleFeed: true },
          },
        })
        void recordGameEvent({
          id: createRecordId('event-altin-rota-crash', fairRound.roundId),
          roundId: fairRound.roundId,
          game: 'altin-rota',
          occurredAt: settledAt,
          type: 'round_crashed',
          payload: { crashPoint: fairRound.crashPoint, stake, grossPayout, net, commitment: fairRound.commitment },
        })
        await delay(currentSettings.tuning.resultWindowMs)
      }
    }

    void run()
    return () => {
      cancelled = true
      window.clearInterval(countdownTimer)
      cancelAnimationFrame(animationFrame)
      stopHum()
    }
    // The live room owns one continuous round loop while mounted.
  }, [])
  */

  useEffect(() => {
    if (!live.ready || !round) return;
    const previous = previousLiveRef.current;
    const roundChanged = previous.roundId !== live.round.roundId;

    if (roundChanged) {
      roundBalanceBeforeRef.current = balanceRef.current;
      setSalon(makeSalon(tuning.livePlayerCount));
      updatePanels((current) =>
        current.map((panel) => ({
          ...panel,
          active: false,
          inRound: false,
          cashedOut: false,
          cashoutMultiplier: null,
          payout: 0,
          activeAmount: 0,
          // Keep a bet prepared during the previous flight for this new round.
          queued: panel.queued,
        })),
      );
      if (phase === "betting") {
        window.setTimeout(() => {
          panelsRef.current.forEach((panel, index) => {
            if (panel.autoBet) reserveRef.current(index, true);
          });
        }, 0);
      }
    }

    if (phase === "flying" && (previous.phase !== "flying" || roundChanged)) {
      const lockedPanels = panelsRef.current.map((panel) =>
        panel.queued
          ? {
              ...panel,
              activeAmount: panel.amount,
              queued: false,
              active: true,
              inRound: true,
            }
          : {
              ...panel,
              activeAmount: 0,
              queued: false,
              active: false,
              inRound: false,
            },
      );
      updatePanels(() => lockedPanels);
      lockedPanels.forEach((panel, index) => {
        if (!panel.inRound) return;
        void recordWalletEntry({
          id: createRecordId("wallet-altin-rota-stake", live.round.roundId),
          roundId: live.round.roundId,
          game: "altin-rota",
          occurredAt: new Date(live.bettingEndsAt).toISOString(),
          type: "stake",
          amount: -panel.activeAmount,
          balanceAfter: balanceRef.current,
          note: `Altın Rota ${index + 1}. bahis kilitlendi`,
        });
      });
      tone("takeoff");
      startHum();
    }

    if (
      phase === "crashed" &&
      previous.phase !== "crashed" &&
      !settledPlayerRoundsRef.current.has(live.round.roundId)
    ) {
      settledPlayerRoundsRef.current.add(live.round.roundId);
      stopHum();
      tone("crash");
      setFlash("crash");
      window.setTimeout(() => setFlash(null), 850);
      const settledPanels = panelsRef.current.map((panel) => ({
        ...panel,
        active: false,
      }));
      updatePanels(() => settledPanels);
      const participated = settledPanels.flatMap((panel, panelIndex) =>
        panel.inRound ? [{ panel, panelIndex }] : [],
      );
      const stake = participated.reduce(
        (sum, entry) => sum + entry.panel.activeAmount,
        0,
      );
      const grossPayout = participated.reduce(
        (sum, entry) => sum + entry.panel.payout,
        0,
      );
      const net = Math.round((grossPayout - stake) * 100) / 100;
      setLastNet(stake ? net : null);
      setLastSettlement(stake ? { stake, grossPayout, net } : null);
      if (stake) {
        const settledAt = new Date(live.flightEndsAt).toISOString();
        void recordGameRound({
          id: createRecordId("round-altin-rota-player", live.round.roundId),
          roundId: live.round.roundId,
          game: "altin-rota",
          variant: "dual-bet-live-provably-fair-crash",
          source: "player",
          playerParticipated: true,
          startedAt: live.round.createdAt,
          settledAt,
          stake,
          grossPayout,
          net,
          outcome: net > 0 ? "win" : net < 0 ? "loss" : "push",
          balanceBefore: roundBalanceBeforeRef.current,
          balanceAfter: balanceRef.current,
          result: {
            telemetryVersion: 2,
            crashPoint: live.round.crashPoint,
            commitment: live.round.commitment,
            serverSeed: live.round.serverSeed,
            clientSeed: live.round.clientSeed,
            nonce: live.round.nonce,
            digest: live.round.digest,
          },
          modifiers: {
            bets: participated.map(({ panel, panelIndex }) => ({
              panel: panelIndex + 1,
              amount: panel.activeAmount,
              autoBet: panel.autoBet,
              autoCashoutEnabled: panel.autoCashoutEnabled,
              autoCashoutTarget: panel.autoCashoutEnabled
                ? panel.autoCashout
                : null,
              cashoutMultiplier: panel.cashoutMultiplier,
              payout: panel.payout,
              net: panel.payout - panel.activeAmount,
            })),
          },
        });
        void recordGameEvent({
          id: createRecordId(
            "event-altin-rota-player-crash",
            live.round.roundId,
          ),
          roundId: live.round.roundId,
          game: "altin-rota",
          occurredAt: settledAt,
          type: "player_round_settled",
          payload: {
            crashPoint: live.round.crashPoint,
            stake,
            grossPayout,
            net,
          },
        });
      }
    }

    previousLiveRef.current = { roundId: live.round.roundId, phase };
  }, [
    live.ready,
    live.round.roundId,
    live.bettingEndsAt,
    live.flightEndsAt,
    phase,
  ]);

  useEffect(() => {
    if (phase !== "flying") return;
    panelsRef.current.forEach((panel, index) => {
      if (
        panel.active &&
        panel.autoCashoutEnabled &&
        multiplier >= panel.autoCashout &&
        panel.autoCashout < live.round.crashPoint
      )
        cashOutRef.current(index, panel.autoCashout, true);
    });
    setSalon((current) =>
      current.map((player) =>
        !player.cashedAt &&
        multiplier >= player.target &&
        player.target < live.round.crashPoint
          ? { ...player, cashedAt: player.target }
          : player,
      ),
    );
  }, [phase, multiplier, live.round.crashPoint]);

  useEffect(() => () => {
    stopHum();
    const context=audioContextRef.current;
    if(context&&context.state!=="closed")void context.close();
    audioContextRef.current=null;
  }, []);

  const setPanel = (index: number, patch: Partial<BetPanel>) =>
    updatePanels((current) =>
      current.map((panel, panelIndex) =>
        panelIndex === index ? { ...panel, ...patch } : panel,
      ),
    );
  const setAutoBet = (index: number, enabled: boolean) => {
    setPanel(index, { autoBet: enabled });
    if (
      enabled &&
      phaseRef.current === "betting" &&
      !panelsRef.current[index]?.queued
    ) {
      window.setTimeout(() => reserveRef.current(index, true), 0);
    }
  };
  const sendToLale = async () => {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    const sentAt = performance.now();
    setDraft("");
    setThinking(true);
    setChat((current) => [
      ...current.slice(-7),
      { speaker: "Sen", text: prompt },
    ]);
    void recordAIConversation({
      id: createRecordId("ai-altin-rota-user", roundRef.current?.roundId),
      sessionId: chatSessionRef.current,
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      character: "Lale",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: {
        phase,
        multiplier,
        crashPoint: phase === "crashed" ? round?.crashPoint : null,
        balance,
      },
    });
    const answer = await askLale(prompt, {
      phase,
      balance,
      multiplier,
      crashPoint: phase === "crashed" ? round?.crashPoint : undefined,
      lastNet,
      activeBets: panels
        .filter((panel) => panel.active || panel.queued)
        .map((panel) => ({
          amount: panel.active ? panel.activeAmount : panel.amount,
          autoCashout: panel.autoCashoutEnabled ? panel.autoCashout : undefined,
        })),
      recentCrashes: history,
      recentMessages: [
        ...chat
          .slice(-5)
          .map((message) => `${message.speaker}: ${message.text}`),
        `Sen: ${prompt}`,
      ],
    });
    const latencyMs = Math.round(performance.now() - sentAt);
    setChat((current) => [
      ...current.slice(-7),
      { speaker: "Lâle", text: answer },
    ]);
    setThinking(false);
    void recordAIConversation({
      id: createRecordId("ai-altin-rota-lale", roundRef.current?.roundId),
      sessionId: chatSessionRef.current,
      roundId: roundRef.current?.roundId,
      game: "altin-rota",
      character: "Lale",
      speaker: "assistant",
      occurredAt: new Date().toISOString(),
      text: answer,
      context: {
        phase,
        multiplier,
        crashPoint: phase === "crashed" ? round?.crashPoint : null,
        balance,
      },
      model: aiOnline ? "local-ai" : "fallback-persona",
      latencyMs,
    });
  };
  const liveTotal = salon.reduce((sum, player) => sum + player.bet, 0);
  const cashedPlayers =
    phase === "flying"
      ? salon
          .filter((player) => player.cashedAt)
          .sort((a, b) => (b.cashedAt ?? 0) - (a.cashedAt ?? 0))
      : [];
  const chart = buildCrashChart(
    phase === "betting" ? 1 : multiplier,
    tuning.curveMs,
  );
  const graphX = (chart.endpoint.x / chart.width) * 100;
  const graphY = (chart.endpoint.y / chart.height) * 100;
  const visualZoom = Math.max(chart.gridZoomX, chart.gridZoomY);
  const planeScale = 1 + Math.min(7, visualZoom - 1) * 0.012;
  const gridCellWidth = Math.max(0.1, 908 / (5 * chart.gridZoomX));
  const gridCellHeight = Math.max(0.1, 426 / (5 * chart.gridZoomY));

  return (
    <main className={`instant-room ${phase} ${flash ? `flash-${flash}` : ""}`}>
      <header className="instant-topbar">
        <button className="instant-back" onClick={onBackToWorld}>
          ← <span>Anlık Oyunlar</span>
        </button>
        <button className="instant-brand" onClick={onExit}>
          <i>MP</i>
          <span>
            ALTIN ROTA<small>İSTANBUL HAVA HATTI</small>
          </span>
        </button>
        <div className="instant-top-actions">
          <GameMusicControls game="altin-rota" />
          <button
            className={`instant-sfx-toggle ${sfxEnabled ? "on" : ""}`}
            onClick={() => setSfxEnabled((enabled) => !enabled)}
            aria-label={
              sfxEnabled ? "Uçuş efektlerini kapat" : "Uçuş efektlerini aç"
            }
            aria-pressed={sfxEnabled}
          >
            <i>FX</i>
            <span>{sfxEnabled ? "EFEKT AÇIK" : "EFEKT KAPALI"}</span>
          </button>
          <span className="instant-balance">
            ✦ {money.format(balance)} <small>PR</small>
          </span>
        </div>
      </header>

      <section className="instant-history" aria-label="Son tur çarpanları">
        <span>SON ROTALAR</span>
        <div>
          {history.map((value, index) => (
            <b key={`${value}-${index}`} className={multiplierTone(value)}>
              {multiplierFormat.format(value)}×
            </b>
          ))}
        </div>
        <button onClick={() => setFairOpen(true)}>◇ TURU DOĞRULA</button>
      </section>

      <section className="instant-layout">
        <aside className="instant-live-rail">
          <header>
            <div>
              <small>CANLI SALON</small>
              <strong>
                {salon.length +
                  panels.filter((panel) => panel.inRound || panel.queued)
                    .length}{" "}
                oyuncu
              </strong>
            </div>
            <span>{money.format(liveTotal)} PR</span>
          </header>
          <div className="instant-live-head">
            <span>OYUNCU</span>
            <span>BAHİS</span>
            <span>ÇIKIŞ</span>
          </div>
          <div className="instant-live-list">
            {panels
              .filter((panel) => panel.inRound || panel.queued)
              .map((panel, index) => (
                <article className="you" key={`you-${index}`}>
                  <i>MP</i>
                  <b>Sen · {index + 1}</b>
                  <span>
                    {money.format(
                      panel.inRound ? panel.activeAmount : panel.amount,
                    )}
                  </span>
                  <em>
                    {panel.cashedOut
                      ? `${panel.cashoutMultiplier?.toFixed(2)}×`
                      : panel.active
                        ? panel.queued
                          ? "UÇUYOR · SONRAKİ HAZIR"
                          : "UÇUYOR"
                        : "HAZIR"}
                  </em>
                </article>
              ))}
            {salon.slice(0, 16).map((player) => (
              <article
                key={player.id}
                className={phase === "flying" && player.cashedAt ? "paid" : ""}
              >
                <i>{player.name.slice(0, 2).toUpperCase()}</i>
                <b>{player.name}</b>
                <span>{money.format(player.bet)}</span>
                <em>
                  {phase === "flying" && player.cashedAt
                    ? `${player.cashedAt.toFixed(2)}×`
                    : phase === "crashed"
                      ? "—"
                      : "..."}
                </em>
              </article>
            ))}
          </div>
        </aside>

        <section className="instant-flight-card">
          <div
            className="instant-sky"
            style={
              {
                "--plane-x": `${graphX}%`,
                "--plane-y": `${graphY}%`,
                "--plane-scale": planeScale,
                "--flight-zoom": Math.min(7, Math.max(0, visualZoom - 1)),
              } as React.CSSProperties
            }
          >
            <svg
              className="instant-curve"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="altin-rota-flight-grid"
                  x="58"
                  y="454"
                  width={gridCellWidth}
                  height={gridCellHeight}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    className="instant-grid-line"
                    d={`M 0 0 H ${gridCellWidth} M 0 0 V ${gridCellHeight}`}
                  />
                </pattern>
              </defs>
              <rect
                className="instant-chart-grid-pattern"
                x="58"
                y="28"
                width="908"
                height="426"
                fill="url(#altin-rota-flight-grid)"
              />
              {phase !== "betting" && (
                <>
                  <polyline className="curve-glow" points={chart.polyline} />
                  <polyline className="curve-line" points={chart.polyline} />
                  <circle
                    className="curve-endpoint"
                    cx={chart.endpoint.x}
                    cy={chart.endpoint.y}
                    r="5"
                  />
                </>
              )}
            </svg>
            <div className="instant-axis-labels" aria-hidden="true">
              {chart.yTicks.map((tick) => (
                <span
                  className="y-label"
                  key={`yl-${tick.value}`}
                  style={{ top: `${(tick.y / chart.height) * 100}%` }}
                >
                  {tick.value >= 100
                    ? money.format(Math.round(tick.value))
                    : `${tick.value.toFixed(tick.value < 10 ? 1 : 0)}×`}
                </span>
              ))}
              {chart.xTicks.slice(0, -1).map((tick) => (
                <span
                  className="x-label"
                  key={`xl-${tick.value}`}
                  style={{ left: `${(tick.x / chart.width) * 100}%` }}
                >
                  {tick.value.toFixed(tick.value < 10 ? 1 : 0)} sn
                </span>
              ))}
              <b className="y-title">ÇARPAN</b>
              <b className="x-title">UÇUŞ SÜRESİ</b>
            </div>
            <div className="instant-plane">
              <span className="plane-trail" />
              <img
                src="/assets/instant/altin-rota/altin-rota-plane-v1.png"
                alt="Altın Rota uçağı"
              />
            </div>
            <div className={`instant-multiplier ${phase}`}>
              {phase === "betting" ? (
                <>
                  <small>KALKIŞA</small>
                  <strong>{Math.max(0, countdown / 1000).toFixed(1)}</strong>
                  <em>SANİYE</em>
                </>
              ) : (
                <>
                  <small>
                    {phase === "crashed" ? "ROTA KESİLDİ" : "CANLI ÇARPAN"}
                  </small>
                  <strong>
                    {multiplierFormat.format(multiplier)}
                    <i>×</i>
                  </strong>
                  <em>{phase === "flying" ? "ÇIKIŞ AÇIK" : "SONUÇ"}</em>
                </>
              )}
            </div>
            {phase === "crashed" && (
              <div className="instant-crash-mark">
                <i>✦</i>
                <span>ROTA KAPANDI</span>
              </div>
            )}
            {flash === "cashout" && (
              <div className="instant-cashout-flash">KAZANÇ ALINDI</div>
            )}
          </div>
          <footer className={`instant-radio ${phase}`}>
            <i>●</i>
            <p>
              {phaseCopy(phase, countdown, multiplier, round?.crashPoint ?? 1)}
            </p>
            <button onClick={() => setRulesOpen(true)}>NASIL OYNANIR?</button>
          </footer>
        </section>

        <aside className="instant-right-rail">
          <section className="instant-host-card">
            <div className="host-portrait">
              <span>LÂLE</span>
            </div>
            <div>
              <small>ROTA KULESİ · CANLI</small>
              <strong>Lâle seni duyuyor.</strong>
              <p>
                “Çarpan yükselirken karar senin. Ben yalnızca irtifayı ve turu
                net söylerim.”
              </p>
            </div>
          </section>
          <section className="instant-lale-chat">
            <header>
              <span>LÂLE İLE KONUŞ</span>
              <small>{aiOnline ? "YEREL AI" : "KULE MODU"}</small>
            </header>
            <div>
              {chat.slice(-4).map((message, index) => (
                <p
                  key={`${message.speaker}-${index}`}
                  className={message.speaker === "Sen" ? "you" : ""}
                >
                  <b>{message.speaker}</b>
                  {message.text}
                </p>
              ))}
              {thinking && (
                <p>
                  <b>Lâle</b>Kule hattı açık…
                </p>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendToLale();
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Lâle'ye yaz…"
              />
              <button disabled={!draft.trim() || thinking}>↑</button>
            </form>
          </section>
          <section className="instant-highs">
            <header>
              <span>YÜKSEK ÇIKIŞLAR</span>
              <small>BU TUR</small>
            </header>
            {cashedPlayers.slice(0, 4).map((player, index) => (
              <article key={player.id}>
                <i>{index + 1}</i>
                <span>
                  <b>{player.name}</b>
                  <small>{money.format(player.bet)} PR bahis</small>
                </span>
                <strong>
                  {player.cashedAt?.toFixed(2)}×
                  <small>
                    {money.format(player.bet * (player.cashedAt ?? 0))} PR
                  </small>
                </strong>
              </article>
            ))}
            {!cashedPlayers.length && (
              <p>Uçuş başladığında çıkışlar burada canlı sıralanır.</p>
            )}
          </section>
          <section className="instant-fair-mini">
            <span>ÖNCEDEN KİLİTLİ TUR</span>
            <code>{round?.commitment.slice(0, 12) ?? "hazırlanıyor"}…</code>
            <button onClick={() => setFairOpen(true)}>Ayrıntı</button>
          </section>
        </aside>
      </section>

      <section className="instant-bet-dock">
        <nav className="instant-mobile-bet-tabs" aria-label="Bahis panelleri">
          {panels.map((panel, index) => (
            <button
              className={`${mobilePanel === index ? "selected" : ""} ${panel.active ? "active" : ""} ${panel.queued ? "queued" : ""} ${panel.cashedOut ? "cashed" : ""}`}
              key={`mobile-bet-tab-${index}`}
              onClick={() => setMobilePanel(index)}
              aria-pressed={mobilePanel === index}
            >
              <span>BAHİS {index + 1}</span>
              <b>
                {panel.active
                  ? `${money.format(panel.activeAmount * multiplier)} PR`
                  : panel.queued
                    ? "SIRADA"
                    : panel.cashedOut
                      ? `${panel.cashoutMultiplier?.toFixed(2)}×`
                      : `${money.format(panel.amount)} PR`}
              </b>
            </button>
          ))}
        </nav>
        {panels.map((panel, index) => {
          const liveReturn = panel.active
            ? panel.activeAmount * multiplier
            : panel.payout;
          return (
            <article
              className={`instant-bet-panel ${mobilePanel === index ? "mobile-selected" : ""} ${panel.active ? "active" : ""} ${panel.queued ? "queued" : ""} ${panel.cashedOut ? "cashed" : ""}`}
              key={index}
            >
              <header>
                <span>BAHİS {index + 1}</span>
                <em>
                  {panel.cashedOut
                    ? `${panel.cashoutMultiplier?.toFixed(2)}× ALINDI`
                    : panel.active
                      ? panel.queued
                        ? "UÇUŞTA · SONRAKİ HAZIR"
                        : "UÇUŞTA"
                      : panel.queued
                        ? "SIRADA"
                        : "HAZIR"}
                </em>
              </header>
              <div className="instant-bet-main">
                <div className="instant-amount">
                  <button
                    disabled={panel.queued}
                    onClick={() =>
                      setPanel(index, {
                        amount: adjustBetAmount(
                          panel.amount,
                          -1,
                          game.minBet,
                          Math.max(game.minBet, balanceRef.current),
                        ),
                      })
                    }
                  >
                    −
                  </button>
                  <label>
                    <small>BAHİS</small>
                    <input
                      aria-label={`${index + 1}. bahis miktarı`}
                      type="number"
                      min={game.minBet}
                      step={adaptiveBetStep(panel.amount)}
                      value={panel.amount}
                      disabled={panel.queued}
                      onChange={(event) =>
                        setPanel(index, {
                          amount: Math.max(
                            game.minBet,
                            Number(event.target.value),
                          ),
                        })
                      }
                    />
                    <em>PR</em>
                  </label>
                  <button
                    disabled={panel.queued}
                    onClick={() =>
                      setPanel(index, {
                        amount: adjustBetAmount(
                          panel.amount,
                          1,
                          game.minBet,
                          Math.max(game.minBet, balanceRef.current),
                        ),
                      })
                    }
                  >
                    +
                  </button>
                </div>
                <div className="instant-quick-bets">
                  {quickBets
                    .filter((value) => value <= Math.max(balance, 1_000))
                    .slice(-7)
                    .map((value) => (
                      <button
                        key={value}
                        disabled={panel.queued}
                        onClick={() => setPanel(index, { amount: value })}
                      >
                        {compactWager(value)}
                      </button>
                    ))}
                  <button
                    disabled={panel.queued}
                    onClick={() =>
                      setPanel(index, {
                        amount: Math.max(game.minBet, balanceRef.current),
                      })
                    }
                  >
                    MAX
                  </button>
                </div>
                <div className="instant-auto-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={panel.autoBet}
                      onChange={(event) =>
                        setAutoBet(index, event.target.checked)
                      }
                    />{" "}
                    OTO BAHİS
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={panel.autoCashoutEnabled}
                      onChange={(event) =>
                        setPanel(index, {
                          autoCashoutEnabled: event.target.checked,
                        })
                      }
                    />{" "}
                    OTO ÇIKIŞ
                  </label>
                  <label className="auto-x">
                    <input
                      aria-label={`${index + 1}. bahis otomatik çıkış çarpanı`}
                      type="number"
                      min="1.01"
                      step="0.05"
                      value={panel.autoCashout}
                      disabled={!panel.autoCashoutEnabled}
                      onChange={(event) =>
                        setPanel(index, {
                          autoCashout: Math.max(
                            1.01,
                            Number(event.target.value),
                          ),
                        })
                      }
                    />
                    <span>×</span>
                  </label>
                </div>
                {phase !== "betting" &&
                  (panel.active || (panel.cashedOut && !panel.queued)) && (
                    <button
                      type="button"
                      className={`instant-next-bet ${panel.queued ? "queued" : ""}`}
                      disabled={!panel.queued && panel.amount > balance}
                      onClick={() =>
                        panel.queued
                          ? cancelBet(index)
                          : reserveRef.current(index)
                      }
                    >
                      {panel.queued
                        ? `SONRAKİ TUR HAZIR · ${money.format(panel.amount)} PR · İPTAL`
                        : `SONRAKİ TURA ${money.format(panel.amount)} PR HAZIRLA`}
                    </button>
                  )}
              </div>
              {panel.active ? (
                <button
                  className="instant-primary cash"
                  onClick={() =>
                    cashOutRef.current(index, multiplierRef.current)
                  }
                >
                  <small>KAZANCI AL</small>
                  <strong>{money.format(liveReturn)} PR</strong>
                </button>
              ) : panel.queued ? (
                <button
                  className="instant-primary cancel"
                  onClick={() => cancelBet(index)}
                >
                  <small>BAHİS HAZIR</small>
                  <strong>İPTAL ET</strong>
                </button>
              ) : panel.cashedOut && phase !== "betting" ? (
                <button className="instant-primary paid" disabled>
                  <small>KASA</small>
                  <strong>+{money.format(panel.payout)} PR</strong>
                </button>
              ) : (
                <button
                  className="instant-primary"
                  disabled={panel.amount > balance}
                  onClick={() => reserveRef.current(index)}
                >
                  <small>SONRAKİ TUR</small>
                  <strong>{money.format(panel.amount)} PR OYNA</strong>
                </button>
              )}
            </article>
          );
        })}
        <div className="instant-round-net">
          <small>SON TUR · TOPLAM ÖDEME</small>
          <strong
            className={
              (lastSettlement?.grossPayout ?? 0) > 0 ? "positive" : "negative"
            }
          >
            {lastSettlement === null
              ? "—"
              : `${money.format(lastSettlement.grossPayout)} PR`}
          </strong>
          <span>
            {lastSettlement
              ? `${money.format(lastSettlement.stake)} PR bahis · net ${lastSettlement.net > 0 ? "+" : lastSettlement.net < 0 ? "−" : ""}${money.format(Math.abs(lastSettlement.net))} PR`
              : "Bahis ve ödeme SQLite'a ayrıntılı kaydedilir."}
          </span>
        </div>
      </section>

      {rulesOpen && (
        <div
          className="instant-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="instant-modal">
            <button className="modal-close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>ALTIN ROTA · 60 SANİYEDE</small>
            <h2>Uçak düşmeden kazancı al.</h2>
            <ol>
              <li>Bahis açıkken bir veya iki panele ayrı miktar gir.</li>
              <li>
                Uçuş başladığında çarpan yükselir. “Kazancı al” dediğinde bahis
                × o anki çarpan bakiyene eklenir.
              </li>
              <li>
                Rota önce kesilirse o panelin bahsi kaybolur. Oto çıkış,
                seçtiğin çarpanda senin yerine karar verir.
              </li>
              <li>
                Oto bahis yalnızca bakiyen yeterliyse sonraki tura katılır;
                bahis açıkken her zaman iptal edebilirsin.
              </li>
            </ol>
            <p>
              Hedef RTP %{money.format(game.targetRtp)}. Sanal PR ile yalnızca
              eğlence amaçlıdır.
            </p>
          </section>
        </div>
      )}
      {fairOpen && (
        <div
          className="instant-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFairOpen(false);
          }}
        >
          <section className="instant-modal fair">
            <button className="modal-close" onClick={() => setFairOpen(false)}>
              ×
            </button>
            <small>SHA-256 · TUR DOĞRULAMA</small>
            <h2>Sonuç, bahis kapanmadan kilitlenir.</h2>
            <dl>
              <div>
                <dt>Tur</dt>
                <dd>{round?.roundId ?? "hazırlanıyor"}</dd>
              </div>
              <div>
                <dt>Taahhüt</dt>
                <dd>{round?.commitment ?? "—"}</dd>
              </div>
              <div>
                <dt>Client seed</dt>
                <dd>{round?.clientSeed ?? "—"}</dd>
              </div>
              <div>
                <dt>Nonce</dt>
                <dd>{round?.nonce ?? "—"}</dd>
              </div>
              <div>
                <dt>Sunucu seed</dt>
                <dd>
                  {phase === "crashed"
                    ? round?.serverSeed
                    : "Tur bitince açıklanacak"}
                </dd>
              </div>
              <div>
                <dt>Digest</dt>
                <dd>
                  {phase === "crashed"
                    ? round?.digest
                    : "Tur bitince açıklanacak"}
                </dd>
              </div>
            </dl>
            <p>
              Taahhüt, sunucu seed’inin SHA-256 özetidir. Tur bitince açıklanan
              seed + client seed + nonce aynı sonucu yeniden üretir.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
