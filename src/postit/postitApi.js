import { API_URL } from '../api'

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

// A video goes whole (the server cuts the 10 s from `start`): it can weigh a lot, so the upload reports its
// progress (0 to 1) — fetch can't, hence XMLHttpRequest
export function createVideoNote(payload, video, start, onProgress) {
  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => value != null && form.append(key, value))
  form.append('start', String(start))
  form.append('video', video, video.name || 'video.mp4')
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/postits`)
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(event.loaded / event.total)
    xhr.onload = () => {
      let data = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        // not JSON: the generic message below
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data)
      const err = new Error(data.error || (xhr.status === 413 ? 'Vidéo trop lourde (300 Mo maximum)' : 'Une erreur est survenue'))
      err.status = xhr.status
      reject(err)
    }
    xhr.onerror = () => {
      const err = new Error("Impossible de joindre la maison. Es-tu bien connecté au Wi‑Fi ?")
      err.status = 0
      reject(err)
    }
    xhr.send(form)
  })
}
export const deleteNote = (id, auth) => request('DELETE', `/${id}`, auth)
