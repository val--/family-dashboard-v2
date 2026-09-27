import { useCallback, useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 5 * 60 * 1000 // in case they were changed from another screen
const DEFAULTS = { idleMinutes: 5, postitSeconds: 30, postitRange: 'today' }

// Dashboard settings, stored by the API (data/settings.json)
export function useSettings() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`)
      if (res.ok) setSettings({ ...DEFAULTS, ...(await res.json()) })
    } catch {
      // keep what we have
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  // Applied at once on screen, then saved; reverted if the API refuses
  const update = useCallback(async (changes) => {
    let previous
    setSettings((current) => {
      previous = current
      return { ...current, ...changes }
    })
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Enregistrement impossible')
      setSettings({ ...DEFAULTS, ...json })
    } catch (err) {
      setSettings(previous)
      setError(err.message)
    }
  }, [])

  return { settings, update, error }
}
