import { useClock } from '../hooks/useClock'

export default function Clock() {
  const { time, date } = useClock()

  return (
    <div className="text-center">
      <div className="text-6xl font-light tracking-wide">{time}</div>
      <div className="mt-1 text-lg font-light capitalize text-white/70">
        {date}
      </div>
    </div>
  )
}
