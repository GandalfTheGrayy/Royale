import type { CasinoGameId } from '../data/casino-database'

export type MusicSource = 'catalog' | 'url' | 'upload'

export type GameMusicSettings = {
  enabled: boolean
  volume: number
  source: MusicSource
  trackId: string
  customUrl: string
  customName: string
}

export type MusicTrack = {
  id: string
  name: string
  mood: string
  artist: string
  license: 'CC0 1.0' | 'Pixabay Content License'
  sourcePage: string
  src: string
}

export const GAME_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'allahin-lutfu-cinematic',
    name: 'Middle Eastern Cinematic Loop',
    mood: 'Sinematik Doğu · canlı, mistik ve ritmik',
    artist: 'Sonican',
    license: 'Pixabay Content License',
    sourcePage: 'https://pixabay.com/music/world-middle-eastern-cinematic-music-loop-453663/',
    src: '/assets/slots/allahin-lutfu/audio/allahin-lutfu-theme-v2.mp3',
  },
  {
    id: 'forget-me-not',
    name: 'Forget Me Not',
    mood: 'Neoklasik piyano · zarif ve sakin',
    artist: 'Kistol',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/forget-me-not',
    src: '/assets/music/blackjack-forget-me-not.ogg',
  },
  {
    id: 'planet-lounge',
    name: 'Planet Lounge',
    mood: 'Lounge · gizemli ve ritmik',
    artist: 'hatmix',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/hello-from-the-children-of-planet-earth',
    src: '/assets/music/roulette-planet-lounge.ogg',
  },
  {
    id: 'title-screen-8bit',
    name: '8Bit Title Screen',
    mood: 'Retro chiptune · canlı ve nostaljik',
    artist: 'Joth',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/8bit-title-screen',
    src: '/assets/music/kiraz-77-title-screen.mp3',
  },
  {
    id: 'pynchon',
    name: 'Pynchon',
    mood: 'Lo-fi cyberpunk · synth ve glitch',
    artist: 'James Gargette / cinameng',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/pynchon',
    src: '/assets/music/neon-kasasi-pynchon.mp3',
  },
  {
    id: 'pirate-indenture',
    name: 'Pirate Indenture',
    mood: 'Deniz macerası · hızlı ve döngülenebilir',
    artist: 'Eldritch Grim',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/pirate-indenture',
    src: '/assets/fisherman/audio/pirate-indenture-loop.wav',
  },
  {
    id: 'not-that-east',
    name: 'Not That East',
    mood: 'Doğu esintili macera · gece uçuşu',
    artist: 'KiluaBoy',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/sci-fi-adventure-eastern-quiet-piano-loop',
    src: '/assets/music/altin-rota-not-that-east.ogg',
  },
  {
    id: 'cave-explorer',
    name: 'Cave Explorer',
    mood: 'Yeraltı ambience · sakin ve gizemli',
    artist: 'mutantleg',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/cave-explorer',
    src: '/assets/instant/obsidyen-damari/audio/cave-explorer.mp3',
  },
  {
    id: 'son-on-urgent',
    name: 'Urgent',
    mood: 'Gerilim nabzı · karanlık ve yükselen',
    artist: 'SRG774',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
    src: '/assets/instant/son-on/audio/urgent.mp3',
  },
  {
    id: 'sekerhane-swing',
    name: 'Catchy Swing',
    mood: 'Oyunbaz swing · sıcak, canlı ve döngüsel',
    artist: 'Doge',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/catchy-swing',
    src: '/assets/music/sekerhane-catchy-swing.ogg',
  },
  {
    id: 'oracle-sector',
    name: 'Sector',
    mood: 'Kozmik gerilim · ritmik ve gizemli',
    artist: 'SRG774',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
    src: '/assets/instant/originals/audio/limbo-oracle-sector.mp3',
  },
  {
    id: 'ruined-temple',
    name: 'Into the Ruined Temple',
    mood: 'Karanlık synth · hareketli ve tehlikeli',
    artist: 'SterlingRay',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/into-the-ruined-temple',
    src: '/assets/instant/originals/audio/mines-ruined-temple.mp3',
  },
  {
    id: 'star-pulse',
    name: 'Pulse',
    mood: 'Uzay nabzı · ritmik ve canlı',
    artist: 'SRG774',
    license: 'CC0 1.0',
    sourcePage: 'https://opengameart.org/content/dark-sci-fi-audio-pack',
    src: '/assets/instant/originals/audio/keno-star-pulse.mp3',
  },
]

