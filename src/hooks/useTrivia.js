import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 3 * 60 * 1000 // cheap: the API only reads its cache (anecdotes are made in the background)
const selectTrivia = (json) => (json.text ? json : undefined) // nothing yet for this movie: keep what we have

export function useTrivia() {
  const { data: trivia, loading } = usePolling('/api/plex/trivia', REFRESH_INTERVAL, { select: selectTrivia, tolerant: true })
  return { trivia, loading }
}
