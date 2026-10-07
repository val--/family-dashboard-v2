import { shortAgo } from './postit/theme'

// A new episode of a show the family has started, in the same frame as a new movie. No spoiler: the
// picture is the show's poster, and the episode's own summary only shows once it was watched (the API
// doesn't even send it before). Until then, a reminder of where the story was left: the last episode
// watched before it, "Dans l'épisode précédent" or "Il y a N épisodes", with Gemini's short recap (Plex's
// summary of that episode until it is written).
export default function NewEpisodeCard({ episode, onClick }) {
  const others = episode.count - 1
  const before = !episode.watched && episode.previously
  const summary = episode.watched ? episode.summary : before ? before.recap || before.summary : episode.showSummary
  return (
    <div onClick={onClick} className={`h-full w-[min(74vh,21rem)] flex flex-col overflow-hidden opacity-90 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="text-[0.7rem] uppercase leading-none tracking-widest text-white/45">Nouvel épisode disponible</div>
      <div className="mt-2.5 flex gap-3">
        {episode.thumb ? (
          <img src={episode.thumb} alt="" className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md bg-white/10" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="line-clamp-3 text-2xl font-medium leading-tight text-white/95">{episode.show}</div>
          <div className="text-sm text-white/70">
            Saison {episode.season} · Épisode {episode.episode}
          </div>
          {episode.title && <div className="line-clamp-2 text-sm italic text-white/55">{episode.title}</div>}
          <div className="text-xs text-white/45">Ajouté {shortAgo(episode.addedAt)}</div>
          {others > 0 && (
            <div className="text-xs text-white/45">
              + {others} autre{others > 1 ? 's' : ''} nouvel{others > 1 ? 's' : ''} épisode{others > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
      {before && (
        <div className="mt-2 text-xs uppercase tracking-wider text-white/45">
          {before.distance === 1 ? "Dans l'épisode précédent" : `Il y a ${before.distance} épisodes`}
          <span className="normal-case tracking-normal"> · S{before.season}E{before.episode}</span>
        </div>
      )}
      {summary && <p className={`${before ? 'mt-1' : 'mt-2'} line-clamp-5 text-[0.82rem] leading-[1.1rem] text-white/65`}>{summary}</p>}
    </div>
  )
}
