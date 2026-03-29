import { useState, useEffect, useCallback } from 'react'
import { mockRadarr } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 60 * 1000 // 1 minute
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useRadarr() {
  const [data, setData] = useState(DEMO ? mockRadarr : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchStatus = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/radarr/status`)
      if (!res.ok) throw new Error('Radarr API request failed')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStatus])

  return { data, loading, error }
}
