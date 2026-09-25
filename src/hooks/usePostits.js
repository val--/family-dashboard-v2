import { useState, useEffect, useCallback } from 'react'
import { mockPostits } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'
const REFRESH_INTERVAL = 30 * 1000 // 30 seconds: a new note shows up quickly
const DEMO = import.meta.env.VITE_DEMO === 'true'
const SEEN_KEY = 'postits-last-seen'

export function usePostits() {
  const [data, setData] = useState(DEMO ? mockPostits : null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!DEMO)

  const fetchNotes = useCallback(async () => {
    if (DEMO) return
    try {
      const res = await fetch(`${API_URL}/api/postits`)
      if (!res.ok) throw new Error('Post-it API request failed')
      setData(await res.json())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    const interval = setInterval(fetchNotes, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNotes])

  return { notes: data?.notes ?? [], config: data?.config ?? null, loading, error }
}

function readSeen() {
  try {
    const value = localStorage.getItem(SEEN_KEY)
    return value === null ? null : Number(value)
  } catch {
    return null
  }
}

function writeSeen(value) {
  try {
    localStorage.setItem(SEEN_KEY, String(value))
  } catch {
    // private mode etc.: the badge just won't persist across reloads
  }
}

// True when a note newer than the last time the board was looked at exists.
// The first run only sets a baseline, so notes already there don't light the badge.
export function useUnseenPostits(notes, loaded, viewing) {
  const [lastSeen, setLastSeen] = useState(readSeen)
  const newest = notes.reduce((max, note) => Math.max(max, note.createdAt), 0)

  useEffect(() => {
    if (!loaded) return
    if (lastSeen === null || viewing) {
      writeSeen(newest)
      setLastSeen(newest)
    }
  }, [loaded, viewing, newest, lastSeen])

  return loaded && lastSeen !== null && newest > lastSeen
}
