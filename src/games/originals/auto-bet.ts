export type AutoBetLimits={rounds:number;stopProfit:number;stopLoss:number}

export function normalizeAutoRounds(value:number){return Math.min(1000,Math.max(1,Math.round(Number.isFinite(value)?value:1)))}
export function normalizeAutoLimit(value:number){return Math.max(0,Math.round((Number.isFinite(value)?value:0)*100)/100)}
export function shouldStopAutoBet(played:number,profit:number,limits:AutoBetLimits){
  if(played>=normalizeAutoRounds(limits.rounds))return 'rounds' as const
  if(limits.stopProfit>0&&profit>=normalizeAutoLimit(limits.stopProfit))return 'profit' as const
  if(limits.stopLoss>0&&profit<=-normalizeAutoLimit(limits.stopLoss))return 'loss' as const
  return false as const
}
