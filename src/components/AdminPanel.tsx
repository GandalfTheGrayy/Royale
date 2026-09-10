import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ALLAH_PRESET_COPY,
  DEFAULT_ALLAH_TUNING,
  DEFAULT_MINE_DROP_TUNING,
  applyAdminAllahPreset,
  applyAdminMineDropPreset,
  applyAdminSlotPreset,
  getAdminSettings,
  resetAdminSettings,
  SLOT_PRESET_COPY,
  subscribeAdminSettings,
  updateAdminGame,
  updateGeneralSettings,
  type SlotMathSettings,
  type AllahPresetId,
  type SlotFlowSettings,
  type SlotPotentialSettings,
  type SlotPresetId,
  type SlotPresentationSettings,
  type SlotProgressionSettings,
} from "../data/casino-admin";
import {
  clearCasinoResearchData,
  exportCasinoResearchJson,
  exportCasinoRoundsCsv,
  getAIConversations,
  getCasinoEvents,
  getCasinoRounds,
  getCasinoStorageStats,
  getCasinoSummary,
  getWalletLedger,
  subscribeCasinoDatabase,
  type AIConversationRecord,
  type CasinoEventRecord,
  type CasinoGameId,
  type CasinoRoundRecord,
  type CasinoStorageStats,
  type CasinoSummary,
  type WalletLedgerRecord,
} from "../data/casino-database";
import "./admin-panel.css";
import "./admin-data.css";
import {
  GAME_MUSIC_TRACKS,
  removeUploadedMusic,
  resolveMusicSource,
  saveUploadedMusic,
} from "../audio/casino-music";
import AccountAdmin from "../auth/AccountAdmin";
import { accountRequest } from "../auth/auth-api";
import { useAuth } from "../auth/auth-client";
import {
  type SimulatableSlotId,
} from "../games/slots/slot-simulation-engine";
import SlotSimulationPanel from "./SlotSimulationPanel";
import CompetitionAdmin from "./CompetitionAdmin";
import OwnerActivity from "./OwnerActivity";
import OwnerSimulationLab from "./OwnerSimulationLab";

type Tab = "activity" | "dashboard" | "games" | "simulation" | "competition" | "users" | "wallet" | "database" | "system";
type GameEditorSection =
  | "general"
  | "math"
  | "flow"
  | "simulation"
  | "experience"
  | "music";
type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onClose: () => void;
};
const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const simulatableSlots = new Set<CasinoGameId>([
  "kaptan-mercan",
  "neon-kasasi",
  "sekerhane-1024",
]);
const isSimulatableSlot = (gameId: CasinoGameId): gameId is SimulatableSlotId =>
  simulatableSlots.has(gameId);
const formatBytes = (bytes = 0) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 ** 2
      ? `${(bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`
      : `${(bytes / 1024 ** 2).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB`;
const gameNames: Record<CasinoGameId, string> = {
  blackjack: "Blackjack",
  roulette: "Canlı Rulet",
  poker: "Midnight Poker",
  "kiraz-77": "Kiraz 77",
  "neon-kasasi": "Neon Kasası",
  "kaptan-mercan": "Kaptan Mercan",
  "sekerhane-1024": "Şekerhane 1024",
  "allahin-lutfu": "Allah’ın Lütfu",
  "baykus-madeni": "Baykuş Madeni",
  "altin-rota": "Altın Rota",
  limbo: "Owl Oracle Limbo",
  "obsidyen-damari": "Obsidyen Damarı",
  mines: "Mines",
  keno: "Owl Star Map Keno",
  "son-on": "Son On",
  plinko: "Pirinç Galeri Plinko",
  hilo: "Hilo",
  "yedi-cevher": "Yedi Cevher",
};
const gameGlyphs: Record<CasinoGameId, string> = {
  blackjack: "♠",
  roulette: "◉",
  poker: "♣",
  "kiraz-77": "77",
  "neon-kasasi": "M",
  "kaptan-mercan": "⚓",
  "sekerhane-1024": "✦",
  "allahin-lutfu": "☼",
  "baykus-madeni": "⛏",
  "altin-rota": "✈",
  limbo: "∞",
  "obsidyen-damari": "◆",
  mines: "✦",
  keno: "✧",
  "son-on": "10",
  plinko: "●",
  hilo: "↕",
  "yedi-cevher": "✦",
};
const featureNames: Record<string, string> = {
  sideBets: "Yan bahisler",
  insurance: "Sigorta",
  split: "İkiye bölme",
  surrender: "Teslim olma",
  surge: "Pehlevan Surge",
  callBets: "İlan bahisleri",
  neighbours: "Komşu bahisleri",
  statistics: "Canlı istatistik",
  casinoHoldem: "Casino Hold'em",
  texasHoldem: "Texas Hold'em",
  botTable: "Bot masası",
  aaBonus: "AA Bonus",
  onlineAdapter: "Online taşıma katmanı",
  hold: "Hold",
  turbo: "Turbo",
  gamble: "Gamble özelliği",
  bonusBuy: "Bonus satın alma",
  superBonusBuy: "Süper bonus satın alma",
  clusterReceipts: "Küme ödeme fişi",
  recipeBook: "Tarif defteri",
  miraBoost: "MIRA Boost",
  winTheatre: "Büyük kazanç tiyatrosu",
  lighthouseAnte: "Fener Şansı",
  hookRescue: "Kanca kurtarması",
  fishermanCollect: "Kaptan toplama",
  dualBet: "İki bağımsız bahis",
  autoCashout: "Otomatik nakit çıkış",
  autoBet: "Otomatik bahis",
  liveFeed: "Canlı salon akışı",
  provablyFair: "SHA-256 tur doğrulaması",
  eyeMeter: "Nur Gözü hedef göstergesi",
  collectors: "Kese ve Süper Kese",
  globalMultiplier: "Global çarpan anahtarı",
  fateSpin: "Kaderin Hükmü dönüşü",
  blockMining: "5×6 blok madenciliği",
  persistentBonus: "Kalıcı bonus duvarı",
  volatilitySwitch: "Yedi kazı modu",
  freeDig: "5×5 Serbest Kazı",
  depthLine: "12 kademeli Derin Hat",
  autoPick: "Otomatik güvenli seçim hedefi",
  excavationLog: "Kazı günlüğü",
  museum: "Kalıcı eser koleksiyonu",
  riskProfiles: "Üç açık risk profili",
  autoBank: "Otomatik kasaya al",
  timeoutChoice: "Süre sonu politikası",
  checkpointDecision: "10 → 1 kontrol noktaları",
  rowSelection: "8–16 sıra seçimi",
  multiBall: "Eşzamanlı çoklu top",
  heatmap: "Canlı göz ısı haritası",
};

const slotMathFields: Array<{
  key: Exclude<
    keyof SlotMathSettings,
    "profileName" | "bonusSpins" | "stageMultipliers"
  >;
  label: string;
  min: number;
  max?: number;
  step: number;
  unit: string;
  games?: CasinoGameId[];
  help?: string;
}> = [
  { key: "maxWinX", label: "Maksimum ödeme", min: 1, step: 100, unit: "×" },
  {
    key: "payoutScale",
    label: "Ödeme tablosu ölçeği",
    min: 0,
    step: 0.001,
    unit: "×",
  },
  {
    key: "bonusPayoutScale",
    label: "Bonus ödeme tablosu ölçeği",
    min: 0,
    step: 0.001,
    unit: "×",
  },
  {
    key: "baseScatterRate",
    label: "Ana oyun scatter oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
  },
  {
    key: "bonusScatterRate",
    label: "Bonus scatter oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
  },
  {
    key: "enhancedScatterRate",
    label: "Artırılmış bahis scatter oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
    games: ["neon-kasasi", "kaptan-mercan"],
    help: "MIRA Boost veya Fener Şansı açıkken scatter sembolünün hücre ağırlığı.",
  },
  {
    key: "baseSpecialRate",
    label: "Ana özel sembol oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
    games: ["neon-kasasi", "kaptan-mercan"],
  },
  {
    key: "bonusSpecialRate",
    label: "Bonus özel sembol oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
    games: ["neon-kasasi", "kaptan-mercan"],
  },
  {
    key: "basePrizeRate",
    label: "Ana ödül sembolü oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
    games: ["kaptan-mercan"],
    help: "Ana oyunda para balığının makaraya gelme ağırlığıdır.",
  },
  {
    key: "bonusPrizeRate",
    label: "Bonus ödül sembolü oranı",
    min: 0,
    step: 0.01,
    unit: "oran",
    games: ["kaptan-mercan"],
    help: "Free spin sırasında para balığının makaraya gelme ağırlığıdır.",
  },
  {
    key: "rescueChancePercent",
    label: "Kurtarma ihtimali",
    min: 0,
    max: 100,
    step: 0.1,
    unit: "%",
    games: ["kaptan-mercan"],
  },
  {
    key: "captainRescueChancePercent",
    label: "Balıksız kaptana balık kurtarması",
    min: 0,
    max: 100,
    step: 0.1,
    unit: "%",
    games: ["kaptan-mercan"],
  },
  {
    key: "cascadeAffinityPercent",
    label: "Zincir yakınlığı",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
    games: ["neon-kasasi", "sekerhane-1024"],
    help: "Patlamadan sonra düşen sembollerin komşulara benzeme eğilimi; yükseldikçe zincir uzar.",
  },
  {
    key: "maxCascades",
    label: "Azami zincir",
    min: 1,
    max: 50,
    step: 1,
    unit: "adet",
    games: ["neon-kasasi", "sekerhane-1024"],
  },
  {
    key: "minimumCluster",
    label: "Minimum küme",
    min: 3,
    max: 20,
    step: 1,
    unit: "sembol",
    games: ["neon-kasasi", "sekerhane-1024"],
  },
  { key: "bonusBuyX", label: "Bonus satın alma", min: 0, step: 1, unit: "×", games: ["neon-kasasi", "kaptan-mercan", "sekerhane-1024"] },
  {
    key: "bonusBuySpins",
    label: "Satın alınan bonus turu",
    min: 0,
    max: 250,
    step: 1,
    unit: "spin",
    games: ["neon-kasasi", "kaptan-mercan", "sekerhane-1024"],
  },
  {
    key: "enhancedBetCostX",
    label: "Artırılmış bahis / süper bonus maliyeti",
    min: 1,
    step: 0.05,
    unit: "×",
    games: ["neon-kasasi", "kaptan-mercan", "sekerhane-1024"],
  },
  {
    key: "retriggerSpins",
    label: "Yeniden tetikleme turu",
    min: 0,
    max: 100,
    step: 1,
    unit: "spin",
    games: ["neon-kasasi", "kaptan-mercan", "sekerhane-1024"],
  },
  {
    key: "maxBonusSessionSpins",
    label: "Bonus oturumu üst sınırı",
    min: 10,
    max: 500,
    step: 5,
    unit: "spin",
    games: ["kaptan-mercan"],
    help: "Kaptan ve fener uzatmaları dahil tek bir free-spin oturumunun oynayabileceği mutlak üst sınırdır. Oyunun bitmeyecekmiş gibi uzamasını engeller.",
  },
  {
    key: "stageAwardSpins",
    label: "Kademe başına ek tur",
    min: 0,
    max: 100,
    step: 1,
    unit: "spin",
    games: ["kaptan-mercan"],
  },
  {
    key: "stageInterval",
    label: "Kademe özel sembol eşiği",
    min: 0,
    max: 100,
    step: 1,
    unit: "adet",
    games: ["kaptan-mercan"],
  },
];

type NumericSlotField<T> = {
  key: Exclude<keyof T, "enabled">;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};

