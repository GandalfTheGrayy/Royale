import { describe, expect, it } from 'vitest'
import { aggregateCasinoRounds, clearCasinoResearchData, getAIConversations, getCasinoStorageStats, recordAIConversation, type CasinoRoundRecord } from './casino-database'

const round = (overrides: Partial<CasinoRoundRecord>): CasinoRoundRecord => ({
  id: crypto.randomUUID(), roundId: crypto.randomUUID(), game: 'roulette', variant: 'test', source: 'player', playerParticipated: true,
  startedAt: '2026-01-01T00:00:00.000Z', settledAt: '2026-01-01T00:00:30.000Z', stake: 100, grossPayout: 0, net: -100,
  outcome: 'loss', result: {}, ...overrides,
})

describe('casino research aggregation', () => {
  it('arka plan rulet turlarını oyuncu RTP ve harcamasına katmaz', () => {
    const summary = aggregateCasinoRounds([
      round({ id: 'live', source: 'live-table', playerParticipated: false, stake: 0, grossPayout: 0, net: 0, outcome: 'watch' }),
      round({ id: 'loss' }),
      round({ id: 'win', game: 'blackjack', stake: 200, grossPayout: 500, net: 300, outcome: 'win' }),
    ])
    expect(summary.rounds).toBe(3)
    expect(summary.liveRounds).toBe(1)
    expect(summary.playedRounds).toBe(2)
    expect(summary.totalStake).toBe(300)
    expect(summary.totalPayout).toBe(500)
    expect(summary.net).toBe(200)
    expect(summary.rtp).toBeCloseTo(5 / 3)
  })

  it('AI konuşmasını bağlamı ve gecikmesiyle araştırma deposuna yazar', async () => {
    await clearCasinoResearchData()
    await recordAIConversation({
      id: 'ai-test', sessionId: 'session-test', game: 'neon-kasasi', character: 'Mira', speaker: 'assistant',
      occurredAt: '2026-01-01T00:00:01.000Z', text: 'Bonus kasası tamamlandı.', context: { wager: 100, freeSpins: 0 }, model: 'local-ai', latencyMs: 412,
    })
    const conversations = await getAIConversations()
    const storage = await getCasinoStorageStats()
    expect(conversations).toHaveLength(1)
    expect(conversations[0]).toMatchObject({ character: 'Mira', speaker: 'assistant', latencyMs: 412 })
    expect(storage.conversationsBytes).toBeGreaterThan(50)
    expect(storage.totalBytes).toBeGreaterThanOrEqual(storage.conversationsBytes)
  })
})
