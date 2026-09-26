const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

// The API keeps two versions of each photo: a 400 px thumbnail for the wall, a 1200 px one for full screen
export function photoUrl(name, full = false) {
  return `${API_URL}/api/postits/photos/${name}${full ? '' : '_thumb'}.jpg`
}

// The full-size version, served as a download (the phone saves it instead of just displaying it)
export function photoDownloadUrl(name) {
  return `${photoUrl(name, true)}?download=1`
}
