import { memo, useState, useEffect } from 'react'
import { usePlex } from '../hooks/usePlex'
import { useRadarr } from '../hooks/useRadarr'

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

function DownloadingCard({ downloads }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (downloads.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % downloads.length)
    }, DOWNLOAD_ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [downloads.length])

  return (
    <div className="flex-1 max-w-36 relative" style={{ aspectRatio: '2/3.4' }}>
      {downloads.map((movie, i) => (
        <DownloadingSlide
          key={movie.title}
          movie={movie}
          isActive={i === index % downloads.length}
        />
      ))}
    </div>
  )
}

function MovieCard({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 max-w-36">
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

function LastWatched({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 max-w-36">
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
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          Vu {movie.lastViewedAt && timeAgo(movie.lastViewedAt).toLowerCase()}
        </div>
        <div className="absolute top-2 right-2 w-5 h-5 bg-green-500/80 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        </div>
      </div>
      <span className="text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </span>
    </div>
  )
}

function Plex() {
  const { movies, lastWatched, loading, error } = usePlex()
  const { data: radarrData } = useRadarr()

  if (error || loading) return null
  if (!movies?.length && !lastWatched && !radarrData) return null

  const filteredMovies = lastWatched
    ? movies?.filter((m) => m.title !== lastWatched.title)
    : movies

  const hasDownloads = radarrData?.downloading?.length > 0

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 flex items-start justify-center gap-4">
        {hasDownloads && (
          <DownloadingCard downloads={radarrData.downloading} />
        )}
        {lastWatched && (
          <LastWatched movie={lastWatched} />
        )}
        {filteredMovies?.length > 0 &&
          filteredMovies.slice(0, hasDownloads ? MAX_PREVIEW_MOVIES - 1 : MAX_PREVIEW_MOVIES).map((movie, i) => (
            <MovieCard key={i} movie={movie} />
          ))
        }
      </div>
    </div>
  )
}

export default memo(Plex)
