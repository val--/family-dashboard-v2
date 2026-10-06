import { useState, useCallback } from 'react'
import { API_URL } from '../api'

export function useMovieSearch() {
  const [results, setResults] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [addStatus, setAddStatus] = useState(null) // null | 'loading' | 'success' | 'error'

  const search = useCallback(async (term) => {
    if (!term.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const res = await fetch(`${API_URL}/api/radarr/search?term=${encodeURIComponent(term)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResults(json.results || [])
    } catch (err) {
      setError(err.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const addMovie = useCallback(async (tmdbId, qualityProfileId) => {
    setAddStatus('loading')
    try {
      const body = { tmdbId }
      if (qualityProfileId) body.qualityProfileId = qualityProfileId
      const res = await fetch(`${API_URL}/api/radarr/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAddStatus('success')
    } catch {
      setAddStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setResults([])
    setHasSearched(false)
    setError(null)
    setAddStatus(null)
  }, [])

  return { results, hasSearched, loading, error, addStatus, search, addMovie, reset }
}
