import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSorties } from '../hooks/useSorties'

function formatDay(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatTimeRange(event) {
  if (event.allDay) return 'Journée'
  if (event.end) return `${event.start} – ${event.end}`
  return event.start
}

function EventItem({ event, onSelect }) {
  return (
    <button
      onClick={() => onSelect(event)}
      className="flex items-baseline gap-2 text-left w-full"
    >
      <span className="text-base text-white/30 w-16 text-right shrink-0 tabular-nums">
        {event.allDay ? 'Journée' : event.start}
      </span>
      <span className="w-px h-4 bg-white/10 shrink-0" />
      <span className="min-w-0">
        <span className="text-base text-white/90 line-clamp-1">{event.title}</span>
        {event.place && (
          <span className="block text-sm text-white/35 line-clamp-1">{event.place}</span>
        )}
      </span>
    </button>
  )
}

function DayColumn({ date, events, onSelect }) {
  return (
    <div className="flex flex-col min-w-0 bg-white/[0.04] rounded-lg overflow-hidden">
      <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
        <span className="text-base font-medium text-amber-400/80 capitalize">
          {formatDay(date)}
        </span>
        <span className="text-sm text-white/25 tabular-nums">{events.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2">
        {events.length === 0 ? (
          <span className="text-sm text-white/30">Aucun événement</span>
        ) : (
          events.map((event) => (
            <EventItem key={event.id} event={event} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  )
}

function EventModal({ event, onClose }) {
  const tags = [...event.categories, ...event.themes].filter(
    (tag, i, all) => all.indexOf(tag) === i
  )

  return createPortal(
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-end p-4">
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-3xl leading-none w-12 h-12 flex items-center justify-center"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 flex items-start justify-center gap-8 px-8 pb-8 overflow-y-auto">
        {event.image && (
          <img
            src={event.image}
            alt=""
            className="w-80 aspect-[4/3] object-cover rounded-lg shrink-0"
          />
        )}
        <div className="flex flex-col gap-3 max-w-xl">
          <h2 className="text-2xl font-light text-white">{event.title}</h2>

          <div className="flex items-center gap-3 text-base text-white/60">
            <span className="capitalize">{formatDay(event.date)}</span>
            <span className="text-white/20">·</span>
            <span className="tabular-nums">{formatTimeRange(event)}</span>
          </div>

          {event.place && <div className="text-base text-white/50">{event.place}</div>}
          {event.address && event.address !== event.place && (
            <div className="text-sm text-white/35">{event.address}</div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full bg-white/10 text-sm text-white/60"
                >
                  {tag}
                </span>
              ))}
              {event.free && (
                <span className="px-2.5 py-0.5 rounded-full bg-green-500/20 text-sm text-green-400">
                  Gratuit
                </span>
              )}
            </div>
          )}

          {event.description && (
            <p className="text-base text-white/60 leading-relaxed line-clamp-[12]">
              {event.description}
            </p>
          )}

          {!event.free && event.price && (
            <div className="text-sm text-white/40">Tarifs : {event.price}</div>
          )}
          {event.audience && (
            <div className="text-sm text-white/40">Public : {event.audience}</div>
          )}
          {event.organizer && (
            <div className="text-sm text-white/30">{event.organizer}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Sorties() {
  const { data, loading, error } = useSorties()
  const [selected, setSelected] = useState(null)

  if (error || loading || !data) return null

  if (data.events.length === 0) {
    return (
      <div className="text-white/30 text-sm">Aucune sortie ce week-end</div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 h-full">
        {data.days.map((day) => (
          <DayColumn
            key={day}
            date={day}
            events={data.events.filter((event) => event.date === day)}
            onSelect={setSelected}
          />
        ))}
      </div>
      {selected && (
        <EventModal event={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
