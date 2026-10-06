import { mockPlex } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 1000 // 1 minute
const selectMovies = (json) => json.movies

// Plex down for a moment: the Films tab keeps the last list (tolerant)
export function usePlex() {
  const { data: movies, loading, error } = usePolling('/api/plex/recent', REFRESH_INTERVAL, {
    demo: mockPlex.movies,
    select: selectMovies,
    bodyErrors: true,
    tolerant: true,
  })
  return { movies, loading, error }
}
