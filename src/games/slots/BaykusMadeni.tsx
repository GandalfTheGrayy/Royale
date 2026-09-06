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
import { SlotAudio } from "./slot-audio";
import {
  cloneMine,
  createMine,
  rollMysteryOutcome,
  runMineSpin,
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
  openedChests: number;
  mine: MineState;
};
type Actor = {
  id: number;
  column: number;
  sourceRow: number;
  targetRow: number;
  tool?: MineTool;
  special?: "tnt";
  phase: "drop" | "bounce" | "hit";
};
type Burst = { id: number; column: number; row: number; valueX: number; kind: "block" | "chest" };
type ChestMath = {
  id: number;
  blockWinX: number;
  chestMultiplierX: number;
  totalWinX: number;
  payout: number;
  credited: boolean;
};
type PendingBuy = { kind: MineBonusTier | "mystery"; label: string; costX: number };

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

const sleep = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

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
  const [mode, setMode] = useState<MinePaidMode>("base");
  const [mine, setMine] = useState(() => createMine(undefined, tuning));
  const [displayMine, setDisplayMine] = useState(() => cloneMine(mine));
  const [reel, setReel] = useState<MineReelSymbol[][]>(() => emptyReel());
  const [result, setResult] = useState<MineSpinResult>();
  const [bonus, setBonus] = useState<BonusSession>();
  const [busy, setBusy] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reel" | "dig" | "settle">("idle");
  const [actors, setActors] = useState<Actor[]>([]);
  const [impacts, setImpacts] = useState<Array<{ id: number; column: number; row: number; kind: "hit" | "blast" }>>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [chestMath, setChestMath] = useState<ChestMath>();
  const [roundWinX, setRoundWinX] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [pendingBuy, setPendingBuy] = useState<PendingBuy>();
  const [featureIntro, setFeatureIntro] = useState<MineBonusTier>();
  const [summary, setSummary] = useState<{ title: string; total: number; spins: number; chests: number }>();
  const [mysteryReveal, setMysteryReveal] = useState<{ outcome: "none" | "super" | "epic"; revealed: boolean }>();
  const [notice, setNotice] = useState("Dönüşü başlat; kazmalar makaradan düşüp blokları tek tek parçalasın.");
  const audioRef = useRef<SlotAudio | undefined>(undefined);
  const mountedRef = useRef(true);
  const balanceRef = useRef(balance);
  const eventId = useRef(0);
  audioRef.current ??= new SlotAudio("baykus-madeni");

  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => {
    // React StrictMode runs an extra setup/cleanup cycle in development. Resetting
    // this guard here keeps asynchronous presentations alive after that cycle.
    mountedRef.current = true;
    return () => { mountedRef.current = false; audioRef.current?.dispose(); };
  }, []);
  useEffect(() => { audioRef.current!.enabled = settings.sound && admin.general.masterSound; }, [settings.sound, admin.general.masterSound]);

  const currentCost = bonus ? 0 : wager * tuning.modeCosts[mode];
  const canPlay = !busy && !bonus && balance >= currentCost;
  const brokenCount = useMemo(() => displayMine.columns.flat().filter((cell) => cell.hp <= 0).length, [displayMine]);
  const bonusDisplayedTotal = bonus ? bonus.totalWin + roundWinX * wager : 0;
  const animationScale = turbo ? tuning.animation.turboScale : 1;
  const wait = (milliseconds: number) => sleep(Math.max(24, Math.round(milliseconds * animationScale)));

  const changeBalance = (delta: number) => {
    balanceRef.current = Math.round((balanceRef.current + delta) * 100) / 100;
    setBalance(balanceRef.current);
  };

  const addBurst = (event: MineSpinEvent, kind: Burst["kind"]) => {
    if (event.column === undefined || event.valueX === undefined) return;
    const id = ++eventId.current;
    setBursts((current) => [...current.slice(-7), { id, column: event.column!, row: event.row ?? 6, valueX: event.valueX!, kind }]);
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

  const playPresentation = async (spinResult: MineSpinResult) => {
    setResult(undefined);
    setRoundWinX(0);
    setActors([]);
    setImpacts([]);
    setBursts([]);
    setChestMath(undefined);
    setDisplayMine(cloneMine(spinResult.initialMine));
    setReel(spinResult.reel.map((row) => row.map((symbol) => ({ ...symbol }))));
    setPhase("reel");
    setNotice("Maden işaretleri hazırlanıyor…");
    audioRef.current?.play("spin");
    await wait(tuning.animation.reelMs);
    if (!mountedRef.current) return;
    audioRef.current?.play("stop", 4);
    await wait(tuning.animation.bounceMs);
    setPhase("dig");
    let displayedBlockWin = 0;
    let displayedChestMultiplier = 1;

    for (const event of spinResult.events.filter((candidate) => candidate.kind === "upgrade")) {
      if (!mountedRef.current) return;
      if (event.kind === "upgrade") {
        setNotice(event.label);
        audioRef.current?.play("mystery");
        setImpacts([{ id: ++eventId.current, column: 2, row: 0, kind: "blast" }]);
        await wait(tuning.animation.blastMs);
      }
    }

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
        const dropActors = drops.map((event) => ({
          id: ++eventId.current,
          column: event.column!, sourceRow: event.sourceRow ?? 0, targetRow: Math.max(0, event.targetRow ?? 0),
          tool: event.tool, special: event.special === "tnt" ? "tnt" as const : undefined, phase: "drop" as const,
        }));
        setNotice(drops.some((event) => event.special === "tnt") ? `${drops.length} TNT birlikte düşüyor!` : `${drops.length} kazma aynı anda madene düşüyor.`);
        const removed = new Set(drops.map((event) => `${event.sourceRow ?? 0}-${event.sourceColumn ?? event.column}`));
        setReel((current) => current.map((row, rowIndex) => row.map((symbol, columnIndex) => removed.has(`${rowIndex}-${columnIndex}`) ? { kind: "special", special: "empty" } : symbol)));
        setActors(dropActors);
        drops.slice(0, 5).forEach((event) => audioRef.current?.play("powerLand", event.column));
        await wait(tuning.animation.dropMs);
        setActors((current) => current.map((actor) => ({ ...actor, phase: "bounce" })));
        await wait(tuning.animation.bounceMs);
      }

      if (hits.length || blasts.length) {
        const hitActors = hits.filter((event) => event.tool).map((event) => ({
          id: ++eventId.current, column: event.column!, sourceRow: event.sourceRow ?? 0, targetRow: event.row!, tool: event.tool, phase: "hit" as const,
        }));
        setActors(hitActors);
        setImpacts([
          ...hits.map((event) => ({ id: ++eventId.current, column: event.column!, row: event.row!, kind: event.special ? "blast" as const : "hit" as const })),
          ...blasts.map((event) => ({ id: ++eventId.current, column: event.column!, row: event.row ?? event.targetRow ?? 0, kind: "blast" as const })),
        ]);
        updateDisplayMine(waveEvents);
        setNotice(blasts.length ? `${blasts.length} patlama madeni sarstı!` : `${hits.length} kazma aynı anda vurup sekiyor.`);
        audioRef.current?.play("cascade", hits[0]?.column ?? blasts[0]?.column ?? 0);
        if (blasts.length) audioRef.current?.play("collector");
      } else if (chests.length) updateDisplayMine(waveEvents);

      for (const event of breaks) {
        displayedBlockWin += event.valueX ?? 0;
        addBurst(event, "block");
        audioRef.current?.play(event.valueX && event.valueX >= 5 ? "multiplier" : "coin");
      }
      for (const event of chests) {
        displayedChestMultiplier *= event.valueX ?? 1;
        addBurst(event, "chest");
        audioRef.current?.play("multiplierImpact", event.column ?? 0);
      }
      if (chests.length) {
        const totalWinX = displayedBlockWin * displayedChestMultiplier;
        setChestMath({
          id: ++eventId.current,
          blockWinX: displayedBlockWin,
          chestMultiplierX: displayedChestMultiplier,
          totalWinX,
          payout: Math.round(wager * totalWinX * 100) / 100,
          credited: false,
        });
        setNotice(`${chests.length} sandık açıldı · ${money.format(displayedBlockWin)}× blok kazancı ${money.format(displayedChestMultiplier)}× ile çarpılıyor.`);
      }
      setRoundWinX(displayedBlockWin * displayedChestMultiplier);
      const waveWait = Math.max(
        hits.length ? tuning.animation.hitMs : 0,
        breaks.length ? tuning.animation.breakMs : 0,
        blasts.length ? tuning.animation.blastMs : 0,
        chests.length ? tuning.animation.chestMs : 0,
      );
      if (waveWait) await wait(waveWait);
    }
    setActors([]);
    setImpacts([]);
    setPhase("settle");
    setDisplayMine(cloneMine(spinResult.mine));
    setRoundWinX(spinResult.totalWinX);
    setResult(spinResult);
    await wait(tuning.animation.countUpMs);
    setPhase("idle");
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
        telemetryVersion: 2, rngModel: tuning.profileName, visibleRuleset: "minedrop-2-flow-reconstruction-v2",
        reel: spinResult.reel, mine: spinResult.mine, eyeCount: spinResult.eyeCount, triggeredBonus: spinResult.triggeredBonus,
        blockWinX: spinResult.blockWinX, chestMultiplierX: spinResult.chestMultiplierX, grossMultiplier: spinResult.totalWinX, events: spinResult.events,
      },
      modifiers: { bonus: Boolean(activeBonus), bonusTier: activeBonus?.tier, bonusSource: activeBonus?.source, mode: activeMode, costX: activeBonus ? 0 : tuning.modeCosts[activeMode] },
    });
    if (cost) void recordWalletEntry({ id: createRecordId("ledger-stake", roundId), roundId, game: "baykus-madeni", occurredAt: startedAt, type: "stake", amount: -cost, balanceBefore, balanceAfter: balanceBefore - cost, note: `Baykuş Madeni · ${modeCopy[activeMode].title}` });
    if (payout) void recordWalletEntry({ id: createRecordId("ledger-payout", roundId), roundId, game: "baykus-madeni", occurredAt: settledAt, type: "payout", amount: payout, balanceBefore: balanceBefore - cost, balanceAfter: balanceBefore - cost + payout, note: "Baykuş Madeni · blok ve sandık ödemesi" });
  };

  const playPaidSpin = async () => {
    if (!canPlay) { setNotice(`Bu dönüş için ${money.format(currentCost)} PR gerekiyor.`); return; }
    setBusy(true); setBuyOpen(false);
    const activeMode = mode;
    const cost = wager * tuning.modeCosts[activeMode];
    const balanceBefore = balanceRef.current;
    changeBalance(-cost);
    const roundId = `baykus-madeni-${Date.now()}-${crypto.randomUUID()}`;
    const startedAt = new Date().toISOString();
    const spinResult = runMineSpin({ mode: activeMode, tuning });
    await playPresentation(spinResult);
    if (!mountedRef.current) return;
    const payout = Math.round(wager * spinResult.totalWinX * 100) / 100;
    changeBalance(payout);
    showBalanceCredit(payout, spinResult.totalWinX);
    setMine(spinResult.mine);
    recordSpin(spinResult, roundId, startedAt, balanceBefore, cost, payout, activeMode);
    if (spinResult.totalWinX > 0) audioRef.current?.play(spinResult.totalWinX >= 25 ? "bigWin" : "win");
    if (spinResult.eyeCount) audioRef.current?.play("eye");
    if (spinResult.triggeredBonus) {
      const session: BonusSession = { tier: spinResult.triggeredBonus, source: "natural", remaining: tuning.bonusSpins, played: 0, totalWin: 0, openedChests: 0, mine: spinResult.mine };
      setBonus(session); setFeatureIntro(spinResult.triggeredBonus);
      setNotice(`${bonusCopy[spinResult.triggeredBonus].title} açıldı.`);
    } else setNotice(spinResult.totalWinX ? `${money.format(spinResult.totalWinX)}× · ${money.format(payout)} PR` : "Kazmalar sustu; yeni duvar hazırlanıyor.");
    setBusy(false);
  };

  const runBonusSequence = async () => {
    if (!bonus || busy) return;
    setFeatureIntro(undefined); setBusy(true);
    let session = { ...bonus, mine: cloneMine(bonus.mine) };
    while (session.remaining > 0 && session.played < tuning.bonusSpins && mountedRef.current) {
      const balanceBefore = balanceRef.current;
      const roundId = `baykus-madeni-bonus-${Date.now()}-${crypto.randomUUID()}`;
      const startedAt = new Date().toISOString();
      const spinResult = runMineSpin({ mine: session.mine, mode: "base", bonusTier: session.tier, tuning });
      await playPresentation(spinResult);
      if (!mountedRef.current) return;
      const sourceScale = session.source === "mystery" ? tuning.payoutScales.mystery : 1;
      const totalWinX = Math.min(tuning.maxWinX, spinResult.totalWinX * sourceScale);
      const settledResult = { ...spinResult, totalWinX };
      const payout = Math.round(wager * totalWinX * 100) / 100;
      changeBalance(payout);
      showBalanceCredit(payout, totalWinX);
      recordSpin(settledResult, roundId, startedAt, balanceBefore, 0, payout, "base", session);
      session = {
        ...session, mine: spinResult.mine, remaining: session.remaining - 1,
        played: session.played + 1, totalWin: session.totalWin + payout, openedChests: session.openedChests + spinResult.openedChests.length,
      };
      setBonus(session); setMine(spinResult.mine); setRoundWinX(0);
      setNotice(`${bonusCopy[session.tier].title} · ${session.remaining} dönüş kaldı · toplam ${money.format(session.totalWin)} PR`);
      await wait(520);
    }
    if (!mountedRef.current) return;
    setBonus(undefined); setBusy(false);
    setSummary({ title: bonusCopy[session.tier].title, total: session.totalWin, spins: session.played, chests: session.openedChests });
    setNotice(`${bonusCopy[session.tier].title} tamamlandı · ${money.format(session.totalWin)} PR`);
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
        setBonus({ tier, source: "mystery", remaining: tuning.bonusSpins, played: 0, totalWin: 0, openedChests: 0, mine: freshMine });
        setFeatureIntro(tier);
      }
      return;
    }
    recordPurchase(pending, pending.kind);
    const freshMine = createMine(undefined, tuning);
    const tier = pending.kind;
    setMine(freshMine); setDisplayMine(cloneMine(freshMine));
    setBonus({ tier, source: "buy", remaining: tuning.bonusSpins, played: 0, totalWin: 0, openedChests: 0, mine: freshMine });
    setFeatureIntro(tier);
  };

  const selectMode = (next: MinePaidMode) => { setMode(next); setBuyOpen(false); audioRef.current?.play("button"); setNotice(`${modeCopy[next].title} etkin · dönüş maliyeti ${money.format(wager * tuning.modeCosts[next])} PR`); };
  const actorStyle = (actor: Actor) => ({
    "--actor-x": `${actor.column * 20 + 10}%`,
    "--actor-start-y": `calc(var(--reel-center-start) + ${actor.sourceRow} * var(--reel-step))`,
    "--actor-y": `calc(var(--wall-top) + ${actor.targetRow} * var(--block-step))`,
    "--drop-duration": `${Math.max(24, Math.round(tuning.animation.dropMs * animationScale))}ms`,
    "--bounce-duration": `${Math.max(24, Math.round(tuning.animation.bounceMs * animationScale))}ms`,
    "--hit-duration": `${Math.max(24, Math.round(tuning.animation.hitMs * animationScale))}ms`,
  } as CSSProperties);

  return (
    <main className={`owl-mine phase-${phase} ${bonus ? `bonus-${bonus.tier}` : ""} ${chestMath?.credited ? "chest-crediting" : ""}`}>
      <header className="owl-mine-topbar">
        <button onClick={onBack}>← Slot katı</button>
        <div className="owl-mine-title"><img src="/assets/slots/baykus-madeni/owl-mine-emblem-v1.png" alt="" /><span><small>PEHLEVAN ROYALE</small>BAYKUŞ MADENİ</span></div>
        <div className="owl-mine-balance"><small>SANAL BAKİYE</small>{money.format(balance)} PR</div>
      </header>

      <section className="owl-mine-stage">
        <div className="owl-mine-statusbar">
          <span>{bonus ? `${bonusCopy[bonus.tier].title} · ${bonus.remaining} dönüş` : modeCopy[mode].title}</span>
          <b>{bonus ? `${money.format(bonusDisplayedTotal)} PR TOPLAM` : roundWinX > 0 ? `${money.format(roundWinX)}×` : `${money.format(tuning.maxWinX)}× AZAMİ`}</b>
          <span>{phase === "dig" ? "KAZI DEVAM EDİYOR" : `${brokenCount}/30 BLOK · ${result?.eyeCount ?? 0} GÖZ`}</span>
        </div>

        <div className="owl-mine-machine">
          {chestMath && <div key={chestMath.id} className={`owl-chest-math ${chestMath.credited ? "credited" : ""}`} role="status" aria-live="polite">
            <small>SANDIK ÇARPANI UYGULANIYOR</small>
            <div>
              <span><b>{money.format(chestMath.blockWinX)}×</b><em>BLOK</em></span>
              <i>×</i>
              <span className="chest-factor"><b>{money.format(chestMath.chestMultiplierX)}×</b><em>SANDIK</em></span>
              <i>=</i>
              <span className="chest-total"><b>{money.format(chestMath.totalWinX)}×</b><em>TUR ÇARPANI</em></span>
            </div>
            <p>{money.format(wager)} PR bahis × {money.format(chestMath.totalWinX)}× = <strong>{money.format(chestMath.payout)} PR</strong> <b>{chestMath.credited ? "BAKİYEYE EKLENDİ" : "BAKİYEYE EKLENECEK"}</b></p>
          </div>}
          <div className="owl-playfield">
            <div className="owl-depth-rail"><span>YÜZEY</span><i /><span>DERİN GALERİ</span></div>
            <section className="owl-reels" aria-label="5 çarpı 3 düşüş paneli">
              {reel.map((row, rowIndex) => row.map((symbol, column) => (
                <div key={`${rowIndex}-${column}`} className={`owl-reel-symbol ${symbol.kind === "tool" ? `tool-${symbol.tool}` : `special-${symbol.special}`}`} style={{ "--reel-column": column, "--reel-row": rowIndex, "--reel-duration": `${tuning.animation.reelMs}ms` } as CSSProperties}>
                  <SymbolArt symbol={symbol} />
                </div>
              )))}
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
            {bursts.map((burst) => <span key={`burst-${burst.id}`} className={`owl-win-burst ${burst.kind}`} style={{ left: `${burst.column * 20 + 10}%`, top: `calc(var(--wall-top) + ${burst.row} * var(--block-step))` }}>{burst.kind === "chest" ? `${money.format(burst.valueX)}× ÇARPAN` : burst.valueX > 0 ? `+${money.format(burst.valueX)}×` : "KIRILDI"}</span>)}
          </div>
          <aside className="owl-live-panel">
            <div><small>AKTİF PROFİL</small><b>{bonus ? bonusCopy[bonus.tier].title : modeCopy[mode].title}</b><span>{bonus ? bonusCopy[bonus.tier].detail : modeCopy[mode].detail}</span></div>
            <div className="owl-risk"><small>VOLATİLİTE</small><span>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < modeCopy[mode].risk ? "on" : ""} />)}</span></div>
            <div><small>TUR KAZANCI</small><strong>{money.format(roundWinX * wager)} PR</strong><span>{money.format(roundWinX)}× temel bahis</span></div>
            {bonus && <div className="owl-bonus-progress"><small>TOPLAM BONUS KAZANCI</small><strong>{money.format(bonusDisplayedTotal)} PR</strong><b>{bonus.played} oynandı · {bonus.remaining} kaldı</b><span>{bonus.openedChests} sandık açıldı · bonus bitince sonuç raporu gösterilir</span></div>}
          </aside>
        </div>

        <div className="owl-mine-notice" role="status"><i className={phase === "dig" ? "working" : ""} />{notice}</div>
        <section className="owl-mine-controls">
          <button className="owl-feature-button" onClick={() => setBuyOpen(true)} disabled={busy}><img src={specialAssets.eye} alt="" /><span><small>VOLATİLİTE ANAHTARI</small>{mode === "base" ? "ÖZEL MODLAR" : modeCopy[mode].title}</span></button>
          <label><span>TEMEL BAHİS</span><div><button disabled={busy} onClick={() => setWager((value) => Math.max(settings.minBet, value - 5))}>−</button><b>{money.format(wager)} PR</b><button disabled={busy} onClick={() => setWager((value) => value + 5)}>+</button></div></label>
          <button className={`owl-turbo ${turbo ? "on" : ""}`} disabled={busy} onClick={() => setTurbo((value) => !value)}>⚡<small>{turbo ? "TURBO" : "NORMAL"}</small></button>
          <button className="owl-spin" disabled={!canPlay} onClick={() => void playPaidSpin()}><span>{busy ? "KAZILIYOR" : "DÜŞÜR"}</span><small>{money.format(currentCost)} PR</small></button>
          <button className="owl-rules-button" onClick={() => setRulesOpen(true)}>i<small>KURALLAR</small></button>
        </section>
      </section>

      <footer className="owl-mine-footer"><div><span className="owl-mini-mark">✡</span><p><small>SADECE EĞLENCE İÇİN</small>PR jetonlarının gerçek para değeri yoktur.</p></div><GameMusicControls game="baykus-madeni" /></footer>

      {buyOpen && <div className="owl-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setBuyOpen(false)}>
        <article className="owl-bonus-shop">
          <header><div><small>BAYKUŞ MÜHRÜ · VOLATİLİTE ANAHTARI</small><h2>Kazı rotanı seç</h2><p>Üst sıra her dönüşte etkin kalır. Alt sıra tek seferlik bonus seansı satın alır.</p></div><div className="owl-shop-bet"><small>AKTİF BAHİS</small><div><button aria-label="Bahsi azalt" onClick={() => setWager((value) => Math.max(settings.minBet, value - 5))}>−</button><strong>{money.format(wager)} PR</strong><button aria-label="Bahsi artır" onClick={() => setWager((value) => value + 5)}>+</button></div></div><button onClick={() => setBuyOpen(false)}>×</button></header>
          <div className="owl-mode-cards">
            {(["extra", "super", "diamond", "obsidian"] as MinePaidMode[]).map((key) => <button key={key} className={`owl-shop-card mode-${key} ${mode === key ? "active" : ""}`} onClick={() => selectMode(key)}>
              <img src={key === "diamond" ? toolAssets.diamond : key === "obsidian" ? toolAssets.obsidian : specialAssets.eye} alt="" />
              <span className="owl-vol-pips">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < modeCopy[key].risk ? "on" : ""} />)}</span>
              <small>DÖNÜŞ BAŞINA</small><b>{modeCopy[key].title}</b><strong>{money.format(wager * tuning.modeCosts[key])} PR</strong><p>{modeCopy[key].detail}</p><em>{mode === key ? "ETKİN" : "ETKİNLEŞTİR"}</em>
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

      {summary && <div className="owl-modal-backdrop"><article className="owl-summary-card"><img src={specialAssets.openChest} alt="" /><small>BONUS TAMAMLANDI</small><h2>{summary.title}</h2><p className="owl-summary-label">TOPLAM KAZANCIN</p><strong>{money.format(summary.total)} PR</strong><div><span><b>{summary.spins}</b> dönüş</span><span><b>{summary.chests}</b> sandık</span></div><button onClick={() => setSummary(undefined)}>MADENE DÖN</button></article></div>}

      {rulesOpen && <div className="owl-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRulesOpen(false)}><article className="owl-rules">
        <header><div><small>CANLI OYUN KILAVUZU</small><h2>Her darbe görünür</h2></div><button onClick={() => setRulesOpen(false)}>×</button></header>
        <p>Kazmalar 5×3 panelden yalnız kendi sütunlarına düşer. Her salınım 1 hasar verir; kazma yukarı seker ve kalan dayanıklılığıyla aynı dikey hattaki bir sonraki sağlam bloğa yeniden düşer. Basamaklı yüzey nedeniyle sütun yükseklikleri farklı başlayabilir. Sütundaki altı mantıksal katman temizlenince sandık anında açılır.</p>
        <h3>Kazmalar</h3><div className="owl-rule-grid tools">{(Object.keys(tuning.toolDurability) as MineTool[]).map((tool) => <span key={tool}><img src={toolAssets[tool]} alt="" /><b>{toolNames[tool]}</b>{tuning.toolDurability[tool]} ayrı vuruş</span>)}</div>
        <h3>Bloklar</h3><div className="owl-rule-grid blocks">{(Object.keys(tuning.blockRules) as MineBlock[]).map((block) => <span key={block}><img src={blockAssets[block]} alt="" /><b>{blockNames[block]}</b>{tuning.blockRules[block].hp} vuruş · {block === "mystery" ? "2,5–100×" : `${tuning.blockRules[block].payoutX}×`}</span>)}</div>
        <h3>Özel akış</h3><ul><li>Geliştirme kitabı bütün kazmaları Elmas; MAX kitap Obsidyen yapar.</li><li>TNT kazmalardan sonra düşer ve 3×3 alana 2 hasar verir.</li><li>Patlayıcı Cevher kırılınca sekiz komşusuna 1 hasar gönderir; zincirleme patlayabilir.</li><li>Bir sütun temizlenince sandık açılır ve değeri o turun bütün blok kazancını çarpar. Aynı turda açılan birden fazla sandık sırayla çarpılır.</li><li>3/4/5 Göz, Blok/Süper/Epik bonus açar. Bonus duvarı dönüşler arasında korunur ve bonus admin panelinde tanımlı sabit tur sayısında tamamlanır.</li><li>Elmas ve Obsidyen dönüşleri önceden kazılmış sahayla başlar; satır sayısı admin panelinden değişir.</li></ul>
        <button className="owl-rules-close" onClick={() => setRulesOpen(false)}>Madene dön</button>
      </article></div>}
    </main>
  );
}
