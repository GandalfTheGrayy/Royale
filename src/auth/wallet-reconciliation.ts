// Preserve local wagers/payouts still awaiting acknowledgement while applying
// authoritative changes from administrators or another device exactly once.
export function reconcileWalletBalance(local: number, previousServer: number, nextServer: number, acknowledgedDelta: number) {
  return local + (nextServer - previousServer) - acknowledgedDelta;
}
