import { useClock } from '../hooks/useClock'

export default function Clock() {
  const { time, date } = useClock()

  return (
    <div className="text-center">
      <div className="text-4xl font-light tracking-wide">{time}</div>
      <div className="text-sm font-light capitalize text-white/70">
        {date}
      </div>
    </div>
  )
}
