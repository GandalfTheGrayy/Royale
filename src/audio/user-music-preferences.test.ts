import { describe, expect, it } from 'vitest'
import { getGameMusicMix, parseUserMusicMixes, setGameMusicMix } from './user-music-preferences'

describe('oyun bazlı müzik tercihleri', () => {
  it('bir oyunu sustururken diğer oyunun tercihini değiştirmez', () => {
    const initial = parseUserMusicMixes('{"blackjack":{"muted":false,"volume":0.7},"roulette":{"muted":false,"volume":0.35}}')
    const changed = setGameMusicMix(initial, 'blackjack', { muted: true, volume: 0.7 })

    expect(getGameMusicMix(changed, 'blackjack')).toEqual({ muted: true, volume: 0.7 })
    expect(getGameMusicMix(changed, 'roulette')).toEqual({ muted: false, volume: 0.35 })
  })

  it('henüz tercihi olmayan oyunu açık ve tam kullanıcı sesinde başlatır', () => {
    expect(getGameMusicMix({}, 'neon-kasasi')).toEqual({ muted: false, volume: 1 })
  })

  it('bozuk veya sınır dışı ses verisini güvenli biçimde düzeltir', () => {
    const parsed = parseUserMusicMixes('{"blackjack":{"muted":true,"volume":4},"roulette":{"volume":-2}}')
    expect(getGameMusicMix(parsed, 'blackjack')).toEqual({ muted: true, volume: 1 })
    expect(getGameMusicMix(parsed, 'roulette')).toEqual({ muted: false, volume: 0 })
  })
})
