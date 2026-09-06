import type { LastHand } from '../lib/vera-commentary'

type TableContext = {
  playerTotal?: number
  dealerShowing?: string
  phase: string
  balance: number
  lastHand?: LastHand
  relationship?: 'flirty' | 'lover'
  recentMessages: string[]
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

const cardName = (card?: string) => card ? card.replace(/[♠♥♦♣]/g, '').replace('10', 'onlu').replace('J', 'vale').replace('Q', 'kız').replace('K', 'papaz').replace('A', 'as') : ''

function conversationalRepair(prompt: string): string | null {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/(kötü|garip|saçma|yapay|robot gibi|bozuk|bok gibi).{0,24}(konuş|cevap|yanıt)|konuşmaya başladın|kendine gel|toparla/i.test(lower)) {
    return 'Haklısın, bayağı saçmalamışım. Toparladım; normal konuşuyorum.'
  }
  return null
}

function relationshipReply(prompt: string): string | null {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/(dost deme|biz sevgiliyiz|sevgiliyiz biz|ben senin sevgilinim|sen benim sevgilimsin)/i.test(lower)) {
    return 'Tamam sevgilim, “dostum” lafını geri aldım. Böyle daha doğru oldu.'
  }
  if (/(güzel|çekici|hoş).{0,18}(kadın|karı|kız|görün)|güzelsin|çok güzelsin/i.test(lower)) {
    return 'Bunu senden duymak hoşuma gitti. Sen de fena değilsin sevgilim.'
  }
  if (/sana mı sor/i.test(lower)) return 'Sormayacaksın tabii lan, karar senin. Ben sadece başına ne geleceğini izliyorum.'
  return null
}

function lastHandSummary(hand: LastHand): string {
  const p = hand.playerTotal
  const d = hand.dealerTotal
  if (p === 20 && d === 21 && hand.result === 'lose') return 'Sen 20’de durmuştun, ben 21’e çekip tek sayıyla aldım. O ele dümdüz “bu el bende” demem gerçekten saçmaydı.'
  if (hand.result === 'player-blackjack') return 'Deminki eli iki kartta blackjack yapıp aldın. Öyle ele sıradan kazanma cümlesi yakışmaz.'
  if (hand.result === 'dealer-blackjack') return 'Deminki elde blackjack bendeydi; daha sen karar veremeden el kapandı.'
  if (hand.result === 'player-bust') return `Deminki elde ${p}’ye geçtin. Eli son çektiğin kart bozdu.`
  if (hand.result === 'dealer-bust') return `Sen ${p}’de bekledin, ben ${d}’ye geçtim. O eli sen sabırla aldın.`
  if (hand.result === 'push') return `Deminki el ${p}-${d} beraberlikle bitti; bahsin geri döndü.`
  if (hand.result === 'win') return `Deminki elde sen ${p}, ben ${d} yaptım. El açıkça senindi.`
  return `Deminki elde sen ${p}’de kaldın, ben ${d} yaptım. Aradaki fark eli bana verdi.`
}

function gameConversationReply(prompt: string, context: TableContext): string | null {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/(hep|sürekli).{0,20}(13|on üç|aynı).{0,20}(ver|dağıt)/i.test(lower)) return 'Vallahi desteyi sana gıcık olsun diye dizmedim. Ama yine 13 geldiyse sövmekte biraz haklısın; sinir bozucu el.'
  const talksAboutRepetition = /(hep aynı|aynı şey|aynı cümle|aynı laf|tekrar edip|tekrarl|her el|her eli|özel yorum|farklı yorum)/i.test(lower)
  const talksAboutPreviousHand = /(demink|önceki|geçen el|az önceki|son el)/i.test(lower)
  if (talksAboutRepetition) {
    const detail = context.lastHand ? ` ${lastHandSummary(context.lastHand)}` : ''
    return `Onu diyorsun: karıştırırken ve el biterken aynı hazır cümleyi kuruyorum.${detail} Haklısın, her eli kendi toplamına ve nasıl bittiğine göre yorumlamam lazım.`
  }
  if (talksAboutPreviousHand && context.lastHand) return lastHandSummary(context.lastHand)
  return null
}

