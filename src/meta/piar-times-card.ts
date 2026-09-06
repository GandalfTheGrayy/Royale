import type { CompetitionDashboard, LeaderboardEntry } from "./meta-api";

const pr = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function entryScore(entry?: LeaderboardEntry) {
  if (!entry) return "KAYIT YOK";
  if (entry.valueType === "PR") return `${pr.format(entry.score)} PR`;
  if (entry.valueType === "POINT") return `${pr.format(entry.score)} SP`;
  if (entry.valueType === "FAME") return `${pr.format(entry.score)} ŞÖHRET`;
  if (entry.valueType === "RATIO") return `${pr.format(entry.score)}×`;
  return `${pr.format(entry.score)} sn`;
}

function rounded(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fit(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  initialSize: number,
  family = "Georgia",
) {
  let size = initialSize;
  do {
    context.font = `900 ${size}px ${family}`;
    size -= 2;
  } while (size > 22 && context.measureText(value).width > maxWidth);
}

function cardBlob(dashboard: CompetitionDashboard) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Paylaşım kartı çizilemedi.");

  const background = context.createLinearGradient(0, 0, 1200, 1500);
  background.addColorStop(0, "#21130f");
  background.addColorStop(0.48, "#100b0a");
  background.addColorStop(1, "#071411");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 1500);

  context.globalAlpha = 0.12;
  context.strokeStyle = "#e6bd70";
  context.lineWidth = 2;
  for (let x = -500; x < 1500; x += 90) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 700, 1500);
    context.stroke();
  }
  context.globalAlpha = 1;

  context.strokeStyle = "#c9984e";
  context.lineWidth = 4;
  rounded(context, 52, 52, 1096, 1396, 30);
  context.stroke();
  context.strokeStyle = "rgba(201,152,78,.32)";
  context.lineWidth = 1;
  rounded(context, 70, 70, 1060, 1360, 24);
  context.stroke();

  context.fillStyle = "#d7ad64";
  context.font = "800 24px Arial";
  context.letterSpacing = "8px";
  context.fillText("PEHLEVAN ROYALE SUNAR", 100, 135);
  context.letterSpacing = "0px";
  context.fillStyle = "#fff1cf";
  context.font = "900 92px Georgia";
  context.fillText("THE PR TIMES", 95, 245);
  context.fillStyle = "#927a68";
  context.font = "700 24px Arial";
  context.fillText(
    `HAFTALIK CASINO BÜLTENİ  ·  ${dashboard.newspaper.weekKey}`,
    100,
    292,
  );
  context.fillStyle = "#d7ad64";
  context.fillRect(100, 330, 1000, 3);

  const features = [
    {
      kicker: "KASANIN ZİRVESİ",
      title: dashboard.newspaper.richest?.displayName ?? "Henüz kayıt yok",
      value: entryScore(dashboard.newspaper.richest),
    },
    {
      kicker: "HAFTANIN KAZANANI",
      title: dashboard.newspaper.weeklyWinner?.displayName ?? "Henüz kayıt yok",
      value: entryScore(dashboard.newspaper.weeklyWinner),
    },
  ];
  features.forEach((feature, index) => {
    const x = 100 + index * 510;
    const panel = context.createLinearGradient(x, 380, x + 480, 690);
    panel.addColorStop(0, "rgba(91,48,30,.72)");
    panel.addColorStop(1, "rgba(17,15,13,.85)");
    context.fillStyle = panel;
    rounded(context, x, 380, 480, 310, 22);
    context.fill();
    context.strokeStyle = "rgba(215,173,100,.38)";
    context.stroke();
    context.fillStyle = "#d7ad64";
    context.font = "800 19px Arial";
    context.fillText(feature.kicker, x + 34, 430);
    context.fillStyle = "#fff1cf";
    fit(context, feature.title, 410, 53);
    context.fillText(feature.title, x + 34, 515);
    context.fillStyle = "#88ddb7";
    context.font = "900 39px Arial";
    context.fillText(feature.value, x + 34, 625);
  });

  const record = dashboard.newspaper.biggestRecord;
  const hotGame = dashboard.newspaper.hotGame;
  const gameLabel = hotGame
    ? (dashboard.config.games[hotGame.gameId]?.label ?? hotGame.gameId)
    : "Henüz kayıt yok";
  const stories = [
    {
      number: "01",
      kicker: "HAFTANIN REKORU",
      title: record?.metric_label ?? "Rekor bekleniyor",
      copy: record
        ? `${record.displayName} · ${pr.format(record.value)}`
        : "İlk büyük hikâyeyi bu hafta sen yazabilirsin.",
    },
    {
      number: "02",
      kicker: "MASALARIN GÖZDESİ",
      title: gameLabel,
      copy: hotGame
        ? `${pr.format(hotGame.count)} doğrulanmış turla haftanın en sıcak oyunu.`
        : "Haftanın oyunu henüz belli olmadı.",
    },
    {
      number: "03",
      kicker: "EN BÜYÜK VURUŞ",
      title: dashboard.newspaper.biggestHit?.displayName ?? "Vuruş bekleniyor",
      copy: dashboard.newspaper.biggestHit
        ? `${dashboard.config.games[dashboard.newspaper.biggestHit.gameId]?.label ?? dashboard.newspaper.biggestHit.gameId} · ${pr.format(dashboard.newspaper.biggestHit.payout)} PR · ${pr.format(dashboard.newspaper.biggestHit.multiplier)}×`
        : "Haftanın en büyük ödemesi henüz gelmedi.",
    },
    {
      number: "04",
      kicker: "HAFTANIN GERİ DÖNÜŞÜ",
      title:
        dashboard.newspaper.comeback?.displayName ?? "Geri dönüş bekleniyor",
      copy: dashboard.newspaper.comeback
        ? `${pr.format(dashboard.newspaper.comeback.trough)} PR dipten ${pr.format(dashboard.newspaper.comeback.anchor)} PR zirveye döndü.`
        : "Bu hafta henüz mühürlenmiş bir geri dönüş yok.",
    },
    {
      number: "05",
      kicker: "EN YAKIN HESAPLAŞMA",
      title: dashboard.newspaper.closestRace
        ? `${dashboard.newspaper.closestRace.displayName} / ${dashboard.newspaper.closestRace.rivalName}`
        : "Rakipler bekleniyor",
      copy: dashboard.newspaper.closestRace
        ? `Aralarındaki haftalık fark yalnız ${pr.format(dashboard.newspaper.closestRace.gap)} PR.`
        : "Yeni haftalık rakip eşleşmesi henüz oluşmadı.",
    },
  ];
  stories.forEach((story, index) => {
    const y = 720 + index * 124;
    context.fillStyle = "rgba(255,255,255,.035)";
    rounded(context, 100, y, 1000, 108, 16);
    context.fill();
    context.fillStyle = "#59463a";
    context.font = "900 54px Georgia";
    context.fillText(story.number, 125, y + 73);
    context.fillStyle = "#c9984e";
    context.font = "800 14px Arial";
    context.fillText(story.kicker, 225, y + 30);
    context.fillStyle = "#fff1cf";
    fit(context, story.title, 820, 28, "Arial");
    context.fillText(story.title, 225, y + 61);
    context.fillStyle = "#b6a79e";
    context.font = "500 16px Arial";
    context.fillText(story.copy, 225, y + 88);
  });

  context.fillStyle = "#d7ad64";
  context.fillRect(100, 1340, 1000, 2);
  context.fillStyle = "#fff1cf";
  context.font = "900 27px Georgia";
  context.fillText(dashboard.profile.user.displayName, 100, 1395);
  context.fillStyle = "#87766d";
  context.font = "700 16px Arial";
  context.textAlign = "right";
  context.fillText("PEHLEVAN ROYALE · HAFTALIK ARŞİV", 1100, 1392);
  context.textAlign = "left";

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Paylaşım kartı üretilemedi.")),
      "image/png",
      1,
    ),
  );
}

export async function sharePiarTimesCard(dashboard: CompetitionDashboard) {
  const blob = await cardBlob(dashboard);
  const filename = `pr-times-${dashboard.newspaper.weekKey}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "The PR Times",
        text: `${dashboard.newspaper.weekKey} haftalık Pehlevan Royale bülteni`,
      });
      return "Paylaşım ekranı açıldı.";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "Paylaşım iptal edildi.";
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "Haftalık kart PNG olarak indirildi.";
}
