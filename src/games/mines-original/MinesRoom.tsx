import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuth } from '../../auth/auth-client'
import GameMusicControls from '../../audio/GameMusicControls'
import { playGameSfx } from '../../audio/game-sfx'
import { getAdminSettings } from '../../data/casino-admin'
import { createRecordId, getCasinoRounds, recordGameEvent, recordGameRound, recordWalletEntry, type CasinoRoundRecord } from '../../data/casino-database'
import { normalizeWagerInput } from '../wagering'
import { shouldStopAutoBet } from '../originals/auto-bet'
import { AutoBetControls, BetAmountControl, DraftNumberInput, type AutoBetUiState } from '../originals/OriginalsBetControls'
import { batchMultiplier, batchWinProbability, createMinesBatchRound, normalizeSelectedIndices, verifyMinesBatchRound, type MinesBatchRound } from './mines-original-engine'
import '../originals/originals.css'
import './mines-original.css'
import './mines-fixed.css'

type Props={balance:number;setBalance:Dispatch<SetStateAction<number>>;onExit:()=>void;onBackToWorld:()=>void}
const money=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2})
const accountKey=(userId:string,key:string)=>`account:${userId}:${key}`

function randomClientSeed(){const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);return`mines-${[...bytes].map((byte)=>byte.toString(16).padStart(2,'0')).join('')}`}

