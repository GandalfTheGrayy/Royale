import { runNeonSpin } from '../src/games/slots/neon-engine.ts'
import { advanceFisherBonus, createFisherBonus, spinFisher } from '../src/games/slots/fisherman-engine.ts'

function seededRandom(seed: number) {
  let state = seed >>> 0
  const float = () => { state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0; return state / 4_294_967_296 }
  return { float, index: (max: number) => Math.floor(float() * max) }
}

const rounds = Number(process.argv[2] ?? 500_000)
const wager = 1_000

function neonReport() {
  const random = seededRandom(0x4e434d50)
  let baseSymbol = 0; let basePower = 0; let bonusSymbol = 0; let bonusPower = 0; let features = 0; let bonusSpins = 0
  for (let round = 0; round < rounds; round += 1) {
    const base = runNeonSpin(wager, random.index)
    baseSymbol += base.baseReturn; basePower += base.grossReturn - base.baseReturn
    let remaining = base.freeSpinsAwarded; let multiplier = 0
    if (remaining) features += 1
    while (remaining > 0 && bonusSpins < rounds * 100) {
      remaining -= 1; bonusSpins += 1
      const spin = runNeonSpin(wager, random.index, { bonusMode: true, bonusMultiplier: multiplier })
      multiplier = spin.finalBonusMultiplier
      bonusSymbol += spin.baseReturn; bonusPower += spin.grossReturn - spin.baseReturn
      remaining += spin.freeSpinsAwarded
    }
  }
  const exposure = rounds * wager
  return { game: 'Neon Kasası', rounds, featureFrequency: features ? rounds / features : 0, bonusSpins, rtp: { baseSymbol: baseSymbol / exposure, basePower: basePower / exposure, bonusSymbol: bonusSymbol / exposure, bonusPower: bonusPower / exposure, total: (baseSymbol + basePower + bonusSymbol + bonusPower) / exposure } }
}

function fisherReport() {
  const random = seededRandom(0x46434d50)
  let baseLine = 0; let baseScatter = 0; let bonusLine = 0; let bonusScatter = 0; let bonusCollect = 0; let features = 0; let bonusSpins = 0
  for (let round = 0; round < rounds; round += 1) {
    const base = spinFisher(wager, { random: random.float })
    baseLine += base.linePayout; baseScatter += base.scatterPayout
    if (!base.bonusSpins) continue
    features += 1
    let state = createFisherBonus(`feature-${round}`, base.bonusSpins, 'natural')
    while (state.spinsRemaining > 0 && bonusSpins < rounds * 100) {
      const spin = spinFisher(wager, { bonus: true, bonusMultiplier: state.multiplier, random: random.float })
      bonusLine += spin.linePayout; bonusScatter += spin.scatterPayout; bonusCollect += wager * spin.collectedFishMultiplier
      bonusSpins += 1; state = advanceFisherBonus(state, spin).state
    }
  }
  const exposure = rounds * wager
  return { game: 'Kaptan Mercan', rounds, featureFrequency: features ? rounds / features : 0, bonusSpins, rtp: { baseLine: baseLine / exposure, baseScatter: baseScatter / exposure, bonusLine: bonusLine / exposure, bonusScatter: bonusScatter / exposure, bonusCollect: bonusCollect / exposure, total: (baseLine + baseScatter + bonusLine + bonusScatter + bonusCollect) / exposure } }
}

console.log(JSON.stringify([neonReport(), fisherReport()], null, 2))
