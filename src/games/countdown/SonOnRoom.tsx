import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import GameMusicControls from "../../audio/GameMusicControls";
import { playGameSfx } from "../../audio/game-sfx";
import { useAuth } from "../../auth/auth-client";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { gameSfxLevel } from "../../audio/user-sfx-preferences";
import {
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import {
  createRecordId,
  getCasinoRounds,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
  type CasinoRoundRecord,
} from "../../data/casino-database";
import {
  COUNTDOWN_PROFILE,
  cashOutCountdown,
  chooseCountdownCell,
  countdownMultiplier,
  countdownSafeChance,
  createFairCountdownRound,
  roundMoney,
  verifyCountdownRound,
  type CountdownRisk,
  type FairCountdownRound,
} from "./son-on-engine";
import "./son-on.css";
import {
  CASINO_CHIP_VALUES,
  compactWager,
  normalizeWagerInput,
} from "../wagering";
import { waitForPresentation } from "../slots/cascade-presentation";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  onBackToWorld: () => void;
  aiOnline: boolean;
};
type NihalMessage = { speaker: "Nihal" | "Sen"; text: string; at: string };
type TimeoutPolicy = "bank" | "random";
type CountdownCue = {
  key: number;
  kind: "start" | "safe" | "alarm" | "cash";
  title: string;
  detail: string;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const QUICK_BETS = CASINO_CHIP_VALUES;
const ACTIVE_KEY = "son-on-active-v1";
const NONCE_KEY = "son-on-nonce-v1";
const CLIENT_SEED_KEY = "son-on-client-seed-v1";

const accountKey = (userId: string, key: string) => `account:${userId}:${key}`;

function loadRound(userId: string) {
  try {
    const value = JSON.parse(
      localStorage.getItem(accountKey(userId, ACTIVE_KEY)) ?? "null",
    ) as FairCountdownRound | null;
    return value?.phase === "active" ? value : null;
  } catch {
    return null;
  }
}

function randomSeed() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `muharrem-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function nextNihalLine(
  event: "start" | "safe" | "alarm" | "cashout" | "complete" | "timeout",
  round: FairCountdownRound,
) {
  const remaining = Math.max(0, round.stages - round.safeSteps);
  const lines = {
    start: [
      `Saat kuruldu. ${COUNTDOWN_PROFILE[round.risk].label} hatta ${round.choices} göz var; ${round.alarmsPerStage} tanesi alarm.`,
      "On’dan geriye gidiyoruz. İlk kapağın sesi insanı ya zengin eder ya da susturur.",
    ],
    safe: [
      `Temiz. ${remaining} adım kaldı; masadaki para şimdi ${round.currentMultiplier.toFixed(2)} kat.`,
      `${round.safeSteps}. kilit açıldı. Buradan sonrası cesaret değil, karar meselesi.`,
      `Doğru gözü buldun. Saat hızlanıyor; ben olsam rakama değil nabzıma bakardım.`,
    ],
    alarm: [
      "Alarmı uyandırdın. Bu kasa bağırmadan önce hiç uyarmaz.",
      "Yanlış kapak. Saat durdu, tur da onunla birlikte kapandı.",
    ],
    cashout: [
      `Tam vaktinde aldın. ${round.currentMultiplier.toFixed(2)} kat doğrudan kasana gidiyor.`,
      "Kapıyı daha fazla zorlamadın. Bazen en pahalı hareket, zamanında geri çekilmektir.",
    ],
    complete: [
      `Birden sıfıra. Saat kasasını sonuna kadar açtın: ${round.currentMultiplier.toFixed(2)} kat.`,
      "On kapının onunu da geçtin. Galata’da bu saati bu gece senden iyi okuyan yok.",
    ],
    timeout: [
      "Süre bitti. Saat kararsızlığı hiç sevmez.",
      "Geç kaldın; kasa senin yerine karar verdi.",
    ],
  }[event];
  return lines[(round.safeSteps + round.nonce) % lines.length];
}

function chatReply(input: string, round: FairCountdownRound | null) {
  const lower = input.toLocaleLowerCase("tr-TR");
  if (/nasıl|kural|ne yap/.test(lower))
    return "Bir göz seç, alarm değilse çarpanın büyür. Sonra ya parayı alırsın ya da sıradaki sayıya geçersin. Güvenli göz oranı masada açık; numara yok.";
  if (/kork|geril|heyecan/.test(lower))
    return "Korku sorun değil. Sorun, korkunca kararını kasaya bırakman. Hedefini tur başlamadan koy; saat çalışırken pazarlık etme.";
  if (/şans|hile|adil/.test(lower))
    return "Alarm yerleri tur başında SHA-256 ile mühürleniyor. Turu kapatınca seed açılır; doğrula düğmesiyle benim sözüme ihtiyaç duymadan kontrol edersin.";
  if (/para|kazan|al/.test(lower))
    return round?.safeSteps
      ? `Şu an ${round.currentMultiplier.toFixed(2)} kat masada. ${round.safeSteps} kapı gördün; daha fazlasını istemek mümkün, geri vermek de.`
      : "Önce bahsi ve risk hattını seç. Sonra saatin ne söylediğine beraber bakarız.";
  if (/küfür|sik|amına|bok/.test(lower))
    return "Saatin suçu yok Muharrem; kapağı sen seçiyorsun. Küfre enerjin varsa bir sonraki gözü daha hızlı seçersin.";
  return round?.phase === "active"
    ? `Şu an sohbetten pahalı bir şey var: ${Math.max(0, round.stages - round.safeSteps)} karar. Ben buradayım ama saat beklemiyor.`
    : "Hazırım. Riskini seç, hedefini koy; sonra konuşmayı kasa kapağının sesine bırakırız.";
}

export default function SonOnRoom({
  balance,
  setBalance,
  onExit,
  onBackToWorld,
  aiOnline,
}: Props) {
  const { user } = useAuth();
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const game = admin.games["son-on"];
  const tuning = game.countdown!;
  const [risk, setRisk] = useState<CountdownRisk>("temkinli");
  const [bet, setBet] = useState(game.defaultBet);
  const [round, setRound] = useState<FairCountdownRound | null>(() =>
    loadRound(user.id),
  );
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [lastAlarm, setLastAlarm] = useState<number | null>(null);
  const [lastSafe, setLastSafe] = useState<number | null>(null);
  const [cue, setCue] = useState<CountdownCue | null>(null);
  const [chipFlying, setChipFlying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(tuning.choiceWindowMs);
  const [turbo, setTurbo] = useState(false);
  const [autoBankStep, setAutoBankStep] = useState(0);
  const [timeoutPolicy, setTimeoutPolicy] = useState<TimeoutPolicy>("bank");
  const [sfxEnabled, setSfxEnabled] = useGameAudioPreference(
    "son-on",
    "effects",
    true,
  );
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "son-on",
    "ai-voice",
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fairOpen, setFairOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<
    "idle" | "checking" | "ok" | "fail"
  >("idle");
  const [recent, setRecent] = useState<CasinoRoundRecord[]>([]);
  const [chat, setChat] = useState<NihalMessage[]>([
    {
      speaker: "Nihal",
      text: "Galata saati kuruldu. Riskini seç; gerisini rakamlar değil, verdiğin karar anlatır.",
      at: new Date().toISOString(),
    },
  ]);
  const [draft, setDraft] = useState("");
  const roundRef = useRef(round);
  const balanceRef = useRef(balance);
  const deadlineRef = useRef(0);
  const timeoutLockRef = useRef(false);
  const skipPresentationRef = useRef(false);
  const pulseRef = useRef<HTMLAudioElement | null>(null);
  const chatSessionRef = useRef(
    `ai-son-on-${Date.now()}-${crypto.randomUUID()}`,
  );
  roundRef.current = round;
  balanceRef.current = balance;

  const active = round?.phase === "active";
  // Bitmiş turun profili yeni tur önizlemesini kilitlememeli. Tur aktifken
  // mühürlenen profil kullanılır; masa boşken seçim doğrudan önizlemeye yansır.
  const currentRisk = active && round ? round.risk : risk;
  const profile = COUNTDOWN_PROFILE[currentRisk];
  const safeChance = countdownSafeChance(currentRisk);
  const nextStep = (round?.safeSteps ?? 0) + 1;
  const nextMultiplier = countdownMultiplier(
    currentRisk,
    nextStep,
    round?.rtp ?? game.targetRtp,
    tuning.maxPayoutX,
  );
  const countdownNumber = Math.max(
    0,
    (round?.stages ?? tuning.stages) - (round?.safeSteps ?? 0),
  );
  const decisionWindow = useCallback(
    (safeSteps: number) => {
      const progress = Math.min(1, safeSteps / Math.max(1, tuning.stages - 1));
      return Math.round(
        tuning.choiceWindowMs +
          (tuning.finalChoiceWindowMs - tuning.choiceWindowMs) * progress,
      );
    },
    [tuning.choiceWindowMs, tuning.finalChoiceWindowMs, tuning.stages],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(() => {
    if (round?.phase === "active")
      localStorage.setItem(
        accountKey(user.id, ACTIVE_KEY),
        JSON.stringify(round),
      );
    else localStorage.removeItem(accountKey(user.id, ACTIVE_KEY));
  }, [round, user.id]);
  useEffect(() => {
    void getCasinoRounds().then((items) =>
      setRecent(items.filter((item) => item.game === "son-on").slice(0, 8)),
    );
  }, []);

  useEffect(() => {
    const audio = new Audio("/assets/instant/son-on/audio/pulse.mp3");
    audio.loop = true;
    audio.preload = "auto";
    pulseRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      pulseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = pulseRef.current;
    if (!audio) return;
    const shouldPlay = Boolean(
      active && sfxEnabled && game.sound && admin.general.masterSound,
    );
    if (!shouldPlay) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    audio.volume = gameSfxLevel("son-on",Math.min(0.38, 0.12 + (round?.safeSteps ?? 0) * 0.025));
    audio.playbackRate = Math.min(1.22, 1 + (round?.safeSteps ?? 0) * 0.025);
    void audio.play().catch(() => undefined);
  }, [
    active,
    admin.general.masterSound,
    game.sound,
    round?.safeSteps,
    sfxEnabled,
  ]);

  const playAsset = useCallback(
    (name: "hover" | "victory", volume = 0.55) => {
      if (!sfxEnabled || !game.sound || !admin.general.masterSound) return;
      playGameSfx("son-on",`/assets/instant/son-on/audio/${name}.mp3`,volume);
    },
    [admin.general.masterSound, game.sound, sfxEnabled],
  );

  const playTone = useCallback(
    (kind: "tick" | "safe" | "alarm" | "cash") => {
      if (!sfxEnabled || !game.sound || !admin.general.masterSound) return;
      const Context =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Context) return;
      const context = new Context();
      const gain = context.createGain();
      gain.connect(context.destination);
      gain.gain.setValueAtTime(
        gameSfxLevel("son-on",kind === "alarm" ? 0.18 : 0.1),
        context.currentTime,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + (kind === "alarm" ? 0.75 : 0.32),
      );
      const frequencies =
        kind === "safe"
          ? [392, 587]
          : kind === "alarm"
            ? [146, 92]
            : kind === "cash"
              ? [440, 660, 880]
              : [1180];
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type =
          kind === "alarm" ? "sawtooth" : kind === "tick" ? "square" : "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        oscillator.start(context.currentTime + index * 0.08);
        oscillator.stop(context.currentTime + (kind === "alarm" ? 0.72 : 0.28));
      });
      window.setTimeout(() => void context.close(), 1000);
    },
    [admin.general.masterSound, game.sound, sfxEnabled],
  );

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.rate = 0.98;
      utterance.pitch = 0.94;
      utterance.volume = 0.86;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice =
        voices.find(
          (voice) =>
            /^tr[-_]/i.test(voice.lang) &&
            /female|emel|selin|filiz|aylin/i.test(voice.name),
        ) ??
        voices.find((voice) => /^tr[-_]/i.test(voice.lang)) ??
        null;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled],
  );

  const addNihal = useCallback(
    (
      text: string,
      state: FairCountdownRound | null,
      speaker: "assistant" | "system-event" = "system-event",
    ) => {
      const at = new Date().toISOString();
      setChat((items) => [...items.slice(-12), { speaker: "Nihal", text, at }]);
      speak(text);
      void recordAIConversation({
        id: createRecordId("ai-son-on-nihal", state?.roundId),
        sessionId: chatSessionRef.current,
        roundId: state?.roundId,
        game: "son-on",
        character: "Nihal",
        speaker,
        occurredAt: at,
        text,
        context: state
          ? {
              phase: state.phase,
              risk: state.risk,
              safeSteps: state.safeSteps,
              multiplier: state.currentMultiplier,
              countdown: state.stages - state.safeSteps,
            }
          : {},
        model:
          speaker === "assistant" && aiOnline
            ? "local:nihal"
            : "fallback:nihal-v1",
      });
    },
    [aiOnline, speak],
  );

  const settle = useCallback(
    async (state: FairCountdownRound, cause: string) => {
      const settledAt = state.settledAt ?? new Date().toISOString();
      const payout = state.phase === "lost" ? 0 : state.grossPayout;
      const before = balanceRef.current;
      if (payout > 0) {
        setBalance((value) => value + payout);
        balanceRef.current += payout;
        await recordWalletEntry({
          id: createRecordId("wallet-son-on-payout", state.roundId),
          roundId: state.roundId,
          game: "son-on",
          occurredAt: settledAt,
          type: "payout",
          amount: payout,
          balanceBefore: before,
          balanceAfter: before + payout,
          note: `Son On ${state.safeSteps} kapı · ${state.currentMultiplier.toFixed(4)}× brüt ödeme`,
        });
      }
      const record: CasinoRoundRecord = {
        id: createRecordId("round-son-on", state.roundId),
        roundId: state.roundId,
        game: "son-on",
        variant: `${COUNTDOWN_PROFILE[state.risk].label} · ${state.stages}→0`,
        source: "player",
        playerParticipated: true,
        startedAt: state.startedAt,
        settledAt,
        stake: state.stake,
        grossPayout: payout,
        net: roundMoney(payout - state.stake),
        outcome:
          payout > state.stake
            ? "win"
            : payout === state.stake
              ? "push"
              : "loss",
        balanceBefore: before + state.stake,
        balanceAfter: before + payout,
        result: {
          telemetryVersion: 1,
          phase: state.phase,
          cause,
          safeSteps: state.safeSteps,
          countdownEndedAt: state.stages - state.safeSteps,
          selections: state.selections,
          hazardIndices: state.hazardIndices,
          choices: state.choices,
          alarmsPerStage: state.alarmsPerStage,
          currentMultiplier: state.currentMultiplier,
          grossPayout: payout,
          algorithm: state.algorithm,
          clientSeed: state.clientSeed,
          nonce: state.nonce,
          serverSeed: state.serverSeed,
          commitment: state.commitment,
          digest: state.digest,
        },
        modifiers: {
          targetRtp: state.rtp,
          risk: state.risk,
          autoBankStep,
          timeoutPolicy,
          turbo,
          sound: sfxEnabled,
          aiVoice: voiceEnabled,
          algorithmVersion: state.algorithm,
        },
      };
      await recordGameRound(record);
      await recordGameEvent({
        id: createRecordId("event-son-on-settle", state.roundId),
        roundId: state.roundId,
        game: "son-on",
        occurredAt: settledAt,
        type: "countdown-round-settled",
        payload: {
          cause,
          phase: state.phase,
          safeSteps: state.safeSteps,
          multiplier: state.currentMultiplier,
          payout,
          net: payout - state.stake,
          selections: state.selections,
        },
      });
      setRecent((items) => [record, ...items].slice(0, 8));
      setResultOpen(true);
      localStorage.removeItem(accountKey(user.id, ACTIVE_KEY));
    },
    [autoBankStep, setBalance, sfxEnabled, timeoutPolicy, turbo, voiceEnabled],
  );

  const cashOut = useCallback(
    async (cause = "manual-bank") => {
      const source = roundRef.current;
      if (!source || source.phase !== "active" || source.safeSteps < 1 || busy)
        return;
      setBusy(true);
      timeoutLockRef.current = true;
      const next = cashOutCountdown(source);
      setRound(next);
      roundRef.current = next;
      playTone("cash");
      playAsset("victory", 0.62);
      addNihal(nextNihalLine("cashout", next), next);
      setCue({
        key: Date.now(),
        kind: "cash",
        title: "KASA ALINDI",
        detail: `${money.format(next.grossPayout)} PR · ${next.currentMultiplier.toFixed(2)}×`,
      });
      await waitForPresentation(
        turbo ? 420 : 900,
        () => skipPresentationRef.current,
      );
      setCue(null);
      await settle(next, cause);
      setBusy(false);
    },
    [addNihal, busy, playAsset, playTone, settle, turbo],
  );

  const chooseCell = useCallback(
    async (
      cell: number,
      sourceOverride?: FairCountdownRound,
      cause = "manual-choice",
    ) => {
      const source = sourceOverride ?? roundRef.current;
      if (!source || source.phase !== "active" || busy) return;
      skipPresentationRef.current = false;
      setBusy(true);
      timeoutLockRef.current = true;
      setOpening(cell);
      setLastAlarm(null);
      setLastSafe(null);
      setCue(null);
      playTone("tick");
      playAsset("hover", 0.42);
      const chanceBefore = countdownSafeChance(source.risk);
      await waitForPresentation(
        turbo ? Math.max(420, tuning.turboRevealMs) : tuning.normalRevealMs,
        () => skipPresentationRef.current,
      );
      const resolved = chooseCountdownCell(source, cell);
      const next = resolved.round;
      setRound(next);
      roundRef.current = next;
      setOpening(null);
      await recordGameEvent({
        id: createRecordId("event-son-on-choice", source.roundId),
        roundId: source.roundId,
        game: "son-on",
        occurredAt: new Date().toISOString(),
        type: "countdown-cell-selected",
        payload: {
          cause,
          stageIndex: source.safeSteps,
          countdownNumber: source.stages - source.safeSteps,
          cell,
          result: resolved.result,
          safeChanceBefore: chanceBefore,
          multiplierBefore: source.currentMultiplier,
          multiplierAfter: next.currentMultiplier,
          decisionTimeRemainingMs: timeLeft,
        },
      });
      if (resolved.result === "alarm") {
        setLastAlarm(cell);
        setCue({
          key: Date.now(),
          kind: "alarm",
          title: "ALARM UYANDI",
          detail: "Saat kilitlendi · bahis kasada kaldı",
        });
        playTone("alarm");
        addNihal(
          nextNihalLine(cause === "timeout-random" ? "timeout" : "alarm", next),
          next,
        );
        await waitForPresentation(
          turbo ? 420 : 1150,
          () => skipPresentationRef.current,
        );
        setCue(null);
        await settle(next, cause);
      } else if (resolved.result === "complete") {
        setLastSafe(cell);
        setCue({
          key: Date.now(),
          kind: "cash",
          title: "SON ON AÇILDI",
          detail: `${money.format(next.grossPayout)} PR · ${next.currentMultiplier.toFixed(2)}×`,
        });
        playTone("cash");
        playAsset("victory", 0.7);
        addNihal(nextNihalLine("complete", next), next);
        await waitForPresentation(
          turbo ? 480 : 1250,
          () => skipPresentationRef.current,
        );
        setCue(null);
        await settle(next, "countdown-complete");
      } else {
        setLastSafe(cell);
        setCue({
          key: Date.now(),
          kind: "safe",
          title: "MÜHÜR AÇILDI",
          detail: `${source.currentMultiplier.toFixed(2)}×  →  ${next.currentMultiplier.toFixed(2)}×`,
        });
        playTone("safe");
        addNihal(nextNihalLine("safe", next), next);
        await waitForPresentation(
          turbo ? 340 : 720,
          () => skipPresentationRef.current,
        );
        setCue(null);
        setLastSafe(null);
        const windowMs = decisionWindow(next.safeSteps);
        deadlineRef.current = performance.now() + windowMs;
        setTimeLeft(windowMs);
        timeoutLockRef.current = false;
        setBusy(false);
        if (autoBankStep > 0 && next.safeSteps >= autoBankStep)
          await cashOut("auto-bank-target");
        return;
      }
      setBusy(false);
    },
    [
      addNihal,
      autoBankStep,
      busy,
      cashOut,
      decisionWindow,
      playAsset,
      playTone,
      settle,
      timeLeft,
      tuning.normalRevealMs,
      tuning.turboRevealMs,
      turbo,
    ],
  );

  useEffect(() => {
    if (!active || busy) return;
    if (!deadlineRef.current)
      deadlineRef.current = performance.now() + decisionWindow(round.safeSteps);
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - performance.now());
      setTimeLeft(remaining);
      if (remaining > 0 || timeoutLockRef.current) return;
      timeoutLockRef.current = true;
      const source = roundRef.current;
      if (!source) return;
      if (timeoutPolicy === "bank" && source.safeSteps > 0)
        void cashOut("timeout-auto-bank");
      else {
        const bytes = new Uint32Array(1);
        crypto.getRandomValues(bytes);
        void chooseCell(bytes[0] % source.choices, source, "timeout-random");
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [
    active,
    busy,
    cashOut,
    chooseCell,
    decisionWindow,
    round?.safeSteps,
    timeoutPolicy,
  ]);

  const startRound = async () => {
    if (active || busy) return;
    skipPresentationRef.current = false;
    const stake = roundMoney(Math.max(game.minBet, bet));
    if (stake > balanceRef.current)
      return addNihal(
        "Bu bahis bakiyeyi geçiyor. Saat borç yazmaz; tutarı küçült.",
        roundRef.current,
      );
    setBusy(true);
    setResultOpen(false);
    setVerifyState("idle");
    setLastAlarm(null);
    setLastSafe(null);
    const clientSeedKey = accountKey(user.id, CLIENT_SEED_KEY),
      nonceKey = accountKey(user.id, NONCE_KEY);
    const clientSeed = localStorage.getItem(clientSeedKey) ?? randomSeed();
    localStorage.setItem(clientSeedKey, clientSeed);
    const nonce = Number(localStorage.getItem(nonceKey) ?? "0") + 1;
    localStorage.setItem(nonceKey, String(nonce));
    const created = await createFairCountdownRound({
      stake,
      rtp: game.targetRtp,
      risk,
      stages: tuning.stages,
      maxPayoutX: tuning.maxPayoutX,
      clientSeed,
      nonce,
    });
    const before = balanceRef.current;
    setBalance((value) => value - stake);
    balanceRef.current -= stake;
    setChipFlying(true);
    setCue({
      key: Date.now(),
      kind: "start",
      title: "BAHİS KASAYA GİDİYOR",
      detail: `${money.format(stake)} PR · ${COUNTDOWN_PROFILE[risk].label}`,
    });
    playAsset("hover", 0.55);
    await waitForPresentation(
      turbo ? 360 : 520,
      () => skipPresentationRef.current,
    );
    setRound(created);
    roundRef.current = created;
    deadlineRef.current = performance.now() + decisionWindow(0);
    setTimeLeft(decisionWindow(0));
    timeoutLockRef.current = false;
    await recordWalletEntry({
      id: createRecordId("wallet-son-on-stake", created.roundId),
      roundId: created.roundId,
      game: "son-on",
      occurredAt: created.startedAt,
      type: "stake",
      amount: -stake,
      balanceBefore: before,
      balanceAfter: before - stake,
      note: `Son On ${COUNTDOWN_PROFILE[risk].label} bahis`,
    });
    await recordGameEvent({
      id: createRecordId("event-son-on-commit", created.roundId),
      roundId: created.roundId,
      game: "son-on",
      occurredAt: created.startedAt,
      type: "countdown-round-committed",
      payload: {
        risk,
        stake,
        rtp: created.rtp,
        choices: created.choices,
        alarmsPerStage: created.alarmsPerStage,
        stages: created.stages,
        commitment: created.commitment,
        clientSeed,
        nonce,
        algorithm: created.algorithm,
      },
    });
    setChipFlying(false);
    setCue(null);
    addNihal(nextNihalLine("start", created), created);
    setBusy(false);
  };

  const sendChat = () => {
    const input = draft.trim();
    if (!input) return;
    const at = new Date().toISOString();
    setDraft("");
    setChat((items) => [
      ...items.slice(-12),
      { speaker: "Sen", text: input, at },
    ]);
    void recordAIConversation({
      id: createRecordId("ai-son-on-user", round?.roundId),
      sessionId: chatSessionRef.current,
      roundId: round?.roundId,
      game: "son-on",
      character: "Nihal",
      speaker: "user",
      occurredAt: at,
      text: input,
      context: {
        phase: round?.phase ?? "idle",
        safeSteps: round?.safeSteps ?? 0,
      },
    });
    window.setTimeout(
      () =>
        addNihal(
          chatReply(input, roundRef.current),
          roundRef.current,
          "assistant",
        ),
      420,
    );
  };

  const dismissResult = () => {
    setResultOpen(false);
    setRound(null);
    roundRef.current = null;
    setLastAlarm(null);
    setLastSafe(null);
    setCue(null);
  };

  const stopPresentation = () => {
    skipPresentationRef.current = true;
  };

  const timePercent = active
    ? Math.max(
        0,
        Math.min(100, (timeLeft / decisionWindow(round.safeSteps)) * 100),
      )
    : 100;
  const potential =
    active && round?.safeSteps ? round.grossPayout : bet * nextMultiplier;
  const stageMarks = useMemo(
    () =>
      Array.from(
        { length: tuning.stages },
        (_, index) => tuning.stages - index,
      ),
    [tuning.stages],
  );

  return (
    <main className="countdown-room">
      <header className="countdown-top">
        <button
          onClick={() => {
            setTurbo(false);
            stopPresentation();
            onBackToWorld();
          }}
        >
          ← <span>Anlık Oyunlar</span>
        </button>
        <div className="countdown-brand">
          <i>10</i>
          <span>
            SON ON<small>GALATA SAAT KASASI</small>
          </span>
        </div>
        <div className="countdown-top-actions">
          <GameMusicControls game="son-on" />
          <button
            className={sfxEnabled ? "on" : ""}
            onClick={() => setSfxEnabled((value) => !value)}
          >
            {sfxEnabled ? "♪ EFEKT" : "♪ KAPALI"}
          </button>
          <button
            className={voiceEnabled ? "on" : ""}
            onClick={() => setVoiceEnabled((value) => !value)}
          >
            {voiceEnabled ? "◉ NİHAL SES" : "○ NİHAL SES"}
          </button>
          <strong>
            ✦ {money.format(balance)} <small>PR</small>
          </strong>
          <button
            className="close-room"
            onClick={() => {
              setTurbo(false);
              stopPresentation();
              onExit();
            }}
          >
            ×
          </button>
        </div>
      </header>
      <section className="countdown-stage">
        <aside className="countdown-host">
          <img
            src="/assets/instant/son-on/nihal-v1.png"
            alt="Saat kasası sunucusu Nihal"
          />
          <div>
            <small>SAAT MUHAFIZI</small>
            <h2>NİHAL</h2>
            <p>Soğukkanlı, kuru mizahlı; kararını senin yerine vermez.</p>
          </div>
          <section className="countdown-chat">
            {chat.slice(-4).map((message, index) => (
              <p
                className={message.speaker === "Sen" ? "user" : ""}
                key={`${message.at}-${index}`}
              >
                <small>{message.speaker}</small>
                {message.text}
              </p>
            ))}
          </section>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendChat();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nihal'e yaz…"
            />
            <button>↑</button>
          </form>
        </aside>
        <section
          className={`countdown-vault ${active ? "is-active" : ""} ${busy ? "is-resolving" : ""}`}
        >
          <div
            className="countdown-progress"
            aria-label="Geri sayım ilerlemesi"
          >
            {stageMarks.map((mark, index) => (
              <span
                key={mark}
                className={
                  index < (round?.safeSteps ?? 0)
                    ? "passed"
                    : index === (round?.safeSteps ?? 0) && active
                      ? "current"
                      : ""
                }
              >
                {mark}
              </span>
            ))}
          </div>
          <div className="countdown-clock">
            <div className="clock-rings">
              <i />
              <i />
              <i />
            </div>
            <span className="clock-hand hour" />
            <span className="clock-hand minute" />
            <span className="clock-house-mark" aria-hidden="true">
              ✡
            </span>
            <small>
              {active ? "KALAN KİLİT" : round ? "TUR SONU" : "İLK KİLİT"}
            </small>
            <strong>{countdownNumber}</strong>
            <em>{round?.currentMultiplier.toFixed(2) ?? "1.00"}×</em>
          </div>
          <div className="countdown-timer">
            <span style={{ width: `${timePercent}%` }} />
            <b>
              {active ? `${(timeLeft / 1000).toFixed(1)} sn` : "SAAT HAZIR"}
            </b>
          </div>
          {cue && (
            <div
              key={cue.key}
              className={`countdown-cue ${cue.kind}`}
              role="status"
            >
              <span>
                {cue.kind === "alarm" ? "!" : cue.kind === "safe" ? "✦" : "✡"}
              </span>
              <div>
                <small>{cue.title}</small>
                <strong>{cue.detail}</strong>
              </div>
            </div>
          )}
          {chipFlying && (
            <div className="countdown-chip-flight" aria-hidden="true">
              <i>✡</i>
              <b>{money.format(bet)}</b>
              <small>PR</small>
            </div>
          )}
          <div className={`countdown-doors choices-${profile.choices}`}>
            {Array.from({ length: profile.choices }, (_, cell) => {
              const isAlarm =
                lastAlarm === cell ||
                (!!round &&
                  round.phase !== "active" &&
                  round.hazardIndices[
                    Math.min(round.safeSteps, round.stages - 1)
                  ]?.includes(cell));
              return (
                <button
                  key={cell}
                  disabled={!active || busy}
                  className={`${opening === cell ? "opening" : ""} ${isAlarm ? "alarm" : ""} ${lastSafe === cell ? "safe" : ""}`}
                  onClick={() => void chooseCell(cell)}
                >
                  <span className="door-face">
                    <span className="door-sigil">✡</span>
                    <i>{String(cell + 1).padStart(2, "0")}</i>
                    <b>
                      {isAlarm
                        ? "ALARM"
                        : lastSafe === cell
                          ? "TEMİZ"
                          : opening === cell
                            ? "AÇILIYOR"
                            : "MÜHÜR"}
                    </b>
                    <span className="door-owl">
                      <u />
                      <u />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="countdown-readout">
            <span>
              <small>SONRAKİ GÜVENLİ KAPAK</small>
              <b>{nextMultiplier.toFixed(2)}×</b>
            </span>
            <span>
              <small>MASADAKİ BRÜT</small>
              <b>{money.format(potential)} PR</b>
            </span>
            <span>
              <small>GÜVENLİ GÖZ</small>
              <b>%{Math.round(safeChance * 100)}</b>
            </span>
          </div>
          <div className="countdown-control-dock">
            <div
              className="countdown-chip-rack"
              aria-label="Hızlı bahis çipleri"
            >
              {QUICK_BETS.map((value) => (
                <button
                  disabled={value > balance}
                  className={bet === value ? "selected" : ""}
                  key={value}
                  onClick={() => setBet(value)}
                >
                  <i>✡</i>
                  <b>{compactWager(value)}</b>
                </button>
              ))}
              <button
                className="countdown-max-chip"
                disabled={balance < game.minBet}
                onClick={() => setBet(balance)}
              >
                <i>✦</i>
                <b>MAX</b>
              </button>
            </div>
            <div className="countdown-actions">
              <div className="bet-control dock-bet">
                <button
                  onClick={() =>
                    setBet(
                      Math.max(
                        game.minBet,
                        bet -
                          (bet >= 10_000
                            ? 1_000
                            : bet >= 1_000
                              ? 100
                              : bet >= 100
                                ? 25
                                : 5),
                      ),
                    )
                  }
                >
                  −
                </button>
                <label>
                  <small>
                    {active ? "SONRAKİ TUR BAHİSİ" : "MASA BAHİSİ · SERBEST"}
                  </small>
                  <input
                    type="number"
                    min={game.minBet}
                    max={balance}
                    value={bet}
                    onChange={(event) =>
                      setBet(
                        normalizeWagerInput(
                          Number(event.target.value),
                          game.minBet,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    setBet(
                      Math.min(
                        balance,
                        bet +
                          (bet >= 10_000
                            ? 1_000
                            : bet >= 1_000
                              ? 100
                              : bet >= 100
                                ? 25
                                : 5),
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
              {busy ? (
                <button className="stop" onClick={stopPresentation}>
                  DUR <strong>ANİMASYONU BİTİR</strong>
                </button>
              ) : !active ? (
                <button
                  className="start"
                  disabled={bet > balance}
                  onClick={() => void startRound()}
                >
                  SAATİ KUR <strong>{money.format(bet)} PR</strong>
                </button>
              ) : (
                <button
                  className="bank"
                  disabled={!round?.safeSteps}
                  onClick={() => {
                    skipPresentationRef.current = false;
                    void cashOut();
                  }}
                >
                  KASAYA AL{" "}
                  <strong>{money.format(round?.grossPayout ?? 0)} PR</strong>
                </button>
              )}
              <button className="utility" onClick={() => setRulesOpen(true)}>
                ?
              </button>
              <button className="utility" onClick={() => setFairOpen(true)}>
                ✓
              </button>
            </div>
          </div>
        </section>
        <aside className="countdown-console">
          <section>
            <small>{active ? "SONRAKİ TUR RİSK HATTI" : "RİSK HATTI"}</small>
            <div className="risk-tabs">
              {(Object.keys(COUNTDOWN_PROFILE) as CountdownRisk[]).map(
                (value) => (
                  <button
                    key={value}
                    className={risk === value ? "active" : ""}
                    onClick={() => setRisk(value)}
                  >
                    <b>{COUNTDOWN_PROFILE[value].label}</b>
                    <span>
                      {COUNTDOWN_PROFILE[value].choices -
                        COUNTDOWN_PROFILE[value].alarms}
                      /{COUNTDOWN_PROFILE[value].choices} güvenli
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>
          <section className="auto-panel">
            <small>OTOMATİK KARAR</small>
            <label>
              Hedef kapı
              <select
                disabled={active}
                value={autoBankStep}
                onChange={(event) =>
                  setAutoBankStep(Number(event.target.value))
                }
              >
                <option value="0">Kapalı</option>
                {stageMarks.map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}. güvenli kapakta al
                  </option>
                ))}
              </select>
            </label>
            <label>
              Süre biterse
              <select
                value={timeoutPolicy}
                onChange={(event) =>
                  setTimeoutPolicy(event.target.value as TimeoutPolicy)
                }
              >
                <option value="bank">Mümkünse kasaya al</option>
                <option value="random">Rastgele göz seç</option>
              </select>
            </label>
            <button
              className={turbo ? "active" : ""}
              onClick={() => setTurbo((value) => !value)}
            >
              ⚡ TURBO {turbo ? "AÇIK" : "KAPALI"}
            </button>
          </section>
          <section className="countdown-history">
            <small>SON KASA KAYITLARI</small>
            {recent.length ? (
              recent.map((item) => (
                <p key={item.id}>
                  <i className={item.outcome}>
                    {item.outcome === "win"
                      ? "↑"
                      : item.outcome === "push"
                        ? "·"
                        : "↓"}
                  </i>
                  <span>
                    {String(item.result.safeSteps ?? 0)} kapı
                    <small>{item.variant}</small>
                  </span>
                  <b>
                    {item.grossPayout
                      ? `${money.format(item.grossPayout)} PR`
                      : "0 PR"}
                  </b>
                </p>
              ))
            ) : (
              <em>İlk tur bekleniyor.</em>
            )}
          </section>
        </aside>
      </section>

      {resultOpen && round && round.phase !== "active" && (
        <div className="countdown-modal-backdrop">
          <section className={`countdown-result ${round.phase}`}>
            <button className="modal-x" onClick={dismissResult}>
              ×
            </button>
            <small>GALATA SAAT KASASI · TUR RAPORU</small>
            <h2>
              {round.phase === "lost"
                ? "SAAT DURDU"
                : round.phase === "completed"
                  ? "SON ON TAMAMLANDI"
                  : "TAM VAKTİNDE"}
            </h2>
            <div className="result-number">
              <strong>
                {money.format(round.phase === "lost" ? 0 : round.grossPayout)}
              </strong>
              <span>PR BRÜT ÖDEME</span>
              <em>
                {round.currentMultiplier.toFixed(2)}× · {round.safeSteps}{" "}
                güvenli kapak
              </em>
            </div>
            <p>
              {round.phase === "lost"
                ? `Bahis ${money.format(round.stake)} PR ile kapandı.`
                : `${money.format(round.stake)} PR bahis dahil toplam tutar bakiyene eklendi.`}
            </p>
            <footer>
              <button onClick={dismissResult}>AYARLARI DEĞİŞTİR</button>
              <button
                className="primary"
                onClick={() => {
                  dismissResult();
                  window.setTimeout(() => void startRound(), 0);
                }}
              >
                AYNI AYARLA YENİ TUR →
              </button>
            </footer>
          </section>
        </div>
      )}
      {rulesOpen && (
        <div className="countdown-modal-backdrop">
          <section className="countdown-info">
            <button className="modal-x" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>NASIL OYNANIR?</small>
            <h2>On kapı, tek karar.</h2>
            <ol>
              <li>
                Bahis ve risk hattını seç. Her hattın güvenli göz sayısı ekranda
                yazar.
              </li>
              <li>
                Saat 10’dan başlar. Bir mühür seç; güvenliyse çarpan yükselir ve
                sayaç iner.
              </li>
              <li>
                Her güvenli seçimden sonra kasaya alabilir veya bir sonraki
                kilide geçebilirsin.
              </li>
              <li>
                Alarm seçersen tur kapanır. Süre biterse seçtiğin politikaya
                göre para kasaya alınır veya rastgele göz açılır.
              </li>
              <li>
                Otomatik hedef, belirlediğin güvenli kapıya ulaşınca ödemeyi
                kendisi alır. Turbo yalnızca animasyonu hızlandırır.
              </li>
            </ol>
            <p>
              Çarpan = hedef RTP ÷ o ana kadar güvenli kalma olasılığı. Bahis,
              ödemenin içindedir; ekranda gösterilen rakam brüt ödemedir.
            </p>
          </section>
        </div>
      )}
      {fairOpen && (
        <div className="countdown-modal-backdrop">
          <section className="countdown-info fair">
            <button className="modal-x" onClick={() => setFairOpen(false)}>
              ×
            </button>
            <small>DOĞRULANABİLİR TUR</small>
            <h2>Alarm yerleri turdan önce mühürlendi.</h2>
            <dl>
              <div>
                <dt>Algoritma</dt>
                <dd>{round?.algorithm ?? "son-on-hmac-sha256-v1"}</dd>
              </div>
              <div>
                <dt>Commitment</dt>
                <dd>{round?.commitment ?? "Tur başladıktan sonra görünür."}</dd>
              </div>
              <div>
                <dt>Client seed</dt>
                <dd>
                  {round?.clientSeed ??
                    localStorage.getItem(
                      accountKey(user.id, CLIENT_SEED_KEY),
                    ) ??
                    "Henüz üretilmedi"}
                </dd>
              </div>
              <div>
                <dt>Nonce</dt>
                <dd>
                  {round?.nonce ??
                    Number(
                      localStorage.getItem(accountKey(user.id, NONCE_KEY)) ??
                        "0",
                    )}
                </dd>
              </div>
              {round && round.phase !== "active" && (
                <div>
                  <dt>Server seed</dt>
                  <dd>{round.serverSeed}</dd>
                </div>
              )}
            </dl>
            <button
              disabled={
                !round || round.phase === "active" || verifyState === "checking"
              }
              onClick={async () => {
                if (!round) return;
                setVerifyState("checking");
                setVerifyState(
                  (await verifyCountdownRound(round)) ? "ok" : "fail",
                );
              }}
            >
              {verifyState === "checking"
                ? "KONTROL EDİLİYOR…"
                : verifyState === "ok"
                  ? "✓ TUR DOĞRULANDI"
                  : verifyState === "fail"
                    ? "× DOĞRULAMA BAŞARISIZ"
                    : "TURU DOĞRULA"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
