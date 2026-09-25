import { useState, useEffect, useCallback } from 'react'
import { mockSystem } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 10 * 1000 // 10 seconds: CPU and network are live values
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useSystem() {
  const [data, setData] = useState(DEMO ? mockSystem : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchStatus = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/system`)
      if (!res.ok) throw new Error('System API request failed')
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
