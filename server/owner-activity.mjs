// Only called after the owner/admin authorization gate. Bound every detail list.
export function getOwnerActivity(database, params) {
  const days = [1, 7, 30].includes(Number(params.get('days'))) ? Number(params.get('days')) : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const userId = (params.get('user') ?? '').slice(0, 100);
  const page = Math.min(10000, Math.max(0, Math.floor(Number(params.get('page')) || 0)));
  const users = database.prepare(`SELECT u.id,u.display_name name,u.username_display username,u.last_seen_at lastSeenAt,
    CAST(w.balance_micro AS TEXT) balanceMicro FROM users u LEFT JOIN wallets w ON w.user_id=u.id
    ORDER BY u.display_name,u.id LIMIT 51 OFFSET ?`).all(page * 50);
  const selected = userId || users[0]?.id;
  const games = selected ? database.prepare(`SELECT game,COUNT(*) rounds,COALESCE(SUM(stake),0) stake,
    COALESCE(SUM(gross_payout),0) payout,COALESCE(SUM(net),0) net
    FROM game_rounds WHERE user_id=? AND player_participated=1 AND settled_at>=? GROUP BY game`).all(selected, since) : [];
  const rounds = selected ? database.prepare(`SELECT id,game,settled_at time,stake,gross_payout payout,net,outcome
    FROM game_rounds WHERE user_id=? AND player_participated=1 AND settled_at>=?
    ORDER BY settled_at DESC LIMIT 40`).all(selected, since) : [];
  const movements = selected ? database.prepare(`SELECT id,game,type,reason,occurred_at time,
    CAST(amount_micro AS TEXT) amountMicro,CAST(balance_after_micro AS TEXT) balanceMicro
    FROM wallet_ledger_v2 WHERE user_id=? AND occurred_at>=? ORDER BY occurred_at DESC LIMIT 40`).all(selected, since) : [];
  return { generatedAt: new Date().toISOString(), days, selected, hasMore: users.length > 50,
    users: users.slice(0, 50), games, rounds, movements };
}
