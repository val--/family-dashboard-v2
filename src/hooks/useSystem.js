import { mockSystem } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 10 * 1000 // 10 seconds: CPU and network are live values

export function useSystem() {
  const { data, loading, error } = usePolling('/api/system', REFRESH_INTERVAL, { demo: mockSystem })
  return { data, loading, error }
}
