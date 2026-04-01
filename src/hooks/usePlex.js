import { useState, useEffect, useCallback } from 'react'
import { mockPlex } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 60 * 1000 // 1 minute
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function usePlex() {
  const [movies, setMovies] = useState(DEMO ? mockPlex.movies : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchData = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/plex/recent`)
      if (res.ok) {
        const json = await res.json()
        if (!json.error) setMovies(json.movies)
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  return { movies, loading, error }
}
