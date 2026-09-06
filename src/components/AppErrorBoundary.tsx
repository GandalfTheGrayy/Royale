import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

const CHUNK_RECOVERY_KEY = 'pehlevan:chunk-recovery'

export function isRecoverableChunkLoadError(error: Error) {
  return /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk .* failed/i.test(
    `${error.name} ${error.message}`,
  )
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  private recoveryTimer: number | undefined

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Pehlevan Royale] Görünüm güvenli moda alındı.', error, info)

    if (!isRecoverableChunkLoadError(error)) return

    try {
      if (window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return
      window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
      window.location.reload()
    } catch {
      // Depolama kapalıysa kullanıcı ekrandaki yeniden yükleme düğmesini kullanabilir.
    }
  }

  componentDidMount() {
    this.recoveryTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY)
      } catch {
        // Gizli mod veya tarayıcı ilkeleri sessionStorage erişimini engelleyebilir.
      }
    }, 15_000)
  }

  componentWillUnmount() {
    if (this.recoveryTimer !== undefined) window.clearTimeout(this.recoveryTimer)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="app-error-screen">
      <section>
        <small>PEHLEVAN ROYALE · GÜVENLİ MOD</small>
        <h1>Bir oda açılırken kayıt uyuşmazlığı oluştu.</h1>
        <p>Bakiyen ve oyun kayıtların silinmedi. Ana salonu temiz biçimde yeniden yükleyebilirsin.</p>
        <button onClick={() => window.location.reload()}>ANA SALONU YENİDEN YÜKLE →</button>
        <details>
          <summary>Teknik ayrıntı</summary>
          <code>{this.state.error.message}</code>
        </details>
      </section>
    </main>
  }
}
