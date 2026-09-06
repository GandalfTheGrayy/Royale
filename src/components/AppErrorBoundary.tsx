import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Pehlevan Royale] Görünüm güvenli moda alındı.', error, info)
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

