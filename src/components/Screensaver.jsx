import { useEffect, useState } from 'react'
import { useClock } from '../hooks/useClock'
import PostitNote from './postit/Note'
import ArrowButton from './ArrowButton'
import Stamp from './postit/Stamp'

const NOTE_ROTATE_MS = 30 * 1000
const FRESH_SECONDS = 5 * 60 // a note that just arrived is shown first for this long

// Minimal night-stand screen: big clock, date, current weather and one post-it, on pure black.
// A post-it with a photo gets the stage instead: clock on the left, the note big on the right.
export default function Screensaver({ weather, notes = [], hasNew = false, onWake, onOpenNote }) {
  const { time, date } = useClock()
  const current = weather?.current
  const [index, setIndex] = useState(0)

  useEffect(() => {
    window.addEventListener('keydown', onWake)
    return () => window.removeEventListener('keydown', onWake)
  }, [onWake])

  // Fresh = arrived in the last few minutes and not looked at yet (hasNew: nobody opened the Post-it
  // tab since). While there are some, only they are shown, newest first; then the normal rotation.
  // This component re-renders every second (clock), so the window closes by itself.
  // Newest first, whatever the API order (it lists pinned notes first): "the latest posted" is then
  // simply the first one, and the arrows walk back in time from there.
  const chronological = [...notes].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
  const latestId = chronological[0]?.id
  const nowSeconds = Date.now() / 1000
  const fresh = hasNew ? chronological.filter((n) => nowSeconds - n.createdAt < FRESH_SECONDS) : []
  const rotation = fresh.length > 0 ? fresh : chronological
  const freshKey = fresh.map((n) => n.id).join(',')

  useEffect(() => {
    setIndex(0) // a new arrival starts the rotation at the newest note
  }, [freshKey])

  // Re-armed whenever the note changes, by itself or by hand: the note you just moved to stays 30 s
  useEffect(() => {
    if (rotation.length <= 1) return
    const count = rotation.length
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), NOTE_ROTATE_MS) // wraps back to the newest
    return () => clearTimeout(timer)
  }, [rotation.length, index])

  const count = rotation.length
  const position = count > 0 ? index % count : 0
  const note = count > 0 ? rotation[position] : null
  const browsable = count > 1

  // The latest posted note wears a stamp (only meaningful when there are other notes). It replaces the
  // "nouveau" pill on that note; the other fresh notes keep the pill.
  const isLatest = Boolean(note) && note.id === latestId && chronological.length > 1

  // Arrows browse the notes and keep the screen asleep, so they must not bubble up to the wake-up tap.
  // By hand they stop at both ends (no left arrow on the latest note); only the automatic rotation wraps.
  const go = (delta) => (event) => {
    event.stopPropagation()
    setIndex((i) => Math.min(count - 1, Math.max(0, (i % count) + delta))) // from the current position, even on rapid taps
  }
  const arrows = (direction) =>
    browsable && (
      <ArrowButton
        direction={direction}
        enabled={direction === 'prev' ? position > 0 : position < count - 1}
        label={direction === 'prev' ? 'Post-it précédent' : 'Post-it suivant'}
        onClick={go(direction === 'prev' ? -1 : 1)}
      />
    )
  const withPhoto = Boolean(note?.photo)

  // A tap on the note opens it (the dashboard wakes up on the Post-it tab); anywhere else just wakes
  function openNote(event) {
    if (!onOpenNote) return
    event.stopPropagation()
    onOpenNote(note)
  }

  const weatherLine = current && (
    <div className={`flex items-center gap-3 text-white/60 ${withPhoto ? 'mt-4' : 'mt-6'}`}>
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
      {withPhoto ? (
        <div className="flex items-center justify-center gap-8 px-4">
          <div className="flex min-w-0 flex-col items-center">
            <div className="text-[7rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
            <div className="mt-3 text-xl capitalize text-white/50">{date}</div>
            {weatherLine}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {arrows('prev')}
            <div onClick={openNote} className={`relative opacity-90 ${onOpenNote ? 'cursor-pointer' : ''}`}>
              <PostitNote note={note} size="lg" rotate={-1} showDate className="h-[min(80vh,22rem)] aspect-square" />
              {isLatest && <Stamp key={note.id} big />}
              {newBadge}
            </div>
            {arrows('next')}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="text-[9rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
          <div className="mt-4 text-2xl capitalize text-white/50">{date}</div>
          {weatherLine}
          {note && (
            <div className="mt-6 flex items-center gap-1">
              {arrows('prev')}
              <div onClick={openNote} className={`relative w-[26rem] max-w-[80vw] opacity-80 ${onOpenNote ? 'cursor-pointer' : ''}`}>
                <PostitNote note={note} size="sm" rotate={-1} showDate />
                {isLatest && <Stamp key={note.id} />}
                {newBadge}
              </div>
              {arrows('next')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
