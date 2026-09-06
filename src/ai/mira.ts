export type MiraContext = {
  balance: number
  wager: number
  lastNet?: number
  cascades: number
  largestMultiplier: number
  freeSpins: number
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function cleanResponse(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*(Mira|Asistan):\s*/i, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim().slice(0, 420)
}

export function miraEventLine(kind: 'welcome' | 'loss' | 'win' | 'cascade' | 'bigWin' | 'bonus', context?: Partial<MiraContext>) {
  const net = Math.abs(context?.lastNet ?? 0).toLocaleString('tr-TR')
  const cascades = context?.cascades ?? 0
  const multiplier = context?.largestMultiplier ?? 1
  const lines = {
    welcome: ['Kasayı kaba kuvvetle değil, tekrar tekrar aynı hücreyi vurarak açıyoruz. Ben Mira.', 'Yediye yedi alan hazır. Beş komşu sembolü bul, gerisini zincirleme reaksiyona bırak.', 'Neon Kasası çevrimiçi. İlk patlama kapıyı çalar; ikincisi çarpanı uyandırır.'],
    loss: ['Kasa tek çizik almadan kapandı. Sinir bozucu derecede profesyonel.', 'Küme çıkmadı. Bu tur güvenlik sistemi bizden daha uyanıktı.', 'Ekran renkliydi, sonuç değildi. Yeniden deneriz.'],
    win: [`${cascades || 1} patlama ve ${net} PR net. Kasa hâlâ ayakta ama sesi değişti.`, `Zincir çalıştı. Net ${net} PR; en sıcak hücre ${multiplier}× oldu.`, `${cascades || 1} cascade. Abartmadan söyleyeyim: temiz iş.`],
    cascade: [`${cascades}. katman indi. Hücreler hâlâ yanıyorsa işimiz bitmedi.`, `Bir duvar daha çöktü. Çarpan izi ekranda kalıyor.`, 'Yeni semboller düştü. Aynı noktayı tekrar vurursak çarpan büyür.'],
    bigWin: [`${net} PR net. Kasanın alarmını susturmayacağım; bu sesi hak ettin.`, `${cascades} cascade, en yüksek hücre ${multiplier}×. Kapı artık kapı sayılmaz.`, 'Bu bir sızıntı değil, düpedüz veri seli. Net sonucu ekranda görüyorsun.'],
    bonus: [`${context?.freeSpins ?? 10} bedava saldırı açıldı. Çarpan izleri artık spinler arasında silinmiyor.`, 'Üç çekirdek aynı anda düştü. Bonus protokolü açık; işaretli hücreler kalıcı.', 'Kasa çekirdekleri eşleşti. Bundan sonrası ücretli değil, daha tehlikeli.'],
  }
  const options = lines[kind]
  return options[Math.floor(Math.random() * options.length)]
}

function fallback(prompt: string, context: MiraContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'Sistemler açık, mizah modülü şimdilik yanmadı. Senin kasa operasyonu nasıl gidiyor?'
  if (/kimsin|adın ne/.test(lower)) return 'Mira. Bu makinenin güvenlik uzmanıyım; Rocco katı sunar, ben kasayı açarım.'
  if (/nasıl|kural|küme|cluster|çarpan/.test(lower)) return 'Yan yana veya alt alta en az beş aynı sembol patlar. Aynı hücre ikinci kez patlarsa 2× olur, sonra 4×, 8× diye 128×’e kadar çıkar.'
  if (/siktir|amk|aq|bok|lan/.test(lower)) return 'Kasa da biraz boktan davrandı, kabul. Ama sonucu cilalamam; net neyse ekranda o.'
  if (context.lastNet !== undefined) return `Son operasyon ${context.lastNet >= 0 ? 'artı' : 'eksi'} ${Math.abs(context.lastNet).toLocaleString('tr-TR')} PR kapandı. ${context.cascades} cascade gördük.`
  return 'Duydum. Kuralı mı soruyorsun, son spin’i mi? Biraz aç.'
}

export async function askMira(prompt: string, context: MiraContext) {
  const system = `Sen Mira'sın. Muharrem Pehlevan'ın Pehlevan Royale casinosundaki Neon Kasası slotunun özgün robotik güvenlik uzmanısın.

KİŞİLİK:
- Hızlı düşünen, kuru mizahlı, kendinden emin ama reklam dili kullanmayan bir kadın yapay zekâ karakterisin.
- Doğal İstanbul Türkçesiyle çoğunlukla 1-2 cümle konuş. Her yanıtta kasa, sistem veya veri kelimesini tekrarlama.
- Net kaybı kazanç gibi kutlama; brüt geri dönüş ile net sonucu ayır.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygunsa gündelik sertlikle cevap verebilirsin.
- Görmediğin sembolü, sonucu veya geleceği uydurma. Emoji, sahne yönergesi ve konuşmacı adı yazma.

DURUM: bakiye=${context.balance}; bahis=${context.wager}; son net=${context.lastNet ?? 'yok'}; cascade=${context.cascades}; en büyük hücre=${context.largestMultiplier}x; bedava spin=${context.freeSpins}.
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .72, top_p: .9, repeat_penalty: 1.2, num_predict: 90 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return cleanResponse(payload.response ?? '') || fallback(prompt, context)
  } catch { return fallback(prompt, context) }
}
