import { useEffect, useState } from 'react'
import { useClock } from '../hooks/useClock'
import PostitNote from './postit/Note'

const NOTE_ROTATE_MS = 30 * 1000

// Minimal night-stand screen: big clock, date, current weather and one post-it, on pure black
export default function Screensaver({ weather, notes = [], hasNew = false, onWake }) {
  const { time, date } = useClock()
  const current = weather?.current
  const [index, setIndex] = useState(0)

  useEffect(() => {
    window.addEventListener('keydown', onWake)
    return () => window.removeEventListener('keydown', onWake)
  }, [onWake])

  useEffect(() => {
    if (notes.length <= 1) return
    const timer = setInterval(() => setIndex((i) => i + 1), NOTE_ROTATE_MS)
    return () => clearInterval(timer)
  }, [notes.length])

  const note = notes.length > 0 ? notes[index % notes.length] : null

  return (
    <div
      onClick={onWake}
      className="visible fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-none"
    >
      <div className="text-[9rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
      <div className="mt-4 text-2xl capitalize text-white/50">{date}</div>
      {current && (
        <div className="mt-6 flex items-center gap-3 text-white/60">
          <img
            src={`https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`}
            alt=""
            className="w-12 h-12"
          />
          <span className="text-3xl font-light">{Math.round(current.main.temp)}°</span>
          <span className="text-lg capitalize text-white/40">{current.weather[0].description}</span>
        </div>
      )}
      {note && (
        <div className="relative mt-6 w-[26rem] max-w-[90vw] opacity-80">
          <PostitNote note={note} size="sm" rotate={-1} />
          {hasNew && (
            <span className="absolute -top-2 -right-2 rounded-full bg-sky-400 px-2 py-0.5 text-xs font-semibold text-black">
              nouveau
            </span>
          )}
        </div>
      )}
    </div>
  )
}
