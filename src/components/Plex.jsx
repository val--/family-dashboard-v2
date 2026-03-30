import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlex } from '../hooks/usePlex'
import { useRadarr } from '../hooks/useRadarr'
import MovieSearch from './MovieSearch'

const MAX_PREVIEW_MOVIES = 4
const DOWNLOAD_ROTATE_INTERVAL = 5000

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp * 1000
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "À l'instant"
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

function DownloadingSlide({ movie, isActive }) {
  const progress = movie.progress || 0

  let etaText = ''
  if (movie.eta) {
    const mins = Math.max(0, Math.round((new Date(movie.eta) - Date.now()) / 60000))
    etaText = mins < 60 ? `${mins}min` : `~${Math.round(mins / 60)}h`
  }

  return (
    <div
      className="absolute inset-0 transition-opacity duration-700 ease-in-out"
      style={{ opacity: isActive ? 1 : 0 }}
    >
      <div className="relative w-full overflow-hidden rounded">
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover grayscale brightness-50"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10" />
        )}
        {movie.poster && (
          <div
            className="absolute bottom-0 left-0 right-0 overflow-hidden transition-[height] duration-1000 ease-out"
            style={{ height: `${progress}%` }}
          >
            <img
              src={movie.poster}
              alt=""
              className="absolute bottom-0 left-0 w-full aspect-[2/3] object-cover"
            />
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          {progress}%{etaText && ` · ${etaText}`}
        </div>
        <span className="absolute top-2 right-2 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
        </span>
      </div>
      <div className="mt-1.5 text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </div>
    </div>
  )
}

function WaitingSlide({ movie, isActive }) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-700 ease-in-out"
      style={{ opacity: isActive ? 1 : 0 }}
    >
      <div className="relative w-full overflow-hidden rounded">
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover grayscale brightness-50"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10" />
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          En attente
        </div>
      </div>
      <div className="mt-1.5 text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </div>
    </div>
  )
}

function StatusCard({ downloads, missing }) {
  const downloadTitles = new Set(downloads.map((m) => m.title))
  const slides = [
    ...downloads.map((m) => ({ ...m, type: 'downloading' })),
    ...missing.filter((m) => !downloadTitles.has(m.title)).map((m) => ({ ...m, type: 'waiting' })),
  ]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, DOWNLOAD_ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  return (
    <div className="flex-1 max-w-36 relative" style={{ aspectRatio: '2/3.4' }}>
      {slides.map((movie, i) => (
        movie.type === 'downloading' ? (
          <DownloadingSlide
            key={`dl-${movie.title}`}
            movie={movie}
            isActive={i === index % slides.length}
          />
        ) : (
          <WaitingSlide
            key={`wait-${movie.title}`}
            movie={movie}
            isActive={i === index % slides.length}
          />
        )
      ))}
    </div>
  )
}

function MovieDetailModal({ movie, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-end p-4">
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center gap-8 px-8 pb-8">
        <div className="h-full max-h-[70vh] aspect-[2/3] shrink-0">
          {movie.thumb ? (
            <img
              src={movie.thumb}
              alt={movie.title}
              className="h-full w-full object-cover rounded-lg"
            />
          ) : (
            <div className="h-full w-full bg-white/10 rounded-lg" />
          )}
        </div>
        <div className="flex flex-col gap-3 max-w-md">
          <h2 className="text-3xl font-light text-white">{movie.title}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {movie.year && (
              <span className="text-base text-white/40">{movie.year}</span>
            )}
            {movie.duration && (
              <span className="text-base text-white/40">{movie.duration} min</span>
            )}
            {movie.contentRating && (
              <span className="px-1.5 py-0.5 border border-white/20 rounded text-xs text-white/40">
                {movie.contentRating}
              </span>
            )}
            {movie.rating && (
              <span className="text-base text-amber-400">{movie.rating}/10</span>
            )}
          </div>
          {movie.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {movie.genres.map((g) => (
                <span key={g} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
                  {g}
                </span>
              ))}
            </div>
          )}
          {movie.directors?.length > 0 && (
            <div className="text-sm text-white/40">
              Réalisé par <span className="text-white/60">{movie.directors.join(', ')}</span>
            </div>
          )}
          {movie.actors?.length > 0 && (
            <div className="text-sm text-white/40">
              Avec <span className="text-white/60">{movie.actors.join(', ')}</span>
            </div>
          )}
          {movie.summary && (
            <p className="text-sm text-white/50 leading-relaxed line-clamp-5">
              {movie.summary}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function MovieCard({ movie, onClick }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 flex-1 max-w-36 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-full">
        {movie.thumb ? (
          <img
            src={movie.thumb}
            alt={movie.title}
            className="w-full aspect-[2/3] object-cover rounded"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10 rounded" />
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          Ajouté {movie.addedAt ? timeAgo(movie.addedAt).toLowerCase() : ''}
        </div>
        {movie.watched && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-green-500/80 rounded-full flex items-center justify-center">
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

function Plex() {
  const { movies, loading, error } = usePlex()
  const { data: radarrData } = useRadarr()
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [showSearch, setShowSearch] = useState(false)

  if (error || loading) return null
  if (!movies?.length && !radarrData) return null

  const downloads = radarrData?.downloading || []
  const missing = radarrData?.missing || []
  const hasStatus = downloads.length > 0 || missing.length > 0

  return (
    <>
      <div className="flex flex-col gap-3 h-full items-center">
        <div className="flex flex-col gap-3 w-fit">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/40">Derniers films ajoutés sur Plex</div>
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-sm text-white/60 hover:text-white"
            >
              Je cherche un film
            </button>
          </div>
          <div className="flex items-start gap-4">
            {hasStatus && (
              <StatusCard downloads={downloads} missing={missing} />
            )}
            {movies?.length > 0 &&
              movies.slice(0, hasStatus ? MAX_PREVIEW_MOVIES : MAX_PREVIEW_MOVIES + 1).map((movie, i) => (
                <MovieCard key={i} movie={movie} onClick={() => setSelectedMovie(movie)} />
              ))
            }
          </div>
        </div>
      </div>
      {selectedMovie && (
        <MovieDetailModal movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
      )}
      {showSearch && (
        <MovieSearch onClose={() => setShowSearch(false)} />
      )}
    </>
  )
}

export default memo(Plex)
