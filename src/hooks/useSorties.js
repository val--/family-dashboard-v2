import { mockSorties } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 60 * 1000 // 1 hour

export function useSorties() {
  const { data, loading, error } = usePolling('/api/sorties', REFRESH_INTERVAL, { demo: mockSorties, bodyErrors: true })
  return { data, loading, error }
}