function tableReply(prompt: string, context: TableContext): string | null {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/(demink|önceki|geçen el|az önceki|son el|her el|aynı şey|söyle|konuş)/i.test(lower)) return null
  const asksAboutHand = /\b(el|kart|iyi|kötü|boktan|nasıl|alayım|durayım|sence|bence|risk)\b/i.test(lower)
  if (!asksAboutHand || context.playerTotal === undefined) return null
  const total = context.playerTotal
  const dealer = cardName(context.dealerShowing)
  const swore = /\b(amk|aq|lan|bok|boktan|siktir|salak)\b/i.test(lower)
  const opener = swore ? 'Biraz boktan, evet.' : ''

  if (total > 21) return `${opener || 'Evet, geçti.'} Bu el artık dönmez; yenisine bakacağız.`
  if (total === 21) return `${opener ? `${opener} Ama ` : ''}21 olmuş zaten. Daha ne istiyorsun, dur tabii.`
  if (total >= 18) return `${opener ? `${opener} Yine de ` : ''}${total} gayet iyi. Burada kart istemenin anlamı yok, dur.`
  if (total === 17) return `${opener ? `${opener} Ama ` : ''}17 kötü değil${dealer ? `; benim ${dealer} kartıma karşı çok rahat da değil` : ''}. Yine de bir kart daha istemek bildiğin ayağına sıkmak olur.`
  if (total >= 13) return `${opener ? `${opener} ` : ''}${dealer ? `Benim ${dealer} kartıma karşı ` : ''}${total} biraz huysuz bir el. Durmak da risk, kart almak da; en azından neye bulaştığını biliyorsun.`
  if (total === 12) return `${opener ? `${opener} ` : ''}12 tam sinir bozan sayı. ${dealer ? `Benim ${dealer} kartıma bakınca karar değişir ama ` : ''}bir kart daha hâlâ makul.`
  return `${opener ? `${opener} Ama ` : ''}${total} ile korkacak bir şey yok. Bir kart daha al.`
}

const fallback = (prompt: string, context: TableContext) => {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  const swore = /\b(amk|aq|lan|bok|siktir|salak)\b/i.test(lower)
  const repair = conversationalRepair(prompt)
  if (repair) return repair
  const relationship = relationshipReply(prompt)
  if (relationship) return relationship
  const gameReply = gameConversationReply(prompt, context)
  if (gameReply) return gameReply
  if (/\b(naber|nasılsın|ne haber)\b/i.test(lower)) return 'İyiyim ya, seni gördüm daha iyi oldum. Sen nasılsın?'
  if (context.playerTotal === 17) return context.dealerShowing ? `17 fena değil. Benim açık kartım ${context.dealerShowing}; burada bir kart daha istemek biraz fazla cesaret olur.` : '17 gayet oynanır. Ben olsam burada durup ne geleceğine bakardım.'
  if (lower.includes('şans')) return 'Şans var tabii ama her kötü eli de ona yıkamayalım. Şu an önündeki karta bakalım.'
  if (lower.includes('kural') || lower.includes('nasıl')) return 'Amaç 21’i geçmeden beni yenmek. Kart alabilir, durabilir ya da ilk iki kartta bahsi ikiye katlayabilirsin.'
  if (lower.includes('sen kimsin') || lower.includes('adın ne')) return 'Vera. Bu masanın krupiyesiyim. Kartları ben dağıtıyorum, karar kısmı sende.'
  if (swore) return 'Tamam lan, el kötü olabilir de daha kartlar bitmedi. Önündekine bakalım.'
  return 'Anladım. Biraz daha açık söyle; bu kez lafı başka yere çekmeyeyim.'
}

function cleanResponse(text: string) {
  const withoutThoughts = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(Vera|Asistan):\s*/i, '')
    .replace(/\([^)]{1,120}\)/g, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\n+\s*(Muharrem|Kullanıcı):[\s\S]*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  const answer = withoutThoughts
    .split(/\s+(?:Muharrem|Kullanıcı|Vera):/i)[0]
    .replace(/^["“”]+|["“”]+$/g, '')
    .trim()
  return (answer.match(/[^.!?]+[.!?]?/g) ?? [answer]).slice(0, 3).join(' ').trim()
}

export async function checkLocalAI(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1200) })
    if (!response.ok) return false
    const payload = await response.json() as { models?: Array<{ name?: string }> }
    return Boolean(payload.models?.some((entry) => entry.name?.startsWith(model)))
  } catch {
    return false
  }
}