const slotFlowFields: Array<NumericSlotField<SlotFlowSettings>> = [
  { key: "meaningfulWinX", label: "Anlamlı kazanç eşiği", help: "Bu çarpanın altındaki iadeler kuru seriyi tamamen bitirmiş sayılmaz.", min: 0, max: 100, step: 0.1, unit: "×" },
  { key: "drySpinSoftLimit", label: "Kuru seri yumuşak sınırı", help: "Bu kadar olaysız spinden sonra motor hareketli sonuçların ağırlığını artırmaya başlar.", min: 0, max: 100, step: 1, unit: "spin" },
  { key: "drySpinEventBoostPercent", label: "Kuru seri olay desteği", help: "Yumuşak sınır aşılınca zincir, balık, güç ve özel sembol ağırlığına eklenir.", min: 0, max: 500, step: 1, unit: "%" },
  { key: "hotWindowChancePercent", label: "Sıcak pencere başlangıcı", help: "Her ücretli spinde birkaç tur süren hareketli seri başlatma ihtimali.", min: 0, max: 100, step: 0.1, unit: "%" },
  { key: "hotWindowSpins", label: "Sıcak pencere uzunluğu", help: "Başlayan sıcak serinin kaç spin devam edeceği.", min: 1, max: 50, step: 1, unit: "spin" },
  { key: "hotWindowEventBoostPercent", label: "Sıcak pencere gücü", help: "Sıcak seri sırasında oyun-özel olay ağırlığına verilen destek.", min: 0, max: 500, step: 1, unit: "%" },
  { key: "bonusPressureStartSpins", label: "Bonus baskısı başlangıcı", help: "Son bonustan sonra bu spin sayısı geçince scatter ağırlığı kademeli yükselmeye başlar.", min: 0, max: 1000, step: 1, unit: "spin" },
  { key: "bonusPressurePerSpinPercent", label: "Spin başına bonus baskısı", help: "Eşik sonrasındaki her spin scatter ağırlığına bu yüzdeyi ekler.", min: 0, max: 20, step: 0.05, unit: "%" },
  { key: "bonusPressureMaxPercent", label: "Azami bonus baskısı", help: "Bonus bekleme desteğinin çıkabileceği en yüksek seviye.", min: 0, max: 1000, step: 1, unit: "%" },
  { key: "retriggerTeasePercent", label: "Free-spin uzatma görüntüsü", help: "Bonus spinlerinde uzatmaya bir sembol kala ekran üretme ihtimali.", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "retriggerConversionPercent", label: "Uzatmayı gerçekleştirme", help: "Güçlü uzatma görüntüsünün gerçekten retrigger'a dönüşme ihtimali.", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "lastBreathPercent", label: "Son nefes uzatması", help: "Son free spinde doğrudan gerçek +spin üretme ihtimali.", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "postFeatureEchoPercent", label: "Özellik artçısı", help: "Bonus veya büyük olay sonrasında bir sonraki spin için ayrılan artçı yoğunluk. Ortak motor parametresidir.", min: 0, max: 100, step: 0.5, unit: "%" },
];

const slotPotentialFields: Array<NumericSlotField<SlotPotentialSettings>> = [
  { key: "exposureChancePercent", label: "Potansiyel vitrin sıklığı", help: "Ödemeyi değiştirmeden yüksek değerli balık, güç veya X hücresi gösterme ihtimali.", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "strongExposureChancePercent", label: "Güçlü yaklaşma sıklığı", help: "Bonusa bir sembol kala veya çok dolu ekran oluşturma ihtimali.", min: 0, max: 100, step: 0.1, unit: "%" },
  { key: "teaserConversionPercent", label: "Yaklaşmayı sonuca çevirme", help: "Güçlü yaklaşmanın gerçek bonus/uzatmaya dönüşme yüzdesi.", min: 0, max: 100, step: 0.5, unit: "%" },
  { key: "maxUnpaidStrongTeases", label: "Karşılıksız güçlü yaklaşma", help: "Bu sayıya ulaşıldığında sonraki güçlü yaklaşma gerçek sonuca çevrilir.", min: 0, max: 20, step: 1, unit: "adet" },
  { key: "displayOnlyMinItems", label: "Vitrin minimum öğe", help: "Potansiyel ekranında en az kaç değerli öğe gösterileceği.", min: 0, max: 49, step: 1, unit: "adet" },
  { key: "displayOnlyMaxItems", label: "Vitrin maksimum öğe", help: "Potansiyel ekranındaki değerli öğe üst sınırı.", min: 0, max: 49, step: 1, unit: "adet" },
  { key: "displayOnlyHighValueMinX", label: "Vitrin değer alt sınırı", help: "Gösterilecek balık, güç veya X değerinin alt sınırı.", min: 0, max: 100000, step: 1, unit: "×" },
  { key: "displayOnlyHighValueMaxX", label: "Vitrin değer üst sınırı", help: "Gösterilecek potansiyel değerin üst sınırı; tek başına ödeme üretmez.", min: 0, max: 100000, step: 1, unit: "×" },
  { key: "nearMissChancePercent", label: "Bir sembol eksik düzen", help: "Şekerhane gibi uygun oyunlarda kazanca bir sembol kala düzen oluşturma ihtimali.", min: 0, max: 100, step: 0.5, unit: "%" },
];

const presentationFields: Array<{
  key: keyof Pick<
    SlotPresentationSettings,
    | "normalStepMs"
    | "turboStepMs"
    | "teaseMs"
    | "multiplierRevealMs"
    | "countUpMs"
  >;
  label: string;
}> = [
  { key: "normalStepMs", label: "Normal animasyon adımı" },
  { key: "turboStepMs", label: "Turbo animasyon adımı" },
  { key: "teaseMs", label: "Beklenti sahnesi" },
  { key: "multiplierRevealMs", label: "Çarpan açıklama aralığı" },
  { key: "countUpMs", label: "Kazanç sayacı süresi" },
];

const progressionFields: Array<{
  key: keyof Omit<SlotProgressionSettings, "enabled">;
  label: string;
}> = [
  { key: "xpPerSpin", label: "Tur başına XP" },
  { key: "xpPerWin", label: "Kazanç başına XP" },
  { key: "xpPerBonus", label: "Bonus başına XP" },
  { key: "xpPerSpecial", label: "Özel sembol başına XP" },
  { key: "levelBaseXp", label: "Seviye taban XP" },
];

function moment(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="admin-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i />
      <span>{label}</span>
    </label>
  );
}

