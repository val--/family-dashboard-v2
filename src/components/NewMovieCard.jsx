import { shortAgo } from './postit/theme'

// Plex sometimes leaves a genre in English
const GENRES_FR = {
  Action: 'Action', Adventure: 'Aventure', Animation: 'Animation', Biography: 'Biographie', Comedy: 'Comédie',
  Crime: 'Crime', Documentary: 'Documentaire', Drama: 'Drame', Family: 'Familial', Fantasy: 'Fantastique',
  History: 'Histoire', Horror: 'Horreur', Music: 'Musique', Musical: 'Comédie musicale', Mystery: 'Mystère',
  Romance: 'Romance', 'Science Fiction': 'Science-fiction', 'Sci-Fi': 'Science-fiction', Sport: 'Sport',
  Thriller: 'Thriller', War: 'Guerre', Western: 'Western',
}

function formatDuration(minutes) {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`
}

// An actor: round photo, first name over the rest of the name (both lines cut if too long)
function Actor({ actor }) {
  const [first, ...rest] = (actor.name || '').split(' ')
  return (
    <div className="flex w-[4.75rem] flex-col items-center gap-1">
      {actor.thumb ? (
        <img src={actor.thumb} alt="" className="h-11 w-11 rounded-full bg-white/10 object-cover object-top" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm text-white/50">{first?.[0]}</div>
      )}
      <div className="w-full text-center text-xs leading-[0.9rem] text-white/60">
        <div className="truncate">{first}</div>
        <div className="truncate">{rest.join(' ')}</div>
      </div>
    </div>
  )
}

// A new movie on Plex, as wide as a post-it and as tall as the stage: poster and details, the start of the
// summary (French, from Plex), and the main actors with their photos
export default function NewMovieCard({ movie, onClick }) {
  const details = [movie.year, formatDuration(movie.duration)].filter(Boolean).join(' · ')
  const cast = (movie.cast || []).slice(0, 4)
  return (
    <div onClick={onClick} className={`h-full w-[min(74vh,21rem)] flex flex-col overflow-hidden opacity-90 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="text-[0.7rem] uppercase leading-none tracking-widest text-white/45">Nouveau film disponible</div>
      <div className="mt-2.5 flex gap-3">
        {movie.thumb ? (
          <img src={movie.thumb} alt="" className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md bg-white/10" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="line-clamp-3 text-2xl font-medium leading-tight text-white/95">{movie.title}</div>
          {details && <div className="text-sm text-white/55">{details}</div>}
          {movie.genres?.length > 0 && <div className="truncate text-xs text-white/45">{[...new Set(movie.genres.map((g) => GENRES_FR[g] || g))].slice(0, 3).join(', ')}</div>}
          {movie.addedAt && <div className="text-xs text-white/45">Ajouté {shortAgo(Number(movie.addedAt))}</div>}
        </div>
      </div>
      {movie.summary && <p className="mt-2 line-clamp-5 text-[0.82rem] leading-[1.1rem] text-white/65">{movie.summary}</p>}
      {cast.length > 0 && (
        <div className="mt-auto flex justify-between pt-2">
          {cast.map((actor) => (
            <Actor key={actor.name} actor={actor} />
          ))}
        </div>
      )}
    </div>
  )
}
