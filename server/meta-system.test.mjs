import { beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { classifyWalletTransaction, getMetaStats, initializeMetaSystem, normalizeSettlement, processRoundSettlement, rebuildMetaSystem } from './meta-system.mjs'

function databaseFixture() {
  const database = new DatabaseSync(':memory:')
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE wallets(user_id TEXT PRIMARY KEY REFERENCES users(id), balance_micro INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE wallet_ledger_v2(
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),round_id TEXT,game TEXT,actor_user_id TEXT,
      type TEXT NOT NULL,amount_micro INTEGER NOT NULL,balance_before_micro INTEGER NOT NULL,balance_after_micro INTEGER NOT NULL,
      idempotency_key TEXT UNIQUE NOT NULL,reason TEXT NOT NULL,occurred_at TEXT NOT NULL
    );
    CREATE TABLE schema_info(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT INTO users(id) VALUES('muharrem');
    INSERT INTO wallets(user_id,balance_micro,updated_at) VALUES('muharrem',100000000000,'2026-01-01T00:00:00.000Z');
  `)
  initializeMetaSystem(database)
  return database
}

function round(overrides = {}) {
  return {
    id: 'round:r-1', roundId: 'r-1', userId: 'muharrem', game: 'kaptan-mercan', source: 'player',
    playerParticipated: true, settledAt: '2026-01-01T00:01:00.000Z', stake: 100, grossPayout: 250,
    outcome: 'win', result: { moneyFishValues: [2, 25], captainCount: 1 }, modifiers: {}, ...overrides,
  }
}

describe('casino meta foundation', () => {
  let database
  beforeEach(() => { database = databaseFixture() })

  it('PR wallet hareketlerini rekabet amacına göre sınıflandırır', () => {
    expect(classifyWalletTransaction('stake')).toMatchObject({ sourceType: 'GAME_WAGER', competitiveEligible: true })
    expect(classifyWalletTransaction('admin_credit')).toMatchObject({ sourceType: 'ADMIN_GRANT', competitiveEligible: false, wealthEligible: false })
    expect(classifyWalletTransaction('approval_credit')).toMatchObject({ sourceType: 'STARTING_BALANCE', competitiveEligible: false, wealthEligible: true })
  })

  it('client net alanına güvenmeyip payout eksi wager hesaplar', () => {
    const settlement = normalizeSettlement(round({ net: 999999 }))
    expect(settlement.netMicro).toBe(150_000_000)
    expect(settlement.metadata.fishMultiplier).toBe(25)
  })

  it('aynı round yeniden gelince aggregate değerlerini iki kez artırmaz', () => {
    expect(processRoundSettlement(database, round()).inserted).toBe(true)
    expect(processRoundSettlement(database, round({ id: 'different-client-record' })).inserted).toBe(false)
    const stats = getMetaStats(database, 'muharrem')
    const casino = stats.aggregates.find((item) => item.scopeType === 'casino')
    expect(casino).toMatchObject({ rounds: 1, wager: 100, payout: 250, netProfit: 150 })
  })

  it('izleyici, test ve iptal sonuçlarını geçmişte tutup rekabetten çıkarır', () => {
    const test = processRoundSettlement(database, round({ id: 'test', roundId: 'test', variant: 'simulation test' }))
    const watch = processRoundSettlement(database, round({ id: 'watch', roundId: 'watch', source: 'live-table', playerParticipated: false, outcome: 'watch' }))
    expect(test.settlement.competitiveEligible).toBe(false)
    expect(watch.settlement.competitiveEligible).toBe(false)
    expect(database.prepare('SELECT COUNT(*) count FROM meta_round_settlements').get().count).toBe(2)
    expect(database.prepare('SELECT COUNT(*) count FROM game_stat_aggregates').get().count).toBe(0)
  })

  it('admin grant rekabet bakiyesini değiştirmez, oyun hareketi değiştirir', () => {
    const insert = database.prepare(`INSERT INTO wallet_ledger_v2(id,user_id,type,amount_micro,balance_before_micro,balance_after_micro,idempotency_key,reason,occurred_at)
      VALUES(?,?,?,?,?,?,?,?,?)`)
    insert.run('admin','muharrem','admin_credit',50_000_000_000,100_000_000_000,150_000_000_000,'admin','grant','2026-01-01T00:01:00.000Z')
    insert.run('stake','muharrem','stake',-10_000_000,150_000_000_000,149_990_000_000,'stake','wager','2026-01-01T00:02:00.000Z')
    const account = getMetaStats(database, 'muharrem').account
    expect(account.competitiveBalance).toBe(99_990)
    expect(database.prepare("SELECT source_type,competitive_eligible FROM wallet_ledger_v2 WHERE id='admin'").get()).toMatchObject({ source_type: 'ADMIN_GRANT', competitive_eligible: 0 })
  })

  it('ham round geçmişinden deterministik olarak yeniden hesaplanabilir', () => {
    database.exec(`CREATE TABLE game_rounds(id TEXT PRIMARY KEY,user_id TEXT,payload_json TEXT NOT NULL,settled_at TEXT NOT NULL)`)
    const payload = round()
    database.prepare('INSERT INTO game_rounds(id,user_id,payload_json,settled_at) VALUES(?,?,?,?)').run(payload.id, payload.userId, JSON.stringify(payload), payload.settledAt)
    expect(rebuildMetaSystem(database)).toBe(1)
    expect(rebuildMetaSystem(database)).toBe(1)
    expect(getMetaStats(database, 'muharrem').aggregates.find((item) => item.scopeType === 'casino')?.rounds).toBe(1)
  })
})
