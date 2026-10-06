import { mockCalendar } from '../mocks'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minutes
const selectEvents = (json) => json.events

export function useCalendar() {
  const { data: events, loading, error } = usePolling('/api/calendar', REFRESH_INTERVAL, {
    demo: mockCalendar.events,
    select: selectEvents,
    bodyErrors: true,
  })
  return { events, loading, error }
}
