let csrfToken = ''

export function clearAccountCsrfToken() {
  csrfToken = ''
}

export async function accountRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => ({})) as T & { error?: string; csrfToken?: string }
  if (payload.csrfToken) csrfToken = payload.csrfToken
  if (!response.ok) {
    throw Object.assign(new Error(payload.error ?? `İstek başarısız (${response.status})`), {
      status: response.status,
      payload,
    })
  }
  return payload
}
