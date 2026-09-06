import type { CasinoGameId } from '../data/casino-database'

export type UserSfxMix={muted:boolean;volume:number}
export type UserSfxMixes=Partial<Record<CasinoGameId,UserSfxMix>>
export const USER_SFX_MIX_KEY='pehlevan-royale-sfx-mix-v1'
export const USER_SFX_MIX_EVENT='pehlevan-royale:sfx-mix-change'
export const DEFAULT_USER_SFX_MIX:UserSfxMix={muted:false,volume:1}

const clamp=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):1
export function parseUserSfxMixes(raw:string|null):UserSfxMixes{if(!raw)return{};try{const parsed=JSON.parse(raw)as Record<string,Partial<UserSfxMix>|undefined>;return Object.fromEntries(Object.entries(parsed).flatMap(([game,mix])=>mix?[[game,{muted:mix.muted===true,volume:clamp(mix.volume)}]]:[]))as UserSfxMixes}catch{return{}}}
export function readUserSfxMixes(){try{return parseUserSfxMixes(localStorage.getItem(USER_SFX_MIX_KEY))}catch{return{}}}
export function getGameSfxMix(mixes:UserSfxMixes,game:CasinoGameId){return mixes[game]??DEFAULT_USER_SFX_MIX}
export function setGameSfxMix(mixes:UserSfxMixes,game:CasinoGameId,mix:UserSfxMix):UserSfxMixes{return{...mixes,[game]:{muted:mix.muted,volume:clamp(mix.volume)}}}
export function persistUserSfxMixes(mixes:UserSfxMixes){try{localStorage.setItem(USER_SFX_MIX_KEY,JSON.stringify(mixes));window.dispatchEvent(new CustomEvent(USER_SFX_MIX_EVENT))}catch{/* storage unavailable */}}
export function resolveGameSfxLevel(mix:UserSfxMix,base=1){return mix.muted?0:Math.max(0,Math.min(1,base*mix.volume))}
export function gameSfxLevel(game:CasinoGameId,base=1){return resolveGameSfxLevel(getGameSfxMix(readUserSfxMixes(),game),base)}
export function isGameSfxEnabled(game:CasinoGameId){return gameSfxLevel(game,1)>0}
