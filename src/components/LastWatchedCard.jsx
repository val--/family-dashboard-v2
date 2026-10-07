import { shortAgo } from './postit/theme'
import AutoScroll from './AutoScroll'

// The last movie watched, in the same frame as a new one: a smaller poster (the text matters more here),
// when it was watched, and all the anecdotes the Films tab already has about it (checked against Allociné
// and Wikipedia), scrolling slowly when they don't fit; its summary until they are written.
export default function LastWatchedCard({ movie, onClick }) {
  const anecdotes = movie.anecdotes || []
  return (
    <div onClick={onClick} className={`h-full w-[min(74vh,21rem)] flex flex-col overflow-hidden opacity-90 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="text-[0.7rem] uppercase leading-none tracking-widest text-white/45">Dernier film vu</div>
      <div className="mt-2.5 flex gap-3">
        {movie.thumb ? (
          <img src={movie.thumb} alt="" className="h-[8.5rem] aspect-[2/3] shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-[8.5rem] aspect-[2/3] shrink-0 rounded-md bg-white/10" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="line-clamp-3 text-2xl font-medium leading-tight text-white/95">{movie.title}</div>
          {movie.year && <div className="text-sm text-white/55">{movie.year}</div>}
          {movie.lastViewedAt > 0 && <div className="text-xs text-white/45">Vu {shortAgo(movie.lastViewedAt)}</div>}
        </div>
      </div>
      {anecdotes.length > 0 ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="text-xs uppercase tracking-wider text-white/45">Le saviez-vous ?</div>
          <AutoScroll className="min-h-0 flex-1">
            <div className="flex flex-col gap-1.5">
              {anecdotes.map((text) => (
                <p key={text} className="flex gap-1.5 text-[0.82rem] leading-[1.1rem] text-white/70">
                  <span className="shrink-0 text-amber-400">★</span>
                  <span>{text}</span>
                </p>
              ))}
            </div>
          </AutoScroll>
        </div>
      ) : (
        movie.summary && <p className="mt-2 line-clamp-6 text-[0.82rem] leading-[1.1rem] text-white/65">{movie.summary}</p>
      )}
    </div>
  )
}
