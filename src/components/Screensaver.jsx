import { useEffect } from 'react'
import { useClock } from '../hooks/useClock'

// Minimal night-stand screen: big clock, date and current weather on pure black
export default function Screensaver({ weather, onWake }) {
  const { time, date } = useClock()
  const current = weather?.current

  useEffect(() => {
    window.addEventListener('keydown', onWake)
    return () => window.removeEventListener('keydown', onWake)
  }, [onWake])

  return (
    <div
      onClick={onWake}
      className="visible fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center select-none"
    >
      <div className="text-[9rem] leading-none font-extralight tabular-nums text-white/85">{time}</div>
      <div className="mt-4 text-2xl capitalize text-white/50">{date}</div>
      {current && (
        <div className="mt-8 flex items-center gap-3 text-white/60">
          <img
            src={`https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`}
            alt=""
            className="w-12 h-12"
          />
          <span className="text-3xl font-light">{Math.round(current.main.temp)}°</span>
          <span className="text-lg capitalize text-white/40">{current.weather[0].description}</span>
        </div>
      )}
    </div>
  )
}
