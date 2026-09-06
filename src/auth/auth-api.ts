let csrfToken = ''

export function clearAccountCsrfToken() {
  csrfToken = ''
}

export async function accountRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 20_000)
  try {
    const response = await fetch(path, {
      ...init,
      signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...init.headers,
      },
    })
    const payload = await response.json().catch((error: unknown) => {
      if (controller.signal.aborted || init.signal?.aborted) throw error
      return {}
    }) as T & { error?: string; csrfToken?: string }
    if (payload.csrfToken) csrfToken = payload.csrfToken
    if (!response.ok) {
      throw Object.assign(new Error(payload.error ?? `İstek başarısız (${response.status})`), {
        status: response.status,
        payload,
      })
    }
    return payload
  } catch (error) {
    if (controller.signal.aborted) {
      if (path === '/api/auth/login') throw new Error('Giriş yanıtı gecikti. Lütfen tekrar giriş yapın.')
      throw new Error(['GET', 'HEAD', 'OPTIONS'].includes(method)
        ? 'Sunucu yanıtı gecikti. Lütfen yeniden deneyin.'
        : 'Sunucu yanıtı gecikti. İşlem gerçekleşmiş olabilir; tekrar işlem yapmadan önce listeyi yenileyip kontrol edin.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
