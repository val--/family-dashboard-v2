import { useCallback } from 'react'
import { API_URL } from '../api'
import { usePolling } from './usePolling'

const REFRESH_INTERVAL = 15 * 1000 // follows what is changed elsewhere (the Hue app, a switch on the wall)

async function send(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Le pont Hue ne répond pas')
  return json
}

// Hue rooms with their lights and scenes, and the three things the kiosk can do. Each action reads the
// bridge again right after, so the screen shows what really happened.
export function useHue() {
  const { data, loading, error, refresh } = usePolling('/api/hue', REFRESH_INTERVAL, { bodyErrors: true })

  const after = useCallback((promise) => promise.finally(refresh), [refresh])
  const setLight = useCallback((id, changes) => after(send('PUT', `/api/hue/lights/${id}`, changes)), [after])
  const setRoom = useCallback((groupId, changes) => after(send('PUT', `/api/hue/groups/${groupId}`, changes)), [after])
  const recallScene = useCallback((id) => after(send('POST', `/api/hue/scenes/${id}/recall`)), [after])

  // home: the whole home's group (every light of the bridge), for "Tout éteindre"
  return { rooms: data?.rooms ?? null, home: data?.home ?? null, loading, error, setLight, setRoom, recallScene }
}
