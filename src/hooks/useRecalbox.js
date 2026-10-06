import { mockRecalbox } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 30 * 1000 // the API polls the box every minute in the background

export function useRecalbox() {
  const { data, loading, error } = usePolling('/api/recalbox', REFRESH_INTERVAL, { demo: mockRecalbox })
  return { data, loading, error }
}
