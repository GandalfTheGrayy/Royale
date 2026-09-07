import type { CasinoGameId } from '../../data/casino-database'
import { gameSfxLevel, isGameSfxEnabled } from '../../audio/user-sfx-preferences'

type AudioMode = 'spin' | 'stop' | 'win' | 'bigWin' | 'winTier' | 'button' | 'cascade' | 'scatter' | 'multiplier' | 'powerLand' | 'multiplierCollect' | 'multiplierImpact' | 'eye' | 'mystery' | 'key' | 'coin' | 'collector' | 'pickaxe' | 'blockBreak' | 'chestLatch' | 'chestOpen' | 'bookUpgrade'

const ALLAH_AUDIO_ROOT = '/assets/slots/allahin-lutfu/audio'
const ALLAH_AUDIO_ASSETS: Partial<Record<AudioMode, { src: string; volume: number }>> = {
  spin: { src: `${ALLAH_AUDIO_ROOT}/reel-spin-v2.mp3`, volume: .22 },
  stop: { src: `${ALLAH_AUDIO_ROOT}/reel-stop-v2.mp3`, volume: .12 },
  eye: { src: `${ALLAH_AUDIO_ROOT}/eye-awaken-v2.mp3`, volume: .25 },
  mystery: { src: `${ALLAH_AUDIO_ROOT}/mystery-reveal-v2.mp3`, volume: .18 },
  key: { src: `${ALLAH_AUDIO_ROOT}/key-unlock-v2.mp3`, volume: .24 },
  coin: { src: `${ALLAH_AUDIO_ROOT}/coin-flight-v2.mp3`, volume: .16 },
  cascade: { src: `${ALLAH_AUDIO_ROOT}/mystery-reveal-v2.mp3`, volume: .13 },
  scatter: { src: `${ALLAH_AUDIO_ROOT}/big-win-v2.mp3`, volume: .2 },
  multiplier: { src: `${ALLAH_AUDIO_ROOT}/multiplier-v2.mp3`, volume: .2 },
  multiplierCollect: { src: `${ALLAH_AUDIO_ROOT}/coin-flight-v2.mp3`, volume: .16 },
  multiplierImpact: { src: `${ALLAH_AUDIO_ROOT}/multiplier-v2.mp3`, volume: .2 },
  collector: { src: `${ALLAH_AUDIO_ROOT}/collector-v2.mp3`, volume: .23 },
  win: { src: `${ALLAH_AUDIO_ROOT}/win-v2.mp3`, volume: .2 },
  bigWin: { src: `${ALLAH_AUDIO_ROOT}/big-win-v2.mp3`, volume: .25 },
  winTier: { src: `${ALLAH_AUDIO_ROOT}/big-win-v2.mp3`, volume: .26 },
}

