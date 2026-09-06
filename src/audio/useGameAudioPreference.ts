import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { CasinoGameId } from '../data/casino-database'
import { getGameSfxMix, persistUserSfxMixes, readUserSfxMixes, setGameSfxMix, USER_SFX_MIX_EVENT } from './user-sfx-preferences'

type AudioChannel = 'ai-voice' | 'effects'

const preferenceKey = (game: CasinoGameId, channel: AudioChannel) =>
  `pehlevan-royale:audio:${game}:${channel}:v1`

function readPreference(game: CasinoGameId, channel: AudioChannel, defaultValue: boolean) {
  if (typeof window === 'undefined') return defaultValue
  const saved = window.localStorage.getItem(preferenceKey(game, channel))
  if(saved!==null)return saved==='true'
  return channel==='effects'?!getGameSfxMix(readUserSfxMixes(),game).muted:defaultValue
}

/**
 * One per-game preference shared by desktop and mobile renderings.
 * AI speech intentionally defaults to off; effects may opt into a different default.
 */
export function useGameAudioPreference(
  game: CasinoGameId,
  channel: AudioChannel,
  defaultValue = channel !== 'ai-voice',
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [enabled, setEnabled] = useState(() => readPreference(game, channel, defaultValue))

  useEffect(() => {
    window.localStorage.setItem(preferenceKey(game, channel), String(enabled))
    if(channel==='effects'){const mixes=readUserSfxMixes();const current=getGameSfxMix(mixes,game);if(current.muted===enabled)persistUserSfxMixes(setGameSfxMix(mixes,game,{...current,muted:!enabled}))}
    if (channel === 'ai-voice' && !enabled) window.speechSynthesis?.cancel()
  }, [channel, enabled, game])

  useEffect(()=>{if(channel!=='effects')return;const sync=()=>setEnabled(!getGameSfxMix(readUserSfxMixes(),game).muted);window.addEventListener(USER_SFX_MIX_EVENT,sync);return()=>window.removeEventListener(USER_SFX_MIX_EVENT,sync)},[channel,game])

  return [enabled, setEnabled]
}
