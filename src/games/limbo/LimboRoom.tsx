import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuth } from '../../auth/auth-client'
import GameMusicControls from '../../audio/GameMusicControls'
import { playGameSfx } from '../../audio/game-sfx'
import { getAdminSettings } from '../../data/casino-admin'
import { createRecordId, getCasinoRounds, recordGameEvent, recordGameRound, recordWalletEntry, type CasinoRoundRecord } from '../../data/casino-database'
import { normalizeWagerInput } from '../wagering'
import { shouldStopAutoBet } from '../originals/auto-bet'
import { AutoBetControls, BetAmountControl, DraftNumberInput, type AutoBetUiState } from '../originals/OriginalsBetControls'
import { clampLimboTarget, createLimboRound, limboWinChance, verifyLimboRound, type LimboRound } from './limbo-engine'
import '../originals/originals.css'
import './limbo.css'

type Props = { balance:number; setBalance:Dispatch<SetStateAction<number>>; onExit:()=>void; onBackToWorld:()=>void }
const money = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
const accountKey = (userId:string, key:string) => `account:${userId}:${key}`

function randomClientSeed() {
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes)
  return `oracle-${[...bytes].map((byte)=>byte.toString(16).padStart(2,'0')).join('')}`
}

export default function LimboRoom({balance,setBalance,onExit,onBackToWorld}:Props) {
  const {user}=useAuth(); const game=getAdminSettings().games.limbo
  const [bet,setBet]=useState(game.defaultBet); const [target,setTarget]=useState(2)
  const [round,setRound]=useState<LimboRound|null>(null); const [busy,setBusy]=useState(false)
  const [betMode,setBetMode]=useState<'manual'|'auto'>('manual');const [autoRunning,setAutoRunning]=useState(false)
  const [autoState,setAutoState]=useState<AutoBetUiState>({rounds:10,stopProfit:0,stopLoss:0,played:0,profit:0})
  const [phase,setPhase]=useState<'idle'|'charging'|'win'|'loss'>('idle'); const [rulesOpen,setRulesOpen]=useState(false); const [fairOpen,setFairOpen]=useState(false)
  const [verifyState,setVerifyState]=useState<'idle'|'checking'|'ok'|'fail'>('idle'); const [history,setHistory]=useState<CasinoRoundRecord[]>([])
  const balanceRef=useRef(balance); balanceRef.current=balance;const actionLockRef=useRef(false);const autoCancelRef=useRef(false)
  const winChance=limboWinChance(target,game.targetRtp); const potential=bet*target;const potentialNet=potential-bet

  useEffect(()=>{ window.scrollTo({top:0,left:0}) },[])
  useEffect(()=>{ void getCasinoRounds().then((records)=>setHistory(records.filter((item)=>item.game==='limbo').slice(0,6))) },[])
  const shownResult=round?.result ?? 1
  const relation=round ? `${round.result.toFixed(2)}x ${round.won?'≥':'<'} ${round.target.toFixed(2)}x` : 'SONUÇ EŞİĞİ BEKLİYOR'

  const playOnce=async():Promise<number|null>=>{
    if(actionLockRef.current) return null
    const stake=Math.max(game.minBet,normalizeWagerInput(bet,game.minBet)); if(stake>balanceRef.current) return null
    const targetSnapshot=target;actionLockRef.current=true;setBusy(true); setVerifyState('idle'); setPhase('charging');playGameSfx('limbo','/assets/instant/originals/audio/limbo-charge.ogg',.3)
    const seedKey=accountKey(user.id,'owl-oracle-client-seed-v1'); const nonceKey=accountKey(user.id,'owl-oracle-nonce-v1')
    const clientSeed=localStorage.getItem(seedKey)??randomClientSeed(); localStorage.setItem(seedKey,clientSeed)
    const nonce=Number(localStorage.getItem(nonceKey)??'0')+1; localStorage.setItem(nonceKey,String(nonce))
    try {
      const created=await createLimboRound({stake,target:targetSnapshot,rtp:game.targetRtp,clientSeed,nonce})
      const before=balanceRef.current; setBalance((value)=>value-stake); balanceRef.current-=stake
      const stakeWrite=recordWalletEntry({id:createRecordId('wallet-limbo-stake',created.roundId),roundId:created.roundId,game:'limbo',occurredAt:created.startedAt,type:'stake',amount:-stake,balanceBefore:before,balanceAfter:before-stake,note:`Owl Oracle ${created.target.toFixed(2)}x hedef bahis`})
      await new Promise((resolve)=>window.setTimeout(resolve,360))
      if(created.grossPayout>0){ setBalance((value)=>value+created.grossPayout); balanceRef.current+=created.grossPayout }
      const payoutWrite=created.grossPayout>0 ? recordWalletEntry({id:createRecordId('wallet-limbo-payout',created.roundId),roundId:created.roundId,game:'limbo',occurredAt:created.settledAt,type:'payout',amount:created.grossPayout,balanceBefore:before-stake,balanceAfter:before-stake+created.grossPayout,note:`Owl Oracle ${created.target.toFixed(2)}x ödeme`}) : Promise.resolve()
      const record:CasinoRoundRecord={id:createRecordId('round-limbo',created.roundId),roundId:created.roundId,game:'limbo',variant:`${created.target.toFixed(2)}x hedef`,source:'player',playerParticipated:true,startedAt:created.startedAt,settledAt:created.settledAt,stake,grossPayout:created.grossPayout,net:created.grossPayout-stake,outcome:created.won?'win':'loss',balanceBefore:before,balanceAfter:before-stake+created.grossPayout,result:{telemetryVersion:1,target:created.target,result:created.result,winChance:created.winChance,algorithm:created.algorithm,clientSeed,serverSeed:created.serverSeed,nonce,commitment:created.commitment,digest:created.digest},modifiers:{targetRtp:created.rtp}}
      await Promise.all([stakeWrite,payoutWrite,recordGameRound(record),recordGameEvent({id:createRecordId('event-limbo-settle',created.roundId),roundId:created.roundId,game:'limbo',occurredAt:created.settledAt,type:'limbo-round-settled',payload:{target:created.target,result:created.result,won:created.won,payout:created.grossPayout}})])
      setRound(created); setPhase(created.won?'win':'loss'); setHistory((items)=>[record,...items].slice(0,6));playGameSfx('limbo',created.won?'/assets/instant/originals/audio/sci-fi-victory.mp3':'/assets/instant/originals/audio/limbo-loss.ogg',created.won ? .34 : .38)
      return created.grossPayout-stake
    } finally { actionLockRef.current=false;setBusy(false) }
  }

  const runAuto=async()=>{
    if(autoRunning)return
    autoCancelRef.current=false;setAutoRunning(true);let played=0;let profit=0;setAutoState((state)=>({...state,played:0,profit:0}))
    try{while(!autoCancelRef.current){const net=await playOnce();if(net===null)break;played+=1;profit=Math.round((profit+net)*100)/100;setAutoState((state)=>({...state,played,profit}));if(shouldStopAutoBet(played,profit,autoState))break;await new Promise((resolve)=>window.setTimeout(resolve,180))}}
    finally{setAutoRunning(false)}
  }

  const verify=async()=>{ if(!round)return; setVerifyState('checking'); setVerifyState(await verifyLimboRound(round)?'ok':'fail') }
  const stageClass=`limbo-stage ${phase}`
  return <main className="originals-room limbo-room">
    <header className="originals-topbar"><button onClick={onBackToWorld}>← Anlık Oyunlar</button><div className="originals-brand"><small>CASINO ORIGINALS · LIMBO</small><strong>OWL ORACLE</strong></div><div className="originals-top-actions"><GameMusicControls game="limbo"/><button onClick={()=>setRulesOpen(true)}>OYUN BİLGİSİ</button><button onClick={onExit}>SALONLAR</button><span className="originals-balance">✦ {money.format(balance)} <small>PR</small></span></div></header>
    <div className="originals-shell"><section className={`originals-stage ${stageClass}`} aria-live="polite">
      <div className="limbo-art"/><div className="limbo-rings"><i/><i/><i/></div><div className="limbo-result"><small>{phase==='charging'?'KEHANET AÇILIYOR':round?(round.won?'EŞİK AŞILDI':'EŞİK ALTINDA'):'ORACLE HAZIR'}</small><strong>{shownResult.toFixed(2)}<em>x</em></strong><span>{relation}</span>{round&&<b>{round.won?`+${money.format(round.grossPayout-round.stake)} PR`:`−${money.format(round.stake)} PR`}</b>}</div>
      <div className="limbo-stage-footer"><span>HEDEF <b>{target.toFixed(2)}x</b></span><span>OLASILIK <b>%{winChance.toFixed(2)}</b></span><span>POTANSİYEL <b>{money.format(potential)} PR</b></span></div>
    </section><aside className="originals-side"><section className="originals-control-card"><small className="originals-kicker">KEHANET SÖZLEŞMESİ</small><h2>Eşiğini belirle.</h2>
      <BetAmountControl value={bet} onChange={setBet} min={game.minBet} balance={balance} disabled={busy||autoRunning}/>
      <label className="originals-field"><span>TARGET MULTIPLIER <b>{target.toFixed(2)}x</b></span><div className="originals-input-split"><button disabled={busy||autoRunning} onClick={()=>setTarget(clampLimboTarget(target-.25))}>−</button><DraftNumberInput ariaLabel="Hedef çarpan" disabled={busy||autoRunning} value={target} min={1.01} max={10000} step={.01} onCommit={(value)=>setTarget(clampLimboTarget(value))}/><button disabled={busy||autoRunning} onClick={()=>setTarget(clampLimboTarget(target+.25))}>+</button></div></label>
      <div className="originals-metrics"><div><small>KAZANMA ŞANSI</small><strong>%{winChance.toFixed(2)}</strong></div><div><small>ÇARPAN</small><strong>{target.toFixed(2)}×</strong></div><div><small>TOPLAM ÖDEME</small><strong>{money.format(potential)} PR</strong></div><div><small>NET KAZANÇ</small><strong>+{money.format(potentialNet)} PR</strong></div></div>
      <AutoBetControls mode={betMode} setMode={setBetMode} state={autoState} setState={setAutoState} running={autoRunning} disabled={busy} onStop={()=>{autoCancelRef.current=true}}/>
      <button className="originals-primary" disabled={busy||autoRunning||bet>balance} onClick={()=>betMode==='auto'?void runAuto():void playOnce()}>{autoRunning?'AUTO BET ÇALIŞIYOR…':busy?'ORACLE DİNLENİYOR…':betMode==='auto'?`AUTO BET · ${autoState.rounds} TUR`:'BET · SONUCU AÇ'}</button><p className="originals-note">Sonuç hedefe ulaşırsa bahis × hedef ödenir. RTP %{game.targetRtp}.</p>
    </section><section className="originals-history-card"><header><strong>SON KEHANETLER</strong><button onClick={()=>setFairOpen(true)}>DOĞRULA</button></header>{history.length?history.map((item)=><article key={item.id} className={item.outcome}><div><b>{Number(item.result.result??0).toFixed(2)}x</b><small>hedef {Number(item.result.target??0).toFixed(2)}x</small></div><span>{item.outcome==='win'?'+':''}{money.format(item.net)} PR</span></article>):<p className="originals-note">İlk kehanetini aç.</p>}</section></aside></div>
    {rulesOpen&&<div className="originals-modal-backdrop" onClick={()=>setRulesOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setRulesOpen(false)}>×</button><h2>Owl Oracle nasıl oynanır?</h2><h3>Target nedir?</h3><p>Kazanmak için sonucun ulaşması gereken çarpandır. Target yükseldikçe kazanma ihtimali azalır, potansiyel ödeme artar.</p><h3>Nasıl kazanılır?</h3><p>Result ≥ Target olduğunda kazanırsın. Ödeme result’tan değil, seçtiğin target’tan hesaplanır: bahis × target.</p><h3>Adil sonuç</h3><p>Her tur HMAC-SHA256 ile client seed, nonce ve gizli server seed’den deterministik üretilir. Ev dönüş hedefi %{game.targetRtp}.</p></section></div>}
    {fairOpen&&<div className="originals-modal-backdrop" onClick={()=>setFairOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setFairOpen(false)}>×</button><h2>Doğrulanabilir tur</h2>{round?<><p>Algoritma: {round.algorithm}</p><code>{round.commitment}</code><p>Nonce: {round.nonce}</p><button className="originals-primary" onClick={()=>void verify()}>{verifyState==='checking'?'KONTROL EDİLİYOR…':verifyState==='ok'?'✓ TUR DOĞRULANDI':verifyState==='fail'?'DOĞRULAMA BAŞARISIZ':'TURU DOĞRULA'}</button></>:<p>Henüz tamamlanmış tur yok.</p>}</section></div>}
  </main>
}
