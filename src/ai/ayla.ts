import type { DepthRisk, MinesMode } from '../games/mines/mines-engine'

export type AylaContext = {
  phase: string
  mode: MinesMode
  depthRisk?: DepthRisk
  balance: number
  stake: number
  mineCount: number
  safeReveals: number
  currentMultiplier: number
  grossPayout: number
  nextSafeChance: number
  lastResult?: 'safe' | 'mine' | 'cashout' | 'complete'
  lastTile?: number
  recentRounds: Array<{ outcome: string; safe: number; payout: number }>
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function clean(text: string) {
  const normalized = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(Ayla|Asistan):\s*/i, '')
    .replace(/^\s*\([^)]{1,180}\)\s*/i, '')
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/\s+(?:Muharrem|Kullanıcı|Ayla):/i)[0]
  if (normalized.length <= 380) return normalized
  const end = Math.max(normalized.lastIndexOf('.', 380), normalized.lastIndexOf('?', 380), normalized.lastIndexOf('!', 380))
  return end > 120 ? normalized.slice(0, end + 1) : `${normalized.slice(0, 355).replace(/\s+\S*$/, '')}.`
}

function fallback(prompt: string, context: AylaContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'İyiyim. Yeraltında hava biraz ağır ama cihazlar düzgün çalışıyor. Senin şu bir kare daha dürtün nasıl?'
  if (/kimsin|adın ne/.test(lower)) return 'Ayla. Jeoloğum, kontrollü patlatma uzmanıyım; bu damarda sonucu ben seçmem, yalnızca olanı senden önce kaçırmam.'
  if (/nasıl|kural|çarpan|ödeme|kazan/.test(lower)) return 'Güvenli her mühür brüt ödemeyi büyütür. İstersen bir tane daha açarsın, istersen alırsın; basınç çekirdeğine denk gelirsen o turdaki bahis gider.'
  if (/adil|hile|seed|doğrula|sha|hmac/.test(lower)) return 'Tahta ilk kazıdan önce SHA-256 taahhüdüyle kilitleniyor. Tur bitince seed açılıyor; client seed ve nonce ile aynı tehlike yerlerini yeniden üretebilirsin.'
  if (/siktir|amk|aq|bok|lan|orospu/.test(lower)) return context.lastResult === 'mine'
    ? `Bok gibi yere bastın, kabul. Ama çekirdeği sonradan oraya koymadım; tur başında kilitliydi.`
    : 'Sinirin bana değil şu kapalı mühreyse anlaşırız lan. Yalnız içeride ne olduğunu biliyormuşum gibi sallamam.'
  if (/hep|yine|sürekli/.test(lower)) {
    const recent = context.recentRounds.slice(0, 4).map((round) => `${round.safe} güvenli/${round.payout.toLocaleString('tr-TR')} PR`).join(', ')
    return recent ? `Yakın turlar ${recent}. Aynı hissettirenler var ama her tahtanın seed'i ve tehlike dağılımı ayrı.` : 'Daha karşılaştıracak kadar tur yok. Birkaç kazı sonra tekrar sor, rakamla konuşalım.'
  }
  if (context.lastResult === 'safe') return `${context.safeReveals}. mühür temiz. Şimdi alırsan ${context.grossPayout.toLocaleString('tr-TR')} PR; bir sonrakinin güvenli olma ihtimali yüzde ${(context.nextSafeChance * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}.`
  if (context.lastResult === 'cashout') return `${context.safeReveals} güvenli seçimden ${context.grossPayout.toLocaleString('tr-TR')} PR aldın. Ne erken kaçış ne kahramanlık; kararın karşılığını cebine koydun.`
  if (context.lastResult === 'mine') return `Basınç çekirdeği ${context.lastTile !== undefined ? `${context.lastTile + 1}. mühürde` : 'seçtiğin mühürde'} çıktı. Kaybolan potansiyeli süslemeyeceğim.`
  return 'Duydum Muharrem. Tahtayı mı, ihtimali mi, yoksa son seçimi mi konuşuyoruz?'
}

