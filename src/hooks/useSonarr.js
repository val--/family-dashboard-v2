import { mockSonarr } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 10 * 1000 // 10 seconds

export function useSonarr() {
  const { data, loading, error } = usePolling('/api/sonarr/status', REFRESH_INTERVAL, { demo: mockSonarr, bodyErrors: true })
  return { data, loading, error }
}
