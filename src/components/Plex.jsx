import { usePlex } from '../hooks/usePlex'

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp * 1000
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

function MovieItem({ movie }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/40 w-16 text-right shrink-0">
        {movie.addedAt ? timeAgo(movie.addedAt) : ''}
      </span>
      <span className="text-sm truncate">
        {movie.title}
        {movie.year && (
          <span className="text-white/30 ml-1">({movie.year})</span>
        )}
      </span>
    </div>
  )
}

export default function Plex() {
  const { movies, loading, error } = usePlex()

  if (error || loading || !movies) return null

  if (movies.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-white/40">
        Derniers films
      </div>
      <div className="flex flex-col gap-1">
        {movies.map((movie, i) => (
          <MovieItem key={i} movie={movie} />
        ))}
      </div>
    </div>
  )
}
