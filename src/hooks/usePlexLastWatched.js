import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 2 * 60 * 1000
const selectMovie = (json) => json.movie

// The last movie watched on Plex, with its anecdotes when they are ready (null when none was watched)
export function usePlexLastWatched() {
  const { data } = usePolling('/api/plex/last-watched', REFRESH_INTERVAL, { select: selectMovie, bodyErrors: true, tolerant: true })
  return data ?? null
}
