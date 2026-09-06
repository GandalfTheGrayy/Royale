import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuth } from '../../auth/auth-client'
import GameMusicControls from '../../audio/GameMusicControls'
import { playGameSfx } from '../../audio/game-sfx'
import { getAdminSettings } from '../../data/casino-admin'
import { createRecordId, getCasinoRounds, recordGameEvent, recordGameRound, recordWalletEntry, type CasinoRoundRecord } from '../../data/casino-database'
import { normalizeWagerInput } from '../wagering'
import { shouldStopAutoBet } from '../originals/auto-bet'
import { AutoBetControls, BetAmountControl, type AutoBetUiState } from '../originals/OriginalsBetControls'
import { createKenoRound, kenoPaytable, verifyKenoRound, type KenoRisk, type KenoRound } from './keno-engine'
import '../originals/originals.css'
import './keno.css'

type Props={balance:number;setBalance:Dispatch<SetStateAction<number>>;onExit:()=>void;onBackToWorld:()=>void}
const money=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2})
const riskNames:Record<KenoRisk,string>={low:'Düşük',medium:'Orta',high:'Yüksek'}
const accountKey=(userId:string,key:string)=>`account:${userId}:${key}`

function randomClientSeed(){const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return `star-map-${[...bytes].map((byte)=>byte.toString(16).padStart(2,'0')).join('')}`}
function quickNumbers(count:number){const values=Array.from({length:40},(_,index)=>index+1);const random=new Uint32Array(40);crypto.getRandomValues(random);for(let index=39;index>0;index-=1){const swap=random[index]%(index+1);[values[index],values[swap]]=[values[swap],values[index]]}return values.slice(0,count)}

