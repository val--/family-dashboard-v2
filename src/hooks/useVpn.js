import { mockVpn } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 1000 // 1 minute

// A broken tunnel comes as { healthy: false, error } with a 200: it is data for the card, not a failure
export function useVpn() {
  const { data, loading, error } = usePolling('/api/vpn', REFRESH_INTERVAL, { demo: mockVpn })
  return { data, loading, error }
}
