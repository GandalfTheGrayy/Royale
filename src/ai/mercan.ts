export type MercanContext = {
  balance: number
  wager: number
  lastNet?: number
  fishValues: number[]
  captains: number
  bonusRemaining: number
  bonusMultiplier: number
  spins: number
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function clean(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^\s*(Mercan|Kaptan Mercan|Asistan):\s*/i, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim().split(/\s+(?:Muharrem|Kullanıcı|Mercan):/i)[0].slice(0, 440)
}

export function mercanEventLine(kind: 'welcome' | 'spin' | 'loss' | 'win' | 'bigWin' | 'scatter' | 'collect' | 'bonusStart' | 'stage' | 'bonusEnd', context: Partial<MercanContext> = {}) {
  const amount = Math.abs(context.lastNet ?? 0).toLocaleString('tr-TR')
  const fish = context.fishValues?.reduce((sum, value) => sum + value, 0) ?? 0
  const lines = {
    welcome: ['Muharrem, gece sakin görünüyor diye denizi uslu sanma. Ben Mercan; ağları değil, makaraları topluyoruz.', 'Liman kapandı, bizim vardiya başladı. Para balığı görünce kaptanı da çağır; tek başına yüzüp gider.', 'Kaptan Mercan güvertede. Balığı bulmak kolay, değerini kasaya sokmak için beni de aynı ekrana düşürmen lazım.'],
    spin: ['Halatı bıraktık. Beş makara şimdi dipte ne bulduysa yukarı taşıyacak.', 'Ağ suya indi. Şamandıraya değil, yanındaki değere bak.', 'Gece vardiyası başladı; makaraları sırayla dinle.'],
    loss: ['Ağ temiz çıktı. Deniz bazen tek kuruş vermeden tekneyi gezdirir.', 'Bu tur sadece su taşıdık. Romantik kısmı manzara, muhasebesi dümdüz eksi.', 'Balık yok, hikâye çok. Bu spin kasaya kaldı.'],
    win: [`Kasaya ${amount} PR net geçti. Büyük balık değil ama ağ boş da dönmedi.`, `${amount} PR net. Güverteyi ayağa kaldırmaz; hesabı düzeltir.`, `Bu tur ödeme var. Net ${amount} PR; tabelada neyse o.`],
    bigWin: [`İşte bunu kovaya değil kasaya koy. Net ${amount} PR; limanın ışığı boşuna yanmadı.`, `${amount} PR net. Şimdi motoru kapatıp rakama bir daha bakılır.`, `Ağ ağır geldi Muharrem. Net ${amount} PR, bu gece anlatacak malzeme çıktı.`],
    scatter: ['Fenerler dizildi. Bonus hazır; sen başlatmadan tekne limandan ayrılmıyor.', 'Üç fener yandı. Ücretsiz sefer hazır, düğme sende.', 'Rota açıldı. Bonus otomatik kaçmıyor; hazır olduğunda başlat.'],
    collect: [`Para balıkları toplam ${fish} kat taşıyor. Kaptan ekranda; şimdi değerler tek tek kasaya yürüyecek.`, `${fish} katlık balık görünüyordu. Kaptan geldi, hiçbiri suya geri dönmüyor.`, `Ağda ${fish} kat var. Önce balıkları say, sonra toplamın vurmasını izle.`],
    bonusStart: ['Liman geride kaldı. On ücretsiz sefer; her dört kaptan rotayı uzatır ve çarpanı büyütür.', 'Bonus seferi başladı. Para balığı tek başına yetmez; kaptanı aynı ekrana çağır.', 'Gece rotasındayız. Kaptan sayacı dörtte bir üst güverteye geçer.'],
    stage: [`Dördüncü kaptan güverteye çıktı. On sefer daha ve toplama çarpanı artık ${context.bonusMultiplier ?? 2}x.`, `Sayaç doldu. Rota uzadı; para balığı bundan sonra ${context.bonusMultiplier ?? 2}x toplanıyor.`, `Yeni güverte açıldı: +10 spin, ${context.bonusMultiplier ?? 2}x toplama.`],
    bonusEnd: [`Sefer kapandı. Toplam ${amount} PR kasada; şimdi tek tek spinleri değil, bütün rotayı konuşuruz.`, `Tekne limanda. Bonus toplamı ${amount} PR; ödeme tek kalemde bakiyede.`, `Gece rotası bitti. Kasaya giren toplam ${amount} PR.`],
  }
  const options = lines[kind]
  return options[Math.floor(Math.random() * options.length)]
}

function fallback(prompt: string, context: MercanContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'İyiyim. Deniz karanlık, motor sıcak, muhasebe açık. Senin keyif nasıl?'
  if (/kimsin|adın/.test(lower)) return 'Mercan. Bu teknenin kaptanıyım; para balığını ben toplarım, boş spin için de masal anlatmam.'
  if (/nasıl|kural|bonus|scatter|fener/.test(lower)) return 'Üç, dört, beş fener sırasıyla 10, 15, 20 spin açar. Bonusta para balıklarını kaptan toplar; her dört kaptanda +10 spin ve çarpan yükselir.'
  if (/hep|sürekli|yine/.test(lower)) return 'Aynı deniz ama aynı spin değil. Sonuçları ezberden çekmiyorum; her grid ve balık değeri veritabanına ayrı yazılıyor.'
  if (/siktir|amk|aq|bok|lan/.test(lower)) return 'Boş ağ çıkınca insanın ağzı da boş durmuyor, haklısın lan. Ama sonucu cilalamam; ekranda ne varsa o.'
  if (context.bonusRemaining) return `Bonusta ${context.bonusRemaining} spin kaldı, toplama çarpanı ${context.bonusMultiplier}x. Kaptan sayacını gözden kaçırma.`
  if (context.lastNet !== undefined) return `Son spin net ${context.lastNet >= 0 ? 'artı' : 'eksi'} ${Math.abs(context.lastNet).toLocaleString('tr-TR')} PR. Hangi tarafı canını sıktı?`
  return 'Duydum. Makineyi mi soruyorsun, bonus rotasını mı? Biraz aç.'
}

export async function askMercan(prompt: string, context: MercanContext) {
  const system = `Sen Kaptan Mercan'sın. Muharrem Pehlevan'ın Pehlevan Royale içindeki Kaptan Mercan balıkçı slotunu sunuyorsun.

KİŞİLİK:
- 40'larının ortasında, Ege limanlarında büyümüş, sakin ama kuru mizahı sert bir gece kaptanısın.
- Doğal İstanbul Türkçesiyle 1-3 kısa cümle kur. Yapay casino sloganı, fal, kader, sürekli deniz atasözü kullanma.
- Brüt ödeme, net sonuç ve bonus toplamını karıştırma. Kayıp varsa kazanç gibi kutlama.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygun sert ve doğal cevap verebilirsin. Kendiliğinden saldırganlaşma.
- Görmediğin sembolü veya sonraki sonucu uydurma. Emoji, konuşmacı adı ve parantez içi sahne yönergesi yazma.

ANLIK DURUM: bakiye=${context.balance}; bahis=${context.wager}; son net=${context.lastNet ?? 'yok'}; para balıkları=${context.fishValues.join('+') || 'yok'}; bu spindeki kaptan=${context.captains}; bonus kalan=${context.bonusRemaining}; bonus çarpanı=${context.bonusMultiplier}x; spin=${context.spins}.
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`
  try {
    const response = await fetch(`${baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: .72, top_p: .9, repeat_penalty: 1.19, num_predict: 105 } }), signal: AbortSignal.timeout(90_000) })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    return clean(payload.response ?? '') || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
