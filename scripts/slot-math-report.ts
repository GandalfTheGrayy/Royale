import { runNeonSpin } from '../src/games/slots/neon-engine.ts'
import { advanceFisherBonus, createFisherBonus, spinFisher } from '../src/games/slots/fisherman-engine.ts'

type Sample = {
  stake: number
  baseWin: number
  bonusWin: number
  totalWin: number
  bonusSpins: number
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  const float = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
  return { float, index: (max: number) => Math.floor(float() * max) }
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))]
}

function maximum(values: number[]) {
  return values.reduce((largest, value) => Math.max(largest, value), 0)
}

function longestRun(values: boolean[]) {
  let longest = 0
  let current = 0
  values.forEach((value) => {
    current = value ? current + 1 : 0
    longest = Math.max(longest, current)
  })
  return longest
}

function summarize(name: string, samples: Sample[]) {
  const stake = samples.reduce((sum, sample) => sum + sample.stake, 0)
  const base = samples.reduce((sum, sample) => sum + sample.baseWin, 0)
  const bonus = samples.reduce((sum, sample) => sum + sample.bonusWin, 0)
  const total = base + bonus
  const baseMultiples = samples.filter((sample) => sample.baseWin > 0).map((sample) => sample.baseWin / sample.stake)
  const totalMultiples = samples.filter((sample) => sample.totalWin > 0).map((sample) => sample.totalWin / sample.stake)
  const featureMultiples = samples.filter((sample) => sample.bonusSpins > 0).map((sample) => sample.bonusWin / sample.stake)
  const featureCount = featureMultiples.length
  return {
    name,
    rounds: samples.length,
    observedRtp: total / stake,
    baseRtp: base / stake,
    bonusRtp: bonus / stake,
    baseHitRate: samples.filter((sample) => sample.baseWin > 0).length / samples.length,
    baseProfitRate: samples.filter((sample) => sample.baseWin > sample.stake).length / samples.length,
    baseStakeReturnRate: samples.filter((sample) => sample.baseWin >= sample.stake).length / samples.length,
    totalProfitRate: samples.filter((sample) => sample.totalWin > sample.stake).length / samples.length,
    blankRate: samples.filter((sample) => sample.baseWin === 0).length / samples.length,
    longestBlankStreak: longestRun(samples.map((sample) => sample.baseWin === 0)),
    longestBelowStakeStreak: longestRun(samples.map((sample) => sample.baseWin < sample.stake)),
    naturalFeatureRate: featureCount / samples.length,
    featureFrequency: featureCount ? samples.length / featureCount : 0,
    averageFeatureSpins: featureCount ? samples.reduce((sum, sample) => sum + sample.bonusSpins, 0) / featureCount : 0,
    baseWinMultiple: {
      median: quantile(baseMultiples, .5), p90: quantile(baseMultiples, .9), p99: quantile(baseMultiples, .99), max: maximum(baseMultiples),
    },
    totalWinMultiple: {
      median: quantile(totalMultiples, .5), p90: quantile(totalMultiples, .9), p99: quantile(totalMultiples, .99), max: maximum(totalMultiples),
    },
    featureWinMultiple: {
      median: quantile(featureMultiples, .5), p75: quantile(featureMultiples, .75), p90: quantile(featureMultiples, .9), p99: quantile(featureMultiples, .99), max: maximum(featureMultiples),
      zeroRate: featureCount ? featureMultiples.filter((value) => value === 0).length / featureCount : 0,
      under10xRate: featureCount ? featureMultiples.filter((value) => value < 10).length / featureCount : 0,
    },
  }
}

function simulateNeon(rounds: number, seed: number): Sample[] {
  const wager = 1_000
  const random = seededRandom(seed)
  const samples: Sample[] = []
  for (let round = 0; round < rounds; round += 1) {
    const base = runNeonSpin(wager, random.index)
    let remaining = base.freeSpinsAwarded
    let bonusMultiplier = 0
    let bonusWin = 0
    let bonusSpins = 0
    while (remaining > 0 && bonusSpins < 500) {
      remaining -= 1
      bonusSpins += 1
      const spin = runNeonSpin(wager, random.index, { bonusMode: true, bonusMultiplier })
      bonusMultiplier = spin.finalBonusMultiplier
      bonusWin += spin.grossReturn
      remaining += spin.freeSpinsAwarded
    }
    samples.push({ stake: wager, baseWin: base.grossReturn, bonusWin, totalWin: base.grossReturn + bonusWin, bonusSpins })
  }
  return samples
}

function simulateFisher(rounds: number, seed: number): Sample[] {
  const wager = 1_000
  const random = seededRandom(seed)
  const samples: Sample[] = []
  for (let round = 0; round < rounds; round += 1) {
    const base = spinFisher(wager, { random: random.float })
    let bonusWin = 0
    let bonusSpins = 0
    if (base.bonusSpins > 0) {
      let state = createFisherBonus(`sim-${round}`, base.bonusSpins, 'natural')
      while (state.spinsRemaining > 0 && bonusSpins < 500) {
        const spin = spinFisher(wager, { bonus: true, bonusMultiplier: state.multiplier, random: random.float })
        bonusWin += spin.grossPayout
        bonusSpins += 1
        state = advanceFisherBonus(state, spin).state
      }
    }
    samples.push({ stake: wager, baseWin: base.grossPayout, bonusWin, totalWin: base.grossPayout + bonusWin, bonusSpins })
  }
  return samples
}

const rounds = Number(process.argv[2] ?? 100_000)
const report = [
  summarize('Neon Kasası', simulateNeon(rounds, 0x4e454f4e)),
  summarize('Kaptan Mercan', simulateFisher(rounds, 0x4d455243)),
]

console.log(JSON.stringify(report, null, 2))
