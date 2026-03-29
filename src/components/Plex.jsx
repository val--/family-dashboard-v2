import { usePlex } from '../hooks/usePlex'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

function thumbUrl(path) {
  return `${API_URL}/api/plex/thumb?path=${encodeURIComponent(path)}`
}

function MovieCard({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1 w-20">
      <div className="relative">
        {movie.thumb ? (
          <img
            src={thumbUrl(movie.thumb)}
            alt={movie.title}
            className="w-20 h-28 object-cover rounded"
          />
        ) : (
          <div className="w-20 h-28 bg-white/10 rounded" />
        )}
        {movie.watched && (
          <div className="absolute top-1 right-1 w-4 h-4 bg-green-500/80 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </div>
        )}
      </div>
      <span className="text-xs text-center text-white/70 line-clamp-2 leading-tight">
        {movie.title}
      </span>
    </div>
  )
}

export default function Plex() {
  const { movies, loading, error } = usePlex()

  if (error || loading || !movies || movies.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wider text-white/40">
        Derniers films
      </div>
      <div className="flex gap-3">
        {movies.map((movie, i) => (
          <MovieCard key={i} movie={movie} />
        ))}
      </div>
    </div>
  )
}
