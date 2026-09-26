import { useState, useEffect, useCallback } from 'react'
import { mockRecalbox } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 30 * 1000 // the API polls the box every minute in the background
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useRecalbox() {
  const [data, setData] = useState(DEMO ? mockRecalbox : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchStatus = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/recalbox`)
      if (!res.ok) throw new Error('Recalbox API request failed')
      setData(await res.json())
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
