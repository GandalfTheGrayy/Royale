import{useEffect,useState,type KeyboardEvent}from'react'
import{normalizeWagerInput}from'../wagering'
import{normalizeAutoLimit,normalizeAutoRounds}from'./auto-bet'
import'./bet-controls.css'

const money=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2})

export function DraftNumberInput({value,onCommit,min,max,step=1,disabled=false,ariaLabel,className}:{value:number;onCommit:(value:number)=>void;min:number;max?:number;step?:number;disabled?:boolean;ariaLabel:string;className?:string}){
  const [draft,setDraft]=useState(String(value));useEffect(()=>{setDraft(String(value))},[value])
  const apply=(next:number)=>{const bounded=Math.min(max??Number.POSITIVE_INFINITY,Math.max(min,next));onCommit(bounded);setDraft(String(bounded))}
  const commit=()=>{const parsed=Number(draft.replace(',','.'));if(Number.isFinite(parsed))apply(parsed);else setDraft(String(value))}
  return <input className={className} aria-label={ariaLabel} disabled={disabled} type="text" inputMode="decimal" value={draft} onChange={(event)=>{if(/^\d*(?:[.,]\d*)?$/.test(event.target.value))setDraft(event.target.value)}} onBlur={commit} onKeyDown={(event)=>{if(event.key==='Enter'){commit();event.currentTarget.blur()}else if(event.key==='ArrowUp'){event.preventDefault();apply(value+step)}else if(event.key==='ArrowDown'){event.preventDefault();apply(value-step)}}}/>
}

export function BetAmountControl({value,onChange,min,balance,disabled=false}:{value:number;onChange:(value:number)=>void;min:number;balance:number;disabled?:boolean}){
  const initialStep=Math.max(min,Math.min(25,Math.max(balance,min)));const [draft,setDraft]=useState(String(value));const [step,setStep]=useState(initialStep);const [stepDraft,setStepDraft]=useState(String(initialStep))
  const clamp=(next:number)=>Math.round(Math.min(balance,Math.max(min,normalizeWagerInput(next,min)))*100)/100
  const parse=(raw:string)=>Number(raw.replace(',','.'))
  const set=(next:number)=>{const applied=clamp(next);onChange(applied);setDraft(String(applied))}
  const commitBet=()=>{const parsed=parse(draft);if(Number.isFinite(parsed))set(parsed);else setDraft(String(value))}
  const commitStep=()=>{const parsed=parse(stepDraft);const applied=Math.round(Math.max(.01,Number.isFinite(parsed)?parsed:step)*100)/100;setStep(applied);setStepDraft(String(applied))}
  const typeDraft=(next:string,setter:(value:string)=>void)=>{if(/^\d*(?:[.,]\d*)?$/.test(next))setter(next)}
  const keyBet=(event:KeyboardEvent<HTMLInputElement>)=>{if(event.key==='Enter'){commitBet();event.currentTarget.blur()}else if(event.key==='ArrowUp'){event.preventDefault();set(value+step)}else if(event.key==='ArrowDown'){event.preventDefault();set(value-step)}}
  useEffect(()=>{setDraft(String(value))},[value])
  return <div className="obc-bet"><label className="originals-field"><span>BAHİS MİKTARI <b>PR</b></span><div className="obc-bet-entry"><button className="decrease" disabled={disabled||value<=min} aria-label={`Bahsi ${money.format(step)} PR azalt`} onClick={()=>set(value-step)}>− <b>{money.format(step)}</b></button><input aria-label="Bahis miktarı" disabled={disabled} type="text" inputMode="decimal" value={draft} onChange={(event)=>typeDraft(event.target.value,setDraft)} onBlur={commitBet} onKeyDown={keyBet}/><button className="increase" disabled={disabled||value>=balance} aria-label={`Bahsi ${money.format(step)} PR artır`} onClick={()=>set(value+step)}>+ <b>{money.format(step)}</b></button></div></label><div className="obc-bet-tools"><label><span>ADIM</span><input aria-label="Bahis artış miktarı" disabled={disabled} type="text" inputMode="decimal" value={stepDraft} onChange={(event)=>typeDraft(event.target.value,setStepDraft)} onBlur={commitStep} onKeyDown={(event)=>{if(event.key==='Enter'){commitStep();event.currentTarget.blur()}}}/></label><button disabled={disabled} onClick={()=>set(min)}>MİN</button><button disabled={disabled||balance<min} onClick={()=>set(balance)}>MAKS</button></div></div>
}

export type AutoBetUiState={rounds:number;stopProfit:number;stopLoss:number;played:number;profit:number}

export function AutoBetControls({mode,setMode,state,setState,running,disabled=false,onStop}:{mode:'manual'|'auto';setMode:(mode:'manual'|'auto')=>void;state:AutoBetUiState;setState:(state:AutoBetUiState)=>void;running:boolean;disabled?:boolean;onStop:()=>void}){
  const patch=(next:Partial<AutoBetUiState>)=>setState({...state,...next})
  return <section className="obc-auto"><div className="obc-tabs"><button className={mode==='manual'?'active':''} disabled={running} onClick={()=>setMode('manual')}>MANUAL</button><button className={mode==='auto'?'active':''} disabled={running} onClick={()=>setMode('auto')}>AUTO BET</button></div>{mode==='auto'&&<><div className="obc-auto-grid"><label><span>TUR SAYISI</span><DraftNumberInput ariaLabel="Auto Bet tur sayısı" disabled={running||disabled} value={state.rounds} min={1} max={1000} step={1} onCommit={(value)=>patch({rounds:normalizeAutoRounds(value)})}/></label><label><span>KÂRDA DUR · PR</span><DraftNumberInput ariaLabel="Kârda dur miktarı" disabled={running||disabled} value={state.stopProfit} min={0} step={1} onCommit={(value)=>patch({stopProfit:normalizeAutoLimit(value)})}/></label><label><span>ZARARDA DUR · PR</span><DraftNumberInput ariaLabel="Zararda dur miktarı" disabled={running||disabled} value={state.stopLoss} min={0} step={1} onCommit={(value)=>patch({stopLoss:normalizeAutoLimit(value)})}/></label></div><div className="obc-auto-status"><span>OYNANAN <b>{state.played}/{state.rounds}</b></span><span>OTURUM NETİ <b className={state.profit>=0?'positive':'negative'}>{state.profit>=0?'+':''}{money.format(state.profit)} PR</b></span>{running&&<button onClick={onStop}>AUTO BET'İ DURDUR</button>}</div></>}</section>
}
