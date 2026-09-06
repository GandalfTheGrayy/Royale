import type { CasinoGameId } from '../data/casino-database'

export type UserMusicMix = { muted: boolean; volume: number }
export type UserMusicMixes = Partial<Record<CasinoGameId, UserMusicMix>>

export const USER_MUSIC_MIX_KEY = 'pehlevan-royale-music-mix-v1'
export const DEFAULT_USER_MUSIC_MIX: UserMusicMix = { muted: false, volume: 1 }

const clampVolume = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? Math.max(0, Math.min(1, value))
  : DEFAULT_USER_MUSIC_MIX.volume

export function parseUserMusicMixes(raw: string | null): UserMusicMixes {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<UserMusicMix> | undefined>
    return Object.fromEntries(Object.entries(parsed).flatMap(([game, mix]) => mix
      ? [[game, { muted: mix.muted === true, volume: clampVolume(mix.volume) }]]
      : [])) as UserMusicMixes
  } catch {
    return {}
  }
}

export function getGameMusicMix(mixes: UserMusicMixes, game: CasinoGameId): UserMusicMix {
  return mixes[game] ?? DEFAULT_USER_MUSIC_MIX
}

export function setGameMusicMix(mixes: UserMusicMixes, game: CasinoGameId, mix: UserMusicMix): UserMusicMixes {
  return { ...mixes, [game]: { muted: mix.muted, volume: clampVolume(mix.volume) } }
}

export function readUserMusicMixes(): UserMusicMixes {
  try {
    return parseUserMusicMixes(localStorage.getItem(USER_MUSIC_MIX_KEY))
  } catch {
    return {}
  }
}

export function persistUserMusicMixes(mixes: UserMusicMixes) {
  try {
    localStorage.setItem(USER_MUSIC_MIX_KEY, JSON.stringify(mixes))
  } catch { /* storage can be unavailable in private mode */ }
}