export default function AdminPanel({ balance, onClose }: Props) {
  const { user } = useAuth();
  const settings = useSyncExternalStore(
    subscribeAdminSettings,
    getAdminSettings,
    getAdminSettings,
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedGame, setSelectedGame] = useState<CasinoGameId>("neon-kasasi");
  const [gameEditorSection, setGameEditorSection] =
    useState<GameEditorSection>("general");
  const [summary, setSummary] = useState<CasinoSummary>();
  const [rounds, setRounds] = useState<CasinoRoundRecord[]>([]);
  const [ledger, setLedger] = useState<WalletLedgerRecord[]>([]);
  const [events, setEvents] = useState<CasinoEventRecord[]>([]);
  const [conversations, setConversations] = useState<AIConversationRecord[]>(
    [],
  );
  const [storage, setStorage] = useState<CasinoStorageStats>();
  const [gameFilter, setGameFilter] = useState<"all" | CasinoGameId>("all");
  const [search, setSearch] = useState("");
  const [adjustment, setAdjustment] = useState(2500);
  const [adjustmentReason, setAdjustmentReason] = useState(
    "Yönetici bakiye düzenlemesi",
  );
  const [deletePhrase, setDeletePhrase] = useState("");
  const [notice, setNotice] = useState("");
  const [musicBusy, setMusicBusy] = useState<CasinoGameId | null>(null);
  const [musicPreview, setMusicPreview] = useState<CasinoGameId | null>(null);
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);
  const musicPreviewUrlRef = useRef("");

  useEffect(() => {
    // These screens load their own data; don't download game history behind them.
    if (!["dashboard", "wallet", "database"].includes(tab)) return;
    let active = true;
    let inFlight = false;
    const refresh = () => {
      if (!active || inFlight || document.hidden) return;
      inFlight = true;
      let failedReads = 0;
      void Promise.all([
        getCasinoSummary('all').catch(() => { failedReads += 1; return undefined; }),
        getCasinoRounds('all', tab === "dashboard" ? 100 : undefined).catch(() => { failedReads += 1; return undefined; }),
        tab === "wallet" || tab === "database" ? getWalletLedger('all').catch(() => { failedReads += 1; return undefined; }) : Promise.resolve([]),
        tab === "dashboard" ? getCasinoEvents('all', 100).catch(() => { failedReads += 1; return undefined; }) : Promise.resolve([]),
        tab === "database" ? getAIConversations('all').catch(() => { failedReads += 1; return undefined; }) : Promise.resolve([]),
        tab === "database" ? getCasinoStorageStats().catch(() => { failedReads += 1; return undefined; }) : Promise.resolve(undefined),
      ]).then(
        ([
          nextSummary,
          nextRounds,
          nextLedger,
          nextEvents,
          nextConversations,
          nextStorage,
        ]) => {
          if (!active) return;
          if (nextSummary) setSummary(nextSummary);
          if (nextRounds) setRounds(nextRounds);
          if (nextLedger) setLedger(nextLedger);
          if (nextEvents) setEvents(nextEvents);
          if (nextConversations) setConversations(nextConversations);
          if (nextStorage) setStorage(nextStorage);
          if (failedReads) setNotice("Verilerin bir bölümü yenilenemedi; bağlantı düzelince otomatik tamamlanacak.");
        },
      ).finally(() => { inFlight = false; });
    };
    refresh();
    const poll = window.setInterval(refresh, 5000);
    const unsubscribe = subscribeCasinoDatabase(refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(poll);
      unsubscribe();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [tab]);

  useEffect(
    () => () => {
      musicPreviewRef.current?.pause();
      if (musicPreviewUrlRef.current)
        URL.revokeObjectURL(musicPreviewUrlRef.current);
    },
    [],
  );

  const playerRounds = useMemo(
    () => rounds.filter((round) => round.playerParticipated),
    [rounds],
  );
  const recentPlayerRounds = playerRounds.slice(0, 12).reverse();
  const largestChartValue = Math.max(
    1,
    ...recentPlayerRounds.map((round) => Math.abs(round.net)),
  );
  const filteredRounds = useMemo(
    () =>
      rounds.filter((round) => {
        if (gameFilter !== "all" && round.game !== gameFilter) return false;
        const haystack =
          `${round.variant} ${round.roundId} ${round.outcome} ${JSON.stringify(round.result)}`.toLocaleLowerCase(
            "tr-TR",
          );
        return haystack.includes(search.toLocaleLowerCase("tr-TR"));
      }),
    [rounds, gameFilter, search],
  );

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const adjustBalance = async (direction: 1 | -1) => {
    const amount = Math.max(0, Math.abs(adjustment)) * direction;
    if (!amount || balance + amount < 0) return;
    const result = await accountRequest<{ balance: number; version: number }>(`/api/admin/accounts/users/${encodeURIComponent(user.id)}/wallet`, { method: 'POST', body: JSON.stringify({ amount, reason: adjustmentReason || "Yönetici bakiye düzenlemesi" }) });
    window.dispatchEvent(new CustomEvent('pehlevan-wallet-updated', { detail: { userId: user.id, balance: result.balance, version: result.version } }));
    flash(
      `${money.format(Math.abs(amount))} PR ${amount > 0 ? "eklendi" : "düşüldü"}.`,
    );
  };

  const clearData = async () => {
    if (deletePhrase !== "VERİLERİ SİL") return;
    await clearCasinoResearchData();
    setDeletePhrase("");
    flash("Araştırma veritabanı temizlendi.");
  };

  const stopMusicPreview = () => {
    musicPreviewRef.current?.pause();
    musicPreviewRef.current = null;
    if (musicPreviewUrlRef.current)
      URL.revokeObjectURL(musicPreviewUrlRef.current);
    musicPreviewUrlRef.current = "";
    setMusicPreview(null);
  };

  const previewMusic = async (game: CasinoGameId) => {
    if (musicPreview === game) {
      stopMusicPreview();
      return;
    }
    stopMusicPreview();
    const resolved = await resolveMusicSource(game, settings.games[game].music);
    if (!resolved.src) {
      flash("Önizlenecek müzik kaynağı bulunamadı.");
      return;
    }
    const audio = new Audio(resolved.src);
    audio.loop = true;
    audio.volume = Math.min(
      0.8,
      settings.games[game].music.volume * settings.general.musicVolume,
    );
    musicPreviewRef.current = audio;
    musicPreviewUrlRef.current = resolved.revoke ? resolved.src : "";
    await audio
      .play()
      .then(() => setMusicPreview(game))
      .catch(() => flash("Tarayıcı müzik önizlemesini başlatamadı."));
  };

  const uploadMusic = async (game: CasinoGameId, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      flash("Lütfen MP3, OGG, WAV veya başka bir ses dosyası seç.");
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      flash("Müzik dosyası 40 MB sınırını aşıyor.");
      return;
    }
    setMusicBusy(game);
    try {
      await saveUploadedMusic(game, file);
      updateAdminGame(game, {
        music: {
          ...settings.games[game].music,
          source: "upload",
          customName: file.name,
        },
      });
      flash(`${settings.games[game].name} için ${file.name} yüklendi.`);
    } catch {
      flash("Müzik dosyası tarayıcı veritabanına kaydedilemedi.");
    } finally {
      setMusicBusy(null);
    }
  };

  const clearUploadedMusic = async (game: CasinoGameId) => {
    stopMusicPreview();
    await removeUploadedMusic(game);
    const fallback =
      GAME_MUSIC_TRACKS.find(
        (track) => track.id === settings.games[game].music.trackId,
      ) ?? GAME_MUSIC_TRACKS[0];
    updateAdminGame(game, {
      music: {
        ...settings.games[game].music,
        source: "catalog",
        trackId: fallback.id,
        customName: "",
        customUrl: "",
      },
    });
    flash(`${settings.games[game].name} özel müziği kaldırıldı.`);
  };

  const nav: Array<{ id: Tab; icon: string; label: string; note: string }> = [
    {
      id: "dashboard",
      icon: "⌁",
      label: "Genel Bakış",
      note: "Canlı operasyon",
    },
    {
      id: "games",
      icon: "◆",
      label: "Oyun Yönetimi",
      note: "Kurallar ve salonlar",
    },
    ...(user.role === "owner" ? [{
      id: "simulation" as const,
      icon: "∑",
      label: "Simülasyon Lab",
      note: "Tüm oyunlar · owner only",
    }] : []),
    {
      id: "activity",
      icon: "◉",
      label: "Oyuncu hareketleri",
      note: "Oyun · kazanç · cüzdan",
    },
    {
      id: "users",
      icon: "◎",
      label: "Kullanıcılar",
      note: "Hesap ve onay dizini",
    },
    {
      id: "competition",
      icon: "♛",
      label: "Meta Rekabet",
      note: "Sezon, rekor ve şöhret",
    },
    {
      id: "wallet",
      icon: "✦",
      label: "Bakiye & Kasa",
      note: `${ledger.length} hareket`,
    },
    {
      id: "database",
      icon: "▦",
      label: "Veritabanı",
      note: `${rounds.length} tur · ${conversations.length} AI`,
    },
    { id: "system", icon: "⚙", label: "Sistem", note: "Genel ayarlar" },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <i>MP</i>
          <div>
            <strong>PEHLEVAN</strong>
            <small>ROYALE CONTROL</small>
          </div>
        </div>
        <div className="admin-environment">
          <i className={settings.general.maintenanceMode ? "danger" : ""} />{" "}
          <span>
            {settings.general.maintenanceMode
              ? "BAKIM MODU"
              : "SİSTEM ÇEVRİMİÇİ"}
          </span>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
            >
              <i>{item.icon}</i>
              <span>
                {item.label}
                <small>{item.note}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="admin-owner">
          <span>MP</span>
          <div>
            <strong>Muharrem Pehlevan</strong>
            <small>MUHARREM PEHLEVAN · TAM YETKİ</small>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <small>PRIVATE HOUSE / YÖNETİM</small>
            <h1>{nav.find((item) => item.id === tab)?.label}</h1>
          </div>
          <div>
            <span className="admin-clock">
              {new Date().toLocaleDateString("tr-TR")}
              <small>
                Son kayıt {rounds[0] ? moment(rounds[0].settledAt) : "yok"}
              </small>
            </span>
            <button onClick={onClose}>
              Yönetimden çık <b>×</b>
            </button>
          </div>
        </header>
        {notice && (
          <div className="admin-notice" role="status">
            ✓ {notice}
          </div>
        )}

        {tab === "activity" && <div className="admin-content"><OwnerActivity /></div>}

        {tab === "simulation" && user.role === "owner" && <OwnerSimulationLab />}

        {tab === "dashboard" && (
          <div className="admin-content">
            <section className="admin-kpis">
              <article>
                <i>✦</i>
                <small>AKTİF BAKİYE</small>
                <strong>
                  {money.format(balance)} <em>PR</em>
                </strong>
                <span>Yerel oyuncu cüzdanı</span>
              </article>
              <article>
                <i>↻</i>
                <small>OYUNCU TURLARI</small>
                <strong>{summary ? summary.playedRounds : "—"}</strong>
                <span>{summary ? summary.liveRounds : "—"} arka plan rulet turu</span>
              </article>
              <article>
                <i>％</i>
                <small>GÖZLENEN RTP</small>
                <strong>{summary ? `%${percent.format(summary.rtp * 100)}` : "—"}</strong>
                <span>
                  {summary ? money.format(summary.totalStake) : "—"} PR toplam bahis
                </span>
              </article>
              <article
                className={
                  (summary?.net ?? 0) <= 0
                    ? "house-positive"
                    : "player-positive"
                }
              >
                <i>◇</i>
                <small>KASA SONUCU</small>
                <strong>
                  {summary ? money.format(Math.abs(summary.net)) : "—"} <em>PR</em>
                </strong>
                <span>
                  {summary ? (summary.net <= 0 ? "Kasa lehine" : "Oyuncu lehine") : "Veri bekleniyor"}
                </span>
              </article>
            </section>
            <section className="admin-dashboard-grid">
              <article className="admin-card performance-card">
                <header>
                  <div>
                    <small>SON OYUNCU TURLARI</small>
                    <h2>Net hareket grafiği</h2>
                  </div>
                  <span>12 TUR</span>
                </header>
                <div className="admin-net-chart">
                  <i className="zero-line" />
                  {recentPlayerRounds.length ? (
                    recentPlayerRounds.map((round) => (
                      <div
                        key={round.id}
                        className={round.net >= 0 ? "up" : "down"}
                        title={`${gameNames[round.game]} · ${round.net} PR`}
                      >
                        <span
                          style={{
                            height: `${Math.max(7, (Math.abs(round.net) / largestChartValue) * 46)}%`,
                          }}
                        />
                        <small>{gameGlyphs[round.game]}</small>
                      </div>
                    ))
                  ) : (
                    <p>Grafik için oyuncu turu bekleniyor.</p>
                  )}
                </div>
              </article>
              <article className="admin-card live-card">
                <header>
                  <div>
                    <small>CANLI AKIŞ</small>
                    <h2>Son olaylar</h2>
                  </div>
                  <i className="live-dot" />
                </header>
                <div>
                  {events.slice(0, 6).map((event) => (
                    <span key={event.id}>
                      <i>{gameGlyphs[event.game]}</i>
                      <b>{event.type.replaceAll("-", " ")}</b>
                      <small>{moment(event.occurredAt)}</small>
                    </span>
                  ))}
                  {!events.length && <p>Henüz olay kaydı yok.</p>}
                </div>
              </article>
              <article className="admin-card games-snapshot">
                <header>
                  <div>
                    <small>OYUN SAĞLIĞI</small>
                    <h2>Salon performansı</h2>
                  </div>
                  <button onClick={() => setTab("games")}>Yönet →</button>
                </header>
                <div>
                  {Object.values(settings.games).map((game) => {
                    const observed = summary?.byGame.find(
                      (entry) => entry.game === game.id,
                    );
                    return (
                      <span key={game.id}>
                        <i>{gameGlyphs[game.id]}</i>
                        <div>
                          <b>{game.name}</b>
                          <small>
                            {game.enabled ? "Açık" : "Kapalı"} · hedef %
                            {percent.format(game.targetRtp)}
                          </small>
                        </div>
                        <em
                          className={
                            observed && observed.rtp * 100 > game.targetRtp + 3
                              ? "warn"
                              : ""
                          }
                        >
                          {summary ? `%${percent.format((observed?.rtp ?? 0) * 100)} RTP` : "—"}
                        </em>
                      </span>
                    );
                  })}
                </div>
              </article>
            </section>
          </div>
        )}

        {tab === "games" && (
          <div className="admin-content">
            <div className="admin-section-intro">
              <div>
                <small>RUNTIME KONTROL</small>
                <h2>Oyunlar ve salon özellikleri</h2>
                <p>
                  Değişiklikler tarayıcıda kalıcıdır; salon erişimi, varsayılan
                  bahis ve özellik anahtarları yeni oyun oturumuna uygulanır.
                </p>
              </div>
              <span>
                {
                  Object.values(settings.games).filter((game) => game.enabled)
                    .length
                }
                /{Object.values(settings.games).length} AÇIK
              </span>
            </div>
            <section
              className="admin-game-selector"
              aria-label="Yönetilecek oyunu seç"
            >
              {Object.values(settings.games).map((game) => {
                const observed = summary?.byGame.find(
                  (entry) => entry.game === game.id,
                );
                return (
                  <button
                    key={game.id}
                    className={selectedGame === game.id ? "active" : ""}
                    onClick={() => {
                      setSelectedGame(game.id);
                      setGameEditorSection("general");
                    }}
                  >
                    <i>{gameGlyphs[game.id]}</i>
                    <span>
                      <b>{game.name}</b>
                      <small>
                        {game.enabled ? "Açık" : "Kapalı"} · hedef %
                        {percent.format(game.targetRtp)}
                      </small>
                    </span>
                    <em>{summary ? `%${percent.format((observed?.rtp ?? 0) * 100)}` : "—"}</em>
                  </button>
                );
              })}
            </section>
            <section className="admin-game-grid">
              {Object.values(settings.games)
                .filter((game) => game.id === selectedGame)
                .map((game) => {
                  const observed = summary?.byGame.find(
                    (entry) => entry.game === game.id,
                  );
                  const slot = game.slot;
                  const crash = game.crash;
                  const mines = game.mines;
                  const countdown = game.countdown;
                  const plinko = game.plinko;
                  const allah = game.allah;
                  const mineDrop = game.mineDrop;
                  return (
                    <article
                      className={`admin-game-card ${game.enabled ? "" : "disabled"}`}
                      key={game.id}
                    >
                      <header>
                        <i>{gameGlyphs[game.id]}</i>
                        <div>
                          <small>{game.room}</small>
                          <h3>{game.name}</h3>
                        </div>
                        <Toggle
                          checked={game.enabled}
                          label={game.enabled ? "AÇIK" : "KAPALI"}
                          onChange={(enabled) =>
                            updateAdminGame(game.id, { enabled })
                          }
                        />
                      </header>
                      <div className="game-live-metrics">
                        <span>
                          <small>OYUN TURU</small>
                          <b>{summary ? (observed?.playedRounds ?? 0) : "—"}</b>
                        </span>
                        <span>
                          <small>GÖZLENEN RTP</small>
                          <b>{summary ? `%${percent.format((observed?.rtp ?? 0) * 100)}` : "—"}</b>
                        </span>
                        <span>
                          <small>NET</small>
                          <b>{summary ? money.format(observed?.net ?? 0) : "—"} PR</b>
                        </span>
                      </div>
                      <nav
                        className="admin-editor-tabs"
                        aria-label={`${game.name} ayar bölümü`}
                      >
                        {(
                          [
                            ["general", "GENEL & ÖZELLİKLER"],
                            ["math", "MATEMATİK MOTORU"],
                            ["flow", "AKIŞ & VİTRİN"],
                            ["simulation", "HIZLI SİMÜLASYON"],
                            ["experience", "DENEYİM & İLERLEME"],
                            ["music", "MÜZİK"],
                          ] as Array<[GameEditorSection, string]>
                        ).map(([section, label]) => (
                          <button
                            key={section}
                            className={
                              gameEditorSection === section ? "active" : ""
                            }
                            disabled={
                              ((!slot && !crash && !mines && !countdown && !plinko && !allah && !mineDrop) && section === "math") ||
                              (!slot && !allah && !mineDrop && section === "flow") ||
                              ((!slot || !isSimulatableSlot(game.id)) && section === "simulation") ||
                              ((!slot && !mines && !countdown && !plinko && !mineDrop) && section === "experience")
                            }
                            onClick={() => setGameEditorSection(section)}
                          >
                            {label}
                          </button>
                        ))}
                      </nav>
                      <div
                        className="admin-editor-pane"
                        hidden={gameEditorSection !== "general"}
                      >
                        <div className="admin-form-grid">
                          <label>
                            Minimum bahis
                            <input
                              type="number"
                              min="1"
                              value={game.minBet}
                              onChange={(event) => {
                                const minBet = Math.max(
                                  1,
                                  Number(event.target.value),
                                );
                                updateAdminGame(game.id, {
                                  minBet,
                                  defaultBet: Math.max(minBet, game.defaultBet),
                                });
                              }}
                            />
                            <em>PR</em>
                          </label>
                          <label>
                            Varsayılan bahis
                            <input
                              type="number"
                              min={game.minBet}
                              value={game.defaultBet}
                              onChange={(event) =>
                                updateAdminGame(game.id, {
                                  defaultBet: Math.max(
                                    game.minBet,
                                    Number(event.target.value),
                                  ),
                                })
                              }
                            />
                            <em>PR</em>
                          </label>
                          <label>
                            RTP kalibrasyon hedefi
                            <input
                              type="number"
                              min="1"
                              max="100"
                              step="0.1"
                              value={game.targetRtp}
                              onChange={(event) =>
                                updateAdminGame(game.id, {
                                  targetRtp: Number(event.target.value),
                                })
                              }
                            />
                            <em>%</em>
                          </label>
                          <label>
                            Volatilite
                            <select
                              value={game.volatility}
                              onChange={(event) =>
                                updateAdminGame(game.id, {
                                  volatility: event.target
                                    .value as typeof game.volatility,
                                })
                              }
                            >
                              <option>düşük</option>
                              <option>orta</option>
                              <option>yüksek</option>
                              <option>çok yüksek</option>
                            </select>
                          </label>
                        </div>
                        <div className="game-switches">
                          <Toggle
                            checked={game.autoplay}
                            label="Otomatik oyun"
                            onChange={(autoplay) =>
                              updateAdminGame(game.id, { autoplay })
                            }
                          />
                          <Toggle
                            checked={game.aiHost}
                            label="AI sunucu"
                            onChange={(aiHost) =>
                              updateAdminGame(game.id, { aiHost })
                            }
                          />
                          <Toggle
                            checked={game.sound}
                            label="Oyun sesi"
                            onChange={(sound) =>
                              updateAdminGame(game.id, { sound })
                            }
                          />
                          {Object.entries(game.features).map(
                            ([feature, enabled]) => (
                              <Toggle
                                key={feature}
                                checked={enabled}
                                label={featureNames[feature] ?? feature}
                                onChange={(value) =>
                                  updateAdminGame(game.id, {
                                    features: { [feature]: value },
                                  })
                                }
                              />
                            ),
                          )}
                        </div>
                      </div>

                      {slot && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "math"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>CANLI MOTOR PROFİLİ</small>
                              <h4>Olasılık ve ödeme parametreleri</h4>
                            </div>
                            <code>{slot.math.profileName}</code>
                          </div>
                          <label className="slot-profile-name">
                            Profil sürümü
                            <input
                              value={slot.math.profileName}
                              onChange={(event) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    math: {
                                      ...slot.math,
                                      profileName: event.target.value,
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                          <div className="slot-parameter-grid">
                            {slotMathFields
                              .filter(
                                (field) =>
                                  !field.games || field.games.includes(game.id),
                              )
                              .map((field) => (
                              <label key={field.key}>
                                <span>{field.label}</span>
                                <input
                                  type="number"
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                  value={slot.math[field.key]}
                                  onChange={(event) =>
                                    updateAdminGame(game.id, {
                                      slot: {
                                        ...slot,
                                        math: {
                                          ...slot.math,
                                          [field.key]: Math.max(
                                            field.min,
                                            Number(event.target.value),
                                          ),
                                        },
                                      },
                                    })
                                  }
                                />
                                <em>{field.unit}</em>
                                {field.help && (
                                  <small className="admin-field-help">
                                    {field.help}
                                  </small>
                                )}
                              </label>
                            ))}
                          </div>
                          <div className="slot-bonus-flow">
                            <section>
                              <small>SCATTER → BAŞLANGIÇ SPİNİ</small>
                              <div>
                                {Object.entries(slot.math.bonusSpins).map(
                                  ([scatter, spins]) => (
                                    <label key={scatter}>
                                      <b>{scatter} scatter</b>
                                      <input
                                        type="number"
                                        min="0"
                                        max="250"
                                        value={spins}
                                        onChange={(event) =>
                                          updateAdminGame(game.id, {
                                            slot: {
                                              ...slot,
                                              math: {
                                                ...slot.math,
                                                bonusSpins: {
                                                  ...slot.math.bonusSpins,
                                                  [scatter]: Math.max(
                                                    0,
                                                    Number(event.target.value),
                                                  ),
                                                },
                                              },
                                            },
                                          })
                                        }
                                      />
                                    </label>
                                  ),
                                )}
                              </div>
                            </section>
                            <section>
                              <small>KADEME ÇARPANLARI</small>
                              <div>
                                {slot.math.stageMultipliers.map(
                                  (multiplier, index) => (
                                    <label key={index}>
                                      <b>Kademe {index}</b>
                                      <input
                                        type="number"
                                        min="1"
                                        max="10000"
                                        value={multiplier}
                                        onChange={(event) => {
                                          const stageMultipliers = [
                                            ...slot.math.stageMultipliers,
                                          ];
                                          stageMultipliers[index] = Math.max(
                                            1,
                                            Number(event.target.value),
                                          );
                                          updateAdminGame(game.id, {
                                            slot: {
                                              ...slot,
                                              math: {
                                                ...slot.math,
                                                stageMultipliers,
                                              },
                                            },
                                          });
                                        }}
                                      />
                                    </label>
                                  ),
                                )}
                                {!slot.math.stageMultipliers.length && (
                                  <p>Bu oyunda kademe yok.</p>
                                )}
                              </div>
                            </section>
                          </div>
                          <div className="slot-weight-editor">
                            <header>
                              <div>
                                <small>DEĞER DAĞILIMI</small>
                                <h4>
                                  {game.id === "neon-kasasi"
                                    ? "Çarpan ağırlıkları"
                                    : game.id === "kaptan-mercan"
                                      ? "Para balığı değer ağırlıkları"
                                      : game.id === "sekerhane-1024"
                                        ? "Şeker sembol ağırlıkları"
                                        : "Ödül ağırlıkları"}
                                </h4>
                              </div>
                              <p>
                                Ağırlık büyüdükçe ilgili değer daha sık
                                üretilir.
                              </p>
                            </header>
                            <div>
                              {Object.entries(slot.valueWeights).map(
                                ([value, weight]) => (
                                  <label key={value}>
                                    <b>
                                      {game.id === "sekerhane-1024"
                                        ? value
                                        : `${value}×`}
                                    </b>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.0001"
                                      value={weight}
                                      onChange={(event) =>
                                        updateAdminGame(game.id, {
                                          slot: {
                                            ...slot,
                                            valueWeights: {
                                              ...slot.valueWeights,
                                              [value]: Math.max(
                                                0,
                                                Number(event.target.value),
                                              ),
                                            },
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                ),
                              )}
                            </div>
                          </div>
                          <p className="slot-editor-warning">
                            Bu alanlar yeni turlara canlı uygulanır. RTP hedefi
                            tek başına sonucu değiştirmez; dağılım
                            değişikliklerinden sonra matematik simülasyonu
                            çalıştırılmalıdır.
                          </p>
                        </div>
                      )}

                      {slot && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "flow"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>ORTAK SLOT AKIŞ MOTORU</small>
                              <h4>Gerçek sonuç ritmi ve görünür potansiyel</h4>
                            </div>
                            <code>shared-slot-flow-v1</code>
                          </div>

                          <div className="slot-flow-explainer">
                            <strong>
                              {game.id === "kaptan-mercan"
                                ? "Kaptan Mercan: para balığı → kaptan toplaması → retrigger"
                                : game.id === "neon-kasasi"
                                  ? "Neon Kasası: güç çipi → zincir → kasa ve MIRA"
                                  : game.id === "sekerhane-1024"
                                    ? "Şekerhane: küme → cascade → X hücresi ve uzatma"
                                    : "Bu slot klasik profil kullanıyor."}
                            </strong>
                            <p>
                              <b>Akış</b> gerçek sembol, zincir, bonus ve ödeme
                              sıklığını etkiler. <b>Vitrin</b> ise ödeme hesabına
                              girmeyen fakat grid üzerinde görünen yüksek değer,
                              eksik bağlantı ve yakın sonuçları yönetir.
                            </p>
                          </div>

                          <section className="slot-preset-picker">
                            <header>
                              <div>
                                <small>HAZIR AYAR PAKETLERİ</small>
                                <h4>Tek tıkla başlangıç profili</h4>
                              </div>
                              <p>Paket uygulandıktan sonra bütün mikro ayarlar ayrıca değiştirilebilir.</p>
                            </header>
                            <div>
                              {(Object.entries(SLOT_PRESET_COPY) as Array<
                                [SlotPresetId, (typeof SLOT_PRESET_COPY)[SlotPresetId]]
                              >).map(([preset, copy]) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => applyAdminSlotPreset(game.id, preset)}
                                >
                                  <b>{copy.name}</b>
                                  <span>{copy.summary}</span>
                                </button>
                              ))}
                            </div>
                          </section>

                          <div className="slot-engine-switches">
                            <Toggle
                              checked={slot.flow.enabled}
                              label="Gerçek sonuç akış motoru"
                              onChange={(enabled) =>
                                updateAdminGame(game.id, {
                                  slot: { ...slot, flow: { ...slot.flow, enabled } },
                                })
                              }
                            />
                            <Toggle
                              checked={slot.potential.enabled}
                              label="Görünür potansiyel motoru"
                              onChange={(enabled) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    potential: { ...slot.potential, enabled },
                                  },
                                })
                              }
                            />
                          </div>

                          <div className="slot-flow-columns">
                            <section>
                              <header>
                                <small>GERÇEK PARA VE OLAY AKIŞI</small>
                                <p>Bu alanlar gerçek ödeme dağılımını ve bonus sıklığını değiştirebilir.</p>
                              </header>
                              {slotFlowFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    value={slot.flow[field.key]}
                                    onChange={(event) =>
                                      updateAdminGame(game.id, {
                                        slot: {
                                          ...slot,
                                          flow: {
                                            ...slot.flow,
                                            [field.key]: Math.max(
                                              field.min,
                                              Math.min(field.max, Number(event.target.value)),
                                            ),
                                          },
                                        },
                                      })
                                    }
                                  />
                                  <em>{field.unit}</em>
                                  <small>{field.help}</small>
                                </label>
                              ))}
                            </section>
                            <section>
                              <header>
                                <small>GÖRÜNÜR POTANSİYEL / VİTRİN</small>
                                <p>Bu alanlar yüksek değerlerin ne kadar sık görüneceğini ayrı yönetir.</p>
                              </header>
                              {slotPotentialFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="number"
                                    min={field.min}
                                    max={field.max}
                                    step={field.step}
                                    value={slot.potential[field.key]}
                                    onChange={(event) =>
                                      updateAdminGame(game.id, {
                                        slot: {
                                          ...slot,
                                          potential: {
                                            ...slot.potential,
                                            [field.key]: Math.max(
                                              field.min,
                                              Math.min(field.max, Number(event.target.value)),
                                            ),
                                          },
                                        },
                                      })
                                    }
                                  />
                                  <em>{field.unit}</em>
                                  <small>{field.help}</small>
                                </label>
                              ))}
                            </section>
                          </div>
                        </div>
                      )}

                      {allah && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "math"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>ALLAH’IN LÜTFU · CANLI MATEMATİK</small>
                              <h4>Her dönüş türü, özel sembol ve ödeme oranı</h4>
                            </div>
                            <code>{allah.profileName}</code>
                          </div>
                          <label className="slot-profile-name">
                            Profil sürümü
                            <input
                              value={allah.profileName}
                              onChange={(event) => updateAdminGame(game.id, {
                                allah: { ...allah, profileName: event.target.value },
                              })}
                            />
                          </label>

                          <section className="allah-admin-presets">
                            <header>
                              <div><small>HAZIR AKIŞ PROFİLLERİ</small><h4>Ritmi tek dokunuşla değiştir</h4></div>
                              <p>Profil uygulandıktan sonra aşağıdaki bütün mikro ayarlar yine ayrı ayrı değiştirilebilir.</p>
                            </header>
                            <div>
                              {(Object.entries(ALLAH_PRESET_COPY) as Array<[AllahPresetId, (typeof ALLAH_PRESET_COPY)[AllahPresetId]]>).map(([preset, copy]) => (
                                <button type="button" key={preset} onClick={() => applyAdminAllahPreset(preset)}>
                                  <b>{copy.name}</b><span>{copy.summary}</span>
                                </button>
                              ))}
                            </div>
                          </section>

                          <div className="slot-parameter-grid">
                            {([
                              ["maxWinX", "Azami ödeme", 1, 10_000_000, 100, "×"],
                              ["linePayoutScale", "Çizgi ödeme ölçeği", 0, 10, 0.01, "×"],
                              ["coinPayoutScale", "Coin ödeme ölçeği", 0, 10, 0.01, "×"],
                              ["globalMultiplierCap", "Global çarpan tavanı", 1, 10_000, 1, "×"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input
                                  type="number"
                                  min={min}
                                  max={max}
                                  step={step}
                                  value={allah[key]}
                                  onChange={(event) => updateAdminGame(game.id, {
                                    allah: {
                                      ...allah,
                                      [key]: Math.max(min, Math.min(max, Number(event.target.value))),
                                    },
                                  })}
                                />
                                <em>{unit}</em>
                              </label>
                            ))}
                          </div>

                          <div className="allah-admin-sections">
                            <section className="allah-admin-table">
                              <header>
                                <div><small>DÖNÜŞ TÜRLERİ</small><h4>Maliyet, Nur Gözü ve Scatter</h4></div>
                                <p>Normal tambur coin üretmez. Eye ve Scatter oranları hücre başına ayrı uygulanır; Hilebaz Eye ağırlıklıdır.</p>
                              </header>
                              <div className="allah-admin-row allah-admin-row-head"><b>Tür</b><span>Maliyet</span><span>Eye</span><span>Scatter</span></div>
                              {([
                                ["base", "Normal"],
                                ["enhancer", "Lütuf Arttırıcı"],
                                ["degen", "Deli Cesareti"],
                                ["trickster", "Hilebaz"],
                                ["fate", "Kaderin Hükmü"],
                                ["bonus-buy", "Bonus satın al"],
                                ["super-bonus-buy", "Büyük bonus"],
                              ] as const).map(([mode, label]) => (
                                <div className="allah-admin-row" key={mode}>
                                  <b>{label}</b>
                                  <label><input type="number" min="0" step="0.1" value={allah.modeCosts[mode]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, modeCosts: { ...allah.modeCosts, [mode]: Math.max(0, Number(event.target.value)) } } })} /><em>×</em></label>
                                  <label><input type="number" min="0" max="100" step="0.01" value={allah.reelEyeChancePercent[mode]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, reelEyeChancePercent: { ...allah.reelEyeChancePercent, [mode]: Math.max(0, Math.min(100, Number(event.target.value))) } } })} /><em>%</em></label>
                                  <label><input type="number" min="0" max="100" step="0.01" value={allah.reelScatterChancePercent[mode]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, reelScatterChancePercent: { ...allah.reelScatterChancePercent, [mode]: Math.max(0, Math.min(100, Number(event.target.value))) } } })} /><em>%</em></label>
                                </div>
                              ))}
                            </section>

                            <section className="allah-admin-table">
                              <header>
                                <div><small>ÖZEL OYUNLAR</small><h4>Bonus Eye ve yükseltme Scatter oranı</h4></div>
                                <p>Free spin yükseldikçe Eye yoğunluğunu ve bonus içindeki bir üst seviyeye geçiş ihtimalini ayrı yönetir.</p>
                              </header>
                              <div className="allah-admin-row allah-admin-row-head"><b>Kademe</b><span>Eye</span><span>Scatter</span></div>
                              {([
                                ["free", "Lütuf Dönüşleri"],
                                ["super", "Büyük Lütuf"],
                                ["legendary", "Efsanevi"],
                                ["mythic", "Mitsel"],
                              ] as const).map(([tier, label]) => (
                                <div className="allah-admin-row compact" key={tier}>
                                  <b>{label}</b>
                                  <label><input type="number" min="0" max="100" step="0.01" value={allah.bonusFeatureChancePercent[tier]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, bonusFeatureChancePercent: { ...allah.bonusFeatureChancePercent, [tier]: Math.max(0, Math.min(100, Number(event.target.value))) } } })} /><em>% / hücre</em></label>
                                  <label><input type="number" min="0" max="100" step="0.01" value={allah.bonusScatterChancePercent[tier]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, bonusScatterChancePercent: { ...allah.bonusScatterChancePercent, [tier]: Math.max(0, Math.min(100, Number(event.target.value))) } } })} /><em>% / hücre</em></label>
                                </div>
                              ))}
                            </section>

                            {([
                              ["mysteryWeights", "MYSTERY İÇERİĞİ", "Normal, Eye ve bonus Mystery sonucu"],
                              ["fateMysteryWeights", "KADERİN HÜKMÜ İÇERİĞİ", "Tam Mystery ekranının özel dağılımı"],
                            ] as const).map(([group, eyebrow, title]) => (
                              <section className="allah-admin-table allah-admin-wide" key={group}>
                                <header><div><small>{eyebrow}</small><h4>{title}</h4></div><p>Ağırlıklar görecelidir; toplamlarının 100 olması gerekmez.</p></header>
                                <div className="allah-admin-weight-grid">
                                  {(Object.keys(allah[group]) as Array<keyof typeof allah.mysteryWeights>).map((kind) => (
                                    <label key={kind}>
                                      <span>{{ coin: "Coin", eye: "Nur Gözü", collector: "Kese", upgrader: "Yükseltici Asa", redrop: "Yeniden Düşür", multiplier: "Yerel Çarpan", scatter: "Scatter", key: "Global Anahtar", maxCoin: "Max Coin" }[kind]}</span>
                                      <input type="number" min="0" step={kind === "maxCoin" ? "0.000001" : "0.001"} value={allah[group][kind]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, [group]: { ...allah[group], [kind]: Math.max(0, Number(event.target.value)) } } })} />
                                      <em>ağırlık</em>
                                    </label>
                                  ))}
                                </div>
                              </section>
                            ))}
                          </div>
                          <button className="allah-admin-reset" type="button" onClick={() => updateAdminGame(game.id, { allah: DEFAULT_ALLAH_TUNING })}>EĞLENCELİ DENGELİ PROFİLE DÖN</button>
                          <p className="slot-editor-warning">Bu ayarlar sonraki dönüşe canlı uygulanır. Olasılık ve ödeme ayarlarını birlikte değiştirmek gerçek RTP’yi değiştirir.</p>
                        </div>
                      )}

                      {allah && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "flow"}>
                          <div className="slot-editor-heading">
                            <div><small>AKIŞ KOREOGRAFİSİ</small><h4>Göz yoğunluğu, zincir uzunluğu ve animasyon temposu</h4></div>
                            <code>live · next spin</code>
                          </div>
                          <div className="slot-parameter-grid">
                            {([
                              ["eyeTargetsMin", "Göz hedefi alt sınırı", 1, 30, 1, "hücre"],
                              ["eyeTargetsMax", "Göz hedefi üst sınırı", 1, 30, 1, "hücre"],
                              ["bonusEyeTargetsMin", "Bonus Göz alt sınırı", 1, 30, 1, "hücre"],
                              ["bonusEyeTargetsMax", "Bonus Göz üst sınırı", 1, 30, 1, "hücre"],
                              ["maxFeatureCycles", "Normal zincir tavanı", 1, 50, 1, "tur"],
                              ["fateMaxFeatureCycles", "Kader zincir tavanı", 1, 75, 1, "tur"],
                              ["bonusSpins", "Özel oyun dönüşü", 1, 100, 1, "spin"],
                              ["tricksterMysteryEyeMultiplier", "Hilebaz Mystery → Göz ağırlığı", 0, 25, .1, "×"],
                              ["superCollectorChancePercent", "Süper kese ihtimali", 0, 100, .1, "%"],
                              ["coinTierDecay", "Üst coin seyrekliği", 1, 30, .1, "oran"],
                              ["normalAnimationScale", "Normal animasyon temposu", .1, 3, .05, "× süre"],
                              ["turboAnimationScale", "Turbo animasyon temposu", .05, 1, .01, "× süre"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input type="number" min={min} max={max} step={step} value={allah[key]} onChange={(event) => updateAdminGame(game.id, { allah: { ...allah, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } })} />
                                <em>{unit}</em>
                              </label>
                            ))}
                          </div>
                          <div className="slot-flow-explainer">
                            <strong>Hazır profil daha dolu ama okunabilir bir ritim kullanır.</strong>
                            <p>Normal oyunda özel hücre olasılığı artırıldı; Göz artık daha çok Mystery hedefi seçer. Max Coin oranı ve yüksek coin seyrekliği güvenli tarafta tutuldu.</p>
                          </div>
                          <button className="allah-admin-reset" type="button" onClick={() => updateAdminGame(game.id, { allah: DEFAULT_ALLAH_TUNING })}>AKIŞ AYARLARINI SIFIRLA</button>
                        </div>
                      )}

                      {mineDrop && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "math"}>
                          <div className="slot-editor-heading">
                            <div><small>BAYKUŞ MADENİ · CANLI MOTOR</small><h4>Her sembol, kazma, blok ve ödül ağırlığı</h4></div>
                            <code>{mineDrop.profileName}</code>
                          </div>
                          <label className="slot-profile-name">Profil sürümü<input value={mineDrop.profileName} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, profileName: event.target.value } })} /></label>
                          <div className="slot-parameter-grid">
                            <label><span>Azami ödeme</span><input type="number" min="1" max="10000000" step="100" value={mineDrop.maxWinX} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, maxWinX: Math.max(1, Number(event.target.value)) } })} /><em>×</em></label>
                            <label><span>Bonus başlangıç dönüşü</span><input type="number" min="1" max="100" step="1" value={mineDrop.bonusSpins} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, bonusSpins: Math.max(1, Math.round(Number(event.target.value))) } })} /><em>spin</em></label>
                          </div>

                          <div className="allah-admin-sections mine-drop-admin">
                            <section className="allah-admin-table allah-admin-wide">
                              <header><div><small>YEDİ MOD</small><h4>Dönüş ve bonus satın alma maliyetleri</h4></div><p>Çarpanlar temel bahse uygulanır; değişiklik bir sonraki tura geçer.</p></header>
                              <div className="allah-admin-weight-grid">
                                {(["base", "extra", "super", "diamond", "obsidian"] as const).map((key) => <label key={key}><span>{{ base: "Normal", extra: "Ekstra Şans", super: "Süper Şans", diamond: "Elmas Dönüş", obsidian: "Obsidyen Dönüş" }[key]}</span><input type="number" min="0" step="0.1" value={mineDrop.modeCosts[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, modeCosts: { ...mineDrop.modeCosts, [key]: Math.max(0, Number(event.target.value)) } } })} /><em>× bahis</em></label>)}
                                {(["block", "super", "mystery"] as const).map((key) => <label key={`buy-${key}`}><span>{{ block: "Blok Bonusu", super: "Süper Bonus", mystery: "Gizemli Dönüş" }[key]}</span><input type="number" min="0" step="1" value={mineDrop.bonusCosts[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, bonusCosts: { ...mineDrop.bonusCosts, [key]: Math.max(0, Number(event.target.value)) } } })} /><em>× bahis</em></label>)}
                              </div>
                            </section>

                            <section className="allah-admin-table">
                              <header><div><small>KAZMA DAYANIKLILIĞI</small><h4>Her kazmanın ayrı salınım sayısı</h4></div></header>
                              <div className="allah-admin-weight-grid">
                                {(["bronze", "iron", "gold", "diamond", "obsidian"] as const).map((key) => <label key={key}><span>{{ bronze: "Bronz", iron: "Demir", gold: "Altın", diamond: "Elmas", obsidian: "Obsidyen" }[key]}</span><input type="number" min="0" max="30" step="1" value={mineDrop.toolDurability[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, toolDurability: { ...mineDrop.toolDurability, [key]: Math.max(0, Math.round(Number(event.target.value))) } } })} /><em>vuruş</em></label>)}
                              </div>
                            </section>

                            <section className="allah-admin-table">
                              <header><div><small>BLOK TABLOSU</small><h4>Kırılma sayısı ve ödeme</h4></div></header>
                              <div className="mine-drop-rule-table"><div className="mine-drop-rule-row head"><b>Blok</b><span>Can</span><span>Ödeme</span></div>
                                {(["dirt", "stone", "blast", "redstone", "mystery", "gold", "diamond", "obsidian"] as const).map((key) => <div className="mine-drop-rule-row" key={key}><b>{{ dirt: "Toprak", stone: "Taş", blast: "Patlayıcı", redstone: "Kızıl", mystery: "Gizem", gold: "Altın", diamond: "Elmas", obsidian: "Obsidyen" }[key]}</b><label><input type="number" min="1" max="50" step="1" value={mineDrop.blockRules[key].hp} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, blockRules: { ...mineDrop.blockRules, [key]: { ...mineDrop.blockRules[key], hp: Math.max(1, Math.round(Number(event.target.value))) } } } })} /><em>vuruş</em></label><label><input type="number" min="0" max="100000" step="0.1" value={mineDrop.blockRules[key].payoutX} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, blockRules: { ...mineDrop.blockRules, [key]: { ...mineDrop.blockRules[key], payoutX: Math.max(0, Number(event.target.value)) } } } })} /><em>×</em></label></div>)}
                              </div>
                            </section>

                            <section className="allah-admin-table allah-admin-wide">
                              <header><div><small>MAKARA SEMBOLLERİ</small><h4>Her mod için göreceli ağırlıklar</h4></div><p>Toplamın 100 olması gerekmez. Boş hücre dahil altı sonuç bağımsızca ayarlanır.</p></header>
                              <div className="mine-drop-matrix scrollable"><div className="mine-drop-matrix-row head"><b>Bağlam</b>{(["tool", "eye", "tnt", "book", "maxBook", "empty"] as const).map((key) => <span key={key}>{key}</span>)}</div>
                                {(["base", "extra", "super", "diamond", "obsidian", "bonus-block", "bonus-super", "bonus-epic"] as const).map((context) => <div className="mine-drop-matrix-row" key={context}><b>{context}</b>{(["tool", "eye", "tnt", "book", "maxBook", "empty"] as const).map((key) => <label key={key}><input type="number" min="0" step="0.01" value={mineDrop.symbolWeights[context][key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, symbolWeights: { ...mineDrop.symbolWeights, [context]: { ...mineDrop.symbolWeights[context], [key]: Math.max(0, Number(event.target.value)) } } } })} /></label>)}</div>)}
                              </div>
                            </section>

                            <details className="mine-drop-details allah-admin-wide"><summary>Kazma havuzu ağırlıkları · tüm bağlamlar</summary><div className="mine-drop-matrix scrollable"><div className="mine-drop-matrix-row tools head"><b>Bağlam</b>{(["bronze", "iron", "gold", "diamond", "obsidian"] as const).map((key) => <span key={key}>{key}</span>)}</div>{(["base", "extra", "super", "diamond", "obsidian", "bonus-block", "bonus-super", "bonus-epic"] as const).map((context) => <div className="mine-drop-matrix-row tools" key={context}><b>{context}</b>{(["bronze", "iron", "gold", "diamond", "obsidian"] as const).map((key) => <label key={key}><input type="number" min="0" step="0.1" value={mineDrop.toolWeights[context][key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, toolWeights: { ...mineDrop.toolWeights, [context]: { ...mineDrop.toolWeights[context], [key]: Math.max(0, Number(event.target.value)) } } } })} /></label>)}</div>)}</div></details>

                            <details className="mine-drop-details allah-admin-wide"><summary>Altı maden katmanının blok ağırlıkları</summary><div className="mine-drop-matrix scrollable wide"><div className="mine-drop-matrix-row layers head"><b>Katman</b>{(["dirt", "stone", "blast", "redstone", "mystery", "gold", "diamond", "obsidian"] as const).map((key) => <span key={key}>{key}</span>)}</div>{mineDrop.layerWeights.map((row, rowIndex) => <div className="mine-drop-matrix-row layers" key={rowIndex}><b>{rowIndex + 1}</b>{(["dirt", "stone", "blast", "redstone", "mystery", "gold", "diamond", "obsidian"] as const).map((key) => <label key={key}><input type="number" min="0" step="0.1" value={row[key]} onChange={(event) => { const layerWeights = mineDrop.layerWeights.map((entry) => ({ ...entry })); layerWeights[rowIndex][key] = Math.max(0, Number(event.target.value)); updateAdminGame(game.id, { mineDrop: { ...mineDrop, layerWeights } }); }} /></label>)}</div>)}</div></details>

                            <section className="allah-admin-table allah-admin-wide">
                              <header><div><small>ÖDÜL HAVUZLARI</small><h4>Gizem bloğu, sandık ve Mystery sonucu</h4></div><p>Ağırlık yükseldikçe değer veya sonuç daha sık seçilir.</p></header>
                              <div className="mine-drop-prize-columns">
                                <div><b>Gizem bloğu</b>{Object.entries(mineDrop.mysteryValueWeights).map(([key, value]) => <label key={key}><span>{key}×</span><input type="number" min="0" step="0.1" value={value} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, mysteryValueWeights: { ...mineDrop.mysteryValueWeights, [key]: Math.max(0, Number(event.target.value)) } } })} /></label>)}</div>
                                <div><b>Sandık</b>{Object.entries(mineDrop.chestValueWeights).map(([key, value]) => <label key={key}><span>{key}×</span><input type="number" min="0" step="0.1" value={value} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, chestValueWeights: { ...mineDrop.chestValueWeights, [key]: Math.max(0, Number(event.target.value)) } } })} /></label>)}</div>
                                <div><b>Gizemli Dönüş</b>{(["none", "super", "epic"] as const).map((key) => <label key={key}><span>{{ none: "Boş", super: "Süper", epic: "Epik" }[key]}</span><input type="number" min="0" step="0.1" value={mineDrop.mysteryOutcomeWeights[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, mysteryOutcomeWeights: { ...mineDrop.mysteryOutcomeWeights, [key]: Math.max(0, Number(event.target.value)) } } })} /></label>)}</div>
                              </div>
                            </section>
                          </div>
                          <button className="allah-admin-reset" type="button" onClick={() => updateAdminGame(game.id, { mineDrop: DEFAULT_MINE_DROP_TUNING })}>ARAŞTIRILMIŞ VARSAYILAN PROFİLE DÖN</button>
                          <p className="slot-editor-warning">Bütün alanlar yeni tura canlı uygulanır. Dayanıklılık, sembol ağırlığı veya ödeme değişikliği gözlenen RTP’yi birlikte değiştirir.</p>
                        </div>
                      )}

                      {mineDrop && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "flow"}>
                          <div className="slot-editor-heading"><div><small>MADEN AKIŞ ŞEMASI</small><h4>Basamaklı yüzey, hazır saha derinliği ve ödeme ölçekleri</h4></div><code>belt → drop → bounce → hit → rebound</code></div>
                          <section className="slot-preset-picker">
                            <header><div><small>HAZIR AYAR PAKETLERİ</small><h4>Tek tıkla başlangıç profili</h4></div><p>Mevcut Akış &amp; Vitrin düzenini değiştirmeden Baykuş Madeni ayarlarına uygulanır.</p></header>
                            <div>
                              {(Object.entries(SLOT_PRESET_COPY) as Array<[SlotPresetId, (typeof SLOT_PRESET_COPY)[SlotPresetId]]>).map(([preset, copy]) => (
                                <button key={preset} type="button" onClick={() => applyAdminMineDropPreset(preset)}>
                                  <b>{copy.name}</b><span>{copy.summary}</span>
                                </button>
                              ))}
                            </div>
                          </section>
                          <div className="slot-flow-explainer"><strong>Normal kazma yalnız kendi sütunundaki ilk sağlam bloğa vurur; çevre hasarı sadece TNT ve Patlayıcı Cevher olayıdır.</strong><p>Duvar 5×6 mantıksal derinliği korur fakat üst yüzeyi her yeni turda basamaklı başlar. Elmas/Obsidyen dönüşleri daha derin ön kazı uygular; bonus duvarı otomatik dönüşlerde aynen korunur.</p></div>
                          <div className="slot-parameter-grid">
                            <label><span>Yüzey en az boş sıra</span><input type="number" min="0" max="5" step="1" value={mineDrop.surfaceProfile.minOpenRows} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, surfaceProfile: { ...mineDrop.surfaceProfile, minOpenRows: Math.max(0, Math.min(5, Math.round(Number(event.target.value)))) } } })} /><em>açık sıra</em></label>
                            <label><span>Yüzey en çok boş sıra</span><input type="number" min="0" max="5" step="1" value={mineDrop.surfaceProfile.maxOpenRows} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, surfaceProfile: { ...mineDrop.surfaceProfile, maxOpenRows: Math.max(0, Math.min(5, Math.round(Number(event.target.value)))) } } })} /><em>açık sıra</em></label>
                            <label><span>Komşu sütun azami kot farkı</span><input type="number" min="0" max="5" step="1" value={mineDrop.surfaceProfile.maxStep} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, surfaceProfile: { ...mineDrop.surfaceProfile, maxStep: Math.max(0, Math.min(5, Math.round(Number(event.target.value)))) } } })} /><em>sıra</em></label>
                            {(["diamond", "obsidian"] as const).map((key) => <label key={key}><span>{key === "diamond" ? "Elmas hazır kazı derinliği" : "Obsidyen hazır kazı derinliği"}</span><input type="number" min="0" max="5" step="1" value={mineDrop.premiumOpenRows[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, premiumOpenRows: { ...mineDrop.premiumOpenRows, [key]: Math.max(0, Math.min(5, Math.round(Number(event.target.value)))) } } })} /><em>açık sıra</em></label>)}
                          </div>
                          <section className="allah-admin-table allah-admin-wide"><header><div><small>ÖDEME ÖLÇEKLERİ</small><h4>Her akış için bağımsız çarpan</h4></div><p>1, özgün ödeme tablosudur. Eğlence dengesi için bağlam bazında artırılabilir veya azaltılabilir.</p></header><div className="allah-admin-weight-grid">{(["base", "extra", "super", "diamond", "obsidian", "bonus-block", "bonus-super", "bonus-epic", "mystery"] as const).map((key) => <label key={key}><span>{key}</span><input type="number" min="0" max="100" step="0.01" value={mineDrop.payoutScales[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, payoutScales: { ...mineDrop.payoutScales, [key]: Math.max(0, Number(event.target.value)) } } })} /><em>×</em></label>)}</div></section>
                        </div>
                      )}

                      {mineDrop && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "experience"}>
                          <div className="slot-editor-heading"><div><small>AKIŞ KOREOGRAFİSİ</small><h4>Her animasyon adımının canlı süresi</h4></div><span>SONUCU DEĞİŞTİRMEZ</span></div>
                          <div className="slot-parameter-grid">
                            {([[
                              "reelMs", "Makara hazırlığı", 100, 5000, 25, "ms"], ["dropMs", "Kazma düşüşü", 80, 2500, 10, "ms"], ["bounceMs", "Zıplama", 30, 1000, 10, "ms"], ["hitMs", "Tek darbe", 40, 1500, 10, "ms"], ["breakMs", "Blok kırılması", 50, 2000, 10, "ms"], ["blastMs", "Patlama", 100, 3000, 25, "ms"], ["chestMs", "Sandık açılışı", 100, 4000, 25, "ms"], ["countUpMs", "Kazanç sayacı", 100, 5000, 25, "ms"], ["turboScale", "Turbo süre ölçeği", 0.05, 1, 0.01, "×"]] as const).map(([key, label, min, max, step, unit]) => <label key={key}><span>{label}</span><input type="number" min={min} max={max} step={step} value={mineDrop.animation[key]} onChange={(event) => updateAdminGame(game.id, { mineDrop: { ...mineDrop, animation: { ...mineDrop.animation, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } } })} /><em>{unit}</em></label>)}
                          </div>
                          <p className="slot-editor-warning">Normal modda yedi vuruş gerçekten yedi ayrı animasyondur. Turbo yalnız süreleri ölçekler; olay sırasını, blok canını ve sonucu değiştirmez.</p>
                        </div>
                      )}

                      {slot && isSimulatableSlot(game.id) && (
                        <div
                          className="admin-editor-pane slot-simulator"
                          hidden={gameEditorSection !== "simulation"}
                        >
                          <SlotSimulationPanel game={{ ...game, id: game.id }} />
                        </div>
                      )}

                      {crash && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "math"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>CANLI CRASH MOTORU</small>
                              <h4>Tur temposu, eğri ve dağılım sınırları</h4>
                            </div>
                            <code>{crash.profileName}</code>
                          </div>
                          <label className="slot-profile-name">
                            Profil sürümü
                            <input
                              value={crash.profileName}
                              onChange={(event) => updateAdminGame(game.id, {
                                crash: { ...crash, profileName: event.target.value },
                              })}
                            />
                          </label>
                          <div className="slot-parameter-grid">
                            {([
                              ["maxMultiplier", "Azami çarpan", 10, 100_000, 100, "×"],
                              ["bettingWindowMs", "Bahis penceresi", 3_000, 30_000, 250, "ms"],
                              ["resultWindowMs", "Sonuç sahnesi", 1_500, 15_000, 100, "ms"],
                              ["curveMs", "Uçuş eğrisi", 2_500, 15_000, 100, "ms"],
                              ["livePlayerCount", "Salon oyuncusu", 4, 80, 1, "kişi"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input
                                  type="number"
                                  min={min}
                                  max={max}
                                  step={step}
                                  value={crash[key]}
                                  onChange={(event) => updateAdminGame(game.id, {
                                    crash: {
                                      ...crash,
                                      [key]: Math.max(min, Math.min(max, Number(event.target.value))),
                                    },
                                  })}
                                />
                                <em>{unit}</em>
                              </label>
                            ))}
                          </div>
                          <p className="slot-editor-warning">
                            RTP, Genel sekmesindeki hedef üzerinden SHA-256 sonucuna uygulanır. Tur başladıktan sonra aktif sonuç değişmez; yeni ayarlar sonraki tura geçer.
                          </p>
                        </div>
                      )}

                      {mines && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "math"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>CANLI MINES MOTORU</small>
                              <h4>Tahta, risk ve ödeme sınırları</h4>
                            </div>
                            <code>{mines.profileName}</code>
                          </div>
                          <label className="slot-profile-name">
                            Profil sürümü
                            <input
                              value={mines.profileName}
                              onChange={(event) => updateAdminGame(game.id, {
                                mines: { ...mines, profileName: event.target.value },
                              })}
                            />
                          </label>
                          <div className="slot-parameter-grid">
                            {([
                              ["defaultMines", "Varsayılan çekirdek", 1, 24, 1, "adet"],
                              ["maxMines", "Azami çekirdek", 1, 24, 1, "adet"],
                              ["maxPayoutX", "Azami ödeme", 10, 10_000_000, 10, "×"],
                              ["depthRows", "Derin Hat kademesi", 6, 20, 1, "sıra"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input
                                  type="number"
                                  min={min}
                                  max={max}
                                  step={step}
                                  value={mines[key]}
                                  onChange={(event) => updateAdminGame(game.id, {
                                    mines: {
                                      ...mines,
                                      [key]: Math.max(min, Math.min(max, Number(event.target.value))),
                                    },
                                  })}
                                />
                                <em>{unit}</em>
                              </label>
                            ))}
                          </div>
                          <p className="slot-editor-warning">
                            Serbest Kazı ödemeleri kombinasyon olasılığından, Derin Hat ödemeleri satır riskinden hesaplanır. Hedef RTP yeni turlarda uygulanır; aktif tur değişmez.
                          </p>
                        </div>
                      )}

                      {countdown && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "math"}>
                          <div className="slot-editor-heading">
                            <div>
                              <small>COUNTDOWN KARAR MOTORU</small>
                              <h4>Aşama, karar süresi ve ödeme sınırları</h4>
                            </div>
                            <code>{countdown.profileName}</code>
                          </div>
                          <label className="slot-profile-name">
                            Profil sürümü
                            <input value={countdown.profileName} onChange={(event) => updateAdminGame(game.id, { countdown: { ...countdown, profileName: event.target.value } })} />
                          </label>
                          <div className="slot-parameter-grid">
                            {([
                              ["stages", "Geri sayım aşaması", 4, 20, 1, "adım"],
                              ["maxPayoutX", "Azami ödeme", 10, 10_000_000, 10, "×"],
                              ["choiceWindowMs", "İlk karar süresi", 2500, 15000, 100, "ms"],
                              ["finalChoiceWindowMs", "Son karar süresi", 1200, 10000, 100, "ms"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input type="number" min={min} max={max} step={step} value={countdown[key]} onChange={(event) => updateAdminGame(game.id, { countdown: { ...countdown, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } })} />
                                <em>{unit}</em>
                              </label>
                            ))}
                          </div>
                          <p className="slot-editor-warning">Her profilin güvenli göz oranı oyuncuya açık gösterilir. Ödemeler, hedef RTP ÷ kümülatif hayatta kalma olasılığı formülüyle yeni tur başında hesaplanır.</p>
                        </div>
                      )}

                      {plinko && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "math"}>
                          <div className="slot-editor-heading"><div><small>PLINKO OLASILIK MOTORU</small><h4>Sıra, eşzamanlı top ve ödeme sınırları</h4></div><code>{plinko.profileName}</code></div>
                          <label className="slot-profile-name">Profil sürümü<input value={plinko.profileName} onChange={(event) => updateAdminGame(game.id, { plinko: { ...plinko, profileName: event.target.value } })} /></label>
                          <div className="slot-parameter-grid">
                            {([
                              ["minRows", "Asgari sıra", 8, 16, 1, "sıra"],
                              ["maxRows", "Azami sıra", 8, 16, 1, "sıra"],
                              ["defaultRows", "Varsayılan sıra", 8, 16, 1, "sıra"],
                              ["maxPayoutX", "Azami çarpan", 10, 100_000, 10, "×"],
                              ["maxConcurrentBalls", "Eşzamanlı top", 1, 12, 1, "top"],
                            ] as const).map(([key, label, min, max, step, unit]) => <label key={key}><span>{label}</span><input type="number" min={min} max={max} step={step} value={plinko[key]} onChange={(event) => updateAdminGame(game.id, { plinko: { ...plinko, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } })} /><em>{unit}</em></label>)}
                          </div>
                          <p className="slot-editor-warning">Her gözün olasılığı binom dağılımından gelir. Çarpan tablosu hedef RTP’ye normalize edilir; Canvas animasyonu önceden mühürlenen gözü değiştirmez.</p>
                        </div>
                      )}

                      {plinko && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "experience"}>
                          <div className="slot-editor-heading"><div><small>PLINKO SAHNESİ</small><h4>Top düşüş ritmi</h4></div><span>SONUÇTAN BAĞIMSIZ</span></div>
                          <div className="slot-parameter-grid"><label><span>Düşüş süresi</span><input type="number" min="1200" max="6000" step="50" value={plinko.animationMs} onChange={(event) => updateAdminGame(game.id, { plinko: { ...plinko, animationMs: Math.max(1200, Math.min(6000, Number(event.target.value))) } })} /><em>ms</em></label></div>
                        </div>
                      )}

                      {countdown && (
                        <div className="admin-editor-pane" hidden={gameEditorSection !== "experience"}>
                          <div className="slot-editor-heading"><div><small>COUNTDOWN SAHNESİ</small><h4>Kapak açılışı ve turbo temposu</h4></div><span>SONUÇTAN BAĞIMSIZ</span></div>
                          <div className="slot-parameter-grid">
                            {([
                              ["normalRevealMs", "Normal kapak açılışı", 250, 2500, 25, "ms"],
                              ["turboRevealMs", "Turbo kapak açılışı", 120, 1200, 20, "ms"],
                            ] as const).map(([key, label, min, max, step, unit]) => (
                              <label key={key}><span>{label}</span><input type="number" min={min} max={max} step={step} value={countdown[key]} onChange={(event) => updateAdminGame(game.id, { countdown: { ...countdown, [key]: Math.max(min, Math.min(max, Number(event.target.value))) } })} /><em>{unit}</em></label>
                            ))}
                          </div>
                        </div>
                      )}

                      {slot && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "experience"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>OYUNCU DENEYİMİ</small>
                              <h4>Tempo, beklenti ve kalıcı ilerleme</h4>
                            </div>
                            <span>SONUÇTAN BAĞIMSIZ</span>
                          </div>
                          <div className="slot-experience-switches">
                            <Toggle
                              checked={slot.presentation.anticipation}
                              label="Scatter ve özel sembol beklenti sahneleri"
                              onChange={(anticipation) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    presentation: {
                                      ...slot.presentation,
                                      anticipation,
                                    },
                                  },
                                })
                              }
                            />
                            <Toggle
                              checked={slot.presentation.dynamicAudio}
                              label="Kazanç yoğunluğuna göre katmanlı ses"
                              onChange={(dynamicAudio) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    presentation: {
                                      ...slot.presentation,
                                      dynamicAudio,
                                    },
                                  },
                                })
                              }
                            />
                            <Toggle
                              checked={slot.presentation.progressHud}
                              label="Seviye ve hedef HUD'ı"
                              onChange={(progressHud) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    presentation: {
                                      ...slot.presentation,
                                      progressHud,
                                    },
                                  },
                                })
                              }
                            />
                            <Toggle
                              checked={slot.presentation.collectionBook}
                              label="Koleksiyon defteri"
                              onChange={(collectionBook) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    presentation: {
                                      ...slot.presentation,
                                      collectionBook,
                                    },
                                  },
                                })
                              }
                            />
                            <Toggle
                              checked={slot.progression.enabled}
                              label="Kalıcı oyun ilerlemesi"
                              onChange={(enabled) =>
                                updateAdminGame(game.id, {
                                  slot: {
                                    ...slot,
                                    progression: {
                                      ...slot.progression,
                                      enabled,
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="slot-experience-columns">
                            <section>
                              <small>ANİMASYON ZAMANLAMASI</small>
                              {presentationFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="number"
                                    min="40"
                                    max="10000"
                                    step="10"
                                    value={slot.presentation[field.key]}
                                    onChange={(event) =>
                                      updateAdminGame(game.id, {
                                        slot: {
                                          ...slot,
                                          presentation: {
                                            ...slot.presentation,
                                            [field.key]: Math.max(
                                              40,
                                              Number(event.target.value),
                                            ),
                                          },
                                        },
                                      })
                                    }
                                  />
                                  <em>ms</em>
                                </label>
                              ))}
                            </section>
                            <section>
                              <small>İLERLEME EKONOMİSİ</small>
                              {progressionFields.map((field) => (
                                <label key={field.key}>
                                  <span>{field.label}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100000"
                                    step="1"
                                    value={slot.progression[field.key]}
                                    onChange={(event) =>
                                      updateAdminGame(game.id, {
                                        slot: {
                                          ...slot,
                                          progression: {
                                            ...slot.progression,
                                            [field.key]: Math.max(
                                              0,
                                              Number(event.target.value),
                                            ),
                                          },
                                        },
                                      })
                                    }
                                  />
                                  <em>XP</em>
                                </label>
                              ))}
                            </section>
                          </div>
                        </div>
                      )}

                      {mines && (
                        <div
                          className="admin-editor-pane"
                          hidden={gameEditorSection !== "experience"}
                        >
                          <div className="slot-editor-heading">
                            <div>
                              <small>KAZI SUNUM MOTORU</small>
                              <h4>Mühür açılışı ve otomatik kazı temposu</h4>
                            </div>
                            <span>SONUÇTAN BAĞIMSIZ</span>
                          </div>
                          <div className="slot-parameter-grid">
                            {([
                              ["normalRevealMs", "Normal mühür açılışı", 180, 2_000, 10],
                              ["turboRevealMs", "Turbo mühür açılışı", 100, 1_000, 10],
                              ["remainingRevealMs", "Kalan çekirdek gösterimi", 30, 500, 10],
                              ["autoPickDelayMs", "Otomatik kazı aralığı", 150, 3_000, 10],
                            ] as const).map(([key, label, min, max, step]) => (
                              <label key={key}>
                                <span>{label}</span>
                                <input
                                  type="number"
                                  min={min}
                                  max={max}
                                  step={step}
                                  value={mines[key]}
                                  onChange={(event) => updateAdminGame(game.id, {
                                    mines: {
                                      ...mines,
                                      [key]: Math.max(min, Math.min(max, Number(event.target.value))),
                                    },
                                  })}
                                />
                                <em>ms</em>
                              </label>
                            ))}
                          </div>
                          <p className="slot-editor-warning">
                            Bu süreler yalnız sunumu etkiler. Önceden üretilmiş tahta, çarpan ve sonuç verisine dokunmaz.
                          </p>
                        </div>
                      )}

                      <section
                        className="admin-music-manager"
                        hidden={gameEditorSection !== "music"}
                      >
                        <header>
                          <div>
                            <small>ARKA PLAN MÜZİĞİ</small>
                            <strong>
                              {game.music.source === "catalog"
                                ? GAME_MUSIC_TRACKS.find(
                                    (track) => track.id === game.music.trackId,
                                  )?.name
                                : game.music.customName || "Özel kaynak"}
                            </strong>
                          </div>
                          <Toggle
                            checked={game.music.enabled}
                            label={game.music.enabled ? "AÇIK" : "KAPALI"}
                            onChange={(enabled) =>
                              updateAdminGame(game.id, {
                                music: { ...game.music, enabled },
                              })
                            }
                          />
                        </header>
                        <label>
                          Hazır müzik kataloğu
                          <select
                            value={
                              game.music.source === "catalog"
                                ? game.music.trackId
                                : ""
                            }
                            onChange={(event) =>
                              updateAdminGame(game.id, {
                                music: {
                                  ...game.music,
                                  source: "catalog",
                                  trackId: event.target.value,
                                  customName: "",
                                  customUrl: "",
                                },
                              })
                            }
                          >
                            <option value="" disabled>
                              Özel kaynak kullanılıyor
                            </option>
                            {GAME_MUSIC_TRACKS.map((track) => (
                              <option value={track.id} key={track.id}>
                                {track.name} · {track.mood}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="music-volume-row">
                          <span>
                            Oyun müzik seviyesi{" "}
                            <b>%{Math.round(game.music.volume * 100)}</b>
                          </span>
                          <input
                            aria-label={`${game.name} müzik seviyesi`}
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(game.music.volume * 100)}
                            onChange={(event) =>
                              updateAdminGame(game.id, {
                                music: {
                                  ...game.music,
                                  volume: Number(event.target.value) / 100,
                                },
                              })
                            }
                          />
                        </label>
                        <div className="music-url-row">
                          <input
                            aria-label={`${game.name} özel müzik URL adresi`}
                            placeholder="https://…/muzik.ogg veya /assets/music/parca.mp3"
                            value={game.music.customUrl}
                            onChange={(event) =>
                              updateAdminGame(game.id, {
                                music: {
                                  ...game.music,
                                  customUrl: event.target.value,
                                  customName:
                                    event.target.value.split("/").pop() ||
                                    "Özel bağlantı",
                                },
                              })
                            }
                          />
                          <button
                            disabled={!game.music.customUrl.trim()}
                            onClick={() =>
                              updateAdminGame(game.id, {
                                music: { ...game.music, source: "url" },
                              })
                            }
                          >
                            URL'Yİ KULLAN
                          </button>
                        </div>
                        <div className="music-file-row">
                          <label className="music-file-button">
                            {musicBusy === game.id
                              ? "YÜKLENİYOR…"
                              : "DOSYA YÜKLE"}
                            <input
                              type="file"
                              accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac"
                              disabled={musicBusy === game.id}
                              onChange={(event) => {
                                void uploadMusic(
                                  game.id,
                                  event.target.files?.[0],
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                          <button onClick={() => void previewMusic(game.id)}>
                            {musicPreview === game.id ? "■ DURDUR" : "▶ ÖNİZLE"}
                          </button>
                          {game.music.source === "upload" && (
                            <button
                              className="music-remove"
                              onClick={() => void clearUploadedMusic(game.id)}
                            >
                              YÜKLENENİ SİL
                            </button>
                          )}
                        </div>
                        <footer>
                          {game.music.source === "catalog"
                            ? "Yerleşik parçalar CC0 · kaynak bilgileri THIRD_PARTY_ASSETS.md içinde."
                            : game.music.source === "upload"
                              ? "Dosya IndexedDB içinde yalnızca bu tarayıcıda saklanır."
                              : "Bağlantının sürekli erişilebilir ve kullanım lisansının uygun olduğundan emin ol."}
                        </footer>
                      </section>
                      {!game.enabled && (
                        <label className="maintenance-copy">
                          Kapalı salon mesajı
                          <input
                            value={game.maintenanceMessage}
                            onChange={(event) =>
                              updateAdminGame(game.id, {
                                maintenanceMessage: event.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                    </article>
                  );
                })}
            </section>
            <p className="admin-calibration-note">
              RTP hedefi analiz/kalibrasyon referansıdır; geçmiş sonuçları
              yeniden yazmaz. Oyun motorunun gözlenen RTP’si hedef dışına
              çıkarsa genel bakışta uyarı oluşur.
            </p>
          </div>
        )}

        {tab === "competition" && <div className="admin-content"><CompetitionAdmin /></div>}

        {tab === "users" && <div className="admin-content"><AccountAdmin /></div>}

        {tab === "wallet" && (
          <div className="admin-content">
            <section className="admin-wallet-grid">
              <article className="wallet-command">
                <small>AKTİF OYUNCU CÜZDANI</small>
                <strong>
                  {money.format(balance)} <em>PR</em>
                </strong>
                <p>
                  Her yönetici işlemi wallet_ledger tablosuna notuyla birlikte
                  yazılır.
                </p>
                <label>
                  Tutar
                  <input
                    type="number"
                    min="1"
                    value={adjustment}
                    onChange={(event) =>
                      setAdjustment(Number(event.target.value))
                    }
                  />
                  <em>PR</em>
                </label>
                <label>
                  İşlem açıklaması
                  <input
                    value={adjustmentReason}
                    onChange={(event) =>
                      setAdjustmentReason(event.target.value)
                    }
                  />
                </label>
                <div>
                  <button onClick={() => adjustBalance(1)}>
                    + Bakiye ekle
                  </button>
                  <button
                    className="danger"
                    onClick={() => adjustBalance(-1)}
                    disabled={balance < adjustment}
                  >
                    − Bakiye düş
                  </button>
                </div>
              </article>
              <article className="admin-card wallet-totals">
                <header>
                  <div>
                    <small>CÜZDAN HAREKETLERİ</small>
                    <h2>Kasa özeti</h2>
                  </div>
                </header>
                <span>
                  <small>TOPLAM BAHİS</small>
                  <b>{money.format(summary?.totalStake ?? 0)} PR</b>
                </span>
                <span>
                  <small>TOPLAM ÖDEME</small>
                  <b>{money.format(summary?.totalPayout ?? 0)} PR</b>
                </span>
                <span>
                  <small>YÖNETİCİ İŞLEMİ</small>
                  <b>
                    {money.format(
                      ledger
                        .filter(
                          (entry) =>
                            entry.type === "credit" ||
                            entry.type === "adjustment",
                        )
                        .reduce((sum, entry) => sum + entry.amount, 0),
                    )}{" "}
                    PR
                  </b>
                </span>
              </article>
            </section>
            <section className="admin-ledger">
              <header>
                <span>ZAMAN</span>
                <span>TÜR</span>
                <span>OYUN / NOT</span>
                <span>ÖNCE</span>
                <span>HAREKET</span>
                <span>SONRA</span>
              </header>
              {ledger.slice(0, 80).map((entry) => (
                <article key={entry.id}>
                  <time>{moment(entry.occurredAt)}</time>
                  <i>{entry.type}</i>
                  <span>
                    <b>{entry.game ? gameNames[entry.game] : "Yönetim"}</b>
                    <small>{entry.note}</small>
                  </span>
                  <em>
                    {entry.balanceBefore === undefined
                      ? "—"
                      : money.format(entry.balanceBefore)}
                  </em>
                  <strong className={entry.amount >= 0 ? "up" : "down"}>
                    {entry.amount > 0 ? "+" : ""}
                    {money.format(entry.amount)} PR
                  </strong>
                  <em>
                    {entry.balanceAfter === undefined
                      ? "—"
                      : money.format(entry.balanceAfter)}
                  </em>
                </article>
              ))}
            </section>
          </div>
        )}

        {tab === "database" && (
          <div className="admin-content">
            <div className="admin-section-intro">
              <div>
                <small>ORTAK SQLITE / CANLI KAYIT · ŞEMA V4</small>
                <h2>Oyun matematiği ve AI araştırması</h2>
                <p>
                  {rounds.length} tur · {ledger.length} cüzdan hareketi ·{" "}
                  {events.length} oyun olayı · {conversations.length} AI mesajı
                </p>
              </div>
              <div>
                <button onClick={() => void exportCasinoResearchJson('all')}>
                  Tüm veriyi JSON indir
                </button>
                <button onClick={() => void exportCasinoRoundsCsv('all')}>
                  Turları CSV indir
                </button>
              </div>
            </div>
            <section className="database-storage">
              <article>
                <small>ORTAK SQLITE</small>
                <strong>{formatBytes(storage?.sqliteBytes)}</strong>
                <span>
                  {storage?.sqliteConnected
                    ? "Bağlı · bütün portlar ortak"
                    : "Bağlantı yok · IndexedDB yedeği"}
                </span>
              </article>
              <article>
                <small>TUR DETAYLARI</small>
                <strong>{formatBytes(storage?.roundsBytes)}</strong>
                <span>{rounds.length} kayıt</span>
              </article>
              <article>
                <small>AI KONUŞMALARI</small>
                <strong>{formatBytes(storage?.conversationsBytes)}</strong>
                <span>{conversations.length} mesaj</span>
              </article>
              <article>
                <small>SQLITE KAYITLARI</small>
                <strong>
                  {storage?.sqliteCounts
                    ? Object.values(storage.sqliteCounts).reduce(
                        (sum, count) => sum + count,
                        0,
                      )
                    : 0}
                </strong>
                <span>Şema v3 · WAL</span>
              </article>
            </section>
            <div className="database-filters">
              <select
                value={gameFilter}
                onChange={(event) =>
                  setGameFilter(event.target.value as typeof gameFilter)
                }
              >
                <option value="all">Tüm oyunlar</option>
                {Object.keys(gameNames).map((game) => (
                  <option key={game} value={game}>
                    {gameNames[game as CasinoGameId]}
                  </option>
                ))}
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tur, sonuç veya varyant ara…"
              />
              <span>{filteredRounds.length} kayıt</span>
            </div>
            <section className="admin-round-table">
              <header>
                <span>ZAMAN</span>
                <span>OYUN</span>
                <span>KAYNAK</span>
                <span>BAHİS</span>
                <span>ÖDEME</span>
                <span>NET</span>
                <span>SONUÇ</span>
              </header>
              {filteredRounds.slice(0, 120).map((round) => (
                <article key={round.id}>
                  <time>{moment(round.settledAt)}</time>
                  <span>
                    <i>{gameGlyphs[round.game]}</i>
                    {gameNames[round.game]}
                  </span>
                  <small>
                    {round.source === "live-table"
                      ? "CANLI ARKA PLAN"
                      : "OYUNCU"}
                  </small>
                  <em>{money.format(round.stake)} PR</em>
                  <em>{money.format(round.grossPayout)} PR</em>
                  <strong className={round.net >= 0 ? "up" : "down"}>
                    {round.net > 0 ? "+" : ""}
                    {money.format(round.net)} PR
                  </strong>
                  <b>{round.outcome.toLocaleUpperCase("tr-TR")}</b>
                </article>
              ))}
            </section>
            <section className="admin-ai-table">
              <header>
                <span>ZAMAN</span>
                <span>KARAKTER / OYUN</span>
                <span>TÜR</span>
                <span>MESAJ</span>
                <span>GECİKME</span>
              </header>
              {conversations.slice(0, 100).map((message) => (
                <article key={message.id}>
                  <time>{moment(message.occurredAt)}</time>
                  <span>
                    <b>{message.character}</b>
                    <small>{gameNames[message.game]}</small>
                  </span>
                  <i className={message.speaker}>
                    {message.speaker === "user"
                      ? "OYUNCU"
                      : message.speaker === "assistant"
                        ? "AI CEVABI"
                        : "OYUN OLAYI"}
                  </i>
                  <p>{message.text}</p>
                  <em>
                    {message.latencyMs === undefined
                      ? "—"
                      : `${message.latencyMs} ms`}
                  </em>
                </article>
              ))}
              {!conversations.length && (
                <p className="admin-empty">Henüz AI konuşması kaydedilmedi.</p>
              )}
            </section>
            <section className="admin-danger-zone">
              <div>
                <small>TEHLİKELİ İŞLEM</small>
                <h3>Araştırma veritabanını temizle</h3>
                <p>
                  Tur, cüzdan, olay, AI konuşması ve meta kayıtları kalıcı
                  olarak silinir. Oyun bakiyesi silinmez.
                </p>
              </div>
              <input
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                placeholder="VERİLERİ SİL yaz"
              />
              <button
                disabled={deletePhrase !== "VERİLERİ SİL"}
                onClick={() => void clearData()}
              >
                Veritabanını temizle
              </button>
            </section>
          </div>
        )}

        {tab === "system" && (
          <div className="admin-content">
            <div className="admin-section-intro">
              <div>
                <small>GLOBAL AYARLAR</small>
                <h2>Casino sistemi</h2>
                <p>Marka, bakım, AI, ses ve veri politikası.</p>
              </div>
              <span>v{settings.version}.0</span>
            </div>
            <section className="admin-system-grid">
              <article className="admin-card system-form">
                <h3>Kimlik ve ortam</h3>
                <label>
                  Casino adı
                  <input
                    value={settings.general.casinoName}
                    onChange={(event) =>
                      updateGeneralSettings({ casinoName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Ortam etiketi
                  <input
                    value={settings.general.environmentLabel}
                    onChange={(event) =>
                      updateGeneralSettings({
                        environmentLabel: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Veri saklama hedefi
                  <input
                    type="number"
                    min="1"
                    value={settings.general.dataRetentionDays}
                    onChange={(event) =>
                      updateGeneralSettings({
                        dataRetentionDays: Number(event.target.value),
                      })
                    }
                  />
                  <em>gün</em>
                </label>
              </article>
              <article className="admin-card system-switches">
                <h3>Genel anahtarlar</h3>
                <Toggle
                  checked={settings.general.maintenanceMode}
                  label="Tüm casinoyu bakım moduna al"
                  onChange={(maintenanceMode) =>
                    updateGeneralSettings({ maintenanceMode })
                  }
                />
                <Toggle
                  checked={settings.general.aiEnabled}
                  label="Tüm AI karakterlerini etkinleştir"
                  onChange={(aiEnabled) => updateGeneralSettings({ aiEnabled })}
                />
                <Toggle
                  checked={settings.general.masterSound}
                  label="Ana ses sistemi"
                  onChange={(masterSound) =>
                    updateGeneralSettings({ masterSound })
                  }
                />
                <Toggle
                  checked={settings.general.musicEnabled}
                  label="Tüm arka plan müziklerini etkinleştir"
                  onChange={(musicEnabled) =>
                    updateGeneralSettings({ musicEnabled })
                  }
                />
                <label className="master-music-volume">
                  <span>
                    Ana müzik seviyesi{" "}
                    <b>%{Math.round(settings.general.musicVolume * 100)}</b>
                  </span>
                  <input
                    aria-label="Ana müzik ses seviyesi"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(settings.general.musicVolume * 100)}
                    onChange={(event) =>
                      updateGeneralSettings({
                        musicVolume: Number(event.target.value) / 100,
                      })
                    }
                  />
                </label>
                <Toggle
                  checked={settings.general.responsiblePlayNotice}
                  label="Eğlence modu uyarısı"
                  onChange={(responsiblePlayNotice) =>
                    updateGeneralSettings({ responsiblePlayNotice })
                  }
                />
              </article>
              <article className="admin-card system-meta">
                <h3>Sistem bilgisi</h3>
                <span>
                  <small>AYAR SON GÜNCELLEME</small>
                  <b>{moment(settings.updatedAt)}</b>
                </span>
                <span>
                  <small>VERİTABANI</small>
                  <b>SQLite · PehlevanRoyale</b>
                </span>
                <span>
                  <small>MÜZİK DEPOSU</small>
                  <b>IndexedDB · yerel özel parçalar</b>
                </span>
                <span>
                  <small>DEPOLAR</small>
                  <b>rounds · ledger · events · meta</b>
                </span>
                <button
                  onClick={() => {
                    resetAdminSettings();
                    flash("Sistem ayarları varsayılana döndü.");
                  }}
                >
                  Oyun ayarlarını varsayılana döndür
                </button>
              </article>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
