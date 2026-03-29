import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes

export function usePlex() {
  const [movies, setMovies] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMovies = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/plex/recent`)
      if (!res.ok) throw new Error('Plex API request failed')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setMovies(json.movies)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMovies()
    const interval = setInterval(fetchMovies, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchMovies])

  return { movies, loading, error }
}
