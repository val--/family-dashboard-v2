import { useClock } from '../hooks/useClock'

export default function Clock() {
  const { time, date } = useClock()

  return (
    <div className="text-center">
      <div className="text-3xl font-light tracking-wide">{time}</div>
      <div className="text-xs font-light capitalize text-white/70">
        {date}
      </div>
    </div>
  )
}
