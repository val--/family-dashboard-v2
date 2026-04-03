import { memo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePlexShows } from '../hooks/usePlexShows'

const MAX_PREVIEW_SHOWS = 5

function timeAgo(timestamp) {
  const now = new Date()
  const added = new Date(timestamp * 1000)
  const diffMs = now - added
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return "À l'instant"

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const addedDay = new Date(added.getFullYear(), added.getMonth(), added.getDate())
  const days = Math.round((today - addedDay) / (1000 * 60 * 60 * 24))

  if (days === 0) return `Il y a ${hours}h`
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

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

function ShowCard({ show, onClick }) {
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
  const { shows, loading, error } = usePlexShows()
  const [selectedShow, setSelectedShow] = useState(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!shows?.length) return
    shows.forEach((show) => {
      if (show.thumb) {
        const img = new Image()
        img.src = show.thumb
      }
    })
  }, [shows])

  if (error || loading) return null
  if (!shows?.length) return null

  const perPage = MAX_PREVIEW_SHOWS
  const totalPages = Math.ceil(shows.length / perPage)
  const visibleShows = shows.slice(page * perPage, (page + 1) * perPage)

  return (
    <>
      <div className="flex flex-col h-full items-center w-full">
        <div className="flex flex-col gap-2 w-fit flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/40">Dernières séries ajoutées sur Plex</div>
          </div>
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
              {visibleShows.map((show, i) => (
                <ShowCard key={`${page}-${i}`} show={show} onClick={() => setSelectedShow(show)} />
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
      </div>
      {selectedShow && (
        <ShowDetailModal show={selectedShow} onClose={() => setSelectedShow(null)} />
      )}
    </>
  )
}

export default memo(Shows)
