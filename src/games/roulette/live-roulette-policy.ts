export type LiveRoulettePhase = 'betting' | 'surge' | 'spinning' | 'result'

/**
 * Bets are authored only during `betting`, then submitted on the first closed
 * phase observed by React. `spinning` is a grace window for an already-placed
 * wager; `result` is deliberately too late because the winner is visible.
 */
export function acceptsClosedRouletteTicket(phase: LiveRoulettePhase) {
  return phase === 'surge' || phase === 'spinning'
}
