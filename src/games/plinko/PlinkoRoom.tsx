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
import GameMusicControls from "../../audio/GameMusicControls";
import { useAuth } from "../../auth/auth-client";
import { useGameAudioPreference } from "../../audio/useGameAudioPreference";
import { gameSfxLevel } from "../../audio/user-sfx-preferences";
import {
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
  CASINO_CHIP_VALUES,
  compactWager,
  normalizeWagerInput,
} from "../wagering";
import {
  PLINKO_RISKS,
  createFairPlinkoRound,
  plinkoMultipliers,
  verifyPlinkoRound,
  type FairPlinkoRound,
  type PlinkoRisk,
} from "./plinko-engine";
import "./plinko.css";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  onBackToWorld: () => void;
};
type VisualBall = {
  round: FairPlinkoRound;
  launchedAt: number;
  duration: number;
  colour: string;
  balanceBefore: number;
  balanceAfterStake: number;
};
type HistoryItem = {
  id: string;
  multiplier: number;
  payout: number;
  net: number;
  bucket: number;
  risk: PlinkoRisk;
  rows: number;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const NONCE_KEY = "pehlevan-plinko-nonce-v1";
const CLIENT_SEED_KEY = "pehlevan-plinko-client-seed-v1";
const BALL_COLOURS = ["#ffe19a", "#77e8d1", "#f39aaa", "#a9bcff", "#fff5d5"];

const accountKey = (userId: string, key: string) => `account:${userId}:${key}`;

function clientSeed(userId: string) {
  const key = accountKey(userId, CLIENT_SEED_KEY);
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const seed = `muharrem-${crypto.randomUUID()}`;
  localStorage.setItem(key, seed);
  return seed;
}

function multiplierLabel(value: number) {
  if (value >= 100) return `${Math.round(value)}×`;
  if (value >= 10) return `${value.toFixed(1)}×`;
  return `${value.toFixed(2)}×`;
}

function playDropTrack(
  round: FairPlinkoRound,
  duration: number,
  enabled: boolean,
  contexts: Set<AudioContext>,
) {
  if (!enabled) return;
  const sfxLevel=gameSfxLevel("plinko",1);if(sfxLevel<=0)return;
  const context = new AudioContext();
  contexts.add(context);
  const now = context.currentTime;
  round.directions.forEach((direction, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = now + (duration / 1000) * 0.78 * ((index + 0.65) / round.rows);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(310 + index * 13 + direction * 18, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.035*sfxLevel, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.085);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.1);
  });
  window.setTimeout(() => {
    contexts.delete(context);
    if(context.state!=="closed")void context.close();
  }, duration + 500);
}

function playResultTone(multiplier: number, enabled: boolean, contexts:Set<AudioContext>) {
  if (!enabled) return;
  const sfxLevel=gameSfxLevel("plinko",1);if(sfxLevel<=0)return;
  const context = new AudioContext();
  contexts.add(context);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.06*sfxLevel, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
  gain.connect(context.destination);
  (multiplier >= 1
    ? [392, 523, multiplier >= 10 ? 784 : 659]
    : [220, 185]
  ).forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = multiplier >= 10 ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.08);
    oscillator.stop(context.currentTime + 0.5);
  });
  window.setTimeout(() => {
    contexts.delete(context);
    if(context.state!=="closed")void context.close();
  }, 700);
}

