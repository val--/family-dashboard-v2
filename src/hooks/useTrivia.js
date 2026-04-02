import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 10 * 60 * 1000 // 10 minutes
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useTrivia() {
  const [trivia, setTrivia] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchTrivia = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/plex/trivia`)
      if (res.ok) {
        const json = await res.json()
        if (json.text) setTrivia(json)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrivia()
    const interval = setInterval(fetchTrivia, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTrivia])

  return { trivia, loading }
}
