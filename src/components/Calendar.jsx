import { useState } from 'react'
import { useCalendar } from '../hooks/useCalendar'

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function groupByDate(events) {
  const groups = {}
  for (const event of events) {
    const key = event.allDay
      ? event.start
      : new Date(event.start).toISOString().slice(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  return Object.entries(groups)
}

function EventItem({ event }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-white/40 w-12 text-right shrink-0">
        {event.allDay ? 'Journée' : formatTime(event.start)}
      </span>
      <span className="text-sm truncate">{event.title}</span>
    </div>
  )
}

function DateGroup({ items }) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-0.5 capitalize">
        {formatDate(items[0].start)}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((event, i) => (
          <EventItem key={i} event={event} />
        ))}
      </div>
    </div>
  )
}

function CalendarModal({ groups, onClose }) {
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <div className="text-sm uppercase tracking-wider text-white/40">
          Agenda
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white text-2xl leading-none"
        >
          &times;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
        {groups.map(([date, items]) => (
          <DateGroup key={date} items={items} />
        ))}
      </div>
    </div>
  )
}

export default function Calendar() {
  const { events, loading, error } = useCalendar()
  const [showModal, setShowModal] = useState(false)

  if (error || loading || !events) return null

  if (events.length === 0) {
    return (
      <div className="text-white/30 text-sm">Aucun événement à venir</div>
    )
  }

  const allGroups = groupByDate(events)
  const previewGroups = allGroups.slice(0, 4)

  return (
    <>
      <div
        className="flex flex-col gap-2 cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {previewGroups.map(([date, items]) => (
          <DateGroup key={date} items={items} />
        ))}
      </div>
      {showModal && (
        <CalendarModal
          groups={allGroups}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
