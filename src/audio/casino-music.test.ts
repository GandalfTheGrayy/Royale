import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_MUSIC, GAME_MUSIC_TRACKS, catalogTrack, resolveMusicSource } from './casino-music'

describe('casino music catalogue', () => {
  it('her oynanabilir oyun için geçerli ve kaynaklı bir varsayılan parça sağlar', () => {
    const ids = new Set(GAME_MUSIC_TRACKS.map((track) => track.id))
    expect(ids.size).toBe(GAME_MUSIC_TRACKS.length)
    expect(Object.values(DEFAULT_GAME_MUSIC).every((music) => music.source === 'catalog' && ids.has(music.trackId))).toBe(true)
    expect(GAME_MUSIC_TRACKS.every((track) => ['CC0 1.0', 'Pixabay Content License'].includes(track.license) && track.sourcePage.startsWith('https://'))).toBe(true)
  })

  it('katalog ve özel URL kaynaklarını oynatılabilir adrese çözer', async () => {
    const builtIn = await resolveMusicSource('blackjack', DEFAULT_GAME_MUSIC.blackjack)
    expect(builtIn.src).toBe(catalogTrack(DEFAULT_GAME_MUSIC.blackjack.trackId).src)
    const custom = await resolveMusicSource('roulette', { ...DEFAULT_GAME_MUSIC.roulette, source: 'url', customUrl: 'https://example.com/lounge.ogg', customName: 'Gece Salonu' })
    expect(custom).toMatchObject({ src: 'https://example.com/lounge.ogg', name: 'Gece Salonu', revoke: false })
  })

  it('yeni Originals oyunlarına birbirinden farklı tematik parçalar atar', () => {
    expect(DEFAULT_GAME_MUSIC.limbo.trackId).toBe('oracle-sector')
    expect(DEFAULT_GAME_MUSIC.mines.trackId).toBe('ruined-temple')
    expect(DEFAULT_GAME_MUSIC.keno.trackId).toBe('star-pulse')
  })
})