export default function MinesRoom({balance,setBalance,onExit,onBackToWorld}:Props){
  const {user}=useAuth();const game=getAdminSettings().games.mines;const tuning=game.mines!
  const selectionKey=accountKey(user.id,'casino-mines-fixed-selection-v1')
  const [bet,setBet]=useState(game.defaultBet);const [mineCount,setMineCount]=useState(tuning.defaultMines)
  const [selected,setSelected]=useState<number[]>(()=>{try{return normalizeSelectedIndices(JSON.parse(localStorage.getItem(selectionKey)??'[]') as number[],tuning.defaultMines)}catch{return[]}})
  const [round,setRound]=useState<MinesBatchRound|null>(null);const [busy,setBusy]=useState(false)
  const [betMode,setBetMode]=useState<'manual'|'auto'>('manual');const [autoRunning,setAutoRunning]=useState(false)
  const [autoState,setAutoState]=useState<AutoBetUiState>({rounds:10,stopProfit:0,stopLoss:0,played:0,profit:0})
  const [rulesOpen,setRulesOpen]=useState(false);const [fairOpen,setFairOpen]=useState(false)
  const [verifyState,setVerifyState]=useState<'idle'|'checking'|'ok'|'fail'>('idle');const [history,setHistory]=useState<CasinoRoundRecord[]>([])
  const balanceRef=useRef(balance);balanceRef.current=balance;const actionLockRef=useRef(false);const autoCancelRef=useRef(false)
  const maxSelections=25-mineCount;const multiplier=selected.length?batchMultiplier(mineCount,selected.length,game.targetRtp):0
  const winChance=selected.length?batchWinProbability(mineCount,selected.length)*100:0;const potential=bet*multiplier;const potentialNet=potential-bet

  useEffect(()=>{window.scrollTo({top:0,left:0})},[])
  useEffect(()=>{localStorage.setItem(selectionKey,JSON.stringify(selected))},[selected,selectionKey])
  useEffect(()=>{void getCasinoRounds().then((items)=>setHistory(items.filter((item)=>item.game==='mines').slice(0,6)))},[])

  const changeMineCount=(value:number)=>{const next=Math.min(24,Math.max(1,Math.round(value)));setMineCount(next);setSelected((items)=>normalizeSelectedIndices(items,next));setRound(null);setVerifyState('idle')}
  const toggleTile=(index:number)=>{if(busy||autoRunning)return;playGameSfx('mines','/assets/instant/originals/audio/sci-fi-hover.mp3',.16,selected.includes(index)?.92:1.08);setRound(null);setVerifyState('idle');setSelected((items)=>items.includes(index)?items.filter((item)=>item!==index):items.length>=maxSelections?items:[...items,index].sort((a,b)=>a-b))}
  const clearSelection=()=>{if(busy||autoRunning)return;setSelected([]);setRound(null);setVerifyState('idle')}

  const playOnce=async():Promise<number|null>=>{
    if(actionLockRef.current||selected.length<1)return null
    const stake=Math.max(game.minBet,normalizeWagerInput(bet,game.minBet));if(stake>balanceRef.current)return null
    const selectedSnapshot=[...selected];const mineCountSnapshot=mineCount
    actionLockRef.current=true;setBusy(true);setRound(null);setVerifyState('idle');playGameSfx('mines','/assets/instant/originals/audio/mines-lock.ogg',.26)
    const seedKey=accountKey(user.id,'casino-mines-client-seed-v2');const nonceKey=accountKey(user.id,'casino-mines-nonce-v2')
    const clientSeed=localStorage.getItem(seedKey)??randomClientSeed();localStorage.setItem(seedKey,clientSeed)
    const nonce=Number(localStorage.getItem(nonceKey)??'0')+1;localStorage.setItem(nonceKey,String(nonce))
    try{
      const created=await createMinesBatchRound({stake,mineCount:mineCountSnapshot,selectedIndices:selectedSnapshot,clientSeed,nonce,rtp:game.targetRtp})
      const before=balanceRef.current;setBalance((value)=>value-stake);balanceRef.current-=stake
      const stakeWrite=recordWalletEntry({id:createRecordId('wallet-mines-stake',created.roundId),roundId:created.roundId,game:'mines',occurredAt:created.startedAt,type:'stake',amount:-stake,balanceBefore:before,balanceAfter:before-stake,note:`Mines · ${selected.length} sabit seçim · ${mineCount} mayın`})
      await new Promise((resolve)=>window.setTimeout(resolve,260))
      if(created.grossPayout>0){setBalance((value)=>value+created.grossPayout);balanceRef.current+=created.grossPayout}
      const after=before-stake+created.grossPayout
      const payoutWrite=created.grossPayout>0?recordWalletEntry({id:createRecordId('wallet-mines-payout',created.roundId),roundId:created.roundId,game:'mines',occurredAt:created.settledAt,type:'payout',amount:created.grossPayout,balanceBefore:before-stake,balanceAfter:after,note:`Mines ${created.multiplier.toFixed(2)}x toplu seçim ödemesi`}):Promise.resolve()
      const record:CasinoRoundRecord={id:createRecordId('round-mines',created.roundId),roundId:created.roundId,game:'mines',variant:`Sabit seçim · ${created.selectedIndices.length} kare · ${created.mineCount} mayın`,source:'player',playerParticipated:true,startedAt:created.startedAt,settledAt:created.settledAt,stake,grossPayout:created.grossPayout,net:created.grossPayout-stake,outcome:created.phase==='won'?'win':'loss',balanceBefore:before,balanceAfter:after,result:{telemetryVersion:1,mineCount:created.mineCount,safeReveals:created.gemCount,currentMultiplier:created.multiplier,selectedIndices:created.selectedIndices,mineIndices:created.mineIndices,hitMines:created.hitMines,gemCount:created.gemCount,phase:created.phase,algorithm:created.algorithm,clientSeed,serverSeed:created.serverSeed,nonce,commitment:created.commitment,digest:created.digest},modifiers:{targetRtp:created.rtp}}
      await Promise.all([stakeWrite,payoutWrite,recordGameRound(record),recordGameEvent({id:createRecordId('event-mines-settle',created.roundId),roundId:created.roundId,game:'mines',occurredAt:created.settledAt,type:'mines-fixed-picks-settled',payload:{selectedIndices:created.selectedIndices,mineCount:created.mineCount,hitMines:created.hitMines,multiplier:created.multiplier,payout:created.grossPayout}})])
      setRound(created);setHistory((items)=>[record,...items].slice(0,6));playGameSfx('mines',created.phase==='won'?'/assets/instant/originals/audio/mines-gem-win.wav':'/assets/instant/originals/audio/mines-deep-explosion.wav',created.phase==='won' ? .52 : .58)
      return created.grossPayout-stake
    }finally{actionLockRef.current=false;setBusy(false)}
  }

  const runAuto=async()=>{
    if(autoRunning||selected.length<1)return
    autoCancelRef.current=false;setAutoRunning(true);let played=0;let profit=0;setAutoState((state)=>({...state,played:0,profit:0}))
    try{while(!autoCancelRef.current){const net=await playOnce();if(net===null||net===undefined)break;played+=1;profit=Math.round((profit+net)*100)/100;setAutoState((state)=>({...state,played,profit}));if(shouldStopAutoBet(played,profit,autoState))break;await new Promise((resolve)=>window.setTimeout(resolve,180))}}
    finally{setAutoRunning(false)}
  }

  const verify=async()=>{if(!round)return;setVerifyState('checking');setVerifyState(await verifyMinesBatchRound(round)?'ok':'fail')}
  const status=busy?'SONUÇLAR DAĞITILIYOR':round?.phase==='won'?'SEÇİMLERİN TAMAMI GEM':round?.phase==='lost'?'SEÇİMLERİNDE MAYIN VAR':selected.length?`${selected.length} KARE SABİT SEÇİLİ`:'ÖNCE KARELERİNİ SEÇ'

  return <main className="originals-room casino-mines-room">
    <header className="originals-topbar"><button onClick={onBackToWorld}>← Anlık Oyunlar</button><div className="originals-brand"><small>CASINO ORIGINALS · MINES</small><strong>FORBIDDEN VAULT</strong></div><div className="originals-top-actions"><GameMusicControls game="mines"/><button onClick={()=>setRulesOpen(true)}>OYUN BİLGİSİ</button><button onClick={onExit}>SALONLAR</button><span className="originals-balance">✦ {money.format(balance)} <small>PR</small></span></div></header>
    <div className="originals-shell mines-shell"><section className="originals-stage casino-mines-stage"><div className="casino-mines-art"/><header className="casino-mines-stage-head"><div><small>5 × 5 SABİT SEÇİM TAHTASI</small><strong>{status}</strong></div><div className={`casino-mines-status ${round?.phase??'idle'}`}><small>SONUÇ</small><b>{round?round.phase==='won'?`+${money.format(round.grossPayout)} PR`:'0 PR':`${selected.length} SEÇİM`}</b></div></header>
      <div className={`casino-mines-board ${busy?'resolving':''}`} aria-label="Mines seçim alanı">{Array.from({length:25},(_,index)=>{const isSelected=selected.includes(index);const resolved=!!round;const isMine=!!round&&round.mineIndices.includes(index);const isGem=!!round&&!isMine;const struck=isMine&&isSelected;return <button key={index} disabled={busy||autoRunning} className={`${isSelected?'selected ':''}${resolved?'resolved ':''}${isMine?'mine ':''}${struck?'struck ':''}${isGem?'safe ':''}${round&&!isSelected?'board-result-muted ':''}`} aria-pressed={isSelected} aria-label={`${index+1}. kare${isSelected?' seçili':''}${isMine?' mayın':isGem?' gem':''}`} onClick={()=>toggleTile(index)}>{isMine?<img src="/assets/instant/originals/mines-cursed-seal-v1.png" alt=""/>:isGem?<img src="/assets/instant/originals/mines-owl-gem-v1.png" alt=""/>:<><span className="closed-mark" aria-hidden="true"/>{isSelected&&<b className="selection-order">{selected.indexOf(index)+1}</b>}</>}</button>})}</div>
      <div className="casino-mines-stage-foot"><span>SELECTED TILES <b>{selected.length}</b></span><span>MINES <b>{mineCount}</b></span><span>WIN CHANCE <b>{selected.length?`%${winChance.toFixed(2)}`:'—'}</b></span><span>PAYOUT MULTIPLIER <b>{selected.length?`${multiplier.toFixed(2)}×`:'—'}</b></span><span>POTENTIAL PAYOUT <b>{selected.length?`${money.format(potential)} PR`:'—'}</b></span></div>
    </section><aside className="originals-side"><section className="originals-control-card"><div className="casino-mines-mode"><b>SABİT SEÇİM</b><span>SEÇ → BET → TOPLU SONUÇ</span></div><small className="originals-kicker">BAHİS AYARLARI</small><h2>Karelerini seç; her BET'te aynı alanları topluca çöz.</h2>
      <BetAmountControl value={bet} onChange={setBet} min={game.minBet} balance={balance} disabled={busy||autoRunning}/>
      <label className="originals-field"><span>MAYIN SAYISI <b>1–24</b></span><div className="mines-count-input"><button disabled={busy||autoRunning||mineCount<=1} onClick={()=>changeMineCount(mineCount-1)}>−</button><DraftNumberInput ariaLabel="Mayın sayısı" disabled={busy||autoRunning} value={mineCount} min={1} max={24} step={1} onCommit={changeMineCount}/><button disabled={busy||autoRunning||mineCount>=24} onClick={()=>changeMineCount(mineCount+1)}>+</button></div></label>
      <div className="casino-mines-selection-row"><span><b>{selected.length}</b> / {maxSelections} KARE SEÇİLİ</span><button disabled={busy||autoRunning||!selected.length} onClick={clearSelection}>SEÇİMİ TEMİZLE</button></div>
      <div className="originals-metrics"><div><small>KAZANMA ŞANSI</small><strong>{selected.length?`%${winChance.toFixed(2)}`:'—'}</strong></div><div><small>ÇARPAN</small><strong>{selected.length?`${multiplier.toFixed(2)}×`:'—'}</strong></div><div><small>TOPLAM ÖDEME</small><strong>{selected.length?`${money.format(potential)} PR`:'—'}</strong></div><div><small>NET KAZANÇ</small><strong>{selected.length?`+${money.format(potentialNet)} PR`:'—'}</strong></div></div>
      <AutoBetControls mode={betMode} setMode={setBetMode} state={autoState} setState={setAutoState} running={autoRunning} disabled={busy||selected.length<1} onStop={()=>{autoCancelRef.current=true}}/>
      <button className="originals-primary casino-mines-bet" disabled={busy||autoRunning||selected.length<1||bet>balance} onClick={()=>betMode==='auto'?void runAuto():void playOnce()}>{autoRunning?'AUTO BET ÇALIŞIYOR…':busy?'DAĞITILIYOR…':betMode==='auto'?`AUTO BET · ${autoState.rounds} TUR`:round?'AYNI SEÇİMLERLE TEKRAR BET':'BET'}</button>
      <p className="originals-note">Seçimler sabit kalır; her BET tüm tahtayı yeni yerleşimle açar. RTP %{game.targetRtp}.</p>
    </section><section className="originals-history-card"><header><strong>SON TOPLU BAHİSLER</strong><button onClick={()=>setFairOpen(true)}>DOĞRULA</button></header>{history.length?history.map((item)=><article key={item.id} className={item.outcome}><div><b>{Number(item.result.currentMultiplier??0).toFixed(2)}×</b><small>{Array.isArray(item.result.selectedIndices)?item.result.selectedIndices.length:0} seçim · {Number(item.result.mineCount??0)} mayın</small></div><span>{item.net>0?'+':''}{money.format(item.net)} PR</span></article>):<p className="originals-note">İlk sabit seçim bahsini yap.</p>}</section></aside></div>
    {rulesOpen&&<div className="originals-modal-backdrop" onClick={()=>setRulesOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setRulesOpen(false)}>×</button><h2>Mines nasıl oynanır?</h2><h3>1 · Karelerini önceden seç</h3><p>5×5 tahta üzerinde bahis yapmak istediğin kareleri işaretle. Seçimlerin sen değiştirene kadar sonraki bahislerde aynı kalır.</p><h3>2 · BET'e bas</h3><p>Her BET yeni ve doğrulanabilir bir mayın yerleşimi üretir. Seçtiğin karelerin tamamı tek seferde çözülür; tur içinde ayrıca kare açılmaz.</p><h3>3 · Toplu sonuç</h3><p>Seçili karelerin tamamı gem ise bahis × çarpan ödenir. Seçili karelerden en az biri mayınsa bahis kaybedilir. Cash Out veya tur içi seçim yoktur.</p></section></div>}
    {fairOpen&&<div className="originals-modal-backdrop" onClick={()=>setFairOpen(false)}><section className="originals-modal" onClick={(event)=>event.stopPropagation()}><button onClick={()=>setFairOpen(false)}>×</button><h2>Doğrulanabilir tur</h2>{round?<><p>Algoritma: {round.algorithm}</p><code>{round.commitment}</code><p>Nonce: {round.nonce}</p><button className="originals-primary" onClick={()=>void verify()}>{verifyState==='checking'?'KONTROL EDİLİYOR…':verifyState==='ok'?'✓ TUR DOĞRULANDI':verifyState==='fail'?'DOĞRULAMA BAŞARISIZ':'TURU DOĞRULA'}</button></>:<p>Henüz tamamlanmış tur yok.</p>}</section></div>}
  </main>
}
