import { bytesToHex, hmacBytes, secureSeed, sha256, shuffledRange } from '../originals/fair-rng'

export const MINES_BOARD_SIZE = 25
export const MINES_RTP = 99

export type MinesBatchRound = {
  algorithm: 'casino-mines-fixed-picks-hmac-sha256-v3'
  roundId: string
  phase: 'won' | 'lost'
  startedAt: string
  settledAt: string
  stake: number
  rtp: number
  mineCount: number
  selectedIndices: number[]
  mineIndices: number[]
  boardOrder: number[]
  hitMines: number[]
  gemCount: number
  multiplier: number
  grossPayout: number
  clientSeed: string
  nonce: number
  serverSeed: string
  commitment: string
  digest: string
}

export type CreateMinesBatchRoundOptions = {
  stake: number
  mineCount: number
  selectedIndices: number[]
  clientSeed: string
  nonce: number
  rtp?: number
  serverSeed?: string
  now?: string
}

export function combination(n:number,k:number) {
  if(!Number.isInteger(n)||!Number.isInteger(k)||n<0||k<0||k>n)return 0
  const steps=Math.min(k,n-k);let result=1
  for(let index=1;index<=steps;index+=1)result=(result*(n-steps+index))/index
  return result
}

export function batchWinProbability(mineCount:number,pickCount:number) {
  if(pickCount<=0)return 0
  const safeTiles=MINES_BOARD_SIZE-mineCount
  if(pickCount>safeTiles)return 0
  return combination(safeTiles,pickCount)/combination(MINES_BOARD_SIZE,pickCount)
}

export function rawBatchMultiplier(mineCount:number,pickCount:number,rtp=MINES_RTP) {
  const probability=batchWinProbability(mineCount,pickCount)
  return probability>0?(rtp/100)/probability:0
}

export function batchMultiplier(mineCount:number,pickCount:number,rtp=MINES_RTP) {
  return Math.floor((rawBatchMultiplier(mineCount,pickCount,rtp)+1e-10)*100)/100
}

export function roundMoney(value:number) {
  return Math.round((value+Number.EPSILON)*100)/100
}

export function normalizeSelectedIndices(indices:number[],mineCount:number) {
  const maxPicks=MINES_BOARD_SIZE-Math.min(24,Math.max(1,Math.round(mineCount)))
  return [...new Set(indices.filter((index)=>Number.isInteger(index)&&index>=0&&index<MINES_BOARD_SIZE))].slice(0,maxPicks).sort((a,b)=>a-b)
}

export async function createMinesBatchRound(options:CreateMinesBatchRoundOptions):Promise<MinesBatchRound> {
  const mineCount=Math.min(24,Math.max(1,Math.round(options.mineCount)))
  const selectedIndices=normalizeSelectedIndices(options.selectedIndices,mineCount)
  if(selectedIndices.length<1)throw new Error('En az bir kare seçilmelidir.')
  const stake=roundMoney(Math.max(0,options.stake));const rtp=Math.min(100,Math.max(1,options.rtp??MINES_RTP))
  const serverSeed=options.serverSeed??secureSeed();const startedAt=options.now??new Date().toISOString()
  const message=`casino-mines-fixed-v3:${options.clientSeed}:${options.nonce}:5x5:${mineCount}`
  const boardOrder=await shuffledRange(MINES_BOARD_SIZE,serverSeed,message)
  const mineIndices=boardOrder.slice(0,mineCount).sort((a,b)=>a-b)
  const mineSet=new Set(mineIndices);const hitMines=selectedIndices.filter((index)=>mineSet.has(index))
  const won=hitMines.length===0;const multiplier=batchMultiplier(mineCount,selectedIndices.length,rtp)
  const grossPayout=won?roundMoney(stake*multiplier):0
  return {algorithm:'casino-mines-fixed-picks-hmac-sha256-v3',roundId:`mines-${options.nonce}-${Date.parse(startedAt)||Date.now()}`,phase:won?'won':'lost',startedAt,settledAt:startedAt,stake,rtp,mineCount,selectedIndices,mineIndices,boardOrder,hitMines,gemCount:selectedIndices.length-hitMines.length,multiplier,grossPayout,clientSeed:options.clientSeed,nonce:options.nonce,serverSeed,commitment:await sha256(serverSeed),digest:bytesToHex(await hmacBytes(serverSeed,message))}
}

export async function verifyMinesBatchRound(round:MinesBatchRound) {
  if(await sha256(round.serverSeed)!==round.commitment)return false
  const replay=await createMinesBatchRound({stake:round.stake,mineCount:round.mineCount,selectedIndices:round.selectedIndices,clientSeed:round.clientSeed,nonce:round.nonce,rtp:round.rtp,serverSeed:round.serverSeed,now:round.startedAt})
  return replay.digest===round.digest&&replay.boardOrder.join(',')===round.boardOrder.join(',')&&replay.mineIndices.join(',')===round.mineIndices.join(',')&&replay.hitMines.join(',')===round.hitMines.join(',')&&replay.grossPayout===round.grossPayout
}
