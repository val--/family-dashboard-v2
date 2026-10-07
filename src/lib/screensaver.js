import { eventEnd, eventStart } from './events'

// What the screensaver shows, as plain functions (no React): which notes and movies go round, in which
// order, and the one-line look at the agenda. Tested in screensaver.test.js.

export const FRESH_SECONDS = 5 * 60 // a note that just arrived is shown first for this long
export const MAX_MOVIES = 8 // a big batch added to Plex at once must not make the rotation endless

// ---- A discreet look at what's coming: today's remaining events, else tomorrow's, else the day after's
const MAX_EVENTS = 2

export function agendaPreview(events, now = new Date()) {
  if (!events?.length) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const dayAfter = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)
  const dayAfterEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)
  const byStart = [...events].sort((a, b) => eventStart(a) - eventStart(b))
  const startingOn = (from, to) => byStart.filter((e) => eventStart(e) >= from && eventStart(e) < to)
  // today: not over yet (ongoing ones and all-day ones included); then the first of the next two days with something
  const days = [
    ["Aujourd'hui", byStart.filter((e) => eventStart(e) < tomorrow && eventEnd(e) > now)],
    ['Demain', startingOn(tomorrow, dayAfter)],
    ['Après-demain', startingOn(dayAfter, dayAfterEnd)],
  ]
  const [label, list] = days.find(([, found]) => found.length) || [null, []]
  if (!label) return null
  const items = list.slice(0, MAX_EVENTS).map((e) => {
    const start = eventStart(e)
    const timed = !e.allDay && start >= today // an event started on an earlier day shows no time
    return timed ? `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ${e.title}` : e.title
  })
  return { label, items, more: list.length - items.length }
}

// The latest movies added to Plex, newest first: the ones added in the last `days` days (0 = none)
export function recentMovies(movies, days, nowSeconds = Date.now() / 1000) {
  if (!days || !movies?.length) return []
  return movies
    .filter((m) => m.addedAt && nowSeconds - Number(m.addedAt) < days * 86400)
    .sort((a, b) => Number(b.addedAt) - Number(a.addedAt))
    .slice(0, MAX_MOVIES)
}

// The new episodes of started shows (the API keeps those only), added in the last `days` days (0 = none),
// newest first. `count`: how many of that show's episodes came in that time.
export function recentEpisodes(episodes, days, nowSeconds = Date.now() / 1000) {
  if (!days || !episodes?.length) return []
  const since = nowSeconds - days * 86400
  return episodes
    .filter((e) => e.addedAt >= since)
    .map((e) => ({ ...e, count: (e.addedTimes || [e.addedAt]).filter((t) => t >= since).length }))
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, MAX_MOVIES)
}

// Notes that go round (Settings): today's (else yesterday's), the last 3 days, or all of them.
// Days are calendar days, not "minus 24 h": DST days are 23 or 25 h long.
export function notePool(chronological, range, now = new Date()) {
  const dayStart = (daysAgo) => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - daysAgo)
    return d / 1000
  }
  if (range === 'all') return chronological
  if (range === '3days') return chronological.filter((n) => n.createdAt >= dayStart(2))
  const today = chronological.filter((n) => n.createdAt >= dayStart(0))
  return today.length > 0 ? today : chronological.filter((n) => n.createdAt >= dayStart(1) && n.createdAt < dayStart(0))
}

// The rotation: the notes of the pool, newest first, then the new movies, then the new episodes. Fresh notes (arrived in the last
// few minutes and not looked at yet: hasNew) go round alone while there are some.
// Returns { chronological (all notes, newest first), fresh, rotation: [{ id, note } | { id, movie } | { id, episode }] }.
export function screensaverItems({
  notes = [], movies = [], episodes = [], hasNew = false, postitRange = 'today', movieDays = 3, episodeDays = 3, now = new Date(),
}) {
  // sorted here, so the screensaver never depends on the API order: "the latest posted" is the first one
  const chronological = [...notes].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  const nowSeconds = now / 1000
  const pool = notePool(chronological, postitRange, now)
  const fresh = hasNew ? pool.filter((n) => nowSeconds - n.createdAt < FRESH_SECONDS) : []
  const asNote = (note) => ({ id: `note-${note.id}`, note })
  const rotation =
    fresh.length > 0
      ? fresh.map(asNote)
      : [
          ...pool.map(asNote),
          ...recentMovies(movies, movieDays, nowSeconds).map((movie) => ({ id: `movie-${movie.key ?? movie.title}`, movie })),
          ...recentEpisodes(episodes, episodeDays, nowSeconds).map((episode) => ({ id: `episode-${episode.key}`, episode })),
        ]
  return { chronological, fresh, rotation }
}
