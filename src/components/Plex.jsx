import { usePlex } from '../hooks/usePlex'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5100'

function thumbUrl(path) {
  return `${API_URL}/api/plex/thumb?path=${encodeURIComponent(path)}`
}

function MovieCard({ movie }) {
  return (
    <div className="flex flex-col items-center gap-1 w-20">
      {movie.thumb ? (
        <img
          src={thumbUrl(movie.thumb)}
          alt={movie.title}
          className="w-20 h-28 object-cover rounded"
        />
      ) : (
        <div className="w-20 h-28 bg-white/10 rounded" />
      )}
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
