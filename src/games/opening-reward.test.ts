import { expect, it } from 'vitest';
import { openingReward } from './wagering';
import { settleBets, outsideBets } from './roulette/roulette-engine';

it('rewards net wins only, bounds invalid configuration, and rounds currency', () => {
  expect(openingReward(200, 100, .15)).toBe(15);
  expect(openingReward(100, 100, .15)).toBe(0);
  expect(openingReward(0, 100, .15)).toBe(0);
  expect(openingReward(200, 100, NaN)).toBe(0);
  expect(openingReward(200, 100, 10)).toBe(25);
});

it('roulette settles the promotional credit in both gross and net', () => {
  const red = outsideBets.find(b => b.numbers.includes(1) && !b.numbers.includes(2))!;
  const bets = [{ definition: red, chips: [100] }];
  const normal = settleBets(bets, 1);
  const opening = settleBets(bets, 1, [], .15);
  expect(opening.grossReturn).toBe(normal.grossReturn + opening.openingBonus);
  expect(opening.net).toBe(opening.grossReturn - 100);
  expect(opening.openingBonus).toBeGreaterThan(0);
});
