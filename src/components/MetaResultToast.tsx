import { useEffect, useState } from 'react'
import type { CompetitionResultSignal } from '../data/casino-database'
import './meta-result-toast.css'

type MetaResultDetail={game:string;signals:CompetitionResultSignal[]}
type Toast={id:string;game:string;signal:CompetitionResultSignal}

const format=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2})

function copy(signal:CompetitionResultSignal){
  if(signal.type==='round-summary') return {eyebrow:'REKABET SONUCU',title:`+${format.format(signal.net)} PR`,detail:`Sezon ${signal.previousSeasonRank!==null&&signal.previousSeasonRank!==signal.seasonRank?`#${signal.previousSeasonRank} → `:''}#${signal.seasonRank??'—'}${signal.rivalGap===null?'':` · rakip farkı ${signal.rivalGap>=0?'+':''}${format.format(signal.rivalGap)} PR`}`,icon:'✦'}
  if(signal.type==='achievement') return {eyebrow:'BAŞARIM AÇILDI',title:signal.name,detail:signal.rarity.toLocaleUpperCase('tr-TR'),icon:'◆'}
  if(signal.type==='casino-record') return {eyebrow:'YENİ CASINO REKORU',title:signal.count>1?`${signal.count} rekor birden`:'Adını duvara yazdın',detail:'Casino Live’a işlendi',icon:'♛'}
  if(signal.type==='club-contribution') return {eyebrow:'KULÜP KATKISI',title:`+${signal.score} KULÜP PUANI`,detail:'Haftalık masa birliği hesabına işlendi',icon:'♣'}
  const suffix=/(payout|pot|bankroll)/.test(signal.metricId)?' PR':signal.metricId.includes('multiplier')?'×':''
  return {eyebrow:'YENİ KİŞİSEL REKOR',title:`${format.format(signal.value)}${suffix}`,detail:`${signal.metricLabel}${signal.previousValue===null?' · ilk kayıt':` · önceki ${format.format(signal.previousValue)}`}`,icon:'↗'}
}

export default function MetaResultToast(){
  const [queue,setQueue]=useState<Toast[]>([])
  useEffect(()=>{
    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<MetaResultDetail>).detail
      if(!detail?.signals?.length)return
      setQueue((current)=>[...current,...detail.signals.slice(0,4).map((signal,index)=>({id:`${Date.now()}-${index}-${signal.type}`,game:detail.game,signal}))])
    }
    window.addEventListener('pehlevan-meta-result',handler)
    return()=>window.removeEventListener('pehlevan-meta-result',handler)
  },[])
  const active=queue[0]
  useEffect(()=>{
    if(!active)return
    const timer=window.setTimeout(()=>setQueue((current)=>current.slice(1)),3600)
    return()=>window.clearTimeout(timer)
  },[active])
  if(!active)return null
  const content=copy(active.signal)
  return <aside className={`meta-result-toast ${active.signal.type}`} role="status" aria-live="polite">
    <i>{content.icon}</i><div><small>{content.eyebrow}</small><strong>{content.title}</strong><span>{content.detail}</span></div>
    <button onClick={()=>setQueue((current)=>current.slice(1))} aria-label="Bildirimi kapat">×</button>
  </aside>
}
