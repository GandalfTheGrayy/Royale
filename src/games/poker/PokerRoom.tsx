import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { PlayerOption, RandomStateSummary } from "poker-engine-ts";
import { askLeyla } from "../../ai/leyla";
import GameMusicControls from "../../audio/GameMusicControls";
import { playGameSfx } from "../../audio/game-sfx";
import {
  createRecordId,
  recordAIConversation,
  recordGameEvent,
  recordGameRound,
  recordWalletEntry,
} from "../../data/casino-database";
import {
  dealCasinoHoldem,
  resolveCasinoHoldem,
  type CasinoHoldemDeal,
  type CasinoHoldemResolution,
} from "./casino-holdem-engine";
import { formatPokerCard, pokerCardImage, type PokerCard } from "./poker-cards";
import {
  localPokerTransport,
  POKER_BOTS,
  type PokerSessionTransport,
} from "./poker-transport";
import "./poker.css";
import {
  CASINO_CHIP_VALUES,
  compactWager,
  normalizeWagerInput,
} from "../wagering";

type PokerMode = "casino" | "holdem";
type CasinoPhase =
  "idle" | "dealing" | "decision" | "turn" | "river" | "settled";

type Props = {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  onExit: () => void;
  aiOnline?: boolean;
};

const money = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const POKER_CHIPS = CASINO_CHIP_VALUES;
const wait = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

function playPokerSound(name: "shuffle" | "card" | "chip", volume = 0.5) {
  const file =
    name === "shuffle"
      ? "card-shuffle.ogg"
      : name === "card"
        ? "card-slide.ogg"
        : "chip-lay.ogg";
  playGameSfx("poker",`/assets/audio/${file}`,volume);
}

function playPokerDealSequence(count: number, gap = 135) {
  for (let index = 0; index < count; index += 1) {
    window.setTimeout(() => playPokerSound("card", 0.34), index * gap);
  }
  return Math.max(720, (count - 1) * gap + 560);
}

function PokerPlayingCard({
  card,
  hidden = false,
  order = 0,
  compact = false,
  highlighted = false,
  dimmed = false,
  placeholder = "KART",
}: {
  card?: PokerCard;
  hidden?: boolean;
  order?: number;
  compact?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  placeholder?: string;
}) {
  const empty = !card && !hidden;
  return (
    <span
      className={`poker-card ${hidden ? "is-back" : ""} ${empty ? "is-empty" : ""} ${compact ? "is-compact" : ""} ${highlighted ? "is-best-five" : ""} ${dimmed ? "is-dimmed" : ""}`}
      style={{ "--poker-card-order": order } as CSSProperties}
      aria-label={
        hidden
          ? "Kapalı kart"
          : empty
            ? `${placeholder} alanı`
            : formatPokerCard(card!)
      }
    >
      {empty ? (
        <span className="poker-card-empty">{placeholder}</span>
      ) : hidden ? (
        <span className="poker-card-seal">MP</span>
      ) : (
        <img
          src={pokerCardImage(card!)}
          alt=""
          draggable="false"
          decoding="async"
        />
      )}
    </span>
  );
}

function PokerTableChip({
  value,
  index = 0,
  flying = false,
}: {
  value: number;
  index?: number;
  flying?: boolean;
}) {
  return (
    <span
      className={`poker-table-chip poker-table-chip-${value} ${flying ? "is-flying" : ""}`}
      style={{ "--chip-stack": index } as CSSProperties}
    >
      <i>MP</i>
      <b>{compactWager(value)}</b>
    </span>
  );
}

function chipBreakdown(amount: number, limit = 8) {
  const chips: number[] = [];
  let remaining = Math.max(0, Math.round(amount));
  for (const value of [...POKER_CHIPS].reverse()) {
    while (remaining >= value && chips.length < limit) {
      chips.push(value);
      remaining -= value;
    }
  }
  if (!chips.length && amount > 0) chips.push(25);
  return chips;
}

function seatPoint(index: number, count: number) {
  const layouts: Record<number, Array<[number, number]>> = {
    2: [
      [50, 77],
      [50, 14],
    ],
    3: [
      [50, 77],
      [22, 26],
      [78, 26],
    ],
    4: [
      [50, 77],
      [15, 46],
      [50, 14],
      [85, 46],
    ],
    5: [
      [50, 77],
      [13, 55],
      [28, 17],
      [72, 17],
      [87, 55],
    ],
    6: [
      [50, 77],
      [13, 64],
      [20, 25],
      [50, 12],
      [80, 25],
      [87, 64],
    ],
    7: [
      [50, 77],
      [20, 82],
      [8, 59],
      [15, 30],
      [38, 12],
      [62, 12],
      [85, 30],
    ],
    8: [
      [50, 77],
      [20, 82],
      [8, 59],
      [15, 30],
      [38, 12],
      [62, 12],
      [85, 30],
      [92, 59],
    ],
    9: [
      [50, 77],
      [20, 82],
      [8, 59],
      [15, 30],
      [38, 12],
      [62, 12],
      [85, 30],
      [92, 59],
      [80, 82],
    ],
  };
  return layouts[count]?.[index] ?? [50, 50];
}

function PokerChip({
  value,
  onClick,
  disabled = false,
}: {
  value: number;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`poker-chip poker-chip-${value}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${money.format(value)} PR çip`}
    >
      <span>MP</span>
      <strong>{compactWager(value)}</strong>
    </button>
  );
}

type LeylaMessage = { speaker: "Leyla" | "Sen"; text: string };

