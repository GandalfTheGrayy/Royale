import { describe,expect,it } from 'vitest'
import { MINES_RTP,batchMultiplier,batchWinProbability,createMinesBatchRound,normalizeSelectedIndices,verifyMinesBatchRound } from './mines-original-engine'

const seed='abcdef0123456789'.repeat(4)
const create=(selectedIndices:number[],mineCount=3,nonce=7)=>createMinesBatchRound({stake:10,mineCount,selectedIndices,clientSeed:'fixed-picks',nonce,serverSeed:seed,now:`2026-09-02T12:00:${String(nonce).padStart(2,'0')}.000Z`})

describe('Sabit seçimli Mines matematiği',()=>{
  it('3 mayında 1–5 sabit seçim için %99 kombinasyon çarpanlarını verir',()=>{
    expect([1,2,3,4,5].map((picks)=>batchMultiplier(3,picks))).toEqual([1.12,1.28,1.47,1.71,1.99])
  })
  it('1–24 mayın ve tüm mümkün seçim adetlerini gerçek olasılıkla doğrular',()=>{
    for(let mines=1;mines<=24;mines+=1)for(let picks=1;picks<=25-mines;picks+=1){
      const shown=batchMultiplier(mines,picks);const raw=(MINES_RTP/100)/batchWinProbability(mines,picks)
      expect(shown).toBeLessThanOrEqual(raw+1e-9);expect(raw-shown).toBeLessThan(.0100001)
    }
  })
})

describe('Sabit seçimli toplu BET akışı',()=>{
  it('seçimleri benzersizleştirir, sıralar ve güvenli kapasiteyle sınırlar',()=>{
    expect(normalizeSelectedIndices([5,2,5,-1,30,1],3)).toEqual([1,2,5])
    expect(normalizeSelectedIndices([0,1,2,3],24)).toEqual([0])
  })
  it('BET anında yalnız seçilmiş karelerin tamamını tek sonuçta çözer',async()=>{
    const round=await create([1,4,8])
    expect(round.selectedIndices).toEqual([1,4,8]);expect(round.gemCount+round.hitMines.length).toBe(3);expect(['won','lost']).toContain(round.phase)
  })
  it('seçimlerden herhangi biri mayınsa bütün bahis kaybedilir',async()=>{
    const probe=await create([0]);const mine=probe.mineIndices[0];const round=await create([mine, ...[0,1,2].filter((index)=>index!==mine).slice(0,2)])
    expect(round.hitMines).toContain(mine);expect(round.phase).toBe('lost');expect(round.grossPayout).toBe(0)
  })
  it('seçimlerin tamamı gem ise tek seferde çarpan ödemesi verir',async()=>{
    const probe=await create([0]);const safe=Array.from({length:25},(_,index)=>index).filter((index)=>!probe.mineIndices.includes(index)).slice(0,3);const round=await create(safe)
    expect(round.phase).toBe('won');expect(round.hitMines).toEqual([]);expect(round.gemCount).toBe(3);expect(round.multiplier).toBe(1.47);expect(round.grossPayout).toBe(14.7)
  })
  it('aynı sabit seçim seti farklı bahislerde korunabilir, sonuç nonce ile yeniden dağıtılır',async()=>{
    const selected=[2,7,18];const first=await create(selected,3,7);const next=await create(selected,3,8)
    expect(next.selectedIndices).toEqual(first.selectedIndices);expect(next.roundId).not.toBe(first.roundId);expect(next.digest).not.toBe(first.digest)
  })
  it('aynı seed, nonce ve seçimler aynı toplu sonucu üretir ve doğrulanır',async()=>{
    const first=await create([3,9,14,20],5);const replay=await create([3,9,14,20],5)
    expect(replay.mineIndices).toEqual(first.mineIndices);expect(replay.phase).toBe(first.phase);expect(await verifyMinesBatchRound(first)).toBe(true)
  })
  it('boş seçimle bahis başlatmaz',async()=>{await expect(create([])).rejects.toThrow('En az bir kare')})
})
