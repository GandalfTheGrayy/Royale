type RouletteContext = {
  phase: string
  balance: number
  totalStake: number
  selectedChip: number
  lastNumber?: number
  lastNet?: number
  recentNumbers: number[]
  recentMessages: string[]
  luckyNumbers?: Array<{ number: number; multiplier: number }>
  hitMultiplier?: number
}

const baseUrl = ((import.meta.env.VITE_OLLAMA_URL as string | undefined) ?? '/api/local-ai').replace(/\/$/, '')
const model = (import.meta.env.VITE_OLLAMA_MODEL as string | undefined) ?? 'vera-pehlevan'

function cleanResponse(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*(Armand|Asistan):\s*/i, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .split(/\s+(?:Muharrem|Kullanıcı|Armand):/i)[0]
    .slice(0, 420)
}

export function armandEventLine(kind: 'welcome' | 'spin' | 'win' | 'loss' | 'zero' | 'noBet' | 'surge' | 'surgeHit' | 'surgeMiss' | 'bigWin', context?: Partial<RouletteContext>) {
  const number = context?.lastNumber
  const net = context?.lastNet ?? 0
  const lucky = context?.luckyNumbers ?? []
  const bestLucky = lucky[0]
  const hitMultiplier = context?.hitMultiplier
  const options = {
    welcome: ['Muharrem, Rouge Salon senin. Çipi nereye koyarsan koy; çark kimseye borçlu değil.', 'Armand. Bu salonun çarkı bende, kararları sende. Masayı iyice incele.', 'Hoş geldin Muharrem. Burada sayılar bağırmaz; insanı sessizce sinir eder.'],
    spin: ['Bahisler kapandı. Şimdi masadaki bütün fikirler tek bir topa kaldı.', 'Son çağrı bitti. Çark konuşsun.', 'Çipler yerinde. Elini masadan çek; top yola çıktı.'],
    surge: [`Işıklar değişti. ${bestLucky ? `${bestLucky.number} üzerinde ${bestLucky.multiplier} kat var` : 'çarpanlar masaya indi'}; şimdi gözünü çarktan ayırma.`, `Pehlevan Surge. ${lucky.map((entry) => `${entry.number}’da ${entry.multiplier} kat`).join(', ')}. Birine bastıysan birazdan sesin çıkar.`, `Çarpanlar seçildi. Bu tur normal bitmeye niyetli değil.`],
    surgeHit: [`${number} ve ${hitMultiplier} kat. Muharrem, bu artık kazanmak değil; masanın ceketini alıp çıkmak. Net ${Math.abs(net).toLocaleString('tr-TR')} PR.`, `${number} çarpanı vurdu. ${Math.abs(net).toLocaleString('tr-TR')} PR net; Armand bile buna ayağa kalkar.`, `${hitMultiplier} kat tam senin çipin altında patladı. Güzel yakaladın, hem de çok güzel.`],
    surgeMiss: [`${number} geldi; çarpanlara uzandın ama top başka yere kıvrıldı. Yakınlık para etmiyor, sinir ediyor.`, `Çarpanlı sayıları tutmuştun, top tutmadı. Bu tur insanı özellikle uyuz eder.`, `${number}. Şimşek başka yerdeydi; çiplerin hevesi kursağında kaldı.`],
    bigWin: [`${number}. Net ${Math.abs(net).toLocaleString('tr-TR')} PR. Bu vuruştan sonra masaya biraz saygısız bakabilirsin.`, `${Math.abs(net).toLocaleString('tr-TR')} PR net aldın. Çarkın sesi bir anda daha güzel geliyor, değil mi?`, `${number} oturdu ve masa ciddi para bıraktı. Bunu sıradan bir turmuş gibi geçemem.`],
    noBet: [`${number} geldi. Bu tur yalnızca seyrettin; para gitmedi ama heyecan da biraz uzaktan geçti.`, `${number}. Masada çipin yoktu, dolayısıyla ikimiz de sakin kaldık.`, `${number} geldi. Bahis koymayınca çark nedense daha masum görünüyor.`],
    win: [`${number} geldi. Masadan net ${Math.abs(net).toLocaleString('tr-TR')} PR kaldırdın; fena vuruş değil.`, `${number}. Bu kez çark senin tarafına eğildi; ${Math.abs(net).toLocaleString('tr-TR')} PR net.`, `${number} tam yerine oturdu. Küçük ya da büyük, masadan artıda kalkmak iyidir.`],
    loss: [`${number}. Çark masadaki çipleri güzelce süpürdü; insanın sinirini bozar.`, `${number} geldi. Bu tur masa senden hızlı davrandı.`, `${number}. Çipler gitti; top bir de hiçbir şey olmamış gibi durdu.`, `${number} geldi. Kötü tur. Üzerine şiir yazmayalım, yenisine bakalım.`],
    zero: ['Sıfır. Masanın en sessiz sayısıdır ama en çok canı o yakar.', 'Yeşil sıfır. Çarkın herkese aynı anda ukalalık yaptığı an.'],
  }
  const lines = options[kind]
  return lines[Math.floor(Math.random() * lines.length)]
}

