import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlexShows } from '../hooks/usePlexShows'
import { usePlexOnDeck } from '../hooks/usePlexOnDeck'

const MAX_RECENT = 5
const MAX_ONDECK = 5

function ShowDetailModal({ show, onClose }) {
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
          {show.thumb ? (
            <img
              src={show.thumb}
              alt={show.show}
              className="h-full w-full object-cover rounded-lg"
            />
          ) : (
            <div className="h-full w-full bg-white/10 rounded-lg" />
          )}
        </div>
        <div className="flex flex-col gap-3 max-w-md">
          <h2 className="text-3xl font-light text-white">{show.show}</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-base text-white/40">
              S{String(show.season).padStart(2, '0')}E{String(show.episode).padStart(2, '0')}
            </span>
            {show.contentRating && (
              <span className="px-1.5 py-0.5 border border-white/20 rounded text-xs text-white/40">
                {show.contentRating}
              </span>
            )}
            {show.rating && (
              <span className="text-base text-amber-400">{show.rating}/10</span>
            )}
          </div>
          {show.title && (
            <div className="text-sm text-white/60 italic">"{show.title}"</div>
          )}
          {show.genres?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {show.genres.map((g) => (
                <span key={g} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/60">
                  {g}
                </span>
              ))}
            </div>
          )}
          {show.episodes > 1 && (
            <div className="text-sm text-white/40">
              {show.episodes} épisodes ajoutés récemment
            </div>
          )}
          {show.summary && (
            <p className="text-sm text-white/50 leading-relaxed line-clamp-5">
              {show.summary}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function OnDeckCard({ show }) {
  const pct = show.total ? Math.round((show.watched / show.total) * 100) : 0

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 max-w-36">
      <div className="relative w-full">
        {show.thumb ? (
          <img
            src={show.thumb}
            alt={show.show}
            className="w-full aspect-[2/3] object-cover rounded"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10 rounded" />
        )}
        {/* Progress bar overlay at bottom of poster */}
        {show.total && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 rounded-b overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <span className="text-sm text-center text-white/70 line-clamp-1 leading-tight w-full">
        {show.show}
      </span>
      <span className="text-xs text-white/40 leading-tight">
        Saison {show.season} · {show.watched}/{show.total} ép.
      </span>
    </div>
  )
}

function RecentCard({ show, onClick }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 flex-1 max-w-36 cursor-pointer"
      onClick={onClick}
    >
      <div className="relative w-full">
        {show.thumb ? (
          <img
            src={show.thumb}
            alt={show.show}
            className="w-full aspect-[2/3] object-cover rounded"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10 rounded" />
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          S{String(show.season).padStart(2, '0')}E{String(show.episode).padStart(2, '0')}
        </div>
        {show.watched && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-green-500/80 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          </div>
        )}
        {show.episodes > 1 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white/70">
            +{show.episodes - 1}
          </div>
        )}
      </div>
      <span className="text-sm text-center text-white/70 line-clamp-1 leading-tight w-full">
        {show.show}
      </span>
    </div>
  )
}

function Shows() {
  const { shows: onDeck } = usePlexOnDeck()
  const { shows: recent, loading, error } = usePlexShows()
  const [selectedShow, setSelectedShow] = useState(null)
  const [recentPage, setRecentPage] = useState(0)

  // Preload thumbs
  useEffect(() => {
    const all = [...(onDeck || []), ...(recent || [])]
    all.forEach((s) => {
      if (s.thumb) {
        const img = new Image()
        img.src = s.thumb
      }
    })
  }, [onDeck, recent])

  const hasOnDeck = onDeck?.length > 0
  const hasRecent = recent?.length > 0

  if (error || loading) return null
  if (!hasOnDeck && !hasRecent) return null

  const totalRecentPages = hasRecent ? Math.ceil(recent.length / MAX_RECENT) : 0
  const visibleRecent = hasRecent ? recent.slice(recentPage * MAX_RECENT, (recentPage + 1) * MAX_RECENT) : []

  return (
    <>
      <div className="flex flex-col h-full items-center w-full gap-3">
        {/* En cours */}
        {hasOnDeck && (
          <div className="flex flex-col gap-2 w-fit" style={{ flex: hasRecent ? '0 0 55%' : '1 1 auto' }}>
            <div className="text-sm text-white/40">En cours</div>
            <div className="flex items-start gap-4 flex-1 min-h-0">
              {onDeck.slice(0, MAX_ONDECK).map((show) => (
                <OnDeckCard key={show.show} show={show} />
              ))}
            </div>
          </div>
        )}

        {/* Récemment ajoutées */}
        {hasRecent && (
          <div className="flex flex-col gap-2 w-fit" style={{ flex: hasOnDeck ? '0 0 45%' : '1 1 auto' }}>
            <div className="text-sm text-white/40">Récemment ajoutées</div>
            <div className="flex items-center gap-1 flex-1 min-h-0">
              <button
                onClick={() => setRecentPage(recentPage - 1)}
                className={`text-3xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
                  recentPage > 0 ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-transparent pointer-events-none'
                }`}
              >
                &#8249;
              </button>
              <div className="flex items-start gap-4 flex-1 min-h-0">
                {visibleRecent.map((show, i) => (
                  <RecentCard key={`${recentPage}-${i}`} show={show} onClick={() => setSelectedShow(show)} />
                ))}
              </div>
              <button
                onClick={() => setRecentPage(recentPage + 1)}
                className={`text-3xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
                  recentPage < totalRecentPages - 1 ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-transparent pointer-events-none'
                }`}
              >
                &#8250;
              </button>
            </div>
          </div>
        )}
      </div>
      {selectedShow && (
        <ShowDetailModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </>
  )
}

export default memo(Shows)
