import { useEffect, useState } from 'react'
import { useClock } from '../hooks/useClock'
import PostitNote from './postit/Note'
import ArrowButton from './ArrowButton'
import Stamp from './postit/Stamp'
import QrCode from './QrCode'
import { POSTIT_URL } from './postit/links'
import { shortAgo } from './postit/theme'
import { agendaPreview, screensaverItems } from '../lib/screensaver'

const INVITE_AFTER_SECONDS = 2 * 86400 // nothing posted for this long: a big QR code invites to post

const SHOWCASE_SIZE = 'h-[min(74vh,21rem)] aspect-square' // a note: the right-hand square
// The stage on the right is taller than a note: a movie card uses the whole height (bigger poster and title),
// a note sits centered in it. Same height for both, so what's below doesn't move from one item to the next.
const STAGE_HEIGHT = 'h-[min(84vh,25rem)]'

// Plex sometimes leaves a genre in English
const GENRES_FR = {
  Action: 'Action', Adventure: 'Aventure', Animation: 'Animation', Biography: 'Biographie', Comedy: 'Comédie',
  Crime: 'Crime', Documentary: 'Documentaire', Drama: 'Drame', Family: 'Familial', Fantasy: 'Fantastique',
  History: 'Histoire', Horror: 'Horreur', Music: 'Musique', Musical: 'Comédie musicale', Mystery: 'Mystère',
  Romance: 'Romance', 'Science Fiction': 'Science-fiction', 'Sci-Fi': 'Science-fiction', Sport: 'Sport',
  Thriller: 'Thriller', War: 'Guerre', Western: 'Western',
}

function formatDuration(minutes) {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}` : `${m} min`
}

// An actor: round photo, first name over the rest of the name (both lines cut if too long)
function Actor({ actor }) {
  const [first, ...rest] = (actor.name || '').split(' ')
  return (
    <div className="flex w-[4.75rem] flex-col items-center gap-1">
      {actor.thumb ? (
        <img src={actor.thumb} alt="" className="h-11 w-11 rounded-full bg-white/10 object-cover object-top" />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm text-white/50">{first?.[0]}</div>
      )}
      <div className="w-full text-center text-xs leading-[0.9rem] text-white/60">
        <div className="truncate">{first}</div>
        <div className="truncate">{rest.join(' ')}</div>
      </div>
    </div>
  )
}

// A new movie on Plex, as wide as a post-it and as tall as the stage: poster and details, the start of the
// summary (French, from Plex), and the main actors with their photos
function MovieCard({ movie, onClick }) {
  const details = [movie.year, formatDuration(movie.duration)].filter(Boolean).join(' · ')
  const cast = (movie.cast || []).slice(0, 4)
  return (
    <div onClick={onClick} className={`h-full w-[min(74vh,21rem)] flex flex-col overflow-hidden opacity-90 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className="text-[0.7rem] uppercase leading-none tracking-widest text-white/45">Nouveau film disponible</div>
      <div className="mt-2.5 flex gap-3">
        {movie.thumb ? (
          <img src={movie.thumb} alt="" className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-[11.5rem] aspect-[2/3] shrink-0 rounded-md bg-white/10" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="line-clamp-3 text-2xl font-medium leading-tight text-white/95">{movie.title}</div>
          {details && <div className="text-sm text-white/55">{details}</div>}
          {movie.genres?.length > 0 && <div className="truncate text-xs text-white/45">{[...new Set(movie.genres.map((g) => GENRES_FR[g] || g))].slice(0, 3).join(', ')}</div>}
          {movie.addedAt && <div className="text-xs text-white/45">Ajouté {shortAgo(Number(movie.addedAt))}</div>}
        </div>
      </div>
      {movie.summary && <p className="mt-2 line-clamp-5 text-[0.82rem] leading-[1.1rem] text-white/65">{movie.summary}</p>}
      {cast.length > 0 && (
        <div className="mt-auto flex justify-between pt-2">
          {cast.map((actor) => (
            <Actor key={actor.name} actor={actor} />
          ))}
        </div>
      )}
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
  const { now, time, date } = useClock() // ticks every second
  // Weather only when it's complete: a partial answer must not take the screensaver down
  const current = weather?.current?.main && weather.current.weather?.[0] ? weather.current : null
  const [index, setIndex] = useState(0)

  useEffect(() => {
    window.addEventListener('keydown', onWake)
    return () => window.removeEventListener('keydown', onWake)
  }, [onWake])

  // Follows the clock (every second), so the fresh window and midnight come by themselves
  const nowSeconds = now / 1000
  const { chronological, fresh, rotation } = screensaverItems({ notes, movies, hasNew, postitRange, movieDays, now })
  const latestId = chronological[0]?.id
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

  // Under the item, one short segment per item, like "stories": the ones already shown are full, the current one
  // fills up until the next (restarted with the timer through its key; just full when nothing moves by itself).
  // A single bar emptying under the content looked like a scrollbar.
  // A tap on a segment shows that item (the touch target is much taller than the 3 px line).
  const countdown = browsable && (
    <div className="mt-0.5 flex w-full">
      {rotation.map((entry, i) => (
        <button
          key={entry.id}
          onClick={(event) => {
            event.stopPropagation() // keeps the screen asleep, like the arrows
            setIndex(i)
          }}
          aria-label={`Élément ${i + 1} sur ${count}`}
          className="flex-1 px-0.5 py-2.5"
        >
          <div className="h-[3px] overflow-hidden rounded-full bg-white/15">
            {i < position && <div className="h-full w-full bg-white/40" />}
            {i === position && (
              <div
                key={`${index}-${count}`}
                className={`h-full w-full rounded-full ${postitSeconds > 0 ? 'animate-countdown' : ''} ${isLatest ? 'bg-sky-400/80' : 'bg-white/60'}`}
                style={postitSeconds > 0 ? { animationDuration: `${duration}ms` } : undefined}
              />
            )}
          </div>
        </button>
      ))}
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
        <>
        {/* A movie brings its scene behind the right side: dimmed, fading into the black towards the clock */}
        {movie?.art && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[62%] overflow-hidden">
            <img key={item.id} src={movie.art} alt="" className="h-full w-full object-cover opacity-55" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/30 to-black/5" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
          </div>
        )}
        <div className="relative flex items-center justify-center gap-8 px-4">
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[7rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
            <div className="mt-3 text-xl capitalize text-white/50">{date}</div>
            {weatherLine}
            {agendaLine}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {arrows('prev')}
            <div className="flex flex-col">
              <div className={`flex ${STAGE_HEIGHT} items-center justify-center`}>
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
              </div>
              {countdown}
              {/* Under post-its only; under a movie it keeps its room (invisible), so nothing moves from one to the other */}
              {onAddNote && (
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddNote()
                  }}
                  disabled={!note}
                  className={`self-end px-1 font-hand text-xl font-semibold text-white/60 active:text-white ${note ? '' : 'invisible'}`}
                >
                  Ajouter un post-it !
                </button>
              )}
            </div>
            {arrows('next')}
          </div>
        </div>
        </>
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
