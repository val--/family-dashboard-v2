import { useState, useEffect, useCallback } from 'react'
import { mockPlex } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function usePlex() {
  const [movies, setMovies] = useState(DEMO ? mockPlex.movies : null)
  const [lastWatched, setLastWatched] = useState(DEMO ? mockPlex.lastWatched : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchData = useCallback(async () => {
    if (DEMO) return
    try {
      const [recentRes, watchedRes] = await Promise.all([
        fetch(`${API_URL}/api/plex/recent`),
        fetch(`${API_URL}/api/plex/last-watched`),
      ])

      if (recentRes.ok) {
        const json = await recentRes.json()
        if (!json.error) setMovies(json.movies)
      }

      if (watchedRes.ok) {
        const json = await watchedRes.json()
        if (json && !json.error) setLastWatched(json)
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

  return { movies, lastWatched, loading, error }
}
