import { mockPrinter } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 60 * 1000 // 1 minute

export function usePrinter() {
  return usePolling('/api/printer', REFRESH_INTERVAL, { demo: mockPrinter })
}
