import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 2 * 60 * 1000 // the API asks Plex, and each started show's progress (cached 10 min)
const selectEpisodes = (json) => json.episodes

// The latest episode added per started show (two weeks at most); the screensaver keeps the recent ones
export function usePlexNewEpisodes() {
  const { data } = usePolling('/api/plex/new-episodes', REFRESH_INTERVAL, { select: selectEpisodes, bodyErrors: true, tolerant: true })
  return data ?? []
}