export default function KenoRoom({balance,setBalance,onExit,onBackToWorld}:Props){
  const {user}=useAuth();const game=getAdminSettings().games.keno
  const [bet,setBet]=useState(game.defaultBet);const [risk,setRisk]=useState<KenoRisk>('medium');const [selected,setSelected]=useState<number[]>([]);const [quickCount,setQuickCount]=useState(5)
  const [round,setRound]=useState<KenoRound|null>(null);const [revealedCount,setRevealedCount]=useState(0);const [busy,setBusy]=useState(false);const [rulesOpen,setRulesOpen]=useState(false);const [fairOpen,setFairOpen]=useState(false);const [verifyState,setVerifyState]=useState<'idle'|'checking'|'ok'|'fail'>('idle');const [history,setHistory]=useState<CasinoRoundRecord[]>([])
  const [betMode,setBetMode]=useState<'manual'|'auto'>('manual');const [autoRunning,setAutoRunning]=useState(false);const [autoState,setAutoState]=useState<AutoBetUiState>({rounds:10,stopProfit:0,stopLoss:0,played:0,profit:0})
  const balanceRef=useRef(balance);balanceRef.current=balance;const actionLockRef=useRef(false);const autoCancelRef=useRef(false)
  useEffect(()=>{window.scrollTo({top:0,left:0})},[])
  useEffect(()=>{void getCasinoRounds().then((records)=>setHistory(records.filter((item)=>item.game==='keno').slice(0,6)))},[])
  const table=useMemo(()=>kenoPaytable(Math.max(1,selected.length),risk,game.targetRtp),[selected.length,risk,game.targetRtp])
  const winningHitCounts=Object.entries(table).filter(([,value])=>value>0).map(([hits])=>Number(hits));const positiveMultipliers=Object.values(table).filter((value)=>value>0);const minWinMultiplier=positiveMultipliers.length?Math.min(...positiveMultipliers):0;const maxWinMultiplier=positiveMultipliers.length?Math.max(...positiveMultipliers):0;const hasPayoutRange=positiveMultipliers.length>1
  const minWinPayout=bet*minWinMultiplier;const maxWinPayout=bet*maxWinMultiplier
  const multiplierPreview=hasPayoutRange?`${minWinMultiplier.toFixed(2)}× – ${maxWinMultiplier.toLocaleString('tr-TR',{maximumFractionDigits:2})}×`:`${maxWinMultiplier.toLocaleString('tr-TR',{maximumFractionDigits:2})}×`
  const payoutPreview=hasPayoutRange?`${money.format(minWinPayout)} – ${money.format(maxWinPayout)} PR`:`${money.format(maxWinPayout)} PR`
  const netPreview=hasPayoutRange?`${money.format(minWinPayout-bet)} – ${money.format(maxWinPayout-bet)} PR`:`${money.format(maxWinPayout-bet)} PR`
  const hitPreview=winningHitCounts.length?(hasPayoutRange?`${winningHitCounts[0]}–${winningHitCounts.at(-1)} HIT`:`${winningHitCounts[0]} HIT`):'—'
  const visibleDrawn=round?.drawn.slice(0,revealedCount)??[]
  const constellation=selected.map((number)=>{const index=number-1;return `${(((index%8)+.5)/8)*100},${((Math.floor(index/8)+.5)/5)*100}`}).join(' ')
  const toggle=(number:number)=>{if(busy||autoRunning)return;playGameSfx('keno','/assets/instant/originals/audio/sci-fi-hover.mp3',.14,selected.includes(number)?.92:1.08);setRound(null);setRevealedCount(0);setSelected((values)=>values.includes(number)?values.filter((value)=>value!==number):values.length<10?[...values,number]:values)}

  const playOnce=async(fast=false):Promise<number|null>=>{
    if(actionLockRef.current||selected.length<1)return null
    const stake=Math.max(game.minBet,normalizeWagerInput(bet,game.minBet));if(stake>balanceRef.current)return null
    const selectedSnapshot=[...selected];const riskSnapshot=risk;actionLockRef.current=true;setBusy(true);setVerifyState('idle');setRevealedCount(0)
    const seedKey=accountKey(user.id,'owl-star-map-client-seed-v1');const nonceKey=accountKey(user.id,'owl-star-map-nonce-v1');const clientSeed=localStorage.getItem(seedKey)??randomClientSeed();localStorage.setItem(seedKey,clientSeed);const nonce=Number(localStorage.getItem(nonceKey)??'0')+1;localStorage.setItem(nonceKey,String(nonce))
    try{
      const created=await createKenoRound({stake,selected:selectedSnapshot,risk:riskSnapshot,rtp:game.targetRtp,clientSeed,nonce});setRound(created)
      const before=balanceRef.current;setBalance((value)=>value-stake);balanceRef.current-=stake
      const stakeWrite=recordWalletEntry({id:createRecordId('wallet-keno-stake',created.roundId),roundId:created.roundId,game:'keno',occurredAt:created.startedAt,type:'stake',amount:-stake,balanceBefore:before,balanceAfter:before-stake,note:`Owl Star Map ${created.selected.length} seçim · ${riskNames[risk]} risk`})
      for(let index=1;index<=10;index+=1){await new Promise((resolve)=>window.setTimeout(resolve,fast?28:105));setRevealedCount(index);if(!fast){const hit=created.selected.includes(created.drawn[index-1]);playGameSfx('keno',hit?'/assets/instant/originals/audio/keno-hit.ogg':'/assets/instant/originals/audio/keno-star.ogg',hit ? .24 : .12,1+(index*.012))}}
      if(created.grossPayout>0){setBalance((value)=>value+created.grossPayout);balanceRef.current+=created.grossPayout}
      const payoutWrite=created.grossPayout>0?recordWalletEntry({id:createRecordId('wallet-keno-payout',created.roundId),roundId:created.roundId,game:'keno',occurredAt:created.settledAt,type:'payout',amount:created.grossPayout,balanceBefore:before-stake,balanceAfter:before-stake+created.grossPayout,note:`Owl Star Map ${created.hits.length}/${created.selected.length} hit · ${created.multiplier.toFixed(4)}x`}):Promise.resolve()
      const record:CasinoRoundRecord={id:createRecordId('round-keno',created.roundId),roundId:created.roundId,game:'keno',variant:`${created.selected.length} seçim · ${riskNames[risk]}`,source:'player',playerParticipated:true,startedAt:created.startedAt,settledAt:created.settledAt,stake,grossPayout:created.grossPayout,net:created.grossPayout-stake,outcome:created.grossPayout>0?'win':'loss',balanceBefore:before,balanceAfter:before-stake+created.grossPayout,result:{telemetryVersion:1,selected:created.selected,drawn:created.drawn,hits:created.hits,hitCount:created.hits.length,multiplier:created.multiplier,risk,algorithm:created.algorithm,clientSeed,serverSeed:created.serverSeed,nonce,commitment:created.commitment,digest:created.digest},modifiers:{targetRtp:created.rtp,paytable:table}}
      await Promise.all([stakeWrite,payoutWrite,recordGameRound(record),recordGameEvent({id:createRecordId('event-keno-settle',created.roundId),roundId:created.roundId,game:'keno',occurredAt:created.settledAt,type:'keno-round-settled',payload:{selected:created.selected,drawn:created.drawn,hits:created.hits,multiplier:created.multiplier,payout:created.grossPayout}})])
      setHistory((items)=>[record,...items].slice(0,6));if(created.grossPayout>0)playGameSfx('keno','/assets/instant/originals/audio/sci-fi-victory.mp3',.3)
      return created.grossPayout-stake
    }finally{actionLockRef.current=false;setBusy(false)}
  }

  const runAuto=async()=>{
    if(autoRunning||selected.length<1)return
    autoCancelRef.current=false;setAutoRunning(true);let played=0;let profit=0;setAutoState((state)=>({...state,played:0,profit:0}))
    try{while(!autoCancelRef.current){const net=await playOnce(true);if(net===null)break;played+=1;profit=Math.round((profit+net)*100)/100;setAutoState((state)=>({...state,played,profit}));if(shouldStopAutoBet(played,profit,autoState))break;await new Promise((resolve)=>window.setTimeout(resolve,150))}}
    finally{setAutoRunning(false)}
  }

  const verify=async()=>{if(!round)return;setVerifyState('checking');setVerifyState(await verifyKenoRound(round)?'ok':'fail')}
  return <main className="originals-room keno-room"><header className="originals-topbar"><button onClick={onBackToWorld}>← Anlık Oyunlar</button><div className="originals-brand"><small>CASINO ORIGINALS · KENO</small><strong>OWL STAR MAP</strong></div><div className="originals-top-actions"><GameMusicControls game="keno"/><button onClick={()=>setRulesOpen(true)}>OYUN BİLGİSİ</button><button onClick={onExit}>SALONLAR</button><span className="originals-balance">✦ {money.format(balance)} <small>PR</small></span></div></header>
    <div className="originals-shell keno-shell"><section className="originals-stage keno-stage"><div className="keno-art"/><header className="keno-stage-head"><div><small>KOZMİK ÇEKİLİŞ</small><strong>{round?(busy?`${revealedCount} / 10 AÇILDI`:`${round.hits.length} / ${round.selected.length} HIT`):`${selected.length} / 10 SEÇİLDİ`}</strong></div><div className={`keno-result-pill ${round&&!busy&&round.grossPayout>0?'win':''}`}><small>SONUÇ</small><b>{round&&!busy?`${round.multiplier.toFixed(2)}x · ${money.format(round.grossPayout)} PR`:'YILDIZLAR BEKLİYOR'}</b></div></header>
      <div className="keno-board-wrap"><svg className="keno-constellation" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={constellation}/></svg><div className="keno-board">{Array.from({length:40},(_,index)=>index+1).map((number)=>{const chosen=selected.includes(number);const drawn=visibleDrawn.includes(number);const hit=chosen&&drawn;return <button key={number} disabled={busy||autoRunning} className={`${chosen?'selected ':''}${drawn?'drawn ':''}${hit?'hit ':''}`} onClick={()=>toggle(number)} aria-label={`${number}${hit?' hit':drawn?' çekildi':chosen?' seçildi':''}`} aria-pressed={chosen}><span>{number}</span>{hit&&<i>HIT</i>}</button>})}</div></div>
      <div className="keno-draw-strip">{round?.drawn.map((number,index)=><span key={`${number}-${index}`} className={`${index<revealedCount?'visible ':''}${round.selected.includes(number)?'hit':''}`}>{index<revealedCount?number:'·'}</span>)??Array.from({length:10},(_,index)=><span key={index}>·</span>)}</div></section>
      <aside className="originals-side"><section className="originals-control-card"><small className="originals-kicker">YILDIZ SÖZLEŞMESİ</small><h2>Haritanı kur.</h2><BetAmountControl value={bet} onChange={setBet} min={game.minBet} balance={balance} disabled={busy||autoRunning}/>
        <label className="originals-field"><span>RİSK SEVİYESİ <b>{riskNames[risk]}</b></span><select value={risk} disabled={busy||autoRunning} onChange={(event)=>setRisk(event.target.value as KenoRisk)}><option value="low">Düşük · daha sık ödeme</option><option value="medium">Orta · dengeli</option><option value="high">Yüksek · seyrek / güçlü</option></select></label>
        <div className="keno-tools"><label><span>QUICK PICK</span><select value={quickCount} disabled={busy||autoRunning} onChange={(event)=>setQuickCount(Number(event.target.value))}>{Array.from({length:10},(_,index)=><option value={index+1} key={index+1}>{index+1} sayı</option>)}</select></label><button disabled={busy||autoRunning} onClick={()=>{setSelected(quickNumbers(quickCount));setRound(null);setRevealedCount(0)}}>HIZLI SEÇ</button><button disabled={busy||autoRunning||selected.length===0} onClick={()=>{setSelected([]);setRound(null);setRevealedCount(0)}}>TEMİZLE</button></div>
        <div className="originals-metrics"><div><small>SEÇİLEN · ÖDEME İÇİN</small><strong>{selected.length?`${selected.length} / 10 · ${hitPreview}`:'0 / 10'}</strong></div><div><small>{hasPayoutRange?'KAZANAN ÇARPANLAR':'KAZANAN ÇARPAN'}</small><strong>{selected.length?multiplierPreview:'—'}</strong></div><div><small>{hasPayoutRange?'ÖDEME ARALIĞI':'KAZANIRSA ÖDEME'}</small><strong>{selected.length?payoutPreview:'—'}</strong></div><div><small>{hasPayoutRange?'NET SONUÇ ARALIĞI':'NET KAZANÇ'}</small><strong>{selected.length?netPreview:'—'}</strong></div></div>
        <AutoBetControls mode={betMode} setMode={setBetMode} state={autoState} setState={setAutoState} running={autoRunning} disabled={busy||selected.length<1} onStop={()=>{autoCancelRef.current=true}}/>
        <button className="originals-primary" disabled={busy||autoRunning||selected.length<1||bet>balance} onClick={()=>betMode==='auto'?void runAuto():void playOnce()}>{autoRunning?'AUTO BET ÇALIŞIYOR…':busy?`ÇEKİLİŞ · ${revealedCount}/10`:betMode==='auto'?`AUTO BET · ${autoState.rounds} TUR`:'BET · 10 YILDIZ ÇEK'}</button><p className="originals-note">Ödeme seçilen sayı, HIT ve risk seviyesine göre hesaplanır. RTP %{game.targetRtp}.</p>
      </section><section className="originals-history-card"><header><strong>SON HARİTALAR</strong><button onClick={()=>setFairOpen(true)}>DOĞRULA</button></header>{history.length?history.map((item)=><article key={item.id} className={item.outcome}><div><b>{Number(item.result.hitCount??0)} / {(item.result.selected as number[]|undefined)?.length??0} hit</b><small>{Number(item.result.multiplier??0).toFixed(2)}x · {String(item.variant)}</small></div><span>{item.outcome==='win'?'+':''}{money.format(item.net)} PR</span></article>):<p className="originals-note">İlk yıldız haritanı çiz.</p>}</section></aside></div>
    {rulesOpen&&<div className="originals-modal-backdrop" onClick={()=>setRulesOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setRulesOpen(false)}>×</button><h2>Owl Star Map nasıl oynanır?</h2><p>1–40 arasından en fazla 10 sayı seç. BET sonrası sistem 10 farklı sayı çeker. Hem seçtiğin hem çekilen sayı bir HIT’tir.</p><h3>Risk seviyesi</h3><p>Düşük risk daha az hit ile ödeme başlatır. Yüksek risk daha fazla eşleşme ister fakat aynı hit seviyesinde daha güçlü çarpanlar sunar.</p><h3>Aktif ödeme tablosu</h3><ul>{Object.entries(table).map(([hits,multiplier])=><li key={hits}>{hits} hit — {multiplier>0?`${multiplier.toLocaleString('tr-TR',{maximumFractionDigits:4})}x`:'ödeme yok'}</li>)}</ul><p>Tablo, 40 sayıdan 10 çekilişin hipergeometrik olasılıklarından %{game.targetRtp} hedef dönüşle üretilir.</p></section></div>}
    {fairOpen&&<div className="originals-modal-backdrop" onClick={()=>setFairOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setFairOpen(false)}>×</button><h2>Doğrulanabilir tur</h2>{round?<><p>{round.algorithm} · nonce {round.nonce}</p><code>{round.commitment}</code><button className="originals-primary" onClick={()=>void verify()}>{verifyState==='checking'?'KONTROL EDİLİYOR…':verifyState==='ok'?'✓ TUR DOĞRULANDI':verifyState==='fail'?'DOĞRULAMA BAŞARISIZ':'TURU DOĞRULA'}</button></>:<p>Henüz tamamlanmış tur yok.</p>}</section></div>}
  </main>
}
