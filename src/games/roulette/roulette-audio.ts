import { gameSfxLevel, isGameSfxEnabled } from '../../audio/user-sfx-preferences'
import { playGameSfx } from '../../audio/game-sfx'

export type RouletteAudioSettings = {
  effects: boolean
  ambience: boolean
}

type SoundName = 'chip' | 'chipRattle' | 'chipSweep' | 'chipWin' | 'coin' | 'spin' | 'ball' | 'payout'

const soundFiles: Record<SoundName, string> = {
  chip: '/assets/audio/chip-lay.ogg',
  chipRattle: '/assets/audio/roulette-chip-rattle.ogg',
  chipSweep: '/assets/audio/roulette-chip-sweep.ogg',
  chipWin: '/assets/audio/roulette-chip-win.ogg',
  coin: '/assets/audio/roulette-coin-drop.ogg',
  spin: '/assets/audio/roulette-spin.ogg',
  ball: '/assets/audio/roulette-ball.ogg',
  payout: '/assets/audio/roulette-payout.ogg',
}

export class RouletteAudio {
  private context?: AudioContext
  private ambienceGain?: GainNode
  private ambienceNodes: OscillatorNode[] = []
  private ballTimers: number[] = []
  private settings: RouletteAudioSettings = { effects: true, ambience: true }

  preload() {
    Object.values(soundFiles).forEach((source) => {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = source
    })
  }

  setSettings(settings: RouletteAudioSettings) {
    this.settings = settings
    if (settings.ambience) this.startAmbience()
    else this.stopAmbience()
  }

  async unlock() {
    const context = this.getContext()
    if (context.state === 'suspended') await context.resume().catch(() => undefined)
    if (this.settings.ambience) this.startAmbience()
  }

  play(name: SoundName, volume = .5, rate = 1) {
    if (!this.settings.effects) return
    playGameSfx('roulette',soundFiles[name],volume,rate)
  }

  countdown(urgent = false) {
    if (!this.settings.effects) return
    this.tone(urgent ? 740 : 520, urgent ? .055 : .035, urgent ? .09 : .06, 'sine')
  }

  betsClosed() {
    if (!this.settings.effects) return
    this.tone(260, .16, .1, 'triangle', 110)
    window.setTimeout(() => this.tone(165, .22, .1, 'triangle', 80), 120)
  }

  surge() {
    if (!this.settings.effects) return
    ;[110, 165, 247, 370].forEach((frequency, index) => window.setTimeout(() => {
      this.tone(frequency, .38, .07, index % 2 ? 'sawtooth' : 'triangle', frequency * 2.2)
    }, index * 85))
  }

  startBallRun() {
    this.stopBallRun()
    if (!this.settings.effects) return
    const gaps = [0, 150, 290, 425, 555, 680, 800, 920, 1045, 1180, 1330, 1500, 1700, 1930]
    gaps.forEach((delay, index) => {
      const timer = window.setTimeout(() => {
        this.play('ball', Math.min(.62, .27 + index * .022), .86 + index * .018)
      }, delay)
      this.ballTimers.push(timer)
    })
  }

  stopBallRun() {
    this.ballTimers.forEach((timer) => window.clearTimeout(timer))
    this.ballTimers = []
  }

  win(big = false) {
    this.play('chipWin', .6)
    window.setTimeout(() => this.play('payout', .72), 110)
    window.setTimeout(() => this.play('coin', big ? .72 : .48, big ? .88 : 1.05), 230)
    if (big) [523, 659, 784, 1046].forEach((frequency, index) => window.setTimeout(() => this.tone(frequency, .22, .075, 'triangle'), 260 + index * 105))
  }

  loss() {
    this.play('chipSweep', .42, .9)
  }

  zero() {
    this.tone(82, .52, .12, 'sawtooth', 46)
  }

  dispose() {
    this.settings={effects:false,ambience:false}
    this.stopBallRun()
    this.stopAmbience()
    if (this.context && this.context.state !== 'closed') void this.context.close()
    this.context = undefined
  }

  private getContext() {
    if (!this.context) this.context = new AudioContext()
    return this.context
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType, endFrequency = frequency) {
    if (!this.settings.effects||!isGameSfxEnabled('roulette')) return
    const context = this.getContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration)
    gain.gain.setValueAtTime(.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,gameSfxLevel('roulette',volume)), now + .015)
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + duration + .03)
  }

  private startAmbience() {
    if (!this.settings.ambience || this.ambienceNodes.length||!isGameSfxEnabled('roulette')) return
    const context = this.getContext()
    const gain = context.createGain()
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 380
    gain.gain.value = gameSfxLevel('roulette',.007)
    filter.connect(gain).connect(context.destination)
    ;[55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      oscillator.detune.value = index * 4 - 3
      oscillator.connect(filter)
      oscillator.start()
      this.ambienceNodes.push(oscillator)
    })
    this.ambienceGain = gain
  }

  private stopAmbience() {
    this.ambienceNodes.forEach((node) => {
      try { node.stop() } catch { /* already stopped */ }
      node.disconnect()
    })
    this.ambienceNodes = []
    this.ambienceGain?.disconnect()
    this.ambienceGain = undefined
  }
}
