import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useCalendar } from '../hooks/useCalendar'

const NEAR_DAYS = 21 // events closer than this get a full card
const MAX_NEAR = 4
const MAX_LATER = 3
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// All-day events come as "YYYY-MM-DD": build a local date, not a UTC one
function eventStart(event) {
  if (event.allDay) {
    const [y, m, d] = event.start.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(event.start)
}

// Google's all-day end date is exclusive: the last day is the day before
function eventLastDay(event) {
  if (event.allDay) {
    const [y, m, d] = event.end.split('-').map(Number)
    return new Date(y, m - 1, d - 1)
  }
  return startOfDay(new Date(event.end))
}

function daysUntil(event, now) {
  return Math.round((startOfDay(eventStart(event)) - startOfDay(now)) / DAY_MS)
}

function relativeLabel(days) {
  if (days < 0) return 'En cours'
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Demain'
  if (days < 14) return `Dans ${days} j`
  if (days < 60) return `Dans ${Math.round(days / 7)} sem.`
  return `Dans ${Math.round(days / 30)} mois`
}

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit' }

function timeLabel(event) {
  return event.allDay ? 'Journée' : new Date(event.start).toLocaleTimeString('fr-FR', TIME_FORMAT)
}

function shortPlace(location) {
  return location ? location.split(',')[0].trim() : null
}

function groupByDay(events) {
  const groups = new Map()
  for (const event of events) {
    const day = startOfDay(eventStart(event))
    if (!groups.has(day.getTime())) groups.set(day.getTime(), { day, items: [] })
    groups.get(day.getTime()).items.push(event)
  }
  return [...groups.values()]
}

function DateTile({ date, soon }) {
  return (
    <div
      className={`w-12 shrink-0 rounded-lg py-1 text-center leading-none ${
        soon ? 'bg-sky-400 text-black' : 'bg-white/20 text-white'
      }`}
    >
      <div className="text-xs uppercase tracking-wide">
        {date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
      </div>
      <div className="mt-0.5 text-2xl font-medium">{date.getDate()}</div>
    </div>
  )
}

function Relative({ days }) {
  return (
    <span className={`text-sm shrink-0 ${days <= 1 ? 'text-sky-300 font-semibold' : 'text-white/60'}`}>
      {relativeLabel(days)}
    </span>
  )
}

function EventCard({ event, now, onSelect }) {
  const days = daysUntil(event, now)
  const place = shortPlace(event.location)

  return (
    <button
      onClick={() => onSelect(event)}
      className="flex items-center gap-3 min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-left"
    >
      <DateTile date={eventStart(event)} soon={days <= 1} />
      <div className="min-w-0 flex-1">
        <div className="text-base leading-tight line-clamp-2 text-white">{event.title}</div>
        <div className="mt-0.5 text-sm leading-tight text-white/70 truncate">
          {timeLabel(event)}
          {place && ` · 📍 ${place}`}
        </div>
      </div>
      <Relative days={days} />
    </button>
  )
}

function LaterRow({ event, now, onSelect }) {
  const date = eventStart(event)

  return (
    <button onClick={() => onSelect(event)} className="flex w-full items-baseline gap-3 px-3 py-1.5 text-left">
      <span className="w-24 shrink-0 text-sm capitalize text-sky-300">
        {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
      <span className="min-w-0 flex-1 truncate text-base text-white">{event.title}</span>
      <Relative days={daysUntil(event, now)} />
    </button>
  )
}

function ModalShell({ title, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between pl-6 pr-2 pt-2">
        <div className="text-sm uppercase tracking-wider text-white/60">{title}</div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="text-white/70 hover:text-white text-3xl leading-none w-12 h-12 flex items-center justify-center"
        >
          &times;
        </button>
      </div>
      {children}
    </div>,
    document.body,
  )
}

function EventDetailModal({ event, now, onClose }) {
  const start = eventStart(event)
  const lastDay = eventLastDay(event)
  const multiDay = lastDay > startOfDay(start)
  const dayFormat = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const shortDay = { day: 'numeric', month: 'long' }

  let when
  if (event.allDay) {
    when = multiDay
      ? `Du ${start.toLocaleDateString('fr-FR', shortDay)} au ${lastDay.toLocaleDateString('fr-FR', shortDay)}`
      : 'Toute la journée'
  } else {
    const end = new Date(event.end)
    const endTime = end.toLocaleTimeString('fr-FR', TIME_FORMAT)
    when = multiDay
      ? `${timeLabel(event)} → ${end.toLocaleDateString('fr-FR', shortDay)}, ${endTime}`
      : `${timeLabel(event)} – ${endTime}`
  }

  return (
    <ModalShell title="Agenda" onClose={onClose}>
      <div className="flex-1 overflow-y-auto flex items-center justify-center gap-6 px-8 pb-8">
        <DateTile date={start} soon={daysUntil(event, now) <= 1} />
        <div className="flex flex-col gap-2 max-w-xl">
          <h2 className="text-3xl font-light text-white">{event.title}</h2>
          <div className="text-lg capitalize text-white/85">{start.toLocaleDateString('fr-FR', dayFormat)}</div>
          <div className="text-lg text-white/70">{when}</div>
          {event.location && <div className="text-base text-white/70">📍 {event.location}</div>}
          <div className="mt-1">
            <Relative days={daysUntil(event, now)} />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function AgendaModal({ events, now, onClose, onSelect }) {
  return (
    <ModalShell title="Agenda" onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        {groupByDay(events).map(({ day, items }) => (
          <div key={day.getTime()} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-base font-medium capitalize text-sky-300">
                {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <Relative days={daysUntil(items[0], now)} />
            </div>
            {items.map((event) => (
              <button
                key={`${event.start}-${event.title}`}
                onClick={() => onSelect(event)}
                className="flex items-baseline gap-3 text-left"
              >
                <span className="w-16 shrink-0 text-right text-base tabular-nums text-white/60">{timeLabel(event)}</span>
                <span className="text-base text-white">{event.title}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </ModalShell>
  )
}

export default function Calendar() {
  const { events, loading, error } = useCalendar()
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)

  if (error || loading || !events) return null

  if (events.length === 0) {
    return <div className="text-white/60 text-sm">Aucun événement à venir</div>
  }

  const now = new Date()
  // Events are sorted by start date, so the near ones are a prefix of the list
  const near = events.filter((event) => daysUntil(event, now) <= NEAR_DAYS).slice(0, MAX_NEAR)
  const later = events.slice(near.length)

  return (
    <>
      <div className="h-full overflow-y-auto flex flex-col gap-3">
        {near.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {near.map((event) => (
              <EventCard key={`${event.start}-${event.title}`} event={event} now={now} onSelect={setSelected} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white/70">
            Rien de prévu dans les 3 prochaines semaines
          </div>
        )}
        {later.length > 0 && (
          <div>
            <div className="mb-1 px-1 text-xs uppercase tracking-wider text-white/60">Plus tard</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] divide-y divide-white/10">
              {later.slice(0, MAX_LATER).map((event) => (
                <LaterRow key={`${event.start}-${event.title}`} event={event} now={now} onSelect={setSelected} />
              ))}
            </div>
            {later.length > MAX_LATER && (
              <button onClick={() => setShowAll(true)} className="mt-1 px-1 py-1 text-sm text-sky-300">
                + {later.length - MAX_LATER} autre{later.length - MAX_LATER > 1 ? 's' : ''} · Tout l'agenda
              </button>
            )}
          </div>
        )}
      </div>
      {showAll && (
        <AgendaModal events={events} now={now} onClose={() => setShowAll(false)} onSelect={setSelected} />
      )}
      {selected && <EventDetailModal event={selected} now={now} onClose={() => setSelected(null)} />}
    </>
  )
}
