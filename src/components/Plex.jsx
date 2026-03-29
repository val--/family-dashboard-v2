import { memo, useState, useEffect } from 'react'
import { usePlex } from '../hooks/usePlex'
import { useRadarr } from '../hooks/useRadarr'

const MAX_PREVIEW_MOVIES = 4

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

const TICKER_INTERVAL = 5000

function RadarrTicker({ data }) {
  const [index, setIndex] = useState(0)

  const entries = []
  if (data?.downloading) {
    for (const m of data.downloading) {
      let text = `${m.title} (${m.year}) — ${m.progress}%`
      if (m.eta) {
        const mins = Math.max(0, Math.round((new Date(m.eta) - Date.now()) / 60000))
        if (mins < 60) text += ` (${mins}min)`
        else text += ` (~${Math.round(mins / 60)}h)`
      }
      entries.push({ type: 'downloading', text })
    }
  }
  if (data?.missing) {
    for (const m of data.missing) {
      entries.push({ type: 'missing', text: `${m.title} (${m.year})` })
    }
  }

  useEffect(() => {
    if (entries.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % entries.length)
    }, TICKER_INTERVAL)
    return () => clearInterval(timer)
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center text-base text-white/30">
        Pas de nouveaux films en attente
      </div>
    )
  }

  const current = entries[index % entries.length]

  return (
    <div
      className="flex items-center justify-center gap-2 text-base h-6 cursor-pointer"
      onClick={() => setIndex((i) => (i + 1) % entries.length)}
    >
      {current.type === 'downloading' ? (
        <>
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <span className="text-blue-400">En cours de téléchargement :</span>
          <span className="text-white/70">{current.text}</span>
        </>
      ) : (
        <>
          <span className="text-amber-400/70">À venir :</span>
          <span className="text-white/50">{current.text}</span>
        </>
      )}
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

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 flex items-start justify-center gap-4">
        {lastWatched && (
          <LastWatched movie={lastWatched} />
        )}
        {filteredMovies?.length > 0 &&
          filteredMovies.slice(0, MAX_PREVIEW_MOVIES).map((movie, i) => (
            <MovieCard key={i} movie={movie} />
          ))
        }
      </div>
      <RadarrTicker data={radarrData} />
    </div>
  )
}

export default memo(Plex)
