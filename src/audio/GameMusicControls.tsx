import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getAdminSettings, subscribeAdminSettings } from '../data/casino-admin'
import type { CasinoGameId } from '../data/casino-database'
import { catalogTrack, resolveMusicSource } from './casino-music'
import { activateGameSfxScope, deactivateGameSfxScope } from './game-sfx'
import { getGameMusicMix, persistUserMusicMixes, readUserMusicMixes, setGameMusicMix, type UserMusicMix } from './user-music-preferences'
import { getGameSfxMix, persistUserSfxMixes, readUserSfxMixes, setGameSfxMix, type UserSfxMix } from './user-sfx-preferences'
import './game-music.css'

export default function GameMusicControls({ game }: { game: CasinoGameId }) {
  const admin = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings)
  const settings = admin.games[game].music
  const [mixes, setMixes] = useState(readUserMusicMixes)
  const mix = getGameMusicMix(mixes, game)
  const [sfxMixes,setSfxMixes]=useState(readUserSfxMixes);const sfxMix=getGameSfxMix(sfxMixes,game)
  const [trackName, setTrackName] = useState(() => settings.source === 'catalog' ? catalogTrack(settings.trackId).name : settings.customName || 'Özel parça')
  const [blocked, setBlocked] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef(0)
  const effectiveEnabled = admin.general.masterSound && admin.general.musicEnabled && admin.games[game].sound && settings.enabled && !mix.muted
  const effectiveVolume = Math.max(0, Math.min(1, admin.general.musicVolume * settings.volume * mix.volume))
  const enabledRef = useRef(effectiveEnabled)
  const volumeRef = useRef(effectiveVolume)
  enabledRef.current = effectiveEnabled
  volumeRef.current = effectiveVolume
  const sourceKey = useMemo(() => `${settings.source}:${settings.trackId}:${settings.customUrl}:${settings.customName}`, [settings])

  useEffect(()=>{
    activateGameSfxScope(game)
    return()=>{
      deactivateGameSfxScope(game)
      window.speechSynthesis?.cancel()
    }
  },[game])

  useEffect(() => {
    let active = true
    let objectUrl = ''
    const audio = new Audio()
    audio.loop = true
    audio.preload = 'auto'
    audioRef.current = audio

    const fadeTo = (target: number, duration = 700) => {
      window.cancelAnimationFrame(fadeRef.current)
      const from = audio.volume
      const started = performance.now()
      const tick = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration))
        const nextVolume = from + (target - from) * (1 - Math.pow(1 - progress, 3))
        audio.volume = Math.max(0, Math.min(1, nextVolume))
        if (progress < 1) fadeRef.current = requestAnimationFrame(tick)
      }
      fadeRef.current = requestAnimationFrame(tick)
    }

    const start = async () => {
      const resolved = await resolveMusicSource(game, settings).catch(() => ({ src: '', name: 'Parça yüklenemedi', revoke: false }))
      if (!active) {
        if (resolved.revoke && resolved.src) URL.revokeObjectURL(resolved.src)
        return
      }
      setTrackName(resolved.name)
      if (!resolved.src) { setBlocked(true); return }
      objectUrl = resolved.revoke ? resolved.src : ''
      audio.src = resolved.src
      audio.volume = 0
      if (!enabledRef.current) return
      await audio.play().then(() => { setBlocked(false); fadeTo(volumeRef.current) }).catch(() => setBlocked(true))
    }

    void start()
    const unlock = () => {
      if (!enabledRef.current || !audio.src || !audio.paused) return
      void audio.play().then(() => { setBlocked(false); fadeTo(volumeRef.current) }).catch(() => setBlocked(true))
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    window.addEventListener('keydown', unlock)
    return () => {
      active = false
      window.cancelAnimationFrame(fadeRef.current)
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (audioRef.current === audio) audioRef.current = null
    }
    // A new source intentionally rebuilds the audio element and performs a fresh fade-in.
  }, [game, sourceKey])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    window.cancelAnimationFrame(fadeRef.current)
    if (!effectiveEnabled) {
      audio.pause()
      return
    }
    audio.volume = effectiveVolume
    if (audio.paused) void audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [effectiveEnabled, effectiveVolume])

  const updateMix = (updater: (current: UserMusicMix) => UserMusicMix) => setMixes((current) => {
    const next = setGameMusicMix(current, game, updater(getGameMusicMix(current, game)))
    persistUserMusicMixes(next)
    return next
  })
  const toggle = () => updateMix((current) => ({ ...current, muted: !current.muted }))
  const updateSfxMix=(updater:(current:UserSfxMix)=>UserSfxMix)=>setSfxMixes((current)=>{const next=setGameSfxMix(current,game,updater(getGameSfxMix(current,game)));persistUserSfxMixes(next);return next})
  const disabledByAdmin = !admin.general.masterSound || !admin.general.musicEnabled || !admin.games[game].sound || !settings.enabled
  const sfxDisabledByAdmin=!admin.general.masterSound||!admin.games[game].sound

  return <div className={`game-music-control ${effectiveEnabled ? 'playing' : ''} ${disabledByAdmin ? 'admin-muted' : ''}`} title={blocked && effectiveEnabled ? 'Müziği başlatmak için ekrana dokun' : trackName}>
    <button type="button" onClick={toggle} disabled={disabledByAdmin} aria-label={mix.muted ? 'Arka plan müziğini aç' : 'Arka plan müziğini kapat'} aria-pressed={!mix.muted}>{mix.muted || disabledByAdmin ? '♫' : '♪'}</button>
    <div><small>{disabledByAdmin ? 'MÜZİK KAPALI' : trackName}</small><input aria-label="Arka plan müziği ses seviyesi" type="range" min="0" max="100" value={Math.round(mix.volume * 100)} disabled={disabledByAdmin || mix.muted} onChange={(event) => updateMix((current) => ({ ...current, volume: Number(event.target.value) / 100 }))} /></div><section className={`game-sfx-control ${!sfxMix.muted&&!sfxDisabledByAdmin?'on':''}`}><button type="button" disabled={sfxDisabledByAdmin} aria-label={sfxMix.muted?'Efekt seslerini aç':'Efekt seslerini kapat'} aria-pressed={!sfxMix.muted} onClick={()=>updateSfxMix((current)=>({...current,muted:!current.muted}))}>FX</button><input aria-label="Efekt sesi seviyesi" type="range" min="0" max="100" value={Math.round(sfxMix.volume*100)} disabled={sfxDisabledByAdmin||sfxMix.muted} onChange={(event)=>updateSfxMix((current)=>({...current,volume:Number(event.target.value)/100}))}/></section>
  </div>
}
