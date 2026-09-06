export type LaleContext = {
  phase: string
  balance: number
  multiplier: number
  crashPoint?: number
  lastNet?: number | null
  activeBets: Array<{ amount: number; autoCashout?: number }>
  recentCrashes: number[]
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function clean(text: string) {
  const normalized = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(Lâle|Lale|Asistan):\s*/i, '')
    .replace(/^\s*\([^)]{1,180}\)\s*/i, '')
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/\s+(?:Muharrem|Kullanıcı|Lâle|Lale):/i)[0]
  if (normalized.length <= 360) return normalized
  const sentenceEnd = Math.max(normalized.lastIndexOf('.', 360), normalized.lastIndexOf('?', 360), normalized.lastIndexOf('!', 360))
  if (sentenceEnd >= 120) return normalized.slice(0, sentenceEnd + 1)
  return `${normalized.slice(0, 340).replace(/\s+\S*$/, '').replace(/[,;:]$/, '')}.`
}

function fallback(prompt: string, context: LaleContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'Kule sakin, motorlar gürültülü. Ben iyiyim; senin elin çıkış düğmesine ne kadar yakın, onu merak ediyorum.'
  if (/kimsin|adın ne/.test(lower)) return 'Lâle. Altın Rota’nın kule operatörüyüm. Uçağı ben düşürmem, sonucu da değiştirmem; ama hangi irtifada kaldığını gözümden kaçırmam.'
  if (/hile|adil|seed|doğrula/.test(lower)) return 'Turun sunucu seed’i önceden SHA-256 ile kilitli. Uçuş bitince seed açılır; client seed ve nonce ile aynı çarpanı yeniden hesaplayabilirsin.'
  if (/nasıl|kural|çıkış|cash/.test(lower)) return 'Bahis uçuşta çarpanla büyür. Rota kesilmeden alırsan bahis çarpı o anki değer ödenir; geç kalırsan o panel gider. İki paneli ayrı ayrı yönetebilirsin.'
  if (/hep|yine|sürekli/.test(lower)) return `Son rotalar ${context.recentCrashes.slice(0, 5).map((x) => `${x.toFixed(2)}×`).join(', ')}. Birbirlerine benzeseler bile her turun seed’i ve nonce’ı ayrı.`
  if (/siktir|amk|aq|bok|lan/.test(lower)) return 'Sinir bozucu rota olduysa oldu lan; kulede süsleyip güzelmiş gibi anlatmayacağım. Ama bir sonraki çarpanı da biliyormuşum gibi sallamam.'
  if (context.lastNet !== null && context.lastNet !== undefined) return `Son tur netin ${context.lastNet >= 0 ? '+' : ''}${context.lastNet.toLocaleString('tr-TR')} PR. Rakam burada; bahanesi yok.`
  return 'Duydum Muharrem. Rota mı, bahis paneli mi, yoksa şu son çarpanlar mı kafana takıldı?'
}

export async function askLale(prompt: string, context: LaleContext) {
  if (/hile|adil|seed|doğrula|sha-?256|nasıl oynan|kural|ödeme|cash|çıkış/i.test(prompt.toLocaleLowerCase('tr-TR'))) {
    return fallback(prompt, context)
  }
  const system = `Sen Lâle'sin. Muharrem Pehlevan'ın Pehlevan Royale içindeki Altın Rota crash oyununu İstanbul'daki gece uçuş kulesinden sunuyorsun.

KİŞİLİK:
- 30'larında, zeki, soğukkanlı, hızlı gözlem yapan ve kuru mizahı olan bir Türk kadınsın. Vera'nın ya da başka karakterin kopyası değilsin.
- Doğal İstanbul Türkçesi kullan. 1-2 kısa cümle kur. Havacılık metaforunu arada kullan ama her cümleyi şiire çevirme.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygun gündelik sertlikle cevap verebilirsin. Kendiliğinden hakaret etme.
- Bir sonraki çarpanı bildiğini iddia etme, kesin kazanç tavsiyesi verme ve görünmeyen sonucu uydurma.
- Brüt ödeme ile net kârı karıştırma. Sahne yönergesi, konuşmacı adı, emoji veya parantez içi hareket yazma.
- SHA-256 doğrulamasını sorarsa kısa ve doğru anlat.

ANLIK DURUM: faz=${context.phase}; bakiye=${context.balance} PR; çarpan=${context.multiplier.toFixed(2)}x; son çöküş=${context.crashPoint ?? 'yok'}; son net=${context.lastNet ?? 'yok'}; aktif bahisler=${context.activeBets.map((bet) => `${bet.amount}PR@${bet.autoCashout ?? 'manuel'}`).join(', ') || 'yok'}; yakın sonuçlar=${context.recentCrashes.slice(0, 8).join(', ')}.
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .7, top_p: .9, repeat_penalty: 1.16, num_predict: 92 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return clean(payload.response ?? '') || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
