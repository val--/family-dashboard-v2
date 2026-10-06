import { mockPlexOnDeck } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 1000
const selectShows = (json) => json.shows

export function usePlexOnDeck() {
  const { data: shows, loading, error } = usePolling('/api/plex/ondeck', REFRESH_INTERVAL, {
    demo: mockPlexOnDeck.shows,
    select: selectShows,
    bodyErrors: true,
    tolerant: true,
  })
  return { shows, loading, error }
}
