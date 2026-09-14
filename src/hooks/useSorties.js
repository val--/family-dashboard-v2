import { useState, useEffect, useCallback } from 'react'
import { mockSorties } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 60 * 60 * 1000 // 1 hour
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useSorties() {
  const [data, setData] = useState(DEMO ? mockSorties : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchSorties = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/sorties`)
      if (!res.ok) throw new Error('Sorties API request failed')
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
    fetchSorties()
    const interval = setInterval(fetchSorties, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchSorties])

  return { data, loading, error }
}
