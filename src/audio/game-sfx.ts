import { getAdminSettings } from '../data/casino-admin'
import type { CasinoGameId } from '../data/casino-database'
import { gameSfxLevel } from './user-sfx-preferences'

const activeScopes=new Map<CasinoGameId,number>()
const playingByGame=new Map<CasinoGameId,Set<HTMLAudioElement>>()

export function activateGameSfxScope(game:CasinoGameId){
  activeScopes.set(game,(activeScopes.get(game)??0)+1)
}

export function stopGameSfx(game:CasinoGameId){
  const playing=playingByGame.get(game)
  playing?.forEach((audio)=>{
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  })
  playing?.clear()
  playingByGame.delete(game)
}

export function deactivateGameSfxScope(game:CasinoGameId){
  const next=Math.max(0,(activeScopes.get(game)??1)-1)
  if(next)activeScopes.set(game,next)
  else{
    activeScopes.delete(game)
    stopGameSfx(game)
  }
}

export function playGameSfx(game:CasinoGameId,src:string,volume=.35,playbackRate=1){
  const admin=getAdminSettings()
  if(!activeScopes.has(game)||!admin.general.masterSound||!admin.games[game].sound)return
  const level=gameSfxLevel(game,volume);if(level<=0)return
  const audio=new Audio(src)
  const playing=playingByGame.get(game)??new Set<HTMLAudioElement>()
  playing.add(audio);playingByGame.set(game,playing)
  const release=()=>{
    playing.delete(audio)
    if(!playing.size)playingByGame.delete(game)
  }
  audio.addEventListener('ended',release,{once:true})
  audio.addEventListener('error',release,{once:true})
  audio.preload='auto'
  audio.volume=level
  audio.playbackRate=Math.max(.5,Math.min(2,playbackRate))
  void audio.play().catch(release)
}
