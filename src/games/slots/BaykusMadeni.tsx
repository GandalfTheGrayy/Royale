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
import {
  DEFAULT_MINE_DROP_TUNING,
  getAdminSettings,
  subscribeAdminSettings,
} from "../../data/casino-admin";
import { createRecordId, recordGameEvent, recordGameRound, recordWalletEntry } from "../../data/casino-database";
import GameMusicControls from "../../audio/GameMusicControls";
import { CASINO_BET_STEPS, compactWager, maximumAffordableWager, normalizeWagerInput } from "../wagering";
import { SlotAudio } from "./slot-audio";
import { mineActorKey, minePresentationDuration, planMineActorLanes } from "./baykus-presentation";
import {
  cloneMine,
  accrueMineBonusSpin,
  createMine,
  createMineBonusProgress,
  rollMysteryOutcome,
  runMineSpin,
  settleMineBonusFinal,
  type MineBonusProgress,
  type MineBlock,
  type MineBonusTier,
  type MinePaidMode,
  type MineReelSymbol,
  type MineSpinEvent,
  type MineSpinResult,
  type MineState,
  type MineTool,
} from "./baykus-madeni-engine";
import "./baykus-madeni.css";

type Props = { balance: number; setBalance: Dispatch<SetStateAction<number>>; onBack: () => void };
type BonusSource = "natural" | "buy" | "mystery";
type BonusSession = {
  tier: MineBonusTier;
  source: BonusSource;
  remaining: number;
  played: number;
  totalWin: number;
  progress: MineBonusProgress;
  maxWinX: number;
  openedChests: number;
  chestValues: number[];
  mine: MineState;
};
type Actor = {
  id: number;
  column: number;
  sourceRow: number;
  targetRow: number;
  tool?: MineTool;
  special?: "tnt";
  phase: "drop" | "bounce" | "hit" | "depart";
  laneOffsetPx: number;
  staggerMs: number;
  laneIndex: number;
};
type Burst = { id: number; column: number; row: number; amount: number; kind: "block" | "chest" };
type ChestMath = {
  id: number;
  blockWinX: number;
  chestMultiplierX: number;
  totalWinX: number;
  payout: number;
  credited: boolean;
  capped: boolean;
  deferred?: boolean;
  stage?: "bank" | "multiplier" | "apply";
};
type PendingBuy = { kind: MineBonusTier | "mystery"; label: string; costX: number };
type BonusFinale = { title: string; total: number; bet: number; spins: number; chests: number; chestValues: number[]; chestMultiplierX: number };
type UpgradeFlight = { id: number; sourceRow: number; sourceColumn: number; targetRow: number; targetColumn: number; kind: "book" | "max-book" };
type FinalWinHold = { id: number; totalWinX: number; payout: number; label: string; tone: string };

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const emptyReel = () => Array.from({ length: 3 }, () => Array.from({ length: 5 }, () => ({ kind: "special", special: "empty" }) as MineReelSymbol));
const assetRoot = "/assets/slots/baykus-madeni/components-v3";
const pickaxeAssetRoot = "/assets/slots/baykus-madeni/components-v4";
const toolAssets: Record<MineTool, string> = {
  bronze: `${pickaxeAssetRoot}/pickaxe-bronze-v4.png`, iron: `${pickaxeAssetRoot}/pickaxe-iron-v4.png`,
  gold: `${pickaxeAssetRoot}/pickaxe-gold-v4.png`, diamond: `${pickaxeAssetRoot}/pickaxe-diamond-v4.png`, obsidian: `${pickaxeAssetRoot}/pickaxe-obsidian-v4.png`,
};
const blockAssets: Record<MineBlock, string> = {
  dirt: `${assetRoot}/block-dirt-v3.png`, stone: `${assetRoot}/block-stone-v3.png`, blast: `${assetRoot}/block-blast-v3.png`,
  redstone: `${assetRoot}/block-redstone-v3.png`, mystery: `${assetRoot}/block-mystery-v3.png`, gold: `${assetRoot}/block-gold-v3.png`,
  diamond: `${assetRoot}/block-diamond-v3.png`, obsidian: `${assetRoot}/block-obsidian-v3.png`,
};
const specialAssets = {
  tnt: `${assetRoot}/special-tnt-v3.png`, book: `${assetRoot}/special-book-v3.png`, "max-book": `${assetRoot}/special-max-book-v3.png`,
  eye: `${assetRoot}/special-eye-v3.png`, closedChest: `${assetRoot}/chest-closed-v3.png`, openChest: `${assetRoot}/chest-open-v3.png`,
} as const;
const modeCopy: Record<MinePaidMode, { title: string; detail: string; risk: number }> = {
  base: { title: "Normal Kazı", detail: "Tam duvar · dengeli sembol havuzu", risk: 1 },
  extra: { title: "Ekstra Şans", detail: "Göz ihtimali yükselir", risk: 2 },
  super: { title: "Süper Şans", detail: "Tetiklenen bonus en az Süper", risk: 3 },
  diamond: { title: "Elmas Dönüş", detail: "Yarı kazılmış saha · Elmas/Obsidyen", risk: 4 },
  obsidian: { title: "Obsidyen Dönüş", detail: "Derin saha · yalnız Obsidyen", risk: 5 },
};
const bonusCopy: Record<MineBonusTier, { title: string; detail: string; eyebrow: string }> = {
  block: { title: "Blok Bonusu", detail: "Kalıcı duvar ve bütün kazma seviyeleri", eyebrow: "3 BAYKUŞ GÖZÜ" },
  super: { title: "Süper Blok Bonusu", detail: "Bronz kaldırıldı; Demir en düşük kazma", eyebrow: "4 BAYKUŞ GÖZÜ" },
  epic: { title: "Epik Blok Bonusu", detail: "Yalnız Altın, Elmas ve Obsidyen", eyebrow: "5 BAYKUŞ GÖZÜ" },
};
const toolNames: Record<MineTool, string> = { bronze: "Bronz", iron: "Demir", gold: "Altın", diamond: "Elmas", obsidian: "Obsidyen" };
const blockNames: Record<MineBlock, string> = { dirt: "Toprak", stone: "Taş", blast: "Patlayıcı Cevher", redstone: "Kızıl Cevher", mystery: "Gizem", gold: "Altın", diamond: "Elmas", obsidian: "Obsidyen" };

const bonusWinTier = (multiplier: number) => {
  if (multiplier >= 1000) return { label: "TARİHİ VURGUN", tone: "historic" };
  if (multiplier >= 500) return { label: "AKILALMAZ KAZANÇ", tone: "absurd" };
  if (multiplier >= 100) return { label: "EFSANEVİ VURGUN", tone: "legendary" };
  if (multiplier >= 25) return { label: "MUHTEŞEM KAZANÇ", tone: "magnificent" };
  if (multiplier >= 10) return { label: "BÜYÜK KAZANÇ", tone: "big" };
  if (multiplier >= 5) return { label: "GÜZEL KAZANÇ", tone: "nice" };
  return { label: "BONUS TAMAMLANDI", tone: "finish" };
};

function SymbolArt({ symbol }: { symbol: MineReelSymbol }) {
  if (symbol.kind === "tool") return <img src={toolAssets[symbol.tool]} alt={toolNames[symbol.tool]} />;
  if (symbol.special === "empty") return null;
  return <img src={specialAssets[symbol.special]} alt={{ tnt: "TNT", book: "Geliştirme Kitabı", "max-book": "MAX Geliştirme Kitabı", eye: "Baykuş Gözü" }[symbol.special]} />;
}

