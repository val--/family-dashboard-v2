const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

async function request(method, path = '', body) {
  let res
  try {
    res = await fetch(`${API_URL}/api/postits${path}`, {
      method,
      // FormData (a note with a photo) sets its own multipart Content-Type
      headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      body: body instanceof FormData || body === undefined ? body : JSON.stringify(body),
    })
  } catch {
    const err = new Error("Impossible de joindre la maison. Es-tu bien connecté au Wi‑Fi ?")
    err.status = 0
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Une erreur est survenue')
    err.status = res.status
    throw err
  }
  return data
}

export const getNotes = () => request('GET')
export const verifyCode = (code) => request('POST', '/verify', { code })
export function createNote(payload, photo) {
  if (!photo) return request('POST', '', payload)
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => value != null && form.append(key, value))
  form.append('photo', photo, photo.name || 'photo.jpg')
  return request('POST', '', form)
}
export const deleteNote = (id, auth) => request('DELETE', `/${id}`, auth)
export const pinNote = (id, auth, pinned) => request('POST', `/${id}/pin`, { ...auth, pinned })
