import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react";
import { askAyla, aylaEventLine, type AylaContext } from "../../ai/ayla";
import { useAuth } from "../../auth/auth-client";
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
  getCasinoRounds,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
  setCasinoMeta,
  type CasinoRoundRecord,
} from "../../data/casino-database";
import {
  DEPTH_HAZARDS,
  canReveal,
  cashOutMinesRound,
  createFairMinesRound,
  nextMultiplier,
  nextSafeProbability,
  revealMinesTile,
  roundMoney,
  verifyMinesRound,
  type DepthRisk,
  type FairMinesRound,
  type MinesMode,
} from "./mines-engine";
import "./mines.css";
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

type ChatMessage = { speaker: "Ayla" | "Sen"; text: string; at: string };
type DigProfile = {
  totalSafe: number;
  bestSafe: number;
  bestMultiplier: number;
  bestPayout: number;
  rounds: number;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const PROFILE_KEY = "obsidyen-damari-profile-v1";
const ACTIVE_KEY = "obsidyen-damari-active-round-v1";
const CLIENT_SEED_KEY = "obsidyen-damari-client-seed-v1";
const NONCE_KEY = "obsidyen-damari-nonce-v1";
const SFX_KEY = "obsidyen-damari-sfx-v1";
const EMPTY_PROFILE: DigProfile = {
  totalSafe: 0,
  bestSafe: 0,
  bestMultiplier: 0,
  bestPayout: 0,
  rounds: 0,
};
const QUICK_BETS = CASINO_CHIP_VALUES;

function loadJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const accountKey = (userId: string, key: string) => `account:${userId}:${key}`;

function loadDigProfile(userId: string): DigProfile {
  const saved = loadJson<Partial<DigProfile>>(
    accountKey(userId, PROFILE_KEY),
    EMPTY_PROFILE,
  );
  return {
    totalSafe: Math.max(0, finiteNumber(saved.totalSafe)),
    bestSafe: Math.max(0, finiteNumber(saved.bestSafe)),
    bestMultiplier: Math.max(0, finiteNumber(saved.bestMultiplier)),
    bestPayout: Math.max(0, finiteNumber(saved.bestPayout)),
    rounds: Math.max(0, finiteNumber(saved.rounds)),
  };
}

function loadActiveRound(userId: string) {
  const saved = loadJson<FairMinesRound | null>(
    accountKey(userId, ACTIVE_KEY),
    null,
  );
  if (!saved) return null;
  return {
    ...saved,
    rows: Math.max(1, finiteNumber(saved.rows, saved.mode === "free" ? 5 : 12)),
    columns: Math.max(1, finiteNumber(saved.columns, 5)),
    mineCount: Math.max(0, finiteNumber(saved.mineCount)),
    depthHazards: Math.max(0, finiteNumber(saved.depthHazards)),
    safeReveals: Math.max(0, finiteNumber(saved.safeReveals)),
    activeDepthRow: Math.max(0, finiteNumber(saved.activeDepthRow)),
    currentMultiplier: Math.max(1, finiteNumber(saved.currentMultiplier, 1)),
    maxMultiplier: Math.max(1, finiteNumber(saved.maxMultiplier, 1_000_000)),
    grossPayout: Math.max(0, finiteNumber(saved.grossPayout)),
    rtp: Math.max(1, finiteNumber(saved.rtp, 97)),
    revealed: Array.isArray(saved.revealed)
      ? saved.revealed.filter(Number.isFinite)
      : [],
    mineIndices: Array.isArray(saved.mineIndices)
      ? saved.mineIndices.filter(Number.isFinite)
      : [],
    boardOrder: Array.isArray(saved.boardOrder)
      ? saved.boardOrder.filter(Number.isFinite)
      : [],
  };
}

function randomClientSeed() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `muharrem-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function trVoice() {
  if (!("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(
      (voice) =>
        /^tr[-_]/i.test(voice.lang) &&
        /emel|female|selin|filiz|aylin/i.test(voice.name),
    ) ?? voices.find((voice) => /^tr[-_]/i.test(voice.lang))
  );
}

function resultTitle(round: FairMinesRound) {
  if (round.phase === "lost") return "BASINÇ ÇEKİRDEĞİ";
  if (round.phase === "won") return "DAMAR TAMAMLANDI";
  return "KAZI KASAYA DÖNDÜ";
}

function riskLabel(round: FairMinesRound) {
  if (round.mode === "free") return `${round.mineCount} çekirdek`;
  return round.depthRisk === "temkinli"
    ? "Temkinli Hat"
    : round.depthRisk === "keskin"
      ? "Keskin Hat"
      : "Uçurum Hattı";
}

export default function ObsidyenDamariRoom({
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
  const game = admin.games["obsidyen-damari"];
  const tuning = game.mines!;
  const [mode, setMode] = useState<MinesMode>("free");
  const [mineCount, setMineCount] = useState(tuning.defaultMines);
  const [depthRisk, setDepthRisk] = useState<DepthRisk>("temkinli");
  const [bet, setBet] = useState(game.defaultBet);
  const [round, setRound] = useState<FairMinesRound | null>(() =>
    loadActiveRound(user.id),
  );
  const [busy, setBusy] = useState(false);
  const [openingIndex, setOpeningIndex] = useState<number | null>(null);
  const [marked, setMarked] = useState<number[]>([]);
  const [turbo, setTurbo] = useState(false);
  const [autoTarget, setAutoTarget] = useState(3);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fairOpen, setFairOpen] = useState(false);
  const [verifyState, setVerifyState] = useState<
    "idle" | "checking" | "ok" | "fail"
  >("idle");
  const [recentRounds, setRecentRounds] = useState<CasinoRoundRecord[]>([]);
  const [profile, setProfile] = useState<DigProfile>(() =>
    loadDigProfile(user.id),
  );
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      speaker: "Ayla",
      text: "İstasyon açık. Mühürleri kapatmadan önce risk sözleşmeni seç.",
      at: new Date().toISOString(),
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useGameAudioPreference(
    "obsidyen-damari",
    "ai-voice",
  );
  const [sfxEnabled, setSfxEnabled] = useState(
    () =>
      loadJson<{ enabled: boolean; volume: number }>(SFX_KEY, {
        enabled: true,
        volume: 0.75,
      }).enabled,
  );
  const [sfxVolume, setSfxVolume] = useState(
    () =>
      loadJson<{ enabled: boolean; volume: number }>(SFX_KEY, {
        enabled: true,
        volume: 0.75,
      }).volume,
  );
  const roundRef = useRef(round);
  const balanceRef = useRef(balance);
  const skipPresentationRef = useRef(false);
  const stopAutoRef = useRef(false);
  const chatSessionRef = useRef(
    `ai-obsidyen-${Date.now()}-${crypto.randomUUID()}`,
  );
  const ambientRef = useRef<HTMLAudioElement | null>(null);
  roundRef.current = round;
  balanceRef.current = balance;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  const active = round?.phase === "active";
  const settled = round && round.phase !== "active";
  const safeChance = round
    ? nextSafeProbability(round)
    : mode === "free"
      ? (25 - mineCount) / 25
      : (5 - DEPTH_HAZARDS[depthRisk]) / 5;
  const upcomingMultiplier = round ? nextMultiplier(round) : 1;
  const upcomingPayout = round
    ? roundMoney(round.stake * upcomingMultiplier)
    : 0;
  const boardIndices = useMemo(() => {
    if ((round?.mode ?? mode) === "free")
      return Array.from({ length: 25 }, (_, index) => index);
    const rows = round?.rows ?? tuning.depthRows;
    return Array.from(
      { length: rows },
      (_, reverseRow) => rows - reverseRow - 1,
    ).flatMap((row) =>
      Array.from({ length: 5 }, (_, column) => row * 5 + column),
    );
  }, [mode, round, tuning.depthRows]);

  useEffect(() => {
    localStorage.setItem(
      accountKey(user.id, PROFILE_KEY),
      JSON.stringify(profile),
    );
    void setCasinoMeta("obsidyen-damari-profile", profile);
  }, [profile, user.id]);

  useEffect(() => {
    if (round?.phase === "active")
      localStorage.setItem(
        accountKey(user.id, ACTIVE_KEY),
        JSON.stringify(round),
      );
    else localStorage.removeItem(accountKey(user.id, ACTIVE_KEY));
  }, [round, user.id]);

  useEffect(() => {
    localStorage.setItem(
      SFX_KEY,
      JSON.stringify({ enabled: sfxEnabled, volume: sfxVolume }),
    );
    const audio = ambientRef.current;
    if (audio)
      audio.volume =
        sfxEnabled && game.sound && admin.general.masterSound
          ? gameSfxLevel("obsidyen-damari",Math.min(0.22, sfxVolume * 0.2))
          : 0;
  }, [sfxEnabled, sfxVolume, game.sound, admin.general.masterSound]);

  useEffect(() => {
    const audio = new Audio(
      "/assets/instant/obsidyen-damari/audio/dark-cavern-loop.ogg",
    );
    audio.loop = true;
    audio.preload = "auto";
    audio.volume =
      sfxEnabled && game.sound && admin.general.masterSound
        ? gameSfxLevel("obsidyen-damari",Math.min(0.22, sfxVolume * 0.2))
        : 0;
    ambientRef.current = audio;
    const unlock = () => {
      if (audio.paused && audio.volume > 0)
        void audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    void audio.play().catch(() => undefined);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      audio.pause();
      audio.removeAttribute("src");
      ambientRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    void getCasinoRounds().then((records) =>
      setRecentRounds(
        records
          .filter((record) => record.game === "obsidyen-damari")
          .slice(0, 12),
      ),
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (
        event.key.toLocaleLowerCase("tr-TR") === "c" &&
        roundRef.current?.safeReveals
      )
        void cashOut();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [active]);

  const playSfx = useCallback(
    (name: string, volume = 1) => {
      if (!sfxEnabled || !game.sound || !admin.general.masterSound) return;
      playGameSfx("obsidyen-damari",`/assets/instant/obsidyen-damari/audio/${name}`,Math.min(1,sfxVolume*volume));
    },
    [admin.general.masterSound, game.sound, sfxEnabled, sfxVolume],
  );

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "tr-TR";
      utterance.voice = trVoice() ?? null;
      utterance.rate = 0.98;
      utterance.pitch = 0.92;
      utterance.volume = 0.88;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled],
  );

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((enabled) => !enabled);
  }, [setVoiceEnabled]);

  const contextFor = useCallback(
    (
      state: FairMinesRound | null,
      lastResult?: AylaContext["lastResult"],
      lastTile?: number,
    ): AylaContext => ({
      phase: state?.phase ?? "idle",
      mode: state?.mode ?? mode,
      depthRisk: state?.depthRisk ?? depthRisk,
      balance: balanceRef.current,
      stake: state?.stake ?? bet,
      mineCount: state?.mineCount ?? mineCount,
      safeReveals: state?.safeReveals ?? 0,
      currentMultiplier: state?.currentMultiplier ?? 1,
      grossPayout: state?.grossPayout ?? 0,
      nextSafeChance: state ? nextSafeProbability(state) : safeChance,
      lastResult,
      lastTile,
      recentRounds: recentRounds.slice(0, 6).map((record) => ({
        outcome: record.outcome,
        safe: Number(record.result.safeReveals ?? 0),
        payout: record.grossPayout,
      })),
      recentMessages: chat
        .slice(-6)
        .map((message) => `${message.speaker}: ${message.text}`),
    }),
    [bet, chat, depthRisk, mineCount, mode, recentRounds, safeChance],
  );

  const addAylaLine = useCallback(
    (
      text: string,
      state: FairMinesRound | null,
      kind: "assistant" | "system-event" = "system-event",
      latencyMs?: number,
    ) => {
      const at = new Date().toISOString();
      setChat((current) => [
        ...current.slice(-20),
        { speaker: "Ayla", text, at },
      ]);
      speak(text);
      void recordAIConversation({
        id: createRecordId("ai-obsidyen-ayla", state?.roundId),
        sessionId: chatSessionRef.current,
        roundId: state?.roundId,
        game: "obsidyen-damari",
        character: "Ayla",
        speaker: kind,
        occurredAt: at,
        text,
        context: contextFor(state),
        model:
          kind === "assistant"
            ? aiOnline
              ? "ollama:vera-pehlevan"
              : "fallback:ayla"
            : "event:ayla-v1",
        latencyMs,
      });
    },
    [aiOnline, contextFor, speak],
  );

  const updateProfileFor = useCallback((state: FairMinesRound) => {
    setProfile((current) => ({
      totalSafe: current.totalSafe + 1,
      bestSafe: Math.max(current.bestSafe, state.safeReveals),
      bestMultiplier: Math.max(current.bestMultiplier, state.currentMultiplier),
      bestPayout: Math.max(current.bestPayout, state.grossPayout),
      rounds: current.rounds,
    }));
  }, []);

  const settle = useCallback(
    async (state: FairMinesRound) => {
      const settledAt = state.settledAt ?? new Date().toISOString();
      const payout = state.phase === "lost" ? 0 : state.grossPayout;
      const balanceBeforePayout = balanceRef.current;
      if (payout > 0) {
        setBalance((current) => current + payout);
        balanceRef.current += payout;
        await recordWalletEntry({
          id: createRecordId("wallet-obsidyen-payout", state.roundId),
          roundId: state.roundId,
          game: "obsidyen-damari",
          occurredAt: settledAt,
          type: "payout",
          amount: payout,
          balanceBefore: balanceBeforePayout,
          balanceAfter: balanceBeforePayout + payout,
          note: `Obsidyen Damarı ${state.safeReveals} güvenli seçim · ${state.currentMultiplier.toFixed(4)}× brüt ödeme`,
        });
      }
      const record: CasinoRoundRecord = {
        id: createRecordId("round-obsidyen", state.roundId),
        roundId: state.roundId,
        game: "obsidyen-damari",
        variant:
          state.mode === "free"
            ? `Serbest Kazı · ${state.mineCount} çekirdek`
            : `Derin Hat · ${riskLabel(state)}`,
        source: "player",
        playerParticipated: true,
        startedAt: state.startedAt,
        settledAt,
        stake: state.stake,
        grossPayout: payout,
        net: roundMoney(payout - state.stake),
        outcome: payout > 0 ? "win" : "loss",
        balanceBefore: balanceBeforePayout + state.stake,
        balanceAfter: balanceBeforePayout + payout,
        result: {
          telemetryVersion: 1,
          phase: state.phase,
          mode: state.mode,
          safeReveals: state.safeReveals,
          revealed: state.revealed,
          mineIndices: state.mineIndices,
          boardOrder: state.boardOrder,
          mineCount: state.mineCount,
          depthRisk: state.depthRisk,
          depthHazards: state.depthHazards,
          rows: state.rows,
          columns: state.columns,
          grossPayout: payout,
          currentMultiplier: state.currentMultiplier,
          maxMultiplier: state.maxMultiplier,
          algorithm: state.algorithm,
          clientSeed: state.clientSeed,
          nonce: state.nonce,
          serverSeed: state.serverSeed,
          commitment: state.commitment,
          digest: state.digest,
        },
        modifiers: {
          turbo,
          autoTarget,
          targetRtp: state.rtp,
          sound: sfxEnabled,
          algorithmVersion: state.algorithm,
        },
      };
      await recordGameRound(record);
      await recordGameEvent({
        id: createRecordId("event-obsidyen-settle", state.roundId),
        roundId: state.roundId,
        game: "obsidyen-damari",
        occurredAt: settledAt,
        type: "mines-round-settled",
        payload: {
          phase: state.phase,
          safeReveals: state.safeReveals,
          multiplier: state.currentMultiplier,
          payout,
          net: payout - state.stake,
        },
      });
      setRecentRounds((current) => [record, ...current].slice(0, 12));
      setProfile((current) => ({
        ...current,
        rounds: current.rounds + 1,
        bestSafe: Math.max(current.bestSafe, state.safeReveals),
        bestMultiplier: Math.max(
          current.bestMultiplier,
          state.currentMultiplier,
        ),
        bestPayout: Math.max(current.bestPayout, payout),
      }));
      localStorage.removeItem(accountKey(user.id, ACTIVE_KEY));
      setResultDismissed(false);
    },
    [autoTarget, setBalance, sfxEnabled, turbo],
  );

  const startRound = async () => {
    if (busy || active) return;
    skipPresentationRef.current = false;
    stopAutoRef.current = false;
    const stake = roundMoney(Math.max(game.minBet, bet));
    if (stake > balanceRef.current)
      return addAylaLine(
        "Bu bahis bakiyeyi geçiyor. Mühürleri borçla kapatmıyoruz; tutarı küçült.",
        roundRef.current,
      );
    setBusy(true);
    setMarked([]);
    setVerifyState("idle");
    setResultDismissed(true);
    playSfx("lock.ogg", 0.9);
    try {
      const clientSeedKey = accountKey(user.id, CLIENT_SEED_KEY);
      const nonceKey = accountKey(user.id, NONCE_KEY);
      const clientSeed =
        localStorage.getItem(clientSeedKey) ?? randomClientSeed();
      localStorage.setItem(clientSeedKey, clientSeed);
      const nonce = Number(localStorage.getItem(nonceKey) ?? "0") + 1;
      localStorage.setItem(nonceKey, String(nonce));
      const created = await createFairMinesRound({
        mode,
        stake,
        rtp: game.targetRtp,
        mineCount,
        depthRisk,
        clientSeed,
        nonce,
        rows: tuning.depthRows,
        maxMultiplier: tuning.maxPayoutX,
      });
      const before = balanceRef.current;
      setBalance((current) => current - stake);
      balanceRef.current -= stake;
      setRound(created);
      roundRef.current = created;
      await recordWalletEntry({
        id: createRecordId("wallet-obsidyen-stake", created.roundId),
        roundId: created.roundId,
        game: "obsidyen-damari",
        occurredAt: created.startedAt,
        type: "stake",
        amount: -stake,
        balanceBefore: before,
        balanceAfter: before - stake,
        note: `Obsidyen Damarı ${created.mode === "free" ? `${created.mineCount} çekirdek` : riskLabel(created)} bahis`,
      });
      await recordGameEvent({
        id: createRecordId("event-obsidyen-start", created.roundId),
        roundId: created.roundId,
        game: "obsidyen-damari",
        occurredAt: created.startedAt,
        type: "mines-round-committed",
        payload: {
          mode: created.mode,
          mineCount: created.mineCount,
          depthRisk: created.depthRisk,
          stake,
          rtp: created.rtp,
          commitment: created.commitment,
          clientSeed,
          nonce,
          algorithm: created.algorithm,
        },
      });
      addAylaLine(aylaEventLine("start", contextFor(created)), created);
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (index: number, baseRound?: FairMinesRound) => {
    const source = baseRound ?? roundRef.current;
    if (!source || !canReveal(source, index)) return source;
    setOpeningIndex(index);
    playSfx("tile-crack.ogg", 0.72);
    const turboRevealMs = Math.max(420, tuning.turboRevealMs);
    await waitForPresentation(
      turbo ? turboRevealMs * 0.9 : tuning.normalRevealMs * 0.46,
      () => skipPresentationRef.current,
    );
    const beforeChance = nextSafeProbability(source);
    const beforeMultiplier = source.currentMultiplier;
    const resolved = revealMinesTile(source, index);
    const next = resolved.round;
    setRound(next);
    roundRef.current = next;
    setOpeningIndex(null);
    if (resolved.result === "mine") playSfx("pressure-burst.ogg", 1);
    else playSfx("crystal-reveal.ogg", 0.82);
    await recordGameEvent({
      id: createRecordId("event-obsidyen-reveal", source.roundId),
      roundId: source.roundId,
      game: "obsidyen-damari",
      occurredAt: new Date().toISOString(),
      type: "mines-tile-revealed",
      payload: {
        index,
        row: Math.floor(index / source.columns),
        column: index % source.columns,
        result: resolved.result,
        sequence: next.revealed.length,
        remainingTilesBefore:
          source.rows * source.columns - source.revealed.length,
        remainingMinesBefore:
          source.mode === "free" ? source.mineCount : source.depthHazards,
        safeProbabilityBefore: beforeChance,
        safeProbabilityAfter: nextSafeProbability(next),
        multiplierBefore: beforeMultiplier,
        multiplierAfter: next.currentMultiplier,
        grossPotentialAfter: next.grossPayout,
        turbo,
      },
    });
    if (resolved.result !== "mine") updateProfileFor(next);
    if (resolved.result === "mine") {
      addAylaLine(aylaEventLine("mine", contextFor(next, "mine", index)), next);
      await waitForPresentation(
        turbo ? 300 : 480,
        () => skipPresentationRef.current,
      );
      await settle(next);
    } else if (resolved.result === "complete") {
      addAylaLine(
        aylaEventLine("complete", contextFor(next, "complete", index)),
        next,
      );
      await waitForPresentation(
        turbo ? 280 : 360,
        () => skipPresentationRef.current,
      );
      await settle(next);
    } else if (!baseRound) {
      const lineKind =
        nextSafeProbability(next) < 0.58 || next.currentMultiplier >= 5
          ? "risky"
          : "safe";
      addAylaLine(
        aylaEventLine(lineKind, contextFor(next, "safe", index)),
        next,
      );
    }
    return next;
  };

  const cashOut = async () => {
    const source = roundRef.current;
    if (!source || busy || source.phase !== "active" || source.safeReveals < 1)
      return;
    setBusy(true);
    const next = cashOutMinesRound(source);
    setRound(next);
    roundRef.current = next;
    playSfx("cashout.ogg", 0.9);
    addAylaLine(aylaEventLine("cashout", contextFor(next, "cashout")), next);
    await settle(next);
    setBusy(false);
  };

  const randomValidIndex = (state: FairMinesRound) => {
    const candidates = Array.from(
      { length: state.rows * state.columns },
      (_, index) => index,
    ).filter((index) => canReveal(state, index) && !marked.includes(index));
    if (!candidates.length) return -1;
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return candidates[bytes[0] % candidates.length];
  };

  const autoDig = async () => {
    let working = roundRef.current;
    if (!working || busy || working.phase !== "active") return;
    skipPresentationRef.current = false;
    stopAutoRef.current = false;
    setBusy(true);
    while (
      working.phase === "active" &&
      working.safeReveals < autoTarget &&
      !stopAutoRef.current
    ) {
      const index = randomValidIndex(working);
      if (index < 0) break;
      const next = await reveal(index, working);
      if (!next) break;
      working = next;
      if (working.phase !== "active") break;
      await waitForPresentation(
        turbo ? Math.max(420, tuning.turboRevealMs) : tuning.autoPickDelayMs,
        () => skipPresentationRef.current,
      );
    }
    if (
      !stopAutoRef.current &&
      working.phase === "active" &&
      working.safeReveals >= autoTarget
    ) {
      const next = cashOutMinesRound(working);
      setRound(next);
      roundRef.current = next;
      playSfx("cashout.ogg", 0.9);
      addAylaLine(aylaEventLine("cashout", contextFor(next, "cashout")), next);
      await settle(next);
    }
    setBusy(false);
  };

  const stopPresentation = () => {
    skipPresentationRef.current = true;
    stopAutoRef.current = true;
  };

  const sendChat = async () => {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    const at = new Date().toISOString();
    setChat((current) => [
      ...current.slice(-20),
      { speaker: "Sen", text: prompt, at },
    ]);
    setDraft("");
    setThinking(true);
    const state = roundRef.current;
    await recordAIConversation({
      id: createRecordId("ai-obsidyen-user", state?.roundId),
      sessionId: chatSessionRef.current,
      roundId: state?.roundId,
      game: "obsidyen-damari",
      character: "Ayla",
      speaker: "user",
      occurredAt: at,
      text: prompt,
      context: contextFor(state),
    });
    const started = performance.now();
    const answer = await askAyla(prompt, contextFor(state));
    addAylaLine(
      answer,
      state,
      "assistant",
      Math.round(performance.now() - started),
    );
    setThinking(false);
  };

  const toggleMark = (event: MouseEvent, index: number) => {
    event.preventDefault();
    if (!active || round?.revealed.includes(index)) return;
    setMarked((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index],
    );
    playSfx("ui-click.ogg", 0.35);
  };

  const changeBet = (direction: -1 | 1) => {
    const steps = QUICK_BETS;
    if (direction > 0)
      setBet(
        steps.find((value) => value > bet) ??
          Math.min(balanceRef.current, Math.ceil(bet / 100_000 + 1) * 100_000),
      );
    else
      setBet([...steps].reverse().find((value) => value < bet) ?? game.minBet);
  };

  const clearSettledBoard = () => {
    const state = roundRef.current;
    if (!state || state.phase === "active") return;
    setRound(null);
    roundRef.current = null;
    setMarked([]);
    setResultDismissed(true);
    setVerifyState("idle");
  };

  const startSame = () => {
    setRound(null);
    roundRef.current = null;
    setMarked([]);
    setResultDismissed(true);
    window.setTimeout(() => void startRound(), 0);
  };

  const verify = async () => {
    if (!round || round.phase === "active") return;
    setVerifyState("checking");
    setVerifyState((await verifyMinesRound(round)) ? "ok" : "fail");
  };

  const currentMode = round?.mode ?? mode;
  const rows = round?.rows ?? (currentMode === "free" ? 5 : tuning.depthRows);
  const relics = [
    {
      name: "İlk Kırık",
      unlocked: profile.totalSafe >= 10,
      note: "10 güvenli mühür",
    },
    {
      name: "Bakır Nabız",
      unlocked: profile.totalSafe >= 50,
      note: "50 güvenli mühür",
    },
    {
      name: "Derin Göz",
      unlocked: profile.bestSafe >= 8,
      note: "Tek turda 8 güvenli",
    },
    {
      name: "Siyah Yıldız",
      unlocked: profile.bestMultiplier >= 20,
      note: "20× veya üstü",
    },
  ];

  return (
    <main
      className={`mines-room mode-${currentMode} ${busy ? "is-busy" : ""} ${round?.phase ?? "idle"}`}
    >
      <header className="mines-topbar">
        <button
          className="mines-back"
          onClick={() => {
            setTurbo(false);
            stopPresentation();
            onBackToWorld();
          }}
        >
          ← <span>Anlık Oyunlar</span>
        </button>
        <button
          className="mines-brand"
          onClick={() => {
            setTurbo(false);
            stopPresentation();
            onExit();
          }}
        >
          <i>OD</i>
          <span>
            OBSİDYEN DAMARI<small>YERALTI ARAŞTIRMA İSTASYONU</small>
          </span>
        </button>
        <div className="mines-top-actions">
          <GameMusicControls game="obsidyen-damari" />
          <button
            className={`mines-audio-toggle ${sfxEnabled ? "on" : ""}`}
            onClick={() => setSfxEnabled((value) => !value)}
            aria-label={
              sfxEnabled ? "Efekt seslerini kapat" : "Efekt seslerini aç"
            }
            aria-pressed={sfxEnabled}
          >
            <i>FX</i>
            <span>{sfxEnabled ? "EFEKT AÇIK" : "EFEKT KAPALI"}</span>
          </button>
          <button
            className={`mines-voice-toggle ${voiceEnabled ? "on" : ""}`}
            onClick={toggleVoice}
            aria-label={voiceEnabled ? "Ayla sesini kapat" : "Ayla sesini aç"}
            aria-pressed={voiceEnabled}
          >
            <i>AI</i>
            <span>{voiceEnabled ? "AYLA SESİ AÇIK" : "AYLA SESİ KAPALI"}</span>
          </button>
          <span className="mines-balance">
            ✦ {money.format(balance)} <small>PR</small>
          </span>
        </div>
      </header>

      <section className="mines-layout">
        <aside className="mines-ayla-panel">
          <div className="ayla-portrait">
            <img
              src="/assets/instant/obsidyen-damari/ayla-v1.png"
              alt="Jeolog Ayla"
            />
            <span>
              <small>KAZI LİDERİ</small>AYLA
            </span>
          </div>
          <div className="ayla-status">
            <i /> <span>{aiOnline ? "YEREL AI BAĞLI" : "OLAY KİŞİLİĞİ"}</span>
            <button onClick={toggleVoice} aria-pressed={voiceEnabled}>
              {voiceEnabled ? "SESİ AÇIK" : "SESİ KAPALI"}
            </button>
          </div>
          <div className="ayla-chat-log">
            {chat.slice(-6).map((message, index) => (
              <article
                key={`${message.at}-${index}`}
                className={message.speaker === "Sen" ? "you" : ""}
              >
                <b>{message.speaker}</b>
                <p>{message.text}</p>
              </article>
            ))}
            {thinking && (
              <article>
                <b>Ayla</b>
                <p>Bir saniye, kazı kaydına bakıyorum…</p>
              </article>
            )}
          </div>
          <form
            className="ayla-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendChat();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ayla'ya yaz…"
            />
            <button disabled={!draft.trim() || thinking}>↑</button>
          </form>
        </aside>

        <section className="mines-stage">
          <header className="mines-stage-head">
            <div>
              <small>
                {currentMode === "free" ? "SERBEST KAZI" : "DERİN HAT"}
              </small>
              <h1>{active ? riskLabel(round!) : "Sözleşmeni seç"}</h1>
            </div>
            <div className="mines-mode-tabs">
              <button
                className={mode === "free" ? "active" : ""}
                disabled={active || !game.features.freeDig}
                onClick={() => {
                  clearSettledBoard();
                  setMode("free");
                }}
              >
                5×5 SERBEST
              </button>
              <button
                className={mode === "depth" ? "active" : ""}
                disabled={active || !game.features.depthLine}
                onClick={() => {
                  clearSettledBoard();
                  setMode("depth");
                }}
              >
                12 KADEME
              </button>
            </div>
            <button
              className="mines-rules-button"
              onClick={() => setRulesOpen(true)}
            >
              NASIL OYNANIR?
            </button>
          </header>

          <div
            className={`mines-board-wrap ${openingIndex !== null ? "opening" : ""}`}
            style={{ "--depth-rows": rows } as CSSProperties}
          >
            <div className="mines-board-ambient">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div
              className={`mines-board ${currentMode}`}
              aria-label={
                currentMode === "free"
                  ? "25 mühürlü kazı tahtası"
                  : "12 kademeli derin hat"
              }
            >
              {boardIndices.map((index) => {
                const isMine = round?.mineIndices.includes(index) ?? false;
                const revealed = round?.revealed.includes(index) ?? false;
                const showMine = Boolean(
                  round && round.phase !== "active" && isMine,
                );
                const depthRow = Math.floor(index / 5);
                const passed =
                  currentMode === "depth" &&
                  round &&
                  depthRow < round.activeDepthRow &&
                  !revealed;
                const selectable = round ? canReveal(round, index) : false;
                const markedTile = marked.includes(index);
                return (
                  <button
                    key={index}
                    className={`mine-tile ${revealed ? (isMine ? "revealed mine" : "revealed safe") : ""} ${showMine && !revealed ? "mine ghost" : ""} ${openingIndex === index ? "opening" : ""} ${selectable ? "selectable" : ""} ${markedTile ? "marked" : ""} ${passed ? "passed" : ""}`}
                    disabled={!selectable || busy}
                    style={
                      {
                        "--tile-delay": `${(index % 5) * 26}ms`,
                      } as CSSProperties
                    }
                    onClick={() => {
                      if (busy) return;
                      skipPresentationRef.current = false;
                      stopAutoRef.current = false;
                      setBusy(true);
                      void reveal(index).finally(() => setBusy(false));
                    }}
                    onContextMenu={(event) => toggleMark(event, index)}
                    aria-label={`${depthRow + 1}. sıra ${(index % 5) + 1}. mühür${markedTile ? ", işaretli" : ""}`}
                  >
                    <span className="tile-shell">
                      <i className="seal-mark">◇</i>
                      <em>
                        {currentMode === "depth"
                          ? String(depthRow + 1).padStart(2, "0")
                          : String(index + 1).padStart(2, "0")}
                      </em>
                    </span>
                    {revealed && !isMine && (
                      <img
                        src="/assets/instant/obsidyen-damari/obsidyen-crystal-v1.png"
                        alt="Güvenli obsidyen kristali"
                      />
                    )}
                    {(revealed && isMine) || showMine ? (
                      <img
                        src="/assets/instant/obsidyen-damari/pressure-core-v1.png"
                        alt={revealed ? "Basınç çekirdeği" : ""}
                      />
                    ) : null}
                    {markedTile && !revealed && <b className="tile-flag">⌖</b>}
                  </button>
                );
              })}
            </div>
            {currentMode === "depth" && (
              <div className="depth-rail">
                <span>YÜZEY</span>
                <i />
                <b>
                  {active
                    ? `${Math.min((round?.activeDepthRow ?? 0) + 1, rows)} / ${rows}`
                    : `0 / ${rows}`}
                </b>
                <i />
                <span>DAMAR</span>
              </div>
            )}
          </div>

          <footer className="mines-stage-footer">
            <span>
              <i className={active ? "live" : ""} />{" "}
              {active
                ? `${round!.safeReveals} güvenli seçim · tahta kilitli`
                : settled
                  ? "Tur tamamlandı · seed açık"
                  : "Bahis ve risk ayarını seç"}
            </span>
            <button onClick={() => setFairOpen(true)}>SHA-256 DOĞRULA →</button>
          </footer>
        </section>

        <aside className="mines-data-rail">
          <section className="mines-odds-card">
            <header>
              <span>SONRAKİ MÜHÜR</span>
              <i>{active ? "CANLI" : "TAHMİN DEĞİL"}</i>
            </header>
            <strong>%{percent.format(safeChance * 100)}</strong>
            <small>GÜVENLİ OLMA İHTİMALİ</small>
            <div>
              <span>
                <small>ŞİMDİ AL</small>
                <b>
                  {round?.safeReveals
                    ? `${money.format(round.grossPayout)} PR`
                    : "—"}
                </b>
              </span>
              <span>
                <small>SONRAKİ GÜVENLİ</small>
                <b>{active ? `${money.format(upcomingPayout)} PR` : "—"}</b>
              </span>
            </div>
            <footer>
              <span>Güncel</span>
              <b>{round?.currentMultiplier.toFixed(4) ?? "1.0000"}×</b>
              <i>→</i>
              <span>Sonraki</span>
              <b>{active ? upcomingMultiplier.toFixed(4) : "—"}×</b>
            </footer>
          </section>

          <section className="mines-progress-card">
            <header>
              <span>KAZI SİCİLİ</span>
              <small>{profile.rounds} TUR</small>
            </header>
            <div className="progress-stats">
              <span>
                <b>{profile.totalSafe}</b>
                <small>GÜVENLİ</small>
              </span>
              <span>
                <b>{profile.bestSafe}</b>
                <small>EN DERİN</small>
              </span>
              <span>
                <b>{profile.bestMultiplier.toFixed(1)}×</b>
                <small>REKOR</small>
              </span>
            </div>
            <div className="relic-list">
              {relics.map((relic) => (
                <span
                  key={relic.name}
                  className={relic.unlocked ? "unlocked" : ""}
                  title={relic.note}
                >
                  <i>◆</i>
                  <b>{relic.name}</b>
                  <small>{relic.unlocked ? "BULUNDU" : relic.note}</small>
                </span>
              ))}
            </div>
          </section>

          <section className="mines-history-card">
            <header>
              <span>SON KAZILAR</span>
              <small>SQLITE</small>
            </header>
            <div>
              {recentRounds.slice(0, 6).map((record) => (
                <article key={record.id} className={record.outcome}>
                  <i>{record.outcome === "win" ? "◆" : "×"}</i>
                  <span>
                    <b>
                      {String(record.variant)
                        .replace("Serbest Kazı · ", "")
                        .replace("Derin Hat · ", "")}
                    </b>
                    <small>
                      {Number(record.result.safeReveals ?? 0)} güvenli ·{" "}
                      {Number(record.result.currentMultiplier ?? 0).toFixed(2)}×
                    </small>
                  </span>
                  <strong>
                    {money.format(record.grossPayout)}
                    <small>PR</small>
                  </strong>
                </article>
              ))}
              {!recentRounds.length && (
                <p>İlk tur burada bütün ayrıntısıyla görünecek.</p>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="mines-control-dock">
        <div className="mines-bet-control">
          <small>
            {active
              ? "SONRAKİ TUR BAHİSİ · MEVCUT TUR DEĞİŞMEZ"
              : "BAHİS · TAVAN YALNIZ BAKİYE"}
          </small>
          <button onClick={() => changeBet(-1)}>−</button>
          <label>
            <input
              type="number"
              min={game.minBet}
              max={balance}
              value={bet}
              onChange={(event) =>
                setBet(
                  normalizeWagerInput(Number(event.target.value), game.minBet),
                )
              }
            />
            <em>PR</em>
          </label>
          <button onClick={() => changeBet(1)}>+</button>
          <div className="mines-quick-bets">
            {QUICK_BETS.filter((value) => value <= Math.max(balance, 1_000))
              .slice(-7)
              .map((value) => (
                <button key={value} onClick={() => setBet(value)}>
                  {compactWager(value)}
                </button>
              ))}
            <button onClick={() => setBet(Math.max(game.minBet, balance))}>
              MAX
            </button>
          </div>
        </div>
        <div className="mines-risk-control">
          {mode === "free" ? (
            <>
              <small>BASINÇ ÇEKİRDEĞİ</small>
              <div>
                {[1, 3, 5, 8, 12, 18, 24]
                  .filter((value) => value <= tuning.maxMines)
                  .map((value) => (
                    <button
                      key={value}
                      className={mineCount === value ? "active" : ""}
                      disabled={active}
                      onClick={() => {
                        clearSettledBoard();
                        setMineCount(value);
                      }}
                    >
                      {value}
                    </button>
                  ))}
              </div>
              <input
                aria-label="Basınç çekirdeği sayısı"
                type="range"
                min="1"
                max={tuning.maxMines}
                value={mineCount}
                disabled={active}
                onChange={(event) => {
                  clearSettledBoard();
                  setMineCount(Number(event.target.value));
                }}
              />
            </>
          ) : (
            <>
              <small>DERİN HAT SÖZLEŞMESİ</small>
              <div>
                {(["temkinli", "keskin", "ucurum"] as DepthRisk[]).map(
                  (risk) => (
                    <button
                      key={risk}
                      className={depthRisk === risk ? "active" : ""}
                      disabled={active}
                      onClick={() => {
                        clearSettledBoard();
                        setDepthRisk(risk);
                      }}
                    >
                      <b>
                        {risk === "temkinli"
                          ? "TEMKİNLİ"
                          : risk === "keskin"
                            ? "KESKİN"
                            : "UÇURUM"}
                      </b>
                      <em>{DEPTH_HAZARDS[risk]}/5 tehlike</em>
                    </button>
                  ),
                )}
              </div>
            </>
          )}
        </div>
        <div className="mines-auto-control">
          <small>HIZ & OTO KAZI</small>
          <label>
            <input
              type="checkbox"
              checked={turbo}
              onChange={(event) => setTurbo(event.target.checked)}
            />{" "}
            TURBO
          </label>
          {game.features.autoPick && (
            <>
              <select
                value={autoTarget}
                onChange={(event) => setAutoTarget(Number(event.target.value))}
              >
                <option value="1">1 güvenli sonra al</option>
                <option value="3">3 güvenli sonra al</option>
                <option value="5">5 güvenli sonra al</option>
                <option value="8">8 güvenli sonra al</option>
              </select>
              {busy ? (
                <button className="is-stop" onClick={stopPresentation}>
                  DUR
                </button>
              ) : (
                <button
                  disabled={!active || (round?.safeReveals ?? 0) >= autoTarget}
                  onClick={() => void autoDig()}
                >
                  OTOMATİK KAZ
                </button>
              )}
            </>
          )}
        </div>
        <div className="mines-primary-control">
          {!active ? (
            <button
              className="start"
              disabled={busy || bet > balance}
              onClick={() => void startRound()}
            >
              <small>{settled ? "YENİ TUR" : "TAHTAYI KİLİTLE"}</small>
              <strong>{money.format(bet)} PR KAZIYI BAŞLAT</strong>
            </button>
          ) : round.safeReveals > 0 ? (
            <button
              className="cash"
              disabled={busy}
              onClick={() => void cashOut()}
            >
              <small>KAZANCI AL · C</small>
              <strong>{money.format(round.grossPayout)} PR</strong>
            </button>
          ) : (
            <button className="waiting" disabled>
              <small>İLK SEÇİMİNİ YAP</small>
              <strong>%{percent.format(safeChance * 100)} GÜVENLİ</strong>
            </button>
          )}
        </div>
        <div className="mines-volume-control">
          <small>EFEKT</small>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(sfxVolume * 100)}
            disabled={!sfxEnabled}
            onChange={(event) => setSfxVolume(Number(event.target.value) / 100)}
          />
          <b>%{Math.round(sfxVolume * 100)}</b>
        </div>
      </section>

      {settled && !resultDismissed && (
        <div className="mines-modal-backdrop result">
          <section className={`mines-result-modal ${round.phase}`}>
            <button
              className="modal-close"
              onClick={() => setResultDismissed(true)}
            >
              ×
            </button>
            <small>
              {round.mode === "free"
                ? "SERBEST KAZI RAPORU"
                : "DERİN HAT RAPORU"}
            </small>
            <h2>{resultTitle(round)}</h2>
            <div className="result-core">
              <img
                src={
                  round.phase === "lost"
                    ? "/assets/instant/obsidyen-damari/pressure-core-v1.png"
                    : "/assets/instant/obsidyen-damari/obsidyen-crystal-v1.png"
                }
                alt=""
              />
              <strong>
                {money.format(round.phase === "lost" ? 0 : round.grossPayout)}{" "}
                <em>PR</em>
              </strong>
              <span>BRÜT ÖDEME · {round.currentMultiplier.toFixed(4)}×</span>
            </div>
            <dl>
              <div>
                <dt>Bahis</dt>
                <dd>{money.format(round.stake)} PR</dd>
              </div>
              <div>
                <dt>Güvenli mühür</dt>
                <dd>{round.safeReveals}</dd>
              </div>
              <div>
                <dt>Sonuç</dt>
                <dd>
                  {round.phase === "lost"
                    ? `−${money.format(round.stake)} PR`
                    : `${roundMoney(round.grossPayout - round.stake) >= 0 ? "+" : "−"}${money.format(Math.abs(roundMoney(round.grossPayout - round.stake)))} PR net`}
                </dd>
              </div>
            </dl>
            <p>
              {round.phase === "lost"
                ? "Tehlike dağılımı tahtada açıldı. Sonucu doğrulamak için seed artık görünür."
                : "Ödeme bakiyene eklendi; açılmayan çekirdekler tahtada gösterildi."}
            </p>
            <footer>
              <button
                onClick={() => {
                  setResultDismissed(true);
                  setRound(null);
                  roundRef.current = null;
                }}
              >
                AYARLARI DEĞİŞTİR
              </button>
              <button
                className="primary"
                disabled={bet > balance}
                onClick={startSame}
              >
                AYNI AYARLA YENİ TUR →
              </button>
            </footer>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div
          className="mines-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRulesOpen(false);
          }}
        >
          <section className="mines-info-modal">
            <button className="modal-close" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>OBSİDYEN DAMARI · KURALLAR</small>
            <h2>Bir mühür daha mı, kasaya dönüş mü?</h2>
            <div className="rules-grid">
              <article>
                <b>01</b>
                <h3>Serbest Kazı</h3>
                <p>
                  25 mühürde 1–24 çekirdek seç. Güvenli kristaller çarpanı
                  büyütür; istediğin kareyi açabilir ve ilk güvenliden sonra
                  ödeme alabilirsin.
                </p>
              </article>
              <article>
                <b>02</b>
                <h3>Derin Hat</h3>
                <p>
                  Her kademede beş mühürden birini seç. Temkinli, Keskin ve
                  Uçurum sözleşmeleri sıradaki tehlike sayısını değiştirir.
                </p>
              </article>
              <article>
                <b>03</b>
                <h3>Brüt ödeme</h3>
                <p>
                  Büyük sayı bakiyene girecek toplam tutardır. Bahis ve net
                  sonuç tur raporunda ayrı gösterilir.
                </p>
              </article>
              <article>
                <b>04</b>
                <h3>Tahta sabittir</h3>
                <p>
                  Tehlike yerleri ilk seçimden önce HMAC-SHA256 ile kilitlenir.
                  Tur sonunda server seed açıklanır ve aynı tahta yeniden
                  üretilebilir.
                </p>
              </article>
            </div>
            <p className="formula">
              Çarpan = RTP × C(25,k) ÷ C(25−m,k) · Hedef RTP %{game.targetRtp}
            </p>
          </section>
        </div>
      )}

      {fairOpen && (
        <div
          className="mines-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFairOpen(false);
          }}
        >
          <section className="mines-info-modal fair">
            <button className="modal-close" onClick={() => setFairOpen(false)}>
              ×
            </button>
            <small>HMAC-SHA256 · PROVABLY FAIR</small>
            <h2>Tahta seçimden önce kilitlendi.</h2>
            {round ? (
              <dl>
                <div>
                  <dt>Tur</dt>
                  <dd>{round.roundId}</dd>
                </div>
                <div>
                  <dt>Algoritma</dt>
                  <dd>{round.algorithm}</dd>
                </div>
                <div>
                  <dt>Taahhüt</dt>
                  <dd>{round.commitment}</dd>
                </div>
                <div>
                  <dt>Client seed</dt>
                  <dd>{round.clientSeed}</dd>
                </div>
                <div>
                  <dt>Nonce</dt>
                  <dd>{round.nonce}</dd>
                </div>
                <div>
                  <dt>Server seed</dt>
                  <dd>
                    {round.phase === "active"
                      ? "Tur bitince açıklanacak"
                      : round.serverSeed}
                  </dd>
                </div>
                <div>
                  <dt>Digest</dt>
                  <dd>
                    {round.phase === "active"
                      ? "Tur bitince açıklanacak"
                      : round.digest}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>Henüz doğrulanacak tur yok.</p>
            )}
            <footer>
              {round && round.phase !== "active" && (
                <button
                  onClick={() => void verify()}
                  disabled={verifyState === "checking"}
                >
                  {verifyState === "checking"
                    ? "KONTROL EDİLİYOR…"
                    : verifyState === "ok"
                      ? "✓ TAHTA DOĞRULANDI"
                      : verifyState === "fail"
                        ? "× UYUŞMAZLIK VAR"
                        : "TAHTAYI YENİDEN ÜRET"}
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
