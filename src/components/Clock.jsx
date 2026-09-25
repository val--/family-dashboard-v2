import { useClock } from '../hooks/useClock'

export default function Clock() {
  const { time, shortDate } = useClock()

  return (
    <div>
      <div className="text-4xl font-light leading-none tracking-wide">{time}</div>
      <div className="mt-1 text-sm capitalize text-white/70">{shortDate}</div>
    </div>
  )
}
