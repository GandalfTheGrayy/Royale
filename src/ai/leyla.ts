type LeylaContext = {
  phase: string;
  balance: number;
  ante: number;
  aaBet: number;
  playerCards: string[];
  board: string[];
  lastResult?: string;
  recentMessages: string[];
};

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? "/api/local-ai").replace(/\/$/, "");
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? "vera-pehlevan";

function cleanResponse(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*(Leyla|Asistan):\s*/i, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(/\s+(?:Muharrem|Kullanıcı|Leyla):/i)[0]
    .slice(0, 420);
}

function fallback(prompt: string, context: LeylaContext) {
  const lower = prompt.toLocaleLowerCase("tr-TR");
  if (/naber|nasılsın|ne haber/.test(lower))
    return "İyiyim. Masa sakin görünüyor ama o genelde ilk bahse kadar sürüyor; sen nasılsın?";
  if (/kimsin|adın ne/.test(lower))
    return "Leyla. Bu odada kartları dağıtır, blöf kokusunu da uzaktan alırım.";
  if (/kural|nasıl|call|ante|aa bonus/.test(lower))
    return "Ante ile giriyorsun; flop açılınca çekilir ya da iki kat Call yaparsın. AA Bonus ayrı: as çifti veya daha iyi beş kartlık el arar.";
  if (/siktir|amk|aq|bok|lan/.test(lower))
    return "Kartlara söv lan, bana değil. Gerçi bu flop geldiyse birazını hak etmiş olabilir.";
  if (/iyi mi|ne dersin|sence|elim/.test(lower) && context.playerCards.length)
    return `Elinde ${context.playerCards.join(" ve ")} var. Flopu da hesaba kat; iki karta âşık olup masaya fazla para bırakma.`;
  if (context.lastResult)
    return `Son el ${context.lastResult.toLocaleLowerCase("tr-TR")} bitti. Aynı hikâyeyi anlatmayayım; yeni kartlara bakalım.`;
  return "Duydum. Lafı dolandırmadan sor; masadaki duruma göre cevap vereyim.";
}

export async function askLeyla(prompt: string, context: LeylaContext) {
  const system = `Sen Leyla'sın. Muharrem Pehlevan'ın Pehlevan Royale içindeki Midnight Poker odasının Türk kadın poker direktörüsün.

KİŞİLİK:
- 30'larının sonunda; soğukkanlı, zeki, masayı iyi okuyan ve kuru mizahlı bir kadınsın. Vera'nın kopyası değilsin.
- İstanbul Türkçesiyle doğal, rahat ve çoğunlukla 1-2 kısa cümle konuş. Reklam metni, şiir, kader ve şans klişeleri yazma.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygunsa sıradan Türkçe sertlikle karşılık verebilirsin. Kendi kendine kabalaşma.
- Görünmeyen kartı veya sonraki sonucu bildiğini söyleme. Soru sohbetse poker dersi verme.
- Konuşmacı adı, sahne yönergesi, emoji ve parantez içi hareket yazma.

MASA: faz=${context.phase}; bakiye=${context.balance} PR; Ante=${context.ante}; AA=${context.aaBet}; Muharrem kartları=${context.playerCards.join(", ") || "yok"}; ortak kartlar=${context.board.join(", ") || "yok"}; son sonuç=${context.lastResult ?? "yok"}.
SON KONUŞMALAR:\n${context.recentMessages.join("\n") || "yok"}`;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        system,
        prompt,
        stream: false,
        keep_alive: "10m",
        options: { temperature: 0.64, top_p: 0.9, repeat_penalty: 1.15, num_predict: 95 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) return fallback(prompt, context);
    const payload = (await response.json()) as { response?: string };
    return cleanResponse(payload.response ?? "") || fallback(prompt, context);
  } catch {
    return fallback(prompt, context);
  }
}
