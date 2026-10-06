import { useState, useEffect } from 'react'
import { mockPostits } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 30 * 1000 // 30 seconds: a new note shows up quickly
const SEEN_KEY = 'postits-last-seen'

export function usePostits() {
  const { data, loading, error } = usePolling('/api/postits', REFRESH_INTERVAL, { demo: mockPostits })
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