export const DEFAULT_GAME_MUSIC: Record<CasinoGameId, GameMusicSettings> = {
  blackjack: { enabled: true, volume: .34, source: 'catalog', trackId: 'forget-me-not', customUrl: '', customName: '' },
  roulette: { enabled: true, volume: .3, source: 'catalog', trackId: 'planet-lounge', customUrl: '', customName: '' },
  poker: { enabled: true, volume: .26, source: 'catalog', trackId: 'planet-lounge', customUrl: '', customName: '' },
  'kiraz-77': { enabled: true, volume: .24, source: 'catalog', trackId: 'title-screen-8bit', customUrl: '', customName: '' },
  'neon-kasasi': { enabled: true, volume: .3, source: 'catalog', trackId: 'pynchon', customUrl: '', customName: '' },
  'kaptan-mercan': { enabled: true, volume: .24, source: 'catalog', trackId: 'pirate-indenture', customUrl: '', customName: '' },
  'sekerhane-1024': { enabled: true, volume: .27, source: 'catalog', trackId: 'sekerhane-swing', customUrl: '', customName: '' },
  'allahin-lutfu': { enabled: true, volume: .24, source: 'catalog', trackId: 'allahin-lutfu-cinematic', customUrl: '', customName: '' },
  'baykus-madeni': { enabled: true, volume: .24, source: 'catalog', trackId: 'cave-explorer', customUrl: '', customName: '' },
  'altin-rota': { enabled: true, volume: .27, source: 'catalog', trackId: 'not-that-east', customUrl: '', customName: '' },
  limbo: { enabled: true, volume: .3, source: 'catalog', trackId: 'oracle-sector', customUrl: '', customName: '' },
  'obsidyen-damari': { enabled: true, volume: .26, source: 'catalog', trackId: 'cave-explorer', customUrl: '', customName: '' },
  mines: { enabled: true, volume: .27, source: 'catalog', trackId: 'ruined-temple', customUrl: '', customName: '' },
  keno: { enabled: true, volume: .29, source: 'catalog', trackId: 'star-pulse', customUrl: '', customName: '' },
  'son-on': { enabled: true, volume: .34, source: 'catalog', trackId: 'son-on-urgent', customUrl: '', customName: '' },
  plinko: { enabled: true, volume: .25, source: 'catalog', trackId: 'planet-lounge', customUrl: '', customName: '' },
  hilo: { enabled: true, volume: .26, source: 'catalog', trackId: 'planet-lounge', customUrl: '', customName: '' },
  'yedi-cevher': { enabled: true, volume: .27, source: 'catalog', trackId: 'oracle-sector', customUrl: '', customName: '' },
}

type StoredMusic = {
  game: CasinoGameId
  name: string
  type: string
  size: number
  blob: Blob
  updatedAt: string
}

const DB_NAME = 'pehlevan-royale-music'
const STORE_NAME = 'tracks'

function openMusicDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'game' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveUploadedMusic(game: CasinoGameId, file: File) {
  const db = await openMusicDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({ game, name: file.name, type: file.type, size: file.size, blob: file, updatedAt: new Date().toISOString() } satisfies StoredMusic)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function removeUploadedMusic(game: CasinoGameId) {
  const db = await openMusicDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(game)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

export async function getUploadedMusic(game: CasinoGameId) {
  const db = await openMusicDatabase()
  const value = await new Promise<StoredMusic | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(game)
    request.onsuccess = () => resolve(request.result as StoredMusic | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return value
}

export function catalogTrack(trackId: string) {
  return GAME_MUSIC_TRACKS.find((track) => track.id === trackId) ?? GAME_MUSIC_TRACKS[0]
}

export async function resolveMusicSource(game: CasinoGameId, settings: GameMusicSettings) {
  if (settings.source === 'url') return { src: settings.customUrl.trim(), name: settings.customName.trim() || 'Özel bağlantı', revoke: false }
  if (settings.source === 'upload') {
    const stored = await getUploadedMusic(game)
    if (!stored) return { src: '', name: settings.customName || 'Yüklenen dosya bulunamadı', revoke: false }
    return { src: URL.createObjectURL(stored.blob), name: stored.name, revoke: true }
  }
  const track = catalogTrack(settings.trackId)
  return { src: track.src, name: track.name, revoke: false }
}