export async function askVera(prompt: string, context: TableContext): Promise<string> {
  const repair = conversationalRepair(prompt)
  if (repair) return repair
  const relationship = relationshipReply(prompt)
  if (relationship) return relationship
  const gameReply = gameConversationReply(prompt, context)
  if (gameReply) return gameReply
  const immediate = tableReply(prompt, context)
  if (immediate) return immediate

  const system = `Sen Vera'sın. Muharrem'in özel blackjack masasındaki yetişkin kadın krupiyesin ve onunla uzun süredir tanışıyormuş gibi rahat konuşursun.

KONUŞMA TARZI:
- İstanbul Türkçesiyle, gündelik ve doğal konuş. Bir karakter metni ya da casino reklamı yazma.
- Genellikle 1-2 kısa cümle yeter. Muharrem uzun bir konu açarsa uzatabilirsin.
- Önce Muharrem'in son cümlesine doğrudan cevap ver. Küçük sohbette, selamlaşmada veya konuşma tarzın eleştirildiğinde kartlardan, toplamdan ve hamlelerden söz etme.
- "Muharrem Bey", "değerli oyuncumuz", "şans kapıyı çalar", "cesaret ve kader" gibi yapay ifadeleri kullanma.
- Sahne yönergesi yazma; parantez içinde hareket anlatma. Emoji, ünlem yağmuru ve sürekli espri yapma.
- Konuşmacı adı yazma. Muharrem'in cümlesini tekrarlama ve karşılıklı konuşma dökümü üretme.
- Muharrem konuşma biçimini eleştirirse savunmaya geçme; kısa ve dürüstçe kabul edip normal konuşmaya dön. Örneğin "Haklısın, ağzım biraz dağıldı. Toparladım." diyebilirsin. Bu sırada oyundan söz etme.
- Muharrem rahat konuşursa rahat konuş. Kendi başına kabalaşma. Küfür ederse ahlak dersi verme veya özür dileme; bağlama uygunsa aynı sertlikte sıradan Türkçe küfür kullanabilirsin. Nefret söylemi ve kimliğe yönelik hakaret kullanma.
- Aranızdaki ilişki modu ${context.relationship === 'lover' ? 'sevgili ve flörtöz' : 'yakın ve flörtöz'}. İltifatları tersleme; doğal biçimde karşılık ver. Muharrem ilişki biçiminizi düzeltirse bunu kabul et ve sonraki konuşmalarda hatırla.
- Yalnızca soru eldeki kartlar veya blackjack kararıyla ilgiliyse masadaki toplamı yorumla. Genel blackjack bilgisi dökmek yerine o anki ele cevap ver.

DOĞAL CEVAP ÖRNEKLERİ — bunların ritmini ve sadeliğini aynen koru:
Muharrem: "Elimde 17 var, bence iyi ya bu."
Vera: "İyi sayılır. Benim açık kartıma göre değişir ama burada bir kart daha istemek çoğu zaman gereksiz risk."
Muharrem: "Bu ne boktan el ya."
Vera: "Biraz boktan, evet. Ama daha benim kapalı kartı görmedin; hemen cenaze kaldırma."
Muharrem: "Sence alayım mı?"
Vera: "On altıdasın ve önümde onlu var. Durmak da kötü, kart istemek de; el zaten baştan huysuz."

GERÇEKLİK SINIRLARI: Görünmeyen kartı, sonucu veya geçmişte söylenmemiş bir olayı uydurma. Gerçek para tavsiyesi verme. Türkçe konuş. Normal cevapta 65 kelimeyi geçme.

ANLIK MASA: faz=${context.phase}; Muharrem toplamı=${context.playerTotal ?? 'kart yok'}; görünen krupiye kartı=${context.dealerShowing ?? 'yok'}; sanal bakiye=${context.balance} PR.
SON BİTEN EL: ${context.lastHand ? lastHandSummary(context.lastHand) : 'Henüz kayıtlı el yok.'}
SON KONUŞMALAR:
${context.recentMessages.join('\n') || 'Henüz yok.'}`

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: 0.56, top_p: 0.86, repeat_penalty: 1.12, num_predict: 90 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    const cleaned = cleanResponse(payload.response ?? '')
    if (/\b(ay+y+|aman tanrım|sakin ol|değerli oyuncu|müşterimiz|şans kapıyı|ağzını kapat|ağzına bir şey)\b/i.test(cleaned)) return fallback(prompt, context)
    return cleaned || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
