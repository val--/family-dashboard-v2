import { useCallback, useEffect, useState } from 'react'
import { API_URL, DEMO } from '../api'

// Reads an API route now and then every `intervalMs`. Returns { data, loading, error, refresh }.
// Options:
// - demo: what to show in a demo build (no call is made)
// - select(json): what to keep from the answer; undefined keeps the previous data
// - bodyErrors: an answer carrying { error } is a failure (some routes answer 200 with it on purpose:
//   the VPN reports a broken tunnel that way, and that must reach the card as data)
// - tolerant: on a failed answer, keep showing the last data without raising an error (only an
//   unreachable API does); for lists better shown stale than blank, like Plex's
export function usePolling(path, intervalMs, { demo = null, select, bodyErrors = false, tolerant = false } = {}) {
  const [data, setData] = useState(DEMO ? demo : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  // `select` comes from the calling module (a stable function): not a dependency
  const refresh = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}${path}`)
      const json = res.ok ? await res.json() : null
      const failure = !res.ok ? `${path}: HTTP ${res.status}` : bodyErrors && json.error ? json.error : null
      if (failure) {
        if (!tolerant) throw new Error(failure)
      } else {
        const value = select ? select(json) : json
        if (value !== undefined) setData(value)
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, intervalMs)
    return () => clearInterval(interval)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}
