import { describe, expect, it } from 'vitest'
import { reconcileWalletBalance } from './wallet-reconciliation'

describe('wallet balance reconciliation', () => {
  it('does not apply a local wager twice when the server acknowledges it', () => {
    expect(reconcileWalletBalance(900, 1_000, 900, -100)).toBe(900)
  })

  it('keeps an unacknowledged local wager while applying an admin credit', () => {
    expect(reconcileWalletBalance(900, 1_000, 1_500, 0)).toBe(1_400)
  })

  it('combines an admin credit and the acknowledgement of an in-flight wager', () => {
    expect(reconcileWalletBalance(900, 1_000, 1_400, -100)).toBe(1_400)
  })

  it('does not reset a pending local payout to an older server snapshot', () => {
    expect(reconcileWalletBalance(1_200, 1_000, 1_000, 0)).toBe(1_200)
  })
})
