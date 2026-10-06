import { mockRadarr } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 10 * 1000 // 10 seconds

export function useRadarr() {
  const { data, loading, error } = usePolling('/api/radarr/status', REFRESH_INTERVAL, { demo: mockRadarr, bodyErrors: true })
  return { data, loading, error }
}
