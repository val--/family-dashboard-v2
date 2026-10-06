import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePolling } from './usePolling'

// fetch answers, one per call (the last one repeats)
function mockFetch(...answers) {
  const calls = []
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    calls.push(url)
    const answer = answers[Math.min(calls.length - 1, answers.length - 1)]
    if (answer instanceof Error) throw answer
    return { ok: answer.status ? answer.status < 400 : true, status: answer.status ?? 200, json: async () => answer.body }
  }))
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('usePolling', () => {
  it('loads the route and returns its answer', async () => {
    const calls = mockFetch({ body: { healthy: true } })
    const { result } = renderHook(() => usePolling('/api/vpn', 60_000))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ healthy: true })
    expect(result.current.error).toBeNull()
    expect(calls[0]).toMatch(/\/api\/vpn$/)
  })

  it('reports an HTTP failure as an error', async () => {
    mockFetch({ status: 500, body: { error: 'boom' } })
    const { result } = renderHook(() => usePolling('/api/printer', 60_000))
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.data).toBeNull()
  })

  it('keeps { error } in a 200 as data by default (the VPN reports a broken tunnel that way)', async () => {
    mockFetch({ body: { healthy: false, error: 'tunnel down' } })
    const { result } = renderHook(() => usePolling('/api/vpn', 60_000))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ healthy: false, error: 'tunnel down' })
    expect(result.current.error).toBeNull()
  })

  it('treats { error } as a failure with bodyErrors', async () => {
    mockFetch({ body: { error: 'Radarr down' } })
    const { result } = renderHook(() => usePolling('/api/radarr/status', 60_000, { bodyErrors: true }))
    await waitFor(() => expect(result.current.error).toBe('Radarr down'))
  })

  it('keeps the last data without an error when tolerant', async () => {
    mockFetch({ body: { movies: ['Drive'] } }, { status: 500, body: {} })
    const select = (json) => json.movies
    const { result } = renderHook(() => usePolling('/api/plex/recent', 60_000, { select, bodyErrors: true, tolerant: true }))
    await waitFor(() => expect(result.current.data).toEqual(['Drive']))
    await act(() => result.current.refresh())
    expect(result.current.data).toEqual(['Drive'])
    expect(result.current.error).toBeNull()
  })

  it('still reports an unreachable API when tolerant', async () => {
    mockFetch(new Error('Failed to fetch'))
    const { result } = renderHook(() => usePolling('/api/plex/recent', 60_000, { tolerant: true }))
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch'))
  })

  it('keeps the previous data when select returns undefined', async () => {
    mockFetch({ body: { text: 'Anecdote' } }, { body: { text: null } })
    const select = (json) => (json.text ? json : undefined)
    const { result } = renderHook(() => usePolling('/api/plex/trivia', 60_000, { select }))
    await waitFor(() => expect(result.current.data?.text).toBe('Anecdote'))
    await act(() => result.current.refresh())
    expect(result.current.data.text).toBe('Anecdote')
  })

  it('asks again at each interval', async () => {
    vi.useFakeTimers()
    const calls = mockFetch({ body: {} })
    renderHook(() => usePolling('/api/system', 10_000))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(calls).toHaveLength(1)
    await act(() => vi.advanceTimersByTimeAsync(25_000))
    expect(calls).toHaveLength(3)
  })
})