const BAYKUS_MINE_AUDIO_ROOT = '/assets/instant/obsidyen-damari/audio'
const BAYKUS_ORIGINAL_AUDIO_ROOT = '/assets/instant/originals/audio'
const BAYKUS_PRESENTATION_AUDIO_ROOT = '/assets/slots/baykus-madeni/audio'
const BAYKUS_AUDIO_ASSETS: Partial<Record<AudioMode, { src: string; volume: number }>> = {
  spin: { src: '/assets/audio/slot-reel-spin.mp3', volume: .28 },
  stop: { src: `${BAYKUS_MINE_AUDIO_ROOT}/ui-click.ogg`, volume: .18 },
  button: { src: `${BAYKUS_MINE_AUDIO_ROOT}/ui-click.ogg`, volume: .16 },
  powerLand: { src: `${BAYKUS_MINE_AUDIO_ROOT}/pressure-burst.ogg`, volume: .2 },
  pickaxe: { src: `${BAYKUS_PRESENTATION_AUDIO_ROOT}/pickaxe-impact-a.ogg`, volume: .2 },
  blockBreak: { src: `${BAYKUS_PRESENTATION_AUDIO_ROOT}/pickaxe-impact-b.ogg`, volume: .22 },
  chestLatch: { src: `${BAYKUS_PRESENTATION_AUDIO_ROOT}/chest-latch.ogg`, volume: .19 },
  chestOpen: { src: `${BAYKUS_PRESENTATION_AUDIO_ROOT}/chest-coins.ogg`, volume: .23 },
  bookUpgrade: { src: `${BAYKUS_PRESENTATION_AUDIO_ROOT}/upgrade-book.ogg`, volume: .19 },
  cascade: { src: `${BAYKUS_MINE_AUDIO_ROOT}/tile-crack.ogg`, volume: .22 },
  collector: { src: `${BAYKUS_ORIGINAL_AUDIO_ROOT}/mines-deep-explosion.wav`, volume: .32 },
  mystery: { src: `${BAYKUS_MINE_AUDIO_ROOT}/crystal-reveal.ogg`, volume: .25 },
  eye: { src: `${BAYKUS_MINE_AUDIO_ROOT}/lock.ogg`, volume: .19 },
  coin: { src: `${BAYKUS_ORIGINAL_AUDIO_ROOT}/mines-gem-win.wav`, volume: .2 },
  multiplier: { src: `${BAYKUS_MINE_AUDIO_ROOT}/cashout.ogg`, volume: .22 },
  multiplierImpact: { src: `${BAYKUS_MINE_AUDIO_ROOT}/cashout.ogg`, volume: .28 },
  win: { src: `${BAYKUS_ORIGINAL_AUDIO_ROOT}/mines-gem-win.wav`, volume: .22 },
  bigWin: { src: `${BAYKUS_ORIGINAL_AUDIO_ROOT}/sci-fi-victory.mp3`, volume: .28 },
}

export class SlotAudio {
  private context?: AudioContext
  private spinAudio?: HTMLAudioElement
  private oneShots = new Set<HTMLAudioElement>()
  private spinTimer=0
  enabled = true
  constructor(private game:CasinoGameId){}

  private stopSpin(){
    window.clearTimeout(this.spinTimer)
    this.spinTimer=0
    if(!this.spinAudio)return
    this.spinAudio.pause()
    this.spinAudio.removeAttribute('src')
    this.spinAudio.load()
    this.spinAudio=undefined
  }

  private getContext() {
    this.context ??= new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
    return this.context
  }

  private playAsset(src: string, volume: number, index: number, asSpin = false) {
    if (asSpin) this.stopSpin()
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = gameSfxLevel(this.game, volume)
    audio.playbackRate = Math.max(.88, Math.min(1.18, .96 + index * .025))
    if (asSpin) {
      this.spinAudio = audio
      void audio.play().catch(() => this.stopSpin())
      this.spinTimer = window.setTimeout(() => this.stopSpin(), 1900)
      return
    }
    const release = () => {
      this.oneShots.delete(audio)
      audio.removeAttribute('src')
      audio.load()
    }
    this.oneShots.add(audio)
    audio.addEventListener('ended', release, { once: true })
    void audio.play().catch(release)
  }

  private stopOneShots() {
    for (const audio of this.oneShots) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    this.oneShots.clear()
  }