export default function BaykusMadeni({ balance, setBalance, onBack }: Props) {
  const admin = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings);
  const settings = admin.games["baykus-madeni"];
  const tuning = settings.mineDrop ?? DEFAULT_MINE_DROP_TUNING;
  const [wager, setWager] = useState(Math.max(settings.minBet, settings.defaultBet));
  const [betStep, setBetStep] = useState(25);
  const [mode, setMode] = useState<MinePaidMode>("base");
  const [mine, setMine] = useState(() => createMine(undefined, tuning));
  const [displayMine, setDisplayMine] = useState(() => cloneMine(mine));
  const [reel, setReel] = useState<MineReelSymbol[][]>(() => emptyReel());
  const [result, setResult] = useState<MineSpinResult>();
  const [bonus, setBonus] = useState<BonusSession>();
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [quick, setQuick] = useState(false);
  const [autoSkipScreens, setAutoSkipScreens] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoCount, setAutoCount] = useState(25);
  const [betToolsOpen, setBetToolsOpen] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [phase, setPhase] = useState<"idle" | "reel" | "dig" | "settle">("idle");
  const [actors, setActors] = useState<Actor[]>([]);
  const [impacts, setImpacts] = useState<Array<{ id: number; column: number; row: number; kind: "hit" | "blast" }>>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [chestMath, setChestMath] = useState<ChestMath>();
  const [finalWinHold, setFinalWinHold] = useState<FinalWinHold>();
  const [roundWinX, setRoundWinX] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [pendingBuy, setPendingBuy] = useState<PendingBuy>();
  const [featureIntro, setFeatureIntro] = useState<MineBonusTier>();
  const [summary, setSummary] = useState<{ title: string; total: number; spins: number; chests: number }>();
  const [bonusFinale, setBonusFinale] = useState<BonusFinale>();
  const [bonusFinaleAmount, setBonusFinaleAmount] = useState(0);
  const [bonusFinaleDone, setBonusFinaleDone] = useState(false);
  const [bonusFinaleStage, setBonusFinaleStage] = useState<"collecting" | "applying">("collecting");
  const [upgradeFlight, setUpgradeFlight] = useState<UpgradeFlight>();
  const [upgradeTarget, setUpgradeTarget] = useState<{ row: number; column: number; id: number }>();
  const [mysteryReveal, setMysteryReveal] = useState<{ outcome: "none" | "super" | "epic"; revealed: boolean }>();
  const [notice, setNotice] = useState("Dönüşü başlat; kazmalar makaradan düşüp blokları tek tek parçalasın.");
  const audioRef = useRef<SlotAudio | undefined>(undefined);
  const mountedRef = useRef(true);
  const balanceRef = useRef(balance);
  const eventId = useRef(0);
  const roundWinXRef = useRef(0);
  const roundCountFrameRef = useRef<number | undefined>(undefined);
  const roundCountResolveRef = useRef<(() => void) | undefined>(undefined);
  const presentationFinalRef = useRef<MineSpinResult | undefined>(undefined);
  const skipRequestedRef = useRef(false);
  const skipWaitersRef = useRef(new Set<() => void>());
  audioRef.current ??= new SlotAudio("baykus-madeni");

  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => {
    // React StrictMode runs an extra setup/cleanup cycle in development. Resetting
    // this guard here keeps asynchronous presentations alive after that cycle.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (roundCountFrameRef.current !== undefined) window.cancelAnimationFrame(roundCountFrameRef.current);
      roundCountFrameRef.current = undefined;
      roundCountResolveRef.current?.();
      roundCountResolveRef.current = undefined;
      for (const resolve of skipWaitersRef.current) resolve();
      skipWaitersRef.current.clear();
      audioRef.current?.dispose();
    };
  }, []);
  useEffect(() => { audioRef.current!.enabled = settings.sound && admin.general.masterSound; }, [settings.sound, admin.general.masterSound]);
  useEffect(() => {
    if (!bonusFinale) { setBonusFinaleAmount(0); setBonusFinaleDone(false); setBonusFinaleStage("collecting"); return; }
    const duration = Math.max(850, Math.min(1_450, 850 + Math.log10(bonusFinale.total + 10) * 150));
    let frameId = 0;
    const collectTimer = window.setTimeout(() => {
      const startedAt = performance.now();
      setBonusFinaleStage("applying");
      audioRef.current?.play("bigWin");
      const frame = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 3;
        setBonusFinaleAmount(Math.round(bonusFinale.total * eased * 100) / 100);
        if (progress < 1) frameId = window.requestAnimationFrame(frame);
        else setBonusFinaleDone(true);
      };
      frameId = window.requestAnimationFrame(frame);
    }, 620);
    return () => { window.clearTimeout(collectTimer); window.cancelAnimationFrame(frameId); };
  }, [bonusFinale]);

  const currentCost = bonus ? 0 : wager * tuning.modeCosts[mode];
  const canPlay = !busy && !bonus && balance >= currentCost;
  const maxWager = Math.max(settings.minBet, maximumAffordableWager(balance, tuning.modeCosts[mode], 1));
  const updateWager = (next: SetStateAction<number>) => setWager((current) => {
    const value = typeof next === "function" ? next(current) : next;
    return Math.min(maxWager, normalizeWagerInput(value, settings.minBet));
  });
  const brokenCount = useMemo(() => displayMine.columns.flat().filter((cell) => cell.hp <= 0).length, [displayMine]);
  const bonusScale = bonus ? tuning.payoutScales[`bonus-${bonus.tier}`] * (bonus.source === "mystery" ? tuning.payoutScales.mystery : 1) : 1;
  const bonusDisplayedTotal = bonus ? bonus.progress.blockWinX * bonusScale * wager : 0;
  const presentationDuration = (milliseconds: number, turboFloor = 24) => minePresentationDuration(
    milliseconds,
    turbo || quick,
    turbo ? tuning.animation.turboScale : .72,
    turbo ? turboFloor : Math.max(60, turboFloor * 2),
  );
  const wait = (milliseconds: number, turboFloor = 24) => new Promise<void>((resolve) => {
    if (skipRequestedRef.current) { resolve(); return; }
    let timeout = 0;
    const finish = () => {
      window.clearTimeout(timeout);
      skipWaitersRef.current.delete(finish);
      resolve();
    };
    skipWaitersRef.current.add(finish);
    timeout = window.setTimeout(finish, presentationDuration(milliseconds, turboFloor));
  });
  const requestPresentationSkip = (target?: EventTarget | null) => {
    if (!busy || phase === "idle") return;
    if (target instanceof Element && target.closest("button, input, select, label, a")) return;
    skipRequestedRef.current = true;
    const finalPresentation = presentationFinalRef.current;
    if (finalPresentation) {
      showRoundWinX(finalPresentation.totalWinX);
      setReel(finalPresentation.reel);
      setDisplayMine(cloneMine(finalPresentation.mine));
      setActors([]);
      setImpacts([]);
      setBursts([]);
      setUpgradeFlight(undefined);
      setUpgradeTarget(undefined);
    }
    if (roundCountFrameRef.current !== undefined) window.cancelAnimationFrame(roundCountFrameRef.current);
    roundCountFrameRef.current = undefined;
    roundCountResolveRef.current?.();
    roundCountResolveRef.current = undefined;
    for (const resolve of skipWaitersRef.current) resolve();
    skipWaitersRef.current.clear();
  };

  const showRoundWinX = (value: number) => {
    const next = Math.round(value * 100) / 100;
    roundWinXRef.current = next;
    setRoundWinX(next);
  };

  const countRoundWinX = (target: number, milliseconds: number) => new Promise<void>((resolve) => {
    if (roundCountFrameRef.current !== undefined) {
      window.cancelAnimationFrame(roundCountFrameRef.current);
      roundCountFrameRef.current = undefined;
      roundCountResolveRef.current?.();
      roundCountResolveRef.current = undefined;
    }
    const start = roundWinXRef.current;
    const final = Math.round(target * 100) / 100;
    if (skipRequestedRef.current) { showRoundWinX(final); resolve(); return; }
    if (start === final || milliseconds <= 0) { showRoundWinX(final); resolve(); return; }
    roundCountResolveRef.current = resolve;
    const startedAt = performance.now();
    const frame = (now: number) => {
      if (!mountedRef.current) {
        roundCountFrameRef.current = undefined;
        roundCountResolveRef.current = undefined;
        resolve();
        return;
      }
      const progress = Math.min(1, (now - startedAt) / milliseconds);
      const eased = 1 - (1 - progress) ** 3;
      showRoundWinX(start + (final - start) * eased);
      if (progress < 1) roundCountFrameRef.current = window.requestAnimationFrame(frame);
      else {
        roundCountFrameRef.current = undefined;
        roundCountResolveRef.current = undefined;
        resolve();
      }
    };
    roundCountFrameRef.current = window.requestAnimationFrame(frame);
  });

  const changeBalance = (delta: number) => {
    balanceRef.current = Math.round((balanceRef.current + delta) * 100) / 100;
    setBalance(current => Math.round((current + delta) * 100) / 100);
  };

  const addBurst = (event: MineSpinEvent, kind: Burst["kind"], amount = event.valueX ?? 0) => {
    if (event.column === undefined || event.valueX === undefined) return;
    const id = ++eventId.current;
    setBursts((current) => [...current.slice(-7), { id, column: event.column!, row: event.row ?? 6, amount, kind }]);
    window.setTimeout(() => setBursts((current) => current.filter((burst) => burst.id !== id)), Math.max(650, tuning.animation.countUpMs));
  };

  const updateDisplayMine = (events: MineSpinEvent[]) => {
    setDisplayMine((current) => {
      const next = cloneMine(current);
      for (const event of events) {
        if (event.column === undefined) continue;
        if (event.kind === "hit" && event.row !== undefined) next.columns[event.column][event.row].hp = event.hpAfter ?? next.columns[event.column][event.row].hp;
        if (event.kind === "chest") next.chests[event.column] = { opened: true, multiplier: event.valueX };
      }
      return next;
    });
  };

  const playPresentation = async (spinResult: MineSpinResult, activeBonus?: BonusSession, activeMode: MinePaidMode = mode, skipScreens = false) => {
    skipRequestedRef.current = skipScreens;
    presentationFinalRef.current = spinResult;
    setResult(undefined);
    showRoundWinX(0);
    setActors([]);
    setImpacts([]);
    setBursts([]);
    setChestMath(undefined);
    setFinalWinHold(undefined);
    setUpgradeFlight(undefined);
    setUpgradeTarget(undefined);
    setDisplayMine(cloneMine(spinResult.initialMine));
    if (skipScreens) {
      setReel(spinResult.reel);
      setDisplayMine(cloneMine(spinResult.mine));
      showRoundWinX(spinResult.totalWinX);
      setResult(spinResult);
      setPhase("idle");
      presentationFinalRef.current = undefined;
      return;
    }
    const upgrades = spinResult.events.filter((event) => event.kind === "upgrade");
    const presentationReel = spinResult.reel.map((row) => row.map((symbol) => ({ ...symbol })));
    for (const upgrade of upgrades) {
      for (const target of upgrade.upgradeTargets ?? []) presentationReel[target.row][target.column] = { kind: "tool", tool: target.from };
    }
    setReel(presentationReel);
    setPhase("reel");
    setNotice("Maden işaretleri hazırlanıyor…");
    audioRef.current?.play("spin");
    await wait(tuning.animation.reelMs, 380);
    if (!mountedRef.current) return;
    audioRef.current?.play("stop", 4);
    const landedEyes = spinResult.reel.flat().filter((symbol) => symbol.kind === "special" && symbol.special === "eye").length;
    if (landedEyes) audioRef.current?.play("eye", landedEyes);
    await wait(tuning.animation.bounceMs, 120);
    setPhase("dig");
    let displayedBlockWin = 0;
    let displayedChestMultiplier = activeBonus ? 0 : 1;
    // Sandıklar tüm ücretli dönüş boyunca ortak/global çarpandır. Son elde
    // açılmaları bile hesabı erkene çekmez; yalnız final sahnesinde uygulanırlar.
    const deferChestSettlement = !activeBonus;
    const scale = activeBonus
      ? tuning.payoutScales[`bonus-${activeBonus.tier}`] * (activeBonus.source === "mystery" ? tuning.payoutScales.mystery : 1)
      : tuning.payoutScales[activeMode];
    const progressBefore = activeBonus?.progress ?? { blockWinX: 0, chestMultiplierX: 0, totalWinX: 0 };
    const displaySettlement = () => {
      if (!activeBonus) {
        if (deferChestSettlement) {
          const blockWinX = displayedBlockWin * scale;
          return { blockWinX, chestMultiplierX: displayedChestMultiplier, totalWinX: blockWinX, creditWinX: blockWinX };
        }
        const totalWinX = Math.min(tuning.maxWinX, displayedBlockWin * displayedChestMultiplier * scale);
        return { blockWinX: displayedBlockWin, chestMultiplierX: displayedChestMultiplier, totalWinX, creditWinX: totalWinX };
      }
      const accrued = accrueMineBonusSpin(progressBefore, {
        blockWinX: displayedBlockWin, chestAddX: displayedChestMultiplier,
      });
      // Bonus sürerken final hesabını projeksiyon amacıyla bile çalıştırma.
      // Özellikle son dönüşte açılan sandık böylece tekil turun sonucuna hiçbir
      // yoldan dokunamaz; sadece session.progress'e eklenip gerçek finali bekler.
      return { ...accrued, totalWinX: 0, creditWinX: 0 };
    };

    for (const event of upgrades) {
      if (!mountedRef.current) return;
      if (event.kind === "upgrade") {
        audioRef.current?.play("mystery");
        const sourceIndex = presentationReel.flat().findIndex((symbol) => symbol.kind === "special" && symbol.special === event.special);
        const sourceRow = sourceIndex >= 0 ? Math.floor(sourceIndex / 5) : 1;
        const sourceColumn = sourceIndex >= 0 ? sourceIndex % 5 : 2;
        for (const target of event.upgradeTargets ?? []) {
          const id = ++eventId.current;
          setUpgradeFlight({ id, sourceRow, sourceColumn, targetRow: target.row, targetColumn: target.column, kind: event.special === "max-book" ? "max-book" : "book" });
          await wait(160, 80);
          setReel((current) => current.map((row, rowIndex) => row.map((symbol, column) => rowIndex === target.row && column === target.column ? { kind: "tool", tool: target.to } : symbol)));
          setUpgradeTarget({ id, row: target.row, column: target.column });
          await wait(80, 50);
        }
        setUpgradeFlight(undefined);
        setUpgradeTarget(undefined);
      }
    }

    const actorLanes = planMineActorLanes(spinResult.events
      .filter((event) => event.kind === "drop" && event.column !== undefined)
      .map((event) => ({
        column: event.column!, sourceColumn: event.sourceColumn, sourceRow: event.sourceRow,
        tool: event.tool, special: event.special,
      })));
    const laneFor = (event: MineSpinEvent) => actorLanes.get(mineActorKey({
      column: event.column ?? 0, sourceColumn: event.sourceColumn, sourceRow: event.sourceRow,
      tool: event.tool, special: event.special,
    })) ?? { laneIndex: 0, laneCount: 1, offsetPx: 0, staggerMs: 0 };
    const actorIds = new Map<string, number>();
    const actorIdFor = (key: string) => {
      const existing = actorIds.get(key);
      if (existing !== undefined) return existing;
      const id = ++eventId.current;
      actorIds.set(key, id);
      return id;
    };
    const actorFrom = (event: MineSpinEvent, phase: Actor["phase"]): Actor => {
      const lane = laneFor(event);
      const key = mineActorKey({
        column: event.column!, sourceColumn: event.sourceColumn, sourceRow: event.sourceRow,
        tool: event.tool, special: event.special,
      });
      return {
        id: actorIdFor(key), column: event.column!, sourceRow: event.sourceRow ?? 0,
        targetRow: Math.max(0, event.row ?? event.targetRow ?? 0), tool: event.tool,
        special: event.special === "tnt" ? "tnt" : undefined, phase,
        laneOffsetPx: lane.offsetPx, staggerMs: lane.staggerMs, laneIndex: lane.laneIndex,
      };
    };

    const waves = [...new Set(spinResult.events.filter((event) => event.kind !== "upgrade").map((event) => event.wave ?? 0))].sort((a, b) => a - b);
    for (const wave of waves) {
      if (!mountedRef.current) return;
      const waveEvents = spinResult.events.filter((event) => event.kind !== "upgrade" && (event.wave ?? 0) === wave);
      const drops = waveEvents.filter((event) => event.kind === "drop" && event.column !== undefined);
      const hits = waveEvents.filter((event) => event.kind === "hit" && event.column !== undefined && event.row !== undefined);
      const breaks = waveEvents.filter((event) => event.kind === "break");
      const blasts = waveEvents.filter((event) => event.kind === "blast" && event.column !== undefined);
      const chests = waveEvents.filter((event) => event.kind === "chest");

      if (drops.length) {
        const dropActors = drops.map((event) => actorFrom(event, "drop"));
        const sameColumn = new Set(drops.map((event) => event.column)).size < drops.length;
        setNotice(drops.some((event) => event.special === "tnt") ? `${drops.length} TNT kontrollü biçimde şafta iniyor.` : sameColumn ? `${drops.length} kazma şeritlerine ayrılıp madene iniyor.` : `${drops.length} kazma madene iniyor.`);
        const removed = new Set(drops.map((event) => `${event.sourceRow ?? 0}-${event.sourceColumn ?? event.column}`));
        setReel((current) => current.map((row, rowIndex) => row.map((symbol, columnIndex) => removed.has(`${rowIndex}-${columnIndex}`) ? { kind: "special", special: "empty" } : symbol)));
        setActors(dropActors);
        drops.slice(0, 5).forEach((event) => audioRef.current?.play("powerLand", event.column));
        const lastDropStagger = Math.max(0, ...dropActors.map((actor) => actor.staggerMs));
        await wait(tuning.animation.dropMs + lastDropStagger, 260);
        setActors((current) => current.map((actor) => ({ ...actor, phase: "bounce" })));
        await wait(Math.min(tuning.animation.bounceMs, 120) + lastDropStagger, 90);
      }

      if (hits.length || blasts.length) {
        const hitActors = hits.filter((event) => event.tool).map((event) => actorFrom(event, "hit"));
        setActors(hitActors);
        setImpacts([
          ...hits.map((event) => ({ id: ++eventId.current, column: event.column!, row: event.row!, kind: event.special ? "blast" as const : "hit" as const })),
          ...blasts.map((event) => ({ id: ++eventId.current, column: event.column!, row: event.row ?? event.targetRow ?? 0, kind: "blast" as const })),
        ]);
        setNotice(blasts.length ? `${blasts.length} patlama madeni sarsıyor!` : `${hits.length} kazma bloklara sırayla vuruyor.`);
        if (hits.length) audioRef.current?.play("cascade", hits[0]?.column ?? 0);
        if (blasts.length) audioRef.current?.play("collector");
        const lastHitStagger = Math.max(0, ...hitActors.map((actor) => actor.staggerMs));
        await wait(Math.max(hits.length ? tuning.animation.hitMs : 0, blasts.length ? tuning.animation.blastMs : 0) + lastHitStagger, blasts.length ? 320 : 220);
        updateDisplayMine(hits);
        setImpacts([]);
        if (hitActors.length) {
          setActors((current) => current.map((actor) => ({ ...actor, phase: "depart" })));
          await wait(110, 80);
        }
      }

      if (breaks.length) {
        for (const event of breaks) {
          displayedBlockWin += event.valueX ?? 0;
          addBurst(event, "block", Math.round((event.valueX ?? 0) * wager * scale * 100) / 100);
        }
        setNotice(`${breaks.length} blok kırıldı · ödül kasaya yazılıyor.`);
        audioRef.current?.play(breaks[0]?.valueX && breaks[0].valueX >= 5 ? "multiplier" : "coin", breaks[0]?.column ?? 0);
      }

      if (chests.length) {
        setNotice(`${chests.length} sandık kilidi açılıyor.`);
        updateDisplayMine(chests);
        for (const event of chests) {
          displayedChestMultiplier = activeBonus
            ? displayedChestMultiplier + (event.valueX ?? 0)
            : displayedChestMultiplier * (event.valueX ?? 1);
          addBurst(event, "chest");
        }
        setNotice(`${chests.length} sandık açıldı · çarpan kasaya işleniyor.`);
        audioRef.current?.play("multiplierImpact", chests[0]?.column ?? 0);
      }

      const displayed = displaySettlement();
      // Bonus içindeki sandıklar burada bir denklem/ödeme sahnesi açmaz. Yalnız
      // bonus kasasına eklenir ve bütün bonus bittikten sonra tek global işlemde
      // uygulanır. Böylece son elde açılan sandık da tekil eli çarpıyor görünmez.
      if (activeBonus && chests.length) setNotice(`${chests.length} sandık çarpanı bonus kasasına eklendi · yalnız finalde uygulanacak.`);
      if (displayed.creditWinX !== roundWinXRef.current) void countRoundWinX(displayed.creditWinX, presentationDuration(tuning.animation.countUpMs, 360));
    }
    setActors([]);
    setImpacts([]);
    setPhase("settle");
    setDisplayMine(cloneMine(spinResult.mine));
    if (deferChestSettlement && displayedChestMultiplier > 1) {
      const finalBlockBankX = spinResult.blockWinX * scale;
      // Final sandık sahnesi ekrana geldiğinde sayaç mutlaka bütün blokların
      // gerçek toplamındadır; son kırılan bloğun ara değerinde kalamaz.
      await countRoundWinX(finalBlockBankX, presentationDuration(tuning.animation.countUpMs, 360));
      setChestMath({
        id: ++eventId.current,
        blockWinX: finalBlockBankX,
        chestMultiplierX: displayedChestMultiplier,
        totalWinX: spinResult.totalWinX,
        payout: Math.round(wager * spinResult.totalWinX * 100) / 100,
        credited: false,
        capped: spinResult.totalWinX < finalBlockBankX * displayedChestMultiplier,
        deferred: true,
        stage: "bank",
      });
      setNotice("Toplam blok kasası hazır.");
      audioRef.current?.play("multiplierCollect");
      await wait(720, 360);
      setChestMath((current) => current ? { ...current, stage: "multiplier" } : current);
      await wait(860, 440);
      setChestMath((current) => current ? { ...current, stage: "apply" } : current);
      audioRef.current?.play("multiplierImpact");
      await wait(580, 320);
      setChestMath(undefined);
    }
    const hasGlobalChestFinal = deferChestSettlement && displayedChestMultiplier > 1;
    const finalCountDuration = hasGlobalChestFinal
      ? Math.max(1_650, Math.min(3_100, 1_450 + Math.log10(spinResult.totalWinX + 10) * 480))
      : tuning.animation.countUpMs;
    await countRoundWinX(spinResult.totalWinX, presentationDuration(finalCountDuration, 520));

    if (hasGlobalChestFinal && !skipRequestedRef.current) {
      const tier = bonusWinTier(spinResult.totalWinX);
      const holdId = ++eventId.current;
      setFinalWinHold({
        id: holdId,
        totalWinX: spinResult.totalWinX,
        payout: Math.round(wager * spinResult.totalWinX * 100) / 100,
        label: tier.label,
        tone: tier.tone,
      });
      await wait(1_450, 1_000);
      setFinalWinHold((current) => current?.id === holdId ? undefined : current);
    }

    setResult(spinResult);
    setPhase("idle");
    presentationFinalRef.current = undefined;
  };

  const showBalanceCredit = (payout: number, totalWinX: number) => {
    setChestMath((current) => {
      if (!current) return current;
      const id = current.id;
      window.setTimeout(() => {
        setChestMath((latest) => latest?.id === id ? undefined : latest);
      }, 1_050);
      return { ...current, totalWinX, payout, credited: true };
    });
  };

  const recordSpin = (
    spinResult: MineSpinResult,
    roundId: string,
    startedAt: string,
    balanceBefore: number,
    cost: number,
    payout: number,
    activeMode: MinePaidMode,
    activeBonus?: BonusSession,
  ) => {
    const settledAt = new Date().toISOString();
    void recordGameRound({
      id: `round:${roundId}`, roundId, game: "baykus-madeni",
      variant: activeBonus ? `${bonusCopy[activeBonus.tier].title} · otomatik ücretsiz dönüş` : modeCopy[activeMode].title,
      source: "player", playerParticipated: true, startedAt, settledAt, stake: cost, grossPayout: payout,
      net: payout - cost, outcome: payout > cost ? "win" : payout < cost ? "loss" : "push",
      balanceBefore, balanceAfter: balanceBefore - cost + payout,
      result: {
        telemetryVersion: 3, rngModel: tuning.profileName, visibleRuleset: "minedrop-2-session-chests-v3",
        reel: spinResult.reel, mine: spinResult.mine, eyeCount: spinResult.eyeCount, triggeredBonus: spinResult.triggeredBonus,
        blockWinX: spinResult.blockWinX, chestMultiplierX: spinResult.chestMultiplierX, chestAddX: spinResult.chestAddX, grossMultiplier: spinResult.totalWinX, events: spinResult.events,
        bonusProgressBefore: activeBonus?.progress,
        bonusProgressAfter: activeBonus ? accrueMineBonusSpin(activeBonus.progress, spinResult) : undefined,
      },
      modifiers: { bonus: Boolean(activeBonus), bonusTier: activeBonus?.tier, bonusSource: activeBonus?.source, mode: activeMode, costX: activeBonus ? 0 : tuning.modeCosts[activeMode] },
    });
    if (cost) void recordWalletEntry({ id: createRecordId("ledger-stake", roundId), roundId, game: "baykus-madeni", occurredAt: startedAt, type: "stake", amount: -cost, balanceBefore, balanceAfter: balanceBefore - cost, note: `Baykuş Madeni · ${modeCopy[activeMode].title}` });
    if (payout) void recordWalletEntry({ id: createRecordId("ledger-payout", roundId), roundId, game: "baykus-madeni", occurredAt: settledAt, type: "payout", amount: payout, balanceBefore: balanceBefore - cost, balanceAfter: balanceBefore - cost + payout, note: "Baykuş Madeni · blok ve sandık ödemesi" });
  };

  const playPaidSpin = async (fromAuto = false) => {
    if (autoRemaining && !fromAuto) return;
    if (!canPlay) {
      if (fromAuto) setAutoRemaining(0);
      setNotice(`Bu dönüş için ${money.format(currentCost)} PR gerekiyor.`);
      return;
    }
    if (fromAuto) setAutoRemaining((remaining) => Math.max(0, remaining - 1));
    setBusy(true); setBuyOpen(false);
    const activeMode = mode;
    const cost = wager * tuning.modeCosts[activeMode];
    const balanceBefore = balanceRef.current;
    changeBalance(-cost);
    const roundId = `baykus-madeni-${Date.now()}-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();
    const spinResult = runMineSpin({ mode: activeMode, tuning });
    await playPresentation(spinResult, undefined, activeMode, fromAuto && autoSkipScreens);
    if (!mountedRef.current) return;
    const payout = Math.round(wager * spinResult.totalWinX * 100) / 100;
    changeBalance(payout);
    showBalanceCredit(payout, spinResult.totalWinX);
    setMine(spinResult.mine);
    recordSpin(spinResult, roundId, startedAt, balanceBefore, cost, payout, activeMode);
    if (spinResult.totalWinX > 0) audioRef.current?.play(spinResult.totalWinX >= 25 ? "bigWin" : "win");
    if (spinResult.eyeCount) audioRef.current?.play("eye");
    if (spinResult.triggeredBonus) {
      setAutoRemaining(0);
      const session: BonusSession = { tier: spinResult.triggeredBonus, source: "natural", remaining: tuning.bonusSpins, played: 0, totalWin: 0, progress: createMineBonusProgress(spinResult.mine), maxWinX: tuning.maxWinX - spinResult.totalWinX, openedChests: 0, chestValues: [], mine: spinResult.mine };
      showRoundWinX(0);
      setBonus(session); setFeatureIntro(spinResult.triggeredBonus);
      setNotice(`${bonusCopy[spinResult.triggeredBonus].title} açıldı.`);
    } else setNotice(spinResult.totalWinX ? `${money.format(spinResult.totalWinX)}× · ${money.format(payout)} PR` : "Kazmalar sustu; yeni duvar hazırlanıyor.");
    setBusy(false);
  };

  useEffect(() => {
    if (!autoRemaining || busy || bonus) return;
    if (!settings.autoplay || balanceRef.current < currentCost) {
      setAutoRemaining(0);
      return;
    }
    const timer = window.setTimeout(() => { void playPaidSpin(true); }, turbo ? 140 : quick ? 300 : 560);
    return () => window.clearTimeout(timer);
    // Her otomatik tur, güncel bakiye ve bahis ile yeniden değerlendirilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRemaining, busy, bonus, currentCost, settings.autoplay, turbo, quick]);

  const startAuto = () => {
    if (busy || bonus || balanceRef.current < currentCost) return;
    setAutoRemaining(Math.max(1, autoCount));
    setAutoOpen(false);
  };

  const stopAuto = () => setAutoRemaining(0);

  const runBonusSequence = async () => {
    if (!bonus || busy) return;
    setFeatureIntro(undefined); setBusy(true);
    let session = { ...bonus, mine: cloneMine(bonus.mine) };
    while (session.remaining > 0 && session.played < tuning.bonusSpins && mountedRef.current) {
      const balanceBefore = balanceRef.current;
      const roundId = `baykus-madeni-bonus-${Date.now()}-${crypto.randomUUID()}`;
      const startedAt = new Date().toISOString();
      const spinResult = runMineSpin({ mine: session.mine, mode: "base", bonusTier: session.tier, tuning });
      const progress = accrueMineBonusSpin(session.progress, spinResult);
      const settledResult = { ...spinResult, totalWinX: 0 };
      await playPresentation(settledResult, session);
      if (!mountedRef.current) return;
      recordSpin(settledResult, roundId, startedAt, balanceBefore, 0, 0, "base", session);
      session = {
        ...session, mine: spinResult.mine, remaining: session.remaining - 1,
        played: session.played + 1, progress, openedChests: session.openedChests + spinResult.openedChests.length,
        chestValues: [...session.chestValues, ...spinResult.events.filter((event) => event.kind === "chest").map((event) => event.valueX ?? 0)],
      };
      setBonus(session); setMine(spinResult.mine); showRoundWinX(0);
      setNotice(`${bonusCopy[session.tier].title} · ${session.remaining} dönüş kaldı · ${money.format(session.progress.blockWinX)}× blok kazancı birikti.`);
      await wait(520);
    }
    if (!mountedRef.current) return;
    const sourceScale = session.source === "mystery" ? tuning.payoutScales.mystery : 1;
    const finalSettlement = settleMineBonusFinal(session.progress, tuning.payoutScales[`bonus-${session.tier}`] * sourceScale, session.maxWinX);
    const finalPayout = Math.round(wager * finalSettlement.totalWinX * 100) / 100;
    if (finalPayout) {
      const finalRoundId = `baykus-madeni-bonus-final-${Date.now()}-${crypto.randomUUID()}`;
      const settledAt = new Date().toISOString();
      const balanceBefore = balanceRef.current;
      changeBalance(finalPayout);
      void recordWalletEntry({ id: createRecordId("ledger-payout", finalRoundId), roundId: finalRoundId, game: "baykus-madeni", occurredAt: settledAt, type: "payout", amount: finalPayout, balanceBefore, balanceAfter: balanceBefore + finalPayout, note: `${bonusCopy[session.tier].title} · bonus final ödemesi` });
    }
    setBonus(undefined); setBusy(false);
    setBonusFinale({ title: bonusCopy[session.tier].title, total: finalPayout, bet: wager, spins: session.played, chests: session.openedChests, chestValues: session.chestValues, chestMultiplierX: session.progress.chestMultiplierX || 1 });
    setNotice(`${bonusCopy[session.tier].title} tamamlandı · ${money.format(finalPayout)} PR`);
  };

  const recordPurchase = (pending: PendingBuy, outcome?: string) => {
    const cost = wager * pending.costX;
    const balanceBefore = balanceRef.current;
    const roundId = `baykus-madeni-buy-${Date.now()}-${crypto.randomUUID()}`;
    const occurredAt = new Date().toISOString();
    changeBalance(-cost);
    void recordWalletEntry({ id: createRecordId("ledger-stake", roundId), roundId, game: "baykus-madeni", occurredAt, type: "stake", amount: -cost, balanceBefore, balanceAfter: balanceBefore - cost, note: `Baykuş Madeni · ${pending.label}` });
    void recordGameEvent({ id: createRecordId("event-baykus-madeni-buy", roundId), roundId, game: "baykus-madeni", occurredAt, type: "bonus-purchased", payload: { kind: pending.kind, outcome, costX: pending.costX, cost, referenceBet: wager } });
    void recordGameRound({
      id: `round:${roundId}`, roundId, game: "baykus-madeni", variant: `Bonus satın alma · ${pending.label}`, source: "player", playerParticipated: true,
      startedAt: occurredAt, settledAt: occurredAt, stake: cost, grossPayout: 0, net: -cost, outcome: "loss", balanceBefore, balanceAfter: balanceBefore - cost,
      result: { telemetryVersion: 2, reel: [], mine: createMine(undefined, tuning), events: [], grossMultiplier: 0, triggeredBonus: outcome ?? pending.kind },
      modifiers: { bonusPurchase: true, kind: pending.kind, outcome, costX: pending.costX, referenceBet: wager },
    });
  };

  const confirmPurchase = async () => {
    if (!pendingBuy || busy) return;
    const cost = wager * pendingBuy.costX;
    if (balanceRef.current < cost) { setNotice(`${pendingBuy.label} için ${money.format(cost)} PR gerekiyor.`); setPendingBuy(undefined); return; }
    const pending = pendingBuy;
    setPendingBuy(undefined); setBuyOpen(false);
    if (pending.kind === "mystery") {
      setBusy(true);
      const outcome = rollMysteryOutcome(undefined, tuning);
      recordPurchase(pending, outcome);
      setMysteryReveal({ outcome, revealed: false });
      audioRef.current?.play("mystery");
      await wait(1_350);
      setMysteryReveal({ outcome, revealed: true });
      audioRef.current?.play(outcome === "none" ? "cascade" : "scatter");
      await wait(1_100);
      setMysteryReveal(undefined); setBusy(false);
      if (outcome === "none") {
        setSummary({ title: "Gizemli Dönüş", total: 0, spins: 0, chests: 0 });
        setNotice("Gizemli kapı bu kez boş galeriye açıldı.");
      } else {
        const freshMine = createMine(undefined, tuning);
        const tier: MineBonusTier = outcome;
        setMine(freshMine); setDisplayMine(cloneMine(freshMine));
        showRoundWinX(0);
        setBonus({ tier, source: "mystery", remaining: tuning.bonusSpins, played: 0, totalWin: 0, progress: createMineBonusProgress(freshMine), maxWinX: tuning.maxWinX, openedChests: 0, chestValues: [], mine: freshMine });
        setFeatureIntro(tier);
      }
      return;
    }
    recordPurchase(pending, pending.kind);
    const freshMine = createMine(undefined, tuning);
    const tier = pending.kind;
    setMine(freshMine); setDisplayMine(cloneMine(freshMine));
    showRoundWinX(0);
    setBonus({ tier, source: "buy", remaining: tuning.bonusSpins, played: 0, totalWin: 0, progress: createMineBonusProgress(freshMine), maxWinX: tuning.maxWinX, openedChests: 0, chestValues: [], mine: freshMine });
    setFeatureIntro(tier);
  };

  const selectMode = (next: MinePaidMode) => {
    const selected = mode === next ? "base" : next;
    setMode(selected);
    setBuyOpen(false);
    audioRef.current?.play("button");
    setNotice(selected === "base" ? "Normal Kazı etkin · özel mod kapatıldı." : `${modeCopy[selected].title} etkin · dönüş maliyeti ${money.format(wager * tuning.modeCosts[selected])} PR`);
  };
  const actorStyle = (actor: Actor) => ({
    "--actor-x": `calc(${actor.column * 20 + 10}% + ${actor.laneOffsetPx}px)`,
    "--actor-start-y": `calc(var(--reel-center-start) + ${actor.sourceRow} * var(--reel-step))`,
    "--actor-y": `calc(var(--wall-top) + ${actor.targetRow} * var(--block-step))`,
    "--drop-duration": `${presentationDuration(tuning.animation.dropMs, 260)}ms`,
    "--bounce-duration": `${presentationDuration(tuning.animation.bounceMs, 120)}ms`,
    "--hit-duration": `${presentationDuration(tuning.animation.hitMs, 220)}ms`,
    "--actor-delay": `${actor.staggerMs}ms`,
    zIndex: 12 + actor.laneIndex,
  } as CSSProperties);
  const finaleMultiplier = bonusFinale ? bonusFinaleAmount / bonusFinale.bet : 0;
  const finaleTier = bonusWinTier(finaleMultiplier);

  return (
    <main className={`owl-mine phase-${phase} ${bonus ? `bonus-${bonus.tier}` : ""} ${chestMath?.credited ? "chest-crediting" : ""}`} onPointerDown={(event) => requestPresentationSkip(event.target)}>
      <header className="owl-mine-topbar">
        <button onClick={onBack}>← Slot katı</button>
        <div className="owl-mine-title"><img src="/assets/slots/baykus-madeni/owl-mine-emblem-v1.png" alt="" /><span><small>PEHLEVAN ROYALE</small>BAYKUŞ MADENİ</span></div>
        <div className="owl-mine-balance"><small>SANAL BAKİYE</small>{money.format(balance)} PR</div>
      </header>

      <section className="owl-mine-stage">
        <div className="owl-mine-statusbar">
          <span>{bonus ? `${bonusCopy[bonus.tier].title} · ${bonus.remaining} dönüş` : modeCopy[mode].title}</span>
          <b>{bonus ? `${money.format(bonusDisplayedTotal)} PR BLOK KASASI` : roundWinX > 0 ? `${money.format(roundWinX * wager)} PR` : `${money.format(tuning.maxWinX)}× AZAMİ`}</b>
          <span>{phase === "dig" ? "KAZI DEVAM EDİYOR" : `${brokenCount}/30 BLOK · ${result?.eyeCount ?? 0} GÖZ`}</span>
        </div>

        <div className="owl-mine-machine">
          {chestMath && <div key={chestMath.id} className={`owl-chest-math ${chestMath.credited ? "credited" : ""} ${chestMath.stage ? `stage-${chestMath.stage}` : ""}`} role="status" aria-live="polite">
            <small>{chestMath.stage === "bank" ? "TOPLAM BLOK KASASI" : chestMath.stage === "multiplier" ? "SANDIK ÇARPANI GELİYOR" : chestMath.stage === "apply" ? "GLOBAL ÇARPAN UYGULANIYOR" : chestMath.deferred ? "SANDIK ÇARPANI FİNAL HESABINI BEKLİYOR" : "SANDIK ÇARPANI UYGULANIYOR"}</small>
            <div>
              <span><b>{money.format(chestMath.blockWinX * wager)} PR</b><em>{chestMath.deferred ? "BİRİKEN BLOK KASASI" : "BLOK KASASI"}</em></span>
              {chestMath.stage !== "bank" && <><i>×</i><span className="chest-factor"><b>{money.format(chestMath.chestMultiplierX)}×</b><em>SANDIK</em></span></>}
              {chestMath.stage === "apply" && <><i>{chestMath.capped ? "→" : "="}</i><span className="chest-total"><b>{chestMath.capped ? "AZAMİ" : `${money.format(chestMath.payout)} PR`}</b><em>{chestMath.capped ? "ÖDEME SINIRI" : "TOPLAM KAZANÇ"}</em></span></>}
              {!chestMath.stage && <><i>{chestMath.deferred || chestMath.capped ? "→" : "="}</i><span className="chest-total"><b>{chestMath.deferred ? "FİNALDE" : chestMath.capped ? "AZAMİ" : `${money.format(chestMath.payout)} PR`}</b><em>{chestMath.deferred ? "TEK SEFERDE UYGULANIR" : chestMath.capped ? "ÖDEME SINIRI" : "TOPLAM KAZANÇ"}</em></span></>}
            </div>
            {chestMath.deferred
              ? <p>{chestMath.stage === "bank" ? "Bütün kırılan blokların gerçek toplamı." : chestMath.stage === "multiplier" ? "Sandık çarpanı ana kasaya yaklaşıyor." : "Kasa global çarpanla birleşiyor."}</p>
              : <p>Kesinleşen kazanç: <strong>{money.format(chestMath.payout)} PR</strong> <b>{chestMath.credited ? "BAKİYEYE EKLENDİ" : "BAKİYEYE EKLENECEK"}</b></p>}
          </div>}
          {finalWinHold && <div key={finalWinHold.id} className={`owl-final-win-hold tier-${finalWinHold.tone}`} role="status" aria-live="polite">
            <small>GLOBAL KAZANÇ</small>
            <em>{finalWinHold.label}</em>
            <strong>{money.format(finalWinHold.payout)} PR</strong>
            <b>{money.format(finalWinHold.totalWinX)}×</b>
          </div>}
          <div className="owl-playfield">
            <div className="owl-depth-rail"><span>YÜZEY</span><i /><span>DERİN GALERİ</span></div>
            <section className="owl-reels" aria-label="5 çarpı 3 düşüş paneli">
              {reel.map((row, rowIndex) => row.map((symbol, column) => (
                <div key={`${rowIndex}-${column}`} className={`owl-reel-symbol ${symbol.kind === "tool" ? `tool-${symbol.tool}` : `special-${symbol.special}`} ${upgradeTarget?.row === rowIndex && upgradeTarget.column === column ? "upgrade-target" : ""}`} style={{ "--reel-column": column, "--reel-row": rowIndex, "--reel-duration": `${tuning.animation.reelMs}ms` } as CSSProperties}>
                  <SymbolArt symbol={symbol} />
                </div>
              )))}
              {upgradeFlight && <img key={upgradeFlight.id} className={`owl-upgrade-flight ${upgradeFlight.kind}`} src={specialAssets[upgradeFlight.kind]} alt="" style={{
                "--book-x0": `${(upgradeFlight.sourceColumn + .5) * 20}%`,
                "--book-y0": `${(upgradeFlight.sourceRow + .5) * (100 / 3)}%`,
                "--book-x1": `${(upgradeFlight.targetColumn + .5) * 20}%`,
                "--book-y1": `${(upgradeFlight.targetRow + .5) * (100 / 3)}%`,
              } as CSSProperties} />}
            </section>
            <div className="owl-shaft-label"><span>MADEN ŞAFTI</span><i>✡</i><span>{bonus ? "DUVAR KALICI" : mode === "diamond" || mode === "obsidian" ? "ÖNCEDEN KAZILMIŞ" : "YENİ DUVAR"}</span></div>
            <section className="owl-block-wall" aria-label="5 çarpı 6 maden duvarı">
              {displayMine.columns.map((column, columnIndex) => (
                <div className="owl-block-column" key={columnIndex}>
                  {column.map((cell, row) => {
                    const damage = cell.maxHp - cell.hp;
                    const activeImpact = impacts.find((candidate) => candidate.column === columnIndex && candidate.row === row);
                    return (
                      <div key={cell.id} className={`owl-block block-${cell.type} ${cell.hp <= 0 ? "broken" : ""} ${activeImpact ? `impact-${activeImpact.kind}` : ""}`} title={`${blockNames[cell.type]} · ${cell.hp}/${cell.maxHp} · ${tuning.blockRules[cell.type].payoutX}×`}>
                        <img src={blockAssets[cell.type]} alt="" />
                        <i style={{ "--crack": `${Math.round((damage / cell.maxHp) * 100)}%` } as CSSProperties} />
                        {cell.hp > 0 && <small aria-label={`${cell.hp} can kaldı`}>{cell.hp}</small>}
                      </div>
                    );
                  })}
                  <div className={`owl-chest ${displayMine.chests[columnIndex].opened ? "open" : ""}`}>
                    <img src={displayMine.chests[columnIndex].opened ? specialAssets.openChest : specialAssets.closedChest} alt={displayMine.chests[columnIndex].opened ? "Açık sandık" : "Kilitli sandık"} />
                    {displayMine.chests[columnIndex].multiplier && <b>{displayMine.chests[columnIndex].multiplier}×</b>}
                  </div>
                </div>
              ))}
            </section>

            {actors.map((actor) => <div key={`actor-${actor.id}`} className={`owl-falling-actor ${actor.phase} ${actor.special ? "tnt" : `pickaxe tool-${actor.tool}`}`} style={actorStyle(actor)}>
              <img src={actor.special ? specialAssets.tnt : toolAssets[actor.tool!]} alt="" />
            </div>)}
            {impacts.map((impact) => <div key={`impact-${impact.id}`} className={`owl-impact ${impact.kind}`} style={{ "--impact-x": `${impact.column * 20 + 10}%`, "--impact-y": `calc(var(--wall-top) + ${impact.row} * var(--block-step))` } as CSSProperties}><b />{impact.kind === "blast" && Array.from({ length: 12 }, (_, spark) => <i key={spark} style={{ "--spark-angle": `${spark * 30}deg` } as CSSProperties} />)}</div>)}
            {bursts.map((burst) => <span key={`burst-${burst.id}`} className={`owl-win-burst ${burst.kind}`} style={{ left: `${burst.column * 20 + 10}%`, top: `calc(var(--wall-top) + ${burst.row} * var(--block-step))` }}>{burst.kind === "chest" ? `${money.format(burst.amount)}× ÇARPAN` : burst.amount > 0 ? `+${money.format(burst.amount)} PR` : "KIRILDI"}</span>)}
          </div>
          <aside className="owl-live-panel">
            <div><small>AKTİF PROFİL</small><b>{bonus ? bonusCopy[bonus.tier].title : modeCopy[mode].title}</b><span>{bonus ? bonusCopy[bonus.tier].detail : modeCopy[mode].detail}</span></div>
            <div className="owl-risk"><small>VOLATİLİTE</small><span>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < modeCopy[mode].risk ? "on" : ""} />)}</span></div>
            <div><small>TUR KAZANCI</small><strong>{money.format(roundWinX * wager)} PR</strong><span>{money.format(roundWinX)}× temel bahis</span></div>
            {bonus && <div className="owl-bonus-progress"><small>BİRİKEN BLOK KAZANCI</small><strong>{money.format(bonusDisplayedTotal)} PR</strong><b>{bonus.played} oynandı · {bonus.remaining} kaldı</b><span>{bonus.openedChests} sandık açıldı · {money.format(bonus.progress.chestMultiplierX)}× çarpan bonus sonunda tek seferde uygulanır</span></div>}
          </aside>
        </div>

        <div className="owl-mine-notice" role="status"><i className={phase === "dig" ? "working" : ""} />{notice}</div>
        <section className="owl-mine-controls">
          <button className="owl-feature-button" onClick={() => setBuyOpen(true)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)}><img src={specialAssets.eye} alt="" /><span><small>VOLATİLİTE ANAHTARI</small>{mode === "base" ? "ÖZEL MODLAR" : modeCopy[mode].title}</span></button>
          <label className="owl-bet-control"><span>TEMEL BAHİS</span><div>
            <button type="button" onClick={() => updateWager(settings.minBet)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)}>MİN</button>
            <button type="button" onClick={() => updateWager((value) => value - betStep)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)} aria-label="Bahsi azalt">−</button>
            <input aria-label="Temel bahis" inputMode="decimal" type="number" min={settings.minBet} max={maxWager} step={betStep} value={wager} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)} onChange={(event) => updateWager(Number(event.target.value))} />
            <button type="button" onClick={() => updateWager((value) => value + betStep)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)} aria-label="Bahsi artır">+</button>
            <button type="button" onClick={() => updateWager(maxWager)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)}>MAKS</button>
            <button type="button" className="owl-bet-more" aria-label="Gelişmiş bahis ayarları" aria-expanded={betToolsOpen} onClick={() => setBetToolsOpen((value) => !value)} disabled={busy || Boolean(bonus) || Boolean(autoRemaining)}>•••</button>
          </div></label>
          <button className={`owl-turbo ${turbo ? "on" : ""}`} disabled={busy || Boolean(autoRemaining)} onClick={() => { setTurbo((value) => !value); setQuick(false); }}>⚡<small>{turbo ? "TURBO" : "NORMAL"}</small></button>
          <button className={`owl-auto-button ${autoRemaining ? "active" : ""}`} disabled={!settings.autoplay || (busy && !autoRemaining)} onClick={() => autoRemaining ? stopAuto() : setAutoOpen(true)}>↻<small>{autoRemaining ? `DUR · ${autoRemaining}` : "AUTO BET"}</small></button>
          <button className="owl-spin" disabled={!canPlay || Boolean(autoRemaining)} onClick={() => void playPaidSpin()}><span>{busy ? "KAZILIYOR" : "DÜŞÜR"}</span><small>{money.format(currentCost)} PR</small></button>
          <button className="owl-rules-button" onClick={() => setRulesOpen(true)}>i<small>KURALLAR</small></button>
        </section>
      </section>

      <footer className="owl-mine-footer"><div><span className="owl-mini-mark">✡</span><p><small>SADECE EĞLENCE İÇİN</small>PR jetonlarının gerçek para değeri yoktur.</p></div><GameMusicControls game="baykus-madeni" /></footer>
      {busy && phase !== "idle" && <div className="owl-skip-hint" aria-hidden="true">EKRANA TIKLA · ANİMASYONU ATLA</div>}

      {autoOpen && <div className="owl-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAutoOpen(false)}>
        <section className="owl-auto-modal" role="dialog" aria-modal="true" aria-labelledby="owl-auto-title">
          <button className="owl-auto-close" onClick={() => setAutoOpen(false)}>×</button>
          <small>PRAGMATIC DÜZENİ</small>
          <h2 id="owl-auto-title">AUTOPLAY AYARLARI</h2>
          <div className="owl-auto-speed" role="group" aria-label="Otomatik dönüş hızı">
            <button className={turbo ? "active" : ""} aria-pressed={turbo} onClick={() => { const next = !turbo; setTurbo(next); if (next) setQuick(false); }}><i>{turbo ? "✓" : ""}</i><span>TURBO SPIN</span></button>
            <button className={quick ? "active" : ""} aria-pressed={quick} onClick={() => { const next = !quick; setQuick(next); if (next) setTurbo(false); }}><i>{quick ? "✓" : ""}</i><span>QUICK SPIN</span></button>
            <button className={autoSkipScreens ? "active" : ""} aria-pressed={autoSkipScreens} onClick={() => setAutoSkipScreens((value) => !value)}><i>{autoSkipScreens ? "✓" : ""}</i><span>EKRANLARI ATLA</span></button>
          </div>
          <div className="owl-auto-count">
            <div><span>OTOMATİK DÖNÜŞ SAYISI</span><strong>{autoCount}</strong></div>
            <input aria-label="Otomatik dönüş sayısı" type="range" min={1} max={1000} step={1} value={autoCount} style={{ "--auto-progress": `${((autoCount - 1) / 999) * 100}%` } as CSSProperties} onChange={(event) => setAutoCount(Math.min(1000, Math.max(1, Number(event.target.value))))} />
            <div className="owl-auto-presets">{[10, 25, 50, 100, 250, 500, 1000].map((count) => <button key={count} className={autoCount === count ? "active" : ""} onClick={() => setAutoCount(count)}>{count}</button>)}</div>
          </div>
          <div className="owl-auto-preview"><span>TOPLAM BAHİS</span><b>{money.format(currentCost * autoCount)} PR</b></div>
          <button className="owl-auto-start" onClick={startAuto} disabled={balance < currentCost}>AUTOPLAY’İ BAŞLAT ({autoCount})</button>
        </section>
      </div>}

      {betToolsOpen && <div className="owl-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBetToolsOpen(false)}>
        <section className="owl-auto-modal owl-bet-modal" role="dialog" aria-modal="true" aria-labelledby="owl-bet-title">
          <button className="owl-auto-close" onClick={() => setBetToolsOpen(false)}>×</button>
          <small>BAHİS MENÜSÜ</small>
          <h2 id="owl-bet-title">BAHİS AYARLARI</h2>
          <div className="owl-bet-modal-current"><span>SEÇİLİ TEMEL BAHİS</span><strong>{money.format(wager)} PR</strong></div>
          <div className="owl-bet-modal-actions">
            <button onClick={() => updateWager(settings.minBet)}><small>EN DÜŞÜK</small><b>MİN</b></button>
            <button onClick={() => updateWager((value) => Math.max(settings.minBet, Math.floor(value / 2)))}><small>YARIYA İNDİR</small><b>½</b></button>
            <button onClick={() => updateWager((value) => value * 2)}><small>İKİYE KATLA</small><b>2×</b></button>
            <button onClick={() => updateWager(maxWager)}><small>EN YÜKSEK</small><b>MAKS</b></button>
          </div>
          <label className="owl-bet-modal-step"><span>ARTIŞ ADIMI</span><select value={betStep} onChange={(event) => setBetStep(Number(event.target.value))} aria-label="Bahis artış adımı">{CASINO_BET_STEPS.map((step) => <option key={step} value={step}>Adım {compactWager(step)} PR</option>)}</select></label>
          <button className="owl-auto-start" onClick={() => setBetToolsOpen(false)}>TAMAM</button>
        </section>
      </div>}

      {buyOpen && <div className="owl-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setBuyOpen(false)}>
        <article className="owl-bonus-shop">
          <header><div><small>BAYKUŞ MÜHRÜ · VOLATİLİTE ANAHTARI</small><h2>Kazı rotanı seç</h2><p>Üst sıra her dönüşte etkin kalır. Alt sıra tek seferlik bonus seansı satın alır.</p></div><div className="owl-shop-bet"><small>AKTİF BAHİS</small><div><button aria-label="Bahsi azalt" onClick={() => updateWager((value) => value - betStep)}>−</button><strong>{money.format(wager)} PR</strong><button aria-label="Bahsi artır" onClick={() => updateWager((value) => value + betStep)}>+</button></div></div><button onClick={() => setBuyOpen(false)}>×</button></header>
          <div className="owl-mode-cards">
            {(["extra", "super", "diamond", "obsidian"] as MinePaidMode[]).map((key) => <button key={key} className={`owl-shop-card mode-${key} ${mode === key ? "active" : ""}`} onClick={() => selectMode(key)}>
              <img src={key === "diamond" ? toolAssets.diamond : key === "obsidian" ? toolAssets.obsidian : specialAssets.eye} alt="" />
              <span className="owl-vol-pips">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < modeCopy[key].risk ? "on" : ""} />)}</span>
              <small>DÖNÜŞ BAŞINA</small><b>{modeCopy[key].title}</b><strong>{money.format(wager * tuning.modeCosts[key])} PR</strong><p>{modeCopy[key].detail}</p><em>{mode === key ? "SEÇİMİ KALDIR" : "ETKİNLEŞTİR"}</em>
            </button>)}
          </div>
          <div className="owl-buy-cards">
            {([
              { kind: "block", label: "Blok Bonusu", costX: tuning.bonusCosts.block, icon: specialAssets.book, detail: `${tuning.bonusSpins} otomatik dönüş · kalıcı duvar`, tone: "block" },
              { kind: "super", label: "Süper Blok Bonusu", costX: tuning.bonusCosts.super, icon: toolAssets.iron, detail: "Bronz yok · Demir en düşük", tone: "super" },
              { kind: "mystery", label: "Gizemli Dönüş", costX: tuning.bonusCosts.mystery, icon: specialAssets["max-book"], detail: "Boş · Süper · Epik mühür", tone: "mystery" },
            ] as const).map((card) => <button key={card.kind} className={`owl-shop-card buy-${card.tone}`} onClick={() => setPendingBuy(card)}>
              <img src={card.icon} alt="" /><small>TEK SEFERLİK</small><b>{card.label}</b><strong>{money.format(wager * card.costX)} PR</strong><p>{card.detail}</p><em>SATIN AL</em>
            </button>)}
          </div>
          <button className="owl-normal-mode" onClick={() => selectMode("base")}>Normal kazıya dön · {money.format(wager)} PR</button>
        </article>
      </div>}

      {pendingBuy && <div className="owl-modal-backdrop"><article className="owl-confirm-card"><img src={pendingBuy.kind === "mystery" ? specialAssets["max-book"] : pendingBuy.kind === "super" ? toolAssets.iron : specialAssets.book} alt="" /><small>BONUS MÜHRÜ</small><h2>{pendingBuy.label}</h2><p>Aktif bahis: {money.format(wager)} PR</p><strong>Bonus bedeli: {money.format(wager * pendingBuy.costX)} PR</strong><div><button onClick={() => setPendingBuy(undefined)}>VAZGEÇ</button><button onClick={() => void confirmPurchase()}>MÜHRÜ AÇ</button></div></article></div>}

      {featureIntro && bonus && <div className={`owl-feature-intro tier-${featureIntro}`}><div className="owl-feature-rays" /><img src={featureIntro === "block" ? specialAssets.eye : featureIntro === "super" ? toolAssets.iron : toolAssets.obsidian} alt="" /><small>{bonusCopy[featureIntro].eyebrow}</small><h2>{bonusCopy[featureIntro].title}</h2><p>{bonusCopy[featureIntro].detail}</p><div><b>{tuning.bonusSpins}</b><span>SABİT OTOMATİK DÖNÜŞ<br />EK TUR VERİLMEZ</span></div><button onClick={() => void runBonusSequence()}>KAZIYI BAŞLAT</button></div>}

      {mysteryReveal && <div className={`owl-mystery-stage ${mysteryReveal.revealed ? "revealed" : "shuffling"}`}><small>GİZEMLİ DÖNÜŞ</small><h2>Üç mühürden biri açılıyor</h2><div>{(["none", "super", "epic"] as const).map((outcome) => <span key={outcome} className={mysteryReveal.revealed && mysteryReveal.outcome === outcome ? "selected" : ""}><img src={outcome === "none" ? specialAssets.closedChest : outcome === "super" ? toolAssets.iron : toolAssets.obsidian} alt="" /><b>{mysteryReveal.revealed && mysteryReveal.outcome === outcome ? { none: "BOŞ GALERİ", super: "SÜPER", epic: "EPİK" }[outcome] : "?"}</b></span>)}</div></div>}

      {bonusFinale && <div className={`owl-bonus-finale tier-${finaleTier.tone} stage-${bonusFinaleStage}`} role="dialog" aria-modal="true" aria-label="Bonus sonucu">
        <div className="owl-finale-rays" />
        <article>
          <div className="owl-finale-chest-bank" aria-label="Toplanan sandık çarpanları">
            {bonusFinale.chestValues.length
              ? bonusFinale.chestValues.map((value, index) => <span key={`${value}-${index}`} style={{ "--chest-order": index } as CSSProperties}>{money.format(value)}×</span>)
              : <span className="empty">1×</span>}
            <i>=</i><b>{money.format(bonusFinale.chestMultiplierX)}×</b>
          </div>
          <img src={specialAssets.openChest} alt="Açık ödül sandığı" />
          <small>{bonusFinale.title.toUpperCase()} · BONUS SONUCU</small>
          <h2>{finaleTier.label}</h2>
          <p>{bonusFinaleStage === "collecting" ? "SANDIK ÇARPANLARI TOPLANIYOR" : `BİRİKEN BLOK KASASI × ${money.format(bonusFinale.chestMultiplierX)}×`}</p>
          <strong aria-live="polite">{money.format(bonusFinaleAmount)} PR</strong>
          <b>{money.format(finaleMultiplier)}× TEMEL BAHİS</b>
          <div><span><b>{bonusFinale.spins}</b> dönüş</span><span><b>{bonusFinale.chests}</b> sandık</span></div>
          <button disabled={!bonusFinaleDone} onClick={() => setBonusFinale(undefined)}>{bonusFinaleDone ? "MADENE DÖN" : "KAZANÇ HESAPLANIYOR…"}</button>
        </article>
      </div>}

      {summary && <div className="owl-modal-backdrop"><article className="owl-summary-card"><img src={specialAssets.openChest} alt="" /><small>BONUS TAMAMLANDI</small><h2>{summary.title}</h2><p className="owl-summary-label">TOPLAM KAZANCIN</p><strong>{money.format(summary.total)} PR</strong><div><span><b>{summary.spins}</b> dönüş</span><span><b>{summary.chests}</b> sandık</span></div><button onClick={() => setSummary(undefined)}>MADENE DÖN</button></article></div>}

      {rulesOpen && <div className="owl-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRulesOpen(false)}><article className="owl-rules">
        <header><div><small>CANLI OYUN KILAVUZU</small><h2>Her darbe görünür</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
        <p>Kazmalar 5×3 panelden yalnız kendi sütunlarına düşer. Her salınım 1 hasar verir; kazma yukarı seker ve kalan dayanıklılığıyla aynı dikey hattaki bir sonraki sağlam bloğa yeniden düşer. Basamaklı yüzey nedeniyle sütun yükseklikleri farklı başlayabilir. Sütundaki altı mantıksal katman temizlenince sandık anında açılır.</p>
        <h3>Kazmalar</h3><div className="owl-rule-grid tools">{(Object.keys(tuning.toolDurability) as MineTool[]).map((tool) => <span key={tool}><img src={toolAssets[tool]} alt="" /><b>{toolNames[tool]}</b>{tuning.toolDurability[tool]} ayrı vuruş</span>)}</div>
        <h3>Bloklar</h3><div className="owl-rule-grid blocks">{(Object.keys(tuning.blockRules) as MineBlock[]).map((block) => <span key={block}><img src={blockAssets[block]} alt="" /><b>{blockNames[block]}</b>{tuning.blockRules[block].hp} vuruş · {block === "mystery" ? "2,5–100×" : `${tuning.blockRules[block].payoutX}×`}</span>)}</div>
        <h3>Özel akış</h3><ul><li>Geliştirme kitabı bütün kazmaları en az Elmas; MAX kitap Obsidyen yapar.</li><li>TNT kazmalardan sonra düşer ve 3×3 alana 2 hasar verir.</li><li>Patlayıcı Cevher kırılınca sekiz komşusuna 1 hasar gönderir; zincirleme patlayabilir.</li><li>Bir sütun temizlenince sandık açılır. Normal, Elmas ve Obsidyen dönüşlerde sandıklar o turun blok kazancını çarpar. Blok, Süper ve Epik bonuslarda sandık çarpanları dönüşler arasında korunur ve özel oyun boyunca biriken bütün blok kazancına uygulanır. Birden fazla sandığın çarpanları birbiriyle çarpılır. Önceden ödenen tutar tekrar eklenmez; yalnız toplam kazançtaki artış bakiyeye geçer.</li><li>3/4/5 Göz, Blok/Süper/Epik bonus açar. Bonus duvarı korunur ve bonus sabit tur sayısında tamamlanır. Gizemli Dönüşten açılan bonuslar da aynı birikim kuralını kullanır. Doğal bonusta tetikleyen elin ödemesi ayrıdır; o el ve devamındaki bonus birlikte azami ödeme sınırına tabidir.</li><li>Elmas ve Obsidyen dönüşleri önceden kazılmış sahayla başlar; satır sayısı admin panelinden değişir.</li></ul>
        <button className="owl-rules-close" onClick={() => setRulesOpen(false)}>Madene dön</button>
      </article></div>}
    </main>
  );
}
