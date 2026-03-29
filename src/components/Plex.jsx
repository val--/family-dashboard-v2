import { useState, useEffect, useCallback } from 'react'
import { usePlex } from '../hooks/usePlex'
import { mockPlex } from '../mocks'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

function thumbUrl(path) {
  return `${API_URL}/api/plex/thumb?path=${encodeURIComponent(path)}`
}

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp * 1000
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "À l'instant"
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

function MovieCard({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      <div className="relative">
        {movie.thumb ? (
          <img
            src={thumbUrl(movie.thumb)}
            alt={movie.title}
            className="w-24 h-36 object-cover rounded"
          />
        ) : (
          <div className="w-24 h-36 bg-white/10 rounded" />
        )}
        {movie.watched && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-green-500/80 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </span>
    </div>
  )
}

function LastWatched({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-24">
      <div className="relative">
        {movie.thumb ? (
          <img
            src={thumbUrl(movie.thumb)}
            alt={movie.title}
            className="w-24 h-36 object-cover rounded"
          />
        ) : (
          <div className="w-24 h-36 bg-white/10 rounded" />
        )}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white/70 whitespace-nowrap">
          Vu {movie.lastViewedAt && timeAgo(movie.lastViewedAt).toLowerCase()}
        </div>
      </div>
      <span className="text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </span>
    </div>
  )
}

function PlexModal({ onClose }) {
  const [allMovies, setAllMovies] = useState(null)

  const DEMO = import.meta.env.VITE_DEMO === 'true'

  const fetchAll = useCallback(async () => {
    if (DEMO) {
      setAllMovies(mockPlex.movies)
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/plex/all`)
      if (!res.ok) return
      const json = await res.json()
      if (!json.error) setAllMovies(json.movies)
    } catch {}
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <div className="text-sm uppercase tracking-wider text-white/40">
          Tous les films
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {!allMovies ? (
          <div className="text-white/30 text-sm">Chargement…</div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {allMovies.map((movie, i) => (
              <MovieCard key={i} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Plex() {
  const { movies, lastWatched, loading, error } = usePlex()
  const [showModal, setShowModal] = useState(false)

  if (error || loading) return null
  if (!movies?.length && !lastWatched) return null

  const filteredMovies = lastWatched
    ? movies?.filter((m) => m.title !== lastWatched.title)
    : movies

  return (
    <>
      <div
        className="flex flex-col gap-2 cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <div className="text-sm uppercase tracking-wider text-white/40">
          Plex
        </div>
        <div className="flex items-start gap-4">
          {lastWatched && (
            <LastWatched movie={lastWatched} />
          )}
          {filteredMovies?.length > 0 &&
            filteredMovies.map((movie, i) => (
              <MovieCard key={i} movie={movie} />
            ))
          }
        </div>
      </div>
      {showModal && (
        <PlexModal onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
