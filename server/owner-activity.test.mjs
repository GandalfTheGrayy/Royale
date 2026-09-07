import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { getOwnerActivity } from './owner-activity.mjs';

it('isolates users and periods, ignores spectator rounds and bounds details', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE users(id TEXT,display_name TEXT,username_display TEXT,last_seen_at TEXT);
      CREATE TABLE wallets(user_id TEXT,balance_micro INTEGER);
      CREATE TABLE game_rounds(id TEXT,user_id TEXT,game TEXT,player_participated INTEGER,settled_at TEXT,stake REAL,gross_payout REAL,net REAL,outcome TEXT);
      CREATE TABLE wallet_ledger_v2(id TEXT,user_id TEXT,game TEXT,type TEXT,reason TEXT,occurred_at TEXT,amount_micro INTEGER,balance_after_micro INTEGER);
      INSERT INTO users VALUES('a','A','a',''),('b','B','b','');
      INSERT INTO wallets VALUES('a',150000000),('b',500000000);`);
    const insert = db.prepare('INSERT INTO game_rounds VALUES(?,?,?,?,?,?,?,?,?)');
    const now = new Date().toISOString();
    for (let i = 0; i < 45; i++) insert.run(String(i),'a','baykus-madeni',1,now,10,15,5,'win');
    insert.run('other','b','roulette',1,now,100,999,899,'win');
    insert.run('spectator','a','roulette',0,now,100,999,899,'win');
    insert.run('old','a','roulette',1,'2020-01-01',100,999,899,'win');
    const report = getOwnerActivity(db,new URLSearchParams('user=a&days=7'));
    expect(report.games).toEqual([{ game:'baykus-madeni',rounds:45,stake:450,payout:675,net:225 }]);
    expect(report.rounds).toHaveLength(40);
    expect(report.users[0].balanceMicro).toBe('150000000');
    expect(getOwnerActivity(db,new URLSearchParams('user=missing')).rounds).toEqual([]);
    expect(getOwnerActivity(db,new URLSearchParams('days=999&page=NaN')).days).toBe(7);
  } finally { db.close(); }
});
