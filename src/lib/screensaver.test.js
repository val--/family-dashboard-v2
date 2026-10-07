import { describe, expect, it } from 'vitest'
import { agendaPreview, notePool, recentEpisodes, recentMovies, screensaverItems, MAX_MOVIES } from './screensaver'

// Tuesday 6 October 2026, 14:30 local time
const NOW = new Date(2026, 9, 6, 14, 30)
const at = (day, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute) / 1000
const timed = (title, day, hour, endHour = hour + 1) => ({
  title,
  allDay: false,
  start: new Date(2026, 9, day, hour).toISOString(),
  end: new Date(2026, 9, day, endHour).toISOString(),
})
const allDay = (title, firstDay, lastDay = firstDay) => ({
  title,
  allDay: true,
  start: `2026-10-${String(firstDay).padStart(2, '0')}`,
  end: `2026-10-${String(lastDay + 1).padStart(2, '0')}`, // Google's end is exclusive
})

describe('agendaPreview', () => {
  it("shows what's left of today", () => {
    const preview = agendaPreview([timed('Dentiste', 6, 9), timed('Piscine', 6, 17), timed('Cinéma', 7, 20)], NOW)
    expect(preview).toEqual({ label: "Aujourd'hui", items: ['17:00 Piscine'], more: 0 })
  })

  it('counts an all-day event and one still going on as today', () => {
    const preview = agendaPreview([allDay('Vacances', 5, 9), timed('Réunion', 6, 14, 16)], NOW)
    expect(preview.label).toBe("Aujourd'hui")
    // the holidays started on an earlier day: no time shown
    expect(preview.items).toEqual(['Vacances', '14:00 Réunion'])
  })

  it('falls back to tomorrow, then the day after', () => {
    expect(agendaPreview([timed('Cinéma', 7, 20)], NOW).label).toBe('Demain')
    expect(agendaPreview([timed('Concert', 8, 21)], NOW).label).toBe('Après-demain')
    expect(agendaPreview([timed('Plus tard', 9, 10)], NOW)).toBeNull()
  })

  it('shows two events at most, sorted, and says how many more', () => {
    const events = [timed('C', 7, 18), timed('A', 7, 9), timed('B', 7, 12)]
    expect(agendaPreview(events, NOW)).toEqual({ label: 'Demain', items: ['09:00 A', '12:00 B'], more: 1 })
  })

  it('handles no events at all', () => {
    expect(agendaPreview([], NOW)).toBeNull()
    expect(agendaPreview(null, NOW)).toBeNull()
  })
})

describe('recentMovies', () => {
  const nowSeconds = NOW / 1000
  const movie = (title, daysAgo) => ({ title, addedAt: String(Math.round(nowSeconds - daysAgo * 86400)) })

  it('keeps the movies added in the last days, newest first', () => {
    const movies = [movie('Vieux', 5), movie('Hier', 1), movie('Ce matin', 0.2)]
    expect(recentMovies(movies, 3, nowSeconds).map((m) => m.title)).toEqual(['Ce matin', 'Hier'])
  })

  it('shows none when the setting is off', () => {
    expect(recentMovies([movie('Hier', 1)], 0, nowSeconds)).toEqual([])
  })

  it('stops at a few movies after a big batch', () => {
    const batch = Array.from({ length: 20 }, (_, i) => movie(`Film ${i}`, 0.5))
    expect(recentMovies(batch, 3, nowSeconds)).toHaveLength(MAX_MOVIES)
  })
})

describe('notePool', () => {
  const notes = [
    { id: 4, createdAt: at(6, 9) },
    { id: 3, createdAt: at(5, 22) },
    { id: 2, createdAt: at(4, 8) },
    { id: 1, createdAt: at(1, 8) },
  ]

  it("takes today's notes, else yesterday's", () => {
    expect(notePool(notes, 'today', NOW).map((n) => n.id)).toEqual([4])
    expect(notePool(notes.slice(1), 'today', NOW).map((n) => n.id)).toEqual([3])
    expect(notePool(notes.slice(2), 'today', NOW)).toEqual([])
  })

  it('takes calendar days for the last 3 days', () => {
    expect(notePool(notes, '3days', NOW).map((n) => n.id)).toEqual([4, 3, 2])
  })

  it('takes everything with "all"', () => {
    expect(notePool(notes, 'all', NOW)).toHaveLength(4)
  })
})

describe('screensaverItems', () => {
  const notes = [
    { id: 1, createdAt: at(6, 8) },
    { id: 2, createdAt: at(6, 14, 28) }, // two minutes ago
  ]
  const movies = [{ key: '42', title: 'Drive', addedAt: String(at(6, 10)) }]

  it('shows the notes newest first, then the new movies', () => {
    const { rotation, chronological } = screensaverItems({ notes, movies, now: NOW })
    expect(rotation.map((item) => item.id)).toEqual(['note-2', 'note-1', 'movie-42'])
    expect(chronological[0].id).toBe(2)
  })

  it('shows a note that just arrived alone, until it has been seen', () => {
    const { rotation, fresh } = screensaverItems({ notes, movies, hasNew: true, now: NOW })
    expect(rotation.map((item) => item.id)).toEqual(['note-2'])
    expect(fresh).toHaveLength(1)
  })

  it('shows only movies when no note goes round', () => {
    const { rotation } = screensaverItems({ notes: [], movies, now: NOW })
    expect(rotation.map((item) => item.id)).toEqual(['movie-42'])
  })

  it('is empty with nothing to show (the QR code invite then)', () => {
    expect(screensaverItems({ notes: [], movies: [], now: NOW }).rotation).toEqual([])
  })
})

describe('recentEpisodes', () => {
  const nowSeconds = NOW / 1000
  const day = 86400
  const episodes = [
    { key: 'a', show: 'MobLand', addedAt: nowSeconds - 1 * day, addedTimes: [nowSeconds - 1 * day, nowSeconds - 2 * day, nowSeconds - 6 * day] },
    { key: 'b', show: 'From', addedAt: nowSeconds - 5 * day, addedTimes: [nowSeconds - 5 * day] },
  ]

  it('keeps the shows with an episode added in the time chosen, counting only those episodes', () => {
    const recent = recentEpisodes(episodes, 3, nowSeconds)
    expect(recent.map((e) => [e.show, e.count])).toEqual([['MobLand', 2]])
    expect(recentEpisodes(episodes, 7, nowSeconds).map((e) => [e.show, e.count])).toEqual([['MobLand', 3], ['From', 1]])
  })

  it('shows none when the setting is off', () => {
    expect(recentEpisodes(episodes, 0, nowSeconds)).toEqual([])
  })

  it('goes round after the notes and the movies', () => {
    const { rotation } = screensaverItems({
      notes: [{ id: 1, createdAt: at(6, 8) }],
      movies: [{ key: '42', title: 'Drive', addedAt: String(at(6, 10)) }],
      episodes,
      now: NOW,
    })
    expect(rotation.map((item) => item.id)).toEqual(['note-1', 'movie-42', 'episode-a'])
  })
})
