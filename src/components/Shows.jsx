import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlexShows } from '../hooks/usePlexShows'
import { usePlexOnDeck } from '../hooks/usePlexOnDeck'

const MAX_RECENT = 4
const ONDECK_ROTATE_INTERVAL = 5000

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

function OnDeckSlide({ show, isActive }) {
  const pct = show.total ? Math.round((show.watched / show.total) * 100) : 0

  return (
    <div
      className="absolute inset-0 transition-opacity duration-700 ease-in-out"
      style={{ opacity: isActive ? 1 : 0 }}
    >
      <div className="relative w-full overflow-hidden rounded">
        {show.thumb ? (
          <img
            src={show.thumb}
            alt={show.show}
            className="w-full aspect-[2/3] object-cover"
          />
        ) : (
          <div className="w-full aspect-[2/3] bg-white/10" />
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500/80 rounded text-xs font-medium text-white whitespace-nowrap">
          S{String(show.season).padStart(2, '0')} · {show.watched}/{show.total}
        </div>
        {show.total && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      <div className="mt-1.5 text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {show.show}
      </div>
    </div>
  )
}

function OnDeckCard({ shows }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (shows.length <= 1) return
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % shows.length)
    }, ONDECK_ROTATE_INTERVAL)
    return () => clearInterval(timer)
  }, [shows.length])

  return (
    <div
      className="flex-1 max-w-36 relative"
      style={{ aspectRatio: '2/3.4' }}
    >
      {shows.map((show, i) => (
        <OnDeckSlide
          key={show.show}
          show={show}
          isActive={i === index % shows.length}
        />
      ))}
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
      <span className="text-sm text-center text-white/70 line-clamp-2 leading-tight">
        {show.show}
      </span>
    </div>
  )
}

function Shows() {
  const { shows: onDeck } = usePlexOnDeck()
  const { shows: recent, loading, error } = usePlexShows()
  const [selectedShow, setSelectedShow] = useState(null)
  const [page, setPage] = useState(0)

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

  const firstPageSize = hasOnDeck ? MAX_RECENT : MAX_RECENT + 1
  const fullPage = MAX_RECENT + 1
  const totalItems = recent?.length || 0
  const remaining = totalItems - firstPageSize
  const totalPages = totalItems <= firstPageSize ? 1 : 1 + Math.ceil(Math.max(0, remaining) / fullPage)
  const start = page === 0 ? 0 : firstPageSize + (page - 1) * fullPage
  const count = page === 0 ? firstPageSize : fullPage
  const visibleRecent = hasRecent ? recent.slice(start, start + count) : []

  return (
    <>
      <div className="flex flex-col h-full items-center w-full">
        <div className="flex flex-col gap-2 self-stretch" style={{ flex: '0 0 85%' }}>
          <div className="text-sm text-white/40">Derniers épisodes ajoutés sur Plex</div>
          <div className="flex items-center gap-1 flex-1 min-h-0">
            <button
              onClick={() => setPage(page - 1)}
              className={`text-3xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
                page > 0 ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-transparent pointer-events-none'
              }`}
            >
              &#8249;
            </button>
            <div className="flex items-start gap-4 flex-1 min-h-0">
              {hasOnDeck && page === 0 && (
                <OnDeckCard shows={onDeck} />
              )}
              {visibleRecent.map((show, i) => (
                <RecentCard key={`${page}-${i}`} show={show} onClick={() => setSelectedShow(show)} />
              ))}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              className={`text-3xl shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${
                page < totalPages - 1 ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-transparent pointer-events-none'
              }`}
            >
              &#8250;
            </button>
          </div>
        </div>
        <div className="w-full flex items-center justify-center" style={{ flex: '0 0 15%' }}>
          {hasOnDeck && onDeck[0]?.total && (
            <div className="text-sm text-white/50">
              Série en cours : <span className="text-white/70">{onDeck[0].show}</span>, encore {onDeck[0].total - onDeck[0].watched} épisode{onDeck[0].total - onDeck[0].watched > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
      {selectedShow && (
        <ShowDetailModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </>
  )
}

export default memo(Shows)