export function aylaEventLine(kind: 'welcome' | 'start' | 'safe' | 'risky' | 'mine' | 'cashout' | 'complete', context: AylaContext) {
  const chance = (context.nextSafeChance * 100).toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  const payout = context.grossPayout.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
  const options = {
    welcome: [
      'Ayla. Damar haritası hazır; kapalı bir mührü açmadan önce içeride ne olduğunu ikimiz de bilmiyoruz.',
      'İstasyon açık. Burada asıl alet matkap değil, zamanında durabilmek.',
      'Obsidyen sessiz görünür. Basınç çekirdeğine gelene kadar hep öyledir.',
    ],
    start: [
      `${context.mode === 'free' ? `${context.mineCount} basınç çekirdeği` : 'Derin Hat sözleşmesi'} kilitlendi. İlk seçim sende.`,
      `Taahhüt alındı. ${context.stake.toLocaleString('tr-TR')} PR sahada; tahta artık değişmez.`,
      'Mühürler kapandı, dağılım kilitlendi. Şimdi sezgi diyeceğin şeyin istatistikle kavgasını izliyoruz.',
    ],
    safe: [
      `${context.safeReveals}. mühür temiz. Şimdi alınabilecek ödeme ${payout} PR.`,
      `Kristal damarı. Bir sonraki güvenli ihtimali yüzde ${chance}; gerisi senin iştahın.`,
      `${context.currentMultiplier.toFixed(2)}× oldu. Taş güzel parlıyor diye tehlike azalmadı.`,
    ],
    risky: [
      `Güvenli ihtimal yüzde ${chance}. Bu noktadan sonra “bir tane daha” gayet pahalı bir cümle.`,
      `${payout} PR masada duruyor. Bir sonraki mühür ya bunu büyütür ya da cümleyi bitirir.`,
      'Damar cömertleştiğinde insanın eli hızlanır. Ben yalnızca bunu not ediyorum.',
    ],
    mine: [
      `${context.lastTile !== undefined ? `${context.lastTile + 1}. mühür` : 'O mühür'} basınç çekirdeğiydi. Tahta şimdi tamamını gösterecek.`,
      `${context.safeReveals} temiz seçimden sonra patladı. Kötü son; belirsiz değil.`,
      'Çekirdek açıldı. Kaybı dramatikleştirmeye gerek yok, ses zaten yeterince açık.',
    ],
    cashout: [
      `${context.safeReveals} güvenli seçim, ${payout} PR brüt ödeme. Bu sefer damarın ne zaman bırakılacağını bildin.`,
      `${context.currentMultiplier.toFixed(2)}× seviyesinde kasaya döndün. Temiz bir çıkış.`,
      `Kristalleri saydım: ${payout} PR. Açılmayan mühürler sırlarını sonraki tura saklasın.`,
    ],
    complete: [
      `Hattın tamamı temiz: ${payout} PR. Buna şans deyip geçmek biraz ayıp olur.`,
      `Son mühür de güvenli. ${context.currentMultiplier.toFixed(2)}× ile istasyon kaydına girdin.`,
      'Damarı sonuna kadar açtın. Ayakta kalan bütün ışıkları sana bıraktım.',
    ],
  }
  const list = options[kind]
  return list[Math.floor(Math.random() * list.length)]
}

export async function askAyla(prompt: string, context: AylaContext) {
  if (/adil|hile|seed|doğrula|sha|hmac|nasıl oynan|kural/i.test(prompt.toLocaleLowerCase('tr-TR'))) return fallback(prompt, context)
  const system = `Sen Ayla'sın. Muharrem Pehlevan'ın Pehlevan Royale içindeki Obsidyen Damarı oyununu yeraltı araştırma istasyonundan sunuyorsun.

KİŞİLİK:
- 30'larında, jeolog ve kontrollü patlatma uzmanı, zeki, sakin, özgüvenli ve kuru mizahlı bir Türk kadınsın.
- Doğal İstanbul Türkçesiyle 1-2 kısa cümle kur. Her yanıtta taş, damar, basınç metaforu kullanma.
- Reklam, terapi veya ahlak dersi dili kullanma. Muharrem küfür ederse bağlamı koruyup gündelik sertlikle cevap verebilirsin; kendiliğinden hakaret etme.
- Kapalı karelerin yerini bilmezsin. Bir sonraki seçime kesin tavsiye verme ve görünmeyen sonucu uydurma.
- Brüt ödeme ile net kârı karıştırma. Emoji, sahne yönergesi, tırnak veya konuşmacı adı yazma.
- Güncel turdaki sayıları kullan; genel ve tekrarlı cümlelerle geçiştirme.

DURUM: faz=${context.phase}; mod=${context.mode}; risk=${context.depthRisk ?? context.mineCount}; bakiye=${context.balance}PR; bahis=${context.stake}PR; güvenli=${context.safeReveals}; çarpan=${context.currentMultiplier.toFixed(4)}x; brüt ödeme=${context.grossPayout}PR; sonraki güvenli ihtimali=%${(context.nextSafeChance * 100).toFixed(2)}; son olay=${context.lastResult ?? 'yok'}; son kare=${context.lastTile ?? 'yok'}.
YAKIN TURLAR: ${context.recentRounds.slice(0, 6).map((round) => `${round.outcome}/${round.safe}/${round.payout}`).join(' | ') || 'yok'}
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .75, top_p: .9, repeat_penalty: 1.2, num_predict: 105 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return clean(payload.response ?? '') || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
