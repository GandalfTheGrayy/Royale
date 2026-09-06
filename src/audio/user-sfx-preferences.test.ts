import{describe,expect,it}from'vitest'
import{getGameSfxMix,parseUserSfxMixes,resolveGameSfxLevel,setGameSfxMix}from'./user-sfx-preferences'

describe('oyun efekt sesi tercihleri',()=>{
  it('bozuk veriyi güvenli varsayılana çevirir',()=>{expect(parseUserSfxMixes('bad')).toEqual({});expect(getGameSfxMix({},'mines')).toEqual({muted:false,volume:1})})
  it('ses seviyesini sınırlar ve mute durumunu saklar',()=>{const mixes=setGameSfxMix({},'mines',{muted:true,volume:4});expect(getGameSfxMix(mixes,'mines')).toEqual({muted:true,volume:1})})
  it('saklanan seviyeyi efekt katsayısına uygular',()=>{expect(resolveGameSfxLevel({muted:false,volume:.4},.5)).toBeCloseTo(.2);expect(resolveGameSfxLevel({muted:true,volume:1},.5)).toBe(0)})
})
