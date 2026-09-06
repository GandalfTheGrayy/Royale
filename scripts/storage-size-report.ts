import { runNeonSpin } from '../src/games/slots/neon-engine.ts'
import { spinFisher } from '../src/games/slots/fisherman-engine.ts'

function seededRandom(seed: number) {
  let state = seed >>> 0
  const float = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
  return { float, index: (max: number) => Math.floor(float() * max) }
}

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength

function summarize(name: string, values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.floor((sorted.length - 1) * q)]
  return { name, samples: values.length, averageBytes: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), p50Bytes: at(.5), p90Bytes: at(.9), p99Bytes: at(.99), maxBytes: at(1) }
}

const samples = Number(process.argv[2] ?? 10_000)
const neonRandom = seededRandom(0x53514c4e)
const fisherRandom = seededRandom(0x53514c46)
const neon: number[] = []
const fisher: number[] = []

for (let index = 0; index < samples; index += 1) {
  neon.push(bytes(runNeonSpin(1_000, neonRandom.index)))
  fisher.push(bytes(spinFisher(1_000, { random: fisherRandom.float })))
}

console.log(JSON.stringify([summarize('Neon spin telemetry payload', neon), summarize('Kaptan spin telemetry payload', fisher)], null, 2))