export default function PlinkoRoom({
  balance,
  setBalance,
  onExit,
  onBackToWorld,
}: Props) {
  const { user } = useAuth();
  const admin = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const game = admin.games.plinko;
  const tuning = game.plinko!;
  const [bet, setBet] = useState(game.defaultBet);
  const [risk, setRisk] = useState<PlinkoRisk>("orta");
  const [rows, setRows] = useState(tuning.defaultRows);
  const [balls, setBalls] = useState<VisualBall[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hits, setHits] = useState<number[]>(() =>
    Array(tuning.defaultRows + 1).fill(0),
  );
  const [autoCount, setAutoCount] = useState(10);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [sfxEnabled, setSfxEnabled] = useGameAudioPreference(
    "plinko",
    "effects",
    true,
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fairOpen, setFairOpen] = useState(false);
  const [lastRound, setLastRound] = useState<FairPlinkoRound>();
  const [verifyState, setVerifyState] = useState<
    "idle" | "checking" | "ok" | "fail"
  >("idle");
  const [theatre, setTheatre] = useState<FairPlinkoRound>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextsRef=useRef(new Set<AudioContext>());
  const balanceRef = useRef(balance);
  const pendingRef = useRef(0);
  const dropRef = useRef<(auto?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const nonceRef = useRef(
    Number(localStorage.getItem(accountKey(user.id, NONCE_KEY)) ?? "0"),
  );
  // Board geometry stays fixed while a ball is visible, but the next ball's
  // stake remains editable throughout the current animation.
  const boardSettingsLocked =
    balls.length > 0 || pendingRef.current > 0 || autoRemaining > 0;
  const multipliers = useMemo(
    () => plinkoMultipliers(rows, risk, game.targetRtp, tuning.maxPayoutX),
    [rows, risk, game.targetRtp, tuning.maxPayoutX],
  );
  const sessionStake = history.reduce(
    (sum, item) => sum + (item.payout - item.net),
    0,
  );
  const sessionPayout = history.reduce((sum, item) => sum + item.payout, 0);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(()=>()=>{
    audioContextsRef.current.forEach((context)=>{if(context.state!=="closed")void context.close()});
    audioContextsRef.current.clear();
  },[]);
  useEffect(() => {
    setHits(Array(rows + 1).fill(0));
  }, [rows]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(320, rect.width),
        height = Math.max(360, rect.height);
      if (
        canvas.width !== Math.round(width * dpr) ||
        canvas.height !== Math.round(height * dpr)
      ) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const context = canvas.getContext("2d")!;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const top = 28;
      const bucketLeft = width * 0.02;
      const bucketAreaWidth = width * 0.96;
      const bucketWidth = bucketAreaWidth / (rows + 1);
      const bucketTop = height - 48;
      // Peg endpoints and CSS bucket centres use the same geometry. The ball's
      // last horizontal position therefore lands in the exact selected pocket.
      const gapX = bucketWidth;
      const pegBottom = bucketTop - Math.max(15, Math.min(24, height * 0.035));
      const gapY = (pegBottom - top) / Math.max(1, rows - 1);
      const pegRadius = Math.max(2.5, Math.min(5.2, gapX * 0.12));

      const glow = context.createRadialGradient(
        width / 2,
        height * 0.48,
        20,
        width / 2,
        height * 0.48,
        width * 0.6,
      );
      glow.addColorStop(0, "rgba(20,110,82,.16)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      context.lineWidth = 1;
      for (let row = 0; row < rows; row += 1) {
        for (let peg = 0; peg <= row; peg += 1) {
          const x = width / 2 + (peg - row / 2) * gapX;
          const y = top + row * gapY;
          context.beginPath();
          context.arc(x, y, pegRadius + 3, 0, Math.PI * 2);
          context.fillStyle = "rgba(224,178,88,.08)";
          context.fill();
          context.beginPath();
          context.arc(x, y, pegRadius, 0, Math.PI * 2);
          const metal = context.createRadialGradient(
            x - pegRadius / 2,
            y - pegRadius / 2,
            0,
            x,
            y,
            pegRadius,
          );
          metal.addColorStop(0, "#fff2bc");
          metal.addColorStop(0.45, "#c99945");
          metal.addColorStop(1, "#4b2c10");
          context.fillStyle = metal;
          context.fill();
          context.strokeStyle = "rgba(255,229,158,.36)";
          context.stroke();
        }
      }
      balls.forEach((ball) => {
        const progress = Math.min(
          1,
          Math.max(0, (time - ball.launchedAt) / ball.duration),
        );
        // The final 22% is a visible pocket-entry phase. A short hold at the
        // end prevents the ball from vanishing at the bottom of the peg field.
        const pegProgress = Math.min(1, progress / 0.78);
        const stepFloat = pegProgress * ball.round.rows;
        const step = Math.min(ball.round.rows - 1, Math.floor(stepFloat));
        const local = pegProgress >= 1 ? 1 : stepFloat - Math.floor(stepFloat);
        const rightsBefore = ball.round.directions
          .slice(0, step)
          .filter((value) => value === 1).length;
        const x0 = width / 2 + (rightsBefore - step / 2) * gapX;
        const direction = ball.round.directions[step] ?? 1;
        const x1 = x0 + (direction * gapX) / 2;
        const eased = local * local * (3 - 2 * local);
        const pathX = x0 + (x1 - x0) * eased;
        const pathY =
          top -
          gapY * 0.72 +
          Math.min(ball.round.rows, stepFloat) * gapY -
          Math.sin(local * Math.PI) * Math.min(11, gapY * 0.22);
        const pocketX = bucketLeft + (ball.round.bucket + 0.5) * bucketWidth;
        const pocketY = bucketTop + 23;
        const landingRaw = Math.min(1, Math.max(0, (progress - 0.78) / 0.12));
        const landing = landingRaw * landingRaw * (3 - 2 * landingRaw);
        const x = pathX + (pocketX - pathX) * landing;
        const y = pathY + (pocketY - pathY) * landing;
        const radius = Math.max(5, Math.min(10, gapX * 0.22));
        // A radial aura replaces the old thick line whose flat cap looked like
        // a small rectangle behind the ball.
        context.save();
        context.globalAlpha = 0.24 * (1 - landingRaw * 0.35);
        const aura = context.createRadialGradient(
          x,
          y,
          radius * 0.25,
          x,
          y,
          radius * 2.7,
        );
        aura.addColorStop(0, ball.colour);
        aura.addColorStop(1, "rgba(0,0,0,0)");
        context.beginPath();
        context.arc(x, y, radius * 2.7, 0, Math.PI * 2);
        context.fillStyle = aura;
        context.fill();
        context.restore();
        context.shadowColor = ball.colour;
        context.shadowBlur = 18;
        const sphere = context.createRadialGradient(
          x - radius * 0.35,
          y - radius * 0.4,
          1,
          x,
          y,
          radius,
        );
        sphere.addColorStop(0, "#fffdf2");
        sphere.addColorStop(0.25, ball.colour);
        sphere.addColorStop(1, "#5d310e");
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = sphere;
        context.fill();
        context.shadowBlur = 0;
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [balls, rows]);

  const settleBall = (
    round: FairPlinkoRound,
    launchBalanceBefore: number,
    balanceAfterStake: number,
  ) => {
    const before = balanceRef.current;
    const after = before + round.grossPayout;
    balanceRef.current = after;
    setBalance(current => current + round.grossPayout);
    setBalls((items) =>
      items.filter((item) => item.round.roundId !== round.roundId),
    );
    setHits((items) =>
      items.map((value, index) => (index === round.bucket ? value + 1 : value)),
    );
    setHistory((items) =>
      [
        {
          id: round.roundId,
          multiplier: round.multiplier,
          payout: round.grossPayout,
          net: round.net,
          bucket: round.bucket,
          risk: round.risk,
          rows: round.rows,
        },
        ...items,
      ].slice(0, 30),
    );
    setLastRound(round);
    setVerifyState("idle");
    if (round.multiplier >= 10) {
      setTheatre(round);
      window.setTimeout(
        () =>
          setTheatre((current) =>
            current?.roundId === round.roundId ? undefined : current,
          ),
        3200,
      );
    }
    playResultTone(
      round.multiplier,
      sfxEnabled && game.sound && admin.general.masterSound,
      audioContextsRef.current,
    );
    void recordWalletEntry({
      id: createRecordId("wallet-plinko-payout", round.roundId),
      roundId: round.roundId,
      game: "plinko",
      occurredAt: round.settledAt,
      type: "payout",
      amount: round.grossPayout,
      balanceBefore: before,
      balanceAfter: after,
      note: `Plinko ${round.rows} sıra · ${round.multiplier.toFixed(4)}× brüt ödeme`,
    });
    void recordGameRound({
      id: createRecordId("round-plinko", round.roundId),
      roundId: round.roundId,
      game: "plinko",
      variant: `${PLINKO_RISKS[round.risk].label} · ${round.rows} sıra`,
      source: "player",
      playerParticipated: true,
      startedAt: round.startedAt,
      settledAt: round.settledAt,
      stake: round.stake,
      grossPayout: round.grossPayout,
      net: round.net,
      outcome: round.net > 0 ? "win" : round.net < 0 ? "loss" : "push",
      balanceBefore: launchBalanceBefore,
      balanceAfter: after,
      result: {
        telemetryVersion: 1,
        bucket: round.bucket,
        directions: round.directions,
        multiplier: round.multiplier,
        multipliers: round.multipliers,
        rows: round.rows,
        risk: round.risk,
        rtp: round.rtp,
        algorithm: round.algorithm,
        digest: round.digest,
        commitment: round.commitment,
        serverSeed: round.serverSeed,
        clientSeed: round.clientSeed,
        nonce: round.nonce,
        profileName: round.profileName,
      },
      modifiers: {
        balanceAfterStake,
        concurrentBalls: balls.length,
        animationMs: tuning.animationMs,
      },
    });
    void recordGameEvent({
      id: createRecordId("event-plinko-landed", round.roundId),
      roundId: round.roundId,
      game: "plinko",
      occurredAt: round.settledAt,
      type: "plinko-ball-landed",
      payload: {
        bucket: round.bucket,
        multiplier: round.multiplier,
        payout: round.grossPayout,
        net: round.net,
        rows: round.rows,
        risk: round.risk,
      },
    });
  };

  const dropBall = async (fromAuto = false) => {
    if (pendingRef.current || balls.length >= tuning.maxConcurrentBalls) return;
    const stake = Math.min(balanceRef.current, Math.max(game.minBet, bet));
    if (stake < game.minBet || balanceRef.current < stake) {
      setAutoRemaining(0);
      return;
    }
    pendingRef.current += 1;
    const nonce = nonceRef.current + 1;
    nonceRef.current = nonce;
    localStorage.setItem(accountKey(user.id, NONCE_KEY), String(nonce));
    try {
      const round = await createFairPlinkoRound({
        stake,
        rtp: game.targetRtp,
        risk,
        rows,
        maxPayoutX: tuning.maxPayoutX,
        clientSeed: clientSeed(user.id),
        nonce,
        profileName: tuning.profileName,
      });
      const before = balanceRef.current,
        after = before - stake;
      balanceRef.current = after;
      setBalance(current => current - stake);
      const duration = Math.max(1_200, tuning.animationMs + rows * 24);
      // The round is settled when the ball reaches its pocket, not when its
      // cryptographic outcome is committed. Keeping these timestamps distinct
      // makes replay and latency analysis in SQLite truthful.
      round.settledAt = new Date(Date.now() + duration).toISOString();
      setBalls((items) => [
        ...items,
        {
          round,
          launchedAt: performance.now(),
          duration,
          colour: BALL_COLOURS[nonce % BALL_COLOURS.length],
          balanceBefore: before,
          balanceAfterStake: after,
        },
      ]);
      playDropTrack(
        round,
        duration,
        sfxEnabled && game.sound && admin.general.masterSound,
        audioContextsRef.current,
      );
      void recordWalletEntry({
        id: createRecordId("wallet-plinko-stake", round.roundId),
        roundId: round.roundId,
        game: "plinko",
        occurredAt: round.startedAt,
        type: "stake",
        amount: -stake,
        balanceBefore: before,
        balanceAfter: after,
        note: `Plinko ${PLINKO_RISKS[risk].label} · ${rows} sıra bahis`,
      });
      void recordGameEvent({
        id: createRecordId("event-plinko-commit", round.roundId),
        roundId: round.roundId,
        game: "plinko",
        occurredAt: round.startedAt,
        type: "plinko-round-committed",
        payload: {
          commitment: round.commitment,
          clientSeed: round.clientSeed,
          nonce,
          rows,
          risk,
          stake,
          rtp: round.rtp,
          algorithm: round.algorithm,
        },
      });
      window.setTimeout(() => settleBall(round, before, after), duration);
      if (fromAuto) setAutoRemaining((value) => Math.max(0, value - 1));
    } finally {
      pendingRef.current -= 1;
    }
  };
  dropRef.current = dropBall;

  useEffect(() => {
    if (
      !autoRemaining ||
      balls.length >= tuning.maxConcurrentBalls ||
      balance < bet
    )
      return;
    const timer = window.setTimeout(() => void dropRef.current(true), 420);
    return () => window.clearTimeout(timer);
  }, [autoRemaining, balls.length, balance, bet, tuning.maxConcurrentBalls]);

  const maxHit = Math.max(1, ...hits);
  const quickBets = CASINO_CHIP_VALUES.filter(
    (value) => value <= Math.max(balance, 1_000),
  ).slice(-7);

  return (
    <main className="plinko-room">
      <header className="plinko-top">
        <button onClick={onBackToWorld}>
          ← <span>Anlık Oyunlar</span>
        </button>
        <div className="plinko-brand">
          <i>●</i>
          <span>
            PİRİNÇ GALERİ<small>PLINKO · HMAC DOĞRULAMALI</small>
          </span>
        </div>
        <div className="plinko-top-actions">
          <GameMusicControls game="plinko" />
          <button
            aria-label={
              sfxEnabled ? "Plinko efektlerini kapat" : "Plinko efektlerini aç"
            }
            className={`plinko-sfx ${sfxEnabled ? "on" : ""}`}
            onClick={() => setSfxEnabled((value) => !value)}
          >
            ♪ <span>{sfxEnabled ? "EFEKT" : "KAPALI"}</span>
          </button>
          <strong>
            ✦ {money.format(balance)} <small>PR</small>
          </strong>
          <button className="close-room" onClick={onExit}>
            ×
          </button>
        </div>
      </header>
      <section className="plinko-layout">
        <aside className="plinko-controls">
          <div className="plinko-control-title">
            <small>TOP AYARLARI</small>
            <h2>Riskini kur.</h2>
            <p>
              Tahta sonucu değil, yolculuğu gösterir. Kenara gittikçe çarpan
              büyür.
            </p>
          </div>
          <section>
            <small>RİSK PROFİLİ</small>
            <div className="plinko-segment">
              {(Object.keys(PLINKO_RISKS) as PlinkoRisk[]).map((value) => (
                <button
                  key={value}
                  className={risk === value ? "active" : ""}
                  disabled={boardSettingsLocked}
                  onClick={() => setRisk(value)}
                >
                  {PLINKO_RISKS[value].label}
                  <i>
                    {value === "dusuk"
                      ? "DENGELİ"
                      : value === "orta"
                        ? "KESKİN"
                        : "UÇLAR"}
                  </i>
                </button>
              ))}
            </div>
          </section>
          <section>
            <small>SIRA SAYISI</small>
            <div className="plinko-row-control">
              <button
                disabled={boardSettingsLocked || rows <= tuning.minRows}
                onClick={() => setRows((value) => value - 1)}
              >
                −
              </button>
              <strong>
                {rows}
                <i>SIRA · {rows + 1} GÖZ</i>
              </strong>
              <button
                disabled={boardSettingsLocked || rows >= tuning.maxRows}
                onClick={() => setRows((value) => value + 1)}
              >
                +
              </button>
            </div>
            <input
              aria-label="Plinko sıra sayısı"
              type="range"
              min={tuning.minRows}
              max={tuning.maxRows}
              value={rows}
              disabled={boardSettingsLocked}
              onChange={(event) => setRows(Number(event.target.value))}
            />
          </section>
          <section className="plinko-bet">
            <small>
              {balls.length
                ? "SONRAKİ TOPUN BAHİSİ"
                : "BAHİS · TAVAN YALNIZ BAKİYE"}
            </small>
            <div>
              <button
                onClick={() =>
                  setBet(
                    Math.max(
                      game.minBet,
                      bet - Math.max(5, Math.round(bet * 0.1)),
                    ),
                  )
                }
              >
                −
              </button>
              <label>
                <input
                  aria-label="Plinko bahis miktarı"
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
                <i>PR</i>
              </label>
              <button
                onClick={() =>
                  setBet(
                    Math.min(balance, bet + Math.max(5, Math.round(bet * 0.1))),
                  )
                }
              >
                +
              </button>
              <button
                disabled={balance < game.minBet}
                onClick={() => setBet(balance)}
              >
                MAX
              </button>
            </div>
            <nav>
              {quickBets.map((value) => (
                <button key={value} onClick={() => setBet(value)}>
                  {compactWager(value)}
                </button>
              ))}
            </nav>
          </section>
          <div className="plinko-primary-row">
            <button
              className="plinko-drop"
              disabled={
                balance < bet || balls.length >= tuning.maxConcurrentBalls
              }
              onClick={() => void dropBall(false)}
            >
              <small>
                {balls.length
                  ? `${balls.length}/${tuning.maxConcurrentBalls} TOP SAHNEDE`
                  : "PİRİNÇ KANALI AÇ"}
              </small>
              <strong>TOPU BIRAK</strong>
              <b>{money.format(bet)} PR</b>
            </button>
            <label>
              <select
                value={autoCount}
                onChange={(event) => setAutoCount(Number(event.target.value))}
              >
                <option value="5">5 TOP</option>
                <option value="10">10 TOP</option>
                <option value="25">25 TOP</option>
                <option value="50">50 TOP</option>
              </select>
              <button
                className={autoRemaining ? "active" : ""}
                disabled={!game.autoplay || (!autoRemaining && balance < bet)}
                onClick={() =>
                  setAutoRemaining((value) => (value ? 0 : autoCount))
                }
              >
                {autoRemaining ? `DUR · ${autoRemaining}` : "OTO DROP"}
              </button>
            </label>
          </div>
          <footer>
            <button onClick={() => setRulesOpen(true)}>ⓘ KURALLAR</button>
            <button onClick={() => setFairOpen(true)}>✓ DOĞRULA</button>
          </footer>
        </aside>

        <section className="plinko-board-shell">
          <div className="plinko-board-heading">
            <span>
              <small>AKTİF PROFİL</small>
              <b>
                {PLINKO_RISKS[risk].label.toUpperCase()} · {rows} SIRA
              </b>
            </span>
            <strong>HEDEF RTP %{game.targetRtp.toFixed(1)}</strong>
            <span>
              <small>SAHNEDE</small>
              <b>{balls.length} TOP</b>
            </span>
          </div>
          <div className="plinko-board">
            <canvas ref={canvasRef} />
            <div className="plinko-entry">
              <i />
              <span>DROP</span>
            </div>
            <div
              className="plinko-buckets"
              style={{ gridTemplateColumns: `repeat(${rows + 1},1fr)` }}
            >
              {multipliers.map((value, index) => (
                <div
                  key={index}
                  className={lastRound?.bucket === index ? "last" : ""}
                  style={{ "--heat": hits[index] / maxHit } as CSSProperties}
                >
                  <b>{multiplierLabel(value)}</b>
                  <i>{hits[index] || ""}</i>
                </div>
              ))}
            </div>
          </div>
          <div className="plinko-live-result">
            {lastRound ? (
              <>
                <span className={lastRound.net >= 0 ? "win" : ""}>
                  {multiplierLabel(lastRound.multiplier)}
                </span>
                <div>
                  <small>SON TOPUN BRÜT ÖDEMESİ</small>
                  <strong>{money.format(lastRound.grossPayout)} PR</strong>
                  <em>
                    {lastRound.rows} sıra · {PLINKO_RISKS[lastRound.risk].label}{" "}
                    · {lastRound.bucket + 1}. göz
                  </em>
                </div>
              </>
            ) : (
              <>
                <span>—</span>
                <div>
                  <small>TAHTA HAZIR</small>
                  <strong>İlk topu bırak.</strong>
                  <em>Çarpan, bahis dâhil brüt ödemeyi belirler.</em>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="plinko-stats">
          <header>
            <small>GALERİ KAYDI</small>
            <strong>{history.length} TOP</strong>
          </header>
          <div className="plinko-session">
            <span>
              <small>TOPLAM BAHİS</small>
              <b>{money.format(sessionStake)} PR</b>
            </span>
            <span>
              <small>BRÜT ÖDEME</small>
              <b>{money.format(sessionPayout)} PR</b>
            </span>
            <span>
              <small>OTURUM NETİ</small>
              <b className={sessionPayout - sessionStake >= 0 ? "win" : ""}>
                {sessionPayout - sessionStake >= 0 ? "+" : "−"}
                {money.format(Math.abs(sessionPayout - sessionStake))} PR
              </b>
            </span>
          </div>
          <div className="plinko-history">
            {history.length ? (
              history.map((item) => (
                <article key={item.id}>
                  <i className={item.net >= 0 ? "win" : ""}>
                    {multiplierLabel(item.multiplier)}
                  </i>
                  <span>
                    <b>
                      {PLINKO_RISKS[item.risk].label} · {item.rows} sıra
                    </b>
                    <small>
                      {item.bucket + 1}. göz · {money.format(item.payout)} PR
                      brüt
                    </small>
                  </span>
                  <strong className={item.net >= 0 ? "win" : ""}>
                    {item.net >= 0 ? "+" : "−"}
                    {money.format(Math.abs(item.net))}
                  </strong>
                </article>
              ))
            ) : (
              <p>Henüz top düşmedi.</p>
            )}
          </div>
        </aside>
      </section>

      {theatre && (
        <div
          className={`plinko-theatre ${theatre.multiplier >= 100 ? "legendary" : ""}`}
        >
          <button onClick={() => setTheatre(undefined)}>×</button>
          <small>
            {theatre.multiplier >= 100 ? "GALERİYİ DELDİN" : "BÜYÜK SEKME"}
          </small>
          <strong>{multiplierLabel(theatre.multiplier)}</strong>
          <b>{money.format(theatre.grossPayout)} PR BRÜT ÖDEME</b>
          <p>Top {theatre.bucket + 1}. göze oturdu.</p>
        </div>
      )}
      {rulesOpen && (
        <div className="plinko-modal-backdrop">
          <section className="plinko-modal">
            <button className="modal-x" onClick={() => setRulesOpen(false)}>
              ×
            </button>
            <small>PİRİNÇ GALERİ KURALLARI</small>
            <h2>Top nereye düşerse bahis o çarpanla ödenir.</h2>
            <ol>
              <li>8–16 sıra seçilir; her peg’de sağ/sol olasılığı eşittir.</li>
              <li>
                Düşük risk merkezde daha yumuşak, yüksek risk uçlarda daha büyük
                çarpan üretir.
              </li>
              <li>
                Her tur bağımsızdır. Isı haritası yalnız geçmişi gösterir;
                sonraki gözü tahmin etmez.
              </li>
              <li>
                Gösterilen ödeme bahis dâhil brüt tutardır. Oto Drop aynı
                ayarlarla yeni ve bağımsız turlar açar.
              </li>
            </ol>
            <p>
              Çarpan tablosu seçili sıra ve risk için %
              {game.targetRtp.toFixed(1)} hedef RTP’ye göre hesaplanır.
            </p>
          </section>
        </div>
      )}
      {fairOpen && (
        <div className="plinko-modal-backdrop">
          <section className="plinko-modal fair">
            <button className="modal-x" onClick={() => setFairOpen(false)}>
              ×
            </button>
            <small>DOĞRULANABİLİR TOP</small>
            <h2>Yol, top bırakılmadan önce mühürlenir.</h2>
            <dl>
              <div>
                <dt>Algoritma</dt>
                <dd>
                  {lastRound?.algorithm ?? "pehlevan-plinko-hmac-sha256-v1"}
                </dd>
              </div>
              <div>
                <dt>Commitment</dt>
                <dd>{lastRound?.commitment ?? "Henüz tur yok"}</dd>
              </div>
              <div>
                <dt>Client seed</dt>
                <dd>
                  {lastRound?.clientSeed ??
                    localStorage.getItem(
                      accountKey(user.id, CLIENT_SEED_KEY),
                    ) ??
                    "Henüz üretilmedi"}
                </dd>
              </div>
              <div>
                <dt>Nonce</dt>
                <dd>{lastRound?.nonce ?? nonceRef.current}</dd>
              </div>
              {lastRound && (
                <>
                  <div>
                    <dt>Server seed</dt>
                    <dd>{lastRound.serverSeed}</dd>
                  </div>
                  <div>
                    <dt>Yol</dt>
                    <dd>
                      {lastRound.directions
                        .map((value) => (value > 0 ? "S" : "L"))
                        .join(" · ")}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <button
              disabled={!lastRound || verifyState === "checking"}
              onClick={async () => {
                if (!lastRound) return;
                setVerifyState("checking");
                setVerifyState(
                  (await verifyPlinkoRound(lastRound)) ? "ok" : "fail",
                );
              }}
            >
              {verifyState === "checking"
                ? "KONTROL EDİLİYOR…"
                : verifyState === "ok"
                  ? "✓ TOP DOĞRULANDI"
                  : verifyState === "fail"
                    ? "× DOĞRULAMA BAŞARISIZ"
                    : "SON TOPU DOĞRULA"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
