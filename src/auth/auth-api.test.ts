import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountRequest, clearAccountCsrfToken } from './auth-api'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); clearAccountCsrfToken() })

describe('account request timeout', () => {
  it('aborts a stalled mutation without retrying or claiming that it failed', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_path: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = accountRequest('/api/admin/accounts/users/test/approve', { method: 'POST' })
    const assertion = expect(result).rejects.toThrow('İşlem gerçekleşmiş olabilir')
    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps CSRF protection and clears the deadline after success', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'test-csrf' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    await accountRequest('/api/auth/session')
    await expect(accountRequest('/api/action', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBe('test-csrf')
    expect(vi.getTimerCount()).toBe(0)
  })
})
