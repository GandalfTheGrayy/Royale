export type NarinContext = {
  balance: number
  wager: number
  lastPayout?: number
  cascades: number
  freeSpins: number
  highestSpot: number
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function clean(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*(Narin|Asistan):\s*/i, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim().slice(0, 360)
}

export function narinEventLine(kind: 'welcome' | 'spin' | 'loss' | 'win' | 'bigWin' | 'bonusReady' | 'bonusStart' | 'retrigger' | 'bonusEnd', context: Partial<NarinContext> = {}) {
  const payout = Math.round(context.lastPayout ?? 0).toLocaleString('tr-TR')
  const lines = {
    welcome: ['Gece vitrini açıldı. Aynı şeker iki kez aynı yerde kırılırsa sır orada başlar.', 'Ben Narin. Beş komşu şeker bir araya gelir, patlar; aynı hücre tekrar kazanırsa çarpanı büyür.', 'Şekerhane hazır. İlk patlama iz bırakır, ikincisi 2× ateşi yakar.'],
    spin: ['Tepsi döndü; şimdi komşu şekerlerin birbirini bulmasını bekliyoruz.', 'Yeni parti vitrinde. En tatlı yer, ikinci kez kırılan yerdir.', 'Şekerler düştü. Küme varsa fişi açıkça önüne koyacağım.'],
    loss: ['Bu tepsi sessiz kaldı. Hücre haritası değişmedi.', 'Küme kurulmadı; ödeme yok. Yeni parti için vitrin hazır.', 'Şekerler yan yana gelemedi. Bu tur kasaya kaldı.'],
    win: [`Toplam ödeme ${payout} PR. Hangi kümenin ne yaptığını fişte görebilirsin.`, `${payout} PR ödeme. İz bırakan hücreler bir sonraki düşüşü bekliyor.`, `Tepsi ${payout} PR verdi; zincir ve çarpan hesabı açık.`],
    bigWin: [`Vitrin aydınlandı: ${payout} PR ödeme. Bu, acele geçilecek bir tepsi değil.`, `${payout} PR. Şekerhanede kepçeyi değil, kasayı dolduran parti bu.`, `Büyük parti: ${payout} PR ödeme. Hücre ateşi işini yaptı.`],
    bonusReady: [`Gece tarifi hazır: ${context.freeSpins ?? 10} ücretsiz tepsi. Sen başlatmadan pişirmiyorum.`, 'Üç Narin mührü bonusu açtı. Tarif hazır; başlatma sende.', 'Bonus kapısı açık. Hücre izleri bütün oturum boyunca korunacak.'],
    bonusStart: ['Tarif başladı. Her tepside hücre izleri korunuyor; ikinci kırılıştan sonra çarpan yükseliyor.', 'Gece vardiyası başladı. Aynı yer yeniden kırılırsa ateş büyür.', 'Ücretsiz tepsiler geliyor. Hücre haritasını gözden kaçırma.'],
    retrigger: [`Mühürler yeniden geldi: +${context.freeSpins ?? 10} tepsi. Tarif uzadı.`, 'Narin mühürleri tarifi uzattı. Hücre ateşi sönmeden devam.', 'Ek tepsiler hazır; şekerhane kapanmıyor.'],
    bonusEnd: [`Gece tarifi bitti. Toplam ${payout} PR tek seferde bakiyene geçti.`, `Vardiya kapandı: ${payout} PR bonus ödemesi.`, `Son tepsi de indi. Bonus toplamı ${payout} PR.`],
  }
  const choices = lines[kind]
  return choices[Math.floor(Math.random() * choices.length)]
}

function fallback(prompt: string, context: NarinContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/nasıl|kural|küme|cluster/.test(lower)) return 'Yatay veya dikey bağlı en az beş aynı şeker ödeme yapar. Patlayan yer ilk seferde izlenir; ikinci seferde 2×, sonra 4× diye 1024×e kadar büyür.'
  if (/bonus|ücretsiz|free/.test(lower)) return 'Üç, dört, beş, altı ve yedi mühür sırasıyla 10, 12, 15, 20 ve 30 ücretsiz tepsi açar. Bonusta hücre çarpanları spinler arasında korunur.'
  if (/süper/.test(lower)) return 'Süper tarifte bütün 49 hücre 2× yanarak başlar. Bedeli 500×; normal bonus 100×dir.'
  if (/kazan|ödeme|para/.test(lower)) return `Son ödeme ${Math.round(context.lastPayout ?? 0).toLocaleString('tr-TR')} PR. ${context.cascades} patlama oldu; en sıcak hücre ${context.highestSpot || 0}×.`
  return 'Duydum. Kuralı mı, son tepsinin hesabını mı soruyorsun? Biraz aç, net cevaplayayım.'
}

export async function askNarin(prompt: string, context: NarinContext) {
  const system = `Sen Narin'sin. Pehlevan Royale içindeki Şekerhane 1024 oyununu sunuyorsun. Sıcak, zeki, kısa ve doğal İstanbul Türkçesiyle 1-3 cümle kur. Sonucu veya sonraki spini uydurma. Brüt ödeme ile net sonucu karıştırma. Oyuncuya baskı kurma. Anlık durum: bakiye=${context.balance}; bahis=${context.wager}; son ödeme=${context.lastPayout ?? 'yok'}; patlama=${context.cascades}; ücretsiz spin=${context.freeSpins}; en yüksek hücre=${context.highestSpot}x. Son konuşmalar: ${context.recentMessages.join(' | ') || 'yok'}`
  try {
    const response = await fetch(`${baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .72, top_p: .9, repeat_penalty: 1.16, num_predict: 95 } }), signal: AbortSignal.timeout(90_000) })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return clean(payload.response ?? '') || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
