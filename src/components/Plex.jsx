import { memo } from 'react'
import { usePlex } from '../hooks/usePlex'
import { useRadarr } from '../hooks/useRadarr'

const MAX_PREVIEW_MOVIES = 6

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
    <div className="flex flex-col items-center gap-1.5 w-28">
      <div className="relative">
        {movie.thumb ? (
          <img
            src={movie.thumb}
            alt={movie.title}
            className="w-28 h-44 object-cover rounded"
          />
        ) : (
          <div className="w-28 h-44 bg-white/10 rounded" />
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
    <div className="flex flex-col items-center gap-1.5 w-28">
      <div className="relative">
        {movie.thumb ? (
          <img
            src={movie.thumb}
            alt={movie.title}
            className="w-28 h-44 object-cover rounded"
          />
        ) : (
          <div className="w-28 h-44 bg-white/10 rounded" />
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

function RadarrTicker({ data }) {
  if (!data) return null

  const { downloading, missing } = data

  if (downloading?.length > 0) {
    const items = downloading.map((m) => {
      let text = `${m.title} (${m.year}) — ${m.progress}%`
      if (m.eta) {
        const mins = Math.max(0, Math.round((new Date(m.eta) - Date.now()) / 60000))
        if (mins < 60) text += ` (${mins}min)`
        else text += ` (~${Math.round(mins / 60)}h)`
      }
      return text
    })
    return (
      <div className="overflow-hidden whitespace-nowrap">
        <span className="inline-block animate-marquee text-base">
          <span className="text-blue-400">⬇ En cours de téléchargement :</span>{' '}
          <span className="text-white/70">{items.join('  •  ')}</span>
        </span>
      </div>
    )
  }

  if (missing?.length > 0) {
    const items = missing.map((m) => `${m.title} (${m.year})`)
    return (
      <div className="overflow-hidden whitespace-nowrap">
        <span className="inline-block animate-marquee text-base">
          <span className="text-amber-400/70">À venir :</span>{' '}
          <span className="text-white/50">{items.join('  •  ')}</span>
        </span>
      </div>
    )
  }

  return null
}

function Plex() {
  const { movies, lastWatched, loading, error } = usePlex()
  const { data: radarrData } = useRadarr()

  if (error || loading) return null
  if (!movies?.length && !lastWatched && !radarrData) return null

  const filteredMovies = lastWatched
    ? movies?.filter((m) => m.title !== lastWatched.title)
    : movies

  return (
    <div className="flex flex-col gap-4">
      <RadarrTicker data={radarrData} />
      <div className="flex items-start gap-4">
        {lastWatched && (
          <LastWatched movie={lastWatched} />
        )}
        {filteredMovies?.length > 0 &&
          filteredMovies.slice(0, MAX_PREVIEW_MOVIES).map((movie, i) => (
            <MovieCard key={i} movie={movie} />
          ))
        }
      </div>
    </div>
  )
}

export default memo(Plex)
