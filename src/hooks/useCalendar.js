import { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes

export function useCalendar() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
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
