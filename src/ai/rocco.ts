type RoccoContext = {
  game: string
  balance: number
  wager: number
  lastNet?: number
  lastWinLabels: string[]
  spins: number
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function cleanResponse(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(Rocco|Asistan):\s*/i, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/\s+(?:Muharrem|Kullanıcı|Rocco):/i)[0]
    .slice(0, 420)
}

export function roccoEventLine(kind: 'welcome' | 'spin' | 'loss' | 'win' | 'bigWin' | 'hold', context?: Partial<RoccoContext>) {
  const net = Math.abs(context?.lastNet ?? 0).toLocaleString('tr-TR')
  const labels = context?.lastWinLabels?.join(', ')
  const lines = {
    welcome: ['Muharrem, burası masa salonu değil. Işık bol, makine çok; hangisinin sinirini bozacağına sen karar ver.', 'Royal Reels’a hoş geldin. Ben Rocco. Makineler benim değil ama bütün numaralarını bilirim.', 'Bu katta yeşil keçe yok. Her makinenin kendi huyu var; birine otur, tanışın.'],
    spin: ['Kolu indirdin. Şimdi üç makara ne kadar terbiyesiz, göreceğiz.', 'Dönsün. Biraz gürültü çıkarmadan eğlence olmuyor.', 'Bahis içeride; ışıkları uyandırdın.'],
    hold: ['İki makarayı kilitledin. Üçüncünün bütün geceyi kurtarmasını bekliyoruz yani.', 'Hold aldım. Aynı yüzleri bir tur daha masada tutuyoruz.', 'Makarayı tuttun; şimdi kalan parça yerine otursun.'],
    loss: ['Bu tur makine parayı aldı, karşılığında üç tane surat gösterdi. Çok cömert.', 'Hiç çizgi yok. Makine şu an aşırı memnun, ben değilim.', 'Boş geçti. Üzerine dramatik müzik koyup daha da sinir bozmayacağım.'],
    win: [`${labels || 'Çizgi'} ödeme yaptı. Net ${net} PR; küçük ama gerçek, süsleyip yalan söylemeyelim.`, `Işık boşuna yanmadı; ${labels || 'bir çizgi'} tuttu. ${net} PR net.`, `Makine sonunda ağzını açtı. ${labels || 'Kazanan çizgi'} masada.`],
    bigWin: [`İşte şimdi ses yükselir. ${labels || 'Çizgiler'} ve net ${net} PR; bu makineyi biraz sarstın.`, `${net} PR net. Rocco burada ceketini düzeltip ayağa kalkar.`, `Bu sıradan spin değil. ${labels || 'Büyük çizgi'} bütün katı uyandırdı.`],
  }
  const options = lines[kind]
  return options[Math.floor(Math.random() * options.length)]
}

function fallback(prompt: string, context: RoccoContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'İyiyim. Kat gürültülü, ceket ağır ama keyfim yerinde. Sen nasıl gidiyorsun?'
  if (/kimsin|adın ne/.test(lower)) return 'Rocco. Slot katının sunucusuyum; makineler konuşamadığı yerde ben konuşuyorum.'
  if (/nasıl|kural|ödeme|çizgi/.test(lower)) return 'Beş çizgin var; bahis beşe bölünüyor. Soldan başlayan iki kiraz 8 kat, üç aynı sembol kendi tablosundaki çarpanı verir.'
  if (/hep|sürekli|yine/.test(lower)) return 'Makine aynı havayı veriyor olabilir ama sonucu ezberden çekmiyor. İstersen iki makarayı hold’a alıp üçüncüyü zorlayalım.'
  if (/siktir|amk|aq|bok|lan/.test(lower)) return 'Haklıysan haklısın lan; boş spin güzel görünce dolmuyor. Neti ekranda açık açık yazıyorum zaten.'
  if (context.lastNet !== undefined) return `Son spin ${context.lastNet >= 0 ? 'artıda' : 'ekside'} ${Math.abs(context.lastNet).toLocaleString('tr-TR')} PR kapandı. Ne tarafını konuşalım?`
  return 'Duydum. Makineyi mi soruyorsun, bu katın geri kalanını mı? Biraz aç.'
}

export async function askRocco(prompt: string, context: RoccoContext) {
  const system = `Sen Rocco'sun. Muharrem Pehlevan'ın Pehlevan Royale içindeki Royal Reels slot katını sunuyorsun.

KİŞİLİK:
- 30'larının sonunda, enerjik, teatral ama yapay casino reklamı gibi konuşmayan bir erkek showmansın.
- İstanbul Türkçesiyle doğal konuş. Genellikle 1-2 kısa cümle kur. Her şeye şans, kader veya büyük zafer deme.
- Net kayıp varsa kazanç gibi kutlama. Brüt ödeme ile net sonucu karıştırma.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygunsa gündelik sertlikle karşılık verebilirsin. Kendi kendine saldırganlaşma.
- Görmediğin sonucu, bonusu veya bir sonraki sembolü uydurma. Sahne yönergesi, konuşmacı adı, emoji ve parantez içi hareket yazma.
- Slot katındaki makinelerin farklı kişilikleri olduğunu bil; ${context.game} şu an açık oyun.

ANLIK DURUM: oyun=${context.game}; bakiye=${context.balance} PR; bahis=${context.wager} PR; son net=${context.lastNet ?? 'yok'}; kazananlar=${context.lastWinLabels.join(', ') || 'yok'}; spin sayısı=${context.spins}.
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .68, top_p: .9, repeat_penalty: 1.17, num_predict: 90 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return cleanResponse(payload.response ?? '') || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
