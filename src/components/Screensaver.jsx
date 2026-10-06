import { useEffect, useState } from 'react'
import { useClock } from '../hooks/useClock'
import PostitNote from './postit/Note'
import ArrowButton from './ArrowButton'
import Stamp from './postit/Stamp'
import QrCode from './QrCode'
import { POSTIT_URL } from './postit/links'
import { shortAgo } from './postit/theme'

const INVITE_AFTER_SECONDS = 2 * 86400 // nothing posted for this long: a big QR code invites to post
const FRESH_SECONDS = 5 * 60 // a note that just arrived is shown first for this long
const MAX_MOVIES = 8 // a big batch added to Plex at once must not make the rotation endless

// ---- A discreet look at what's coming: today's remaining events, else tomorrow's, else the day after's
const MAX_EVENTS = 2

function eventStart(event) {
  if (event.allDay) {
    const [y, m, d] = event.start.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(event.start)
}

function eventEnd(event) {
  if (event.allDay) {
    const [y, m, d] = event.end.split('-').map(Number) // exclusive: the day after the last one
    return new Date(y, m - 1, d)
  }
  return new Date(event.end)
}

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

const SHOWCASE_SIZE = 'h-[min(74vh,21rem)] aspect-square' // the right-hand square: a note, or a movie poster

// A new movie on Plex: its poster and its name, in the same square as a post-it
function MovieCard({ movie, onClick }) {
  return (
    <div onClick={onClick} className={`${SHOWCASE_SIZE} flex flex-col items-center justify-center gap-1.5 opacity-90 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="text-xs uppercase tracking-widest text-white/45">Nouveau film disponible</div>
      {movie.thumb ? (
        <img src={movie.thumb} alt="" className="h-[calc(min(74vh,21rem)_-_4.5rem)] aspect-[2/3] rounded-md object-cover" />
      ) : (
        <div className="h-[calc(min(74vh,21rem)_-_4.5rem)] aspect-[2/3] rounded-md bg-white/10" />
      )}
      <div className="max-w-full truncate text-lg leading-tight text-white/85">
        {movie.title}
        {movie.year && <span className="text-white/45"> ({movie.year})</span>}
      </div>
      {movie.addedAt && <div className="text-sm leading-none text-white/45">Ajouté {shortAgo(Number(movie.addedAt))}</div>}
    </div>
  )
}

// Minimal night-stand screen on pure black: clock, date, weather and agenda on the left, and on the right a
// small notification center going round: the recent post-its (big square notes), then the movies just added
// to Plex (poster and name). Nothing to show: the clock alone, centered, or the QR code inviting to post.
export default function Screensaver({
  weather, events, notes = [], movies = [], hasNew = false, onWake, onOpenNote, onAddNote, onOpenMovie, stickerViews,
  postitSeconds = 30, // from the Settings screen: time per item (the latest post-it: twice as long); 0 = stays
  postitRange = 'today', // 'today' (else yesterday), '3days' or 'all'
  movieDays = 3, // movies added this many days ago at most; 0 = no movies
}) {
  const { time, date } = useClock()
  // Weather only when it's complete: a partial answer must not take the screensaver down
  const current = weather?.current?.main && weather.current.weather?.[0] ? weather.current : null
  const [index, setIndex] = useState(0)

  useEffect(() => {
    window.addEventListener('keydown', onWake)
    return () => window.removeEventListener('keydown', onWake)
  }, [onWake])

  // Newest first (sorted here too, so the screensaver never depends on the API order): "the latest posted" is then
  // simply the first one, and the arrows walk back in time from there.
  const chronological = [...notes].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  const latestId = chronological[0]?.id
  const nowSeconds = Date.now() / 1000

  // Which notes go round (Settings): today's (else yesterday's), the last 3 days, or all of them.
  // Days are calendar days. Computed on every render: the clock ticks each second, so this follows midnight.
  const dayStart = (daysAgo) => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - daysAgo) // not "minus 24 h": DST days are 23 or 25 h long
    return d / 1000
  }
  let pool
  if (postitRange === 'all') {
    pool = chronological
  } else if (postitRange === '3days') {
    pool = chronological.filter((n) => n.createdAt >= dayStart(2))
  } else {
    const today = chronological.filter((n) => n.createdAt >= dayStart(0))
    pool = today.length > 0 ? today : chronological.filter((n) => n.createdAt >= dayStart(1) && n.createdAt < dayStart(0))
  }
  const newMovies = recentMovies(movies, movieDays, nowSeconds)

  // Fresh = arrived in the last few minutes and not looked at yet (hasNew: nobody opened the Post-it
  // tab since). While there are some, only they are shown, newest first; then the normal rotation:
  // the post-its, then the new movies. This component re-renders every second (clock), so the window closes by itself.
  const fresh = hasNew ? pool.filter((n) => nowSeconds - n.createdAt < FRESH_SECONDS) : []
  const asNote = (note) => ({ id: `note-${note.id}`, note })
  const rotation =
    fresh.length > 0
      ? fresh.map(asNote)
      : [...pool.map(asNote), ...newMovies.map((movie) => ({ id: `movie-${movie.key ?? movie.title}`, movie }))]
  const rotationKey = rotation.map((item) => item.id).join(',')

  useEffect(() => {
    setIndex(0) // a new arrival, a new movie or a new day starts again from the newest note
  }, [rotationKey])

  const count = rotation.length
  const position = count > 0 ? index % count : 0
  const item = count > 0 ? rotation[position] : null
  const note = item?.note ?? null
  const movie = item?.movie ?? null
  const browsable = count > 1

  // The latest posted note wears a stamp (only meaningful when there are other notes). It replaces the
  // "nouveau" pill on that note; the other fresh notes keep the pill.
  const isLatest = Boolean(note) && note.id === latestId && chronological.length > 1
  const duration = postitSeconds * 1000 * (isLatest ? 2 : 1)

  // Re-armed whenever the item changes, by itself or by hand: the item you just moved to gets its full time
  useEffect(() => {
    if (count <= 1 || !postitSeconds) return // 0 = 'always': no automatic change, arrows only
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), duration) // wraps back to the newest note
    return () => clearTimeout(timer)
  }, [count, index, duration])

  // Thin bar under the item that empties until the next one (restarted with the timer through its key)
  const countdown = browsable && postitSeconds > 0 && (
    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/15">
      <div
        key={`${item.id}-${index}-${count}`}
        className={`h-full w-full animate-countdown rounded-full ${isLatest ? 'bg-sky-400/80' : 'bg-white/50'}`}
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  )

  // Arrows browse the items and keep the screen asleep, so they must not bubble up to the wake-up tap.
  // By hand they stop at both ends (no left arrow on the first one); only the automatic rotation wraps.
  const go = (delta) => (event) => {
    event.stopPropagation()
    setIndex((i) => Math.min(count - 1, Math.max(0, (i % count) + delta))) // from the current position, even on rapid taps
  }
  const arrows = (direction) =>
    browsable && (
      <ArrowButton
        direction={direction}
        enabled={direction === 'prev' ? position > 0 : position < count - 1}
        label={direction === 'prev' ? 'Précédent' : 'Suivant'}
        onClick={go(direction === 'prev' ? -1 : 1)}
      />
    )
  const showcase = Boolean(item)

  // Nothing to show for 2 days (or no post-it at all) and no new movie: instead of the lone clock, a big QR code to the phone page
  const latestAt = chronological[0]?.createdAt
  const quietDays = latestAt ? Math.floor((nowSeconds - latestAt) / 86400) : null
  const invite = count === 0 && (latestAt == null || nowSeconds - latestAt > INVITE_AFTER_SECONDS)

  // A tap on the item opens it (the dashboard wakes up on the Post-it or Films tab); anywhere else just wakes
  const opener = (open, what) =>
    open
      ? (event) => {
          event.stopPropagation()
          open(what)
        }
      : undefined

  const agenda = agendaPreview(events)
  const agendaLine = agenda && (
    <div className={`mt-3 flex ${showcase ? 'max-w-[19rem]' : 'max-w-[28rem]'} items-center gap-2 text-base text-white/50`}>
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <span className="truncate">
        <span className="text-white/70">{agenda.label}</span> · {agenda.items.join(' · ')}
        {agenda.more > 0 && ` · +${agenda.more}`}
      </span>
    </div>
  )

  const weatherLine = current && (
    <div className={`flex items-center gap-3 text-white/60 ${showcase ? 'mt-4' : 'mt-6'}`}>
      <img
        src={`https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`}
        alt=""
        className="w-12 h-12"
      />
      <span className="text-3xl font-light">{Math.round(current.main.temp)}°</span>
      <span className="text-lg capitalize text-white/40">{current.weather[0].description}</span>
    </div>
  )

  const newBadge = fresh.length > 0 && !isLatest && (
    <span className="absolute -top-2 -right-2 rounded-full bg-sky-400 px-2 py-0.5 text-xs font-semibold text-black">
      nouveau
    </span>
  )

  return (
    <div
      onClick={onWake}
      className="visible fixed inset-0 z-[100] bg-black flex items-center justify-center select-none"
    >
      {invite ? (
        <div className="flex items-center justify-center gap-10 px-4">
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[7rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
            <div className="mt-3 text-xl capitalize text-white/50">{date}</div>
            {weatherLine}
            {agendaLine}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-3">
            <QrCode value={POSTIT_URL} className="h-[min(56vh,15rem)] aspect-square rounded-xl" />
            <div className="max-w-[17rem] text-center font-hand text-2xl font-semibold leading-tight text-white/85">
              {latestAt == null ? 'Colle le premier post-it !' : `Rien de neuf depuis ${quietDays} jours… Colle une photo !`}
            </div>
            <div className="text-sm text-white/45">Scanne avec ton téléphone (Wi‑Fi de la maison)</div>
          </div>
        </div>
      ) : showcase ? (
        <div className="flex items-center justify-center gap-8 px-4">
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[7rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
            <div className="mt-3 text-xl capitalize text-white/50">{date}</div>
            {weatherLine}
            {agendaLine}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {arrows('prev')}
            <div className="flex flex-col">
              {note ? (
                <div onClick={opener(onOpenNote, note)} className={`relative opacity-90 ${onOpenNote ? 'cursor-pointer' : ''}`}>
                  {/* A text-only note makes room at the top for the (one-line) stamp; on a photo the big stamp covers the picture's corner */}
                  <PostitNote
                    note={note}
                    size="lg"
                    rotate={-1}
                    showDate
                    showSticker={stickerViews?.isSticker(note.id)}
                    className={`${SHOWCASE_SIZE} ${isLatest && !note.photo ? 'pt-9' : ''}`}
                  />
                  {isLatest && <Stamp key={note.id} big={Boolean(note.photo)} />}
                  {newBadge}
                </div>
              ) : (
                <MovieCard movie={movie} onClick={opener(onOpenMovie, movie)} />
              )}
              {countdown}
              {onAddNote && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddNote()
                  }}
                  className="mt-2 self-end px-1 font-hand text-xl font-semibold text-white/60 active:text-white"
                >
                  Ajouter un post-it !
                </button>
              )}
            </div>
            {arrows('next')}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-[9rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
          <div className="mt-4 text-2xl capitalize text-white/50">{date}</div>
          {weatherLine}
          {agendaLine}
        </div>
      )}
    </div>
  )
}
