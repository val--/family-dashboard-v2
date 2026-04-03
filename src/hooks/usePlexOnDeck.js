import { useState, useEffect, useCallback } from 'react'
import { mockPlexOnDeck } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 60 * 1000
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function usePlexOnDeck() {
  const [shows, setShows] = useState(DEMO ? mockPlexOnDeck.shows : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchData = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/plex/ondeck`)
      if (res.ok) {
        const json = await res.json()
        if (!json.error) setShows(json.shows)
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

  return { shows, loading, error }
}