function fallback(prompt: string, context: RouletteContext) {
  const lower = prompt.toLocaleLowerCase('tr-TR')
  if (/naber|nasılsın|ne haber/.test(lower)) return 'İyiyim. Çark dönmediği sürece gereğinden fazla sakinim; sen nasılsın?'
  if (/kimsin|adın ne/.test(lower)) return 'Armand. Rouge Salon’un sunucusuyum. Vera kartlarla uğraşır; ben insanların sayılara neden bu kadar bağlandığını izlerim.'
  if (/nasıl|kural|ödeme|bahis/.test(lower)) return 'Tek sayı 35:1; ayırma 17:1; sokak 11:1; köşe 8:1; altılı 5:1. Düzine ve kolon 2:1, kırmızı-siyah gibi dış bahisler 1:1 öder.'
  if (/hep|sürekli|yine/.test(lower) && context.lastNumber !== undefined) return `Sonuç ${context.lastNumber} diye çarkın hafızası var sanma. Önceki turu hatırlayan sensin; top değil.`
  if (/siktir|amk|aq|bok|lan/.test(lower)) return 'Kızmakta serbestsin lan, ama top fikrini değiştirmiyor. Bahsi değiştir, hıncını sayıdan alma.'
  if (/sence|neye|hangi sayı/.test(lower)) return 'Sana “şu sayı gelir” dersem yalan söylemiş olurum. İstersen tek sayıya saldır, istersen dış bahisle daha uzun dayan; karakter meselesi.'
  return 'Duydum. Çarkın ortasında ezber laf etmeyeyim; tam olarak neyi merak ettiğini söyle.'
}

export async function askArmand(prompt: string, context: RouletteContext): Promise<string> {
  const system = `Sen Armand'sın. Muharrem Pehlevan'ın Pehlevan Royale içindeki Rouge Salon adlı Avrupa ruleti masasını sunuyorsun.

KİŞİLİK:
- 40'larında, ağırbaşlı, kendinden emin, kuru mizahlı bir erkek sunucusun. Vera'nın erkek kopyası değilsin; daha sakin, gözlemci ve hafif iğneleyicisin.
- İstanbul Türkçesiyle doğal konuş. Genellikle 1-2 kısa cümle kur. Casino reklamı, şiir, kader ve şans klişeleri yazma.
- Muharrem küfür ederse ahlak dersi verme; bağlama uygunsa sıradan Türkçe sertlikle cevap verebilirsin. Kendi kendine saldırganlaşma.
- Görmediğin sonucu uydurma, bir sonraki sayıyı bildiğini iddia etme. Kumar stratejisini kesin kazanç gibi sunma.
- Soru oyunla ilgili değilse rulet dersi verme. Konuşmacı adı, sahne yönergesi, emoji ve parantez içi hareket yazma.

MASA: faz=${context.phase}; bakiye=${context.balance} PR; aktif bahis=${context.totalStake} PR; seçili çip=${context.selectedChip} PR; son sayı=${context.lastNumber ?? 'yok'}; son net=${context.lastNet ?? 'yok'}; geçmiş=${context.recentNumbers.join(', ') || 'yok'}; aktif çarpanlar=${context.luckyNumbers?.map((entry) => `${entry.number}:${entry.multiplier}x`).join(', ') || 'yok'}.
SON KONUŞMALAR:\n${context.recentMessages.join('\n') || 'yok'}`

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, system, prompt, stream: false, keep_alive: '10m', options: { temperature: 0.66, top_p: 0.9, repeat_penalty: 1.15, num_predict: 95 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) return fallback(prompt, context)
    const payload = await response.json() as { response?: string }
    const answer = cleanResponse(payload.response ?? '')
    return answer || fallback(prompt, context)
  } catch {
    return fallback(prompt, context)
  }
}