  play(mode: AudioMode, index = 0) {
    if (!this.enabled||!isGameSfxEnabled(this.game)) return
    if (this.game === 'allahin-lutfu') {
      const asset = ALLAH_AUDIO_ASSETS[mode]
      if (asset) {
        this.playAsset(asset.src, asset.volume, index, mode === 'spin')
        return
      }
    }
    if (this.game === 'baykus-madeni') {
      const asset = BAYKUS_AUDIO_ASSETS[mode]
      if (asset) {
        if (mode === 'stop' && index >= 2) this.stopSpin()
        this.playAsset(asset.src, asset.volume, index, mode === 'spin')
        return
      }
    }
    if (mode === 'spin') {
      this.stopSpin()
      const audio=new Audio('/assets/audio/slot-reel-spin.mp3')
      audio.preload='auto'
      audio.volume=gameSfxLevel(this.game,.34)
      this.spinAudio=audio
      void audio.play().catch(()=>this.stopSpin())
      this.spinTimer=window.setTimeout(()=>this.stopSpin(),1900)
      return
    }

    if(mode==='stop'&&index>=(this.game==='allahin-lutfu'?4:2))this.stopSpin()
    const context = this.getContext()

    const tone = (frequency: number, starts: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = type
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(gameSfxLevel(this.game,volume), context.currentTime + starts)
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + starts + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(context.currentTime + starts)
      oscillator.stop(context.currentTime + starts + duration)
    }

    if (mode === 'stop') tone(150 + index * 38, 0, .13, .12, 'square')
    if (mode === 'button') tone(520, 0, .06, .05, 'triangle')
    if (mode === 'eye') {
      tone(176, 0, .48, .08, 'sine')
      tone(528, .04, .42, .055, 'triangle')
      tone(1056, .13, .34, .035, 'sine')
    }
    if (mode === 'mystery') {
      tone(212, 0, .36, .06, 'sawtooth')
      tone(848, .08, .31, .05, 'triangle')
    }
    if (mode === 'key') {
      tone(294, 0, .25, .06, 'triangle')
      tone(587, .07, .32, .06, 'sine')
      tone(1175, .15, .42, .045, 'sine')
    }
    if (mode === 'coin') tone(720 + index * 42, 0, .2, .045, 'triangle')
    if (mode === 'collector') {
      tone(72, 0, .58, .13, 'square')
      tone(440, .05, .34, .07, 'triangle')
    }
    if (mode === 'cascade') {
      ;[780, 620, 420, 260].forEach((frequency, noteIndex) => tone(frequency, noteIndex * .025, .14, .045, 'sawtooth'))
    }
    if (mode === 'scatter') {
      ;[330, 494, 659, 988].forEach((frequency, noteIndex) => tone(frequency, noteIndex * .13, .42, .075, 'triangle'))
    }
    if (mode === 'powerLand') {
      // Short electric signature: audible the instant a power orb enters from
      // the initial feed or from any later tumble.
      tone(118 + index * 9, 0, .2, .09, 'sawtooth')
      tone(690 + index * 36, .035, .16, .075, 'triangle')
      tone(1380 + index * 42, .08, .11, .045, 'sine')
    }
    if (mode === 'multiplierCollect') {
      const lift = index * 74
      tone(310 + lift, 0, .25, .08, 'triangle')
      tone(620 + lift, .08, .3, .07, 'sine')
    }
    if (mode === 'multiplierImpact') {
      const lift = index * 18
      tone(68 + lift, 0, .62, .16, 'square')
      ;[392, 587, 784, 1175].forEach((frequency, noteIndex) => tone(frequency + lift, .05 + noteIndex * .075, .38, .09, noteIndex < 2 ? 'sawtooth' : 'triangle'))
    }
    if (mode === 'multiplier') {
      const lift = index * 34
      ;[170, 340, 680, 1020].forEach((frequency, noteIndex) => tone(frequency + lift, noteIndex * .055, .28 + index * .012, .065 + index * .004, noteIndex < 2 ? 'sawtooth' : 'triangle'))
      tone(72 + index * 9, 0, .46, .11, 'square')
    }
    if (mode === 'win' || mode === 'bigWin') {
      const notes = mode === 'bigWin' ? [392, 523, 659, 784, 1047] : [392, 494, 659]
      notes.forEach((note, noteIndex) => tone(note, noteIndex * .1, .32, .075, 'triangle'))
    }
    if (mode === 'winTier') {
      const tier = Math.max(0, Math.min(4, index))
      const notes = [262, 330, 392, 523, 659, 784, 1047]
      notes.slice(0, 3 + tier).forEach((note, noteIndex) => tone(note * (1 + tier * .025), noteIndex * .085, .5 + tier * .06, .07 + tier * .012, noteIndex % 2 ? 'triangle' : 'sawtooth'))
      tone(58 + tier * 8, 0, .9, .12 + tier * .018, 'square')
      tone(1318 + tier * 150, .22, .7, .05 + tier * .01, 'sine')
    }
  }

  dispose() {
    this.stopSpin()
    this.stopOneShots()
    void this.context?.close()
    this.context = undefined
  }
}
