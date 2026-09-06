import { useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import { getAdminSettings, subscribeAdminSettings } from '../../data/casino-admin'
import AltinRotaRoom from './AltinRotaRoom'
import ObsidyenDamariRoom from '../mines/ObsidyenDamariRoom'
import SonOnRoom from '../countdown/SonOnRoom'
import PlinkoRoom from '../plinko/PlinkoRoom'
import LimboRoom from '../limbo/LimboRoom'
import KenoRoom from '../keno/KenoRoom'
import MinesRoom from '../mines-original/MinesRoom'
import HiloRoom from '../hilo/HiloRoom'
import YediCevherRoom from '../diamonds/YediCevherRoom'
import './instant.css'

type Props = { balance: number; setBalance: Dispatch<SetStateAction<number>>; onExit: () => void; aiOnline: boolean }

export default function InstantWorld({ balance, setBalance, onExit, aiOnline }: Props) {
  const admin = useSyncExternalStore(subscribeAdminSettings, getAdminSettings, getAdminSettings)
  const [room, setRoom] = useState<'world' | 'altin-rota' | 'limbo' | 'obsidyen-damari' | 'mines' | 'keno' | 'son-on' | 'plinko' | 'hilo' | 'yedi-cevher'>('world')
  if (room === 'altin-rota') return <AltinRotaRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} aiOnline={aiOnline && admin.general.aiEnabled && admin.games['altin-rota'].aiHost} />
  if (room === 'limbo') return <LimboRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  if (room === 'obsidyen-damari') return <ObsidyenDamariRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} aiOnline={aiOnline && admin.general.aiEnabled && admin.games['obsidyen-damari'].aiHost} />
  if (room === 'mines') return <MinesRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  if (room === 'keno') return <KenoRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  if (room === 'son-on') return <SonOnRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} aiOnline={aiOnline && admin.general.aiEnabled && admin.games['son-on'].aiHost} />
  if (room === 'plinko') return <PlinkoRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  if (room === 'hilo') return <HiloRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  if (room === 'yedi-cevher') return <YediCevherRoom balance={balance} setBalance={setBalance} onExit={onExit} onBackToWorld={() => setRoom('world')} />
  return <main className="instant-world">
    <header className="instant-world-top"><button onClick={onExit}>← Salonlar</button><div><i>MP</i><span>PEHLEVAN ROYALE<small>ANLIK OYUNLAR</small></span></div><strong>✦ {balance.toLocaleString('tr-TR')} <small>PR</small></strong></header>
    <section className="instant-world-hero"><small>ANLIK OYUNLAR</small><h1>Kararı zamanında ver.<br /><i>Risk büyümeden çık.</i></h1><p>Canlı çarpan, kapalı mühür ve tek dokunuşta kasa kararı. Slot değil; sonucu izlemek yerine karar verdiğin oyunlar.</p></section>
    <section className="instant-world-grid">
      <button className="instant-game-card altin-rota-card" disabled={!admin.games['altin-rota'].enabled || admin.general.maintenanceMode} onClick={() => setRoom('altin-rota')}><div className="instant-card-plane"><img src="/assets/instant/altin-rota/altin-rota-plane-v1.png" alt="" /></div><span>01 · CRASH</span><h2>ALTIN ROTA</h2><p>İstanbul gecesinde iki bahisli, canlı ve doğrulanabilir uçuş.</p><footer><b>CANLI TUR</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card limbo-card" disabled={!admin.games.limbo.enabled || admin.general.maintenanceMode} onClick={() => setRoom('limbo')}><div className="instant-card-original-art limbo"/><span>02 · LIMBO</span><h2>OWL ORACLE</h2><p>Hedef çarpanı seç. Oracle sonucu eşiğe ulaşırsa seçtiğin çarpanı al.</p><footer><b>ANLIK KEHANET</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card obsidyen-card" disabled={!admin.games['obsidyen-damari'].enabled || admin.general.maintenanceMode} onClick={() => setRoom('obsidyen-damari')}><div className="instant-card-obsidyen"><img src="/assets/instant/obsidyen-damari/obsidyen-crystal-v1.png" alt="" /></div><span>03 · OBSİDYEN</span><h2>OBSİDYEN DAMARI</h2><p>5×5 Serbest Kazı ve 12 kademeli Derin Hat. Bir mühür daha mı, kasaya dönüş mü?</p><footer><b>2 OYUN MODU</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card mines-original-card" disabled={!admin.games.mines.enabled || admin.general.maintenanceMode} onClick={() => setRoom('mines')}><div className="instant-card-original-art mines"/><span>04 · MINES</span><h2>FORBIDDEN VAULT</h2><p>Sabit karelerini önceden seç. Her BET'te yeni gem ve mayın sonuçlarını topluca aç.</p><footer><b>SABİT SEÇİM · TOPLU SONUÇ</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card keno-card" disabled={!admin.games.keno.enabled || admin.general.maintenanceMode} onClick={() => setRoom('keno')}><div className="instant-card-original-art keno"/><span>05 · KENO</span><h2>OWL STAR MAP</h2><p>1–40 arasından yıldızlarını seç. 10 hızlı çekilişte eşleşmeleri yakala.</p><footer><b>3 RİSK SEVİYESİ</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card son-on-card" disabled={!admin.games['son-on'].enabled || admin.general.maintenanceMode} onClick={() => setRoom('son-on')}><div className="instant-card-countdown" /><span>06 · COUNTDOWN</span><h2>SON ON</h2><p>10’dan geriye inen saat kasası. Mührü aç, çarpanı büyüt veya tam vaktinde kasaya al.</p><footer><b>3 RİSK HATTI</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card plinko-card" disabled={!admin.games.plinko.enabled || admin.general.maintenanceMode} onClick={() => setRoom('plinko')}><div className="instant-card-plinko"><i /><i /><i /><i /><i /><b>●</b></div><span>07 · PLINKO</span><h2>PİRİNÇ GALERİ</h2><p>8–16 sıra, üç risk profili ve aynı anda beş top. Kenarı bul, çarpanı büyüt.</p><footer><b>HMAC DOĞRULAMALI</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card hilo-card" disabled={!admin.games.hilo.enabled || admin.general.maintenanceMode} onClick={() => setRoom('hilo')}><div className="instant-card-hilo"><i>7<span>♦</span></i><i>K<span>♠</span></i><b>↕</b></div><span>08 · HILO</span><h2>YÜKSEK / DÜŞÜK</h2><p>Bir kart açık. Sıradaki daha yüksek mi, daha düşük mü? Doğru bil, çarpanı büyüt, zamanında çık.</p><footer><b>HIZLI KART TAHMİNİ</b><em>OYNA →</em></footer></button>
      <button className="instant-game-card yedi-cevher-card" disabled={!admin.games['yedi-cevher'].enabled || admin.general.maintenanceMode} onClick={() => setRoom('yedi-cevher')}><div className="instant-card-yedi-cevher"><img src="/assets/instant/yedi-cevher/yedi-cevher-emblem-v1.png" alt=""/></div><span>09 · COMBO</span><h2>YEDİ CEVHER</h2><p>Beş mühür, yedi renk. Aynı cevherleri eşleştir; tek dokunuşta 50×’e kadar hükmünü aç.</p><footer><b>BAYKUŞUN MÜHRÜ</b><em>OYNA →</em></footer></button>
    </section>
    <footer className="instant-world-footer"><span>SADECE EĞLENCE İÇİN · SANAL PR</span><span>CRASH · LIMBO · OBSİDYEN · MINES · KENO · COUNTDOWN · PLINKO · HILO · YEDİ CEVHER</span></footer>
  </main>
}