function CasinoHoldemTable({
  balance,
  setBalance,
  aiOnline = false,
}: Omit<Props, "onExit">) {
  const [phase, setPhase] = useState<CasinoPhase>("idle");
  const [anteChips, setAnteChips] = useState<number[]>([100]);
  const [aaChips, setAaChips] = useState<number[]>([]);
  const [customChip, setCustomChip] = useState(1_000_000);
  const [betTarget, setBetTarget] = useState<"ante" | "aa">("ante");
  const [deal, setDeal] = useState<CasinoHoldemDeal>();
  const [resolution, setResolution] = useState<CasinoHoldemResolution>();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [chat, setChat] = useState<LeylaMessage[]>([
    {
      speaker: "Leyla",
      text: "Ante’yi kur. AA istiyorsan ayrı koy; flop gelince karar senin.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const aiSessionRef = useRef(`poker-leyla-${crypto.randomUUID()}`);
  const roundRef = useRef({ id: "", startedAt: "", balanceBefore: 0 });
  const ante = anteChips.reduce((sum, chip) => sum + chip, 0);
  const aaBet = aaChips.reduce((sum, chip) => sum + chip, 0);

  const rememberLeyla = (
    text: string,
    speaker: "assistant" | "system-event",
    latencyMs?: number,
  ) => {
    setChat((messages) =>
      [...messages, { speaker: "Leyla" as const, text }].slice(-12),
    );
    void recordAIConversation({
      id: createRecordId("ai-poker-leyla", crypto.randomUUID()),
      sessionId: aiSessionRef.current,
      roundId: roundRef.current.id || undefined,
      game: "poker",
      character: "Leyla",
      speaker,
      occurredAt: new Date().toISOString(),
      text,
      context: { phase, balance, ante, aaBet, result: resolution?.result },
      model:
        speaker === "assistant"
          ? aiOnline
            ? "local-ai"
            : "fallback-persona"
          : undefined,
      latencyMs,
    });
  };

  const addChip = (value: number) => {
    if (phase !== "idle" || ante + aaBet + value > balance) return;
    if (betTarget === "ante") setAnteChips((current) => [...current, value]);
    else setAaChips((current) => [...current, value]);
    playPokerSound("chip", 0.4);
  };

  const clearTarget = () => {
    if (phase !== "idle") return;
    if (betTarget === "ante") setAnteChips([]);
    else setAaChips([]);
  };

  const startHand = async () => {
    const openingStake = ante + aaBet;
    if (phase !== "idle" || ante < 25 || openingStake > balance) return;
    const roundId = `poker-casino-${Date.now()}-${crypto.randomUUID()}`;
    roundRef.current = {
      id: roundId,
      startedAt: new Date().toISOString(),
      balanceBefore: balance,
    };
    setBalance((current) => current - openingStake);
    setResolution(undefined);
    setSummaryOpen(false);
    setPhase("dealing");
    playPokerSound("shuffle", 0.5);
    await wait(650);
    const nextDeal = dealCasinoHoldem();
    setDeal(nextDeal);
    const dealDuration = playPokerDealSequence(7, 145);
    await wait(dealDuration);
    setPhase("decision");
    rememberLeyla(
      "Flop açık. Çekilirsen Ante gider; devam edersen iki kat Call. Elini değil, masayı oku.",
      "system-event",
    );
    void recordWalletEntry({
      id: createRecordId("poker-casino-open", roundId),
      roundId,
      game: "poker",
      occurredAt: roundRef.current.startedAt,
      type: "stake",
      amount: -openingStake,
      balanceBefore: balance,
      balanceAfter: balance - openingStake,
      note: `Casino Hold'em Ante ${ante} + AA ${aaBet}`,
    });
    void recordGameEvent({
      id: createRecordId("poker-casino-start", roundId),
      roundId,
      game: "poker",
      occurredAt: new Date().toISOString(),
      type: "casino-holdem-hand-started",
      payload: {
        ante,
        aaBet,
        playerCards: nextDeal.player,
        flop: nextDeal.flop,
        rulesProfile: "casino-holdem-nevada-v1",
      },
    });
  };

  const settle = async (called: boolean) => {
    if (!deal || phase !== "decision") return;
    const callCost = called ? ante * 2 : 0;
    if (called && balance < callCost) return;
    if (called) {
      setBalance((current) => current - callCost);
      playPokerSound("chip", 0.5);
    }
    void recordGameEvent({
      id: createRecordId("poker-casino-call", roundRef.current.id),
      roundId: roundRef.current.id,
      game: "poker",
      occurredAt: new Date().toISOString(),
      type: called ? "casino-holdem-call" : "casino-holdem-fold",
      payload: {
        phase: "flop",
        ante,
        aaBet,
        callCost,
        playerCards: deal.player,
        flop: deal.flop,
      },
    });
    if (called) {
      setPhase("turn");
      rememberLeyla(
        "Call masada. Önce turn geliyor; acele yok.",
        "system-event",
      );
      await wait(1_050);
      playPokerSound("card", 0.55);
      void recordGameEvent({
        id: createRecordId("poker-casino-turn", roundRef.current.id),
        roundId: roundRef.current.id,
        game: "poker",
        occurredAt: new Date().toISOString(),
        type: "casino-holdem-card-revealed",
        payload: { street: "turn", card: deal.turn },
      });
      setPhase("river");
      rememberLeyla("Turn açık. Bir nefes; river birazdan.", "system-event");
      await wait(1_350);
      playPokerSound("card", 0.55);
      void recordGameEvent({
        id: createRecordId("poker-casino-river", roundRef.current.id),
        roundId: roundRef.current.id,
        game: "poker",
        occurredAt: new Date().toISOString(),
        type: "casino-holdem-card-revealed",
        payload: { street: "river", card: deal.river },
      });
      await wait(1_150);
    } else {
      await wait(650);
    }
    const next = resolveCasinoHoldem(deal, ante, aaBet, called);
    setResolution(next);
    if (next.grossPayout) setBalance((current) => current + next.grossPayout);
    setPhase("settled");
    setSummaryOpen(true);
    rememberLeyla(next.message, "system-event");
    const settledAt = new Date().toISOString();
    const finalBalance = balance - callCost + next.grossPayout;
    void recordGameRound({
      id: `round:${roundRef.current.id}`,
      roundId: roundRef.current.id,
      game: "poker",
      variant: "Casino Hold'em · Leyla'ya karşı",
      source: "player",
      playerParticipated: true,
      startedAt: roundRef.current.startedAt,
      settledAt,
      stake: next.stake,
      grossPayout: next.grossPayout,
      net: next.net,
      outcome: next.net > 0 ? "win" : next.net < 0 ? "loss" : "push",
      balanceBefore: roundRef.current.balanceBefore,
      balanceAfter: finalBalance,
      result: {
        rulesProfile: "casino-holdem-nevada-v1",
        playerCards: deal.player,
        dealerCards: deal.dealer,
        board: [...deal.flop, deal.turn, deal.river],
        playerHand: next.playerHand,
        dealerHand: next.dealerHand,
        dealerQualifies: next.dealerQualifies,
        result: next.result,
      },
      modifiers: {
        ante,
        call: callCost,
        aaBet,
        aaMultiplier: next.aaMultiplier,
        anteGross: next.anteGross,
        callGross: next.callGross,
        aaGross: next.aaGross,
        winningBestFive:
          next.result === "player" || next.result === "dealer-no-qualify"
            ? next.playerHand.bestFive
            : next.result === "dealer"
              ? next.dealerHand.bestFive
              : [],
      },
    });
    if (callCost)
      void recordWalletEntry({
        id: createRecordId("poker-casino-call", roundRef.current.id),
        roundId: roundRef.current.id,
        game: "poker",
        occurredAt: settledAt,
        type: "stake",
        amount: -callCost,
        note: "Casino Hold'em 2× Call",
      });
    if (next.grossPayout)
      void recordWalletEntry({
        id: createRecordId("poker-casino-payout", roundRef.current.id),
        roundId: roundRef.current.id,
        game: "poker",
        occurredAt: settledAt,
        type: "payout",
        amount: next.grossPayout,
        note: next.message,
      });
  };

  const reset = () => {
    setDeal(undefined);
    setResolution(undefined);
    setSummaryOpen(false);
    setPhase("idle");
  };

  const leylaLine =
    chat.at(-1)?.speaker === "Leyla"
      ? chat.at(-1)!.text
      : phase === "idle"
        ? "Ante’yi kur. AA istiyorsan ayrı koy; flop gelince karar senin."
        : phase === "dealing"
          ? "İki sana, iki bana. Önce flop konuşsun."
          : phase === "decision"
            ? "Flopu gördün. Çekil ya da Ante’nin iki katıyla beni gör."
            : phase === "turn"
              ? "Call masada. Önce turn geliyor; kartı hazmet."
              : phase === "river"
                ? "Turn açık. River için bir nefes daha."
                : (resolution?.message ?? "El kapandı.");

  const sendChat = async () => {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    const userMessage = { speaker: "Sen" as const, text: prompt };
    const recent = [...chat, userMessage];
    setChat(recent.slice(-12));
    setDraft("");
    setThinking(true);
    void recordAIConversation({
      id: createRecordId("ai-poker-user", crypto.randomUUID()),
      sessionId: aiSessionRef.current,
      roundId: roundRef.current.id || undefined,
      game: "poker",
      character: "Leyla",
      speaker: "user",
      occurredAt: new Date().toISOString(),
      text: prompt,
      context: { phase, balance, ante, aaBet },
    });
    const startedAt = performance.now();
    const answer = await askLeyla(prompt, {
      phase,
      balance,
      ante,
      aaBet,
      playerCards: deal?.player.map(formatPokerCard) ?? [],
      board: deal
        ? [
            ...deal.flop,
            ...(phase === "river" || phase === "settled"
              ? [deal.turn, deal.river]
              : []),
          ].map(formatPokerCard)
        : [],
      lastResult: resolution?.result,
      recentMessages: recent
        .slice(-6)
        .map((message) => `${message.speaker}: ${message.text}`),
    });
    setThinking(false);
    rememberLeyla(
      answer,
      "assistant",
      Math.round(performance.now() - startedAt),
    );
  };

  const winningSide = !resolution
    ? undefined
    : resolution.result === "player" ||
        resolution.result === "dealer-no-qualify"
      ? "player"
      : resolution.result === "dealer"
        ? "dealer"
        : resolution.result === "push"
          ? "push"
          : "fold";
  const winningCards = new Set(
    winningSide === "player"
      ? resolution?.playerHand.bestFive
      : winningSide === "dealer"
        ? resolution?.dealerHand.bestFive
        : [],
  );

  return (
    <section className={`poker-game casino-holdem-game phase-${phase}`}>
      <div className="poker-table casino-poker-table">
        <div className="poker-felt-texture" />
        <div className="poker-deck-shoe casino-deck-shoe">
          <i />
          <i />
          <strong>MP</strong>
          <small>DESTE</small>
        </div>
        <div className="leyla-host">
          <img
            src="/assets/poker/leyla-poker-director-v1.png"
            alt="Poker direktörü Leyla"
          />
          <div className="leyla-name">
            <strong>LEYLA</strong>
            <small>POKER DİREKTÖRÜ</small>
          </div>
        </div>
        <div className="leyla-line">
          <span>LEYLA</span>
          {leylaLine}
        </div>

        <div className="casino-dealer-hand poker-hand-zone">
          <div className="poker-hand-label">
            KRUPİYE <small>{resolution?.dealerHand.label ?? "KAPALI"}</small>
          </div>
          <div className="poker-cards-row">
            {[0, 1].map((index) => (
              <PokerPlayingCard
                key={`dealer-${deal?.dealer[index] ?? "empty"}-${index}-${phase === "settled" && resolution?.result !== "fold" ? "open" : "back"}`}
                card={deal?.dealer[index]}
                hidden={Boolean(
                  deal &&
                  (phase !== "settled" || resolution?.result === "fold"),
                )}
                order={index * 2 + 1}
                highlighted={
                  phase === "settled" &&
                  winningSide === "dealer" &&
                  winningCards.has(deal!.dealer[index])
                }
                dimmed={
                  phase === "settled" &&
                  Boolean(resolution) &&
                  winningSide !== "push" &&
                  winningSide !== "fold" &&
                  !winningCards.has(deal!.dealer[index])
                }
              />
            ))}
          </div>
          {resolution && (
            <span
              className={`qualify-pill ${resolution.dealerQualifies ? "yes" : "no"}`}
            >
              {resolution.dealerQualifies ? "AÇILDI" : "AÇILAMADI"}
            </span>
          )}
        </div>

        <div className="casino-board">
          <div className="poker-hand-label">
            ORTAK KARTLAR <small>FLOP · TURN · RIVER</small>
          </div>
          <div className="poker-cards-row">
            {deal?.flop.map((card, index) => (
              <PokerPlayingCard
                key={card}
                card={card}
                order={4 + index}
                highlighted={phase === "settled" && winningCards.has(card)}
                dimmed={
                  phase === "settled" &&
                  winningSide !== "push" &&
                  winningSide !== "fold" &&
                  !winningCards.has(card)
                }
              />
            )) ??
              [0, 1, 2].map((index) => (
                <PokerPlayingCard key={index} placeholder="FLOP" />
              ))}
            <PokerPlayingCard
              key={`turn-${phase === "turn" || phase === "river" || phase === "settled" ? deal?.turn : "empty"}`}
              card={
                phase === "turn" || phase === "river" || phase === "settled"
                  ? deal?.turn
                  : undefined
              }
              placeholder="TURN"
              order={0}
              highlighted={
                phase === "settled" &&
                Boolean(deal) &&
                winningCards.has(deal!.turn)
              }
              dimmed={
                phase === "settled" &&
                winningSide !== "push" &&
                winningSide !== "fold" &&
                Boolean(deal) &&
                !winningCards.has(deal!.turn)
              }
            />
            <PokerPlayingCard
              key={`river-${phase === "river" || phase === "settled" ? deal?.river : "empty"}`}
              card={
                phase === "river" || phase === "settled"
                  ? deal?.river
                  : undefined
              }
              placeholder="RIVER"
              order={0}
              highlighted={
                phase === "settled" &&
                Boolean(deal) &&
                winningCards.has(deal!.river)
              }
              dimmed={
                phase === "settled" &&
                winningSide !== "push" &&
                winningSide !== "fold" &&
                Boolean(deal) &&
                !winningCards.has(deal!.river)
              }
            />
          </div>
        </div>

        <div className="casino-player-hand poker-hand-zone">
          <div className="poker-hand-label">
            MUHARREM{" "}
            <small>
              {resolution?.playerHand.label ??
                (deal ? "ELİN AÇIK" : "MASA HAZIR")}
            </small>
          </div>
          <div className="poker-cards-row">
            {[0, 1].map((index) => (
              <PokerPlayingCard
                key={`player-${deal?.player[index] ?? "empty"}-${index}`}
                card={deal?.player[index]}
                order={index * 2}
                highlighted={
                  phase === "settled" &&
                  winningSide === "player" &&
                  winningCards.has(deal!.player[index])
                }
                dimmed={
                  phase === "settled" &&
                  Boolean(resolution) &&
                  winningSide !== "push" &&
                  winningSide !== "fold" &&
                  !winningCards.has(deal!.player[index])
                }
              />
            ))}
          </div>
        </div>

        <button
          className={`casino-bet-spot ante ${betTarget === "ante" ? "selected" : ""}`}
          onClick={() => setBetTarget("ante")}
        >
          <small>ANTE</small>
          <strong>{money.format(ante)} PR</strong>
          <span>ANA BAHİS</span>
          <i className="casino-placed-chip-stack">
            {anteChips.slice(-8).map((chip, index) => (
              <PokerTableChip
                key={`${chip}-${index}`}
                value={chip}
                index={index}
                flying
              />
            ))}
            {anteChips.length > 8 && <em>+{anteChips.length - 8}</em>}
          </i>
        </button>
        <button
          className={`casino-bet-spot aa ${betTarget === "aa" ? "selected" : ""}`}
          onClick={() => setBetTarget("aa")}
        >
          <small>AA BONUS</small>
          <strong>{money.format(aaBet)} PR</strong>
          <span>AS ÇİFTİ VE ÜSTÜ</span>
          <i className="casino-placed-chip-stack">
            {aaChips.slice(-8).map((chip, index) => (
              <PokerTableChip
                key={`${chip}-${index}`}
                value={chip}
                index={index}
                flying
              />
            ))}
            {aaChips.length > 8 && <em>+{aaChips.length - 8}</em>}
          </i>
        </button>

        {(phase === "turn" || phase === "river") && (
          <div key={phase} className="casino-street-reveal">
            <small>KART AÇILIYOR</small>
            <strong>{phase === "turn" ? "TURN" : "RIVER"}</strong>
            <i />
          </div>
        )}
        {phase === "turn" && (
          <div className="casino-call-flight">
            {chipBreakdown(ante * 2, 5).map((chip, index) => (
              <PokerTableChip
                key={`${chip}-${index}`}
                value={chip}
                index={index}
              />
            ))}
            <strong>2× CALL · {money.format(ante * 2)} PR</strong>
          </div>
        )}
        {phase === "settled" && resolution && resolution.grossPayout > 0 && (
          <div className="casino-return-flight">
            {chipBreakdown(resolution.grossPayout, 6).map((chip, index) => (
              <PokerTableChip
                key={`${chip}-${index}`}
                value={chip}
                index={index}
              />
            ))}
            <strong>{money.format(resolution.grossPayout)} PR DÖNÜŞ</strong>
          </div>
        )}

        {summaryOpen && resolution && (
          <div
            className={`poker-result-modal ${resolution.net > 0 ? "win" : resolution.net < 0 ? "loss" : "push"}`}
          >
            <button
              className="poker-modal-close"
              onClick={() => setSummaryOpen(false)}
              aria-label="Kapat"
            >
              ×
            </button>
            <small>EL SONUCU</small>
            <h3>
              {resolution.net > 0
                ? "MASA SENİN"
                : resolution.net < 0
                  ? "LEYLA ALDI"
                  : "BERABERE"}
            </h3>
            <strong>
              {money.format(resolution.grossPayout)} <em>PR TOPLAM ÖDEME</em>
            </strong>
            <p>{resolution.message}</p>
            {winningSide === "fold" ? (
              <div className="casino-fold-explanation">
                <b>FOLD</b>
                <span>Kart karşılaştırması yapılmadı.</span>
                <p>
                  Eli sen bıraktığın için Leyla’nın kapalı kartları açılmadı;
                  Ante ve varsa AA Bonus masada kaldı.
                </p>
              </div>
            ) : (
              <div className="casino-result-comparison">
                <article className={winningSide === "player" ? "winner" : ""}>
                  <span>MUHARREM · {resolution.playerHand.label}</span>
                  <div>
                    {resolution.playerHand.bestFive.map((card, index) => (
                      <PokerPlayingCard
                        key={card}
                        card={card}
                        compact
                        order={index}
                        highlighted={winningSide === "player"}
                      />
                    ))}
                  </div>
                </article>
                <b>
                  {winningSide === "push"
                    ? "="
                    : winningSide === "player"
                      ? ">"
                      : "<"}
                </b>
                <article className={winningSide === "dealer" ? "winner" : ""}>
                  <span>LEYLA · {resolution.dealerHand.label}</span>
                  <div>
                    {resolution.dealerHand.bestFive.map((card, index) => (
                      <PokerPlayingCard
                        key={card}
                        card={card}
                        compact
                        order={index}
                        highlighted={winningSide === "dealer"}
                      />
                    ))}
                  </div>
                </article>
              </div>
            )}
            <div className="casino-payout-breakdown">
              <span>
                <small>TOPLAM YATIRILAN</small>
                <b>{money.format(resolution.stake)} PR</b>
              </span>
              <span>
                <small>NET SONUÇ</small>
                <b>
                  {resolution.net > 0 ? "+" : resolution.net < 0 ? "−" : ""}
                  {money.format(Math.abs(resolution.net))} PR
                </b>
              </span>
              <span>
                <small>ANTE DÖNÜŞÜ</small>
                <b>{money.format(resolution.anteGross)} PR</b>
              </span>
              <span>
                <small>CALL DÖNÜŞÜ</small>
                <b>{money.format(resolution.callGross)} PR</b>
              </span>
              <span>
                <small>AA BONUS</small>
                <b>{money.format(resolution.aaGross)} PR</b>
              </span>
            </div>
            {resolution.aaMultiplier > 0 && (
              <span>AA BONUS · {resolution.aaMultiplier}×</span>
            )}
            <button className="poker-primary" onClick={reset}>
              AYNI BAHİSLE YENİ EL →
            </button>
          </div>
        )}
      </div>

      <aside className="poker-side-panel casino-controls">
        <header>
          <span>CASINO HOLD’EM</span>
          <strong>ANTE MASASI</strong>
        </header>
        {phase === "decision" && (
          <div className="casino-decision-panel rail-decision">
            <div>
              <span>CALL BEDELİ</span>
              <strong>{money.format(ante * 2)} PR</strong>
              <small>Casino Hold’em’de flop sonrası tek karar verilir.</small>
            </div>
            <button
              className="poker-action danger"
              data-explain="Eli bırakır ve bu turu hemen bitirirsin. Ante ile AA Bonus masada kalır; ek Call bahsi ödemezsin."
              onClick={() => void settle(false)}
            >
              FOLD <small>Eli bırak · ek ödeme yok</small>
            </button>
            <button
              className="poker-action gold"
              data-explain={`Ante'nin iki katı olan ${money.format(ante * 2)} PR daha koyarsın. Turn ve river ayrı ayrı açılır; senin en iyi beş kartın Leyla'nın eliyle karşılaştırılır.`}
              disabled={balance < ante * 2}
              onClick={() => void settle(true)}
            >
              2× CALL <small>Turn ve river’ı tek tek aç</small>
            </button>
          </div>
        )}
        <div className="poker-rule-card">
          <b>KRUPİYE YETERLİLİĞİ</b>
          <strong>4’LÜ ÇİFT VEYA ÜSTÜ</strong>
          <p>Açılmazsa Call iade, Ante el tablosuna göre ödenir.</p>
        </div>
        <div className="poker-paytable">
          <span>
            <b>Royal Flush</b>
            <strong>100×</strong>
          </span>
          <span>
            <b>Straight Flush</b>
            <strong>20×</strong>
          </span>
          <span>
            <b>Kare</b>
            <strong>10×</strong>
          </span>
          <span>
            <b>Full House</b>
            <strong>3×</strong>
          </span>
          <span>
            <b>Floş</b>
            <strong>2×</strong>
          </span>
          <span>
            <b>Diğer kazanan</b>
            <strong>1×</strong>
          </span>
        </div>
        <div className="leyla-chat">
          <div className="leyla-chat-head">
            <span>LEYLA İLE KONUŞ</span>
            <i>● {aiOnline ? "YEREL AI" : "YEDEK KİŞİLİK"}</i>
          </div>
          <div className="leyla-chat-log">
            {chat.slice(-3).map((message, index) => (
              <p
                className={message.speaker === "Sen" ? "user" : "host"}
                key={`${message.text}-${index}`}
              >
                <b>{message.speaker}</b>
                {message.text}
              </p>
            ))}
            {thinking && (
              <p className="host">
                <b>Leyla</b>Düşünüyor…
              </p>
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
              placeholder="Leyla’ya yaz…"
            />
            <button disabled={!draft.trim() || thinking}>↑</button>
          </form>
        </div>
        <div className="poker-chip-rack">
          <div>
            <span>SEÇİLİ ALAN</span>
            <strong>{betTarget === "ante" ? "ANTE" : "AA BONUS"}</strong>
            <button onClick={clearTarget}>Temizle</button>
          </div>
          <div className="poker-chip-grid">
            {POKER_CHIPS.map((chip) => (
              <PokerChip
                key={chip}
                value={chip}
                disabled={phase !== "idle" || ante + aaBet + chip > balance}
                onClick={() => addChip(chip)}
              />
            ))}
          </div>
          <div className="poker-custom-chip">
            <label>
              <small>ÖZEL ÇİP</small>
              <input
                aria-label="Özel poker çip değeri"
                type="number"
                min="1"
                value={customChip}
                disabled={phase !== "idle"}
                onChange={(event) =>
                  setCustomChip(
                    normalizeWagerInput(Number(event.target.value), 1),
                  )
                }
              />
            </label>
            <button
              disabled={phase !== "idle" || ante + aaBet + customChip > balance}
              onClick={() => addChip(customChip)}
            >
              KOY
            </button>
            <button
              disabled={phase !== "idle" || balance - ante - aaBet <= 0}
              onClick={() => addChip(balance - ante - aaBet)}
            >
              MAX
            </button>
          </div>
        </div>
        <button
          className="poker-primary deal-button"
          disabled={phase !== "idle" || ante < 25 || ante + aaBet > balance}
          onClick={() => void startHand()}
        >
          KARTLARI DAĞIT <span>{money.format(ante + aaBet)} PR</span>
        </button>
      </aside>
    </section>
  );
}

function actionLabel(option: PlayerOption) {
  if (option.type === "fold") return "FOLD";
  if (option.type === "check") return "CHECK";
  if (option.type === "call") return `CALL · ${money.format(option.amount)}`;
  if (option.type === "all-in")
    return `ALL-IN · ${money.format(option.amount)}`;
  return option.type === "bet" ? "BET" : "RAISE";
}

function actionExplain(option: PlayerOption, raiseAmount: number) {
  if (option.type === "fold")
    return "Kartlarını bırakır, bu pot için yatırdığın çiplerden vazgeçersin. Bu el boyunca başka karar vermezsin.";
  if (option.type === "check")
    return "Yeni çip koymadan sırayı geçirirsin. Yalnızca önünde eşlemen gereken açık bir bahis yoksa kullanılabilir.";
  if (option.type === "call")
    return `Masadaki en yüksek bahsi eşitlemek için ${money.format(option.amount)} PR koyarsın ve elde kalırsın.`;
  if (option.type === "all-in")
    return `Önündeki kullanılabilir stack'in tamamını, ${money.format(option.amount)} PR'yi pota sürersin. Gerekirse ayrı bir yan pot oluşur.`;
  if (option.type === "bet")
    return `Bu turdaki ilk bahsi ${money.format(raiseAmount)} PR olarak açarsın. Diğer oyuncular eşlemek, yükseltmek veya çekilmek zorunda kalır.`;
  return `Mevcut bahsi ${money.format(raiseAmount)} PR seviyesine yükseltirsin. Rakipler yeni tutarı eşlemek, tekrar yükseltmek veya çekilmek zorunda kalır.`;
}

function pokerHandLabel(rankClass?: string) {
  const labels: Record<string, string> = {
    "royal-flush": "Royal Flush",
    "straight-flush": "Straight Flush",
    "four-of-a-kind": "Kare",
    "full-house": "Full House",
    flush: "Floş",
    straight: "Kent",
    "three-of-a-kind": "Üçlü",
    "two-pair": "İki Çift",
    pair: "Bir Çift",
    "high-card": "Yüksek Kart",
  };
  return rankClass
    ? (labels[rankClass] ?? rankClass.replaceAll("-", " "))
    : "El açıklanmadı";
}

function TexasHoldemTable({
  balance,
  setBalance,
  transport = localPokerTransport,
  registerCashout,
}: Omit<Props, "onExit"> & {
  transport?: PokerSessionTransport;
  registerCashout: (handler: () => void) => void;
}) {
  const [botCount, setBotCount] = useState(5);
  const [buyIn, setBuyIn] = useState(20_000);
  const [smallBlind, setSmallBlind] = useState(100);
  const [stackMode, setStackMode] = useState<"equal" | "open">("equal");
  const [summary, setSummary] = useState<RandomStateSummary>();
  const [joined, setJoined] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(400);
  const [actionFeed, setActionFeed] = useState<string[]>([]);
  const [handNumber, setHandNumber] = useState(1);
  const [buttonIndex, setButtonIndex] = useState(0);
  const [chipFlight, setChipFlight] = useState<{
    id: number;
    seatIndex: number;
    amount: number;
  }>();
  const settledRef = useRef<string | undefined>(undefined);
  const handStartStacksRef = useRef<Record<string, number>>({});
  const sessionStartedAtRef = useRef("");
  const escrowBalanceRef = useRef(0);

  const snapshot = summary?.session.activeSnapshot;
  const decision = summary?.decision;
  const heroSeat = snapshot?.seating.seats.find(
    (seat) => seat?.occupant?.playerId === "muharrem",
  );
  const heroStack = heroSeat?.stack ?? escrowBalanceRef.current;
  const isSettled = snapshot?.hand.stage === "settled";
  const isHeroTurn = decision?.actor === "muharrem";
  const board = snapshot
    ? ([
        ...(snapshot.cards.community.flop ?? []),
        snapshot.cards.community.turn,
        snapshot.cards.community.river,
      ].filter(Boolean) as PokerCard[])
    : [];
  const folded = useMemo(
    () =>
      new Set(
        summary?.session.events
          .map((envelope) => envelope.event)
          .filter((event) => event.action.type === "fold")
          .map((event) => event.actor) ?? [],
      ),
    [summary],
  );
  const showdownPlayers = new Set(
    snapshot?.hand.showdown?.evaluatedHands.map((hand) => hand.playerId) ?? [],
  );

  const stacksFrom = (state: RandomStateSummary) =>
    Object.fromEntries(
      state.session.activeSnapshot.seating.seats
        .filter((seat) => seat?.occupant)
        .map((seat) => [seat!.occupant!.playerId, seat!.stack]),
    );

  const createHand = async (
    stacks?: Record<string, number>,
    nextButton = 0,
    tableBuyIn = buyIn,
  ) => {
    setProcessing(true);
    playPokerSound("shuffle", 0.45);
    const next = await transport.create({
      botCount,
      buyIn: tableBuyIn,
      smallBlind,
      bigBlind: smallBlind * 2,
      stacks,
      buttonIndex: nextButton,
    });
    handStartStacksRef.current = Object.fromEntries(
      next.session.activeSnapshot.seating.seats
        .filter((seat) => seat?.occupant)
        .map((seat) => [seat!.occupant!.playerId, seat!.stack]),
    );
    settledRef.current = undefined;
    setSummary(next);
    setActionFeed([
      `${handNumber}. el açıldı · ${money.format(smallBlind)}/${money.format(smallBlind * 2)}`,
    ]);
    const handRoundId = `poker-holdem-${next.session.activeSnapshot.hand.id}`;
    void recordGameEvent({
      id: createRecordId("poker-hand-start", handRoundId),
      roundId: handRoundId,
      game: "poker",
      occurredAt: new Date().toISOString(),
      type: "poker-hand-started",
      payload: {
        sessionId: next.session.id,
        handId: next.session.activeSnapshot.hand.id,
        handNumber,
        buttonIndex: next.session.activeSnapshot.hand.buttonSeat,
        blinds: { small: smallBlind, big: smallBlind * 2 },
        stackMode,
        startingStacks: handStartStacksRef.current,
        seats: next.session.activeSnapshot.seating.seats
          .filter((seat) => seat?.occupant)
          .map((seat) => ({
            playerId: seat!.occupant!.playerId,
            displayName: seat!.occupant!.displayName,
            seatIndex: seat!.index,
            stack: seat!.stack,
          })),
      },
    });
    const occupiedSeats = next.session.activeSnapshot.seating.seats.filter(
      (seat) => seat?.occupant,
    ).length;
    const dealDuration = playPokerDealSequence(occupiedSeats * 2, 110);
    await wait(dealDuration);
    setProcessing(false);
  };

  const joinTable = async () => {
    const entryStack = stackMode === "open" ? Math.floor(balance) : buyIn;
    if (joined || entryStack > balance || entryStack < smallBlind * 20) return;
    const openStacks =
      stackMode === "open"
        ? Object.fromEntries([
            ["muharrem", entryStack],
            ...POKER_BOTS.slice(0, botCount).map(
              (bot) => [bot.id, bot.bankroll] as const,
            ),
          ])
        : undefined;
    escrowBalanceRef.current = entryStack;
    sessionStartedAtRef.current = new Date().toISOString();
    setBalance((current) => current - entryStack);
    setJoined(true);
    void recordWalletEntry({
      id: createRecordId("poker-buyin", crypto.randomUUID()),
      game: "poker",
      occurredAt: sessionStartedAtRef.current,
      type: "stake",
      amount: -entryStack,
      balanceBefore: balance,
      balanceAfter: balance - entryStack,
      note: `Texas Hold'em ${stackMode === "open" ? "açık kasa" : "buy-in"} · ${botCount + 1} kişi`,
    });
    await createHand(openStacks, 0, entryStack);
  };

  const cashOut = () => {
    if (!joined) return;
    const amount = heroStack;
    escrowBalanceRef.current = 0;
    setBalance((current) => current + amount);
    setJoined(false);
    setSummary(undefined);
    void recordWalletEntry({
      id: createRecordId("poker-cashout", crypto.randomUUID()),
      game: "poker",
      occurredAt: new Date().toISOString(),
      type: "payout",
      amount,
      note: "Texas Hold'em masadan kalkış / kasa çıkışı",
    });
  };

  useEffect(() => registerCashout(cashOut), [joined, heroStack]);

  const appendLatestAction = (next: RandomStateSummary) => {
    const latest = next.session.events.at(-1)?.event;
    if (!latest) return;
    const player =
      latest.actor === "muharrem"
        ? "Sen"
        : (POKER_BOTS.find((bot) => bot.id === latest.actor)?.name ??
          latest.actor);
    const amount =
      "amount" in latest.action
        ? ` · ${money.format(latest.action.amount)} PR`
        : "";
    setActionFeed((lines) =>
      [
        `${player}: ${latest.action.type.toUpperCase()}${amount}`,
        ...lines,
      ].slice(0, 10),
    );
    if ("amount" in latest.action && latest.action.amount > 0) {
      const seatIndex = next.session.activeSnapshot.seating.seats.find(
        (seat) => seat?.occupant?.playerId === latest.actor,
      )?.index;
      if (seatIndex !== undefined)
        setChipFlight({
          id: Date.now(),
          seatIndex,
          amount: latest.action.amount,
        });
    }
    const nextSnapshot = next.session.activeSnapshot;
    const roundId = `poker-holdem-${nextSnapshot.hand.id}`;
    const totalPot =
      nextSnapshot.pots.main.amount +
      nextSnapshot.pots.sides.reduce((sum, pot) => sum + pot.amount, 0);
    void recordGameEvent({
      id: createRecordId("poker-action", roundId),
      roundId,
      game: "poker",
      occurredAt: new Date(latest.timestamp).toISOString(),
      type: "poker-player-action",
      payload: {
        sessionId: next.session.id,
        handId: nextSnapshot.hand.id,
        snapshotIndex: nextSnapshot.index,
        street: nextSnapshot.hand.stage,
        actor: latest.actor,
        actorName: player,
        actorKind: latest.actor === "muharrem" ? "player" : "bot",
        botProfile: POKER_BOTS.find((bot) => bot.id === latest.actor),
        action: latest.action,
        legalOptions: latest.legalOptions,
        stackBefore: latest.stackBefore,
        stackAfter: latest.stackAfter,
        contribution: latest.contribution,
        potAfter: totalPot,
        botDecisionDelayMs: latest.actor === "muharrem" ? undefined : 1_000,
        metadata: latest.metadata,
      },
    });
  };

  const chooseAction = async (option: PlayerOption) => {
    if (!summary || !isHeroTurn || processing) return;
    setProcessing(true);
    const next = await transport.applyPlayerAction(
      summary,
      "muharrem",
      option,
      option.type === "bet" || option.type === "raise"
        ? raiseAmount
        : undefined,
    );
    appendLatestAction(next);
    playPokerSound(
      option.type === "fold" || option.type === "check" ? "card" : "chip",
      0.42,
    );
    const streetChanged =
      summary.session.activeSnapshot.hand.stage !==
      next.session.activeSnapshot.hand.stage;
    setSummary(next);
    if (streetChanged && next.session.activeSnapshot.hand.stage !== "settled") {
      playPokerSound("card", 0.44);
      await wait(900);
    }
    setProcessing(false);
  };

  useEffect(() => {
    if (!summary || !decision?.actor || isHeroTurn || processing || isSettled)
      return;
    const timer = window.setTimeout(async () => {
      setProcessing(true);
      try {
        const next = await transport.advanceBot(summary);
        appendLatestAction(next);
        playPokerSound("chip", 0.28);
        const streetChanged =
          summary.session.activeSnapshot.hand.stage !==
          next.session.activeSnapshot.hand.stage;
        setSummary(next);
        if (
          streetChanged &&
          next.session.activeSnapshot.hand.stage !== "settled"
        ) {
          playPokerSound("card", 0.42);
          await wait(900);
        }
      } catch (error) {
        setActionFeed((lines) =>
          [
            `${POKER_BOTS.find((bot) => bot.id === decision.actor)?.name ?? "Bot"}: karar motoru toparlandı, sıra ilerletiliyor`,
            ...lines,
          ].slice(0, 10),
        );
        try {
          const recovered = await localPokerTransport.advanceBot(summary);
          appendLatestAction(recovered);
          setSummary(recovered);
        } catch {
          setActionFeed((lines) =>
            [
              "Masa motoru bu kararı tamamlayamadı; eli yeniden açabilirsin.",
              ...lines,
            ].slice(0, 10),
          );
        }
      } finally {
        setProcessing(false);
      }
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [summary, decision?.actor, isHeroTurn, processing, isSettled, transport]);

  useEffect(() => {
    const option = decision?.availableActions.find(
      (candidate) => candidate.type === "raise" || candidate.type === "bet",
    );
    if (option && (option.type === "raise" || option.type === "bet"))
      setRaiseAmount(option.min);
  }, [decision?.actor, snapshot?.index]);

  useEffect(() => {
    if (!summary || !isSettled || settledRef.current === snapshot?.hand.id)
      return;
    settledRef.current = snapshot?.hand.id;
    const finalStacks = stacksFrom(summary);
    escrowBalanceRef.current = finalStacks.muharrem ?? 0;
    const startStack = handStartStacksRef.current.muharrem ?? buyIn;
    const payout =
      snapshot?.hand.payouts?.entries
        .filter((entry) => entry.playerId === "muharrem")
        .reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    const potSize =
      snapshot?.hand.payouts?.entries.reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ) ?? 0;
    const finalStack = finalStacks.muharrem ?? 0;
    const net = finalStack - startStack;
    const stake = Math.max(0, startStack - finalStack + payout);
    const roundId = `poker-holdem-${snapshot?.hand.id}`;
    void recordGameRound({
      id: `round:${roundId}`,
      roundId,
      game: "poker",
      variant: `No-Limit Texas Hold'em · ${botCount + 1} kişi`,
      source: "player",
      playerParticipated: true,
      startedAt: sessionStartedAtRef.current,
      settledAt: new Date().toISOString(),
      stake,
      grossPayout: payout,
      net,
      outcome: net > 0 ? "win" : net < 0 ? "loss" : "push",
      result: {
        telemetryVersion: 1,
        engine: "poker-engine-ts@0.1.3",
        engineMode: transport.kind,
        sessionId: summary.session.id,
        handId: snapshot?.hand.id,
        potSize,
        opponentCount: botCount,
        board,
        heroCards: snapshot?.cards.holeCards.muharrem,
        showdown: snapshot?.hand.showdown,
        payouts: snapshot?.hand.payouts,
        finalStacks,
        eventLog: summary.session.events,
      },
      modifiers: {
        botCount,
        buyIn,
        smallBlind,
        bigBlind: smallBlind * 2,
        buttonIndex,
        stackMode,
      },
    });
    void recordGameEvent({
      id: createRecordId("poker-hand-complete", roundId),
      roundId,
      game: "poker",
      occurredAt: new Date().toISOString(),
      type: "poker-hand-completed",
      payload: {
        net,
        stake,
        payout,
        finalStacks,
        engineEvents: summary.session.events.length,
      },
    });
  }, [summary, isSettled]);

  const nextHand = async () => {
    if (!summary || !isSettled || heroStack <= 0) return;
    const stacks = stacksFrom(summary);
    const nextButton =
      (buttonIndex + 1) % Math.max(2, Object.keys(stacks).length);
    setButtonIndex(nextButton);
    setHandNumber((current) => current + 1);
    await createHand(stacks, nextButton);
  };

  const maxBuyIn = Math.max(2_000, Math.floor(balance / 1_000) * 1_000);
  const entryStack = stackMode === "open" ? Math.floor(balance) : buyIn;
  const minimumBuyIn = smallBlind * 20;
  const canJoin = entryStack <= balance && entryStack >= minimumBuyIn;
  const selectBlind = (nextBlind: number) => {
    setSmallBlind(nextBlind);
    const nextMinimum = nextBlind * 20;
    if (stackMode === "equal" && buyIn < nextMinimum && nextMinimum <= balance)
      setBuyIn(nextMinimum);
  };

  if (!joined)
    return (
      <section className="poker-game holdem-setup-screen">
        <div className="holdem-setup-hero">
          <span>PEHLEVAN ROYALE · CASH GAME</span>
          <h2>Kendi masanı kur.</h2>
          <p>
            Bir rakipten sekiz bota kadar. Her botun ayrı ritmi, blöf eğilimi ve
            risk iştahı var.
          </p>
          <div className="bot-preview-row">
            {POKER_BOTS.slice(0, botCount).map((bot) => (
              <span
                key={bot.id}
                style={{ "--bot-color": bot.color } as CSSProperties}
              >
                <b>{bot.monogram}</b>
                <small>{bot.name}</small>
                {stackMode === "open" && (
                  <em>{money.format(bot.bankroll)} PR</em>
                )}
              </span>
            ))}
          </div>
        </div>
        <aside className="holdem-config-panel">
          <header>
            <span>MASA KURULUMU</span>
            <strong>NO-LIMIT HOLD’EM</strong>
          </header>
          <div
            className="stack-mode-switch"
            role="group"
            aria-label="Masa para modu"
          >
            <button
              className={stackMode === "equal" ? "active" : ""}
              onClick={() => setStackMode("equal")}
            >
              <strong>EŞİT BUY-IN</strong>
              <small>Herkes aynı stack</small>
            </button>
            <button
              className={stackMode === "open" ? "active" : ""}
              onClick={() => setStackMode("open")}
            >
              <strong>AÇIK KASA</strong>
              <small>Cüzdan kadar · No Limit</small>
            </button>
          </div>
          <label>
            <span>BOT SAYISI</span>
            <strong>
              {botCount} bot · {botCount + 1} kişilik masa
            </strong>
            <input
              type="range"
              min="1"
              max="8"
              value={botCount}
              onChange={(event) => setBotCount(Number(event.target.value))}
            />
          </label>
          {stackMode === "equal" ? (
            <label>
              <span>BUY-IN</span>
              <strong>{money.format(buyIn)} PR</strong>
              <input
                type="range"
                min="2000"
                max={maxBuyIn}
                step="1000"
                value={Math.min(buyIn, maxBuyIn)}
                onChange={(event) => setBuyIn(Number(event.target.value))}
              />
              <span className="buyin-presets">
                <button onClick={() => setBuyIn(Math.min(20_000, balance))}>
                  20K
                </button>
                <button
                  disabled={balance < 100_000}
                  onClick={() => setBuyIn(100_000)}
                >
                  100K
                </button>
                <button onClick={() => setBuyIn(Math.floor(balance))}>
                  MAX · {money.format(balance)}
                </button>
              </span>
            </label>
          ) : (
            <div className="open-stack-card">
              <span>SENİN MASA STACK’İN</span>
              <strong>{money.format(entryStack)} PR</strong>
              <p>
                Bakiyenin tamamıyla oturursun. Her bot kendi cebindeki farklı
                parayla gelir; yükseltme sınırı yalnızca oyuncunun kalan
                stack’idir.
              </p>
            </div>
          )}
          <label>
            <span>KÖR BAHİSLER</span>
            <strong>
              {money.format(smallBlind)} / {money.format(smallBlind * 2)}
            </strong>
            <select
              value={smallBlind}
              onChange={(event) => selectBlind(Number(event.target.value))}
            >
              <option value="25">25 / 50</option>
              <option value="50">50 / 100</option>
              <option value="100">100 / 200</option>
              <option value="250">250 / 500</option>
              <option value="500">500 / 1.000</option>
              <option value="1000">1.000 / 2.000</option>
              <option value="2500">2.500 / 5.000</option>
              <option value="5000">5.000 / 10.000</option>
            </select>
            <small className={`buyin-requirement ${canJoin ? "ok" : "error"}`}>
              Bu blind için minimum stack: {money.format(minimumBuyIn)} PR
              {!canJoin ? " · bakiye/buy-in yetersiz" : " · masa hazır"}
            </small>
          </label>
          <div className="online-ready-note">
            <i>●</i>
            <div>
              <strong>YEREL OTORİTER MOTOR</strong>
              <small>
                Event log + transport adapter hazır. Online sunucuya UI
                değiştirmeden taşınabilir.
              </small>
            </div>
          </div>
          <button
            className="poker-primary"
            disabled={!canJoin}
            onClick={() => void joinTable()}
          >
            {stackMode === "open" ? "AÇIK KASAYLA OTUR" : "MASAYA OTUR"}{" "}
            <span>{money.format(entryStack)} PR</span>
          </button>
        </aside>
      </section>
    );

  const seats = snapshot?.seating.seats.filter((seat) => seat?.occupant) ?? [];
  const available =
    decision?.availableActions.filter((option) => !option.disabled) ?? [];
  const raiseOption = available.find(
    (option) => option.type === "raise" || option.type === "bet",
  );
  const winners = snapshot?.hand.payouts?.entries ?? [];
  const potAmount =
    (decision?.potSize ?? 0) ||
    (snapshot?.pots.main.amount ?? 0) +
      (snapshot?.pots.sides.reduce((sum, pot) => sum + pot.amount, 0) ?? 0);
  const payoutAmount = winners.reduce((sum, entry) => sum + entry.amount, 0);
  const heroStartStack = handStartStacksRef.current.muharrem ?? buyIn;
  const heroPayout = winners
    .filter((entry) => entry.playerId === "muharrem")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const heroNet = heroStack - heroStartStack;
  const heroCommitted = Math.max(0, heroStartStack - heroStack + heroPayout);
  const heroWinner = winners.some((entry) => entry.playerId === "muharrem");
  const visualPotAmount = isSettled ? payoutAmount : potAmount;
  const primaryWinnerSeat = winners.length
    ? seats.find((seat) => seat?.occupant?.playerId === winners[0].playerId)
        ?.index
    : undefined;
  const flightPoint = chipFlight
    ? seatPoint(chipFlight.seatIndex, seats.length)
    : undefined;
  const payoutPoint =
    primaryWinnerSeat !== undefined
      ? seatPoint(primaryWinnerSeat, seats.length)
      : undefined;
  const showdownByPlayer = new Map(
    snapshot?.hand.showdown?.evaluatedHands.map((hand) => [
      hand.playerId,
      hand,
    ]) ?? [],
  );
  const heroShowdown = showdownByPlayer.get("muharrem");
  const winningBoardCards = new Set(
    winners.flatMap(
      (winner) => showdownByPlayer.get(winner.playerId)?.bestFive ?? [],
    ),
  );

  return (
    <section className="poker-game holdem-live-game">
      <div className={`poker-table holdem-table seat-count-${seats.length}`}>
        <div className="poker-felt-texture" />
        <div className="poker-deck-shoe holdem-deck-shoe">
          <i />
          <i />
          <strong>MP</strong>
          <small>DESTE</small>
        </div>
        <div className="holdem-board">
          <div className="holdem-pot">
            <small>{isSettled ? "DAĞITILAN POT" : "TOPLAM POT"}</small>
            <strong>{money.format(visualPotAmount)} PR</strong>
            <div className="holdem-pot-chips">
              {chipBreakdown(visualPotAmount, 10).map((chip, index) => (
                <PokerTableChip
                  key={`${chip}-${index}`}
                  value={chip}
                  index={index}
                />
              ))}
            </div>
            {(snapshot?.pots.sides.length ?? 0) > 0 && (
              <span>{snapshot?.pots.sides.length} YAN POT</span>
            )}
          </div>
          <div className="poker-cards-row community-row">
            {[0, 1, 2, 3, 4].map((index) => (
              <PokerPlayingCard
                key={`${index}-${board[index] ?? "empty"}`}
                card={board[index]}
                placeholder={
                  index < 3 ? "FLOP" : index === 3 ? "TURN" : "RIVER"
                }
                order={index}
                compact
                highlighted={
                  isSettled &&
                  Boolean(board[index]) &&
                  winningBoardCards.has(board[index])
                }
                dimmed={
                  isSettled &&
                  Boolean(board[index]) &&
                  winners.length > 0 &&
                  !winningBoardCards.has(board[index])
                }
              />
            ))}
          </div>
          <div className="street-name">
            {(snapshot?.hand.stage ?? "deal").toUpperCase()}
          </div>
        </div>

        {chipFlight && flightPoint && (
          <div
            key={chipFlight.id}
            className="poker-chip-flight"
            style={
              {
                "--from-x": `${flightPoint[0]}%`,
                "--from-y": `${flightPoint[1]}%`,
              } as CSSProperties
            }
          >
            <PokerTableChip value={chipBreakdown(chipFlight.amount, 1)[0]} />
            <strong>{money.format(chipFlight.amount)} PR</strong>
          </div>
        )}
        {isSettled && payoutPoint && payoutAmount > 0 && (
          <div
            className="poker-payout-flight"
            style={
              {
                "--to-x": `${payoutPoint[0]}%`,
                "--to-y": `${payoutPoint[1]}%`,
              } as CSSProperties
            }
          >
            {chipBreakdown(payoutAmount, 5).map((chip, index) => (
              <PokerTableChip
                key={`${chip}-${index}`}
                value={chip}
                index={index}
              />
            ))}
            <strong>{money.format(payoutAmount)} PR</strong>
          </div>
        )}

        {seats.map((seat) => {
          const playerId = seat!.occupant!.playerId;
          const isHero = playerId === "muharrem";
          const bot = POKER_BOTS.find((candidate) => candidate.id === playerId);
          const cards = snapshot?.cards.holeCards[playerId] as
            PokerCard[] | null | undefined;
          const reveal = isHero || (isSettled && showdownPlayers.has(playerId));
          const won = winners.some((winner) => winner.playerId === playerId);
          const contribution =
            (snapshot?.pots.main.contributions[playerId] ?? 0) +
            (snapshot?.pots.sides.reduce(
              (sum, pot) => sum + (pot.contributions[playerId] ?? 0),
              0,
            ) ?? 0);
          const [seatX, seatY] = seatPoint(seat!.index, seats.length);
          const seatBestFive = new Set(
            showdownByPlayer.get(playerId)?.bestFive ?? [],
          );
          return (
            <article
              key={playerId}
              className={`holdem-seat seat-${seat!.index} ${decision?.actor === playerId ? "active" : ""} ${folded.has(playerId) ? "folded" : ""} ${won ? "winner" : ""}`}
              style={
                {
                  "--bot-color": bot?.color ?? "#d1ad64",
                  "--seat-x": `${seatX}%`,
                  "--seat-y": `${seatY}%`,
                } as CSSProperties
              }
            >
              <div className="seat-avatar">{isHero ? "MP" : bot?.monogram}</div>
              <div className="seat-info">
                <strong>{seat!.occupant!.displayName}</strong>
                <span>{money.format(seat!.stack)} PR</span>
                <small>
                  {isHero ? "SEN" : bot?.style.replaceAll("-", " ")}
                </small>
              </div>
              <div className="seat-hole-cards">
                <PokerPlayingCard
                  key={`${snapshot?.hand.id}-${playerId}-0-${cards?.[0] ?? "back"}`}
                  card={cards?.[0]}
                  hidden={!reveal}
                  compact
                  order={seat!.index * 2}
                  highlighted={
                    won && Boolean(cards?.[0]) && seatBestFive.has(cards![0])
                  }
                  dimmed={
                    isSettled &&
                    reveal &&
                    won &&
                    Boolean(cards?.[0]) &&
                    !seatBestFive.has(cards![0])
                  }
                />
                <PokerPlayingCard
                  key={`${snapshot?.hand.id}-${playerId}-1-${cards?.[1] ?? "back"}`}
                  card={cards?.[1]}
                  hidden={!reveal}
                  compact
                  order={seat!.index * 2 + 1}
                  highlighted={
                    won && Boolean(cards?.[1]) && seatBestFive.has(cards![1])
                  }
                  dimmed={
                    isSettled &&
                    reveal &&
                    won &&
                    Boolean(cards?.[1]) &&
                    !seatBestFive.has(cards![1])
                  }
                />
              </div>
              {snapshot?.hand.buttonSeat === seat!.index && (
                <b className="dealer-button">D</b>
              )}
              {decision?.actor === playerId && processing && (
                <span className="thinking-dots">
                  <i />
                  <i />
                  <i />
                </span>
              )}
              {folded.has(playerId) && <em className="seat-status">FOLD</em>}
              {seat!.stack === 0 && !folded.has(playerId) && (
                <em className="seat-status allin">ALL-IN</em>
              )}
              {contribution > 0 && (
                <div className="seat-contribution">
                  <span>
                    {chipBreakdown(contribution, 3).map((chip, index) => (
                      <PokerTableChip
                        key={`${chip}-${index}`}
                        value={chip}
                        index={index}
                      />
                    ))}
                  </span>
                  <b>{money.format(contribution)} PR</b>
                </div>
              )}
            </article>
          );
        })}

        {isHeroTurn && !isSettled && (
          <div className="holdem-action-console">
            <div className="holdem-decision-context">
              <span>
                KARAR SENDE ·{" "}
                {(snapshot?.hand.stage ?? "preflop").toUpperCase()}
              </span>
              <strong>
                {available.some((option) => option.type === "call")
                  ? `${money.format(available.find((option) => option.type === "call")!.amount)} PR eşle veya elini bırak`
                  : "Bahis yok · ücretsiz geçebilir ya da potu açabilirsin"}
              </strong>
              <small>Bir kararın ne yaptığını görmek için üzerine gel.</small>
            </div>
            {raiseOption &&
              (raiseOption.type === "raise" || raiseOption.type === "bet") && (
                <div className="raise-control">
                  <span>
                    {raiseOption.type === "raise" ? "RAISE TO" : "BET"}
                  </span>
                  <input
                    type="range"
                    min={raiseOption.min}
                    max={raiseOption.max}
                    step={raiseOption.increment || 1}
                    value={Math.min(raiseAmount, raiseOption.max)}
                    onChange={(event) =>
                      setRaiseAmount(Number(event.target.value))
                    }
                  />
                  <strong>{money.format(raiseAmount)}</strong>
                </div>
              )}
            <div className="holdem-actions">
              {available.map((option) => (
                <button
                  key={option.type}
                  data-explain={actionExplain(option, raiseAmount)}
                  className={`poker-action ${option.type === "fold" ? "danger" : option.type === "all-in" ? "allin" : option.type === "raise" || option.type === "bet" ? "gold" : ""}`}
                  disabled={processing}
                  onClick={() => void chooseAction(option)}
                >
                  <span>
                    {option.type === "raise" || option.type === "bet"
                      ? `${actionLabel(option)} · ${money.format(raiseAmount)}`
                      : actionLabel(option)}
                  </span>
                  <small>
                    {option.type === "fold"
                      ? "Eli bırak"
                      : option.type === "check"
                        ? "Çip koymadan geç"
                        : option.type === "call"
                          ? "Bahsi eşle"
                          : option.type === "all-in"
                            ? "Tüm stack'i sür"
                            : "Bahsi yükselt"}
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}

        {isSettled && (
          <div className="holdem-settled-panel">
            <small>EL TAMAMLANDI</small>
            <h3>{heroWinner ? "POT SENİN" : "BU EL RAKİBİN"}</h3>
            <p>
              {winners
                .map((entry) => {
                  const hand = showdownByPlayer.get(entry.playerId);
                  const name =
                    entry.playerId === "muharrem"
                      ? "Muharrem"
                      : POKER_BOTS.find((bot) => bot.id === entry.playerId)
                          ?.name;
                  return `${name}: ${hand ? pokerHandLabel(hand.rankClass) : "diğer oyuncular çekildi"} · ${money.format(entry.amount)} PR`;
                })
                .join(" · ") || "Pot kazanan oyuncuya iade edildi."}
            </p>
            <div className="holdem-result-ledger">
              <span>
                <small>SENİN ELİN</small>
                <strong>
                  {heroShowdown
                    ? pokerHandLabel(heroShowdown.rankClass)
                    : folded.has("muharrem")
                      ? "Fold · kartlarını bıraktın"
                      : heroWinner
                        ? "Rakipler çekildi"
                        : "Showdown oluşmadı"}
                </strong>
              </span>
              <span>
                <small>BU ELE YATIRDIN</small>
                <strong>{money.format(heroCommitted)} PR</strong>
              </span>
              <span>
                <small>GERİ DÖNEN</small>
                <strong>{money.format(heroPayout)} PR</strong>
              </span>
              <span className={heroNet >= 0 ? "positive" : "negative"}>
                <small>NET SONUÇ</small>
                <strong>
                  {heroNet > 0 ? "+" : heroNet < 0 ? "−" : ""}
                  {money.format(Math.abs(heroNet))} PR
                </strong>
              </span>
            </div>
            <div>
              <button
                className="poker-primary"
                disabled={heroStack <= 0}
                onClick={() => void nextHand()}
              >
                YENİ EL →
              </button>
              <button className="poker-secondary" onClick={cashOut}>
                KASAYI AL · {money.format(heroStack)}
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="poker-side-panel holdem-rail">
        <header>
          <span>MASA #{summary?.session.id.slice(0, 6).toUpperCase()}</span>
          <strong>{seats.length} KİŞİLİK CASH</strong>
        </header>
        <div className="holdem-session-strip">
          <span>
            <small>EL</small>
            <strong>#{handNumber}</strong>
          </span>
          <span>
            <small>BLIND</small>
            <strong>
              {smallBlind}/{smallBlind * 2}
            </strong>
          </span>
          <span>
            <small>MOTOR</small>
            <strong>LOCAL AI</strong>
          </span>
        </div>
        <div className="bot-tell-card">
          <span>MASA OKUMASI</span>
          <strong>
            {decision?.actor === "muharrem"
              ? "Karar sende."
              : decision?.actor
                ? `${POKER_BOTS.find((bot) => bot.id === decision.actor)?.name ?? decision.actor} düşünüyor…`
                : "El kapandı."}
          </strong>
          <p>
            {decision?.actor && decision.actor !== "muharrem"
              ? POKER_BOTS.find((bot) => bot.id === decision.actor)?.tell
              : "Pot, pozisyon ve bahis boyu aynı event günlüğünden okunuyor."}
          </p>
          {decision?.actor && decision.actor !== "muharrem" && !isSettled && (
            <span
              key={`${snapshot?.index}-${decision.actor}`}
              className="bot-thinking-meter"
            >
              <i />
            </span>
          )}
        </div>
        <div className="poker-action-feed">
          <h4>EL AKIŞI</h4>
          {actionFeed.map((line, index) => (
            <p key={`${line}-${index}`}>
              <i>{index === 0 ? "●" : "·"}</i>
              {line}
            </p>
          ))}
        </div>
        <button className="poker-secondary cashout-button" onClick={cashOut}>
          MASADAN KALK <span>{money.format(heroStack)} PR</span>
        </button>
      </aside>
    </section>
  );
}

export default function PokerRoom({
  balance,
  setBalance,
  onExit,
  aiOnline = false,
}: Props) {
  const [mode, setMode] = useState<PokerMode>("casino");
  const cashoutRef = useRef<() => void>(() => undefined);

  const exit = () => {
    cashoutRef.current();
    onExit();
  };

  const switchMode = (next: PokerMode) => {
    if (next === mode) return;
    cashoutRef.current();
    cashoutRef.current = () => undefined;
    setMode(next);
  };

  return (
    <main className="poker-room">
      <header className="poker-topbar">
        <button className="poker-back" onClick={exit}>
          ← <span>Salonlar</span>
        </button>
        <div className="poker-brand">
          <span>MP</span>
          <div>
            <strong>MIDNIGHT POKER</strong>
            <small>PEHLEVAN ROYALE</small>
          </div>
        </div>
        <nav className="poker-mode-tabs" aria-label="Poker modu">
          <button
            className={mode === "casino" ? "active" : ""}
            onClick={() => switchMode("casino")}
          >
            <small>01</small> LEYLA’YA KARŞI
          </button>
          <button
            className={mode === "holdem" ? "active" : ""}
            onClick={() => switchMode("holdem")}
          >
            <small>02</small> TEXAS HOLD’EM
          </button>
        </nav>
        <div className="poker-top-actions">
          <GameMusicControls game="poker" />
          <span className="poker-balance">
            ✦ {money.format(balance)} <small>PR</small>
          </span>
        </div>
      </header>
      {mode === "casino" ? (
        <CasinoHoldemTable
          balance={balance}
          setBalance={setBalance}
          aiOnline={aiOnline}
        />
      ) : (
        <TexasHoldemTable
          balance={balance}
          setBalance={setBalance}
          registerCashout={(handler) => {
            cashoutRef.current = handler;
          }}
        />
      )}
    </main>
  );
}
