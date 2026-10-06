import { mockPlexShows } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 1000 // 1 minute
const selectShows = (json) => json.shows

export function usePlexShows() {
  const { data: shows, loading, error } = usePolling('/api/plex/shows', REFRESH_INTERVAL, {
    demo: mockPlexShows.shows,
    select: selectShows,
    bodyErrors: true,
    tolerant: true,
  })
  return { shows, loading, error }
}
