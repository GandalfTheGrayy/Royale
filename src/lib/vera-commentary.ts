import { type Card, formatCard, handValue } from './blackjack'

export type HandResult = 'player-blackjack' | 'dealer-blackjack' | 'win' | 'lose' | 'push' | 'player-bust' | 'dealer-bust' | 'surrender'

export type LastHand = {
  playerTotal: number
  dealerTotal: number
  playerCards: string[]
  dealerCards: string[]
  result: HandResult
  bet: number
}

export function chooseFresh(lines: string[], previous?: string): string {
  const choices = lines.filter((line) => line !== previous)
  const pool = choices.length ? choices : lines
  const entropy = new Uint32Array(1)
  crypto.getRandomValues(entropy)
  return pool[entropy[0] % pool.length]
}

export function shuffleLines(lastHand?: LastHand): string[] {
  if (lastHand?.playerTotal === 20 && lastHand.dealerTotal === 21 && lastHand.result === 'lose') {
    return [
      'Az önce 20’ni 21’le aldım. Desteyi karıyorum; bu sefer rövanşın var.',
      'O 20’ye karşı çektiğim 21 biraz acımasızdı. Yeni destede hesabı kapatırsın belki.',
    ]
  }
  if (lastHand?.result === 'player-blackjack') return ['Blackjack’in hâlâ masada duruyor. Desteyi karıyorum, bakalım devamı gelecek mi.']
  if (lastHand?.result === 'player-bust') return ['Geçen elde frene biraz geç bastın. Kartları karıyorum; bu kez acele yok.']
  return [
    'Desteyi bir daha karıyorum. Bakalım bu el kimin canını sıkacak.',
    'Kartları karıyorum. Bu kez biraz daha karakterli bir el gelsin.',
    'Yeni el, temiz deste. Öncekini şimdilik kapattım.',
    'Bir saniye, desteyi toparlıyorum. Sonra kozlarımızı paylaşırız.',
    'Kartlar karışıyor. Bu el senden mi yana benden mi, birazdan görürüz.',
  ]
}

export function hitLines(card: Card, total: number): string[] {
  const name = formatCard(card)
  if (total > 21) return [`${name} geldi ve toplam ${total}. O kart fazla oldu.`, `${name} canını yaktı; ${total}’ye geçtin.`]
  if (total === 21) return [`${name} tam yerine oturdu. Yirmi bir; daha iyisi yok.`, `${name} geldi, el tam 21 oldu. Güzel çektin.`]
  if (total >= 18) return [`${name} geldi, ${total} oldun. Buradan sonra iştahı kesmek lazım.`, `Şimdi ${total}. Bir kart daha istemek bayağı kumar olur.`]
  if (total >= 15) return [`${name} geldi; toplam ${total}. El şimdi biraz huzursuz.`, `${total} oldun. Burada her yeni kartın dişi var.`]
  return [`${name} geldi, toplam ${total}. Hâlâ nefes alanın var.`, `Şimdi ${total}. Bir kart daha kaldırabilecek gibi duruyor.`]
}

export function standLines(playerTotal: number, dealerShowing?: Card): string[] {
  const showing = dealerShowing ? formatCard(dealerShowing) : 'açık kartım'
  if (playerTotal === 20) return [`20’de duruyorsun, doğru. Şimdi bakalım ben o eli nasıl aşacağım.`, `Yirmiyle kapattın. Beni zor bir yere bıraktın, açıyorum.`]
  if (playerTotal >= 18) return [`Toplamın ${playerTotal}; burada kalmak sağlam karar. Şimdi kapalı kartımı açıyorum.`, `${playerTotal} sana yeter diyorsun. ${showing} ile önümde ne var, açalım.`]
  if (playerTotal <= 12) return [`Toplamın ${playerTotal} ve duruyorsun; cesur karar. Kapalı kartımı açıyorum.`, `${playerTotal} ile bana alan bıraktın. Bakalım değerlendirebilecek miyim.`]
  return [`Toplamın ${playerTotal}; burada kaldın. ${showing} karşısında nasıl bitecek, görelim.`, `Tamam, sende ${playerTotal} var. Şimdi ben oynuyorum.`]
}

export function resultComment(hand: LastHand): string[] {
  const p = hand.playerTotal
  const d = hand.dealerTotal
  if (hand.result === 'player-blackjack') return ['İki kartta 21. Buna laf yok; blackjack’i tertemiz aldın.', 'Blackjack. Daha ben masaya yerleşemeden işi bitirdin.']
  if (hand.result === 'dealer-blackjack') return [`Ben iki kartta 21 yaptım. Bu elde sana oynayacak yer bırakmadım.`, 'Blackjack bende. Kısa ve biraz tatsız oldu, kabul.']
  if (hand.result === 'push') return [`${p}-${d}. Aynı yerde kapattık; bahsin geri dönüyor.`, `İkimiz de ${p}. Bu el kimseye yazılmadı.`]
  if (hand.result === 'player-bust') return [`Toplamın ${p} oldu; son kart bütün eli dağıttı.`, `Toplam ${p}. Bir kart fazla istedin ve el orada bitti.`]
  if (hand.result === 'dealer-bust') return [`Benim toplam ${d} oldu; senin ${p} hiçbir şey yapmadan kazandı.`, `Sen ${p} ile bekledin, ben ${d} ile patladım. Sabır bu eli aldı.`]
  if (hand.result === 'win') {
    if (p - d === 1) return [`${p}-${d}. Beni tek sayıyla geçtin; kıl payı ama el senin.`, `Aramızda bir sayı vardı: ${p}-${d}. Bu kez o sayı senden yana.`]
    return [`Sen ${p}, ben ${d}. Bu eli açık biçimde aldın.`, `${p}’yle benim ${d}’mi geçtin. Bahis senin.`]
  }
  if (p === 20 && d === 21) return ['Sen 20’de kapattın, ben son kartla 21’e geldim. Böyle kaybetmek insanın sinirini bozar, haklısın.', '20’yle gayet doğru oynadın; ben 21’e çekip eli tek sayıyla aldım. Biraz pis bir son oldu.']
  if (d - p === 1) return [`${p}-${d}. Seni tek sayıyla geçtim; bu el gerçekten kıl payı gitti.`, `Sen ${p}, ben ${d}. Aradaki tek sayı bütün bahsi çevirdi.`]
  return [`Sen ${p} ile kaldın, ben ${d} yaptım. Bu el bende.`, `Ben ${d}, sen ${p}. Bu sefer kartlar benim tarafımdaydı.`]
}

export function classifyResult(player: Card[], dealer: Card[], forced?: 'blackjack' | 'dealerBlackjack' | 'push'): HandResult {
  const p = handValue(player).total
  const d = handValue(dealer).total
  if (forced === 'blackjack') return 'player-blackjack'
  if (forced === 'dealerBlackjack') return 'dealer-blackjack'
  if (forced === 'push' || p === d) return 'push'
  if (p > 21) return 'player-bust'
  if (d > 21) return 'dealer-bust'
  return p > d ? 'win' : 'lose'
}
