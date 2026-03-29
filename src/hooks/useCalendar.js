import { useState, useEffect, useCallback } from 'react'
import { mockCalendar } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes
const DEMO = import.meta.env.VITE_DEMO === 'true'

export function useCalendar() {
  const [events, setEvents] = useState(DEMO ? mockCalendar.events : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchEvents = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/calendar`)
      if (!res.ok) throw new Error('Calendar API request failed')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setEvents(json.events)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    const interval = setInterval(fetchEvents, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return { events, loading, error }
}
